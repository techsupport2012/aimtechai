const express = require('express');
const { get, all, run } = require('../../db/db');
const { requireAuth, validateCsrf } = require('../middleware/auth');
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
    system:  svgI('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06"/>'),
  };
  return icons[type] || svgI('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>');
}

function typeBadge(type) {
  const colors = { booking: 'yellow', contact: 'teal', agent: 'green', visitor: 'gray', system: 'red' };
  return `<span class="badge-sm badge-${colors[type] || 'gray'}">${esc(type)}</span>`;
}

function timeAgo(d) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const days = Math.floor(h / 24);
  if (days < 30) return days + 'd ago';
  return Math.floor(days / 30) + 'mo ago';
}

// GET /admin/notifications — full notifications page with channel settings
router.get('/', requireAuth, (req, res) => {
  const filterType = req.query.type || 'all';
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const perPage = 20;
  const offset = (page - 1) * perPage;

  let where = '';
  const params = [];
  if (filterType !== 'all') {
    where = 'WHERE type = ?';
    params.push(filterType);
  }

  const total = (get(`SELECT COUNT(*) AS c FROM notifications ${where}`, params) || {}).c || 0;
  const notifications = all(
    `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, perPage, offset]
  );
  const unread = (get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;
  const totalPages = Math.ceil(total / perPage) || 1;

  // Channel settings
  const gs = (k, fb) => { const r = get('SELECT value FROM settings WHERE key = ?', [k]); return (r && r.value) || fb || ''; };
  const tgEnabled = gs('notif_telegram_enabled', '0');
  const tgBotToken = gs('notif_telegram_bot_token', '');
  const tgChatId = gs('notif_telegram_chat_id', '');
  const dcEnabled = gs('notif_discord_enabled', '0');
  const dcWebhook = gs('notif_discord_webhook_url', '');
  const waEnabled = gs('notif_whatsapp_enabled', '0');
  const waPhone = gs('notif_whatsapp_phone', '');
  const waApiKey = gs('notif_whatsapp_api_key', '');
  const emEnabled = gs('notif_email_enabled', '0');
  const emTo = gs('notif_email_to', '');
  const emFrom = gs('notif_email_from', '');
  const smsEnabled = gs('notif_sms_enabled', '0');
  const smsProvider = gs('notif_sms_provider', 'twilio');
  const smsTwilioSid = gs('notif_sms_twilio_sid', '');
  const smsTwilioToken = gs('notif_sms_twilio_token', '');
  const smsTwilioFrom = gs('notif_sms_twilio_from', '');
  const smsTo = gs('notif_sms_to', '');
  const emSmtpHost = gs('notif_email_smtp_host', '');
  const emSmtpPort = gs('notif_email_smtp_port', '587');
  const emSmtpUser = gs('notif_email_smtp_user', '');
  const emSmtpPass = gs('notif_email_smtp_pass', '');

  // Trigger settings — stored as JSON array of disabled trigger keys
  let disabledTriggers = [];
  try {
    const raw = gs('notification_triggers_disabled', '');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) disabledTriggers = parsed;
    }
  } catch { /* fall through to empty default */ }
  const isTriggerOn = (k) => !disabledTriggers.includes(k);
  const TRIGGERS = [
    { group: 'Visitors & Engagement', items: [
      { k: 'visitor_new',            label: 'New Visitor',                desc: 'First-time visitor lands on the site.' },
      { k: 'visitor_return',         label: 'Returning Visitor',          desc: 'A previous visitor comes back.' },
      { k: 'visitor_returning_long', label: 'Returning After 7+ Days',    desc: 'A visitor returns after a long absence.' },
      { k: 'visitor_long_session',   label: 'Long Session (>5 min)',      desc: 'Visitor stays on the site for more than 5 minutes.' },
      { k: 'visitor_high_intent',    label: 'High-Intent Visitor',        desc: 'Visited /book or /contact without converting.' },
      { k: 'visitor_new_country',    label: 'Visitor From New Country',   desc: 'First visitor ever from a brand-new country.' },
      { k: 'visitor_after_hours',    label: 'After-Hours Visit',          desc: 'Visit between 11pm and 6am local time.' },
      { k: 'visitor_pages_5plus',    label: 'Browsed 5+ Pages',           desc: 'Single session with 5 or more page views.' },
      { k: 'visitor_mobile',         label: 'Mobile Visit',               desc: 'Visit from a mobile device.' },
      { k: 'visitor_desktop',        label: 'Desktop Visit',              desc: 'Visit from a desktop browser.' },
      { k: 'visitor_tablet',         label: 'Tablet Visit',               desc: 'Visit from a tablet device.' },
      { k: 'visitor_chat_engaged',   label: 'Hero Chat Opened',           desc: 'Visitor sent a message in the hero AI chat.' },
      { k: 'visitor_chat_long',      label: 'Long Chat Conversation',     desc: 'Hero chat conversation went 5+ messages.' },
      { k: 'visitor_form_abandoned', label: 'Form Abandoned',             desc: 'Started filling a form but did not submit.' },
      { k: 'visitor_video_played',   label: 'Video Played',               desc: 'Played the hero video or About-page CEO videos.' },
      { k: 'traffic_spike',          label: 'Traffic Spike',              desc: 'Unusual burst of activity (>50 views in 5 min).' },
      { k: 'bot_detected',           label: 'Bot / Crawler Detected',     desc: 'Known crawler or bot user-agent hit the site.' },
    ]},
    { group: 'Marketing & Acquisition', items: [
      { k: 'shared_on_social',     label: 'Shared on Social',           desc: 'Referrer is Twitter, LinkedIn, Facebook, or Reddit.' },
      { k: 'new_backlink',         label: 'New Backlink',               desc: 'First-ever referral from a new domain.' },
      { k: 'seo_query_logged',     label: 'SEO Query Captured',         desc: 'Search query that brought a visitor in (when available).' },
      { k: 'newsletter_signup',    label: 'Newsletter Signup',          desc: 'Visitor subscribed to the newsletter.' },
      { k: 'direct_visit_spike',   label: 'Direct Traffic Spike',       desc: 'Many direct visits — a brand-awareness lift.' },
    ]},
    { group: 'Leads & Bookings', items: [
      { k: 'contact',              label: 'New Contact Submission',      desc: 'Someone fills out the contact / lead form.' },
      { k: 'booking',              label: 'New Booking',                 desc: 'A consultation slot was booked.' },
      { k: 'booking_cancel',       label: 'Booking Cancelled',           desc: 'A booking was cancelled.' },
      { k: 'booking_rescheduled',  label: 'Booking Rescheduled',         desc: 'A booking time was changed.' },
      { k: 'booking_reminder_24h', label: 'Booking Reminder (24h)',      desc: 'Heads-up 24 hours before a confirmed call.' },
      { k: 'booking_no_show',      label: 'Booking No-Show',             desc: 'Booked time passed without admin confirmation.' },
    ]},
    { group: 'Content & SEO', items: [
      { k: 'blog',         label: 'Blog Post Published',  desc: 'A new blog post went live from the CMS.' },
      { k: 'page',         label: 'Page Published',       desc: 'A new CMS page went live.' },
      { k: 'error_404',    label: '404 Broken Link',      desc: 'Visitor hit a missing page (helps catch typos / dead links).' },
      { k: 'slow_page',    label: 'Slow Page (>3s)',      desc: 'A page took longer than 3 seconds to render.' },
      { k: 'seo_search',   label: 'Search Engine Visit',  desc: 'Visitor arrived from a search engine (with query if available).' },
    ]},
    { group: 'Account & Security', items: [
      { k: 'user_new',              label: 'New Admin User Created',    desc: 'A new admin / editor / viewer was added.' },
      { k: 'login',                 label: 'Admin Login',               desc: 'An admin successfully logged in.' },
      { k: 'login_failed',          label: 'Failed Login Attempt',      desc: 'Wrong password / username submitted to /admin/login.' },
      { k: 'login_new_ip',          label: 'Login From New IP',         desc: 'Admin signed in from a never-before-seen IP.' },
      { k: 'emergency_login_used',  label: 'Emergency Login Used',      desc: 'The .env recovery token was used to bypass normal login.' },
      { k: 'password_changed',      label: 'Password Changed / Reset',  desc: 'Any admin password was reset (by self or another admin).' },
      { k: 'settings_changed',      label: 'Settings Changed',          desc: 'General admin settings were modified.' },
      { k: 'api_key_added',         label: 'API Key Added',             desc: 'A new LLM / email / SMS key was configured.' },
      { k: 'api_key_removed',       label: 'API Key Removed',           desc: 'A configured key was removed or rotated.' },
      { k: 'security',              label: 'Other Security Event',      desc: 'Catch-all for security-relevant events.' },
      { k: 'rate_limit_hit',        label: 'Rate Limit Hit',            desc: 'A public API rate-limited a client (possible attack).' },
    ]},
    { group: 'AI & Knowledge Base', items: [
      { k: 'agent_run',              label: 'AI Agent Run Completed',  desc: 'An automated agent finished a task.' },
      { k: 'agent_fail',             label: 'AI Agent Run Failed',     desc: 'An automated agent run errored.' },
      { k: 'kb',                     label: 'KB Entry Added',          desc: 'A new knowledge base entry was created.' },
      { k: 'chat_query',             label: 'Hero Chat Query Logged',  desc: 'Visitor query missed the KB and may need a new entry.' },
      { k: 'chat_off_topic_streak',  label: 'Off-Topic Chat Streak',   desc: 'Same visitor asks 3+ off-topic questions (possible abuse).' },
      { k: 'chat_llm_error',         label: 'Chat LLM Provider Error', desc: 'Claude / OpenAI / Groq / etc. returned an error.' },
      { k: 'chat_high_volume',       label: 'Chat High Volume',        desc: 'Hero chat received unusually many queries (interest spike).' },
    ]},
    { group: 'System & Operational', items: [
      { k: 'system',            label: 'System Notification',  desc: 'General system alerts (test, restart, etc.).' },
      { k: 'daily_digest',      label: 'Daily Digest',         desc: 'Once-per-day summary: visitors, bookings, contacts, top pages.' },
      { k: 'weekly_digest',     label: 'Weekly Digest',        desc: 'Weekly stats roll-up.' },
      { k: 'backup_completed',  label: 'Backup Completed',     desc: 'Scheduled DB backup ran successfully.' },
      { k: 'backup_failed',     label: 'Backup Failed',        desc: 'Scheduled DB backup errored.' },
    ]},
    { group: 'Server & Infrastructure', items: [
      { k: 'server_started',         label: 'Server Started',          desc: 'Node process / nodemon restarted.' },
      { k: 'server_crash',           label: 'Server Crashed',          desc: 'Process exited unexpectedly or 5xx error spike.' },
      { k: 'memory_high',            label: 'High Memory Usage',       desc: 'Server RAM usage exceeded 80%.' },
      { k: 'disk_low',               label: 'Low Disk Space',          desc: 'Free disk space dropped below 20%.' },
      { k: 'db_size_warning',        label: 'Database Size Warning',   desc: 'SQLite DB grew past a configured threshold.' },
      { k: 'ssl_expiring',           label: 'SSL Cert Expiring',       desc: 'TLS certificate expires within 30 days.' },
      { k: 'domain_expiring',        label: 'Domain Expiring',         desc: 'Domain registration expires within 60 days.' },
      { k: 'uptime_check_failed',    label: 'Uptime Check Failed',     desc: 'External health check or uptime monitor failed.' },
    ]},
    { group: 'API & Integrations', items: [
      { k: 'api_quota_warning',      label: 'API Quota Warning',       desc: 'LLM (Claude/OpenAI/etc.) usage approaching billing limit.' },
      { k: 'third_party_outage',     label: 'Third-Party Outage',      desc: 'External provider returned 5xx errors repeatedly.' },
      { k: 'webhook_received',       label: 'Webhook Received',        desc: 'Inbound webhook from an external integration.' },
      { k: 'webhook_failed',         label: 'Webhook Delivery Failed', desc: 'Outbound webhook delivery returned an error.' },
      { k: 'mcp_server_connected',   label: 'MCP Server Status',       desc: 'MCP server connected or disconnected.' },
    ]},
    { group: 'Compliance & Privacy', items: [
      { k: 'gdpr_request',           label: 'GDPR / Data Request',     desc: 'A visitor requested data export or deletion.' },
      { k: 'cookie_consent_declined',label: 'Cookie Consent Declined', desc: 'Visitor declined cookies on the consent banner.' },
    ]},
  ];
  const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const triggersHtml = TRIGGERS.map((g, gi) => {
    const total = g.items.length;
    const enabled = g.items.filter(i => isTriggerOn(i.k)).length;
    const groupKey = g.group.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const groupAllOn = enabled === total;
    return `
    <div class="trigger-group ${gi === 0 ? 'open' : ''}" data-group-key="${groupKey}">
      <h4 class="trigger-group-title" onclick="window.toggleTriggerGroup(event, this)">
        <span class="acc-name">${g.group}</span>
        <span class="acc-meta">
          <span class="acc-count" data-count-for="${groupKey}">${enabled}/${total}</span>
          <label class="ch-toggle group-master" onclick="event.stopPropagation();" title="Toggle entire group">
            <input type="checkbox" class="group-master-checkbox" data-group-key="${groupKey}" ${groupAllOn ? 'checked' : ''} onchange="window.toggleTriggerGroupMaster(this)" />
            <span class="ch-slider"></span>
          </label>
          <svg class="acc-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
      </h4>
      <div class="trigger-grid">
        ${g.items.map(it => `
          <label class="trigger-row" title="${escAttr(it.desc)} (key: ${it.k})">
            <span class="trigger-meta">
              <span class="trigger-label">${it.label}</span>
              <span class="trigger-desc">${it.desc}</span>
            </span>
            <span class="ch-toggle">
              <input type="checkbox" class="trigger-checkbox" data-key="${it.k}" ${isTriggerOn(it.k) ? 'checked' : ''} />
              <span class="ch-slider"></span>
            </span>
          </label>
        `).join('')}
      </div>
    </div>`;
  }).join('');

  const types = ['all', 'booking', 'contact', 'agent', 'visitor', 'system'];
  const filterBtns = types.map(t => {
    const active = t === filterType ? ' btn-primary' : ' btn-secondary';
    const label = t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1);
    return `<a href="/admin/notifications?type=${t}" class="btn btn-sm${active}">${label}</a>`;
  }).join('');

  const rows = notifications.map(n => `
    <tr class="${n.is_read ? '' : 'notif-unread'}" data-id="${n.id}">
      <td style="width:2.5rem;text-align:center;">${typeIcon(n.type)}</td>
      <td>${typeBadge(n.type)}</td>
      <td>
        <div style="font-weight:${n.is_read ? '400' : '600'};font-size:0.88rem;">${esc(n.title)}</div>
        ${n.message ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${esc(n.message)}</div>` : ''}
      </td>
      <td style="white-space:nowrap;font-size:0.78rem;color:var(--text-muted);">${timeAgo(n.created_at)}</td>
      <td style="width:10rem;">
        <div style="display:flex;gap:0.4rem;">
          ${n.link ? `<a href="${esc(n.link)}" class="btn btn-sm btn-secondary">View</a>` : ''}
          ${!n.is_read ? `<button class="btn btn-sm btn-secondary mark-read-btn" data-id="${n.id}">Read</button>` : ''}
          <button class="btn btn-sm btn-danger delete-notif-btn" data-id="${n.id}">&times;</button>
        </div>
      </td>
    </tr>
  `).join('');

  const pagination = totalPages > 1 ? `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1.2rem;font-size:0.82rem;">
      <span style="color:var(--text-muted);">Showing ${offset + 1}&ndash;${Math.min(offset + perPage, total)} of ${total}</span>
      <div style="display:flex;gap:0.4rem;">
        ${page > 1 ? `<a href="/admin/notifications?type=${filterType}&page=${page - 1}" class="btn btn-sm btn-secondary">&larr; Prev</a>` : ''}
        ${page < totalPages ? `<a href="/admin/notifications?type=${filterType}&page=${page + 1}" class="btn btn-sm btn-secondary">Next &rarr;</a>` : ''}
      </div>
    </div>
  ` : '';

  const content = `
    <style>
      .notif-unread td { background: rgba(15,193,183,0.04); }
      .notif-unread td:first-child { box-shadow: inset 3px 0 0 var(--teal); }
      .ntab-bar { display:flex; gap:0; border-bottom:2px solid var(--border, #333); margin-bottom:1.5rem; }
      .ntab { padding:.65rem 1.2rem; cursor:pointer; font-weight:600; font-size:.88rem; color:var(--muted, #888); border:none; border-bottom:2px solid transparent; margin-bottom:-2px; background:none; transition:all .2s; display:flex; align-items:center; gap:.4rem; }
      .ntab:hover { color:var(--text, #fff); }
      .ntab.active { color:var(--accent, #14b8a6); border-bottom-color:var(--accent, #14b8a6); }
      .ntab-panel { display:none; }
      .ntab-panel.active { display:block; }
      .ch-card { padding:1.2rem; margin-bottom:1rem; }
      .ch-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }
      .ch-header h4 { font-size:.95rem; font-weight:600; display:flex; align-items:center; gap:.5rem; }
      .ch-toggle { position:relative; width:42px; height:24px; display:inline-block; }
      .ch-toggle input { opacity:0; width:0; height:0; }
      .ch-slider { position:absolute; inset:0; background:var(--border, #444); border-radius:12px; cursor:pointer; transition:.2s; }
      .ch-slider::before { content:''; position:absolute; width:18px; height:18px; left:3px; top:3px; background:#fff; border-radius:50%; transition:.2s; }
      .ch-toggle input:checked + .ch-slider { background:var(--accent, #14b8a6); }
      .ch-toggle input:checked + .ch-slider::before { transform:translateX(18px); }
      .ch-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:.7rem; }
      .ch-row.single { grid-template-columns:1fr; }
      .ch-field { display:flex; flex-direction:column; gap:.25rem; }
      .ch-field label { font-size:.76rem; font-weight:500; color:var(--muted, #888); text-transform:uppercase; letter-spacing:.04em; }
      .ch-field input, .ch-field select, .ch-field-select { padding:.5rem .7rem; background:var(--surface, rgba(255,255,255,.06)); border:1px solid var(--border, #333); border-radius:6px; color:var(--text, #fff); font-size:.88rem; font-family:inherit; }
      .ch-field input:focus, .ch-field select:focus, .ch-field-select:focus { outline:none; border-color:var(--accent, #14b8a6); }
      .ch-actions { display:flex; gap:.6rem; align-items:center; margin-top:.8rem; }
      .btn-ch-save { padding:.5rem 1.4rem; background:var(--accent, #14b8a6); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:.88rem; }
      .btn-ch-save:hover { opacity:.9; }
      .btn-ch-test { padding:.5rem 1rem; background:transparent; color:var(--accent, #14b8a6); border:1px solid var(--accent, #14b8a6); border-radius:6px; font-weight:600; cursor:pointer; font-size:.82rem; }
      .btn-ch-test:hover { background:rgba(20,184,166,.1); }
      .ch-msg { font-size:.82rem; color:#22c55e; opacity:0; transition:opacity .3s; display:inline-block; margin-left:.5rem; }
      .ch-msg.show { opacity:1; }
      .ch-msg.err { color:#ef4444; }
      .ch-status { display:inline-block; padding:.15rem .5rem; border-radius:4px; font-size:.72rem; font-weight:600; }
      .ch-status.on { background:rgba(34,197,94,.15); color:#22c55e; }
      .ch-status.off { background:rgba(239,68,68,.1); color:#ef4444; }
    </style>

    <!-- Tab bar -->
    <div class="ntab-bar">
      <button class="ntab active" data-tab="inbox" onclick="switchNTab('inbox')">
        ${svgI('<path d="M22 12h-6l-2 3H10l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>')}
        Inbox ${unread > 0 ? '<span style="background:var(--accent);color:#fff;padding:.1rem .45rem;border-radius:10px;font-size:.72rem;margin-left:.2rem;">' + unread + '</span>' : ''}
      </button>
      <button class="ntab" data-tab="telegram" onclick="switchNTab('telegram')">
        ${svgI('<path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-8.609 3.33c-2.068.8-4.133 1.598-5.724 2.21a405.15 405.15 0 0 1-2.849 1.09c-.42.147-.99.332-1.473.901-.728.855.054 1.7.166 1.85.35.462.778.812 1.208 1.14.516.393 1.048.81 1.46 1.15.327.27.595.5.782.675l2.58 7.758.003.01c.126.378.32.763.684 1.035.366.273.79.355 1.2.304.414-.052.71-.217 1.014-.382l.022-.012 3.222-2.178 3.878 3.167c.105.09.262.2.456.299.194.098.43.181.706.181.527 0 .96-.287 1.232-.602.272-.315.405-.652.503-.955l.02-.06 3.473-18.169.001-.003c.088-.459.13-.912-.025-1.373a1.807 1.807 0 0 0-.907-1.05 2.074 2.074 0 0 0-1.169-.266zM21.198 3.433zM10.088 15.2l-.966 3.402 1.674-1.132z"/>')}
        Telegram <span class="ch-status ${tgEnabled === '1' ? 'on' : 'off'}">${tgEnabled === '1' ? 'ON' : 'OFF'}</span>
      </button>
      <button class="ntab" data-tab="discord" onclick="switchNTab('discord')">
        ${svgI('<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>')}
        Discord <span class="ch-status ${dcEnabled === '1' ? 'on' : 'off'}">${dcEnabled === '1' ? 'ON' : 'OFF'}</span>
      </button>
      <button class="ntab" data-tab="whatsapp" onclick="switchNTab('whatsapp')">
        ${svgI('<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>')}
        WhatsApp <span class="ch-status ${waEnabled === '1' ? 'on' : 'off'}">${waEnabled === '1' ? 'ON' : 'OFF'}</span>
      </button>
      <button class="ntab" data-tab="email" onclick="switchNTab('email')">
        ${svgI('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>')}
        Email <span class="ch-status ${emEnabled === '1' ? 'on' : 'off'}">${emEnabled === '1' ? 'ON' : 'OFF'}</span>
      </button>
      <button class="ntab" data-tab="sms" onclick="switchNTab('sms')">
        ${svgI('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')}
        SMS <span class="ch-status ${smsEnabled === '1' ? 'on' : 'off'}">${smsEnabled === '1' ? 'ON' : 'OFF'}</span>
      </button>
      <button class="ntab" data-tab="triggers" onclick="switchNTab('triggers')">
        ${svgI('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>')}
        Triggers <span class="ch-status on">${TRIGGERS.reduce((n,g)=>n+g.items.filter(i=>isTriggerOn(i.k)).length,0)}/${TRIGGERS.reduce((n,g)=>n+g.items.length,0)}</span>
      </button>
    </div>

    <!-- TAB: Inbox -->
    <div class="ntab-panel active" id="ntab-inbox">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem;flex-wrap:wrap;gap:0.8rem;">
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
          ${filterBtns}
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-sm btn-primary" id="markAllReadBtn">Mark all read</button>
          <button class="btn btn-sm btn-danger" id="clearOldBtn">Clear 30+ days</button>
        </div>
      </div>
      <div class="card" style="padding:0;">
        ${notifications.length ? `
          <table class="admin-table">
            <thead><tr><th></th><th>Type</th><th>Notification</th><th>Time</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        ` : `
          <div style="padding:3rem;text-align:center;color:var(--text-muted);">
            <div style="font-size:1.5rem;margin-bottom:0.5rem;">${svgI('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>')}</div>
            <div style="font-size:0.9rem;">No notifications${filterType !== 'all' ? ' of type "' + filterType + '"' : ''}.</div>
          </div>
        `}
      </div>
      ${pagination}
      <div style="margin-top:1rem;font-size:0.75rem;color:var(--text-muted);">${unread} unread &middot; ${total} total</div>
    </div>

    <!-- TAB: Telegram -->
    <div class="ntab-panel" id="ntab-telegram">
      <div class="card ch-card">
        <div class="ch-header">
          <h4>${svgI('<path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-8.609 3.33c-2.068.8-4.133 1.598-5.724 2.21a405.15 405.15 0 0 1-2.849 1.09c-.42.147-.99.332-1.473.901-.728.855.054 1.7.166 1.85.35.462.778.812 1.208 1.14.516.393 1.048.81 1.46 1.15.327.27.595.5.782.675l2.58 7.758.003.01c.126.378.32.763.684 1.035.366.273.79.355 1.2.304.414-.052.71-.217 1.014-.382l.022-.012 3.222-2.178 3.878 3.167c.105.09.262.2.456.299.194.098.43.181.706.181.527 0 .96-.287 1.232-.602.272-.315.405-.652.503-.955l.02-.06 3.473-18.169.001-.003c.088-.459.13-.912-.025-1.373a1.807 1.807 0 0 0-.907-1.05 2.074 2.074 0 0 0-1.169-.266z"/>')} Telegram Bot</h4>
          <label class="ch-toggle"><input type="checkbox" id="tg-enabled" ${tgEnabled === '1' ? 'checked' : ''}/><span class="ch-slider"></span></label>
        </div>
        <div class="ch-row"><div class="ch-field"><label>Bot Token</label><input type="text" id="tg-bot-token" value="${esc(tgBotToken)}" placeholder="123456:ABC-DEF..." /></div><div class="ch-field"><label>Chat ID</label><input type="text" id="tg-chat-id" value="${esc(tgChatId)}" placeholder="-1001234567890" /></div></div>
        <p style="font-size:.75rem;color:var(--muted,#888);margin-bottom:.6rem;">Create a bot via <strong>@BotFather</strong> on Telegram. Add it to your group/channel and get the Chat ID.</p>
        <div class="ch-actions"><button class="btn-ch-save" onclick="saveChannel('telegram')">Save</button><button class="btn-ch-test" onclick="testChannel('telegram')">Send Test</button><span class="ch-msg" id="msg-telegram"></span></div>
      </div>
    </div>

    <!-- TAB: Discord -->
    <div class="ntab-panel" id="ntab-discord">
      <div class="card ch-card">
        <div class="ch-header">
          <h4>${svgI('<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M7.5 7.5c3-1 6-1 9 0"/><path d="M7.5 16.5c3 1 6 1 9 0"/><path d="M15.5 17c0 1 1.5 3 2 3 1.5 0 2.833-1.667 3.5-3 .667-1.667.5-5.833-1.5-11.5-1.457-1.015-3-1.34-4.5-1.5l-1 2"/><path d="M8.5 17c0 1-1.356 3-1.832 3-1.429 0-2.698-1.667-3.333-3-.635-1.667-.476-5.833 1.428-11.5C6.151 4.485 7.545 4.16 9 4l1 2"/>')} Discord Webhook</h4>
          <label class="ch-toggle"><input type="checkbox" id="dc-enabled" ${dcEnabled === '1' ? 'checked' : ''}/><span class="ch-slider"></span></label>
        </div>
        <div class="ch-row single"><div class="ch-field"><label>Webhook URL</label><input type="text" id="dc-webhook" value="${esc(dcWebhook)}" placeholder="https://discord.com/api/webhooks/..." /></div></div>
        <p style="font-size:.75rem;color:var(--muted,#888);margin-bottom:.6rem;">Server Settings &rarr; Integrations &rarr; Webhooks &rarr; New Webhook. Copy the webhook URL.</p>
        <div class="ch-actions"><button class="btn-ch-save" onclick="saveChannel('discord')">Save</button><button class="btn-ch-test" onclick="testChannel('discord')">Send Test</button><span class="ch-msg" id="msg-discord"></span></div>
      </div>
    </div>

    <!-- TAB: WhatsApp -->
    <div class="ntab-panel" id="ntab-whatsapp">
      <div class="card ch-card">
        <div class="ch-header">
          <h4>${svgI('<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>')} WhatsApp (CallMeBot)</h4>
          <label class="ch-toggle"><input type="checkbox" id="wa-enabled" ${waEnabled === '1' ? 'checked' : ''}/><span class="ch-slider"></span></label>
        </div>
        <div class="ch-row"><div class="ch-field"><label>Phone Number</label><input type="text" id="wa-phone" value="${esc(waPhone)}" placeholder="+1234567890" /></div><div class="ch-field"><label>API Key</label><input type="text" id="wa-api-key" value="${esc(waApiKey)}" placeholder="CallMeBot API key" /></div></div>
        <p style="font-size:.75rem;color:var(--muted,#888);margin-bottom:.6rem;">Get your API key at <strong>callmebot.com/blog/free-api-whatsapp-messages</strong></p>
        <div class="ch-actions"><button class="btn-ch-save" onclick="saveChannel('whatsapp')">Save</button><button class="btn-ch-test" onclick="testChannel('whatsapp')">Send Test</button><span class="ch-msg" id="msg-whatsapp"></span></div>
      </div>
    </div>

    <!-- TAB: Email -->
    <div class="ntab-panel" id="ntab-email">
      <div class="card ch-card">
        <div class="ch-header">
          <h4>${svgI('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>')} Email (SMTP)</h4>
          <label class="ch-toggle"><input type="checkbox" id="em-enabled" ${emEnabled === '1' ? 'checked' : ''}/><span class="ch-slider"></span></label>
        </div>
        <div class="ch-row"><div class="ch-field"><label>To (recipient)</label><input type="email" id="em-to" value="${esc(emTo)}" placeholder="admin@aimtechai.com" /></div><div class="ch-field"><label>From</label><input type="email" id="em-from" value="${esc(emFrom)}" placeholder="noreply@aimtechai.com" /></div></div>
        <div class="ch-row"><div class="ch-field"><label>SMTP Host</label><input type="text" id="em-smtp-host" value="${esc(emSmtpHost)}" placeholder="smtp.gmail.com" /></div><div class="ch-field"><label>SMTP Port</label><input type="number" id="em-smtp-port" value="${esc(emSmtpPort)}" placeholder="587" /></div></div>
        <div class="ch-row"><div class="ch-field"><label>SMTP Username</label><input type="text" id="em-smtp-user" value="${esc(emSmtpUser)}" placeholder="user@gmail.com" /></div><div class="ch-field"><label>SMTP Password</label><input type="password" id="em-smtp-pass" value="${esc(emSmtpPass)}" placeholder="App password" /></div></div>
        <div class="ch-actions"><button class="btn-ch-save" onclick="saveChannel('email')">Save</button><button class="btn-ch-test" onclick="testChannel('email')">Send Test</button><span class="ch-msg" id="msg-email"></span></div>
      </div>
    </div>

    <!-- TAB: SMS -->
    <div class="ntab-panel" id="ntab-sms">
      <div class="card ch-card">
        <div class="ch-header">
          <h4>${svgI('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')} SMS Notifications</h4>
          <label class="ch-toggle"><input type="checkbox" id="sms-enabled" ${smsEnabled === '1' ? 'checked' : ''}/><span class="ch-slider"></span></label>
        </div>
        <div class="ch-row">
          <div class="ch-field">
            <label>Provider</label>
            <select id="sms-provider" class="ch-field-select" onchange="toggleSmsFields()">
              <option value="twilio" ${smsProvider === 'twilio' ? 'selected' : ''}>Twilio</option>
              <option value="vonage" ${smsProvider === 'vonage' ? 'selected' : ''}>Vonage (Nexmo)</option>
              <option value="plivo" ${smsProvider === 'plivo' ? 'selected' : ''}>Plivo</option>
              <option value="sinch" ${smsProvider === 'sinch' ? 'selected' : ''}>Sinch</option>
              <option value="messagebird" ${smsProvider === 'messagebird' ? 'selected' : ''}>MessageBird</option>
              <option value="clicksend" ${smsProvider === 'clicksend' ? 'selected' : ''}>ClickSend</option>
              <option value="textmagic" ${smsProvider === 'textmagic' ? 'selected' : ''}>TextMagic</option>
              <option value="telnyx" ${smsProvider === 'telnyx' ? 'selected' : ''}>Telnyx</option>
              <option value="infobip" ${smsProvider === 'infobip' ? 'selected' : ''}>Infobip</option>
              <option value="aws_sns" ${smsProvider === 'aws_sns' ? 'selected' : ''}>AWS SNS</option>
            </select>
          </div>
          <div class="ch-field">
            <label>To Phone Number</label>
            <input type="text" id="sms-to" value="${esc(smsTo)}" placeholder="+1234567890" />
          </div>
        </div>
        <div id="sms-credential-fields">
          <div class="ch-row">
            <div class="ch-field" id="sms-field1-wrap"><label id="sms-field1-label">Account SID</label><input type="text" id="sms-twilio-sid" value="${esc(smsTwilioSid)}" /></div>
            <div class="ch-field" id="sms-field2-wrap"><label id="sms-field2-label">Auth Token</label><input type="password" id="sms-twilio-token" value="${esc(smsTwilioToken)}" /></div>
          </div>
          <div class="ch-row single" id="sms-field3-wrap"><div class="ch-field"><label id="sms-field3-label">From Phone Number</label><input type="text" id="sms-twilio-from" value="${esc(smsTwilioFrom)}" /></div></div>
        </div>
        <p style="font-size:.72rem;color:var(--muted,#888);margin-bottom:.6rem;margin-top:.4rem;" id="sms-provider-hint"></p>
        <div class="ch-actions"><button class="btn-ch-save" onclick="saveChannel('sms')">Save</button><button class="btn-ch-test" onclick="testChannel('sms')">Send Test</button><span class="ch-msg" id="msg-sms"></span></div>
      </div>
    </div>

    <!-- TAB: Triggers -->
    <div class="ntab-panel" id="ntab-triggers">
      <div class="card" style="padding:1.4rem 1.6rem;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;">
          <div>
            <h3 style="font-size:1rem;font-weight:600;margin:0 0 .3rem;">Notification Triggers</h3>
            <p style="font-size:.82rem;color:var(--muted,#888);margin:0;max-width:640px;line-height:1.55;">
              Toggle which events fan out to your enabled channels (Telegram, Discord, WhatsApp, Email, SMS).
              Disabled triggers still appear in the Inbox tab — they just don't ping you externally.
            </p>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
            <button class="btn-ch-test" onclick="window.toggleAllTriggers(true)">Enable All</button>
            <button class="btn-ch-test" onclick="window.toggleAllTriggers(false)">Disable All</button>
            <button class="btn-ch-save" onclick="window.saveTriggers()">Save</button>
            <span class="ch-msg" id="msg-triggers"></span>
          </div>
        </div>
        ${triggersHtml}
      </div>
      <style>
        .trigger-group { margin-top:.6rem; border:1px solid var(--border,#333); border-radius:8px; overflow:hidden; background:var(--surface,rgba(255,255,255,.02)); }
        .trigger-group:first-child { margin-top:0; }
        .trigger-group-title { display:flex; justify-content:space-between; align-items:center; gap:1rem; font-size:.78rem; font-weight:600; color:var(--text,#fff); text-transform:uppercase; letter-spacing:.06em; margin:0; padding:.7rem 1rem; cursor:pointer; user-select:none; transition:background .15s; }
        .trigger-group-title:hover { background:var(--surface,rgba(255,255,255,.05)); }
        .trigger-group-title .acc-meta { display:flex; align-items:center; gap:.6rem; font-size:.7rem; color:var(--muted,#888); font-weight:500; text-transform:none; letter-spacing:0; }
        .trigger-group-title .acc-count { background:var(--surface,rgba(255,255,255,.06)); padding:.1rem .5rem; border-radius:10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.68rem; }
        .trigger-group-title .acc-chevron { transition:transform .2s; color:var(--accent,#14b8a6); }
        .trigger-group.open .trigger-group-title .acc-chevron { transform:rotate(90deg); }
        .trigger-group .trigger-grid { display:none; }
        .trigger-group.open .trigger-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); gap:.4rem; padding:.4rem .8rem .8rem; border-top:1px solid var(--border,#333); }
        .trigger-row { display:flex; justify-content:space-between; align-items:center; gap:.6rem; padding:.45rem .6rem; border:1px solid var(--border,#333); border-radius:6px; cursor:pointer; transition:background .15s; min-width:0; background:var(--bg,rgba(0,0,0,.15)); }
        .trigger-row:hover { background:var(--surface,rgba(255,255,255,.04)); }
        .trigger-meta { display:flex; flex-direction:column; gap:.1rem; min-width:0; flex:1; }
        .trigger-label { font-size:.82rem; font-weight:500; color:var(--text,#fff); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .trigger-desc { font-size:.7rem; color:var(--muted,#888); line-height:1.35; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .trigger-key { display:none; }
        .trigger-row .ch-toggle { width:34px; height:20px; flex-shrink:0; }
        .trigger-row .ch-slider::before { width:14px; height:14px; left:3px; top:3px; }
        .trigger-row .ch-toggle input:checked + .ch-slider::before { transform:translateX(14px); }
      </style>
    </div>

    <script>
    (function() {
      var csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      var headers = { 'Content-Type': 'application/json', 'x-csrf-token': csrf };

      /* SMS provider field labels */
      var _smsProviders = {
        twilio:     { f1: 'Account SID', f2: 'Auth Token', f3: 'From Phone Number', p1: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', p2: 'Auth token', p3: '+1234567890 (Twilio number)', hint: 'Get credentials at <strong>console.twilio.com</strong>', showF3: true },
        vonage:     { f1: 'API Key', f2: 'API Secret', f3: 'From Name/Number', p1: 'a1b2c3d4', p2: 'API secret', p3: 'AIMTechAI or +1234567890', hint: 'Get credentials at <strong>dashboard.nexmo.com</strong>', showF3: true },
        plivo:      { f1: 'Auth ID', f2: 'Auth Token', f3: 'From Phone Number', p1: 'MAXXXXXXXXXXXXXXXXXX', p2: 'Auth token', p3: '+1234567890 (Plivo number)', hint: 'Get credentials at <strong>console.plivo.com</strong>', showF3: true },
        sinch:      { f1: 'Service Plan ID', f2: 'API Token', f3: 'From Phone Number', p1: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', p2: 'Bearer token', p3: '+1234567890 (Sinch number)', hint: 'Get credentials at <strong>dashboard.sinch.com</strong> &rarr; SMS &rarr; APIs', showF3: true },
        messagebird:{ f1: '(not used)', f2: 'Access Key', f3: 'Originator', p1: 'Leave empty', p2: 'live_xxxxxxxxxxxxxxx', p3: 'AIMTechAI or +1234567890', hint: 'Get Access Key at <strong>dashboard.messagebird.com</strong> &rarr; Developers', showF3: true },
        clicksend:  { f1: 'Username', f2: 'API Key', f3: 'From Name/Number', p1: 'your@email.com', p2: 'API key from dashboard', p3: 'AIMTechAI or +1234567890', hint: 'Get credentials at <strong>dashboard.clicksend.com</strong> &rarr; API Credentials', showF3: true },
        textmagic:  { f1: 'Username', f2: 'API Key (v2)', f3: '(not used)', p1: 'your_username', p2: 'API key from dashboard', p3: 'Leave empty', hint: 'Get API key at <strong>my.textmagic.com</strong> &rarr; API Settings', showF3: false },
        telnyx:     { f1: '(not used)', f2: 'API Key', f3: 'From Phone Number', p1: 'Leave empty', p2: 'KEY_xxxxxxxxxx', p3: '+1234567890 (Telnyx number)', hint: 'Get API key at <strong>portal.telnyx.com</strong> &rarr; Auth V2', showF3: true },
        infobip:    { f1: 'Base URL Prefix', f2: 'API Key', f3: 'From Name/Number', p1: 'xxxxx (e.g. abc123)', p2: 'App API key', p3: 'AIMTechAI', hint: 'Your base URL is <strong>[prefix].api.infobip.com</strong>. Get API key in Infobip dashboard.', showF3: true },
        aws_sns:    { f1: 'Access Key ID', f2: 'Secret Access Key', f3: '(not used)', p1: 'AKIAXXXXXXXXXXXXXXXX', p2: 'Secret key', p3: 'Leave empty', hint: 'Create IAM credentials with <strong>sns:Publish</strong> permission. Requires <code>@aws-sdk/client-sns</code> npm package.', showF3: false }
      };
      window.toggleSmsFields = function() {
        var prov = document.getElementById('sms-provider').value;
        var cfg = _smsProviders[prov] || _smsProviders.twilio;
        document.getElementById('sms-field1-label').textContent = cfg.f1;
        document.getElementById('sms-field2-label').textContent = cfg.f2;
        document.getElementById('sms-field3-label').textContent = cfg.f3;
        document.getElementById('sms-twilio-sid').placeholder = cfg.p1;
        document.getElementById('sms-twilio-token').placeholder = cfg.p2;
        document.getElementById('sms-twilio-from').placeholder = cfg.p3;
        document.getElementById('sms-field3-wrap').style.display = cfg.showF3 ? '' : 'none';
        document.getElementById('sms-provider-hint').innerHTML = cfg.hint;
      };
      toggleSmsFields();

      /* Tab switching */
      window.switchNTab = function(tab) {
        document.querySelectorAll('.ntab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.ntab-panel').forEach(function(p) { p.classList.remove('active'); });
        var panel = document.getElementById('ntab-' + tab);
        if (panel) panel.classList.add('active');
        var btn = document.querySelector('.ntab[data-tab="' + tab + '"]');
        if (btn) btn.classList.add('active');
        try { localStorage.setItem('aim_notif_active_tab', tab); } catch {}
      };
      // Restore last-active tab on page load (defaults to 'inbox' if none saved)
      try {
        var saved = localStorage.getItem('aim_notif_active_tab');
        if (saved && document.getElementById('ntab-' + saved)) {
          window.switchNTab(saved);
        }
      } catch {}

      /* Flash message */
      function flash(id, msg, isErr) {
        var el = document.getElementById(id);
        el.textContent = msg || 'Saved';
        el.className = 'ch-msg show' + (isErr ? ' err' : '');
        setTimeout(function() { el.classList.remove('show'); }, 3000);
      }

      /* Triggers — accordion toggle (single-group expand, others auto-close) */
      window.toggleTriggerGroup = function(ev, headerEl) {
        // Don't toggle accordion if click came from the master switch
        if (ev && ev.target && (ev.target.closest && ev.target.closest('.ch-toggle'))) return;
        var group = headerEl.parentElement;
        var key = group.dataset.groupKey || '';
        var wasOpen = group.classList.contains('open');
        // Close every other group
        document.querySelectorAll('.trigger-group').forEach(function(g) { g.classList.remove('open'); });
        // If it was closed, open it (clicking an already-open group collapses it)
        if (!wasOpen) group.classList.add('open');
        // Persist only the currently open group (or empty if collapsed)
        try {
          var openKey = !wasOpen ? key : '';
          localStorage.setItem('aim_trigger_open_groups', JSON.stringify(openKey ? [openKey] : []));
        } catch {}
      };

      /* Triggers — group master toggle (turn all triggers in group on/off) */
      window.toggleTriggerGroupMaster = function(checkbox) {
        var key = checkbox.dataset.groupKey;
        var group = document.querySelector('.trigger-group[data-group-key="' + key + '"]');
        if (!group) return;
        var state = checkbox.checked;
        group.querySelectorAll('.trigger-checkbox').forEach(function(cb) { cb.checked = state; });
        // Live count update
        var countEl = group.querySelector('[data-count-for="' + key + '"]');
        if (countEl) {
          var total = group.querySelectorAll('.trigger-checkbox').length;
          countEl.textContent = (state ? total : 0) + '/' + total;
        }
      };

      /* Keep group master + count in sync when individual toggles change */
      document.querySelectorAll('.trigger-group').forEach(function(group) {
        var key = group.dataset.groupKey;
        var checkboxes = group.querySelectorAll('.trigger-checkbox');
        var master = group.querySelector('.group-master-checkbox');
        var countEl = group.querySelector('[data-count-for="' + key + '"]');
        function refresh() {
          var total = checkboxes.length;
          var on = 0;
          checkboxes.forEach(function(cb) { if (cb.checked) on++; });
          if (countEl) countEl.textContent = on + '/' + total;
          if (master) {
            master.checked = on === total;
            master.indeterminate = on > 0 && on < total;
          }
        }
        checkboxes.forEach(function(cb) { cb.addEventListener('change', refresh); });
        refresh();
      });

      /* Restore last-open group (single open; else default = first group) */
      try {
        var raw = localStorage.getItem('aim_trigger_open_groups');
        if (raw) {
          var arr = JSON.parse(raw);
          var savedKey = Array.isArray(arr) && arr.length ? arr[0] : null;
          document.querySelectorAll('.trigger-group').forEach(function(g) { g.classList.remove('open'); });
          if (savedKey) {
            var target = document.querySelector('.trigger-group[data-group-key="' + savedKey + '"]');
            if (target) target.classList.add('open');
          }
        }
      } catch {}

      /* Triggers — bulk toggle */
      window.toggleAllTriggers = function(state) {
        document.querySelectorAll('.trigger-checkbox').forEach(function(cb) { cb.checked = state; });
      };
      window.saveTriggers = function() {
        var disabled = [];
        document.querySelectorAll('.trigger-checkbox').forEach(function(cb) {
          if (!cb.checked) disabled.push(cb.dataset.key);
        });
        fetch('/api/admin/notifications/trigger-settings', {
          method: 'PUT',
          headers: headers,
          body: JSON.stringify({ disabled: disabled })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data && data.ok) flash('msg-triggers', 'Saved', false);
          else flash('msg-triggers', (data && data.error) || 'Save failed', true);
        })
        .catch(function() { flash('msg-triggers', 'Network error', true); });
      };

      /* Save channel settings */
      window.saveChannel = function(ch) {
        var body = {};
        if (ch === 'telegram') {
          body.notif_telegram_enabled = document.getElementById('tg-enabled').checked ? '1' : '0';
          body.notif_telegram_bot_token = document.getElementById('tg-bot-token').value;
          body.notif_telegram_chat_id = document.getElementById('tg-chat-id').value;
        } else if (ch === 'discord') {
          body.notif_discord_enabled = document.getElementById('dc-enabled').checked ? '1' : '0';
          body.notif_discord_webhook_url = document.getElementById('dc-webhook').value;
        } else if (ch === 'whatsapp') {
          body.notif_whatsapp_enabled = document.getElementById('wa-enabled').checked ? '1' : '0';
          body.notif_whatsapp_phone = document.getElementById('wa-phone').value;
          body.notif_whatsapp_api_key = document.getElementById('wa-api-key').value;
        } else if (ch === 'email') {
          body.notif_email_enabled = document.getElementById('em-enabled').checked ? '1' : '0';
          body.notif_email_to = document.getElementById('em-to').value;
          body.notif_email_from = document.getElementById('em-from').value;
          body.notif_email_smtp_host = document.getElementById('em-smtp-host').value;
          body.notif_email_smtp_port = document.getElementById('em-smtp-port').value;
          body.notif_email_smtp_user = document.getElementById('em-smtp-user').value;
          body.notif_email_smtp_pass = document.getElementById('em-smtp-pass').value;
        } else if (ch === 'sms') {
          body.notif_sms_enabled = document.getElementById('sms-enabled').checked ? '1' : '0';
          body.notif_sms_provider = document.getElementById('sms-provider').value;
          body.notif_sms_to = document.getElementById('sms-to').value;
          body.notif_sms_twilio_sid = document.getElementById('sms-twilio-sid').value;
          body.notif_sms_twilio_token = document.getElementById('sms-twilio-token').value;
          body.notif_sms_twilio_from = document.getElementById('sms-twilio-from').value;
        }
        fetch('/api/admin/notifications/channel-settings', {
          method: 'PUT', headers: headers, body: JSON.stringify(body)
        }).then(function(r) { return r.json(); })
          .then(function(d) { flash('msg-' + ch, d.success ? 'Saved' : (d.error || 'Error'), !d.success); })
          .catch(function(e) { flash('msg-' + ch, 'Error: ' + e.message, true); });
      };

      /* Test channel */
      window.testChannel = function(ch) {
        flash('msg-' + ch, 'Sending...', false);
        fetch('/api/admin/notifications/test-channel', {
          method: 'POST', headers: headers, body: JSON.stringify({ channel: ch })
        }).then(function(r) { return r.json(); })
          .then(function(d) { flash('msg-' + ch, d.success ? 'Test sent!' : (d.error || 'Failed'), !d.success); })
          .catch(function(e) { flash('msg-' + ch, 'Error: ' + e.message, true); });
      };

      // Inbox: Mark single as read
      document.querySelectorAll('.mark-read-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          fetch('/api/admin/notifications/' + this.dataset.id + '/read', { method: 'PATCH', headers: headers, body: JSON.stringify({ _csrf: csrf }) }).then(function() { location.reload(); });
        });
      });
      // Inbox: Delete single
      document.querySelectorAll('.delete-notif-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var tr = this.closest('tr');
          fetch('/api/admin/notifications/' + this.dataset.id, { method: 'DELETE', headers: headers, body: JSON.stringify({ _csrf: csrf }) }).then(function() { tr.remove(); });
        });
      });
      // Inbox: Mark all read
      document.getElementById('markAllReadBtn')?.addEventListener('click', function() {
        fetch('/api/admin/notifications/read-all', { method: 'POST', headers: headers, body: JSON.stringify({ _csrf: csrf }) }).then(function() { location.reload(); });
      });
      // Inbox: Clear old
      document.getElementById('clearOldBtn')?.addEventListener('click', function() {
        if (!confirm('Delete all notifications older than 30 days?')) return;
        fetch('/api/admin/notifications/clear-old', { method: 'POST', headers: headers, body: JSON.stringify({ _csrf: csrf }) }).then(function() { location.reload(); });
      });
    })();
    </script>
  `;

  res.send(adminLayout({
    title: 'Notifications',
    page: 'notifications',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount: unread,
    content,
  }));
});

module.exports = router;
