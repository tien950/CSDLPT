import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getPool } from '../config/db.js';
import { normalizeNodeKey, getHeadquarterId, isValidNode } from '../config/nodes.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';
import { deleteRow, insertRow, queryRows, updateRow } from '../utils/tableCrud.js';
import { getCachedResult, setCachedResult } from '../utils/queryCache.js';

const router = express.Router();
const ID_TYPE = sql.NVarChar(50);

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
}

function resolveNode(req) {
  const requested = normalizeNodeKey(req.query.maCS ?? req.query.ID_headquarter ?? req.body?.ID_headquarter);
  const userNode = normalizeNodeKey(req.user?.maCS);
  if (req.user?.role === 'quantrivien' && requested && isValidNode(requested)) {
    return requested;
  }
  return userNode;
}

router.get('/', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
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

     const pool = await safeGetPool(maCS);
     const resolvedHeadquarter = (await fetchStudentHeadquarterId(maCS, maSV))
       ?? getHeadquarterId(maCS)
       ?? maCS;

     const request = createRequest(maCS, null, pool);
     request.input('ID_student', ID_TYPE, maSV);
     request.input('ID_headquarter', ID_TYPE, resolvedHeadquarter);

     let result = await request.execute('usp_GetRegistrationResult');

     if (result.recordset.length === 0 && resolvedHeadquarter) {
       const fallbackRequest = createRequest(maCS, null, pool);
       fallbackRequest.input('ID_student', ID_TYPE, maSV);
       result = await fallbackRequest.execute('usp_GetRegistrationResult');
     }

     const data = result.recordset;
     setCachedResult(maSV, maCS, 'registrations', data);

     return res.json({
       success: true,
       data,
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

     const pool = await safeGetPool(maCS);
     const resolvedHeadquarter = (await fetchStudentHeadquarterId(maCS, maSV))
       ?? getHeadquarterId(maCS)
       ?? maCS;

     const request = createRequest(maCS, null, pool);
     request.input('ID_student', ID_TYPE, maSV);
     request.input('ID_headquarter', ID_TYPE, resolvedHeadquarter);

     let result = await request.execute('usp_GetStudentTimetable');

     if (result.recordset.length === 0 && resolvedHeadquarter) {
       const fallbackRequest = createRequest(maCS, null, pool);
       fallbackRequest.input('ID_student', ID_TYPE, maSV);
       result = await fallbackRequest.execute('usp_GetStudentTimetable');
     }

     const data = result.recordset;
     setCachedResult(maSV, maCS, 'schedule', data);

     return res.json({
       success: true,
       data,
       meta: { offlineNodes: [] },
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
