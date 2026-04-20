const express = require('express');
const { get, all } = require('../../db/db');
const { requireAuth } = require('../middleware/auth');
const { adminLayout } = require('../views/render');

const router = express.Router();

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

const svgI = (d) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
function typeIcon(type) {
  const icons = {
    booking: svgI('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
    contact: svgI('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'),
    agent:   svgI('<circle cx="12" cy="12" r="3"/><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7"/>'),
    visitor: svgI('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
    system:  svgI('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"/>'),
  };
  return icons[type] || svgI('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>');
}

function timeAgo(d) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

router.get('/admin', requireAuth, async (req, res) => {
  // Core stats
  const contacts    = (await get("SELECT COUNT(*) AS c FROM contacts") || {}).c || 0;
  const posts       = (await get("SELECT COUNT(*) AS c FROM blog_posts WHERE status='published'") || {}).c || 0;
  const bookings    = (await get("SELECT COUNT(*) AS c FROM bookings WHERE date >= date('now') AND status != 'cancelled'") || {}).c || 0;
  const agents      = (await get("SELECT COUNT(*) AS c FROM agents WHERE is_active = 1") || {}).c || 0;
  const visitors    = (await get("SELECT COUNT(DISTINCT ip_hash) AS c FROM visitors WHERE created_at >= date('now')") || {}).c || 0;
  const unread      = (await get("SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0") || {}).c || 0;
  const recentNotifs = await all("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 8") || [];

  // Additional stats
  const pages       = (await get("SELECT COUNT(*) AS c FROM pages") || {}).c || 0;
  const totalDeals  = (await get("SELECT COUNT(*) AS c FROM deals") || {}).c || 0;
  const visitorsWeek = (await get("SELECT COUNT(DISTINCT ip_hash) AS c FROM visitors WHERE created_at >= date('now', '-7 days')") || {}).c || 0;
  const pendingBookings = await all("SELECT * FROM bookings WHERE status = 'pending' AND date >= date('now') ORDER BY date, time LIMIT 5") || [];
  const recentContacts = await all("SELECT * FROM contacts ORDER BY created_at DESC LIMIT 5") || [];
  const topPages = await all("SELECT path AS page_url, COUNT(*) AS views FROM page_views WHERE created_at >= date('now', '-7 days') GROUP BY path ORDER BY views DESC LIMIT 5") || [];
  const dealsByStage = await all("SELECT ps.name AS stage, COUNT(d.id) AS cnt, COALESCE(SUM(d.value), 0) AS total FROM pipeline_stages ps LEFT JOIN deals d ON d.stage_id = ps.id GROUP BY ps.id ORDER BY ps.position") || [];
  const agentRuns = (await get("SELECT COUNT(*) AS c FROM agent_runs WHERE started_at >= date('now')") || {}).c || 0;
  const contactsWeek = (await get("SELECT COUNT(*) AS c FROM contacts WHERE created_at >= date('now', '-7 days')") || {}).c || 0;

  const si = (d) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const stats = [
    { icon: si('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'), label: 'Contacts', value: contacts, sub: '+' + contactsWeek + ' this week', color: '#0FC1B7', href: '/admin/contacts' },
    { icon: si('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'), label: 'Bookings', value: bookings, sub: pendingBookings.length + ' pending', color: '#fbbf24', href: '/admin/bookings' },
    { icon: si('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'), label: 'Visitors Today', value: visitors, sub: visitorsWeek + ' this week', color: '#60a5fa', href: '/admin/visitors' },
    { icon: si('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'), label: 'Deals', value: totalDeals, sub: dealsByStage.filter(d=>d.cnt>0).length + ' stages active', color: '#f472b6', href: '/admin/pipeline' },
    { icon: si('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'), label: 'Blog Posts', value: posts, sub: pages + ' pages', color: '#34d399', href: '/admin/blog' },
    { icon: si('<circle cx="12" cy="12" r="3"/><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7"/>'), label: 'Agents', value: agents, sub: agentRuns + ' runs today', color: '#a78bfa', href: '/admin/agents' },
  ];

  const statCards = stats.map(s => `
    <a href="${s.href}" class="stat-card" style="text-decoration:none;color:inherit;border-left:3px solid ${s.color};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="stat-label">${s.label}</div>
          <div class="stat-value" style="color:${s.color}">${s.value}</div>
          ${s.sub ? '<div style="font-size:.7rem;color:var(--text-muted);margin-top:.15rem;">' + s.sub + '</div>' : ''}
        </div>
        <span style="font-size:1.6rem;opacity:0.4;">${s.icon}</span>
      </div>
    </a>
  `).join('');

  const activity = recentNotifs.length ? recentNotifs.map(n => `
    <a href="${esc(n.link || '#')}" style="display:flex;align-items:center;gap:0.8rem;padding:0.65rem 0;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;transition:opacity 0.15s;">
      <span style="font-size:1.2rem;width:2rem;height:2rem;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.04);border-radius:8px;flex-shrink:0;">${typeIcon(n.type)}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(n.title)}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:1px;">${esc(n.message || '')}</div>
      </div>
      <span style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap;flex-shrink:0;">${timeAgo(n.created_at)}</span>
    </a>
  `).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0;">No recent activity yet.</p>';

  const qi = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const quickActions = [
    { href: '/admin/blog/new', icon: qi('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'), label: 'New Post', primary: true },
    { href: '/admin/contacts', icon: qi('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'), label: 'Contacts' },
    { href: '/admin/agents', icon: qi('<circle cx="12" cy="12" r="3"/><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7"/>'), label: 'Agents' },
    { href: '/admin/bookings', icon: qi('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'), label: 'Bookings' },
    { href: '/admin/pipeline', icon: qi('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'), label: 'Pipeline' },
    { href: '/', icon: qi('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'), label: 'View Site', target: '_blank' },
  ];

  // Pending bookings rows
  const pendingRows = pendingBookings.length ? pendingBookings.map(b => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-size:.85rem;font-weight:600;">${esc(b.name)}</div>
        <div style="font-size:.72rem;color:var(--text-muted);">${esc(b.email)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:.82rem;font-weight:500;">${esc(b.date)}</div>
        <div style="font-size:.72rem;color:var(--text-muted);">${esc(b.time)}</div>
      </div>
    </div>
  `).join('') : '<p style="color:var(--text-muted);font-size:.82rem;padding:.5rem 0;">No pending bookings</p>';

  // Recent contacts rows
  const contactRows = recentContacts.length ? recentContacts.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.45rem 0;border-bottom:1px solid var(--border);">
      <div style="min-width:0;">
        <div style="font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.name)}</div>
        <div style="font-size:.72rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.email)}</div>
      </div>
      <span style="font-size:.68rem;color:var(--text-muted);white-space:nowrap;flex-shrink:0;margin-left:.5rem;">${c.source ? esc(c.source) : ''}</span>
    </div>
  `).join('') : '<p style="color:var(--text-muted);font-size:.82rem;padding:.5rem 0;">No contacts yet</p>';

  // Top pages rows
  const topPagesRows = topPages.length ? topPages.map((p, i) => `
    <div style="display:flex;align-items:center;gap:.6rem;padding:.4rem 0;border-bottom:1px solid var(--border);">
      <span style="font-size:.72rem;font-weight:700;color:var(--text-muted);width:1.2rem;">${i + 1}</span>
      <span style="flex:1;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.page_url)}</span>
      <span style="font-size:.82rem;font-weight:600;color:var(--teal);flex-shrink:0;">${p.views}</span>
    </div>
  `).join('') : '<p style="color:var(--text-muted);font-size:.82rem;padding:.5rem 0;">No page views yet</p>';

  // Pipeline mini chart
  const maxDealCount = Math.max(1, ...dealsByStage.map(d => d.cnt));
  const pipelineRows = dealsByStage.map(d => `
    <div style="display:flex;align-items:center;gap:.6rem;padding:.35rem 0;">
      <span style="font-size:.78rem;min-width:80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(d.stage)}</span>
      <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(d.cnt / maxDealCount * 100)}%;background:linear-gradient(90deg,#0FC1B7,#34d399);border-radius:3px;"></div>
      </div>
      <span style="font-size:.78rem;font-weight:600;min-width:2rem;text-align:right;">${d.cnt}</span>
    </div>
  `).join('');

  const content = `
    <style>
      .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.2rem; }
      .dash-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-top: 1rem; }
      .dash-greeting { font-size: 1.3rem; font-weight: 700; margin-bottom: 0.3rem; }
      .dash-sub { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1.5rem; }
      .quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
      .quick-btn { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: .8rem 0.5rem; background: var(--bg-input); border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: var(--text); font-size: 0.76rem; font-weight: 500; transition: all 0.15s; }
      .quick-btn:hover { border-color: var(--teal); background: var(--teal-dim); text-decoration: none; }
      .quick-btn .q-icon { font-size: 1.4rem; }
      .quick-btn.primary { background: var(--teal-dim); border-color: rgba(15,193,183,0.3); }
      .card-title { font-size:.9rem; font-weight:700; margin-bottom:.6rem; display:flex; justify-content:space-between; align-items:center; }
      .card-title a { font-size:.7rem; color:var(--teal); text-decoration:none; }
      .card-title a:hover { text-decoration:underline; }
      .stat-cards { display:grid; grid-template-columns: repeat(6, 1fr); gap:.8rem; }
      @media (max-width: 1100px) { .stat-cards { grid-template-columns: repeat(3, 1fr); } .dash-grid-3 { grid-template-columns: 1fr; } }
      @media (max-width: 900px) { .dash-grid { grid-template-columns: 1fr; } .stat-cards { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 600px) { .quick-grid { grid-template-columns: repeat(2, 1fr); } .stat-cards { grid-template-columns: 1fr; } }
    </style>

    <div class="dash-greeting">Welcome back, ${esc(req.user.username)}</div>
    <div class="dash-sub">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>

    <div class="stat-cards">${statCards}</div>

    <div class="dash-grid">
      <div class="card">
        <div class="card-title">Recent Activity <a href="/admin/notifications">View all</a></div>
        ${activity}
      </div>
      <div class="card">
        <div class="card-title">Pending Bookings <a href="/admin/bookings">Manage</a></div>
        ${pendingRows}
      </div>
    </div>

    <div class="dash-grid-3">
      <div class="card">
        <div class="card-title">Pipeline Overview <a href="/admin/pipeline">Open</a></div>
        ${pipelineRows}
      </div>
      <div class="card">
        <div class="card-title">Top Pages (7d) <a href="/admin/visitors">Analytics</a></div>
        ${topPagesRows}
      </div>
      <div class="card">
        <div class="card-title">Recent Contacts <a href="/admin/contacts">View all</a></div>
        ${contactRows}
      </div>
    </div>

    <div class="dash-grid">
      <div class="card">
        <div class="card-title">Quick Actions</div>
        <div class="quick-grid">
          ${quickActions.map(a => `
            <a href="${a.href}" class="quick-btn${a.primary ? ' primary' : ''}"${a.target ? ` target="${a.target}"` : ''}>
              <span class="q-icon">${a.icon}</span>
              ${a.label}
            </a>
          `).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">System</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
          <div style="padding:.5rem .7rem;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">Unread</div>
            <div style="font-size:1.1rem;font-weight:700;color:${unread > 0 ? '#fbbf24' : '#22c55e'};">${unread}</div>
          </div>
          <div style="padding:.5rem .7rem;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">Agent Runs Today</div>
            <div style="font-size:1.1rem;font-weight:700;">${agentRuns}</div>
          </div>
          <div style="padding:.5rem .7rem;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">Blog Posts</div>
            <div style="font-size:1.1rem;font-weight:700;">${posts}</div>
          </div>
          <div style="padding:.5rem .7rem;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">Total Pages</div>
            <div style="font-size:1.1rem;font-weight:700;">${pages}</div>
          </div>
        </div>
      </div>
    </div>
  `;

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
