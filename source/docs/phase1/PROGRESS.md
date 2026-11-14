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
