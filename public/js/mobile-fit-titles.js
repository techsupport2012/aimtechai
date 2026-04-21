/* ============================================================
   AIM Tech AI — Mobile Auto-Fit Titles
   Shrinks any .section-title (and h1, .page-hero h1) to fit
   on a single line within its parent. Runs only on ≤768px.
   ============================================================ */

(function () {
  if (window.__aimFitTitlesReady) return;
  window.__aimFitTitlesReady = true;

  const MQ = window.matchMedia('(max-width: 768px)');
  const SELECTORS = '.section-title, .page-hero h1, .hero h1';
  const MIN_PX = 16;
  const MAX_PX = 56;
  const STEP = 1; // px per shrink iteration

  function fit(el) {
    // Reset to a clean state so we measure fresh
    el.style.whiteSpace = 'nowrap';
    el.style.overflow = 'visible';
    el.style.removeProperty('font-size');
    // Read computed starting font size
    const cs = getComputedStyle(el);
    let size = Math.min(MAX_PX, Math.max(MIN_PX, parseFloat(cs.fontSize) || 28));
    el.style.setProperty('font-size', size + 'px', 'important');

    // Shrink while we overflow
    let safety = 80;
    while (el.scrollWidth > el.clientWidth + 1 && size > MIN_PX && safety-- > 0) {
      size -= STEP;
      el.style.setProperty('font-size', size + 'px', 'important');
    }
  }

  function fitAll() {
    if (!MQ.matches) {
      // Restore — clear inline font-size on desktop
      document.querySelectorAll(SELECTORS).forEach((el) => {
        el.style.removeProperty('font-size');
        el.style.removeProperty('white-space');
        el.style.removeProperty('overflow');
      });
      return;
    }
    document.querySelectorAll(SELECTORS).forEach(fit);
  }

  // Re-fit when the page is ready, on resize, on font-load, on theme change.
  function init() {
    fitAll();
    // Fonts may load late and shift metrics
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitAll).catch(() => {});
    }
    let timer;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(fitAll, 100);
    });
    // Theme toggle can change letter spacing slightly via font-feature changes
    const themeObserver = new MutationObserver(fitAll);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    // SPA navigation: re-run when content changes
    const contentObserver = new MutationObserver(() => {
      // Throttle — recalc once per frame after content mutations
      requestAnimationFrame(fitAll);
    });
    const content = document.querySelector('.content') || document.body;
    contentObserver.observe(content, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
