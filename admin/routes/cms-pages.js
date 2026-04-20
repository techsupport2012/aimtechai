const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const { get, all, update } = require('../../db/db');
const { requireAuth, requireRole, validateCsrf } = require('../middleware/auth');
const { adminLayout } = require('../views/render');

// HTML-escape helper
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// GET / — Page list
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  const pages = await all('SELECT id, title, slug, status, updated_at FROM pages ORDER BY slug');
  const unreadCount = (await get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;

  const rows = pages.map(p => `
    <tr onclick="location.href='/admin/pages/${p.id}'" style="cursor:pointer">
      <td>${esc(p.title)}</td>
      <td><code>${esc(p.slug)}</code></td>
      <td><span class="status-badge status-${esc(p.status)}">${esc(p.status)}</span></td>
      <td>${p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}</td>
    </tr>
  `).join('');

  const content = `
    <style>
      .pages-table { width:100%; border-collapse:collapse; }
      .pages-table th, .pages-table td { padding:.75rem 1rem; text-align:left; border-bottom:1px solid var(--border, #333); }
      .pages-table tr:hover { background:var(--surface-hover, rgba(255,255,255,.04)); }
      .pages-table th { color:var(--muted, #888); font-weight:500; font-size:.85rem; text-transform:uppercase; letter-spacing:.04em; }
      .status-badge { padding:.2rem .6rem; border-radius:4px; font-size:.8rem; font-weight:500; }
      .status-published { background:#22c55e22; color:#22c55e; }
      .status-draft { background:#eab30822; color:#eab308; }
      code { background:var(--surface, #1a1a2e); padding:.15rem .4rem; border-radius:3px; font-size:.85rem; }
    </style>
    <div class="card">
      <h3>Site Pages</h3>
      <p style="margin:.5rem 0 1.5rem;color:var(--muted)">Manage page titles, meta descriptions, and publish status.</p>
      <table class="pages-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4" style="color:var(--muted)">No pages found. Run seed to populate.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  res.send(adminLayout({
    title: 'Pages',
    page: 'pages',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount,
    content
  }));
});

// ---------------------------------------------------------------------------
// GET /:id — Edit page form
// ---------------------------------------------------------------------------
router.get('/:id', requireAuth, async (req, res) => {
  const page = await get('SELECT * FROM pages WHERE id = ?', [req.params.id]);
  if (!page) return res.status(404).send('Page not found');

  const unreadCount = (await get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;

  const content = `
    <style>
      .page-form { max-width:720px; }
      .page-form label { display:block; margin-bottom:.3rem; font-weight:500; color:var(--muted, #aaa); font-size:.85rem; text-transform:uppercase; letter-spacing:.03em; }
      .page-form input, .page-form textarea, .page-form select {
        width:100%; padding:.6rem .8rem; margin-bottom:1.2rem;
        background:var(--surface, #1a1a2e); color:var(--text, #eee);
        border:1px solid var(--border, #333); border-radius:6px; font-size:.95rem;
        font-family:inherit;
      }
      .page-form input:read-only { opacity:.6; cursor:not-allowed; }
      .page-form textarea { resize:vertical; min-height:80px; }
      .char-counter { float:right; font-size:.8rem; color:var(--muted, #888); margin-top:-1rem; margin-bottom:1rem; }
      .page-form .btn-save {
        padding:.7rem 2rem; background:var(--accent, #14b8a6); color:#fff;
        border:none; border-radius:6px; font-size:1rem; font-weight:600; cursor:pointer;
      }
      .page-form .btn-save:hover { opacity:.9; }
      .page-form .btn-back { margin-right:1rem; padding:.7rem 1.5rem; background:transparent; color:var(--muted, #aaa); border:1px solid var(--border, #333); border-radius:6px; cursor:pointer; text-decoration:none; font-size:1rem; }
      .toast { position:fixed; top:1.5rem; right:1.5rem; padding:.8rem 1.5rem; border-radius:6px; font-weight:500; z-index:9999; transition:opacity .3s; }
      .toast-success { background:#22c55e22; color:#22c55e; border:1px solid #22c55e44; }
      .toast-error { background:#ef444422; color:#ef4444; border:1px solid #ef444444; }
    </style>
    <div class="card page-form">
      <h3>Edit Page</h3>
      <form id="pageForm" style="margin-top:1.2rem">
        <label for="title">Title</label>
        <input type="text" id="title" name="title" value="${esc(page.title)}" required maxlength="200">

        <label for="slug">Slug</label>
        <input type="text" id="slug" name="slug" value="${esc(page.slug)}" readonly>

        <label for="meta_description">Meta Description</label>
        <textarea id="meta_description" name="meta_description" maxlength="160">${esc(page.meta_description)}</textarea>
        <div class="char-counter"><span id="metaCount">${(page.meta_description || '').length}</span>/160</div>

        <label for="status">Status</label>
        <select id="status" name="status">
          <option value="published"${page.status === 'published' ? ' selected' : ''}>Published</option>
          <option value="draft"${page.status === 'draft' ? ' selected' : ''}>Draft</option>
        </select>

        <div style="margin-top:.5rem">
          <a href="/admin/pages" class="btn-back">Back</a>
          <button type="submit" class="btn-save">Save Changes</button>
        </div>
      </form>
    </div>

    <script>
    (function() {
      const metaEl = document.getElementById('meta_description');
      const counterEl = document.getElementById('metaCount');
      metaEl.addEventListener('input', () => {
        counterEl.textContent = metaEl.value.length;
      });

      function showToast(msg, type) {
        const el = document.createElement('div');
        el.className = 'toast toast-' + type;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
      }

      document.getElementById('pageForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const csrf = document.querySelector('meta[name="csrf-token"]').content;
        try {
          const resp = await fetch('/api/admin/pages/${page.id}', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify({
              title: document.getElementById('title').value,
              meta_description: document.getElementById('meta_description').value,
              status: document.getElementById('status').value
            })
          });
          const data = await resp.json();
          if (resp.ok) {
            showToast('Page saved successfully', 'success');
          } else {
            showToast(data.error || 'Save failed', 'error');
          }
        } catch (err) {
          showToast('Network error', 'error');
        }
      });
    })();
    </script>
  `;

  res.send(adminLayout({
    title: 'Edit: ' + (page.title || page.slug),
    page: 'pages',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount,
    content
  }));
});

// ---------------------------------------------------------------------------
// PUT /api/:id — Update page
// ---------------------------------------------------------------------------
router.put('/api/:id', requireAuth, requireRole('admin', 'editor'), validateCsrf, async (req, res) => {
  const { title, meta_description, status } = req.body || {};
  const pageId = req.params.id;

  const page = await get('SELECT * FROM pages WHERE id = ?', [pageId]);
  if (!page) return res.status(404).json({ error: 'Page not found' });

  // Validate
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  if (meta_description && meta_description.length > 160) {
    return res.status(400).json({ error: 'Meta description must be 160 characters or fewer' });
  }
  if (!['published', 'draft'].includes(status)) {
    return res.status(400).json({ error: 'Status must be published or draft' });
  }

  // Update DB
  await update('pages', pageId, {
    title: title.trim(),
    meta_description: (meta_description || '').trim(),
    status,
    updated_by: req.user.id,
    updated_at: new Date().toISOString()
  });

  // Update the actual HTML file on disk
  const filePath = path.join(__dirname, '..', '..', 'public', `${page.slug}.html`);
  if (fs.existsSync(filePath)) {
    try {
      let html = fs.readFileSync(filePath, 'utf-8');

      // Replace <title>
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title.trim()}</title>`);

      // Replace <meta name="description">
      const metaRegex = /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i;
      const newMeta = `<meta name="description" content="${(meta_description || '').trim().replace(/"/g, '&quot;')}">`;
      if (metaRegex.test(html)) {
        html = html.replace(metaRegex, newMeta);
      }

      fs.writeFileSync(filePath, html, 'utf-8');
    } catch (err) {
      console.error(`[cms-pages] Error updating ${filePath}:`, err.message);
      // Don't fail the request — DB was already updated
    }
  }

  res.json({ ok: true, message: 'Page updated' });
});

module.exports = router;
