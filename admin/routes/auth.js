const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { get, all, run, insert } = require('../../db/db');
const {
  requireAuth,
  loginLimiter,
  createSession,
  destroySession
} = require('../middleware/auth');

const router = express.Router();

const VIEWS_DIR = path.join(__dirname, '..', 'views');
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

// ---------------------------------------------------------------------------
// GET /admin/login
// ---------------------------------------------------------------------------
router.get('/admin/login', (req, res) => {
  const token = req.cookies && req.cookies.admin_session;
  if (token) {
    const session = get(
      `SELECT id FROM sessions WHERE token = ? AND expires_at > datetime('now')`,
      [token]
    );
    if (session) return res.redirect('/admin');
  }
  res.sendFile(path.join(VIEWS_DIR, 'login.html'));
});

// ---------------------------------------------------------------------------
// GET /admin/setup
// ---------------------------------------------------------------------------
router.get('/admin/setup', (req, res) => {
  const existing = get(`SELECT id FROM users LIMIT 1`);
  if (existing) return res.redirect('/admin/login');
  res.sendFile(path.join(VIEWS_DIR, 'setup.html'));
});

// ---------------------------------------------------------------------------
// POST /admin/setup — create first admin account
// ---------------------------------------------------------------------------
router.post('/admin/setup', async (req, res) => {
  try {
    // Block if users already exist
    const existing = get(`SELECT id FROM users LIMIT 1`);
    if (existing) {
      return res.status(403).json({ error: 'Setup already completed' });
    }

    const { username, email, password } = req.body || {};

    // Validation
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Username, email, and password are required' });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    insert('users', {
      username,
      email,
      password_hash: passwordHash,
      role: 'admin'
    });

    const user = get(`SELECT id FROM users WHERE username = ?`, [username]);

    // Notification
    insert('notifications', {
      type: 'system',
      title: 'Admin panel setup complete',
      message: `Admin account "${username}" was created.`
    });

    const token = createSession(user.id);
    res.cookie('admin_session', token, COOKIE_OPTIONS);
    res.json({ ok: true, redirect: '/admin' });
  } catch (err) {
    console.error('Setup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/login
// ---------------------------------------------------------------------------
router.post('/admin/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: 'Username/email and password are required' });
    }

    // Find user by username OR email
    const user = get(
      `SELECT id, username, email, role, password_hash
       FROM users WHERE username = ? OR email = ?`,
      [username, username]
    );

    if (!user) {
      try {
        const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
        insert('notifications', { type: 'login_failed', title: 'Failed login attempt', message: `Unknown user "${username}" from ${ip}.`, is_read: 0 });
        require('../services/notify').dispatchNotification('Failed login attempt', `Unknown user "${username}" from ${ip}.`, 'login_failed');
      } catch {}
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      try {
        const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
        insert('notifications', { type: 'login_failed', title: 'Failed login attempt', message: `Wrong password for "${user.email}" from ${ip}.`, is_read: 0 });
        require('../services/notify').dispatchNotification('Failed login attempt', `Wrong password for "${user.email}" from ${ip}.`, 'login_failed');
      } catch {}
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createSession(user.id);
    res.cookie('admin_session', token, COOKIE_OPTIONS);

    // Notifications: successful login + new-IP detection
    try {
      const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
      const { dispatchNotification } = require('../services/notify');
      const seen = get(`SELECT 1 FROM notifications WHERE type IN ('login','login_new_ip') AND message LIKE ? LIMIT 1`, [`%${ip}%`]);
      const isNewIp = !seen;
      if (isNewIp) {
        const title = 'Login from new IP';
        const message = `${user.email} signed in from a new IP: ${ip}.`;
        insert('notifications', { type: 'login_new_ip', title, message, is_read: 0 });
        dispatchNotification(title, message, 'login_new_ip');
      } else {
        const title = 'Admin login';
        const message = `${user.email} signed in from ${ip}.`;
        insert('notifications', { type: 'login', title, message, is_read: 0 });
        dispatchNotification(title, message, 'login');
      }
    } catch {}

    run(`UPDATE users SET last_login = datetime('now') WHERE id = ?`, [user.id]);

    res.json({
      ok: true,
      redirect: '/admin',
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// ===========================================================================
// POST /admin/emergency-login — lockout recovery via env-var token
// ---------------------------------------------------------------------------
// AUDITABLE BACKDOOR. Requires ADMIN_RECOVERY_TOKEN env var (blank = disabled).
// On a successful token match, opens a session for an EXISTING admin user
// (specified by target_email, or defaults to the first admin in the table).
// Does NOT create new user rows — leaves no footprint in the users table /
// CRM listing. The token itself is the secret; rotate it after every use.
//
// Security:
// - Constant-time token compare (crypto.timingSafeEqual).
// - Every use logged to console.error with IP + target — leaves audit trail.
// - Same rate limit as /admin/login (5 attempts / 15 min / IP).
// - Generic error messages — no info leak about token vs user state.
// ===========================================================================
router.post('/admin/emergency-login', loginLimiter, async (req, res) => {
  try {
    const { token, target_email } = req.body || {};
    const configured = process.env.ADMIN_RECOVERY_TOKEN || '';
    const generic = { error: 'Invalid recovery request' };

    if (!configured) return res.status(403).json(generic);
    if (!token) return res.status(400).json(generic);

    const a = Buffer.from(String(token));
    const b = Buffer.from(configured);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json(generic);
    }

    let user = null;
    if (target_email) {
      user = get(
        `SELECT id, username, email, role FROM users WHERE (email = ? OR username = ?) AND role = 'admin'`,
        [target_email, target_email]
      );
    } else {
      user = get(`SELECT id, username, email, role FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`);
    }

    if (!user) return res.status(401).json(generic);

    const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    console.error(`[EMERGENCY-LOGIN] target=${user.email} (id=${user.id}) ip=${ip} at=${new Date().toISOString()}`);

    try {
      const title = 'Emergency login used';
      const message = `Recovery token used to log in as ${user.email} (id=${user.id}) from ${ip}.`;
      insert('notifications', { type: 'emergency_login_used', title, message, is_read: 0 });
      require('../services/notify').dispatchNotification(title, message, 'emergency_login_used');
    } catch {}

    const sessionToken = createSession(user.id);
    res.cookie('admin_session', sessionToken, COOKIE_OPTIONS);
    return res.json({ ok: true, redirect: '/admin' });
  } catch (err) {
    console.error('Emergency login error:', err);
    return res.status(500).json({ error: 'Invalid recovery request' });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/logout
// ---------------------------------------------------------------------------
router.post('/admin/logout', (req, res) => {
  const token = req.cookies && req.cookies.admin_session;
  if (token) destroySession(token);
  res.clearCookie('admin_session');
  res.redirect('/admin/login');
});

module.exports = router;
