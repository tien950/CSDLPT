import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { LOCAL_NODE, isValidNode, normalizeNodeKey } from '../config/nodes.js';
import { isOfflineError } from '../utils/db.js';
import { deleteRow, insertRow, queryRows, updateRow } from '../utils/tableCrud.js';
import { callRemoteNode } from '../utils/remoteApi.js';

const router = express.Router();
const TABLE = 'class';
const ID_FIELD = 'ID_class';

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

function resolveNode(req) {
  const requested = normalizeNodeKey(req.query.maCS ?? req.query.ID_headquarter ?? req.body?.ID_headquarter);
  const userNode = normalizeNodeKey(req.user?.maCS);
  if (req.user?.role === 'quantrivien' && requested && isValidNode(requested)) {
    return requested;
  }
  return userNode;
}

async function proxyIfRemote(req, nodeKey) {
  if (!nodeKey || nodeKey === LOCAL_NODE) return null;
  return await callRemoteNode(nodeKey, req.method, req.originalUrl, req.body ?? null, req.headers.authorization);
}

router.use(authenticate, requireRole(['nhanvien', 'quantrivien']));

router.get('/', async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  const filters = {};
  if (req.query.ID_term) {
    filters.ID_term = req.query.ID_term;
  }

  try {
    const { rows } = await queryRows(nodeKey, TABLE, filters, 500);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    const { rows } = await queryRows(nodeKey, TABLE, { [ID_FIELD]: req.params.id }, 1);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lớp học phần.' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/', async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    await insertRow(nodeKey, TABLE, req.body ?? {});
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:id', async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    await updateRow(nodeKey, TABLE, req.body ?? {}, { [ID_FIELD]: req.params.id });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:id/status', async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  const classStatus = req.body?.class_status ?? req.body?.status;
  if (!classStatus) {
    return res.status(400).json({ success: false, message: 'Thiếu trạng thái lớp học phần.' });
  }

  try {
    await updateRow(nodeKey, TABLE, { class_status: classStatus }, { [ID_FIELD]: req.params.id });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/:id', async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    await deleteRow(nodeKey, TABLE, { [ID_FIELD]: req.params.id });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;

