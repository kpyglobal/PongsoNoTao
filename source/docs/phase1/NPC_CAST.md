# NPC cast (2026-11-14)

Request (Larry, 2 AM): every elder of the six villages and every key NPC gets a distinct face and a portrait;
ambient villagers (parents' generation, peers of the 族人 youths, children) fill the villages with a few shared
bases in different clothes.

## 1. Inventory before this pass

| id | 名稱 | sheet (kind) | portrait | problem |
|---|---|---|---|---|
| elder_yayo / _iraraley / _iranmeylek / _ivalino / _imorod / _iratay | 六部落的長輩 (… a akey) | elder (shared) | elder (shared) | all six identical |
| villager_taro | 水芋田長輩 | farmer | farmer | shared with shop_yayo, weaver_elder |
| weaver_elder | 織布的婦女長輩 | farmer | farmer | shared |
| shop_yayo | 雜貨店老闆 | farmer | farmer | shared |
| villager_harbor | 拼板舟漁人 | fisher | fisher | shared with rental, dive coach, villager_iratay |
| rental_owner | 租車行老闆 | fisher | fisher | shared |
| dive_coach | 潛水教練 | fisher | fisher | shared |
| villager_iratay | 漁人的族人 | fisher | fisher | generic |
| villager_iranmeylek | 東清的族人 | villager | local (= 族男 portrait!) | wrong portrait |
| teacher_yayo | 族語老師 | villager | local (= 族男 portrait!) | wrong portrait |
| clinic_nurse | 衛生所護理師 | clinic | nurse | ok-ish, old style |
| harbor_staff | 開元港港務人員 | harbor | harbor | ok-ish, old style |
| tourist_a | 剛下飛機的訪客 | tourist | visitor (= 女旅人 portrait!) | wrong portrait |
| tourist_b | 東清灣的旅人 | player_researcher | visitor (= 女旅人 portrait!) | wrong portrait |
| guide only: 衛生所醫師 | — | — | nurse | no NPC, borrowed portrait |
| guide only: 營養師, 部落文化工作者, 地質學家 | — | — | none (seal) | no NPC, no image |
| guide: 族語老師 | — | — | none (seal) | |
| guide: 主人家長輩 / 田邊的長輩 / 租車行老闆 | — | — | elder / farmer / harbor | generic or wrong (租車行 used the harbour portrait) |

No ambient villagers of the parents' generation, the youths' peers, or children existed.
There is no separate "recipe keeper" NPC in the data: the one recipe is unlocked at the clinic (nurse / nutritionist);
the host-family women elders (水芋田長輩, 織布的婦女長輩) are the closest. Not invented here — see decisions.

## 2. Key NPCs (unique face + unique sprite)

Skin: Tao people golden-tan (same tone as the v3 local / local_f portraits), Southeast Asian / Austronesian features.
Clothes modern and everyday; elders may carry one subtle traditional touch. Outsiders never wear Tao clothing.
No real people. Names stay as the game already has them (Tao only where the game has Tao).

| # | id | 名稱 | looks (one line) | signature |
|---|---|---|---|---|
| 1 | elder_yayo | 椰油的長輩 (Yayo a akey) | ~75, lean, long face, cropped grey hair, deep smile lines | faded navy polo, rolled fishing net on the shoulder |
| 2 | elder_iraraley | 朗島的長輩 (Iraraley a akey) | ~80, round face, bald crown with white sides, thick white brows, sturdy | open plaid short-sleeve shirt over a singlet, carved walking stick |
| 3 | elder_iranmeylek | 東清的長輩 (Iranmeylek a akey) | ~70, square jaw, salt-and-pepper buzz cut, thin moustache, wiry | sun-faded olive work shirt, coil of rope |
| 4 | elder_ivalino | 野銀的長輩 (Ivalino a akey) | ~85, deeply wrinkled, gaunt, thin white hair, calm eyes | plain grey tee with a light hand-woven striped vest (subtle traditional touch) |
| 5 | elder_imorod | 紅頭的長輩 (Imorod a akey) | ~72, chubby, short grey hair, reading glasses on a cord, cheerful | blue short-sleeve shirt, faded cap |
| 6 | elder_iratay | 漁人的長輩 (Iratay a akey) | ~78, tall, grey goatee, weathered, longish grey hair | white tee, rattan fish basket |
| 7 | villager_taro | 水芋田長輩 | ~75 woman, small, round face, grey bun under a towel scarf | floral long-sleeve work shirt, taro leaves |
| 8 | weaver_elder | 織布的婦女長輩 | ~70 woman, slim, silver short hair, glasses, gentle | plain purple blouse, folded striped hand-woven cloth |
| 9 | villager_harbor | 拼板舟漁人 | ~45 man, muscular, black buzz cut, stubble | dark sleeveless tee, wooden paddle |
| 10 | teacher_yayo | 族語老師 | ~40 woman, long black hair half-up, round glasses | cardigan over a blouse, textbook + lanyard |
| 11 | shop_yayo | 雜貨店老闆 | ~55 woman, plump, short permed curls, big grin | apron over a tee, pen in the apron pocket |
| 12 | rental_owner | 租車行老闆 | ~35 man, slim, undercut, sunglasses on the head | grey tee with grease marks, scooter key ring |
| 13 | dive_coach | 潛水教練 | ~30 man, athletic, wavy hair tied back | navy-teal rash guard, mask on the forehead |
| 14 | harbor_staff | 開元港港務人員 | ~50 man, moustache | light-blue uniform shirt, navy cap, hi-vis vest, walkie-talkie |
| 15 | clinic_nurse | 衛生所護理師 | ~32 woman, neat bun, freckles, kind | teal scrubs, stethoscope |
| 16 | clinic_doctor (new) | 衛生所醫師 | ~45 man (from Taiwan), side-parted hair, rimless glasses | white coat over a polo |
| 17 | nutritionist (new) | 營養師 | ~35 woman, shoulder bob | pastel blouse, clipboard with a food chart |
| 18 | culture_worker (new) | 部落文化工作者 | ~38 man, long hair in a low bun, light beard, round face | linen shirt, cross-body bag with a small woven strap |
| 19 | geologist (new, outsider) | 地質學家 | ~45 woman, short grey-streaked hair | sun hat, khaki field vest, rock hammer |
| 20 | tourist_b (outsider) | 東清灣的旅人 | ~28 woman researcher | sun hat, khaki vest, field notebook (existing researcher sprite) |

The four new NPCs (16–19) stand where the guide says they are; they have no dialogue yet (their quests are still
placeholders), so they are not talkable.

## 3. Ambient villagers (shared bases × outfit variants)

Six bases, one portrait each; three outfit variants per base (colour / hat / apron), spread so no village repeats a look:

| base | age | looks | variants |
|---|---|---|---|
| auntie | ~45 woman | wavy shoulder hair tied with a scrunchie, round face | sun visor + coral tee / towel scarf + teal tee / apron + yellow tee |
| uncle | ~48 man | short black hair, greying temples, stocky | white singlet + boardshorts / faded red polo / navy work shirt + cap |
| youth_m | ~22 man | messy black hair, slim | basketball jersey / black tee + bucket hat / white tee + open blue shirt |
| youth_f | ~22 woman | long straight black hair, ponytail or loose | oversized pink tee / striped tee / white tee + denim shorts |
| boy | ~9 | buzz cut, gap-tooth grin | yellow tee / green tee / red tee |
| girl | ~9 | two pigtails | sky-blue dress / orange tee / pink tee |
| tourist (outsider) | ~30 man | white cap, coral tee, camera | existing tourist sprite (tourist_a) |

Placement: three ambient villagers per village (one adult, one youth, one child, genders alternating), wandering
between the village centre and its taro field. villager_iranmeylek / villager_iratay become two of them.

## 4. As built (2026-11-14)

- Portraits: 27 new painted portraits (21 key incl. nurse / researcher / tourist, 6 ambient bases), sources in
  `art-src/portraits/<id>.jpg`, keyed to `public/assets/portraits/<id>.webp` (440×560). The nurse keeps the file
  name `nurse.webp` (game.ts clinic door uses it); the researcher is `researcher.webp`, tourist_a uses `tourist.webp`.
- Sprites (`scripts/octo/cast.py`): a unique walk sheet per key NPC (`KEY_NPCS`), the six ambient bases (`AMBIENT`) and
  12 `variant()` outfits (`<base>__<outfit>_sheet.png`). New generator options: `scale` / `heads` (children are
  0.68–0.70 tall with a 4-head ratio), `glasses`, `beard` (moustache / goatee / stubble), hair `bald` / `pigtails`,
  props `paddle` / `leaves` / `cloth` / `net` / `rope` / `keys` / `hammer` / `radio`. clinic, harbor and
  player_researcher were re-dressed to match their new portraits.
- Game data: `npcs.json` has 39 NPCs. Elders keep `kind: "elder"` (stand-off spot) and point at their own sheet with the
  new optional `sheet` field; everyone else's `kind` is their sheet. The 16 new ambient villagers (+ the two existing
  villager_iranmeylek / villager_iratay, re-skinned as uncle__polo / auntie__apron and keeping their quest schedules)
  wander village ↔ taro field and go home at night; they are not talkable.
- Not done / for Larry: no 傳統食譜擁有人 NPC exists in the data, so none was invented; the four new role NPCs have no
  dialogue yet.

## 5. Rev (2026-11-14 09:22): elders by village, recipe keepers, quest villagers

Division of labour (Larry): **a akes** (female elders) lead production — taro fields, food, weaving;
**a akey** (male elders) decide on hunting, the flying-fish season and the plank boats. Every village now has
one of each: the 6 existing men stay, 4 new a akes are added and 2 existing women (水芋田長輩, 織布長輩) become their villages' a akes.

| 部落 | 男性長輩 a akey（負責） | 女性長輩 a akes（負責） | 食譜傳承者 → 料理 |
|---|---|---|---|
| 椰油 Yayo | elder_yayo：飛魚季出海、漁網與漁團 | **elder_f_yayo（新）**：食物——煮食與保存（鋁鍋、木杓） | elder_f_yayo → 飛魚乾 |
| 朗島 Iraraley | elder_iraraley：造拼板舟、上山選木 | **elder_f_iraraley（新）**：田地——山藥與小米（網袋裝山藥） | elder_f_iraraley → 水煮山藥 |
| 東清 Iranmeylek | elder_iranmeylek：拼板舟出海、繩索與划槳 | **elder_f_iranmeylek（新）**：潮間帶採集與料理（草帽、貝類海菜） | elder_f_iranmeylek → 水煮貝類與海菜 |
| 野銀 Ivalino | elder_ivalino：飛魚季的規矩與漁獲分配 | villager_taro（水芋田長輩，沿用）：水芋田 | villager_taro → 水煮芋頭 |
| 紅頭 Imorod | elder_imorod：上山打獵與山林 | weaver_elder（織布長輩，沿用）：織布 | weaver_elder → 水煮飛魚 |
| 漁人 Iratay | elder_iratay：飛魚季出海與分魚 | **elder_f_iratay（新）**：田地——地瓜與水芋（一盆地瓜） | elder_f_iratay → 芋頭與地瓜 |

Wiring (code worker; this pass did not touch npcs.json except two appearance fields):
- 4 new a akes: proposed entries in `docs/phase1/npcs_additions.json` (kind = own sheet, portrait = own id,
  name.tao "<Village> a akes", schedule village ↔ taro field). Sheets, portraits, guide cards and atlas slots exist.
- villager_taro: proposed home ivalino only (drop the taro_iranmeylek waypoint) so she reads as 野銀's a akes.
- weaver_elder: proposed fixed home imorod instead of host_weave (her atlas slot is in `imorod`).
- Recipe keepers + dishes: `docs/phase1/RECIPE_KEEPERS.md`.

Quest villagers (K visits) now have their own faces: villager_iranmeylek (man ~40, curly hair, olive tee, white
towel round the neck) and villager_iratay (woman ~38, short hair, silver hoops, coral shirt, canvas tote).
npcs.json: only their `kind` and `portrait` changed (→ own id). The variants uncle__polo / auntie__apron were
only used by them and are removed (cast.py lines, sheets).

## 5. Passers-by and new kids (2026-11-14, art only — not wired in yet)

Non-Tao visitors in ordinary holiday clothes (outsiders never wear Tao clothing) plus four kids. Each id has its own
portrait `public/assets/portraits/<id>.webp` (330×420, transparent) and walk sheet
`public/assets/sprites/characters/<id>_sheet.png` (same layout as every NPC; defined in `scripts/octo/cast.py`
`PASSERSBY` / `KIDS_NEW`). Review sheet: `screenshots-cast/passersby.png` (`python3 scripts/octo/contact_passersby.py`).

| id | 名稱 | who | looks |
|---|---|---|---|
| pb_couple_m | 情侶旅客・男 | ~27 Taiwanese man, with pb_couple_f | white tee + open light-blue shirt, sunglasses on head, sling bag |
| pb_couple_f | 情侶旅客・女 | ~26 Taiwanese woman | straw sun hat, yellow floral sundress, phone |
| pb_middle_m | 跟團的中年旅客 | ~50 man on a group tour | navy polo, tan visor, tour lanyard, waist pouch |
| pb_middle_f | 中年女旅客 | ~48 woman | lilac UV jacket, black visor, folded parasol |
| pb_retiree_m | 退休旅客・男 | ~68 man | bucket hat, glasses, striped polo, hiking vest, trekking pole |
| pb_retiree_f | 退休旅客・女 | ~66 woman | white sun hat, grey perm, pink floral blouse, camera |
| pb_backpacker | 背包客 | ~24 Western man | teal tee, big trekking pack with sleeping mat |
| pb_family_dad | 全家出遊的爸爸 | ~38 man (family with kid_tourist_girl) | cap, glasses, grey tee, kid's water bottle, beach bag |
| pb_family_mom | 全家出遊的媽媽 | ~36 woman | bucket hat, coral top + open denim shirt, sunscreen |
| kid_quest_tourist | 好奇的小旅客 | ~8 tourist boy — **quest kid, unique** | navy bucket hat, green sea-turtle tee, orange binoculars |
| kid_quest_local | 愛畫畫的部落女孩 | ~10 local Tao girl — **quest kid, unique** | short bob + hair clip, sky-blue sports tee, sketchbook with a shell drawing |
| kid_tourist_girl | 小旅客・女孩 | ~6 tourist girl (pb_family_*) | white sun hat, pigtails, pink striped rash guard, beach bucket |
| kid_local_ball | 踢球的部落男孩 | ~8–9 local boy (made younger 2026-11-14) | red jersey (no text), plaster on cheek, soccer ball |

Also changed: **geologist is now a man** (~45, bucket hat, khaki field vest over a blue shirt, field notebook + hand lens);
portrait, guide copy and walk sheet redone, NPC atlas rebuilt. visitor_m skin warmed toward visitor (scripts/skin_match.py).
