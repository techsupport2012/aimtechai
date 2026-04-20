// ============================================================
// Hero Background — Persistent Spline iframe
// Optimized for mobile + PC performance.
// ============================================================

export function initHeroBackground() {
  if (document.getElementById('spline-bg')) return;

  const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);

  // On mobile, skip the iframe entirely — just show aurora bg
  if (isMobile) return;

  if (!window.__splineInitialized) {
    sessionStorage.removeItem('spline-scene-url');
    window.__splineInitialized = true;
  }

  const container = document.createElement('div');
  container.id = 'spline-bg';

  const iframe = document.createElement('iframe');
  iframe.id = 'spline-iframe';
  iframe.src = '/spline-frame.html';
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:transparent;';
  iframe.setAttribute('allowtransparency', 'true');
  iframe.setAttribute('loading', 'lazy');

  container.appendChild(iframe);
  document.body.prepend(container);

  // Listen for scene type from iframe
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'spline-scene') {
      if (e.data.isMobile) {
        container.style.display = 'none';
        return;
      }
      if (e.data.isModelScene) {
        container.style.right = '-5vw';
        container.style.width = '65vw';
        container.style.height = '115vh';
        container.style.top = '-5vh';
      } else {
        container.style.right = '-10vw';
      }
    }
  });

  // Throttled mouse forwarding — 30fps max
  let lastSend = 0;
  document.addEventListener('mousemove', (e) => {
    const now = performance.now();
    if (now - lastSend < 33) return; // 30fps cap
    lastSend = now;
    const rect = container.getBoundingClientRect();
    iframe.contentWindow?.postMessage({
      type: 'mousemove',
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }, '*');
  });
}
