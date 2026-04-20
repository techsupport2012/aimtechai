# CSFUND Ready-Made Scene Integration — Multi-Session Plan

**Status:** ❌ **Abandoned for good after four consecutive export failures on Blender 5.1.1.** Shipped a Sketchfab-furniture alternative instead at commit `6314435`.

**Source asset:** `Y:\AimTechAI\public\models\blended\13.blend` (1.3 GB, 3,828 objects, 448 textures, zero lights, originally branded for 中证基金 / CSFUND plus SILBER WELL).

**Goal:** Replace the current textured-primitive `public/assets/office/scene.glb` (1.9 MB, commit `07be31c`) with a de-branded, culled, decimated variant of the CSFUND office floor — glb ≤ 5 MB, no visible third-party trademarks, runtime works unchanged.

---

## Session 1 — ✅ Completed 2026-04-16

- World HDRI strength boosted to 15× so interior previews are visible.
- Scene AABB measured: X −16 to +16, Y −16 to +16, Z 0 to 5.7; actual building ~18 × 10 × 3.4 m, originates at Y ≈ +1.5 to +9.5 (not centered on origin).
- 20-view branding audit (5 viewpoints × 4 compass dirs) at eye height.
- Findings:
  - No CSFUND logos visible from interior viewpoints after last session's 61-object delete cleared the lobby area.
  - **New brand discovered:** "SILBER WELL" wall-sign visible from workspace/lounge looking south. Deleted the 3D-letter cluster; aggressive south-wall sign/decor cull (-29 objects) removed it and any neighbors.
- Output: `Y:\AimTechAI\public\models\blended\13-debrand.blend` (515 MB with packed textures, 3,735 objects).

## Session 2 — ⚠️ Partial

- 5 waypoint + 5 hotspot Empties placed and verified by render (all 5 waypoints show real office content after two iterations to correct coordinate assumptions about building origin).
- Cone-based visibility cull: dropped 3,735 → 3,107 (−627 meshes outside any waypoint's 80° cone).
- Building-bounds cull (X ∉ [−13, +8], Y ∉ [+0.5, +10.5], Z ∉ [−0.2, +3.6]): 3,107 → 2,269.
- Trivial-small cull (max dim < 5 cm): 2,269 → 2,133 → 1,976 after >5k-tri drop.
- High-polygon drop (>2k tris deleted outright, no decimate): 1,976 → 1,845.
- Output: `Y:\AimTechAI\public\models\blended\13-culled.blend` (150 MB, 1,845 meshes, de-branded, waypoints placed).

## Session 3 / 3b — ❌ Failed to export (4 attempts)

Five consecutive export attempts, all beat the pipeline:

1. **Attempt 1:** `export_apply=True` with 468 pending Decimate modifiers. Blender MCP addon's TCP socket dropped after 15 min of silent work; no glb produced.
2. **Attempt 2:** Decimate modifiers swapped for outright mesh deletion, export with `export_apply=False`. MCP socket dropped a second time on the texture-downsize + export combo.
3. **Attempt 3 (manual via Blender UI):** Blender 5.1.1 **segfaulted during glTF export** in `BKE_image_save_options_init` inside the embedded-texture JPEG encoder. Traceback:
   ```
   _encode_temp_image → rna_Image_save → BKE_image_save_options_init → NULL deref
   ```
   Root cause: in-place `img.scale()` calls in the pre-export pass orphaned some image filepaths. The exporter's `__encode_from_image` path then tries to re-save the image to disk before JPEG-embedding and hits a null filepath. A Blender bug in the exception path, triggered by our workflow.
4. **Attempt 4 (retry with image-sanitization fix):** Removed 321 `.001`/`.002` ghost duplicate images with `has_data=False`; scaled 26 survivors without re-packing; called exporter with `image_format='AUTO'`. Blender remained responsive, memory held stable at ~3 GB, but after 8+ min the exporter silently wrote nothing — no crash log, no glb on disk, BlenderMCP socket stayed dead throughout. Either the exporter hung on the first textured mesh or silently aborted without surfacing any error. User restarted Blender.
5. **Attempt 5 (hardened pipeline — purge bad TEX_IMAGE nodes + disconnect Principled-BSDF Normal inputs on all 128 materials + save 13-clean.blend):** Sanitize pass got through cleanly (297 more ghost images removed on second pass, 24 Normal inputs disconnected, saved 13-clean.blend at 36.8 MB). Export started, ran silently for ~4 min, then Blender process silently crashed and restarted (PID changed, memory dropped 2.8GB → 1GB). No glb written, no crash log surfaced, no error in the Info panel. The scene is genuinely exporter-hostile in Blender 5.1.1 even with aggressive normal-map bypass.

## Lessons

- **MCP addon timeouts** on long operations (30+s). The addon's socket closes even while Blender keeps working. This blocks any reliable long-running export, texture scan, or decimate-apply via MCP.
- **Blender's glTF exporter is fragile** with modified images that don't have writable backing files. Either save-as-disk every scaled image (slow, but safe) or never in-place-scale — re-bake textures with `bpy.ops.image.save_as` to a temp dir first.
- **The source asset is genuinely adversarial** — no lights, 448 textures most of which are 2K+ concrete/wood/brand surfaces, 3,828 meshes many with > 20k tris each, plus non-separable branded geometry.

## Resolution — shipped Sketchfab furniture instead (commit `6314435`)

Final working pipeline after abandoning CSFUND:

1. Regenerate the committed primitive room shell via `blender/build_office.py` (textured walls + beveled cube placeholders for furniture).
2. Via BlenderMCP Sketchfab integration, import 5 CC-BY furniture pieces directly into the scene:
   - thethieme *Office Chair Modern* (1,234 faces) — exec chair + 4 workspace-chair instances
   - Raffey *Grey Sofa* (76k faces) — lounge
   - zeerkad sculptural white+wood coffee table (1,668 faces)
   - edudias *Pendente Mantra 30500* linear LED bar (10k faces) — 2 instances over workspace
   - byegdesign *Modern Tripod Floor Lamp* (42k faces) — lounge
3. Delete the primitive furniture; position imports at the existing `WP_*` / `HS_*` coordinates.
4. Export glb **unmodified** (don't touch images at all) → 51 MB.
5. `gltf-transform optimize` CLI externally: dedup + instance + palette + flatten + join + weld + simplify + prune + WebP texture compression at 1024 max + meshopt → **1.11 MB**.

This pipeline completely sidesteps Blender's image-save crash path because textures are never modified in Blender — all compression happens in `gltf-transform` after export. Attribution: 5 Sketchfab CC-BY authors (add to /legal when convenient).

## If you ever want to retry CSFUND

The asset is uniquely broken in Blender 5.1.1 — 321 ghost duplicate image datablocks plus something else hangs the exporter indefinitely. Worth trying again only on:

- A newer Blender (5.2+ / 6.x) where the exporter bug may be fixed.
- A clean re-import of the FBX (`13.fbx`, 665 MB) rather than the converted `.blend` — the ghost duplicates entered through some prior import/edit session and a fresh import might skip them.
- Alternative extractors: `assimp`-based converters or `gltfpack` on the FBX directly, bypassing Blender entirely.

## Do-not-touch invariants

- `public/js/blender-bg.js` + helpers expect `WP_0..WP_4`, `WP_*_LOOK`, and `HS_{AI,Cloud,Consulting,UIUX,QA}` named Empties in the glb.
- `export_yup=True` required so the runtime's Y-up convention holds.
- `public/assets/office/scene.glb` currently serves commit `6314435` (primitive room shell + Sketchfab CC-BY furniture, 1.11 MB). The earlier pure-primitive version is at `07be31c` and can be regenerated via `blender/build_office.py` at any time.

## Artefacts preserved (not committed — large files)

- `Y:\AimTechAI\public\models\blended\13.blend` — original source, 1.3 GB
- `Y:\AimTechAI\public\models\blended\13-debrand.blend` — Session 1 output, 515 MB, brand-safe
- `Y:\AimTechAI\public\models\blended\13-culled.blend` — Session 2 output, 150 MB, ready to export once the image-save crash is worked around
