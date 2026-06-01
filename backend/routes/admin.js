import express from 'express';
import sql from 'mssql';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getPool } from '../config/db.js';
import { LOCAL_NODE, isValidNode, normalizeNodeKey, nodeApiBase, nodeKeys } from '../config/nodes.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';
import { callRemoteNode } from '../utils/remoteApi.js';

const router = express.Router();
const COLLATION = 'SQL_Latin1_General_CP1_CI_AS';

const ALLOWED_TABLES = {
  headquarter: 'Cơ sở đào tạo',
  department: 'Phòng ban',
  curriculum: 'Chương trình đào tạo',
  student: 'Sinh viên',
  teacher: 'Giảng viên',
  subject: 'Học phần',
  class: 'Lớp học phần',
  room: 'Phòng học',
  session: 'Lịch học',
  term: 'Học kỳ',
  timeslot: 'Khung giờ'
};

const STRING_TYPES = new Set(['varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext']);
const EXCLUDED_COLUMNS = new Set(['rowguid']);

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

async function proxyIfRemote(req, nodeKey) {
  if (!nodeKey || nodeKey === LOCAL_NODE) return null;
  return await callRemoteNode(nodeKey, req.method, req.originalUrl, req.body ?? null, req.headers.authorization);
}

function resolveNodeKey(req) {
  const role = req.user?.role;
  const nodeFromRequest = normalizeNodeKey(req.query.maCS ?? req.body?.maCS ?? req.body?.node);
  if (role === 'quantrivien' && nodeFromRequest && isValidNode(nodeFromRequest)) {
    return nodeFromRequest;
  }
  return normalizeNodeKey(req.user?.maCS);
}

function resolveSqlType(column) {
  const type = String(column.dataType).toLowerCase();
  const maxLength = column.maxLength;
  const precision = column.numericPrecision ?? 18;
  const scale = column.numericScale ?? 0;

  switch (type) {
    case 'int':
      return sql.Int;
    case 'bigint':
      return sql.BigInt;
    case 'smallint':
      return sql.SmallInt;
    case 'tinyint':
      return sql.TinyInt;
    case 'bit':
      return sql.Bit;
    case 'decimal':
      return sql.Decimal(precision, scale);
    case 'numeric':
      return sql.Numeric(precision, scale);
    case 'float':
      return sql.Float;
    case 'real':
      return sql.Real;
    case 'date':
      return sql.Date;
    case 'datetime':
      return sql.DateTime;
    case 'datetime2':
      return sql.DateTime2;
    case 'smalldatetime':
      return sql.SmallDateTime;
    case 'time':
      return sql.Time;
    case 'uniqueidentifier':
      return sql.UniqueIdentifier;
    case 'nvarchar':
      if (maxLength === -1) return sql.NVarChar(sql.MAX);
      return maxLength ? sql.NVarChar(maxLength) : sql.NVarChar;
    case 'varchar':
      if (maxLength === -1) return sql.VarChar(sql.MAX);
      return maxLength ? sql.VarChar(maxLength) : sql.VarChar;
    case 'nchar':
      return sql.NChar(maxLength || 1);
    case 'char':
      return sql.Char(maxLength || 1);
    case 'text':
      return sql.Text;
    case 'ntext':
      return sql.NText;
    default:
      return null;
  }
}

function normalizeValue(value, column) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const type = String(column.dataType).toLowerCase();

  if (['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'real'].includes(type)) {
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? value : numericValue;
  }

  if (type === 'bit') {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return null;
  }

  return value;
}

function sanitizeData(input, columnMap, options = {}) {
  const result = {};
  const entries = Object.entries(input ?? {});
  for (const [key, rawValue] of entries) {
    if (!columnMap.has(key)) continue;
    const column = columnMap.get(key);
    if (options.excludeIdentity && column.isIdentity) continue;
    if (options.excludeKeys && options.excludeKeys.has(key)) continue;
    const value = normalizeValue(rawValue, column);
    if (value === undefined) continue;
    result[key] = value;
  }
  return result;
}

function buildWhereClause(keys, columnMap, request) {
  const conditions = [];
  let index = 0;

  for (const [key, value] of Object.entries(keys)) {
    if (!columnMap.has(key)) continue;
    const column = columnMap.get(key);
    const paramName = `w_${index}`;
    const columnExpr = column.isString ? `[${key}] COLLATE ${COLLATION}` : `[${key}]`;
    const paramExpr = column.isString ? `@${paramName} COLLATE ${COLLATION}` : `@${paramName}`;
    const sqlType = resolveSqlType(column);
    if (sqlType) {
      request.input(paramName, sqlType, value);
    } else {
      request.input(paramName, value);
    }
    conditions.push(`${columnExpr} = ${paramExpr}`);
    index += 1;
  }

  return conditions.join(' AND ');
}

async function getTableMeta(nodeKey, table) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('table', sql.NVarChar(128), table);

  const columnsResult = await request.query(
    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = @table
     ORDER BY ORDINAL_POSITION`
  );

  const primaryKeyResult = await request.query(
    `SELECT kcu.COLUMN_NAME
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
     JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
       ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
     WHERE tc.TABLE_NAME = @table AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
     ORDER BY kcu.ORDINAL_POSITION`
  );

  const identityResult = await request.query(
    `SELECT c.name AS COLUMN_NAME, c.is_identity AS isIdentity
     FROM sys.columns c
     JOIN sys.tables t ON c.object_id = t.object_id
     WHERE t.name = @table`
  );

  const identitySet = new Set(
    identityResult.recordset.filter(row => row.isIdentity).map(row => row.COLUMN_NAME)
  );

  const columns = columnsResult.recordset
    .filter(row => !EXCLUDED_COLUMNS.has(String(row.COLUMN_NAME).toLowerCase()))
    .map(row => ({
    name: row.COLUMN_NAME,
    dataType: row.DATA_TYPE,
    isNullable: row.IS_NULLABLE === 'YES',
    maxLength: row.CHARACTER_MAXIMUM_LENGTH,
    numericPrecision: row.NUMERIC_PRECISION,
    numericScale: row.NUMERIC_SCALE,
    isIdentity: identitySet.has(row.COLUMN_NAME),
    isString: STRING_TYPES.has(String(row.DATA_TYPE).toLowerCase())
  }));

  const primaryKeys = primaryKeyResult.recordset
    .map(row => row.COLUMN_NAME)
    .filter(columnName => !EXCLUDED_COLUMNS.has(String(columnName).toLowerCase()));

  return {
    table,
    columns,
    primaryKeys
  };
}

function buildTimestamp() {
  return new Date().toISOString();
}

async function pingNode(nodeKey) {
  if (nodeKey === LOCAL_NODE) {
    return { status: 'online', timestamp: buildTimestamp() };
  }

  const baseUrl = nodeApiBase[nodeKey];
  if (!baseUrl) {
    return { status: 'offline', timestamp: buildTimestamp() };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${baseUrl}/api/internal/node-ping`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Internal-Call': 'true'
      },
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      return { status: 'offline', timestamp: buildTimestamp() };
    }
    return { status: 'online', timestamp: payload.timestamp ?? buildTimestamp() };
  } catch {
    return { status: 'offline', timestamp: buildTimestamp() };
  } finally {
    clearTimeout(timer);
  }
}

router.get('/node-status', async (req, res) => {
  const results = await Promise.allSettled(
    nodeKeys.map(async nodeKey => ({ nodeKey, result: await pingNode(nodeKey) }))
  );

  const nodes = nodeKeys.reduce((acc, nodeKey) => {
    acc[nodeKey] = { status: 'offline', timestamp: buildTimestamp() };
    return acc;
  }, {});

  results.forEach(item => {
    if (item.status === 'fulfilled') {
      const { nodeKey, result } = item.value;
      nodes[nodeKey] = result;
    }
  });

  return res.json({ success: true, nodes });
});

router.get('/tables', authenticate, requireRole(['nhanvien', 'quantrivien']), (req, res) => {
  const tables = Object.entries(ALLOWED_TABLES).map(([key, label]) => ({ key, label }));
  return res.json({
    success: true,
    data: tables
  });
});

router.get('/meta/:table', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
  const table = req.params.table;
  if (!ALLOWED_TABLES[table]) {
    return res.status(404).json({ success: false, message: 'Bảng dữ liệu không hợp lệ.' });
  }

  const nodeKey = resolveNodeKey(req);
  if (!nodeKey || !isValidNode(nodeKey)) {
    return res.status(400).json({ success: false, message: 'Mã cơ sở không hợp lệ.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    const meta = await getTableMeta(nodeKey, table);
    return res.json({ success: true, data: meta });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/:table', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
  const table = req.params.table;
  if (!ALLOWED_TABLES[table]) {
    return res.status(404).json({ success: false, message: 'Bảng dữ liệu không hợp lệ.' });
  }

  const nodeKey = resolveNodeKey(req);
  if (!nodeKey || !isValidNode(nodeKey)) {
    return res.status(400).json({ success: false, message: 'Mã cơ sở không hợp lệ.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  const limitRaw = Number(req.query.limit ?? 200);
  const limit = Number.isNaN(limitRaw) ? 200 : Math.min(limitRaw, 500);

  try {
    const meta = await getTableMeta(nodeKey, table);
    const orderBy = meta.primaryKeys.length > 0
      ? ` ORDER BY ${meta.primaryKeys.map(key => `[${key}]`).join(', ')}`
      : '';
    const selectColumns = meta.columns.map(column => `[${column.name}]`).join(', ');

    const pool = await safeGetPool(nodeKey);
    const request = createRequest(nodeKey, null, pool);
    const result = await request.query(
      `SELECT TOP (${limit}) ${selectColumns} FROM [${table}]${orderBy}`
    );

    return res.json({ success: true, data: result.recordset, meta });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:table', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
  const table = req.params.table;
  if (!ALLOWED_TABLES[table]) {
    return res.status(404).json({ success: false, message: 'Bảng dữ liệu không hợp lệ.' });
  }

  const nodeKey = resolveNodeKey(req);
  if (!nodeKey || !isValidNode(nodeKey)) {
    return res.status(400).json({ success: false, message: 'Mã cơ sở không hợp lệ.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    const meta = await getTableMeta(nodeKey, table);
    const columnMap = new Map(meta.columns.map(col => [col.name, col]));
    const payload = req.body?.data ?? req.body ?? {};
    const data = sanitizeData(payload, columnMap, { excludeIdentity: true });

    const columns = Object.keys(data);
    if (columns.length === 0) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu để tạo mới.' });
    }

    const pool = await safeGetPool(nodeKey);
    const request = createRequest(nodeKey, null, pool);
    const values = [];

    columns.forEach((column, index) => {
      const paramName = `p_${index}`;
      const columnMeta = columnMap.get(column);
      const sqlType = resolveSqlType(columnMeta);
      if (sqlType) {
        request.input(paramName, sqlType, data[column]);
      } else {
        request.input(paramName, data[column]);
      }
      values.push(`@${paramName}`);
    });

    await request.query(
      `INSERT INTO [${table}] (${columns.map(col => `[${col}]`).join(', ')})
       VALUES (${values.join(', ')})`
    );

    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/:table', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
  const table = req.params.table;
  if (!ALLOWED_TABLES[table]) {
    return res.status(404).json({ success: false, message: 'Bảng dữ liệu không hợp lệ.' });
  }

  const nodeKey = resolveNodeKey(req);
  if (!nodeKey || !isValidNode(nodeKey)) {
    return res.status(400).json({ success: false, message: 'Mã cơ sở không hợp lệ.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    const meta = await getTableMeta(nodeKey, table);
    const columnMap = new Map(meta.columns.map(col => [col.name, col]));
    const payload = req.body?.data ?? {};
    const keyPayload = req.body?.keys ?? {};
    const keySet = new Set(Object.keys(keyPayload));
    const data = sanitizeData(payload, columnMap, { excludeIdentity: true, excludeKeys: keySet });
    const keys = sanitizeData(keyPayload, columnMap);

    if (Object.keys(keys).length === 0) {
      return res.status(400).json({ success: false, message: 'Thiếu khóa để cập nhật.' });
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có dữ liệu cần cập nhật.' });
    }

    const pool = await safeGetPool(nodeKey);
    const request = createRequest(nodeKey, null, pool);
    const setParts = [];

    Object.entries(data).forEach(([column, value], index) => {
      const paramName = `p_${index}`;
      const columnMeta = columnMap.get(column);
      const sqlType = resolveSqlType(columnMeta);
      if (sqlType) {
        request.input(paramName, sqlType, value);
      } else {
        request.input(paramName, value);
      }
      setParts.push(`[${column}] = @${paramName}`);
    });

    const whereClause = buildWhereClause(keys, columnMap, request);
    if (!whereClause) {
      return res.status(400).json({ success: false, message: 'Thiếu khóa hợp lệ để cập nhật.' });
    }

    await request.query(
      `UPDATE [${table}] SET ${setParts.join(', ')} WHERE ${whereClause}`
    );

    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/:table', authenticate, requireRole(['nhanvien', 'quantrivien']), async (req, res) => {
  const table = req.params.table;
  if (!ALLOWED_TABLES[table]) {
    return res.status(404).json({ success: false, message: 'Bảng dữ liệu không hợp lệ.' });
  }

  const nodeKey = resolveNodeKey(req);
  if (!nodeKey || !isValidNode(nodeKey)) {
    return res.status(400).json({ success: false, message: 'Mã cơ sở không hợp lệ.' });
  }

  const proxyResult = await proxyIfRemote(req, nodeKey);
  if (proxyResult) {
    return res.status(proxyResult.status).json(proxyResult.data);
  }

  try {
    const meta = await getTableMeta(nodeKey, table);
    const columnMap = new Map(meta.columns.map(col => [col.name, col]));
    const keyPayload = req.body?.keys ?? req.body ?? {};
    const keys = sanitizeData(keyPayload, columnMap);

    if (Object.keys(keys).length === 0) {
      return res.status(400).json({ success: false, message: 'Thiếu khóa để xóa.' });
    }

    const pool = await safeGetPool(nodeKey);
    const request = createRequest(nodeKey, null, pool);
    const whereClause = buildWhereClause(keys, columnMap, request);

    if (!whereClause) {
      return res.status(400).json({ success: false, message: 'Thiếu khóa hợp lệ để xóa.' });
    }

    await request.query(`DELETE FROM [${table}] WHERE ${whereClause}`);

    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
