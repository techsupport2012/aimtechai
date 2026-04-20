const express = require('express');
const router = express.Router();
const { get, all, run, insert, update } = require('../../db/db');
const { requireAuth, requireRole, validateCsrf } = require('../middleware/auth');
const { adminLayout } = require('../views/render');

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// GET /admin/kb — list KB entries
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (req, res) => {
  const unreadCount =
    (get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = all(
      `SELECT id, question, keywords, link, weight, is_active, updated_at
         FROM kb_entries
        WHERE question LIKE ? OR answer LIKE ? OR keywords LIKE ?
        ORDER BY is_active DESC, weight DESC, id DESC`,
      [like, like, like],
    );
  } else {
    rows = all(
      `SELECT id, question, keywords, link, weight, is_active, updated_at
         FROM kb_entries
        ORDER BY is_active DESC, weight DESC, id DESC`,
    );
  }
  const totalCount = rows.length;
  const activeCount = rows.filter((r) => r.is_active).length;

  const rowsHtml = rows.length
    ? rows
        .map(
          (r) => `
        <tr style="border-bottom:1px solid var(--border);" onclick="location.href='/admin/kb/${r.id}'">
          <td style="padding:.65rem 1rem;"><span class="badge badge-${r.is_active ? 'success' : 'gray'}">${r.is_active ? 'Live' : 'Off'}</span></td>
          <td style="padding:.65rem 1rem;font-weight:500;">${esc(r.question).slice(0, 90)}</td>
          <td style="padding:.65rem 1rem;color:var(--muted);font-size:.82rem;">${esc(r.keywords || '')}</td>
          <td style="padding:.65rem 1rem;font-family:monospace;font-size:.8rem;">${esc(r.link || '')}</td>
          <td style="padding:.65rem 1rem;text-align:center;font-weight:600;">${r.weight}</td>
        </tr>`,
        )
        .join('')
    : `<tr><td colspan="5" style="padding:2rem;text-align:center;color:var(--muted);">No entries yet. Start with common visitor questions you wish the chat handled better.</td></tr>`;

  const content = `
    <style>
      .kb-hdr{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1.2rem;}
      .kb-stats{display:flex;gap:.6rem;font-size:.82rem;}
      .kb-stat{padding:.3rem .65rem;border-radius:6px;background:var(--surface);font-weight:600;}
      .kb-stat.active{background:rgba(185,38,212,.15);color:var(--accent);}
      .btn-new{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem 1rem;background:var(--accent);color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:.85rem;}
      .btn-new:hover{opacity:.9;text-decoration:none;}
      .kb-search{display:flex;gap:.5rem;margin-bottom:.8rem;}
      .kb-search input{flex:1;padding:.5rem .8rem;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:.88rem;}
      .kb-table{width:100%;border-collapse:collapse;}
      .kb-table th{padding:.55rem 1rem;text-align:left;font-size:.78rem;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--border);}
      .kb-table tr{cursor:pointer;}
      .kb-table tr:hover{background:rgba(255,255,255,.03);}
      .badge{padding:.18rem .55rem;border-radius:4px;font-size:.72rem;font-weight:600;}
      .badge-success{background:rgba(52,211,153,.14);color:#34d399;}
      .badge-gray{background:rgba(255,255,255,.08);color:var(--muted);}
      .tablinks a{display:inline-block;padding:.5rem 1rem;color:var(--muted);text-decoration:none;font-size:.88rem;border-bottom:2px solid transparent;margin-right:.5rem;}
      .tablinks a.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:600;}
    </style>
    <div class="tablinks" style="margin-bottom:1.2rem;">
      <a href="/admin/kb" class="active">Knowledge Base</a>
      <a href="/admin/kb/queries">Visitor Queries</a>
    </div>
    <div class="card">
      <div class="kb-hdr">
        <div>
          <h3 style="margin:0 0 .3rem;">Chat Knowledge Base</h3>
          <div class="kb-stats">
            <span class="kb-stat">${totalCount} total</span>
            <span class="kb-stat active">${activeCount} live</span>
          </div>
        </div>
        <a href="/admin/kb/new" class="btn-new">+ New Entry</a>
      </div>
      <form class="kb-search" method="GET" action="/admin/kb">
        <input type="text" name="q" value="${esc(q)}" placeholder="Search question, answer, or keywords…" />
        ${q ? '<a href="/admin/kb" style="padding:.5rem .9rem;border:1px solid var(--border);border-radius:6px;color:var(--muted);text-decoration:none;font-size:.85rem;">Clear</a>' : ''}
      </form>
      <table class="kb-table">
        <thead>
          <tr>
            <th style="width:70px;">Status</th>
            <th>Question</th>
            <th>Keywords</th>
            <th>Link</th>
            <th style="width:70px;text-align:center;">Weight</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;

  res.send(
    adminLayout({
      title: 'Knowledge Base',
      page: 'kb',
      user: req.user,
      csrfToken: req.csrfToken,
      unreadCount,
      content,
    }),
  );
});

// ---------------------------------------------------------------------------
// GET /admin/kb/queries — visitor query log
// ---------------------------------------------------------------------------
router.get('/queries', requireAuth, (req, res) => {
  const unreadCount =
    (get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;

  let rows = [];
  try {
    rows = all(
      `SELECT id, query, matched_source, answer, created_at
         FROM chat_queries
         ORDER BY created_at DESC
         LIMIT 200`,
    );
  } catch {
    /* table might not exist until next boot */
  }

  const rowsHtml = rows.length
    ? rows
        .map(
          (r) => `
        <tr>
          <td style="padding:.6rem 1rem;font-family:monospace;font-size:.75rem;color:var(--muted);">${esc(r.created_at || '').slice(0, 16)}</td>
          <td style="padding:.6rem 1rem;font-weight:500;">${esc(r.query).slice(0, 160)}</td>
          <td style="padding:.6rem 1rem;"><span class="badge badge-${r.matched_source ? 'success' : 'gray'}">${esc(r.matched_source || 'miss')}</span></td>
          <td style="padding:.6rem 1rem;color:var(--muted);font-size:.82rem;">${esc((r.answer || '').slice(0, 140))}</td>
          <td style="padding:.6rem 1rem;text-align:right;">
            <form method="POST" action="/api/admin/kb/api/promote" style="display:inline;">
              <input type="hidden" name="_csrf" value="${esc(req.csrfToken)}" />
              <input type="hidden" name="query_id" value="${r.id}" />
              <button type="submit" class="btn-promote" title="Promote to a KB draft">Promote →</button>
            </form>
          </td>
        </tr>`,
        )
        .join('')
    : `<tr><td colspan="5" style="padding:2rem;text-align:center;color:var(--muted);">No queries recorded yet.</td></tr>`;

  const content = `
    <style>
      .q-table{width:100%;border-collapse:collapse;}
      .q-table th{padding:.55rem 1rem;text-align:left;font-size:.78rem;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--border);}
      .q-table tr{border-bottom:1px solid var(--border);}
      .btn-promote{background:rgba(185,38,212,.15);color:var(--accent);border:1px solid rgba(185,38,212,.4);padding:.25rem .55rem;border-radius:4px;font-size:.72rem;cursor:pointer;font-weight:600;}
      .btn-promote:hover{background:rgba(185,38,212,.3);}
      .badge{padding:.18rem .55rem;border-radius:4px;font-size:.72rem;font-weight:600;}
      .badge-success{background:rgba(52,211,153,.14);color:#34d399;}
      .badge-gray{background:rgba(255,255,255,.08);color:var(--muted);}
      .tablinks a{display:inline-block;padding:.5rem 1rem;color:var(--muted);text-decoration:none;font-size:.88rem;border-bottom:2px solid transparent;margin-right:.5rem;}
      .tablinks a.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:600;}
    </style>
    <div class="tablinks" style="margin-bottom:1.2rem;">
      <a href="/admin/kb">Knowledge Base</a>
      <a href="/admin/kb/queries" class="active">Visitor Queries</a>
    </div>
    <div class="card">
      <h3 style="margin:0 0 .6rem;">Recent Visitor Questions</h3>
      <p style="color:var(--muted);font-size:.82rem;margin-bottom:1rem;">
        Last 200 questions submitted to the hero assistant. Queries with "miss" had no good match — promote them
        into the KB so the bot handles them next time.
      </p>
      <table class="q-table">
        <thead>
          <tr>
            <th style="width:140px;">Time</th>
            <th>Query</th>
            <th style="width:100px;">Matched</th>
            <th>Reply snippet</th>
            <th style="width:120px;text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;

  res.send(
    adminLayout({
      title: 'Visitor Queries',
      page: 'kb',
      user: req.user,
      csrfToken: req.csrfToken,
      unreadCount,
      content,
    }),
  );
});

// ---------------------------------------------------------------------------
// GET /admin/kb/new — new entry form
// GET /admin/kb/:id — edit entry form
// ---------------------------------------------------------------------------
function entryForm(entry, csrfToken, isEdit) {
  const e = entry || { question: '', answer: '', keywords: '', link: '', weight: 1, is_active: 1 };
  return `
    <style>
      .kb-form label{display:block;font-size:.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin:1rem 0 .35rem;font-weight:500;}
      .kb-form input,.kb-form textarea,.kb-form select{width:100%;padding:.55rem .75rem;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:.9rem;font-family:inherit;}
      .kb-form textarea{min-height:140px;resize:vertical;}
      .kb-form .row{display:grid;grid-template-columns:1fr 1fr;gap:1rem;}
      .kb-form .btn-row{display:flex;gap:.6rem;margin-top:1.5rem;align-items:center;}
      .kb-form .btn-save{background:var(--accent);color:#fff;padding:.55rem 1.2rem;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:.88rem;}
      .kb-form .btn-cancel{padding:.55rem 1.2rem;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:.88rem;text-decoration:none;}
      .kb-form .btn-delete{margin-left:auto;padding:.55rem 1.2rem;background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.35);border-radius:6px;cursor:pointer;font-size:.82rem;}
    </style>
    <div class="card kb-form" style="max-width:780px;">
      <h3 style="margin:0 0 .5rem;">${isEdit ? 'Edit Entry' : 'New Entry'}</h3>
      <form id="kbForm">
        <label>Question / topic the visitor is likely to ask</label>
        <input type="text" id="f_question" value="${esc(e.question)}" required maxlength="300" placeholder="e.g. What is CF1 and how does it work?" />
        <label>Answer — how the bot should reply</label>
        <textarea id="f_answer" required maxlength="1200" placeholder="Write in first person, keep it tight, end with a nudge to /book, /overview, /pillars, or /outcomes.">${esc(e.answer)}</textarea>
        <label>Keywords (comma-separated, helps the search rank this entry)</label>
        <input type="text" id="f_keywords" value="${esc(e.keywords)}" maxlength="300" placeholder="cf1, pillars, understanding, trust" />
        <div class="row">
          <div>
            <label>Link (optional — appended to the reply)</label>
            <input type="text" id="f_link" value="${esc(e.link)}" maxlength="200" placeholder="/overview" />
          </div>
          <div>
            <label>Weight (1–10) &middot; Active</label>
            <div style="display:flex;gap:.6rem;align-items:center;">
              <input type="number" id="f_weight" value="${e.weight}" min="1" max="10" style="width:90px;" />
              <select id="f_active" style="flex:1;">
                <option value="1"${e.is_active ? ' selected' : ''}>Live</option>
                <option value="0"${!e.is_active ? ' selected' : ''}>Off</option>
              </select>
            </div>
          </div>
        </div>
        <div class="btn-row">
          <a href="/admin/kb" class="btn-cancel">Cancel</a>
          <button type="button" class="btn-save" id="btnSave">${isEdit ? 'Save' : 'Create'}</button>
          ${isEdit ? '<button type="button" class="btn-delete" id="btnDelete">Delete</button>' : ''}
        </div>
      </form>
    </div>
    <script>
    (function(){
      const csrf = ${JSON.stringify(csrfToken)};
      const headers = {'Content-Type':'application/json','X-CSRF-Token':csrf};
      const data = () => ({
        question: document.getElementById('f_question').value.trim(),
        answer: document.getElementById('f_answer').value.trim(),
        keywords: document.getElementById('f_keywords').value.trim(),
        link: document.getElementById('f_link').value.trim(),
        weight: parseInt(document.getElementById('f_weight').value, 10) || 1,
        is_active: parseInt(document.getElementById('f_active').value, 10) || 0,
        _csrf: csrf,
      });
      document.getElementById('btnSave').addEventListener('click', async () => {
        const payload = data();
        if (!payload.question || !payload.answer) { alert('Question and answer are required.'); return; }
        const url = ${isEdit ? `'/api/admin/kb/api/${e.id}'` : `'/api/admin/kb/api'`};
        const method = ${isEdit ? `'PUT'` : `'POST'`};
        const r = await fetch(url, { method, headers, body: JSON.stringify(payload) }).then(r => r.json());
        if (r.ok) location.href = '/admin/kb';
        else alert(r.error || 'Save failed');
      });
      ${isEdit
        ? `document.getElementById('btnDelete').addEventListener('click', async () => {
             if (!confirm('Delete this KB entry?')) return;
             const r = await fetch('/api/admin/kb/api/${e.id}', { method:'DELETE', headers, body: JSON.stringify({_csrf:csrf}) }).then(r => r.json());
             if (r.ok) location.href = '/admin/kb';
             else alert(r.error || 'Delete failed');
           });`
        : ''}
    })();
    </script>
  `;
}

router.get('/new', requireAuth, requireRole('admin', 'editor'), (req, res) => {
  const unreadCount =
    (get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;
  res.send(
    adminLayout({
      title: 'New KB Entry',
      page: 'kb',
      user: req.user,
      csrfToken: req.csrfToken,
      unreadCount,
      content: entryForm(null, req.csrfToken, false),
    }),
  );
});

router.get('/:id', requireAuth, (req, res, next) => {
  if (req.params.id === 'api' || req.params.id === 'queries' || req.params.id === 'new')
    return next();
  const entry = get('SELECT * FROM kb_entries WHERE id = ?', [req.params.id]);
  if (!entry) return res.status(404).send('Not found');
  const unreadCount =
    (get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;
  res.send(
    adminLayout({
      title: 'Edit KB Entry',
      page: 'kb',
      user: req.user,
      csrfToken: req.csrfToken,
      unreadCount,
      content: entryForm(entry, req.csrfToken, true),
    }),
  );
});

// ---------------------------------------------------------------------------
// Create / Update / Delete / Promote
// ---------------------------------------------------------------------------
router.post('/api', requireAuth, requireRole('admin', 'editor'), validateCsrf, (req, res) => {
  const { question, answer, keywords, link, weight, is_active } = req.body || {};
  if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });
  const r = insert('kb_entries', {
    question: String(question).slice(0, 500),
    answer: String(answer).slice(0, 2000),
    keywords: String(keywords || '').slice(0, 500),
    link: String(link || '').slice(0, 200),
    weight: Math.max(1, Math.min(10, parseInt(weight, 10) || 1)),
    is_active: is_active ? 1 : 0,
    updated_at: new Date().toISOString(),
  });
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.put('/api/:id', requireAuth, requireRole('admin', 'editor'), validateCsrf, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = get('SELECT id FROM kb_entries WHERE id = ?', [id]);
  if (!row) return res.status(404).json({ error: 'not_found' });
  const { question, answer, keywords, link, weight, is_active } = req.body || {};
  if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });
  update('kb_entries', id, {
    question: String(question).slice(0, 500),
    answer: String(answer).slice(0, 2000),
    keywords: String(keywords || '').slice(0, 500),
    link: String(link || '').slice(0, 200),
    weight: Math.max(1, Math.min(10, parseInt(weight, 10) || 1)),
    is_active: is_active ? 1 : 0,
    updated_at: new Date().toISOString(),
  });
  res.json({ ok: true });
});

router.delete('/api/:id', requireAuth, requireRole('admin'), validateCsrf, (req, res) => {
  const id = parseInt(req.params.id, 10);
  run('DELETE FROM kb_entries WHERE id = ?', [id]);
  res.json({ ok: true });
});

// POST /api/admin/kb/api/promote — turn a chat_queries row into a KB draft.
// Accepts a form-encoded body (coming from the Visitor Queries button) with
// the _csrf token supplied as a hidden input. Redirects to /admin/kb/:newId.
router.post(
  '/api/promote',
  requireAuth,
  requireRole('admin', 'editor'),
  express.urlencoded({ extended: false }),
  (req, res) => {
    const tokenFromBody = (req.body && req.body._csrf) || '';
    // Lean CSRF check — we don't go through validateCsrf because this is a
    // classic form POST, not a JSON fetch.
    if (!tokenFromBody || tokenFromBody !== req.csrfToken) {
      return res.status(403).send('Invalid CSRF token');
    }
    const queryId = parseInt((req.body && req.body.query_id) || '0', 10);
    const qrow = get('SELECT query, answer FROM chat_queries WHERE id = ?', [queryId]);
    if (!qrow) return res.status(404).send('Query not found');

    const r = insert('kb_entries', {
      question: String(qrow.query).slice(0, 500),
      answer:
        qrow.answer && qrow.answer.length > 10
          ? String(qrow.answer)
          : 'DRAFT — fill in a proper answer for this common visitor question.',
      keywords: '',
      link: '',
      weight: 1,
      is_active: 0,
      updated_at: new Date().toISOString(),
    });
    res.redirect(`/admin/kb/${r.lastInsertRowid}`);
  },
);

module.exports = router;
