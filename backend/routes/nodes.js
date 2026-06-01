import express from 'express';
import { LOCAL_NODE } from '../config/nodes.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { callAllNodes } from '../utils/remoteApi.js';

const router = express.Router();

router.get('/internal/node-ping', (req, res) => {
  return res.json({ success: true, node: LOCAL_NODE, status: 'ok' });
});

router.get('/status', authenticate, requireRole(['quantrivien']), async (req, res) => {
  const localNode = LOCAL_NODE ?? 'UNKNOWN';
  const remoteResults = await callAllNodes('GET', '/api/internal/node-ping', null, req.headers.authorization);
  const results = [
    { node: localNode, status: 'online' },
    ...remoteResults.map(item => ({
      node: item.node,
      status: item.ok ? 'online' : 'offline',
      message: item.data?.message ?? null
    }))
  ];
  return res.json({
    success: true,
    data: results
  });
});

export default router;
