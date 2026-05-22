/**
 * Reads cached data for a given key. Returns { data, expired } or null.
 */
function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && "data" in parsed) {
        return { data: parsed.data, expired: (parsed.expiresAt ?? 0) <= Date.now() };
      }
    }
  } catch (error) {
    console.warn("Cache read skipped.", error);
  }
  return null;
}

function writeCache(key, data, ttlMs) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ expiresAt: Date.now() + ttlMs, data }),
    );
  } catch (error) {
    console.warn("Cache write skipped.", error);
  }
}

/**
 * Cache with stale-while-revalidate semantics.
 * Returns fresh data when within TTL; on loader failure, returns stale data
 * if available rather than throwing.
 */
export async function withCache(key, ttlMs, loader) {
  const cached = readCache(key);

  if (cached && !cached.expired) {
    return cached.data;
  }

  try {
    const data = await loader();
    writeCache(key, data, ttlMs);
    return data;
  } catch (error) {
    if (cached) {
      console.warn(`Cache stale fallback used for "${key}".`, error.message ?? error);
      return cached.data;
    }
    throw error;
  }
}