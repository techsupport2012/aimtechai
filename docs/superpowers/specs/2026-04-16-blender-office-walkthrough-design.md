# Blender Office Walkthrough Background — Design

**Date:** 2026-04-16
**Project:** AIM Tech AI website (`Y:\AimTechAI`)
**Scope:** Upgrade the index.html background from the existing procedural Three.js office (`public/js/office-bg.js`) to a Blender-authored, live-rendered, scroll-driven cinematic walkthrough with day-to-night lighting and service-mapped hotspots.

---

## 1. Goals

- Background of `index.html` feels like moving through a luxurious, believable modern office as the user scrolls.
- Scene, materials, lighting, and camera choreography originate in Blender; browser runtime uses Three.js to render the exported assets live (no pre-rendered video/frame sequence).
- Gradual golden-hour → dusk → night lighting transition synced to scroll.
- Elegant interactive hotspots anchored to meaningful 3D objects, each mapped to one existing service page.
- Integrates cleanly into the existing site without breaking the current background implementation; rollback is trivial.

## 2. Non-goals

- Film-grade Cycles realism (explicitly deferred by choosing Option C hybrid).
- Multi-room VR-style navigation (scroll-only, single linear camera path).
- Editing existing site content, navigation, or copy outside the background integration points.
- Server-side rendering of the 3D scene.

## 3. Approach (Option C — Hybrid)

Blender builds the scene and exports static PBR assets (glTF + HDRIs). The browser loads these once and renders them live in Three.js, driving camera, lighting, and hotspots from scroll position.

```
Blender (MCP scripting)
  ├─ Build multi-zone floor: reception → open workspace → exec office → lounge
  ├─ PBR materials via PolyHaven textures; selected Sketchfab/PolyHaven furniture
  ├─ Named Empties: 5 camera waypoints, 5 hotspot anchors, 1 sun target
  └─ Export: scene.glb (Draco/Meshopt), 4 HDRIs (golden/blue/dusk/night, 2K KTX2), 1 poster.jpg

Browser (new blender-bg.js; replaces office-bg.js behind a feature flag)
  ├─ Load glb + first HDRI; lazy-load remaining HDRIs as scroll approaches them
  ├─ Catmull-Rom camera spline over waypoints
  ├─ Scroll progress p drives: camera t, 2-HDRI blend, sun, lamp emissive, exposure, fog, bloom
  ├─ 5 hotspots rendered as projected HTML, activated by scroll range + occlusion
  └─ Fallbacks: reduced-motion / mobile / WebGL failure → static poster
```

## 4. Scene layout

Single floor, approx 24 m × 12 m. South wall is floor-to-ceiling glass facing the LA hills. North wall is walnut slats with wall sconces.

Zones (west → east along camera path):

1. **Reception** — marble floor, backlit logo wall, low seating
2. **Open workspace** — walnut desks with brushed-metal legs, pendant cluster
3. **Executive office** — glass partition, exec desk facing window, leather chair, desk lamp
4. **Lounge / meeting** — premium fabric sofa, coffee table, sculptural floor lamp

## 5. Camera choreography

Catmull-Rom spline through 5 waypoints, eye height ~1.65 m. Per-segment ease-in-out (cubic) so motion feels stabilized-rig, never linear.

| Waypoint | Scroll p | Content section | Beat | Lighting state |
|---|---|---|---|---|
| W0 | 0.00 | Hero | Reception entry, wide 35 mm, low angle | Golden hour |
| W1 | 0.25 | About | Dolly through workspace, lateral drift left | Late golden |
| W2 | 0.50 | Services | Exec office threshold, pan right to window | Blue hour onset |
| W3 | 0.75 | Values | Lounge retreat, lower angle, warm lamps blooming | Dusk |
| W4 | 1.00 | Contact | Sofa foreground, window dominant, hills lit | Night |

## 6. Lighting & day-to-night

Four HDRIs from PolyHaven (chosen at build time for LA-hills coherence), each processed to KTX2. Two are active at any time and blended per segment.

| Scroll p range | State | HDRI A → B | Blend |
|---|---|---|---|
| 0.00–0.25 | Golden hour | golden → golden | 0 |
| 0.25–0.50 | Late golden → blue | golden → blue | 0→1 |
| 0.50–0.75 | Blue → dusk | blue → dusk | 0→1 |
| 0.75–1.00 | Dusk → night | dusk → night | 0→1 |

Per-frame driven from p:

- **Environment**: custom shader samples two PMREMGenerator-processed HDRIs and mixes by `blend`.
- **Sun** (DirectionalLight): elevation 55° → -8°, color warm amber → magenta → indigo, intensity 3.5 → 0.15. Soft shadows on floor + exec desk only (single shadow camera).
- **Interior lamps**: per-fixture emissive strength 0.0 (day) → 3.5 (night). Ceiling pendants, floor lamp, wall sconces, exec desk lamp.
- **Tone mapping**: ACESFilmic; exposure 1.0 → 1.25.
- **Fog**: exponential, warm haze → cool blue → deep indigo.
- **Bloom** (UnrealBloomPass): threshold low, strength 0.3 → 0.9.

Outside view: HDRI provides sky; a large skyline plane ~60 m out (PolyHaven LA-hills-like photo) tinted by the time-of-day curve adds parallax behind the glass.

## 7. Hotspots

Five hotspots, one per existing service page. Anchored to Empties in the glb by name.

| # | Anchor Empty | Title | Blurb | Link | Scroll range |
|---|---|---|---|---|---|
| 1 | `HS_AI` | AI Development | Custom AI systems, LLM integrations, computer vision. | `/ai` | 0.00–0.22 |
| 2 | `HS_Cloud` | Cloud | Scalable cloud architecture and DevOps. | `/cloud` | 0.18–0.44 |
| 3 | `HS_Consulting` | Consulting | Strategy, architecture review, technical due diligence. | `/consulting` | 0.42–0.66 |
| 4 | `HS_UIUX` | UI / UX | Interface design systems and product experience. | `/ui-ux` | 0.60–0.86 |
| 5 | `HS_QA` | Quality Assurance | Automated testing, release engineering, observability. | `/qa` | 0.80–1.00 |

Rendering: absolute-positioned HTML elements, not 3D billboards. Each frame:

1. Project anchor world position → NDC → CSS transform.
2. Raycast camera → anchor; if first hit is not the anchor, fade out.
3. Opacity = active_in_range × on_screen × not_occluded × proximity_falloff.

Interactions:

- Idle: 2 px glow ring, 3 s pulse.
- Hover (desktop): ring expands, title preview appears.
- Click / tap: glass-morphism card opens (320 px, title + blurb + "Learn more →"). Esc or outside click dismisses.
- Keyboard: focusable when active (`tabindex=0`), Enter/Space opens, focus ring visible.
- A11y: `role="button"` + `aria-label` on ring; card is `role="dialog"`, `aria-modal="false"`.

## 8. Scroll driver

```
p_raw   = clamp(scrollY / (docHeight − viewportHeight), 0, 1)
p_render = critically-damped spring toward p_raw (damping 0.12, no deps)
```

Single rAF applies `p_render` to camera, HDRI blend, sun, lamps, tone mapping, fog, bloom, and hotspot visibility. Rendering pauses on `visibilitychange` hidden.

## 9. Feature flag

```js
const useBlender =
  new URLSearchParams(location.search).get('bg') === 'blender' ||
  localStorage.getItem('bg') === 'blender';
if (useBlender) await initBlenderBackground();
else           await initOfficeBackground();
```

Default remains `office-bg.js` until we promote. Flipping the default is a single-line change; the existing file stays untouched.

## 10. Performance budget

| Target | Desktop | Mobile |
|---|---|---|
| Scene tris | ≤ 250 k | — (poster) |
| Texture memory (GPU) | ≤ 80 MB | — |
| Initial transfer (gz) | ≤ 8 MB (glb + first HDRI) | ≤ 400 KB (poster jpg) |
| Frame budget | 16 ms @ 1080p | — |
| Added TTI on index | < 150 ms (lazy after `load`) | 0 |

Techniques: Draco geometry + KTX2 BasisU textures + Meshopt; instancing for repeated furniture; two HDRIs resident at a time; single shadow-casting light; Bloom the only post-FX (AO baked into textures).

## 11. Fallbacks

- `prefers-reduced-motion` → freeze at W0 golden-hour frame; hotspots remain functional at static projected positions.
- Mobile (< 768 px or touch-only) → static poster `<img>` rendered from W0 by Blender at build time; hotspots overlay the poster via pre-computed 2D positions.
- WebGL2 missing or glb/HDRI fetch failure → poster fallback; if flag is set but assets missing, fall back to `office-bg.js` after 2 s with a console warning.

## 12. File plan

New:

- `public/js/blender-bg.js` — loader, scroll driver, render loop.
- `public/js/blender-bg-hotspots.js` — hotspot DOM sync and card UI.
- `public/css/blender-bg.css` — ring, card, and focus styles (uses existing `--font-*` tokens).
- `public/assets/office/scene.glb`
- `public/assets/office/hdri-{golden,blue,dusk,night}.ktx2`
- `public/assets/office/poster.jpg`
- `blender/build_office.py` — reproducible Blender build script (idempotent, parameterized).

Modified:

- `public/index.html` — add feature-flag check and conditional import of `blender-bg.js`.

Untouched:

- `public/js/office-bg.js` — remains the default background.

## 13. Build reproducibility

`blender/build_office.py` is the source of truth. Running it end-to-end from an empty Blender scene produces the full asset set (`scene.glb`, 4 HDRIs copied/converted to KTX2, poster.jpg). Parameters — material palette, HDRI choices, camera waypoints, hotspot anchor positions — are defined at the top of the file.

## 14. Open questions / deferred

- Exact PolyHaven HDRI names for LA-hills coherence — picked during build.
- Specific furniture assets from Sketchfab/PolyHaven — picked during build; swap freely if one is low quality.
- Whether to bake AO maps per-object or use a single lightmap pass — decided during build based on visual result.
- Analytics wiring on hotspot interaction — stub `data-hotspot` attribute in markup, actual tracking out of scope.
