# Recipe keepers (NPC cast rev, 2026-11-14)

One recipe keeper per village; all six are the village's **a akes** (female elder), who lead food and the fields.
The player collects the listed ingredients, then the keeper teaches the dish (owner, pt103u).
Dishes use only real Tao staples (flying fish fresh or dried, taro, yam, sweet potato, intertidal shellfish and seaweed),
are simple boiled or dried preparations, and carry no invented customs. Every dish and its details still need
confirmation by a Tao cultural consultant; the game text keeps the existing "還要請族人確認" wording.

The dishes are mapped onto the recipe placeholders already in public/data/recipes.json (owned by the code worker)
so as few entries as possible move. Only changes: 椰油 ↔ 朗島 ↔ 東清 swap so each dish matches its keeper's role/props.

| 部落 | Keeper (npc id) | 料理 | recipes.json id | 食材 (ingredient ids) | Change vs current placeholder | Why this keeper |
|---|---|---|---|---|---|---|
| 椰油 | elder_f_yayo（新，椰油的女性長輩） | 飛魚乾 | rc-dried-flyingfish | alibangbang | was 朗島 → **椰油** | 食物：煮食與保存；保存曬好的魚乾 |
| 朗島 | elder_f_iraraley（新，朗島的女性長輩） | 水煮山藥 | rc-boiled-yam | ovi | was 東清 → **朗島** | 田地：山藥與小米；拿著網袋裝的山藥 |
| 東清 | elder_f_iranmeylek（新，東清的女性長輩） | 水煮貝類與海菜 | **new** e.g. rc-shellfish-seaweed | **new** shellfish 貝類, seaweed 海菜 (tao "" until confirmed) | new dish; fallback = rc-boiled-sweetpotato (水煮地瓜, wakay) if no new ingredients | 潮間帶採集與料理；提著貝類海菜 |
| 野銀 | villager_taro（水芋田長輩） | 水煮芋頭 | rc-boiled-taro | soli | unchanged | 水芋田 |
| 紅頭 | weaver_elder（織布長輩） | 水煮飛魚 | rc-boiled-flyingfish | alibangbang | unchanged | 紅頭的 a akes（織布）；飛魚季時家裡的料理 |
| 漁人 | elder_f_iratay（新，漁人的女性長輩） | 芋頭與地瓜 | rc-taro-sweetpotato | soli, wakay | unchanged | 田地：地瓜與水芋；端著一盆地瓜 |

Notes for the code worker
- `unlockedBy` values: rc-dried-flyingfish → recipe-keeper-椰油, rc-boiled-yam → recipe-keeper-朗島,
  東清's dish → recipe-keeper-東清. 水煮地瓜 (rc-boiled-sweetpotato) is then free; keep it as a shop/field recipe or drop it.
- Proposed 東清 recipe text (same tone as the others):
  - steps: 「退潮時在潮間帶採集的貝類與海菜，洗淨後以水煮熟。哪些可以採、什麼時候採，各部落有自己的規矩，還要請族人確認。」
  - nutrition: 「貝類提供蛋白質、鐵與鋅，海菜含碘與礦物質；水煮清淡，常與芋頭、地瓜等主食一起吃。」
  - ingredient nutrition: 貝類「蛋白質、鐵、鋅與維生素 B12。」 海菜「碘、鈣等礦物質與膳食纖維。」
- New NPC entries for the 4 a akes: docs/phase1/npcs_additions.json (interact id "recipe_keeper" is a placeholder).
- Guide (public/guide/data.json) already names each keeper's dish in her card ("收齊食材後，她會教你做「…」").
  If a dish changes, update the card text too.
- Art for every keeper exists: portraits public/assets/portraits/<id>.webp, sheets characters/<id>_sheet.png,
  atlas slots in npc_atlas.json.
