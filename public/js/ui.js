// ============================================================
// Shared UI Behaviors — No Three.js dependency
// ============================================================

export function initUI() {
  initCursor();
  initScrollProgress();
  initShowAll();
  initNavScroll();
  initScrambleText();
  initScrambleReveal();
  initProgressNav();
  initMarquee();
  initCounters();
  initCardGlow();
  initMobileMenu();
  initThemeToggle();
  initLangSelector();
  initCeoVideoSwitch();
  initBookingPageIfPresent();
  initProgressiveBlur();
  initCardTilt3D();
}

// Mouse-tilt with preserve-3d — rotates any glass-y card toward the cursor.
// Excludes testimonial / booking stack (they have their own drag interactions).
function initCardTilt3D() {
  const SELECTOR = [
    '.glass-card',
    '.stat-item',
    '.value-item',
    '.blog-card',
    '.feature-card',
    '.service-card',
    '.team-card',
    '.contact-card',
    '.cta-block',
    '.quick-answer'
  ].join(', ');
  const EXCLUDE = new Set(['testimonial-card', 'tstack-card']);

  document.querySelectorAll(SELECTOR).forEach(card => {
    // Skip excluded or already-bound
    if (card.dataset.tilt3dBound) return;
    if ([...card.classList].some(c => EXCLUDE.has(c))) return;
    card.dataset.tilt3dBound = '1';
    card.style.transformStyle = 'preserve-3d';

    function onMove(e) {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;   // 0..1
      const py = (e.clientY - r.top)  / r.height;  // 0..1
      const rx = (0.5 - py) * 22;  // -11..11 deg
      const ry = (px - 0.5) * 26;  // -13..13 deg
      card.style.transform = `perspective(700px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    }
    function onLeave() { card.style.transform = ''; }
    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
  });
}

// Apply `has-progressive-blur` class to <body> on long-read pages (blog articles + legal pages)
// so CSS pseudo-elements render the top/bottom blur fades.
let _footerObserver = null;
function initProgressiveBlur() {
  const path = location.pathname;
  const isBlogArticle = path.startsWith('/blog/') && path !== '/blog/';
  const legalPaths = ['/privacy','/terms','/cookies','/disclaimer','/aup','/refund','/ai-policy','/security'];
  const isLegal = legalPaths.some(p => path === p || path.startsWith(p + '/'));
  const enabled = isBlogArticle || isLegal;
  document.body.classList.toggle('has-progressive-blur', enabled);
  document.body.classList.remove('near-footer');

  // Tear down previous observer (from prior SPA nav) to avoid stacking
  if (_footerObserver) { try { _footerObserver.disconnect(); } catch {} _footerObserver = null; }
  if (!enabled) return;

  const footer = document.getElementById('footer');
  if (!footer) return;

  _footerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      document.body.classList.toggle('near-footer', entry.isIntersecting);
    });
  }, { rootMargin: '0px 0px 0px 0px', threshold: 0.01 });
  _footerObserver.observe(footer);
}

// Called on every SPA navigation — if we landed on /book, the inline script set
// window.initBookingPage. Clear the dataset guard so we re-bind against the fresh DOM,
// then invoke it. No-op on other pages.
function initBookingPageIfPresent() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  grid.dataset.bookingInitialized = '';
  if (typeof window.initBookingPage === 'function') {
    window.initBookingPage();
  }
}

// --- CEO Video Switch (about page — swaps dark/light background videos on theme change) ---
// Global init so it fires both on fresh page load and after SPA navigation.
let _ceoThemeObserver = null;
function initCeoVideoSwitch() {
  const darkVid = document.getElementById('ceo-video-dark');
  const lightVid = document.getElementById('ceo-video-light');
  if (!darkVid || !lightVid) return;

  function apply() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    darkVid.style.display  = isLight ? 'none'  : 'block';
    lightVid.style.display = isLight ? 'block' : 'none';
    if (isLight) {
      lightVid.play().catch(() => {});
      darkVid.pause();
    } else {
      darkVid.play().catch(() => {});
      lightVid.pause();
    }
  }
  apply();

  // Disconnect any previous observer from a prior page so we don't stack them
  if (_ceoThemeObserver) { try { _ceoThemeObserver.disconnect(); } catch {} }
  _ceoThemeObserver = new MutationObserver(apply);
  _ceoThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

// --- Theme Toggle (Light/Dark) ---
function initThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  if (!toggle || !icon) return;

  // Restore saved theme
  const saved = localStorage.getItem('theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    icon.innerHTML = saved === 'light' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    icon.style.transform = 'rotate(0deg)';
  }

  // Remove old listeners by cloning
  const fresh = toggle.cloneNode(true);
  toggle.parentNode.replaceChild(fresh, toggle);
  const freshIcon = fresh.querySelector('.theme-toggle-icon');

  fresh.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);

    if (freshIcon) {
      freshIcon.innerHTML = next === 'light' ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      freshIcon.style.transform = 'rotate(0deg)';
    }
  });
}

// --- Custom Cursor ---
function initCursor() {
  // Skip on touch / mobile / tablet — the custom cursor only makes sense
  // when there's a real mouse pointer hovering over things.
  const isTouch = window.matchMedia('(pointer: coarse)').matches ||
                  window.matchMedia('(max-width: 900px)').matches ||
                  /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
  if (isTouch) {
    document.getElementById('cursor-dot')?.remove();
    document.getElementById('cursor-ring')?.remove();
    return;
  }

  let dot = document.getElementById('cursor-dot');
  let ring = document.getElementById('cursor-ring');
  if (!dot) {
    dot = document.createElement('div');
    dot.id = 'cursor-dot';
    dot.style.cssText = 'position:fixed;width:6px;height:6px;background:#6b82ff;border-radius:50%;pointer-events:none;z-index:99999;mix-blend-mode:difference;transition:transform 0.1s;';
    document.body.appendChild(dot);
  }
  if (!ring) {
    ring = document.createElement('div');
    ring.id = 'cursor-ring';
    ring.style.cssText = 'position:fixed;width:36px;height:36px;border:1px solid rgba(107,130,255,0.5);border-radius:50%;pointer-events:none;z-index:99998;mix-blend-mode:difference;transition:transform 0.15s ease-out,width 0.3s,height 0.3s;';
    document.body.appendChild(ring);
  }
  document.addEventListener('mousemove', (e) => {
    dot.style.left = e.clientX - 3 + 'px';
    dot.style.top = e.clientY - 3 + 'px';
    ring.style.left = e.clientX - 18 + 'px';
    ring.style.top = e.clientY - 18 + 'px';
  });
  document.querySelectorAll('a, button, .glass-card, .service-card, .industry-item, .value-item').forEach(el => {
    el.addEventListener('mouseenter', () => {
      ring.style.width = '50px';
      ring.style.height = '50px';
      ring.style.borderColor = 'rgba(255,90,158,0.5)';
      ring.style.transform = 'translate(-7px, -7px)';
    });
    el.addEventListener('mouseleave', () => {
      ring.style.width = '36px';
      ring.style.height = '36px';
      ring.style.borderColor = 'rgba(107,130,255,0.5)';
      ring.style.transform = 'translate(0,0)';
    });
  });
}

// --- Scroll Progress Bar ---
function initScrollProgress() {
  let bar = document.getElementById('scroll-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'scroll-progress';
    bar.className = 'scroll-progress';
    document.body.prepend(bar);
  }
  const snapContainer = document.querySelector('.content');
  const scrollTarget = snapContainer || window;
  scrollTarget.addEventListener('scroll', () => {
    const el = snapContainer || document.documentElement;
    const scrollTop = snapContainer ? snapContainer.scrollTop : window.scrollY;
    const max = el.scrollHeight - el.clientHeight;
    bar.style.width = (max > 0 ? scrollTop / max * 100 : 0) + '%';
  }, { passive: true });
}

// --- Scroll Reveal ---
// initScrollReveal removed — was causing jiggle

// --- Navbar Scroll ---
function initNavScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  const snapContainer = document.querySelector('.content');
  const scrollTarget = snapContainer || window;
  scrollTarget.addEventListener('scroll', () => {
    const scrollTop = snapContainer ? snapContainer.scrollTop : window.scrollY;
    navbar.classList.toggle('scrolled', scrollTop > 50);
  }, { passive: true });
}

// --- Text Scramble on Hover ---
function initScrambleText() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%';
  document.querySelectorAll('[data-scramble]').forEach(el => {
    const original = el.textContent;
    let running = false;
    el.addEventListener('mouseenter', () => {
      if (running) return;
      running = true;
      let iteration = 0;
      const interval = setInterval(() => {
        el.textContent = original.split('').map((char, i) => {
          if (char === ' ') return ' ';
          if (i < iteration) return original[i];
          return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
        iteration += 1 / 3;
        if (iteration >= original.length) {
          clearInterval(interval);
          el.textContent = original;
          running = false;
        }
      }, 30);
    });
  });
}

// --- Scramble Reveal on Scroll ---
function initScrambleReveal() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  document.querySelectorAll('[data-scramble-reveal]').forEach(el => {
    const original = el.textContent;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          let iteration = 0;
          const interval = setInterval(() => {
            el.textContent = original.split('').map((char, i) => {
              if (char === ' ') return ' ';
              if (i < iteration) return original[i];
              return chars[Math.floor(Math.random() * chars.length)];
            }).join('');
            iteration += 0.5;
            if (iteration >= original.length) {
              clearInterval(interval);
              el.textContent = original;
            }
          }, 25);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.3 });
    observer.observe(el);
  });
}

// --- Progress Navigation ---
function initProgressNav() {
  const nav = document.querySelector('.progress-nav');
  if (!nav) return;
  const links = nav.querySelectorAll('.progress-link');
  const sections = document.querySelectorAll('.page-section');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
        const id = entry.target.id;
        links.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { threshold: 0.5, root: document.querySelector('.content') });

  sections.forEach(section => observer.observe(section));

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// --- Blur-In Animation ---
// Force all content visible — no animations that cause jiggle
function initShowAll() {
  document.querySelectorAll('.reveal, .blur-in').forEach(el => {
    el.classList.add('visible');
    el.classList.remove('blur-in');
    el.style.opacity = '1';
    el.style.transform = 'none';
    el.style.filter = 'none';
  });
  // Also force hero elements visible
  ['.hero-sub-header', '.hero h1', '.hero-sub', '.hero-buttons'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.filter = 'none';
    }
  });
}

// --- Marquee Auto-Duplicate ---
function initMarquee() {
  document.querySelectorAll('.marquee-track').forEach(track => {
    if (track.dataset.duplicated) return;
    const items = [...track.children];
    items.forEach(item => track.appendChild(item.cloneNode(true)));
    track.dataset.duplicated = '1';
  });
}

// --- Counter Animation ---
function initCounters() {
  const states = ['AL','AK','AZ','AR','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','CA'];

  // Number counters
  const counters = document.querySelectorAll('.stat-number[data-target]');
  const numObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target);
        const suffix = el.dataset.suffix || '';
        let current = 0;
        const step = target / 40;
        const timer = setInterval(() => {
          current += step;
          if (current >= target) {
            current = target;
            clearInterval(timer);
          }
          el.textContent = (target === 5 ? current.toFixed(1) : Math.floor(current)) + suffix;
        }, 40);
        numObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => numObserver.observe(c));

  // State cycler — rapidly cycles through all US states then lands on CA
  const stateEls = document.querySelectorAll('.stat-number[data-states]');
  const stateObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const finalState = el.textContent.trim();
        let i = 0;
        const timer = setInterval(() => {
          el.textContent = states[i];
          i++;
          if (i >= states.length) {
            clearInterval(timer);
            el.textContent = finalState;
          }
        }, 60);
        stateObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  stateEls.forEach(el => stateObserver.observe(el));
}

// --- Glass Card Mouse Glow ---
function initCardGlow() {
  document.querySelectorAll('.glass-card, .service-card, .value-item, .testimonial-card, .contact-card, .stat-item, .feature-card, .team-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100) + '%');
    });
  });
}

// --- Mobile Menu ---
function initMobileMenu() {
  const toggle = document.getElementById('mobile-toggle');
  const navLinks = document.getElementById('nav-links');
  if (!toggle || !navLinks) return;
  toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// --- Language Selector ---
function initLangSelector() {
  const toggle = document.getElementById('lang-toggle');
  const dropdown = document.getElementById('lang-dropdown');
  const flagEl = document.getElementById('lang-flag');
  if (!toggle || !dropdown) return;

  // Country code map for flag images
  const countryMap = {
    'en-US': 'US', 'en-GB': 'GB', 'zh-CN': 'CN', 'zh-TW': 'HK',
    'es': 'ES', 'fr': 'FR', 'de': 'DE', 'ja': 'JP',
    'ko': 'KR', 'ar': 'SA', 'hi': 'IN', 'pt': 'BR',
    'ru': 'RU', 'tl': 'PH',
  };

  // Restore saved language flag
  const savedLang = localStorage.getItem('site-lang');
  if (savedLang && flagEl && countryMap[savedLang]) {
    flagEl.setAttribute('data-country', countryMap[savedLang]);
  }

  // Toggle dropdown
  const freshToggle = toggle.cloneNode(true);
  toggle.parentNode.replaceChild(freshToggle, toggle);
  const freshFlag = freshToggle.querySelector('.lang-flag');

  freshToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.lang-selector')) {
      dropdown.classList.remove('open');
    }
  });

  // Mark active option
  const options = dropdown.querySelectorAll('.lang-option');
  if (savedLang) {
    options.forEach(opt => {
      const lang = opt.dataset.lang;
      const variant = opt.dataset.variant;
      const key = variant ? lang + '-' + variant : lang;
      opt.classList.toggle('active', key === savedLang);
    });
  }

  // Handle language selection
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      const lang = opt.dataset.lang;
      const variant = opt.dataset.variant;
      const key = variant ? lang + '-' + variant : lang;
      const googleLang = lang; // Google Translate language code

      // Update flag image
      const country = opt.dataset.country || countryMap[key];
      if (freshFlag && country) {
        freshFlag.setAttribute('data-country', country);
      }

      // Save selection
      localStorage.setItem('site-lang', key);

      // Mark active
      options.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');

      // Close dropdown
      dropdown.classList.remove('open');

      // Trigger Google Translate
      triggerGoogleTranslate(googleLang);
    });
  });

  // Auto-apply saved language on load
  if (savedLang) {
    const langCode = savedLang.split('-')[0];
    // Wait for Google Translate to load
    const waitForGT = setInterval(() => {
      const select = document.querySelector('.goog-te-combo');
      if (select) {
        clearInterval(waitForGT);
        // Small delay to ensure GT is fully ready
        setTimeout(() => triggerGoogleTranslate(langCode), 500);
      }
    }, 200);
    // Stop waiting after 10s
    setTimeout(() => clearInterval(waitForGT), 10000);
  }
}

function triggerGoogleTranslate(langCode) {
  // If English, reset to original
  if (langCode === 'en') {
    // Remove Google Translate cookie to restore original
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
    // Reload to clear translations
    if (document.querySelector('.goog-te-combo')) {
      const select = document.querySelector('.goog-te-combo');
      select.value = 'en';
      select.dispatchEvent(new Event('change'));
    }
    return;
  }

  // Set Google Translate via the hidden select element
  const waitForSelect = setInterval(() => {
    const select = document.querySelector('.goog-te-combo');
    if (select) {
      clearInterval(waitForSelect);
      select.value = langCode;
      select.dispatchEvent(new Event('change'));
    }
  }, 100);
  setTimeout(() => clearInterval(waitForSelect), 5000);
}

