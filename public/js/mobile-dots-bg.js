/* ============================================================
   Mobile Dots Background — connected-dots constellation
   - Replaces the video background on mobile / tablet (≤900px)
   - No touch / scroll interaction (purely ambient)
   - Reacts to [data-theme] toggle (dark = teal on dark, light = dark teal on white)
   ============================================================ */

export function initMobileDotsBg() {
  if (document.getElementById('mobile-dots-bg')) return;

  const container = document.createElement('div');
  container.id = 'mobile-dots-bg';
  container.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;z-index:0;pointer-events:none;overflow:hidden;';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  container.appendChild(canvas);
  document.body.prepend(container);

  const ctx = canvas.getContext('2d', { alpha: true });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Tunables
  const DOT_DENSITY = 0.00006;   // dots per px² → ~30 dots on iPhone
  const MAX_DOTS = 70;
  const MIN_DOTS = 18;
  const LINK_DIST = 110;         // px — within this we draw a line
  const SPEED = 0.18;            // px / frame
  const DOT_RADIUS = 1.6;

  let dots = [];
  let w = 0, h = 0;
  let rafId = 0;
  let running = true;

  /* ---- theme ---- */
  function getColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return isLight
      // Light mode: deeper teal dots + navy lines for contrast on white bg
      // Dark mode: bright teal dots + softer teal lines on dark bg
      : { dot: 'rgba(94,234,212,0.95)',  line: 'rgba(15,193,183,',   lineOpacityMul: 0.7  };
  }

  /* ---- sizing ---- */
  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const targetCount = Math.max(MIN_DOTS, Math.min(MAX_DOTS, Math.round(w * h * DOT_DENSITY)));
    if (dots.length === 0) {
      for (let i = 0; i < targetCount; i++) dots.push(spawnDot());
    } else if (dots.length < targetCount) {
      while (dots.length < targetCount) dots.push(spawnDot());
    } else if (dots.length > targetCount) {
      dots.length = targetCount;
    }
  }

  function spawnDot() {
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: Math.cos(angle) * SPEED,
      vy: Math.sin(angle) * SPEED,
    };
  }

  /* ---- draw ---- */
  function tick() {
    rafId = 0;
    if (!running) return;
    ctx.clearRect(0, 0, w, h);

    const colors = getColors();

    // Update positions
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      d.x += d.vx;
      d.y += d.vy;
      // wrap around edges
      if (d.x < -10) d.x = w + 10;
      if (d.x > w + 10) d.x = -10;
      if (d.y < -10) d.y = h + 10;
      if (d.y > h + 10) d.y = -10;
    }

    // Draw connecting lines
    ctx.lineWidth = 0.7;
    const mul = colors.lineOpacityMul || 0.45;
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const a = dots[i], b = dots[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist2 = dx * dx + dy * dy;
        const max2 = LINK_DIST * LINK_DIST;
        if (dist2 < max2) {
          const dist = Math.sqrt(dist2);
          const alpha = (1 - dist / LINK_DIST) * mul;
          ctx.strokeStyle = colors.line + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Draw dots on top
    ctx.fillStyle = colors.dot;
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      ctx.beginPath();
      ctx.arc(d.x, d.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    schedule();
  }

  function schedule() {
    if (rafId) return;
    rafId = requestAnimationFrame(tick);
  }

  /* ---- lifecycle ---- */
  resize();
  schedule();

  window.addEventListener('resize', () => {
    resize();
  });
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) schedule();
  });
}

export default initMobileDotsBg;
