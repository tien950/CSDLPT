import sql from 'mssql';
import { getNode } from './nodes.js';

const poolCache = new Map();
const poolTimestamps = new Map(); // Track when pools were created

function getEnvForNode(nodeKey, suffix) {
  const nodeSpecific = process.env[`${nodeKey}_${suffix}`];
  return nodeSpecific ?? process.env[`DB_${suffix}`];
}

function buildConfig(nodeKey) {
  const node = getNode(nodeKey);
  if (!node) {
    throw new Error(`Unknown node: ${nodeKey}`);
  }

  const user = getEnvForNode(nodeKey, 'USER');
  const password = getEnvForNode(nodeKey, 'PASSWORD');
  const instanceName =
    getEnvForNode(nodeKey, 'INSTANCE') ?? getEnvForNode(nodeKey, 'INSTANCE_NAME');

  if (!user || !password) {
    throw new Error(`Missing DB credentials for ${nodeKey}. Set ${nodeKey}_USER and ${nodeKey}_PASSWORD.`);
  }

  const portRaw = getEnvForNode(nodeKey, 'PORT');
  const port = portRaw ? Number(portRaw) : null;

  const config = {
    user,
    password,
    server: node.server,
    database: node.database,
    pool: {
      // increase pool size to handle higher concurrency
      max: 20,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectionTimeout: 30000,
      requestTimeout: 90000,
      cancelTimeout: 5000,
      ...(instanceName ? { instanceName } : {})
    }
  };

  if (port) {
    config.port = port;
  } else if (!instanceName) {
    config.port = 1433;
  }

  return config;
}

export async function getPool(nodeKey) {
   if (poolCache.has(nodeKey)) {
     const pool = poolCache.get(nodeKey);
     // Recreate pool if older than 10 minutes to avoid stale connections
     const createdAt = poolTimestamps.get(nodeKey) || 0;
     const ageMs = Date.now() - createdAt;
     if (ageMs > 10 * 60 * 1000) {
       console.warn(`[DB] Pool for ${nodeKey} is old (${Math.round(ageMs / 1000)}s), recreating...`);
       await pool.close().catch(() => {});
       poolCache.delete(nodeKey);
       poolTimestamps.delete(nodeKey);
     } else {
       return pool;
     }
   }

   const config = buildConfig(nodeKey);
   const pool = new sql.ConnectionPool(config);
   
   const connectPromise = pool.connect().catch(error => {
     console.error(`[DB] Connection failed for ${nodeKey}:`, error.message);
     console.error(`[DB] Error code: ${error.code}`);
     poolCache.delete(nodeKey);
     poolTimestamps.delete(nodeKey);
     throw error;
   });

   poolCache.set(nodeKey, pool);
   poolTimestamps.set(nodeKey, Date.now());
   return pool;
 }

export async function closePools() {
  const pools = Array.from(poolCache.values());
  poolCache.clear();
  poolTimestamps.clear();
  await Promise.allSettled(pools.map(pool => pool.close()));
}


