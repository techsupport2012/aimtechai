import * as THREE from 'three';

// ============================================================
// initThreeBackground()
// Dark atmospheric 3D background inspired by Raven Trading.
// Extremely subtle — dark void with faint particles, slow-
// moving wireframe geometry, and gentle gradient fog.
// ============================================================
export function initThreeBackground() {
  let canvas = document.getElementById('three-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'three-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;pointer-events:none;';
    document.body.prepend(canvas);
  }

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x08080a, 0.018);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 35;

  // --- Subtle wireframe icosahedron (faint, ghostly) ---
  const icoGeo = new THREE.IcosahedronGeometry(10, 1);
  const icoMat = new THREE.MeshBasicMaterial({
    color: 0x4d65ff,
    wireframe: true,
    transparent: true,
    opacity: 0.04,
  });
  const icosahedron = new THREE.Mesh(icoGeo, icoMat);
  scene.add(icosahedron);

  // --- Outer ring (barely visible) ---
  const torusGeo = new THREE.TorusGeometry(18, 0.08, 16, 120);
  const torusMat = new THREE.MeshBasicMaterial({
    color: 0x4d65ff,
    transparent: true,
    opacity: 0.06,
  });
  const torus = new THREE.Mesh(torusGeo, torusMat);
  torus.rotation.x = Math.PI / 2.5;
  scene.add(torus);

  // --- Second ring ---
  const torus2Geo = new THREE.TorusGeometry(22, 0.05, 16, 120);
  const torus2Mat = new THREE.MeshBasicMaterial({
    color: 0x7b2fff,
    transparent: true,
    opacity: 0.04,
  });
  const torus2 = new THREE.Mesh(torus2Geo, torus2Mat);
  torus2.rotation.x = -Math.PI / 3;
  torus2.rotation.y = Math.PI / 5;
  scene.add(torus2);

  // --- Particle field (sparse, dim) ---
  const particleCount = 250;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 100;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    sizes[i] = Math.random() * 0.5 + 0.2;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0x4d65ff,
    size: 0.04,
    transparent: true,
    opacity: 0.3,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // --- Scroll tracking ---
  let scrollProgress = 0;
  let targetScroll = 0;

  // Listen on snap-container (the actual scrolling element) AND window
  const snapContainer = document.querySelector('.snap-container');
  const scrollTarget = snapContainer || window;

  function onScroll() {
    const el = snapContainer || document.documentElement;
    const scrollTop = snapContainer ? snapContainer.scrollTop : window.scrollY;
    const maxScroll = el.scrollHeight - el.clientHeight;
    targetScroll = maxScroll > 0 ? scrollTop / maxScroll : 0;
  }
  scrollTarget.addEventListener('scroll', onScroll, { passive: true });

  // --- Mouse parallax ---
  let mouseX = 0, mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // --- Render loop ---
  function animate() {
    requestAnimationFrame(animate);
    scrollProgress += (targetScroll - scrollProgress) * 0.03;
    const s = scrollProgress;
    const t = performance.now() * 0.0001;

    // Icosahedron: ultra-slow rotation + scroll
    icosahedron.rotation.x = t * 0.5 + s * Math.PI;
    icosahedron.rotation.y = t * 0.3 + s * Math.PI * 0.7;
    const scale = 1 + s * 0.6;
    icosahedron.scale.set(scale, scale, scale);
    icoMat.opacity = 0.04 + Math.sin(t * 2) * 0.01;

    // Torus: slow drift
    torus.rotation.z = t * 0.4 + s * Math.PI;
    torus2.rotation.z = -t * 0.25 + s * Math.PI * 0.5;

    // Particles: drift gently
    particles.rotation.y = t * 0.15 + s * 0.2;
    particles.rotation.x = t * 0.08;

    // Camera parallax (subtle)
    camera.position.x += (mouseX * 1.2 - camera.position.x) * 0.015;
    camera.position.y += (-mouseY * 1.2 - camera.position.y) * 0.015;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ============================================================
// initUI()
// All shared DOM UI behaviors.
// ============================================================
export function initUI() {
  initCursor();
  initScrollProgress();
  initScrollReveal();
  initNavScroll();
  initScrambleText();
  initScrambleReveal();
  initProgressNav();
  initBlurIn();
  initMarquee();
  initCounters();
  initCardGlow();
  initMobileMenu();
  initHeroAnimation();
}

// --- Custom Cursor ---
function initCursor() {
  let dot = document.getElementById('cursor-dot');
  let ring = document.getElementById('cursor-ring');
  if (!dot) {
    dot = document.createElement('div');
    dot.id = 'cursor-dot';
    dot.style.cssText = 'position:fixed;width:6px;height:6px;background:#4d65ff;border-radius:50%;pointer-events:none;z-index:99999;mix-blend-mode:difference;transition:transform 0.1s;';
    document.body.appendChild(dot);
  }
  if (!ring) {
    ring = document.createElement('div');
    ring.id = 'cursor-ring';
    ring.style.cssText = 'position:fixed;width:36px;height:36px;border:1px solid rgba(77,101,255,0.5);border-radius:50%;pointer-events:none;z-index:99998;mix-blend-mode:difference;transition:transform 0.15s ease-out,width 0.3s,height 0.3s;';
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
      ring.style.borderColor = 'rgba(255,45,123,0.5)';
      ring.style.transform = 'translate(-7px, -7px)';
    });
    el.addEventListener('mouseleave', () => {
      ring.style.width = '36px';
      ring.style.height = '36px';
      ring.style.borderColor = 'rgba(77,101,255,0.5)';
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
  const snapContainer = document.querySelector('.snap-container');
  const scrollTarget = snapContainer || window;
  scrollTarget.addEventListener('scroll', () => {
    const el = snapContainer || document.documentElement;
    const scrollTop = snapContainer ? snapContainer.scrollTop : window.scrollY;
    const max = el.scrollHeight - el.clientHeight;
    bar.style.width = (max > 0 ? scrollTop / max * 100 : 0) + '%';
  }, { passive: true });
}

// --- Scroll Reveal ---
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 60);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  els.forEach(el => observer.observe(el));
}

// --- Navbar Scroll ---
function initNavScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  const snapContainer = document.querySelector('.snap-container');
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
  const sections = document.querySelectorAll('.snap-section');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
        const id = entry.target.id;
        links.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { threshold: 0.5, root: document.querySelector('.snap-container') });

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
function initBlurIn() {
  document.querySelectorAll('.blur-in').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.filter = 'blur(16px)';
    el.style.transition = `opacity 1s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s, filter 1s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s`;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.filter = 'blur(0px)';
          });
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.05 });
    observer.observe(el);
  });
}

// --- Marquee Auto-Duplicate ---
function initMarquee() {
  document.querySelectorAll('.marquee-track').forEach(track => {
    const items = [...track.children];
    items.forEach(item => track.appendChild(item.cloneNode(true)));
  });
}

// --- Counter Animation ---
function initCounters() {
  const counters = document.querySelectorAll('.stat-number');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target);
        let current = 0;
        const step = target / 40;
        const timer = setInterval(() => {
          current += step;
          if (current >= target) {
            current = target;
            clearInterval(timer);
          }
          el.textContent = target === 5 ? current.toFixed(1) : Math.floor(current);
        }, 40);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => observer.observe(c));
}

// --- Glass Card Mouse Glow ---
function initCardGlow() {
  document.querySelectorAll('.glass-card, .service-card').forEach(card => {
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

// --- Hero Entrance Animation ---
function initHeroAnimation() {
  const heroEls = ['.hero-sub-header', '.hero h1', '.hero-sub', '.hero-buttons'];
  heroEls.forEach((sel, i) => {
    const el = document.querySelector(sel);
    if (el && !el.classList.contains('blur-in')) {
      el.style.opacity = '0';
      el.style.filter = 'blur(16px)';
      el.style.transition = `opacity 1.2s cubic-bezier(0.16,1,0.3,1) ${0.3 + i * 0.2}s, filter 1.2s cubic-bezier(0.16,1,0.3,1) ${0.3 + i * 0.2}s`;
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.filter = 'blur(0px)';
      }, 100);
    }
  });
}
