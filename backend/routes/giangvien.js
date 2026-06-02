import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { LOCAL_NODE, isValidNode, normalizeNodeKey } from '../config/nodes.js';
import { getPool } from '../config/db.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';
import { deleteRow, insertRow, queryRows, updateRow } from '../utils/tableCrud.js';
import { callRemoteNode } from '../utils/remoteApi.js';

const router = express.Router();
const TABLE = 'teacher';
const ID_FIELD = 'ID_teacher';
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
  return res.status(status).json({ success: false, message });
}

function resolveNode(req) {
  const requested = normalizeNodeKey(req.query.maCS ?? req.query.ID_headquarter ?? req.body?.ID_headquarter);
  const userNode = normalizeNodeKey(req.user?.maCS);
  const localNode = normalizeNodeKey(LOCAL_NODE);
  const isHqhdGlobalAdmin = req.user?.role === 'quantrivien' && userNode === 'HQHD' && localNode === 'HQHD';
  if (isHqhdGlobalAdmin && requested && isValidNode(requested)) {
    return requested;
  }
  return userNode;
}

async function proxyIfRemote(req, nodeKey) {
  if (!nodeKey || nodeKey === LOCAL_NODE) return null;
  return await callRemoteNode(nodeKey, req.method, req.originalUrl, req.body ?? null, req.headers.authorization);
}

async function safeGetPool(nodeKey) {
  try {
    return await getPool(nodeKey);
  } catch (error) {
    throw withNode(nodeKey, error);
  }
}

router.get('/me/overview', authenticate, requireRole(['giangvien']), async (req, res) => {
  const nodeKey = normalizeNodeKey(req.user?.maCS);
  const teacherId = req.user?.id ?? req.user?.ID_user;

  if (!nodeKey || !teacherId) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin giảng viên hoặc cơ sở.' });
  }

  try {
    const pool = await safeGetPool(nodeKey);

    const profileRequest = createRequest(nodeKey, null, pool);
    profileRequest.input('ID_teacher', ID_TYPE, teacherId);
    const profileResult = await profileRequest.query(`
      SELECT
        te.ID_teacher,
        te.name_teacher,
        te.degree,
        te.phone_teacher,
        te.gender_teacher,
        te.address_teacher,
        d.ID_department,
        d.name_department,
        d.ID_headquarter
      FROM teacher te
      LEFT JOIN department d
        ON te.ID_department = d.ID_department COLLATE DATABASE_DEFAULT
      WHERE te.ID_teacher = @ID_teacher COLLATE DATABASE_DEFAULT
    `);

    if (profileResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin giảng viên.' });
    }

    const classesRequest = createRequest(nodeKey, null, pool);
    classesRequest.input('ID_teacher', ID_TYPE, teacherId);
    const classesResult = await classesRequest.query(`
      SELECT
        c.ID_class,
        sub.ID_subject,
        sub.name_subject,
        sub.number_of_credit,
        t.ID_term,
        t.name_term,
        c.group_number,
        c.number_of_registration,
        c.max_students,
        c.class_status,
        COUNT(DISTINCT ss.ID_session) AS session_count
      FROM [class] c
      JOIN subject sub
        ON c.ID_subject = sub.ID_subject COLLATE DATABASE_DEFAULT
      JOIN term t
        ON c.ID_term = t.ID_term COLLATE DATABASE_DEFAULT
      LEFT JOIN [session] ss
        ON c.ID_class = ss.ID_class COLLATE DATABASE_DEFAULT
      WHERE c.ID_teacher = @ID_teacher COLLATE DATABASE_DEFAULT
      GROUP BY
        c.ID_class,
        sub.ID_subject,
        sub.name_subject,
        sub.number_of_credit,
        t.ID_term,
        t.name_term,
        c.group_number,
        c.number_of_registration,
        c.max_students,
        c.class_status
      ORDER BY t.ID_term DESC, sub.ID_subject, c.ID_class
    `);

    const scheduleRequest = createRequest(nodeKey, null, pool);
    scheduleRequest.input('ID_teacher', ID_TYPE, teacherId);
    const scheduleResult = await scheduleRequest.query(`
      SELECT
        ss.ID_session,
        c.ID_class,
        sub.ID_subject,
        sub.name_subject,
        ss.study_date,
        ss.day_of_week,
        ts.shift_no,
        ts.start_time,
        ts.end_time,
        r.ID_room,
        r.name_room,
        hq.name_headquarter AS room_headquarter,
        ss.note
      FROM [class] c
      JOIN subject sub
        ON c.ID_subject = sub.ID_subject COLLATE DATABASE_DEFAULT
      JOIN [session] ss
        ON c.ID_class = ss.ID_class COLLATE DATABASE_DEFAULT
      JOIN timeslot ts
        ON ss.ID_timeslot = ts.ID_timeslot COLLATE DATABASE_DEFAULT
      JOIN room r
        ON ss.ID_room = r.ID_room COLLATE DATABASE_DEFAULT
      LEFT JOIN headquarter hq
        ON r.ID_headquarter = hq.ID_headquarter COLLATE DATABASE_DEFAULT
      WHERE c.ID_teacher = @ID_teacher COLLATE DATABASE_DEFAULT
      ORDER BY ss.study_date, ts.start_time, c.ID_class
    `);

    return res.json({
      success: true,
      data: {
        profile: profileResult.recordset[0],
        classes: classesResult.recordset,
        schedule: scheduleResult.recordset
      }
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.use(authenticate, requireRole(['quantrivien']));

router.get('/', async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    const { rows } = await queryRows(nodeKey, TABLE, {}, 500);
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
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên.' });
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

router.delete('/:id', async (req, res) => {
  const nodeKey = resolveNode(req);
  if (!nodeKey) {
    return res.status(400).json({ success: false, message: 'Thiếu mã cơ sở.' });
  }

  try {
    await deleteRow(nodeKey, TABLE, { [ID_FIELD]: req.params.id });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;

