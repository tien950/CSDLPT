import sql from 'mssql';
import { getPool } from '../config/db.js';
import { createRequest, withNode } from './db.js';

const STRING_TYPES = new Set(['varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext']);
const NUMBER_TYPES = new Set(['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'real']);
const EXCLUDED_COLUMNS = new Set(['rowguid']);

export const COLLATION = 'SQL_Latin1_General_CP1_CI_AS';

export async function safeGetPool(nodeKey) {
  try {
    return await getPool(nodeKey);
  } catch (error) {
    throw withNode(nodeKey, error);
  }
}

export function resolveSqlType(column) {
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
  if (value === '' || value === undefined) return null;
  if (value === null) return null;
  const type = String(column.dataType).toLowerCase();

  if (type === 'bit') {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return null;
  }

  if (NUMBER_TYPES.has(type)) {
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? value : numericValue;
  }

  return value;
}

export function sanitizeData(input, columnMap, options = {}) {
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

export function buildWhereClause(keys, columnMap, request) {
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

export async function getTableMeta(nodeKey, table) {
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

export async function queryRows(nodeKey, table, filters = {}, limit = 200) {
  const meta = await getTableMeta(nodeKey, table);
  const columnMap = new Map(meta.columns.map(col => [col.name, col]));
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  const hasFilters = Object.keys(filters).length > 0;
  const whereClause = hasFilters ? buildWhereClause(filters, columnMap, request) : '';

  if (hasFilters && !whereClause) {
    const error = new Error('Thiếu khóa hợp lệ để truy vấn.');
    error.status = 400;
    throw error;
  }

  const orderBy = meta.primaryKeys.length > 0
    ? ` ORDER BY ${meta.primaryKeys.map(key => `[${key}]`).join(', ')}`
    : '';

  const whereSql = whereClause ? ` WHERE ${whereClause}` : '';
  const selectColumns = meta.columns.map(column => `[${column.name}]`).join(', ');
  const result = await request.query(
    `SELECT TOP (${limit}) ${selectColumns} FROM [${table}]${whereSql}${orderBy}`
  );

  return { rows: result.recordset, meta };
}

export async function insertRow(nodeKey, table, payload) {
  const meta = await getTableMeta(nodeKey, table);
  const columnMap = new Map(meta.columns.map(col => [col.name, col]));
  const data = sanitizeData(payload, columnMap, { excludeIdentity: true });
  const columns = Object.keys(data);

  if (columns.length === 0) {
    const error = new Error('Thiếu dữ liệu để tạo mới.');
    error.status = 400;
    throw error;
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
}

export async function updateRow(nodeKey, table, payload, keyPayload) {
  const meta = await getTableMeta(nodeKey, table);
  const columnMap = new Map(meta.columns.map(col => [col.name, col]));
  const keySet = new Set(Object.keys(keyPayload ?? {}));
  const data = sanitizeData(payload, columnMap, { excludeIdentity: true, excludeKeys: keySet });
  const keys = sanitizeData(keyPayload ?? {}, columnMap);

  if (Object.keys(keys).length === 0) {
    const error = new Error('Thiếu khóa để cập nhật.');
    error.status = 400;
    throw error;
  }

  if (Object.keys(data).length === 0) {
    const error = new Error('Không có dữ liệu cần cập nhật.');
    error.status = 400;
    throw error;
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
    const error = new Error('Thiếu khóa hợp lệ để cập nhật.');
    error.status = 400;
    throw error;
  }

  await request.query(
    `UPDATE [${table}] SET ${setParts.join(', ')} WHERE ${whereClause}`
  );
}

export async function deleteRow(nodeKey, table, keyPayload) {
  const meta = await getTableMeta(nodeKey, table);
  const columnMap = new Map(meta.columns.map(col => [col.name, col]));
  const keys = sanitizeData(keyPayload ?? {}, columnMap);

  if (Object.keys(keys).length === 0) {
    const error = new Error('Thiếu khóa để xóa.');
    error.status = 400;
    throw error;
  }

  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  const whereClause = buildWhereClause(keys, columnMap, request);

  if (!whereClause) {
    const error = new Error('Thiếu khóa hợp lệ để xóa.');
    error.status = 400;
    throw error;
  }

  await request.query(`DELETE FROM [${table}] WHERE ${whereClause}`);
}

