import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getPool, hasNodeCredentials } from '../config/db.js';
import { LOCAL_NODE, getNodeApiBase, isValidNode, normalizeNodeKey, getNodes } from '../config/nodes.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';
import { deleteRow, insertRow, queryRows, updateRow } from '../utils/tableCrud.js';
import { callRemoteNode } from '../utils/remoteApi.js';
import { fetchNodeApiJson, getProxyHeaders, isProxyRequest } from '../utils/nodeProxy.js';

const router = express.Router();
const ID_TYPE = sql.NVarChar(50);

// Query result cache: { "HQHL": { data: [...], timestamp: 1625..., ttl: 5min } }
const queryCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(nodeKey, query) {
  return `${nodeKey}:${query}`;
}

function getCachedResult(nodeKey, queryName) {
  const key = getCacheKey(nodeKey, queryName);
  const cached = queryCache.get(key);
  if (!cached) return null;

  const ageMs = Date.now() - cached.timestamp;
  if (ageMs > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }

  console.log(`[CACHE] HIT: ${key} (age: ${Math.round(ageMs / 1000)}s)`);
  return cached.data;
}

function setCachedResult(nodeKey, queryName, data) {
  const key = getCacheKey(nodeKey, queryName);
  queryCache.set(key, {
    data,
    timestamp: Date.now()
  });
  console.log(`[CACHE] SET: ${key}`);
}

function canProxyToNode(req, nodeKey) {
  if (!nodeKey || isProxyRequest(req)) return false;
  const userNode = normalizeNodeKey(req.user?.maCS);
  return Boolean(getNodeApiBase(nodeKey)) && (!userNode || userNode !== nodeKey);
}

function shouldUseLocalDb(req, nodeKey) {
  const userNode = normalizeNodeKey(req.user?.maCS);
  if (userNode && userNode !== nodeKey) return false;
  return hasNodeCredentials(nodeKey);
}

async function tryProxyNode(req, nodeKey, path, query) {
  if (!canProxyToNode(req, nodeKey)) return null;
  try {
    return await fetchNodeApiJson(nodeKey, path, {
      query,
      headers: getProxyHeaders(req)
    });
  } catch (error) {
    console.warn(`[PROXY] Failed ${nodeKey} ${path}: ${error.message}`);
    return null;
  }
}

async function tryLocalThenProxy(req, nodeKey, path, query, localTask) {
  const preferProxy = canProxyToNode(req, nodeKey) && !shouldUseLocalDb(req, nodeKey);
  if (preferProxy) {
    const proxyResult = await tryProxyNode(req, nodeKey, path, query);
    if (proxyResult) {
      return proxyResult.data;
    }
  }

  try {
    return await localTask();
  } catch (localError) {
    const proxyResult = await tryProxyNode(req, nodeKey, path, query);
    if (proxyResult) {
      return proxyResult.data;
    }
    throw localError;
  }
}

function normalizeRows(result) {
  if (!result) return [];
  if (Array.isArray(result.recordset)) return result.recordset;
  if (Array.isArray(result.data)) return result.data;
  return [];
}

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

function ensureHQHD(req, res, next) {
  const userNode = normalizeNodeKey(req.user?.maCS);
  if (userNode !== 'HQHD') {
    return res.status(403).json({
      success: false,
      message: 'Chức năng này chỉ dành cho quản trị viên tại HQHD.'
    });
  }
  return next();
}

router.get('/classes', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const maCSRaw = req.query.maCS;
  const maCS = normalizeNodeKey(maCSRaw);
  if (!maCS || !isValidNode(maCS)) {
    return res.status(400).json({
      success: false,
      message: 'Mã cơ sở không hợp lệ.'
    });
  }

  try {
    const result = await tryLocalThenProxy(
      req,
      maCS,
      '/api/hocphan/classes',
      { maCS },
      async () => {
        const pool = await safeGetPool(maCS);
        const request = createRequest(maCS, null, pool);
        return await request.query(
          `SELECT ID_class
           FROM [class]
           ORDER BY ID_class`
        );
      }
    );

    const rows = normalizeRows(result);
    return res.json({
      success: true,
      data: rows.map(row => ({
        id_class: row.ID_class ?? row.id_class
      }))
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/available', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const maCS = normalizeNodeKey(req.query.maCS) || normalizeNodeKey(req.user?.maCS);

  if (!maCS || !isValidNode(maCS)) {
    return res.status(400).json({
      success: false,
      message: 'Mã cơ sở không hợp lệ.'
    });
  }

  try {
    const cached = getCachedResult(maCS, 'available');
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    const result = await tryLocalThenProxy(
      req,
      maCS,
      '/api/hocphan/available',
      { maCS },
      async () => {
        const pool = await safeGetPool(maCS);
        const request = createRequest(maCS, null, pool);
        return await request.query(
          `SELECT TOP 100
             c.ID_class AS maMH,
             s.name_subject AS tenMonHoc,
             s.number_of_credit AS soTC,
             c.group_number AS nhom,
             t.name_teacher AS giangVien,
             c.max_students AS siSoToiDa,
             c.number_of_registration AS siSoDaDangKy,
             (c.max_students - c.number_of_registration) AS conLai,
             c.class_status AS trangThai,
             tm.name_term AS hocKy
           FROM [class] c
           JOIN subject s ON s.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS
           JOIN teacher t ON t.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS
           JOIN term tm ON tm.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS
           WHERE c.class_status COLLATE SQL_Latin1_General_CP1_CI_AS = 'OPEN'
             AND c.max_students > c.number_of_registration
           ORDER BY c.ID_class`
        );
      }
    );

    const data = normalizeRows(result);
    if (Array.isArray(data)) {
      setCachedResult(maCS, 'available', data);
      return res.json({
        success: true,
        data,
        cached: false
      });
    }

    throw new Error('Không thể lấy dữ liệu từ cơ sở.');
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/schedule/:classId', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const maCS = normalizeNodeKey(req.query.maCS) || normalizeNodeKey(req.user?.maCS);
  const { classId } = req.params;

  if (!maCS || !isValidNode(maCS) || !classId) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin.'
    });
  }

  try {
    const result = await tryLocalThenProxy(
      req,
      maCS,
      `/api/hocphan/schedule/${encodeURIComponent(classId)}`,
      { maCS },
      async () => {
        const pool = await safeGetPool(maCS);
        const request = createRequest(maCS, null, pool);
        request.input('classId', ID_TYPE, classId);
        return await request.query(
          `SELECT 
             s.ID_session AS ID_session,
             s.study_date AS ngayHoc,
             s.day_of_week AS thuHoc,
             s.note AS ghiChu,
             ts.shift_no AS caHoc,
             ts.start_time AS gioStart,
             ts.end_time AS gioEnd,
             r.name_room AS phongHoc
           FROM [session] s
           JOIN timeslot ts ON ts.ID_timeslot COLLATE SQL_Latin1_General_CP1_CI_AS = s.ID_timeslot COLLATE SQL_Latin1_General_CP1_CI_AS
           JOIN room r ON r.ID_room COLLATE SQL_Latin1_General_CP1_CI_AS = s.ID_room COLLATE SQL_Latin1_General_CP1_CI_AS
           WHERE s.ID_class COLLATE SQL_Latin1_General_CP1_CI_AS = @classId COLLATE SQL_Latin1_General_CP1_CI_AS
           ORDER BY s.study_date, ts.shift_no`
        );
      }
    );

    return res.json({
      success: true,
      data: normalizeRows(result)
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/available-all', authenticate, requireRole(['sinhvien']), async (req, res) => {
  try {
    const nodes = getNodes();
    const allClasses = {};

    for (const [nodeKey] of Object.entries(nodes)) {
      try {
        if (nodeKey === LOCAL_NODE) {
          const pool = await safeGetPool(nodeKey);
          const request = createRequest(nodeKey, null, pool);
          const result = await request.query(
            `SELECT 
                c.ID_class AS maMH,
                s.name_subject AS tenMonHoc,
                s.number_of_credit AS soTC,
                c.group_number AS nhom,
                t.name_teacher AS giangVien,
                c.max_students AS siSoToiDa,
                c.number_of_registration AS siSoDaDangKy,
                (c.max_students - c.number_of_registration) AS conLai,
                c.class_status AS trangThai,
                tm.name_term AS hocKy
              FROM [class] c
              JOIN subject s ON s.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_subject COLLATE SQL_Latin1_General_CP1_CI_AS
              JOIN teacher t ON t.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_teacher COLLATE SQL_Latin1_General_CP1_CI_AS
              JOIN term tm ON tm.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS = c.ID_term COLLATE SQL_Latin1_General_CP1_CI_AS
              WHERE c.class_status COLLATE SQL_Latin1_General_CP1_CI_AS = 'OPEN'
                AND c.max_students > c.number_of_registration
              ORDER BY c.ID_class`
          );
          allClasses[nodeKey] = result.recordset;
          continue;
        }

        const proxyResult = await callRemoteNode(nodeKey, 'GET', `/api/hocphan/available?maCS=${encodeURIComponent(nodeKey)}`, null, req.headers.authorization);
        allClasses[nodeKey] = proxyResult.data?.data ?? [];
      } catch (err) {
        console.log(`[DB] Failed to fetch from ${nodeKey}:`, err.message);
        allClasses[nodeKey] = [];
      }
    }

    return res.json({
      success: true,
      data: allClasses
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:id', authenticate, requireRole(['quantrivien']), ensureHQHD, async (req, res) => {
  try {
    const { rows } = await queryRows('HQHD', 'subject', { ID_subject: req.params.id }, 1);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học phần.' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    if (isProxyRequest(req)) {
      return sendError(res, error);
    }
    try {
      const proxyResult = await fetchNodeApiJson('HQHD', `/api/hocphan/${req.params.id}`, {
        headers: getProxyHeaders(req)
      });
      if (proxyResult.ok) {
        return res.status(proxyResult.status).json(proxyResult.data);
      }
    } catch (proxyErr) {
      console.warn(`[PROXY] Failed: ${proxyErr.message}`);
    }
    return sendError(res, error);
  }
});

router.put('/:id', authenticate, requireRole(['quantrivien']), ensureHQHD, async (req, res) => {
  try {
    await updateRow('HQHD', 'subject', req.body ?? {}, { ID_subject: req.params.id });
    return res.json({ success: true });
  } catch (error) {
    if (isProxyRequest(req)) {
      return sendError(res, error);
    }
    try {
      const proxyResult = await fetchNodeApiJson('HQHD', `/api/hocphan/${req.params.id}`, {
        method: 'PUT',
        body: req.body ?? {},
        headers: getProxyHeaders(req)
      });
      if (proxyResult.ok) {
        return res.status(proxyResult.status).json(proxyResult.data);
      }
    } catch (proxyErr) {
      console.warn(`[PROXY] Failed: ${proxyErr.message}`);
    }
    return sendError(res, error);
  }
});

router.delete('/:id', authenticate, requireRole(['quantrivien']), ensureHQHD, async (req, res) => {
  try {
    await deleteRow('HQHD', 'subject', { ID_subject: req.params.id });
    return res.json({ success: true });
  } catch (error) {
    if (isProxyRequest(req)) {
      return sendError(res, error);
    }
    try {
      const proxyResult = await fetchNodeApiJson('HQHD', `/api/hocphan/${req.params.id}`, {
        method: 'DELETE',
        headers: getProxyHeaders(req)
      });
      if (proxyResult.ok) {
        return res.status(proxyResult.status).json(proxyResult.data);
      }
    } catch (proxyErr) {
      console.warn(`[PROXY] Failed: ${proxyErr.message}`);
    }
    return sendError(res, error);
  }
});

router.get('/', authenticate, requireRole(['quantrivien']), ensureHQHD, async (req, res) => {
  try {
    const { rows } = await queryRows('HQHD', 'subject', {}, 500);
    return res.json({ success: true, data: rows });
  } catch (error) {
    if (isProxyRequest(req)) {
      return sendError(res, error);
    }
    try {
      const proxyResult = await fetchNodeApiJson('HQHD', '/api/hocphan', {
        headers: getProxyHeaders(req)
      });
      if (proxyResult.ok) {
        return res.status(proxyResult.status).json(proxyResult.data);
      }
    } catch (proxyErr) {
      console.warn(`[PROXY] Failed: ${proxyErr.message}`);
    }
    return sendError(res, error);
  }
});

router.post('/', authenticate, requireRole(['quantrivien']), ensureHQHD, async (req, res) => {
  try {
    await insertRow('HQHD', 'subject', req.body ?? {});
    return res.json({ success: true });
  } catch (error) {
    if (isProxyRequest(req)) {
      return sendError(res, error);
    }
    try {
      const proxyResult = await fetchNodeApiJson('HQHD', '/api/hocphan', {
        method: 'POST',
        body: req.body ?? {},
        headers: getProxyHeaders(req)
      });
      if (proxyResult.ok) {
        return res.status(proxyResult.status).json(proxyResult.data);
      }
    } catch (proxyErr) {
      console.warn(`[PROXY] Failed: ${proxyErr.message}`);
    }
    return sendError(res, error);
  }
});

export default router;
