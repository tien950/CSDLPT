import sql from 'mssql';
import { LOCAL_NODE } from '../config/nodes.js';

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
  if (OFFLINE_CODES.has(error.code)) {
    console.warn(`[DB] Offline error detected: ${error.code} - ${error.message}`);
    return true;
  }
  return /Failed to connect|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|socket/i.test(error.message ?? '');
}

export function createRequest(nodeKey, transaction, pool) {
  console.log('[DB] Querying local node', LOCAL_NODE ?? nodeKey ?? 'UNKNOWN');
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
