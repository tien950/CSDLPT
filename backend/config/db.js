import sql from 'mssql';
import { LOCAL_NODE, localDbConfig } from './nodes.js';

const poolCache = new Map();
const poolTimestamps = new Map(); // Track when pools were created
const DEFAULT_CONNECTION_TIMEOUT_MS = 5000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_CANCEL_TIMEOUT_MS = 5000;
const DEFAULT_POOL_MAX = 30;
const DEFAULT_POOL_MIN = 2;
const DEFAULT_POOL_IDLE_TIMEOUT_MS = 300000;

function getTimeoutEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function validateLocalDbConfig() {
  const missing = [];
  if (!localDbConfig.server || typeof localDbConfig.server !== 'string') missing.push('LOCAL_SERVER');
  if (!localDbConfig.database || typeof localDbConfig.database !== 'string') missing.push('LOCAL_DATABASE');
  if (!localDbConfig.user || typeof localDbConfig.user !== 'string') missing.push('LOCAL_USER');
  if (!localDbConfig.password || typeof localDbConfig.password !== 'string') missing.push('LOCAL_PASSWORD');

  if (missing.length > 0) {
    throw new Error(`Thiếu cấu hình DB local: ${missing.join(', ')}`);
  }
}

function buildLocalConfig() {
  const connectionTimeout = getTimeoutEnv('DB_CONNECTION_TIMEOUT_MS', DEFAULT_CONNECTION_TIMEOUT_MS);
  const requestTimeout = getTimeoutEnv('DB_REQUEST_TIMEOUT_MS', DEFAULT_REQUEST_TIMEOUT_MS);
  const cancelTimeout = getTimeoutEnv('DB_CANCEL_TIMEOUT_MS', DEFAULT_CANCEL_TIMEOUT_MS);
  const config = {
    server: localDbConfig.server,
    database: localDbConfig.database,
    user: localDbConfig.user,
    password: localDbConfig.password,
    connectionTimeout,
    requestTimeout,
    pool: {
      max: getTimeoutEnv('DB_POOL_MAX', DEFAULT_POOL_MAX),
      min: getTimeoutEnv('DB_POOL_MIN', DEFAULT_POOL_MIN),
      idleTimeoutMillis: getTimeoutEnv('DB_POOL_IDLE_TIMEOUT_MS', DEFAULT_POOL_IDLE_TIMEOUT_MS)
    },
    options: {
      encrypt: false,
      trustServerCertificate: true,
      cancelTimeout
    }
  };

  if (Number.isInteger(localDbConfig.port) && localDbConfig.port > 0) {
    config.port = localDbConfig.port;
    return config;
  }

  if (localDbConfig.instanceName) {
    config.options.instanceName = localDbConfig.instanceName;
    return config;
  }

  config.port = 1433;
  return config;
}

export function hasNodeCredentials(nodeKey) {
  return Boolean(nodeKey && LOCAL_NODE && nodeKey === LOCAL_NODE && localDbConfig.user && localDbConfig.password);
}

export async function getPool(nodeKey = LOCAL_NODE) {
  const key = LOCAL_NODE ?? nodeKey;
  if (!key) {
    throw new Error('LOCAL_NODE chưa được cấu hình.');
  }

  validateLocalDbConfig();

  if (poolCache.has(key)) {
    const pool = poolCache.get(key);
    const createdAt = poolTimestamps.get(key) || 0;
    const ageMs = Date.now() - createdAt;
    if (ageMs > 10 * 60 * 1000) {
      console.warn(`[DB] Pool for ${key} is old (${Math.round(ageMs / 1000)}s), recreating...`);
      await pool.close().catch(() => {});
      poolCache.delete(key);
      poolTimestamps.delete(key);
    } else {
      return pool;
    }
  }

  const config = buildLocalConfig();
  const pool = new sql.ConnectionPool(config);

  const connectPromise = pool.connect().catch(error => {
    console.error(`[DB] Connection failed for ${key}:`, error.message);
    console.error(`[DB] Error code: ${error.code}`);
    poolCache.delete(key);
    poolTimestamps.delete(key);
    throw error;
  });

  await connectPromise;
  poolCache.set(key, pool);
  poolTimestamps.set(key, Date.now());
  return pool;
}

export async function closePools() {
  const pools = Array.from(poolCache.values());
  poolCache.clear();
  poolTimestamps.clear();
  await Promise.allSettled(pools.map(pool => pool.close()));
}
