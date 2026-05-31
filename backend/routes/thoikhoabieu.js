import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { isValidNode, normalizeNodeKey } from '../config/nodes.js';
import { getPool } from '../config/db.js';
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
  return res.status(status).json({ success: false, message });
}

async function safeGetPool(nodeKey) {
  try {
    return await getPool(nodeKey);
  } catch (error) {
    throw withNode(nodeKey, error);
  }
}

router.get('/', authenticate, requireRole(['sinhvien', 'nhanvien', 'quantrivien', 'giangvien']), async (req, res) => {
  const role = req.user?.role;
  let studentId = req.query.ID_student;
  let headquarterId = normalizeNodeKey(req.query.ID_headquarter ?? req.query.maCS);

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
    const result = await request.execute('usp_GetStudentTimetable');

    return res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;

