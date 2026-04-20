const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { get, run } = require('../../db/db');

// CSRF HMAC secret — must persist across server restarts. If it regenerates,
// every CSRF token already rendered into a page becomes invalid and any
// subsequent form submit / fetch returns 403 until the user reloads.
//
// Resolution order:
//   1. process.env.CSRF_SECRET (production)
//   2. data/.csrf-secret  (auto-generated once, persisted across restarts)
const CSRF_SECRET = (function loadCsrfSecret() {
  if (process.env.CSRF_SECRET && process.env.CSRF_SECRET.length >= 32) {
    return process.env.CSRF_SECRET;
  }
  const dataDir = path.join(__dirname, '..', '..', 'data');
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
  const secretFile = path.join(dataDir, '.csrf-secret');
  try {
    const existing = fs.readFileSync(secretFile, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {}
  const fresh = crypto.randomBytes(32).toString('hex');
  try { fs.writeFileSync(secretFile, fresh, { mode: 0o600 }); } catch {}
  return fresh;
})();

// ---------------------------------------------------------------------------
// DB settings — read fresh on each call (SQLite local reads are sub-ms)
// ---------------------------------------------------------------------------
async function getSecSettings() {
  const readSetting = async (key, fallback) => {
    const row = await get('SELECT value FROM settings WHERE key = ?', [key]);
    return (row && row.value != null) ? row.value : fallback;
  };
  const result = {
    maxAttempts:    parseInt(await readSetting('sec_login_max_attempts', '5'), 10)  || 5,
    lockoutMin:     parseInt(await readSetting('sec_login_lockout_min',  '15'), 10) || 15,
    sessionExpHrs:  parseInt(await readSetting('sec_session_expire_hrs', '24'), 10) || 24,
    forceHttps:     (await readSetting('sec_force_https',   '0')) === '1',
    ipWhitelist:    (await readSetting('sec_ip_whitelist',  '')).split(',').map(s => s.trim()).filter(Boolean),
    ipBlacklist:    (await readSetting('sec_ip_blacklist',  '')).split(',').map(s => s.trim()).filter(Boolean),
    rateLimitRpm:   parseInt(await readSetting('sec_rate_limit_rpm', '100'), 10) || 100,
  };
  return result;
}

// ---------------------------------------------------------------------------
// Rate-limiter store (in-memory, per IP)
// ---------------------------------------------------------------------------
const loginAttempts = new Map(); // ip -> { count, resetAt }

// ---------------------------------------------------------------------------
// Middleware: requireAuth
// ---------------------------------------------------------------------------
async function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.admin_session;
  if (!token) return res.redirect('/admin/login');

  const session = await get(
    `SELECT s.token, s.expires_at, u.id, u.username, u.email, u.role
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > datetime('now')`,
    [token]
  );

  if (!session) return res.redirect('/admin/login');

  req.user = {
    id: session.id,
    username: session.username,
    email: session.email,
    role: session.role
  };

  // CSRF token derived from session token via HMAC
  req.csrfToken = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(token)
    .digest('hex');

  next();
}

// ---------------------------------------------------------------------------
// Middleware factory: requireRole
// ---------------------------------------------------------------------------
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden — insufficient role' });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Middleware: validateCsrf
// ---------------------------------------------------------------------------
function validateCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const token = req.cookies && req.cookies.admin_session;
  if (!token) return res.status(403).json({ error: 'Invalid CSRF token' });

  const expected = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(token)
    .digest('hex');

  const provided =
    (req.body && req.body._csrf) || req.headers['x-csrf-token'];

  if (!provided || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(provided)))) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}

// ---------------------------------------------------------------------------
// Middleware: loginLimiter
// ---------------------------------------------------------------------------
async function loginLimiter(req, res, next) {
  const { maxAttempts, lockoutMin } = await getSecSettings();
  const windowMs = lockoutMin * 60 * 1000;
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  let entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    loginAttempts.set(ip, entry);
    return next();
  }

  entry.count += 1;

  if (entry.count > maxAttempts) {
    return res
      .status(429)
      .json({ error: 'Too many login attempts. Try again later.' });
  }

  next();
}

// ---------------------------------------------------------------------------
// createSession(userId) -> token string
// ---------------------------------------------------------------------------
async function createSession(userId) {
  const { sessionExpHrs } = await getSecSettings();
  const token = crypto.randomBytes(64).toString('hex');
  await run(
    `INSERT INTO sessions (user_id, token, expires_at)
     VALUES (?, ?, datetime('now', '+' || ? || ' hours'))`,
    [userId, token, sessionExpHrs]
  );
  await run(`UPDATE users SET last_login = datetime('now') WHERE id = ?`, [userId]);
  return token;
}

// ---------------------------------------------------------------------------
// destroySession(token)
// ---------------------------------------------------------------------------
async function destroySession(token) {
  await run(`DELETE FROM sessions WHERE token = ?`, [token]);
}

// ---------------------------------------------------------------------------
// Periodic cleanup of expired sessions (every hour)
// ---------------------------------------------------------------------------
setInterval(async () => {
  try {
    await run(`DELETE FROM sessions WHERE expires_at <= datetime('now')`);
  } catch (err) {
    console.error('[auth] session cleanup error:', err.message);
  }
}, 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// Middleware: ipFilter — blocks blacklisted IPs, restricts to whitelist if set
// ---------------------------------------------------------------------------
async function ipFilter(req, res, next) {
  const { ipWhitelist, ipBlacklist } = await getSecSettings();
  const ip = req.ip || req.connection.remoteAddress;

  if (ipBlacklist.length && ipBlacklist.includes(ip)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (ipWhitelist.length && !ipWhitelist.includes(ip)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

module.exports = {
  requireAuth,
  requireRole,
  validateCsrf,
  loginLimiter,
  createSession,
  destroySession,
  ipFilter,
  getSecSettings
};
