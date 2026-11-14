# Party split (族男・族女・旅人 分頭行動)

Batch "Party split & recipes", 2026-11-14. Data-driven: quests opt in with step fields; the engine keeps member
state in the save; game.ts only renders it (followers, HUD, markers) and enforces who may act.

## Member state (QuestEngine.members, saved)

| st | meaning | follows leader | switchable |
|---|---|---|---|
| `party` | with the group (default) | yes | yes |
| `away` | left for `task` at place `at` (quest `quest`) | no (stays at `at`) | only when `ctrl: true` |
| `wait` | done with its part / waiting at `at` (regroup point, shore) | no | `ctrl` decides |

Plus `solo` (one member alone, others locked) and `meet` (regroup place id). Older saves have none of these and
load as "everyone in the party". `tasksDone` remembers finished member parts of a `tasks` step.

## Step fields (src/quests/types.ts → QuestStep)

| field | effect when the step completes |
|---|---|
| `split: { m?: {at, task, ctrl}, f?: …, t?: … }` | those members go `away` to `at`; `ctrl: true` = player can switch to them (3-way split), `false` = busy |
| `meet: '<place>'` | regroup point; HUD banner「集合點：…」+ marker |
| `solo: { role, at, task, waitAt }` | only `role` is controllable (族男出海); the others `wait` at `waitAt`; banner shows 「放棄出海」 |
| `regroup: true` | everyone back to `party`, solo / meet cleared |
| `requires: ['f']` | step blocked while that member is away (reason shown) |
| `kind: 'tasks'`, `tasks: [{ role, kind, npc/spot, …, done: {at, task} }]` | parallel member parts; each finished part sets that member `wait` at the regroup point; step completes when all are done |
| `minigame: 'fish' / 'taro'`, `canoe: true` | spot step that plays the mini-game; success completes it (canoe = board the tatala) |

Quest-level: `abortTo` (step a solo give-up returns to), `giver: 'f' | 'm'`, `recipe`.

NPC tokens: `@host` (host family's elder), `@giver` (quest's 女／男耆老 for the host village),
`@hostf` (host village's a akes, waits on the host porch `host_weave`).
Elders come from npcs.json `elder: 'f'` + `home` → quests.json `elders.f`, male = `elder_<village>`.

## Playable scenarios (scripts/quests/playable-split.mjs)

- **Q07 3-way main-story split**: elders send 族男 → 開元港, 族女 → host porch (a akes), 旅人 → 椰油雜貨店 (all `ctrl`).
  Switching member jumps the camera to them. Each finished part → `wait` at `host_home`; regroup there → rules talk.
- **J1 member busy, others help**: 族女 receives the job from the a akes, stays busy on the porch (not switchable);
  族男／旅人 buy water at the shop and bring it → 族女 rejoins → 回報.
- **M1 → M2 → M3 solo sea trip**: 男耆老 gives boat prep (M1); M2 completes itself when the flying-fish season
  starts; M3 = 族男 alone on the tatala (fish mini-game), 族女 + 旅人 wait at the harbour. 「放棄出海」 regroups and
  sends M3 back to `abortTo`. Narration only, no ritual simulation.

## UI

Party chips show status under the name (在隊上／離隊：…／在…等), dimmed when away, lock icon when not switchable
(tap shows the reason). A banner under the chips shows the regroup point or the solo task (+ 放棄出海).
Markers: regroup point, away members, gather spots.

## Debug

See TEST_HOOKS.md (forceSplit / forceSolo / forceRegroup / members / completeStep / runStep / runQuest).
Covered by scripts/test-split.mjs (also save/load mid-split).
