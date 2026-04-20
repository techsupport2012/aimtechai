const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const { get, all, run, insert } = require('../../db/db');
const { requireAuth } = require('../middleware/auth');
const { adminLayout } = require('../views/render');

// ---------------------------------------------------------------------------
// IP hashing — salt regenerated each server start (no persistent tracking)
// ---------------------------------------------------------------------------
const SALT = crypto.randomBytes(16).toString('hex');
function hashIP(ip) {
  return crypto.createHash('sha256').update(SALT + ip).digest('hex');
}

// ---------------------------------------------------------------------------
// GeoIP lookup (optional — gracefully degrades)
// ---------------------------------------------------------------------------
let geoip;
try { geoip = require('geoip-lite'); } catch { geoip = null; }

// ---------------------------------------------------------------------------
// In-process rate limiter for tracking (30 req/min per IP)
// ---------------------------------------------------------------------------
const trackHits = new Map();
function trackLimiter(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const now = Date.now();
  const arr = (trackHits.get(ip) || []).filter(t => now - t < 60000);
  if (arr.length >= 30) return res.status(429).end();
  arr.push(now);
  trackHits.set(ip, arr);
  next();
}

// ---------------------------------------------------------------------------
// Helper: HTML-escape
// ---------------------------------------------------------------------------
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Helper: time ago string
// ---------------------------------------------------------------------------
function timeAgo(dateStr) {
  const now = new Date();
  const then = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  return days + 'd ago';
}

// =========================================================================
// PUBLIC TRACKING HANDLERS (no auth) — exported for direct mounting
// =========================================================================

// ---------------------------------------------------------------------------
// Helper: parse user-agent into device, browser, OS
// ---------------------------------------------------------------------------
function parseUA(ua) {
  let device = 'Desktop';
  if (/iPad|Tablet/i.test(ua)) device = 'Tablet';
  else if (/Android.*Mobile|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) device = 'Phone';
  else if (/Android/i.test(ua)) device = 'Tablet';
  else if (/Smart-?TV|SmartTV|AppleTV|GoogleTV|BRAVIA|Roku|CrKey|FireTV/i.test(ua)) device = 'Smart TV';
  else if (/Bot|Crawl|Spider|Slurp|Lighthouse/i.test(ua)) device = 'Bot';

  let browser = 'Other';
  if (/OPR|Opera/i.test(ua)) browser = 'Opera';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua) && !/Edg|OPR/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/MSIE|Trident/i.test(ua)) browser = 'IE';

  let os = 'Other';
  if (/Windows NT 10/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';

  return { device, browser, os };
}

function handleTrack(req, res) {
  try {
    const rawIP = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    const ip_hash = hashIP(rawIP);
    const ua = String(req.headers['user-agent'] || '').slice(0, 512);
    const pathVal = String(req.body.path || '/').slice(0, 512);
    const referrer = String(req.body.referrer || '').slice(0, 1024);
    const { device, browser, os } = parseUA(ua);

    // GeoIP lookup
    let country = '';
    let city = '';
    if (geoip) {
      const geo = geoip.lookup(rawIP);
      if (geo) {
        country = geo.country || '';
        city = geo.city || '';
      }
    }

    // Check if visitor with same ip_hash exists in last 30 min → reuse
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    let visitor = get(
      `SELECT id FROM visitors WHERE ip_hash = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 1`,
      [ip_hash, thirtyMinAgo]
    );

    if (!visitor) {
      const result = insert('visitors', {
        ip_hash,
        ip_address: rawIP,
        user_agent: ua,
        device,
        browser,
        os,
        country,
        city,
        referrer,
        landing_page: pathVal
      });
      visitor = { id: result.lastInsertRowid };

      // Notification: distinguish first-ever vs returning visitor
      try {
        const priorCount = (get(
          'SELECT COUNT(*) AS c FROM visitors WHERE ip_hash = ? AND id != ?',
          [ip_hash, visitor.id]
        ) || {}).c || 0;
        const isReturn = priorCount > 0;
        const where = [city, country].filter(Boolean).join(', ') || 'unknown location';
        const title = isReturn ? 'Returning visitor' : 'New visitor';
        const message = `${isReturn ? 'Returning' : 'First-time'} visitor from ${where} landed on ${pathVal} (${browser || 'browser'} on ${os || 'unknown OS'}).`;
        const triggerType = isReturn ? 'visitor_return' : 'visitor_new';
        insert('notifications', { type: triggerType, title, message, is_read: 0 });
        const { dispatchNotification } = require('../services/notify');
        dispatchNotification(title, message, triggerType);
      } catch (notifyErr) {
        console.error('[track] notification failed:', notifyErr.message);
      }
    }

    // Insert page_view
    insert('page_views', {
      visitor_id: visitor.id,
      path: pathVal,
      duration_ms: 0
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[track] error:', err.message);
    res.status(500).json({ error: 'tracking failed' });
  }
}

const durationBodyParser = express.text({ type: '*/*', limit: '4kb' });

function handleTrackDuration(req, res) {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }
    const rawIP = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    const ip_hash = hashIP(rawIP);
    const pathVal = String(body.path || '/').slice(0, 512);
    const durationMs = Math.max(0, Math.min(Number(body.duration_ms) || 0, 3600000)); // cap 1hr

    // Find visitor
    const visitor = get(
      `SELECT id FROM visitors WHERE ip_hash = ? ORDER BY created_at DESC LIMIT 1`,
      [ip_hash]
    );
    if (!visitor) return res.status(204).end();

    // Update most recent page_view for this visitor+path
    run(
      `UPDATE page_views SET duration_ms = ? WHERE id = (
        SELECT id FROM page_views WHERE visitor_id = ? AND path = ? ORDER BY created_at DESC LIMIT 1
      )`,
      [durationMs, visitor.id, pathVal]
    );

    res.status(204).end();
  } catch (err) {
    console.error('[track/duration] error:', err.message);
    res.status(500).end();
  }
}

// Export tracking handlers for direct mounting in server.js
router.trackLimiter = trackLimiter;
router.handleTrack = handleTrack;
router.durationBodyParser = durationBodyParser;
router.handleTrackDuration = handleTrackDuration;

// =========================================================================
// ADMIN PAGE (requireAuth)
// =========================================================================

// GET / — Visitors dashboard (server-side rendered)
router.get('/', requireAuth, (req, res) => {
  const unreadCount = (get(`SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0`) || {}).c || 0;

  // --- Stats ---
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const live = (get(`SELECT COUNT(DISTINCT id) AS c FROM visitors WHERE created_at >= ?`, [fiveMinAgo]) || {}).c || 0;
  const todayStart = new Date().toISOString().slice(0, 10) + ' 00:00:00';
  const today = (get(`SELECT COUNT(*) AS c FROM visitors WHERE created_at >= ?`, [todayStart]) || {}).c || 0;
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const week = (get(`SELECT COUNT(*) AS c FROM visitors WHERE created_at >= ?`, [weekAgo]) || {}).c || 0;
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const month = (get(`SELECT COUNT(*) AS c FROM visitors WHERE created_at >= ?`, [monthAgo]) || {}).c || 0;
  const totalAll = (get(`SELECT COUNT(*) AS c FROM visitors`) || {}).c || 0;
  const totalPageViews = (get(`SELECT COUNT(*) AS c FROM page_views`) || {}).c || 0;
  const avgPagesPerVisit = totalAll > 0 ? (totalPageViews / totalAll).toFixed(1) : '0';

  // --- Top pages ---
  const topPages = all(`
    SELECT pv.path, SUM(CASE WHEN pv.created_at >= ? THEN 1 ELSE 0 END) AS views_today, COUNT(*) AS views_total
    FROM page_views pv GROUP BY pv.path ORDER BY views_total DESC LIMIT 15
  `, [todayStart]);

  // --- Top referrers ---
  const topReferrers = all(`
    SELECT v.referrer, SUM(CASE WHEN v.created_at >= ? THEN 1 ELSE 0 END) AS visits_today, COUNT(*) AS visits_total
    FROM visitors v WHERE v.referrer IS NOT NULL AND v.referrer != ''
    GROUP BY v.referrer ORDER BY visits_total DESC LIMIT 10
  `, [todayStart]).map(r => {
    let domain = r.referrer;
    try { domain = new URL(r.referrer).hostname; } catch {}
    return { domain, visits_today: r.visits_today, visits_total: r.visits_total };
  });

  // --- Top countries ---
  const topCountries = all(`
    SELECT country, COUNT(*) AS cnt FROM visitors WHERE country != '' AND country IS NOT NULL
    GROUP BY country ORDER BY cnt DESC LIMIT 10
  `);

  // --- Browser/Device/OS breakdown (use stored columns, fallback to UA parsing) ---
  const recentUAs = all(`SELECT browser, device, os, user_agent FROM visitors ORDER BY created_at DESC LIMIT 500`);
  const browsers = {};
  const devices = {};
  const oses = {};
  recentUAs.forEach(r => {
    let b = r.browser, d = r.device, o = r.os;
    if (!b || !d) {
      const parsed = parseUA(r.user_agent || '');
      b = b || parsed.browser;
      d = d || parsed.device;
      o = o || parsed.os;
    }
    browsers[b] = (browsers[b] || 0) + 1;
    devices[d] = (devices[d] || 0) + 1;
    if (o) oses[o] = (oses[o] || 0) + 1;
  });

  // --- Recent visitors with search ---
  const q = (req.query.q || '').trim();
  let recentWhere = '';
  let recentParams = [];
  if (q) {
    const like = '%' + q + '%';
    recentWhere = "WHERE (v.country LIKE ? OR v.city LIKE ? OR v.landing_page LIKE ? OR v.referrer LIKE ? OR v.ip_hash LIKE ? OR v.ip_address LIKE ? OR v.device LIKE ? OR v.browser LIKE ? OR v.os LIKE ?)";
    recentParams = [like, like, like, like, like, like, like, like, like];
  }
  const recentVisitors = all(`
    SELECT v.ip_hash, v.ip_address, v.country, v.city, v.landing_page, v.referrer, v.user_agent,
      v.device, v.browser, v.os, v.created_at,
      (SELECT COUNT(*) FROM page_views pv WHERE pv.visitor_id = v.id) AS page_count,
      (SELECT COALESCE(SUM(pv.duration_ms), 0) FROM page_views pv WHERE pv.visitor_id = v.id) AS total_duration
    FROM visitors v ${recentWhere}
    ORDER BY v.created_at DESC LIMIT 50
  `, recentParams);

  // --- Render helpers ---
  const _td = 'padding:.5rem .7rem;border-bottom:1px solid var(--border,#333);border-right:1px solid var(--border,#333);font-size:.84rem;';
  const _tdLast = 'padding:.5rem .7rem;border-bottom:1px solid var(--border,#333);font-size:.84rem;';
  const _th = 'padding:.5rem .7rem;font-size:.75rem;font-weight:500;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--border,#333);border-right:1px solid var(--border,#333);text-align:left;background:var(--surface,rgba(255,255,255,.03));';
  const _thLast = _th.replace('border-right:1px solid var(--border,#333);', '');

  const si = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

  const statCards = [
    { label: 'Live Now', value: live, color: '#22c55e', icon: si('<circle cx="12" cy="12" r="3" fill="#22c55e"/><circle cx="12" cy="12" r="8" stroke-dasharray="4 4"/>') },
    { label: 'Today', value: today, color: '#0FC1B7', icon: si('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>') },
    { label: 'This Week', value: week, color: '#60a5fa', icon: si('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>') },
    { label: 'This Month', value: month, color: '#a78bfa', icon: si('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>') },
    { label: 'All Time', value: totalAll, color: '#f472b6', icon: si('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>') },
    { label: 'Avg Pages/Visit', value: avgPagesPerVisit, color: '#fbbf24', icon: si('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>') },
  ].map(s => `
    <div class="stat-card" style="border-left:3px solid ${s.color};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div><div class="stat-label">${s.label}</div><div class="stat-value" style="color:${s.color}">${s.value}</div></div>
        <span style="opacity:.4;">${s.icon}</span>
      </div>
    </div>
  `).join('');

  // Top pages table
  const pagesRows = topPages.length ? topPages.map((p, i) => `
    <tr><td style="${_td}width:2rem;text-align:center;color:var(--muted);">${i + 1}</td><td style="${_td}">${esc(p.path)}</td><td style="${_td}text-align:right;">${p.views_today}</td><td style="${_tdLast}text-align:right;font-weight:600;">${p.views_total}</td></tr>
  `).join('') : '<tr><td colspan="4" style="' + _tdLast + 'color:var(--muted);text-align:center;padding:1.5rem;">No page views yet</td></tr>';

  // Top referrers table
  const refRows = topReferrers.length ? topReferrers.map((r, i) => `
    <tr><td style="${_td}width:2rem;text-align:center;color:var(--muted);">${i + 1}</td><td style="${_td}">${esc(r.domain)}</td><td style="${_td}text-align:right;">${r.visits_today}</td><td style="${_tdLast}text-align:right;font-weight:600;">${r.visits_total}</td></tr>
  `).join('') : '<tr><td colspan="4" style="' + _tdLast + 'color:var(--muted);text-align:center;padding:1.5rem;">No referrer data yet</td></tr>';

  // Country bars
  const maxCountry = topCountries.length ? topCountries[0].cnt : 1;
  const countryRows = topCountries.map(c => `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;">
      <span style="min-width:30px;font-size:.82rem;font-weight:600;">${esc(c.country)}</span>
      <div style="flex:1;height:8px;background:var(--border,#333);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(c.cnt / maxCountry * 100)}%;background:linear-gradient(90deg,#0FC1B7,#60a5fa);border-radius:4px;"></div>
      </div>
      <span style="min-width:2.5rem;text-align:right;font-size:.82rem;font-weight:500;">${c.cnt}</span>
    </div>
  `).join('') || '<p style="color:var(--muted);font-size:.85rem;">No geo data</p>';

  // Browser/device breakdown
  const browserTotal = Object.values(browsers).reduce((a, b) => a + b, 0) || 1;
  const browserBars = Object.entries(browsers).sort((a, b) => b[1] - a[1]).map(([name, cnt]) => `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.25rem 0;">
      <span style="min-width:60px;font-size:.82rem;">${esc(name)}</span>
      <div style="flex:1;height:6px;background:var(--border,#333);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(cnt / browserTotal * 100)}%;background:#0FC1B7;border-radius:3px;"></div>
      </div>
      <span style="font-size:.78rem;color:var(--muted);min-width:3rem;text-align:right;">${Math.round(cnt / browserTotal * 100)}%</span>
    </div>
  `).join('');

  const deviceTotal = Object.values(devices).reduce((a, b) => a + b, 0) || 1;
  const deviceBars = Object.entries(devices).sort((a, b) => b[1] - a[1]).map(([name, cnt]) => `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.25rem 0;">
      <span style="min-width:60px;font-size:.82rem;">${esc(name)}</span>
      <div style="flex:1;height:6px;background:var(--border,#333);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(cnt / deviceTotal * 100)}%;background:#a78bfa;border-radius:3px;"></div>
      </div>
      <span style="font-size:.78rem;color:var(--muted);min-width:3rem;text-align:right;">${Math.round(cnt / deviceTotal * 100)}%</span>
    </div>
  `).join('');

  const osTotal = Object.values(oses).reduce((a, b) => a + b, 0) || 1;
  const osBars = Object.entries(oses).sort((a, b) => b[1] - a[1]).map(([name, cnt]) => `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.25rem 0;">
      <span style="min-width:70px;font-size:.82rem;">${esc(name)}</span>
      <div style="flex:1;height:6px;background:var(--border,#333);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(cnt / osTotal * 100)}%;background:#f472b6;border-radius:3px;"></div>
      </div>
      <span style="font-size:.78rem;color:var(--muted);min-width:3rem;text-align:right;">${Math.round(cnt / osTotal * 100)}%</span>
    </div>
  `).join('');

  // Duration helper
  function fmtDuration(ms) {
    if (!ms || ms < 1000) return '<1s';
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  }

  // Recent visitors table
  const recentRows = recentVisitors.length ? recentVisitors.map(r => {
    const b = r.browser || 'Other';
    const d = r.device || 'Desktop';
    const o = r.os || '';
    const ip = r.ip_address || esc((r.ip_hash || '').slice(0, 8));
    const deviceIcon = d === 'Phone' ? '&#128241;' : d === 'Tablet' ? '&#128221;' : d === 'Bot' ? '&#129302;' : d === 'Smart TV' ? '&#128250;' : '&#128187;';
    return `<tr>
      <td style="${_td}font-family:monospace;font-size:.78rem;">${esc(ip)}</td>
      <td style="${_td}">${esc(r.country || '--')}</td>
      <td style="${_td}">${esc(r.city || '--')}</td>
      <td style="${_td}text-align:center;">${deviceIcon} <span style="font-size:.78rem;">${esc(d)}</span></td>
      <td style="${_td}font-size:.82rem;">${esc(b)}${o ? '<br><span style="font-size:.72rem;color:var(--muted);">' + esc(o) + '</span>' : ''}</td>
      <td style="${_td}">${esc(r.landing_page || '/')}</td>
      <td style="${_td}text-align:center;">${r.page_count}</td>
      <td style="${_td}">${esc(r.referrer || '(direct)')}</td>
      <td style="${_td}text-align:right;">${fmtDuration(r.total_duration)}</td>
      <td style="${_tdLast}white-space:nowrap;">${timeAgo(r.created_at)}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="10" style="' + _tdLast + 'color:var(--muted);text-align:center;padding:2rem;">No visitors' + (q ? ' matching "' + esc(q) + '"' : ' yet') + '</td></tr>';

  const content = `
    <style>
      .vis-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem; }
      .vis-grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; margin-bottom:1rem; }
      .card-title { font-size:.9rem; font-weight:700; margin-bottom:.6rem; }
      .vis-search { display:flex; gap:.5rem; margin-bottom:1rem; align-items:center; }
      .vis-search input { flex:1; padding:.45rem .7rem; background:var(--surface,rgba(255,255,255,.06)); border:1px solid var(--border,#333); border-radius:6px; color:var(--text,#fff); font-size:.85rem; }
      .vis-search input:focus { outline:none; border-color:var(--accent,#14b8a6); }
      .vis-search button { padding:.45rem .8rem; background:var(--accent,#14b8a6); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:.82rem; }
      .vis-search a { font-size:.82rem; color:var(--muted); }
      @media(max-width:900px) { .vis-grid,.vis-grid-3 { grid-template-columns:1fr; } }
    </style>

    <div class="stat-cards" style="grid-template-columns:repeat(6,1fr);gap:.8rem;margin-bottom:1.2rem;">${statCards}</div>

    <div class="vis-grid">
      <div class="card" style="padding:0;">
        <div style="padding:.7rem 1rem;border-bottom:1px solid var(--border,#333);"><span class="card-title" style="margin:0;">Top Pages</span></div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr><th style="${_th}width:2rem;">#</th><th style="${_th}">Path</th><th style="${_th}text-align:right;">Today</th><th style="${_thLast}text-align:right;">Total</th></tr></thead>
          <tbody>${pagesRows}</tbody>
        </table>
      </div>
      <div class="card" style="padding:0;">
        <div style="padding:.7rem 1rem;border-bottom:1px solid var(--border,#333);"><span class="card-title" style="margin:0;">Top Referrers</span></div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr><th style="${_th}width:2rem;">#</th><th style="${_th}">Domain</th><th style="${_th}text-align:right;">Today</th><th style="${_thLast}text-align:right;">Total</th></tr></thead>
          <tbody>${refRows}</tbody>
        </table>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1rem;">
      <div class="card">
        <div class="card-title">Top Countries</div>
        ${countryRows}
      </div>
      <div class="card">
        <div class="card-title">Browsers</div>
        ${browserBars || '<p style="color:var(--muted);font-size:.85rem;">No data</p>'}
      </div>
      <div class="card">
        <div class="card-title">Devices</div>
        ${deviceBars || '<p style="color:var(--muted);font-size:.85rem;">No data</p>'}
      </div>
      <div class="card">
        <div class="card-title">Operating Systems</div>
        ${osBars || '<p style="color:var(--muted);font-size:.85rem;">No data</p>'}
      </div>
    </div>

    <div class="card" style="padding:0;">
      <div style="padding:.7rem 1rem;border-bottom:1px solid var(--border,#333);display:flex;justify-content:space-between;align-items:center;">
        <span class="card-title" style="margin:0;">Recent Visitors</span>
        <form class="vis-search" method="GET" action="/admin/visitors" style="margin:0;">
          <input type="text" name="q" value="${esc(q)}" placeholder="Search country, city, page, referrer..." />
          <button type="submit">Search</button>
          ${q ? '<a href="/admin/visitors">Clear</a>' : ''}
        </form>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="${_th}">IP Address</th>
          <th style="${_th}">Country</th>
          <th style="${_th}">City</th>
          <th style="${_th}text-align:center;">Device</th>
          <th style="${_th}">Browser / OS</th>
          <th style="${_th}">Landing Page</th>
          <th style="${_th}text-align:center;">Pages</th>
          <th style="${_th}">Referrer</th>
          <th style="${_th}text-align:right;">Duration</th>
          <th style="${_thLast}">When</th>
        </tr></thead>
        <tbody>${recentRows}</tbody>
      </table>
    </div>

    <div style="margin-top:.8rem;font-size:.72rem;color:var(--muted);">
      ${totalAll} total visitors &middot; ${totalPageViews} page views &middot; Auto-refreshes every 5s
    </div>

    <script>
    (function(){ setTimeout(function(){ location.reload(); }, 5000); })();
    </script>
  `;

  res.send(adminLayout({
    title: 'Visitors',
    page: 'visitors',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount,
    content
  }));
});

// =========================================================================
// ADMIN API (requireAuth)
// =========================================================================

// GET /api/overview — stat cards
router.get('/api/overview', requireAuth, (req, res) => {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const live = (get(`SELECT COUNT(DISTINCT id) AS c FROM visitors WHERE created_at >= ?`, [fiveMinAgo]) || {}).c || 0;

    const todayStart = new Date().toISOString().slice(0, 10) + ' 00:00:00';
    const today = (get(`SELECT COUNT(*) AS c FROM visitors WHERE created_at >= ?`, [todayStart]) || {}).c || 0;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const week = (get(`SELECT COUNT(*) AS c FROM visitors WHERE created_at >= ?`, [weekAgo]) || {}).c || 0;

    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const month = (get(`SELECT COUNT(*) AS c FROM visitors WHERE created_at >= ?`, [monthAgo]) || {}).c || 0;

    res.json({ live, today, week, month });
  } catch (err) {
    console.error('[visitors/overview] error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// GET /api/pages — top pages
router.get('/api/pages', requireAuth, (req, res) => {
  try {
    const todayStart = new Date().toISOString().slice(0, 10) + ' 00:00:00';
    const rows = all(`
      SELECT
        pv.path,
        SUM(CASE WHEN pv.created_at >= ? THEN 1 ELSE 0 END) AS views_today,
        COUNT(*) AS views_total
      FROM page_views pv
      GROUP BY pv.path
      ORDER BY views_total DESC
      LIMIT 20
    `, [todayStart]);
    res.json(rows);
  } catch (err) {
    console.error('[visitors/pages] error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// GET /api/referrers — top referrers
router.get('/api/referrers', requireAuth, (req, res) => {
  try {
    const todayStart = new Date().toISOString().slice(0, 10) + ' 00:00:00';
    const rows = all(`
      SELECT
        v.referrer,
        SUM(CASE WHEN v.created_at >= ? THEN 1 ELSE 0 END) AS visits_today,
        COUNT(*) AS visits_total
      FROM visitors v
      WHERE v.referrer IS NOT NULL AND v.referrer != ''
      GROUP BY v.referrer
      ORDER BY visits_total DESC
      LIMIT 20
    `, [todayStart]);

    // Extract domain from referrer URL
    const result = rows.map(r => {
      let domain = r.referrer;
      try { domain = new URL(r.referrer).hostname; } catch {}
      return { domain, visits_today: r.visits_today, visits_total: r.visits_total };
    });

    res.json(result);
  } catch (err) {
    console.error('[visitors/referrers] error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// GET /api/recent — recent 20 visitors
router.get('/api/recent', requireAuth, (req, res) => {
  try {
    const rows = all(`
      SELECT
        v.ip_hash,
        v.country,
        v.city,
        v.landing_page,
        v.referrer,
        v.created_at,
        (SELECT COUNT(*) FROM page_views pv WHERE pv.visitor_id = v.id) AS page_count
      FROM visitors v
      ORDER BY v.created_at DESC
      LIMIT 20
    `);

    const result = rows.map(r => ({
      hash_short: (r.ip_hash || '').slice(0, 8),
      country: r.country || '--',
      city: r.city || '--',
      landing_page: r.landing_page || '/',
      page_count: r.page_count || 0,
      referrer: r.referrer || '(direct)',
      time_ago: timeAgo(r.created_at)
    }));

    res.json(result);
  } catch (err) {
    console.error('[visitors/recent] error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

module.exports = router;
