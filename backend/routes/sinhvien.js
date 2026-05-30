import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getPool } from '../config/db.js';
import { nodeKeys, normalizeNodeKey } from '../config/nodes.js';
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

function buildInClause(values, prefix) {
  const params = [];
  const placeholders = values.map((value, index) => {
    const name = `${prefix}${index}`;
    params.push({ name, value });
    return `@${name}`;
  });
  return { clause: placeholders.join(', '), params };
}

router.get('/registrations', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const maSV = req.user?.id;
  const maCS = normalizeNodeKey(req.user?.maCS);

  if (!maSV || !maCS) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin sinh viên trong token.'
    });
  }

  try {
    const pool = await safeGetPool(maCS);
    const request = createRequest(maCS, null, pool);
    request.input('maSV', ID_TYPE, maSV);
    const result = await request.query(
      `SELECT 
         r.ID_registration AS maDangKy,
         r.ID_class AS maMH,
         s.name_subject AS tenMonHoc,
         s.number_of_credit AS soTC,
         c.group_number AS nhom,
         t.name_teacher AS giangVien,
         r.registered_at AS ngayDangKy,
         r.registration_status AS trangThai,
         r.cancelled_at AS ngayHuy
       FROM registration r
       JOIN [class] c ON c.ID_class = r.ID_class
       JOIN subject s ON s.ID_subject = c.ID_subject
       JOIN teacher t ON t.ID_teacher = c.ID_teacher
       WHERE r.ID_student = @maSV
       ORDER BY r.registered_at DESC`
    );
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

  if (!maSV || !maCS) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin sinh viên trong token.'
    });
  }

  try {
    const pool = await safeGetPool(maCS);
    const request = createRequest(maCS, null, pool);
    request.input('maSV', ID_TYPE, maSV);
    const registrations = await request.query(
      `SELECT ID_class
       FROM registration
       WHERE ID_student = @maSV`
    );

    const classIds = registrations.recordset.map(row => row.ID_class).filter(Boolean);

    if (classIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        meta: {
          offlineNodes: []
        }
      });
    }

    const perNodeResults = await Promise.all(
      nodeKeys.map(async nodeKey => {
        try {
          const nodePool = await safeGetPool(nodeKey);
          const nodeRequest = createRequest(nodeKey, null, nodePool);
          const { clause, params } = buildInClause(classIds, `cls_${nodeKey}_`);
          params.forEach(param => {
            nodeRequest.input(param.name, ID_TYPE, param.value);
          });
          const result = await nodeRequest.query(
          `SELECT s.*, '${nodeKey}' AS node
           FROM [session] s
           WHERE s.ID_class IN (${clause})`
        );
          return { nodeKey, rows: result.recordset };
        } catch (error) {
          const nodeError = withNode(nodeKey, error);
          if (isOfflineError(nodeError)) {
            return { nodeKey, offline: true };
          }
          throw nodeError;
        }
      })
    );

    const rows = [];
    const offlineNodes = [];
    perNodeResults.forEach(result => {
      if (result.offline) {
        offlineNodes.push(result.nodeKey);
      } else if (result.rows?.length) {
        rows.push(...result.rows);
      }
    });

    return res.json({
      success: true,
      data: rows,
      meta: {
        offlineNodes
      }
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
