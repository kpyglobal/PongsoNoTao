# Pongso no Tao｜蘭嶼文化島

> [!WARNING]
> This is an experimental prototype.
>
> - Characters, relationships, options and story do not reflect any real persons, real personal relationships or real choices.
> - Cultural content is provisional and unverified, and is not authorized for reuse without the community's consent.
> - Nothing in this project implies endorsement by any person, community, organization or institution.

**Version 0.1.1**

Pongso no Tao is a browser RPG set on Lanyu (Pongso no Tao). Players walk the island with a small party and learn about Tao language, culture, traditional food, ingredients and nutrition. The current build is an early prototype for review, not a finished or authorized cultural work.

- Play: <https://kpyglobal.github.io/PongsoNoTao/>
- 攻略 / Guide: <https://kpyglobal.github.io/PongsoNoTao/guide.html> (a separate page; the game itself does not link to it)

Rights are held by Kristen Pin-Chun Yang, PhD and Larry Syu-Heng Lai, PhD. See [LICENSE](./LICENSE). Third-party material (the game engine, fonts, and provisional language or song sources) keeps its own terms; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

### What's new in 0.1.1

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

### 0.1.1 更新

- **離開港口：** 隊伍現在可以從開元港碼頭走上公路。0.1.0 時碼頭和島之間隔著一段海，走不出去。
- **面向修正：** 角色走哪個方向就面向哪邊。以前往右走時，角色會面向左邊。
- **道路淨空：** 房子、樹和石頭不再擋在路上，所有道路都接得起來。舊存檔如果停在房子裡或水裡，讀取時會移到最近的空地。
- **新角色圖：** 隊伍成員換上新的畫像，地圖上的小人物也跟著重畫。
- **小人物關節更自然：** 膝蓋和手肘看起來更順。
- **水下景點：** 每個潛水點維持所有人看同一張圖；沒用到的草稿圖已從原始檔中移除。

版本 0.1.1。權利由 Kristen Pin-Chun Yang, PhD 與 Larry Syu-Heng Lai, PhD 持有，詳見 LICENSE。
