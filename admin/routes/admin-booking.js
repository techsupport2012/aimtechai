const express = require('express');
const router = express.Router();

const { get, all, run, insert } = require('../../db/db');
const { requireAuth, requireRole, validateCsrf } = require('../middleware/auth');
const { adminLayout } = require('../views/render');

// ---------------------------------------------------------------------------
// Helper: HTML-escape
// ---------------------------------------------------------------------------
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Helper: read a setting with fallback
// ---------------------------------------------------------------------------
function getSetting(key, fallback) {
  const row = get(`SELECT value FROM settings WHERE key = ?`, [key]);
  return (row && row.value) || fallback || '';
}

// ---------------------------------------------------------------------------
// Helper: get Monday of the week containing a given date
// ---------------------------------------------------------------------------
function getMonday(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when Sunday
  const mon = new Date(d);
  mon.setDate(diff);
  return mon;
}

// ---------------------------------------------------------------------------
// Helper: format date as YYYY-MM-DD
// ---------------------------------------------------------------------------
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ---------------------------------------------------------------------------
// Helper: generate time slots between start and end with given duration
// ---------------------------------------------------------------------------
function generateSlots(startStr, endStr, durationMin) {
  const slots = [];
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  for (let m = startMin; m < endMin; m += durationMin) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

// ---------------------------------------------------------------------------
// Helper: day names
// ---------------------------------------------------------------------------
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// GET / — Week calendar view
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (req, res) => {
  try {
    const unreadCount = (get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;

    // Booking settings
    const bookingStart = getSetting('booking_start', '09:00');
    const bookingEnd = getSetting('booking_end', '17:00');
    const bookingDuration = parseInt(getSetting('booking_duration', '30'), 10) || 30;

    // View mode & time format
    const view = req.query.view || 'week';
    const tf = req.query.tf || '12';

    // Helper: format time slot for display
    function fmtSlot(slot) {
      if (tf === '24') return slot;
      const [h, m] = slot.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
    }

    // Carry view & tf through nav links
    const qp = (extra) => { const p = new URLSearchParams(extra); p.set('view', view); p.set('tf', tf); return p.toString(); };

    // Week navigation
    const monday = getMonday(req.query.week);
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d);
    }
    const mondayStr = fmtDate(weekDates[0]);
    const sundayStr = fmtDate(weekDates[6]);

    // Prev / next week
    const prevMon = new Date(monday);
    prevMon.setDate(monday.getDate() - 7);
    const nextMon = new Date(monday);
    nextMon.setDate(monday.getDate() + 7);

    // Month view dates
    const monthDate = req.query.month ? new Date(req.query.month + '-01T00:00:00') : new Date();
    const monthYear = monthDate.getFullYear();
    const monthIdx = monthDate.getMonth();
    const monthFirst = fmtDate(new Date(monthYear, monthIdx, 1));
    const monthLast = fmtDate(new Date(monthYear, monthIdx + 1, 0));
    const prevMonth = fmtDate(new Date(monthYear, monthIdx - 1, 1));
    const nextMonth = fmtDate(new Date(monthYear, monthIdx + 1, 1));
    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    // Day view
    const dayDate = req.query.day ? new Date(req.query.day + 'T00:00:00') : new Date();
    const dayStr = fmtDate(dayDate);
    const prevDay = new Date(dayDate); prevDay.setDate(dayDate.getDate() - 1);
    const nextDay = new Date(dayDate); nextDay.setDate(dayDate.getDate() + 1);
    const dayLabel = dayDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Year view
    const yearVal = parseInt(req.query.year) || new Date().getFullYear();
    const yearFirst = yearVal + '-01-01';
    const yearLast = yearVal + '-12-31';

    // Determine date range for fetching bookings
    let fetchStart, fetchEnd;
    if (view === 'day') { fetchStart = dayStr; fetchEnd = dayStr; }
    else if (view === 'month') { fetchStart = monthFirst; fetchEnd = monthLast; }
    else if (view === 'year') { fetchStart = yearFirst; fetchEnd = yearLast; }
    else { fetchStart = mondayStr; fetchEnd = sundayStr; }

    // Time slots
    const slots = generateSlots(bookingStart, bookingEnd, bookingDuration);

    // Fetch bookings for the range
    const bookings = all(
      `SELECT * FROM bookings WHERE date BETWEEN ? AND ? ORDER BY date, time`,
      [fetchStart, fetchEnd]
    );

    // All bookings (for confirmation tab) — most recent first
    const allBookings = all(`SELECT * FROM bookings ORDER BY created_at DESC LIMIT 100`);
    const pendingCount = allBookings.filter(b => b.status === 'pending').length;
    const confirmedCount = allBookings.filter(b => b.status === 'confirmed').length;
    const cancelledCount = allBookings.filter(b => b.status === 'cancelled').length;

    // Build lookup: "YYYY-MM-DD|HH:MM" → booking
    const lookup = {};
    for (const b of bookings) {
      const key = `${b.date}|${b.time}`;
      if (!lookup[key]) lookup[key] = [];
      lookup[key].push(b);
    }

    // Build header row
    const headerCells = weekDates.map(d => {
      const dayName = DAY_NAMES[d.getDay()];
      const dateStr = fmtDate(d);
      const isToday = dateStr === fmtDate(new Date());
      return `<th style="text-align:center;min-width:120px;${isToday ? 'background:var(--accent-dim, rgba(20,184,166,0.08));' : ''}">${dayName}<br><small>${dateStr.slice(5)}</small></th>`;
    }).join('');

    // Build table body
    const bodyRows = slots.map(slot => {
      const cells = weekDates.map(d => {
        const dateStr = fmtDate(d);
        const key = `${dateStr}|${slot}`;
        const list = lookup[key];
        if (list && list.length > 0) {
          return list.map(b => {
            let bgStyle = '';
            let textStyle = '';
            if (b.status === 'pending') {
              bgStyle = 'background:#facc15;color:#000;';
            } else if (b.status === 'confirmed') {
              bgStyle = 'background:#22c55e33;color:#22c55e;';
            } else if (b.status === 'cancelled') {
              bgStyle = 'background:#ef444422;color:#ef4444;text-decoration:line-through;';
            }
            return `<td style="text-align:center;cursor:pointer;${bgStyle}"
              class="booking-cell"
              data-id="${b.id}"
              data-name="${esc(b.name)}"
              data-email="${esc(b.email)}"
              data-notes="${esc(b.notes)}"
              data-timezone="${esc(b.client_timezone)}"
              data-status="${esc(b.status)}"
              data-date="${esc(b.date)}"
              data-time="${esc(b.time)}"
              data-created="${esc(b.created_at)}"
              onclick="showBookingDetail(this)"
            >${esc(b.name)}</td>`;
          }).join('');
        }
        return `<td style="text-align:center;color:var(--muted,#666)">&mdash;</td>`;
      }).join('');
      return `<tr><td style="white-space:nowrap;font-weight:500;padding-right:1rem;font-size:.85rem;">${fmtSlot(slot)}</td>${cells}</tr>`;
    }).join('');

    // --- Month view: calendar grid ---
    const monthBookingsByDate = {};
    bookings.forEach(b => {
      if (!monthBookingsByDate[b.date]) monthBookingsByDate[b.date] = [];
      monthBookingsByDate[b.date].push(b);
    });
    const daysInMonth = new Date(monthYear, monthIdx + 1, 0).getDate();
    const firstDow = new Date(monthYear, monthIdx, 1).getDay();
    const todayStr = fmtDate(new Date());
    let monthCells = '';
    for (let i = 0; i < firstDow; i++) monthCells += '<div class="mcal-day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = fmtDate(new Date(monthYear, monthIdx, d));
      const dayBookings = monthBookingsByDate[ds] || [];
      const isToday = ds === todayStr;
      const pending = dayBookings.filter(b => b.status === 'pending').length;
      const confirmed = dayBookings.filter(b => b.status === 'confirmed').length;
      monthCells += '<div class="mcal-day' + (isToday ? ' today' : '') + '">' +
        '<div class="mcal-num">' + d + '</div>' +
        (dayBookings.length > 0 ? '<div class="mcal-dots">' +
          (confirmed > 0 ? '<span style="background:#22c55e;">' + confirmed + '</span>' : '') +
          (pending > 0 ? '<span style="background:#facc15;color:#000;">' + pending + '</span>' : '') +
        '</div>' : '') +
      '</div>';
    }

    // --- Year view: monthly summary grid ---
    const yearBookings = {};
    bookings.forEach(b => {
      const m = parseInt(b.date.slice(5, 7), 10) - 1;
      if (!yearBookings[m]) yearBookings[m] = { total: 0, pending: 0, confirmed: 0, cancelled: 0 };
      yearBookings[m].total++;
      if (b.status === 'pending') yearBookings[m].pending++;
      else if (b.status === 'confirmed') yearBookings[m].confirmed++;
      else yearBookings[m].cancelled++;
    });
    const yearCards = MONTH_NAMES.map((name, i) => {
      const s = yearBookings[i] || { total: 0, pending: 0, confirmed: 0, cancelled: 0 };
      return '<div class="ycal-card">' +
        '<div class="ycal-name">' + name + '</div>' +
        '<div class="ycal-total">' + s.total + '</div>' +
        (s.total > 0 ? '<div class="ycal-breakdown">' +
          (s.confirmed > 0 ? '<span style="color:#22c55e;">' + s.confirmed + ' conf</span>' : '') +
          (s.pending > 0 ? '<span style="color:#facc15;">' + s.pending + ' pend</span>' : '') +
          (s.cancelled > 0 ? '<span style="color:#ef4444;">' + s.cancelled + ' canc</span>' : '') +
        '</div>' : '<div class="ycal-breakdown" style="color:var(--muted);">No bookings</div>') +
      '</div>';
    }).join('');

    // --- Day view: single column of time slots ---
    const dayBodyRows = slots.map(slot => {
      const key = `${dayStr}|${slot}`;
      const list = lookup[key];
      let cellContent = '<span style="color:var(--muted,#666);">&mdash; Available</span>';
      let cellStyle = '';
      if (list && list.length > 0) {
        cellContent = list.map(b => {
          let bg = '';
          if (b.status === 'pending') bg = 'background:#facc15;color:#000;';
          else if (b.status === 'confirmed') bg = 'background:#22c55e33;color:#22c55e;';
          else if (b.status === 'cancelled') bg = 'background:#ef444422;color:#ef4444;text-decoration:line-through;';
          return '<div class="booking-cell" style="padding:.4rem .6rem;border-radius:6px;cursor:pointer;' + bg + '"' +
            ' data-id="' + b.id + '" data-name="' + esc(b.name) + '" data-email="' + esc(b.email) + '"' +
            ' data-notes="' + esc(b.notes) + '" data-timezone="' + esc(b.client_timezone) + '"' +
            ' data-status="' + esc(b.status) + '" data-date="' + esc(b.date) + '" data-time="' + esc(b.time) + '"' +
            ' data-created="' + esc(b.created_at) + '" onclick="showBookingDetail(this)">' +
            '<strong>' + esc(b.name) + '</strong>' +
            '<span style="margin-left:.5rem;font-size:.8rem;opacity:.7;">' + esc(b.email) + '</span>' +
            '<span style="float:right;font-size:.78rem;">' + esc(b.status) + '</span>' +
          '</div>';
        }).join('');
      }
      return '<tr><td style="white-space:nowrap;font-weight:500;width:100px;font-size:.85rem;">' + fmtSlot(slot) + '</td><td>' + cellContent + '</td></tr>';
    }).join('');

    // Read all settings needed for the settings panel
    const timezone = getSetting('timezone', 'America/Los_Angeles');
    const bookingDaysStr = getSetting('booking_days', '1,2,3,4,5');
    const bookingDays = bookingDaysStr.split(',').map(Number);
    const maxPerSlot = parseInt(getSetting('booking_max_per_slot', '1'), 10) || 1;
    const bufferMin = parseInt(getSetting('booking_buffer', '15'), 10) || 0;
    const confirmEmail = getSetting('booking_confirm_email', '1');
    const confirmEmailTemplate = getSetting('booking_confirm_template', 'Hi {{name}},\\n\\nYour consultation on {{date}} at {{time}} ({{timezone}}) has been confirmed.\\n\\nBest regards,\\nAIM Tech AI');
    const reminderEnabled = getSetting('booking_reminder_enabled', '0');
    const reminderHoursBefore = getSetting('booking_reminder_hours', '24');
    const cancelEnabled = getSetting('booking_cancel_email', '1');
    const cancelTemplate = getSetting('booking_cancel_template', 'Hi {{name}},\\n\\nYour consultation on {{date}} at {{time}} has been cancelled.\\n\\nIf this was a mistake, please rebook at https://aimtechai.com/book\\n\\nBest regards,\\nAIM Tech AI');

    // SMTP settings for booking emails
    const smtpHost = getSetting('booking_smtp_host', '');
    const smtpPort = getSetting('booking_smtp_port', '587');
    const smtpUser = getSetting('booking_smtp_user', '');
    const smtpPass = getSetting('booking_smtp_pass', '');
    const smtpFrom = getSetting('booking_smtp_from', '');
    const smtpSecure = getSetting('booking_smtp_secure', '0');

    const content = `
    <style>
      .cal-table { width:100%; border-collapse:collapse; font-size:.9rem; }
      .cal-table th, .cal-table td { padding:.5rem .6rem; border:1px solid var(--border, #333); }
      .cal-table th { color:var(--muted, #888); font-weight:500; font-size:.82rem; text-transform:uppercase; letter-spacing:.03em; }
      .cal-table tr:hover { background:var(--surface-hover, rgba(255,255,255,.04)); }
      .booking-cell:hover { opacity:.85; }
      .cal-toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:.5rem; }
      .cal-nav { display:flex; align-items:center; gap:.5rem; }
      .cal-nav a { color:var(--accent, #14b8a6); text-decoration:none; font-weight:600; padding:.35rem .7rem; border:1px solid var(--accent, #14b8a6); border-radius:6px; font-size:.82rem; }
      .cal-nav a:hover { background:var(--accent, #14b8a6); color:#fff; }
      .cal-nav h3 { font-size:.95rem; margin:0; white-space:nowrap; }
      .cal-controls { display:flex; align-items:center; gap:.6rem; }
      .view-btns { display:flex; gap:0; }
      .view-btn { padding:.35rem .7rem; border:1px solid var(--border, #333); background:none; color:var(--muted, #888); cursor:pointer; font-size:.78rem; font-weight:600; transition:all .15s; }
      .view-btn:first-child { border-radius:6px 0 0 6px; }
      .view-btn:last-child { border-radius:0 6px 6px 0; }
      .view-btn:not(:first-child) { border-left:none; }
      .view-btn.active { background:var(--accent, #14b8a6); color:#fff; border-color:var(--accent, #14b8a6); }
      .view-btn:hover:not(.active) { color:var(--text, #fff); }
      .tf-toggle { display:flex; align-items:center; gap:.3rem; font-size:.75rem; color:var(--muted, #888); font-weight:500; }
      .tf-toggle button { padding:.25rem .5rem; border:1px solid var(--border, #333); background:none; color:var(--muted, #888); cursor:pointer; font-size:.75rem; font-weight:600; }
      .tf-toggle button:first-of-type { border-radius:4px 0 0 4px; }
      .tf-toggle button:last-of-type { border-radius:0 4px 4px 0; border-left:none; }
      .tf-toggle button.active { background:var(--accent, #14b8a6); color:#fff; border-color:var(--accent, #14b8a6); }
      /* Month calendar */
      .mcal-grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:2px; }
      .mcal-header { text-align:center; font-size:.72rem; font-weight:600; color:var(--muted, #888); padding:.4rem; text-transform:uppercase; letter-spacing:.05em; }
      .mcal-day { min-height:70px; padding:.4rem; border:1px solid var(--border, #333); border-radius:4px; font-size:.82rem; }
      .mcal-day.empty { border-color:transparent; }
      .mcal-day.today { border-color:var(--accent, #14b8a6); background:rgba(15,193,183,.05); }
      .mcal-num { font-weight:600; font-size:.8rem; margin-bottom:.3rem; }
      .mcal-dots { display:flex; gap:.25rem; flex-wrap:wrap; }
      .mcal-dots span { font-size:.65rem; font-weight:600; padding:.1rem .35rem; border-radius:3px; }
      /* Year calendar */
      .ycal-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:.8rem; }
      .ycal-card { padding:.8rem; border:1px solid var(--border, #333); border-radius:8px; text-align:center; }
      .ycal-name { font-size:.78rem; font-weight:600; color:var(--muted, #888); text-transform:uppercase; letter-spacing:.04em; margin-bottom:.3rem; }
      .ycal-total { font-size:1.5rem; font-weight:700; }
      .ycal-breakdown { font-size:.7rem; margin-top:.2rem; display:flex; justify-content:center; gap:.5rem; }
      @media (max-width:768px) { .ycal-grid { grid-template-columns:repeat(2, 1fr); } }
      #booking-detail { display:none; margin-top:1rem; }
      .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:.6rem 1.5rem; }
      .detail-grid label { font-weight:500; color:var(--muted, #888); font-size:.82rem; text-transform:uppercase; letter-spacing:.03em; }
      .detail-grid span { font-size:.95rem; }
      .detail-actions { margin-top:1rem; display:flex; gap:.6rem; }
      .btn-confirm { padding:.5rem 1.2rem; background:#22c55e; color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; }
      .btn-confirm:hover { opacity:.9; }
      .btn-cancel-booking { padding:.5rem 1.2rem; background:#ef4444; color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; }
      .btn-cancel-booking:hover { opacity:.9; }

      /* Booking tabs */
      .booking-tabs { display:flex; gap:0; margin-bottom:1.5rem; border-bottom:2px solid var(--border, #333); }
      .booking-tab { padding:.7rem 1.4rem; cursor:pointer; font-weight:600; font-size:.9rem; color:var(--muted, #888); border-bottom:2px solid transparent; margin-bottom:-2px; transition:all .2s; background:none; border-top:none; border-left:none; border-right:none; }
      .booking-tab:hover { color:var(--text, #fff); }
      .booking-tab.active { color:var(--accent, #14b8a6); border-bottom-color:var(--accent, #14b8a6); }
      .tab-panel { display:none; }
      .tab-panel.active { display:block; }

      /* Settings form */
      .settings-section { margin-bottom:1.5rem; }
      .settings-section h4 { font-size:.95rem; font-weight:600; margin-bottom:.8rem; display:flex; align-items:center; gap:.5rem; }
      .settings-section h4 svg { opacity:.6; }
      .form-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:.8rem; }
      .form-row.three-col { grid-template-columns:1fr 1fr 1fr; }
      .form-row.single { grid-template-columns:1fr; }
      .form-field { display:flex; flex-direction:column; gap:.3rem; }
      .form-field label { font-size:.78rem; font-weight:500; color:var(--muted, #888); text-transform:uppercase; letter-spacing:.04em; }
      .form-field input, .form-field select, .form-field textarea { padding:.55rem .7rem; background:var(--surface, rgba(255,255,255,.06)); border:1px solid var(--border, #333); border-radius:6px; color:var(--text, #fff); font-size:.9rem; font-family:inherit; }
      .form-field input:focus, .form-field select:focus, .form-field textarea:focus { outline:none; border-color:var(--accent, #14b8a6); }
      .form-field textarea { resize:vertical; min-height:100px; font-family:monospace; font-size:.82rem; }
      .day-checkboxes { display:flex; gap:.5rem; flex-wrap:wrap; }
      .day-check { display:flex; align-items:center; gap:.3rem; padding:.35rem .7rem; border:1px solid var(--border, #333); border-radius:6px; cursor:pointer; font-size:.82rem; font-weight:500; transition:all .2s; }
      .day-check:hover { border-color:var(--accent, #14b8a6); }
      .day-check input { display:none; }
      .day-check.checked { background:var(--accent, #14b8a6); border-color:var(--accent, #14b8a6); color:#fff; }
      .toggle-row { display:flex; align-items:center; gap:.8rem; margin-bottom:.6rem; }
      .toggle-switch { position:relative; width:42px; height:24px; }
      .toggle-switch input { opacity:0; width:0; height:0; }
      .toggle-slider { position:absolute; inset:0; background:var(--border, #444); border-radius:12px; cursor:pointer; transition:.2s; }
      .toggle-slider::before { content:''; position:absolute; width:18px; height:18px; left:3px; top:3px; background:#fff; border-radius:50%; transition:.2s; }
      .toggle-switch input:checked + .toggle-slider { background:var(--accent, #14b8a6); }
      .toggle-switch input:checked + .toggle-slider::before { transform:translateX(18px); }
      .toggle-label { font-size:.9rem; font-weight:500; }
      .template-hint { font-size:.75rem; color:var(--muted, #888); margin-top:.2rem; }
      .btn-save-settings { padding:.6rem 1.6rem; background:var(--accent, #14b8a6); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:.9rem; }
      .btn-save-settings:hover { opacity:.9; }
      .save-msg { display:inline-block; margin-left:.8rem; font-size:.85rem; color:#22c55e; opacity:0; transition:opacity .3s; }
      .save-msg.show { opacity:1; }
    </style>

    <!-- Tabs -->
    <div class="booking-tabs">
      <button class="booking-tab active" data-tab="calendar" onclick="switchBookingTab('calendar')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Calendar
      </button>
      <button class="booking-tab" data-tab="incoming" onclick="switchBookingTab('incoming')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Incoming
      </button>
      <button class="booking-tab" data-tab="outgoing" onclick="switchBookingTab('outgoing')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Outgoing
      </button>
      <button class="booking-tab" data-tab="confirmation" onclick="switchBookingTab('confirmation')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Confirmation
      </button>
    </div>

    <!-- TAB: Calendar -->
    <div class="tab-panel active" id="tab-calendar">
      <div class="card">
        <div class="cal-toolbar">
          <div class="cal-nav">
            ${view === 'day' ? `
              <a href="/admin/bookings?${qp({day: fmtDate(prevDay)})}">&larr;</a>
              <h3>${dayLabel}</h3>
              <a href="/admin/bookings?${qp({day: fmtDate(nextDay)})}">&rarr;</a>
            ` : view === 'week' ? `
              <a href="/admin/bookings?${qp({week: fmtDate(prevMon)})}">&larr;</a>
              <h3>Week of ${mondayStr}</h3>
              <a href="/admin/bookings?${qp({week: fmtDate(nextMon)})}">&rarr;</a>
            ` : view === 'month' ? `
              <a href="/admin/bookings?${qp({month: prevMonth.slice(0,7)})}">&larr;</a>
              <h3>${MONTH_NAMES[monthIdx]} ${monthYear}</h3>
              <a href="/admin/bookings?${qp({month: nextMonth.slice(0,7)})}">&rarr;</a>
            ` : `
              <a href="/admin/bookings?${qp({year: yearVal - 1})}">&larr;</a>
              <h3>${yearVal}</h3>
              <a href="/admin/bookings?${qp({year: yearVal + 1})}">&rarr;</a>
            `}
          </div>
          <div class="cal-controls">
            <div class="tf-toggle">
              <button class="${tf === '12' ? 'active' : ''}" onclick="(function(){var u=new URL(location);u.searchParams.set('tf','12');location.href=u;})()">12h</button>
              <button class="${tf === '24' ? 'active' : ''}" onclick="(function(){var u=new URL(location);u.searchParams.set('tf','24');location.href=u;})()">24h</button>
            </div>
            <div class="view-btns">
              <button class="view-btn${view === 'day' ? ' active' : ''}" onclick="location.href='/admin/bookings?view=day&tf=${tf}&day=${dayStr}'">Day</button>
              <button class="view-btn${view === 'week' ? ' active' : ''}" onclick="location.href='/admin/bookings?view=week&tf=${tf}&week=${mondayStr}'">Week</button>
              <button class="view-btn${view === 'month' ? ' active' : ''}" onclick="location.href='/admin/bookings?view=month&tf=${tf}&month=${monthFirst.slice(0,7)}'">Month</button>
              <button class="view-btn${view === 'year' ? ' active' : ''}" onclick="location.href='/admin/bookings?view=year&tf=${tf}&year=${yearVal}'">Year</button>
            </div>
          </div>
        </div>

        ${view === 'day' ? `
        <!-- DAY VIEW -->
        <div class="table-wrap" style="overflow-x:auto;">
          <table class="cal-table">
            <thead><tr><th style="width:100px;">Time</th><th>Booking</th></tr></thead>
            <tbody>${dayBodyRows}</tbody>
          </table>
        </div>
        ` : view === 'week' ? `
        <!-- WEEK VIEW -->
        <div class="table-wrap" style="overflow-x:auto;">
          <table class="cal-table">
            <thead><tr><th>Time</th>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
        ` : view === 'month' ? `
        <!-- MONTH VIEW -->
        <div class="mcal-grid">
          ${DAY_NAMES.map(d => '<div class="mcal-header">' + d + '</div>').join('')}
          ${monthCells}
        </div>
        ` : `
        <!-- YEAR VIEW -->
        <div class="ycal-grid">
          ${yearCards}
        </div>
        `}
      </div>

      <div id="booking-detail" class="card">
        <h3 style="margin-bottom:.8rem;">Booking Detail</h3>
        <div class="detail-grid">
          <div><label>Name</label><br><span id="bd-name"></span></div>
          <div><label>Email</label><br><span id="bd-email"></span></div>
          <div><label>Date</label><br><span id="bd-date"></span></div>
          <div><label>Time</label><br><span id="bd-time"></span></div>
          <div><label>Notes</label><br><span id="bd-notes"></span></div>
          <div><label>Timezone</label><br><span id="bd-timezone"></span></div>
          <div><label>Status</label><br><span id="bd-status"></span></div>
          <div><label>Created</label><br><span id="bd-created"></span></div>
        </div>
        <div class="detail-actions">
          <button class="btn-confirm" id="btn-confirm" onclick="updateBookingStatus('confirmed')">Confirm</button>
          <button class="btn-cancel-booking" id="btn-cancel" onclick="updateBookingStatus('cancelled')">Cancel</button>
        </div>
      </div>
    </div>

    <!-- TAB: Incoming Settings -->
    <div class="tab-panel" id="tab-incoming">
      <div class="card">
        <div class="settings-section">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Availability Schedule
          </h4>
          <div class="form-row">
            <div class="form-field">
              <label>Timezone</label>
              <select id="set-timezone">
                <option value="America/Los_Angeles" ${timezone === 'America/Los_Angeles' ? 'selected' : ''}>Pacific (Los Angeles)</option>
                <option value="America/Denver" ${timezone === 'America/Denver' ? 'selected' : ''}>Mountain (Denver)</option>
                <option value="America/Chicago" ${timezone === 'America/Chicago' ? 'selected' : ''}>Central (Chicago)</option>
                <option value="America/New_York" ${timezone === 'America/New_York' ? 'selected' : ''}>Eastern (New York)</option>
                <option value="UTC" ${timezone === 'UTC' ? 'selected' : ''}>UTC</option>
                <option value="Europe/London" ${timezone === 'Europe/London' ? 'selected' : ''}>London (GMT/BST)</option>
                <option value="Europe/Paris" ${timezone === 'Europe/Paris' ? 'selected' : ''}>Paris (CET)</option>
                <option value="Asia/Tokyo" ${timezone === 'Asia/Tokyo' ? 'selected' : ''}>Tokyo (JST)</option>
                <option value="Asia/Shanghai" ${timezone === 'Asia/Shanghai' ? 'selected' : ''}>Shanghai (CST)</option>
                <option value="Asia/Manila" ${timezone === 'Asia/Manila' ? 'selected' : ''}>Manila (PHT)</option>
                <option value="Asia/Dubai" ${timezone === 'Asia/Dubai' ? 'selected' : ''}>Dubai (GST)</option>
                <option value="Australia/Sydney" ${timezone === 'Australia/Sydney' ? 'selected' : ''}>Sydney (AEST)</option>
              </select>
            </div>
            <div class="form-field">
              <label>Slot Duration (minutes)</label>
              <select id="set-duration">
                <option value="15" ${bookingDuration === 15 ? 'selected' : ''}>15 min</option>
                <option value="30" ${bookingDuration === 30 ? 'selected' : ''}>30 min</option>
                <option value="45" ${bookingDuration === 45 ? 'selected' : ''}>45 min</option>
                <option value="60" ${bookingDuration === 60 ? 'selected' : ''}>60 min</option>
                <option value="90" ${bookingDuration === 90 ? 'selected' : ''}>90 min</option>
              </select>
            </div>
          </div>
          <div class="form-row three-col">
            <div class="form-field">
              <label>Start Time</label>
              <input type="time" id="set-start" value="${esc(bookingStart)}" />
            </div>
            <div class="form-field">
              <label>End Time</label>
              <input type="time" id="set-end" value="${esc(bookingEnd)}" />
            </div>
            <div class="form-field">
              <label>Buffer Between Slots (min)</label>
              <input type="number" id="set-buffer" value="${bufferMin}" min="0" max="60" />
            </div>
          </div>
          <div class="form-field" style="margin-bottom:.8rem;">
            <label>Working Days</label>
            <div class="day-checkboxes" id="day-checks">
              <label class="day-check ${bookingDays.includes(0) ? 'checked' : ''}"><input type="checkbox" value="0" ${bookingDays.includes(0) ? 'checked' : ''} onchange="toggleDayCheck(this)"> Sun</label>
              <label class="day-check ${bookingDays.includes(1) ? 'checked' : ''}"><input type="checkbox" value="1" ${bookingDays.includes(1) ? 'checked' : ''} onchange="toggleDayCheck(this)"> Mon</label>
              <label class="day-check ${bookingDays.includes(2) ? 'checked' : ''}"><input type="checkbox" value="2" ${bookingDays.includes(2) ? 'checked' : ''} onchange="toggleDayCheck(this)"> Tue</label>
              <label class="day-check ${bookingDays.includes(3) ? 'checked' : ''}"><input type="checkbox" value="3" ${bookingDays.includes(3) ? 'checked' : ''} onchange="toggleDayCheck(this)"> Wed</label>
              <label class="day-check ${bookingDays.includes(4) ? 'checked' : ''}"><input type="checkbox" value="4" ${bookingDays.includes(4) ? 'checked' : ''} onchange="toggleDayCheck(this)"> Thu</label>
              <label class="day-check ${bookingDays.includes(5) ? 'checked' : ''}"><input type="checkbox" value="5" ${bookingDays.includes(5) ? 'checked' : ''} onchange="toggleDayCheck(this)"> Fri</label>
              <label class="day-check ${bookingDays.includes(6) ? 'checked' : ''}"><input type="checkbox" value="6" ${bookingDays.includes(6) ? 'checked' : ''} onchange="toggleDayCheck(this)"> Sat</label>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Capacity
          </h4>
          <div class="form-row">
            <div class="form-field">
              <label>Max Bookings Per Slot</label>
              <input type="number" id="set-max-per-slot" value="${maxPerSlot}" min="1" max="20" />
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;">
          <button class="btn-save-settings" onclick="saveIncomingSettings()">Save Incoming Settings</button>
          <span class="save-msg" id="incoming-save-msg">Saved</span>
        </div>
      </div>
    </div>

    <!-- TAB: Outgoing Settings -->
    <div class="tab-panel" id="tab-outgoing">
      <div class="card">
        <div class="settings-section">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Confirmation Email
          </h4>
          <div class="toggle-row">
            <label class="toggle-switch">
              <input type="checkbox" id="set-confirm-email" ${confirmEmail === '1' ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Send confirmation email when booking is confirmed</span>
          </div>
          <div class="form-row single" id="confirm-template-row">
            <div class="form-field">
              <label>Confirmation Template</label>
              <textarea id="set-confirm-template">${esc(confirmEmailTemplate.replace(/\\n/g, '\n'))}</textarea>
              <span class="template-hint">Variables: {{name}}, {{email}}, {{date}}, {{time}}, {{timezone}}</span>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            Cancellation Email
          </h4>
          <div class="toggle-row">
            <label class="toggle-switch">
              <input type="checkbox" id="set-cancel-email" ${cancelEnabled === '1' ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Send email when booking is cancelled</span>
          </div>
          <div class="form-row single" id="cancel-template-row">
            <div class="form-field">
              <label>Cancellation Template</label>
              <textarea id="set-cancel-template">${esc(cancelTemplate.replace(/\\n/g, '\n'))}</textarea>
              <span class="template-hint">Variables: {{name}}, {{email}}, {{date}}, {{time}}, {{timezone}}</span>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            Reminder
          </h4>
          <div class="toggle-row">
            <label class="toggle-switch">
              <input type="checkbox" id="set-reminder-enabled" ${reminderEnabled === '1' ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Send reminder email before appointment</span>
          </div>
          <div class="form-row" id="reminder-hours-row">
            <div class="form-field">
              <label>Hours Before Appointment</label>
              <select id="set-reminder-hours">
                <option value="1" ${reminderHoursBefore === '1' ? 'selected' : ''}>1 hour</option>
                <option value="2" ${reminderHoursBefore === '2' ? 'selected' : ''}>2 hours</option>
                <option value="4" ${reminderHoursBefore === '4' ? 'selected' : ''}>4 hours</option>
                <option value="12" ${reminderHoursBefore === '12' ? 'selected' : ''}>12 hours</option>
                <option value="24" ${reminderHoursBefore === '24' ? 'selected' : ''}>24 hours</option>
                <option value="48" ${reminderHoursBefore === '48' ? 'selected' : ''}>48 hours</option>
              </select>
            </div>
          </div>
        </div>

        <div class="settings-section" style="border-top:1px solid var(--border,#333);padding-top:1.2rem;">
          <h4>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            SMTP Configuration
          </h4>
          <p style="font-size:.75rem;color:var(--muted,#888);margin-bottom:.8rem;">SMTP server used to send booking confirmation, cancellation, and reminder emails.</p>
          <div class="form-row">
            <div class="form-field">
              <label>SMTP Host</label>
              <input type="text" id="set-smtp-host" value="${esc(smtpHost)}" placeholder="smtp.gmail.com" />
            </div>
            <div class="form-field">
              <label>SMTP Port</label>
              <input type="number" id="set-smtp-port" value="${esc(smtpPort)}" placeholder="587" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>SMTP Username</label>
              <input type="text" id="set-smtp-user" value="${esc(smtpUser)}" placeholder="user@gmail.com" />
            </div>
            <div class="form-field">
              <label>SMTP Password</label>
              <input type="password" id="set-smtp-pass" value="${esc(smtpPass)}" placeholder="App password" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>From Address</label>
              <input type="text" id="set-smtp-from" value="${esc(smtpFrom)}" placeholder="bookings@aimtechai.com" />
            </div>
            <div class="form-field">
              <label>&nbsp;</label>
              <div class="toggle-row" style="margin:0;">
                <label class="toggle-switch">
                  <input type="checkbox" id="set-smtp-secure" ${smtpSecure === '1' ? 'checked' : ''} />
                  <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label" style="font-size:.85rem;">SSL/TLS (port 465)</span>
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex;align-items:center;">
          <button class="btn-save-settings" onclick="saveOutgoingSettings()">Save Outgoing Settings</button>
          <span class="save-msg" id="outgoing-save-msg">Saved</span>
        </div>
      </div>
    </div>

    <!-- TAB: Confirmation -->
    <div class="tab-panel" id="tab-confirmation">
      <!-- Stat cards -->
      <div class="stat-cards" style="grid-template-columns:repeat(3,1fr);gap:.8rem;margin-bottom:1.2rem;">
        <div class="stat-card" style="border-left:3px solid #facc15;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div><div class="stat-label">Pending</div><div class="stat-value" style="color:#facc15;">${pendingCount}</div></div>
            <span style="opacity:.3;font-size:1.5rem;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
          </div>
        </div>
        <div class="stat-card" style="border-left:3px solid #22c55e;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div><div class="stat-label">Confirmed</div><div class="stat-value" style="color:#22c55e;">${confirmedCount}</div></div>
            <span style="opacity:.3;font-size:1.5rem;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
          </div>
        </div>
        <div class="stat-card" style="border-left:3px solid #ef4444;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div><div class="stat-label">Cancelled</div><div class="stat-value" style="color:#ef4444;">${cancelledCount}</div></div>
            <span style="opacity:.3;font-size:1.5rem;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></span>
          </div>
        </div>
      </div>

      ${(() => {
        const _ctd = 'padding:.5rem .7rem;border-bottom:1px solid var(--border,#333);border-right:1px solid var(--border,#333);font-size:.84rem;';
        const _ctdL = 'padding:.5rem .7rem;border-bottom:1px solid var(--border,#333);font-size:.84rem;';
        const _cth = 'padding:.5rem .7rem;font-size:.75rem;font-weight:500;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--border,#333);border-right:1px solid var(--border,#333);text-align:left;background:var(--surface,rgba(255,255,255,.03));';
        const _cthL = _cth.replace('border-right:1px solid var(--border,#333);', '');

        function buildTable(title, color, items, showConfirm, showCancel) {
          if (!items.length) return '';
          const rows = items.map(b => {
            let actions = '';
            if (showConfirm) actions += '<button class="btn-confirm" style="font-size:.76rem;padding:.25rem .5rem;" onclick="confirmRow(' + b.id + ',this)">Confirm</button> ';
            if (showCancel) actions += '<button class="btn-cancel-booking" style="font-size:.76rem;padding:.25rem .5rem;" onclick="cancelRow(' + b.id + ',this)">Cancel</button>';
            if (!showConfirm && !showCancel) actions = '<span style="color:var(--muted,#666);font-size:.8rem;">-</span>';
            return '<tr><td style="' + _ctd + 'font-weight:500;">' + esc(b.name) + '</td><td style="' + _ctd + 'font-size:.82rem;">' + esc(b.email) + '</td><td style="' + _ctd + '">' + esc(b.date) + '</td><td style="' + _ctd + '">' + esc(b.time) + '</td><td style="' + _ctd + 'font-size:.8rem;">' + esc(b.client_timezone || '-') + '</td><td style="' + _ctd + 'font-size:.8rem;">' + esc(b.created_at || '') + '</td><td style="' + _ctdL + '">' + actions + '</td></tr>';
          }).join('');
          return '<div class="card" style="padding:0;margin-bottom:1rem;">' +
            '<div style="padding:.6rem 1rem;border-bottom:1px solid var(--border,#333);display:flex;align-items:center;gap:.5rem;">' +
            '<span style="width:8px;height:8px;border-radius:50%;background:' + color + ';"></span>' +
            '<span style="font-size:.88rem;font-weight:600;">' + title + ' (' + items.length + ')</span></div>' +
            '<table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr><th style="' + _cth + '">Name</th><th style="' + _cth + '">Email</th><th style="' + _cth + '">Date</th><th style="' + _cth + '">Time</th><th style="' + _cth + '">Timezone</th><th style="' + _cth + '">Created</th><th style="' + _cthL + '">Actions</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>';
        }

        const pending = allBookings.filter(b => b.status === 'pending');
        const confirmed = allBookings.filter(b => b.status === 'confirmed');
        const cancelled = allBookings.filter(b => b.status === 'cancelled');

        return buildTable('Pending', '#facc15', pending, true, true) +
               buildTable('Confirmed', '#22c55e', confirmed, false, true) +
               buildTable('Cancelled', '#ef4444', cancelled, false, false) +
               (allBookings.length === 0 ? '<div class="card" style="text-align:center;color:var(--muted);padding:2rem;">No bookings yet</div>' : '');
      })()}
    </div>

    <!-- Cancel Confirmation Modal -->
    <div id="cancelModal" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);align-items:center;justify-content:center;">
      <div style="background:var(--bg-card,#1e2433);border:1px solid var(--border,#333);border-radius:12px;width:440px;max-width:92vw;padding:1.5rem;box-shadow:0 16px 48px rgba(0,0,0,.4);">
        <h3 style="font-size:1rem;font-weight:700;margin-bottom:.3rem;display:flex;align-items:center;gap:.5rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          Cancel Booking
        </h3>
        <p style="font-size:.82rem;color:var(--muted,#888);margin-bottom:1rem;">Please select a reason for cancellation.</p>

        <div style="margin-bottom:.8rem;">
          <label style="display:block;font-size:.75rem;font-weight:500;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.3rem;">Category</label>
          <select id="cancelCategory" style="width:100%;padding:.5rem .7rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.88rem;" onchange="onCancelCategoryChange()">
            <optgroup label="Client Request">
              <option value="Client requested cancellation">Client requested cancellation</option>
              <option value="Client no longer available">Client no longer available</option>
              <option value="Client found alternative solution">Client found alternative solution</option>
              <option value="Client unresponsive">Client unresponsive / no confirmation</option>
            </optgroup>
            <optgroup label="Scheduling">
              <option value="Time conflict">Time conflict</option>
              <option value="Double booking">Double booking</option>
              <option value="Rescheduled to new date">Rescheduled to new date</option>
              <option value="Outside business hours">Outside business hours</option>
            </optgroup>
            <optgroup label="Admin / Internal">
              <option value="Staff unavailable">Staff unavailable</option>
              <option value="Service temporarily unavailable">Service temporarily unavailable</option>
              <option value="Technical issue">Technical issue</option>
              <option value="Duplicate entry">Duplicate entry</option>
              <option value="Test booking">Test / spam booking</option>
            </optgroup>
            <optgroup label="Policy">
              <option value="Late cancellation by client">Late cancellation by client</option>
              <option value="No-show">No-show</option>
              <option value="Payment issue">Payment issue</option>
            </optgroup>
            <optgroup label="Other">
              <option value="other">Other (custom reason)</option>
            </optgroup>
          </select>
        </div>

        <div id="cancelCustomWrap" style="display:none;margin-bottom:.8rem;">
          <label style="display:block;font-size:.75rem;font-weight:500;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.3rem;">Custom Reason</label>
          <textarea id="cancelCustomReason" rows="3" style="width:100%;padding:.5rem .7rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.88rem;font-family:inherit;resize:vertical;" placeholder="Enter your reason..."></textarea>
        </div>

        <div id="cancelNoteWrap" style="margin-bottom:1rem;">
          <label style="display:block;font-size:.75rem;font-weight:500;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.3rem;">Additional Note (optional)</label>
          <input type="text" id="cancelNote" style="width:100%;padding:.5rem .7rem;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);font-size:.88rem;" placeholder="Any extra details..." />
        </div>

        <div style="display:flex;gap:.6rem;justify-content:flex-end;">
          <button onclick="closeCancelModal()" style="padding:.5rem 1rem;background:none;border:1px solid var(--border,#333);border-radius:6px;color:var(--text,#fff);cursor:pointer;font-size:.85rem;font-weight:500;">Go Back</button>
          <button id="cancelConfirmBtn" onclick="submitCancel()" style="padding:.5rem 1.2rem;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.85rem;font-weight:600;">Confirm Cancellation</button>
        </div>
      </div>
    </div>

    <script>
    var _selectedBookingId = null;
    var _cancelTargetId = null;
    var _cancelTargetBtn = null;

    /* ── Tab switching ── */
    function switchBookingTab(tab) {
      document.querySelectorAll('.booking-tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
      document.getElementById('tab-' + tab).classList.add('active');
      var btn = document.querySelector('.booking-tab[data-tab="' + tab + '"]');
      if (btn) btn.classList.add('active');
    }

    /* ── Day checkbox toggle ── */
    function toggleDayCheck(input) {
      var label = input.closest('.day-check');
      if (input.checked) label.classList.add('checked');
      else label.classList.remove('checked');
    }

    /* ── Flash saved message ── */
    function flashMsg(id) {
      var el = document.getElementById(id);
      el.classList.add('show');
      setTimeout(function() { el.classList.remove('show'); }, 2000);
    }

    /* ── Booking detail ── */
    function showBookingDetail(el) {
      _selectedBookingId = el.dataset.id;
      document.getElementById('bd-name').textContent = el.dataset.name || '';
      document.getElementById('bd-email').textContent = el.dataset.email || '';
      document.getElementById('bd-date').textContent = el.dataset.date || '';
      document.getElementById('bd-time').textContent = el.dataset.time || '';
      document.getElementById('bd-notes').textContent = el.dataset.notes || '';
      document.getElementById('bd-timezone').textContent = el.dataset.timezone || '';
      document.getElementById('bd-status').textContent = el.dataset.status || '';
      document.getElementById('bd-created').textContent = el.dataset.created || '';
      document.getElementById('booking-detail').style.display = 'block';
      var status = el.dataset.status;
      document.getElementById('btn-confirm').style.display = (status === 'confirmed') ? 'none' : '';
      document.getElementById('btn-cancel').style.display = (status === 'cancelled') ? 'none' : '';
    }

    function updateBookingStatus(newStatus) {
      if (!_selectedBookingId) return;
      if (newStatus === 'cancelled') {
        _cancelTargetId = _selectedBookingId;
        _cancelTargetBtn = null;
        openCancelModal();
        return;
      }
      var csrf = document.querySelector('meta[name="csrf-token"]').content;
      fetch('/api/admin/bookings/api/' + _selectedBookingId + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ status: newStatus, _csrf: csrf })
      }).then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success) location.reload();
          else alert(data.error || 'Failed to update booking');
        })
        .catch(function(err) { alert('Error: ' + err.message); });
    }

    /* ── Save Incoming Settings ── */
    function saveIncomingSettings() {
      var csrf = document.querySelector('meta[name="csrf-token"]').content;
      var days = [];
      document.querySelectorAll('#day-checks input:checked').forEach(function(cb) { days.push(cb.value); });
      var body = {
        timezone: document.getElementById('set-timezone').value,
        booking_days: days.join(','),
        booking_start: document.getElementById('set-start').value,
        booking_end: document.getElementById('set-end').value,
        booking_duration: document.getElementById('set-duration').value,
        booking_buffer: document.getElementById('set-buffer').value,
        booking_max_per_slot: document.getElementById('set-max-per-slot').value
      };
      fetch('/api/admin/bookings/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify(body)
      }).then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success) flashMsg('incoming-save-msg');
          else alert(data.error || 'Failed to save');
        })
        .catch(function(err) { alert('Error: ' + err.message); });
    }

    /* ── Confirmation tab: filter ── */
    function filterConfirmation(status) {
      var rows = document.querySelectorAll('#confirmation-table tbody tr');
      rows.forEach(function(row) {
        if (status === 'all' || row.dataset.status === status) row.style.display = '';
        else row.style.display = 'none';
      });
    }

    /* ── Confirmation tab: confirm/cancel row ── */
    function confirmRow(id, btn) {
      var csrf = document.querySelector('meta[name="csrf-token"]').content;
      btn.disabled = true; btn.textContent = '...';
      fetch('/api/admin/bookings/api/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ status: 'confirmed' })
      }).then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success) location.reload();
          else { alert(data.error || 'Failed'); btn.disabled = false; btn.textContent = 'Confirm'; }
        })
        .catch(function(err) { alert('Error: ' + err.message); btn.disabled = false; });
    }
    function cancelRow(id, btn) {
      _cancelTargetId = id;
      _cancelTargetBtn = btn;
      openCancelModal();
    }

    /* ── Cancel modal logic ── */
    function openCancelModal() {
      document.getElementById('cancelCategory').selectedIndex = 0;
      document.getElementById('cancelCustomWrap').style.display = 'none';
      document.getElementById('cancelCustomReason').value = '';
      document.getElementById('cancelNote').value = '';
      document.getElementById('cancelModal').style.display = 'flex';
    }
    function closeCancelModal() {
      document.getElementById('cancelModal').style.display = 'none';
      _cancelTargetId = null;
      if (_cancelTargetBtn) { _cancelTargetBtn.disabled = false; _cancelTargetBtn = null; }
    }
    function onCancelCategoryChange() {
      var val = document.getElementById('cancelCategory').value;
      document.getElementById('cancelCustomWrap').style.display = val === 'other' ? 'block' : 'none';
    }
    function submitCancel() {
      if (!_cancelTargetId) return;
      var cat = document.getElementById('cancelCategory').value;
      var reason = cat === 'other' ? document.getElementById('cancelCustomReason').value.trim() : cat;
      var note = document.getElementById('cancelNote').value.trim();
      if (cat === 'other' && !reason) { document.getElementById('cancelCustomReason').style.borderColor = '#ef4444'; return; }
      var fullReason = reason + (note ? ' — ' + note : '');

      var csrf = document.querySelector('meta[name="csrf-token"]').content;
      var btn = document.getElementById('cancelConfirmBtn');
      btn.disabled = true; btn.textContent = 'Cancelling...';
      fetch('/api/admin/bookings/api/' + _cancelTargetId + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ status: 'cancelled', cancel_reason: fullReason })
      }).then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success) location.reload();
          else { alert(data.error || 'Failed'); btn.disabled = false; btn.textContent = 'Confirm Cancellation'; }
        })
        .catch(function(err) { alert('Error: ' + err.message); btn.disabled = false; btn.textContent = 'Confirm Cancellation'; });
    }
    // Close modal on backdrop click
    document.getElementById('cancelModal').addEventListener('click', function(e) { if (e.target === this) closeCancelModal(); });

    /* ── Save Outgoing Settings ── */
    function saveOutgoingSettings() {
      var csrf = document.querySelector('meta[name="csrf-token"]').content;
      var body = {
        booking_confirm_email: document.getElementById('set-confirm-email').checked ? '1' : '0',
        booking_confirm_template: document.getElementById('set-confirm-template').value,
        booking_cancel_email: document.getElementById('set-cancel-email').checked ? '1' : '0',
        booking_cancel_template: document.getElementById('set-cancel-template').value,
        booking_reminder_enabled: document.getElementById('set-reminder-enabled').checked ? '1' : '0',
        booking_reminder_hours: document.getElementById('set-reminder-hours').value,
        booking_smtp_host: document.getElementById('set-smtp-host').value,
        booking_smtp_port: document.getElementById('set-smtp-port').value,
        booking_smtp_user: document.getElementById('set-smtp-user').value,
        booking_smtp_pass: document.getElementById('set-smtp-pass').value,
        booking_smtp_from: document.getElementById('set-smtp-from').value,
        booking_smtp_secure: document.getElementById('set-smtp-secure').checked ? '1' : '0'
      };
      fetch('/api/admin/bookings/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify(body)
      }).then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success) flashMsg('outgoing-save-msg');
          else alert(data.error || 'Failed to save');
        })
        .catch(function(err) { alert('Error: ' + err.message); });
    }
    </script>
    `;

    const html = adminLayout({
      title: 'Bookings',
      page: 'bookings',
      user: req.user,
      csrfToken: req.csrfToken,
      unreadCount,
      content
    });

    res.send(html);
  } catch (err) {
    console.error('GET /admin/bookings error:', err);
    res.status(500).send('Internal server error');
  }
});

// ---------------------------------------------------------------------------
// GET /api — List bookings for a date range
// ---------------------------------------------------------------------------
router.get('/api', requireAuth, (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: 'start and end query params are required' });
    }
    const bookings = all(
      `SELECT * FROM bookings WHERE date BETWEEN ? AND ? ORDER BY date, time`,
      [start, end]
    );
    res.json(bookings);
  } catch (err) {
    console.error('GET /api/admin/bookings/api error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/:id/status — Confirm or cancel a booking
// ---------------------------------------------------------------------------
router.patch('/api/:id/status', requireAuth, requireRole('admin', 'editor'), validateCsrf, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, cancel_reason } = req.body;

    if (!['confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Status must be confirmed or cancelled' });
    }

    const booking = get(`SELECT * FROM bookings WHERE id = ?`, [id]);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (status === 'cancelled' && cancel_reason) {
      run(`UPDATE bookings SET status = ?, cancel_reason = ? WHERE id = ?`, [status, String(cancel_reason).slice(0, 500), id]);
    } else {
      run(`UPDATE bookings SET status = ? WHERE id = ?`, [status, id]);
    }

    // Create notification
    const action = status === 'confirmed' ? 'confirmed' : 'cancelled';
    const reasonText = status === 'cancelled' && cancel_reason ? ` — Reason: ${String(cancel_reason).slice(0, 200)}` : '';
    insert('notifications', {
      type: 'booking',
      title: `Booking ${action}`,
      message: `${booking.name} <${booking.email}> booking on ${booking.date} ${booking.time} was ${action} by ${req.user.username || 'unknown'}${reasonText}`,
      is_read: 0
    });

    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/admin/bookings/api/:id/status error:', err);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/settings — Return booking settings
// ---------------------------------------------------------------------------
router.get('/api/settings', requireAuth, (req, res) => {
  try {
    const settings = {
      booking_days: getSetting('booking_days', 'mon,tue,wed,thu,fri'),
      booking_start: getSetting('booking_start', '09:00'),
      booking_end: getSetting('booking_end', '17:00'),
      booking_duration: parseInt(getSetting('booking_duration', '30'), 10) || 30,
      booking_max_per_slot: parseInt(getSetting('booking_max_per_slot', '1'), 10) || 1,
      booking_buffer: parseInt(getSetting('booking_buffer', '0'), 10) || 0
    };
    res.json(settings);
  } catch (err) {
    console.error('GET /api/admin/bookings/api/settings error:', err);
    res.status(500).json({ error: 'Failed to fetch booking settings' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/settings — Update booking settings
// ---------------------------------------------------------------------------
router.put('/api/settings', requireAuth, requireRole('admin'), validateCsrf, (req, res) => {
  try {
    const allowedKeys = ['timezone', 'booking_days', 'booking_start', 'booking_end', 'booking_duration', 'booking_max_per_slot', 'booking_buffer', 'booking_confirm_email', 'booking_confirm_template', 'booking_cancel_email', 'booking_cancel_template', 'booking_reminder_enabled', 'booking_reminder_hours', 'booking_smtp_host', 'booking_smtp_port', 'booking_smtp_user', 'booking_smtp_pass', 'booking_smtp_from', 'booking_smtp_secure'];
    const updates = req.body;

    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        const value = String(updates[key]);
        const existing = get(`SELECT key FROM settings WHERE key = ?`, [key]);
        if (existing) {
          run(`UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?`, [value, key]);
        } else {
          run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`, [key, value]);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/admin/bookings/api/settings error:', err);
    res.status(500).json({ error: 'Failed to update booking settings' });
  }
});

module.exports = router;
