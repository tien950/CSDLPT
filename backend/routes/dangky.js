import express from 'express';
import sql from 'mssql';
import { getPool } from '../config/db.js';
import { isValidNode, normalizeNodeKey, getHeadquarterId, getNodes } from '../config/nodes.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';
import { clearStudentCache } from '../utils/queryCache.js';

const router = express.Router();

const ID_TYPE = sql.NVarChar(50);

function sendError(res, error) {
  if (isOfflineError(error)) {
    const node = error.node ?? 'UNKNOWN';
    return res.status(503).json({
      success: false,
      message: `Node ${node} đang offline.`,
      node,
      status: 'offline'
    });
  }

  const status = error.status ?? 500;
  const message = error.message ?? 'Có lỗi xảy ra.';
  return res.status(status).json({
    success: false,
    message
  });
}

async function safeGetPool(nodeKey) {
  try {
    return await getPool(nodeKey);
  } catch (error) {
    throw withNode(nodeKey, error);
  }
}

async function runOnNode(nodeKey, task) {
  try {
    return await task();
  } catch (error) {
    throw withNode(nodeKey, error);
  }
}

// Generate next registration ID
async function generateRegId(pool, nodeKey) {
   const request = createRequest(nodeKey, null, pool);
      // Use TRY_CAST to avoid errors when ID_registration contains non-numeric suffixes
      // (e.g. values created by sync processes). Also ensure we only consider IDs
      // that start with 'REG' and have a digit at the 4th position.
      const result = await request.query(
        `SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(ID_registration, 4, 10) AS INT)), 0) + 1 AS nextNum
         FROM registration
         WHERE ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS LIKE 'REG[0-9]%'
           OR (ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS LIKE 'REG%'
               AND TRY_CAST(SUBSTRING(ID_registration, 4, 10) AS INT) IS NOT NULL)`
      );
   const nextNum = result.recordset[0]?.nextNum || 1;
   return 'REG' + String(nextNum).padStart(6, '0');
 }

async function fetchStudentHeadquarterId(nodeKey, studentId) {
    const pool = await safeGetPool(nodeKey);
    const request = createRequest(nodeKey, null, pool);
    request.input('studentId', ID_TYPE, studentId);
    try {
      const result = await request.query(
        `SELECT h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS AS headquarterId
         FROM student s
         JOIN department d ON d.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS = s.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS
         JOIN headquarter h ON h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS = d.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS
         WHERE s.ID_student COLLATE SQL_Latin1_General_CP1_CI_AS = @studentId COLLATE SQL_Latin1_General_CP1_CI_AS`
      );
      return result.recordset[0]?.headquarterId ?? null;
    } catch (error) {
      throw withNode(nodeKey, error);
    }
  }

  async function fetchClassHeadquarterId(nodeKey, classId) {
    const pool = await safeGetPool(nodeKey);
    const request = createRequest(nodeKey, null, pool);
    request.input('classId', ID_TYPE, classId);
    try {
      const result = await request.query(
        `SELECT h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS AS headquarterId
         FROM class c
         JOIN teacher t ON t.ID_teacher = c.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS
         JOIN department d ON d.ID_department = t.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS
         JOIN headquarter h ON h.ID_headquarter = d.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS
         WHERE c.ID_class = @classId COLLATE SQL_Latin1_General_CP1_CI_AS`
      );
      return result.recordset[0]?.headquarterId ?? null;
    } catch (error) {
      throw withNode(nodeKey, error);
    }
  }

async function fetchAvailableClasses(nodeKey, termId) {
   const pool = await safeGetPool(nodeKey);
   const request = createRequest(nodeKey, null, pool);
   if (termId) {
     request.input('termId', ID_TYPE, termId);
   }

   const termFilter = termId
     ? 'AND c.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS = @termId COLLATE SQL_Latin1_General_CP1_CI_AS'
     : '';

   try {
     const result = await request.query(
       `SELECT
          c.ID_class AS ID_class,
          c.group_number AS group_number,
          c.max_students AS max_students,
          c.number_of_registration AS number_of_registration,
          (c.max_students - c.number_of_registration) AS remaining,
          c.class_status AS class_status,
          c.ID_term AS ID_term,
          s.ID_subject AS ID_subject,
          s.name_subject AS name_subject,
          s.number_of_credit AS number_of_credit,
          t.ID_teacher AS ID_teacher,
          t.name_teacher AS name_teacher,
          h.ID_headquarter AS ID_headquarter
        FROM [class] c
        JOIN subject s ON s.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS
        JOIN teacher t ON t.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS
        JOIN department d ON d.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS = t.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS
        JOIN headquarter h ON h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS = d.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE c.class_status COLLATE SQL_Latin1_General_CP1_CI_AS = 'OPEN'
          AND c.max_students > c.number_of_registration
          ${termFilter}
        ORDER BY c.ID_class`
     );
     return result.recordset;
   } catch (error) {
     throw withNode(nodeKey, error);
   }
 }

router.post('/', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const { maLop, maCSLop } = req.body ?? {};
  const maSV = req.user?.id;
  const maCS = normalizeNodeKey(req.user?.maCS);
  const maCSLopNormalized = normalizeNodeKey(maCSLop);

  const headquarterStudent = (await fetchStudentHeadquarterId(maCS, maSV))
    ?? getHeadquarterId(maCS)
    ?? maCS;
  const headquarterClass = (await fetchClassHeadquarterId(maCSLopNormalized, maLop))
    ?? getHeadquarterId(maCSLopNormalized)
    ?? maCSLopNormalized;

  if (!maSV || !maCS) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin sinh viên trong token.'
    });
  }

  if (!maLop || !maCSLop) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu mã lớp hoặc mã cơ sở lớp học phần.'
    });
  }

  if (!isValidNode(maCS) || !isValidNode(maCSLopNormalized)) {
    return res.status(400).json({
      success: false,
      message: 'Mã cơ sở không hợp lệ.'
    });
  }

   // Same campus registration
   if (maCS === maCSLopNormalized) {
     try {
       const pool = await safeGetPool(maCS);

       // 1. Check conditions using stored procedure
       const checkRequest = createRequest(maCS, null, pool);
       checkRequest.input('ID_student', ID_TYPE, maSV);
       checkRequest.input('ID_class', ID_TYPE, maLop);
       checkRequest.input('ID_headquarter', ID_TYPE, headquarterStudent);

       let checkResult;
       try {
         checkResult = await checkRequest.execute('usp_CheckRegisterCondition');
       } catch (error) {
         throw withNode(maCS, error);
       }
       const isValid = checkResult.recordset[0]?.is_valid;
       const message = checkResult.recordset[0]?.message;

       if (!isValid) {
         return res.status(400).json({
           success: false,
           message: message || 'Không thể đăng ký lớp này.'
         });
       }

       // 2. Generate registration ID
       const regId = await generateRegId(pool, maCS);

       // 3. Register using stored procedure
       const regRequest = createRequest(maCS, null, pool);
       regRequest.input('ID_registration', ID_TYPE, regId);
       regRequest.input('ID_student', ID_TYPE, maSV);
       regRequest.input('ID_class', ID_TYPE, maLop);
       regRequest.input('ID_headquarter', ID_TYPE, headquarterStudent);

        try {
          await regRequest.execute('usp_RegisterClass');
        } catch (error) {
          throw withNode(maCS, error);
        }

        // Clear cache for this student
        clearStudentCache(maSV, maCS);

        return res.json({
          success: true,
          data: {
            maDangKy: regId,
            maSV,
            maLop,
            maCS
          }
        });
     } catch (error) {
       return sendError(res, error);
     }
   }

   // Cross-campus registration (2PC pattern)
   let transactionStudent;
   let transactionClass;
   try {
     const poolStudent = await safeGetPool(maCS);
     const poolClass = await safeGetPool(maCSLopNormalized);

     // 1. Check conditions on both nodes
     const checkStudentReq = createRequest(maCS, null, poolStudent);
     checkStudentReq.input('ID_student', ID_TYPE, maSV);
     checkStudentReq.input('ID_class', ID_TYPE, maLop);
     checkStudentReq.input('ID_headquarter', ID_TYPE, headquarterStudent);
     let checkStudentResult;
     try {
       checkStudentResult = await checkStudentReq.execute('usp_CheckRegisterCondition');
     } catch (error) {
       throw withNode(maCS, error);
     }

     const checkClassReq = createRequest(maCSLopNormalized, null, poolClass);
     checkClassReq.input('ID_student', ID_TYPE, maSV);
     checkClassReq.input('ID_class', ID_TYPE, maLop);
     checkClassReq.input('ID_headquarter', ID_TYPE, headquarterClass);
     let checkClassResult;
     try {
       checkClassResult = await checkClassReq.execute('usp_CheckRegisterCondition');
     } catch (error) {
       throw withNode(maCSLopNormalized, error);
     }

     if (!checkStudentResult.recordset[0]?.is_valid) {
       return res.status(400).json({
         success: false,
         message: checkStudentResult.recordset[0]?.message || 'Không thể đăng ký lớp này.'
       });
     }

     if (!checkClassResult.recordset[0]?.is_valid) {
       return res.status(400).json({
         success: false,
         message: checkClassResult.recordset[0]?.message || 'Không thể đăng ký lớp này.'
       });
     }

     // 2. Generate registration ID (on student's node)
     const regId = await generateRegId(poolStudent, maCS);

     // 3. Begin transactions
     transactionStudent = new sql.Transaction(poolStudent);
     transactionClass = new sql.Transaction(poolClass);

     await transactionStudent.begin();
     await transactionClass.begin();

     // 4. Register on student's node
     const regStudentReq = createRequest(maCS, transactionStudent);
     regStudentReq.input('ID_registration', ID_TYPE, regId);
     regStudentReq.input('ID_student', ID_TYPE, maSV);
     regStudentReq.input('ID_class', ID_TYPE, maLop);
     regStudentReq.input('ID_headquarter', ID_TYPE, headquarterStudent);
     try {
       await regStudentReq.execute('usp_RegisterClass');
     } catch (error) {
       throw withNode(maCS, error);
     }

      // 5. Increment on class's node
      const updateClassReq = createRequest(maCSLopNormalized, transactionClass);
      updateClassReq.input('ID_class', ID_TYPE, maLop);
      try {
        await updateClassReq.query(
          `UPDATE [class]
           SET number_of_registration = number_of_registration + 1
           WHERE ID_class COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_class COLLATE SQL_Latin1_General_CP1_CI_AS`
        );
      } catch (error) {
        throw withNode(maCSLopNormalized, error);
      }

      await transactionStudent.commit();
      try {
        await transactionClass.commit();
      } catch (error) {
        // Rollback student transaction if class update fails
        await runOnNode(maCS, async () => {
          const pool = await safeGetPool(maCS);
         const deleteReq = createRequest(maCS, null, pool);
           deleteReq.input('ID_registration', ID_TYPE, regId);
           await deleteReq.query(
             `DELETE FROM registration WHERE ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS`
           );
        }).catch(() => undefined);
        throw withNode(maCSLopNormalized, error);
      }

      // Clear cache for this student
      clearStudentCache(maSV, maCS);

      return res.json({
        success: true,
        data: {
          maDangKy: regId,
          maSV,
          maLop,
          maCS,
          maCSLop: maCSLopNormalized
        }
      });
   } catch (error) {
     if (transactionStudent) {
       await transactionStudent.rollback().catch(() => undefined);
     }
     if (transactionClass) {
       await transactionClass.rollback().catch(() => undefined);
     }
     return sendError(res, error);
   }
});

router.post('/cancel', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const { maDangKy } = req.body ?? {};
  const maSV = req.user?.id;
  const maCS = normalizeNodeKey(req.user?.maCS);

  const headquarterId = (await fetchStudentHeadquarterId(maCS, maSV))
    ?? getHeadquarterId(maCS)
    ?? maCS;

  if (!maSV || !maCS) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin sinh viên.'
    });
  }

  if (!maDangKy) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu mã đăng ký.'
    });
  }

   try {
     const pool = await safeGetPool(maCS);

     // 1. Verify registration belongs to student
     const verifyReq = createRequest(maCS, null, pool);
     verifyReq.input('ID_registration', ID_TYPE, maDangKy);
     verifyReq.input('ID_student', ID_TYPE, maSV);
     let verifyResult;
     try {
       verifyResult = await verifyReq.query(
         `SELECT ID_class, registration_status FROM registration 
          WHERE ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS 
            AND ID_student COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_student COLLATE SQL_Latin1_General_CP1_CI_AS`
       );
     } catch (error) {
       throw withNode(maCS, error);
     }

     if (verifyResult.recordset.length === 0) {
       return res.status(404).json({
         success: false,
         message: 'Không tìm thấy đăng ký.'
       });
     }

     const regStatus = verifyResult.recordset[0].registration_status;
     if (regStatus === 'CANCELLED') {
       return res.status(400).json({
         success: false,
         message: 'Đăng ký này đã bị hủy rồi.'
       });
     }

      // 2. Cancel registration using stored procedure
      const cancelReq = createRequest(maCS, null, pool);
      cancelReq.input('ID_registration', ID_TYPE, maDangKy);
      cancelReq.input('ID_headquarter', ID_TYPE, headquarterId);

      try {
        await cancelReq.execute('usp_CancelRegistration');
      } catch (error) {
        throw withNode(maCS, error);
      }

      // Clear cache for this student
      clearStudentCache(maSV, maCS);

      return res.json({
        success: true,
        message: 'Hủy đăng ký thành công.'
      });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.delete('/:maDangKy', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const maDangKy = req.params.maDangKy;
  const maSV = req.user?.id;
  const maCS = normalizeNodeKey(req.user?.maCS);
  const headquarterId = normalizeNodeKey(req.body?.ID_headquarter_sv ?? req.query.ID_headquarter_sv)
    ?? (await fetchStudentHeadquarterId(maCS, maSV))
    ?? getHeadquarterId(maCS)
    ?? maCS;

  if (!maSV || !maCS) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin sinh viên.'
    });
  }

  if (!maDangKy) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu mã đăng ký.'
    });
  }

   try {
     const pool = await safeGetPool(maCS);

     const verifyReq = createRequest(maCS, null, pool);
     verifyReq.input('ID_registration', ID_TYPE, maDangKy);
     verifyReq.input('ID_student', ID_TYPE, maSV);
     let verifyResult;
     try {
       verifyResult = await verifyReq.query(
         `SELECT ID_class, registration_status FROM registration 
          WHERE ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS 
            AND ID_student COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_student COLLATE SQL_Latin1_General_CP1_CI_AS`
       );
     } catch (error) {
       throw withNode(maCS, error);
     }

     if (verifyResult.recordset.length === 0) {
       return res.status(404).json({
         success: false,
         message: 'Không tìm thấy đăng ký.'
       });
     }

     const regStatus = verifyResult.recordset[0].registration_status;
     if (regStatus === 'CANCELLED') {
       return res.status(400).json({
         success: false,
         message: 'Đăng ký này đã bị hủy rồi.'
       });
     }

      const cancelReq = createRequest(maCS, null, pool);
      cancelReq.input('ID_registration', ID_TYPE, maDangKy);
      cancelReq.input('ID_headquarter', ID_TYPE, headquarterId);
      try {
        await cancelReq.execute('usp_CancelRegistration');
      } catch (error) {
        throw withNode(maCS, error);
      }

      // Clear cache for this student
      clearStudentCache(maSV, maCS);

      return res.json({
        success: true,
        message: 'Hủy đăng ký thành công.'
      });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/available', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const termId = req.query.ID_term ?? null;
  try {
    const nodes = getNodes();
    const results = [];
    const offlineNodes = [];

    await Promise.all(Object.keys(nodes).map(async nodeKey => {
      try {
        const rows = await fetchAvailableClasses(nodeKey, termId);
        rows.forEach(row => {
          results.push({
            ...row,
            node: nodeKey
          });
        });
      } catch (error) {
        const nodeError = withNode(nodeKey, error);
        if (isOfflineError(nodeError)) {
          offlineNodes.push(nodeKey);
          return;
        }
        throw nodeError;
      }
    }));

    return res.json({
      success: true,
      data: results,
      meta: {
        offlineNodes
      }
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/result', authenticate, requireRole(['sinhvien', 'nhanvien', 'quantrivien']), async (req, res) => {
  const role = req.user?.role;
  let studentId = req.query.ID_student;
  let headquarterId = normalizeNodeKey(req.query.ID_headquarter ?? req.query.maCS ?? req.user?.maCS);

  if (role === 'sinhvien') {
    studentId = req.user?.id;
    headquarterId = normalizeNodeKey(req.user?.maCS);
  }

  if (!studentId || !headquarterId) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin sinh viên hoặc cơ sở.' });
  }

  if (!isValidNode(headquarterId)) {
    return res.status(400).json({ success: false, message: 'Mã cơ sở không hợp lệ.' });
  }

   try {
     const pool = await safeGetPool(headquarterId);
     const request = createRequest(headquarterId, null, pool);
     request.input('ID_student', ID_TYPE, studentId);
     request.input('ID_headquarter', ID_TYPE, headquarterId);
     let result;
     try {
       result = await request.execute('usp_GetRegistrationResult');
     } catch (error) {
       throw withNode(headquarterId, error);
     }

     return res.json({
       success: true,
       data: result.recordset
     });
   } catch (error) {
     return sendError(res, error);
   }
});

export default router;
