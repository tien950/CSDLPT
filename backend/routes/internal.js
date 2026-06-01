import express from 'express';
import { LOCAL_NODE } from '../config/nodes.js';

const router = express.Router();

router.get('/node-ping', (req, res) => {
  return res.json({
    success: true,
    node: LOCAL_NODE,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

export default router;

