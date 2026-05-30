import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getPool } from '../config/db.js';
import { isValidNode } from '../config/nodes.js';
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

router.get('/classes', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const maCS = req.query.maCS;
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
      `SELECT id_class
       FROM [class]
       ORDER BY id_class`
    );

    return res.json({
      success: true,
      data: result.recordset.map(row => ({
        id_class: row.id_class
      }))
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
