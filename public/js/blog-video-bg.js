// ============================================================
// Blog Video Background — ultra-smooth scroll scrubbing
// Dual approach: spring-based seek + playbackRate glide
// ============================================================

import { createScrollSpring } from '/js/scroll-spring.js';

export function initBlogVideoBg() {
  if (document.getElementById('blog-video-bg')) return;

  const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
  if (isMobile) return;

  const container = document.createElement('div');
  container.id = 'blog-video-bg';
  container.className = 'blog-video-bg';

  const video = document.createElement('video');
  video.src = '/assets/server-bg-1080p.mp4';
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
    video.style.filter = 'blur(12px)';

    // Very soft spring — ultra cinematic
    const spring = createScrollSpring(0, { damping: 0.04, clamp: true });
    let last = performance.now();
    let running = true;
    let rafId = 0;
    let lastSeek = 0;
    let isPlaying = false;

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

      const targetTime = Math.max(0, Math.min(spring.value * duration, duration - 0.01));
      const delta = targetTime - video.currentTime;
      const absDelta = Math.abs(delta);

      if (absDelta > 1.0) {
        // Far away — soft seek (jump halfway)
        video.currentTime = video.currentTime + delta * 0.3;
        lastSeek = now;
        if (isPlaying) { video.pause(); isPlaying = false; }
      }
      else if (absDelta > 0.03) {
        // Close — use playbackRate to glide smoothly
        // Forward: speed up. Backward: tiny seeks.
        if (delta > 0) {
          // Need to go forward — play at variable speed
          const speed = Math.max(0.1, Math.min(3, delta * 5));
          if (!isPlaying) {
            video.play().catch(() => {});
            isPlaying = true;
          }
          video.playbackRate = speed;
        } else {
          // Need to go backward — small seek steps
          if (isPlaying) { video.pause(); isPlaying = false; }
          // Seek backward gently
          if (now - lastSeek > 30) { // max ~33 seeks/sec
            video.currentTime = Math.max(0, video.currentTime + delta * 0.15);
            lastSeek = now;
          }
        }
      }
      else {
        // On target — slow down toward pause. Browsers require playbackRate >= 0.0625.
        if (isPlaying) {
          try { video.playbackRate = 0.0625; } catch {}
          // Fully stop after settling
          if (absDelta < 0.01) {
            video.pause();
            isPlaying = false;
          }
        }
      }

      // Blur: 12px at hero (p=0), clears to 0 by p=0.15, re-blurs on scroll up
      const p = spring.value;
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
  }).catch(err => {
    console.warn('[blog-video-bg] load failed:', err);
  });
}
