// In-memory TTL + LRU cache for AI responses. Identical prompts return the
// stored answer instead of spending another Groq API call, which is what lets
// the /generate rate limit sit higher than the raw Groq quota would allow.
const MAX_ENTRIES = 500;
const TTL_MS = 24 * 60 * 60 * 1000; // course content for identical inputs is reusable for a day

const store = new Map(); // key -> { value, expiresAt }; Map order doubles as LRU recency

export const cacheGet = (key) => {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  // Refresh recency so frequently-used prompts survive eviction
  store.delete(key);
  store.set(key, entry);
  return entry.value;
};

export const cacheSet = (key, value) => {
  if (store.has(key)) store.delete(key);
  else if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
};
