export const API_LOCAL =
  import.meta.env.VITE_API_LOCAL || 'http://localhost:4000';
export const API_GATEWAY =
  import.meta.env.VITE_API_HQHD || API_LOCAL;

export const API_BY_CAMPUS = {
  HQHD: import.meta.env.VITE_API_HQHD || 'http://26.28.246.97:4000',
  HQHL: import.meta.env.VITE_API_HQHL || 'http://26.54.47.104:4000',
  HQHCM: import.meta.env.VITE_API_HQHCM || 'http://26.213.180.63:4000',
};
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 60000);

export function getApiBase(maCS) {
  return API_BY_CAMPUS[maCS] || API_LOCAL;
}

export function getToken() {
  return localStorage.getItem('token');
}

function normalizeJsonBody(options) {
  if (
    options.body &&
    typeof options.body === 'object' &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof URLSearchParams) &&
    !(options.body instanceof Blob)
  ) {
    return {
      ...options,
      body: JSON.stringify(options.body),
    };
  }

  return options;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Quá thời gian chờ API (${API_TIMEOUT_MS}ms).`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function authFetch(path, options = {}) {
  const requestOptions = normalizeJsonBody(options);

  const res = await fetchWithTimeout(`${API_LOCAL}${path}`, {
    ...requestOptions,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      ...(requestOptions.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.message || 'Không thể đăng nhập.');
  }

  return data;
}

export async function apiFetch(path, maCS, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error('Thiếu token đăng nhập.');
  }

  const apiBase = getApiBase(maCS);
  const requestOptions = normalizeJsonBody(options);

  const res = await fetchWithTimeout(`${apiBase}${path}`, {
    ...requestOptions,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      ...(requestOptions.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.message || 'Không thể lấy dữ liệu từ cơ sở.');
  }

  return data;
}

export async function gatewayFetch(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error('Thiếu token đăng nhập.');
  }

  const requestOptions = normalizeJsonBody(options);

  const res = await fetchWithTimeout(`${API_GATEWAY}${path}`, {
    ...requestOptions,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      ...(requestOptions.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.message || 'Không thể lấy dữ liệu từ máy chủ HQHD.');
  }

  return data;
}
