// ============================================================
// Parallax Video Background — for main site pages
// Uses parallax-bg-1080p.mp4 with spring-based scroll scrubbing
// ============================================================

import { createScrollSpring } from '/js/scroll-spring.js';

export function initParallaxVideoBg() {
  if (document.getElementById('parallax-video-bg')) return;
  // Don't load if blog video bg already exists
  if (document.getElementById('blog-video-bg')) return;

  // Detect mobile / small viewport — use simple looping playback there.
  // Scroll-scrubbing seeks the video frame on every scroll event which is
  // GPU-expensive on mobile and causes severe lag.
  const isMobile = window.matchMedia('(max-width: 768px)').matches ||
                   /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);

  const container = document.createElement('div');
  container.id = 'parallax-video-bg';
  container.className = 'blog-video-bg'; // reuse same CSS class for styling

  const video = document.createElement('video');
  video.src = '/assets/parallax-bg-1080p.mp4';
  video.muted = true;
  video.playsInline = true;
  video.preload = isMobile ? 'metadata' : 'auto';
  video.loop = isMobile;
  video.autoplay = isMobile;
  video.style.cssText = 'width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.5s ease;';

  container.appendChild(video);
  document.body.prepend(container);

  // Mobile path — simple loop, no scroll scrub
  if (isMobile) {
    const showVideo = () => {
      video.style.opacity = '1';
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      video.style.filter = isDark ? 'brightness(0.45)' : 'brightness(1)';
      video.style.opacity = isDark ? '1' : '0.7';
    };
    video.addEventListener('loadeddata', showVideo, { once: true });
    video.play().then(showVideo).catch(() => { showVideo(); });
    return;
  }

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
