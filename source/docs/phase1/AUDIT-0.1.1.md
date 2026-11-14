# 0.1.1 audit (2026-11-14)

Scope: everything changed since the v0.1.0 release (commit b062e76; compared against a fresh clone of
`source/` in kpyglobal/PongsoNoTao). Changed code: `src/entities/billboard.ts`, `src/world/{layout,height,
collision,island,populate,buildings,places,shade,textures}.ts`, `src/core/{game,state,save,assets}.ts`,
`src/ui/dom.ts`, `src/styles/app.css`, `public/data/places.json`, test scripts. Art (party sheets, portraits)
came from the art worker and was not reviewed line by line here; it is covered by the visual checks.

## Findings and fixes

| # | Area | Finding | Fix |
|---|------|---------|-----|
| A1 | Save migration (real bug) | Old saves are moved with `findSafeStand` on load. Checked every spot a 0.1.0 player could stand on (2 795 spots on a 1 m grid, flood-filled from the spawn and all fast-travel points of the 0.1.0 world): **17 landed in a thin gap between two buildings** (4 places in village house rows): standable, but cut off from the island. | `findSafeStand` now looks for a roomy spot first (1 m clear disc, both radii checked so a wide circle cannot pass over water at a dock edge), then falls back to the old search. Result: 0 stranded. `check-roads.mjs` now runs this test on every build (fixture `scripts/dev/fixtures/v010-spots.json`). |
| A2 | Save migration | Old 外國 (intl) traveller saves: `travelerFrom` was still a live field that was always forced to `'tw'`. | Field, type, parameters and the `setTraveler` debug hook removed; old saves still load (field ignored, same-gender traveller, old per-outfit dive photos fold into one per spot) and the field is no longer written back. `test-audit.mjs` checks both. |
| A3 | Save migration | Saved positions in the sea / under the new quay / inside moved buildings. | Covered by A1 (player and followers both go through `findSafeStand`); fast travel (環島傳送) is always available as a further escape. |
| A4 | Visual regression | Moving village lantern posts and fish racks to the seaward road edge put 2 posts and 3 racks inside a 涼亭 / modern building (椰油, 野銀, 漁人). Posts are decoration only (no collider). | `freeEdgeU()` slides each post / rack along the road edge until it clears every footprint and stands on dry ground; one 椰油 rack has no room and is left out. |
| A5 | Performance | The new building-placement resolver ran at module load in ~250 ms (desktop Node; more on phones), mostly sampling road distance 81× per candidate box. | Candidate list built once; road-clearance test returns early using the box centre distance (exact same yes/no). Same 66 buildings, same positions (hash checked), ~90 ms. Height grid / road distance per sample: 16 road segments vs 19 in 0.1.0, no runtime cost. |
| A6 | Dead code | `scooterTex()` (scooter is drawn in the ride sheets), `CharacterSheet`, `SAVE_VERSION`, `FOOT` alias of `FOOTPRINT`, ~45 lines of CSS for the pre-notebook quest log and the removed 臺灣本島／外國 chips, the in-game guide links. | Removed. `tsc --noUnusedLocals` clean; ts-prune only lists exports used by the road audit. |
| A7 | Correctness | Facing: `dirFromRelative` mapping swap applies to player walk / scooter / tatala, followers and NPCs (one shared function). | Verified by `test-walkout.mjs` (default + rotated camera, scooter, tatala). |
| A8 | Correctness | Quest places (`yayo_shop`, `yayo_school`) now read the same resolved buildings as the world (`ALL_STRUCTURES`), not a second unresolved layout. | OK; all 140 quest / NPC / POI targets reachable (`check-roads`). |
| A9 | Informational | The resolver leaves out 3 buildings with no clear lot: one 椰油 modern house, one 野銀 涼亭, one 漁人 makarang. | Reported by `check-roads.mjs`; acceptable for a prototype. |
| A10 | Informational | Harbour spawn moved ~0.6 m (findSafeStand now prefers open ground); still on the dock, walk-out test passes. | — |

No issues found in: billboard `dir` bookkeeping, road embankment / quay height shaping (no pits or terraces
touched: guarded by `pit === 0`), plant clearing near roads, guide removal (guide still builds to `guide.html`).

## Checks after the fixes

See "# 0.1.1 release" R3/R4 in PROGRESS.md for the run log.
