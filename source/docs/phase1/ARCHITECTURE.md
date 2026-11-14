# How the game is put together (Phase B, 2026-11-14)

The short version: **all game content is data in `content/`**. The code reads it, checks it, and runs it.
Adding a quest, an item, an NPC or a side story means editing JSON. You do not touch `src/`.

## The parts

| Part | File | What it does |
|---|---|---|
| Content loader | `src/content/loader.ts` | Bundles every `content/**/*.json` at build time (Vite `import.meta.glob`). It merges each folder into one list and hands the game a single `ContentDB`. Game content is no longer fetched from `public/data`. |
| Content check | `src/content/validate.ts` | Runs once at boot. Ids must be unique and every reference must resolve (quests, items, NPCs, places, dialogue, outfits, recipes, gather nodes). It also catches time windows that can never open, and the traveller wearing Tao clothing. A bad edit stops the game with a readable list. |
| Full design check | `scripts/validate-content.mjs` | Deeper check: every quest can be finished, splits regroup, 分工, wording. Run it after editing content. |
| Quest engine | `src/quests/engine.ts` | Prerequisites, steps, rewards and the save. Pure logic. |
| Party split | `src/systems/partySplit.ts` | Who is with the party, who is away or waiting, the solo trip, the regroup point. Saved inside the quest save. `Game` draws it: HUD chips, banner, regroup marker. Switching characters moves the camera to that member. |
| Time and season windows | `src/systems/timeWindow.ts` | `time` (day / night / any), `seasons` (summer / winter), `periods`, `tide`. Seasons follow the art style's `SEASON_KIND` in `styleConfig.ts`: the winter look counts as `winter`, everything else as `summer`. Low tide is a placeholder: dawn and dusk. |
| Inventory and 圖鑑 | `src/systems/inventory.ts`, `src/ui/codex.ts` | Bag counts and the "seen" list. The 背包 tab in the 手札 shows the pixel icon `assets/items/icons/<id>.png` and the illustration `assets/items/<id>.webp`, loaded only when an entry opens. Missing art shows a placeholder. |
| Gathering | `src/systems/gathering.ts` | Gather and observe nodes from `content/gatherNodes`. A gather node shows only while an active recipe still needs its item. Each node has a time / season / tide window, a daily limit that resets when night ends, and optional `requires`. |
| Photo spots | `src/systems/photoSpots.ts` | A photo step's `spot` is a place id or a landmark id. `content/photoSpots` adds that quest's window. |
| Recipes | `src/systems/recipes.ts` | What open recipe quests still need, where each item comes from (item `sources`), shop sales, and the keeper's state. The keeper teaches in the recipe quest's last talk step, after the items are collected. |
| Outfits | `src/systems/outfits.ts` | Unlocked by a quest reward `gives.outfits`, worn from the 背包 tab, saved. Wearing an outfit swaps the portrait and the walk sheet. If the art is missing, the base look stays. The traveller only gets accessories (portrait and walk sheet per gender: `portraitByGender`, `sheetByGender`), never Tao clothing. Riding and paddling use the base outfit's sheets until variants exist. |
| NPC chat | `src/systems/dialogue.ts` | Used when no quest step runs. Plays old line lists, or new sets: greet, duty, idle by time and season, `after.<quest>`, recipe keeper invite / missing / teach. |
| NPCs in the world | `src/entities/npcs.ts` | One entry per NPC in `content/npcs/*.json`. Sprites stream in near the camera and unload with hysteresis (see Performance). A missing walk sheet falls back to `fallbackSheet`, else `tourist` for outsiders or `uncle`. A missing portrait hides the portrait frame. |
| Game | `src/core/game.ts` | Wires the parts together: input, camera, dialogue box, markers, save. |

## Add a quest
1. Add an object to the `quests` list of a file in `content/quests/` (or a new file; any `*.json` there is picked up).
2. Required fields: `id`, `line` (main / side / photo), `arc`, `roles`, `req`, `steps`, `hint`, `playable`, `name.zh`.
   Optional fields: a window (`time`, `seasons`, `periods`, `tide`) and `giver` (f or m, for 分工).
3. Step kinds: `talk` (npc), `spot` / `photo` (spot + r), `auto` (with `until`), and `tasks` (one part per member).
   Party effects: `split`, `solo`, `regroup`. Rewards: `gives` (items, recipe, glossary, outfits, flags, toast).
4. Speakers in `lines`: an NPC id, `@npc`, `@host`, `@hostf`, `@giver`, `@m`, `@f`, `@t`, `@me`, `旁白`.
5. Run `node scripts/validate-content.mjs`, then `node scripts/check-roads.mjs` if you used a new place.

Full field list: `CONTENT_SCHEMA.md`.

## Add an item
Add it to a file in `content/items/` with `id`, `name`, `category`, `collectible`, `description`, `codex`,
`icon: icon_<id>`, `illustration: illus_<id>` and `sources`. Drop the art in as `public/assets/items/icons/<id>.png`
and `public/assets/items/<id>.webp` whenever it is ready; the game shows a placeholder until then.

## Add an NPC (passers-by, kids, the geologist …)
Add one entry to `content/npcs/passersby.json` (or any file in `content/npcs/`). Set `id`, `name`, `kind`, `home`
(a place id) and `schedule`. Set `outsider: true` for non-Tao visitors. Optional fields:
- `sheet`, `portrait`, `dialogue` (an id in `content/dialogue/`)
- `talkable: false` for pure background
- `fallbackSheet`
The art goes in through the art worker's atlas (`scripts/octo/build_atlas.py` now reads `content/npcs/`).

## Add a side story
A side story is a few quests chained by `req`, plus a dialogue set (with `after.<quest>` lines) and maybe a new place.
- New place: add it to `content/places.json` `places`, then run `check-roads`.
- Gather or observe spot: add a node to `content/gatherNodes/`.
- Photo moment: add a `photo` step and an entry in `content/photoSpots/`.

## Places
The five Phase A places are now real places in `content/places.json`, checked reachable and near a road:
- `iranmeylek_beach` (23, −23)
- `iratay_shore` (−24.5, 25.5): water within 9 m, so a tatala can launch
- `iratay_school` (−17.5, 24.5)
- `wakay_iratay` (−24, 15): moved, because the first guess was on a slope
- `owl_road` (−33, 10)

`check-roads` now reads `content/`, including every quest spot, split-task spot and gather node.

## Performance
- NPC sprites stream by distance from a point a little ahead of the camera.
  - They load inside 12 m + 0.75 × camera distance and unload 12 m further out (hysteresis).
  - Unloading disposes the texture clone, geometry and material, and releases the atlas when the last holder lets go.
- Portraits and item art are `<img>` elements loaded on demand.
- Content ships as its own JS chunk, so a text edit does not re-download the engine.

## Defaults for Larry's open questions (still open, please confirm)
1. M3 no longer requires MS1. MS1 (the 3-way preparation) is optional and only leads to IM-M1 and OF1.
2. Traditional outfits can be worn anywhere once unlocked. A note in the 背包 tab asks players to treat them with respect.
3. The seasons (summer / winter, no snow) stay as designed.
4. The owl spot (`owl_road`, night, observe only, no flash) stays as designed.
5. The 漁人 gathering stays a modern community event.

Also new: night tide pools. the placeholder tide has low tide only at dawn and dusk, so NT2 and the night tide-pool nodes
   now open at dusk (`periods: ["dusk"]`). Change this when the real tide clock arrives.

## Passers-by and kids (wired 2026-11-14)
`content/npcs/passersby.json` adds 13 new NPCs, all as data entries:
- 9 non-Tao visitors, in pairs or families around 開元港 / 椰油, the 東清 beach, 紅頭 to 漁人 and the airport
- 4 kids
- the geologist entry (now drawn as a man) is unchanged

They use their own single walk sheets for now. Running `python3 scripts/octo/build_atlas.py` (it reads `content/npcs/`) would pack them into the village atlases. I left that to the art worker.

The two quest kids each have a short side story in `content/quests/kids.json`:
- KD1 小旅客的望遠鏡: watch the tatala from afar at 東清灣
- KD2 愛畫畫的女孩: observe hermit crabs at low tide on the 漁人 shore, take nothing

## For the Tao cultural consultant (new in Phase B)
- KD1: how the tatala etiquette is worded (look from afar, never touch or sit in one for photos), and whether visitors should keep off the beach altogether during the flying-fish season.
- KD2: tide-pool rules (leave shells, put stones back).
- Traditional outfit portraits `local_trad` / `local_f_trad` and walk sheets `player_trad` / `player_f_trad`: the look itself, and the default that they can be worn anywhere.
- NT2 moved to dusk because of the placeholder tide.

## What the E key picks (interaction order)

1. A nearby NPC (2.4 m). A passer-by does not count when the player is standing on a gather node.
2. A quest spot. If two quests share a spot, the one the current member can do now wins. Only the traveller takes photos.
3. A gather node. It wins over a quest spot when that quest step can't run now, or when the player is closer to the node.
4. Decor (signs, etc.).

Code: `nearestTarget()` and `nearestQuestSpot()` in `src/core/game.ts`.
