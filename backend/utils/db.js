import sql from 'mssql';

const OFFLINE_CODES = new Set([
  'ETIMEOUT',
  'ESOCKET',
  'ELOGIN',
  'ENOTOPEN',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ECONNREFUSED'
]);

export function isOfflineError(error) {
  if (!error) return false;
  if (OFFLINE_CODES.has(error.code)) return true;
  return /Failed to connect|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|socket/i.test(error.message ?? '');
}

export function createRequest(nodeKey, transaction, pool) {
  console.log(`[DB] Querying node ${nodeKey}`);
  if (transaction) {
    return new sql.Request(transaction);
  }
  return pool.request();
}

export function withNode(nodeKey, error) {
  if (error && !error.node) {
    error.node = nodeKey;
  }
  return error;
}
