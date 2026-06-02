import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getPool } from '../config/db.js';
import { LOCAL_NODE, getNodes, isValidNode, normalizeNodeKey } from '../config/nodes.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';
import { callRemoteNode } from '../utils/remoteApi.js';

const router = express.Router();
const ID_TYPE = sql.NVarChar(50);

function isCentralAdmin(req) {
  return req.user?.role === 'quantrivien' && normalizeNodeKey(req.user?.maCS) === 'HQHD';
}

async function proxyToHqhdIfNeeded(req, res) {
  if (normalizeNodeKey(LOCAL_NODE) === 'HQHD') return false;
  const remote = await callRemoteNode('HQHD', req.method, req.originalUrl, null, req.headers.authorization);
  res.status(remote.status).json(remote.data);
  return true;
}

const DISTRIBUTED_QUERIES = {
  q1: {
    title: 'Thong ke so sinh vien da dang ky theo co so',
    sql: `
WITH q AS
(
SELECT
 hq.ID_headquarter COLLATE DATABASE_DEFAULT AS ID_headquarter,
 hq.name_headquarter COLLATE DATABASE_DEFAULT AS name_headquarter,
 COUNT(DISTINCT r.ID_student) AS student_count
FROM DkyTinChi.dbo.registration r
JOIN DkyTinChi.dbo.student st
  ON r.ID_student COLLATE DATABASE_DEFAULT = st.ID_student COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.department d
  ON st.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.headquarter hq
  ON d.ID_headquarter COLLATE DATABASE_DEFAULT = hq.ID_headquarter COLLATE DATABASE_DEFAULT
WHERE r.registration_status COLLATE DATABASE_DEFAULT = 'REGISTERED'
  AND hq.ID_headquarter COLLATE DATABASE_DEFAULT = 'HQHD'
GROUP BY hq.ID_headquarter, hq.name_headquarter
UNION ALL
SELECT ID_headquarter COLLATE DATABASE_DEFAULT, name_headquarter COLLATE DATABASE_DEFAULT, student_count
FROM OPENQUERY(
  LINK_HL,
  '
  SELECT hq.ID_headquarter, hq.name_headquarter, COUNT(DISTINCT r.ID_student) AS student_count
  FROM CSDL_HL.dbo.registration r
  JOIN CSDL_HL.dbo.student st ON r.ID_student COLLATE DATABASE_DEFAULT = st.ID_student COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.department d ON st.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.headquarter hq ON d.ID_headquarter COLLATE DATABASE_DEFAULT = hq.ID_headquarter COLLATE DATABASE_DEFAULT
  WHERE r.registration_status COLLATE DATABASE_DEFAULT = ''REGISTERED''
    AND hq.ID_headquarter COLLATE DATABASE_DEFAULT = ''HQHL''
  GROUP BY hq.ID_headquarter, hq.name_headquarter
  '
)
UNION ALL
SELECT ID_headquarter COLLATE DATABASE_DEFAULT, name_headquarter COLLATE DATABASE_DEFAULT, student_count
FROM OPENQUERY(
  Link_HoChiMinh,
  '
  SELECT hq.ID_headquarter, hq.name_headquarter, COUNT(DISTINCT r.ID_student) AS student_count
  FROM DkiTinChi_HCM.dbo.registration r
  JOIN DkiTinChi_HCM.dbo.student st ON r.ID_student COLLATE DATABASE_DEFAULT = st.ID_student COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.department d ON st.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.headquarter hq ON d.ID_headquarter COLLATE DATABASE_DEFAULT = hq.ID_headquarter COLLATE DATABASE_DEFAULT
  WHERE r.registration_status COLLATE DATABASE_DEFAULT = ''REGISTERED''
    AND hq.ID_headquarter COLLATE DATABASE_DEFAULT = ''HQHCM''
  GROUP BY hq.ID_headquarter, hq.name_headquarter
  '
)
)
SELECT
 ID_headquarter AS [Ma co so],
 name_headquarter AS [Co so],
 student_count AS [So sinh vien da dang ky]
FROM q
ORDER BY ID_headquarter;
    `
  },
  q2: {
    title: 'Hoc phan co nhieu sinh vien dang ky nhat',
    sql: `
WITH q AS
(
SELECT sub.ID_subject COLLATE DATABASE_DEFAULT AS ID_subject,
       sub.name_subject COLLATE DATABASE_DEFAULT AS name_subject,
       COUNT(*) AS registered_count
FROM DkyTinChi.dbo.registration r
JOIN DkyTinChi.dbo.[class] c ON r.ID_class COLLATE DATABASE_DEFAULT = c.ID_class COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
WHERE r.registration_status COLLATE DATABASE_DEFAULT = 'REGISTERED'
  AND d.ID_headquarter COLLATE DATABASE_DEFAULT = 'HQHD'
GROUP BY sub.ID_subject, sub.name_subject
UNION ALL
SELECT ID_subject COLLATE DATABASE_DEFAULT, name_subject COLLATE DATABASE_DEFAULT, registered_count
FROM OPENQUERY(
  LINK_HL,
  '
  SELECT sub.ID_subject, sub.name_subject, COUNT(*) AS registered_count
  FROM CSDL_HL.dbo.registration r
  JOIN CSDL_HL.dbo.[class] c ON r.ID_class COLLATE DATABASE_DEFAULT = c.ID_class COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
  WHERE r.registration_status COLLATE DATABASE_DEFAULT = ''REGISTERED''
    AND d.ID_headquarter COLLATE DATABASE_DEFAULT = ''HQHL''
  GROUP BY sub.ID_subject, sub.name_subject
  '
)
UNION ALL
SELECT ID_subject COLLATE DATABASE_DEFAULT, name_subject COLLATE DATABASE_DEFAULT, registered_count
FROM OPENQUERY(
  Link_HoChiMinh,
  '
  SELECT sub.ID_subject, sub.name_subject, COUNT(*) AS registered_count
  FROM DkiTinChi_HCM.dbo.registration r
  JOIN DkiTinChi_HCM.dbo.[class] c ON r.ID_class COLLATE DATABASE_DEFAULT = c.ID_class COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
  WHERE r.registration_status COLLATE DATABASE_DEFAULT = ''REGISTERED''
    AND d.ID_headquarter COLLATE DATABASE_DEFAULT = ''HQHCM''
  GROUP BY sub.ID_subject, sub.name_subject
  '
)
)
SELECT TOP 1
 ID_subject AS [Ma hoc phan],
 name_subject AS [Ten hoc phan],
 SUM(registered_count) AS [Tong so sinh vien dang ky]
FROM q
GROUP BY ID_subject, name_subject
ORDER BY SUM(registered_count) DESC;
    `
  },
  q3: {
    title: 'Danh sach sinh vien dang ky cheo co so',
    sql: `
WITH q AS
(
SELECT
 r.ID_registration COLLATE DATABASE_DEFAULT AS ID_registration,
 st.ID_student COLLATE DATABASE_DEFAULT AS ID_student,
 st.name_student COLLATE DATABASE_DEFAULT AS name_student,
 hq_st.name_headquarter COLLATE DATABASE_DEFAULT AS student_campus,
 c.ID_class COLLATE DATABASE_DEFAULT AS ID_class,
 sub.name_subject COLLATE DATABASE_DEFAULT AS name_subject,
 hq_cl.name_headquarter COLLATE DATABASE_DEFAULT AS class_campus
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
SELECT ID_registration COLLATE DATABASE_DEFAULT, ID_student COLLATE DATABASE_DEFAULT, name_student COLLATE DATABASE_DEFAULT, student_campus COLLATE DATABASE_DEFAULT, ID_class COLLATE DATABASE_DEFAULT, name_subject COLLATE DATABASE_DEFAULT, class_campus COLLATE DATABASE_DEFAULT
FROM OPENQUERY(
  LINK_HL,
  '
  SELECT r.ID_registration, st.ID_student, st.name_student,
         hq_st.name_headquarter AS student_campus,
         c.ID_class, sub.name_subject,
         hq_cl.name_headquarter AS class_campus
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
SELECT ID_registration COLLATE DATABASE_DEFAULT, ID_student COLLATE DATABASE_DEFAULT, name_student COLLATE DATABASE_DEFAULT, student_campus COLLATE DATABASE_DEFAULT, ID_class COLLATE DATABASE_DEFAULT, name_subject COLLATE DATABASE_DEFAULT, class_campus COLLATE DATABASE_DEFAULT
FROM OPENQUERY(
  Link_HoChiMinh,
  '
  SELECT r.ID_registration, st.ID_student, st.name_student,
         hq_st.name_headquarter AS student_campus,
         c.ID_class, sub.name_subject,
         hq_cl.name_headquarter AS class_campus
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
SELECT ID_registration AS [Ma dang ky], ID_student AS [Ma sinh vien], name_student AS [Ten sinh vien], student_campus AS [Co so sinh vien], ID_class AS [Ma lop hoc phan], name_subject AS [Ten hoc phan], class_campus AS [Co so mo lop]
FROM q
ORDER BY student_campus, class_campus, ID_student;
    `
  },
  q4: {
    title: 'Ty le lap day lop hoc phan toan he thong',
    sql: `
WITH q AS
(
SELECT N'Ha Dong' AS site_name, c.ID_class COLLATE DATABASE_DEFAULT AS ID_class, sub.name_subject COLLATE DATABASE_DEFAULT AS name_subject, c.max_students, c.number_of_registration, c.class_status COLLATE DATABASE_DEFAULT AS class_status
FROM DkyTinChi.dbo.[class] c
JOIN DkyTinChi.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
WHERE d.ID_headquarter COLLATE DATABASE_DEFAULT = 'HQHD'
UNION ALL
SELECT N'Hoa Lac', ID_class COLLATE DATABASE_DEFAULT, name_subject COLLATE DATABASE_DEFAULT, max_students, number_of_registration, class_status COLLATE DATABASE_DEFAULT
FROM OPENQUERY(
  LINK_HL,
  '
  SELECT c.ID_class, sub.name_subject, c.max_students, c.number_of_registration, c.class_status
  FROM CSDL_HL.dbo.[class] c
  JOIN CSDL_HL.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
  WHERE d.ID_headquarter COLLATE DATABASE_DEFAULT = ''HQHL''
  '
)
UNION ALL
SELECT N'TP. Ho Chi Minh', ID_class COLLATE DATABASE_DEFAULT, name_subject COLLATE DATABASE_DEFAULT, max_students, number_of_registration, class_status COLLATE DATABASE_DEFAULT
FROM OPENQUERY(
  Link_HoChiMinh,
  '
  SELECT c.ID_class, sub.name_subject, c.max_students, c.number_of_registration, c.class_status
  FROM DkiTinChi_HCM.dbo.[class] c
  JOIN DkiTinChi_HCM.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
  WHERE d.ID_headquarter COLLATE DATABASE_DEFAULT = ''HQHCM''
  '
)
)
SELECT site_name AS [Co so], ID_class AS [Ma lop hoc phan], name_subject AS [Ten hoc phan], max_students AS [Si so toi da], number_of_registration AS [Da dang ky], CAST(number_of_registration * 100.0 / NULLIF(max_students, 0) AS decimal(5,2)) AS [Ty le lap day (%)], class_status AS [Trang thai lop]
FROM q
ORDER BY site_name, [Ty le lap day (%)] DESC;
    `
  },
  q5: {
    title: 'Thong ke so lop hoc phan mo theo khoa',
    sql: `
WITH q AS
(
SELECT hq.name_headquarter COLLATE DATABASE_DEFAULT AS campus_name, d.name_department COLLATE DATABASE_DEFAULT AS department_name, COUNT(c.ID_class) AS class_count
FROM DkyTinChi.dbo.[class] c
JOIN DkyTinChi.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.headquarter hq ON d.ID_headquarter COLLATE DATABASE_DEFAULT = hq.ID_headquarter COLLATE DATABASE_DEFAULT
WHERE c.class_status COLLATE DATABASE_DEFAULT = 'OPEN'
  AND hq.ID_headquarter COLLATE DATABASE_DEFAULT = 'HQHD'
GROUP BY hq.name_headquarter, d.name_department
UNION ALL
SELECT campus_name COLLATE DATABASE_DEFAULT, department_name COLLATE DATABASE_DEFAULT, class_count
FROM OPENQUERY(
  LINK_HL,
  '
  SELECT hq.name_headquarter AS campus_name, d.name_department AS department_name, COUNT(c.ID_class) AS class_count
  FROM CSDL_HL.dbo.[class] c
  JOIN CSDL_HL.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.headquarter hq ON d.ID_headquarter COLLATE DATABASE_DEFAULT = hq.ID_headquarter COLLATE DATABASE_DEFAULT
  WHERE c.class_status COLLATE DATABASE_DEFAULT = ''OPEN''
    AND hq.ID_headquarter COLLATE DATABASE_DEFAULT = ''HQHL''
  GROUP BY hq.name_headquarter, d.name_department
  '
)
UNION ALL
SELECT campus_name COLLATE DATABASE_DEFAULT, department_name COLLATE DATABASE_DEFAULT, class_count
FROM OPENQUERY(
  Link_HoChiMinh,
  '
  SELECT hq.name_headquarter AS campus_name, d.name_department AS department_name, COUNT(c.ID_class) AS class_count
  FROM DkiTinChi_HCM.dbo.[class] c
  JOIN DkiTinChi_HCM.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.headquarter hq ON d.ID_headquarter COLLATE DATABASE_DEFAULT = hq.ID_headquarter COLLATE DATABASE_DEFAULT
  WHERE c.class_status COLLATE DATABASE_DEFAULT = ''OPEN''
    AND hq.ID_headquarter COLLATE DATABASE_DEFAULT = ''HQHCM''
  GROUP BY hq.name_headquarter, d.name_department
  '
)
)
SELECT campus_name AS [Co so], department_name AS [Khoa], SUM(class_count) AS [So lop hoc phan dang mo]
FROM q
GROUP BY campus_name, department_name
ORDER BY campus_name, department_name;
    `
  },
  q6: {
    title: 'Danh sach lop hoc phan con cho',
    sql: `
WITH q AS
(
SELECT N'Ha Dong' AS site_name, c.ID_class COLLATE DATABASE_DEFAULT AS ID_class, sub.name_subject COLLATE DATABASE_DEFAULT AS name_subject, c.max_students, c.number_of_registration
FROM DkyTinChi.dbo.[class] c
JOIN DkyTinChi.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
WHERE c.class_status COLLATE DATABASE_DEFAULT = 'OPEN'
  AND c.number_of_registration < c.max_students
  AND d.ID_headquarter COLLATE DATABASE_DEFAULT = 'HQHD'
UNION ALL
SELECT N'Hoa Lac', ID_class COLLATE DATABASE_DEFAULT, name_subject COLLATE DATABASE_DEFAULT, max_students, number_of_registration
FROM OPENQUERY(
  LINK_HL,
  '
  SELECT c.ID_class, sub.name_subject, c.max_students, c.number_of_registration
  FROM CSDL_HL.dbo.[class] c
  JOIN CSDL_HL.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
  WHERE c.class_status COLLATE DATABASE_DEFAULT = ''OPEN''
    AND c.number_of_registration < c.max_students
    AND d.ID_headquarter COLLATE DATABASE_DEFAULT = ''HQHL''
  '
)
UNION ALL
SELECT N'TP. Ho Chi Minh', ID_class COLLATE DATABASE_DEFAULT, name_subject COLLATE DATABASE_DEFAULT, max_students, number_of_registration
FROM OPENQUERY(
  Link_HoChiMinh,
  '
  SELECT c.ID_class, sub.name_subject, c.max_students, c.number_of_registration
  FROM DkiTinChi_HCM.dbo.[class] c
  JOIN DkiTinChi_HCM.dbo.subject sub ON c.ID_subject COLLATE DATABASE_DEFAULT = sub.ID_subject COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
  WHERE c.class_status COLLATE DATABASE_DEFAULT = ''OPEN''
    AND c.number_of_registration < c.max_students
    AND d.ID_headquarter COLLATE DATABASE_DEFAULT = ''HQHCM''
  '
)
)
SELECT site_name AS [Co so], ID_class AS [Ma lop hoc phan], name_subject AS [Ten hoc phan], max_students AS [Si so toi da], number_of_registration AS [Da dang ky], max_students - number_of_registration AS [So cho con lai]
FROM q
ORDER BY site_name, [So cho con lai] DESC;
    `
  },
  q7: {
    title: 'Thong ke khoi luong giang day cua giang vien',
    sql: `
WITH q AS
(
SELECT hq.name_headquarter COLLATE DATABASE_DEFAULT AS campus_name, te.ID_teacher COLLATE DATABASE_DEFAULT AS ID_teacher, te.name_teacher COLLATE DATABASE_DEFAULT AS name_teacher, COUNT(c.ID_class) AS class_count
FROM DkyTinChi.dbo.[class] c
JOIN DkyTinChi.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
JOIN DkyTinChi.dbo.headquarter hq ON d.ID_headquarter COLLATE DATABASE_DEFAULT = hq.ID_headquarter COLLATE DATABASE_DEFAULT
WHERE hq.ID_headquarter COLLATE DATABASE_DEFAULT = 'HQHD'
GROUP BY hq.name_headquarter, te.ID_teacher, te.name_teacher
UNION ALL
SELECT campus_name COLLATE DATABASE_DEFAULT, ID_teacher COLLATE DATABASE_DEFAULT, name_teacher COLLATE DATABASE_DEFAULT, class_count
FROM OPENQUERY(
  LINK_HL,
  '
  SELECT hq.name_headquarter AS campus_name, te.ID_teacher, te.name_teacher, COUNT(c.ID_class) AS class_count
  FROM CSDL_HL.dbo.[class] c
  JOIN CSDL_HL.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
  JOIN CSDL_HL.dbo.headquarter hq ON d.ID_headquarter COLLATE DATABASE_DEFAULT = hq.ID_headquarter COLLATE DATABASE_DEFAULT
  WHERE hq.ID_headquarter COLLATE DATABASE_DEFAULT = ''HQHL''
  GROUP BY hq.name_headquarter, te.ID_teacher, te.name_teacher
  '
)
UNION ALL
SELECT campus_name COLLATE DATABASE_DEFAULT, ID_teacher COLLATE DATABASE_DEFAULT, name_teacher COLLATE DATABASE_DEFAULT, class_count
FROM OPENQUERY(
  Link_HoChiMinh,
  '
  SELECT hq.name_headquarter AS campus_name, te.ID_teacher, te.name_teacher, COUNT(c.ID_class) AS class_count
  FROM DkiTinChi_HCM.dbo.[class] c
  JOIN DkiTinChi_HCM.dbo.teacher te ON c.ID_teacher COLLATE DATABASE_DEFAULT = te.ID_teacher COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.department d ON te.ID_department COLLATE DATABASE_DEFAULT = d.ID_department COLLATE DATABASE_DEFAULT
  JOIN DkiTinChi_HCM.dbo.headquarter hq ON d.ID_headquarter COLLATE DATABASE_DEFAULT = hq.ID_headquarter COLLATE DATABASE_DEFAULT
  WHERE hq.ID_headquarter COLLATE DATABASE_DEFAULT = ''HQHCM''
  GROUP BY hq.name_headquarter, te.ID_teacher, te.name_teacher
  '
)
)
SELECT campus_name AS [Co so], ID_teacher AS [Ma giang vien], name_teacher AS [Ten giang vien], SUM(class_count) AS [So lop phu trach]
FROM q
GROUP BY campus_name, ID_teacher, name_teacher
ORDER BY campus_name, SUM(class_count) DESC;
    `
  }
};

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

function buildRemotePath(path, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function safeGetPool(nodeKey) {
  try {
    return await getPool(nodeKey);
  } catch (error) {
    throw withNode(nodeKey, error);
  }
}

async function fetchOverviewForNode(nodeKey) {
  if (nodeKey !== LOCAL_NODE) {
    const remote = await callRemoteNode(nodeKey, 'GET', '/api/internal/thongke/overview', null, null);
    if (!remote.ok) {
      const error = new Error(remote.data?.message ?? 'Không lấy được thống kê từ node.');
      error.status = remote.status;
      error.node = nodeKey;
      throw error;
    }
    return remote.data?.data ?? {};
  }

  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  const result = await request.query(
    `SELECT
       (SELECT COUNT(*) FROM headquarter) AS headquarter,
       (SELECT COUNT(*) FROM department) AS department,
       (SELECT COUNT(*) FROM student) AS student,
       (SELECT COUNT(*) FROM teacher) AS teacher,
       (SELECT COUNT(*) FROM subject) AS subject,
       (SELECT COUNT(*) FROM [class]) AS class,
       (SELECT COUNT(*) FROM room) AS room,
       (SELECT COUNT(*) FROM session) AS session,
       (SELECT COUNT(*) FROM registration) AS registration,
       (SELECT COUNT(*) FROM registration WHERE registration_status = 'CANCELLED') AS cancelled
     `
  );

  const row = result.recordset[0] ?? {};
  return {
    headquarter: row.headquarter ?? 0,
    department: row.department ?? 0,
    student: row.student ?? 0,
    teacher: row.teacher ?? 0,
    subject: row.subject ?? 0,
    class: row.class ?? 0,
    room: row.room ?? 0,
    session: row.session ?? 0,
    registration: row.registration ?? 0,
    cancelled: row.cancelled ?? 0
  };
}

async function fetchClassStatsForNode(nodeKey, termId, headquarterId) {
  if (nodeKey !== LOCAL_NODE) {
    const remotePath = buildRemotePath('/api/thongke/lophocphan', {
      ID_term: termId,
      ID_headquarter: headquarterId
    });
    const remote = await callRemoteNode(nodeKey, 'GET', remotePath, null, null);
    if (!remote.ok) {
      const error = new Error(remote.data?.message ?? 'Không lấy được thống kê lớp học phần từ node.');
      error.status = remote.status;
      error.node = nodeKey;
      throw error;
    }
    return remote.data?.data ?? [];
  }

  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  if (termId) {
    request.input('ID_term', ID_TYPE, termId);
  }
  if (headquarterId) {
    request.input('ID_headquarter', ID_TYPE, headquarterId);
  }
  const result = await request.execute('usp_StatsClassRegistrationByTerm');
  return result.recordset ?? [];
}

router.get('/internal/overview', authenticate, async (req, res) => {
  try {
    const data = await fetchOverviewForNode(LOCAL_NODE);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/overview', authenticate, requireRole(['quantrivien']), async (req, res) => {
  const role = req.user?.role;
  const requestedNode = normalizeNodeKey(req.query.maCS);
  const scope = req.query.scope ?? 'all';

  let nodes = [];
  if (role === 'quantrivien' && scope === 'node' && requestedNode && isValidNode(requestedNode)) {
    nodes = [requestedNode];
  } else if (role === 'quantrivien' && scope === 'all') {
    nodes = Object.keys(getNodes());
  } else {
    const ownNode = normalizeNodeKey(req.user?.maCS);
    if (!ownNode) {
      return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
    }
    nodes = [ownNode];
  }

  try {
    const perNode = {};
    const offlineNodes = [];

    await Promise.all(nodes.map(async nodeKey => {
      try {
        perNode[nodeKey] = await fetchOverviewForNode(nodeKey);
      } catch (error) {
        const nodeError = withNode(nodeKey, error);
        if (isOfflineError(nodeError)) {
          offlineNodes.push(nodeKey);
        } else {
          throw nodeError;
        }
      }
    }));

    const total = Object.values(perNode).reduce((acc, current) => {
      Object.entries(current).forEach(([key, value]) => {
        acc[key] = (acc[key] ?? 0) + value;
      });
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        perNode,
        total,
        offlineNodes
      }
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/lophocphan', authenticate, requireRole(['quantrivien']), async (req, res) => {
  const role = req.user?.role;
  const termId = req.query.ID_term ?? null;
  const requestedNode = normalizeNodeKey(req.query.ID_headquarter ?? req.query.maCS);
  const centralAdmin = isCentralAdmin(req);

  if (centralAdmin && !requestedNode) {
    const nodes = Object.keys(getNodes());
    try {
      const results = await Promise.allSettled(
        nodes.map(nodeKey => fetchClassStatsForNode(nodeKey, termId, nodeKey))
      );
      const data = [];
      const offlineNodes = [];
      results.forEach((item, index) => {
        if (item.status === 'fulfilled') {
          data.push(...item.value);
        } else {
          offlineNodes.push(nodes[index]);
        }
      });
      return res.json({ success: true, data, meta: { offlineNodes } });
    } catch (error) {
      return sendError(res, error);
    }
  }

  const nodeKey = role === 'quantrivien' && requestedNode && isValidNode(requestedNode)
    ? requestedNode
    : normalizeNodeKey(req.user?.maCS);

  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  try {
    const data = await fetchClassStatsForNode(nodeKey, termId, nodeKey);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/sinhvien-theo-coso', authenticate, requireRole(['quantrivien']), async (req, res) => {
  const headquarterId = normalizeNodeKey(req.query.ID_headquarter ?? req.query.maCS);

  try {
    if (normalizeNodeKey(LOCAL_NODE) !== 'HQHD') {
      const remote = await callRemoteNode('HQHD', 'GET', req.originalUrl, null, req.headers.authorization);
      return res.status(remote.status).json(remote.data);
    }

    const pool = await safeGetPool('HQHD');
    const request = createRequest('HQHD', null, pool);
    if (headquarterId) {
      request.input('ID_headquarter', ID_TYPE, headquarterId);
    }
    const result = await request.execute('usp_StatsRegisteredStudentsByCampus');

    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/dangky-cheo', authenticate, requireRole(['quantrivien']), async (req, res) => {
  try {
    if (normalizeNodeKey(LOCAL_NODE) !== 'HQHD') {
      const remote = await callRemoteNode('HQHD', 'GET', req.originalUrl, null, req.headers.authorization);
      return res.status(remote.status).json(remote.data);
    }

    const pool = await safeGetPool('HQHD');
    const request = createRequest('HQHD', null, pool);
    const result = await request.execute('usp_CheckCrossCampusRegistration');

    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/distributed/:queryKey', authenticate, requireRole(['quantrivien']), async (req, res) => {
  if (!isCentralAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Chi quan tri vien HQHD duoc chay truy van phan tan.' });
  }

  try {
    if (await proxyToHqhdIfNeeded(req, res)) return;
  } catch (error) {
    return sendError(res, error);
  }

  const config = DISTRIBUTED_QUERIES[req.params.queryKey];
  if (!config) {
    return res.status(404).json({ success: false, message: 'Khong ton tai truy van.' });
  }

  try {
    const pool = await safeGetPool('HQHD');
    const request = createRequest('HQHD', null, pool);
    const result = await request.query(config.sql);
    return res.json({
      success: true,
      data: result.recordset ?? [],
      meta: {
        key: req.params.queryKey,
        title: config.title
      }
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
