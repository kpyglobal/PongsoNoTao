# Asset manifest: 8-direction player sheets

Generated 2026-11-14 by `scripts/octo/build.py` (renderer `scripts/octo/diag.py`):

```
cd scripts/octo && OCTO_ONLY=<keys> /usr/bin/python3 build.py walk8 ride8 canoe8
```

Leaving out `OCTO_ONLY` builds all 8 keys. The default `build.py` run (`walk ride canoe`) does not write these sheets.
Only the playable characters have them. NPCs and passers-by stay 4-direction. All existing `*_sheet.png` files are unchanged.

Keys (8):
- `player`, `player_f`, `player_visitor`, `player_visitor_f`
- Outfits: `player_trad`, `player_f_trad`, `player_visitor_acc`, `player_visitor_f_acc`

All files are in `public/assets/sprites/characters/`.

| Sheet | File | Size | Frame | Rows |
|---|---|---|---|---|
| Walk + idle | `<key>_8dir_sheet.png` | 256×1536 | 64×96, 4 columns | 16 |
| Scooter | `ride_<key>_8dir_sheet.png` | 384×768 | 96×96, 4 columns | 8 |
| Canoe (tatala) | `canoe_<key>_8dir_sheet.png` | 512×768 | 128×96, 4 columns | 8 |
| Modern sea kayak | `canoe_modern_<key>_8dir_sheet.png` (+ 4-dir `canoe_modern_<key>_sheet.png`, 512×384) | 512×768 | 128×96, 4 columns | 8 |

The base sheet is an exact prefix of each 8dir sheet: the top half matches `<key>_sheet.png`, `ride_<key>_sheet.png` or `canoe_<key>_sheet.png` pixel for pixel. A loader can switch to an 8dir sheet with no other change and add the diagonal rows after it.

Directions: sw = down-left, nw = up-left, ne = up-right, se = down-right (screen space, s = toward the camera).

## `<key>_8dir_sheet.png` row order (4 frames per row, same timing as the base sheet)

| Row | Content |
|---|---|
| 0–3 | walk s, w, n, e (same as base) |
| 4–7 | idle s, w, n, e: rest, inhale, blink, rest (same as base) |
| 8 | walk sw |
| 9 | walk nw |
| 10 | walk ne |
| 11 | walk se |
| 12 | idle sw: rest, inhale, blink, rest |
| 13 | idle nw: rest, inhale, rest, rest (back view, no blink, like base n) |
| 14 | idle ne: rest, inhale, rest, rest |
| 15 | idle se: rest, inhale, blink, rest |

## `ride_<key>_8dir_sheet.png` / `canoe_<key>_8dir_sheet.png` row order (4 frames per row)

| Row | Content |
|---|---|
| 0–3 | s, w, n, e (same as base) |
| 4 | sw |
| 5 | nw |
| 6 | ne |
| 7 | se |

## How the diagonals are drawn

- Walk: the front or back view is turned about 45°. The head leads, and the far half is foreshortened. The near foot sits about 1 px lower.
- Ride and canoe: the side view is seen at 45°. Its length is about 80%, and the front end sits lower (sw) or higher (nw).
- ne and se are mirrors of nw and sw, the same way e mirrors w in the base sheets.
- Palette, outline, shading, glasses (both travellers) and outfits come from the same `cast.py` entries as the base sheets.
- Review sheet: `screenshots-cast/player-8dir.png` (`scripts/octo/contact_8dir.py`).
