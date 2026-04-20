// ============================================================
// Video scroll scrubber background.
// Fullscreen fixed-position video; its currentTime is driven by scroll
// progress through a critically-damped spring. Scroll down = video plays
// forward; scroll up = video plays in reverse (free consequence of
// setting currentTime directly).
// ============================================================

import { createScrollSpring } from '/js/scroll-spring.js';

const VIDEO_SRC = '/assets/parallax-bg-1080p.mp4';
const POSTER_SRC = '/assets/office/poster.jpg'; // fallback while video buffers

export async function initVideoBackground({ reducedMotion = false } = {}) {
  if (document.getElementById('video-bg')) return;

  const container = document.createElement('div');
  container.id = 'video-bg';
  container.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;z-index:0;' +
    'pointer-events:none;overflow:hidden;background:#0a0608;';
  document.body.prepend(container);

  const video = document.createElement('video');
  video.src = VIDEO_SRC;
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.loop = false;
  video.autoplay = false;
  // Poster shows a static image while video decodes first frames
  video.poster = POSTER_SRC;
  video.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' +
    'will-change:opacity;opacity:0;transition:opacity .4s ease;';
  container.appendChild(video);

  // Wait for enough data to seek; fall back to poster if it fails.
  const metadataReady = new Promise((resolve, reject) => {
    const onReady = () => { cleanup(); resolve(); };
    const onError = (e) => { cleanup(); reject(e); };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('error', onError);
    };
    if (video.readyState >= 1) resolve();
    else {
      video.addEventListener('loadedmetadata', onReady, { once: true });
      video.addEventListener('error', onError, { once: true });
    }
  });

  try {
    await metadataReady;
  } catch (err) {
    console.warn('[video-bg] metadata load failed, keeping poster only:', err);
    // Keep container with black background + poster; abort scrub wiring.
    return { container, video, duration: 0 };
  }

  // Nudge a first-frame render and reveal the video.
  try { await video.play(); video.pause(); } catch {}
  video.currentTime = 0;
  video.style.opacity = '1';
  video.style.filter = 'blur(12px)';

  const duration = Math.max(0.01, video.duration || 0);

  // Reduced-motion: freeze on first frame, skip the scrub loop.
  if (reducedMotion) {
    video.currentTime = 0;
    return { container, video, duration };
  }

  // Smoothed scroll progress — critically-damped spring (damping 0.18 is snappy
  // but still filters trackpad jitter enough to keep seeks from thrashing).
  const spring = createScrollSpring(0, { damping: 0.18, clamp: true });

  function rawProgress() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    return Math.max(0, Math.min(1, scrollY / max));
  }

  // Avoid redundant seeks — only write currentTime when the target has moved
  // more than one frame's worth. Assume ~30fps source (tighten if source is 60).
  const FRAME_STEP = 1 / 30;
  let lastWritten = -1;
  let running = true;
  let rafId = 0;
  let last = performance.now();

  function frame(now) {
    rafId = 0;
    if (!running) return;
    const dt = now - last;
    last = now;
    spring.target = rawProgress();
    spring.tick(dt);
    const p = spring.value;
    const t = p * duration;
    if (Math.abs(t - lastWritten) >= FRAME_STEP) {
      video.currentTime = t;
      lastWritten = t;
    }
    // Blur: 12px at hero (p=0), clears to 0 by p=0.15 (~one viewport scroll)
    // Scrolling back up re-blurs smoothly
    const blur = Math.max(0, (1 - p / 0.15)) * 12;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const parts = [];
    if (blur > 0.1) parts.push(`blur(${blur.toFixed(1)}px)`);
    parts.push(isDark ? 'brightness(0.45)' : 'brightness(1)');
    video.style.filter = parts.join(' ');
    video.style.opacity = isDark ? '1' : '0.7';
    schedule();
  }
  function schedule() {
    if (rafId) return;
    rafId = requestAnimationFrame(frame);
  }
  schedule();

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) {
      last = performance.now();
      schedule();
    }
  });

  addEventListener('resize', () => {
    // No layout work needed — video is fixed-cover; just re-apply currentTime
    // in case scrollHeight changed.
    spring.target = rawProgress();
  });

  return { container, video, duration, spring };
}
