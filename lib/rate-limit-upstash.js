const URL = process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

async function call(commands) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const json = await res.json();
  return json.result;
}

module.exports = {
  // Fixed-window counter (acceptable at low call rates; documented limitation)
  async check(key, limit, windowMs) {
    const bucket = `ratelimit:${key}:${Math.floor(Date.now() / windowMs)}`;
    try {
      const count = await call(['INCR', bucket]);
      if (count === 1) await call(['EXPIRE', bucket, Math.ceil(windowMs / 1000)]);
      if (count > limit) return { ok: false, remaining: 0 };
      return { ok: true, remaining: Math.max(0, limit - count) };
    } catch {
      // Fail open — don't block real users if Upstash is unreachable
      return { ok: true, remaining: limit };
    }
  },
};
