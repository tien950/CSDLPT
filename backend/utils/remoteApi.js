import { LOCAL_NODE, nodeApiBase, nodeKeys } from '../config/nodes.js';

const DEFAULT_TIMEOUT_MS = 5000;

function normalizeJson(data) {
  if (data && typeof data === 'object') {
    return data;
  }
  return { success: false, message: 'Phản hồi từ node không hợp lệ.' };
}

function buildUrl(baseUrl, path, query) {
  const url = new URL(path, baseUrl);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, value);
  });
  return url;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(new Error('Request timed out.')), timeoutMs);
  const method = String(options.method ?? 'GET').toUpperCase();
  const canSendBody = method !== 'GET' && method !== 'HEAD';
  const requestOptions = {
    method,
    headers: options.headers,
    signal: controller.signal
  };

  if (canSendBody && options.body !== undefined && options.body !== null) {
    requestOptions.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, requestOptions);

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: false, message: 'Phản hồi JSON không hợp lệ.', raw: text };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data: normalizeJson(data)
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function callRemoteNode(nodeKey, method, path, body, token) {
  const baseUrl = nodeApiBase[nodeKey];
  if (!baseUrl) {
    const error = new Error(`Node ${nodeKey} hiện không khả dụng`);
    error.node = nodeKey;
    error.offline = true;
    throw error;
  }

  console.log('[REMOTE] Calling node', nodeKey, path);

  try {
    const url = buildUrl(baseUrl, path);
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Internal-Call': 'true',
      'x-node-proxy': '1'
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return await fetchWithTimeout(url, {
      method,
      body,
      headers
    });
  } catch (error) {
    const offlineError = new Error(`Node ${nodeKey} hiện không khả dụng`);
    offlineError.node = nodeKey;
    offlineError.offline = true;
    offlineError.cause = error;
    throw offlineError;
  }
}

export async function callAllNodes(method, path, body, token) {
  const tasks = nodeKeys
    .filter(nodeKey => nodeKey !== LOCAL_NODE)
    .map(async nodeKey => {
      try {
        const result = await callRemoteNode(nodeKey, method, path, body, token);
        return { node: nodeKey, ...result };
      } catch (error) {
        console.warn(`[REMOTE] Node ${nodeKey} unavailable: ${error.message}`);
        return {
          node: nodeKey,
          ok: false,
          status: 503,
          offline: true,
          data: {
            success: false,
            message: error.message,
            node: nodeKey,
            offline: true
          }
        };
      }
    });

  const results = await Promise.allSettled(tasks);
  return results
    .map(item => (item.status === 'fulfilled' ? item.value : null))
    .filter(Boolean);
}

export function isRemoteNode(nodeKey) {
  return Boolean(nodeKey && LOCAL_NODE && nodeKey !== LOCAL_NODE);
}



