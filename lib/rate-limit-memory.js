const hits = new Map();

module.exports = {
  check(key, limit, windowMs) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= limit) {
      hits.set(key, arr);
      return { ok: false, remaining: 0 };
    }
    arr.push(now);
    hits.set(key, arr);
    return { ok: true, remaining: Math.max(0, limit - arr.length) };
  },
  resetForTests() {
    hits.clear();
  },
};
