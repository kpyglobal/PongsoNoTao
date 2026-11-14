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
