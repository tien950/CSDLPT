import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getPool } from '../config/db.js';
import { LOCAL_NODE, normalizeNodeKey, getHeadquarterId, isValidNode } from '../config/nodes.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';
import { deleteRow, insertRow, queryRows, updateRow } from '../utils/tableCrud.js';
import { getCachedResult, setCachedResult } from '../utils/queryCache.js';
import { callRemoteNode } from '../utils/remoteApi.js';

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
    const remote = await callRemoteNode(HQHD_NODE, 'GET', path, null, getBearerToken(req));
    if (!remote.ok) {
      const error = new Error(remote.data?.message ?? `KhÃ´ng láº¥y Ä‘Æ°á»£c ${queryName} tá»« HQHD.`);
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
    'Ä‘Äƒng kÃ½ chÃ©o',
    buildCrossRegistrationsSql(),
    studentId
  );
}

async function fetchCrossSchedule(req, studentId) {
  return fetchCentralCrossRows(
    req,
    '/api/sinhvien/cross-schedule',
    'thá»i khÃ³a biá»ƒu chÃ©o',
    buildCrossScheduleSql(),
    studentId
  );
}

async function fetchLocalRegistrations(nodeKey, studentId, headquarterId) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('ID_student', ID_TYPE, studentId);
  request.input('ID_headquarter', ID_TYPE, headquarterId);

  const result = await request.query(
    `SELECT
       r.ID_registration AS maDangKy,
       c.ID_class AS maMH,
       sub.name_subject AS tenMonHoc,
       sub.number_of_credit AS soTC,
       c.group_number AS nhom,
       te.name_teacher AS giangVien,
       r.registered_at AS ngayDangKy,
       r.cancelled_at AS ngayHuy,
       r.registration_status AS trangThai,
       h.ID_headquarter AS [MÃ£ cÆ¡ sá»Ÿ],
       h.name_headquarter AS [CÆ¡ sá»Ÿ],
       r.ID_registration AS [MÃ£ Ä‘Äƒng kÃ½],
       st.ID_student AS [MÃ£ sinh viÃªn],
       st.name_student AS [TÃªn sinh viÃªn],
       c.ID_class AS [MÃ£ lá»›p há»c pháº§n],
       sub.ID_subject AS [MÃ£ há»c pháº§n],
       sub.name_subject AS [TÃªn há»c pháº§n],
       sub.number_of_credit AS [Sá»‘ tÃ­n chá»‰],
       tm.name_term AS [Há»c ká»³],
       te.name_teacher AS [Giáº£ng viÃªn],
       r.registered_at AS [Thá»i gian Ä‘Äƒng kÃ½],
       r.cancelled_at AS [Thá»i gian há»§y],
       r.registration_status AS [Tráº¡ng thÃ¡i]
     FROM registration r
     JOIN student st
       ON r.ID_student COLLATE SQL_Latin1_General_CP1_CI_AS = st.ID_student COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN department d_st
       ON st.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS = d_st.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN headquarter h
       ON d_st.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS = h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN [class] c
       ON r.ID_class COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_class COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN subject sub
       ON c.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS = sub.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS
     LEFT JOIN term tm
       ON c.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS = tm.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN teacher te
       ON c.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS = te.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS
     WHERE r.ID_student COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_student COLLATE SQL_Latin1_General_CP1_CI_AS
       AND h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS
     ORDER BY r.registered_at DESC`
  );
  return result.recordset ?? [];
}

async function fetchLocalSchedule(nodeKey, studentId, headquarterId) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('ID_student', ID_TYPE, studentId);
  request.input('ID_headquarter', ID_TYPE, headquarterId);

  const result = await request.query(
    `SELECT
       ss.ID_session AS ID_session,
       c.ID_class AS ID_class,
       ss.study_date AS ngayHoc,
       ss.day_of_week AS thuHoc,
       ts.shift_no AS caHoc,
       ts.start_time AS gioStart,
       ts.end_time AS gioEnd,
       room.name_room AS phongHoc,
       sub.name_subject AS tenMonHoc,
       te.name_teacher AS giangVien,
       ss.note AS ghiChu,
       ss.ID_session AS [MÃ£ buá»•i há»c],
       c.ID_class AS [MÃ£ lá»›p há»c pháº§n],
       ss.study_date AS [NgÃ y há»c],
       ss.day_of_week AS [Thá»©],
       ts.shift_no AS [Ca há»c],
       ts.start_time AS [Giá» báº¯t Ä‘áº§u],
       ts.end_time AS [Giá» káº¿t thÃºc],
       room.name_room AS [PhÃ²ng há»c],
       sub.name_subject AS [TÃªn há»c pháº§n],
       te.name_teacher AS [Giáº£ng viÃªn],
       ss.note AS [Ghi chÃº],
       h.ID_headquarter AS maCS
     FROM registration r
     JOIN student st
       ON r.ID_student COLLATE SQL_Latin1_General_CP1_CI_AS = st.ID_student COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN department d_st
       ON st.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS = d_st.ID_department COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN headquarter h
       ON d_st.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS = h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN [class] c
       ON r.ID_class COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_class COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN subject sub
       ON c.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS = sub.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN teacher te
       ON c.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS = te.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN [session] ss
       ON c.ID_class COLLATE SQL_Latin1_General_CP1_CI_AS = ss.ID_class COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN timeslot ts
       ON ss.ID_timeslot COLLATE SQL_Latin1_General_CP1_CI_AS = ts.ID_timeslot COLLATE SQL_Latin1_General_CP1_CI_AS
     JOIN room
       ON ss.ID_room COLLATE SQL_Latin1_General_CP1_CI_AS = room.ID_room COLLATE SQL_Latin1_General_CP1_CI_AS
     WHERE r.ID_student COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_student COLLATE SQL_Latin1_General_CP1_CI_AS
       AND h.ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS = @ID_headquarter COLLATE SQL_Latin1_General_CP1_CI_AS
       AND r.registration_status COLLATE SQL_Latin1_General_CP1_CI_AS = 'REGISTERED'
     ORDER BY ss.study_date, ts.shift_no, c.ID_class`
  );
  return result.recordset ?? [];
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
    return res.status(400).json({ success: false, message: 'Thiáº¿u thÃ´ng tin sinh viÃªn trong token.' });
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
    return res.status(400).json({ success: false, message: 'Thiáº¿u thÃ´ng tin sinh viÃªn trong token.' });
  }

  try {
    const data = await fetchCrossSchedule(req, maSV);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
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

router.post('/', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
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

router.put('/:id', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
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

router.delete('/:id', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
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
     // Check cache first
     const cached = getCachedResult(maSV, maCS, 'registrations');
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
     let crossRows = [];
     try {
       crossRows = await fetchCrossRegistrations(req, maSV);
     } catch (error) {
       console.warn(`[CROSS] KhÃ´ng láº¥y Ä‘Æ°á»£c Ä‘Äƒng kÃ½ chÃ©o tá»« HQHD: ${error.message}`);
       offlineNodes.push(HQHD_NODE);
     }

     const data = dedupeRows(
       [...localRows, ...crossRows],
       [
         ['MÃ£ Ä‘Äƒng kÃ½', 'maDangKy', 'ID_registration'],
         ['MÃ£ lá»›p há»c pháº§n', 'maMH', 'ID_class']
       ]
     );

     if (offlineNodes.length === 0) {
       setCachedResult(maSV, maCS, 'registrations', data);
     }

     return res.json({
       success: true,
       data,
       meta: { offlineNodes, crossRegistrationCount: crossRows.length },
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

      router.get('/timetable', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
         const nodeKey = resolveNode(req);
         const studentId = req.query.ID_student;
         const headquarterId = normalizeNodeKey(req.query.ID_headquarter ?? req.query.maCS);

         if (!nodeKey) {
           return res.status(400).json({ success: false, message: 'Thieu ma co so.' });
         }
         if (!studentId) {
           return res.status(400).json({ success: false, message: 'Thieu ma sinh vien.' });
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
     let crossRows = [];
     try {
       crossRows = await fetchCrossSchedule(req, maSV);
     } catch (error) {
       console.warn(`[CROSS] KhÃ´ng láº¥y Ä‘Æ°á»£c thá»i khÃ³a biá»ƒu chÃ©o tá»« HQHD: ${error.message}`);
       offlineNodes.push(HQHD_NODE);
     }

     const data = dedupeRows(
       [...localRows, ...crossRows],
       [
         ['MÃ£ buá»•i há»c', 'ID_session', 'id_session'],
         ['MÃ£ lá»›p há»c pháº§n', 'ID_class', 'id_class']
       ]
     );

     if (offlineNodes.length === 0) {
       setCachedResult(maSV, maCS, 'schedule', data);
     }

     return res.json({
       success: true,
       data,
       meta: { offlineNodes, crossScheduleCount: crossRows.length },
       cached: false
     });
   } catch (error) {
     return sendError(res, error);
   }
 });

router.get('/:id', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
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
