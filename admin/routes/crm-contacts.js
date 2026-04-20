const express = require('express');
const router = express.Router();

const { get, all, run, insert, update } = require('../../db/db');
const { requireAuth, requireRole, validateCsrf } = require('../middleware/auth');
const { adminLayout } = require('../views/render');

// ---------------------------------------------------------------------------
// Helper: HTML-escape
// ---------------------------------------------------------------------------
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Status / source config
// ---------------------------------------------------------------------------
const STATUSES  = ['new', 'contacted', 'qualified', 'client'];
const SOURCES   = ['manual', 'booking', 'website'];

const STATUS_COLORS = { new: '#14b8a6', contacted: '#3b82f6', qualified: '#a855f7', client: '#22c55e' };
const SOURCE_COLORS = { manual: '#888', booking: '#14b8a6', website: '#1e3a5f' };

function statusBadge(s) {
  const c = STATUS_COLORS[s] || '#888';
  return `<span style="padding:.2rem .6rem;border-radius:4px;font-size:.8rem;font-weight:500;background:${c}22;color:${c}">${esc(s)}</span>`;
}
function sourceBadge(s) {
  const c = SOURCE_COLORS[s] || '#888';
  return `<span style="padding:.2rem .6rem;border-radius:4px;font-size:.8rem;font-weight:500;background:${c}22;color:${c}">${esc(s)}</span>`;
}

// ---------------------------------------------------------------------------
// Helper: option builder
// ---------------------------------------------------------------------------
function opts(values, selected) {
  return values.map(v =>
    `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(v)}</option>`
  ).join('');
}

// ---------------------------------------------------------------------------
// GET / — Contacts list page
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  const search = (req.query.q || '').trim();
  const unreadCount = (await get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;

  let contacts;
  if (search) {
    const like = `%${search}%`;
    contacts = await all(
      `SELECT * FROM contacts WHERE name LIKE ? OR email LIKE ? OR company LIKE ? ORDER BY created_at DESC`,
      [like, like, like]
    );
  } else {
    contacts = await all('SELECT * FROM contacts ORDER BY created_at DESC');
  }

  const rows = contacts.map(c => {
    const date = c.created_at ? new Date(c.created_at).toLocaleDateString() : '\u2014';
    return `
    <tr onclick="location.href='/admin/contacts/${c.id}'" style="cursor:pointer">
      <td>${esc(c.name)}</td>
      <td>${esc(c.email)}</td>
      <td>${esc(c.phone)}</td>
      <td>${esc(c.company)}</td>
      <td>${sourceBadge(c.source)}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${date}</td>
    </tr>`;
  }).join('');

  const content = `
    <style>
      .crm-table { width:100%; border-collapse:collapse; }
      .crm-table th, .crm-table td { padding:.75rem 1rem; text-align:left; border-bottom:1px solid var(--border, #333); }
      .crm-table tr:hover { background:var(--surface-hover, rgba(255,255,255,.04)); }
      .crm-table th { color:var(--muted, #888); font-weight:500; font-size:.85rem; text-transform:uppercase; letter-spacing:.04em; }
      .btn-add { display:inline-block; padding:.6rem 1.5rem; background:var(--accent, #14b8a6); color:#fff; border:none; border-radius:6px; font-size:.95rem; font-weight:600; cursor:pointer; }
      .btn-add:hover { opacity:.9; }
      .search-input { padding:.55rem .8rem; background:var(--surface, #1a1a2e); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:6px; font-size:.9rem; width:260px; }
      /* Modal */
      .modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:900; justify-content:center; align-items:center; }
      .modal-overlay.open { display:flex; }
      .modal { background:var(--card-bg, #16213e); border:1px solid var(--border, #333); border-radius:10px; padding:2rem; width:100%; max-width:480px; }
      .modal h3 { margin-bottom:1.2rem; }
      .modal label { display:block; margin-bottom:.25rem; font-weight:500; color:var(--muted, #aaa); font-size:.82rem; text-transform:uppercase; letter-spacing:.03em; }
      .modal input, .modal select { width:100%; padding:.55rem .75rem; margin-bottom:1rem; background:var(--surface, #1a1a2e); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:6px; font-size:.9rem; font-family:inherit; box-sizing:border-box; }
      .modal .btn-row { display:flex; gap:.8rem; margin-top:.5rem; }
      .modal .btn-cancel { padding:.6rem 1.2rem; background:var(--border, #333); color:var(--text, #eee); border:none; border-radius:6px; cursor:pointer; }
      .modal .btn-submit { padding:.6rem 1.5rem; background:var(--accent, #14b8a6); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; }
      .toast { position:fixed; top:1.5rem; right:1.5rem; padding:.8rem 1.5rem; border-radius:6px; font-weight:500; z-index:9999; transition:opacity .3s; }
      .toast-success { background:#22c55e22; color:#22c55e; border:1px solid #22c55e44; }
      .toast-error { background:#ef444422; color:#ef4444; border:1px solid #ef444444; }
    </style>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:.8rem;">
        <div>
          <h3>Contacts</h3>
          <p style="margin:.3rem 0 0;color:var(--muted)">Manage your CRM contacts.</p>
        </div>
        <div style="display:flex;gap:.8rem;align-items:center;">
          <form method="get" action="/admin/contacts" style="margin:0">
            <input class="search-input" type="text" name="q" value="${esc(search)}" placeholder="Search name, email, company...">
          </form>
          <button class="btn-add" id="btnAddContact">+ Add Contact</button>
        </div>
      </div>

      <table class="crm-table">
        <thead>
          <tr>
            <th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Source</th><th>Status</th><th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" style="color:var(--muted)">No contacts yet.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Add Contact Modal -->
    <div class="modal-overlay" id="addModal">
      <div class="modal">
        <h3>Add Contact</h3>
        <form id="addContactForm">
          <label for="ac_name">Name *</label>
          <input type="text" id="ac_name" name="name" required maxlength="100">

          <label for="ac_email">Email</label>
          <input type="email" id="ac_email" name="email" maxlength="200">

          <label for="ac_phone">Phone</label>
          <input type="text" id="ac_phone" name="phone" maxlength="30">

          <label for="ac_company">Company</label>
          <input type="text" id="ac_company" name="company" maxlength="100">

          <label for="ac_source">Source</label>
          <select id="ac_source" name="source">
            ${opts(SOURCES, 'manual')}
          </select>

          <label for="ac_status">Status</label>
          <select id="ac_status" name="status">
            ${opts(STATUSES, 'new')}
          </select>

          <div class="btn-row">
            <button type="button" class="btn-cancel" id="btnCancelAdd">Cancel</button>
            <button type="submit" class="btn-submit">Create</button>
          </div>
        </form>
      </div>
    </div>

    <script>
    (function() {
      const csrf = document.querySelector('meta[name="csrf-token"]').content;

      function showToast(msg, type) {
        const el = document.createElement('div');
        el.className = 'toast toast-' + type;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
      }

      // Modal open/close
      const modal = document.getElementById('addModal');
      document.getElementById('btnAddContact').addEventListener('click', () => modal.classList.add('open'));
      document.getElementById('btnCancelAdd').addEventListener('click', () => modal.classList.remove('open'));
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

      // Submit new contact
      document.getElementById('addContactForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
          name: document.getElementById('ac_name').value,
          email: document.getElementById('ac_email').value,
          phone: document.getElementById('ac_phone').value,
          company: document.getElementById('ac_company').value,
          source: document.getElementById('ac_source').value,
          status: document.getElementById('ac_status').value
        };
        try {
          const resp = await fetch('/api/admin/contacts/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify(data)
          });
          const result = await resp.json();
          if (resp.ok) {
            showToast('Contact created', 'success');
            setTimeout(() => location.reload(), 600);
          } else {
            showToast(result.error || 'Failed', 'error');
          }
        } catch (err) {
          showToast('Network error', 'error');
        }
      });
    })();
    </script>
  `;

  res.send(adminLayout({
    title: 'Contacts',
    page: 'contacts',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount,
    content
  }));
});

// ---------------------------------------------------------------------------
// GET /:id — Contact detail page (skip if id === 'api')
// ---------------------------------------------------------------------------
router.get('/:id', requireAuth, async (req, res, next) => {
  if (req.params.id === 'api') return next();

  const contact = await get('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
  if (!contact) return res.status(404).send('Contact not found');

  const unreadCount = (await get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;
  const isAdmin = req.user && req.user.role === 'admin';

  // Parse notes JSON
  let notes = [];
  try { notes = JSON.parse(contact.notes || '[]'); } catch { notes = []; }

  const notesHtml = notes.length
    ? notes.map(n => `
        <div style="padding:.8rem;border-bottom:1px solid var(--border, #333);">
          <div style="font-size:.8rem;color:var(--muted, #888);margin-bottom:.3rem;">${esc(n.date ? new Date(n.date).toLocaleString() : '')}</div>
          <div>${esc(n.text)}</div>
        </div>`).join('')
    : '<p style="color:var(--muted);padding:.8rem;">No notes yet.</p>';

  const content = `
    <style>
      .detail-form { max-width:680px; }
      .detail-form label { display:block; margin-bottom:.25rem; font-weight:500; color:var(--muted, #aaa); font-size:.82rem; text-transform:uppercase; letter-spacing:.03em; }
      .detail-form input, .detail-form select { width:100%; padding:.55rem .75rem; margin-bottom:1rem; background:var(--surface, #1a1a2e); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:6px; font-size:.9rem; font-family:inherit; box-sizing:border-box; }
      .detail-form .btn-row { display:flex; gap:.8rem; margin-top:.5rem; flex-wrap:wrap; align-items:center; }
      .btn-back { padding:.6rem 1.2rem; background:transparent; color:var(--muted, #aaa); border:1px solid var(--border, #333); border-radius:6px; cursor:pointer; text-decoration:none; font-size:.95rem; }
      .btn-save { padding:.6rem 1.5rem; background:var(--accent, #14b8a6); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:.95rem; }
      .btn-save:hover, .btn-back:hover { opacity:.9; }
      .btn-delete { padding:.6rem 1.2rem; background:#ef444422; color:#ef4444; border:1px solid #ef444444; border-radius:6px; cursor:pointer; font-size:.9rem; margin-left:auto; }
      .btn-delete:hover { background:#ef444444; }
      .notes-section { max-width:680px; margin-top:1.5rem; }
      .notes-section textarea { width:100%; min-height:80px; padding:.6rem .75rem; background:var(--surface, #1a1a2e); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:6px; font-size:.9rem; font-family:inherit; resize:vertical; box-sizing:border-box; }
      .btn-note { padding:.5rem 1.2rem; background:var(--accent, #14b8a6); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; margin-top:.5rem; font-size:.9rem; }
      .toast { position:fixed; top:1.5rem; right:1.5rem; padding:.8rem 1.5rem; border-radius:6px; font-weight:500; z-index:9999; transition:opacity .3s; }
      .toast-success { background:#22c55e22; color:#22c55e; border:1px solid #22c55e44; }
      .toast-error { background:#ef444422; color:#ef4444; border:1px solid #ef444444; }
    </style>

    <div class="card detail-form">
      <h3>Contact Detail</h3>
      <form id="contactForm" style="margin-top:1.2rem;">
        <label for="cf_name">Name</label>
        <input type="text" id="cf_name" name="name" value="${esc(contact.name)}" required maxlength="100">

        <label for="cf_email">Email</label>
        <input type="email" id="cf_email" name="email" value="${esc(contact.email)}" maxlength="200">

        <label for="cf_phone">Phone</label>
        <input type="text" id="cf_phone" name="phone" value="${esc(contact.phone)}" maxlength="30">

        <label for="cf_company">Company</label>
        <input type="text" id="cf_company" name="company" value="${esc(contact.company)}" maxlength="100">

        <label for="cf_source">Source</label>
        <select id="cf_source" name="source">
          ${opts(SOURCES, contact.source)}
        </select>

        <label for="cf_status">Status</label>
        <select id="cf_status" name="status">
          ${opts(STATUSES, contact.status)}
        </select>

        <div class="btn-row">
          <a href="/admin/contacts" class="btn-back">Back</a>
          <button type="submit" class="btn-save">Save Changes</button>
          ${isAdmin ? '<button type="button" class="btn-delete" id="btnDelete">Delete</button>' : ''}
        </div>
      </form>
    </div>

    <div class="card notes-section">
      <h3>Notes</h3>
      <textarea id="noteText" placeholder="Add a note..."></textarea>
      <button type="button" class="btn-note" id="btnAddNote">Add Note</button>
      <div id="notesList" style="margin-top:1rem;">
        ${notesHtml}
      </div>
    </div>

    <script>
    (function() {
      const csrf = document.querySelector('meta[name="csrf-token"]').content;
      const contactId = ${contact.id};

      function showToast(msg, type) {
        const el = document.createElement('div');
        el.className = 'toast toast-' + type;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
      }

      // Save contact
      document.getElementById('contactForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
          name: document.getElementById('cf_name').value,
          email: document.getElementById('cf_email').value,
          phone: document.getElementById('cf_phone').value,
          company: document.getElementById('cf_company').value,
          source: document.getElementById('cf_source').value,
          status: document.getElementById('cf_status').value
        };
        try {
          const resp = await fetch('/api/admin/contacts/api/' + contactId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify(data)
          });
          const result = await resp.json();
          if (resp.ok) {
            showToast('Contact updated', 'success');
          } else {
            showToast(result.error || 'Update failed', 'error');
          }
        } catch (err) {
          showToast('Network error', 'error');
        }
      });

      // Delete contact
      const btnDel = document.getElementById('btnDelete');
      if (btnDel) {
        btnDel.addEventListener('click', async () => {
          if (!confirm('Delete this contact permanently?')) return;
          try {
            const resp = await fetch('/api/admin/contacts/api/' + contactId, {
              method: 'DELETE',
              headers: { 'X-CSRF-Token': csrf }
            });
            const result = await resp.json();
            if (resp.ok) {
              showToast('Contact deleted', 'success');
              setTimeout(() => { location.href = '/admin/contacts'; }, 800);
            } else {
              showToast(result.error || 'Delete failed', 'error');
            }
          } catch (err) {
            showToast('Network error', 'error');
          }
        });
      }

      // Add note
      document.getElementById('btnAddNote').addEventListener('click', async () => {
        const text = document.getElementById('noteText').value.trim();
        if (!text) return;
        try {
          const resp = await fetch('/api/admin/contacts/api/' + contactId + '/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify({ text })
          });
          const result = await resp.json();
          if (resp.ok) {
            showToast('Note added', 'success');
            setTimeout(() => location.reload(), 600);
          } else {
            showToast(result.error || 'Failed', 'error');
          }
        } catch (err) {
          showToast('Network error', 'error');
        }
      });
    })();
    </script>
  `;

  res.send(adminLayout({
    title: 'Contact: ' + (contact.name || contact.email),
    page: 'contacts',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount,
    content
  }));
});

// ---------------------------------------------------------------------------
// POST /api — Create contact
// ---------------------------------------------------------------------------
router.post('/api', requireAuth, requireRole('admin', 'editor'), validateCsrf, async (req, res) => {
  const { name, email, phone, company, source, status } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const contactStatus = STATUSES.includes(status) ? status : 'new';
  const contactSource = SOURCES.includes(source) ? source : 'manual';

  const result = await insert('contacts', {
    name: String(name).trim().slice(0, 100),
    email: String(email || '').trim().slice(0, 200),
    phone: String(phone || '').trim().slice(0, 30),
    company: String(company || '').trim().slice(0, 100),
    source: contactSource,
    status: contactStatus,
    notes: '[]',
    updated_at: new Date().toISOString()
  });

  res.json({ ok: true, id: result.lastInsertRowid, message: 'Contact created' });
});

// ---------------------------------------------------------------------------
// PUT /api/:id — Update contact
// ---------------------------------------------------------------------------
router.put('/api/:id', requireAuth, requireRole('admin', 'editor'), validateCsrf, async (req, res) => {
  const contact = await get('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const { name, email, phone, company, source, status } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const contactStatus = STATUSES.includes(status) ? status : contact.status;
  const contactSource = SOURCES.includes(source) ? source : contact.source;

  await update('contacts', contact.id, {
    name: String(name).trim().slice(0, 100),
    email: String(email || '').trim().slice(0, 200),
    phone: String(phone || '').trim().slice(0, 30),
    company: String(company || '').trim().slice(0, 100),
    source: contactSource,
    status: contactStatus,
    updated_at: new Date().toISOString()
  });

  res.json({ ok: true, message: 'Contact updated' });
});

// ---------------------------------------------------------------------------
// DELETE /api/:id — Delete contact (admin only)
// ---------------------------------------------------------------------------
router.delete('/api/:id', requireAuth, requireRole('admin'), validateCsrf, async (req, res) => {
  const contact = await get('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  await run('DELETE FROM contacts WHERE id = ?', [contact.id]);

  res.json({ ok: true, message: 'Contact deleted' });
});

// ---------------------------------------------------------------------------
// POST /api/:id/notes — Add note to contact
// ---------------------------------------------------------------------------
router.post('/api/:id/notes', requireAuth, validateCsrf, async (req, res) => {
  const contact = await get('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Note text is required' });

  let notes = [];
  try { notes = JSON.parse(contact.notes || '[]'); } catch { notes = []; }

  notes.unshift({ text: String(text).trim().slice(0, 2000), date: new Date().toISOString() });

  await update('contacts', contact.id, {
    notes: JSON.stringify(notes),
    updated_at: new Date().toISOString()
  });

  res.json({ ok: true, message: 'Note added' });
});

module.exports = router;
