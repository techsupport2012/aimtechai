require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

// ---------------------------------------------------------------------------
// Database initialisation
// ---------------------------------------------------------------------------
const { get, all, run, insert } = require('./db/db');
const { dispatchNotification } = require('./admin/services/notify');
require('./db/seed').seed();

// ---------------------------------------------------------------------------
// Legacy migration: schedule.json → SQLite bookings
// ---------------------------------------------------------------------------
try {
  const SCHEDULE_FILE = path.join(__dirname, 'data', 'schedule.json');
  if (fs.existsSync(SCHEDULE_FILE)) {
    const bookingCount = (get(`SELECT COUNT(*) AS c FROM bookings`) || {}).c || 0;
    if (bookingCount === 0) {
      const data = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
      const bookings = data.bookings || [];
      for (const b of bookings) {
        insert('bookings', {
          date: b.date || '',
          time: b.time || '',
          name: b.name || '',
          email: b.email || '',
          notes: b.notes || '',
          client_timezone: b.clientTimezone || '',
          client_date: b.clientDate || '',
          client_time: b.clientTime || '',
          status: b.status || 'pending'
        });
      }
      console.log(`[migration] Migrated ${bookings.length} bookings from schedule.json to SQLite`);
    }
    fs.renameSync(SCHEDULE_FILE, SCHEDULE_FILE + '.migrated');
    console.log('[migration] Renamed schedule.json → schedule.json.migrated');
  }
} catch (err) {
  console.error('[migration] schedule.json migration error:', err.message);
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 10500;

app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

// Admin static assets
app.use('/admin/assets', express.static(path.join(__dirname, 'admin', 'public')));

// ---------------------------------------------------------------------------
// Admin view helpers
// ---------------------------------------------------------------------------
const { adminLayout } = require('./admin/views/render');
const { requireAuth, ipFilter, getSecSettings } = require('./admin/middleware/auth');

// ---------------------------------------------------------------------------
// Force HTTPS — redirect HTTP → HTTPS if sec_force_https is '1'
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  if (getSecSettings().forceHttps && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// ---------------------------------------------------------------------------
// IP filter — honour sec_ip_whitelist / sec_ip_blacklist
// ---------------------------------------------------------------------------
app.use(ipFilter);

// ---------------------------------------------------------------------------
// Admin routes — auth (login / setup / logout) — no auth required
// ---------------------------------------------------------------------------
app.use('/', require('./admin/routes/auth'));

// ---------------------------------------------------------------------------
// First-run redirect: if no users exist, go to setup
// ---------------------------------------------------------------------------
app.get('/admin', (req, res, next) => {
  const hasUsers = get(`SELECT id FROM users LIMIT 1`);
  if (!hasUsers) return res.redirect('/admin/setup');
  next();
});

// ---------------------------------------------------------------------------
// Admin routes — dashboard
// ---------------------------------------------------------------------------
app.use('/', require('./admin/routes/dashboard'));

// ---------------------------------------------------------------------------
// Admin routes — notifications API
// ---------------------------------------------------------------------------
app.use('/api/admin/notifications', require('./admin/routes/notifications'));

// ---------------------------------------------------------------------------
// Admin routes — CMS pages
// ---------------------------------------------------------------------------
const cmsPagesRoutes = require('./admin/routes/cms-pages');
app.use('/admin/pages', cmsPagesRoutes);
app.use('/api/admin/pages', cmsPagesRoutes);

// ---------------------------------------------------------------------------
// Admin routes — CMS blog
// ---------------------------------------------------------------------------
const cmsBlogRoutes = require('./admin/routes/cms-blog');
app.use('/admin/blog', cmsBlogRoutes);
app.use('/api/admin/blog', cmsBlogRoutes);

// ---------------------------------------------------------------------------
// Admin routes — settings page + API
// ---------------------------------------------------------------------------
const settingsRouter = require('./admin/routes/settings');
// The settings router has GET /admin/settings (page) and PUT/POST/DELETE under /api
// Mount the page route at root, and the API routes under /admin/settings
app.use('/', settingsRouter);
app.use('/admin/settings', settingsRouter);

// ---------------------------------------------------------------------------
// Admin routes — CRM contacts
// ---------------------------------------------------------------------------
const crmContactsRoutes = require('./admin/routes/crm-contacts');
app.use('/admin/contacts', crmContactsRoutes);
app.use('/api/admin/contacts', crmContactsRoutes);

// ---------------------------------------------------------------------------
// Admin routes — CRM pipeline
// ---------------------------------------------------------------------------
const crmPipelineRoutes = require('./admin/routes/crm-pipeline');
app.use('/admin/pipeline', crmPipelineRoutes);
app.use('/api/admin/pipeline', crmPipelineRoutes);

// ---------------------------------------------------------------------------
// Admin routes — Booking calendar
// ---------------------------------------------------------------------------
const adminBookingRoutes = require('./admin/routes/admin-booking');
app.use('/admin/bookings', adminBookingRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);

// ---------------------------------------------------------------------------
// Admin routes — Visitor tracking
// ---------------------------------------------------------------------------
const adminVisitorsRoutes = require('./admin/routes/admin-visitors');
app.use('/admin/visitors', adminVisitorsRoutes);
app.use('/api/admin/visitors', adminVisitorsRoutes);

// Admin routes — Knowledge Base
const adminKbRoutes = require('./admin/routes/admin-kb');
app.use('/admin/kb', adminKbRoutes);

// Public routes — unauthenticated contact form submission
app.use('/api/admin', require('./admin/routes/crm-contacts-public'));

// Public routes — hero AI chat
app.use('/api/public', require('./routes/public-chat'));

// ---------------------------------------------------------------------------
// Admin routes — AI Agents
// ---------------------------------------------------------------------------
const adminAgentsRoutes = require('./admin/routes/admin-agents');
app.use('/admin/agents', adminAgentsRoutes);
app.use('/api/admin/agents', adminAgentsRoutes);

// ---------------------------------------------------------------------------
// Admin — Notifications page
// ---------------------------------------------------------------------------
app.use('/admin/notifications', require('./admin/routes/admin-notifications'));

// ---------------------------------------------------------------------------
// Placeholder admin pages
// ---------------------------------------------------------------------------
const placeholderPages = [
];

for (const pg of placeholderPages) {
  app.get(pg.path, requireAuth, (req, res) => {
    const unreadCount = (get(`SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0`) || {}).c || 0;
    const html = adminLayout({
      title: pg.title,
      page: pg.page,
      user: req.user,
      csrfToken: req.csrfToken,
      unreadCount,
      content: `
        <div class="card">
          <h3>${pg.title}</h3>
          <p style="margin-top:1rem;color:var(--muted)">Module coming soon.</p>
        </div>
      `
    });
    res.send(html);
  });
}

// ---------------------------------------------------------------------------
// In-process rate limiter for booking (5 per minute per IP)
// ---------------------------------------------------------------------------
const _bookHits = new Map();
function bookingLimiter(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const now = Date.now();
  const windowMs = 60_000;
  const maxPerWindow = 5;
  const arr = (_bookHits.get(ip) || []).filter(t => now - t < windowMs);
  if (arr.length >= maxPerWindow) return res.status(429).json({ error: 'Too many bookings. Try again shortly.' });
  arr.push(now);
  _bookHits.set(ip, arr);
  next();
}

// ---------------------------------------------------------------------------
// Public booking API — SQLite-based
// ---------------------------------------------------------------------------

// GET /api/schedule/availability
app.get('/api/schedule/availability', (req, res) => {
  try {
    const bookedSlots = all(
      `SELECT date, time FROM bookings WHERE status != 'cancelled'`
    ).map(b => ({ date: b.date, time: b.time }));

    // Read scheduling settings from settings table
    const getSetting = (key, fallback) => {
      const row = get(`SELECT value FROM settings WHERE key = ?`, [key]);
      return (row && row.value) || fallback || '';
    };

    const startStr = getSetting('booking_start', '09:00');
    const endStr   = getSetting('booking_end',   '17:00');
    const settings = {
      timezone:     getSetting('timezone', 'America/Los_Angeles'),
      workingDays:  getSetting('booking_days', '1,2,3,4,5').split(',').map(Number),
      startHour:    parseInt(startStr.split(':')[0], 10) || 9,
      endHour:      parseInt(endStr.split(':')[0], 10)   || 17,
      slotMinutes:  parseInt(getSetting('booking_duration', '30'), 10) || 30,
      maxPerSlot:   parseInt(getSetting('booking_max_per_slot', '1'), 10) || 1,
      advanceDays:  60,
      blockedDates: []
    };

    res.json({ settings, bookedSlots });
  } catch (err) {
    console.error('GET /api/schedule/availability error:', err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// POST /api/schedule/book
app.post('/api/schedule/book', bookingLimiter, (req, res) => {
  try {
    const { date, time, name, email, notes, clientTimezone, clientDate, clientTime } = req.body || {};
    if (!date || !time || !name || !email) {
      return res.status(400).json({ error: 'date, time, name and email are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check slot availability
    const getSetting = (key, fallback) => {
      const row = get(`SELECT value FROM settings WHERE key = ?`, [key]);
      return (row && row.value) || fallback || '';
    };
    const maxPerSlot = parseInt(getSetting('booking_max_per_slot', '1'), 10) || 1;
    const taken = (get(
      `SELECT COUNT(*) AS c FROM bookings WHERE date = ? AND time = ? AND status != 'cancelled'`,
      [date, time]
    ) || {}).c || 0;
    if (taken >= maxPerSlot) {
      return res.status(409).json({ error: 'This time slot is no longer available' });
    }

    // Insert booking
    const result = insert('bookings', {
      date: String(date).slice(0, 10),
      time: String(time).slice(0, 5),
      name: String(name).slice(0, 100),
      email: String(email).slice(0, 200),
      notes: String(notes || '').slice(0, 500),
      client_timezone: String(clientTimezone || '').slice(0, 60),
      client_date: String(clientDate || '').slice(0, 10),
      client_time: String(clientTime || '').slice(0, 30),
      status: 'pending'
    });

    // Create notification
    const bookingTitle = 'New Booking';
    const bookingMessage = `${String(name).slice(0, 100)} <${String(email).slice(0, 200)}> booked ${date} ${time}`;
    insert('notifications', {
      type: 'booking',
      title: bookingTitle,
      message: bookingMessage,
      is_read: 0
    });
    dispatchNotification(bookingTitle, bookingMessage, 'booking');

    // Auto-create contact if email not found
    const existingContact = get(`SELECT id FROM contacts WHERE email = ?`, [String(email).slice(0, 200)]);
    if (!existingContact) {
      insert('contacts', {
        name: String(name).slice(0, 100),
        email: String(email).slice(0, 200),
        source: 'booking'
      });
      const contactTitle = 'New Contact';
      const contactMessage = `${String(name).slice(0, 100)} <${String(email).slice(0, 200)}> auto-created from booking`;
      insert('notifications', {
        type: 'contact',
        title: contactTitle,
        message: contactMessage,
        is_read: 0
      });
      dispatchNotification(contactTitle, contactMessage, 'contact');
    }

    console.log(`[book] ${name} <${email}> booked ${date} ${time}`);
    res.json({ ok: true, booking: { id: result.lastInsertRowid, date: String(date).slice(0, 10), time: String(time).slice(0, 5) } });
  } catch (err) {
    console.error('POST /api/schedule/book error:', err);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// ---------------------------------------------------------------------------
// Public tracking APIs (before static middleware, no auth)
// ---------------------------------------------------------------------------
app.post('/api/track', adminVisitorsRoutes.trackLimiter, adminVisitorsRoutes.handleTrack);
app.post('/api/track/duration', adminVisitorsRoutes.durationBodyParser, adminVisitorsRoutes.handleTrackDuration);

// ---------------------------------------------------------------------------
// Public site routes
// ---------------------------------------------------------------------------

// Explicit route for /blog (directory conflicts with blog.html)
app.get('/blog', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blog.html'));
});

// Silence Chrome DevTools workspace probe (returns 404 noise otherwise)
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.json({});
});

// Serve static files, auto-resolving .html extensions
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  redirect: false,
}));

// Fallback to index.html for any unmatched route
// Paths that browsers / extensions / DevTools probe for and we don't care about.
// Returning silently keeps the notifications inbox clean.
const NOISE_404_PATTERNS = [
  /^\/\.well-known\//i,
  /^\/(robots\.txt|sitemap.*\.xml|favicon\.ico|apple-touch-icon.*\.png|manifest\.json|sw\.js|service-worker\.js)$/i,
  /^\/__/i,                      // various dev-tooling probes
  /\/wp-(admin|login|content)/i, // wordpress scanner noise
  /\.(php|asp|aspx|jsp)$/i,      // exploit scanners
];

app.get('/{*path}', (req, res) => {
  const p = req.path || '';
  const isAsset = /\.(html|js|css|png|jpg|jpeg|gif|svg|webp|mp4|pdf|json|xml|txt|ico)$/i.test(p);
  const isNoise = NOISE_404_PATTERNS.some((re) => re.test(p));

  if (isAsset && !isNoise) {
    try {
      const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
      const ref = String(req.headers.referer || '').slice(0, 500);
      const title = '404 broken link';
      const message = `Missing asset: ${p}${ref ? ` (referrer: ${ref})` : ''} — IP ${ip}.`;
      insert('notifications', { type: 'error_404', title, message, is_read: 0 });
      dispatchNotification(title, message, 'error_404');
    } catch {}
    return res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  if (isNoise) {
    return res.status(404).end();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Backup auto-scheduler — checks every hour, respects backup_frequency setting
// ---------------------------------------------------------------------------
let _lastBackupTs = 0;

function _shouldRunBackup(frequency) {
  const now = Date.now();
  const elapsed = now - _lastBackupTs;
  const HOUR = 3600 * 1000;
  const thresholds = { hourly: HOUR, daily: 24 * HOUR, weekly: 7 * 24 * HOUR, monthly: 30 * 24 * HOUR };
  return elapsed >= (thresholds[frequency] || 24 * HOUR);
}

setInterval(() => {
  try {
    const enabled = (get('SELECT value FROM settings WHERE key = ?', ['backup_auto_enabled']) || {}).value;
    if (enabled !== '1') return;

    const frequency   = (get('SELECT value FROM settings WHERE key = ?', ['backup_frequency'])   || {}).value || 'daily';
    const retainDays  = parseInt((get('SELECT value FROM settings WHERE key = ?', ['backup_retain_days']) || {}).value || '7', 10);
    const backupPath  = (get('SELECT value FROM settings WHERE key = ?', ['backup_path']) || {}).value || path.join(__dirname, 'backups');

    if (!_shouldRunBackup(frequency)) return;

    // Ensure backup directory exists
    if (!fs.existsSync(backupPath)) fs.mkdirSync(backupPath, { recursive: true });

    // Copy DB file
    const src  = path.join(__dirname, 'data', 'aimtechai.db');
    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(backupPath, `aimtechai-backup-${ts}.db`);
    fs.copyFileSync(src, dest);
    _lastBackupTs = Date.now();
    console.log(`[backup] Created: ${dest}`);

    // Clean up backups older than retain_days
    const cutoff = Date.now() - retainDays * 24 * 3600 * 1000;
    for (const f of fs.readdirSync(backupPath)) {
      if (!/^aimtechai-backup-.*\.db$/.test(f)) continue;
      const fp = path.join(backupPath, f);
      if (fs.statSync(fp).mtimeMs < cutoff) {
        fs.unlinkSync(fp);
        console.log(`[backup] Removed old backup: ${f}`);
      }
    }
  } catch (err) {
    console.error('[backup] Error:', err.message);
  }
}, 3600 * 1000);

app.listen(PORT, () => {
  console.log(`AIM Tech AI server running at http://localhost:${PORT}`);
  try {
    const title = 'Server started';
    const message = `AIM Tech AI server is up at http://localhost:${PORT} (pid ${process.pid}, node ${process.version}).`;
    insert('notifications', { type: 'server_started', title, message, is_read: 0 });
    dispatchNotification(title, message, 'server_started');
  } catch {}
});
