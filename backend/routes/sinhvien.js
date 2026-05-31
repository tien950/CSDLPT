import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getPool } from '../config/db.js';
import { normalizeNodeKey, getHeadquarterId } from '../config/nodes.js';
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

    return res.json({
      success: true,
      data: result.recordset
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

    return res.json({
      success: true,
      data: result.recordset,
      meta: {
        offlineNodes: []
      }
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
