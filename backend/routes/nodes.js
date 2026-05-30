import express from 'express';
import { getPool } from '../config/db.js';
import { nodeKeys } from '../config/nodes.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';

const router = express.Router();

async function checkNode(nodeKey) {
  try {
    const pool = await getPool(nodeKey);
    const request = createRequest(nodeKey, null, pool);
    await request.query('SELECT 1 AS ok');
    return { node: nodeKey, status: 'online' };
  } catch (error) {
    const nodeError = withNode(nodeKey, error);
    if (isOfflineError(nodeError)) {
      return { node: nodeKey, status: 'offline' };
    }
    return { node: nodeKey, status: 'error', message: nodeError.message };
  }
}

router.get('/status', authenticate, requireRole(['quantrivien']), async (req, res) => {
  const results = await Promise.all(nodeKeys.map(checkNode));
  return res.json({
    success: true,
    data: results
  });
});

export default router;
