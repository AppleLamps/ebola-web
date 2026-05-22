export async function withCache(key, ttlMs, loader) {
  const now = Date.now();

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.expiresAt > now) {
        return parsed.data;
      }
    }
  } catch (error) {
    console.warn("Cache read skipped.", error);
  }

  const data = await loader();

  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        expiresAt: now + ttlMs,
        data,
      }),
    );
  } catch (error) {
    console.warn("Cache write skipped.", error);
  }

  return data;
}