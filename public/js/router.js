// ============================================================
// Client-side router — swaps page content without full reload
// so background (office-bg) stays persistent.
// ============================================================

function scrollToHash(hash) {
  const el = document.querySelector(hash);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Diff <link rel="stylesheet"> tags between the live head and the fetched doc's head.
// Remove stylesheets the new page doesn't use; add any the new page needs.
// Compare via getAttribute('href') (the literal string authored in HTML) for
// deterministic matching across live DOM and DOMParser output.
function syncStylesheets(doc) {
  const live = new Map();
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
    const key = l.getAttribute('href');
    if (key) live.set(key, l);
  });
  const wanted = new Set();
  doc.head.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
    const key = l.getAttribute('href');
    if (!key) return;
    wanted.add(key);
    if (!live.has(key)) {
      // Add missing stylesheet to live head
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = key;
      document.head.appendChild(link);
    }
  });
  // Remove live stylesheets the new page doesn't include
  for (const [key, node] of live) {
    if (!wanted.has(key)) node.remove();
  }
}

export function initRouter() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Skip external, tel, mailto
    if (href.startsWith('http') || href.startsWith('tel:') || href.startsWith('mailto:')) return;

    // Skip blog, landing, and book — they have page-specific inline CSS/JS
    // that the SPA content-swap cannot inject (inline <style> in <head>, heavy
    // inline <script> outside .content).  Full page load is required.
    if (href.startsWith('/blog') || href.startsWith('/landing') || href === '/book' || href === '/book.html') return;

    // Pure anchor (#services) — scroll on current page
    if (href.startsWith('#')) {
      e.preventDefault();
      scrollToHash(href);
      return;
    }

    // Homepage anchor links (/#services)
    if (href.startsWith('/#')) {
      e.preventDefault();
      const anchor = href.substring(1);
      if (location.pathname === '/') {
        scrollToHash(anchor);
      } else {
        navigateTo('/', true, anchor);
      }
      return;
    }

    // Internal page navigation — swap content only
    e.preventDefault();
    navigateTo(href);
  });

  window.addEventListener('popstate', () => {
    navigateTo(location.pathname, false);
  });
}

async function navigateTo(url, pushState = true, scrollToAnchor = null) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      window.location.href = url;
      return;
    }
    const html = await resp.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    document.title = doc.title;

    // Sync <link rel="stylesheet"> tags in <head> so page-specific stylesheets
    // (e.g. blog.css) don't persist when navigating to a page that doesn't use them.
    syncStylesheets(doc);

    const newContent = doc.querySelector('.content') || doc.querySelector('body');
    const oldContent = document.querySelector('.content');

    if (oldContent && newContent) {
      // Fade out
      oldContent.style.transition = 'opacity 0.3s';
      oldContent.style.opacity = '0';
      await new Promise(r => setTimeout(r, 300));

      // Replace content
      oldContent.innerHTML = newContent.innerHTML;
      oldContent.className = newContent.className;

      // innerHTML assignment does NOT execute <script> tags. Manually re-execute
      // inline scripts from the fetched page so page-specific logic runs.
      oldContent.querySelectorAll('script').forEach(oldScript => {
        const s = document.createElement('script');
        // Copy attributes (type, src, async, defer, etc.)
        for (const attr of oldScript.attributes) s.setAttribute(attr.name, attr.value);
        s.textContent = oldScript.textContent;
        oldScript.parentNode.replaceChild(s, oldScript);
      });

      // Also re-execute body-level inline scripts that sit OUTSIDE .content (e.g. page-specific
      // calendar / widget init blocks). We skip module and external-src scripts — those are
      // handled by the import system (initUI, initRouter, etc.).
      doc.body.querySelectorAll('script').forEach(fetched => {
        if (fetched.src) return;
        if (fetched.type === 'module') return;
        // Skip scripts that are inside .content — already re-executed above
        if (doc.querySelector('.content')?.contains(fetched)) return;
        const s = document.createElement('script');
        for (const attr of fetched.attributes) s.setAttribute(attr.name, attr.value);
        s.textContent = fetched.textContent;
        document.body.appendChild(s);
        // Remove after exec so we don't accumulate script nodes across navigations
        s.parentNode.removeChild(s);
      });

      // Keep nav persistent — don't swap it
      // Only update active state if needed

      // Fade in
      oldContent.style.opacity = '1';

      // Scroll to top
      window.scrollTo(0, 0);

      // Swap video background if the destination page uses a different one.
      // Blog pages use blog-video-bg (server-bg), other pages use parallax-video-bg.
      const destUsesBlogBg = doc.body.innerHTML.includes('initBlogVideoBg');
      const destUsesParallaxBg = doc.body.innerHTML.includes('initParallaxVideoBg');
      const currentBlogBg = document.getElementById('blog-video-bg');
      const currentParallaxBg = document.getElementById('parallax-video-bg');

      if (destUsesBlogBg && !currentBlogBg) {
        if (currentParallaxBg) currentParallaxBg.remove();
        const { initBlogVideoBg } = await import('/js/blog-video-bg.js');
        initBlogVideoBg();
      } else if (destUsesParallaxBg && !currentParallaxBg) {
        if (currentBlogBg) currentBlogBg.remove();
        const { initParallaxVideoBg } = await import('/js/parallax-video-bg.js');
        initParallaxVideoBg();
      } else if (!destUsesBlogBg && !destUsesParallaxBg) {
        // Destination has no bg video — remove whichever is active
        if (currentBlogBg) currentBlogBg.remove();
        if (currentParallaxBg) currentParallaxBg.remove();
      }

      // Re-init UI
      const { initUI } = await import('/js/ui.js');
      initUI();

      // Re-init router event listeners on new content
      initRouter();

      // Scroll to anchor if provided
      if (scrollToAnchor) {
        await new Promise(r => setTimeout(r, 200));
        scrollToHash(scrollToAnchor);
      }
    }

    if (pushState) {
      history.pushState(null, '', url);
    }

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: location.pathname, referrer: document.referrer || '' })
    }).catch(() => {});
  } catch (err) {
    // Fallback to normal navigation
    window.location.href = url;
  }
}
