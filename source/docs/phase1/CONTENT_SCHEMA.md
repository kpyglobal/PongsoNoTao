# Content schema (Phase A, 2026-11-14)

All game text and design data live in `content/` at the repo root, one folder per content type.
The framework (later refactor) loads **every `*.json` in a type folder (recursively) and merges them**, so adding a
quest, item, NPC line or side story means adding a file or an entry. No code change.
Check everything with `node scripts/validate-content.mjs` (`--review` lists items flagged for a Tao cultural consultant).

`content/` was seeded once from `public/data/*.json` by `scripts/content/migrate-legacy.mjs` (refuses to re-run).
From now on `content/` is the source of truth; the game still reads `public/data/` until the refactor wires the loader.

## Layout

| path | merge key | what |
|---|---|---|
| `meta.json` | – | roles, respect levels, villages, `times`, `periods`, `seasons`, speaker tokens, `elders` (village → a akey / a akes), `externalFlags` (flags set by game code, not quests) |
| `places.json` | – | `places` (with coords), `derived.ids` (positions computed in code), `landmarks`, `proposed.places` (new ids, first-guess coords) |
| `quests/*.json`, `quests/villages/*.json` | `quests` | quests split by arc or village |
| `items/*.json` | `items` | everything for the bag and the 圖鑑 |
| `recipes/*.json` | `recipes` | dishes, keeper, ingredients |
| `npcs/*.json` | `npcs` | cast with role / duties / dialogue key |
| `dialogue/*.json` | `dialogues` (object, key = id) | NPC idle / duty / keeper / after-quest lines |
| `photoSpots/*.json` | `photoSpots` | photo spots with time / season windows |
| `gatherNodes/*.json` | `gatherNodes` | gather and observe points with time / season / tide windows |
| `outfits/*.json` | `outfits` | unlockable outfits and accessories |
| `songs.json`, `phrases.json`, `glossary.json`, `milestones.json` | – | shared tables (unchanged from the game) |

## Shared types

```ts
type Role = 'm' | 'f' | 't';               // 族男 / 族女 / 旅人
type RoleSet = string;                     // `need` entries: 'm', 'f', 't' or a set like 'mf' (either one)
type Time = 'day' | 'night' | 'any';       // required on quests, photo spots, gather nodes
type Period = 'dawn' | 'day' | 'dusk' | 'night'; // optional finer window
type SeasonTag = 'summer' | 'winter';      // [] = all year. summer = 飛魚季 (game seasons meyvanwa / rayon / manoyotoyon),
                                           // winter = 東北季風 (game season off). Never snow.
type Line = { who?: string; zh: string; tao?: string };   // who = npc id or a meta.tokens key (@npc, @m, @f, @t, @host, @giver, @hostf, @me, 旁白)
type Req = string /* quest id */ | { all: Req[] } | { any: Req[]; n?: number } | { flag: string }
         | { respect: 'first'|'learning'|'trusted'|'friend' } | { stat: string; min: number }
         | { count: string; min: number } | { item: string; min: number } | { pending: true };
```

## Quest

```ts
interface Quest {
  id: string; line: 'main' | 'side' | 'photo'; arc: string;   // arc = old `group` or split / outfit / night / village
  village: string | null;                                       // one of meta.villages
  name: { zh: string; en: string };
  time: Time; seasons: SeasonTag[]; periods?: Period[]; tide?: 'low' | 'high';  // replaces the old `when`
  roles: Role[]; n: number; need?: RoleSet[];
  giver?: 'f' | 'm';            // 分工: f = a akes (水芋、食物、紡織), m = a akey (漁獵、飛魚季、拼板舟)
  labourNote?: string;          // explains an intentional cross-role step (silences the 分工 warning)
  text: { who; coop; season; pre; unlock; kind: string };     // quest-log strings
  req: Req; steps: Step[]; hint: { tier: 'direct'|'vague'|'tao'; from: string; zh: string };
  playable: boolean;            // false = design placeholder (validator skips completability)
  review?: string[];            // points a Tao cultural consultant must confirm
  abortTo?: number;             // solo give-up returns here (required with `solo`)
  needsItem?: { item: string; from: string }; recipe?: { id; village; keeper: string };
  ground?: 'fishing' | 'dive'; song?: string; hidden?: boolean; distanceOnly?: boolean;
}
interface Step {
  kind: 'talk' | 'spot' | 'photo' | 'auto' | 'placeholder' | 'tasks';
  text: string; npc?: string; spot?: string; r?: number; lines?: Line[];
  actor?: Role[];               // who may do it
  need?: RoleSet[];             // who must be nearby
  until?: Req;                  // auto steps
  gives?: { flags?: string[]; items?: string[] /* repeat an id for ×2 */; consume?: Record<string, number>;
            recipe?: string; glossary?: string[]; outfits?: string[]; relation?: number;
            respect?: string; counter?: Record<string, number>; toast?: [string, string] };
  // ---- party split (applied when the step completes)
  split?: Partial<Record<Role, { at: string; task: string; ctrl?: boolean }>>; // ctrl true = switchable (3-way split); false = busy
  meet?: string;                // regroup point (HUD + marker)
  solo?: { role: Role; at: string; task: string; waitAt: string; giveUp?: Line[] }; // only `role` playable
  regroup?: boolean;            // everyone back in the party
  requires?: Role[];            // "requiredMembers": members that must not be away
  tasks?: { role: Role; kind: 'talk' | 'spot'; npc?; spot?; text: string; lines?: Line[]; gives? }[];
  minigame?: 'fish' | 'taro'; canoe?: boolean; dive?: 'A' | 'B' | 'POV'; translate?: boolean;
}
```

Party-split rules the validator enforces: a `split` must be followed by a `regroup` in the same quest; a `tasks`
step only lists members who are away on the open split; `requires` cannot name a member who is still away;
`solo` needs `abortTo` (≤ its own index) and a later `regroup`.

## Item

```ts
interface Item {
  id: string; name: { zh: string; tao: string };   // tao '' until confirmed
  category: 'tool' | 'ingredient' | 'material' | 'accessory' | 'observe';
  collectible: boolean;          // false = 圖鑑 only (observe), never in the bag
  description: string;           // short bag text
  codex: string;                 // 圖鑑 text
  icon: string;                  // pixel icon key  → sprites/icons/<icon>.png (inventory + on the ground)
  illustration: string;          // watercolor+ink key → illustrations/<illustration>.webp (圖鑑)
  nutrition?: string; review?: boolean; unlockFlag?: string;
  sources?: ({ kind: 'shop'; npc: string } | { kind: 'minigame'; id: 'fish'|'taro'; seasons?: SeasonTag[] }
           | { kind: 'gather' | 'observe'; node: string })[];   // quest rewards are found automatically
  equip?: { who: Role[]; slot: string; outfit: string }; outsiderSafe?: boolean;
}
```

## Recipe, NPC, dialogue, photo spot, gather node, outfit

```ts
interface Recipe { id; name: { zh; tao }; village: string | null; keeper: string | null; quest: string | null;
  ingredients: Record<string, number>; seasons: SeasonTag[]; unlockedBy: string; steps: string; nutrition: string;
  icon: string; illustration: string; review: boolean; clinicNote?: boolean }
interface Npc { id; name: { zh; tao? }; role: 'elder_m' | 'elder_f' | 'questVillager' | 'service' | 'outsider' | 'ambient';
  village: string | null; duties?: ('flyingfish'|'net'|'boat'|'hunt'|'food'|'field'|'taro'|'tide'|'weaving')[]; dutyText?: string;
  recipeKeeper?: string; outsider: boolean; talkable: boolean; dialogue: string | null;
  kind: string; home: string; schedule?: {...}[]; portrait?: string; sheet?: string; elder?: 'f' }   // render fields as before
interface Dialogue { npc: string; greet?: Line[]; duty?: Line[];
  idle?: { when?: { time?: Time; seasons?: SeasonTag[] }; lines: Line[] }[];   // first matching `when`, else the first
  keeper?: { invite: Line[]; missing: Line[] /* {need} = missing ingredients */; teach: Line[]; after: Line[] };
  after?: Record<string /* quest id */, Line[]>;  lines?: Line[]; speaker?: {...}; unlocks?: {...} }   // legacy shape too
interface PhotoSpot { id; quest?: string; name: { zh }; landmark?: string; place?: string; r: number | null;
  time: Time; seasons: SeasonTag[]; periods?: Period[]; status: 'placed'|'placeholder'|'proposed-place'; distanceOnly: boolean; noFlash?: boolean }
interface GatherNode { id; kind: 'gather' | 'observe'; item?: string; observe?: string; place: string; r: number; ox?; oz?;
  label: string; time: Time; seasons: SeasonTag[]; tide?: 'low'|'high'; perDay?: number; requires?: Req; requiresHint?: string; sets?: string; review?: boolean }
  // requiresHint: shown on the spot while `requires` is unmet (the node shows no 採 marker until then)
interface Outfit { id; who: Role[]; kind: 'traditional' | 'accessory'; name: { zh; tao? }; unlockQuest: string;
  sheet?: string; portrait?: string; item?: string; layer?: string; icon: string; outsiderSafe?: boolean; excludes?: string[]; review?: boolean }
```

Outfit rule (validator): the traveller (`t`) never gets `kind: 'traditional'`; anything for `t` must be `outsiderSafe`.

## How to add …

- **a quest / side story**: add an entry to a `quests/` file (or a new file). Pick `time` and `seasons`, point `req` at an
  existing quest or flag, and run the validator. A new flag set only by game code goes in `meta.externalFlags`.
- **an item**: add it to an `items/` file with `icon` + `illustration` keys and at least one source (or a quest reward).
- **a recipe**: add the dish to `recipes/`, a keeper NPC with `recipeKeeper`, and a three-step recipe quest (talk → auto until items → talk with `gives.recipe` + `consume`).
- **an NPC line**: add or edit a block in `dialogue/`. New NPC: add it to an `npcs/` file with `dialogue` = the block id.
- **a place**: add it to `places.json` `proposed.places` until the code worker gives it real coords.

## Phase B changes (the game reads content/ now)
- The game bundles `content/**/*.json` at build time (`src/content/loader.ts`). `public/data/` is gone; a backup is in `/workspace/backups/`.
- `ui.json` moved to `content/ui.json` (UI text, origins, help, mini-games).
- `places.json`: the five new places are now ordinary `places` entries, so `proposed` is no longer there. If a new `proposed` entry has `x` / `z`, the loader still picks it up.
- `meta.giverLabels`: the quest-card line for who gives / approves a quest (女性長輩交辦、驗收 / 男性長輩交辦、驗收).
- NPCs:
  - `action` (`taro_intro`, `auto-fish`) replaces the old `interact` special cases.
  - `talkable: false` means background only.
  - `fallbackSheet` is the sheet used until the NPC's own art exists.
  - New NPCs go in `content/npcs/passersby.json` (or any file in that folder).
- Outfits: `portraitByGender: { m, f }` sets the traveller's accessory portrait. Traditional outfits use `portrait` (`local_trad`, `local_f_trad`) and `sheet` (the variant walk sheet, not drawn yet, so the base sheet is used).
- Windows: the loader rejects `time: night` + `tide: low` without `periods`, because low tide is only at dawn / dusk for now.


## 0.1.4 additions (content worker, 2026-11-14)

- **Quest `requiresOutfit`**: `{ "m"?: outfitId, "f"?: outfitId }`. The quest cannot start (and steps for that member cannot be done) unless the member wears that outfit. The quest that unlocks the outfit must be in the quest's prerequisites (validate-content checks). Used for festival, boat-fishing and tribal-event quests (M3, M4, A2, IT-M1, T5–T8). Engine support: world/src worker. Travellers never get real Tao clothing.
- **Canoe step `canoeKind`**: `"tatala"` (default) or `"modern"`. Only the Tao man (m) paddles a tatala; any canoe step that f or t may do must say `"canoeKind": "modern"` (validate-content rejects it otherwise).
- **Photo spot / photo quest `distanceOnly: true`**: sacred or taboo places (P05, P07, P18, P22): photographed from the road or a viewpoint; no entering or touching.
- **`content-pending/`**: same layout as content/; entries that need a place id from docs/phase1/WORLD_NEEDS.md. Not bundled. `node scripts/content/promote-pending.mjs [--dry]` moves every entry whose places now exist (and whose prerequisite quests are live) into content/. validate-content checks content/ + content-pending/ (with the WORLD_NEEDS ids) at the end of every run.
- **`review`**: array of strings — what a Tao reviewer must confirm. Listed in docs/phase1/CULTURAL_REVIEW.md.

## 0.1.4 additions
- Quest `silent: true`: a story beat, not a quest (Q01 arrival). It runs like any quest (lines, flags, unlocks) but never shows in the quest log, the tracker or a 任務完成／新任務 toast.
- Step line `if: "<flag>"`: the line is only said when that quest flag is set (for example `arrived_plane` / `arrived_boat`, set by the 搭飛機／搭船 choice).
