const DEFAULT_API_BY_CAMPUS = {
  HQHD: 'http://26.28.246.97:4000',
  HQHL: 'http://26.54.47.104:4000',
  HQHCM: 'http://26.213.180.63:4000'
};

function normalizeBaseUrl(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export const API_BY_CAMPUS = {
  HQHD: normalizeBaseUrl(import.meta.env.VITE_API_HQHD) ?? DEFAULT_API_BY_CAMPUS.HQHD,
  HQHL: normalizeBaseUrl(import.meta.env.VITE_API_HQHL) ?? DEFAULT_API_BY_CAMPUS.HQHL,
  HQHCM: normalizeBaseUrl(import.meta.env.VITE_API_HQHCM) ?? DEFAULT_API_BY_CAMPUS.HQHCM
};

export function getApiBase(maCS) {
  return API_BY_CAMPUS[maCS] ?? API_BY_CAMPUS.HQHD;
}

export function getToken() {
  try {
    const raw = localStorage.getItem('csdlpt.auth');
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.token) return parsed.token;
  } catch {
    // ignore parse errors
  }
  return localStorage.getItem('token');
}

function buildUrl(path, maCS) {
  if (!path) return getApiBase(maCS);
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBase(maCS);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export async function apiFetch(path, maCS, options = {}) {
  const url = buildUrl(path, maCS);
  const headers = new Headers(options.headers ?? {});
  const token = getToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    body = JSON.stringify(body);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body
  });

  const rawText = await response.text();
  let payload = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message = payload?.message ?? `Lỗi HTTP ${response.status}`;
    throw new Error(message);
  }

  if (payload && payload.success === false) {
    throw new Error(payload.message ?? 'Có lỗi xảy ra.');
  }

  return payload;
}
