# Cleanup candidates after 0.1.4

_Drafted 2026-11-15 3:41 AM America/Chicago. Nothing in this list has been deleted. Larry needs to approve before anything is removed._

## Leave these alone

- `/workspace/tao-rpg` as a whole — the live working copy. Only the leftover folders inside it, listed below, are candidates.
- `/workspace/tao-rpg-0.1.4-final.tar.gz` — the 0.1.4 backup tarball (also being copied to the Mac).
- `/workspace/PongsoNoTao-publish` — the GitHub clone used to ship the game.
- `/workspace/world-015`, `/workspace/content-015`, `/workspace/audio-015` — already reserved for 0.1.5.
- `/workspace/content-0151` — a small 0.1.5-adjacent snapshot; leave it with the 0.1.5 folders.
- `/workspace/tao-rpg/art-ref/arrival/layers25d/` — final painted intro layers, needed to rebuild the shipped pack.
- `/workspace/tao-rpg/screenshots-014/` — official 0.1.4 arrival screenshots.
- `/workspace/tao-rpg/fonts-src/` — masters for the six shipping fonts (needed to rebuild the subset WOFF2 files).
- `/workspace/tao-rpg/scripts/audio/approved/title_intro_v7.wav` — approved title-intro master used to remake the title music.
- `/workspace/tao-rpg-backup-0.1.4/stage-0.1.4.sh` and the 0.1.4 README / notices beside it (the bulky `before-0.1.4.tar` is listed below).
- `/workspace/.fontvenv` — font-check environment used by the release suite.
- `/workspace/.fluidsynth` and `/workspace/.soundfonts` — tools for remaking the music; keep them unless Larry is done with audio work.

Other large folders on this shared box (pld, ssx, conda, research venvs, and so on) belong to other projects and are **not** listed here and **not** included in the total.

## Total reclaimable

**4.92 GB (5,282,891,963 bytes)** if every low- and medium-risk item below is removed. Of that, 3.28 GB (3,517,877,333 bytes) is low risk and 1.64 GB (1,765,014,630 bytes) is medium risk. One high-risk item (1.2 MB (1,278,261 bytes)) is listed for awareness but is **not** included in the total.

## Candidates (largest first)

| Path | Size | Why it is safe | Risk |
| --- | --- | --- | --- |
| `/workspace/tmp_arrival` | 1.28 GB (1,375,547,859 bytes) | Digital Painter and landscape scratch for the 0.1.4 arrival intro (plane/yacht work folders, DEM, super-resolution, reference stills, and the retired island-height plates). The final painted layers already live in /workspace/tao-rpg/art-ref/arrival/layers25d/ and were shipped as public/assets/intro25d/. Includes /workspace/tmp_arrival/archive_layers25d (29 MB): the _x1.5 / _x2 / true-height / keyframe-alt plates moved aside when Larry picked 1.5× and Digital Painter promoted those plates to the canonical names. Safe once Larry is sure he does not want to revisit the unused height variants or the painter work files. Do not delete this until that is confirmed; the 29 MB archive is the lowest-risk part. | medium |
| `/workspace/tao-rpg-backup-0.1.1` | 656.0 MB (687,862,229 bytes) | 0.1.1 staging folder: before-0.1.1.tar, deleted-files.tar, and tao-rpg-0.1.1-final.tar.gz. Superseded by the 0.1.3 and 0.1.4 releases and by /workspace/tao-rpg-0.1.4-final.tar.gz. The tiny stage-0.1.1.sh / README can be kept if wanted (a few KB); the bulk is old tarballs. | low |
| `/workspace/tao-rpg-0.1.3-final.tar.gz` | 651.3 MB (682,962,071 bytes) | The 0.1.3 final tree tarball. The user asked to drop old release tarballs other than 0.1.4. Keep /workspace/tao-rpg-0.1.4-final.tar.gz. 0.1.3 remains on GitHub as tag v0.1.3. | low |
| `/workspace/tao-rpg-backup-castrev` | 556.3 MB (583,342,080 bytes) | A single before-castrev.tar taken before the NPC-cast art review. That work shipped in 0.1.4; the live art is in the working copy and the 0.1.4 tarball. | low |
| `/workspace/tao-qa` | 286.7 MB (300,583,440 bytes) | A separate checkout used for QA, with its own qa/, font-samples/, fonts-src/ and art-src/. It is not the live working copy (/workspace/tao-rpg) and is not the GitHub clone. Safe if Larry no longer needs that QA tree; medium because it may hold QA notes or captures not copied elsewhere (look at tao-qa/qa/ and tao-qa/docs/ first). | medium |
| `/workspace/tao-rpg-backup-style` | 142.1 MB (148,961,280 bytes) | before-style.tar, taken before the style-v7 / walking-figure work. The chosen style is in the live tree. | low |
| `/workspace/tao-rpg-backup-0.1.4/before-0.1.4.tar` | 127.5 MB (133,703,680 bytes) | Snapshot of the tree just before 0.1.4 work started. Superseded by the 0.1.4 final tarball. Keep the small staging files next to it (stage-0.1.4.sh, README-repo-0.1.4.md, NOTICES-0.1.4.md) — they were used for this release and may be useful for 0.1.5. | low |
| `/workspace/tao-rpg-backup-octo` | 126.7 MB (132,853,820 bytes) | Full tree backup from the octopath-style / chibi walking-figure experiments, including scripts/chibi and generate_chibi.py. The shipping figures are the v7 sheets in public/assets/sprites/. Not needed to rebuild the live game. | low |
| `/workspace/tao-rpg/screenshots-phase1` | 119.9 MB (125,718,016 bytes) | Phase 1 review screenshots from early 0.1.x. Not the 0.1.4 arrival set (that is screenshots-014/, which should be kept). | low |
| `/workspace/tao-rpg-backup-styleA` | 88.0 MB (92,305,470 bytes) | Backup from the style-A experiment. The shipping style is v7 in the live tree. | low |
| `/workspace/tao-rpg-backup-p2` | 87.6 MB (91,802,907 bytes) | Backup from an earlier 0.1.x pass (p2). Superseded by later trees and the 0.1.4 tarball. | low |
| `/workspace/tao-rpg-backup-p1` | 86.8 MB (91,001,542 bytes) | Backup from an earlier 0.1.x pass (p1). Superseded by later trees and the 0.1.4 tarball. | low |
| `/workspace/tao-rpg/screenshots-octo` | 79.7 MB (83,521,302 bytes) | Walking-figure / octopath-style comparison shots from the style review. The chosen sheets already shipped. | low |
| `/workspace/tao-rpg/screenshots-style` | 73.8 MB (77,431,667 bytes) | Style-proposal screenshots from before v7 was locked. | low |
| `/workspace/tao-rpg/font-samples` | 71.3 MB (74,804,476 bytes) | Font bake-off files: unused trial faces (Klee One, LXGW WenKai, jf-openhuninn, Caveat, Kalam, and others) plus comparison images. The shipping faces are Iansui, Literata, and Noto Sans/Serif TC, whose masters live in fonts-src/ (keep fonts-src/). Medium only because it is the record of the font choice. | medium |
| `/workspace/tao014-logs` | 58.6 MB (61,443,445 bytes) | 0.1.4 intro/build/test logs, probe frames, and earlier suite output. The signed-off suite is also in this folder (final-suite-25d.txt, final25d/). Low risk after the 0.1.4 tarball and GitHub release exist; keep a copy of final-suite-25d.txt if the rest is deleted. | low |
| `/workspace/tao-rpg-backup-phase1` | 44.1 MB (46,214,227 bytes) | Backup from the phase-1 pass. Superseded by later backups and the 0.1.4 tarball. | low |
| `/workspace/tao-rpg/screenshots-phase1b` | 38.5 MB (40,408,689 bytes) | Phase 1b review screenshots. Not used by the live game. | low |
| `/workspace/tao-rpg/screenshots-styleA` | 36.4 MB (38,128,716 bytes) | Style-A comparison screenshots. Style A was not chosen. | low |
| `/workspace/tao-rpg/screenshots-party` | 32.0 MB (33,596,906 bytes) | Character-select and party-portrait captures from 0.1.1-era art reviews. The shipping portraits are in public/assets/portraits/. | low |
| `/workspace/tao-rpg/screenshots-guide` | 29.1 MB (30,546,884 bytes) | Guide-page captures from earlier review passes. | low |
| `/workspace/tao-rpg/screenshots-notebook` | 27.6 MB (28,890,367 bytes) | Notebook / journal UI captures from earlier review passes. | low |
| `/workspace/tao-rpg-backup-art-prev` | 24.2 MB (25,407,792 bytes) | art-prev-2026-11-14.tar.gz, the previous art tree Larry was asked to consider. Replaced by the current art-src/ and the 0.1.4 tarball. | low |
| `/workspace/tao-rpg/screenshots-cast` | 22.8 MB (23,900,594 bytes) | NPC-cast review screenshots. The revised cast is in the live tree. | low |
| `/workspace/tao-rpg-backup-split` | 20.9 MB (21,896,921 bytes) | Backup from the split-party work, which shipped in 0.1.3. | low |
| `/workspace/tao-rpg/screenshots-traveller` | 20.2 MB (21,206,213 bytes) | Traveller-portrait review screenshots. | low |
| `/workspace/tao-rpg-backup-cast` | 19.0 MB (19,896,320 bytes) | Earlier NPC-cast backup, before the larger castrev tarball. | low |
| `/workspace/tao-rpg/screenshots-0.1.1` | 16.3 MB (17,079,890 bytes) | Official 0.1.1 review screenshots (harbour exit, facing, and so on). Kept historically; 0.1.1 is tagged on GitHub. | low |
| `/workspace/tao-rpg/art-ref/arrival/placeholder25d` | 13.7 MB (14,413,407 bytes) | Placeholder 2.5D cut-outs used before Digital Painter finished the plane and yacht layers. The live pack is built from art-ref/arrival/layers25d/. | low |
| `/workspace/tao-rpg/screenshots` | 12.8 MB (13,370,761 bytes) | Older generic screenshot folder, predating the dated review folders. | low |
| `/workspace/tao-rpg-local.prev-before-traveller.zip` | 12.5 MB (13,124,662 bytes) | Snapshot zip of an older local tree, taken before the traveller-art pass. | low |
| `/workspace/tao-rpg-local.prev-before-guidefix.zip` | 12.1 MB (12,664,789 bytes) | Snapshot zip taken before the guide-link fix. | low |
| `/workspace/tao-rpg-local.zip` | 12.0 MB (12,584,233 bytes) | A 'current' local zip that is now stale (0.1.4 is much newer). Medium only until Larry confirms he does not still use this zip elsewhere. | medium |
| `/workspace/tao-rpg-local.prev-before-notebook.zip` | 9.2 MB (9,664,180 bytes) | Snapshot zip taken before the notebook work. | low |
| `/workspace/tao-rpg-local.prev-before-phase1b.zip` | 9.0 MB (9,453,090 bytes) | Snapshot zip taken before phase 1b. | low |
| `/workspace/tao-rpg/screenshots-v4` | 8.0 MB (8,385,962 bytes) | Style v4 comparison screenshots. v7 is the locked in-game style. | low |
| `/workspace/tao-rpg-local.prev-before-p1.zip` | 7.7 MB (8,036,461 bytes) | Snapshot zip taken before the p1 pass. | low |
| `/workspace/tao-rpg-local.prev-before-phase1.zip` | 7.0 MB (7,328,565 bytes) | Snapshot zip taken before phase 1. | low |
| `/workspace/tao-rpg-backup-traveller` | 6.7 MB (7,024,640 bytes) | Backup from the traveller-portrait pass. | low |
| `/workspace/tao-rpg/screenshots-ios` | 6.6 MB (6,893,878 bytes) | Older iPhone-size captures from before the 0.1.4 intro shots (the 0.1.4 iPhone frames are in screenshots-014/). | low |
| `/workspace/tao-rpg-backup-party` | 6.4 MB (6,675,948 bytes) | Backup from the party-portrait pass. | low |
| `/workspace/preview` | 6.2 MB (6,542,714 bytes) | Listening previews from the 0.1.4 music work: title_v7_backup.mp3, title_v8.mp3, menu_to_title_v2–v4.mp3, menu_sfx_demo.mp3. The shipping loops and stings are in /workspace/tao-rpg/public/assets/audio/. The approved title-intro master used to rebuild the title track is scripts/audio/approved/title_intro_v7.wav — keep that. | low |
| `/workspace/tao-rpg/screenshots-v2` | 6.2 MB (6,529,300 bytes) | Style v2 comparison screenshots. | low |
| `/workspace/tao-rpg-local.prev-before-octo.zip` | 5.4 MB (5,698,811 bytes) | Snapshot zip taken before the octopath-style experiment. | low |
| `/workspace/tao-rpg/screenshots-v3` | 5.4 MB (5,656,461 bytes) | Style v3 comparison screenshots. | low |
| `/workspace/tao-rpg-local.prev-before-styleA.zip` | 5.1 MB (5,347,005 bytes) | Snapshot zip taken before style A. | low |
| `/workspace/tao-rpg-local.prev-before-p2.zip` | 5.1 MB (5,329,113 bytes) | Snapshot zip taken before the p2 pass. | low |
| `/workspace/tao-rpg/art-ref/arrival/layers` | 4.3 MB (4,549,837 bytes) | Early arrival plates (far-island silhouettes, cloud cards, sea-glint tile) from the first painted/3D intro. Replaced by layers25d/ for the shipping 2.5D pack. | low |
| `/workspace/tao-rpg-local.prev-before-portrait-revert.zip` | 4.2 MB (4,398,534 bytes) | Snapshot zip taken before a portrait revert. | low |
| `/workspace/tao-rpg/screenshots-split` | 3.9 MB (4,101,183 bytes) | Split-party review screenshots from 0.1.3. | low |
| `/workspace/tao-dist-before-tint` | 3.7 MB (3,929,578 bytes) | A dist/ tree captured before a sprite-tint change. Regenerable, and not the 0.1.4 dist. | low |
| `/workspace/tao-rpg-backup-audit` | 2.0 MB (2,048,000 bytes) | Backup from the 0.1.1 audit pass. | low |
| `/workspace/tao-rpg-backup-phase1b` | 1.9 MB (1,955,840 bytes) | Backup from phase 1b. | low |
| `/workspace/tao-rpg/style-proposals-v2` | 1.4 MB (1,417,972 bytes) | Octopath / Mana / FF6 style-proposal images and generators. v7 was locked; these are not used to build the game. | low |
| `/workspace/sfx-about-backup-2026-11-13` | 1.2 MB (1,278,261 bytes) | Looks like a backup of a different package (PyPI / Zenodo README, CITATION.cff, notebooks), not Pongso no Tao. Do not delete with the game leftovers unless Larry confirms it is disposable. | high |
| `/workspace/backups` | 965.6 KB (988,766 bytes) | Small mid-development snapshots: legacy public data and generator, NPC atlas, a guide font, and pre-fix copies of two test scripts. The live files have moved on; medium because one or two of these were safety copies during edits. | medium |
| `/workspace/tao-rpg-backup-knees` | 920.0 KB (942,080 bytes) | Backup from the sprite-knee cleanup. | low |
| `/workspace/tao-rpg/screenshots-content` | 622.8 KB (637,763 bytes) | Content-review screenshots. | low |
| `/workspace/tao-rpg/art-src/_backup` | 521.5 KB (534,054 bytes) | Older canoe-art backup (canoe_modern_v014) inside art-src. The live canoe sheets are in public/assets/sprites/characters/. | low |
| `/workspace/content-014` | 494.0 KB (505,856 bytes) | Scripts that authored the 0.1.4 placeholder-quest pass. The results already live in /workspace/tao-rpg/content/. Medium because it is a reconstructable history of that pass, not 0.1.5 work. | medium |
| `/workspace/tao-rpg/style-proposals` | 418.3 KB (428,291 bytes) | Early style options plus style-proposals/chibi-portraits-archive and gen_style_proposals.py. The chibi portrait experiment was not used; v7 is locked. | low |
| `/workspace/tao-rpg/screenshots-audio` | 386.2 KB (395,489 bytes) | Audio-panel captures from the music work. Tiny; the 0.1.4 intro screenshots are in screenshots-014/. | low |
| `/workspace/tao-rpg/art-src/style-test` | 289.3 KB (296,245 bytes) | Small style-test drawings, not referenced by the build. | low |
| `/workspace/README_0.1.3.md` | 19.2 KB (19,692 bytes) | A leftover 0.1.3 readme at the workspace root. The live repo README is in the GitHub clone and the 0.1.4 backup folder. | low |

## Notes on groups

### `/workspace/tmp_arrival` (1.28 GB), including `archive_layers25d`

This is the largest single candidate. Approximate breakdown:

- `p25/` (~655 MB) and `y25/` (~322 MB) — painter work for the plane and yacht 2.5D layers.
- `dem/` (~179 MB) and `sr/` (~110 MB) — elevation and super-resolution scratch used to study the real Lanyu skyline.
- `archive_layers25d/` (29 MB) — the unused island-height plates (`_x1.5` / `_x2` / true-height / keyframe-alt) moved here when the 1.5× plates were promoted to `03_lanyu.png` and `01_lanyu.png`. This subfolder is the one named in the cleanup request; it is included in the parent total, not counted twice.
- Keyframe and reference stills (a few MB) — copies also exist under `art-ref/arrival/` (keep those).

### Stale screenshots inside `/workspace/tao-rpg`

Together the stale `screenshots*` folders listed above are about 562 MB. **Keep `screenshots-014/`.** The others are review captures from 0.1.1 through the style, party, guide, notebook, and intro-prototype passes.

### Chibi / unused generators

There is no live chibi generator in the 0.1.4 tree. `scripts/generate_octo.py` and `scripts/key_art.py` are still used for the shipping walk sheets and portraits — do not delete those. The unused chibi archive is `style-proposals/chibi-portraits-archive`. The old `generate_chibi.py` only exists inside `tao-rpg-backup-octo`.

### Unused fonts and scripts

`font-samples/` holds trial fonts that were not chosen. Do not delete `fonts-src/` or `public/fonts/`. One-off capture scripts (`capture-style.mjs`, `capture-octo` helpers, and so on) are small; they can go with the stale screenshot folders if Larry wants a tidier `scripts/` directory, but they are not a meaningful size saving. `scripts/audio/__pycache__/` is trivial generated cache.

### Dead code

The old 3D intro (`ArrivalScene` / `public/assets/intro/`) was already removed before the 0.1.4 release. No further large dead-code tree is sitting in `src/`. A few leftover authoring helpers (`scripts/content/migrate-legacy.mjs`, mid-dev copies under `/workspace/backups/`) are small and listed above.

### Old preview audio

`/workspace/preview/` has the rejected or superseded title and menu listening copies. The shipping files are `public/assets/audio/bgm/` and `.../sfx/`. Keep `scripts/audio/approved/title_intro_v7.wav`.

### Old release tarballs

Listed: `/workspace/tao-rpg-0.1.3-final.tar.gz` and the 0.1.1 tarball inside `/workspace/tao-rpg-backup-0.1.1`. **Do not delete `/workspace/tao-rpg-0.1.4-final.tar.gz`.**

