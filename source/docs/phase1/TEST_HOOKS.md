# Test hooks (window.__TAO_RPG__)

Only in dev builds (`npm run dev`) or with `?debug` in the URL; a normal player build has none of these. Available with `?debug` in the URL (scripts/lib/harness.mjs `debugUrl()`); wait for `window.__TAO_RPG__.ready`.
Parallel agents: each script uses its own port (`PORT=` env) and its own browser profile; saves are per origin, so
call `clearSave()` + reload at start. All hooks are synchronous unless noted.

## World / movement
| hook | does |
|---|---|
| `goto(id)` | teleport to a place id (content/places.json, incl. iranmeylek_beach, iratay_shore, iratay_school, wakay_iratay, owl_road; + derived: host_home, host_taro, host_weave, yayo_shop, tide_iranmeylek …), an NPC id, or a quest id (its current target); party snaps around |
| `teleport(x, z)` / `playerPos()` | raw position |
| `setWorld({ season?, period? })`, `setSeason(s)`, `setTime(p)` | season `meyvanwa` / `rayon` / `manoyotoyon` / `off`, or the content tags `summer` (→ rayon) / `winter` (→ off); period dawn/day/dusk/night |
| `clock()` | `{ season, seasonTag, period, time }` as content sees it |
| `fitWhen(questId)` | set season/time so the quest's window (time / seasons / periods / tide + its photo spot) is open |
| `setCamera({ dist, yaw, pitch, x, z, snap })` | camera |
| `canStandAt(x, z)` | collision probe |

## Items / recipes
| hook | does |
|---|---|
| `giveItem(id, n=1)` / `items()` | bag (ingredients: alibangbang, soli, wakay, ovi, shellfish, seaweed) |
| `recipes()` | learned recipes, seen ingredients, `need` = what open recipe quests still need |
| `gatherSpots()` | live gather / observe nodes `{ id, item, kind, x, z, r, label }` (gather: only still-needed items; window + daily limit) |
| `gather(nodeId)` | use a live node now (bag +1, or 圖鑑 for observe) |
| `codex()` | 圖鑑 entries `{ id, known, n }` |
| `chat(npcId)` | the NPC's chat lines right now (greet / duty / idle / keeper / after) |
| `content()` | counts of what content/ loaded |
| `autoMinigame(on=true)` | next mini-games succeed by themselves |
| `interactables()`, `nearTarget()`, `interactNearest()` | world spots; what E would do; press E |

## Quests
| hook | does |
|---|---|
| `quest(id)` | `{ id, status, step, playable, block }` (block = why it can't run now) |
| `questTarget(id)` | current target `{ kind: 'npc'|'spot', id, x, z }` |
| `questIds()`, `questCounts()`, `questState()` | lists / counts / raw state |
| `startQuest(id, k=0)` | activate now (prereqs skipped), optionally at step k |
| `completeStep(id, role?)` | finish the current step (or `role`'s part of a tasks step) without playing; party effects apply |
| `completeQuest(id)` | mark done |
| `runStep(id, { fitWhen })` | play the current step for real (go there, switch to an allowed member, talk / use spot / mini-game, drain dialogue) → `{ ok, why, step, status, controlled }` |
| `runQuest(id, { fitWhen, max })` | runStep until done or stuck → `{ done, trace }` |
| `talkTo(npcId)`, `useSpot()`, `advanceDialogue()`, `closeAll()`, `mode()` | low-level |

## Party split
| hook | does |
|---|---|
| `members()` | `{ controlled, solo, meet, split, banner, m/f/t: { st, at, task, ctrl, quest, pos, block, status } }` |
| `switchMember(r)` | same as tapping a chip (respects blocks) |
| `forceSplit({ f: { at, task, ctrl } }, meet?)` | split without a quest |
| `forceSolo(role='m', at='harbor', waitAt='harbor', task)` | solo without a quest |
| `forceRegroup()` / `abortSolo()` | everyone back / 放棄出海 |
| `gatherParty()` | snap followers around the leader |

## Outfits
| hook | does |
|---|---|
| `unlockOutfit(id)` | unlock as a quest reward would (outfit_m_tao, outfit_f_tao, acc_t_band, acc_t_strap) |
| `wearOutfit(role, id \| null)` | wear / take off (async → true / false; the traveller is refused Tao clothing) |
| `outfitLook(role)` | `{ sheet, portrait, worn, shown, unlocked }`: `sheet` is the walk sheet the outfit asks for (the base if its art is missing); `shown` is the sheet on screen now |

## Performance / streaming
| hook | does |
|---|---|
| `npcLoaded()` | `{ loaded, total, sheets, refs, groups (atlas groups held), ids }` |
| `renderInfo()`, `memory()` | three.js renderer.info |

scripts/perf-mobile.mjs adds WebGL byte accounting (`window.__gpu`) + frame sampling; `node scripts/perf-mobile.mjs <label>` → perf-<label>.json.

`node scripts/test-content.mjs` exercises the Phase B hooks above (content, places, windows, gathering, 圖鑑, outfits).
