import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getPool } from '../config/db.js';
import { getNodes, isValidNode, normalizeNodeKey } from '../config/nodes.js';
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

async function fetchOverviewForNode(nodeKey) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  const result = await request.query(
    `SELECT
       (SELECT COUNT(*) FROM headquarter) AS headquarter,
       (SELECT COUNT(*) FROM department) AS department,
       (SELECT COUNT(*) FROM student) AS student,
       (SELECT COUNT(*) FROM teacher) AS teacher,
       (SELECT COUNT(*) FROM subject) AS subject,
       (SELECT COUNT(*) FROM [class]) AS class,
       (SELECT COUNT(*) FROM room) AS room,
       (SELECT COUNT(*) FROM session) AS session,
       (SELECT COUNT(*) FROM registration) AS registration,
       (SELECT COUNT(*) FROM registration WHERE registration_status = 'CANCELLED') AS cancelled
     `
  );

  const row = result.recordset[0] ?? {};
  return {
    headquarter: row.headquarter ?? 0,
    department: row.department ?? 0,
    student: row.student ?? 0,
    teacher: row.teacher ?? 0,
    subject: row.subject ?? 0,
    class: row.class ?? 0,
    room: row.room ?? 0,
    session: row.session ?? 0,
    registration: row.registration ?? 0,
    cancelled: row.cancelled ?? 0
  };
}

router.get('/overview', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
  const role = req.user?.role;
  const requestedNode = normalizeNodeKey(req.query.maCS);
  const scope = req.query.scope ?? 'all';

  let nodes = [];
  if (role === 'quantrivien' && scope === 'node' && requestedNode && isValidNode(requestedNode)) {
    nodes = [requestedNode];
  } else if (role === 'quantrivien' && scope === 'all') {
    nodes = Object.keys(getNodes());
  } else {
    const ownNode = normalizeNodeKey(req.user?.maCS);
    if (!ownNode) {
      return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
    }
    nodes = [ownNode];
  }

  try {
    const perNode = {};
    const offlineNodes = [];

    await Promise.all(nodes.map(async nodeKey => {
      try {
        perNode[nodeKey] = await fetchOverviewForNode(nodeKey);
      } catch (error) {
        const nodeError = withNode(nodeKey, error);
        if (isOfflineError(nodeError)) {
          offlineNodes.push(nodeKey);
        } else {
          throw nodeError;
        }
      }
    }));

    const total = Object.values(perNode).reduce((acc, current) => {
      Object.entries(current).forEach(([key, value]) => {
        acc[key] = (acc[key] ?? 0) + value;
      });
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        perNode,
        total,
        offlineNodes
      }
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/lophocphan', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
  const role = req.user?.role;
  const termId = req.query.ID_term ?? null;
  const requestedNode = normalizeNodeKey(req.query.ID_headquarter ?? req.query.maCS);
  const nodeKey = role === 'quantrivien' && requestedNode && isValidNode(requestedNode)
    ? requestedNode
    : normalizeNodeKey(req.user?.maCS);

  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  try {
    const pool = await safeGetPool(nodeKey);
    const request = createRequest(nodeKey, null, pool);
    if (termId) {
      request.input('ID_term', ID_TYPE, termId);
    }
    request.input('ID_headquarter', ID_TYPE, nodeKey);
    const result = await request.execute('usp_StatsClassRegistrationByTerm');

    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/sinhvien-theo-coso', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
  const headquarterId = normalizeNodeKey(req.query.ID_headquarter ?? req.query.maCS);

  try {
    const pool = await safeGetPool('HQHD');
    const request = createRequest('HQHD', null, pool);
    if (headquarterId) {
      request.input('ID_headquarter', ID_TYPE, headquarterId);
    }
    const result = await request.execute('usp_StatsRegisteredStudentsByCampus');

    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/dangky-cheo', authenticate, requireRole(['quantrivien']), async (req, res) => {
  try {
    const pool = await safeGetPool('HQHD');
    const request = createRequest('HQHD', null, pool);
    const result = await request.execute('usp_CheckCrossCampusRegistration');

    return res.json({ success: true, data: result.recordset });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
