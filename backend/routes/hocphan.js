import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getPool } from '../config/db.js';
import { isValidNode, normalizeNodeKey } from '../config/nodes.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';
import { deleteRow, insertRow, queryRows, updateRow } from '../utils/tableCrud.js';

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

function ensureHQHD(req, res, next) {
  const userNode = normalizeNodeKey(req.user?.maCS);
  if (userNode !== 'HQHD') {
    return res.status(403).json({
      success: false,
      message: 'Chức năng này chỉ dành cho quản trị viên tại HQHD.'
    });
  }
  return next();
}

router.get('/classes', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const maCSRaw = req.query.maCS;
  const maCS = normalizeNodeKey(maCSRaw);
  if (!maCS || !isValidNode(maCS)) {
    return res.status(400).json({
      success: false,
      message: 'Mã cơ sở không hợp lệ.'
    });
  }

  try {
    const pool = await safeGetPool(maCS);
    const request = createRequest(maCS, null, pool);
    const result = await request.query(
      `SELECT ID_class
       FROM [class]
       ORDER BY ID_class`
    );

    return res.json({
      success: true,
      data: result.recordset.map(row => ({
        id_class: row.ID_class
      }))
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/available', authenticate, requireRole(['sinhvien']), async (req, res) => {
   const maCS = normalizeNodeKey(req.query.maCS) || normalizeNodeKey(req.user?.maCS);

   if (!maCS) {
     return res.status(400).json({
       success: false,
       message: 'Thiếu thông tin cơ sở.'
     });
   }

   try {
     const pool = await safeGetPool(maCS);
     const request = createRequest(maCS, null, pool);
     const result = await request.query(
       `SELECT 
          c.ID_class AS maMH,
          s.name_subject AS tenMonHoc,
          s.number_of_credit AS soTC,
          c.group_number AS nhom,
          t.name_teacher AS giangVien,
          c.max_students AS siSoToiDa,
          c.number_of_registration AS siSoDaDangKy,
          (c.max_students - c.number_of_registration) AS conLai,
          c.class_status AS trangThai,
          tm.name_term AS hocKy
        FROM [class] c
        JOIN subject s ON s.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS
        JOIN teacher t ON t.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS
        JOIN term tm ON tm.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE c.class_status COLLATE SQL_Latin1_General_CP1_CI_AS = 'OPEN'
          AND c.max_students > c.number_of_registration
        ORDER BY c.ID_class`
     );

     return res.json({
       success: true,
       data: result.recordset
     });
   } catch (error) {
     return sendError(res, error);
   }
});

router.get('/schedule/:classId', authenticate, requireRole(['sinhvien']), async (req, res) => {
   const maCS = normalizeNodeKey(req.user?.maCS);
   const { classId } = req.params;

   if (!maCS || !classId) {
     return res.status(400).json({
       success: false,
       message: 'Thiếu thông tin.'
     });
   }

   try {
     const pool = await safeGetPool(maCS);
     const request = createRequest(maCS, null, pool);
     request.input('classId', ID_TYPE, classId);
     const result = await request.query(
       `SELECT 
          s.ID_session AS ID_session,
          s.study_date AS ngayHoc,
          s.day_of_week AS thuHoc,
          s.note AS ghiChu,
          ts.shift_no AS caHoc,
          ts.start_time AS gioStart,
          ts.end_time AS gioEnd,
          r.name_room AS phongHoc
        FROM [session] s
        JOIN timeslot ts ON ts.ID_timeslot COLLATE SQL_Latin1_General_CP1_CI_AS = s.ID_timeslot COLLATE SQL_Latin1_General_CP1_CI_AS
        JOIN room r ON r.ID_room COLLATE SQL_Latin1_General_CP1_CI_AS = s.ID_room COLLATE SQL_Latin1_General_CP1_CI_AS
        WHERE s.ID_class COLLATE SQL_Latin1_General_CP1_CI_AS = @classId COLLATE SQL_Latin1_General_CP1_CI_AS
        ORDER BY s.study_date, ts.shift_no`
     );

     return res.json({
       success: true,
       data: result.recordset
     });
   } catch (error) {
     return sendError(res, error);
   }
});

router.get('/available-all', authenticate, requireRole(['sinhvien']), async (req, res) => {
  try {
    const { getNodes } = await import('../config/nodes.js');
    const nodes = getNodes();
    const allClasses = {};

    for (const [nodeKey, nodeInfo] of Object.entries(nodes)) {
      try {
        const pool = await safeGetPool(nodeKey);
        const request = createRequest(nodeKey, null, pool);
        const result = await request.query(
          `SELECT 
              c.ID_class AS maMH,
              s.name_subject AS tenMonHoc,
              s.number_of_credit AS soTC,
              c.group_number AS nhom,
              t.name_teacher AS giangVien,
              c.max_students AS siSoToiDa,
              c.number_of_registration AS siSoDaDangKy,
              (c.max_students - c.number_of_registration) AS conLai,
              c.class_status AS trangThai,
              tm.name_term AS hocKy
            FROM [class] c
            JOIN subject s ON s.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS
            JOIN teacher t ON t.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS
            JOIN term tm ON tm.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS
            WHERE c.class_status COLLATE SQL_Latin1_General_CP1_CI_AS = 'OPEN'
              AND c.max_students > c.number_of_registration
            ORDER BY c.ID_class`
        );
        allClasses[nodeKey] = result.recordset;
      } catch (err) {
        console.log(`[DB] Failed to fetch from ${nodeKey}:`, err.message);
        allClasses[nodeKey] = [];
      }
    }

    return res.json({
      success: true,
      data: allClasses
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id', authenticate, requireRole(['quantrivien']), ensureHQHD, async (req, res) => {
  try {
    const { rows } = await queryRows('HQHD', 'subject', { ID_subject: req.params.id }, 1);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học phần.' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:id', authenticate, requireRole(['quantrivien']), ensureHQHD, async (req, res) => {
  try {
    await updateRow('HQHD', 'subject', req.body ?? {}, { ID_subject: req.params.id });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/:id', authenticate, requireRole(['quantrivien']), ensureHQHD, async (req, res) => {
  try {
    await deleteRow('HQHD', 'subject', { ID_subject: req.params.id });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/', authenticate, requireRole(['quantrivien']), ensureHQHD, async (req, res) => {
  try {
    const { rows } = await queryRows('HQHD', 'subject', {}, 500);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/', authenticate, requireRole(['quantrivien']), ensureHQHD, async (req, res) => {
  try {
    await insertRow('HQHD', 'subject', req.body ?? {});
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
