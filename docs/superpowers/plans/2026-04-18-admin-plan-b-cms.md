# Admin Panel CMS — Implementation Plan (Plan B of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CMS module — pages editor (edit existing site pages) and blog manager (create/edit/delete/publish posts with markdown) — inside the admin panel foundation from Plan A.

**Architecture:** Two new route files (`admin/routes/cms-pages.js`, `admin/routes/cms-blog.js`) serve both admin UI pages and JSON APIs. Pages editor reads/writes from the `pages` DB table and regenerates static HTML files. Blog manager uses `blog_posts` table with markdown→HTML conversion via `marked`, generates individual post HTML files from a template, and rebuilds the blog listing page.

**Tech Stack:** Express.js routes, SQLite (via db.js from Plan A), marked (markdown→HTML), adminLayout (from Plan A)

**Spec:** `docs/superpowers/specs/2026-04-18-admin-crm-design.md` §8.1 + §8.2

**Depends on:** Plan A (database, auth, admin shell)

---

## File Structure

**New files:**
```
admin/routes/
  cms-pages.js      — pages list + edit API + page renderer
  cms-blog.js       — blog list + create/edit/delete/publish API + page renderer
admin/templates/
  blog-post.js      — HTML template function for generating blog post files
```

**Modified files:**
```
server.js           — mount CMS routes, replace placeholder pages
package.json        — add marked dependency
```

---

### Task 1: Pages CMS module

**Files:**
- Create: `admin/routes/cms-pages.js`
- Modify: `server.js` (mount route, replace placeholder)

- [ ] **Step 1: Install marked**

```bash
cd Y:/AimTechAI
npm install marked
```

- [ ] **Step 2: Scan existing pages into DB on first run**

Add to `db/seed.js` — after existing seed logic, add a page scanner:

```js
const path = require('path');
const fs = require('fs');

function seedPages() {
  const pageCount = get('SELECT COUNT(*) as c FROM pages').c;
  if (pageCount > 0) return;

  const publicDir = path.join(__dirname, '..', 'public');
  const mainPages = ['index', 'about', 'ai', 'cloud', 'consulting', 'portfolio', 'qa', 'ui-ux', 'blog'];

  for (const slug of mainPages) {
    const filePath = path.join(publicDir, `${slug}.html`);
    if (!fs.existsSync(filePath)) continue;
    const html = fs.readFileSync(filePath, 'utf8');
    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/);
    insert('pages', {
      slug,
      title: titleMatch ? titleMatch[1].split('|')[0].trim() : slug,
      meta_description: descMatch ? descMatch[1] : '',
      content_html: html,
      status: 'published',
    });
  }
  console.log('[seed] Registered existing pages in DB');
}
```

Export and call `seedPages()` from the `seed()` function.

- [ ] **Step 3: Create `admin/routes/cms-pages.js`**

```js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { get, all, run, update } = require('../../db/db');
const { requireAuth, requireRole, validateCsrf } = require('../middleware/auth');
const { adminLayout } = require('../views/render');

const router = express.Router();
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// GET /admin/pages — list all pages
router.get('/', requireAuth, (req, res) => {
  const pages = all('SELECT id, slug, title, status, updated_at FROM pages ORDER BY id');
  const unread = get('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').c;

  const rows = pages.map(p => `
    <tr data-id="${p.id}" style="cursor:pointer" onclick="location.href='/admin/pages/${p.id}'">
      <td><strong>${esc(p.title)}</strong></td>
      <td class="text-dim text-sm">/${esc(p.slug)}</td>
      <td><span class="badge-sm ${p.status === 'published' ? 'badge-green' : 'badge-yellow'}">${p.status}</span></td>
      <td class="text-dim text-sm">${p.updated_at || '—'}</td>
    </tr>
  `).join('');

  const content = `
    <div class="flex-between mb-1">
      <div></div>
      <a href="/" target="_blank" class="btn btn-secondary btn-sm">View Site →</a>
    </div>
    <div class="card">
      <table class="admin-table">
        <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  res.send(adminLayout({ title: 'Pages', page: 'pages', user: req.user, csrfToken: req.csrfToken, unreadCount: unread, content }));
});

// GET /admin/pages/:id — edit page
router.get('/:id', requireAuth, (req, res) => {
  const page = get('SELECT * FROM pages WHERE id = ?', [req.params.id]);
  if (!page) return res.redirect('/admin/pages');
  const unread = get('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').c;

  const content = `
    <div class="flex-between mb-1">
      <a href="/admin/pages" class="btn btn-secondary btn-sm">← Back to Pages</a>
      <a href="/${esc(page.slug)}" target="_blank" class="btn btn-secondary btn-sm">Preview →</a>
    </div>
    <div class="card">
      <form id="page-form">
        <div class="form-group">
          <label>Title</label>
          <input name="title" class="form-input" value="${esc(page.title)}" required>
        </div>
        <div class="form-group">
          <label>Slug (read-only)</label>
          <input class="form-input" value="/${esc(page.slug)}" disabled>
        </div>
        <div class="form-group">
          <label>Meta Description <span class="text-dim text-sm" id="meta-count">0/160</span></label>
          <textarea name="meta_description" class="form-input" maxlength="160" oninput="document.getElementById('meta-count').textContent=this.value.length+'/160'">${esc(page.meta_description)}</textarea>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select name="status" class="form-input">
            <option value="published" ${page.status==='published'?'selected':''}>Published</option>
            <option value="draft" ${page.status==='draft'?'selected':''}>Draft</option>
          </select>
        </div>
        <div class="flex gap-1" style="margin-top:1rem;">
          <button type="submit" class="btn btn-primary">Save Page</button>
        </div>
      </form>
    </div>
    <script>
      document.getElementById('page-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        const res = await adminFetch('/api/admin/pages/${page.id}', { method: 'PUT', body: JSON.stringify(data) });
        if (res.ok) { alert('Page saved'); location.reload(); }
        else alert(res.error || 'Failed');
      });
    </script>
  `;

  res.send(adminLayout({ title: `Edit: ${page.title}`, page: 'pages', user: req.user, csrfToken: req.csrfToken, unreadCount: unread, content }));
});

// PUT /api/admin/pages/:id — update page
router.put('/api/:id', requireAuth, requireRole('admin', 'editor'), validateCsrf, (req, res) => {
  const { title, meta_description, status } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  update('pages', req.params.id, {
    title: String(title).slice(0, 200),
    meta_description: String(meta_description || '').slice(0, 160),
    status: status === 'draft' ? 'draft' : 'published',
    updated_by: req.user.id,
    updated_at: new Date().toISOString(),
  });

  // Update the <title> and <meta description> in the actual HTML file
  const page = get('SELECT * FROM pages WHERE id = ?', [req.params.id]);
  if (page && page.content_html) {
    let html = page.content_html;
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${String(title).slice(0, 200)} | AIM Tech AI</title>`);
    html = html.replace(/<meta\s+name="description"\s+content="[^"]*"/, `<meta name="description" content="${String(meta_description || '').slice(0, 160).replace(/"/g, '&quot;')}"`);

    const filePath = path.join(PUBLIC_DIR, `${page.slug}.html`);
    fs.writeFileSync(filePath, html, 'utf8');

    // Update stored HTML too
    run('UPDATE pages SET content_html = ? WHERE id = ?', [html, req.params.id]);
  }

  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 4: Mount in server.js**

Add after existing admin routes (replace the 'pages' placeholder):

```js
const cmsPagesRoutes = require('./admin/routes/cms-pages');
app.use('/admin/pages', cmsPagesRoutes);
app.use('/api/admin/pages', cmsPagesRoutes);
```

Remove 'pages' from the placeholder pages array.

- [ ] **Step 5: Commit**

```bash
git add admin/routes/cms-pages.js db/seed.js server.js package.json package-lock.json
git commit -m "feat(admin): CMS pages module — list, edit, save with HTML regeneration"
```

---

### Task 2: Blog CMS module — listing + create/edit

**Files:**
- Create: `admin/routes/cms-blog.js`
- Create: `admin/templates/blog-post.js`

- [ ] **Step 1: Scan existing blog posts into DB on first run**

Add to `db/seed.js` a `seedBlogPosts()` function:

```js
function seedBlogPosts() {
  const postCount = get('SELECT COUNT(*) as c FROM blog_posts').c;
  if (postCount > 0) return;

  const blogDir = path.join(__dirname, '..', 'public', 'blog');
  if (!fs.existsSync(blogDir)) return;

  const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.html'));
  for (const file of files) {
    const slug = file.replace('.html', '');
    const html = fs.readFileSync(path.join(blogDir, file), 'utf8');
    const titleMatch = html.match(/<h1[^>]*>([^<]*)<\/h1>/) || html.match(/<title>([^|<]*)/);
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/);
    const categoryMatch = html.match(/"articleSection"\s*:\s*"([^"]*)"/);
    const dateMatch = html.match(/"datePublished"\s*:\s*"([^"]*)"/);

    insert('blog_posts', {
      slug,
      title: titleMatch ? titleMatch[1].trim() : slug,
      excerpt: descMatch ? descMatch[1].slice(0, 200) : '',
      content_html: html,
      category: categoryMatch ? categoryMatch[1] : 'AI & ML',
      tags: '',
      meta_description: descMatch ? descMatch[1] : '',
      status: 'published',
      published_at: dateMatch ? dateMatch[1] : new Date().toISOString(),
    });
  }
  console.log(`[seed] Registered ${files.length} existing blog posts in DB`);
}
```

Call `seedBlogPosts()` from `seed()`.

- [ ] **Step 2: Create `admin/templates/blog-post.js`**

A function that generates a complete blog post HTML file from data:

```js
function blogPostTemplate({ title, slug, excerpt, contentHtml, category, tags, metaDescription, publishedAt }) {
  const tagsList = (tags || '').split(',').filter(Boolean).map(t => t.trim());
  const canonical = `https://aimtechai.com/blog/${slug}`;
  const dateStr = publishedAt ? new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} | AIM Tech AI</title>
  <meta name="description" content="${esc(metaDescription || excerpt || '')}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(metaDescription || excerpt || '')}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/styles.css">
  <script type="application/ld+json">
  [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": ${JSON.stringify(title)},
      "description": ${JSON.stringify(metaDescription || excerpt || '')},
      "url": "${canonical}",
      "datePublished": "${publishedAt || new Date().toISOString().split('T')[0]}",
      "author": {"@type": "Organization", "name": "AIM Tech AI"},
      "publisher": {"@type": "Organization", "name": "AIM Tech AI", "url": "https://aimtechai.com"},
      "keywords": ${JSON.stringify(tagsList)},
      "articleSection": ${JSON.stringify(category || '')}
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://aimtechai.com"},
        {"@type": "ListItem", "position": 2, "name": "Blog", "item": "https://aimtechai.com/blog"},
        {"@type": "ListItem", "position": 3, "name": ${JSON.stringify(title)}, "item": "${canonical}"}
      ]
    }
  ]
  </script>
</head>
<body>
  <div class="noise-overlay"></div>
  <nav id="navbar">
    <a href="/" class="nav-logo">AIM<span>TECH</span>AI</a>
    <ul class="nav-links" id="nav-links">
      <li><a href="/#services">Services</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/portfolio">Portfolio</a></li>
      <li><a href="/blog">Blog</a></li>
      <li><a href="/#contact">Contact</a></li>
    </ul>
    <div class="nav-actions">
      <button class="theme-toggle" id="theme-toggle" aria-label="Toggle light/dark mode">
        <span class="theme-toggle-icon" id="theme-icon">&#127769;</span>
      </button>
      <a href="/#contact" class="nav-cta">Get Started</a>
    </div>
    <div class="mobile-toggle" id="mobile-toggle"><span></span><span></span><span></span></div>
  </nav>

  <div class="content">
    <div class="page-hero">
      <div class="breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/blog">Blog</a> &rsaquo; ${esc(title)}</div>
      <h1>${esc(title)}</h1>
      <p class="hero-sub" style="opacity:1;transform:none;">${dateStr}${category ? ' &middot; ' + esc(category) : ''}</p>
    </div>

    <section style="padding:2rem;">
      <div style="max-width:800px;margin:0 auto;background:linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08));backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.22);border-radius:20px;padding:3rem;box-shadow:0 8px 32px rgba(0,0,0,0.25);">
        ${contentHtml}
        ${tagsList.length ? `<div style="margin-top:2rem;display:flex;gap:0.5rem;flex-wrap:wrap;">${tagsList.map(t => `<span style="font-size:0.8rem;padding:0.2rem 0.6rem;border:1px solid rgba(255,255,255,0.15);border-radius:12px;color:rgba(255,255,255,0.7);">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
    </section>
  </div><!-- .content -->

  <!-- FOOTER -->
  <footer id="footer" style="padding-top:4rem;">
    <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 2fr;gap:4rem;text-align:left;padding:0 2rem;">
      <div>
        <div class="footer-logo">AIM<span>TECH</span>AI</div>
        <p style="color:var(--clr-text-dim);font-size:0.85rem;font-weight:300;line-height:1.8;margin-top:1rem;">Enhancing the efficiency of software development through transparency, integrity, and partnership.</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2rem;">
        <div><small style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:3px;text-transform:uppercase;color:var(--clr-text-dim);">Services</small><ul class="footer-links" style="flex-direction:column;justify-content:flex-start;gap:0.8rem;margin-top:1rem;"><li><a href="/ai">AI &amp; ML</a></li><li><a href="/consulting">Consulting</a></li><li><a href="/ui-ux">UI/UX</a></li><li><a href="/cloud">Cloud</a></li><li><a href="/qa">QA</a></li></ul></div>
        <div><small style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:3px;text-transform:uppercase;color:var(--clr-text-dim);">Company</small><ul class="footer-links" style="flex-direction:column;justify-content:flex-start;gap:0.8rem;margin-top:1rem;"><li><a href="/about">About</a></li><li><a href="/portfolio">Portfolio</a></li><li><a href="/blog">Blog</a></li></ul></div>
        <div><small style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:3px;text-transform:uppercase;color:var(--clr-text-dim);">Contact</small><ul class="footer-links" style="flex-direction:column;justify-content:flex-start;gap:0.8rem;margin-top:1rem;"><li><a href="tel:+13104218638">(310) 421-8638</a></li><li><a href="/#contact">Get in Touch</a></li></ul></div>
      </div>
    </div>
    <div style="border-top:1px solid var(--clr-border);margin-top:3rem;padding-top:2rem;text-align:center;">
      <p>&copy; 2026 AIM Tech AI LLC. All rights reserved. Beverly Hills, California.</p>
    </div>
  </footer>

  <script type="module">
    import { initUI } from '/js/ui.js';
    import { initParallaxVideoBg } from '/js/parallax-video-bg.js';
    initParallaxVideoBg();
    initUI();
  </script>
</body>
</html>`;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

module.exports = { blogPostTemplate };
```

- [ ] **Step 3: Create `admin/routes/cms-blog.js`**

```js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { get, all, run, insert, update } = require('../../db/db');
const { requireAuth, requireRole, validateCsrf } = require('../middleware/auth');
const { adminLayout } = require('../views/render');
const { blogPostTemplate } = require('../templates/blog-post');

const router = express.Router();
const BLOG_DIR = path.join(__dirname, '..', '..', 'public', 'blog');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// GET /admin/blog — list all posts
router.get('/', requireAuth, (req, res) => {
  const posts = all('SELECT id, slug, title, category, status, published_at, created_at FROM blog_posts ORDER BY created_at DESC');
  const unread = get('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').c;

  const rows = posts.map(p => `
    <tr style="cursor:pointer" onclick="location.href='/admin/blog/${p.id}'">
      <td><strong>${esc(p.title)}</strong></td>
      <td><span class="badge-sm badge-teal">${esc(p.category || '')}</span></td>
      <td><span class="badge-sm ${p.status==='published'?'badge-green':'badge-yellow'}">${p.status}</span></td>
      <td class="text-dim text-sm">${p.published_at || p.created_at || '—'}</td>
    </tr>
  `).join('');

  const content = `
    <div class="flex-between mb-1">
      <div></div>
      <a href="/admin/blog/new" class="btn btn-primary btn-sm">✏️ New Post</a>
    </div>
    <div class="card">
      <table class="admin-table">
        <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  res.send(adminLayout({ title: 'Blog', page: 'blog', user: req.user, csrfToken: req.csrfToken, unreadCount: unread, content }));
});

// GET /admin/blog/new — new post form
router.get('/new', requireAuth, (req, res) => {
  const unread = get('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').c;
  res.send(adminLayout({
    title: 'New Blog Post',
    page: 'blog',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount: unread,
    content: blogForm(null, req.csrfToken),
  }));
});

// GET /admin/blog/:id — edit post
router.get('/:id', requireAuth, (req, res) => {
  if (req.params.id === 'api') return; // skip API routes
  const post = get('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!post) return res.redirect('/admin/blog');
  const unread = get('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').c;
  res.send(adminLayout({
    title: `Edit: ${post.title}`,
    page: 'blog',
    user: req.user,
    csrfToken: req.csrfToken,
    unreadCount: unread,
    content: blogForm(post, req.csrfToken),
  }));
});

function blogForm(post, csrf) {
  const isNew = !post;
  const action = isNew ? '/api/admin/blog' : `/api/admin/blog/${post?.id}`;
  const method = isNew ? 'POST' : 'PUT';

  return `
    <a href="/admin/blog" class="btn btn-secondary btn-sm" style="margin-bottom:1rem;">← Back to Blog</a>
    <div class="card">
      <form id="blog-form">
        <div class="form-group">
          <label>Title</label>
          <input name="title" class="form-input" value="${esc(post?.title || '')}" required style="font-size:1.2rem;font-weight:700;">
        </div>
        <div class="form-group">
          <label>Slug</label>
          <input name="slug" class="form-input" value="${esc(post?.slug || '')}" placeholder="auto-generated-from-title">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div class="form-group">
            <label>Category</label>
            <select name="category" class="form-input">
              ${['AI & ML','Engineering','Cloud','Design','Company','Security'].map(c =>
                `<option ${post?.category===c?'selected':''}>${c}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Tags (comma-separated)</label>
            <input name="tags" class="form-input" value="${esc(post?.tags || '')}" placeholder="AI, Automation, Enterprise">
          </div>
        </div>
        <div class="form-group">
          <label>Excerpt</label>
          <textarea name="excerpt" class="form-input" maxlength="200" style="min-height:60px;">${esc(post?.excerpt || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Content (Markdown)</label>
          <textarea name="content_markdown" class="form-input" style="min-height:400px;font-family:monospace;font-size:0.85rem;">${esc(post?.content_markdown || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Meta Description <span class="text-dim text-sm" id="meta-count">0/160</span></label>
          <textarea name="meta_description" class="form-input" maxlength="160" oninput="document.getElementById('meta-count').textContent=this.value.length+'/160'">${esc(post?.meta_description || '')}</textarea>
        </div>
        <div class="flex gap-1" style="margin-top:1rem;">
          <button type="submit" name="action" value="draft" class="btn btn-secondary">Save Draft</button>
          <button type="submit" name="action" value="publish" class="btn btn-primary">Publish</button>
          ${!isNew ? `<button type="button" class="btn btn-danger btn-sm" onclick="deletePost(${post.id})" style="margin-left:auto;">Delete</button>` : ''}
        </div>
      </form>
    </div>
    <script>
      document.getElementById('blog-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        data.status = e.submitter?.value === 'publish' ? 'published' : 'draft';
        // Auto-slug from title if empty
        if (!data.slug) data.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const res = await adminFetch('${action}', { method: '${method}', body: JSON.stringify(data) });
        if (res.ok) { location.href = '/admin/blog'; }
        else alert(res.error || 'Failed');
      });
      ${!isNew ? `
      async function deletePost(id) {
        if (!confirm('Delete this post? This will also remove the HTML file.')) return;
        const res = await adminFetch('/api/admin/blog/' + id, { method: 'DELETE' });
        if (res.ok) location.href = '/admin/blog';
        else alert(res.error || 'Failed');
      }` : ''}
    </script>
  `;
}

// POST /api/admin/blog — create post
router.post('/api', requireAuth, requireRole('admin', 'editor'), validateCsrf, (req, res) => {
  const { title, slug, excerpt, content_markdown, category, tags, meta_description, status } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const finalSlug = (slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).slice(0, 100);
  const existing = get('SELECT 1 FROM blog_posts WHERE slug = ?', [finalSlug]);
  if (existing) return res.status(409).json({ error: 'Slug already exists' });

  const contentHtml = marked.parse(String(content_markdown || ''));
  const isPublished = status === 'published';

  const result = insert('blog_posts', {
    slug: finalSlug,
    title: String(title).slice(0, 200),
    excerpt: String(excerpt || '').slice(0, 200),
    content_html: contentHtml,
    content_markdown: String(content_markdown || ''),
    category: String(category || '').slice(0, 50),
    tags: String(tags || '').slice(0, 500),
    meta_description: String(meta_description || '').slice(0, 160),
    status: isPublished ? 'published' : 'draft',
    author_id: req.user.id,
    published_at: isPublished ? new Date().toISOString() : null,
  });

  if (isPublished) {
    generatePostFile(finalSlug);
    insert('notifications', { type: 'system', title: `Blog published: ${String(title).slice(0, 50)}`, message: `/${finalSlug}`, link: '/admin/blog' });
  }

  res.json({ ok: true, id: result.lastInsertRowid });
});

// PUT /api/admin/blog/:id — update post
router.put('/api/:id', requireAuth, requireRole('admin', 'editor'), validateCsrf, (req, res) => {
  const { title, slug, excerpt, content_markdown, category, tags, meta_description, status } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const post = get('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const contentHtml = marked.parse(String(content_markdown || ''));
  const isPublished = status === 'published';
  const wasPublished = post.status === 'published';

  update('blog_posts', req.params.id, {
    title: String(title).slice(0, 200),
    slug: String(slug || post.slug).slice(0, 100),
    excerpt: String(excerpt || '').slice(0, 200),
    content_html: contentHtml,
    content_markdown: String(content_markdown || ''),
    category: String(category || '').slice(0, 50),
    tags: String(tags || '').slice(0, 500),
    meta_description: String(meta_description || '').slice(0, 160),
    status: isPublished ? 'published' : 'draft',
    published_at: isPublished && !post.published_at ? new Date().toISOString() : post.published_at,
    updated_at: new Date().toISOString(),
  });

  const finalSlug = String(slug || post.slug).slice(0, 100);

  if (isPublished) {
    generatePostFile(finalSlug);
  } else if (wasPublished && !isPublished) {
    // Unpublish: remove HTML file
    const filePath = path.join(BLOG_DIR, `${finalSlug}.html`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  res.json({ ok: true });
});

// DELETE /api/admin/blog/:id — delete post
router.delete('/api/:id', requireAuth, requireRole('admin'), validateCsrf, (req, res) => {
  const post = get('SELECT slug FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  // Remove HTML file
  const filePath = path.join(BLOG_DIR, `${post.slug}.html`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  run('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// Helper: generate HTML file for a published post
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
    publishedAt: post.published_at,
  });

  fs.mkdirSync(BLOG_DIR, { recursive: true });
  fs.writeFileSync(path.join(BLOG_DIR, `${slug}.html`), html, 'utf8');
}

module.exports = router;
```

- [ ] **Step 4: Add `content_markdown` column to schema**

The schema from Task 1 doesn't have a `content_markdown` column on `blog_posts`. Add it:

In `db/schema.sql`, the blog_posts table already has `content_html`. We need to add `content_markdown` for storing the raw markdown source. Since SQLite allows adding columns with ALTER TABLE, add this to `db/db.js` after schema execution:

```js
// Migration: add content_markdown column if missing
try { db.exec('ALTER TABLE blog_posts ADD COLUMN content_markdown TEXT'); } catch {}
```

- [ ] **Step 5: Mount in server.js**

```js
const cmsBlogRoutes = require('./admin/routes/cms-blog');
app.use('/admin/blog', cmsBlogRoutes);
app.use('/api/admin/blog', cmsBlogRoutes);
```

Remove 'blog' from placeholder pages array.

- [ ] **Step 6: Commit**

```bash
git add admin/routes/cms-blog.js admin/templates/blog-post.js db/seed.js db/db.js db/schema.sql server.js package.json package-lock.json
git commit -m "feat(admin): CMS blog module — create, edit, delete, publish with markdown

Blog manager with markdown editor, auto-slug, category/tags, excerpt,
SEO meta. Publish generates HTML from template with JSON-LD schemas,
glass container, full site shell. Delete removes HTML file. Existing
30 blog posts auto-scanned into DB on first run."
```

---

## Self-Review

**Spec coverage:**
- ✅ §8.1 Pages — list, edit title/meta/status, save regenerates HTML
- ✅ §8.2 Blog — list, create, edit, delete, markdown editor, publish generates HTML, categories, tags, excerpt, meta
- ✅ Blog template — glass container, JSON-LD (BlogPosting + BreadcrumbList), nav, footer, video bg

**What Plan B delivers:**
- Pages module: list 9 site pages, edit title + meta + status, save updates the actual HTML file
- Blog module: list 30 posts, create new with markdown editor, edit, delete, publish (generates HTML), unpublish (removes HTML)
- Existing content auto-scanned into DB on first run

**What's deferred:**
- Blog listing page rebuild (blog.html) — currently static, auto-rebuild deferred
- Rich text editor — using textarea + markdown for MVP, can upgrade later
- Version history — schema supports it, not implemented
