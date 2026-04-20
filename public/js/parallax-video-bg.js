// ============================================================
// Parallax Video Background — for main site pages
// Uses parallax-bg-1080p.mp4 with spring-based scroll scrubbing
// ============================================================

import { createScrollSpring } from '/js/scroll-spring.js';

export function initParallaxVideoBg() {
  if (document.getElementById('parallax-video-bg')) return;
  // Don't load if blog video bg already exists
  if (document.getElementById('blog-video-bg')) return;

  // Allow video bg on mobile — preload="metadata" keeps initial cost low

  const container = document.createElement('div');
  container.id = 'parallax-video-bg';
  container.className = 'blog-video-bg'; // reuse same CSS class for styling

  const video = document.createElement('video');
  video.src = '/assets/parallax-bg-1080p.mp4';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.loop = false;
  video.autoplay = false;
  video.style.cssText = 'width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.5s ease;';

  container.appendChild(video);
  document.body.prepend(container);

  const metadataReady = new Promise((resolve, reject) => {
    if (video.readyState >= 1) resolve();
    else {
      video.addEventListener('loadedmetadata', resolve, { once: true });
      video.addEventListener('error', reject, { once: true });
    }
  });

  metadataReady.then(() => {
    const duration = Math.max(0.01, video.duration || 0);
    try { video.play().then(() => video.pause()); } catch {}
    video.currentTime = 0;
    video.style.opacity = '1';
    video.style.filter = '';

    const spring = createScrollSpring(0, { damping: 0.06, clamp: true });
    const FRAME_STEP = 1 / 60;
    let lastWritten = -1;
    let last = performance.now();
    let running = true;
    let rafId = 0;

    function rawProgress() {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      return Math.max(0, Math.min(1, scrollY / max));
    }

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

      // No blur on parallax video. Dark mode gets a brightness darken to create
      // the black overlay effect; light mode is untouched.
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      video.style.filter = isDark ? 'brightness(0.45)' : 'brightness(1)';
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
  }).catch(err => {
    console.warn('[parallax-video-bg] load failed:', err);
  });
}
