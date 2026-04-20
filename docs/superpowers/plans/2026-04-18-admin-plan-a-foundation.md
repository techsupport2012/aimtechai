# Admin Panel Foundation — Implementation Plan (Plan A of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the secured admin panel foundation — database, authentication, admin UI shell, settings, and notification infrastructure — so Plans B/C/D can add modules incrementally.

**Architecture:** Express.js server extended with admin routes under `/admin/*`, protected by session-based auth middleware. SQLite database via `better-sqlite3` stores all data. Admin UI is server-rendered HTML with a persistent sidebar + topbar shell, styled with AIM Tech AI brand colors. Settings module manages users, API keys, and site config. Notification infrastructure provides the bell icon + polling that all future modules push to.

**Tech Stack:** Express.js, better-sqlite3, bcrypt, crypto (Node built-in), vanilla HTML/CSS/JS

**Spec:** `docs/superpowers/specs/2026-04-18-admin-crm-design.md`

**Depends on:** Nothing (this is the first plan)
**Enables:** Plans B (CMS), C (CRM+Bookings), D (Agents+Visitors+Dashboard)

---

## File Structure

**New files (create):**
```
db/
  schema.sql              — full SQLite schema (all 14 tables)
  db.js                   — connection singleton + query helpers
  seed.js                 — default pipeline stages + settings

admin/
  middleware/
    auth.js               — session check, role guard, CSRF token
  routes/
    auth.js               — POST login/logout, GET setup, POST setup
    settings.js           — users CRUD, API keys, site config, booking config
    notifications.js      — list, mark-read, unread-count
  views/
    layout.html           — admin shell (sidebar + topbar + content slot)
    login.html            — login form
    setup.html            — first-run admin creation
    dashboard.html        — placeholder dashboard (stats filled in Plan D)
    settings.html         — settings page with tabs
    notifications.html    — full notifications page
  public/
    admin.css             — admin panel styles (dark theme, teal accents)
    admin.js              — sidebar nav, topbar bell, modals, notifications polling

tests/
  db.test.js              — database helpers
  auth.test.js            — login, session, middleware
  notifications.test.js   — create, list, mark-read
```

**Modified files:**
```
server.js                 — mount admin routes, serve admin assets
package.json              — add better-sqlite3, bcrypt dependencies
.gitignore                — add data/aimtechai.db
```

---

### Task 1: Install dependencies + create database schema

**Files:**
- Modify: `package.json`
- Create: `db/schema.sql`
- Create: `db/db.js`
- Create: `db/seed.js`
- Create: `.gitignore` (or modify)

- [ ] **Step 1: Install dependencies**

```bash
cd Y:/AimTechAI
npm install better-sqlite3 bcrypt
```

- [ ] **Step 2: Create `.gitignore` if missing, add database**

Create or append to `.gitignore`:
```
data/aimtechai.db
node_modules/
```

- [ ] **Step 3: Create `db/schema.sql`**

```sql
-- AIM Tech AI Admin Panel — SQLite Schema
-- Run once on first startup; idempotent (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  meta_description TEXT,
  content_html TEXT,
  status TEXT DEFAULT 'published',
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_html TEXT,
  category TEXT,
  tags TEXT,
  meta_description TEXT,
  status TEXT DEFAULT 'draft',
  author_id INTEGER REFERENCES users(id),
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'new',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT
);

CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  stage_id INTEGER REFERENCES pipeline_stages(id),
  title TEXT NOT NULL,
  value REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  client_timezone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  trigger_type TEXT DEFAULT 'manual',
  trigger_config TEXT,
  is_active INTEGER DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'running',
  input TEXT,
  output TEXT,
  tokens_used INTEGER DEFAULT 0,
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  referrer TEXT,
  landing_page TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id INTEGER REFERENCES visitors(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_visitors_created ON visitors(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id);
```

- [ ] **Step 4: Create `db/db.js`**

```js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'aimtechai.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

// Open database (created if not exists)
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema on startup (all IF NOT EXISTS, safe to re-run)
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// Query helpers
const helpers = {
  get: (sql, params = []) => db.prepare(sql).get(...(Array.isArray(params) ? params : [params])),
  all: (sql, params = []) => db.prepare(sql).all(...(Array.isArray(params) ? params : [params])),
  run: (sql, params = []) => db.prepare(sql).run(...(Array.isArray(params) ? params : [params])),
  insert: (table, obj) => {
    const keys = Object.keys(obj);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    return db.prepare(sql).run(...keys.map(k => obj[k]));
  },
  update: (table, id, obj) => {
    const keys = Object.keys(obj);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const sql = `UPDATE ${table} SET ${sets} WHERE id = ?`;
    return db.prepare(sql).run(...keys.map(k => obj[k]), id);
  },
};

module.exports = { db, ...helpers };
```

- [ ] **Step 5: Create `db/seed.js`**

```js
const { get, insert } = require('./db');

function seed() {
  // Default pipeline stages (only if empty)
  const stageCount = get('SELECT COUNT(*) as c FROM pipeline_stages').c;
  if (stageCount === 0) {
    const stages = [
      { name: 'Lead', position: 1, color: '#0FC1B7' },
      { name: 'Qualified', position: 2, color: '#0DAFA6' },
      { name: 'Proposal', position: 3, color: '#0A9B92' },
      { name: 'Negotiation', position: 4, color: '#087D75' },
      { name: 'Won', position: 5, color: '#28a745' },
      { name: 'Lost', position: 6, color: '#dc3545' },
    ];
    for (const s of stages) insert('pipeline_stages', s);
    console.log('[seed] Created default pipeline stages');
  }

  // Default settings (only if empty)
  const settingsCount = get('SELECT COUNT(*) as c FROM settings').c;
  if (settingsCount === 0) {
    const defaults = {
      company_name: 'AIM Tech AI',
      company_phone: '(310) 421-8638',
      company_address: '9171 Wilshire Blvd, Suite 500, Beverly Hills, CA 90210',
      timezone: 'America/Los_Angeles',
      booking_days: 'mon,tue,wed,thu,fri',
      booking_start: '09:00',
      booking_end: '17:00',
      booking_duration: '30',
      booking_max_per_slot: '1',
      booking_buffer: '0',
      agent_max_tokens: '4096',
      agent_max_runs_hour: '10',
      agent_max_runs_day: '100',
      agent_scheduled_enabled: '0',
      claude_api_key: '',
    };
    for (const [key, value] of Object.entries(defaults)) {
      insert('settings', { key, value });
    }
    console.log('[seed] Created default settings');
  }
}

module.exports = { seed };
```

- [ ] **Step 6: Commit**

```bash
git add db/ .gitignore package.json package-lock.json
git commit -m "feat(admin): database schema + connection + seed defaults

14 tables (users, sessions, pages, blog_posts, contacts, pipeline_stages,
deals, bookings, agents, agent_runs, visitors, page_views, notifications,
settings) with indexes. better-sqlite3 in WAL mode. Seed creates default
pipeline stages and settings."
```

---

### Task 2: Authentication system (middleware + routes)

**Files:**
- Create: `admin/middleware/auth.js`
- Create: `admin/routes/auth.js`

- [ ] **Step 1: Create `admin/middleware/auth.js`**

```js
const crypto = require('crypto');
const { get, run } = require('../../db/db');

const CSRF_SECRET = crypto.randomBytes(32).toString('hex');

// Clean expired sessions periodically
function cleanSessions() {
  run("DELETE FROM sessions WHERE expires_at < datetime('now')");
}
setInterval(cleanSessions, 60 * 60 * 1000); // hourly

function generateCsrfToken(sessionToken) {
  return crypto.createHmac('sha256', CSRF_SECRET).update(sessionToken).digest('hex');
}

// Main auth middleware — checks session cookie
function requireAuth(req, res, next) {
  const token = req.cookies?.admin_session;
  if (!token) return res.redirect('/admin/login');

  const session = get(
    "SELECT s.*, u.id as user_id, u.username, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')",
    [token]
  );
  if (!session) {
    res.clearCookie('admin_session');
    return res.redirect('/admin/login');
  }

  req.user = {
    id: session.user_id,
    username: session.username,
    email: session.email,
    role: session.role,
  };
  req.csrfToken = generateCsrfToken(token);
  next();
}

// Role guard — use after requireAuth
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// CSRF validation for POST/PUT/DELETE
function validateCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.body?._csrf || req.headers['x-csrf-token'];
  const sessionToken = req.cookies?.admin_session;
  if (!sessionToken || !token) return res.status(403).json({ error: 'CSRF token missing' });
  const expected = generateCsrfToken(sessionToken);
  if (token !== expected) return res.status(403).json({ error: 'CSRF token invalid' });
  next();
}

// Login rate limiter (5 per 15 min per IP)
const loginAttempts = new Map();
function loginLimiter(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const max = 5;
  const attempts = (loginAttempts.get(ip) || []).filter(t => now - t < window);
  if (attempts.length >= max) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }
  attempts.push(now);
  loginAttempts.set(ip, attempts);
  next();
}

// Create a session for a user, return the token
function createSession(userId) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  run('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)', [userId, token, expiresAt]);
  run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [userId]);
  return token;
}

function destroySession(token) {
  run('DELETE FROM sessions WHERE token = ?', [token]);
}

module.exports = {
  requireAuth, requireRole, validateCsrf, loginLimiter,
  createSession, destroySession, generateCsrfToken,
};
```

- [ ] **Step 2: Create `admin/routes/auth.js`**

```js
const express = require('express');
const bcrypt = require('bcrypt');
const { get, all, run, insert } = require('../../db/db');
const { loginLimiter, createSession, destroySession, requireAuth } = require('../middleware/auth');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

// GET /admin/login — show login page
router.get('/login', (req, res) => {
  // If already logged in, redirect to dashboard
  const token = req.cookies?.admin_session;
  if (token) {
    const session = get(
      "SELECT 1 FROM sessions WHERE token = ? AND expires_at > datetime('now')",
      [token]
    );
    if (session) return res.redirect('/admin');
  }
  res.sendFile('login.html', { root: __dirname + '/../views' });
});

// GET /admin/setup — first-run setup (only if no users exist)
router.get('/setup', (req, res) => {
  const userCount = get('SELECT COUNT(*) as c FROM users').c;
  if (userCount > 0) return res.redirect('/admin/login');
  res.sendFile('setup.html', { root: __dirname + '/../views' });
});

// POST /admin/setup — create first admin account
router.post('/setup', async (req, res) => {
  const userCount = get('SELECT COUNT(*) as c FROM users').c;
  if (userCount > 0) return res.status(400).json({ error: 'Setup already completed' });

  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = insert('users', {
    username: String(username).slice(0, 50),
    email: String(email).slice(0, 200),
    password_hash: hash,
    role: 'admin',
  });

  // Create notification
  insert('notifications', {
    type: 'system',
    title: 'Admin panel setup complete',
    message: `Welcome, ${username}! Your admin account has been created.`,
    link: '/admin/settings',
  });

  const token = createSession(result.lastInsertRowid);
  res.cookie('admin_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true, redirect: '/admin' });
});

// POST /admin/login — authenticate
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = createSession(user.id);
  res.cookie('admin_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true, redirect: '/admin' });
});

// POST /admin/logout
router.post('/logout', (req, res) => {
  const token = req.cookies?.admin_session;
  if (token) destroySession(token);
  res.clearCookie('admin_session');
  res.redirect('/admin/login');
});

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add admin/middleware/auth.js admin/routes/auth.js
git commit -m "feat(admin): auth system — session middleware, login, setup, CSRF

bcrypt password hashing (cost 12), 64-byte session tokens, httpOnly
cookies, login rate limiting (5/15min), CSRF protection via HMAC,
role guard middleware, first-run setup flow."
```

---

### Task 3: Admin UI shell (layout + login + setup pages + CSS)

**Files:**
- Create: `admin/views/layout.html`
- Create: `admin/views/login.html`
- Create: `admin/views/setup.html`
- Create: `admin/views/dashboard.html`
- Create: `admin/public/admin.css`
- Create: `admin/public/admin.js`

- [ ] **Step 1: Create `admin/public/admin.css`**

```css
/* AIM Tech AI Admin Panel — Dark Theme */
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg-sidebar: #1e2433;
  --bg-main: #151921;
  --bg-card: #1e2433;
  --bg-input: #252d3d;
  --border: rgba(255,255,255,0.08);
  --teal: #0FC1B7;
  --teal-hover: #0DAFA6;
  --navy: #2A354B;
  --text: #e8ecf1;
  --text-dim: rgba(255,255,255,0.5);
  --danger: #dc3545;
  --success: #28a745;
  --warning: #ffc107;
  --font: 'Outfit', system-ui, sans-serif;
  --radius: 10px;
}

body {
  font-family: var(--font);
  background: var(--bg-main);
  color: var(--text);
  display: flex;
  min-height: 100vh;
}

/* Sidebar */
.sidebar {
  width: 220px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0; bottom: 0;
  z-index: 100;
}
.sidebar-logo {
  padding: 1.5rem 1.2rem;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  border-bottom: 1px solid var(--border);
}
.sidebar-logo span { color: var(--teal); }
.sidebar-logo small { display: block; font-size: 0.65rem; font-weight: 400; color: var(--text-dim); letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }

.sidebar-nav { flex: 1; padding: 0.8rem 0; overflow-y: auto; }
.sidebar-nav a {
  display: flex; align-items: center; gap: 0.7rem;
  padding: 0.6rem 1.2rem; color: var(--text-dim);
  text-decoration: none; font-size: 0.85rem; font-weight: 500;
  border-left: 3px solid transparent;
  transition: all 0.2s;
}
.sidebar-nav a:hover { color: var(--text); background: rgba(255,255,255,0.03); }
.sidebar-nav a.active { color: var(--teal); border-left-color: var(--teal); background: rgba(15,193,183,0.06); }
.sidebar-nav a .icon { font-size: 1rem; width: 1.2rem; text-align: center; }
.sidebar-nav a .badge {
  margin-left: auto; background: var(--danger); color: #fff;
  font-size: 0.65rem; font-weight: 700; padding: 1px 6px;
  border-radius: 10px; min-width: 18px; text-align: center;
}

.sidebar-footer {
  padding: 0.8rem 1.2rem; border-top: 1px solid var(--border);
}
.sidebar-footer a {
  display: flex; align-items: center; gap: 0.5rem;
  color: var(--text-dim); text-decoration: none; font-size: 0.8rem;
}
.sidebar-footer a:hover { color: var(--danger); }

/* Main area */
.main { margin-left: 220px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }

/* Topbar */
.topbar {
  height: 56px; padding: 0 1.5rem;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid var(--border);
  background: var(--bg-sidebar);
}
.topbar-title { font-size: 1.05rem; font-weight: 700; }
.topbar-actions { display: flex; align-items: center; gap: 1rem; }
.topbar-bell {
  position: relative; cursor: pointer; font-size: 1.2rem;
  background: none; border: none; color: var(--text-dim);
  padding: 0.4rem; border-radius: 8px;
}
.topbar-bell:hover { color: var(--text); background: rgba(255,255,255,0.05); }
.topbar-bell .badge {
  position: absolute; top: 0; right: 0;
  background: var(--danger); color: #fff; font-size: 0.6rem;
  width: 16px; height: 16px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
}
.topbar-user { font-size: 0.8rem; color: var(--text-dim); }

/* Content */
.content-area { flex: 1; padding: 1.5rem; }

/* Cards */
.card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.5rem;
}
.stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { text-align: center; }
.stat-card .stat-value { font-size: 2rem; font-weight: 800; color: var(--teal); }
.stat-card .stat-label { font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; margin-top: 0.3rem; }

/* Tables */
.admin-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.admin-table th { text-align: left; padding: 0.7rem 1rem; color: var(--text-dim); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border); }
.admin-table td { padding: 0.7rem 1rem; border-bottom: 1px solid var(--border); }
.admin-table tr:hover td { background: rgba(255,255,255,0.02); }

/* Badges */
.badge-sm { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; }
.badge-teal { background: rgba(15,193,183,0.15); color: var(--teal); }
.badge-green { background: rgba(40,167,69,0.15); color: var(--success); }
.badge-red { background: rgba(220,53,69,0.15); color: var(--danger); }
.badge-yellow { background: rgba(255,193,7,0.15); color: var(--warning); }
.badge-gray { background: rgba(255,255,255,0.08); color: var(--text-dim); }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border: none; border-radius: 8px; font-family: var(--font); font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; text-decoration: none; }
.btn-primary { background: var(--teal); color: #fff; }
.btn-primary:hover { background: var(--teal-hover); }
.btn-secondary { background: var(--bg-input); color: var(--text); border: 1px solid var(--border); }
.btn-secondary:hover { border-color: var(--teal); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-danger:hover { opacity: 0.85; }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.75rem; }

/* Forms */
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.4rem; }
.form-input { width: 100%; padding: 0.6rem 0.8rem; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: var(--font); font-size: 0.85rem; }
.form-input:focus { outline: none; border-color: var(--teal); }
.form-input::placeholder { color: var(--text-dim); }
select.form-input { appearance: none; cursor: pointer; }
textarea.form-input { min-height: 100px; resize: vertical; }

/* Modals */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; display: none; align-items: center; justify-content: center; }
.modal-overlay.open { display: flex; }
.modal { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
.modal-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 1.5rem; }
.modal-actions { display: flex; gap: 0.7rem; justify-content: flex-end; margin-top: 1.5rem; }

/* Notifications dropdown */
.notif-dropdown { position: absolute; top: 100%; right: 0; width: 360px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,0.4); z-index: 300; display: none; }
.notif-dropdown.open { display: block; }
.notif-dropdown-header { padding: 0.8rem 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 600; }
.notif-item { display: flex; gap: 0.7rem; padding: 0.7rem 1rem; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; }
.notif-item:hover { background: rgba(255,255,255,0.03); }
.notif-item.unread { border-left: 3px solid var(--teal); }
.notif-item .notif-icon { font-size: 1.1rem; margin-top: 2px; }
.notif-item .notif-text { flex: 1; }
.notif-item .notif-title { font-size: 0.8rem; font-weight: 500; }
.notif-item .notif-time { font-size: 0.65rem; color: var(--text-dim); margin-top: 2px; }
.notif-dropdown-footer { padding: 0.6rem 1rem; text-align: center; }
.notif-dropdown-footer a { color: var(--teal); font-size: 0.75rem; text-decoration: none; }

/* Login page */
.login-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--bg-main); }
.login-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 2.5rem; width: 100%; max-width: 400px; text-align: center; }
.login-card h1 { font-size: 1.5rem; margin-bottom: 0.3rem; }
.login-card h1 span { color: var(--teal); }
.login-card .subtitle { color: var(--text-dim); font-size: 0.8rem; margin-bottom: 2rem; }
.login-card .form-group { text-align: left; }
.login-card .btn-primary { width: 100%; justify-content: center; padding: 0.7rem; font-size: 0.9rem; margin-top: 0.5rem; }
.login-error { color: var(--danger); font-size: 0.8rem; margin-top: 0.5rem; display: none; }

/* Utility */
.flex { display: flex; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.gap-1 { gap: 0.5rem; }
.mt-1 { margin-top: 0.5rem; }
.mb-1 { margin-bottom: 0.5rem; }
.text-dim { color: var(--text-dim); }
.text-sm { font-size: 0.8rem; }

@media (max-width: 768px) {
  .sidebar { width: 60px; }
  .sidebar-nav a span:not(.icon) { display: none; }
  .sidebar-logo small { display: none; }
  .main { margin-left: 60px; }
}
```

- [ ] **Step 2: Create `admin/views/login.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login | AIM Tech AI Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/admin/assets/admin.css">
</head>
<body class="login-page">
  <div class="login-card">
    <h1>AIM<span>TECH</span>AI</h1>
    <p class="subtitle">Admin Panel</p>
    <form id="login-form">
      <div class="form-group">
        <label>Username or Email</label>
        <input type="text" name="username" class="form-input" placeholder="admin" required autofocus>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" class="form-input" placeholder="••••••••" required>
      </div>
      <div class="login-error" id="login-error"></div>
      <button type="submit" class="btn btn-primary">Sign In</button>
    </form>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const errEl = document.getElementById('login-error');
      errEl.style.display = 'none';
      try {
        const res = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: form.username.value,
            password: form.password.value,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          location.href = data.redirect || '/admin';
        } else {
          errEl.textContent = data.error || 'Login failed';
          errEl.style.display = 'block';
        }
      } catch (err) {
        errEl.textContent = 'Connection error';
        errEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 3: Create `admin/views/setup.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Setup | AIM Tech AI Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/admin/assets/admin.css">
</head>
<body class="login-page">
  <div class="login-card">
    <h1>AIM<span>TECH</span>AI</h1>
    <p class="subtitle">Create your admin account</p>
    <form id="setup-form">
      <div class="form-group">
        <label>Username</label>
        <input type="text" name="username" class="form-input" placeholder="admin" required autofocus>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" class="form-input" placeholder="admin@aimtechai.com" required>
      </div>
      <div class="form-group">
        <label>Password (min 8 characters)</label>
        <input type="password" name="password" class="form-input" placeholder="••••••••" required minlength="8">
      </div>
      <div class="login-error" id="setup-error"></div>
      <button type="submit" class="btn btn-primary">Create Admin Account</button>
    </form>
  </div>
  <script>
    document.getElementById('setup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const errEl = document.getElementById('setup-error');
      errEl.style.display = 'none';
      try {
        const res = await fetch('/admin/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: form.username.value,
            email: form.email.value,
            password: form.password.value,
          }),
        });
        const data = await res.json();
        if (data.ok) location.href = data.redirect || '/admin';
        else {
          errEl.textContent = data.error || 'Setup failed';
          errEl.style.display = 'block';
        }
      } catch (err) {
        errEl.textContent = 'Connection error';
        errEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 4: Create `admin/views/layout.html`**

This is a template string used by the server to wrap page content. Create it as a JS function:

Create `admin/views/render.js`:

```js
function adminLayout({ title, page, user, csrfToken, unreadCount = 0, content }) {
  const nav = [
    { href: '/admin', icon: '◉', label: 'Dashboard', id: 'dashboard' },
    { href: '/admin/visitors', icon: '👁', label: 'Visitors', id: 'visitors' },
    { href: '/admin/notifications', icon: '🔔', label: 'Notifications', id: 'notifications', badge: unreadCount },
    { href: '/admin/pages', icon: '📄', label: 'Pages', id: 'pages' },
    { href: '/admin/blog', icon: '✏️', label: 'Blog', id: 'blog' },
    { href: '/admin/contacts', icon: '👥', label: 'Contacts', id: 'contacts' },
    { href: '/admin/pipeline', icon: '💰', label: 'Pipeline', id: 'pipeline' },
    { href: '/admin/bookings', icon: '📅', label: 'Bookings', id: 'bookings' },
    { href: '/admin/agents', icon: '🤖', label: 'Agents', id: 'agents' },
    { href: '/admin/settings', icon: '⚙️', label: 'Settings', id: 'settings' },
  ];

  const navHtml = nav.map(n => {
    const active = n.id === page ? ' active' : '';
    const badge = n.badge ? `<span class="badge">${n.badge}</span>` : '';
    return `<a href="${n.href}" class="${active}"><span class="icon">${n.icon}</span><span>${n.label}</span>${badge}</a>`;
  }).join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | AIM Tech AI Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/admin/assets/admin.css">
  <meta name="csrf-token" content="${csrfToken}">
</head>
<body>
  <aside class="sidebar">
    <div class="sidebar-logo">
      AIM<span>TECH</span>AI
      <small>Admin Panel</small>
    </div>
    <nav class="sidebar-nav">
      ${navHtml}
    </nav>
    <div class="sidebar-footer">
      <a href="#" onclick="document.getElementById('logout-form').submit();return false;">
        <span>🔓</span> <span>Logout</span>
      </a>
      <form id="logout-form" method="POST" action="/admin/logout" style="display:none;">
        <input type="hidden" name="_csrf" value="${csrfToken}">
      </form>
    </div>
  </aside>

  <div class="main">
    <header class="topbar">
      <div class="topbar-title">${title}</div>
      <div class="topbar-actions">
        <div style="position:relative;">
          <button class="topbar-bell" id="bell-btn" aria-label="Notifications">
            🔔
            <span class="badge" id="bell-badge" style="${unreadCount > 0 ? '' : 'display:none'}">${unreadCount}</span>
          </button>
          <div class="notif-dropdown" id="notif-dropdown">
            <div class="notif-dropdown-header">
              <span>Notifications</span>
              <a href="#" id="mark-all-read" style="color:var(--teal);font-size:0.7rem;text-decoration:none;">Mark all read</a>
            </div>
            <div id="notif-list"></div>
            <div class="notif-dropdown-footer">
              <a href="/admin/notifications">View all</a>
            </div>
          </div>
        </div>
        <span class="topbar-user">${user.username} <span class="badge-sm badge-teal">${user.role}</span></span>
      </div>
    </header>

    <div class="content-area">
      ${content}
    </div>
  </div>

  <script src="/admin/assets/admin.js"></script>
</body>
</html>`;
}

module.exports = { adminLayout };
```

- [ ] **Step 5: Create `admin/views/dashboard.html` content**

Create `admin/routes/dashboard.js`:

```js
const express = require('express');
const { get } = require('../../db/db');
const { adminLayout } = require('../views/render');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const contacts = get('SELECT COUNT(*) as c FROM contacts').c;
  const posts = get("SELECT COUNT(*) as c FROM blog_posts WHERE status='published'").c;
  const drafts = get("SELECT COUNT(*) as c FROM blog_posts WHERE status='draft'").c;
  const bookings = get("SELECT COUNT(*) as c FROM bookings WHERE date >= date('now') AND status != 'cancelled'").c;
  const agents = get('SELECT COUNT(*) as c FROM agents WHERE is_active = 1').c;

  const content = `
    <div class="stat-cards">
      <div class="card stat-card"><div class="stat-value">${contacts}</div><div class="stat-label">Contacts</div></div>
      <div class="card stat-card"><div class="stat-value">${posts}</div><div class="stat-label">Published Posts</div></div>
      <div class="card stat-card"><div class="stat-value">${drafts}</div><div class="stat-label">Draft Posts</div></div>
      <div class="card stat-card"><div class="stat-value">${bookings}</div><div class="stat-label">Upcoming Bookings</div></div>
      <div class="card stat-card"><div class="stat-value">${agents}</div><div class="stat-label">Active Agents</div></div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:1rem;">Quick Actions</h3>
      <div class="flex gap-1">
        <a href="/admin/blog?new=1" class="btn btn-primary">✏️ New Blog Post</a>
        <a href="/admin/contacts?new=1" class="btn btn-secondary">👥 Add Contact</a>
        <a href="/admin/agents" class="btn btn-secondary">🤖 Manage Agents</a>
      </div>
    </div>
  `;

  const unread = get('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').c;
  res.send(adminLayout({
    title: 'Dashboard',
    page: 'dashboard',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount: unread,
    content,
  }));
});

module.exports = router;
```

- [ ] **Step 6: Create `admin/public/admin.js`**

```js
// AIM Tech AI Admin — Client-side JS

const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || '';

// Notification bell
const bellBtn = document.getElementById('bell-btn');
const bellBadge = document.getElementById('bell-badge');
const notifDropdown = document.getElementById('notif-dropdown');
const notifList = document.getElementById('notif-list');

if (bellBtn) {
  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle('open');
    if (notifDropdown.classList.contains('open')) loadNotifications();
  });
  document.addEventListener('click', () => notifDropdown?.classList.remove('open'));
  notifDropdown?.addEventListener('click', (e) => e.stopPropagation());
}

async function loadNotifications() {
  try {
    const res = await fetch('/api/admin/notifications?unread=true');
    const data = await res.json();
    bellBadge.textContent = data.unreadCount;
    bellBadge.style.display = data.unreadCount > 0 ? '' : 'none';
    notifList.innerHTML = (data.recent || []).map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" onclick="window.location='${n.link || '#'}'">
        <span class="notif-icon">${typeIcon(n.type)}</span>
        <div class="notif-text">
          <div class="notif-title">${esc(n.title)}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      </div>
    `).join('') || '<div style="padding:1rem;text-align:center;color:var(--text-dim);font-size:0.8rem;">No notifications</div>';
  } catch (err) {
    console.warn('[admin] notification load failed:', err);
  }
}

// Mark all read
document.getElementById('mark-all-read')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await fetch('/api/admin/notifications/read-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': CSRF },
  });
  bellBadge.style.display = 'none';
  bellBadge.textContent = '0';
  loadNotifications();
});

// Poll every 30s
setInterval(async () => {
  try {
    const res = await fetch('/api/admin/notifications?unread=true');
    const data = await res.json();
    bellBadge.textContent = data.unreadCount;
    bellBadge.style.display = data.unreadCount > 0 ? '' : 'none';
  } catch {}
}, 30000);

// Helpers
function typeIcon(type) {
  const map = { booking: '📅', contact: '👥', agent: '🤖', visitor: '👁', system: '⚙️' };
  return map[type] || '📌';
}
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Modal helpers
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// Generic fetch helper with CSRF
async function adminFetch(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-csrf-token': CSRF, ...(opts.headers || {}) };
  const res = await fetch(url, { ...opts, headers });
  return res.json();
}
```

- [ ] **Step 7: Commit**

```bash
git add admin/views/ admin/public/ admin/routes/dashboard.js
git commit -m "feat(admin): UI shell — sidebar, topbar, login, setup, dashboard, CSS

Dark theme admin panel with AIM Tech AI branding. Layout renderer
produces sidebar (10 nav items with badges) + topbar (bell icon +
user info) + content area. Login page, first-run setup page, and
dashboard with stat cards + quick actions. Notification dropdown
with polling every 30s."
```

---

### Task 4: Notifications API + Settings routes

**Files:**
- Create: `admin/routes/notifications.js`
- Create: `admin/routes/settings.js`

- [ ] **Step 1: Create `admin/routes/notifications.js`**

```js
const express = require('express');
const { get, all, run } = require('../../db/db');
const { requireAuth, validateCsrf } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/notifications — list (with optional ?unread=true)
router.get('/', requireAuth, (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const unreadCount = get('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').c;

  let recent;
  if (unreadOnly) {
    recent = all('SELECT * FROM notifications WHERE is_read = 0 ORDER BY created_at DESC LIMIT 10');
  } else {
    const type = req.query.type;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    if (type && type !== 'all') {
      recent = all('SELECT * FROM notifications WHERE type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [type, limit, offset]);
    } else {
      recent = all('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
    }
  }

  res.json({ unreadCount, recent });
});

// PATCH /api/admin/notifications/:id/read
router.patch('/:id/read', requireAuth, validateCsrf, (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// POST /api/admin/notifications/read-all
router.post('/read-all', requireAuth, validateCsrf, (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
  res.json({ ok: true });
});

// DELETE /api/admin/notifications/:id
router.delete('/:id', requireAuth, validateCsrf, (req, res) => {
  run('DELETE FROM notifications WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 2: Create `admin/routes/settings.js`**

```js
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { get, all, run, insert, update } = require('../../db/db');
const { requireAuth, requireRole, validateCsrf } = require('../middleware/auth');
const { adminLayout } = require('../views/render');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

// Encryption helpers for API keys
const ENC_KEY = crypto.createHash('sha256').update(process.env.ADMIN_SECRET || 'aimtechai-default-secret-change-me').digest();
function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}
function decrypt(text) {
  if (!text || !text.includes(':')) return '';
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// GET /admin/settings — render settings page
router.get('/', requireAuth, (req, res) => {
  const users = all('SELECT id, username, email, role, created_at, last_login FROM users ORDER BY id');
  const settings = {};
  for (const row of all('SELECT key, value FROM settings')) {
    settings[row.key] = row.key === 'claude_api_key' ? (row.value ? '••••••••' : '') : row.value;
  }

  const unread = get('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').c;

  const content = `
    <div class="card" style="margin-bottom:1.5rem;">
      <div class="flex-between mb-1">
        <h3>Users</h3>
        ${req.user.role === 'admin' ? '<button class="btn btn-primary btn-sm" onclick="openModal(\'add-user-modal\')">Add User</button>' : ''}
      </div>
      <table class="admin-table">
        <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Last Login</th><th></th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${esc(u.username)}</td>
              <td>${esc(u.email)}</td>
              <td><span class="badge-sm badge-teal">${u.role}</span></td>
              <td class="text-dim text-sm">${u.last_login || 'Never'}</td>
              <td>${req.user.role === 'admin' && u.id !== req.user.id ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Delete</button>` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card" style="margin-bottom:1.5rem;">
      <h3 style="margin-bottom:1rem;">API Keys</h3>
      <form id="api-keys-form">
        <div class="form-group">
          <label>Claude API Key</label>
          <div class="flex gap-1">
            <input type="password" name="claude_api_key" class="form-input" placeholder="${settings.claude_api_key || 'sk-ant-...'}" value="">
            <button type="submit" class="btn btn-primary btn-sm">Save</button>
          </div>
        </div>
      </form>
    </div>

    <div class="card" style="margin-bottom:1.5rem;">
      <h3 style="margin-bottom:1rem;">Site Configuration</h3>
      <form id="site-config-form">
        <div class="form-group"><label>Company Name</label><input name="company_name" class="form-input" value="${esc(settings.company_name || '')}"></div>
        <div class="form-group"><label>Phone</label><input name="company_phone" class="form-input" value="${esc(settings.company_phone || '')}"></div>
        <div class="form-group"><label>Address</label><textarea name="company_address" class="form-input">${esc(settings.company_address || '')}</textarea></div>
        <div class="form-group"><label>Timezone</label><input name="timezone" class="form-input" value="${esc(settings.timezone || '')}"></div>
        <button type="submit" class="btn btn-primary">Save Configuration</button>
      </form>
    </div>

    <div class="card">
      <h3 style="margin-bottom:1rem;">Agent Limits</h3>
      <form id="agent-limits-form">
        <div class="form-group"><label>Max Tokens Per Run</label><input type="number" name="agent_max_tokens" class="form-input" value="${settings.agent_max_tokens || 4096}"></div>
        <div class="form-group"><label>Max Runs Per Hour</label><input type="number" name="agent_max_runs_hour" class="form-input" value="${settings.agent_max_runs_hour || 10}"></div>
        <div class="form-group"><label>Max Runs Per Day</label><input type="number" name="agent_max_runs_day" class="form-input" value="${settings.agent_max_runs_day || 100}"></div>
        <button type="submit" class="btn btn-primary">Save Limits</button>
      </form>
    </div>

    <!-- Add User Modal -->
    <div class="modal-overlay" id="add-user-modal">
      <div class="modal">
        <div class="modal-title">Add User</div>
        <form id="add-user-form">
          <div class="form-group"><label>Username</label><input name="username" class="form-input" required></div>
          <div class="form-group"><label>Email</label><input type="email" name="email" class="form-input" required></div>
          <div class="form-group"><label>Password</label><input type="password" name="password" class="form-input" required minlength="8"></div>
          <div class="form-group">
            <label>Role</label>
            <select name="role" class="form-input">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" onclick="closeModal('add-user-modal')">Cancel</button>
            <button type="submit" class="btn btn-primary">Create User</button>
          </div>
        </form>
      </div>
    </div>

    <script>
    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    // Save API key
    document.getElementById('api-keys-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const key = e.target.claude_api_key.value;
      if (!key) return;
      await adminFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ claude_api_key: key }) });
      e.target.claude_api_key.value = '';
      e.target.claude_api_key.placeholder = '••••••••';
      alert('API key saved');
    });

    // Save site config
    document.getElementById('site-config-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      await adminFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) });
      alert('Configuration saved');
    });

    // Save agent limits
    document.getElementById('agent-limits-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      await adminFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) });
      alert('Limits saved');
    });

    // Add user
    document.getElementById('add-user-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      const result = await adminFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(data) });
      if (result.ok) location.reload();
      else alert(result.error || 'Failed');
    });

    // Delete user
    async function deleteUser(id) {
      if (!confirm('Delete this user?')) return;
      const result = await adminFetch('/api/admin/users/' + id, { method: 'DELETE' });
      if (result.ok) location.reload();
      else alert(result.error || 'Failed');
    }
    </script>
  `;

  res.send(adminLayout({
    title: 'Settings',
    page: 'settings',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount: unread,
    content,
  }));
});

// PUT /api/admin/settings — update settings
router.put('/api', requireAuth, requireRole('admin'), validateCsrf, (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    const storeValue = key === 'claude_api_key' ? encrypt(value) : String(value).slice(0, 2000);
    const existing = get('SELECT 1 FROM settings WHERE key = ?', [key]);
    if (existing) {
      run("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?", [storeValue, key]);
    } else {
      insert('settings', { key, value: storeValue });
    }
  }

  if (updates.claude_api_key) {
    insert('notifications', { type: 'system', title: 'Claude API key updated', message: 'A new Claude API key has been saved.', link: '/admin/settings' });
  }

  res.json({ ok: true });
});

// POST /api/admin/users — create user
router.post('/api/users', requireAuth, requireRole('admin'), validateCsrf, async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (!['admin', 'editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });

  const exists = get('SELECT 1 FROM users WHERE username = ? OR email = ?', [username, email]);
  if (exists) return res.status(409).json({ error: 'Username or email already exists' });

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  insert('users', { username: String(username).slice(0, 50), email: String(email).slice(0, 200), password_hash: hash, role });
  res.json({ ok: true });
});

// DELETE /api/admin/users/:id
router.delete('/api/users/:id', requireAuth, requireRole('admin'), validateCsrf, (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  const admins = get("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").c;
  const target = get('SELECT role FROM users WHERE id = ?', [id]);
  if (target?.role === 'admin' && admins <= 1) return res.status(400).json({ error: 'Cannot delete last admin' });
  run('DELETE FROM sessions WHERE user_id = ?', [id]);
  run('DELETE FROM users WHERE id = ?', [id]);
  res.json({ ok: true });
});

// Export decrypt for use by agent runner
module.exports = router;
module.exports.decrypt = decrypt;
```

- [ ] **Step 3: Commit**

```bash
git add admin/routes/notifications.js admin/routes/settings.js
git commit -m "feat(admin): notifications API + settings page with users/API keys/config

Notifications: list, mark-read, read-all, delete, unread count.
Settings: users CRUD (admin-only), Claude API key (AES-256 encrypted),
site config, agent limits. All with CSRF + role checks."
```

---

### Task 5: Wire everything into server.js

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Update `server.js`**

```js
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

// Initialize database + seed
require('./db/db');
const { seed } = require('./db/seed');
seed();

// Migrate legacy bookings from JSON to SQLite
const { get, insert } = require('./db/db');
const LEGACY_SCHEDULE = path.join(__dirname, 'data', 'schedule.json');
if (fs.existsSync(LEGACY_SCHEDULE)) {
  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_SCHEDULE, 'utf8'));
    const existing = get('SELECT COUNT(*) as c FROM bookings').c;
    if (existing === 0 && legacy.bookings?.length) {
      for (const b of legacy.bookings) {
        insert('bookings', {
          date: b.date, time: b.time, name: b.name, email: b.email,
          notes: b.notes || '', status: b.status || 'pending',
          client_timezone: b.clientTimezone || '',
        });
      }
      console.log(`[migrate] Imported ${legacy.bookings.length} bookings from schedule.json`);
    }
    fs.renameSync(LEGACY_SCHEDULE, LEGACY_SCHEDULE + '.migrated');
  } catch (err) {
    console.warn('[migrate] Failed to migrate schedule.json:', err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 10500;

app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

// Admin static assets
app.use('/admin/assets', express.static(path.join(__dirname, 'admin', 'public')));

// Admin auth routes (no auth required)
const authRoutes = require('./admin/routes/auth');
app.use('/admin', authRoutes);

// Admin auth middleware for all other /admin routes
const { requireAuth, validateCsrf } = require('./admin/middleware/auth');

// First-run redirect: if no users, send to setup
app.get('/admin', (req, res, next) => {
  const userCount = get('SELECT COUNT(*) as c FROM users').c;
  if (userCount === 0) return res.redirect('/admin/setup');
  next();
});

// Admin page routes (auth required)
const dashboardRoutes = require('./admin/routes/dashboard');
app.use('/admin', dashboardRoutes);

// Admin API routes
const notificationRoutes = require('./admin/routes/notifications');
app.use('/api/admin/notifications', notificationRoutes);

const settingsRoutes = require('./admin/routes/settings');
app.get('/admin/settings', settingsRoutes);
app.use('/api/admin/settings', requireAuth, validateCsrf, settingsRoutes.router || settingsRoutes);

// Placeholder admin pages (will be implemented in Plans B/C/D)
const placeholderPages = ['visitors', 'pages', 'blog', 'contacts', 'pipeline', 'bookings', 'agents', 'notifications'];
for (const pg of placeholderPages) {
  app.get(`/admin/${pg}`, requireAuth, (req, res) => {
    const { adminLayout } = require('./admin/views/render');
    const unread = get('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').c;
    res.send(adminLayout({
      title: pg.charAt(0).toUpperCase() + pg.slice(1),
      page: pg,
      user: req.user,
      csrfToken: req.csrfToken,
      unreadCount: unread,
      content: `<div class="card"><p class="text-dim">Module coming soon.</p></div>`,
    }));
  });
}

// ===== PUBLIC ROUTES (unchanged) =====

// Booking API (now using SQLite)
const { run, all } = require('./db/db');

app.get('/api/schedule/availability', (req, res) => {
  const settings = {};
  for (const row of all('SELECT key, value FROM settings WHERE key LIKE "booking_%"')) {
    settings[row.key] = row.value;
  }
  const bookedSlots = all("SELECT date, time FROM bookings WHERE status != 'cancelled'")
    .map(b => ({ date: b.date, time: b.time }));
  res.json({ settings, bookedSlots });
});

// In-process rate limiter for booking
const _bookHits = new Map();
function bookingLimiter(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const now = Date.now();
  const arr = (_bookHits.get(ip) || []).filter(t => now - t < 60000);
  if (arr.length >= 5) return res.status(429).json({ error: 'Too many bookings. Try again shortly.' });
  arr.push(now);
  _bookHits.set(ip, arr);
  next();
}

app.post('/api/schedule/book', bookingLimiter, (req, res) => {
  const { date, time, name, email, notes, clientTimezone } = req.body || {};
  if (!date || !time || !name || !email) {
    return res.status(400).json({ error: 'date, time, name and email are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const maxPerSlot = parseInt(get("SELECT value FROM settings WHERE key = 'booking_max_per_slot'")?.value || '1');
  const taken = get("SELECT COUNT(*) as c FROM bookings WHERE date = ? AND time = ? AND status != 'cancelled'", [date, time]).c;
  if (taken >= maxPerSlot) {
    return res.status(409).json({ error: 'This time slot is no longer available' });
  }

  const result = insert('bookings', {
    date: String(date).slice(0, 10),
    time: String(time).slice(0, 5),
    name: String(name).slice(0, 100),
    email: String(email).slice(0, 200),
    notes: String(notes || '').slice(0, 500),
    status: 'pending',
    client_timezone: String(clientTimezone || '').slice(0, 60),
  });

  // Create notification
  insert('notifications', {
    type: 'booking',
    title: `New booking: ${String(name).slice(0, 50)}`,
    message: `${date} at ${time}`,
    link: '/admin/bookings',
  });

  // Auto-create contact if not exists
  const existingContact = get('SELECT id FROM contacts WHERE email = ?', [email]);
  if (!existingContact) {
    insert('contacts', { name: String(name).slice(0, 100), email: String(email).slice(0, 200), source: 'booking' });
    insert('notifications', { type: 'contact', title: `New contact: ${String(name).slice(0, 50)}`, message: email, link: '/admin/contacts' });
  }

  console.log(`[book] ${name} <${email}> booked ${date} ${time}`);
  res.json({ ok: true, booking: { id: result.lastInsertRowid, date, time } });
});

// Explicit route for /blog
app.get('/blog', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blog.html'));
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  redirect: false,
}));

// Fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AIM Tech AI server running at http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Install cookie-parser**

```bash
npm install cookie-parser
```

- [ ] **Step 3: Test manually**

Start the server:
```bash
node server.js
```

Expected:
- `[seed] Created default pipeline stages`
- `[seed] Created default settings`
- Server running on port 10500

Visit `http://localhost:10500/admin`:
- Should redirect to `/admin/setup` (no users yet)
- Fill out the form → creates admin account → redirects to dashboard
- Dashboard shows stat cards (all zeros) + quick actions
- Bell icon shows 1 notification ("Admin panel setup complete")
- Sidebar navigation works (placeholder pages show "Module coming soon")
- Settings page shows users table, API keys, site config, agent limits
- Logout works → redirects to login → can log back in

- [ ] **Step 4: Commit**

```bash
git add server.js package.json package-lock.json
git commit -m "feat(admin): wire foundation into server.js

Mounts auth routes, dashboard, notifications API, settings page.
Migrates legacy schedule.json bookings to SQLite on first run.
Booking API uses SQLite. Auto-creates contacts + notifications on
new bookings. Placeholder pages for modules coming in Plans B/C/D.
First-run redirects to /admin/setup."
```

---

## Self-Review

**Spec coverage check:**
- ✅ §1 Architecture — file structure matches
- ✅ §2 Database — all 14 tables + indexes in schema.sql
- ✅ §3 Sidebar — all 10 nav items in layout renderer
- ✅ §3b Visitors + Notifications — notification infrastructure built, visitors placeholder
- ✅ §4 Security — bcrypt, sessions, CSRF, rate limiting, role guard, encrypted API keys
- ✅ §5 Dashboard — stat cards + quick actions
- ✅ §5 Settings — users CRUD, API keys, site config, agent limits
- ✅ §11 Migration — legacy JSON bookings migrated

**What Plan A delivers:**
- Working `/admin` with login, setup, dashboard, settings, notifications
- Database with all tables ready for Plans B/C/D
- Auth middleware that all future routes use
- Notification system that all future modules push to
- Booking API migrated from JSON to SQLite

**What's deferred to Plans B/C/D:**
- Plan B: CMS pages editor, blog editor with markdown + publish
- Plan C: Contacts CRUD, pipeline kanban, booking calendar
- Plan D: Agent builder + runner, visitor tracking + charts, full dashboard
