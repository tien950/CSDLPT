import sql from 'mssql';
import { LOCAL_NODE, localDbConfig } from './nodes.js';

const poolCache = new Map();
const poolTimestamps = new Map(); // Track when pools were created

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
  const config = {
    server: localDbConfig.server,
    database: localDbConfig.database,
    user: localDbConfig.user,
    password: localDbConfig.password,
    pool: {
      max: 20,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectionTimeout: 5000,
      requestTimeout: 15000,
      cancelTimeout: 2000,
      ...(localDbConfig.instanceName ? { instanceName: localDbConfig.instanceName } : {})
    }
  };

  if (localDbConfig.instanceName) {
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
