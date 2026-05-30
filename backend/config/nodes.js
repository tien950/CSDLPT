import dotenv from 'dotenv';

dotenv.config();

const nodeDefaults = {
  HQHD: { server: 'IP_1', database: 'QLDangKy_HQHD' },
  HQHL: { server: 'IP_2', database: 'QLDangKy_HQHL' },
  HQHCM: { server: 'IP_3', database: 'QLDangKy_HQHCM' }
};

export const nodeKeys = ['HQHD', 'HQHL', 'HQHCM'];
const headquarterDefaults = {
  HQHD: 'HQHD',
  HQHL: 'HQHL',
  HQHCM: 'HQHCM'
};

export function getNodes() {
  return {
    HQHD: {
      server: process.env.HQHD_SERVER ?? nodeDefaults.HQHD.server,
      database: process.env.HQHD_DATABASE ?? nodeDefaults.HQHD.database
    },
    HQHL: {
      server: process.env.HQHL_SERVER ?? nodeDefaults.HQHL.server,
      database: process.env.HQHL_DATABASE ?? nodeDefaults.HQHL.database
    },
    HQHCM: {
      server: process.env.HQHCM_SERVER ?? nodeDefaults.HQHCM.server,
      database: process.env.HQHCM_DATABASE ?? nodeDefaults.HQHCM.database
    }
  };
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
