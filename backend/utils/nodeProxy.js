import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { getNodeApiBase } from '../config/nodes.js';

const DEFAULT_TIMEOUT_MS = 15000;
const PROXY_HEADER = 'x-node-proxy';

function parseProxyHeader(value) {
  if (!value) return false;
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function buildUrl(baseUrl, path, query) {
  const url = new URL(path, baseUrl);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, value);
    });
  }
  return url;
}

function parseJsonSafely(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return {
      success: false,
      message: 'Phan hoi khong hop le tu node.',
      raw
    };
  }
}

function requestJson(url, options) {
  const client = url.protocol === 'https:' ? https : http;
  const payload = options.body ? JSON.stringify(options.body) : null;
  const headers = {
    Accept: 'application/json',
    ...(options.headers ?? {})
  };

  if (payload) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload);
  }

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: options.method ?? 'GET',
        headers
      },
      response => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', chunk => {
          raw += chunk;
        });
        response.on('end', () => {
          const data = parseJsonSafely(raw);
          resolve({
            status: response.statusCode ?? 500,
            ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300,
            data
          });
        });
      }
    );

    request.on('error', reject);
    request.setTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, () => {
      request.destroy(new Error('Proxy timeout.'));
    });

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

export function isProxyRequest(req) {
  return parseProxyHeader(req.headers?.[PROXY_HEADER]);
}

export function getProxyHeaders(req) {
  const headers = {
    [PROXY_HEADER]: '1'
  };
  if (req.headers?.authorization) {
    headers.Authorization = req.headers.authorization;
  }
  return headers;
}

export async function fetchNodeApiJson(nodeKey, path, options = {}) {
  const baseUrl = getNodeApiBase(nodeKey);
  if (!baseUrl) {
    const error = new Error(`Thieu cau hinh API base cho node ${nodeKey}.`);
    error.code = 'ENODEAPI';
    throw error;
  }

  const url = buildUrl(baseUrl, path, options.query);
  return requestJson(url, options);
}

