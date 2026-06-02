import express from 'express';
import sql from 'mssql';
import { getPool } from '../config/db.js';
import { LOCAL_NODE, nodeKeys, normalizeNodeKey, getHeadquarterId, isValidNode } from '../config/nodes.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';
import { clearStudentCache } from '../utils/queryCache.js';
import { callRemoteNode } from '../utils/remoteApi.js';
import { fetchNodeApiJson, getProxyHeaders, isProxyRequest } from '../utils/nodeProxy.js';
const router = express.Router();
const ID_TYPE = sql.NVarChar(50);
function sendError(res, error) {
  if (isOfflineError(error) || error.offline) {
    const node = error.node ?? 'UNKNOWN';
    return res.status(503).json({
      success: false,
      message: `Node ${node} hiện không khả dụng`,
      node,
      step: error.step,
      offline: true
    });
  }
  return res.status(error.status ?? 500).json({
    success: false,
    message: error.message ?? 'Có lỗi xảy ra.',
    step: error.step,
    node: error.node ?? LOCAL_NODE ?? 'UNKNOWN'
  });
}

async function timedStep(step, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > 500) {
      console.warn(`[DANGKY] ${step} took ${elapsedMs}ms`);
    }
    return result;
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    error.step = error.step ?? step;
    console.error(`[DANGKY] ${step} failed after ${elapsedMs}ms: ${error.code ?? ''} ${error.message}`);
    throw error;
  }
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
function buildRemotePath(path, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function isMissingProcedureError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('could not find stored procedure') || message.includes('usp_getclassesbycampus');
}

function getField(row, keys, fallback = null) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) {
      return row[key];
    }
  }
  return fallback;
}

function normalizeAvailableClassRow(row, fallbackNode = LOCAL_NODE) {
  const maCSRaw = getField(row, ['maCS', 'ID_headquarter', 'Mã cơ sở', 'Ma co so']);
  const maCS = normalizeNodeKey(maCSRaw) ?? normalizeNodeKey(fallbackNode) ?? LOCAL_NODE;
  const maLop = getField(row, ['maLop', 'ID_class', 'Mã lớp học phần', 'Ma lop hoc phan']);
  const maHocPhan = getField(row, ['maHocPhan', 'ID_subject', 'Mã học phần', 'Ma hoc phan']);
  const tenHocPhan = getField(row, ['tenHocPhan', 'name_subject', 'Tên học phần', 'Ten hoc phan']);
  const soTinChi = Number(getField(row, ['soTinChi', 'number_of_credit', 'Số tín chỉ', 'So tin chi'], 0)) || 0;
  const maGiangVien = getField(row, ['maGiangVien', 'ID_teacher', 'Mã giảng viên', 'Ma giang vien']);
  const tenGiangVien = getField(row, ['tenGiangVien', 'name_teacher', 'Giảng viên', 'Giang vien']);
  const nhom = getField(row, ['nhom', 'group_number', 'Nhóm lớp', 'Nhom lop']);
  const siSoDaDangKy = Number(getField(row, ['siSoDaDangKy', 'number_of_registration', 'Số lượng đã đăng ký', 'So luong da dang ky'], 0)) || 0;
  const siSoToiDa = Number(getField(row, ['siSoToiDa', 'max_students', 'Sĩ số tối đa', 'Si so toi da'], 0)) || 0;
  const choConLaiRaw = Number(getField(row, ['choConLai', 'remaining', 'So cho con lai'], siSoToiDa - siSoDaDangKy)) || 0;
  const choConLai = Math.max(choConLaiRaw, 0);
  const trangThai = getField(row, ['trangThai', 'class_status', 'Trạng thái lớp', 'Trang thai lop']);
  const ngayHoc = getField(row, ['ngayHoc', 'study_date', 'Ngày học', 'Ngay hoc']);
  const thu = getField(row, ['thu', 'day_of_week', 'Thứ', 'Thu']);
  const caHoc = getField(row, ['caHoc', 'shift_no', 'Ca học', 'Ca hoc']);
  const gioBatDau = getField(row, ['gioBatDau', 'start_time', 'Giờ bắt đầu', 'Gio bat dau']);
  const gioKetThuc = getField(row, ['gioKetThuc', 'end_time', 'Giờ kết thúc', 'Gio ket thuc']);
  const maPhong = getField(row, ['maPhong', 'ID_room', 'Mã phòng', 'Ma phong']);
  const phongHoc = getField(row, ['phongHoc', 'name_room', 'Phòng học', 'Phong hoc']);

  return {
    maCS,
    tenCoSo: getField(row, ['tenCoSo', 'name_headquarter', 'Cơ sở mở lớp', 'Co so mo lop']),
    maLop,
    maHocPhan,
    tenHocPhan,
    soTinChi,
    maGiangVien,
    tenGiangVien,
    nhom,
    siSoDaDangKy,
    siSoToiDa,
    choConLai,
    trangThai,
    ngayHoc,
    thu,
    caHoc,
    gioBatDau,
    gioKetThuc,
    maPhong,
    phongHoc,
    // backward-compatible keys
    ID_headquarter: maCS,
    ID_class: maLop,
    ID_subject: maHocPhan,
    name_subject: tenHocPhan,
    number_of_credit: soTinChi,
    ID_teacher: maGiangVien,
    name_teacher: tenGiangVien,
    group_number: nhom,
    number_of_registration: siSoDaDangKy,
    max_students: siSoToiDa,
    remaining: choConLai,
    class_status: trangThai,
    study_date: ngayHoc,
    day_of_week: thu,
    shift_no: caHoc,
    start_time: gioBatDau,
    end_time: gioKetThuc,
    ID_room: maPhong,
    name_room: phongHoc
  };
}

async function fetchAvailableClassesLegacy(nodeKey, options = {}) {
  const { termId = null, subjectId = null, headquarterId = null } = options;
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('headquarterId', ID_TYPE, headquarterId ?? getHeadquarterId(nodeKey) ?? nodeKey);
  if (termId) request.input('termId', ID_TYPE, termId);
  if (subjectId) request.input('subjectId', ID_TYPE, subjectId);
  const termFilter = termId ? 'AND c.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS = @termId COLLATE SQL_Latin1_General_CP1_CI_AS' : '';
  const subjectFilter = subjectId ? 'AND c.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS = @subjectId COLLATE SQL_Latin1_General_CP1_CI_AS' : '';
  const result = await request.query(
    `SELECT
       h.ID_headquarter AS ID_headquarter,
       h.name_headquarter AS name_headquarter,
       c.ID_class AS ID_class,
       sub.ID_subject AS ID_subject,
       sub.name_subject AS name_subject,
       sub.number_of_credit AS number_of_credit,
       te.ID_teacher AS ID_teacher,
       te.name_teacher AS name_teacher,
       c.group_number AS group_number,
       c.number_of_registration AS number_of_registration,
       c.max_students AS max_students,
       c.max_students - c.number_of_registration AS remaining,
       c.class_status AS class_status,
       ss.study_date AS study_date,
       ss.day_of_week AS day_of_week,
       ts.shift_no AS shift_no,
       ts.start_time AS start_time,
       ts.end_time AS end_time,
       r.ID_room AS ID_room,
       r.name_room AS name_room
     FROM [class] c
     JOIN subject sub
       ON c.ID_subject = sub.ID_subject COLLATE DATABASE_DEFAULT
     JOIN teacher te
       ON c.ID_teacher = te.ID_teacher COLLATE DATABASE_DEFAULT
     JOIN department d
       ON te.ID_department = d.ID_department COLLATE DATABASE_DEFAULT
     JOIN headquarter h
       ON d.ID_headquarter = h.ID_headquarter COLLATE DATABASE_DEFAULT
     JOIN [session] ss
       ON c.ID_class = ss.ID_class COLLATE DATABASE_DEFAULT
     JOIN room r
       ON ss.ID_room = r.ID_room COLLATE DATABASE_DEFAULT
     JOIN timeslot ts
       ON ss.ID_timeslot = ts.ID_timeslot COLLATE DATABASE_DEFAULT
     WHERE h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS = @headquarterId COLLATE SQL_Latin1_General_CP1_CI_AS
       AND c.class_status COLLATE SQL_Latin1_General_CP1_CI_AS = 'OPEN'
       ${termFilter}
       ${subjectFilter}
     ORDER BY sub.ID_subject, c.ID_class, ss.study_date, ts.start_time`
  );
  return result.recordset ?? [];
}

async function fetchAvailableClassesByCampus(nodeKey, options = {}) {
  const { termId = null, subjectId = null, headquarterId = null } = options;
  return fetchAvailableClassesLegacy(nodeKey, { termId, subjectId, headquarterId });
}
async function getClassById(nodeKey, classId, authToken = null) {
  const normalizedNode = normalizeNodeKey(nodeKey);
  const shouldQueryLocal = LOCAL_NODE === 'HQHD' || normalizedNode === normalizeNodeKey(LOCAL_NODE);

  if (!shouldQueryLocal) {
    const remote = await callRemoteNode(nodeKey, 'GET', `/api/dangky/internal/lophocphan/${encodeURIComponent(classId)}`, null, authToken);
    if (!remote.ok) {
      const error = new Error(remote.data?.message ?? 'Không lấy được thông tin lớp học phần.');
      error.status = remote.status;
      error.node = nodeKey;
      throw error;
    }
    return remote.data?.data ?? null;
  }
  const pool = await safeGetPool(LOCAL_NODE);
  const request = createRequest(LOCAL_NODE, null, pool);
  request.input('classId', ID_TYPE, classId);
  request.input('headquarterId', ID_TYPE, getHeadquarterId(normalizedNode) ?? normalizedNode ?? LOCAL_NODE);
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
      + ` AND h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS = @headquarterId COLLATE SQL_Latin1_General_CP1_CI_AS`
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
  request.input('ID_headquarter', ID_TYPE, null);
  await request.execute('usp_CancelRegistration');
}
async function proxyCrossRegistrationToHqhd(req, res) {
  if (LOCAL_NODE === 'HQHD' || isProxyRequest(req)) {
    return null;
  }

  try {
    const proxyResult = await fetchNodeApiJson('HQHD', '/api/dangky', {
      method: 'POST',
      body: req.body ?? {},
      headers: getProxyHeaders(req)
    });
    return res.status(proxyResult.status).json(proxyResult.data);
  } catch (error) {
    return sendError(res, error);
  }
}

async function registerCrossCampusOnHqhd(studentId, classId) {
  const pool = await safeGetPool('HQHD');
  const regId = await generateRegId(pool, 'HQHD');
  const request = createRequest('HQHD', null, pool);
  request.input('ID_registration', ID_TYPE, regId);
  request.input('ID_student', ID_TYPE, studentId);
  request.input('ID_class', ID_TYPE, classId);
  await request.execute('usp_RegisterCrossCampusClass');
  return regId;
}

function parseAvailableFilters(query = {}) {
  const termId = query.ID_term ?? null;
  const subjectId = query.ID_subject ?? null;
  const requestedNodeRaw = query.maCS ?? query.ID_headquarter ?? null;
  const requestedNode = requestedNodeRaw ? normalizeNodeKey(requestedNodeRaw) : null;

  if (requestedNodeRaw && !requestedNode) {
    const error = new Error('Mã cơ sở không hợp lệ.');
    error.status = 400;
    throw error;
  }

  return {
    termId,
    subjectId,
    requestedNode
  };
}

async function fetchAvailableClassesFromNode(nodeKey, filters, authToken) {
  if (LOCAL_NODE === 'HQHD' || normalizeNodeKey(nodeKey) === normalizeNodeKey(LOCAL_NODE)) {
    const rawRows = await fetchAvailableClassesByCampus(LOCAL_NODE, {
      termId: filters.termId,
      subjectId: filters.subjectId,
      headquarterId: getHeadquarterId(nodeKey) ?? nodeKey
    });
    return rawRows.map(row => normalizeAvailableClassRow(row, nodeKey));
  }

  const remotePath = buildRemotePath('/api/dangky/internal/lophocphan', {
    ID_term: filters.termId,
    ID_subject: filters.subjectId,
    ID_headquarter: getHeadquarterId(nodeKey) ?? nodeKey
  });
  const remote = await callRemoteNode(nodeKey, 'GET', remotePath, null, authToken);
  if (!remote.ok) {
    const error = new Error(remote.data?.message ?? 'Không lấy được danh sách lớp học phần.');
    error.status = remote.status;
    error.node = nodeKey;
    error.offline = remote.data?.offline === true || remote.status === 503;
    throw error;
  }

  const rows = Array.isArray(remote.data?.data) ? remote.data.data : [];
  return rows.map(row => normalizeAvailableClassRow(row, nodeKey));
}

router.get('/internal/node-ping', (req, res) => {
  return res.json({ success: true, node: LOCAL_NODE, status: 'ok' });
});
router.get('/internal/lophocphan', authenticate, async (req, res) => {
  try {
    const filters = parseAvailableFilters(req.query);
    const data = await fetchAvailableClassesByCampus(LOCAL_NODE, {
      termId: filters.termId,
      subjectId: filters.subjectId,
      headquarterId: getHeadquarterId(LOCAL_NODE) ?? LOCAL_NODE
    });
    const normalized = data.map(row => normalizeAvailableClassRow(row, LOCAL_NODE));
    return res.json({ success: true, data: normalized });
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
  return res.status(405).json({
    success: false,
    message: 'Sĩ số lớp học phần chỉ được cập nhật thông qua procedure đăng ký/hủy đăng ký.'
  });
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

  // Workstations should not coordinate cross-campus writes directly.
  // Send them to the HQHD gateway before doing remote class checks.
  if (maCS !== maCSLopNormalized) {
    const proxied = await proxyCrossRegistrationToHqhd(req, res);
    if (proxied) {
      return proxied;
    }
  }

  let regId = null;
  try {
    const classInfo = await timedStep('getClassById', () => getClassById(maCSLopNormalized, maLop, req.headers.authorization));
    if (!classInfo || classInfo.class_status !== 'OPEN' || classInfo.number_of_registration >= classInfo.max_students) {
      return res.status(400).json({
        success: false,
        message: 'Lớp học phần đã đủ sĩ số, không mở đăng ký hoặc không thuộc cơ sở được chọn.'
      });
    }

    if (maCS === maCSLopNormalized) {
      const headquarterStudent = (await timedStep('fetchStudentHeadquarterId', () => fetchStudentHeadquarterId(LOCAL_NODE, maSV))) ?? getHeadquarterId(LOCAL_NODE) ?? LOCAL_NODE;
      const pool = await timedStep('getPool', () => safeGetPool(LOCAL_NODE));
      const checkRequest = createRequest(LOCAL_NODE, null, pool);
      checkRequest.input('ID_student', ID_TYPE, maSV);
      checkRequest.input('ID_class', ID_TYPE, maLop);
      checkRequest.input('ID_headquarter', ID_TYPE, headquarterStudent);
      const checkResult = await timedStep('usp_CheckRegisterCondition', () => checkRequest.execute('usp_CheckRegisterCondition'));
      if (!checkResult.recordset[0]?.is_valid) {
        return res.status(400).json({ success: false, message: checkResult.recordset[0]?.message || 'Không thể đăng ký lớp này.' });
      }
      regId = await timedStep('generateRegId', () => generateRegId(pool, LOCAL_NODE));
      await timedStep('usp_RegisterClass', () => registerLocal(LOCAL_NODE, regId, maSV, maLop, headquarterStudent));
      clearStudentCache(maSV, LOCAL_NODE);
      return res.json({ success: true, data: { maDangKy: regId, maSV, maLop, maCS: LOCAL_NODE, maCSLop: maCSLopNormalized } });
    }

    regId = await timedStep('usp_RegisterCrossCampusClass', () => registerCrossCampusOnHqhd(maSV, maLop));
    clearStudentCache(maSV, LOCAL_NODE);
    return res.json({
      success: true,
      data: { maDangKy: regId, maSV, maLop, maCS, maCSLop: maCSLopNormalized, gateway: 'HQHD' }
    });
  } catch (error) {
    return sendError(res, error);
  }
});
async function cancelRegistrationForStudent(maDangKy, maSV) {
  const pool = await safeGetPool(LOCAL_NODE);
  const verifyReq = createRequest(LOCAL_NODE, null, pool);
  verifyReq.input('ID_registration', ID_TYPE, maDangKy);
  verifyReq.input('ID_student', ID_TYPE, maSV);
  const verifyResult = await verifyReq.query(
    `SELECT
       r.ID_class,
       r.registration_status,
       d.ID_headquarter AS class_headquarter
     FROM registration r
     LEFT JOIN [class] c
       ON r.ID_class COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_class COLLATE SQL_Latin1_General_CP1_CI_AS
     LEFT JOIN teacher t
       ON c.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS = t.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS
     LEFT JOIN department d
       ON t.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS = d.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS
     WHERE r.ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_registration COLLATE SQL_Latin1_General_CP1_CI_AS
       AND r.ID_student COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_student COLLATE SQL_Latin1_General_CP1_CI_AS`
  );

  if (verifyResult.recordset.length === 0) {
    const error = new Error('Không tìm thấy đăng ký.');
    error.status = 404;
    throw error;
  }

  if (verifyResult.recordset[0].registration_status === 'CANCELLED') {
    const error = new Error('Đăng ký này đã bị hủy rồi.');
    error.status = 400;
    throw error;
  }

  const cancelReq = createRequest(LOCAL_NODE, null, pool);
  cancelReq.input('ID_registration', ID_TYPE, maDangKy);
  cancelReq.input('ID_headquarter', ID_TYPE, verifyResult.recordset[0].class_headquarter ?? getHeadquarterId(LOCAL_NODE) ?? LOCAL_NODE);
  await cancelReq.execute('usp_CancelRegistration');
  clearStudentCache(maSV, LOCAL_NODE);
}

router.post('/cancel', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const { maDangKy } = req.body ?? {};
  const maSV = req.user?.id;
  const maCS = normalizeNodeKey(req.user?.maCS) ?? LOCAL_NODE;
  if (!maSV || !maCS || !maDangKy) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin hủy đăng ký.' });
  }
  try {
    await cancelRegistrationForStudent(maDangKy, maSV);
    return res.json({ success: true, message: 'Hủy đăng ký thành công.' });
  } catch (error) {
    return sendError(res, error);
  }
});
router.delete('/:maDangKy', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const maSV = req.user?.id;
  if (!maSV || !req.params.maDangKy) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin hủy đăng ký.' });
  }
  try {
    await cancelRegistrationForStudent(req.params.maDangKy, maSV);
    return res.json({ success: true, message: 'Hủy đăng ký thành công.' });
  } catch (error) {
    return sendError(res, error);
  }
});
router.get('/available', authenticate, requireRole(['sinhvien']), async (req, res) => {
  try {
    const filters = parseAvailableFilters(req.query);
    const targetNodes = filters.requestedNode ? [filters.requestedNode] : [...nodeKeys];
    const fetchResults = await Promise.all(
      targetNodes.map(async nodeKey => {
        try {
          const data = await fetchAvailableClassesFromNode(nodeKey, filters, req.headers.authorization);
          return { node: nodeKey, data, offline: false };
        } catch (error) {
          if (isOfflineError(error) || error.offline || error.status === 503) {
            return { node: nodeKey, data: [], offline: true, message: error.message };
          }
          throw error;
        }
      })
    );

    if (targetNodes.length === 1 && fetchResults[0]?.offline) {
      return res.status(503).json({
        success: false,
        message: fetchResults[0].message ?? `Node ${targetNodes[0]} hiện không khả dụng`,
        node: targetNodes[0],
        offline: true
      });
    }

    const offlineNodes = fetchResults.filter(item => item.offline).map(item => item.node);
    const data = fetchResults
      .flatMap(item => item.data)
      .sort((a, b) => {
        const subjectCmp = String(a.maHocPhan ?? '').localeCompare(String(b.maHocPhan ?? ''));
        if (subjectCmp !== 0) return subjectCmp;
        const classCmp = String(a.maLop ?? '').localeCompare(String(b.maLop ?? ''));
        if (classCmp !== 0) return classCmp;
        return String(a.ngayHoc ?? '').localeCompare(String(b.ngayHoc ?? ''));
      });

    return res.json({ success: true, data, meta: { offlineNodes } });
  } catch (error) {
    return sendError(res, error);
  }
});
router.get('/result', authenticate, requireRole(['sinhvien', 'quantrivien']), async (req, res) => {
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
