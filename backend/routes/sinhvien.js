import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getPool } from '../config/db.js';
import { LOCAL_NODE, normalizeNodeKey, getHeadquarterId, isValidNode } from '../config/nodes.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';
import { deleteRow, insertRow, queryRows, updateRow } from '../utils/tableCrud.js';
import { getCachedResult, setCachedResult } from '../utils/queryCache.js';
import { callRemoteNode } from '../utils/remoteApi.js';
import { fetchNodeApiJson } from '../utils/nodeProxy.js';

const router = express.Router();
const ID_TYPE = sql.NVarChar(50);
const HQHD_NODE = 'HQHD';

// ...existing code...

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

function getBearerToken(req) {
  const raw = req.headers?.authorization;
  if (!raw) return null;
  return String(raw).replace(/^Bearer\s+/i, '');
}

function getField(row, keys, fallback = null) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) {
      return row[key];
    }
  }
  return fallback;
}

function dedupeRows(rows, keys) {
  const seen = new Set();
  return rows.filter(row => {
    const key = keys.map(item => getField(row, item, '')).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isActiveRegistration(row) {
  const status = String(getField(row, [
    'Trạng thái',
    'trangThai',
    'registration_status'
  ], 'REGISTERED')).toUpperCase();
  return status === 'REGISTERED';
}

function shouldBypassCache(req) {
  const value = req.query?.refresh ?? req.query?.noCache;
  return value === '1' || value === 'true' || value === 'yes';
}

function buildCrossRegistrationsSql() {
  return `
WITH q AS
(
SELECT
 r.ID_registration COLLATE DATABASE_DEFAULT AS maDangKy,
 st.ID_student COLLATE DATABASE_DEFAULT AS maSV,
 st.name_student COLLATE DATABASE_DEFAULT AS tenSinhVien,
 hq_st.ID_headquarter COLLATE DATABASE_DEFAULT AS maCSSinhVien,
 hq_st.name_headquarter COLLATE DATABASE_DEFAULT AS coSoSinhVien,
 c.ID_class COLLATE DATABASE_DEFAULT AS maMH,
 sub.ID_subject COLLATE DATABASE_DEFAULT AS maHocPhan,
 sub.name_subject COLLATE DATABASE_DEFAULT AS tenMonHoc,
 sub.number_of_credit AS soTC,
 c.group_number AS nhom,
 te.name_teacher COLLATE DATABASE_DEFAULT AS giangVien,
 hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT AS maCSLop,
 hq_cl.name_headquarter COLLATE DATABASE_DEFAULT AS coSoMoLop,
 r.registered_at AS ngayDangKy,
 r.cancelled_at AS ngayHuy,
 r.registration_status COLLATE DATABASE_DEFAULT AS trangThai
FROM DkyTinChi.dbo.registration r
JOIN DkyTinChi.dbo.student st ON r.ID_student COLLATE DATABASE_DEFAULT = st.ID_student COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.department d_st ON st.ID_department COLLATE DATABASE_DEFAULT = d_st.ID_department COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.headquarter hq_st ON d_st.ID_headquarter COLLATE DATABASE_DEFAULT = hq_st.ID_headquarter COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.[class] c ON r.ID_class COLLATE DATABASE_DEFAULT = c.ID_class COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.department d_te ON te.ID_department COLLATE DATABASE_DEFAULT = d_te.ID_department COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.headquarter hq_cl ON d_te.ID_headquarter COLLATE DATABASE_DEFAULT = hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
WHERE r.registration_status COLLATE DATABASE_DEFAULT = 'REGISTERED'
  AND hq_st.ID_headquarter COLLATE DATABASE_DEFAULT <> hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
UNION ALL
SELECT maDangKy COLLATE DATABASE_DEFAULT, maSV COLLATE DATABASE_DEFAULT, tenSinhVien COLLATE DATABASE_DEFAULT,
       maCSSinhVien COLLATE DATABASE_DEFAULT, coSoSinhVien COLLATE DATABASE_DEFAULT,
       maMH COLLATE DATABASE_DEFAULT, maHocPhan COLLATE DATABASE_DEFAULT, tenMonHoc COLLATE DATABASE_DEFAULT,
       soTC, nhom, giangVien COLLATE DATABASE_DEFAULT,
       maCSLop COLLATE DATABASE_DEFAULT, coSoMoLop COLLATE DATABASE_DEFAULT,
       ngayDangKy, ngayHuy, trangThai COLLATE DATABASE_DEFAULT
FROM OPENQUERY(
  LINK_HL,
  '
  SELECT r.ID_registration AS maDangKy, st.ID_student AS maSV, st.name_student AS tenSinhVien,
         hq_st.ID_headquarter AS maCSSinhVien, hq_st.name_headquarter AS coSoSinhVien,
         c.ID_class AS maMH, sub.ID_subject AS maHocPhan, sub.name_subject AS tenMonHoc,
         sub.number_of_credit AS soTC, c.group_number AS nhom, te.name_teacher AS giangVien,
         hq_cl.ID_headquarter AS maCSLop, hq_cl.name_headquarter AS coSoMoLop,
         r.registered_at AS ngayDangKy, r.cancelled_at AS ngayHuy, r.registration_status AS trangThai
  FROM CSDL_HL.dbo.registration r
  JOIN CSDL_HL.dbo.student st ON r.ID_student COLLATE DATABASE_DEFAULT = st.ID_student COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.department d_st ON st.ID_department COLLATE DATABASE_DEFAULT = d_st.ID_department COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.headquarter hq_st ON d_st.ID_headquarter COLLATE DATABASE_DEFAULT = hq_st.ID_headquarter COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.[class] c ON r.ID_class COLLATE DATABASE_DEFAULT = c.ID_class COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.department d_te ON te.ID_department COLLATE DATABASE_DEFAULT = d_te.ID_department COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.headquarter hq_cl ON d_te.ID_headquarter COLLATE DATABASE_DEFAULT = hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
  WHERE r.registration_status COLLATE DATABASE_DEFAULT = ''REGISTERED''
    AND hq_st.ID_headquarter COLLATE DATABASE_DEFAULT <> hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
  '
)
UNION ALL
SELECT maDangKy COLLATE DATABASE_DEFAULT, maSV COLLATE DATABASE_DEFAULT, tenSinhVien COLLATE DATABASE_DEFAULT,
       maCSSinhVien COLLATE DATABASE_DEFAULT, coSoSinhVien COLLATE DATABASE_DEFAULT,
       maMH COLLATE DATABASE_DEFAULT, maHocPhan COLLATE DATABASE_DEFAULT, tenMonHoc COLLATE DATABASE_DEFAULT,
       soTC, nhom, giangVien COLLATE DATABASE_DEFAULT,
       maCSLop COLLATE DATABASE_DEFAULT, coSoMoLop COLLATE DATABASE_DEFAULT,
       ngayDangKy, ngayHuy, trangThai COLLATE DATABASE_DEFAULT
FROM OPENQUERY(
  Link_HoChiMinh,
  '
  SELECT r.ID_registration AS maDangKy, st.ID_student AS maSV, st.name_student AS tenSinhVien,
         hq_st.ID_headquarter AS maCSSinhVien, hq_st.name_headquarter AS coSoSinhVien,
         c.ID_class AS maMH, sub.ID_subject AS maHocPhan, sub.name_subject AS tenMonHoc,
         sub.number_of_credit AS soTC, c.group_number AS nhom, te.name_teacher AS giangVien,
         hq_cl.ID_headquarter AS maCSLop, hq_cl.name_headquarter AS coSoMoLop,
         r.registered_at AS ngayDangKy, r.cancelled_at AS ngayHuy, r.registration_status AS trangThai
  FROM DkiTinChi_HCM.dbo.registration r
  JOIN DkiTinChi_HCM.dbo.student st ON r.ID_student COLLATE DATABASE_DEFAULT = st.ID_student COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.department d_st ON st.ID_department COLLATE DATABASE_DEFAULT = d_st.ID_department COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.headquarter hq_st ON d_st.ID_headquarter COLLATE DATABASE_DEFAULT = hq_st.ID_headquarter COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.[class] c ON r.ID_class COLLATE DATABASE_DEFAULT = c.ID_class COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.department d_te ON te.ID_department COLLATE DATABASE_DEFAULT = d_te.ID_department COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.headquarter hq_cl ON d_te.ID_headquarter COLLATE DATABASE_DEFAULT = hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
  WHERE r.registration_status COLLATE DATABASE_DEFAULT = ''REGISTERED''
    AND hq_st.ID_headquarter COLLATE DATABASE_DEFAULT <> hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
  '
)
)
SELECT *
FROM q
WHERE maSV COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_student COLLATE SQL_Latin1_General_CP1_CI_AS
ORDER BY ngayDangKy DESC, maMH;
`;
}

function buildCrossScheduleSql() {
  return `
WITH q AS
(
SELECT
 r.ID_registration COLLATE DATABASE_DEFAULT AS maDangKy,
 st.ID_student COLLATE DATABASE_DEFAULT AS maSV,
 hq_st.ID_headquarter COLLATE DATABASE_DEFAULT AS maCSSinhVien,
 hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT AS maCSLop,
 ss.ID_session COLLATE DATABASE_DEFAULT AS ID_session,
 c.ID_class COLLATE DATABASE_DEFAULT AS ID_class,
 sub.name_subject COLLATE DATABASE_DEFAULT AS tenMonHoc,
 te.name_teacher COLLATE DATABASE_DEFAULT AS giangVien,
 ss.study_date AS ngayHoc,
 ss.day_of_week AS thuHoc,
 ts.shift_no AS caHoc,
 ts.start_time AS gioStart,
 ts.end_time AS gioEnd,
 r_room.name_room COLLATE DATABASE_DEFAULT AS phongHoc,
 ss.note COLLATE DATABASE_DEFAULT AS ghiChu
FROM DkyTinChi.dbo.registration r
JOIN DkyTinChi.dbo.student st ON r.ID_student COLLATE DATABASE_DEFAULT = st.ID_student COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.department d_st ON st.ID_department COLLATE DATABASE_DEFAULT = d_st.ID_department COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.headquarter hq_st ON d_st.ID_headquarter COLLATE DATABASE_DEFAULT = hq_st.ID_headquarter COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.[class] c ON r.ID_class COLLATE DATABASE_DEFAULT = c.ID_class COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.department d_te ON te.ID_department COLLATE DATABASE_DEFAULT = d_te.ID_department COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.headquarter hq_cl ON d_te.ID_headquarter COLLATE DATABASE_DEFAULT = hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.[session] ss ON c.ID_class COLLATE DATABASE_DEFAULT = ss.ID_class COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.timeslot ts ON ss.ID_timeslot COLLATE DATABASE_DEFAULT = ts.ID_timeslot COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.room r_room ON ss.ID_room COLLATE DATABASE_DEFAULT = r_room.ID_room COLLATE DATABASE_DEFAULT
WHERE r.registration_status COLLATE DATABASE_DEFAULT = 'REGISTERED'
  AND hq_st.ID_headquarter COLLATE DATABASE_DEFAULT <> hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
UNION ALL
SELECT maDangKy COLLATE DATABASE_DEFAULT, maSV COLLATE DATABASE_DEFAULT,
       maCSSinhVien COLLATE DATABASE_DEFAULT, maCSLop COLLATE DATABASE_DEFAULT,
       ID_session COLLATE DATABASE_DEFAULT, ID_class COLLATE DATABASE_DEFAULT,
       tenMonHoc COLLATE DATABASE_DEFAULT, giangVien COLLATE DATABASE_DEFAULT,
       ngayHoc, thuHoc, caHoc, gioStart, gioEnd,
       phongHoc COLLATE DATABASE_DEFAULT, ghiChu COLLATE DATABASE_DEFAULT
FROM OPENQUERY(
  LINK_HL,
  '
  SELECT r.ID_registration AS maDangKy, st.ID_student AS maSV,
         hq_st.ID_headquarter AS maCSSinhVien, hq_cl.ID_headquarter AS maCSLop,
         ss.ID_session, c.ID_class, sub.name_subject AS tenMonHoc, te.name_teacher AS giangVien,
         ss.study_date AS ngayHoc, ss.day_of_week AS thuHoc, ts.shift_no AS caHoc,
         ts.start_time AS gioStart, ts.end_time AS gioEnd, r_room.name_room AS phongHoc, ss.note AS ghiChu
  FROM CSDL_HL.dbo.registration r
  JOIN CSDL_HL.dbo.student st ON r.ID_student COLLATE DATABASE_DEFAULT = st.ID_student COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.department d_st ON st.ID_department COLLATE DATABASE_DEFAULT = d_st.ID_department COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.headquarter hq_st ON d_st.ID_headquarter COLLATE DATABASE_DEFAULT = hq_st.ID_headquarter COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.[class] c ON r.ID_class COLLATE DATABASE_DEFAULT = c.ID_class COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.department d_te ON te.ID_department COLLATE DATABASE_DEFAULT = d_te.ID_department COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.headquarter hq_cl ON d_te.ID_headquarter COLLATE DATABASE_DEFAULT = hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.[session] ss ON c.ID_class COLLATE DATABASE_DEFAULT = ss.ID_class COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.timeslot ts ON ss.ID_timeslot COLLATE DATABASE_DEFAULT = ts.ID_timeslot COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.room r_room ON ss.ID_room COLLATE DATABASE_DEFAULT = r_room.ID_room COLLATE DATABASE_DEFAULT
  WHERE r.registration_status COLLATE DATABASE_DEFAULT = ''REGISTERED''
    AND hq_st.ID_headquarter COLLATE DATABASE_DEFAULT <> hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
  '
)
UNION ALL
SELECT maDangKy COLLATE DATABASE_DEFAULT, maSV COLLATE DATABASE_DEFAULT,
       maCSSinhVien COLLATE DATABASE_DEFAULT, maCSLop COLLATE DATABASE_DEFAULT,
       ID_session COLLATE DATABASE_DEFAULT, ID_class COLLATE DATABASE_DEFAULT,
       tenMonHoc COLLATE DATABASE_DEFAULT, giangVien COLLATE DATABASE_DEFAULT,
       ngayHoc, thuHoc, caHoc, gioStart, gioEnd,
       phongHoc COLLATE DATABASE_DEFAULT, ghiChu COLLATE DATABASE_DEFAULT
FROM OPENQUERY(
  Link_HoChiMinh,
  '
  SELECT r.ID_registration AS maDangKy, st.ID_student AS maSV,
         hq_st.ID_headquarter AS maCSSinhVien, hq_cl.ID_headquarter AS maCSLop,
         ss.ID_session, c.ID_class, sub.name_subject AS tenMonHoc, te.name_teacher AS giangVien,
         ss.study_date AS ngayHoc, ss.day_of_week AS thuHoc, ts.shift_no AS caHoc,
         ts.start_time AS gioStart, ts.end_time AS gioEnd, r_room.name_room AS phongHoc, ss.note AS ghiChu
  FROM DkiTinChi_HCM.dbo.registration r
  JOIN DkiTinChi_HCM.dbo.student st ON r.ID_student COLLATE DATABASE_DEFAULT = st.ID_student COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.department d_st ON st.ID_department COLLATE DATABASE_DEFAULT = d_st.ID_department COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.headquarter hq_st ON d_st.ID_headquarter COLLATE DATABASE_DEFAULT = hq_st.ID_headquarter COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.[class] c ON r.ID_class COLLATE DATABASE_DEFAULT = c.ID_class COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.department d_te ON te.ID_department COLLATE DATABASE_DEFAULT = d_te.ID_department COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.headquarter hq_cl ON d_te.ID_headquarter COLLATE DATABASE_DEFAULT = hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.[session] ss ON c.ID_class COLLATE DATABASE_DEFAULT = ss.ID_class COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.timeslot ts ON ss.ID_timeslot COLLATE DATABASE_DEFAULT = ts.ID_timeslot COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.room r_room ON ss.ID_room COLLATE DATABASE_DEFAULT = r_room.ID_room COLLATE DATABASE_DEFAULT
  WHERE r.registration_status COLLATE DATABASE_DEFAULT = ''REGISTERED''
    AND hq_st.ID_headquarter COLLATE DATABASE_DEFAULT <> hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
  '
)
)
SELECT *
FROM q
WHERE maSV COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_student COLLATE SQL_Latin1_General_CP1_CI_AS
ORDER BY ngayHoc, caHoc, ID_class;
`;
}

async function fetchCentralCrossRows(req, path, queryName, sqlText, studentId) {
  if (normalizeNodeKey(LOCAL_NODE) !== HQHD_NODE) {
    const token = getBearerToken(req);
    const remote = await fetchNodeApiJson(HQHD_NODE, path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeoutMs: 60000
    });
    if (!remote.ok) {
      const error = new Error(remote.data?.message ?? `Không lấy được ${queryName} từ HQHD.`);
      error.status = remote.status;
      error.node = HQHD_NODE;
      error.offline = remote.data?.offline === true || remote.status === 503;
      throw error;
    }
    return Array.isArray(remote.data?.data) ? remote.data.data : [];
  }

  const pool = await safeGetPool(HQHD_NODE);
  const request = createRequest(HQHD_NODE, null, pool);
  request.input('ID_student', ID_TYPE, studentId);
  const result = await request.query(sqlText);
  return result.recordset ?? [];
}

async function fetchCrossRegistrations(req, studentId) {
  return fetchCentralCrossRows(
    req,
    '/api/sinhvien/cross-registrations',
    'đăng ký chéo',
    buildCrossRegistrationsSql(),
    studentId
  );
}

async function fetchCrossSchedule(req, studentId) {
  return fetchCentralCrossRows(
    req,
    '/api/sinhvien/cross-schedule',
    'thời khóa biểu chéo',
    buildCrossScheduleSql(),
    studentId
  );
}

async function fetchLocalRegistrations(nodeKey, studentId, headquarterId) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('ID_student', ID_TYPE, studentId);
  request.input('ID_headquarter', ID_TYPE, headquarterId);

  const result = await request.execute('usp_GetRegistrationResult');
  return (result.recordset ?? []).map(row => {
    const values = Object.values(row);
    return {
      ...row,
      maDangKy: row.maDangKy ?? values[2],
      maSV: row.maSV ?? values[3],
      maMH: row.maMH ?? values[5],
      maHocPhan: row.maHocPhan ?? values[6],
      tenMonHoc: row.tenMonHoc ?? values[7],
      soTC: row.soTC ?? values[8],
      hocKy: row.hocKy ?? values[9],
      giangVien: row.giangVien ?? values[10],
      ngayDangKy: row.ngayDangKy ?? values[11],
      ngayHuy: row.ngayHuy ?? values[12],
      trangThai: row.trangThai ?? values[13]
    };
  });
}

async function fetchLocalSchedule(nodeKey, studentId, headquarterId) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('ID_student', ID_TYPE, studentId);
  request.input('ID_headquarter', ID_TYPE, headquarterId);

  const result = await request.execute('usp_GetStudentTimetable');
  return (result.recordset ?? []).map(row => {
    const values = Object.values(row);
    const classId = row.ID_class ?? values[4];
    const studyDate = row.ngayHoc ?? values[6];
    const shiftNo = row.caHoc ?? values[8];
    return {
      ...row,
      ID_session: row.ID_session ?? `${classId ?? ''}:${studyDate ?? ''}:${shiftNo ?? ''}`,
      ID_class: classId,
      tenMonHoc: row.tenMonHoc ?? values[5],
      ngayHoc: studyDate,
      thuHoc: row.thuHoc ?? values[7],
      caHoc: shiftNo,
      gioStart: row.gioStart ?? values[9],
      gioEnd: row.gioEnd ?? values[10],
      phongHoc: row.phongHoc ?? values[11],
      node: row.node ?? values[12],
      maCS: row.maCS ?? values[12],
      giangVien: row.giangVien ?? values[13],
      ghiChu: row.ghiChu ?? null
    };
  });
}
function resolveNode(req) {
  const requested = normalizeNodeKey(req.query.maCS ?? req.query.ID_headquarter ?? req.body?.ID_headquarter);
  const userNode = normalizeNodeKey(req.user?.maCS);
  const localNode = normalizeNodeKey(LOCAL_NODE);
  const isHqhdGlobalAdmin = req.user?.role === 'quantrivien' && userNode === 'HQHD' && localNode === 'HQHD';
  if (isHqhdGlobalAdmin && requested && isValidNode(requested)) {
    return requested;
  }
  return userNode;
}

async function proxyIfRemote(req, nodeKey) {
  if (!nodeKey || nodeKey === LOCAL_NODE) return null;
  return await callRemoteNode(nodeKey, req.method, req.originalUrl, req.body ?? null, req.headers.authorization);
}

router.get('/cross-registrations', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const maSV = req.user?.id;
  if (!maSV) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin sinh viên trong token.' });
  }

  try {
    const data = await fetchCrossRegistrations(req, maSV);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/cross-schedule', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const maSV = req.user?.id;
  if (!maSV) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin sinh viên trong token.' });
  }

  try {
    const data = await fetchCrossSchedule(req, maSV);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/', authenticate, requireRole(['quantrivien']), async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    const { rows } = await queryRows(nodeKey, 'student', {}, 500);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/', authenticate, requireRole(['quantrivien']), async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    await insertRow(nodeKey, 'student', req.body ?? {});
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:id', authenticate, requireRole(['quantrivien']), async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    await updateRow(nodeKey, 'student', req.body ?? {}, { ID_student: req.params.id });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/:id', authenticate, requireRole(['quantrivien']), async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    await deleteRow(nodeKey, 'student', { ID_student: req.params.id });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/registrations', authenticate, requireRole(['sinhvien']), async (req, res) => {
   const maSV = req.user?.id;
   const maCS = normalizeNodeKey(req.user?.maCS);
   const headquarterId = getHeadquarterId(maCS) ?? maCS;

   if (!maSV || !maCS) {
     return res.status(400).json({
       success: false,
       message: 'Thiếu thông tin sinh viên trong token.'
     });
   }

   try {
     const bypassCache = shouldBypassCache(req);
     const cached = bypassCache ? null : getCachedResult(maSV, maCS, 'registrations');
     if (cached) {
       return res.json({
         success: true,
         data: cached,
         cached: true
       });
     }

     const resolvedHeadquarter = getHeadquarterId(maCS) ?? maCS;
     const localRows = await fetchLocalRegistrations(maCS, maSV, resolvedHeadquarter);

     const offlineNodes = [];
     const crossErrors = [];
     let crossRows = [];
     try {
       crossRows = await fetchCrossRegistrations(req, maSV);
     } catch (error) {
       console.warn(`[CROSS] Không lấy được đăng ký chéo từ HQHD: ${error.message}`);
       offlineNodes.push(HQHD_NODE);
       crossErrors.push({ node: HQHD_NODE, message: error.message });
     }

     const data = dedupeRows(
       [...localRows, ...crossRows].filter(isActiveRegistration),
       [
         ['Mã đăng ký', 'maDangKy', 'ID_registration'],
         ['Mã lớp học phần', 'maMH', 'ID_class']
       ]
     );

     if (offlineNodes.length === 0) {
       setCachedResult(maSV, maCS, 'registrations', data);
     }

     return res.json({
       success: true,
       data,
       meta: { offlineNodes, crossErrors, crossRegistrationCount: crossRows.length },
       cached: false
     });
   } catch (error) {
     return sendError(res, error);
   }
 });

router.get('/schedule', authenticate, requireRole(['sinhvien']), async (req, res) => {
   const maSV = req.user?.id;
   const maCS = normalizeNodeKey(req.user?.maCS);
   const headquarterId = getHeadquarterId(maCS) ?? maCS;

   if (!maSV || !maCS) {
     return res.status(400).json({
       success: false,
       message: 'Thiếu thông tin sinh viên trong token.'
     });
   }

   try {
     // Check cache first
     const cached = getCachedResult(maSV, maCS, 'schedule');
     if (cached) {
       return res.json({
         success: true,
         data: cached,
         meta: { offlineNodes: [] },
         cached: true
       });
     }

     const resolvedHeadquarter = getHeadquarterId(maCS) ?? maCS;
     const localRows = await fetchLocalSchedule(maCS, maSV, resolvedHeadquarter);

     const offlineNodes = [];
     const crossErrors = [];
     let crossRows = [];
     try {
       crossRows = await fetchCrossSchedule(req, maSV);
     } catch (error) {
       console.warn(`[CROSS] Không lấy được thời khóa biểu chéo từ HQHD: ${error.message}`);
       offlineNodes.push(HQHD_NODE);
       crossErrors.push({ node: HQHD_NODE, message: error.message });
     }

     const data = dedupeRows(
       [...localRows, ...crossRows],
       [
         ['Mã buổi học', 'ID_session', 'id_session'],
         ['Mã lớp học phần', 'ID_class', 'id_class']
       ]
     );

     if (offlineNodes.length === 0) {
       setCachedResult(maSV, maCS, 'schedule', data);
     }

     return res.json({
       success: true,
       data,
       meta: { offlineNodes, crossErrors, crossScheduleCount: crossRows.length },
       cached: false
     });
   } catch (error) {
     return sendError(res, error);
   }
 });

router.get('/timetable', authenticate, requireRole(['quantrivien']), async (req, res) => {
  const nodeKey = resolveNode(req);
  const studentId = req.query.ID_student;
  const headquarterId = normalizeNodeKey(req.query.ID_headquarter ?? req.query.maCS);

  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }
  if (!studentId) {
    return res.status(400).json({ success: false, message: 'Thiếu mã sinh viên.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    const pool = await safeGetPool(nodeKey);
    const request = createRequest(nodeKey, null, pool);
    request.input('ID_student', ID_TYPE, studentId);
    if (headquarterId) {
      request.input('ID_headquarter', ID_TYPE, headquarterId);
    }
    const result = await request.execute('usp_GetStudentTimetable');
    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id', authenticate, requireRole(['quantrivien']), async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  try {
    const { rows } = await queryRows(nodeKey, 'student', { ID_student: req.params.id }, 1);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sinh viên.' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;


