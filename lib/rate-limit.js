/**
 * Rate-limit factory. Picks Upstash when both UPSTASH_REDIS_REST_URL
 * and UPSTASH_REDIS_REST_TOKEN are set, otherwise the in-memory
 * adapter. In-memory is dev/single-process only — resets on every
 * cold start and not shared across instances.
 */
const memory = require('./rate-limit-memory');

let cached = null;

function getLimiter() {
  if (cached) return cached;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    cached = require('./rate-limit-upstash');
  } else {
    cached = memory;
  }
  return cached;
}

async function checkRateLimit(key, limit, windowMs) {
  return await Promise.resolve(getLimiter().check(key, limit, windowMs));
}

function resetRateLimitForTests() {
  cached = null;
  memory.resetForTests();
}

module.exports = { getLimiter, checkRateLimit, resetRateLimitForTests };
