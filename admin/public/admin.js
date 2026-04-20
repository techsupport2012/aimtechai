/* =========================================================================
   AIM Tech AI — Admin Panel Client-Side JS
   ========================================================================= */

(function () {
  'use strict';

  // --- Helpers ---------------------------------------------------------------

  /** HTML-escape a string */
  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  /** Get CSRF token from <meta name="csrf-token"> */
  function csrfToken() {
    const el = document.querySelector('meta[name="csrf-token"]');
    return el ? el.getAttribute('content') : '';
  }

  /** Fetch wrapper that adds CSRF header for mutations */
  function adminFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken()
    }, opts.headers || {});
    return fetch(url, opts);
  }

  /** Icon for notification type */
  const _si = (d) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  function typeIcon(type) {
    const icons = {
      contact: _si('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'),
      booking: _si('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
      blog:    _si('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'),
      agent:   _si('<circle cx="12" cy="12" r="3"/><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7"/>'),
      visitor: _si('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
      system:  _si('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06"/>'),
    };
    return icons[type] || _si('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>');
  }

  /** Relative time string */
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    var diff = (Date.now() - new Date(dateStr + 'Z').getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
    return new Date(dateStr).toLocaleDateString();
  }

  /** Open a modal by id */
  function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('open');
  }

  /** Close a modal by id */
  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('open');
  }

  // Expose helpers globally
  window.esc = esc;
  window.adminFetch = adminFetch;
  window.typeIcon = typeIcon;
  window.timeAgo = timeAgo;
  window.openModal = openModal;
  window.closeModal = closeModal;

  // --- Notification Dropdown -------------------------------------------------

  var bellBtn = document.getElementById('bellBtn');
  var dropdown = document.getElementById('notifDropdown');
  var notifList = document.getElementById('notifList');
  var bellBadge = document.getElementById('bellBadge');
  var markAllBtn = document.getElementById('markAllReadBtn');

  if (bellBtn && dropdown) {
    // Toggle dropdown on bell click
    bellBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.contains('open');
      dropdown.classList.toggle('open');
      if (!isOpen) loadNotifications();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target) && e.target !== bellBtn) {
        dropdown.classList.remove('open');
      }
    });

    // Mark all read
    if (markAllBtn) {
      markAllBtn.addEventListener('click', function () {
        adminFetch('/api/admin/notifications/read-all', { method: 'POST' })
          .then(function () {
            updateBadge(0);
            loadNotifications();
          });
      });
    }

    // Initial load & poll
    pollUnread();
    setInterval(pollUnread, 30000);
  }

  /** Fetch unread notifications and render them into the dropdown */
  function loadNotifications() {
    if (!notifList) return;
    fetch('/api/admin/notifications?unread=true')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var items = data.notifications || data || [];
        if (!items.length) {
          notifList.innerHTML = '<li class="notif-empty">No unread notifications</li>';
          return;
        }
        notifList.innerHTML = items.map(function (n) {
          return '<li class="notif-item' + (n.is_read ? '' : ' unread') + '"' +
            (n.link ? ' onclick="window.location.href=\'' + esc(n.link) + '\'"' : '') + '>' +
            '<span class="notif-icon">' + typeIcon(n.type) + '</span>' +
            '<div class="notif-body">' +
              '<div class="notif-title">' + esc(n.title) + '</div>' +
              '<div class="notif-msg">' + esc(n.message) + '</div>' +
              '<div class="notif-time">' + timeAgo(n.created_at) + '</div>' +
            '</div>' +
          '</li>';
        }).join('');
      })
      .catch(function () {
        notifList.innerHTML = '<li class="notif-empty">Failed to load</li>';
      });
  }

  /** Poll for unread count and update badge */
  function pollUnread() {
    fetch('/api/admin/notifications?unread=true&count=true')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var count = typeof data.count === 'number' ? data.count : 0;
        updateBadge(count);
      })
      .catch(function () { /* silent */ });
  }

  /** Update bell badge number */
  function updateBadge(count) {
    if (!bellBadge) return;
    if (count > 0) {
      bellBadge.textContent = count > 99 ? '99+' : count;
      bellBadge.classList.remove('hidden');
    } else {
      bellBadge.classList.add('hidden');
    }
  }

  // --- Modal close on overlay click ------------------------------------------
  document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // --- Sidebar collapse toggle ------------------------------------------------
  var sidebarEl = document.getElementById('sidebar');
  var sidebarBtn = document.getElementById('sidebarToggle');
  if (sidebarBtn && sidebarEl) {
    // Sync .collapsed on sidebar with html.sb-collapsed (set by head script)
    var isCollapsed = localStorage.getItem('sidebar-collapsed') === '1';
    if (isCollapsed) sidebarEl.classList.add('collapsed');

    sidebarBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var nowCollapsed = !sidebarEl.classList.contains('collapsed');
      sidebarEl.classList.toggle('collapsed');
      document.documentElement.classList.toggle('sb-collapsed', nowCollapsed);
      localStorage.setItem('sidebar-collapsed', nowCollapsed ? '1' : '0');
    });
  }

  // --- Dark / Light mode toggle ----------------------------------------------
  var themeBtn = document.getElementById('themeToggle');
  var themeIcon = document.getElementById('themeIcon');
  var moonPath = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  var sunPath = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';

  function updateThemeIcon() {
    if (!themeIcon) return;
    var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    themeIcon.innerHTML = isDark ? moonPath : sunPath;
  }
  updateThemeIcon();

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      var newTheme = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('admin-theme', newTheme);
      updateThemeIcon();
    });
  }

  // Apply saved theme on load
  var savedTheme = localStorage.getItem('admin-theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon();
  }

  // --- Client-side DOM translator -------------------------------------------
  // Translates all visible static text using window.__t (set by server).
  // Skips: input values, textarea content, code/pre, script, style, elements
  // with data-notranslate attribute, and any user-generated content.
  (function translateDOM() {
    if (!window.__t || window.__adminLang === 'en') return;
    var dict = window.__t;
    // Build reverse map: English text → translated text
    // We need the English strings to match against. Load them from the en dict
    // which is embedded alongside the target lang.
    var enDict = null;
    try {
      // The server injects __t as the target language dict.
      // We build reverse: for each key, if the DOM contains the English value, replace with translated.
      // English fallback values are the keys themselves for common words.
    } catch(e) {}

    // Build map of English → Target for all known keys
    var enStrings = {
      'Dashboard':'dashboard','Visitors':'visitors','Notifications':'notifications','Pages':'pages',
      'Blog':'blog','Contacts':'contacts','Pipeline':'pipeline','Bookings':'bookings','Agents':'agents',
      'Settings':'settings','Logout':'logout',
      'Save':'save','Cancel':'cancel','Confirm':'confirm','Delete':'delete','Edit':'edit','Create':'create',
      'New':'new','Search':'search','Clear':'clear','Back':'back','Close':'close','Submit':'submit',
      'Add':'add','Remove':'remove','Reset':'reset','Refresh':'refresh','Download':'download','Upload':'upload',
      'Name':'name','Email':'email','Phone':'phone','Date':'date','Time':'time','Status':'status','Actions':'actions',
      'Total':'total','Type':'type','Role':'role','ID':'id','Username':'username','Password':'password',
      'Description':'description','Category':'category','Tags':'tags','Title':'title','Content':'content',
      'Message':'message','Notes':'notes','Value':'value','Address':'address',
      'Welcome back':'welcome_back','Recent Activity':'recent_activity','Quick Actions':'quick_actions',
      'View all':'view_all','Manage':'manage','Open':'open','View Site':'view_site','New Post':'new_post',
      'System':'system','Unread':'unread','Agent Runs Today':'agent_runs_today','Blog Posts':'blog_posts',
      'Total Pages':'total_pages','Deals':'deals',
      'Today':'today','This Week':'this_week_cap','This Month':'this_month','All Time':'all_time',
      'Live Now':'live_now','Avg Pages/Visit':'avg_pages_visit','Published':'published','Drafts':'drafts',
      'Pending':'pending','Confirmed':'confirmed','Cancelled':'cancelled','Calendar':'calendar',
      'Incoming':'incoming','Outgoing':'outgoing','Confirmation':'confirmation',
      'Week':'week','Month':'month','Year':'year','Day':'day',
      'Booking Detail':'booking_detail','Timezone':'timezone','Created':'created',
      'Working Days':'working_days','Slot Duration':'slot_duration','Start Time':'start_time',
      'End Time':'end_time','Buffer':'buffer','Max Per Slot':'max_per_slot',
      'Availability Schedule':'availability_schedule','Capacity':'capacity',
      'Confirmation Email':'confirmation_email','Cancellation Email':'cancellation_email',
      'Reminder':'reminder','SMTP Configuration':'smtp_configuration',
      'Save Incoming Settings':'save_incoming','Save Outgoing Settings':'save_outgoing',
      'Hours Before Appointment':'hours_before',
      'Add Contact':'add_contact','Source':'source',
      'New Deal':'new_deal','Stage':'stage',
      'Top Pages':'top_pages','Top Referrers':'top_referrers','Top Countries':'top_countries',
      'Browsers':'browsers','Devices':'devices','Operating Systems':'operating_systems',
      'Recent Visitors':'recent_visitors','IP Address':'ip_address','City':'city','Country':'country',
      'Landing Page':'landing_page','Referrer':'referrer','Browser':'browser','Duration':'duration',
      'When':'when','Device':'device',
      'Inbox':'inbox','Telegram':'telegram','Discord':'discord','WhatsApp':'whatsapp','SMS':'sms',
      'Mark all read':'mark_all_read','Clear 30+ days':'clear_old','Send Test':'send_test',
      'General':'general','Users':'users','API Keys':'api_keys','Security':'security',
      'Appearance':'appearance','Backup':'backup','Danger':'danger','SEO':'seo',
      'Site Configuration':'site_configuration','Company Name':'company_name',
      'User Accounts':'user_accounts','Add User':'add_user',
      'Default Meta Tags':'default_meta_tags','Social Media':'social_media',
      'Verification & Analytics':'verification_analytics','Structured Data':'structured_data',
      'Login & Session':'login_session','Access Control':'access_control','Advanced':'advanced',
      'Theme & Layout':'theme_layout','Regional':'regional','Default Admin Theme':'default_admin_theme',
      'Accent Color':'accent_color','UI Density':'ui_density','Date Format':'date_format',
      'Language':'language','Sidebar Position':'sidebar_position',
      'Auto Backup':'auto_backup','Frequency':'frequency','Retain':'retain','Backup Path':'backup_path',
      'Backup Now':'backup_now','Manual Backup':'manual_backup',
      'Reset Admin Panel':'reset_admin','Danger Zone':'danger_zone',
      'Max Tokens / Run':'max_tokens','Max Runs / Hour':'max_runs_hour','Max Runs / Day':'max_runs_day',
      'Agent Limits':'agent_limits','Email Settings':'email_settings',
      'Cancel Booking':'cancel_booking_title',
      'Go Back':'go_back','Confirm Cancellation':'confirm_cancellation',
      'Saved':'saved','Error':'error','Loading...':'loading','No data yet':'no_data',
      'ON':'on','OFF':'off','Enabled':'enabled','Disabled':'disabled',
      'Compact':'compact','Default':'default_density','Comfortable':'comfortable',
      'Dark':'dark','Light':'light','Left':'left','Right':'right',
      'Provider':'provider','Model':'model','Run':'run',
    };

    // Build final English→Translated map
    var map = {};
    for (var en in enStrings) {
      var key = enStrings[en];
      if (dict[key] && dict[key] !== en) map[en] = dict[key];
    }
    if (Object.keys(map).length === 0) return;

    // Sort by length descending so longer phrases match first
    var sorted = Object.keys(map).sort(function(a, b) { return b.length - a.length; });

    // Skip these elements
    var SKIP = { SCRIPT:1, STYLE:1, TEXTAREA:1, CODE:1, PRE:1, INPUT:1, SELECT:1, OPTION:1 };

    function walk(node) {
      if (node.nodeType === 3) { // Text node
        var txt = node.textContent;
        var changed = false;
        for (var i = 0; i < sorted.length; i++) {
          var en = sorted[i];
          if (txt.indexOf(en) !== -1) {
            txt = txt.split(en).join(map[en]);
            changed = true;
          }
        }
        if (changed) node.textContent = txt;
        return;
      }
      if (node.nodeType !== 1) return;
      if (SKIP[node.tagName]) return;
      if (node.getAttribute('data-notranslate') !== null) return;
      if (node.classList && node.classList.contains('notranslate')) return;
      // Skip user content areas
      if (node.id === 'bd-name' || node.id === 'bd-email' || node.id === 'bd-notes') return;
      for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
    }

    // Translate placeholder attributes too
    document.querySelectorAll('[placeholder]').forEach(function(el) {
      if (SKIP[el.tagName]) return;
      var ph = el.getAttribute('placeholder');
      for (var i = 0; i < sorted.length; i++) {
        if (ph.indexOf(sorted[i]) !== -1) {
          ph = ph.split(sorted[i]).join(map[sorted[i]]);
        }
      }
      el.setAttribute('placeholder', ph);
    });

    walk(document.body);
  })();

})();
