const express = require('express');
const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const router = express.Router();

const { get, all, run, insert, update } = require('../../db/db');
const { requireAuth, requireRole, validateCsrf } = require('../middleware/auth');
const { adminLayout } = require('../views/render');
const { blogPostTemplate, esc } = require('../templates/blog-post');
const { dispatchNotification } = require('../services/notify');

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
const CATEGORIES = ['AI & ML', 'Engineering', 'Cloud', 'Design', 'Company', 'Security'];

// ---------------------------------------------------------------------------
// Helper: generate static HTML file for a published post
// ---------------------------------------------------------------------------
function generatePostFile(slug) {
  const post = get('SELECT * FROM blog_posts WHERE slug = ?', [slug]);
  if (!post) return;

  const html = blogPostTemplate({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    contentHtml: post.content_html,
    category: post.category,
    tags: post.tags,
    metaDescription: post.meta_description,
    publishedAt: post.published_at
  });

  const outPath = path.join(__dirname, '..', '..', 'public', 'blog', `${slug}.html`);
  fs.writeFileSync(outPath, html, 'utf-8');
}

// ---------------------------------------------------------------------------
// Helper: slugify
// ---------------------------------------------------------------------------
function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Reusable blog form HTML
// ---------------------------------------------------------------------------
function blogForm(post, csrfToken, isEdit) {
  const p = post || {};
  const categoryOptions = CATEGORIES.map(c =>
    `<option value="${esc(c)}"${p.category === c ? ' selected' : ''}>${esc(c)}</option>`
  ).join('');

  const statusVal = p.status || 'draft';

  return `
    <style>
      .blog-form { max-width:780px; }
      .blog-form label { display:block; margin-bottom:.3rem; font-weight:500; color:var(--muted, #aaa); font-size:.85rem; text-transform:uppercase; letter-spacing:.03em; }
      .blog-form input, .blog-form textarea, .blog-form select {
        width:100%; padding:.6rem .8rem; margin-bottom:1.2rem;
        background:var(--surface, #1a1a2e); color:var(--text, #eee);
        border:1px solid var(--border, #333); border-radius:6px; font-size:.95rem;
        font-family:inherit;
      }
      .blog-form input.title-input { font-size:1.4rem; font-weight:600; padding:.8rem; }
      .blog-form textarea.content-area { min-height:400px; font-family:'Space Mono', monospace; font-size:.88rem; line-height:1.6; resize:vertical; }
      .blog-form textarea.excerpt-area { min-height:80px; resize:vertical; }
      .char-counter { float:right; font-size:.8rem; color:var(--muted, #888); margin-top:-1rem; margin-bottom:1rem; }
      .blog-form .btn-row { display:flex; gap:.8rem; margin-top:1rem; flex-wrap:wrap; align-items:center; }
      .blog-form .btn-save, .blog-form .btn-publish {
        padding:.7rem 2rem; border:none; border-radius:6px; font-size:1rem; font-weight:600; cursor:pointer;
      }
      .blog-form .btn-save { background:var(--border, #333); color:var(--text, #eee); }
      .blog-form .btn-publish { background:var(--accent, #14b8a6); color:#fff; }
      .blog-form .btn-save:hover, .blog-form .btn-publish:hover { opacity:.9; }
      .blog-form .btn-back { padding:.7rem 1.5rem; background:transparent; color:var(--muted, #aaa); border:1px solid var(--border, #333); border-radius:6px; cursor:pointer; text-decoration:none; font-size:1rem; }
      .blog-form .btn-delete { padding:.7rem 1.5rem; background:#ef444422; color:#ef4444; border:1px solid #ef444444; border-radius:6px; cursor:pointer; font-size:.9rem; margin-left:auto; }
      .blog-form .btn-delete:hover { background:#ef444444; }
      .toast { position:fixed; top:1.5rem; right:1.5rem; padding:.8rem 1.5rem; border-radius:6px; font-weight:500; z-index:9999; transition:opacity .3s; }
      .toast-success { background:#22c55e22; color:#22c55e; border:1px solid #22c55e44; }
      .toast-error { background:#ef444422; color:#ef4444; border:1px solid #ef444444; }
    </style>
    <div class="card blog-form">
      <h3>${isEdit ? 'Edit Post' : 'New Post'}</h3>
      <form id="blogForm" style="margin-top:1.2rem">

        <label for="title">Title</label>
        <input type="text" id="title" name="title" class="title-input" value="${esc(p.title)}" required maxlength="200" placeholder="Post title...">

        <label for="slug">Slug <span style="font-weight:300;text-transform:none;font-size:.8rem;">(auto-generated from title if empty)</span></label>
        <input type="text" id="slug" name="slug" value="${esc(p.slug)}" placeholder="auto-generated-slug" maxlength="200">

        <label for="category">Category</label>
        <select id="category" name="category">
          <option value="">Select category...</option>
          ${categoryOptions}
        </select>

        <label for="tags">Tags <span style="font-weight:300;text-transform:none;font-size:.8rem;">(comma-separated)</span></label>
        <input type="text" id="tags" name="tags" value="${esc(p.tags)}" placeholder="AI, automation, enterprise">

        <label for="excerpt">Excerpt</label>
        <textarea id="excerpt" name="excerpt" class="excerpt-area" maxlength="200" placeholder="Brief summary (max 200 chars)...">${esc(p.excerpt)}</textarea>
        <div class="char-counter"><span id="excerptCount">${(p.excerpt || '').length}</span>/200</div>

        <label for="content_markdown">Content (Markdown)</label>
        <textarea id="content_markdown" name="content_markdown" class="content-area" placeholder="Write your post in Markdown...">${esc(p.content_markdown)}</textarea>

        <label for="meta_description">Meta Description</label>
        <textarea id="meta_description" name="meta_description" maxlength="160" style="min-height:60px;" placeholder="SEO meta description (max 160 chars)...">${esc(p.meta_description)}</textarea>
        <div class="char-counter"><span id="metaCount">${(p.meta_description || '').length}</span>/160</div>

        <div class="btn-row">
          <a href="/admin/blog" class="btn-back">Back</a>
          <button type="button" class="btn-save" id="btnDraft">Save Draft</button>
          <button type="button" class="btn-publish" id="btnPublish">Publish</button>
          ${isEdit ? `<button type="button" class="btn-delete" id="btnDelete">Delete</button>` : ''}
        </div>
      </form>
    </div>

    <script>
    (function() {
      const excerptEl = document.getElementById('excerpt');
      const excerptCounter = document.getElementById('excerptCount');
      excerptEl.addEventListener('input', () => { excerptCounter.textContent = excerptEl.value.length; });

      const metaEl = document.getElementById('meta_description');
      const metaCounter = document.getElementById('metaCount');
      metaEl.addEventListener('input', () => { metaCounter.textContent = metaEl.value.length; });

      // Auto-slug from title
      const titleEl = document.getElementById('title');
      const slugEl = document.getElementById('slug');
      ${!isEdit ? `
      titleEl.addEventListener('input', () => {
        if (!slugEl.dataset.manual) {
          slugEl.value = titleEl.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }
      });
      slugEl.addEventListener('input', () => { slugEl.dataset.manual = '1'; });
      ` : ''}

      function showToast(msg, type) {
        const el = document.createElement('div');
        el.className = 'toast toast-' + type;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
      }

      const csrf = document.querySelector('meta[name="csrf-token"]').content;

      function getData() {
        return {
          title: titleEl.value,
          slug: slugEl.value,
          category: document.getElementById('category').value,
          tags: document.getElementById('tags').value,
          excerpt: excerptEl.value,
          content_markdown: document.getElementById('content_markdown').value,
          meta_description: metaEl.value
        };
      }

      async function submit(status) {
        const data = getData();
        data.status = status;
        const isEdit = ${isEdit ? 'true' : 'false'};
        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? '/api/admin/blog/api/${p.id || ''}' : '/api/admin/blog/api';
        try {
          const resp = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify(data)
          });
          const result = await resp.json();
          if (resp.ok) {
            showToast(result.message || 'Saved!', 'success');
            if (!isEdit && result.id) {
              setTimeout(() => { location.href = '/admin/blog/' + result.id; }, 800);
            }
          } else {
            showToast(result.error || 'Save failed', 'error');
          }
        } catch (err) {
          showToast('Network error', 'error');
        }
      }

      document.getElementById('btnDraft').addEventListener('click', () => submit('draft'));
      document.getElementById('btnPublish').addEventListener('click', () => submit('published'));

      ${isEdit ? `
      const btnDel = document.getElementById('btnDelete');
      if (btnDel) {
        btnDel.addEventListener('click', async () => {
          if (!confirm('Delete this post permanently?')) return;
          try {
            const resp = await fetch('/api/admin/blog/api/${p.id || ''}', {
              method: 'DELETE',
              headers: { 'X-CSRF-Token': csrf }
            });
            const result = await resp.json();
            if (resp.ok) {
              showToast('Post deleted', 'success');
              setTimeout(() => { location.href = '/admin/blog'; }, 800);
            } else {
              showToast(result.error || 'Delete failed', 'error');
            }
          } catch (err) {
            showToast('Network error', 'error');
          }
        });
      }
      ` : ''}
    })();
    </script>
  `;
}

// ---------------------------------------------------------------------------
// GET / — Blog post list
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (req, res) => {
  const unreadCount = (get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;

  // Search & filter params
  const q = (req.query.q || '').trim();
  const filterCat = req.query.category || '';
  const filterStatus = req.query.status || '';
  const filterFrom = req.query.from || '';
  const filterTo = req.query.to || '';
  const matchAll = req.query.match === 'all';

  // Build query
  let where = [];
  let params = [];

  if (q) {
    const like = '%' + q + '%';
    if (matchAll) {
      // Match all: search term must appear in title AND content
      where.push("(title LIKE ? AND (content_markdown LIKE ? OR content_html LIKE ?))");
      params.push(like, like, like);
    } else {
      where.push("(title LIKE ? OR content_markdown LIKE ? OR content_html LIKE ? OR category LIKE ? OR tags LIKE ?)");
      params.push(like, like, like, like, like);
    }
  }
  if (filterCat) { where.push("category = ?"); params.push(filterCat); }
  if (filterStatus) { where.push("status = ?"); params.push(filterStatus); }
  if (filterFrom) { where.push("date(COALESCE(published_at, created_at)) >= ?"); params.push(filterFrom); }
  if (filterTo) { where.push("date(COALESCE(published_at, created_at)) <= ?"); params.push(filterTo); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const posts = all('SELECT id, title, slug, category, status, tags, published_at, created_at FROM blog_posts ' + whereClause + ' ORDER BY created_at DESC', params);
  const totalAll = (get('SELECT COUNT(*) AS c FROM blog_posts') || {}).c || 0;
  const totalPublished = (get("SELECT COUNT(*) AS c FROM blog_posts WHERE status='published'") || {}).c || 0;
  const totalDraft = (get("SELECT COUNT(*) AS c FROM blog_posts WHERE status='draft'") || {}).c || 0;

  // Category options
  const catOptions = CATEGORIES.map(c =>
    '<option value="' + esc(c) + '"' + (filterCat === c ? ' selected' : '') + '>' + esc(c) + '</option>'
  ).join('');

  const rows = posts.map(p => {
    const date = p.published_at || p.created_at;
    return `
    <tr onclick="location.href='/admin/blog/${p.id}'" style="cursor:pointer">
      <td style="max-width:320px;">
        <div style="font-weight:600;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.title)}</div>
        ${p.tags ? '<div style="font-size:.7rem;color:var(--muted);margin-top:2px;">' + esc(p.tags).split(',').slice(0,3).map(t => '<span style="background:var(--surface,rgba(255,255,255,.06));padding:.1rem .4rem;border-radius:3px;margin-right:.3rem;">' + t.trim() + '</span>').join('') + '</div>' : ''}
      </td>
      <td>${esc(p.category)}</td>
      <td><span class="status-badge status-${esc(p.status)}">${esc(p.status)}</span></td>
      <td style="font-size:.85rem;">${date ? new Date(date).toLocaleDateString() : '\u2014'}</td>
    </tr>`;
  }).join('');

  const content = `
    <style>
      .blog-table { width:100%; border-collapse:collapse; }
      .blog-table th, .blog-table td { padding:.65rem 1rem; text-align:left; border-bottom:1px solid var(--border, #333); }
      .blog-table tr:hover { background:var(--surface-hover, rgba(255,255,255,.04)); }
      .blog-table th { color:var(--muted, #888); font-weight:500; font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; }
      .status-badge { padding:.2rem .6rem; border-radius:4px; font-size:.78rem; font-weight:500; }
      .status-published { background:#22c55e22; color:#22c55e; }
      .status-draft { background:#eab30822; color:#eab308; }
      .btn-new { display:inline-block; padding:.5rem 1.2rem; background:var(--accent, #14b8a6); color:#fff; border:none; border-radius:6px; font-size:.9rem; font-weight:600; cursor:pointer; text-decoration:none; }
      .btn-new:hover { opacity:.9; text-decoration:none; }
      .blog-search { display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; }
      .blog-search input[type="text"] { flex:1; min-width:200px; padding:.5rem .8rem; background:var(--surface, rgba(255,255,255,.06)); border:1px solid var(--border, #333); border-radius:6px; color:var(--text, #fff); font-size:.88rem; }
      .blog-search input[type="text"]:focus { outline:none; border-color:var(--accent, #14b8a6); }
      .blog-search select, .blog-search input[type="date"] { padding:.5rem .6rem; background:var(--surface, rgba(255,255,255,.06)); border:1px solid var(--border, #333); border-radius:6px; color:var(--text, #fff); font-size:.82rem; }
      .blog-search select:focus, .blog-search input[type="date"]:focus { outline:none; border-color:var(--accent, #14b8a6); }
      .blog-search .btn-search { padding:.5rem 1rem; background:var(--accent, #14b8a6); color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:.85rem; }
      .blog-search .btn-search:hover { opacity:.9; }
      .blog-search .btn-clear { padding:.5rem .8rem; background:none; color:var(--muted, #888); border:1px solid var(--border, #333); border-radius:6px; cursor:pointer; font-size:.82rem; }
      .blog-search .btn-clear:hover { color:var(--text); border-color:var(--text-muted); }
      .blog-stats { display:flex; gap:1rem; margin-bottom:1rem; font-size:.8rem; }
      .blog-stat { padding:.3rem .7rem; border-radius:6px; font-weight:600; }
      .match-toggle { display:flex; align-items:center; gap:.3rem; font-size:.78rem; color:var(--muted); cursor:pointer; }
      .match-toggle input { margin:0; }
    </style>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <div>
          <h3 style="margin-bottom:.2rem;">Blog Posts</h3>
          <div class="blog-stats">
            <span class="blog-stat" style="background:rgba(255,255,255,.06);">${totalAll} total</span>
            <span class="blog-stat" style="background:#22c55e15;color:#22c55e;">${totalPublished} published</span>
            <span class="blog-stat" style="background:#eab30815;color:#eab308;">${totalDraft} drafts</span>
            ${posts.length !== totalAll ? '<span class="blog-stat" style="background:rgba(15,193,183,.12);color:var(--accent);">' + posts.length + ' matched</span>' : ''}
          </div>
        </div>
        <a href="/admin/blog/new" class="btn-new">+ New Post</a>
      </div>

      <form class="blog-search" method="GET" action="/admin/blog" style="margin-bottom:1rem;">
        <input type="text" name="q" value="${esc(q)}" placeholder="Search title, content, tags..." />
        <select name="category">
          <option value="">All Categories</option>
          ${catOptions}
        </select>
        <select name="status">
          <option value="">All Status</option>
          <option value="published"${filterStatus === 'published' ? ' selected' : ''}>Published</option>
          <option value="draft"${filterStatus === 'draft' ? ' selected' : ''}>Draft</option>
        </select>
        <input type="date" name="from" value="${esc(filterFrom)}" title="From date" />
        <input type="date" name="to" value="${esc(filterTo)}" title="To date" />
        <label class="match-toggle" title="When checked, search term must appear in both title AND content"><input type="checkbox" name="match" value="all"${matchAll ? ' checked' : ''} /> Match All</label>
        <button type="submit" class="btn-search">Search</button>
        <a href="/admin/blog" class="btn-clear">Clear</a>
      </form>

      <table class="blog-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4" style="color:var(--muted);padding:2rem;text-align:center;">No posts' + (q || filterCat || filterStatus ? ' matching your search' : ' yet. Create your first post') + '.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  res.send(adminLayout({
    title: 'Blog',
    page: 'blog',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount,
    content
  }));
});

// ---------------------------------------------------------------------------
// GET /new — New post form
// ---------------------------------------------------------------------------
router.get('/new', requireAuth, (req, res) => {
  const unreadCount = (get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;

  res.send(adminLayout({
    title: 'New Post',
    page: 'blog',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount,
    content: blogForm(null, req.csrfToken, false)
  }));
});

// ---------------------------------------------------------------------------
// GET /:id — Edit post form (skip if id === 'api')
// ---------------------------------------------------------------------------
router.get('/:id', requireAuth, (req, res, next) => {
  if (req.params.id === 'api') return next();

  const post = get('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).send('Post not found');

  const unreadCount = (get('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0') || {}).c || 0;

  res.send(adminLayout({
    title: 'Edit: ' + (post.title || post.slug),
    page: 'blog',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount,
    content: blogForm(post, req.csrfToken, true)
  }));
});

// ---------------------------------------------------------------------------
// POST /api — Create post
// ---------------------------------------------------------------------------
router.post('/api', requireAuth, requireRole('admin', 'editor'), validateCsrf, (req, res) => {
  const { title, slug: rawSlug, category, tags, excerpt, content_markdown, meta_description, status } = req.body || {};

  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

  const slug = (rawSlug && rawSlug.trim()) ? slugify(rawSlug) : slugify(title);
  if (!slug) return res.status(400).json({ error: 'Could not generate a valid slug' });

  // Check uniqueness
  const existing = get('SELECT id FROM blog_posts WHERE slug = ?', [slug]);
  if (existing) return res.status(409).json({ error: 'A post with this slug already exists' });

  // Convert markdown to HTML
  const contentHtml = content_markdown ? marked.parse(content_markdown) : '';

  const postStatus = status === 'published' ? 'published' : 'draft';
  const publishedAt = postStatus === 'published' ? new Date().toISOString() : null;

  const result = insert('blog_posts', {
    slug,
    title: title.trim(),
    excerpt: (excerpt || '').trim().slice(0, 200),
    content_html: contentHtml,
    content_markdown: (content_markdown || ''),
    category: (category || '').trim(),
    tags: (tags || '').trim(),
    meta_description: (meta_description || '').trim().slice(0, 160),
    status: postStatus,
    author_id: req.user.id,
    published_at: publishedAt,
    updated_at: new Date().toISOString()
  });

  // Generate static HTML file if published
  if (postStatus === 'published') {
    try {
      generatePostFile(slug);
    } catch (err) {
      console.error('[cms-blog] Error generating post file:', err.message);
    }

    // Create notification
    const blogTitle = 'Blog Post Published';
    const blogMessage = `"${title.trim()}" was published`;
    insert('notifications', {
      type: 'blog',
      title: blogTitle,
      message: blogMessage,
      is_read: 0
    });
    dispatchNotification(blogTitle, blogMessage, 'blog');
  }

  res.json({ ok: true, id: result.lastInsertRowid, slug, message: 'Post created' });
});

// ---------------------------------------------------------------------------
// PUT /api/:id — Update post
// ---------------------------------------------------------------------------
router.put('/api/:id', requireAuth, requireRole('admin', 'editor'), validateCsrf, (req, res) => {
  const postId = req.params.id;
  const post = get('SELECT * FROM blog_posts WHERE id = ?', [postId]);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const { title, slug: rawSlug, category, tags, excerpt, content_markdown, meta_description, status } = req.body || {};

  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

  const slug = (rawSlug && rawSlug.trim()) ? slugify(rawSlug) : post.slug;

  // Check slug uniqueness if changed
  if (slug !== post.slug) {
    const existing = get('SELECT id FROM blog_posts WHERE slug = ? AND id != ?', [slug, postId]);
    if (existing) return res.status(409).json({ error: 'A post with this slug already exists' });
  }

  // Convert markdown to HTML
  const contentHtml = content_markdown ? marked.parse(content_markdown) : post.content_html;

  const postStatus = status === 'published' ? 'published' : 'draft';
  const wasPublished = post.status === 'published';
  const isNowPublished = postStatus === 'published';

  let publishedAt = post.published_at;
  if (isNowPublished && !publishedAt) {
    publishedAt = new Date().toISOString();
  }

  update('blog_posts', postId, {
    slug,
    title: title.trim(),
    excerpt: (excerpt || '').trim().slice(0, 200),
    content_html: contentHtml,
    content_markdown: (content_markdown || ''),
    category: (category || '').trim(),
    tags: (tags || '').trim(),
    meta_description: (meta_description || '').trim().slice(0, 160),
    status: postStatus,
    published_at: publishedAt,
    updated_at: new Date().toISOString()
  });

  // If slug changed, remove old file
  if (slug !== post.slug && wasPublished) {
    const oldPath = path.join(__dirname, '..', '..', 'public', 'blog', `${post.slug}.html`);
    try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch {}
  }

  // Generate / remove static file
  if (isNowPublished) {
    try {
      generatePostFile(slug);
    } catch (err) {
      console.error('[cms-blog] Error generating post file:', err.message);
    }
  } else if (wasPublished && !isNowPublished) {
    // Unpublishing — remove HTML file
    const filePath = path.join(__dirname, '..', '..', 'public', 'blog', `${slug}.html`);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
  }

  res.json({ ok: true, message: 'Post updated' });
});

// ---------------------------------------------------------------------------
// DELETE /api/:id — Delete post
// ---------------------------------------------------------------------------
router.delete('/api/:id', requireAuth, requireRole('admin'), validateCsrf, (req, res) => {
  const postId = req.params.id;
  const post = get('SELECT * FROM blog_posts WHERE id = ?', [postId]);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  // Remove HTML file
  const filePath = path.join(__dirname, '..', '..', 'public', 'blog', `${post.slug}.html`);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}

  // Delete from DB
  run('DELETE FROM blog_posts WHERE id = ?', [postId]);

  res.json({ ok: true, message: 'Post deleted' });
});

module.exports = router;
