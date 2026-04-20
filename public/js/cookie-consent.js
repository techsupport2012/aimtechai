// ============================================================
// Cookie consent banner — minimal, theme-aware, GDPR/CCPA friendly
// Stored in localStorage as 'cookie-consent' = 'accepted' | 'declined'
// ============================================================

(function () {
  if (typeof window === 'undefined') return;
  const KEY = 'cookie-consent';
  if (localStorage.getItem(KEY)) return;

  function inject() {
    if (document.getElementById('cookie-consent-banner')) return;

    const bar = document.createElement('div');
    bar.id = 'cookie-consent-banner';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.style.cssText = [
      'position:fixed',
      'left:1rem', 'right:1rem', 'bottom:1rem',
      'max-width:560px', 'margin:0 auto',
      'z-index:9999',
      'padding:1.1rem 1.3rem',
      'border-radius:14px',
      'background:linear-gradient(135deg,rgba(0,0,0,0.85),rgba(0,0,0,0.65))',
      'backdrop-filter:blur(18px)',
      '-webkit-backdrop-filter:blur(18px)',
      'border:1px solid rgba(15,193,183,0.35)',
      'box-shadow:0 10px 40px rgba(0,0,0,0.5)',
      'color:#fff',
      'font-family:var(--font-display,Outfit,system-ui,sans-serif)',
      'font-size:0.9rem',
      'line-height:1.55',
      'display:flex',
      'flex-direction:column',
      'gap:0.7rem'
    ].join(';');

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      bar.style.background = 'linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,255,255,0.78))';
      bar.style.color = '#1A1A1A';
    }

    bar.innerHTML = ''
      + '<div><strong>We use cookies.</strong> '
      + 'By using AIM Tech AI you agree to our '
      + '<a href="/cookies" style="color:#0FC1B7;text-decoration:underline;">Cookie Policy</a>, '
      + '<a href="/privacy" style="color:#0FC1B7;text-decoration:underline;">Privacy Policy</a>, and '
      + '<a href="/terms" style="color:#0FC1B7;text-decoration:underline;">Terms</a>.</div>'
      + '<div style="display:flex;gap:0.6rem;flex-wrap:wrap;">'
      +   '<button id="cookie-accept" style="flex:1;min-width:120px;padding:0.6rem 1rem;background:#0FC1B7;color:#0a0608;border:none;border-radius:8px;font-weight:700;cursor:pointer;">Accept</button>'
      +   '<button id="cookie-decline" style="flex:1;min-width:120px;padding:0.6rem 1rem;background:transparent;color:inherit;border:1px solid rgba(255,255,255,0.3);border-radius:8px;font-weight:600;cursor:pointer;">Decline</button>'
      + '</div>';

    document.body.appendChild(bar);

    function dismiss(value) {
      try { localStorage.setItem(KEY, value); } catch {}
      bar.remove();
    }
    document.getElementById('cookie-accept').addEventListener('click', () => dismiss('accepted'));
    document.getElementById('cookie-decline').addEventListener('click', () => dismiss('declined'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();
