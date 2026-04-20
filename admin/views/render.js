/**
 * Admin layout renderer — returns full HTML string for admin pages.
 */

const { get } = require('../../db/db');
const { t, translations } = require('../i18n');

function getSetting(key, fallback = '') {
  const row = get('SELECT value FROM settings WHERE key = ?', [key]);
  return (row && row.value) || fallback;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Flat SVG icons (16x16 viewBox, stroke-based, currentColor)
const svgIcon = (d, fill) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="${fill||'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  dashboard:     svgIcon('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
  visitors:      svgIcon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
  notifications: svgIcon('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
  pages:         svgIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
  blog:          svgIcon('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'),
  contacts:      svgIcon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  pipeline:      svgIcon('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
  bookings:      svgIcon('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
  agents:        svgIcon('<path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27A7 7 0 0 1 7.27 19H6a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h-1V5.73A2 2 0 0 1 12 2z"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/>'),
  kb:            svgIcon('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  settings:      svgIcon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  logout:        svgIcon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
  bell:          svgIcon('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
};

const NAV_ITEMS = [
  { key: 'dashboard', icon: ICONS.dashboard, href: '/admin' },
  { key: 'visitors', icon: ICONS.visitors, href: '/admin/visitors' },
  { key: 'notifications', icon: ICONS.notifications, href: '/admin/notifications', badge: true },
  { key: 'pages', icon: ICONS.pages, href: '/admin/pages' },
  { key: 'blog', icon: ICONS.blog, href: '/admin/blog' },
  { key: 'contacts', icon: ICONS.contacts, href: '/admin/contacts' },
  { key: 'pipeline', icon: ICONS.pipeline, href: '/admin/pipeline' },
  { key: 'bookings', icon: ICONS.bookings, href: '/admin/bookings' },
  { key: 'agents', icon: ICONS.agents, href: '/admin/agents' },
  { key: 'kb', icon: ICONS.kb, href: '/admin/kb' },
  { key: 'settings', icon: ICONS.settings, href: '/admin/settings' }
];

/**
 * @param {object} opts
 * @param {string} opts.title     - Page title shown in topbar
 * @param {string} opts.page      - Active nav key (e.g. 'dashboard')
 * @param {object} opts.user      - { username, role }
 * @param {string} opts.csrfToken - CSRF token string
 * @param {number} opts.unreadCount - Unread notifications count
 * @param {string} opts.content   - Inner HTML for content area
 */
function adminLayout({ title, page, user, csrfToken, unreadCount = 0, content = '' }) {
  const gtmId = getSetting('seo_gtm_id', '');

  // Appearance settings
  const appTheme = getSetting('app_admin_theme', 'dark');
  const appDensity = getSetting('app_density', 'default');
  const appDateFormat = getSetting('app_date_format', 'MM/DD/YYYY');
  const appLang = getSetting('app_language', 'en');
  const appSidebarPos = getSetting('app_sidebar_position', 'left');
  const gaId  = getSetting('seo_ga_id', '');

  const gtmHeadScript = gtmId ? `
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(gtmId)}');</script>
  <!-- End Google Tag Manager -->` : '';

  const gaHeadScript = gaId ? `
  <!-- Google Analytics 4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${esc(gaId)}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc(gaId)}');</script>
  <!-- End Google Analytics 4 -->` : '';

  const navHtml = NAV_ITEMS.map(item => {
    const active = item.key === page ? ' active' : '';
    const badgeHtml = item.badge && unreadCount > 0
      ? `<span class="nav-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>`
      : '';
    return `<li><a href="${item.href}" class="${active}"><span class="nav-icon">${item.icon}</span><span class="nav-label">${t(appLang, item.key)}</span>${badgeHtml}</a></li>`;
  }).join('\n          ');

  return `<!DOCTYPE html>
<html lang="${appLang}" data-density="${appDensity}" data-sidebar="${appSidebarPos}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="${esc(csrfToken)}">
  <title>${esc(title)} — ${esc(getSetting('company_name', 'AIM Tech AI'))} Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/admin/assets/admin.css">
  <script>
    /* Apply sidebar + theme state before first paint to prevent flash */
    (function(){
      var dbTheme = '${appTheme}';
      var t = localStorage.getItem('admin-theme') || (dbTheme === 'system' ? (matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark') : dbTheme);
      if (t) document.documentElement.setAttribute('data-theme', t);
      if (localStorage.getItem('sidebar-collapsed') === '1') document.documentElement.classList.add('sb-collapsed');
      window.__adminDateFormat = '${appDateFormat}';
      window.__adminLang = '${appLang}';
      window.__t = ${JSON.stringify(translations[appLang] || translations.en)};
    })();
  </script>${gtmHeadScript}${gaHeadScript}${(function(){
    const hex = getSetting('app_accent_color', '#0FC1B7');
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
    if (!m) return '';
    const [r, g, b] = [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)];
    return `\n  <style>:root { --teal: ${hex}; --teal-dim: rgba(${r},${g},${b},0.15); }</style>`;
  })()}
</head>
<body>
  <!-- Sidebar -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <img src="/assets/aim_transparent_logo.png" alt="AIM" class="sidebar-logo-icon logo-dark" />
      <img src="/assets/black_aim_transparent_logo.png" alt="AIM" class="sidebar-logo-icon logo-light" style="display:none;" />
      <span class="sidebar-logo-text">${(function(){
        const name = getSetting('company_name', 'AIM Tech AI');
        const parts = name.trim().split(/\s+/);
        if (parts.length === 3) return `${esc(parts[0])}<span>${esc(parts[1])}</span>${esc(parts[2])}`;
        return esc(name);
      })()}</span>
    </div>
    <ul class="sidebar-nav">
          ${navHtml}
    </ul>
    <div class="sidebar-footer">
      <button onclick="try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith('aim_'))localStorage.removeItem(k);}}catch(e){}document.getElementById('logoutForm').submit()">
        <span class="nav-icon">${ICONS.logout}</span><span class="nav-label">${t(appLang, "logout")}</span>
      </button>
    </div>
  </aside>
  <button class="sidebar-toggle-btn" id="sidebarToggle" title="Toggle sidebar">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
  </button>

  <!-- Main -->
  <div class="main-area">
    <header class="topbar">
      <h1 class="topbar-title">${esc(title)}</h1>
      <div class="topbar-actions">
        <button class="topbar-bell" id="bellBtn" aria-label="Notifications">
          ${ICONS.bell}
          <span class="bell-badge${unreadCount > 0 ? '' : ' hidden'}" id="bellBadge">${unreadCount > 99 ? '99+' : unreadCount}</span>
        </button>

        <!-- Notification dropdown -->
        <div class="notif-dropdown" id="notifDropdown">
          <div class="notif-header">
            <span>Notifications</span>
            <button id="markAllReadBtn">Mark all read</button>
          </div>
          <ul class="notif-list" id="notifList">
            <li class="notif-empty">Loading\u2026</li>
          </ul>
        </div>

        <button class="topbar-theme-toggle" id="themeToggle" aria-label="Toggle theme" style="background:none;border:1px solid var(--border);border-radius:8px;width:34px;height:34px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-muted);transition:all .2s;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="themeIcon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
        <span class="topbar-user">${esc(user && user.username)}</span>
      </div>
    </header>

    <main class="content-area">
      ${content}
    </main>
  </div>

  <!-- Logout form (hidden) -->
  <form id="logoutForm" method="POST" action="/admin/logout" style="display:none">
    <input type="hidden" name="_csrf" value="${esc(csrfToken)}">
  </form>

  <script src="/admin/assets/admin.js"></script>
  <script src="/js/dev-indicator.js" defer></script>
</body>
</html>`;
}

module.exports = { adminLayout };
