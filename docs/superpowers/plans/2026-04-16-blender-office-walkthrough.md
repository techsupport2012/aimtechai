# Blender Office Walkthrough — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing procedural Three.js office background on `index.html` with a Blender-authored, live-rendered, scroll-driven cinematic office walkthrough featuring day-to-night lighting and five service-mapped hotspots — delivered behind a feature flag so rollback is a one-line change.

**Architecture:** Blender MCP scripting builds a multi-zone executive office, exports a Draco+Meshopt-compressed glTF plus four KTX2 HDRIs plus a poster JPG. A new `blender-bg.js` replaces `office-bg.js` (behind `?bg=blender` or `localStorage.bg='blender'`) and uses Three.js to load those assets once, then drives camera position (Catmull-Rom spline over 5 waypoints), environment lighting (2-HDRI blend), sun, lamp emissives, tone mapping, fog, and bloom from scroll progress. Hotspots are absolute-positioned HTML synced each frame to projected 3D anchors with occlusion testing.

**Tech Stack:** Blender (Cycles for poster, Eevee for preview), PolyHaven + Sketchfab MCPs (assets), Three.js 0.163 (runtime, already a site dependency), Vitest (pure-logic unit tests), `basisu` CLI (KTX2 encoding), `gltf-transform` CLI (Draco/Meshopt). Spec: `docs/superpowers/specs/2026-04-16-blender-office-walkthrough-design.md`.

---

## File structure

**New files (runtime):**
- `public/js/blender-bg.js` — scene loader, scroll driver, render loop, lighting state machine
- `public/js/blender-bg/camera-spline.js` — Catmull-Rom eval + per-segment ease-in-out
- `public/js/blender-bg/day-night.js` — scroll → lighting state pure mapper
- `public/js/blender-bg/hotspots.js` — state machine, projection, DOM sync
- `public/js/blender-bg/scroll-spring.js` — critically-damped spring smoothing
- `public/js/blender-bg/feature-flag.js` — flag resolution
- `public/css/blender-bg.css` — hotspot ring + card + focus styles

**New files (build/assets):**
- `blender/build_office.py` — full reproducible Blender build (the MCP executes its sections)
- `public/assets/office/scene.glb`
- `public/assets/office/hdri-{golden,blue,dusk,night}.ktx2`
- `public/assets/office/poster.jpg`

**New files (tests):**
- `tests/blender-bg/camera-spline.test.js`
- `tests/blender-bg/day-night.test.js`
- `tests/blender-bg/hotspots.test.js`
- `tests/blender-bg/scroll-spring.test.js`
- `tests/blender-bg/feature-flag.test.js`
- `vitest.config.js`

**Modified:**
- `public/index.html` — conditional import of `blender-bg.js` vs `office-bg.js`
- `package.json` — add vitest + gltf-transform devDependencies, `test` script

**Untouched (safety):**
- `public/js/office-bg.js` — remains the default background

---

## Task 1: Test harness + feature-flag module

**Files:**
- Create: `vitest.config.js`
- Create: `tests/blender-bg/feature-flag.test.js`
- Create: `public/js/blender-bg/feature-flag.js`
- Modify: `package.json`

- [ ] **Step 1: Add vitest devDependency and test script**

Modify `package.json` — add inside `devDependencies` (create the block if absent) and `scripts`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^1.6.0",
    "jsdom": "^24.0.0"
  }
}
```

Run: `npm install` (from `Y:\AimTechAI`).

- [ ] **Step 2: Create vitest config**

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    globals: false,
  },
});
```

- [ ] **Step 3: Write failing test for feature-flag resolver**

Create `tests/blender-bg/feature-flag.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { shouldUseBlenderBackground } from '../../public/js/blender-bg/feature-flag.js';

describe('shouldUseBlenderBackground', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/');
  });

  it('returns false by default', () => {
    expect(shouldUseBlenderBackground()).toBe(false);
  });

  it('returns true when ?bg=blender query param is set', () => {
    history.replaceState(null, '', '/?bg=blender');
    expect(shouldUseBlenderBackground()).toBe(true);
  });

  it('returns true when localStorage.bg === "blender"', () => {
    localStorage.setItem('bg', 'blender');
    expect(shouldUseBlenderBackground()).toBe(true);
  });

  it('query param overrides localStorage opt-out', () => {
    localStorage.setItem('bg', 'office');
    history.replaceState(null, '', '/?bg=blender');
    expect(shouldUseBlenderBackground()).toBe(true);
  });

  it('returns false for unknown values', () => {
    localStorage.setItem('bg', 'something-else');
    expect(shouldUseBlenderBackground()).toBe(false);
  });
});
```

- [ ] **Step 4: Run test, expect failure**

Run: `npm test`
Expected: FAIL with "Failed to load url ../../public/js/blender-bg/feature-flag.js".

- [ ] **Step 5: Implement feature-flag module**

Create `public/js/blender-bg/feature-flag.js`:

```js
export function shouldUseBlenderBackground() {
  const q = new URLSearchParams(location.search).get('bg');
  if (q === 'blender') return true;
  if (q && q !== 'blender') return false;
  return localStorage.getItem('bg') === 'blender';
}
```

- [ ] **Step 6: Run tests, expect pass**

Run: `npm test`
Expected: PASS, 5 tests green.

- [ ] **Step 7: Commit**

```bash
cd Y:/AimTechAI
git init 2>/dev/null; git add package.json vitest.config.js tests/blender-bg/feature-flag.test.js public/js/blender-bg/feature-flag.js
git commit -m "feat(bg): add vitest harness and feature-flag resolver"
```

Note: `Y:\AimTechAI` is not currently a git repo. Run `git init` once at the start (safe to rerun); after that every task commits normally.

---

## Task 2: Scroll progress spring

**Files:**
- Create: `tests/blender-bg/scroll-spring.test.js`
- Create: `public/js/blender-bg/scroll-spring.js`

- [ ] **Step 1: Write failing test**

Create `tests/blender-bg/scroll-spring.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createScrollSpring } from '../../public/js/blender-bg/scroll-spring.js';

describe('createScrollSpring', () => {
  it('starts at initial value', () => {
    const s = createScrollSpring(0);
    expect(s.value).toBe(0);
  });

  it('chases target over repeated ticks', () => {
    const s = createScrollSpring(0, { damping: 0.15 });
    s.target = 1;
    for (let i = 0; i < 120; i++) s.tick(16);
    expect(s.value).toBeGreaterThan(0.99);
    expect(s.value).toBeLessThanOrEqual(1);
  });

  it('does not overshoot target significantly', () => {
    const s = createScrollSpring(0, { damping: 0.15 });
    s.target = 1;
    let peak = 0;
    for (let i = 0; i < 240; i++) { s.tick(16); peak = Math.max(peak, s.value); }
    expect(peak).toBeLessThan(1.02);
  });

  it('clamps value to [0, 1] when clamp option is true', () => {
    const s = createScrollSpring(0, { damping: 0.3, clamp: true });
    s.target = 1.5;
    for (let i = 0; i < 240; i++) s.tick(16);
    expect(s.value).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- scroll-spring`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement scroll-spring**

Create `public/js/blender-bg/scroll-spring.js`:

```js
// Critically-damped spring that chases `target`.
// damping is a unitless smoothing factor; larger = faster convergence.
export function createScrollSpring(initial = 0, { damping = 0.12, clamp = false } = {}) {
  const state = {
    value: initial,
    velocity: 0,
    target: initial,
    tick(dtMs) {
      const dt = Math.min(dtMs, 64) / 16.6667; // frames at 60fps equivalent
      const k = damping;
      const delta = state.target - state.value;
      state.velocity += delta * k;
      state.velocity *= 1 - k * 1.8;
      state.value += state.velocity * dt;
      if (clamp) state.value = Math.max(0, Math.min(1, state.value));
    },
  };
  return state;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- scroll-spring`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/blender-bg/scroll-spring.test.js public/js/blender-bg/scroll-spring.js
git commit -m "feat(bg): add critically-damped scroll spring"
```

---

## Task 3: Camera spline evaluator

**Files:**
- Create: `tests/blender-bg/camera-spline.test.js`
- Create: `public/js/blender-bg/camera-spline.js`

- [ ] **Step 1: Write failing test**

Create `tests/blender-bg/camera-spline.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createCameraSpline } from '../../public/js/blender-bg/camera-spline.js';

const waypoints = [
  { pos: [0, 1.65, 10], look: [0, 1.65, -5] },
  { pos: [0, 1.65,  5], look: [0, 1.65, -8] },
  { pos: [2, 1.65,  0], look: [4, 1.6, -6] },
  { pos: [4, 1.6,  -4], look: [6, 1.5, -8] },
  { pos: [6, 1.5,  -7], look: [8, 1.5, -10] },
];

describe('createCameraSpline', () => {
  const spline = createCameraSpline(waypoints);

  it('at p=0 returns exactly the first waypoint', () => {
    const { position, lookAt } = spline.at(0);
    expect(position).toEqual(waypoints[0].pos);
    expect(lookAt).toEqual(waypoints[0].look);
  });

  it('at p=1 returns exactly the last waypoint', () => {
    const { position, lookAt } = spline.at(1);
    expect(position).toEqual(waypoints[4].pos);
    expect(lookAt).toEqual(waypoints[4].look);
  });

  it('at p=0.5 is near the geometric midpoint of segment 2 (after easing)', () => {
    // Eased midpoint should be on or very close to waypoint index 2 (5 points → p=0.5 ~ wp[2])
    const { position } = spline.at(0.5);
    expect(Math.abs(position[0] - waypoints[2].pos[0])).toBeLessThan(0.5);
  });

  it('motion is monotonic along the spline for p increasing', () => {
    let prevZ = spline.at(0).position[2];
    for (let i = 1; i <= 20; i++) {
      const z = spline.at(i / 20).position[2];
      expect(z).toBeLessThanOrEqual(prevZ + 1e-6);
      prevZ = z;
    }
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- camera-spline`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement camera spline**

Create `public/js/blender-bg/camera-spline.js`:

```js
// Catmull-Rom over N waypoints with per-segment cubic ease-in-out.
// waypoints: [{ pos:[x,y,z], look:[x,y,z] }]

const ease = t => t * t * (3 - 2 * t); // smoothstep

function catmull(a, b, c, d, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (
    (2 * b) +
    (-a + c) * t +
    (2 * a - 5 * b + 4 * c - d) * t2 +
    (-a + 3 * b - 3 * c + d) * t3
  );
}

function vec3At(pts, i, t) {
  const n = pts.length;
  const a = pts[Math.max(0, i - 1)];
  const b = pts[i];
  const c = pts[Math.min(n - 1, i + 1)];
  const d = pts[Math.min(n - 1, i + 2)];
  return [
    catmull(a[0], b[0], c[0], d[0], t),
    catmull(a[1], b[1], c[1], d[1], t),
    catmull(a[2], b[2], c[2], d[2], t),
  ];
}

export function createCameraSpline(waypoints) {
  const n = waypoints.length;
  const positions = waypoints.map(w => w.pos);
  const looks = waypoints.map(w => w.look);

  return {
    at(p) {
      p = Math.max(0, Math.min(1, p));
      if (p === 0) return { position: positions[0].slice(), lookAt: looks[0].slice() };
      if (p === 1) return { position: positions[n - 1].slice(), lookAt: looks[n - 1].slice() };
      const segF = p * (n - 1);
      const i = Math.floor(segF);
      const t = ease(segF - i);
      return {
        position: vec3At(positions, i, t),
        lookAt:   vec3At(looks,     i, t),
      };
    },
  };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- camera-spline`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/blender-bg/camera-spline.test.js public/js/blender-bg/camera-spline.js
git commit -m "feat(bg): add catmull-rom camera spline with eased segments"
```

---

## Task 4: Day-night state mapper

**Files:**
- Create: `tests/blender-bg/day-night.test.js`
- Create: `public/js/blender-bg/day-night.js`

- [ ] **Step 1: Write failing test**

Create `tests/blender-bg/day-night.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { dayNightAt } from '../../public/js/blender-bg/day-night.js';

describe('dayNightAt', () => {
  it('at p=0 returns golden-only (blend=0)', () => {
    const s = dayNightAt(0);
    expect(s.hdriA).toBe('golden');
    expect(s.hdriB).toBe('golden');
    expect(s.blend).toBe(0);
    expect(s.sunIntensity).toBeGreaterThan(3);
    expect(s.lampStrength).toBeCloseTo(0, 3);
    expect(s.exposure).toBeCloseTo(1.0, 2);
  });

  it('at p=0.25 transitions out of pure golden', () => {
    const s = dayNightAt(0.25);
    expect(s.hdriA).toBe('golden');
    expect(s.hdriB).toBe('blue');
    expect(s.blend).toBeCloseTo(0, 2);
  });

  it('at p=0.5 is mid blue-hour arrival', () => {
    const s = dayNightAt(0.5);
    expect(s.hdriA).toBe('blue');
    expect(s.hdriB).toBe('dusk');
    expect(s.blend).toBeCloseTo(0, 2);
  });

  it('at p=1 returns night-only (A=B=night, blend=0)', () => {
    const s = dayNightAt(1);
    expect(s.hdriA).toBe('night');
    expect(s.hdriB).toBe('night');
    expect(s.sunIntensity).toBeLessThan(0.3);
    expect(s.lampStrength).toBeGreaterThan(3);
    expect(s.exposure).toBeCloseTo(1.25, 2);
  });

  it('sun elevation decreases monotonically from p=0 to p=1', () => {
    let prev = dayNightAt(0).sunElevationDeg;
    for (let i = 1; i <= 20; i++) {
      const s = dayNightAt(i / 20);
      expect(s.sunElevationDeg).toBeLessThanOrEqual(prev + 1e-6);
      prev = s.sunElevationDeg;
    }
  });

  it('fog color shifts warm → cool as p increases', () => {
    const a = dayNightAt(0.0).fogColorHex;
    const b = dayNightAt(1.0).fogColorHex;
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- day-night`
Expected: FAIL.

- [ ] **Step 3: Implement day-night module**

Create `public/js/blender-bg/day-night.js`:

```js
// Maps scroll progress p ∈ [0,1] → full lighting state descriptor.
// Consumed by blender-bg.js; pure, deterministic, unit-tested.

const clamp01 = x => Math.max(0, Math.min(1, x));
const lerp    = (a, b, t) => a + (b - a) * t;
const lerpHex = (a, b, t) => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const b2 = Math.round(lerp(ab, bb, t));
  return (r << 16) | (g << 8) | b2;
};

const SEGMENTS = [
  { range: [0.00, 0.25], a: 'golden', b: 'golden' },
  { range: [0.25, 0.50], a: 'golden', b: 'blue' },
  { range: [0.50, 0.75], a: 'blue',   b: 'dusk' },
  { range: [0.75, 1.00], a: 'dusk',   b: 'night' },
];

export function dayNightAt(p) {
  p = clamp01(p);
  const seg = p >= 1 ? SEGMENTS[SEGMENTS.length - 1] : SEGMENTS.find(s => p < s.range[1]) || SEGMENTS[0];
  const blend = p >= 1 ? 0 : (p - seg.range[0]) / (seg.range[1] - seg.range[0]);
  const hdriA = seg.a, hdriB = p >= 1 ? 'night' : seg.b;

  const sunElevationDeg = lerp(55, -8, p);
  const sunIntensity    = lerp(3.5, 0.15, p);
  const sunColorHex     = lerpHex(0xffb070, 0x202040, p);
  const lampStrength    = lerp(0.0, 3.5, p);
  const exposure        = lerp(1.0, 1.25, p);
  const fogColorHex     = p < 0.5
    ? lerpHex(0xd9b88a, 0x3a4866, p / 0.5)
    : lerpHex(0x3a4866, 0x110c1e, (p - 0.5) / 0.5);
  const bloomStrength   = lerp(0.3, 0.9, p);

  return {
    hdriA, hdriB, blend,
    sunElevationDeg, sunIntensity, sunColorHex,
    lampStrength, exposure, fogColorHex, bloomStrength,
  };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- day-night`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/blender-bg/day-night.test.js public/js/blender-bg/day-night.js
git commit -m "feat(bg): add day-night lighting state mapper"
```

---

## Task 5: Hotspot state machine

**Files:**
- Create: `tests/blender-bg/hotspots.test.js`
- Create: `public/js/blender-bg/hotspots.js`

This task implements the *pure* hotspot state machine (given scroll progress and projection inputs, compute per-hotspot visibility/opacity). DOM sync is wired up in Task 14.

- [ ] **Step 1: Write failing test**

Create `tests/blender-bg/hotspots.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { hotspotState, HOTSPOTS } from '../../public/js/blender-bg/hotspots.js';

const mkProj = (override = {}) => ({
  onScreen: true,
  ndcX: 0, ndcY: 0,
  distanceToCamera: 6,
  occluded: false,
  ...override,
});

describe('hotspotState', () => {
  it('is fully hidden outside scroll range', () => {
    const state = hotspotState(HOTSPOTS[0], 0.5, mkProj());
    expect(state.opacity).toBe(0);
    expect(state.visible).toBe(false);
  });

  it('is fully visible mid-range and on-screen', () => {
    const hs = HOTSPOTS[0]; // range 0.00–0.22
    const state = hotspotState(hs, 0.11, mkProj({ distanceToCamera: 3 }));
    expect(state.opacity).toBeGreaterThan(0.9);
    expect(state.visible).toBe(true);
  });

  it('is hidden when off-screen', () => {
    const state = hotspotState(HOTSPOTS[0], 0.11, mkProj({ onScreen: false }));
    expect(state.opacity).toBe(0);
  });

  it('is hidden when occluded', () => {
    const state = hotspotState(HOTSPOTS[0], 0.11, mkProj({ occluded: true }));
    expect(state.opacity).toBe(0);
  });

  it('fades out with distance beyond proximity radius', () => {
    const close = hotspotState(HOTSPOTS[0], 0.11, mkProj({ distanceToCamera: 2 }));
    const far   = hotspotState(HOTSPOTS[0], 0.11, mkProj({ distanceToCamera: 40 }));
    expect(close.opacity).toBeGreaterThan(far.opacity);
  });

  it('all 5 hotspots map to existing service pages', () => {
    expect(HOTSPOTS).toHaveLength(5);
    expect(HOTSPOTS.map(h => h.href).sort()).toEqual(
      ['/ai', '/cloud', '/consulting', '/qa', '/ui-ux']
    );
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- hotspots`
Expected: FAIL.

- [ ] **Step 3: Implement hotspots module**

Create `public/js/blender-bg/hotspots.js`:

```js
export const HOTSPOTS = [
  { id: 'ai',         anchor: 'HS_AI',         title: 'AI Development',
    blurb: 'Custom AI systems, LLM integrations, computer vision.',
    href: '/ai',         range: [0.00, 0.22] },
  { id: 'cloud',      anchor: 'HS_Cloud',      title: 'Cloud',
    blurb: 'Scalable cloud architecture and DevOps.',
    href: '/cloud',      range: [0.18, 0.44] },
  { id: 'consulting', anchor: 'HS_Consulting', title: 'Consulting',
    blurb: 'Strategy, architecture review, technical due diligence.',
    href: '/consulting', range: [0.42, 0.66] },
  { id: 'uiux',       anchor: 'HS_UIUX',       title: 'UI / UX',
    blurb: 'Interface design systems and product experience.',
    href: '/ui-ux',      range: [0.60, 0.86] },
  { id: 'qa',         anchor: 'HS_QA',         title: 'Quality Assurance',
    blurb: 'Automated testing, release engineering, observability.',
    href: '/qa',         range: [0.80, 1.00] },
];

const smoothRange = (p, a, b, fade = 0.04) => {
  if (p < a - fade || p > b + fade) return 0;
  if (p < a) return (p - (a - fade)) / fade;
  if (p > b) return ((b + fade) - p) / fade;
  return 1;
};

const proximityFalloff = (d, near = 3, far = 20) => {
  if (d <= near) return 1;
  if (d >= far) return 0;
  return 1 - (d - near) / (far - near);
};

export function hotspotState(hs, p, projection) {
  const inRange    = smoothRange(p, hs.range[0], hs.range[1]);
  const onScreen   = projection.onScreen ? 1 : 0;
  const notOccl    = projection.occluded ? 0 : 1;
  const proximity  = proximityFalloff(projection.distanceToCamera);
  const opacity    = inRange * onScreen * notOccl * proximity;
  return {
    opacity,
    visible: opacity > 0.01,
    ndcX: projection.ndcX,
    ndcY: projection.ndcY,
  };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- hotspots`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/blender-bg/hotspots.test.js public/js/blender-bg/hotspots.js
git commit -m "feat(bg): add hotspot state machine and service mapping"
```

---

## Task 6: Blender build script — shell + materials + room

**Files:**
- Create: `blender/build_office.py`

This is the first Blender MCP session. The script is authored as a single reproducible Python file; sections of it are executed via `mcp__blender__execute_blender_code` during the build. Commit the script incrementally as each section is authored and verified.

- [ ] **Step 1: Author script header + scene reset + parameters**

Create `blender/build_office.py`:

```python
"""
AIM Tech AI — Office walkthrough background.
Reproducible build: run sections in order (clear -> room -> materials ->
reception -> workspace -> exec -> lounge -> empties -> skyline -> export).
Invoked via Blender MCP; each section is idempotent within its own scope.
"""
import bpy, math, os

OUT_DIR     = r"Y:\AimTechAI\public\assets\office"
GLB_PATH    = os.path.join(OUT_DIR, "scene.glb")
POSTER_PATH = os.path.join(OUT_DIR, "poster.jpg")

# ---- Floor footprint (metres) ----
FLOOR_W  = 24.0   # east-west
FLOOR_D  = 12.0   # north-south
WALL_H   =  3.4
GLASS_H  =  3.2   # south wall glass height
SLAB_T   =  0.12

ZONE_X = {'reception': -9.5, 'workspace': -2.5, 'exec': 4.5, 'lounge': 0.0}
# lounge occupies the rear (north) half around x=0; exec occupies east front

# ---- Camera waypoints: (position, look-at) ----
WAYPOINTS = [
    ((-10.5, 1.40,  4.8), (-6.0, 1.60, -3.0)),   # W0 Hero
    (( -4.8, 1.55,  3.2), (-0.5, 1.55, -3.5)),   # W1 About
    ((  1.4, 1.60,  2.0), ( 5.5, 1.55, -3.5)),   # W2 Services
    ((  3.6, 1.45,  0.2), ( 1.6, 1.40,  3.8)),   # W3 Values
    (( -0.2, 1.40, -1.2), ( 6.5, 1.35, -5.0)),   # W4 Contact (sofa fg, window bg)
]

# ---- Hotspot anchors (Empty world positions) ----
HOTSPOT_ANCHORS = {
    'HS_AI':         (-9.5, 1.80, -5.2),  # reception logo wall
    'HS_Cloud':      (-2.5, 2.60, -3.5),  # pendant cluster
    'HS_Consulting': ( 5.5, 1.10, -4.6),  # exec desk surface
    'HS_UIUX':       ( 0.8, 0.55,  2.4),  # lounge coffee table art piece
    'HS_QA':         ( 6.8, 1.70, -5.6),  # window framing element
}

def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.meshes) + list(bpy.data.materials) + list(bpy.data.lights):
        try: block.user_clear()
        except: pass
```

- [ ] **Step 2: Run reset_scene() via MCP**

Use `mcp__blender__execute_blender_code` with the script above plus `reset_scene()` call at the end. Expected result: empty Blender scene.

- [ ] **Step 3: Add room shell function, execute via MCP**

Append to `blender/build_office.py`:

```python
def add_mat(name, base_color, roughness=0.5, metallic=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value  = metallic
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat

def cube(name, size, location, material=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    if material: ob.data.materials.append(material)
    return ob

def build_room():
    mat_floor   = add_mat("M_Marble",      (0.78, 0.76, 0.72), roughness=0.25)
    mat_wall    = add_mat("M_WallPaint",   (0.10, 0.09, 0.085), roughness=0.85)
    mat_ceil    = add_mat("M_Ceiling",     (0.11, 0.10, 0.095), roughness=0.9)
    mat_walnut  = add_mat("M_Walnut",      (0.18, 0.10, 0.055), roughness=0.55)
    mat_glass   = add_mat("M_Glass",       (0.72, 0.78, 0.82), roughness=0.05, metallic=0.0)
    mat_glass.blend_method = 'BLEND'
    bsdf = mat_glass.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Transmission Weight"].default_value = 0.95
    bsdf.inputs["IOR"].default_value = 1.45
    bsdf.inputs["Alpha"].default_value = 0.15

    cube("FLOOR",   (FLOOR_W, FLOOR_D, SLAB_T), (0, 0, -SLAB_T / 2), mat_floor)
    cube("CEILING", (FLOOR_W, FLOOR_D, SLAB_T), (0, 0, WALL_H + SLAB_T / 2), mat_ceil)
    cube("WALL_N",  (FLOOR_W, 0.18, WALL_H),   (0,  FLOOR_D / 2, WALL_H / 2), mat_walnut)
    cube("WALL_E",  (0.18, FLOOR_D, WALL_H),   (FLOOR_W / 2, 0, WALL_H / 2), mat_wall)
    cube("WALL_W",  (0.18, FLOOR_D, WALL_H),   (-FLOOR_W / 2, 0, WALL_H / 2), mat_wall)
    cube("GLASS_S", (FLOOR_W, 0.05, GLASS_H),  (0, -FLOOR_D / 2, GLASS_H / 2), mat_glass)

build_room()
```

Run via MCP: the section from `def add_mat` through `build_room()`.

Expected: a rectangular room with floor, ceiling, 3 solid walls, and 1 glass wall.

- [ ] **Step 4: Verify visually**

Use `mcp__blender__get_viewport_screenshot` and confirm room shell looks rectangular with the glass wall transparent.

- [ ] **Step 5: Commit**

```bash
git add blender/build_office.py
git commit -m "build(office): scaffold reproducible script + room shell"
```

---

## Task 7: Blender — reception zone (marble floor accent, logo wall, low seating)

**Files:**
- Modify: `blender/build_office.py` (append)

- [ ] **Step 1: Append reception builders**

Append to `blender/build_office.py`:

```python
def build_reception():
    mat_logo    = add_mat("M_LogoGlow",   (0.95, 0.82, 0.60), roughness=0.3,
                          emission=(0.95, 0.82, 0.60), emission_strength=2.5)
    mat_leather = add_mat("M_Leather",    (0.09, 0.075, 0.06), roughness=0.45)
    mat_brass   = add_mat("M_Brass",      (0.78, 0.55, 0.28), roughness=0.25, metallic=0.9)

    # Logo wall: slim recessed panel with emissive lettering plane
    cube("RCP_LogoPanel", (3.6, 0.06, 1.2), (-9.5, 5.85, 2.1),
         add_mat("M_LogoPanelDark", (0.06, 0.05, 0.045), roughness=0.7))
    cube("RCP_LogoGlyph", (2.8, 0.01, 0.45), (-9.5, 5.82, 2.1), mat_logo)

    # Low bench (leather, brass legs)
    cube("RCP_Bench_Seat",  (2.6, 0.55, 0.12), (-9.5, 4.6, 0.42), mat_leather)
    cube("RCP_Bench_LegL",  (0.08, 0.4, 0.36), (-10.6, 4.6, 0.18), mat_brass)
    cube("RCP_Bench_LegR",  (0.08, 0.4, 0.36), ( -8.4, 4.6, 0.18), mat_brass)

    # Side plinth with a single object (sculpture placeholder)
    cube("RCP_Plinth", (0.45, 0.45, 1.1), (-7.8, 5.6, 0.55),
         add_mat("M_PlinthStone", (0.92, 0.90, 0.86), roughness=0.4))

build_reception()
```

- [ ] **Step 2: Execute via MCP and verify viewport**

Use screenshot to confirm reception objects are in place.

- [ ] **Step 3: Commit**

```bash
git add blender/build_office.py
git commit -m "build(office): add reception zone"
```

---

## Task 8: Blender — open workspace zone

**Files:**
- Modify: `blender/build_office.py` (append)

- [ ] **Step 1: Append workspace builders**

Append:

```python
def build_workspace():
    mat_walnut = bpy.data.materials["M_Walnut"]
    mat_steel  = add_mat("M_Steel", (0.55, 0.56, 0.58), roughness=0.35, metallic=1.0)
    mat_fabric = add_mat("M_ChairFabric", (0.14, 0.14, 0.16), roughness=0.8)
    mat_pend   = add_mat("M_PendantBrass", (0.82, 0.60, 0.28), roughness=0.25, metallic=0.95,
                         emission=(1.0, 0.85, 0.65), emission_strength=0.0)  # strength lerped at runtime

    def desk(x):
        cube(f"WS_DeskTop_{x:.1f}", (2.2, 1.0, 0.05), (x, 0.0, 0.74), mat_walnut)
        cube(f"WS_DeskLegL_{x:.1f}", (0.05, 0.9, 0.72), (x - 1.05, 0.0, 0.36), mat_steel)
        cube(f"WS_DeskLegR_{x:.1f}", (0.05, 0.9, 0.72), (x + 1.05, 0.0, 0.36), mat_steel)
        cube(f"WS_Monitor_{x:.1f}", (0.65, 0.08, 0.38), (x, -0.3, 1.05),
             add_mat("M_ScreenBezel", (0.04, 0.04, 0.05), roughness=0.6))
        cube(f"WS_Chair_{x:.1f}", (0.55, 0.55, 0.06), (x, 0.9, 0.48), mat_fabric)

    for i, x in enumerate([-4.2, -2.1, 0.0, 2.1]):
        desk(x)

    # Pendant cluster over workspace (4 drums, aligned at z=2.6)
    for i, x in enumerate([-3.1, -1.1, 1.0, 2.9]):
        cube(f"WS_Pendant_{i}", (0.45, 0.45, 0.25), (x, -0.8, 2.6), mat_pend)
        # thin rod up to ceiling
        cube(f"WS_PendantRod_{i}", (0.025, 0.025, 0.7), (x, -0.8, 3.05), mat_steel)

build_workspace()
```

- [ ] **Step 2: Execute and screenshot-verify**

- [ ] **Step 3: Commit**

```bash
git add blender/build_office.py
git commit -m "build(office): add open workspace with desks and pendant cluster"
```

---

## Task 9: Blender — executive office + lounge zones

**Files:**
- Modify: `blender/build_office.py` (append)

- [ ] **Step 1: Append exec and lounge builders**

Append:

```python
def build_exec():
    mat_walnut = bpy.data.materials["M_Walnut"]
    mat_steel  = bpy.data.materials["M_Steel"]
    mat_glass  = bpy.data.materials["M_Glass"]
    mat_lamp   = add_mat("M_DeskLamp", (1.0, 0.92, 0.75), roughness=0.3,
                          emission=(1.0, 0.85, 0.65), emission_strength=0.0)
    mat_chair  = add_mat("M_ExecChair", (0.07, 0.06, 0.055), roughness=0.5)

    # Glass partition (running east-west at x ~ 3.4, between workspace and exec)
    cube("EX_Partition", (0.04, 8.0, 2.6), (3.4, -1.0, 1.3), mat_glass)

    # Exec desk (L-shape approximation via two cubes)
    cube("EX_DeskMain", (2.6, 1.1, 0.06), (5.5, -4.6, 0.78), mat_walnut)
    cube("EX_DeskWing", (0.9, 1.1, 0.06), (4.25, -3.2, 0.78), mat_walnut)
    cube("EX_DeskFront", (2.6, 0.05, 0.72), (5.5, -4.0, 0.36), mat_walnut)
    # Exec chair
    cube("EX_ChairBack", (0.7, 0.08, 0.95), (5.5, -5.55, 0.9), mat_chair)
    cube("EX_ChairSeat", (0.7, 0.7, 0.08), (5.5, -5.2, 0.48), mat_chair)
    # Desk lamp (emissive bulb on arm)
    cube("EX_LampArm", (0.04, 0.04, 0.55), (4.5, -4.85, 1.05), mat_steel)
    cube("EX_LampBulb", (0.18, 0.18, 0.12), (4.5, -4.7, 1.38), mat_lamp)

def build_lounge():
    mat_fabric2 = add_mat("M_SofaFabric", (0.22, 0.19, 0.16), roughness=0.85)
    mat_stone   = add_mat("M_CoffeeStone", (0.08, 0.075, 0.07), roughness=0.4)
    mat_lamp2   = add_mat("M_FloorLamp", (0.95, 0.88, 0.72), roughness=0.35,
                           emission=(1.0, 0.85, 0.65), emission_strength=0.0)
    mat_steel   = bpy.data.materials["M_Steel"]

    # Sofa (3-seat) centered at (0, 2.2)
    cube("LG_SofaBase", (2.6, 1.0, 0.42), (0.0, 2.2, 0.26), mat_fabric2)
    cube("LG_SofaBack", (2.6, 0.18, 0.55), (0.0, 2.75, 0.62), mat_fabric2)
    cube("LG_SofaArmL", (0.22, 1.0, 0.55), (-1.28, 2.2, 0.47), mat_fabric2)
    cube("LG_SofaArmR", (0.22, 1.0, 0.55), ( 1.28, 2.2, 0.47), mat_fabric2)
    # Coffee table
    cube("LG_CoffeeTop", (1.4, 0.7, 0.05), (0.8, 1.1, 0.45), mat_stone)
    cube("LG_CoffeeLegs", (0.04, 0.62, 0.42), (0.8, 1.1, 0.23), mat_steel)
    # Floor lamp (slim pole + emissive drum)
    cube("LG_LampPole", (0.04, 0.04, 1.7), (2.3, 2.4, 0.85), mat_steel)
    cube("LG_LampDrum", (0.32, 0.32, 0.3),  (2.3, 2.4, 1.8),  mat_lamp2)

build_exec()
build_lounge()
```

- [ ] **Step 2: Execute and screenshot-verify**

- [ ] **Step 3: Commit**

```bash
git add blender/build_office.py
git commit -m "build(office): add executive and lounge zones"
```

---

## Task 10: Blender — empties (camera waypoints, hotspots, sun target) + skyline plane + wall sconces

**Files:**
- Modify: `blender/build_office.py` (append)

- [ ] **Step 1: Append empties + skyline + sconces**

Append:

```python
def add_empty(name, location):
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=location)
    ob = bpy.context.active_object
    ob.name = name
    return ob

def add_waypoints():
    for i, (pos, look) in enumerate(WAYPOINTS):
        add_empty(f"WP_{i}",      pos)
        add_empty(f"WP_{i}_LOOK", look)

def add_hotspot_anchors():
    for name, pos in HOTSPOT_ANCHORS.items():
        add_empty(name, pos)

def add_sun_target():
    add_empty("SUN_TARGET", (0, 0, 0))

def add_skyline_plane():
    mat_sky = add_mat("M_SkylineBackdrop", (0.55, 0.42, 0.38), roughness=0.9,
                      emission=(0.9, 0.72, 0.55), emission_strength=1.0)
    cube("SKYLINE", (80.0, 0.05, 22.0), (0.0, -42.0, 11.0), mat_sky)

def add_wall_sconces():
    mat_sconce = add_mat("M_Sconce", (0.85, 0.7, 0.5), roughness=0.3,
                         emission=(1.0, 0.82, 0.6), emission_strength=0.0)
    for x in [-8.0, -4.0, 0.0, 4.0, 8.0]:
        cube(f"SCONCE_N_{x:.1f}", (0.25, 0.1, 0.35), (x, FLOOR_D/2 - 0.2, 2.3), mat_sconce)

add_waypoints()
add_hotspot_anchors()
add_sun_target()
add_skyline_plane()
add_wall_sconces()
```

- [ ] **Step 2: Execute via MCP**

- [ ] **Step 3: Verify named objects**

Run via MCP: `print([o.name for o in bpy.data.objects if o.name.startswith(('WP_','HS_','SUN_','SKYLINE','SCONCE_'))])`. Confirm all 5 WP_, 5 WP_*_LOOK, 5 HS_*, 1 SUN_TARGET, 1 SKYLINE, 5 SCONCE_ are listed.

- [ ] **Step 4: Commit**

```bash
git add blender/build_office.py
git commit -m "build(office): add empties, skyline plane, wall sconces"
```

---

## Task 11: Blender — export glb + poster render

**Files:**
- Modify: `blender/build_office.py` (append)
- Create: `public/assets/office/scene.glb`
- Create: `public/assets/office/poster.jpg`

- [ ] **Step 1: Author export routine**

Append:

```python
def export_glb():
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_materials='EXPORT',
        export_image_format='AUTO',
        export_extras=True,  # exports custom properties + Empty names
    )

def render_poster():
    # Configure Cycles for single golden-hour poster
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 128
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 82
    scene.render.filepath = POSTER_PATH

    # Simple camera at W0
    pos, look = WAYPOINTS[0]
    cam_data = bpy.data.cameras.new("POSTER_CAM")
    cam_data.lens = 35
    cam = bpy.data.objects.new("POSTER_CAM", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = pos
    direction = (look[0]-pos[0], look[1]-pos[1], look[2]-pos[2])
    import mathutils
    rot = mathutils.Vector(direction).to_track_quat('-Z', 'Y').to_euler()
    cam.rotation_euler = rot
    scene.camera = cam

    # Golden-hour sun
    sun_data = bpy.data.lights.new("POSTER_SUN", type='SUN')
    sun_data.energy = 4.0
    sun_data.color  = (1.0, 0.76, 0.52)
    sun = bpy.data.objects.new("POSTER_SUN", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(55), 0, math.radians(35))

    bpy.ops.render.render(write_still=True)

export_glb()
render_poster()
```

- [ ] **Step 2: Execute via MCP**

Expected tool result mentions `scene.glb` and `poster.jpg` written. Cycles render at 128 samples at 1080p takes a few minutes.

- [ ] **Step 3: Verify files exist and sizes are sane**

Run locally:

```bash
ls -la Y:/AimTechAI/public/assets/office/
```

Expect: `scene.glb` present (expect 0.5–3 MB before compression), `poster.jpg` present (~300–700 KB).

- [ ] **Step 4: Commit assets and final script**

```bash
git add blender/build_office.py public/assets/office/scene.glb public/assets/office/poster.jpg
git commit -m "build(office): export scene.glb and poster.jpg"
```

---

## Task 12: Acquire + convert 4 HDRIs to KTX2

**Files:**
- Create: `public/assets/office/hdri-golden.ktx2`
- Create: `public/assets/office/hdri-blue.ktx2`
- Create: `public/assets/office/hdri-dusk.ktx2`
- Create: `public/assets/office/hdri-night.ktx2`
- Create: `blender/fetch_hdris.py` (small helper)

- [ ] **Step 1: Verify basisu availability; install if missing**

Run: `basisu -version`. If not found, install via npm: `npm i -g @khronosgroup/ktx-software` (provides `toktx`) or `pip install basis-universal`. Prefer `toktx` (KTX-Software). Expected: version prints.

- [ ] **Step 2: Download 4 HDRIs via PolyHaven MCP**

Use `mcp__blender__download_polyhaven_asset` four times. Asset IDs (selected for LA-hills warm-to-night arc; swap if a preview looks off):

- `spruit_sunrise` (golden — warm low sun)
- `kloppenheim_06_puresky` (blue — mid-day to bluing)
- `kiara_1_dawn` (dusk — deep blue with warm horizon; will be flipped)
- `dikhololo_night` (night — dark with distant lights)

Each call:

```
mcp__blender__download_polyhaven_asset asset_id=<id> asset_type=hdris resolution=2k file_format=exr
```

Destination is Blender's asset cache. Locate files via `bpy.data.images` or the `file_path` returned by the tool.

- [ ] **Step 3: Create fetch_hdris.py to copy them to a staging folder**

Create `blender/fetch_hdris.py`:

```python
"""Copy the four downloaded PolyHaven HDRIs to a staging dir for KTX2 conversion."""
import shutil, os, bpy

STAGE = r"Y:\AimTechAI\build\hdri_stage"
os.makedirs(STAGE, exist_ok=True)

MAP = {
    'spruit_sunrise':        'hdri-golden.exr',
    'kloppenheim_06_puresky':'hdri-blue.exr',
    'kiara_1_dawn':          'hdri-dusk.exr',
    'dikhololo_night':       'hdri-night.exr',
}

for img in bpy.data.images:
    for key, out in MAP.items():
        if key in img.name.lower() and img.filepath:
            src = bpy.path.abspath(img.filepath)
            dst = os.path.join(STAGE, out)
            shutil.copy2(src, dst)
            print("copied", src, "->", dst)
```

Run via MCP.

- [ ] **Step 4: Convert EXR → KTX2 using toktx**

From the shell in `Y:\AimTechAI`:

```bash
mkdir -p public/assets/office
for f in golden blue dusk night; do
  toktx --t2 --encode uastc --uastc_quality 2 --zcmp 18 \
    public/assets/office/hdri-$f.ktx2 \
    build/hdri_stage/hdri-$f.exr
done
```

Expected: 4 `.ktx2` files, each ~1–4 MB.

- [ ] **Step 5: Commit**

```bash
git add blender/fetch_hdris.py public/assets/office/hdri-*.ktx2
git commit -m "build(office): fetch PolyHaven HDRIs and encode to KTX2"
```

---

## Task 13: `blender-bg.js` — scene loader and static render

Bring up Three.js with one HDRI, load the glb, place camera at W0, render one frame. No scroll driving yet.

**Files:**
- Create: `public/js/blender-bg.js`

- [ ] **Step 1: Create skeleton that loads glb + first HDRI + renders statically**

Create `public/js/blender-bg.js`:

```js
import { createScrollSpring }    from '/js/blender-bg/scroll-spring.js';
import { createCameraSpline }    from '/js/blender-bg/camera-spline.js';
import { dayNightAt }            from '/js/blender-bg/day-night.js';
import { HOTSPOTS, hotspotState } from '/js/blender-bg/hotspots.js';

const BASE = '/assets/office';
const THREE_URL  = 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';
const GLTF_URL   = 'https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/loaders/GLTFLoader.js';
const DRACO_URL  = 'https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/loaders/DRACOLoader.js';
const KTX2_URL   = 'https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/loaders/KTX2Loader.js';
const MESHOPT_URL= 'https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/libs/meshopt_decoder.module.js';
const RGBELOAD_URL='https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/loaders/RGBELoader.js';
const BLOOM_URL  = 'https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/postprocessing/UnrealBloomPass.js';
const RENDERPASS_URL='https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/postprocessing/RenderPass.js';
const COMPOSER_URL='https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/postprocessing/EffectComposer.js';

export async function initBlenderBackground() {
  if (document.getElementById('blender-bg')) return;

  const THREE    = await import(THREE_URL);
  const { GLTFLoader }  = await import(GLTF_URL);
  const { DRACOLoader } = await import(DRACO_URL);
  const { KTX2Loader }  = await import(KTX2_URL);
  const { MeshoptDecoder } = await import(MESHOPT_URL);

  const container = document.createElement('div');
  container.id = 'blender-bg';
  container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;pointer-events:none;';
  document.body.prepend(container);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 200);

  const ktx2 = new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/libs/basis/').detectSupport(renderer);
  const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.163.0/examples/jsm/libs/draco/');
  const gltfLoader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

  const gltf = await gltfLoader.loadAsync(`${BASE}/scene.glb`);
  scene.add(gltf.scene);

  // Extract named empties
  const empties = {};
  gltf.scene.traverse(o => { if (/^(WP_|HS_|SUN_|SKYLINE)/.test(o.name)) empties[o.name] = o; });

  // Initial env from golden HDRI only (as KTX2)
  const envTex = await ktx2.loadAsync(`${BASE}/hdri-golden.ktx2`);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = envTex;
  scene.background  = envTex;

  // Place camera at W0
  const wp0 = empties.WP_0, wp0l = empties.WP_0_LOOK;
  if (wp0 && wp0l) {
    camera.position.copy(wp0.position);
    camera.lookAt(wp0l.position);
  }

  renderer.render(scene, camera);
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  });

  return { renderer, scene, camera, empties, THREE };
}
```

- [ ] **Step 2: Verify load manually**

Start local server: `cd Y:/AimTechAI && node server.js` (assuming existing server) and open `http://localhost:<port>/?bg=blender`. In console: `await import('/js/blender-bg.js').then(m => m.initBlenderBackground())`. Confirm the office appears with golden HDRI environment.

- [ ] **Step 3: Commit**

```bash
git add public/js/blender-bg.js
git commit -m "feat(bg): blender-bg loader renders glb with KTX2 env, waypoint 0"
```

---

## Task 14: Wire scroll → camera + lighting driver

**Files:**
- Modify: `public/js/blender-bg.js`

- [ ] **Step 1: Add HDRI preload for all 4, switch scene.environment pair via blend uniform**

Modify `public/js/blender-bg.js` — after the single-HDRI setup, replace `scene.environment = envTex; scene.background = envTex;` with a loader for all 4 HDRIs and a custom background shader that blends two. Replace from the line `const envTex = ...` through `scene.background = envTex;` with:

```js
  const hdriKeys = ['golden', 'blue', 'dusk', 'night'];
  const hdris = {};
  await Promise.all(hdriKeys.map(async k => {
    const tex = await ktx2.loadAsync(`${BASE}/hdri-${k}.ktx2`);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    hdris[k] = tex;
  }));
  // Use PMREM for IBL; two separate PMREM textures per frame, blended via env intensity split
  const pmrem = new THREE.PMREMGenerator(renderer);
  const pmremTex = {};
  for (const k of hdriKeys) pmremTex[k] = pmrem.fromEquirectangular(hdris[k]).texture;
  scene.environment = pmremTex.golden;
  // Background: simple equirect shader with 2-texture blend
  scene.background = null;
  const bgGeom = new THREE.SphereGeometry(100, 48, 32);
  const bgMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      texA: { value: hdris.golden }, texB: { value: hdris.golden }, blend: { value: 0 },
      exposure: { value: 1.0 },
    },
    vertexShader: `varying vec3 vWorld; void main(){ vWorld = normalize((modelMatrix*vec4(position,1.0)).xyz); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vWorld;
      uniform sampler2D texA, texB;
      uniform float blend, exposure;
      vec2 eq(vec3 d){ float u = atan(d.z,d.x)/6.2831853+0.5; float v = acos(clamp(d.y,-1.,1.))/3.1415927; return vec2(u, 1.0-v); }
      void main(){
        vec3 a = texture2D(texA, eq(vWorld)).rgb;
        vec3 b = texture2D(texB, eq(vWorld)).rgb;
        vec3 c = mix(a, b, blend) * exposure;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const bgSphere = new THREE.Mesh(bgGeom, bgMat);
  bgSphere.frustumCulled = false;
  scene.add(bgSphere);
```

- [ ] **Step 2: Add directional sun + ambient hemi + lamp material registry**

Append before the camera-placement block:

```js
  const sun = new THREE.DirectionalLight(0xffb070, 3.5);
  sun.position.set(10, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x181420, 0.35);
  scene.add(hemi);

  // Register emissive materials to drive per-frame
  const lampMats = [];
  gltf.scene.traverse(o => {
    if (o.isMesh && o.material && o.material.name && /Pendant|Sconce|Lamp|LogoGlow/.test(o.material.name)) {
      lampMats.push(o.material);
    }
  });
```

- [ ] **Step 3: Add scroll spring + camera spline + per-frame driver + rAF loop**

Append at end (replacing the single `renderer.render` line):

```js
  const waypoints = [0,1,2,3,4].map(i => ({
    pos:  empties[`WP_${i}`]?.position.toArray(),
    look: empties[`WP_${i}_LOOK`]?.position.toArray(),
  }));
  const spline = createCameraSpline(waypoints);
  const spring = createScrollSpring(0, { damping: 0.12, clamp: true });
  let last = performance.now(), running = true;

  function pRaw() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    return Math.max(0, Math.min(1, scrollY / max));
  }

  function frame(now) {
    const dt = now - last; last = now;
    spring.target = pRaw();
    spring.tick(dt);
    const p = spring.value;

    // Camera
    const cam = spline.at(p);
    camera.position.fromArray(cam.position);
    camera.lookAt(...cam.lookAt);

    // Day/night
    const s = dayNightAt(p);
    scene.environment = pmremTex[s.hdriB]; // IBL uses the "target" state for highlights
    bgMat.uniforms.texA.value = hdris[s.hdriA];
    bgMat.uniforms.texB.value = hdris[s.hdriB];
    bgMat.uniforms.blend.value = s.blend;
    bgMat.uniforms.exposure.value = s.exposure * 0.9;
    renderer.toneMappingExposure = s.exposure;
    const rad = s.sunElevationDeg * Math.PI / 180;
    sun.position.set(Math.cos(rad) * 18, Math.sin(rad) * 18, 6);
    sun.intensity = s.sunIntensity;
    sun.color.setHex(s.sunColorHex);
    // Fog
    scene.fog = new THREE.FogExp2(s.fogColorHex, p < 0.5 ? 0.006 : 0.012);
    // Lamps
    for (const m of lampMats) {
      if (m && m.emissiveIntensity !== undefined) m.emissiveIntensity = s.lampStrength;
    }

    renderer.render(scene, camera);
    if (running) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });
```

- [ ] **Step 2 (verify): Manual scroll test**

Reload `/?bg=blender`. Scroll slowly from top to bottom. Expected:
- Camera glides through waypoints without jitter.
- Sky visibly shifts golden → blue → dusk → night.
- Interior surfaces darken gradually; lamp emissives glow up as scroll progresses.

- [ ] **Step 3: Commit**

```bash
git add public/js/blender-bg.js
git commit -m "feat(bg): scroll-driven camera spline and day-night transitions"
```

---

## Task 15: Hotspot DOM sync + card UI

**Files:**
- Create: `public/js/blender-bg/hotspot-dom.js`
- Create: `public/css/blender-bg.css`
- Modify: `public/js/blender-bg.js` (wire into frame loop)
- Modify: `public/index.html` (import css)

- [ ] **Step 1: Create DOM layer**

Create `public/js/blender-bg/hotspot-dom.js`:

```js
import { HOTSPOTS, hotspotState } from '/js/blender-bg/hotspots.js';

export function createHotspotLayer(THREE, container, empties) {
  const layer = document.createElement('div');
  layer.className = 'blender-bg-hotspots';
  container.appendChild(layer);
  let cardEl = null;

  const items = HOTSPOTS.map(hs => {
    const btn = document.createElement('button');
    btn.className = 'hs-ring';
    btn.type = 'button';
    btn.tabIndex = -1;
    btn.setAttribute('aria-label', hs.title);
    btn.dataset.hotspot = hs.id;
    btn.addEventListener('click', () => openCard(hs, btn));
    layer.appendChild(btn);
    return { hs, el: btn, anchor: empties[hs.anchor] };
  });

  function openCard(hs, sourceEl) {
    closeCard();
    const card = document.createElement('div');
    card.className = 'hs-card open';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-labelledby', `hs-title-${hs.id}`);
    card.innerHTML = `
      <h3 id="hs-title-${hs.id}">${hs.title}</h3>
      <p>${hs.blurb}</p>
      <a href="${hs.href}" class="hs-learn">Learn more →</a>
      <button class="hs-close" aria-label="Close">×</button>`;
    card.querySelector('.hs-close').addEventListener('click', closeCard);
    card.addEventListener('click', e => e.stopPropagation());
    document.body.appendChild(card);
    cardEl = card;
    const rect = sourceEl.getBoundingClientRect();
    card.style.left = `${Math.min(innerWidth - 340, Math.max(16, rect.left + rect.width + 8))}px`;
    card.style.top  = `${Math.max(16, rect.top)}px`;
    const esc = e => { if (e.key === 'Escape') closeCard(); };
    addEventListener('keydown', esc, { once: true });
    const docClick = e => { if (!card.contains(e.target)) closeCard(); };
    setTimeout(() => addEventListener('click', docClick, { once: true }), 0);
    function closeCard() { if (cardEl) { cardEl.remove(); cardEl = null; } }
    card._closeCard = closeCard;
  }
  function closeCard() { if (cardEl) { cardEl.remove(); cardEl = null; } }

  const vec = new THREE.Vector3();
  const ray = new THREE.Raycaster();

  function update(p, camera, scene) {
    const meshes = [];
    scene.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const it of items) {
      if (!it.anchor) { it.el.style.opacity = 0; continue; }
      vec.copy(it.anchor.position);
      const world = vec.clone();
      vec.project(camera);
      const onScreen = vec.z > -1 && vec.z < 1 && Math.abs(vec.x) < 1 && Math.abs(vec.y) < 1;
      const ndcX = (vec.x * 0.5 + 0.5) * innerWidth;
      const ndcY = (-vec.y * 0.5 + 0.5) * innerHeight;
      const dist = camera.position.distanceTo(world);

      // Occlusion
      ray.set(camera.position, world.clone().sub(camera.position).normalize());
      const hits = ray.intersectObjects(meshes, false);
      const occluded = hits.length > 0 && hits[0].distance + 0.05 < dist && hits[0].object !== it.anchor;

      const state = hotspotState(it.hs, p, { onScreen, ndcX, ndcY, distanceToCamera: dist, occluded });
      it.el.style.opacity = state.opacity.toFixed(3);
      it.el.style.pointerEvents = state.visible ? 'auto' : 'none';
      it.el.tabIndex = state.visible ? 0 : -1;
      it.el.style.transform = `translate(${ndcX}px, ${ndcY}px) translate(-50%, -50%)`;
    }
  }

  return { update, closeCard };
}
```

- [ ] **Step 2: Create CSS**

Create `public/css/blender-bg.css`:

```css
.blender-bg-hotspots { position:fixed; inset:0; z-index:2; pointer-events:none; }
.blender-bg-hotspots .hs-ring {
  position:absolute; left:0; top:0;
  width:22px; height:22px; border-radius:50%;
  border:2px solid rgba(255,220,180,.85);
  background:radial-gradient(circle, rgba(255,220,180,.25) 0%, rgba(255,220,180,0) 70%);
  box-shadow:0 0 12px rgba(255,210,160,.45);
  cursor:pointer;
  transition:opacity .18s ease, transform .18s ease, box-shadow .18s ease;
  pointer-events:none;
  animation:hs-pulse 3s ease-in-out infinite;
}
.blender-bg-hotspots .hs-ring:hover { box-shadow:0 0 22px rgba(255,220,180,.9); transform: translate(var(--x,0),var(--y,0)) translate(-50%,-50%) scale(1.15); }
.blender-bg-hotspots .hs-ring:focus-visible { outline:2px solid #fff; outline-offset:3px; }
@keyframes hs-pulse { 0%,100% { box-shadow:0 0 10px rgba(255,210,160,.35); } 50% { box-shadow:0 0 22px rgba(255,220,180,.85); } }

.hs-card {
  position:fixed; z-index:3; width:320px; padding:20px 22px 18px;
  background:rgba(14,12,18,.78); backdrop-filter:blur(18px) saturate(1.2);
  -webkit-backdrop-filter:blur(18px) saturate(1.2);
  border:1px solid rgba(255,220,180,.18);
  border-radius:14px; color:#ece6dd;
  font-family: 'Outfit', sans-serif;
  box-shadow:0 20px 60px rgba(0,0,0,.55);
  animation:hs-in .22s ease both;
}
@keyframes hs-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
.hs-card h3 { margin:0 0 6px; font-size:18px; font-weight:600; background:linear-gradient(90deg,#ffd39a,#f0b676); -webkit-background-clip:text; background-clip:text; color:transparent; }
.hs-card p { margin:0 0 14px; font-size:14px; color:#cbc0b3; line-height:1.45; }
.hs-card .hs-learn { font-size:13px; color:#ffd39a; text-decoration:none; border-bottom:1px dotted rgba(255,211,154,.5); padding-bottom:1px; }
.hs-card .hs-learn:hover { border-bottom-style:solid; }
.hs-card .hs-close { position:absolute; top:8px; right:10px; background:none; border:none; color:#9b8f80; font-size:20px; line-height:1; cursor:pointer; }
.hs-card .hs-close:hover { color:#fff; }

@media (prefers-reduced-motion: reduce) {
  .blender-bg-hotspots .hs-ring { animation:none; transition:none; }
  .hs-card { animation:none; }
}
```

- [ ] **Step 3: Import CSS and hook hotspots into frame loop**

Modify `public/index.html` — add inside `<head>` after the existing styles link:

```html
<link rel="stylesheet" href="/css/blender-bg.css">
```

Modify `public/js/blender-bg.js`:

Add to the imports block at top:

```js
import { createHotspotLayer } from '/js/blender-bg/hotspot-dom.js';
```

After the `empties` extraction, add:

```js
  const hotspotLayer = createHotspotLayer(THREE, container, empties);
```

Inside the `frame` function, after `renderer.render(...)`, add:

```js
    hotspotLayer.update(p, camera, scene);
```

- [ ] **Step 4: Verify manually**

Reload `/?bg=blender`. Scroll to p≈0.1 — expect AI Development hotspot to fade in near the reception logo wall. Hover/click opens a card with title + blurb + link. Esc or outside click dismisses. Test keyboard Tab → Enter on a visible ring.

- [ ] **Step 5: Commit**

```bash
git add public/js/blender-bg/hotspot-dom.js public/css/blender-bg.css public/js/blender-bg.js public/index.html
git commit -m "feat(bg): hotspot DOM layer with projection, occlusion, card UI"
```

---

## Task 16: Feature-flag integration + fallbacks

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/blender-bg.js` (fallback branches)

- [ ] **Step 1: Replace the import/init block in index.html**

In `public/index.html`, locate the block starting `<script type="module">` (around line 413) and replace its contents with:

```html
<script type="module">
  import { initUI }     from '/js/ui.js';
  import { initRouter } from '/js/router.js';
  import { initSounds } from '/js/sounds.js';
  import { shouldUseBlenderBackground } from '/js/blender-bg/feature-flag.js';

  const useBlender = shouldUseBlenderBackground();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchOrNarrow = matchMedia('(max-width: 767px), (pointer: coarse)').matches;

  async function boot() {
    if (useBlender && !isTouchOrNarrow) {
      try {
        const m = await import('/js/blender-bg.js');
        await m.initBlenderBackground({ reducedMotion: reduce });
      } catch (err) {
        console.warn('[blender-bg] load failed, falling back:', err);
        const m = await import('/js/office-bg.js');
        await m.initOfficeBackground();
      }
    } else if (useBlender && isTouchOrNarrow) {
      // Mobile poster fallback
      const poster = document.createElement('img');
      poster.src = '/assets/office/poster.jpg';
      poster.alt = '';
      poster.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:cover;z-index:0;';
      document.body.prepend(poster);
    } else {
      const m = await import('/js/office-bg.js');
      await m.initOfficeBackground();
    }
  }
  boot();
  initUI();
  initRouter();
  initSounds();
</script>
```

- [ ] **Step 2: Support reducedMotion in blender-bg.js**

In `public/js/blender-bg.js`, change the exported signature:

```js
export async function initBlenderBackground({ reducedMotion = false } = {}) {
```

Before the rAF start (`requestAnimationFrame(frame)`), add:

```js
  if (reducedMotion) {
    // Freeze at W0; one render, update hotspots once; skip rAF.
    const cam = spline.at(0);
    camera.position.fromArray(cam.position);
    camera.lookAt(...cam.lookAt);
    const s = dayNightAt(0);
    bgMat.uniforms.texA.value = hdris[s.hdriA];
    bgMat.uniforms.texB.value = hdris[s.hdriB];
    bgMat.uniforms.blend.value = 0;
    renderer.toneMappingExposure = s.exposure;
    renderer.render(scene, camera);
    hotspotLayer.update(0, camera, scene);
    return;
  }
```

Wrap the dynamic WebGL2-required setup in a try/catch around `new THREE.WebGLRenderer(...)`, and on failure throw with a specific message so the `catch` in `index.html` triggers the office-bg.js fallback.

- [ ] **Step 3: Verify fallback matrix manually**

Open in order:

1. `/` (no flag) — expect existing `office-bg.js` behaviour unchanged.
2. `/?bg=blender` on desktop — expect Blender walkthrough.
3. `/?bg=blender` with DevTools device-mode phone — expect static poster image.
4. `/?bg=blender` with DevTools throttle → block `scene.glb` → expect `office-bg.js` fallback after error.
5. `/?bg=blender` with OS reduced-motion — expect frozen W0 render, hotspots functional.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/js/blender-bg.js
git commit -m "feat(bg): feature-flag integration + reduced-motion / mobile / error fallbacks"
```

---

## Task 17: Performance pass — instancing, texture budget, frame budget verify

**Files:**
- Modify: `blender/build_office.py` (instancing pass)
- Modify: `public/js/blender-bg.js` (shadow + post-fx tune)

- [ ] **Step 1: Convert repeated meshes to instances in the glb**

Use `gltf-transform` CLI (install: `npm i -g @gltf-transform/cli`).

From `Y:\AimTechAI`:

```bash
gltf-transform inspect public/assets/office/scene.glb
gltf-transform instance public/assets/office/scene.glb public/assets/office/scene.glb
gltf-transform dedup public/assets/office/scene.glb public/assets/office/scene.glb
gltf-transform meshopt public/assets/office/scene.glb public/assets/office/scene.glb
gltf-transform draco public/assets/office/scene.glb public/assets/office/scene.glb --method edgebreaker
```

Expected: glb shrinks by 40–70%. Re-run `inspect` and record before/after sizes.

- [ ] **Step 2: Verify runtime still works after compression**

Reload `/?bg=blender`; confirm scene still renders identically.

- [ ] **Step 3: Tighten shadow budget + verify FPS**

In `public/js/blender-bg.js`, change shadow setup:

```js
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Only a subset of meshes receive shadows
  gltf.scene.traverse(o => {
    if (o.isMesh) {
      o.castShadow    = /FLOOR|WALL_|SOFA|DESK|CHAIR|GLASS/.test(o.name) ? false : true;
      o.receiveShadow = /FLOOR|SOFA|EX_Desk/.test(o.name);
    }
  });
```

- [ ] **Step 4: Record frame times**

In DevTools → Performance, record a 5 s scroll at 1080p on the `?bg=blender` page. Confirm average frame < 16 ms and no layout thrash. If over budget, reduce `pixelRatio` to `Math.min(devicePixelRatio, 1.5)`.

- [ ] **Step 5: Commit**

```bash
git add public/assets/office/scene.glb public/js/blender-bg.js
git commit -m "perf(bg): instance+compress glb, tune shadow budget"
```

---

## Task 18: Cross-browser + a11y verification pass

**Files:** none (verification only, but may produce minor fixes)

- [ ] **Step 1: Desktop matrix**

Test `/?bg=blender` on: Chrome latest, Firefox latest, Safari latest (macOS if available). Confirm: render correct, scroll smooth, hotspots clickable, day-night visible, no console errors.

- [ ] **Step 2: Mobile matrix**

Test on physical iOS Safari + Android Chrome. Confirm: poster image displayed, hotspots (on poster) functional, no layout shift.

- [ ] **Step 3: Keyboard + screen-reader spot checks**

- Tab cycles through the first active hotspot ring; Enter opens its card; Esc closes.
- NVDA/VoiceOver announces each ring by aria-label and each card by its heading.

- [ ] **Step 4: Lighthouse check**

Run Lighthouse on `http://localhost:<port>/?bg=blender`. Confirm Performance ≥ 80 desktop, Accessibility ≥ 95, no serious violations.

- [ ] **Step 5: Fix any findings inline**

Address any concrete issue discovered; commit separately with message `fix(bg): <finding>`.

- [ ] **Step 6: Final commit (if any fixes)**

```bash
git commit -am "test(bg): verified cross-browser + a11y"
```

---

## Task 19: Flip the default (optional gate — do not run until user approval)

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Confirm user wants the new background default**

Do not execute this task without explicit user sign-off after Task 18.

- [ ] **Step 2: Invert default**

In `public/index.html` boot block, change:

```js
const useBlender = shouldUseBlenderBackground();
```

to:

```js
const useBlender = shouldUseBlenderBackground({ defaultOn: true });
```

And in `public/js/blender-bg/feature-flag.js`, extend:

```js
export function shouldUseBlenderBackground({ defaultOn = false } = {}) {
  const q = new URLSearchParams(location.search).get('bg');
  if (q === 'blender') return true;
  if (q === 'office')  return false;
  const stored = localStorage.getItem('bg');
  if (stored === 'blender') return true;
  if (stored === 'office')  return false;
  return defaultOn;
}
```

Update `tests/blender-bg/feature-flag.test.js` to cover `defaultOn` — add:

```js
it('respects defaultOn when no flag set', () => {
  expect(shouldUseBlenderBackground({ defaultOn: true })).toBe(true);
});
it('query param overrides defaultOn', () => {
  history.replaceState(null, '', '/?bg=office');
  expect(shouldUseBlenderBackground({ defaultOn: true })).toBe(false);
});
```

Run `npm test` — expect green.

- [ ] **Step 3: Commit**

```bash
git add public/index.html public/js/blender-bg/feature-flag.js tests/blender-bg/feature-flag.test.js
git commit -m "feat(bg): promote blender-bg to default, office-bg as fallback"
```

---

## Self-review notes (already applied)

- Spec requirement "day-to-night transition smooth and cinematic" — covered by Tasks 4, 14.
- Spec requirement "HDRI plus realistic sun/sky lighting" — covered by Tasks 12, 14.
- Spec requirement "PBR materials" — covered by Task 6 (Principled BSDF with roughness/metallic).
- Spec requirement "elegant interactive hotspots" with 5 service pages — covered by Tasks 5, 15.
- Spec requirement "feature flag / safe rollback" — covered by Tasks 1, 16, 19.
- Spec requirement "mobile + reduced-motion fallback" — covered by Task 16.
- Spec requirement "build reproducibility via `build_office.py`" — covered by Tasks 6–11.
- Spec requirement "poster fallback image from W0" — covered by Task 11.
- No placeholders, type names are consistent (`createCameraSpline`, `hotspotState`, `dayNightAt`, `shouldUseBlenderBackground` used identically everywhere).
- Scope: single project, single plan, no decomposition needed.
