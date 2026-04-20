const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { get, all, run, insert } = require('../../db/db');
const { requireAuth, requireRole, validateCsrf } = require('../middleware/auth');
const { adminLayout } = require('../views/render');
const { dispatchNotification } = require('../services/notify');

const router = express.Router();

// ---------------------------------------------------------------------------
// Encryption helpers for API keys
// ---------------------------------------------------------------------------
const ENC_KEY = crypto
  .createHash('sha256')
  .update(process.env.ADMIN_SECRET || 'aimtechai-default-secret-change-me')
  .digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv);
  let encrypted = cipher.update(String(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const [ivHex, encrypted] = String(text).split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ---------------------------------------------------------------------------
// Inline HTML escaper
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// GET /admin/settings — settings page
// ---------------------------------------------------------------------------
router.get('/admin/settings', requireAuth, (req, res) => {
  const unreadCount = (get(`SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0`) || {}).c || 0;
  const users = all(`SELECT id, username, email, role, last_login FROM users ORDER BY id`);

  // Check if Claude API key exists
  const claudeKeyRow = get(`SELECT value FROM settings WHERE key = 'claude_api_key'`);
  const hasClaudeKey = !!(claudeKeyRow && claudeKeyRow.value);

  // Load site config settings
  const getSetting = (key, fallback) => {
    const row = get(`SELECT value FROM settings WHERE key = ?`, [key]);
    return (row && row.value) || fallback || '';
  };

  const companyName = getSetting('company_name', 'AIM Tech AI');
  const phone = getSetting('phone');
  const address = getSetting('address');
  const timezone = getSetting('timezone', 'Asia/Manila');

  // Notification channel settings
  const notifTelegramEnabled = getSetting('notif_telegram_enabled', '0');
  const notifTelegramBotToken = getSetting('notif_telegram_bot_token');
  const notifTelegramChatId = getSetting('notif_telegram_chat_id');
  const notifDiscordEnabled = getSetting('notif_discord_enabled', '0');
  const notifDiscordWebhookUrl = getSetting('notif_discord_webhook_url');
  const notifWhatsappEnabled = getSetting('notif_whatsapp_enabled', '0');
  const notifWhatsappPhone = getSetting('notif_whatsapp_phone');
  const notifWhatsappApiKey = getSetting('notif_whatsapp_api_key');
  const notifEmailEnabled = getSetting('notif_email_enabled', '0');
  const notifEmailTo = getSetting('notif_email_to');
  const notifEmailSmtpHost = getSetting('notif_email_smtp_host');
  const notifEmailSmtpPort = getSetting('notif_email_smtp_port', '587');
  const notifEmailSmtpUser = getSetting('notif_email_smtp_user');
  const notifEmailSmtpPass = getSetting('notif_email_smtp_pass');
  const notifEmailFrom = getSetting('notif_email_from');

  // Agent limits
  const maxTokens = getSetting('agent_max_tokens', '4096');
  const maxRunsHour = getSetting('agent_max_runs_hour', '10');
  const maxRunsDay = getSetting('agent_max_runs_day', '100');

  // SEO settings
  const seoTitle = getSetting('seo_default_title', 'AIM Tech AI — Custom Software & AI Integration');
  const seoDesc = getSetting('seo_default_description', 'AIM Tech AI builds custom software, AI integrations, and cloud solutions for businesses worldwide.');
  const seoKeywords = getSetting('seo_default_keywords', 'AI integration, custom software, cloud architecture, machine learning, Beverly Hills tech');
  const seoOgImage = getSetting('seo_og_image', '/assets/aim_transparent_logo.png');
  const seoCanonicalBase = getSetting('seo_canonical_base', 'https://aimtechai.com');
  const seoRobots = getSetting('seo_robots', 'index, follow');
  const seoGoogleVerify = getSetting('seo_google_verification', '');
  const seoBingVerify = getSetting('seo_bing_verification', '');
  const seoGtmId = getSetting('seo_gtm_id', '');
  const seoGaId = getSetting('seo_ga_id', '');
  const seoJsonLdOrg = getSetting('seo_jsonld_org', '');
  const seoSitemap = getSetting('seo_sitemap_enabled', '1');
  const seoTwitter = getSetting('seo_twitter_handle', '');
  const seoFbAppId = getSetting('seo_fb_app_id', '');

  // Security settings
  const secLoginMaxAttempts = getSetting('sec_login_max_attempts', '5');
  const secLoginLockoutMin = getSetting('sec_login_lockout_min', '15');
  const secSessionExpireHrs = getSetting('sec_session_expire_hrs', '24');
  const secForceHttps = getSetting('sec_force_https', '0');
  const secCorsOrigins = getSetting('sec_cors_origins', '*');
  const secRateLimitRpm = getSetting('sec_rate_limit_rpm', '100');
  const secIpWhitelist = getSetting('sec_ip_whitelist', '');
  const secIpBlacklist = getSetting('sec_ip_blacklist', '');
  const sec2faEnabled = getSetting('sec_2fa_enabled', '0');
  const secContentSecurityPolicy = getSetting('sec_csp', '');

  // Appearance settings
  const appAdminTheme = getSetting('app_admin_theme', 'dark');
  const appAccentColor = getSetting('app_accent_color', '#0FC1B7');
  const appSidebarPosition = getSetting('app_sidebar_position', 'left');
  const appDateFormat = getSetting('app_date_format', 'MM/DD/YYYY');
  const appLang = getSetting('app_language', 'en');
  const appDensity = getSetting('app_density', 'default');

  // Email settings
  const emailDefaultFrom = getSetting('email_default_from', '');
  const emailDefaultReplyTo = getSetting('email_default_reply_to', '');
  const emailFooterText = getSetting('email_footer_text', '© 2026 AIM Tech AI LLC. Beverly Hills, California.');
  const emailLogoUrl = getSetting('email_logo_url', 'https://aimtechai.com/assets/aim_transparent_logo.png');

  // Backup settings
  const backupAutoEnabled = getSetting('backup_auto_enabled', '0');
  const backupFrequency = getSetting('backup_frequency', 'daily');
  const backupRetainDays = getSetting('backup_retain_days', '30');
  const backupPath = getSetting('backup_path', './data/backups');

  const isAdmin = req.user.role === 'admin';

  // Build users table rows
  const _td = 'padding:.6rem .8rem;border-bottom:1px solid var(--border,#333);border-right:1px solid var(--border,#333);font-size:.88rem;';
  const _tdLast = 'padding:.6rem .8rem;border-bottom:1px solid var(--border,#333);font-size:.88rem;';
  const ROLES = ['admin', 'editor', 'viewer'];
  const usersRows = users.map(u => `
    <tr style="transition:background .15s;" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background=''">
      <td style="${_td}width:3rem;">${u.id}</td>
      <td style="${_td}font-weight:500;">${esc(u.username)}</td>
      <td style="${_td}">${esc(u.email)}</td>
      <td style="${_td}">${isAdmin ? `<select class="role-select" data-id="${u.id}" style="padding:.3rem .5rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.82rem;font-family:inherit;cursor:pointer;">${ROLES.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('')}</select>` : `<span class="badge badge-${u.role === 'admin' ? 'danger' : 'info'}">${esc(u.role)}</span>`}</td>
      <td style="${isAdmin ? _td : _tdLast}">${u.last_login ? esc(u.last_login) : '<em style="color:var(--muted,#666);">Never</em>'}</td>
      ${isAdmin ? `<td style="${_tdLast}white-space:nowrap;"><button class="btn btn-sm reset-pw-btn" data-id="${u.id}" data-username="${esc(u.username)}" style="background:var(--accent,#14b8a6);color:#fff;border:none;padding:.3rem .7rem;border-radius:6px;cursor:pointer;font-size:.78rem;margin-right:.3rem;">Reset Password</button><button class="btn btn-danger btn-sm delete-user-btn" data-id="${u.id}" ${u.id === req.user.id ? 'data-self="true"' : ''} style="padding:.3rem .7rem;font-size:.78rem;">Delete</button></td>` : ''}
    </tr>
  `).join('');

  const _si = (d) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

  const content = `
    <style>
      .stab-bar{display:flex;gap:0;border-bottom:2px solid var(--border,#333);margin-bottom:1.2rem;}
      .stab{padding:.6rem 1.1rem;cursor:pointer;font-weight:600;font-size:.85rem;color:var(--muted,#888);border:none;border-bottom:2px solid transparent;margin-bottom:-2px;background:none;transition:all .2s;display:flex;align-items:center;gap:.35rem;white-space:nowrap;}
      .stab:hover{color:var(--text,#fff);}
      .stab.active{color:var(--accent,#14b8a6);border-bottom-color:var(--accent,#14b8a6);}
      .stab-panel{display:none;}
      .stab-panel.active{display:block;}
      .sf-row{display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:.7rem;}
      .sf-row.single{grid-template-columns:1fr;}
      .sf-row.three{grid-template-columns:1fr 1fr 1fr;}
      .sf-field{display:flex;flex-direction:column;gap:.2rem;}
      .sf-field label{font-size:.74rem;font-weight:500;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.04em;}
      .sf-field input,.sf-field select{padding:.45rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.85rem;font-family:inherit;}
      .sf-field input:focus,.sf-field select:focus{outline:none;border-color:var(--accent,#14b8a6);}
      .sf-save{padding:.45rem 1.2rem;background:var(--accent,#14b8a6);color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:.85rem;}
      .sf-save:hover{opacity:.9;}
      .sf-msg{font-size:.8rem;color:#22c55e;opacity:0;transition:opacity .3s;display:inline-block;margin-left:.5rem;}
      .sf-msg.show{opacity:1;}
      .sf-msg.err{color:#ef4444;}
    </style>

    <!-- Settings Tabs -->
    <div class="stab-bar">
      <button class="stab active" data-tab="general" onclick="switchSTab('general')">${_si('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09"/>')} General</button>
      <button class="stab" data-tab="users" onclick="switchSTab('users')">${_si('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>')} Users</button>
      <button class="stab" data-tab="api" onclick="switchSTab('api')">${_si('<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>')} API Keys</button>
      <button class="stab" data-tab="agents" onclick="switchSTab('agents')">${_si('<circle cx="12" cy="12" r="3"/><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7 2 2 0 0 1-2 2h-1"/><path d="M6 16a2 2 0 0 1-2-2 7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 12 2"/>')} Agents</button>
      <button class="stab" data-tab="seo" onclick="switchSTab('seo')">${_si('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>')} SEO</button>
      <button class="stab" data-tab="security" onclick="switchSTab('security')">${_si('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>')} Security</button>
      <button class="stab" data-tab="appearance" onclick="switchSTab('appearance')">${_si('<circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12.5" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>')} Appearance</button>
      <button class="stab" data-tab="email" onclick="switchSTab('email')">${_si('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>')} Email</button>
      <button class="stab" data-tab="backup" onclick="switchSTab('backup')">${_si('<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>')} Backup</button>
      ${isAdmin ? `<button class="stab" data-tab="danger" onclick="switchSTab('danger')" style="color:#ef4444;">${_si('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>')} Danger</button>` : ''}
    </div>

    <!-- TAB: General -->
    <div class="stab-panel active" id="stab-general">
      <div class="card">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Site Configuration</h4>
        <form id="siteConfigForm">
          <div class="sf-row">
            <div class="sf-field"><label>Company Name</label><input type="text" id="company_name" name="company_name" value="${esc(companyName)}" /></div>
            <div class="sf-field"><label>Phone</label><input type="text" id="phone" name="phone" value="${esc(phone)}" /></div>
          </div>
          <div class="sf-row">
            <div class="sf-field"><label>Address</label><input type="text" id="address" name="address" value="${esc(address)}" /></div>
            <div class="sf-field"><label>Timezone</label><input type="text" id="timezone" name="timezone" value="${esc(timezone)}" /></div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save</button><span class="sf-msg" id="msg-config">Saved</span></div>
        </form>
      </div>
    </div>

    <!-- TAB: Users -->
    <div class="stab-panel" id="stab-users">
      <div class="card" style="padding:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.8rem 1rem;">
          <h4 style="font-size:.9rem;font-weight:600;margin:0;">User Accounts</h4>
          ${isAdmin ? '<button class="sf-save" id="addUserBtn" style="font-size:.8rem;padding:.35rem .8rem;">Add User</button>' : ''}
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="border-top:1px solid var(--border,#333);border-bottom:1px solid var(--border,#333);background:var(--surface,rgba(255,255,255,.03));">
            <th style="padding:.55rem .8rem;text-align:left;font-size:.78rem;font-weight:500;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.04em;border-right:1px solid var(--border,#333);">ID</th>
            <th style="padding:.55rem .8rem;text-align:left;font-size:.78rem;font-weight:500;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.04em;border-right:1px solid var(--border,#333);">Username</th>
            <th style="padding:.55rem .8rem;text-align:left;font-size:.78rem;font-weight:500;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.04em;border-right:1px solid var(--border,#333);">Email</th>
            <th style="padding:.55rem .8rem;text-align:left;font-size:.78rem;font-weight:500;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.04em;border-right:1px solid var(--border,#333);">Role</th>
            <th style="padding:.55rem .8rem;text-align:left;font-size:.78rem;font-weight:500;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.04em;${isAdmin ? 'border-right:1px solid var(--border,#333);' : ''}">Last Login</th>
            ${isAdmin ? '<th style="padding:.55rem .8rem;text-align:left;font-size:.78rem;font-weight:500;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.04em;">Actions</th>' : ''}
          </tr></thead>
          <tbody>${usersRows}</tbody>
        </table>
      </div>
    </div>

    <!-- TAB: API Keys -->
    <div class="stab-panel" id="stab-api">
      <div class="card">
        <p style="font-size:.78rem;color:var(--muted,#888);margin-bottom:1rem;">Agents can use any configured key. Add keys for the providers you want your agents to access.</p>
        <form id="apiKeysForm">
          ${[
            { id: 'claude_api_key', label: 'Anthropic (Claude)', icon: _si('<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'), placeholder: 'sk-ant-...' },
            { id: 'openai_api_key', label: 'OpenAI (GPT)', icon: _si('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'), placeholder: 'sk-...' },
            { id: 'google_api_key', label: 'Google (Gemini)', icon: _si('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'), placeholder: 'AIza...' },
            { id: 'mistral_api_key', label: 'Mistral AI', icon: _si('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>'), placeholder: 'mis-...' },
            { id: 'groq_api_key', label: 'Groq', icon: _si('<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M9 15h6"/>'), placeholder: 'gsk_...' },
            { id: 'perplexity_api_key', label: 'Perplexity', icon: _si('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'), placeholder: 'pplx-...' },
            { id: 'deepseek_api_key', label: 'DeepSeek', icon: _si('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'), placeholder: 'dsk-...' },
          ].map(k => {
            const row = get('SELECT value FROM settings WHERE key = ?', [k.id]);
            const hasKey = !!(row && row.value);
            return '<div style="display:flex;align-items:center;gap:.8rem;padding:.6rem 0;border-bottom:1px solid var(--border,#333);">' +
              '<div style="width:1.2rem;opacity:.5;">' + k.icon + '</div>' +
              '<div style="min-width:130px;font-weight:600;font-size:.85rem;">' + k.label + '</div>' +
              '<div style="flex:1;"><input type="password" name="' + k.id + '" placeholder="' + (hasKey ? '********** (set)' : k.placeholder) + '" style="width:100%;padding:.4rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.84rem;font-family:monospace;" /></div>' +
              '<div style="width:50px;text-align:center;">' + (hasKey ? '<span style="color:#22c55e;font-size:.72rem;font-weight:600;">SET</span>' : '<span style="color:var(--muted,#666);font-size:.72rem;">-</span>') + '</div>' +
            '</div>';
          }).join('')}
          <div style="margin-top:.8rem;display:flex;align-items:center;">
            <button type="submit" class="sf-save">Save All Keys</button>
            <span class="sf-msg" id="msg-api">Saved</span>
          </div>
        </form>
      </div>
    </div>

    <!-- TAB: Agents -->
    <div class="stab-panel" id="stab-agents">
      <div class="card">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Agent Limits</h4>
        <form id="agentLimitsForm">
          <div class="sf-row three">
            <div class="sf-field"><label>Max Tokens / Run</label><input type="number" id="agent_max_tokens" name="agent_max_tokens" value="${esc(maxTokens)}" /></div>
            <div class="sf-field"><label>Max Runs / Hour</label><input type="number" id="agent_max_runs_hour" name="agent_max_runs_hour" value="${esc(maxRunsHour)}" /></div>
            <div class="sf-field"><label>Max Runs / Day</label><input type="number" id="agent_max_runs_day" name="agent_max_runs_day" value="${esc(maxRunsDay)}" /></div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save Limits</button><span class="sf-msg" id="msg-agents">Saved</span></div>
        </form>
      </div>
    </div>

    <!-- TAB: SEO -->
    <div class="stab-panel" id="stab-seo">
      <div class="card">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Default Meta Tags</h4>
        <form id="seoMetaForm">
          <div class="sf-row">
            <div class="sf-field"><label>Default Title</label><input type="text" name="seo_default_title" value="${esc(seoTitle)}" placeholder="Site Name — Tagline" /></div>
            <div class="sf-field"><label>Canonical Base URL</label><input type="text" name="seo_canonical_base" value="${esc(seoCanonicalBase)}" placeholder="https://aimtechai.com" /></div>
          </div>
          <div class="sf-row single">
            <div class="sf-field"><label>Default Description</label><input type="text" name="seo_default_description" value="${esc(seoDesc)}" placeholder="150-160 character site description" /></div>
          </div>
          <div class="sf-row single">
            <div class="sf-field"><label>Default Keywords</label><input type="text" name="seo_default_keywords" value="${esc(seoKeywords)}" placeholder="keyword1, keyword2, keyword3" /></div>
          </div>
          <div class="sf-row">
            <div class="sf-field"><label>Robots</label>
              <select name="seo_robots" style="padding:.45rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.85rem;">
                <option value="index, follow" ${seoRobots === 'index, follow' ? 'selected' : ''}>index, follow</option>
                <option value="index, nofollow" ${seoRobots === 'index, nofollow' ? 'selected' : ''}>index, nofollow</option>
                <option value="noindex, follow" ${seoRobots === 'noindex, follow' ? 'selected' : ''}>noindex, follow</option>
                <option value="noindex, nofollow" ${seoRobots === 'noindex, nofollow' ? 'selected' : ''}>noindex, nofollow</option>
              </select>
            </div>
            <div class="sf-field"><label>OG Image Path</label><input type="text" name="seo_og_image" value="${esc(seoOgImage)}" placeholder="/assets/og-image.png" /></div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save Meta Tags</button><span class="sf-msg" id="msg-seo-meta">Saved</span></div>
        </form>
      </div>

      <div class="card" style="margin-top:1rem;">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Social Media</h4>
        <form id="seoSocialForm">
          <div class="sf-row three">
            <div class="sf-field"><label>Twitter Handle</label><input type="text" name="seo_twitter_handle" value="${esc(seoTwitter)}" placeholder="@aimtechai" /></div>
            <div class="sf-field"><label>Facebook App ID</label><input type="text" name="seo_fb_app_id" value="${esc(seoFbAppId)}" placeholder="123456789" /></div>
            <div class="sf-field"><label>Sitemap</label>
              <select name="seo_sitemap_enabled" style="padding:.45rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.85rem;">
                <option value="1" ${seoSitemap === '1' ? 'selected' : ''}>Enabled</option>
                <option value="0" ${seoSitemap !== '1' ? 'selected' : ''}>Disabled</option>
              </select>
            </div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save Social</button><span class="sf-msg" id="msg-seo-social">Saved</span></div>
        </form>
      </div>

      <div class="card" style="margin-top:1rem;">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Verification &amp; Analytics</h4>
        <form id="seoAnalyticsForm">
          <div class="sf-row">
            <div class="sf-field"><label>Google Site Verification</label><input type="text" name="seo_google_verification" value="${esc(seoGoogleVerify)}" placeholder="Content value from meta tag" /></div>
            <div class="sf-field"><label>Bing Site Verification</label><input type="text" name="seo_bing_verification" value="${esc(seoBingVerify)}" placeholder="Content value from meta tag" /></div>
          </div>
          <div class="sf-row">
            <div class="sf-field"><label>Google Tag Manager ID</label><input type="text" name="seo_gtm_id" value="${esc(seoGtmId)}" placeholder="GTM-XXXXXXX" /></div>
            <div class="sf-field"><label>Google Analytics ID</label><input type="text" name="seo_ga_id" value="${esc(seoGaId)}" placeholder="G-XXXXXXXXXX" /></div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save Analytics</button><span class="sf-msg" id="msg-seo-analytics">Saved</span></div>
        </form>
      </div>

      <div class="card" style="margin-top:1rem;">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Structured Data (JSON-LD)</h4>
        <form id="seoJsonLdForm">
          <div class="sf-row single">
            <div class="sf-field">
              <label>Organization Schema</label>
              <textarea name="seo_jsonld_org" style="padding:.5rem .7rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.8rem;font-family:monospace;min-height:120px;resize:vertical;width:100%;">${esc(seoJsonLdOrg)}</textarea>
              <span style="font-size:.7rem;color:var(--muted,#888);">Paste valid JSON-LD for your Organization. Applied to all pages as the default schema.</span>
            </div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save Schema</button><span class="sf-msg" id="msg-seo-jsonld">Saved</span></div>
        </form>
      </div>
    </div>

    <!-- TAB: Security -->
    <div class="stab-panel" id="stab-security">
      <div class="card">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Login &amp; Session</h4>
        <form id="secLoginForm">
          <div class="sf-row three">
            <div class="sf-field"><label>Max Login Attempts</label><input type="number" name="sec_login_max_attempts" value="${esc(secLoginMaxAttempts)}" min="1" max="50" /></div>
            <div class="sf-field"><label>Lockout Duration (min)</label><input type="number" name="sec_login_lockout_min" value="${esc(secLoginLockoutMin)}" min="1" max="1440" /></div>
            <div class="sf-field"><label>Session Expiry (hrs)</label><input type="number" name="sec_session_expire_hrs" value="${esc(secSessionExpireHrs)}" min="1" max="720" /></div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save</button><span class="sf-msg" id="msg-sec-login">Saved</span></div>
        </form>
      </div>
      <div class="card" style="margin-top:1rem;">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Access Control</h4>
        <form id="secAccessForm">
          <div class="sf-row">
            <div class="sf-field"><label>IP Whitelist (comma-separated)</label><input type="text" name="sec_ip_whitelist" value="${esc(secIpWhitelist)}" placeholder="Leave empty to allow all" /></div>
            <div class="sf-field"><label>IP Blacklist (comma-separated)</label><input type="text" name="sec_ip_blacklist" value="${esc(secIpBlacklist)}" placeholder="Block specific IPs" /></div>
          </div>
          <div class="sf-row">
            <div class="sf-field"><label>CORS Allowed Origins</label><input type="text" name="sec_cors_origins" value="${esc(secCorsOrigins)}" placeholder="* or https://aimtechai.com" /></div>
            <div class="sf-field"><label>Rate Limit (requests/min)</label><input type="number" name="sec_rate_limit_rpm" value="${esc(secRateLimitRpm)}" min="10" max="10000" /></div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save</button><span class="sf-msg" id="msg-sec-access">Saved</span></div>
        </form>
      </div>
      <div class="card" style="margin-top:1rem;">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Advanced</h4>
        <form id="secAdvancedForm">
          <div class="sf-row">
            <div class="sf-field"><label>Force HTTPS</label>
              <select name="sec_force_https" style="padding:.45rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.85rem;">
                <option value="0"${secForceHttps !== '1' ? ' selected' : ''}>Disabled</option>
                <option value="1"${secForceHttps === '1' ? ' selected' : ''}>Enabled</option>
              </select>
            </div>
            <div class="sf-field"><label>Two-Factor Auth</label>
              <select name="sec_2fa_enabled" style="padding:.45rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.85rem;">
                <option value="0"${sec2faEnabled !== '1' ? ' selected' : ''}>Disabled</option>
                <option value="1"${sec2faEnabled === '1' ? ' selected' : ''}>Enabled (coming soon)</option>
              </select>
            </div>
          </div>
          <div class="sf-row single">
            <div class="sf-field"><label>Content Security Policy</label><input type="text" name="sec_csp" value="${esc(secContentSecurityPolicy)}" placeholder="default-src 'self'; script-src 'self' 'unsafe-inline'" /></div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save</button><span class="sf-msg" id="msg-sec-advanced">Saved</span></div>
        </form>
      </div>
    </div>

    <!-- TAB: Appearance -->
    <div class="stab-panel" id="stab-appearance">
      <div class="card">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Theme &amp; Layout</h4>
        <form id="appThemeForm">
          <div class="sf-row three">
            <div class="sf-field"><label>Default Admin Theme</label>
              <select name="app_admin_theme" style="padding:.45rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.85rem;">
                <option value="dark"${appAdminTheme === 'dark' ? ' selected' : ''}>Dark</option>
                <option value="light"${appAdminTheme === 'light' ? ' selected' : ''}>Light</option>
                <option value="system"${appAdminTheme === 'system' ? ' selected' : ''}>System</option>
              </select>
            </div>
            <div class="sf-field"><label>Accent Color</label><input type="color" name="app_accent_color" value="${esc(appAccentColor)}" style="height:36px;padding:2px;cursor:pointer;" /></div>
            <div class="sf-field"><label>UI Density</label>
              <select name="app_density" style="padding:.45rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.85rem;">
                <option value="compact"${appDensity === 'compact' ? ' selected' : ''}>Compact</option>
                <option value="default"${appDensity === 'default' ? ' selected' : ''}>Default</option>
                <option value="comfortable"${appDensity === 'comfortable' ? ' selected' : ''}>Comfortable</option>
              </select>
            </div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save</button><span class="sf-msg" id="msg-app-theme">Saved</span></div>
        </form>
      </div>
      <div class="card" style="margin-top:1rem;">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Regional</h4>
        <form id="appRegionalForm">
          <div class="sf-row three">
            <div class="sf-field"><label>Date Format</label>
              <select name="app_date_format" style="padding:.45rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.85rem;">
                <option value="MM/DD/YYYY"${appDateFormat === 'MM/DD/YYYY' ? ' selected' : ''}>MM/DD/YYYY</option>
                <option value="DD/MM/YYYY"${appDateFormat === 'DD/MM/YYYY' ? ' selected' : ''}>DD/MM/YYYY</option>
                <option value="YYYY-MM-DD"${appDateFormat === 'YYYY-MM-DD' ? ' selected' : ''}>YYYY-MM-DD</option>
                <option value="DD.MM.YYYY"${appDateFormat === 'DD.MM.YYYY' ? ' selected' : ''}>DD.MM.YYYY</option>
              </select>
            </div>
            <div class="sf-field"><label>Language</label>
              <select name="app_language" style="padding:.45rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.85rem;">
                <option value="en"${appLang === 'en' ? ' selected' : ''}>English</option>
                <option value="es"${appLang === 'es' ? ' selected' : ''}>Espa&ntilde;ol</option>
                <option value="fr"${appLang === 'fr' ? ' selected' : ''}>Fran&ccedil;ais</option>
                <option value="de"${appLang === 'de' ? ' selected' : ''}>Deutsch</option>
                <option value="ja"${appLang === 'ja' ? ' selected' : ''}>日本語</option>
                <option value="zh"${appLang === 'zh' ? ' selected' : ''}>中文</option>
                <option value="ko"${appLang === 'ko' ? ' selected' : ''}>한국어</option>
              </select>
            </div>
            <div class="sf-field"><label>Sidebar Position</label>
              <select name="app_sidebar_position" style="padding:.45rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.85rem;">
                <option value="left"${appSidebarPosition === 'left' ? ' selected' : ''}>Left</option>
                <option value="right"${appSidebarPosition === 'right' ? ' selected' : ''}>Right</option>
              </select>
            </div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save</button><span class="sf-msg" id="msg-app-regional">Saved</span></div>
        </form>
      </div>
    </div>

    <!-- TAB: Email -->
    <div class="stab-panel" id="stab-email">
      <div class="card">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Default Email Settings</h4>
        <p style="font-size:.78rem;color:var(--muted,#888);margin-bottom:.8rem;">Defaults for all outgoing emails. Individual modules (bookings, notifications) can override these.</p>
        <form id="emailDefaultForm">
          <div class="sf-row">
            <div class="sf-field"><label>Default From Address</label><input type="email" name="email_default_from" value="${esc(emailDefaultFrom)}" placeholder="noreply@aimtechai.com" /></div>
            <div class="sf-field"><label>Default Reply-To</label><input type="email" name="email_default_reply_to" value="${esc(emailDefaultReplyTo)}" placeholder="info@aimtechai.com" /></div>
          </div>
          <div class="sf-row">
            <div class="sf-field"><label>Email Logo URL</label><input type="text" name="email_logo_url" value="${esc(emailLogoUrl)}" placeholder="https://aimtechai.com/assets/logo.png" /></div>
            <div class="sf-field"><label>Footer Text</label><input type="text" name="email_footer_text" value="${esc(emailFooterText)}" placeholder="© 2026 AIM Tech AI LLC." /></div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save</button><span class="sf-msg" id="msg-email-default">Saved</span></div>
        </form>
      </div>
    </div>

    <!-- TAB: Backup -->
    <div class="stab-panel" id="stab-backup">
      <div class="card">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Auto Backup</h4>
        <form id="backupAutoForm">
          <div class="sf-row three">
            <div class="sf-field"><label>Auto Backup</label>
              <select name="backup_auto_enabled" style="padding:.45rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.85rem;">
                <option value="0"${backupAutoEnabled !== '1' ? ' selected' : ''}>Disabled</option>
                <option value="1"${backupAutoEnabled === '1' ? ' selected' : ''}>Enabled</option>
              </select>
            </div>
            <div class="sf-field"><label>Frequency</label>
              <select name="backup_frequency" style="padding:.45rem .6rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.85rem;">
                <option value="hourly"${backupFrequency === 'hourly' ? ' selected' : ''}>Hourly</option>
                <option value="daily"${backupFrequency === 'daily' ? ' selected' : ''}>Daily</option>
                <option value="weekly"${backupFrequency === 'weekly' ? ' selected' : ''}>Weekly</option>
                <option value="monthly"${backupFrequency === 'monthly' ? ' selected' : ''}>Monthly</option>
              </select>
            </div>
            <div class="sf-field"><label>Retain (days)</label><input type="number" name="backup_retain_days" value="${esc(backupRetainDays)}" min="1" max="365" /></div>
          </div>
          <div class="sf-row single">
            <div class="sf-field"><label>Backup Path</label><input type="text" name="backup_path" value="${esc(backupPath)}" placeholder="./data/backups" /></div>
          </div>
          <div style="margin-top:.6rem;"><button type="submit" class="sf-save">Save</button><span class="sf-msg" id="msg-backup-auto">Saved</span></div>
        </form>
      </div>
      <div class="card" style="margin-top:1rem;">
        <h4 style="font-size:.9rem;font-weight:600;margin-bottom:.8rem;">Manual Backup</h4>
        <p style="font-size:.78rem;color:var(--muted,#888);margin-bottom:.8rem;">Download a full backup of the database and settings.</p>
        <div style="display:flex;gap:.6rem;">
          <button class="sf-save" id="backupNowBtn" onclick="doBackupNow()">Backup Now</button>
          <span class="sf-msg" id="msg-backup-now"></span>
        </div>
      </div>
    </div>

    <!-- TAB: Danger Zone -->
    ${isAdmin ? `
    <div class="stab-panel" id="stab-danger">
      <div class="card" style="border-color:rgba(248,113,113,0.3);">
        <h4 style="font-size:.9rem;font-weight:600;color:#ef4444;margin-bottom:.5rem;">Reset Admin Panel</h4>
        <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:.8rem;">Delete all user accounts and return to initial setup. This cannot be undone.</p>
        <button class="btn btn-danger" id="resetAdminBtn" style="font-size:.85rem;padding:.45rem 1rem;">Reset All Admin Accounts</button>
      </div>
    </div>
    ` : ''}

    <!-- Add User Modal -->
    <div class="modal-overlay" id="addUserModal" style="display:none">
      <div class="modal">
        <div class="modal-header">
          <h3>Add User</h3>
          <button class="modal-close" id="closeUserModal">&times;</button>
        </div>
        <form id="addUserForm">
          <div class="form-group">
            <label for="new_username">Username</label>
            <input type="text" id="new_username" name="username" required class="form-input">
          </div>
          <div class="form-group">
            <label for="new_email">Email</label>
            <input type="email" id="new_email" name="email" required class="form-input">
          </div>
          <div class="form-group">
            <label for="new_password">Password</label>
            <input type="password" id="new_password" name="password" required minlength="8" class="form-input">
          </div>
          <div class="form-group">
            <label for="new_role">Role</label>
            <select id="new_role" name="role" class="form-input">
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="cancelUserModal">Cancel</button>
            <button type="submit" class="btn btn-primary">Create User</button>
          </div>
        </form>
      </div>
    </div>

    <script>
    (function() {
      var csrf = document.querySelector('meta[name="csrf-token"]').content;
      var headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

      /* Tab switching */
      window.switchSTab = function(tab) {
        document.querySelectorAll('.stab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.stab-panel').forEach(function(p) { p.classList.remove('active'); });
        document.getElementById('stab-' + tab).classList.add('active');
        var btn = document.querySelector('.stab[data-tab="' + tab + '"]');
        if (btn) btn.classList.add('active');
      };

      function flash(id, msg, isErr) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = msg || 'Saved';
        el.className = 'sf-msg show' + (isErr ? ' err' : '');
        setTimeout(function() { el.classList.remove('show'); }, 2500);
      }

      function saveSetting(key, value) {
        return fetch('/admin/settings/api', { method: 'PUT', headers: headers, body: JSON.stringify({ _csrf: csrf, key: key, value: value }) }).then(function(r) { return r.json(); });
      }

      /* Site Config */
      document.getElementById('siteConfigForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var inputs = this.querySelectorAll('input[name]');
        var ok = true;
        for (var inp of inputs) { var r = await saveSetting(inp.name, inp.value.trim()); if (!r.success) { ok = false; flash('msg-config', r.error || 'Error', true); break; } }
        if (ok) flash('msg-config', 'Saved');
      });

      /* API Keys (all providers) */
      document.getElementById('apiKeysForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var inputs = this.querySelectorAll('input[name]');
        var saved = 0;
        for (var inp of inputs) {
          var val = inp.value.trim();
          if (!val) continue;
          var r = await saveSetting(inp.name, val);
          if (!r.success) { flash('msg-api', r.error || 'Error', true); return; }
          saved++;
          inp.value = '';
          inp.placeholder = '********** (set)';
          var statusEl = inp.closest('div').parentElement.querySelector('span');
          if (statusEl) { statusEl.textContent = 'SET'; statusEl.style.color = '#22c55e'; }
        }
        flash('msg-api', saved > 0 ? saved + ' key(s) saved' : 'No changes');
      });

      /* Agent Limits */
      document.getElementById('agentLimitsForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var inputs = this.querySelectorAll('input[name]');
        var ok = true;
        for (var inp of inputs) { var r = await saveSetting(inp.name, inp.value.trim()); if (!r.success) { ok = false; flash('msg-agents', r.error || 'Error', true); break; } }
        if (ok) flash('msg-agents', 'Saved');
      });

      /* SEO forms */
      ['seoMetaForm', 'seoSocialForm', 'seoAnalyticsForm', 'seoJsonLdForm'].forEach(function(formId) {
        var form = document.getElementById(formId);
        if (!form) return;
        var msgId = formId === 'seoMetaForm' ? 'msg-seo-meta' : formId === 'seoSocialForm' ? 'msg-seo-social' : formId === 'seoAnalyticsForm' ? 'msg-seo-analytics' : 'msg-seo-jsonld';
        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          var fields = this.querySelectorAll('input[name], select[name], textarea[name]');
          var ok = true;
          for (var f of fields) { var r = await saveSetting(f.name, f.value.trim()); if (!r.success) { ok = false; flash(msgId, r.error || 'Error', true); break; } }
          if (ok) flash(msgId, 'Saved');
        });
      });

      /* Security, Appearance, Email, Backup forms — generic handler */
      var _settingsForms = {
        secLoginForm: 'msg-sec-login', secAccessForm: 'msg-sec-access', secAdvancedForm: 'msg-sec-advanced',
        appThemeForm: 'msg-app-theme', appRegionalForm: 'msg-app-regional',
        emailDefaultForm: 'msg-email-default',
        backupAutoForm: 'msg-backup-auto'
      };
      Object.keys(_settingsForms).forEach(function(formId) {
        var form = document.getElementById(formId);
        if (!form) return;
        var msgId = _settingsForms[formId];
        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          var fields = this.querySelectorAll('input[name], select[name], textarea[name]');
          var ok = true;
          for (var f of fields) {
            var val = f.type === 'color' ? f.value : f.value.trim();
            var r = await saveSetting(f.name, val);
            if (!r.success) { ok = false; flash(msgId, r.error || 'Error', true); break; }
          }
          if (ok) flash(msgId, 'Saved');
        });
      });

      /* Backup Now */
      window.doBackupNow = async function() {
        flash('msg-backup-now', 'Creating backup...', false);
        try {
          var r = await fetch('/admin/settings/api/backup', { method: 'POST', headers: headers, body: JSON.stringify({ _csrf: csrf }) }).then(function(r) { return r.json(); });
          if (r.success) flash('msg-backup-now', 'Backup saved: ' + (r.path || 'OK'));
          else flash('msg-backup-now', r.error || 'Failed', true);
        } catch(e) { flash('msg-backup-now', 'Error: ' + e.message, true); }
      };

      /* Add User modal */
      var modal = document.getElementById('addUserModal');
      var addBtn = document.getElementById('addUserBtn');
      if (addBtn) addBtn.addEventListener('click', function() { modal.style.display = 'flex'; });
      document.getElementById('closeUserModal').addEventListener('click', function() { modal.style.display = 'none'; });
      document.getElementById('cancelUserModal').addEventListener('click', function() { modal.style.display = 'none'; });
      document.getElementById('addUserForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var body = { _csrf: csrf, username: document.getElementById('new_username').value.trim(), email: document.getElementById('new_email').value.trim(), password: document.getElementById('new_password').value, role: document.getElementById('new_role').value };
        var data = await fetch('/admin/settings/api/users', { method: 'POST', headers: headers, body: JSON.stringify(body) }).then(function(r) { return r.json(); });
        if (data.success) location.reload();
        else alert(data.error || 'Failed to create user');
      });

      /* Reset Admin */
      var resetBtn = document.getElementById('resetAdminBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', async function() {
          var typed = prompt('This will DELETE ALL admin accounts and log you out.\\nType RESET to confirm:');
          if (typed !== 'RESET') return;
          var data = await fetch('/admin/settings/api/reset-admin', { method: 'POST', headers: headers, body: JSON.stringify({ _csrf: csrf }) }).then(function(r) { return r.json(); });
          if (data.success) { alert('All accounts deleted. Redirecting to setup...'); window.location.href = '/admin/setup'; }
          else alert(data.error || 'Reset failed');
        });
      }

      /* Change Role */
      document.querySelectorAll('.role-select').forEach(function(sel) {
        var prevValue = sel.value;
        sel.addEventListener('change', async function() {
          var id = this.dataset.id;
          var newRole = this.value;
          var data = await fetch('/admin/settings/api/users/' + id + '/role', { method: 'PUT', headers: headers, body: JSON.stringify({ _csrf: csrf, role: newRole }) }).then(function(r) { return r.json(); });
          if (data.success) { prevValue = newRole; }
          else { alert(data.error || 'Failed to change role'); sel.value = prevValue; }
        });
      });

      /* Reset Password */
      document.querySelectorAll('.reset-pw-btn').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var id = this.dataset.id;
          var username = this.dataset.username;
          var newPw = prompt('Enter new password for "' + username + '" (minimum 8 characters):');
          if (!newPw) return;
          if (newPw.length < 8) { alert('Password must be at least 8 characters'); return; }
          var data = await fetch('/admin/settings/api/users/' + id + '/password', { method: 'PUT', headers: headers, body: JSON.stringify({ _csrf: csrf, password: newPw }) }).then(function(r) { return r.json(); });
          if (data.success) { alert('Password reset successfully for ' + username + '. All their sessions have been logged out.'); }
          else alert(data.error || 'Failed to reset password');
        });
      });

      /* Delete User */
      document.querySelectorAll('.delete-user-btn').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var id = this.dataset.id;
          var isSelf = this.dataset.self === 'true';
          if (isSelf) { var typed = prompt('Deleting YOUR OWN account. Type DELETE to confirm:'); if (typed !== 'DELETE') return; }
          else { if (!confirm('Delete this user?')) return; }
          var data = await fetch('/admin/settings/api/users/' + id, { method: 'DELETE', headers: headers, body: JSON.stringify({ _csrf: csrf }) }).then(function(r) { return r.json(); });
          if (data.success) { if (data.selfDelete) { alert('Account deleted.'); window.location.href = '/admin/login'; } else location.reload(); }
          else alert(data.error || 'Failed to delete user');
        });
      });
    })();
    </script>
  `;

  const html = adminLayout({
    title: 'Settings',
    page: 'settings',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount,
    content
  });

  res.send(html);
});

// ---------------------------------------------------------------------------
// PUT /admin/settings/api — update a single setting
// ---------------------------------------------------------------------------
router.put('/api', requireAuth, requireRole('admin'), validateCsrf, (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }

    const isApiKey = /(_api_key|_token)$/i.test(String(key));
    const storeValue = isApiKey && value ? encrypt(value) : value;

    const existing = get(`SELECT key, value FROM settings WHERE key = ?`, [key]);
    const oldValue = existing ? existing.value : '';
    if (existing) {
      run(`UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?`, [storeValue, key]);
    } else {
      run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`, [key, storeValue]);
    }

    try {
      const actor = req.user.email || req.user.username || 'unknown';
      if (isApiKey) {
        const wasEmpty = !oldValue;
        const isEmpty = !value;
        if (wasEmpty && !isEmpty) {
          const t = 'API key added'; const m = `${actor} added a value for ${key}.`;
          insert('notifications', { type: 'api_key_added', title: t, message: m, is_read: 0 });
          dispatchNotification(t, m, 'api_key_added');
        } else if (!wasEmpty && isEmpty) {
          const t = 'API key removed'; const m = `${actor} cleared ${key}.`;
          insert('notifications', { type: 'api_key_removed', title: t, message: m, is_read: 0 });
          dispatchNotification(t, m, 'api_key_removed');
        } else if (oldValue !== storeValue) {
          const t = 'API key changed'; const m = `${actor} updated ${key}.`;
          insert('notifications', { type: 'api_key_added', title: t, message: m, is_read: 0 });
          dispatchNotification(t, m, 'api_key_added');
        }
      } else {
        const t = 'Settings changed'; const m = `${actor} changed setting "${key}".`;
        insert('notifications', { type: 'settings_changed', title: t, message: m, is_read: 0 });
        dispatchNotification(t, m, 'settings_changed');
      }
    } catch {}

    res.json({ success: true });
  } catch (err) {
    console.error('PUT /admin/settings/api error:', err);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/settings/api/users — create user
// ---------------------------------------------------------------------------
router.post('/api/users', requireAuth, requireRole('admin'), validateCsrf, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check uniqueness
    const existingUser = get(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    const existingEmail = get(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = insert('users', {
      username,
      email,
      password_hash: passwordHash,
      role: role || 'editor'
    });

    try {
      const title = 'New admin user created';
      const message = `${req.user.email} added ${email} (role: ${role || 'editor'}).`;
      insert('notifications', { type: 'user_new', title, message, is_read: 0 });
      dispatchNotification(title, message, 'user_new');
    } catch {}

    res.json({ success: true, userId: result.lastInsertRowid });
  } catch (err) {
    console.error('POST /admin/settings/api/users error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/settings/api/reset-admin — wipe all users → back to setup
// ---------------------------------------------------------------------------
router.post('/api/reset-admin', requireAuth, requireRole('admin'), validateCsrf, (req, res) => {
  try {
    run(`DELETE FROM sessions`);
    run(`DELETE FROM users`);
    res.clearCookie('admin_session');
    res.json({ success: true });
  } catch (err) {
    console.error('POST /admin/settings/api/reset-admin error:', err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

// ---------------------------------------------------------------------------
// PUT /admin/settings/api/users/:id/role — change user role
// ---------------------------------------------------------------------------
router.put('/api/users/:id/role', requireAuth, requireRole('admin'), validateCsrf, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body || {};

    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin, editor, or viewer.' });
    }

    const user = get(`SELECT id, role FROM users WHERE id = ?`, [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = (get(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`) || {}).c || 0;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last admin' });
      }
    }

    run(`UPDATE users SET role = ? WHERE id = ?`, [role, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /admin/settings/api/users/:id/role error:', err);
    res.status(500).json({ error: 'Failed to change role' });
  }
});

// ---------------------------------------------------------------------------
// PUT /admin/settings/api/users/:id/password — reset user password
// ---------------------------------------------------------------------------
router.put('/api/users/:id/password', requireAuth, requireRole('admin'), validateCsrf, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { password } = req.body || {};

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = get(`SELECT id, email FROM users WHERE id = ?`, [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const passwordHash = await bcrypt.hash(password, 12);
    run(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId]);
    run(`DELETE FROM sessions WHERE user_id = ?`, [userId]);

    try {
      const title = 'Password changed';
      const message = `${req.user.email} reset the password for ${user.email} (id=${user.id}).`;
      insert('notifications', { type: 'password_changed', title, message, is_read: 0 });
      dispatchNotification(title, message, 'password_changed');
    } catch {}

    res.json({ success: true });
  } catch (err) {
    console.error('PUT /admin/settings/api/users/:id/password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /admin/settings/api/users/:id — delete user
// ---------------------------------------------------------------------------
router.delete('/api/users/:id', requireAuth, requireRole('admin'), validateCsrf, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    const user = get(`SELECT id, role FROM users WHERE id = ?`, [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isSelf = userId === req.user.id;

    // Self-delete: only if another admin exists
    if (isSelf) {
      const otherAdmins = (get(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND id != ?`, [userId]) || {}).c || 0;
      if (otherAdmins === 0) {
        return res.status(400).json({ error: 'Create another admin account first before deleting yourself' });
      }
    }

    // Cannot delete the last admin (any delete)
    if (user.role === 'admin') {
      const adminCount = (get(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`) || {}).c || 0;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin user' });
      }
    }

    // Delete sessions first, then user
    run(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
    run(`DELETE FROM users WHERE id = ?`, [userId]);

    res.json({ success: true, selfDelete: isSelf });
  } catch (err) {
    console.error('DELETE /admin/settings/api/users/:id error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/settings/api/test-notifications — send test to all channels
// ---------------------------------------------------------------------------
router.post('/api/test-notifications', requireAuth, requireRole('admin'), validateCsrf, async (req, res) => {
  try {
    await dispatchNotification('Test Notification', 'This is a test from AIM Tech AI Admin Panel.', 'system');
    res.json({ success: true });
  } catch (err) {
    console.error('POST /admin/settings/api/test-notifications error:', err);
    res.status(500).json({ error: 'Test failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/settings/api/backup — create manual backup
// ---------------------------------------------------------------------------
router.post('/api/backup', requireAuth, requireRole('admin'), validateCsrf, (req, res) => {
  try {
    const backupDir = getSetting('backup_path', './data/backups');
    const absDir = path.resolve(__dirname, '..', '..', backupDir);
    const fs = require('fs');
    if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(absDir, `aimtechai-backup-${ts}.db`);
    const src = path.join(__dirname, '..', '..', 'data', 'aimtechai.db');
    fs.copyFileSync(src, dest);
    res.json({ success: true, path: dest });
  } catch (err) {
    console.error('POST /admin/settings/api/backup error:', err);
    res.status(500).json({ error: 'Backup failed: ' + err.message });
  }
});

function getSetting(key, fallback) {
  const row = get(`SELECT value FROM settings WHERE key = ?`, [key]);
  return (row && row.value) || fallback || '';
}

module.exports = router;
module.exports.decrypt = decrypt;

