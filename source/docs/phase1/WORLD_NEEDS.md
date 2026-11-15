# World needs for the 0.1.4 content (from the content worker)

Written 2026-11-14 ~18:10 CST. Owner of this list: the content worker. Owner of the fixes: the world / src worker.
The content worker does not edit `src/` or the world layout. Every quest that needs one of these ids is written and
checked, but waits in `content-pending/` (same file names as `content/`). When the ids below exist, run
`node scripts/content/promote-pending.mjs`: it moves every pending entry whose places now exist into `content/`
(replacing the placeholder with the same id) and leaves the rest waiting. `node scripts/validate-content.mjs` checks both.

Coordinates are not given on purpose: please place them on the new island shape. "Real place" is where it is on the
real Lanyu ring road, clockwise from 開元港 going south: 饅頭岩 → 虎頭坡 → 椰油 → 機場 → 漁人 → 八代灣 → 紅頭
(中橫 up to 氣象站) → 大天池 trailhead → 青青草原 → 龍門港 → 龍頭岩 → 象鼻岩 → 鋼盔岩 → 野銀 → 東清 → 情人洞
→ (軍艦岩 offshore) → 雙獅岩 → 母雞岩 → 朗島 → 玉女岩 → 五孔洞 → 坦克岩 → 鱷魚岩 → 紅頭岩 → 開元港.

## 1. Places (add to `content/places.json` places, derived ids, or landmarks)

| id | what (zh) | where (real Lanyu) | kind | quests |
|---|---|---|---|---|
| `host_tagakal` | 主人家的涼亭 (tagakal) | derived like `host_home`: next to the host family's house in the chosen home village, on its own lot | derived | Q03, Q07, NT1, Z1, N1, M9, V5, W2, H1, V3 |
| `hongtou_rock` | 紅頭岩（路穿過的岩洞） | NW coast, just north of 開元港 on the ring road | landmark | P01 |
| `carp_rock` | 鯉魚岩 | position not certain: the plan lists it as a north-coast rock; 鯉魚山 is by 紅頭. Put it where you think it fits and tell me | landmark | P02 |
| `tank_rock` | 坦克岩 | NW coast between 五孔洞 and 紅頭岩 | landmark | P03, D2 |
| `lighthouse` | 蘭嶼燈塔（山坡上的觀景點） | hill above 開元港 / 椰油 | landmark | P04 |
| `five_caves_view` | 五孔洞（路邊遠看的位置） | NW coast, SW of 朗島, on the road. **A roadside viewpoint only**: keep the player ≥ 12 m from the cave mouths; the caves must not be enterable | viewpoint | P05 |
| `jade_rock` | 玉女岩（族人稱火把岩，待確認） | north coast, just west of 朗島 | landmark | P06 |
| `small_lake_view` | 小天池（遠看） | interior hills; a lookout on a trail, the water itself not reachable | viewpoint | P07 |
| `lovers_cave` | 情人洞（海蝕拱門） | the headland at the north end of 東清灣 | landmark | P11, D3 |
| `skyline_gap` | 一線天 | east coast, between 東清 and 野銀 (position not certain) | landmark | P12 |
| `helmet_rock` | 鋼盔岩 | SE coast, between 象鼻岩 and 野銀 | landmark | P14 |
| `elephant_rock` | 象鼻岩 | SE coast, between 龍頭岩 and 鋼盔岩 | landmark | P15 |
| `lanyu_falls` | 蘭嶼的瀑布（路邊小瀑布） | south coast (position not certain) | landmark | P16 |
| `dragonhead_rock` | 龍頭岩（看得到小蘭嶼） | south coast, east of 龍門港 | landmark | P17 |
| `big_lake_view` | 大天池（遠看） | SW hills; trail starts south of 紅頭. A lookout above the crater lake; the shore not reachable | viewpoint | P18 |
| `old_man_rock` | 老人岩 | SW / S coast (position not certain) | landmark | P19 |
| `badai_view` | 八代灣（部落外的路邊觀景點） | the road above the bay between 漁人 and 紅頭, **outside** both villages' beaches | viewpoint | P21 |
| `hutou_slope` | 虎頭坡（大涼亭、山羊） | the road south of 開元港; looks north to 饅頭岩, south to 椰油 / the airport. Goats graze here | viewpoint | P22, A4 |
| `weather_station` | 蘭嶼氣象站 | at the top of the 中橫 road branch above 紅頭 | landmark | P25 |
| `thatch_field` | 山坡上的茅草地 | a hillside near the host villages, reachable from a road | field | J4 |
| `host_fishrack` | 主人家的曬魚架 | derived like `host_home`, beside the house (the fish rack you are adding) | derived | M6, G2, M10 |

## 2. Things to see in the world (decor, no new ids)
- Goats (山羊) grazing at `hutou_slope` and on `hongtoushan`; one goat with a notched ear near `hutou_slope` for A4 (a spot step, not an NPC).
- A fish rack with drying flying fish at `host_fishrack`, summer only if easy.
- A thatch patch (tall grass) at `thatch_field`.
- 饅頭岩 out at sea, visible from `hutou_slope` (it is a former sea-burial place: no path to it).

## 3. NPC positions
- `geologist`: D1 says he "moves around". Please give him a day schedule that visits `tank_rock`, `lovers_cave` and `airport` (any order). D1 only needs him talkable somewhere in daylight.
- `culture_worker`: should be reachable at 朗島 in the day (B1, B2, B3 talk to him there).
- No new NPCs are needed. The "割茅草的婦女長輩" in J4 is the host family's a akes (`@hostf`).

## 4. Engine: `requiresOutfit` (quest field)
Larry, 2026-11-14: "祭典、上船捕魚、部落活動，沒有換部落衣服無法開始", and outfits can be taken off any time.

```json
"requiresOutfit": { "m": "outfit_m_tao" }          // or { "m": "outfit_m_tao", "f": "outfit_f_tao" }
```
- Meaning: the quest cannot **start** (its first step cannot run) unless each listed member is wearing that outfit.
  Later steps don't re-check, so taking it off mid-quest is allowed.
- Show it on the quest card and as the step block reason, e.g. 「族男要先換上傳統服飾（手札 → 背包）」.
- `quest(id).block` should say so; `runStep` in the test hooks may auto-wear when `{ wear: true }` is passed (nice to have).
- Every quest with `requiresOutfit` has the outfit's unlock quest in its prerequisites (validate-content checks this).
- Quests with it now: M3, M4, A2, IT-M1, T6, T7, T8 (族男); T5 (族男＋族女).
- NT4 (漁人 evening gathering) is a modern community event (Larry's default 5), so it has no outfit rule.

## 5. Other engine notes
- None of the new quests need a new step kind or tide logic. Tides stay the dawn / dusk placeholder (real tides: Phase 2).
- External flags that code never sets were replaced by quest data (`injured` → also unlocked by I2;
  `crab_season` → summer nights; `met_coconut_crab` → after C1; `met_dietitian` → given by Y2; `year_done` → given by Z1;
  `met_thatch_elder` → given by J3). The old flag names still work if code sets them later.

## 6. Only Tao men paddle a tatala (Larry, 2026-11-14 18:10)
- 族女 and 旅人 never paddle a tatala. When they go on the water they use a **modern canoe** (rented next to the
  rental shop), and they don't necessarily follow the men out to sea.
- Quest data: a step with `canoe: true` that 族女 / 旅人 may do carries `"canoeKind": "modern"` (validate-content
  rejects one without it). Only V4 has one now (the traveller's rented canoe beside the 族男's tatala).
- Engine: please draw the modern canoe for `canoeKind: "modern"` (a plain one-colour kayak-style canoe, no tatala
  paint or carved prow), and check free play: if 族女 / 旅人 can toggle into the canoe anywhere, it must be the
  modern canoe too (or not offered).

## 7. World side: what was done (engine/world worker, 0.1.4)

- All place ids in §1 are in the game (places, derived ids or landmarks), and the waiting quests and photo spots were moved into content/ with `promote-pending.mjs`.
- `requiresOutfit` and `canoeKind: "modern"` work as described in §4 and §6.
- Not certain: 一線天, 鋼盔岩, 象鼻岩 and 鯉魚岩 have no exact public position we could check, so they sit between their real neighbours on the coast. Please check with the Tao cultural consultant or someone from the island.
- The 氣象站 sits on the hill near its real spot, but there is no separate road branch up to it; it is reached on foot.
- 饅頭岩 is out at sea, to look at only.
- 東清灣潮間帶 moved about 4 m toward the sea, because a 涼亭 now stands on the old spot.
- The island outline and some place positions come from OpenStreetMap (© OpenStreetMap contributors, ODbL). When publishing, add this line to THIRD_PARTY_NOTICES.md.
