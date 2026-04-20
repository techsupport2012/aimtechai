const crypto = require('crypto');
const { get, run } = require('../../db/db');

// Random secret for CSRF HMAC — generated once on process start
const CSRF_SECRET = crypto.randomBytes(32).toString('hex');

// ---------------------------------------------------------------------------
// DB settings — read fresh on each call (SQLite local reads are sub-ms)
// ---------------------------------------------------------------------------
function getSecSettings() {
  const readSetting = (key, fallback) => {
    const row = get('SELECT value FROM settings WHERE key = ?', [key]);
    return (row && row.value != null) ? row.value : fallback;
  };
  const result = {
    maxAttempts:    parseInt(readSetting('sec_login_max_attempts', '5'), 10)  || 5,
    lockoutMin:     parseInt(readSetting('sec_login_lockout_min',  '15'), 10) || 15,
    sessionExpHrs:  parseInt(readSetting('sec_session_expire_hrs', '24'), 10) || 24,
    forceHttps:     readSetting('sec_force_https',   '0') === '1',
    ipWhitelist:    readSetting('sec_ip_whitelist',  '').split(',').map(s => s.trim()).filter(Boolean),
    ipBlacklist:    readSetting('sec_ip_blacklist',  '').split(',').map(s => s.trim()).filter(Boolean),
    rateLimitRpm:   parseInt(readSetting('sec_rate_limit_rpm', '100'), 10) || 100,
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
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.admin_session;
  if (!token) return res.redirect('/admin/login');

  const session = get(
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
function loginLimiter(req, res, next) {
  const { maxAttempts, lockoutMin } = getSecSettings();
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
function createSession(userId) {
  const { sessionExpHrs } = getSecSettings();
  const token = crypto.randomBytes(64).toString('hex');
  run(
    `INSERT INTO sessions (user_id, token, expires_at)
     VALUES (?, ?, datetime('now', '+' || ? || ' hours'))`,
    [userId, token, sessionExpHrs]
  );
  run(`UPDATE users SET last_login = datetime('now') WHERE id = ?`, [userId]);
  return token;
}

// ---------------------------------------------------------------------------
// destroySession(token)
// ---------------------------------------------------------------------------
function destroySession(token) {
  run(`DELETE FROM sessions WHERE token = ?`, [token]);
}

// ---------------------------------------------------------------------------
// Periodic cleanup of expired sessions (every hour)
// ---------------------------------------------------------------------------
setInterval(() => {
  run(`DELETE FROM sessions WHERE expires_at <= datetime('now')`);
}, 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// Middleware: ipFilter — blocks blacklisted IPs, restricts to whitelist if set
// ---------------------------------------------------------------------------
function ipFilter(req, res, next) {
  const { ipWhitelist, ipBlacklist } = getSecSettings();
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
