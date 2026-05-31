import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { normalizeNodeKey } from '../config/nodes.js';
import { isOfflineError } from '../utils/db.js';
import { deleteRow, insertRow, queryRows, updateRow } from '../utils/tableCrud.js';

const router = express.Router();
const TABLE = 'headquarter';
const ID_FIELD = 'ID_headquarter';
const HQHD_NODE = 'HQHD';

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

function ensureHQHD(req, res, next) {
  const userNode = normalizeNodeKey(req.user?.maCS);
  if (userNode !== HQHD_NODE) {
    return res.status(403).json({
      success: false,
      message: 'Chức năng này chỉ dành cho quản trị viên tại HQHD.'
    });
  }
  return next();
}

router.use(authenticate, requireRole(['quantrivien']), ensureHQHD);

router.get('/', async (req, res) => {
  try {
    const { rows } = await queryRows(HQHD_NODE, TABLE, {}, 500);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const { rows } = await queryRows(HQHD_NODE, TABLE, { [ID_FIELD]: id }, 1);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cơ sở.' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    await insertRow(HQHD_NODE, TABLE, req.body ?? {});
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await updateRow(HQHD_NODE, TABLE, req.body ?? {}, { [ID_FIELD]: id });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await deleteRow(HQHD_NODE, TABLE, { [ID_FIELD]: id });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;

