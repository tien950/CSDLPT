import express from 'express';
import sql from 'mssql';
import { getPool } from '../config/db.js';
import { isValidNode, normalizeNodeKey, getHeadquarterId } from '../config/nodes.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';

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
  const result = await request.query(
    `SELECT ISNULL(MAX(CAST(SUBSTRING(ID_registration, 4, 10) AS INT)), 0) + 1 AS nextNum 
     FROM registration
     WHERE ID_registration LIKE 'REG%'`
  );
  const nextNum = result.recordset[0]?.nextNum || 1;
  return 'REG' + String(nextNum).padStart(6, '0');
}

async function fetchStudentHeadquarterId(nodeKey, studentId) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('studentId', ID_TYPE, studentId);
  const result = await request.query(
    `SELECT h.ID_headquarter AS headquarterId
     FROM student s
     JOIN department d ON d.ID_department = s.ID_department
     JOIN headquarter h ON h.ID_headquarter = d.ID_headquarter
     WHERE s.ID_student = @studentId`
  );
  return result.recordset[0]?.headquarterId ?? null;
}

async function fetchClassHeadquarterId(nodeKey, classId) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('classId', ID_TYPE, classId);
  const result = await request.query(
    `SELECT h.ID_headquarter AS headquarterId
     FROM class c
     JOIN teacher t ON t.ID_teacher = c.ID_teacher
     JOIN department d ON d.ID_department = t.ID_department
     JOIN headquarter h ON h.ID_headquarter = d.ID_headquarter
     WHERE c.ID_class = @classId`
  );
  return result.recordset[0]?.headquarterId ?? null;
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

      const checkResult = await checkRequest.execute('usp_CheckRegisterCondition');
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

      await regRequest.execute('usp_RegisterClass');

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
    const checkStudentResult = await checkStudentReq.execute('usp_CheckRegisterCondition');

    const checkClassReq = createRequest(maCSLopNormalized, null, poolClass);
    checkClassReq.input('ID_student', ID_TYPE, maSV);
    checkClassReq.input('ID_class', ID_TYPE, maLop);
    checkClassReq.input('ID_headquarter', ID_TYPE, headquarterClass);
    const checkClassResult = await checkClassReq.execute('usp_CheckRegisterCondition');

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
    await regStudentReq.execute('usp_RegisterClass');

    // 5. Increment on class's node
    const updateClassReq = createRequest(maCSLopNormalized, transactionClass);
    updateClassReq.input('ID_class', ID_TYPE, maLop);
    await updateClassReq.query(
      `UPDATE [class]
       SET number_of_registration = number_of_registration + 1
       WHERE ID_class = @ID_class`
    );

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
          `DELETE FROM registration WHERE ID_registration = @ID_registration`
        );
      }).catch(() => undefined);
      throw error;
    }

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
    const verifyResult = await verifyReq.query(
      `SELECT ID_class, registration_status FROM registration 
       WHERE ID_registration = @ID_registration AND ID_student = @ID_student`
    );

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

    await cancelReq.execute('usp_CancelRegistration');

    return res.json({
      success: true,
      message: 'Hủy đăng ký thành công.'
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
