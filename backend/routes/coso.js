import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { normalizeNodeKey } from '../config/nodes.js';
import { isOfflineError } from '../utils/db.js';
import { deleteRow, insertRow, queryRows, updateRow } from '../utils/tableCrud.js';
import { fetchNodeApiJson, getProxyHeaders, isProxyRequest } from '../utils/nodeProxy.js';

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

async function tryLocalThenProxy(req, nodeKey, method, apiPath, body = null) {
  try {
    if (method === 'GET' && apiPath.includes(':id')) {
      const { rows } = await queryRows(nodeKey, TABLE, { [ID_FIELD]: apiPath.split('/').pop() }, 1);
      return rows.length > 0 ? rows[0] : null;
    } else if (method === 'GET') {
      const { rows } = await queryRows(nodeKey, TABLE, {}, 500);
      return rows;
    } else if (method === 'POST') {
      await insertRow(nodeKey, TABLE, body ?? {});
      return { success: true };
    } else if (method === 'PUT') {
      await updateRow(nodeKey, TABLE, body ?? {}, { [ID_FIELD]: apiPath.split('/').pop() });
      return { success: true };
    } else if (method === 'DELETE') {
      await deleteRow(nodeKey, TABLE, { [ID_FIELD]: apiPath.split('/').pop() });
      return { success: true };
    }
  } catch (localError) {
    if (isProxyRequest(req)) throw localError;
    try {
      const proxyResult = await fetchNodeApiJson(nodeKey, apiPath, {
        method,
        body,
        headers: getProxyHeaders(req)
      });
      if (proxyResult.ok) {
        return proxyResult.data?.data ?? proxyResult.data;
      }
      throw new Error(proxyResult.data?.message ?? 'Proxy failed');
    } catch (proxyError) {
      console.warn(`[COSO] Proxy failed: ${proxyError.message}`);
      throw localError;
    }
  }
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
    const rows = await tryLocalThenProxy(req, HQHD_NODE, 'GET', '/api/coso');
    return res.json({ success: true, data: rows ?? [] });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const row = await tryLocalThenProxy(req, HQHD_NODE, 'GET', `/api/coso/${id}`);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cơ sở.' });
    }
    return res.json({ success: true, data: row });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    await tryLocalThenProxy(req, HQHD_NODE, 'POST', '/api/coso', req.body ?? {});
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await tryLocalThenProxy(req, HQHD_NODE, 'PUT', `/api/coso/${id}`, req.body ?? {});
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await tryLocalThenProxy(req, HQHD_NODE, 'DELETE', `/api/coso/${id}`);
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;

