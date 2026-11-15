# Arrival intro (2.5D painted layers)

The 搭飛機／搭船 opening is made of hand-painted layers moved with parallax, not a 3D scene.
Code: `src/intro/introScene.ts`. Digital Painter's layers live in `art-ref/arrival/layers25d/` (not shipped).

## Choreography

1. Behind the title, party and 搭飛機／搭船 menus: only Lanyu — sky, sea and the real island — from the **same
   starting angle** for both routes, with a slow gentle drift. (The plane set's sky / sea / `03_lanyu.png` are
   reused; no extra assets.)
2. **搭飛機:** the camera pulls back to reveal the cabin window frame and the wing. The plane bobs while the
   island loads (logo, title music, lower-left loading bar). After the logo fades, the camera keeps pulling
   back, then the whole plane banks and turns toward the island, and the shot fades out.
3. **搭船:** the camera pulls back to reveal the bow deck. It loops a gentle pitch with cycling spray while
   loading. After the logo fades, the yacht drives forward out of frame (the bow slides and scales away,
   leaving the open sea and the island), then the shot fades out.
4. Both routes fade into the notebook on the quest-log page. **抵達蘭嶼** (Q01) is an auto-completed arrival
   entry in the log — not a playable quest — and animates to completed. The notebook closes, and the game
   starts at the route's start (蘭嶼機場 / 開元港) with the scooter-rental guidance as before.

Old saves skip the opening. The intro scene is disposed (all textures freed) before the notebook opens.

## Swapping in layers (one command)

1. Put the layers in `art-ref/arrival/layers25d/plane/` and `art-ref/arrival/layers25d/yacht/` (PNG with alpha).
2. Run `/workspace/pld_venv/bin/python scripts/art/build-intro25d.py`.
3. `npm run build`, then `node scripts/test-intro.mjs`.

The script uses a mode's folder as soon as it has images; otherwise it uses the keyframe cut-outs
(`scripts/art/cut-intro-placeholders.py` → `art-ref/arrival/placeholder25d/`). It writes WebP files and
`public/assets/intro25d/intro25d.json`, prints every size and the total (aim: under about 1.5 MB). Plates are
capped at 2048 px wide; other layers are cropped to what they cover. The two routes share the menu vista, so
those layers are not shipped twice.

As of 15 Nov 2026 both sets are Digital Painter's final layers. The island is the real Lanyu skyline at **1.5×
vertical exaggeration** (Larry's pick). Digital Painter promoted the plates to the canonical names
`plane/03_lanyu.png` (top y≈492) and `yacht/01_lanyu.png` (top y≈436); the earlier `_x1.5` / `_x2` / true-height /
keyframe-alt files live in `/workspace/tmp_arrival/archive_layers25d/` and are not used. The shipped WebP keeps the
canonical name. The build script still accepts a `_x1.5` filename if it reappears. The cabin window frame is included
so the camera can pull back to reveal it.

## layers.json (optional, per mode folder)

See `scripts/art/intro25d-plane.json` and `intro25d-yacht.json` for the live lists (parallax, horizon, sun,
frame overscan, overlay anchors). Yacht `05_sea_mist` is drawn after `02_sea_far` and before `03_sea_mid` (the
file number is out of order on purpose).
