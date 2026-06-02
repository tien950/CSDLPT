import dotenv from 'dotenv';

dotenv.config();

export const nodeKeys = ['HQHD', 'HQHL', 'HQHCM'];
export const LOCAL_NODE = process.env.LOCAL_NODE ? String(process.env.LOCAL_NODE).trim() : null;

export const localDbConfig = {
  server: process.env.LOCAL_SERVER ?? null,
  database: process.env.LOCAL_DATABASE ?? null,
  instanceName: process.env.LOCAL_INSTANCE ?? null,
  port: process.env.LOCAL_PORT ? Number(process.env.LOCAL_PORT) : null,
  user: process.env.LOCAL_USER ?? null,
  password: process.env.LOCAL_PASSWORD ?? null,
  options: {
    trustServerCertificate: true,
    encrypt: false
  }
};

const headquarterDefaults = {
  HQHD: 'HQHD',
  HQHL: 'HQHL',
  HQHCM: 'HQHCM'
};

export function getNodes() {
  return nodeKeys.reduce((acc, key) => {
    acc[key] = {
      node: key,
      apiBase: getNodeApiBase(key)
    };
    return acc;
  }, {});
}

export function getNode(nodeKey) {
  return getNodes()[nodeKey];
}

export function getHeadquarterId(nodeKey) {
  const key = nodeKeys.includes(nodeKey) ? nodeKey : null;
  if (!key) return null;
  const envKey = `${key}_HEADQUARTER_ID`;
  return process.env[envKey] ?? headquarterDefaults[key];
}

export function normalizeNodeKey(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (nodeKeys.includes(trimmed)) {
    return trimmed;
  }
  const match = nodeKeys.find(key => getHeadquarterId(key) === trimmed);
  return match ?? null;
}

export function isValidNode(nodeKey) {
  return normalizeNodeKey(nodeKey) !== null;
}

function normalizeApiBase(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function getNodeApiBase(nodeKey) {
  const key = normalizeNodeKey(nodeKey);
  if (!key) return null;
  const envKey = `${key}_API_BASE`;
  return normalizeApiBase(process.env[envKey]);
}

export const nodeApiBase = {
  HQHD: getNodeApiBase('HQHD'),
  HQHL: getNodeApiBase('HQHL'),
  HQHCM: getNodeApiBase('HQHCM')
};

export function isLocalNode(nodeKey) {
  return normalizeNodeKey(nodeKey) === normalizeNodeKey(LOCAL_NODE);
}

