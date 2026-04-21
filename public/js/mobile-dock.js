/* ============================================================
   AIM Tech AI — Mobile Dock + Bottom Sheet
   Activates only on touch / mobile. Renders:
   - Bottom dock nav (Home / Services / Portfolio / Chat / Book)
   - Bottom sheet that hosts the AI chat widget
   ============================================================ */

(function () {
  if (window.__aimMobileDockReady) return;
  window.__aimMobileDockReady = true;

  // Only mount on small viewports / touch
  function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches ||
           /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
  }

  /* ---------- icons ---------- */
  const ic = {
    home:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V10"/></svg>',
    services:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    portfolio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    chat:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    book:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    close:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  };

  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ---------- mount ---------- */
  function mount() {
    if (!document.body) return setTimeout(mount, 50);
    if (!isMobile()) return;
    if (document.getElementById('mobile-dock')) return;

    /* ---- Backdrop ---- */
    const backdrop = el('div', { id: 'mobile-sheet-backdrop' });
    backdrop.addEventListener('click', closeSheet);
    document.body.appendChild(backdrop);

    /* ---- Sheet ---- */
    const sheet = el('div', { id: 'mobile-sheet', 'aria-hidden': 'true', role: 'dialog' });
    const handle = el('div', { class: 'sheet-handle', 'aria-label': 'Drag to close' });
    const header = el('div', { class: 'sheet-header' });
    const title = el('div', { class: 'sheet-title', id: 'mobile-sheet-title' }, 'Ask Anything');
    const closeBtn = el('button', { class: 'sheet-close', 'aria-label': 'Close', type: 'button' }, ic.close);
    closeBtn.addEventListener('click', closeSheet);
    header.appendChild(title);
    header.appendChild(closeBtn);
    const content = el('div', { class: 'sheet-content', id: 'mobile-sheet-content' });
    sheet.appendChild(handle);
    sheet.appendChild(header);
    sheet.appendChild(content);
    document.body.appendChild(sheet);

    /* Drag-to-dismiss on the handle */
    let startY = 0, currentY = 0, dragging = false;
    function dragStart(e) {
      dragging = true;
      startY = (e.touches ? e.touches[0].clientY : e.clientY);
      sheet.style.transition = 'none';
    }
    function dragMove(e) {
      if (!dragging) return;
      currentY = (e.touches ? e.touches[0].clientY : e.clientY);
      const dy = Math.max(0, currentY - startY);
      sheet.style.transform = `translateY(${dy}px)`;
    }
    function dragEnd() {
      if (!dragging) return;
      dragging = false;
      sheet.style.transition = '';
      const dy = Math.max(0, currentY - startY);
      if (dy > 100) closeSheet();
      else sheet.style.transform = '';
    }
    handle.addEventListener('touchstart', dragStart, { passive: true });
    handle.addEventListener('touchmove', dragMove, { passive: true });
    handle.addEventListener('touchend', dragEnd);

    /* ---- Dock ---- */
    const dock = el('div', { id: 'mobile-dock', role: 'navigation', 'aria-label': 'Main' });
    const items = [
      { key: 'home',      label: 'Home',      href: '/',           icon: ic.home },
      { key: 'services',  label: 'Services',  href: '/#services',  icon: ic.services },
      { key: 'chat',      label: 'Chat',      action: 'chat',      icon: ic.chat,   cta: true },
      { key: 'portfolio', label: 'Work',      href: '/portfolio',  icon: ic.portfolio },
      { key: 'book',      label: 'Book',      href: '/book',       icon: ic.book },
    ];
    items.forEach(it => {
      const tag = it.action ? 'button' : 'a';
      const node = el(tag, {
        class: 'dock-item' + (it.cta ? ' is-cta' : ''),
        ...(it.action ? { type: 'button', 'aria-label': it.label } : { href: it.href, 'aria-label': it.label }),
        'data-dock': it.key,
      }, it.icon + '<span>' + it.label + '</span>');
      if (it.action === 'chat') node.addEventListener('click', openChatSheet);
      dock.appendChild(node);
    });
    document.body.appendChild(dock);

    // Mark active dock item by current path
    const path = location.pathname.replace(/\/$/, '') || '/';
    const activeKey = (path === '/' ? 'home'
                    : /^\/portfolio/.test(path) ? 'portfolio'
                    : /^\/book/.test(path) ? 'book'
                    : null);
    if (activeKey) {
      const a = dock.querySelector(`[data-dock="${activeKey}"]`);
      if (a) a.classList.add('active');
    }

    // Hide dock when bottom-sheet is open (the chat sheet covers it visually)
    // and reveal again on close — handled in openSheet/closeSheet.
  }

  /* ---------- sheet open/close ---------- */
  let activeSheetType = null;

  function openSheet(type) {
    activeSheetType = type;
    const sheet = document.getElementById('mobile-sheet');
    const backdrop = document.getElementById('mobile-sheet-backdrop');
    if (!sheet || !backdrop) return;
    sheet.style.transform = '';
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('open');
    document.body.classList.add('sheet-open');
  }

  function closeSheet() {
    const sheet = document.getElementById('mobile-sheet');
    const backdrop = document.getElementById('mobile-sheet-backdrop');
    if (!sheet || !backdrop) return;
    // Blur any focused input inside the sheet so iOS keyboard collapses + viewport returns
    try {
      const focused = sheet.querySelector('input:focus, textarea:focus');
      if (focused) focused.blur();
    } catch {}
    // Wipe any residual fullscreen state from the chat widget
    const chat = sheet.querySelector('#hero-ai-chat');
    if (chat) chat.classList.remove('is-fullscreen');
    document.body.classList.remove('chat-fs-open');
    sheet.classList.remove('open', 'full');
    sheet.style.transform = '';
    sheet.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('open');
    document.body.classList.remove('sheet-open');
    activeSheetType = null;
  }

  function openChatSheet() {
    const title = document.getElementById('mobile-sheet-title');
    const content = document.getElementById('mobile-sheet-content');
    if (!title || !content) return;
    title.textContent = 'Ask Anything';

    let chat = document.getElementById('hero-ai-chat');
    let needsInit = false;
    if (chat && chat.parentElement !== content) {
      chat._origParent = chat.parentElement;
      chat._origNext = chat.nextSibling;
      content.appendChild(chat);
    } else if (!chat) {
      chat = el('div', { id: 'hero-ai-chat' });
      content.appendChild(chat);
      needsInit = true;
    }
    openSheet('chat');

    // Auto-focus the input so the mobile keyboard opens immediately.
    // Wait for sheet slide-in (~360ms) and (if needed) widget init.
    function focusInput() {
      const input = chat.querySelector('.chat-input');
      if (input) {
        try {
          input.focus({ preventScroll: true });
          // iOS sometimes ignores programmatic focus — trigger a tap-equivalent
          if (typeof input.click === 'function') {
            // No click — just focus is enough; click would re-trigger handlers
          }
        } catch {}
      }
    }
    if (needsInit) {
      import('/js/hero-ai-chat.js').then(m => {
        try { (m.default || m.initHeroAiChat)(); } catch (e) { console.warn('[chat]', e); }
        setTimeout(focusInput, 420);
      });
    } else {
      setTimeout(focusInput, 420);
    }
  }

  // ESC closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('sheet-open')) closeSheet();
  });

  // SPA navigation (popstate or programmatic) — close any open sheet so it
  // doesn't carry visual state into the next page
  window.addEventListener('popstate', closeSheet);
  // Also close when a dock <a> link is tapped (in-page nav)
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href]');
    if (link && document.body.classList.contains('sheet-open')) {
      // Only close for non-anchor navigation
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) closeSheet();
    }
  }, true);

  /* ---------- public API ---------- */
  window.aimMobile = {
    openChat: openChatSheet,
    closeSheet,
    isMobile,
  };

  /* ---------- mobile keyboard awareness via visualViewport ----------
     When the on-screen keyboard appears, window.visualViewport.height
     shrinks. We expose the offset as `--kb-bottom` on the document so the
     fixed chat input row can lift above the keyboard.
  */
  function handleViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb-bottom', offset > 24 ? offset + 'px' : 'env(safe-area-inset-bottom, 0)');
    document.body.classList.toggle('kb-open', offset > 24);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewport);
    window.visualViewport.addEventListener('scroll', handleViewport);
    handleViewport();
  }

  /* ---------- mount ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }

  // Re-evaluate on resize (orientation change)
  let lastIsMobile = isMobile();
  window.addEventListener('resize', () => {
    const now = isMobile();
    if (now !== lastIsMobile) {
      lastIsMobile = now;
      // If we crossed the threshold, just reload UI elements
      const dock = document.getElementById('mobile-dock');
      if (now && !dock) mount();
    }
  });
})();
