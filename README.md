# Pongso no Tao｜蘭嶼文化島

> [!WARNING]
> This is an experimental prototype.
>
> - Characters, relationships, options and story do not reflect any real persons, real personal relationships or real choices.
> - Cultural content is provisional and unverified, and is not authorized for reuse without the community's consent.
> - Nothing in this project implies endorsement by any person, community, organization or institution.

**Version 0.1.3**

Pongso no Tao is a browser RPG set on Lanyu (Pongso no Tao). Players walk the island with a small party and learn about Tao language, culture, traditional food, ingredients and nutrition. The current build is an early prototype for review, not a finished or authorized cultural work.

- Play: <https://kpyglobal.github.io/PongsoNoTao/>
- 攻略 / Guide: <https://kpyglobal.github.io/PongsoNoTao/guide.html> (a separate page; the game itself does not link to it)

Rights are held by Kristen Pin-Chun Yang, PhD and Larry Syu-Heng Lai, PhD. See [LICENSE](./LICENSE). Third-party material (the game engine, fonts, and provisional language or song sources) keeps its own terms; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

### What's new in 0.1.3

- **More to do:** 163 quests are written, and 78 of them can be played from start to finish. New ones include village side stories, night and seasonal quests, and two short stories with children.
- **Village recipes:** six elders each teach a traditional dish once you bring the ingredients. You can gather some ingredients on the shore at low tide, on the hills or in the fields, and buy others.
- **Bag and field guide:** a new 背包 tab shows what you carry, with a drawing for each item. Things you only watch (crabs, the owl, goats) go into the field guide.
- **Outfits:** the two Tao party members can unlock traditional clothing, and the visitor can unlock a woven hat and pouch. Their portraits and walking figures change to match. Visitors never wear Tao clothing.
- **Splitting up:** some quests send party members to different places, then bring everyone back together. Saving in the middle of this works.
- **Day, night and seasons:** some quests and gathering spots open only at certain times of day, at low tide, or in the flying-fish or winter season.
- **New people and places:** 13 passers-by and children around the harbour and villages, a geologist, and five new places (a beach, a shore, a school field, a sweet-potato field and a roadside wood).
- **Fixes:** the notebook tabs now fit on small phones, the Tao-language words can all be collected, and the Tao-name labels no longer show Mandarin or English placeholders.
- **Faster to change:** the game text and quest data now live in one place, so new quests, items and stories can be added without touching the game code.

### What was new in 0.1.1

- **Harbour exit:** the party can now walk off the 開元港 (Kaiyuan Harbour) dock onto the road. In 0.1.0 a strip of sea cut the dock off from the island.
- **Facing fix:** characters now face the way they walk. Walking right used to show them facing left.
- **Roads cleared:** buildings, trees and rocks no longer stand on the roads, and every road connects. Older saves that ended up inside a building or in the water move to the nearest open spot.
- **New character art:** new drawings for the party, and the small walking figures were redrawn to match.
- **Softer sprite joints:** knees and elbows on the small figures look smoother.
- **Underwater spots:** each dive spot keeps its one picture for everyone; unused draft pictures were removed from the source files.

## Run locally

```bash
cd source && npm install && npm run dev
```

Then open the local address printed by Vite (usually `http://localhost:5173/`).

## 繁體中文

這是一套以瀏覽器遊玩的實驗性原型 RPG，場景在蘭嶼（Pongso no Tao），核心是達悟族的語言、文化、傳統飲食、食材與營養。

**警告：** 本專案為實驗性原型。其中的角色、關係、選項與故事並不反映任何真實人物、真實私人關係或真實選擇。文化內容均為暫定、尚未經過查證，未經相關部落或社群同意，不得另行使用。本專案不表示任何個人、社群、組織或機構的背書或認可。

- 遊玩：<https://kpyglobal.github.io/PongsoNoTao/>
- 攻略：<https://kpyglobal.github.io/PongsoNoTao/guide.html>（獨立網頁，遊戲裡不會連過去）

### 0.1.3 更新

- **更多內容：** 共 163 個任務，其中 78 個可以從頭玩到尾。新增各部落的支線、夜晚與季節任務，以及兩段和小朋友有關的小故事。
- **部落食譜：** 六位長輩在你帶齊食材後，各教一道傳統料理。有些食材可以在退潮的海邊、山邊或田裡採集，有些可以用買的。
- **背包與圖鑑：** 新的「背包」分頁列出身上的東西，每樣都有插畫。只觀察不帶走的生物（螃蟹、角鴞、山羊）會記進圖鑑。
- **服裝：** 兩位族人隊員可以解鎖傳統服飾，旅人可以解鎖織草帽和小袋，畫像和地圖上的小人物都會跟著換。旅人不會穿達悟族的服飾。
- **分頭行動：** 有些任務會讓隊員分頭到不同地方，最後再集合。分頭途中存檔也沒問題。
- **白天、夜晚與季節：** 有些任務和採集點只在特定時段、退潮時，或飛魚季、冬季才開放。
- **新人物與地點：** 港口和部落多了 13 位路人和小朋友、一位地質學家，以及五個新地點（沙灘、灘頭、學校操場、地瓜田、路邊樹林）。
- **修正：** 手機上的手札分頁不再被擋住；族語詞卡都收集得到；族語名稱欄不再出現華語拼音或英文的暫用字。
- **更好修改：** 遊戲文字和任務資料集中在同一個地方，之後新增任務、物品或故事不必改程式。

### 0.1.1 更新

- **離開港口：** 隊伍現在可以從開元港碼頭走上公路。0.1.0 時碼頭和島之間隔著一段海，走不出去。
- **面向修正：** 角色走哪個方向就面向哪邊。以前往右走時，角色會面向左邊。
- **道路淨空：** 房子、樹和石頭不再擋在路上，所有道路都接得起來。舊存檔如果停在房子裡或水裡，讀取時會移到最近的空地。
- **新角色圖：** 隊伍成員換上新的畫像，地圖上的小人物也跟著重畫。
- **小人物關節更自然：** 膝蓋和手肘看起來更順。
- **水下景點：** 每個潛水點維持所有人看同一張圖；沒用到的草稿圖已從原始檔中移除。

版本 0.1.3。權利由 Kristen Pin-Chun Yang, PhD 與 Larry Syu-Heng Lai, PhD 持有，詳見 LICENSE。
