# English glossary (0.1.5)

How Pongso no Tao is put into English. Use these words everywhere (content `en` fields, the interface
table `src/ui/strings-en.ts`, docs). Plain, simple English; British spelling (colour, harbour, travelled).

## Rules

- **Tao words stay in Tao.** Write them as they are (akokey, soli, alibangbang, tatala, rayon …). Where the
  Chinese explains the word, the English explains it too: `tatala (plank boat)`, `akokey (hello)`.
- **Same meaning, simple words.** Short sentences, everyday words; children and visitors read this.
- **Keep the respect.** Taboos, sacred places and "ask first" lines are translated exactly, never softened or
  made into jokes.
- **Teaching draft notes stay visible.** `（教學草稿）` → `(teaching draft)`; `還要請族人確認` → "still needs
  checking with the community".
- **Slots stay.** `{name}`, `{n}` … appear in the English exactly as in the Chinese.
- **Task lines** (what a member is doing while away) are lower-case "-ing" phrases, because the game writes
  "Tao man is {task}": `mending the net`, `paddling out to sea`.

## People and roles

| 中文 | English |
|---|---|
| 族男 / 族女 / 旅人 | Tao man / Tao woman / Traveller (portrait letters M / W / T) |
| 主人家 | host family |
| 長輩；女性長輩／男性長輩 | elder; woman elder / man elder |
| a akes / a akey | kept in Tao: a akes, a akey |
| 阿公 / 外婆 | Grandpa / Grandma |
| 族人 | Tao people / the community (when it means people who must agree) |
| 族語 | Tao (the language) |
| 族語老師 | Tao language teacher |
| 船組 | boat crew |
| 旁白 / 文化聲明 | Narrator / Cultural note |

## Villages and places

Villages use their Tao names: 椰油 Yayo · 朗島 Iraraley · 東清 Iranmeylek · 野銀 Ivalino · 紅頭 Imorod · 漁人 Iratay.
部落 = village.

| 中文 | English |
|---|---|
| 開元港 | Kaiyuan Harbour |
| 東清灣 / 八代灣 | Dongqing Bay / Badai Bay |
| 小蘭嶼 | Little Orchid Island (Jimagaod) |
| 紅頭山 / 大森山 / 虎頭坡 | Mt. Hongtou / Mt. Dasen / Hutou Slope |
| 青青草原 | Qingqing Prairie |
| 蘭嶼機場 / 氣象站 / 燈塔 | Lanyu Airport / Lanyu Weather Station / Lanyu Lighthouse |
| 衛生所 | health station |
| 租車行 / 雜貨店 | scooter rental shop / grocery store |
| 涼亭 / 簷廊 / 地下屋 | pavilion (tagakal) / porch / underground houses |
| 潮間帶 / 灘頭 | tide flats / (boat) beach |
| 曬魚架 / 糧倉 | drying rack / food store |

Photo spots: Hongtou Rock, Carp Rock, Tank Rock, Jade Maiden Rock, Hen Rock, Helmet Rock, Elephant Trunk Rock,
Dragon Head Rock, Old Man Rock, Mantou Rock, Twin Lions Rock, Battleship Rock, Lovers' Cave, Sky Crack, Five Holes
Cave, Little / Big Heaven Lake, Lanyu Waterfall.

Place labels on the island and the fast-travel map come from content/places.json (`en`), content/ui.json
`travel[]` (`en`) and, for the names the world code writes itself (landmarks, lakes, quest spots, goat herds,
prompts), src/world/names.ts. Add a new place in all the places that apply.

## Boats, sea, fields

| 中文 | English |
|---|---|
| 拼板舟 | plank boat (tatala) |
| 大船 | big boat |
| 獨木舟（租的） | kayak (rented) |
| 水芋 / 水芋田 / 田埂 | taro (soli) / taro field / field bank |
| 飛魚 | flying fish (alibangbang) |
| 漁場 / 潛點 | fishing ground / dive spot |

## Seasons and time

| 中文 | English |
|---|---|
| 飛魚季 | flying fish season (rayon) |
| 招魚祭 | fish-calling festival (meyvanwa) |
| 終食祭 | end-of-eating festival (manoyotoyon) |
| 休漁期 | off-season (teyteyka / amian) |
| 清晨 / 白天 / 黃昏 / 夜晚 | dawn / day / dusk / night |
| 退潮 / 漲潮 | low tide / high tide |

On phones the season buttons use short forms: Fish-calling · Flying fish · End of eating · Off-season.

## Game words

| 中文 | English |
|---|---|
| 圖鑑手札 / 手札 | Notebook |
| 圖鑑 | field guide |
| 背包 | Bag |
| 任務；主線／支線 | Quests; Main / Side |
| 族語詞卡 | Tao word cards |
| 食材與營養 / 料理卡 | Food & nutrition / recipe card |
| 相簿與水下 | Album & underwater |
| 成就 | Milestones |
| 存檔 | Save |
| 生態值 / 尊重值 | nature points / respect points |
| 尊重：初訪／學習中／被信任／朋友 | First visit / Learning / Trusted / Friend |
| 部落關係 | village ties |
| 放棄出海 | Give up |
| 步行｜機車 | Walk / Scooter |
| 互動 / 交談 / 繼續 / 結束對話 | Interact / Talk / Next / End |
| 環島傳送 | Island travel |
| 雙語 / 僅繁中 / 僅族語（介面英文時） | Tao + English / English only / Tao only |
| 語言 / 對話 | Language (中文 / English) / Dialogue (the three modes above) |
