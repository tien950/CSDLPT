import express from 'express';
import sql from 'mssql';
import { getPool } from '../config/db.js';
import { LOCAL_NODE, normalizeNodeKey, getHeadquarterId, isValidNode } from '../config/nodes.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';
import { clearStudentCache } from '../utils/queryCache.js';
import { callRemoteNode } from '../utils/remoteApi.js';
const router = express.Router();
const ID_TYPE = sql.NVarChar(50);
function sendError(res, error) {
  if (isOfflineError(error) || error.offline) {
    const node = error.node ?? 'UNKNOWN';
    return res.status(503).json({
      success: false,
      message: `Node ${node} hiện không khả dụng`,
      node,
      offline: true
    });
  }
  return res.status(error.status ?? 500).json({
    success: false,
    message: error.message ?? 'Có lỗi xảy ra.',
    node: error.node ?? LOCAL_NODE ?? 'UNKNOWN'
  });
}
async function safeGetPool(nodeKey) {
  try {
    return await getPool(nodeKey);
  } catch (error) {
    throw withNode(nodeKey, error);
  }
}
async function generateRegId(pool, nodeKey) {
  const request = createRequest(nodeKey, null, pool);
  const result = await request.query(
    `SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(ID_registration, 4, 10) AS INT)), 0) + 1 AS nextNum
     FROM registration
     WHERE ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS LIKE 'REG[0-9]%'
        OR (ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS LIKE 'REG%'
            AND TRY_CAST(SUBSTRING(ID_registration, 4, 10) AS INT) IS NOT NULL)`
  );
  return 'REG' + String(result.recordset[0]?.nextNum ?? 1).padStart(6, '0');
}
async function fetchStudentHeadquarterId(nodeKey, studentId) {
  try {
    const pool = await safeGetPool(nodeKey);
    const request = createRequest(nodeKey, null, pool);
    request.input('studentId', ID_TYPE, studentId);
    const result = await request.query(
      `SELECT h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS AS headquarterId
       FROM student s
       JOIN department d ON d.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS = s.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS
       JOIN headquarter h ON h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS = d.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS
       WHERE s.ID_student COLLATE SQL_Latin1_General_CP1_CI_AS = @studentId COLLATE SQL_Latin1_General_CP1_CI_AS`
    );
    return result.recordset[0]?.headquarterId ?? null;
  } catch (error) {
    console.warn(`[DB] fetchStudentHeadquarterId failed for ${nodeKey}: ${error.message}`);
    return null;
  }
}
async function fetchAvailableClasses(nodeKey, termId) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  if (termId) request.input('termId', ID_TYPE, termId);
  const termFilter = termId ? 'AND c.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS = @termId COLLATE SQL_Latin1_General_CP1_CI_AS' : '';
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
}
async function getClassById(nodeKey, classId) {
  if (normalizeNodeKey(nodeKey) !== normalizeNodeKey(LOCAL_NODE)) {
    const remote = await callRemoteNode(nodeKey, 'GET', `/api/internal/lophocphan/${encodeURIComponent(classId)}`, null, null);
    if (!remote.ok) {
      const error = new Error(remote.data?.message ?? 'Không lấy được thông tin lớp học phần.');
      error.status = remote.status;
      error.node = nodeKey;
      throw error;
    }
    return remote.data?.data ?? null;
  }
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('classId', ID_TYPE, classId);
  const result = await request.query(
    `SELECT
       c.ID_class AS ID_class,
       c.group_number AS group_number,
       c.max_students AS max_students,
       c.number_of_registration AS number_of_registration,
       c.class_status AS class_status,
       c.ID_term AS ID_term,
       h.ID_headquarter AS ID_headquarter
     FROM [class] c
     JOIN teacher t ON t.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN department d ON d.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS = t.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN headquarter h ON h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS = d.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS
     WHERE c.ID_class COLLATE SQL_Latin1_General_CP1_CI_AS = @classId COLLATE SQL_Latin1_General_CP1_CI_AS`
  );
  return result.recordset[0] ?? null;
}
async function registerLocal(nodeKey, regId, studentId, classId, headquarterStudent) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('ID_registration', ID_TYPE, regId);
  request.input('ID_student', ID_TYPE, studentId);
  request.input('ID_class', ID_TYPE, classId);
  request.input('ID_headquarter', ID_TYPE, headquarterStudent);
  await request.execute('usp_RegisterClass');
}
async function deleteLocalRegistration(nodeKey, regId) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('ID_registration', ID_TYPE, regId);
  await request.query(
    `DELETE FROM registration
     WHERE ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS`
  );
}
async function updateLocalEnrollment(nodeKey, classId, delta) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('ID_class', ID_TYPE, classId);
  const updateSql = delta > 0
    ? `UPDATE [class] SET number_of_registration = number_of_registration + 1
       WHERE ID_class COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_class COLLATE SQL_Latin1_General_CP1_CI_AS`
    : `UPDATE [class] SET number_of_registration = CASE WHEN number_of_registration > 0 THEN number_of_registration - 1 ELSE 0 END
       WHERE ID_class COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_class COLLATE SQL_Latin1_General_CP1_CI_AS`;
  await request.query(updateSql);
}
router.get('/internal/node-ping', (req, res) => {
  return res.json({ success: true, node: LOCAL_NODE, status: 'ok' });
});
router.get('/internal/lophocphan', authenticate, async (req, res) => {
  try {
    const data = await fetchAvailableClasses(LOCAL_NODE, req.query.ID_term ?? null);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});
router.get('/internal/lophocphan/:id', authenticate, async (req, res) => {
  try {
    const data = await getClassById(LOCAL_NODE, req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học phần.' });
    }
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});
router.put('/internal/lophocphan/:id/enrollment', authenticate, async (req, res) => {
  try {
    await updateLocalEnrollment(LOCAL_NODE, req.params.id, 1);
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});
router.post('/internal/dangky', authenticate, async (req, res) => {
  const { ID_registration, ID_student, ID_class, ID_headquarter } = req.body ?? {};
  if (!ID_registration || !ID_student || !ID_class) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng ký.' });
  }
  try {
    await registerLocal(LOCAL_NODE, ID_registration, ID_student, ID_class, ID_headquarter ?? LOCAL_NODE);
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});
router.delete('/internal/dangky/:id', authenticate, async (req, res) => {
  try {
    await deleteLocalRegistration(LOCAL_NODE, req.params.id);
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});
router.post('/', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const { maLop, maCSLop } = req.body ?? {};
  const maSV = req.user?.id;
  const maCS = normalizeNodeKey(req.user?.maCS) ?? LOCAL_NODE;
  const maCSLopNormalized = normalizeNodeKey(maCSLop);
  if (!maSV || !maCS || !maLop || !maCSLopNormalized) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng ký.' });
  }
  if (!isValidNode(maCS) || !isValidNode(maCSLopNormalized)) {
    return res.status(400).json({ success: false, message: 'Mã cơ sở không hợp lệ.' });
  }
  const headquarterStudent = (await fetchStudentHeadquarterId(LOCAL_NODE, maSV)) ?? getHeadquarterId(LOCAL_NODE) ?? LOCAL_NODE;
  const classInfo = await getClassById(maCSLopNormalized, maLop);
  let regId = null;
  if (!classInfo || classInfo.class_status !== 'OPEN' || classInfo.number_of_registration >= classInfo.max_students) {
    return res.status(400).json({
      success: false,
      message: 'Lớp học phần đã đủ sĩ số, không mở đăng ký hoặc không thuộc cơ sở được chọn.'
    });
  }
  if (maCS === maCSLopNormalized) {
    try {
      const pool = await safeGetPool(LOCAL_NODE);
      const checkRequest = createRequest(LOCAL_NODE, null, pool);
      checkRequest.input('ID_student', ID_TYPE, maSV);
      checkRequest.input('ID_class', ID_TYPE, maLop);
      checkRequest.input('ID_headquarter', ID_TYPE, headquarterStudent);
      const checkResult = await checkRequest.execute('usp_CheckRegisterCondition');
      if (!checkResult.recordset[0]?.is_valid) {
        return res.status(400).json({ success: false, message: checkResult.recordset[0]?.message || 'Không thể đăng ký lớp này.' });
      }
      regId = await generateRegId(pool, LOCAL_NODE);
      await registerLocal(LOCAL_NODE, regId, maSV, maLop, headquarterStudent);
      clearStudentCache(maSV, LOCAL_NODE);
      return res.json({ success: true, data: { maDangKy: regId, maSV, maLop, maCS: LOCAL_NODE, maCSLop: maCSLopNormalized } });
    } catch (error) {
      return sendError(res, error);
    }
  }
  console.log('[2PC] Phase 1: PREPARE', LOCAL_NODE, '->', maCSLopNormalized);
  try {
    const pool = await safeGetPool(LOCAL_NODE);
    const checkRequest = createRequest(LOCAL_NODE, null, pool);
    checkRequest.input('ID_student', ID_TYPE, maSV);
    checkRequest.input('ID_class', ID_TYPE, maLop);
    checkRequest.input('ID_headquarter', ID_TYPE, headquarterStudent);
    const checkResult = await checkRequest.execute('usp_CheckRegisterCondition');
    if (!checkResult.recordset[0]?.is_valid) {
      return res.status(400).json({ success: false, message: checkResult.recordset[0]?.message || 'Không thể đăng ký lớp này.' });
    }
    regId = await generateRegId(pool, LOCAL_NODE);
    await registerLocal(LOCAL_NODE, regId, maSV, maLop, headquarterStudent);
    console.log('[2PC] Phase 2: COMMIT', LOCAL_NODE, '->', maCSLopNormalized);
    const remoteUpdate = await callRemoteNode(maCSLopNormalized, 'PUT', `/api/internal/lophocphan/${encodeURIComponent(maLop)}/enrollment`, null, req.headers.authorization);
    if (!remoteUpdate.ok) {
      throw new Error(remoteUpdate.data?.message || 'Không thể cập nhật sĩ số lớp học phần.');
    }
    clearStudentCache(maSV, LOCAL_NODE);
    return res.json({ success: true, data: { maDangKy: regId, maSV, maLop, maCS: LOCAL_NODE, maCSLop: maCSLopNormalized } });
  } catch (error) {
    console.log('[2PC] ROLLBACK — reason:', error.message);
    if (regId) {
      await deleteLocalRegistration(LOCAL_NODE, regId).catch(() => undefined);
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Không thể hoàn tất đăng ký lớp học phần.',
      node: maCSLopNormalized,
      offline: Boolean(error.offline)
    });
  }
});
router.post('/cancel', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const { maDangKy } = req.body ?? {};
  const maSV = req.user?.id;
  const maCS = normalizeNodeKey(req.user?.maCS) ?? LOCAL_NODE;
  if (!maSV || !maCS || !maDangKy) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin hủy đăng ký.' });
  }
  try {
    const pool = await safeGetPool(LOCAL_NODE);
    const verifyReq = createRequest(LOCAL_NODE, null, pool);
    verifyReq.input('ID_registration', ID_TYPE, maDangKy);
    verifyReq.input('ID_student', ID_TYPE, maSV);
    const verifyResult = await verifyReq.query(
      `SELECT ID_class, registration_status FROM registration
       WHERE ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS
         AND ID_student COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_student COLLATE SQL_Latin1_General_CP1_CI_AS`
    );
    if (verifyResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
    }
    if (verifyResult.recordset[0].registration_status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Đăng ký này đã bị hủy rồi.' });
    }
    const cancelReq = createRequest(LOCAL_NODE, null, pool);
    cancelReq.input('ID_registration', ID_TYPE, maDangKy);
    cancelReq.input('ID_headquarter', ID_TYPE, getHeadquarterId(LOCAL_NODE) ?? LOCAL_NODE);
    await cancelReq.execute('usp_CancelRegistration');
    clearStudentCache(maSV, LOCAL_NODE);
    return res.json({ success: true, message: 'Hủy đăng ký thành công.' });
  } catch (error) {
    return sendError(res, error);
  }
});
router.delete('/:maDangKy', authenticate, requireRole(['sinhvien']), async (req, res) => {
  try {
    await deleteLocalRegistration(LOCAL_NODE, req.params.maDangKy);
    return res.json({ success: true, message: 'Hủy đăng ký thành công.' });
  } catch (error) {
    return sendError(res, error);
  }
});
router.get('/available', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const termId = req.query.ID_term ?? null;
  try {
    const data = await fetchAvailableClasses(LOCAL_NODE, termId);
    return res.json({ success: true, data, meta: { offlineNodes: [] } });
  } catch (error) {
    return sendError(res, error);
  }
});
router.get('/result', authenticate, requireRole(['sinhvien', 'nhanvien', 'quantrivien']), async (req, res) => {
  const role = req.user?.role;
  let studentId = req.query.ID_student;
  const headquarterId = normalizeNodeKey(req.query.ID_headquarter ?? req.query.maCS ?? req.user?.maCS) ?? LOCAL_NODE;
  if (role === 'sinhvien') {
    studentId = req.user?.id;
  }
  if (!studentId || !headquarterId) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin sinh viên hoặc cơ sở.' });
  }
  try {
    const pool = await safeGetPool(LOCAL_NODE);
    const request = createRequest(LOCAL_NODE, null, pool);
    request.input('ID_student', ID_TYPE, studentId);
    request.input('ID_headquarter', ID_TYPE, headquarterId);
    const result = await request.execute('usp_GetRegistrationResult');
    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    return sendError(res, error);
  }
});
export default router;
