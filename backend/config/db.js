import sql from 'mssql';
import { getNode } from './nodes.js';

const poolCache = new Map();

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
      connectionTimeout: 15000,
      requestTimeout: 15000,
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
    return poolCache.get(nodeKey);
  }

  const config = buildConfig(nodeKey);
  const pool = new sql.ConnectionPool(config);
  const connectPromise = pool.connect().catch(error => {
    console.error(`[DB] Connection failed for ${nodeKey}:`, error.message);
    poolCache.delete(nodeKey);
    throw error;
  });

  poolCache.set(nodeKey, connectPromise);
  return connectPromise;
}

export async function closePools() {
  const pools = Array.from(poolCache.values());
  poolCache.clear();
  await Promise.allSettled(pools.map(poolPromise => poolPromise.then(pool => pool.close())));
}
