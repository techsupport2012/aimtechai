// ============================================================
// Futuristic UI Sounds — Web Audio API (no audio files)
// Hover on: ascending synth blip
// Hover off: descending soft tone
// ============================================================

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Hover ON — gentle ascending tone, no click
function playHoverOn() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.setTargetAtTime(1500, t, 0.05);

    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.012, t, 0.02);    // soft fade in
    gain.gain.setTargetAtTime(0.0001, t + 0.06, 0.04); // fade out

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  } catch(e) {}
}

// Hover OFF — gentle descending tone, no click
function playHoverOff() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.setTargetAtTime(600, t, 0.05);

    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.01, t, 0.02);     // soft fade in
    gain.gain.setTargetAtTime(0.0001, t + 0.06, 0.05); // fade out

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  } catch(e) {}
}

export function initSounds() {
  const selectors = [
    'a', 'button',
    '.glass-card', '.service-card', '.value-item',
    '.testimonial-card', '.contact-card', '.stat-item',
    '.feature-card', '.team-card', '.industry-item',
    '.marquee-item', '.nav-cta', '.btn-primary', '.btn-outline',
    '.lang-option', '.theme-toggle', '.lang-toggle',
  ].join(',');

  // Use event delegation on document for efficiency
  // and to catch dynamically added elements
  let lastHovered = null;

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest(selectors);
    if (target && target !== lastHovered) {
      lastHovered = target;
      playHoverOn();
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest(selectors);
    if (target && target === lastHovered) {
      // Check if we're actually leaving the element
      const related = e.relatedTarget;
      if (!target.contains(related)) {
        lastHovered = null;
        playHoverOff();
      }
    }
  });

  // Resume AudioContext on first user interaction (browser policy)
  document.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }, { once: true });
}
