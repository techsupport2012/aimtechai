/**
 * Blog post HTML template — generates a complete public-facing blog post page.
 */

const { get } = require('../../db/db');

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

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.slug
 * @param {string} opts.excerpt
 * @param {string} opts.contentHtml - Rendered article body HTML
 * @param {string} opts.category
 * @param {string} opts.tags - Comma-separated tag string
 * @param {string} opts.metaDescription
 * @param {string} opts.publishedAt - ISO date string
 * @returns {string} Full HTML page
 */
function blogPostTemplate({ title, slug, excerpt, contentHtml, category, tags, metaDescription, publishedAt }) {
  const dateStr = publishedAt ? new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const isoDate = publishedAt ? publishedAt.slice(0, 10) : '';
  const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  // ── DB settings ─────────────────────────────────────────────────────────────
  const canonicalBase   = getSetting('seo_canonical_base', 'https://aimtechai.com').replace(/\/$/, '');
  const ogImage         = getSetting('seo_og_image', '/assets/aim_transparent_logo.png');
  const twitterHandle   = getSetting('seo_twitter_handle', '');
  const fbAppId         = getSetting('seo_fb_app_id', '');
  const defaultDesc     = getSetting('seo_default_description', '');
  const googleVerify    = getSetting('seo_google_verification', '');
  const bingVerify      = getSetting('seo_bing_verification', '');
  const gtmId           = getSetting('seo_gtm_id', '');
  const gaId            = getSetting('seo_ga_id', '');
  const jsonldOrg       = getSetting('seo_jsonld_org', '');

  const desc = metaDescription || excerpt || defaultDesc || '';
  const pageUrl = `${canonicalBase}/blog/${slug}`;
  const ogImageAbs = ogImage.startsWith('http') ? ogImage : `${canonicalBase}${ogImage}`;

  // ── Optional head tags ───────────────────────────────────────────────────────
  const verifyTags = [
    googleVerify ? `  <meta name="google-site-verification" content="${esc(googleVerify)}">` : '',
    bingVerify   ? `  <meta name="msvalidate.01" content="${esc(bingVerify)}">` : '',
  ].filter(Boolean).join('\n');

  const socialTags = [
    twitterHandle ? `  <meta name="twitter:site" content="${esc(twitterHandle)}">` : '',
    fbAppId       ? `  <meta property="fb:app_id" content="${esc(fbAppId)}">` : '',
  ].filter(Boolean).join('\n');

  const gtmHeadScript = gtmId ? `
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(gtmId)}');</script>
  <!-- End Google Tag Manager -->` : '';

  const gaHeadScript = gaId ? `
  <!-- Google Analytics 4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${esc(gaId)}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc(gaId)}');</script>
  <!-- End Google Analytics 4 -->` : '';

  // ── JSON-LD ──────────────────────────────────────────────────────────────────
  const keywordsJson = tagList.length > 0 ? `"keywords": ${JSON.stringify(tagList)},` : '';

  const orgJsonLd = jsonldOrg ? `
  <script type="application/ld+json">
  ${jsonldOrg}
  </script>` : '';

  // ── Tags HTML ────────────────────────────────────────────────────────────────
  const tagsHtml = tagList.length > 0
    ? `<div class="blog-tags" style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--clr-border);">
        ${tagList.map(t => `<span style="display:inline-block;padding:0.3rem 0.8rem;margin:0.2rem;background:rgba(15,193,183,0.12);border:1px solid rgba(15,193,183,0.25);border-radius:20px;font-size:0.8rem;color:var(--clr-primary);">${esc(t)}</span>`).join('\n        ')}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} | AIM Tech AI</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${pageUrl}">
${verifyTags ? verifyTags + '\n' : ''}  <meta property="og:title" content="${esc(title)} | AIM Tech AI">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:image" content="${esc(ogImageAbs)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)} | AIM Tech AI">
  <meta name="twitter:description" content="${esc(desc)}">
${socialTags ? socialTags + '\n' : ''}  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="stylesheet" href="/css/blog.css">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": ${JSON.stringify(title)},
    "datePublished": "${isoDate}",
    ${category ? `"articleSection": ${JSON.stringify(category)},` : ''}
    ${keywordsJson}
    "author": {
      "@type": "Organization",
      "name": "AIM Tech AI"
    },
    "description": ${JSON.stringify(desc)},
    "publisher": {
      "@type": "Organization",
      "name": "AIM Tech AI"
    }
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "${canonicalBase}/" },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": "${canonicalBase}/blog" },
      { "@type": "ListItem", "position": 3, "name": ${JSON.stringify(title)} }
    ]
  }
  </script>${orgJsonLd}
  <script>/* theme-init */const t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t);</script>${gtmHeadScript}${gaHeadScript}
</head>
<body>
  <div class="noise-overlay"></div>

  <!-- NAV -->
  <nav id="navbar">
    <a href="/" class="nav-logo">AIM<span>TECH</span>AI</a>
    <ul class="nav-links" id="nav-links">
      <li><a href="/#services" data-scramble>Services</a></li>
      <li><a href="/about" data-scramble>About</a></li>
      <li><a href="/portfolio" data-scramble>Portfolio</a></li>
      <li><a href="/blog" data-scramble>Blog</a></li>
      <li><a href="/#contact" data-scramble>Contact</a></li>
    </ul>
    <div class="nav-actions">
      <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">
        <span class="theme-icon">&#9790;</span>
      </button>
      <button class="mobile-toggle" id="mobile-toggle" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>

  <div class="content">

    <!-- Page Hero -->
    <section class="page-hero" style="padding:6rem 2rem 2rem;text-align:center;">
      <nav class="breadcrumb" style="font-size:0.85rem;color:var(--clr-text-dim);margin-bottom:1.5rem;">
        <a href="/" style="color:var(--clr-primary);text-decoration:none;">Home</a>
        <span style="margin:0 0.5rem;">&rsaquo;</span>
        <a href="/blog" style="color:var(--clr-primary);text-decoration:none;">Blog</a>
        <span style="margin:0 0.5rem;">&rsaquo;</span>
        <span>${esc(title)}</span>
      </nav>
      <h1 style="font-size:clamp(1.8rem,4vw,3rem);margin:0 auto;max-width:800px;">${esc(title)}</h1>
      <div style="margin-top:1rem;font-size:0.9rem;color:var(--clr-text-dim);">
        ${dateStr ? `<time datetime="${isoDate}">${dateStr}</time>` : ''}
        ${category ? `<span style="margin-left:1rem;padding:0.2rem 0.7rem;background:rgba(15,193,183,0.15);border-radius:12px;font-size:0.8rem;color:var(--clr-primary);">${esc(category)}</span>` : ''}
      </div>
    </section>

    <!-- Article Body -->
    <section style="max-width:800px;margin:0 auto;padding:0 2rem 4rem;">
      <div style="background:rgba(255,255,255,0.03);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--clr-border);border-radius:16px;padding:2.5rem;">
        <article class="blog-article-body">
          ${contentHtml}
        </article>
        ${tagsHtml}
      </div>
    </section>

    <div class="glow-divider"></div>

  </div><!-- .content -->

  <!-- FOOTER -->
  <footer id="footer" style="padding-top:4rem;">
    <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 2fr;gap:4rem;text-align:left;padding:0 2rem;">
      <div>
        <div class="footer-logo">AIM<span>TECH</span>AI</div>
        <p style="color:var(--clr-text-dim);font-size:0.85rem;font-weight:300;line-height:1.8;margin-top:1rem;">
          Enhancing the efficiency of software development through transparency, integrity, and partnership.
        </p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2rem;">
        <div>
          <small style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:3px;text-transform:uppercase;color:var(--clr-text-dim);">Services</small>
          <ul class="footer-links" style="flex-direction:column;justify-content:flex-start;gap:0.8rem;margin-top:1rem;">
            <li><a href="/ai">AI &amp; ML</a></li>
            <li><a href="/consulting">Consulting</a></li>
            <li><a href="/ui-ux">UI/UX Design</a></li>
            <li><a href="/cloud">Cloud</a></li>
            <li><a href="/qa">QA &amp; Testing</a></li>
          </ul>
        </div>
        <div>
          <small style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:3px;text-transform:uppercase;color:var(--clr-text-dim);">Company</small>
          <ul class="footer-links" style="flex-direction:column;justify-content:flex-start;gap:0.8rem;margin-top:1rem;">
            <li><a href="/about">About</a></li>
            <li><a href="/portfolio">Portfolio</a></li>
            <li><a href="/blog">Blog</a></li>
            <li><a href="/#values">Values</a></li>
          </ul>
        </div>
        <div>
          <small style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:3px;text-transform:uppercase;color:var(--clr-text-dim);">Contact</small>
          <ul class="footer-links" style="flex-direction:column;justify-content:flex-start;gap:0.8rem;margin-top:1rem;">
            <li><a href="tel:+13104218638">(310) 421-8638</a></li>
            <li><a href="/#contact">Get in Touch</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div style="border-top:1px solid var(--clr-border);margin-top:3rem;padding-top:2rem;text-align:center;">
      <p>&copy; ${new Date().getFullYear()} AIM Tech AI LLC. All rights reserved. Beverly Hills, California.</p>
    </div>
  </footer>

  <a href="/blog" class="back-link">&larr; Blog</a>

  <script type="module">
    import { initUI } from '/js/ui.js';
    import { initBlogVideoBg } from '/js/blog-video-bg.js';
    initBlogVideoBg();
    initUI();
  </script>
</body>
</html>`;
}

module.exports = { blogPostTemplate, esc };
