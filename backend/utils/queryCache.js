// Shared query cache across routes
const queryCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export function getCacheKey(studentId, nodeKey, queryName) {
  return `${studentId}:${nodeKey}:${queryName}`;
}

export function getCachedResult(studentId, nodeKey, queryName) {
  const key = getCacheKey(studentId, nodeKey, queryName);
  const cached = queryCache.get(key);
  if (!cached) return null;

  const ageMs = Date.now() - cached.timestamp;
  if (ageMs > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }

  return cached.data;
}

export function setCachedResult(studentId, nodeKey, queryName, data) {
  const key = getCacheKey(studentId, nodeKey, queryName);
  queryCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

export function clearStudentCache(studentId, nodeKey) {
  // Clear cache when student makes changes (register/cancel)
  queryCache.delete(getCacheKey(studentId, nodeKey, 'registrations'));
  queryCache.delete(getCacheKey(studentId, nodeKey, 'schedule'));
  console.log(`[CACHE] Cleared for student ${studentId} on ${nodeKey}`);
}

