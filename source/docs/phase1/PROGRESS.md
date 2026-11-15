# Phase 1 batch 1 progress (party switch + quest engine + autosave)
- [x] canvas saved: docs/phase1/plan-canvas.txt, prose: plan-prose.txt, quests-raw.json (116)
- [x] backup: /workspace/tao-rpg-backup-phase1 (pre-phase1 source)
## Design decisions (batch 1)
- Party = 族男(player) + 族女(player_f) + traveller (from x gender). Origin screen: pick 家鄉部落 (host family village) + traveller.
- Start at 開元港 (boat) for all; Q01 completes after the 文化聲明 dialogue.
- Switch = Player swaps outfit/position with a follower; followers trail the leader (breadcrumbs), ride when leader rides.
- Seasons: 飛魚季 = meyvanwa|rayon|manoyotoyon chips; non-fishing = off. Tide placeholder: low tide at dawn & dusk.
- New NPCs reuse existing sheets/portraits: elder_iraraley/iranmeylek/iratay, teacher_yayo, rental_owner, shop_yayo.
- Scooter gated behind Q02 (debug setScooter bypasses).
- Files: scripts/build-quests.mjs -> public/data/quests.json; src/quests/*; src/entities/party.ts; src/core/save.ts
- [x] scripts/build-quests.mjs + scripts/quests/{rules,playable}.mjs -> public/data/quests.json (116; 28 playable)
- [x] src/quests/{types,engine}.ts, src/entities/party.ts, src/core/save.ts, input keys (1/2/3, C, L)
- [ ] content: npcs.json (+6 NPCs), dialogues idle nodes, glossary (akokey, wawa, kalang), ui.json origin text, content.ts DATA_FILES quests
- [ ] dom.ts: party bar, tracker, tide, quest tab, origin screen (home + traveller), continue button
- [ ] game.ts integration
- [ ] css, build, verify-phase1 script, screenshots, zip
- [x] content data (npcs +6, dialogues idle, glossary +3, ui help rows), content.ts registers quests
- [x] dom.ts: origin screen (home + traveller), continue, party bar, tide pill, tracker, quest tab renderQuests
- [x] game.ts integration (party switch, quest talk/spot/photo, tao hints + teacher translation, markers, tracker, autosave/resume, scooter gate) — tsc + build OK (19:xx)
- [ ] verify-phase1 + screenshots + zip
- [x] verify-phase1 (puppeteer-core harness; Playwright not installed) desktop + mobile ok, 0 console errors → screenshots-phase1/, report-phase1.json
- Fixes from verify: time/season change now refreshes quest ctx at once (tide / night gates); a runnable side step at the same NPC still toasts the main-quest role hint; follower stuck timer (1.6 s blocked → hop onto trail); quest log sorts tracked → playable → main/side/photo.
- [ ] zip
## Open questions for Larry
- Tide is a placeholder (low tide at dawn/dusk); season is island-wide.
- Placeholder NPCs reuse existing sheets/portraits (族語老師 uses the young local portrait).
- No 跟隨/待命/前往 command menu yet (Phase 2).
- Sacred-place photos P05/P07/P18 and all non-playable quests are placeholders (unlock correctly, cannot complete).
## Steering: crisper ground at closest zoom (added to batch 1)
- terrain shader: camera-distance-faded micro detail (new 128px `terrainFine()` texture, grass/sand/basalt channels, ~3 tiles/m) + mild unsharp of the painted map vs. its mip 2; only inside ~19–34 m of the camera (dynamic branch), so wide shots cost nothing extra.
- anisotropic filtering: max (16 desktop / 8 mobile) on albedo + detail textures; mipmaps already on (LinearMipmapLinear).
- tilt-shift: at the closest zoom the sharp band widens (+0.08) and blur drops (−0.9), easing back by dist 26.
- mobile tier (`TAO_LITE`): skips the 2 side-projection fetches for rock micro detail.
- A/B: `?groundfx=0` restores the old ground look; `scripts/capture-ground.mjs` (LABEL=before/after) → screenshots-phase1/ground/compare-*.png
- Not done (heavier): higher-res painted albedo / LOD tiles near the player.
- [x] terrain before/after → screenshots-phase1/terrain/ (compare-*.png)
- [x] guide link (圖鑑手札 header + cover) → guide.html in a new tab; 紅頭 romanization unified to Imorod (places.json keeps "Imowrod" only in `aka`)
- [x] smoke-phase1 (puppeteer-core) ok: no console errors, dist/guide.html 200
- [x] zip rebuilt

# Phase 1 batch 1b (underwater + 族人分工 + songs + save export/import) — started 20:20
- canvas saved: docs/phase1/plan-canvas-1b.txt (127 quests); raw: quests-raw.json (+U1–U3, J1–J4, A1–A4; batch1 copy quests-raw.batch1.json)
- backup: /workspace/tao-rpg-backup-phase1b/src-before-1b.tar
## Plan
- data: rules (REQ/HIDDEN/WHEN, fishing `ground`), playable (U1 dive A, U2 coach+dive B, U3 traveller POV set, J1/J2 weaver elder (族女), J3 feed at host home (song 02, kois), R1–R3 + A3 simple taro-field steps so J1/A3 are reachable), songs dict (7, 暫定 + source)
- placeholders kept: A1 (needs T3), A2 (needs M4), A4 / J4 (hidden; no goats / thatch field in the world yet)
- engine: collect set (underwater variants, POV, songs) saved with quests; photos counter = P only
- game: places hen_rock_bay / yayo_dive / dive_shop / host_home / host_taro; dive step → underwater overlay → collect; re-dive at done spots for other members' variants; song card on quest done; met_npc_<id> flag on talk
- ui: dive overlay (composited canvas still), song card (ⓘ source), 手札 tabs 相簿與水下 + 存檔 (export file / code, import file / code, warning)
- [x] data: rules (U/J/A reqs, hidden U3/J4/A4, WHEN, GROUND, SONGS), playable-1b.mjs, build → 127 quests (38 playable); npcs +dive_coach, +weaver_elder; glossary +kois
- [x] engine collect set; types; src/ui/dive.ts (composited stills), src/ui/phase1b.ts (dive overlay, song card, album + save tabs); dom.ts tabs / ground chip / song block; game.ts hooks + methods; css — tsc + build OK (~20:55)
- [ ] verify-phase1b + screenshots + zip
- fix: song card stayed invisible in headless shots (CSS fade frozen at frame 0) → card shows without fade; U3 unlock refreshes immediately after a dive (mobile fail)
- [x] verify-phase1b (puppeteer-core, desktop + mobile) ok: 0 fails, 0 console errors, 0 4xx — screenshots-phase1b/ (desktop-/mobile- 01–10 + report-phase1b.json), 21:16
- [x] build + zip rebuilt (prev: tao-rpg-local.prev-before-phase1b.zip)

# Audit fixes (audits/tao-rpg-phase1-audit.md) + 手札 notebook redesign — started 21:25
- backup: /workspace/tao-rpg-backup-audit/src-before-audit.tar
## A. audit fixes
- [x] M1 runPendingAutoLines() in questFrame replays an `auto` step with lines (Q01 intro) after reload / interruption
- [x] M2 save.ts validateSave() (done/active/savedAt/controlled/pos), saveMeta defensive, showContinue in its own try; import uses validateSave
- [x] M3 QuestEngine.load drops bad / done / negative indexes, clamps out-of-range to last step, clamps respect, clears tracked unless active, filters non-strings / non-numbers
- [x] M4 resume → handleQuestEvents(refresh(), true)
- [x] M5 QuestEngine.onGives (glossary + toast) called in advance(); completeStep no longer reads st.gives
- [x] S1 migrate() + raw backup to tao-rpg:save:backup when a save cannot be read; contentRev stored
- [x] S2 confirm before a new journey replaces a save (cover origin cards)
- [x] S3 begin() resets GameState (keeps lang / clock); failed resume resets state + quests
- [x] S4 fromJSON whitelists period / season / lang / origin
- [x] S5 unknown respect id fails
- [x] S6 build-quests.mjs referential check (fails on broken refs; warns 8 known placeholder flags)
- [x] S7 one-time 無法存檔 toast
- [x] S8 dialogue completion only advances the step that opened it
- [x] S9 Tao hints marked heard in the dialogue's done callback
- [x] S10 follower trail seeded behind the leader
- [x] S11 mobile: near detail 10–20 m, anisotropy 4 on albedo only
- [x] tsc + build OK
- [x] scripts/test-audit.mjs (M1 reload replay, M2 malformed, S1 newer v, M3 clamp, S4 whitelist): all ok, 0 console errors
- [x] B fonts: Iansui 400 (381 KB subset) + Literata 400/600/400i (≈12 KB each) via build-fonts.py; fonts.css; check-fonts skips literata (Latin only)
- [x] B notebook: src/ui/notebook.ts (paged list / detail, flip on mobile), dom.ts journal markup + renderers (6 ribbons; recipes+clinic → 食材與營養; album/save sections become items), CSS spread / binding / ribbons; build OK
- [x] verify-phase1 / verify-phase1b selectors updated for the notebook (filters behind 篩選, paged list walk for hidden quests, U1 detail page, save items); cover clicks wait for visibility; dialogs auto-accepted
- note: headless swiftshader runs the game at ~0.5–2 fps; verify-phase1 I1 tide-pill check now waits for the pill instead of a fixed 900 ms (same on the pre-notebook build)
- [x] screenshots-notebook: before-* (01/03/05/06; no detail view existed) + after-* (01–06) desktop + mobile, seeded journal content; capture 0 console errors
## Underwater stills → Larry's AI illustrations (22:15)
- [x] art-src/underwater/final/*.webp → public/assets/underwater/ (+ thumbs/ 480×270 for the album); dive.ts reduced to an image loader (OUTFIT_WHO map tao_/tw_/intl_ m/f); phase1b.ts showImagePopup (full-screen, caption, ✕ / tap anywhere to close; U3 = 3×2 set); album thumbnails tap → full image; game captions; ❗ first visit unchanged; tsc + build OK
- [x] verify-phase1b: popup file + decode checks per member (u1_tao_f, u1_intl_f / u1_tw_f, u3_01–06, u2_tao_m), album thumbnail → full image → tap closes
## Scope change (Larry, 22:25): one underwater picture per spot, 2 travellers
- [x] public/assets/underwater = u1.webp (from final/u1_tao_f), u2.webp (from final/u2_tao_f), u3_01–03 (+ thumbs/); per-member variants NOT copied
- [x] collect uw:A / uw:B (old uw:A:<outfit> keys migrate in QuestEngine.load; pov:4–6 dropped); POV set = 3; re-dive + its prompt removed
- [x] U3 now unlocks when U1 is done with the traveller there (controlled or within 12 m — the party follows), since the traveller can no longer re-dive
- [x] cover: 臺灣本島／外國／隨機 picker removed → 2 travellers (男 = player_visitor + portrait visitor_m, 女 = player_visitor_f + portrait visitor); travelerFrom always 'tw'; old intl saves load as the same-gender traveller (fromJSON)
- [x] DONE 11:07 PM run: brown-hair traveller portraits (Larry's art) + matching walk/ride/canoe sprites; foreign assets removed from public/
- [x] verify-phase1 / 1b / smoke / test-audit updated (no 來自 clicks; u1 / u2 / u3_01–03 popups; no re-dive prompt; intl-save migration check)
- [x] verify-phase1b (desktop + mobile): ok, 0 fails, 0 console errors, 0 4xx; dive popup shots copied to screenshots-notebook/dive-*.png

### 23:01 — final verify + zip (FINISH ONLY run)
- verify-phase1 (desktop+mobile): ok, 0 fails, 0 console errors, 0 4xx.
- verify-phase1b (desktop+mobile): ok, 0 fails, 0 console errors, 0 4xx.
- test-audit: all ok (M1 replay, M2 malformed+backup, S1, M3 clamp, intl→tw migration + collect migration, S4, no console errors).
- smoke-phase1: ok, errors [].
- dist/assets/underwater: only u1, u2, u3_01–03 (+thumbs).
- Zip rebuilt: /workspace/tao-rpg-local.zip (527 files, 13.1 MB); previous kept as tao-rpg-local.prev-before-notebook.zip. No screenshots/font-samples/art-src.
- Pending (Larry): brown-hair traveller sprites + portraits; foreign assets left in place until then.

## Traveller art run (11:07 PM)
- Step 0: backup → /workspace/tao-rpg-backup-traveller/before-traveller.tar (portraits, sprites, art-src/portraits, key_art.py, octo, src). Confirmed the octo generator reproduces all 28 current sheets byte-for-byte (numpy/scipy added to /tmp/imgvenv). build.py gained OCTO_OUT / OCTO_ONLY so only the two traveller keys get rewritten.
- Step 2 (walk sprites): octo generator gained hair kinds `wavy` (medium-short tousled waves) and `wavylong` (shoulder-length waves; bob under the scooter helmet), a `chestnut` hair colour and a `floral` shirt pattern (body + sleeves). cast.py: player_visitor = no hat, chestnut wavy hair, beige linen shirt (#D8C9A6) over white tee, olive pack, camera, denim-blue shorts (beige shorts vanished against the beige shirt); player_visitor_f = chestnut wavylong, beige bucket hat, cream floral shirt over white tee, olive pack, camera, same jeans. Regenerated all 28 sheets into /tmp and diffed: only the 6 traveller sheets (walk/ride/canoe × m/f) changed; those 6 copied into public/. Same 64×96 layout, frames and 4-tone ramp palette.
- Step 1 (portraits): new approved art saved as art-src/portraits/visitor_m.jpg (male) and visitor.jpg (female) (old green-screen sources are in the backup tar). These are on white, not green, so key_art.py now detects a white border and keys by flood fill (border-connected near-white + small pure-white pockets trapped in the hair), keeping the white tee and notebook pages; then the same crop → 440×560 bottom-centred → WebP q90 as the other portraits. `key_art.py portraits visitor visitor_m` rebuilds only those two (the old run-all mode would also have re-emitted the intl portraits).
- Step 3 (cleanup): src no longer references the 外國 outfits/portraits (PLAYER_OUTFITS = 4 keys; roleOutfit / rolePortrait always use player_visitor[_f] / visitor[_m]). Deleted from public/: portraits/visitor_intl_{m,f}.webp and sprites/characters/{,ride_,canoe_}player_foreign{,_f}_sheet.png (copies in the backup tar; art-src kept). `TravelerFrom` still accepts 'intl' so old saves load; GameState.fromJSON maps them to tw with the same gender (test-audit covers it). Not touched (off-limits): public/guide/data.json still lists the two 外國旅人 and uses its own copies in public/guide/portraits/ (old black-hair visitor art too). scripts/verify-octo.mjs is a legacy script that still clicks #btn-from-intl; not run.
- Step 4a: tsc + build ok (dist has no foreign/intl files). New scripts/capture-traveller.mjs (port 8843): character select, then each traveller in-world with the intro dialogue portrait, desktop + mobile, checks outfit/portrait/preview sheets, console errors and 4xx → screenshots-traveller/.
- Step 4b: capture-traveller run (closer camera on the 2nd run): ok, 0 fails, 0 console errors, 0 4xx. screenshots-traveller/{desktop,mobile}-01-character-select-*, -02/-03-traveller-{m,f}-dialogue, -04/-05-traveller-{m,f}-in-world, plus 06-before-after-sprites-portraits.png.
- Step 4c: verify-phase1b (desktop + mobile): ok, 0 fails, 0 console errors, 0 4xx. test-audit: all ok (incl. old intl save → same-gender traveller).
- Step 5: zip rebuilt → /workspace/tao-rpg-local.zip (512 files, 12.7 MB); previous kept as tao-rpg-local.prev-before-traveller.zip. Only intl leftovers inside are the guide's own copies (public/guide/portraits/visitor_intl_*.webp, off-limits).

## Party art run (11:38 PM) — local only, nothing pushed
- Step 0: backup → /workspace/tao-rpg-backup-party/before-party.tar (portraits, character sheets, guide portraits, art-src/portraits, octo, key_art.py, package.json).
- Step 1a (portraits): traveller portraits regenerated with GenerateImage from the current ones as reference — same face/hair/hat/camera/notebook, olive-green overshirt (female: plain green, no floral). Larry's approved 族男 / 族女 art saved as art-src/portraits/local.jpg / local_f.jpg. All four keyed with the white-bg path (edge alpha floor removed so dark hair has less halo) → public/assets/portraits/{visitor_m,visitor,local,local_f}.webp (440×560).
- Step 1b: HOLD on 族男 / 族女 (Larry wants lighter skin, more Southeast Asian look; new portraits coming). Restored the previous local / local_f portraits and sources from the backup; the first approved-art versions are parked in /workspace/tao-rpg-backup-party/held/.
- Step 1c (traveller sprites): back to the old olive greens (male shirt #788C50, female #7E9356, no floral) over white tees; brown wavy hair and the female bucket hat kept. Male shorts back to beige (#C4AE84) — reads fine against green. Only the 6 traveller sheets regenerated (OCTO_ONLY) and copied.
- Step 2 (族男 / 族女 portraits): Larry's second approved set (lighter golden-tan, more Southeast Asian) → art-src/portraits/local.jpg / local_f.jpg → white-bg key → public/assets/portraits/local.webp / local_f.webp.
- Step 3 (族男 / 族女 sprites): octo gained a `lowtail` hair (low wavy ponytail over the shoulder, red-white-black woven tie), short sleeves (`short`) and a 4×2 px red-white-black `pocket` stripe; new skin tones golden (#E2AB74) / golden_m (#D9A06A) to match the lighter tan. player = thick short black hair (wavy kind in black, no tall spikes), charcoal short-sleeve open shirt over a dark tee, pocket stripe, beads, khaki shorts; player_f = black lowtail, light denim overshirt (#8DAED0) over a white tee, beads, the navy skirt kept. Full regen diffed against public/: only the 6 族男/族女 sheets changed (traveller sheets already installed in step 1c; every NPC identical). PLAYERS no longer lists the 外國 looks, so a full run won't re-emit them.
- Step 4 (guide, explicitly requested this run): public/guide/portraits/local.webp / local_f.webp regenerated the same way as before (trimmed to the figure, 520 px tall); visitor.webp / visitor_m.webp copied from the game portraits (440×560, as before). guide.html / data.json untouched (the 外國旅人 entries are still listed there).
- Step 5a: package.json → 0.1.1. tsc + build ok. New scripts/capture-party.mjs (port 8844): character select, intro dialogue portraits for 族男 / 族女 / traveller, party-bar portraits, outfits, and an in-world close-up while controlling each member; desktop + mobile, both traveller genders → screenshots-party/. screenshots-party/compare.png = portraits + front/side/back/side walk frames, before this run vs after.

# 0.1.1 bugfix
- Step 0: backup → /workspace/tao-rpg-backup-0.1.1/before-0.1.1.tar (whole tree minus node_modules/dist/screenshots/art-src).
- Step 1 (facing): root cause = billboard.ts dirFromRelative had the side rows swapped. facing yaw = atan2(dx,dz) and camYaw = atan2(cam−sprite); moving along camera screen-right (cos c, −sin c) gives rel = +90°, which returned 'w' (sheet row 1, figure faces screen-left). Swapped so +90° → 'e', −90° → 'w'. Same function drives player walk/scooter/canoe, party followers and NPCs (all use atan2(dx,dz)), and it uses the live camera position, so rotated cameras stay correct. Sprite sheets untouched.
- Step 2 (refactor, no behaviour change): derived quest places (shop/school/rental/dive shop/dive spots) and host-family spots moved from game.ts into pure src/world/places.ts (addQuestPlaces / hostPlaces) so the road check resolves the same coordinates as the game.
- Step 5b: capture-party (2nd run moves the party to open ground for the close-ups and hides the unlock toast for the shot): ok — 28 checks, 0 fails, 0 console errors, 0 4xx. screenshots-party/{desktop,mobile}-01-character-select, -02-dialogue-{m,f,tm,tf}, -03-in-world-{m,f,tm,tf}, compare.png, report-party.json. Nothing pushed; the zip was not rebuilt this run.

## Soft knees (12:00 AM) — generator + sheets only, no src/ edits, nothing pushed
- Step 0: backup → /workspace/tao-rpg-backup-knees/before-knees.tar (character sheets + scripts/octo).
- Step 1: cause = thigh and shin were two separate fills, so the second fill drew a dark contour where it met the first (the knee seam / dark pixel cluster), and each segment had its own cylinder shading (a light break at the knee). Fix: new px16 shade kind `limb` (one cylinder along the bent hip→knee→ankle polyline, nearest segment per pixel) and Fig.leg_fill() drawing thigh + shin as ONE mask with that shading, used by both the front/back legs and the side legs (walk, idle, scooter side). Scooter front view: the knees beside the apron lost their outline and use soft shading.
- Shared by everyone, so applied to all: regenerated sheets changed only around the legs (~100–600 px per sheet) for 族男, 族女, both travellers, the scooter sheets, elder, fisher, clinic, harbor, tourist, villager, researcher. Unchanged: farmer (long skirt hides the legs) and every canoe sheet (legs inside the hull). A second full regeneration reproduces the installed sheets byte-for-byte.
- Step 2 (future 換裝): cast.py gained `variant(base, outfit, **overrides)` — an outfit is just a deep-merged parameter set (None removes a key), written as `<base>__<outfit>_sheet.png` (+ ride_/canoe_ for players) and meant to pair with portrait `<portrait>__<outfit>.webp`. No variants registered yet, so output is unchanged.
- Step 3: tsc + build ok (dist sprites match public/). screenshots-party/compare.png = knees before/after (front, side walk ×2, side) for the 4 party members; the earlier portrait comparison moved to screenshots-party/compare-portraits.png.
- Step 3 (road audit tool): scripts/check-roads.mjs bundles scripts/dev/road-audit.ts with esbuild and runs it on the real src/world code + public/data. It rasterises canStand() at 0.25 m, flood-fills from the 開元港 spawn (game.ts startNew: harbor + (1.6, 1.2) → findSafeStand), and asserts: every place / host-family spot (all 6 home villages) / quest spot+photo step (own radius) / NPC schedule waypoint (talk range) / world interactable / landmark is reachable; no solid box or post within 1.5 m of a road centreline; the road centreline is standable and connected; no building in the sea or overlapping another. Prints failures, exits 1. `--png` writes a top-down overlay (road cream = reached, orange = cut off; red = colliders; magenta = unreachable targets; yellow = spawn).
- Step 3a: 0.1.0 result: 319 problems — reached only 866 cells (the dock), 127 targets unreachable, 32 colliders on the road (houses, 涼亭, churches, the clinic, the airport terminal, the plane wing, a harbour lantern), road centreline cut in dozens of places. screenshots-0.1.1/road-map-before.png (0.1.0 tree + 2 read-only export shims, comparison only).
- Step 4 (harbour, bug 1 root cause): the 開元港 apron/pier pads end at x = −35.0 but the natural coast is at x ≈ −30.5; the harbour flatten in height.ts only applied where the natural ground was already land (nat.s > −0.02), so a 4–5 m strip of sea (canStand: below water + margin) sealed the dock on all sides. The party spawns on that dock → could never walk off, on keyboard or joystick. Fix: height.ts HARBOUR_QUAY — a reclaimed quay box (−37.3…−27.9 × −11.9…−0.9, flat 0.75 m in its core, raised only, land mask set so it paints as apron) joining the apron to the shore; harbour spur road (layout.ts HARBOUR_SPUR) from the quay up to the 椰油 seafront road; the middle land-side lantern post (on the spur) dropped (HARBOUR_LANTERN_DZ = [−3.2, 0]).
- Step 5 (roads, bug 3 root cause): the 0.1.0 ring road was a hand-drawn polyline through each village centre, while village layouts put houses at w = −2.6 and 涼亭 at w = +2.6 around that same centre and the flank church/shop/school straddled it; the clinic and airport terminal were placed on it too. Fix (layout.ts): the ring is now generated — through each village along its seafront at local w = ROAD_W (−0.2), extended past the village ends, linked by a few hand-placed waypoints (LINKS / ROAD_EXTEND) — exported as ROADS (ring + harbour spur); height.ts carves/paints from ROADS (distToRing now covers every road). Houses moved 0.8 m inland (ROW0_W 3.6), 涼亭 seaward of the road with 1.6 m clearance, flank buildings set back by their turned footprint; clinic set back inland of the road. A placement resolver slides makarang / 涼亭 / flank buildings outward or away from the road (≤ 6 m) until clear of the road corridor, other buildings (all villages), clinic/terminal/plane boxes, taro terraces, and the sea (涼亭 that would stand in the sea go behind the last house row). Where nothing fits, the generic building is left out: 3 of 69 (椰油 one 'modern', 野銀 one of three 涼亭, 漁人 one makarang). places.ts (yayo_shop / yayo_school) now reads the same resolved ALL_STRUCTURES.
- Step 5a: airport moved 0.8 m east (runway x −28.4, terminal x −24.6, places.json airport x −24.6) and the plane parked beside the terminal (AIRPORT_PLANE local (0.6, 4.6); collider = wing span 2.8) so the west-coast road clears the wing. Coastal road sections run on a low seawall embankment (height.ts ROAD_BANK_H 0.62 within 1.6–2.6 m of the centreline, only over shallow water), so no road section dips into the sea.
- Step 5b: footprints shared: layout.ts FOOTPRINT / CLINIC_FOOT / TERMINAL_FOOT / PLANE_FOOT (collision.ts FOOT = FOOTPRINT; collision builds the same boxes). Trees, palms and rocks skip anything within 2.4 m of a road (island.ts ROAD_PLANT_CLEAR).
- Step 5c: check-roads → OK: road network connected, all 140 targets reachable from the harbour spawn, corridors clear, no building in the sea / overlapping. screenshots-0.1.1/road-map-after.png.
- Step 6 (props): village lantern posts and fish racks moved to the seaward road edge (w = ROAD_W + 1.75), outside the 1.5 m corridor (0.1.0 had several standing in the street).
- Step 7 (tests): new debug hooks facing() (sheet row the controlled sprite shows) and roadFlora(r). New scripts/test-walkout.mjs (port 8851): fresh game → party on the 開元港 dock → steer with real input only (desktop: held arrow keys; mobile: touch drag on #vpad) along quay → spur → 椰油 road; then facing for ←→↑↓ (default camera, rotated 90° / 180° / −45°, scooter, tatala); no tree/palm/bush within 1.5 m of a road. Result: ALL OK — desktop reached the road (roadDist 0.04 m), mobile joystick too (0.03 m); facing e / w / n / s in every case; 0 console errors, 0 4xx. Screenshots → screenshots-0.1.1/{desktop,mobile}-01-harbour-spawn, -02-harbour-exit-on-road, desktop-03-facing-right, -04-facing-left, -05-scooter-facing-right, -06-canoe-facing-right.
- Step 7a: verify-phase1b (desktop + mobile) on this build: EXIT 0, 0 fails, 0 console errors, 0 4xx.
- Step 8: quay painted as concrete apron (island.ts texture: quay mask 0.85) and no beach flowers on it.

# 0.1.1 release
- R0: resumed; verify-phase1 on the step-8-minus build EXIT 0 (rerun at R3 anyway).
- R1 (guide): removed the cover link (#cover-guide) and the notebook link (#journal-guide) + their CSS; src/ and index.html no longer mention the guide. The guide stays a separate static page: public/guide.html + public/guide/ (data, css, js, map, portraits, fonts) → built to dist/guide.html, live path https://kpyglobal.github.io/PongsoNoTao/guide.html (same as v0.1.0; it was never under /guide/guide.html). smoke-phase1 now asserts 0 guide links in the game and that guide.html still loads.
- R2 cleanup (2026-11-14 00:5x CST): 215 files / 37 MB deleted after grepping src/, public/, scripts/, index.html (only package.json pointed at two of them; fixed). Backup: /workspace/tao-rpg-backup-0.1.1/deleted-files.tar (+ deleted-list.txt).
  - public/assets/sprites: CHARACTERS_V3.png, CONTACT_SHEET.png, buildings/, textures/, ui/, old chibi frame dirs characters/{clinic,elder,player,tourist,villager}/, props/* except flying_fish_sheet.png + flora_atlas.webp; public/data/asset_manifest.json (never loaded).
  - generators/tests: scripts/generate_sprites.py (old chibi/buildings generator; flying_fish_sheet.png is now a fixed asset), scripts/legacy/ (chibi + old verifiers), verify-v4.mjs, verify-styleA.mjs, verify-octo.mjs (expects the removed 外國 outfits). package.json: dropped `sprites`, `verify:v4`; `verify` → verify-phase1.mjs.
  - art-src: underwater kept only the 5 shipped finals (u1_tao_f, u2_tao_f, u3_01–03) + their approved raws; dropped other variants, refs, contact sheet; portraits visitor_intl_{f,m}.jpg.
  - fonts-src/NotoSerifTC-Regular.otf (not used by build-fonts.py).
  - dead code: scooterTex(), CharacterSheet, SAVE_VERSION, the travelerFrom field/type/params and the setTraveler debug hook (old saves still load: the field is ignored and no longer written; test-audit checks this), ~45 lines of dead CSS (old quest-card journal, from-pick chips, note-card, card-grid, .panel). Typecheck OK.
- R4 audit (01:0x CST): fresh clone of v0.1.0 `source/` diffed against the tree; full write-up in docs/phase1/AUDIT-0.1.1.md. Fixed: (A1) findSafeStand could move 17 of 2 795 old 0.1.0 standing spots into thin gaps between buildings (cut-off pockets) → roomy-spot-first search, now 0 stranded and check-roads tests it every run (fixture scripts/dev/fixtures/v010-spots.json); (A2) travelerFrom removed, old intl saves still load; (A4) 2 village lantern posts + 3 fish racks stood inside buildings → slid along the road edge (one 椰油 rack left out); (A5) placement resolver 250 → ~90 ms at load, identical output (hash); (A6) dead code (scooterTex, CharacterSheet, SAVE_VERSION, FOOT alias, ~45 lines CSS). Docs: ASSET_MANIFEST / DESIGN_BLUEPRINT no longer list deleted files or the 外國 traveller.
- R3 build + checks on the final tree (build 00:57 CST, after all R2/R4 code changes; tsc re-run 01:30): npm run build OK (typecheck, check-fonts 1010 chars, vite). tsc OK; check-roads OK (140 targets, corridors clear, 2 795 old 0.1.0 spots → 0 stranded); test-walkout ALL OK (desktop keys + mobile joystick, facing ×6); smoke-phase1 OK (no guide links, guide.html 200); test-audit OK (incl. intl save migration); verify-phase1 OK; verify-phase1b OK; capture-party OK. Every run: 0 console errors, 0 4xx.
- R5 README: bilingual repo README with 攻略 / Guide link and 0.1.1 notes (warning + rights lines unchanged); staged from tao-rpg-backup-0.1.1/README-repo-0.1.1.md.
- R6 push (01:3x CST): PR https://github.com/kpyglobal/PongsoNoTao/pull/2 rebase-merged → main 015b155 (tree identical to the staged commit; 257 removed files deleted from the repo, __pycache__ no longer shipped); tag v0.1.1 + pre-release https://github.com/kpyglobal/PongsoNoTao/releases/tag/v0.1.1. Pages built 015b155. Live: game + guide.html 200, 0 console errors, 0 4xx, no guide links (first load right after deploy saw one transient CDN 503, gone on recheck; every dist file curl-checked 200). test-walkout got a LIVE_URL option.
- R6 live walk-out (01:5x CST): LIVE_URL test-walkout against https://kpyglobal.github.io/PongsoNoTao/ ALL OK (desktop keys + mobile joystick walk off the dock, facing ×6, no trees on roads, 0 console errors, 0 4xx).
- R7 backup: /workspace/tao-rpg-backup-0.1.1/tao-rpg-0.1.1-final.tar.gz (whole tree minus node_modules and dist, incl. screenshots / font-samples / art-src, ~0.5 GB).

# NPC cast
(2026-11-14 2 AM task from Larry: portraits + sprites for every key NPC and ambient villagers in all six villages. Resume from the last step below.)
- Step 0: backup of the whole tree (minus node_modules/dist/screenshots/fonts-src) → /workspace/tao-rpg-backup-cast/before-cast.tar.
- Step 1–2: inventory + roster written to docs/phase1/NPC_CAST.md (20 key NPCs incl. 4 new guide-only roles, 6 ambient bases × 3 variants, 18 ambient villagers). Next: portraits (art-src/portraits/<id>.jpg → public/assets/portraits/<id>.webp).
- Step 3a: portraits generated + saved to art-src/portraits: elder_yayo, elder_iraraley, elder_iranmeylek, elder_ivalino, elder_imorod, elder_iratay.
- Step 3b: + villager_taro, weaver_elder, villager_harbor, teacher_yayo, shop_yayo, rental_owner.
- Step 3c: + dive_coach, harbor_staff, nurse_new (replaces nurse src later), clinic_doctor, nutritionist, culture_worker.
- Step 3d: + geologist, researcher, tourist, ambient auntie/uncle/youth_m/youth_f/boy(2nd try; 1st looked teen, discarded)/girl. All portrait sources done.
- Step 3e: keyed 27 portraits -> public/assets/portraits/*.webp (440x560). clinic_doctor + uncle white-key ate the white coat/singlet -> regenerated same image on green, chroma-keyed clean (sources replaced).
- Step 4a: generator features added (fig.py/poses.py): per-entry scale/heads (children), glasses, beard (moustache/goatee/stubble), hair 'bald' + 'pigtails', props paddle/leaves/cloth/net/rope/keys/hammer/radio. Regenerated all 20 existing sheets to /tmp: byte-identical.
- Step 4b: cast.py: 17 key NPC entries + 6 ambient bases + 12 variant() outfits (KEY_NPCS/AMBIENT lists); clinic (nurse: teal scrubs, golden skin), harbor (light-blue shirt, moustache, radio), player_researcher (black lowtail, bucket hat) updated to match their new portraits. Wrote 39 NPC walk sheets to public/assets/sprites/characters (player sheets unchanged).
- Step 5a: npcs.json: 39 NPCs (19 old + doctor/nutritionist/culture_worker/geologist + 16 ambient). Elders keep kind 'elder' + new 'sheet'; other key NPCs kind=<own sheet>; portraits all unique. villager_iranmeylek/villager_iratay (quest K-visit NPCs) re-skinned as ambient adults (uncle__polo / auntie__apron) with their old schedules kept. src: NpcDef.sheet + content check, Assets loads every npcs.json sheet after data (fixed old NPC sheet list removed), fish dialogue portrait fisher->villager_harbor, places.ts derived 'clinic_yard'.
- Step 6: guide data.json npcs: 6 elders (own cards), weaver, canoe fisher, shop, coach, port staff, nurse, researcher, tourist, ambient villagers card added; teacher/culture/geo/doctor/nutrition/farmer/rental now have their own portraits (seals dropped). 22 guide portrait copies (trimmed, 520 tall). Removed obsolete: portraits elder/farmer/fisher/harbor (game+guide+art-src), sheets elder/farmer/fisher/villager + their cast.py entries. Regenerated everything to /tmp: identical to public, sheet set matches 1:1.
- Step 6b: guide Iansui subset rebuilt (old codepoints + guide.html/data.json/guide.js; 17 new glyphs, 224->234 KB, default fontTools options).
- Step 7a: screenshots-cast/key-npcs.png (21 cards: portrait + in-game sprite, Iansui labels) + ambient.png (6 bases x 3 outfits).
- Step 7b: scripts/capture-cast.mjs (port 8845): 39 NPCs spawn, every talkable key NPC opens with its own portrait, village shots yayo/ivalino/imorod (+ lineups) and a key-NPC lineup at 開元港; 0 console errors, 0 4xx.
- Step 8: checks — build+tsc OK, check-roads OK, capture-cast OK, test-walkout ALL OK, smoke-phase1 ok, verify-phase1b 56 ok / exit 0, test-audit all ok when run alone (one M1 timing fail when run in parallel with verify-phase1b: the test waits a fixed 1.5 s after reload; passed on solo rerun). NPC_CAST.md 'As built' section added. DONE (not pushed).

# NPC cast rev

(2026-11-14 09:22 request: female elders + division of labour, recipe keepers, unique faces for the two quest villagers, image optimisation + NPC atlases, guide/contact sheets. ART ONLY: no src/, no quests/recipes data.)

- Step 0: backup /workspace/tao-rpg-backup-castrev/before-castrev.tar.
- Step 1: 6 new portrait sources (art-src/portraits): elder_f_yayo (food, pot+ladle), elder_f_iraraley (yam field, yams in a net bag), elder_f_iranmeylek (shore, straw hat, shells+seaweed bucket), elder_f_iratay (sweet potato/taro field, hairband, basin), villager_iranmeylek (curly hair, olive tee, towel), villager_iratay (woman, short layered hair, coral shirt, tote).
- Step 2: portraits re-keyed from art-src at their max on-screen size. Dialogue portrait is 196 CSS px wide (118 on
  mobile), aspect 440:560 → **330×420 WebP q80 (method 6, alpha kept)**, bottom-centre anchored as before
  (scripts/key_art.py PW/PH/PQ). q chosen by eye on 3 faces at 2× zoom: q78–95 indistinguishable, q70 slightly
  soft, q60 loses wrinkles. Guide copies cut from the same full-res key, trimmed to the figure: NPC cards 360 px
  tall, party / traveller (local, local_f, visitor, visitor_m) 480 px tall. 37 portraits (31 old + 6 new).
  Side-by-side: screenshots-cast/portraits-optimised-vs-original.png (as seen at 196 CSS px @2×, plus 2× face crops).
- Step 3: new sprites (scripts/octo): fig.py hand items pot / yams / bucket / basin + `towel` detail; cast.py
  elder_f_yayo / elder_f_iraraley / elder_f_iranmeylek / elder_f_iratay (golden_d, elder build) and
  villager_iranmeylek (curly hair, olive tee, towel) / villager_iratay (bob, coral shirt, tote). Removed the variants
  uncle__polo / auntie__apron (only the two quest villagers used them): cast lines + sheets deleted. All other 49
  sheets regenerated byte-identical before step 5.
- Step 4: public/data/npcs.json: only villager_iranmeylek / villager_iratay `kind` + `portrait` → own id (text edit,
  nothing else touched). Guide data.json: male elder cards get their role, 4 a akes cards + 2 quest villager cards
  added, 水芋田長輩 / 織布長輩 become 野銀 / 紅頭 a akes, each keeper card names her dish. Guide font
  (public/guide/fonts/iansui.woff2) re-subset for 32 new glyphs (234 → 238 KB). Docs: NPC_CAST.md §5 (village table),
  RECIPE_KEEPERS.md, npcs_additions.json (proposed entries for the 4 a akes, not wired).
- Step 5: sprites losslessly optimised: pyoxipng level 6 + zopfli, safe chunk strip, every sheet decoded and compared
  RGBA-equal to the original (alpha-0 bleed texels included). Note: generate_octo output is now no longer
  byte-equal to public/ — compare decoded pixels, or re-run the optimiser after regenerating.
  Size test (all 55 character sheets): PNG unoptimised 1,475,711 B → PNG oxipng 847,937 B → **WebP lossless
  (exact) 465,100 B**, also pixel-identical. Kept PNG as briefed; WebP lossless is the smallest lossless option if
  the loader accepts it (one-line change in build_atlas.py / the optimiser).
- Step 6: NPC atlases (scripts/octo/build_atlas.py, reads npcs.json read-only): one lossless PNG per village group
  public/assets/sprites/npc_atlas_<group>.png + manifest public/assets/sprites/npc_atlas.json.
  Groups: the six villages + `harbor` (harbor / airport / rental / dive shop outsiders). Non-village homes map via
  PLACE_GROUP (yayo_school, yayo_shop → yayo; clinic, clinic_yard, host_weave → imorod). Sheets are packed
  2 rows high, ≤4 across (768 or 1024 × 1536), so no empty slots. Atlas pixels are verified equal to the sheets.
  The 4 proposed a akes are already packed (yayo / iraraley / iranmeylek / iratay).

  **npc_atlas.json format (for the code worker)**
  ```
  { "version": 1,
    "frame": {"w":64,"h":96},
    "sheet": {"w":256,"h":768,"cols":4,"rows":8,"rows_dir":["s","w","n","e"],"walk_rows":[0,1,2,3],"idle_rows":[4,5,6,7]},
    "filter": "nearest",
    "atlases": { "<group>": {"file":"sprites/npc_atlas_<group>.png","w":768|1024,"h":1536,"bytes":N,
                             "sheets": {"<sheetName>": {"x":X,"y":Y}, ...}} , ...},
    "npcs": { "<npcId>": {"atlas":"<group>","sheet":"<sheetName>"}, ... } }
  ```
  `file` is relative to public/assets/. A frame (col c, row r) of sheet s in atlas g is the pixel rect
  x = sheets[s].x + c*64, y = sheets[s].y + r*96, 64×96 — same layout as the single sheets, so
  makeCharacter only needs an atlas texture + offset (UV offset = x/w, 1 - (y+96)/h for flipY textures,
  repeat = 64/w, 96/h). Lazy loading: load an atlas when the player gets near any NPC in it (group = its home
  village; roamers sit in `harbor`), dispose() it when no NPC of that group is within range; GPU cost per atlas
  4.5 MiB (768 wide) / 6 MiB (1024 wide) vs 0.75 MiB per single sheet. sheet name = def.sheet ?? def.kind, as now.
  After the switch the 43 single NPC sheets in sprites/characters (676,797 B) can be deleted; player / ride /
  canoe sheets stay single.
- Step 7: contact sheets regenerated (scripts/octo/contact_cast.py, contact_elders.py): screenshots-cast/key-npcs.png
  (27 cards, elders paired by village), ambient.png (uncle__polo / auntie__apron gone), elders-by-village.png (new),
  portraits-optimised-vs-original.png. capture-cast (on an isolated copy at /tmp/castrev-wt so the live dist and
  src were untouched): all 39 NPCs spawn, 14 dialogue portraits own, 0 console errors, 0 4xx; check-roads OK; build OK.
  Known: scripts/capture-party.mjs:57 and capture-traveller.mjs:65 assert dialogue portrait naturalWidth === 440;
  they now need 330 (outside this pass's edit scope, left for the code worker).
- Sizes (bytes, before → after): game portraits 1,442,876 (31) → 773,564 (37; the same 31 = 644,328, −55 %);
  guide portraits 1,008,250 (26) → 579,262 (32; same 26 = 476,942, −53 %); character sheets 1,364,506 (51) →
  847,937 (55, lossless); props 353,870 → 353,495. Total 4.17 MB → 2.55 MB (−39 %) with 6 more characters, plus
  the new atlases 694,326 B (which replace 676,797 B of single NPC sheets once the loader switches).

# Party split & recipes

Brief (2026-11-14 9:22 AM, from Larry's pt103u): A 食譜 per village, B 生產類女耆老／漁獵造舟男耆老 分工,
C party split (temporary leave, solo 族男 sea trip, 3-way main-story split + regroup), D NPC streaming + perf,
E debug hooks + TEST_HOOKS.md. No art edits (the other worker owns sprites / portraits / art-src), no push.

- Step 0 (done): backup /workspace/tao-rpg-backup-split/before-split.tar (+ dist-before/). RECIPE_KEEPERS.md and
  npc_atlas.json not there yet → placeholders from the existing cast, adapt when they land.
- Step 1 (done): scripts/perf-mobile.mjs (WebGL texture/renderbuffer byte accounting + frame / rAF CPU time at
  390×844 @2×); baseline on the pre-batch build → perf-before.json.

# Watercolor-ink style

Brief (2026-11-14 10:09): world (terrain, sea, buildings, rocks, trees, props) in watercolor (soft washes, paper
grain) + a bit of ink (dark-brown contours, light hatching only in shadows); target art-src/style-ref/
target_watercolor_ink.jpg. Sprites and UI untouched. New files + minimal marked hooks only (another worker is in
src/). Switchable (風格：水彩／原始), quality tier, debug hook, before/after perf + screenshots in screenshots-style/.
Then: 3 cartoon-restyle test portraits (same designs, watercolor fills + ink lines only), not applied in game.

- Step 0: backup /workspace/tao-rpg-backup-style/before-style.tar.
- Step 1: src/render/stylize.ts (new): StylizePass replaces RenderPass: world without sprites → own target with a
  depth texture; one paint pass (pigment-bleed wobble, soft value bands, edge darkening, paper grain + wash blotches,
  dark-brown contours from depth silhouettes + Laplacian creases, shadow hatching on the high tier) writing the
  world depth back; then the sprites alone (layer 31) on top, depth-tested. Hook: src/core/post.ts, 2 marked lines
  (import + addPass). Toggle row 風格 mounted into the 操作說明 sheet from stylize.ts (no dom.ts edit).

- Step 2: tuning. Sea: the ocean (transparent, no depth write) is made to write depth in the world pass only, so the
  sea floor under it gets no ink and the shoreline gets a contour. Darks lifted (screen) + light paper tint so the
  world reads as translucent washes; first pass was too grey, values pulled back (uLift 0.05, paper 0.12, bands 0.35).
  Quality tier: high = full (pooling + hatching); mobile = no pooling taps, no hatching (contours + wobble + bands +
  paper only). Debug: window.__TAO_STYLE__.set('original'|'watercolor'), .params (uniforms), .pass.cpuMs.
- Step 3: scripts/capture-style.mjs (new): same build, same spot, original vs watercolor shots + rAF frame time,
  desktop 1440×900 and mobile 390×844@2× → screenshots-style/*.png + perf-style.json.
- Step 4 (STYLE TEST, per Larry: one style for everything): restyled portraits (same faces/designs, only colouring +
  ink lines) art-src/portraits/cartoon-test/{local,elder_yayo,visitor}.jpg; u1 restyle art-src/style-test/
  u1_watercolor.jpg; items flying fish / taro / sweet potato: 24 px pixel icons (scripts/octo/item_icons.py →
  art-src/style-test/icon_*.png) + 圖鑑 plates art-src/style-test/item_*.jpg. Sheet: screenshots-style/style-test.png
  (scripts/octo/style_test_sheet.py). Nothing in game replaced; waiting for Larry's approval.
- Step 2 (done): quest data model for party split (types.ts: split / meet / solo / regroup / requires / tasks /
  minigame / canoe, quest giver / abortTo / recipe) + QuestEngine member states (saved; old saves load as "all in
  party"). Design: docs/phase1/PARTY_SPLIT.md.
- Step 3 (done): playable scenarios (scripts/quests/playable-split.mjs): Q07 3-way main-story split + regroup at
  host_home, J1 族女 busy / others bring water, M1 → M2 (auto when the flying-fish season starts) → M3 族男 solo sea
  trip (tatala + fish mini-game, 放棄出海 → abortTo). 分工 givers (rules.mjs GIVER): 女耆老 for taro / food /
  weaving jobs, 男耆老 for fishing / hunting / tatala jobs; each wrapped with 領工作 + 回報 steps at @giver.
- Step 4 (done): 食譜 (scripts/quests/recipes.mjs → FD1–FD6, recipes.json): talk to the keeper → collect (fish
  mini-game, taro mini-game, shop, gather spots) → learn → notebook 食材與營養.
- Step 5 (done): HUD (member status under each chip, dimmed / locked, split banner + 放棄出海), markers (regroup,
  away members, gather spots), follower `stay`.
- Step 6 (done): NPC streaming (distance load / unload with hysteresis, refcounted textures, disposed geometry /
  materials) + MSAA off on coarse-pointer devices (multisampled targets were the largest GPU item on phones).
- Step 7 (done): debug hooks + docs/phase1/TEST_HOOKS.md; scripts/test-split.mjs (save / load mid-split included).
- Steering 10:02 (art worker done, see # NPC cast rev):
  - npcs.json: the 4 a akes from npcs_additions.json added (+ `elder: 'f'`); 水芋田長輩 home 野銀 (waypoints
    ivalino / taro_ivalino), 織布長輩 home 紅頭 (imorod), both `elder: 'f'`. quests.json `elders.f` now = each
    village's a akes. New token `@hostf` (host village's a akes; she waits on the host porch host_weave) replaces the
    hard-coded weaver in Q07 / J1 / J2. dialogues.json `recipe_keeper` node (generic, 「還要請族人確認」).
  - Recipes per RECIPE_KEEPERS.md: 椰油 飛魚乾 (elder_f_yayo), 朗島 水煮山藥 (elder_f_iraraley), 東清 水煮貝類與海菜
    (elder_f_iranmeylek, new rc-shellfish-seaweed; new ingredients shellfish 貝類 / seaweed 海菜, tao "" until
    confirmed, gathered on the 東清灣 shore: derived place tide_iranmeylek), 野銀 水煮芋頭 (villager_taro), 紅頭 水煮飛魚
    (weaver_elder), 漁人 芋頭與地瓜 (elder_f_iratay). rc-boiled-sweetpotato (水煮地瓜) dropped.
  - NPC loading switched to the per-village atlases: Assets reads npc_atlas.json, NpcActor acquires its group's
    atlas (refcounted, disposed when no NPC of that group is in range), SpriteBillboard gets a `region` (UV window of
    the sheet slot). Fallback to the single sheet if an NPC is missing from the manifest.
  - capture-party.mjs:57 / capture-traveller.mjs:65 → portrait width 330.
- Steering 10:31 (hold on image assets): the lossless-WebP atlases I had made (pixel-identical, 694 KB → 367 KB) and
  the deletion of the 43 single NPC sheets were both REVERTED to the art worker's files (byte-identical manifest,
  PNG atlases and 43 sheets restored from /workspace/tao-rpg-backup-split/). Code runs from the PNG atlases; the 43
  single sheets are now unused (only loaded as a fallback) and can be deleted once the art style is settled.
- Tests adapted to the batch: verify-phase1 (Q07 is now a split → runQuest; 133 quests = 127 + 6 食譜),
  verify-phase1b (分工 jobs now start / end at @giver → runQuest; J1 actor check via quest().block).

## Art style notes (style test v6, 2026-11-14)
- Style settings (ink, paper, palette from the target picture, seasons, time of day, night glow, sea streaks) all live in `src/render/styleConfig.ts`.
- 圖鑑 illustrations: locked style = the hand-drawn flying fish (`art-src/style-test/v3/item_flyingfish.jpg`).
- Travellers may wear glasses (`art-src/portraits/style-v6/*_glasses.jpg`). **Underwater images (u1/u2/u3 and any later dive art) must show the travellers WITHOUT glasses.**

# Phase A: content data (2026-11-14)

- New `content/` tree (data only; the game still reads `public/data/` until the refactor): seeded by `scripts/content/migrate-legacy.mjs` (one-off), then new quests, items, dialogue, outfits, gather nodes, photo spots.
- `scripts/validate-content.mjs`: unique ids, references, split / solo structure, village 分工 + keeper coverage, outsider-outfit rule, simplified-character scan, completability fixpoint. Current: 161 quests (76 playable, all completable), 23 items, 7 recipes, 43 NPCs, 34 dialogue sets, 0 errors.
- Docs: `CONTENT_SCHEMA.md` (format + how to add), `CONTENT_PHASE_A.md` (design, open questions, cultural review list).

## Phase A — art unification (2026-11-14)
- Backup of all previous art: /workspace/tao-rpg-backup-art-prev/art-prev-2026-11-14.tar.gz.
- 37 portraits restyled to the locked v2 portrait style (watercolor + fine dark-brown ink); sources in art-src/portraits/*.jpg, keyed + fitted with `python3 scripts/key_art.py portraits` (transparent, 330×420 + guide copies).
- Underwater U1/U2/U3×3 restyled (traveller wears a snorkel mask, no glasses); sources art-src/underwater/v2/.
- 圖鑑 plates for all 11 items (v3 flying-fish style) in art-src/items/ → public/assets/items/illus_<id>.webp (512²) + icons/icon_<id>.png (24² pixel icons; names = the illustration/icon keys in content/items, 23 items; art-src/items/icon_src_<id>.jpg = optional bolder icon source). `python3 scripts/convert-phase-a.py` rebuilds underwater + items. NOT yet wired into the UI.
- Review sheet: screenshots-style/phase-a-review.png (`python3 scripts/phase-a-sheet.py`).

# Phase B: modular refactor (2026-11-14)

Status log (newest last). To resume: read this list, then docs/phase1/ARCHITECTURE.md.

- [done] Content loader `src/content/` (import.meta.glob + validate). `public/data/` and the old quest generator removed (backup in /workspace/backups/legacy-public-data-and-generator-1300.tgz).
- [done] Systems in `src/systems/`: timeWindow, partySplit, inventory, gathering, photoSpots, recipes, outfits, dialogue. 背包/圖鑑 tab with the 23 item icons and drawings.
- [done] Outfits: portrait swap (local_trad, local_f_trad, visitor_m_acc, visitor_acc); no sprite variants, so the base sprite is kept.
- [done] Traveller accessories renamed 織草帽 / 織草小袋 (ids kept). Guide shows outfit variants on the same card. Guide font subset rebuilt for 服編鎖飾.
- [done] content-polish merged and deleted (手札, 族語詞卡, 男性/女性長輩; giver labels come from content/meta.json).
- [done] 13 passers-by + 2 quest-kid side quests (KD1, KD2); the geologist (man) was already in cast.json.
- [done] 5 new places placed; check-roads OK.
- [done] Test hooks + docs (TEST_HOOKS.md, ARCHITECTURE.md). capture-party / capture-traveller fixed (waited for the portrait to load).
- [done] 14:00 Interaction fix: 族女 at a shared spot no longer gets the traveller's photo step; a small gather node inside a wide quest-spot circle now wins when the player stands on it.
- [done] verify-phase1: the Q03 role-gate check talks again when a new village side quest (IV-M1) runs first.
- [done] test-split: shore gathering needs low tide (dawn); the test sets dawn and matches nodes by item. Passers-by no longer block gather nodes (E gathers instead of chatting). test-split ALL OK at 14:30.
- [done] Full re-run on the final dist (/tmp/afterB3/summary.txt): perf, test-content, verify-phase1, verify-phase1b, smoke, test-audit, test-split, test-walkout, capture-party and capture-traveller all exit 0 with no FAIL lines. tsc, build, validate-content, check-roads and check-fonts OK.
- Atlas test (15:10): packing the 13 passer-by sheets into the village atlases raised GPU memory (peak 82.9→88.9 MB), because the atlases grow to 3 rows and load whole. Reverted to the old atlases (backup in /workspace/backups/npc-atlas-pre-pb-*.tgz). The passers-by stay single sheets, streamed by distance. build_atlas.py now knows the iranmeylek_beach and iratay_school homes.
- Final perf (mobile 390x844), before→after: GPU harbour 64.6→69.6 MB; village 72.9→72.9 MB; peak 80.9→79.1 MB. JS heap harbour 85→53 MB. Frame p50 harbour 4.0→4.9 ms, village 3.5→3.6 ms.

**Phase B: DONE (2026-11-14 ~15:10 CST).** Not pushed.

# Leftovers (pre-0.1.3)

Started 2026-11-14 15:15 CST. Status log (newest last).

- [done] Collected the leftovers (PROGRESS.md, CONTENT_PHASE_A.md, ARCHITECTURE.md, AUDIT-0.1.1.md, collaborator notes; no TODO/FIXME left in src or scripts).
- [done] Version 0.1.3 in package.json and package-lock.json. There is no in-game version text.
- [done] Gather nodes whose `requires` is unmet (the 漁人 sweet-potato field before permission, the night shore without a headlamp) now show a hint instead of silently hiding. The hint comes from the new `requiresHint` field in content; no 採 marker shows until the node can be used. test-content checks this.
- [done] 15:16 Outfit walk sheets wired: player_trad, player_f_trad, player_visitor_acc, player_visitor_f_acc. They come from `sheet` / `sheetByGender` in content/outfits/outfits.json; accessories now swap the sheet too. Riding and paddling fall back to the base outfit's sheets (outfitBaseSheet). Missing art still falls back to the base. test-content checks wear → portrait + walk sheet on screen, riding, and reload: PASS.
- [done] Docs: CONTENT_PHASE_A.md (stale questions and the striped-band wording), TEST_HOOKS.md (`shown`), ASSET_MANIFEST.md (variant sheets), ARCHITECTURE.md.
- [done] Checked the night quests (NT1, NT4, NT5, IM-V2): their NPCs keep a night schedule at home, so they are reachable. Every NPC portrait file exists.
- [done] Full check run on the 0.1.3 dist (/tmp/leftovers/summary.txt). Everything passed. verify-phase1 crashed in 1 s on the first run (a browser that another worker was running on the box detached it) and passed when re-run on its own port. test-walkout timed out at 90 s while the box was loaded; its budget is now 150 s, and it passed on re-run.
- [done] 16:20 QA bug list (/workspace/tao-qa/qa/BUGS.md, 18 bugs):
  - H1 X04 only reached 9 words. The six male elders had lost their first-talk 族語 lesson (elder_home) in the Phase A dialogue move. Dialogue sets now have an `intro` (a node told on the first talk while its words are unlearned), and the six elder sets use elder_home. validate-content now counts the words play can reach (14 of 17) and fails if any quest needs more.
  - H2 Outfit 404s: stale. The QA copy predates the real sheets (player_trad etc.); test-content shows 0 missing sheets.
  - H3 Desktop arrow keys on the dock: the collision sim never sticks at any camera yaw. QA's stop is at the arrival spot with the arrival yaw (0.7), so the player never moved, which points to a story line opening over the walk. test-walkout now closes such a dialogue like a player would and logs mode / modals / focus if it ever stops. slideMove also tries the move turned ±30° / ±60° when both axis slides fail at a corner.
  - M1 goat 圖鑑: Inventory.known() also reads `unlockFlag` (quest flags).
  - M2 raw ids in the HUD: placeZh() looks up landmarks too (dasenshan → 大森山) and never shows an id. test-content checks every split / meet place.
  - M3 / M4 族語 tab: categories 語言／自然／食材. alibaong's developer note moved to `review`. validate-content rejects English categories and "Phase…" notes; smoke checks the tab.
  - M5 390 px phone: the 手札 tabs wrap to two rows. smoke (now 390×844) checks every tab is visible and clear of ✕.
  - M6 dive popup: openModals() lists 'dive'; closeAll() closes it and the step still finishes; a missing image shows a placeholder. verify-phase1b checks this.
  - L1 party snap: followers go behind the leader only where they can stand (else beside or on the leader). test-content checks 野銀 / 東清 / 紅頭.
  - L2 Tao slots: "Kaiyuan" / "Surprise" blanked (places.json, ui.json). validate-content rejects known non-Tao words in `tao`.
  - L3 host_tagakal dropped from the derived place list (no lot, unused).
  - L4 NT2, the night shellfish node and the hermit-crab node relabelled 黃昏 (they open at dusk with the placeholder tide).
  - L5 / L9 test timing: verify-phase1b waits for the ❗ marker (quest tick), and test-split polls the atlas groups instead of sleeping.
  - L6 gn_ovi_peak moved onto open ground (ox −1.5, oz 3). check-roads now needs every gather node's centre to be walkable (r 1.2).
  - L7 song s08 spelling (lilikey / lilikei): left for the consultant, not guessed.
  - L8: information only, no change.
- [done] ~17:30 Check run on the QA-fix dist (/tmp/qafix/summary.txt): test-content, verify-phase1b, test-walkout (arrow keys and joystick), test-split, verify-phase1, test-audit, capture-party, capture-traveller and perf-mobile all exit 0 with no FAIL lines. smoke (390×844), tsc, build, validate-content, check-roads and check-fonts OK.

**Leftovers (pre-0.1.3): DONE.** Version 0.1.3, not pushed. The open questions are listed above.

## Open questions for Larry (pre-0.1.3), not guessed
1. Phase A questions 1–5 (M3 without MS1, outfits worn anywhere, seasons, owl spot, 漁人 gathering). The defaults are in the game; see ARCHITECTURE.md.
2. Sacred-place photos P05 / P07 / P18 can be unlocked but never completed. Keep them as placeholders, drop them, or turn them into "view from afar" notes?
3. 85 of the 163 quests are still placeholders (for example A2 needs M4; A4 / J4 need goats and a thatch field in the world). Which ones should become playable next?
4. `host_tagakal` (the host family's tagakal): removed from the derived place list (QA L3), since no lot exists and no content used it. Should a host tagakal come back with a quest, and on which lot? (check-roads reports no clear lot for 野銀's tagakal.)
5. Audit A9: the layout leaves out 3 buildings (a 椰油 modern house, a 野銀 涼亭, a 漁人 makarang). Is that OK, or should they be moved somewhere they fit?
6. Real tide data. The tide is still a placeholder (low tide at dawn and dusk). This is why NT2 and the night shore nodes open at dusk.
7. The 跟隨／待命／前往 party command menu: Phase 2, or sooner?
8. Should the four outfits also get riding and paddling sheets? Today the base outfit shows on the scooter and the tatala.
9. (For the consultant) Song s08: the title says `tana lilikey` but the lyric says `tana lilikei`. Which spelling is right? (QA L7)
10. (For the consultant) The four traditional / accessory walk sheets (player_trad, player_f_trad) need the same review as their portraits.

## Art leftovers (for the art worker, not code)
- ~~nurse_new portrait~~: closed. nurse.webp was already redone in the v2 style (2026-11-14).
- Outfit ride_ / canoe_ variants, if Larry wants them (question 8).

# 0.1.3 release
- Perf (quiet box, perf-leftovers-013-quiet.json): harbour heap 52.9 MB (<65, no leak; the earlier 88 MB was box load), GPU 69.6 MB, p50 6.0 / p95 7.9 ms; riding GPU 81.9 MB; village heap 53.1 MB.
- Staged with /workspace/tao-rpg-backup-0.1.3/stage-0.1.3.sh (0.1.1 script + excludes for perf-*.json, tarballs, .env/keys). Built dist at repo root, source/ without node_modules/dist/art-src/screenshots/backups.
- PR https://github.com/kpyglobal/PongsoNoTao/pull/3 rebase-merged → main 346f211 (tree identical). Pre-release https://github.com/kpyglobal/PongsoNoTao/releases/tag/v0.1.3. Pages built 346f211 (5:35 PM CST).
- Live LIVE_URL test-walkout: ALL OK (keys + joystick off the dock, 0 console errors, 0 4xx); guide.html 200.
- Backups: /workspace/tao-rpg-0.1.3-final.tar.gz (651 MB, tree minus node_modules/dist); Mac clone fast-forwarded to 346f211 with git pull only.

# 0.1.4 work
(2026-11-14 5:58 PM CST task: (A) bigger island, real Lanyu outline, villages in real relative positions, 3 omitted buildings + fish rack, re-place everything; (B) requiresOutfit; (C) WORLD_NEEDS.md from the content worker. Don't push.)
- Step 0: started; backup next.

# 0.1.4 content
(2026-11-14 ~18:00 CST, content worker. Task: make the 85 placeholder quests playable, P05/P07/P18 viewable from afar,
host_tagakal as home base, `requiresOutfit` on festival / boat-fishing / tribal-event quests, cultural review list.
Don't edit src/ or world layout. Don't push.)
- [done] 18:10 docs/phase1/WORLD_NEEDS.md written (new place ids, decor, NPC schedules, the `requiresOutfit` field spec).
- Plan: quests that need a new place wait in `content-pending/` (same file names); `scripts/content/promote-pending.mjs`
  moves them into `content/` once the ids exist. validate-content checks content/ and content/ + pending.
- Step 0 (6:00 PM): backup /workspace/tao-rpg-backup-0.1.4/before-0.1.4.tar. The "3 omitted buildings" = check-roads DROPPED (yayo:modern, ivalino:tagakal, iratay:makarang); one 椰油 fish rack also had no room.
- Step 1 (6:10 PM): real outline from the OpenStreetMap 蘭嶼 island polygon (relation 10730513, ODbL) via scripts/dev/make-outline.py → src/world/outline.ts (88 pts, 11.2 u/km, ≈5 730 u² vs 4 800 before). src/world/coast.ts: blurred SDF, sea normal, arc helpers. src/world/legacy.ts: the old village frames (old saves / old points keep their place relative to the nearest village). layout.ts: villages placed from real lon/lat (mkCoast). IN PROGRESS: facilities, links, landmarks, height.ts coastField/ridges, runway yaw, scatter boxes, places.
- Steering received: (1) ride_/canoe_ outfit sheets exist for all 4 outfits; Outfits.ensure() now also loads them (player.ts already prefers them, base fallback). (2) keep the BGM worker's edits. (3) tatala only for Tao men (data flag) — others get a modern canoe hull + zh hint. TODO after the island.
- [done] ~18:14 Authored all 85 placeholder quests + live edits (Q01 why they came home, Q03/Q07/NT1 at host_tagakal, OF1 before M3, M3/IT-M1 requiresOutfit, K1–K6 give the village names as 族語 words). Source: /workspace/content-014/*.mjs (run `node /workspace/content-014/run.mjs`; it rebuilds from /workspace/content-014/baseline, the content as of 18:15, so re-running is safe). Result: 129 playable live; 37 waiting in content-pending/ for WORLD_NEEDS ids (incl. W1/B2/M7/M9/M11 held back because their prerequisites wait). validate-content OK.
- 18:10 steering: only Tao men paddle a tatala. Women / travellers use a modern canoe (`canoeKind: "modern"`) or watch from shore. V4 rewritten that way; no other f/t canoe step exists.
- [done] ~18:16 validate-content: checks content-pending/ too (CONTENT_OVERLAY + WORLD_NEEDS ids), requiresOutfit (unlock quest must be a prerequisite), and the tatala rule (f/t canoe steps need canoeKind modern). scripts/content/promote-pending.mjs written and dry-run tested on a copy with all WORLD_NEEDS ids added: all 55 entries move, 163/163 quests playable and completable.
- [done] ~18:18 Font subsets rebuilt for the new text; build-fonts.py and check-fonts.mjs now also scan content-pending/.

- [done] ~18:24 `scripts/test-quests.mjs` (new, needs `dist/`): plays every playable quest in prerequisite order (wears the required outfit, switches to the traveller for photo steps). 129/129 OK on a temp build.
- [done] ~18:45 `scripts/test-split.mjs` updated: OF1 + wearing outfit_m_tao before M3; up to 8 shop talks (E1/E4 now also talk at the 椰油 shop); taro-field mini-game stands on the side away from the clinic (the reshaped layout puts the clinic ~2 m from 野銀水芋田, so E picks the clinic — **world worker: please move one of them**). Still 1 FAIL, also failing on the 18:15 baseline content, so not from 0.1.4 content: 「gather 貝類 ×2 at the 東清 shore」 gets 海菜 only (gn_shellfish_im / gn_seaweed_im 1.6 m apart → nearest-pick/engine side) → FD5 + six-recipes checks fail after it.
- Regression on temp build: validate-content OK (live + pending), check-fonts OK, verify-phase1 / verify-phase1b / test-content OK, test-quests 129/129.
- [done] ~18:50 docs/phase1/CULTURAL_REVIEW.md (11 design decisions + landmark-name sources + 58 auto-listed `review` items). CONTENT_SCHEMA.md / TEST_HOOKS.md: `requiresOutfit`, `canoeKind`, `distanceOnly`, content-pending + promote, test-quests.
- Status: 129 quests playable now; 37 quests + 18 photo spots wait in content-pending/ for the WORLD_NEEDS places (run `node scripts/content/promote-pending.mjs` after the world lands, then `npm run fonts` is not needed — fonts already cover pending text). Nothing pushed; src/ and places.json not touched.

# 0.1.4 audio + feedback

_2026-11-14 (America/Chicago)_

**Background music, first batch (6 loops).** All original 8-bit melodies generated by `scripts/audio/make_bgm.py` (pulse / triangle / noise synth, pentatonic tunes over simple chord loops; mood only, no Tao traditional song quoted or imitated). Rendered circularly so each loop repeats with no seam; 32 kHz mono MP3, 230–282 KB each, in `public/assets/audio/bgm/`.

| Track | Use | Loop |
|---|---|---|
| harbour_day | default / 開元港 island theme (day) | 36.9 s |
| night | night anywhere | 41.1 s |
| sea | canoe at sea, diving | 34.3 s |
| imorod | 紅頭 (day) | 40.0 s |
| ivalino | 野銀 (day) | 33.5 s |
| iranmeylek | 東清 (day) | 34.3 s |

- Manifest `content/audio/bgm.json`: tracks, loop lengths, per-track gain, village → theme map, fade time, village radius. New village theme = one track + one map entry.
- `src/systems/audio/bgm.ts`: picks sea → night → nearest themed village → default once a second, 2.5 s crossfade, silent until the first tap / key, lazy fetch + decode (≤ 3 decoded loops kept, 32 kHz context), pauses when the tab is hidden. A ♪ button is added to the top-right HUD; it cycles 開 → 小聲 → 關 (label 背景音樂：…), saved in this browser.
- Hook: one import + one `startBgm(...)` line in `src/core/game.ts` after boot. No other game file touched.
- Test: `node scripts/test-bgm.mjs` (needs `dist/`): silent before tap, right loop per village / back at the harbour / canoe / night / day, all 6 files decode at their loop length, button + saved setting, cache ≤ 3, no console errors: OK.
- Listening page: `screenshots-audio/index.html` (play each loop, or start 5 s before the end to hear the seam).
- Open: dusk / dawn use the day themes; 朗島, 椰油, 漁人 have no theme yet (they get the island theme).

**Kristen feedback folder.** `feedback/kristen/`: README (中文 + English), `TEMPLATE.md`, `CHANGELOG-from-feedback.md`, `materials/`. Small outfit / culture / language / food / side-quest items are adapted directly and summarised for Larry; major changes wait for Larry.

**Mac cleanup (approved by Larry).** Moved to the Mac Trash (recoverable with Put Back): `~/tao-rpg` (22 MB) and `~/tao-rpg-local.zip` (12 MB). No `tao-rpg*.zip` in `~/Downloads`. `~/Dropbox/Github Projects/PongsoNoTao` untouched.

**Checks at the time of writing.** tsc OK, build OK, validate-content OK, smoke-phase1 OK, test-bgm OK. check-roads reported road gaps and check-fonts flagged characters in `content-pending/`, both from the parallel world-reshape / quest work in progress, not from these changes.
- [done] ~18:24 scripts/test-quests.mjs (quest runner, plays every playable quest via the hooks in prerequisite order; wears requiresOutfit; skips only dive / code-flag / counter waits). On a temp build of the current tree: 129/129 ALL OK. The 37 pending quests get covered once promoted.
- Step 2 (6:50 PM): layout working: villages from real lon/lat (ivalino / imorod / iranmeylek nudged ≤ 1 km along the coast so they fit), coastal link roads from the smoothed outline, airport on the straight SW shore with the beach road seaward (as before), clinic beside the 紅頭→漁人 road at 八代灣, landmarks at real spots (軍艦岩 300 m off the NE shore), old saves remapped to their village (save.world = 2). check-roads down to the dropped yayo lots + taro / pocket nits.
- Step 3 (7:25 PM): every building placed (wider second search, kept inside its own village: 椰油 modern + makarang, 野銀 third 涼亭 and makarang all in); fish racks moved to src/world/racks.ts with more candidate spots (2 per village, 椰油 included). WORLD_NEEDS §1–3 world side: landmarks 紅頭岩 坦克岩 燈塔 玉女岩 情人洞 一線天 鋼盔岩 象鼻岩 龍頭岩 瀑布 老人岩 鯉魚岩 氣象站 (rocks drawn as shore stacks / arches with colliders; positions from OSM names via Nominatim; 一線天 鋼盔岩 象鼻岩 鯉魚岩 placed between their real neighbours, not certain), 饅頭岩 out at sea (no path), 小天池 / 大天池 as lakes you only see from a lookout (collider on the water), places five_caves_view (≥ 12 m from the caves) small_lake_view big_lake_view badai_view hutou_slope thatch_field, derived host_tagakal / host_fishrack, goats on 虎頭坡 + 紅頭山, a thatch patch. Geologist: dawn 坦克岩, day 情人洞, dusk/night airport (an NPC whose next stop is > 24 m away moves there between periods). check-roads OK (392 targets, 0 stranded old saves).
- Step 4: (B) and the steering. `requiresOutfit` on quests (checked at step 0; the quest card and a gentle zh hint say which member must change, 手札 → 背包); everyday clothes can be put back on any time. Tatala only for the roles in content/meta.json `tatalaRoles` (now 族男); others get a gentle hint, and steps marked `canoeKind: "modern"` give them a plain orange modern canoe (scripts/art/make-modern-canoe.py, 16 sheets; loaded only when needed). 8-direction facing for the four playable characters from the `*_8dir` sheets (keyboard diagonals, stick snapped to 45°, 4-way fallback, no mirroring; `?dir8=0` turns it off); scripts/test-8dir.mjs checks all 8. WORLD_NEEDS places in, then `promote-pending.mjs` moved the 37 quests + 18 photo spots into content/ (163 quests, 34 photo spots); font subset rebuilt.
- Step 5: 東清 shellfish bug fixed. Cause: in the new layout a 涼亭 (tagakal) stood right on the `tide_iranmeylek` spot, so the 貝類 node was inside its walls and the player was pushed next to the 涼亭 keeper, whose talk won over the pickup. Fixes: the spot now steps clear of buildings (places.ts `clearOfBuildings`, ≈ 4 m toward the sea), and a gather node you stand on now wins over a nearby NPC (game.ts nearestTarget). Tatala boarding is in the same tick again (the modern hull loads first only when it is not in memory). test-split: Q07 regroup is now host_tagakal (content change). Clinic vs 野銀 taro field: 14 m apart in this layout, nothing to move. Note: a box restart at ≈ 6:57 PM wiped node_modules, dist and /tmp; reinstalled with `npm ci` and redid the lost edits.
- Step 6 (7:40–8:05 PM): full check run on a fresh build. Font subset rebuilt again (the audio worker's new text needed 效). Pass: tsc + build, validate-content, check-fonts, check-roads, test-content, test-quests (163/163, ALL OK), test-split, test-8dir, verify-phase1, verify-phase1b, smoke-phase1. Test fixes (no game change): test-walkout finds its road route and harbour in the game instead of the old fixed points, and its "stuck" check is now by wall clock (software GL under load); test-8dir holds keys until the facing settles; test-audit takes a PORT like the others (8841 was busy).

## 0.1.4 audio, round 2 (Larry's feedback: quieter, softer, SFX, separate controls, title theme)

_2026-11-14 evening (America/Chicago)_

- **Quiet by default:** 音樂 35%, 音效 50% (`src/systems/audio/engine.ts`, one shared AudioContext with a music bus and an SFX bus). The old 開／小聲／關 setting migrates (關 stays off).
- **Settings panel:** the ♪ button opens 聲音設定 with two sliders (音樂 / 音效) and a 開／關 toggle each; saved in this browser (`tao-rpg.audio`), closes on ✕ / outside tap / Esc, fits a 390 px phone (`src/systems/audio/panel.ts`).
- **SFX, synthesized live (`src/systems/audio/sfx.ts`):** a soft triangle 嘟 every 2nd character while dialogue types out (punctuation skipped, at most ~13 a second); a digital-camera bi-bip + shutter click on photos (hooked into the existing photo flash).
- **Dialogue typewriter (`src/ui/typewriter.ts`):** lines reveal at 32 ms a character (instant with reduced motion); the first tap / key shows the rest, the next one advances. The full text is in the element from the start, so the layout never jumps and the test scripts still read whole lines.
- **All loops redone, softer:** triangle / gently clipped sine leads an octave lower, triangle arpeggios, no noise channels (soft kick, low woodblock, log drum only), 4th-order 2.2–2.6 kHz low-pass, equal loudness (−18.6 dB RMS, peaks ≤ 0.5). Energy above 4 kHz: 0.0% in every loop; above 2 kHz ≤ 0.3%. 48 kbps MP3, 176–289 KB.
- **New tracks:** 標題曲 `title` (cover screen, 49 s) and 山上 `mountain` (ground height ≥ 5.5, light adventure, 33 s). Sea is now a lighter 6/8 adventure (30 s).
- **Shared motif:** every loop opens its A phrase with the title theme's motif (rising sol-la-do-mi, settling la-sol-mi) in its own key, tempo and voice; the title theme also uses it in its B phrase. Original; no Tao song quoted.
- **Pick order:** cover → title; sea → sea; night → night; high ground → mountain; near 紅頭 / 野銀 / 東清 → village theme; else island theme. The title theme starts on the first tap on the cover and crossfades into the game music on start.
- Game hooks: `game.ts` (startBgm probe adds `title` and ground height; the interact key finishes a typing line first), `dom.ts` (typewriter on the dialogue line, ✓ button finishes typing first, shutter sound in `flash()`). Fonts rebuilt for 效 / 曲.
- `scripts/audio/make_bgm.py` now writes the loop lengths back into `content/audio/bgm.json` and prints the spectrum / loudness per loop. Listening page `screenshots-audio/index.html` has all 8 loops, a volume slider and both SFX.

## 0.1.4 audio, round 3 (Larry t144u: happier, faster, less 8-bit, island instruments)

_2026-11-14 night (America/Chicago)_

- **New sound:** "island pop" instead of chiptune, with a light digital touch. All synthesized offline in `scripts/audio/make_bgm.py` (numpy / scipy only, no samples or soundfonts, so no third-party licence): ukulele strums (re-entrant G-C-E-A voicing, down / up strums), slack-key-style picking, a round light plucked bass, a soft digital bell / kalimba lead, wordless synthetic "oo / oh / ah" voices as lead doubles, pads and chops (formant-weighted harmonics; no real voice, no lyrics), log drums, soft hand drums, a gentle shaker (band-limited under 3.4 kHz), a soft kick, and a slight swing on the off-beats.
- **Faster and happier:** title 108, harbour 114, 紅頭 108, 野銀 104, 東清 120, mountain 122 BPM, sea 120 BPM in 6/8, night 96 (calm but moving). Major keys, pop progressions (I–V–vi–IV and friends), syncopated melody rhythms.
- **Kept:** the shared title motif opens every track; seamless circular loops; equal loudness (−18.6 dB RMS, peaks ≤ 0.61); nothing generated above 3.6 kHz plus a 3.0–3.4 kHz master low-pass (energy above 4 kHz ≤ 0.001%, above 2 kHz ≤ 1.1%); default volumes (音樂 35%, 音效 50%); file names, manifest keys and the game code unchanged. Loops are 30–40 s, 176–235 KB.
- `make_bgm.py -v` also prints each instrument's level in the mix (balance check: lead ≈ 0.5, uke ≈ 0.45, bass ≈ 0.37, percussion ≈ 0.3).
- Listening page `screenshots-audio/index.html` updated (BPM and instruments per loop). `content/audio/bgm.json`: new loop lengths and moods.
- Step 7 (8:50 PM): on the current build (20:07) test-walkout passes (desktop + mobile, ALL OK); test-audit passes with its new PORT. perf-mobile → perf-014.json (vs perf-leftovers-013-quiet): CPU p50 5.8 / 4.9 / 4.1 ms at harbour / riding / village (was 6.0 / 5.0 / 5.5); GPU 86.6 / 73.1 / 72.1 MB (was 69.6 / 81.9 / 72.9; the harbour is +17 MB, mostly the 8-direction sheets); heap ≈ 59 MB (was 53). Shots for Larry in screenshots-014/: 01-village-ivalino, 02-coast-road, 03-modern-canoe-at-sea (1280×800, scripts/capture-014.mjs), next to the 00 top-down map. Not mine: test-bgm fails in the audio worker's new typewriter/blip checks (it is still editing that test and src/systems/audio); left for the audio worker.
- Step 8 (9:10 PM): ground fix for Larry ("地板為啥還是那麼粗糙&哪些格子"). Cause: the painted ground map (island.ts paintTerrain) drew village / plaza ground as a light-dark checkerboard of 0.45 m squares (a fake paver pattern), which at play zoom reads as a grid; on top, the repeating detail grain was strong on roads and plazas. Fix: no checker any more, soft irregular earth / paver patches from the smooth noise instead; the grain on roads and plazas is halved (shader cache key bumped to v4). The v7 style settings are unchanged. Retook screenshots-014/01–03, plus 04-ground-before-after.png. Checks: tsc + build, check-roads, test-walkout (ALL OK), smoke-phase1 OK. perf-ground-014.json: the paint change adds no textures; frame and memory numbers moved with the box load (other workers' browsers running), so treat this run as noisy.
- Step 9 (10:10 PM): 0.1.4 scope locked, so only the ground fix ships. The trails, goat herds and pig pens I had started are moved to 0.1.5 and taken out of the tree. They are saved in /workspace/world-015/ (patch/world-015.diff, full file copies in tree/, new/pens.ts, new/animals.ts, test-animals.mjs, and a README). Rechecked after taking them out: tsc (both configs) OK, build OK, validate-content OK, check-roads OK, test-walkout ALL OK, smoke-phase1 ok. perf-ground-014.json: memory the same as before (GPU 86.6 / 73.1 / 72.1 MB, heap about 59 MB). CPU and fps are not usable this run because the box was heavily loaded (load 30, 0.5 fps). The screenshots in screenshots-014/01–04 already show the ground fix. Not pushed, no version bump.

## 0.1.4 audio, round 4 (Larry t149u: real instruments, epic title, a memorable hook, festival voices, ukulele stings)

_2026-11-14 night (America/Chicago)_

- **Real instrument sounds:** `scripts/audio/make_bgm.py` now writes each original tune as MIDI and renders it with FluidSynth 2.4.4 + the **FluidR3_GM** soundfont (MIT licence, Frank Wen / Toby Smithe; full text in `docs/AUDIO_CREDITS.md`; setup in `scripts/audio/README.md`). Steel-string and nylon guitars (strummed, plus slack-key-style thumb bass), marimba, flute, pan flute, harp, upright bass, strings, choir, taiko, congas, shaker; FluidSynth reverb and chorus; light humanised timing and velocity.
- **New hook (`HOOK`):** call "mi sol la, sol la do', re' do' la" (rises to a peak, settles), answer "mi sol la, sol mi re, do" (comes home); pentatonic, I-IV-V-I. Most loops are hook, developed hook (the answer climbs higher before resolving), bridge, hook. The sea loop adds a 4-bar groove, and the festival loop quotes only the call's first notes, so every track still quotes it.
- **Title theme:** 9.3 s one-time intro (strings + choir swell from quiet, taiko hits, a rolling taiko crescendo, the hook's call broad on the strings), then the 104 BPM guitar groove loop (37 s). New manifest field `loopStart`; `bgm.ts` loops only [loopStart, loopStart + loop).
- **Other loops kept simple and happy:** strum + bass + light percussion + one lead with a soft double; 96–122 BPM.
- **Festival / culture loop `festival` (100 BPM, 38 s):** no instruments and no soundfont: fully synthesized wordless "ah / oh" voices (formants, a few detuned "people", vibrato), a solo call answered by the group (unison + octave + fifth), a low hum, hand claps and foot stamps, synthetic hall reverb (circular, seamless). Original; no Tao song quoted or imitated. Manifest `culture` block: plays while a dialogue or mini-game scene of a cultural quest is open (arcs `tatala`, `outfit`; quests `M4`, `F2`, `T3`; any quest with `requiresOutfit`). For the cultural consultant to confirm which scenes should get it.
- **Ukulele stings (nylon guitar in the ukulele register, ≤ 0.6 s, 5 KB each):** `public/assets/audio/sfx/item.mp3` (two plucks up), `milestone.mp3` (strum + a high ringing note), `quest.mp3` (the hook's rising mi-sol-la-do'). They play on the 音效 bus via `sfxSting()` and are preloaded after the first tap. Stings that fire together merge to the most important one (quest > milestone > item). Hooks in `game.ts`: item gained (gathering / step gives), milestone unlocked, quest done.
- **Limits kept:** 4 kHz low-pass (energy above 4 kHz ≤ 0.05% in every loop), equal loudness (−18.6 dB RMS), soft limiter, seamless loops (rendered middle copy of three), default volumes 35% / 50%. All loops 31–46 s and 183–271 KB.
- Listening page `screenshots-audio/index.html`: 9 loops (title plays intro + loop), the 3 stings, blip and shutter. `test-bgm` checks the festival rule, the title intro, the stings (play, merge, ≤ 0.6 s) and `loopStart + loop` against each file.
- Tooling on the box (not in the repo): `/workspace/.fluidsynth` (FluidSynth + soundfont extracted from the Debian packages) and `/workspace/.audiovenv` (mido).

## 0.1.4 modern canoe → sea kayak, sun shadows, water reflections (Larry t146u–t148u, art worker)

_2026-11-14 night (America/Chicago)_

- **Kayak sprites:** all 16 `canoe_modern_<key>[_8dir]_sheet.png` redrawn in the v7 pixel style by `scripts/octo/kayak.py` (build jobs `kayak`, `kayak8` in `scripts/octo/build.py`): a slim pointed hull (muted brick-red deck, cream hull, dark seam), cockpit coaming with the paddler sitting low, deck cord lines and bungee crosses, a double-bladed paddle with an alternating left / right stroke (4 frames). The frame layout and the 4 / 8-direction row order are unchanged. Old sheets are backed up in `art-src/_backup/canoe_modern_v014/`; `scripts/art/make-modern-canoe.py` is retired (exits).
- **Sun shadows for sprites:** every walking / riding / canoe character billboard carries an invisible caster plane (same sheet, alpha-tested, no colour or depth in the camera passes) turned to the sun (`setSpriteSunYaw` from the time-of-day preset). So the shadow comes from the same sun shadow map as the tatala, rocks and houses: same direction, length, softness and time of day, on land and water. The old round blob is now only a faint contact shade (0.28 → 0.18).
- **Shadows on the sea:** the ocean shader now receives the sun shadow map (three.js light / shadow chunks). Shade strength follows sun vs. sky light (`uShadowK`, ≈ 0.6× lit by day, weaker at dusk / night), with a slight cool tint, and it removes the sun glint in the shade.
- **Reflections:** the watercolor pass used to hide the sprites while the sea mirror rendered, so they had no reflection. They now leave the camera layer instead and come back only for the mirror render (`src/render/reflectHooks.ts`). Player, kayak and NPCs reflect with the same ripple, tint and alpha as boats and rocks; off underwater (`reflectHooks.sprites = !diveOpen`).
- **Perf guards:** casters only within 34 m and only for sprites a camera pass drew in their last 45 updates (counted in frames, not wall time, so slow frames keep the shadow); mirror sprites only within 40 m and on screen. So the shadow and mirror passes never upload lazily-shown NPC sheets (a first version without this added +15–31 MB of NPC atlases). Casters draw an empty range in the camera passes. perf-015-kayak.json vs. perf-014: GPU memory and texture count unchanged (86.6 / 73.1 / 72.1 MB; 51 / 48 / 47 textures). CPU timings unusable this round (box load ≈ 25–30 on 8 cores from other workers' browsers); a back-to-back A/B, feature off vs. on, gave the same riding / village CPU within noise.
- Checks on the final build (21:45–22:10): tsc and build OK; test-8dir OK (族女 paddles the modern kayak 8-way); test-walkout ALL OK (one earlier run hit the 600 s timeout under load, rerun alone passed); smoke-phase1 ok. Goats / pig / pig pen / feast art moved to 0.1.5 (Larry); not started.
- Shots: `screenshots-014/05-canoe-new.png` (kayak beside the moored tatala at 開元港, shadow and reflection; `scripts/capture-kayak.mjs`), `screenshots-014/06-canoe-before-after.png` (crops of 03-modern-canoe-at-sea before and after).
- Files: scripts/octo/kayak.py, build.py; src/entities/billboard.ts, src/world/water.ts, src/render/stylize.ts, src/render/reflectHooks.ts, src/core/game.ts. textures.ts / island.ts / audio untouched.

## 0.1.4 verify fixes (22:1x CST, content worker)
- `scripts/verify-phase1.mjs`: Q03 now checks its second step (the elder takes everyone to the host family's 涼亭, `host_tagakal`), walks there, then expects Q03 done. That second step is intended 0.1.4 content.
- P23 photo failure, root cause: a cascade, not the layout. Q03 stayed on step 1, so Q07 (needs Q03) never ran its split → regroup, and the traveller was not in the party at 開元港 when the test switched to her for P23. With Q03 fixed, Q07 and P23 pass. No content or src/world change needed. Side note: the test's +2 m offset from the harbour place lands off walkable ground in the new layout; the game moves the player about 4 m away, still inside r 9.
- `verify-phase1.mjs` / `verify-phase1b.mjs` now exit 1 when any check fails or on a console error / 4xx (`process.exitCode`). Before, they always exited 0.
- Fresh temp build (21:5x): verify-phase1 desktop + mobile ALL OK (exit 0; the run before the last fix exited 1 on its one FAIL, so the exit code works), verify-phase1b ALL OK (exit 0), validate-content OK (163), test-quests 163/163.


## 0.1.5 (planned)
_2026-11-14 21:5x CST, content worker. Larry t157u: 0.1.4 ships as is; this work moves to 0.1.5. Nothing of it is in the tree._
- Drafts in `/workspace/content-015/` (outside the repo): `patch.mjs` (idempotent: `node /workspace/content-015/patch.mjs /workspace/tao-rpg`), `mountain.json`, `content-before/` + `content-after/` (diff to review), `scripts/test-playthrough.mjs`, `assets/` (illus_lanyu_pig.webp, illus_feast_pig.webp, icons icon_lanyu_pig / icon_feast_pig / icon_pork_share), `docs/CULTURAL_REVIEW.0151-draft.md` (review rows 12–15).
- Content: MG1 羊群回家 (main, winter, after M11, before Z1; 3-way split at hongtou_lookout / hutou_slope / qingqing, feast at host_tagakal, no slaughter); MT1 選造舟木材 at timber_grove (T3 → MT1 → T4; 族男 + 旅人); MT2 山上走失的羊 (tell the owner, no hunting); P31 紅頭山步道觀景台 photo; P07 moves to tianchi_lookout; PF0 蘭嶼豬 talk + PF1 部落分享會：烤豬 (winter dusk, requiresOutfit m) + 圖鑑 lanyu_pig / feast_pig, item pork_share, recipe feast-pork-taro, elder_imorod pig lines.
- Story-flow fixes in the patch: M1 needs Q07 (house rules first); M1 points to OF1, OF1 hint direct; Z1 needs MG1 + extra ending lines; M11 tells how to reach winter; rewards for M1 / M2 / Q05 / R2; photo quests outside 椰油 open after Q05 instead of Q04 (47 → 23 open quests after the first four).
- Tested on a temp build at 21:30–21:44: validate-content OK (169 quests), check-fonts OK after a font rebuild, test-quests 169/169, test-playthrough new game → ending OK (imorod/m and iratay/f), test-split OK.
- To do when applying: verify-phase1 / verify-phase1b / test-content assert fixed counts (163 quests, 23 items, 7 recipes), so update them. (The Q03 / Q07 / P23 failures and the always-0 exit code are fixed in 0.1.4, see "0.1.4 verify fixes".)

## 0.1.4 audio, round 5 (Larry t155u/t156u: less digital, more real; a festival with power and unity)

_2026-11-14, 9:31–9:48 PM (America/Chicago)_

- **Kept:** the hook, every track's structure, the instrument choices and the title intro; file names, manifest keys, default volumes (音樂 35% / 音效 50%), the 4 kHz low-pass, equal loudness (−18.7 dB RMS), seamless loops.
- **Better soundfont:** `make_bgm.py` now renders with **GeneralUser GS 2.0.3** (S. Christian Collins; free licence allowing use in software projects, full text in `docs/AUDIO_CREDITS.md` and `public/assets/audio/CREDITS.txt`); FluidR3_GM stays as the fallback. The bank lives on the box at `/workspace/.soundfonts/` (not in the repo, not shipped).
- **Humanized:** every part gets its own timing spread (sd 8–15 ms, clipped to ±16–25 ms) and velocity spread (±5–10); the lead's double is no longer locked to the lead; phrase peaks a little louder. Strums sweep string by string (down 14–22 ms, up 9–14 ms per string, the whole stroke drifting).
- **Room, tape, EQ, stereo:** the soundfont's own reverb and chorus are off (the chorus was a big part of the "digital" sheen). Post on the whole render: 40 Hz high-pass, +1.5 dB warmth around 110–320 Hz, a softened 2.2–3.8 kHz, soft asymmetric tape saturation, convolution with a synthesized stereo IR (warm small hall ≈ 1.6 s; open-air gathering for the festival), the 4 kHz low-pass, subtle width (mid/side; lead, bass, kick centred; L/R correlation 0.86–0.91). Instruments are panned slightly (strums left, double / picking right). Night's synth "warm pad" → soft strings.
- **Files:** 44.1 kHz stereo MP3 at 80 kbps, 304–452 KB per loop (were 183–271 KB mono); stings 5 KB. The game still decodes at 32 kHz (content ≤ 4 kHz). Non-title loops now carry a 35 ms guard of wrapped loop audio at both ends (`loopStart` 0.0348) so MP3 frame edges never touch the seam; the title keeps its 9.29 s intro.
- **Festival rebuilt:** many people as one. A leader calls (joined by two more in the second half), the whole gathering answers in one locked rhythm: low men's chorus (10 → 16 voices) + an octave below (4–5) + higher voices an octave up (4 → 10), each voice with its own detune (sd 9 cents), timing (sd 12 ms) and vowel shape; a held low hum under each call; a unison "oh!" accent on each answer. 14–20 layered stamps and claps per hit (sd 7 ms spread, panned around the circle); stamps double in the second half, fills before each round. The loop builds by ≈ 6 dB (more voices, louder answers), then a big unison "oh!" + stamp opens the next round. Lower register (men around D3). About 1,100 voice layers per loop, all synthesized; still no instruments, wordless, original, no Tao song quoted or imitated.
- Listening page, `bgm.json` notes, `scripts/audio/README.md`, credits updated. `test-bgm`: size limit 300 → 500 KB (stereo); everything else unchanged. Checks: `npm run build` (tsc, content, fonts) OK, `test-bgm` OK.

## 0.1.4 audio, round 6 (Larry t159u: "進主題曲後好難聽。南島風呢？")

_2026-11-14, 10:01–10:22 PM (America/Chicago)_

- **Title:** the epic intro is unchanged (strings + choir swell, taiko). Its strings line is now only tones of each chord, the ukulele fades in on the last bar (V chord) and a slide-guitar pickup (re) leads into the groove, with a 2.5 s crossfade so the intro's tails fade out under the groove (intro 8.6 s + 2.5 s, `loopStart` 11.07). The main section is rewritten from scratch as an island groove at 112 BPM. The ukulele (GeneralUser GS "Ukulele", GS bank 8) strums D-DU-UDU with re-entrant voicing, per-string sweeps and accents. A Hawaiian slide guitar (GS bank 8 "Hawaiian Guitar") sings the melody, gliding between close notes with pitch bend (±5 semitone range, 80–150 ms glides) and bar vibrato on long notes. Underneath: upright bass on roots and fifths, a woody log-drum figure on root and fifth, a soft kick and side-stick, 16th-note shaker and a conga answer. A soft marimba answers in the melody's gaps. Chords loop I–V–vi–IV. Form: A (hook), A2 (the repeat climbs to mi'), B (long sliding notes, the marimba answers each bar), A. Loop 34.3 s.
- **Melody (island version of the hook):** "mi sol la, sol la do' | re' — ti sol — | mi sol la, mi do | la sol do —". It uses major pentatonic plus the V chord's own ti, short phrases and a catchy repeat, and keeps the same contour.
- **harbour_day:** the same groove at 114 BPM in F. A slack-key steel guitar sings with fewer slides, and its own breather phrase (B2) replaces B. Form: A, A2, B2, A. Loop 33.7 s.
- **Harmony check (`check_harmony` in make_bgm.py, runs on every render; the build fails on a violation):** every melody, marimba, ukulele, bass, log-drum and intro note is checked against the chord under it. Allowed: a chord tone, or a short (≤ 1 beat) pentatonic passing note off beats 1 and 3 that is not a semitone from any chord tone. Results: title 607 notes = 593 chord tones + 14 passing, 0 violations; harbour_day 563 = 552 + 11, 0 violations.
- **Levels:** above 4 kHz ≤ 0.04%, −18.6 / −18.7 dB RMS, seamless loops; 444 KB and 330 KB. Listening page and `bgm.json` moods updated. No other tracks or game files changed.
- **Ukulele stings redone (Larry t163u):** GeneralUser GS "Ukulele" (GS bank 8). On its own that sample is very round (almost nothing above the 2nd harmonic), so a nylon-guitar layer about 8 dB lower adds the fingertip pluck. Real g-C-E-A re-entrant voicings (C = G4 C4 E4 C5, G = G4 D4 G4 B4), strings sweep 7–13 ms apart, notes ring out and decay naturally, dry with a touch of room (wet 0.08), and no extra low-pass beyond the shared 4 kHz limit. `item` (0.55 s): a quick sol → do' pluck. `milestone` (1.0 s): do-mi-sol-do' arpeggio into a bright C-major strum. `quest` (1.18 s): a G-chord down-up-down flourish resolving to a ringing C chord (+ a high mi). Same loudness as before (−17.5 dB RMS, peaks ≤ 0.7), 7–15 KB. The same nylon layer sits under the ukulele in the title and harbour grooves. `test-bgm` length limits are now 0.6 / 1.0 / 1.2 s.
- **Festival removed from 0.1.4 (Larry):** `bgm.json` `culture.enabled: false` and no `tracks.festival`; `pickTrack` only plays the culture track when it is enabled and in `tracks`, so cultural scenes keep the normal location music. `festival.mp3` no longer ships (not in `public/` or `dist/`). The listening page drops it, and `test-bgm` checks that it is disabled and not shipped and that cultural scenes fall back to sea / night.
- Checks (10:22 PM): `npm run build` (tsc, content, fonts) OK; `test-bgm` OK (festival disabled and not shipped, cultural scenes fall back, title intro, new sting lengths, all 8 loops decode at their loop length, no console errors).

## 0.1.5 (planned): audio

- **Festival / culture music:** redo with an AI music model or real recordings (with community consent and recorded licences). The 0.1.4 synthesized version is parked in `/workspace/audio-015/`: `festival.mp3`, `make_festival.py` (its generator and settings: seed 131, 100 BPM, D3 men's register, 16 bars; uses the post chain from `scripts/audio/make_bgm.py`) and `festival-manifest.json` (the old `tracks.festival` entry and the culture rules). To restore: put the track back in `bgm.json`, set `culture.enabled` to true, and restore the test-bgm festival checks.

## 0.1.4 audio, rounds 7–8 (Larry t164u "滑音好難聽，一開場很好啊"; 10:26 PM: "grandpa/grandma music", go modern)

_2026-11-14, 10:25–10:36 PM (America/Chicago)_

- **Round 7 (superseded):** removed every slide, glide, pitch bend and vibrato (the MIDI has no pitchwheel or RPN events). Nylon-guitar melody.
- **Round 8, title main section and harbour_day:** a modern cozy island-adventure groove (new `modern_body` in make_bgm.py) instead of the old hula / lounge feel. Instruments: syncopated 16th-note ukulele with muted chucks on the backbeat (Ukulele + nylon layer), steel-string acoustic arpeggios on open add9 voicings, a soft string pad, a moving fingered bass (root, fifth, chord-tone passing, octave pickups), and a tight light kit (soft kick, clap, closed / open hats, shaker, tambourine; half-time feel in the lift). The lead is clean and catchy: piano on the title, pizzicato strings on harbour_day, each softly doubled an octave up by glockenspiel. No slide or steel lead guitar, bends, vibrato, accordion, organ, brass or 8-bit sounds.
  - Chords: IVadd9 – V – vi7 – Iadd9 (A phrases), vi7 – IVadd9 – Iadd9 – V (lift). Form A, A2, lift, A.
  - Melody keeps the hook's contour on the new chords: "la do' re', do' re' sol' | re' — ti sol — | mi sol la, sol mi | re mi do —"; A2's answer climbs to mi'.
  - `check_harmony` now knows chord sets with extensions (add9, 7). Title: 1,147 notes = 1,135 chord tones + 12 passing, 0 violations. harbour_day: 1,102 = 1,090 + 12, 0 violations. One clash it found (mi' over IVadd9, a semitone from fa) was fixed to sol'.
  - Rough stem balance (dry render): title lead −6.6 dB vs the mix, ukulele −6, bass −5; ukulele and bass velocities lowered and lead / glockenspiel raised after that check.
- **Title intro kept:** same notes and code. Its level is pinned to the approved version (`intro_rms` 0.0817, then the gain eases to 1 over the 2.5 s crossfade). Measured against the v6 intro: −0.45 dB, residual −23 dB. The only intentional difference is the one pickup note before the groove, now on the lead instrument (piano) instead of the removed slide guitar.
- Title 112 BPM (the intro's tempo), loop 34.3 s, 444 KB. harbour_day 120 BPM, loop 32.0 s, 314 KB. Above 4 kHz ≤ 0.04%, −18.6 / −18.7 dB RMS.
- **Stings:** same real-ukulele takes plus a soft glockenspiel sparkle on the top notes (item C6; milestone C6 E6; quest G5 C6 E6). Same lengths (0.55 / 1.0 / 1.18 s) and loudness (−17.5 dB RMS).
- Listening page and `bgm.json` moods updated. Only title.mp3, harbour_day.mp3 and the 3 stings were re-rendered.
- Checks (10:36 PM): `npm run build` OK; `test-bgm` OK.

## 0.1.4 audio: start menu loop, loopable title, menu UI sounds (Larry t176u)

_2026-11-14, 11:12–11:24 PM (America/Chicago)_

- **`menu.mp3`:** 8 bars, D, 112 BPM, the same instruments as the title main section, made lighter: no muted ukulele chucks, a soft root / fifth bass, a soft kick on 1, rim and shaker. Chords Iadd9–IVadd9–vi7–V twice. Every pass ends on V, so the title intro (which opens on I) can start on the next bar line; the loop end is best. Manifest: `loopStart` 0.0348, `loopEnd` 17.1777, loop 17.1429, `gain` 0.7 (title 0.9), plus a `transition` note. Harmony check: 452 notes, 0 violations. 169 KB.
- **Title loop:** unchanged audio. `[loopStart 11.0714, loopEnd 45.3571)` loops the main section (loading phase, 開元港 / airport start zone). After MP3 decode the seam has no click spike: wrap step 0.020 vs ordinary steps p99 0.028. The menu seam is also click-free: wrap 0.036, the largest ordinary step near the seam is 0.046. Every track now carries `loopEnd` in the manifest.
- **Menu UI sounds (GeneralUser GS instruments, no bends):** `menu_move` 70 ms marimba tick, `menu_confirm` 220 ms ukulele + nylon + glockenspiel, `menu_cancel` 180 ms lower pluck stepping down, `menu_open` 200 ms two marimba notes up, `menu_toggle` 120 ms kalimba. RMS −24.5 to −27 dB (the stings are −17.5). 1.6–3.4 KB each. `make_bgm.py ui` rebuilds them.
- **API:** `sfx.play(name)` in `src/systems/audio/sfx.ts` (menu_* plus the stings and the shutter), on the 音效 bus and respecting 音效 on/off. Cursor ticks are throttled and cut each other; the sounds are preloaded with the stings. Notes for the start-menu worker: `docs/audio-menu-api.md`. No UI files were touched.
- Listening page: menu loop, a "menu last bar → title intro" segue button, the 5 menu sounds. test-bgm: menu loop ≥ 15 s, `loopEnd` consistency, menu sound lengths / quietness / throttling / 音效 關.
- Checks (11:24 PM): tsc, `npm run build` and `test-bgm` OK.
- **Menu loop revised (Larry 11:28 PM, "not too lofi or slow"):** still 112 BPM and forward. Kick on 1 / 3 with a push, backbeat rim → clap, hats move from 8ths to 16ths in bars 5–8, the ukulele's muted chucks join in bar 5, a pulsing 8th-note bass, a small fill in bar 8 into the next round or the title intro. Lo-fi tone only: Rhodes lead + soft piano double, a quiet room tone (≈ −42 dB under the music) and sparse soft vinyl ticks, generated at the loop length so they loop seamlessly. Same chords, length (17.1429 s), loop points and gain. Harmony: 516 notes, 0 violations. The seam sits inside bar 1's downbeat attack: wrap step 0.065 vs the attack's own 0.052; no separate click. test-bgm OK at 11:37 PM (on a `vite build`; the `npm run build` type-check is blocked by the intro worker's in-progress `src/intro/introScene.ts` / `src/core/game.ts`, no audio errors).
- **Menu loop v3 (Larry 11:42 PM, "drop the melody"):** no lead line at all. Lo-fi atmosphere on the same light 112 BPM groove: Rhodes comping rootless maj7 / add9 voicings (Imaj9 – IVmaj9 – vi9 – Vadd9 ×2, voice-led so the top note stays F#4 F#4 F#4 E4), soft piano dyads doubling the voicing's top two notes on off-beats, soft string pad, warm pulsing bass, the same light kit, room tone + vinyl ticks. Build in bars 7–8: pad swell (velocity + CC11) and a soft noise riser (≈ −30 dB, band opening 400 Hz → 2.8 kHz) into the next bar line / the title intro. Ukulele and acoustic guitar dropped from the menu. Same key, tempo, length (17.1429 s), loop points (0.0348 → 17.1777), gain 0.7 and segue logic. Harmony: 252 notes, all chord tones, 0 violations. Loop RMS −19.1 dB (same as the title loop); seam wrap 0.051 inside bar 1's downbeat attack (downbeats' own steps 0.052–0.062). Preview: `/workspace/preview/menu_to_title_v3.mp3`. Generator: `menu_comp_body` in `scripts/audio/make_bgm.py`. `npm run build` (tsc clean) + test-bgm OK at 11:53 PM.
- **Title v8 main section (Larry 11:58 PM, "after the epic opening it falls apart"):** the intro (0–8.57 s) is kept exactly, spliced in from the approved master (`scripts/audio/approved/title_intro_v7.wav`; the whole-render post chain would otherwise shift it by ~−30 dB of processing differences). Everything after it is a melody-free "fresh new world" bed in the v3-menu manner (`title_bed_body`): bright piano chords with the top note held on A5, Rhodes maj7 / add9 voicings under it, airy high strings, a soft choir and more glockenspiel sparkle in the bars 9–16 lift, warm pulsing bass, the light forward kit, room tone + vinyl ticks, a bar-16 swell + soft riser back to bar 1. Bar 1 resolves the intro's ukulele / piano pickup with one soft ukulele strum; the 2.5 s handover is now equal-power (no level dip). Chords I–IV–vi–V ×2 | IV–V–vi–I | IV–I–IV–V. Same loop points (11.0714 → 45.3571, 34.2857 s) and gain 0.9; harmony 749 notes, 0 violations; loop RMS −19.1 dB; seam step 0.0179 vs p99 0.0277. The loop is now the modern-zone music: `startZone.facilities` = harbor, runway, terminal, clinic (衛生所), scooterShop, hotel (the last two are skipped until the world adds them to `FACILITIES`); `bgm.ts` pickTrack reads that list (default harbor + runway). `harbour_day` stays the default elsewhere. Previews: `/workspace/preview/title_v8.mp3`, `/workspace/preview/menu_to_title_v4.mp3`.

## 0.1.4 arrival opening: painted intro scene, background loading, menu sounds (Larry 10:56–11:28 PM)

_2026-11-14 / 15 (America/Chicago). Release still on hold: nothing pushed._

- **Intro scene (`src/intro/introScene.ts`):** its own small three.js scene, not the island: painted sky strip, cloud cards, the painter's far Lanyu silhouettes (west 258° from sea level, aerial 240° from 1,300 m; heightmap fallback), a shader sea with a glint tile, the plane wing seen from a cabin window, the yacht bow. Realistic-painterly, framed after `keyframe_plane_clouds.png` / `keyframe_yacht_sea.png`. Island height exaggerated 1.4× (the cap Larry allowed; the keyframes paint the peaks about 4× real height, so our island stays lower).
- **Assets:** `public/assets/intro/`, 9 WebP + 1 PNG heightmap + manifest, 134 KB total. `art-ref/` is not shipped (stage script excludes it; dist checked).
- **Flow:** content loads first; the world loads in the background once the ride starts, with a bar at the lower left. The title music keeps looping and the logo stays until loading is done (at least 6 s), then the logo fades, the intro is disposed, and a 5 s in-world approach zoom lands at the airport or 開元港. Skip during loading starts the game as soon as loading is done.
- **Disposal:** before: 12 geometries / 11 textures / 43 programs; after: 1 / 0 / 38 (the 1 is the sprite geometry three.js shares). The 11 textures are about 8.6 MB of GPU memory (decoded, with mipmaps), all freed. JS heap after a forced GC (CDP), world loaded in both: 10.1 MB with the intro alive, 11.8–12 MB right after it is disposed (the game has started by then); the intro holds almost no JS memory, its cost is GPU textures.
- **In-game props:** plane and yacht are their own groups (`arrival-prop-plane`, `arrival-prop-yacht`), v7 style, ready to animate later.
- **Menu sounds:** `src/ui/menuSound.ts` wraps the audio worker's `sfx.play('menu_*')`: move on hover / keyboard focus, confirm, cancel on back, toggle; on the title, party, arrival screens, in-game menus and dialogue choices. 音樂／音效 開關 on the start screens share the in-game panel's saved setting.
- **Touch menu sounds:** on a phone the sound plays on the tap itself (buttons act on pointerup and the screen can change before the click), so 回上一步 now gives the cancel sound on iPhone too. test-intro checks move / confirm / cancel counts.
- **Music:** the arrival uses the audio worker's `segueToTitle()`; the title (v8) keeps looping from its `loopStart` while the world loads.
- **iPhone fix:** a tap that switches screens no longer also "clicks" the button that appears under the finger (`bindActivate` ghost-click guard).
- Test: boat start spot road distance limit is now ≤ 3.2 (the spot measures 3.0 to the road centre line, i.e. at the road edge; check-roads passes).
- Checks: see the suite logs in `/workspace/tao014-logs/` (test-intro ALL OK).

## 0.1.4 arrival intro rebuilt as 2.5D painted layers (Larry 1:16 AM)

_2026-11-15 (America/Chicago). Release still on hold: nothing pushed._

- **Why:** Larry found the 3D intro ugly (flat island, primitive bow and clouds).
- **New intro (`src/intro/introScene.ts`):** hand-painted layers in their own tiny three.js scene (orthographic camera, one shared quad). Each layer has a depth, so a slow dolly and sideways drift give parallax. Live parts: sea shader (wave ripples, rolling swell, sun sparkles) on a sea mask, the yacht's spray frames (cross-faded and broken up), procedural mist, drifting cloud cards. Plane: bursts out of a cloud, vapour slides past the window, wing bob and roll. Yacht: pitch and roll, spray pulses with the bow. When the game has loaded and the logo has faded, the camera pushes in on the airport or 開元港 on the painted island (3 s), then a short in-world glide (3.5 s, no vehicle, no landing) settles on the game camera. How-to: `docs/phase1/INTRO_25D.md`.
- **Assets:** `public/assets/intro25d/`, about 1.17 MB (budget ~1.5 MB). Built by `scripts/art/build-intro25d.py` (one command; uses `art-ref/arrival/layers25d/<mode>/` when Digital Painter's layers are there, else placeholders cut from the keyframes by `scripts/art/cut-intro-placeholders.py`). **Plane: Digital Painter's final layers** (2:06 AM), mapped by `scripts/art/intro25d-plane.json`: README parallax factors, 2560 frame inside the 3072 overscan, the real-skyline island `03_lanyu.png` (Larry's choice; not the keyframe alt), wing camera-locked, no window frame. **Yacht: placeholders** until `layers25d/yacht/` arrives (then rerun the script; add `scripts/art/intro25d-yacht.json` with its parallax factors). Vertical motion stays within 12 px of the 1440 frame. The old 3D intro assets (`public/assets/intro/`, 134 KB) are removed.
- **Disposal:** before: 11 textures; after: 0 (all freed). JS heap after a forced GC: 9.7 MB with the intro alive, 10.9–12.1 MB right after (the game has started by then).
- **Parked plane:** moved onto the runway at the 開元港 end, in front of the terminal, clear of houses (they keep 0.6 m from its box) and plants (nothing grows on the runway or around the plane). Collision box follows it. More detail on both props (nav lights, beacon, doors, exhausts, chocks; yacht rub rail, cleats, anchor, ladder, helm, lights).
- check-roads OK (0 stranded).

## PAUSED 2:44 AM — waiting for Larry to pick the intro island height (1.5× or 2×) — superseded 3:32 AM

_2026-11-15 ~2:44 AM America/Chicago. Nothing pushed. No further island / layer work until Larry chooses._

Stopped mid-implementation of the new opening choreography (Larry: shared Lanyu vista → pull back to the window / bow → bank or drive-off → notebook stamps 抵達蘭嶼). The painted islands currently in the tree are Digital Painter's **true 1:1 height** plates (`art-ref/arrival/layers25d/plane/03_lanyu.png`, `yacht/01_lanyu.png`). Do not rebuild or swap those until Larry picks 1.5× or 2× exaggeration.

### Already in the working copy (not in `dist/`; last vite build was 2:13 AM, before this choreography)

- **Choreography, code:** `src/intro/introScene.ts` (shared sky/sea/island drift behind the menus; pull-back reveal of the window frame + wing, or the bow + cycling spray; logo fades first; plane bank / yacht drive-off; fade out). `src/core/game.ts` opens the notebook after the fade, stamps Q01, then plays the arrival lines.
- **Q01:** renamed **抵達蘭嶼**, `silent: false`, `playable: false` — an auto-completed log entry, not a playable quest (`content/quests/open.json`). Notebook stamp animation in `src/ui/dom.ts` + `src/styles/app.css`.
- **Assets:** `public/assets/intro25d/`, **1.30 MB**, both sets marked `source: "final"` (plane includes `08_window_frame.webp`; yacht is the painted set, not placeholders). Built by `scripts/art/build-intro25d.py` (yacht plates capped at 1600 px so the pack stays under ~1.5 MB). Manifests: `scripts/art/intro25d-plane.json`, `intro25d-yacht.json`. How-to: `docs/phase1/INTRO_25D.md`.
- **Tests:** `scripts/test-intro.mjs` updated (pre-choice island, reveal, bank, drive-off, notebook, Q01 in the log as done). A clean full suite has **not** been run against this code + these assets. An older suite (started 2:13 AM, against the previous `dist/`) is still finishing `verify-phase1b` and should be left alone; its summary in `/workspace/tao014-logs/final-suite-25d.txt` is mixed and is not a sign-off for this build.
- Parked-plane / moored-yacht props and road checks from earlier in 0.1.4 are already in the tree.

### Remains, after Larry picks 1.5× or 2×

1. Ask Digital Painter for new island plates at that exaggeration (plane `03_lanyu`, yacht `01_lanyu`; no keyframe-alt; no extra exaggeration in code). Rebuild with `build-intro25d.py`.
2. `npm run build` (current `dist/` is stale).
3. Run the full check suite with `PATH` including `/workspace/.fontvenv/bin`, log to `/workspace/tao014-logs/final-suite-25d.txt`.
4. Screenshots in `screenshots-014/`: 20 pre-choice island, 21/22 keyframe-vs-game SBS, 23 plane bank, 24 loading bar, 25 iPhone, 26 parked plane, 27 yacht drive-off, 28 notebook-complete.
5. Update this progress entry with check results, shipped size, GPU memory freed on disposal, and that both routes used final layers.

## 0.1.4 2.5D intro finished — 1.5× island, new choreography (Larry 2:51 AM pick)

_2026-11-15, finished ~3:32 AM America/Chicago. Release still on hold: nothing pushed._

Larry picked **1.5×** island height. Digital Painter promoted the plates to the canonical names `art-ref/arrival/layers25d/plane/03_lanyu.png` (bbox top y≈492) and `yacht/01_lanyu.png` (top y≈436). The earlier `_x1.5` / `_x2` / true-height / keyframe-alt files were moved to `/workspace/tmp_arrival/archive_layers25d/` and are not used. `scripts/art/build-intro25d.py` still accepts a `_x1.5` filename if it reappears, and always ships `03_lanyu.webp` / `01_lanyu.webp`.

### Choreography (completed)

Shared Lanyu vista (sky / sea / real 1.5× island) behind the title, character select, and 搭飛機／搭船 menus, with a slow drift. After the choice the camera pulls back to the cabin window + wing, or the bow deck + cycling spray, and loops while the world loads (logo + title music, lower-left loading bar). When loading is done the logo fades first, then the plane banks toward the island, or the yacht drives forward out of frame. Fade into the notebook, which stamps **抵達蘭嶼** (Q01) complete; the notebook closes; culture statement + arrival + scooter-rental lines play; the party starts at 蘭嶼機場 or 開元港. Old saves still skip the intro. The intro scene is disposed afterwards.

Q01 stays `playable: false`, `silent: false` (auto-completed log entry, not a playable quest). `scripts/validate-content.mjs` now treats a non-playable quest whose steps are all `auto` as already completable when its req is met, so Q02+ are not reported as blocked.

### Assets

`public/assets/intro25d/`: **1.32 MB** (1,347.9 KB, 27 files), both routes `source: "final"`. Yacht plates still capped at 1600 px. Manifests updated to the canonical 1.5× names. How-to: `docs/phase1/INTRO_25D.md`.

### Removed (listed as requested)

- **`public/assets/intro/`** (old 3D intro pack, ~134 KB): already deleted earlier in 0.1.4; confirmed still absent.
- **Dead 3D-intro code:** `ArrivalScene`, `ArrivalShot`, and `APPROACH_SECONDS` removed from `src/world/arrival.ts`. That file now only keeps start spots and the static parked-plane / moored-yacht props. `src/core/game.ts` no longer imports `ArrivalScene`, no longer stores `arrival.scene`, and no longer exposes the in-world approach `duration` / `pose` on the debug `arrival()` object.
- **`public/assets/intro25d/`:** wiped and rebuilt by `build-intro25d.py`, so the previous 1:1 island WebPs (`plane/03_lanyu.webp`, `yacht/01_lanyu.webp`) were replaced by the 1.5× plates under the same names. No leftover unused intro25d files remain.

### Checks

Full suite logged to `/workspace/tao014-logs/final-suite-25d.txt` (and `/workspace/tao014-logs/final25d/`), started after the stale 2:13 AM suite was confirmed not running. `PATH` included `/workspace/.fontvenv/bin`.

- `tsc` 0; `npm run build` 0; `validate-content` 0 (163/163 quests completable, 0 placeholders); `check-fonts` 0 (1331 CJK); `check-roads` 0 (0 stranded).
- First `test-intro` in that run reported 2 fails: the check read `logoOut` / `minEnd` after `arrival()` had been cleared. The ride itself was fine (logo was held, then faded before the bank). The check now snapshots those values during the wait loop. Re-run: **ALL OK**.
- `test-walkout`, `test-quests`, `test-split`, `test-8dir`, `test-content`, `test-bgm`, `verify-phase1`, `verify-phase1b`, `smoke-phase1`: all OK.

### Disposal

Desktop plane: intro textures 12 → 0, geometries 1 → 0 (all GPU textures freed). JS heap after a forced GC: 9.7 MB with the intro alive, 11.8 MB right after it is disposed (the game has already started). iPhone plane: same 12 → 0 textures; heap 9.7 → 11.9 MB.

### Screenshots (`/workspace/tao-rpg/screenshots-014/`)

20-pre-island.png, 21-sbs-plane.jpg, 22-sbs-yacht.jpg, 23-plane-bank.png, 24-loading-bar.png, 25-iphone-size.png, 26-parked-plane.png, 27-yacht-driveoff.png, 28-notebook-complete.png. Both SBS frames are keyframe left, in-game right.

