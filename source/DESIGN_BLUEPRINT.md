# Pongso no Tao｜蘭嶼文化島 — 設計藍圖 / Design Blueprint

> Interactive web RPG about Lanyu (Orchid Island) and Tao / Yami culture.
> 本文件以**臺灣繁體中文**撰寫，並保留英文技術名詞。達悟語羅馬拼音以公開文獻常見寫法為準，**完整語句須與族語協作者校訂**後才視為正式文本。
> Prototype language: Traditional Chinese (Taiwan) ONLY — never Simplified Chinese — plus Romanized Tao (`ciriciring no Tao`).

---

## 1. 已敲定的設計決策 / Settled decisions

| 題目 | 決策 |
| --- | --- |
| 主題 | 蘭嶼、達悟族（Tao；Yami 為他稱）。正式地名：**Pongso no Tao**（直譯「人之島」）。遊戲標題：**《Pongso no Tao｜蘭嶼文化島》**。 |
| 地理 | 依真實方位配置六大部落＋共享設施＋南方小蘭嶼 Jimagaod。 |
| 美術 | **A＋B 混合**：日常如清新繪本細緻像素（明亮好讀）；同時具備 HD-2D 的 3D 水面反光與日夜／黃昏光影。**不要** C（微縮模型／假感）。 |
| 相機 | 可 3D 旋轉視角（滑鼠拖曳、Q／R、縮放），角色精靈依相機做四方向朝向。 |
| 操作 | 主角在 3D 島嶼自由走動（鍵盤／搖桿／虛擬搖桿），靠近 NPC、水芋田或建築時互動。 |
| 語言 UI | 對話可切換 **雙語／僅繁中／僅族語**，**至少顯示一種**。 |
| 時間 | 提供時段與季節切換：清晨／白天／黃昏／夜晚＋招魚祭 meyvanwa／飛魚季 rayon／終食祭 manoyotoyon／休漁期。 |
| 核心小遊戲（完整版） | 拼板舟捕飛魚、傳統烹飪＋衛生所營養、水芋田／潮間帶生態辨識、族語文字對答。原型先做其中 2–3 個可玩迴圈。對答先用文字。 |
| 託管 | **不從個人網站連過去**。將來放在協作者帳號 repo 的 `/Tao-rpg/` 子路徑（對方是 primary account，Larry 可完全管理）。Vite `base: './'`，相對路徑。 |
| 開局 | 可選六大部落之一（久別返鄉或隔代尋根）或外來參訪者，也可隨機。共享主線與 100% 收藏里程碑；沒有單一強制結局，但有隱藏小任務。 |
| 地圖尺度 | 中小型精緻密度：各部落數棟代表建築與衛星水芋田、漁場；走路節奏緊湊。NPC 依時段在部落、田間與港口間移動。 |
| UI | 田野筆記／海島食譜手札（暖色紙、清楚字體、達悟幾何波紋／眼紋點綴），質感參考《歧路旅人》的清爽資訊層。 |
| 美術資產起步（B6） | 原型採用**可替換的細緻像素 PNG 程序生成稿**（`public/assets/sprites/`），方便逐張檢查與替換。正式繪師／協作美術可在不改程式的前提下覆蓋同名檔。3D 建築與 tatala 另以可替換貼圖建構。 |
| 開發順序 | **B（美術概念＋地圖藍圖）→ A（3D 可玩原型）→ C（完整部落與族語／食譜資料庫與小遊戲）**。 |

---

## 2. 地理配置 / Geography

座標系：`+X = 東 East`，`+Z = 南 South`，海平面 `y = 0`。見 `public/data/places.json` 與 `src/world/height.ts`。

順時針（自開元港／椰油起，符合實際環島方向）：

| 方位 | 部落 | 羅馬拼音 | 遊戲重點 |
| --- | --- | --- | --- |
| 西／西北 | 椰油 | Yayo | 最熱鬧、開元港、店家 |
| 北 | 朗島 | Iraraley | 領域最廣、潮間帶、上下部落 |
| 東北 | 東清 | Iranmeylek | 東清灣、曙光 |
| 東／東南 | 野銀 | Ivalino | 保存最完整的傳統地下屋 |
| 南／西南 | 紅頭 | Imorod（文獻亦作 Imowrod；遊戲統一用 Imorod） | 飛魚傳說起源、**衛生所**、八代灣望小蘭嶼 |
| 西南 | 漁人 | Iratay | 平坦、**蘭嶼機場** |

共享／衛星設施：

- **開元港**位於**椰油**西岸（真實位置）。外來參訪者預設由此上岸。
- **蘭嶼衛生所**位於**紅頭**（全島唯一衛生所）。在緊湊地圖上它與西岸交通帶（港、機場）同側、步行可及。這比「港邊衛生所」更接近真實地理，也保留「入港之後會走到健康知識據點」的設計意圖。
- **蘭嶼機場**位於**漁人**。
- 各部落後方／側翼：**衛星水芋梯田**。
- 各部落廣場：**涼亭 tagakal**、傳統半地下石屋、部分部落有教會與雜貨店。
- **飛魚海域**在西岸港外與東清灣外（飛魚季可見魚群）。
- **小蘭嶼 Jimagaod**在主島正南方。原型以眺望解鎖為主，航渡留給 Phase C。

環島道路以 packed-earth／瀝青感畫在地形貼圖上，串起六部落與港口。

**刻意不做成輕鬆景點的內容：** 紅頭傳統領域末端的核能廢料貯存場，若進入 Phase C 歷史線，須以嚴肅、非娛樂化的方式處理，且需與協作者討論是否納入。

---

## 3. 美術與攝影機 / Visual style & camera

- 3D 火山脊、梯田、海岸與小蘭嶼；`MeshStandardMaterial`＋方向光陰影（HD-2D 光影）。
- 海水：自訂 vertex／fragment shader，淺灘青綠、深海、Fresnel 反射、太陽高光、岸邊泡沫；顏色隨時段改變。
- 天空穹頂 shader：天頂／地平漸層、日／月圓盤、夜間星點。
- 角色、椰子樹、水芋、飛魚：64×64（或相應尺寸）細緻像素 **Y-axis billboard**，`NearestFilter`，**不要**粗顆粒 16×16 放大感。
- 拼板舟 **tatala／cinedkeran**：單體、雙尖、無舷外浮木（**NO outrigger**）。紅、白、黑幾何色帶與船眼（mata）語彙，為教學用簡化圖案，不是任何一艘真實聖船的複製。
- 傳統家屋為半地下石牆＋低矮茅屋頂的 3D 體塊，貼上 pixel 風格 stone／wood／thatch 貼圖。
- 相機：環繞玩家的 yaw／pitch／distance；滑鼠拖曳、Q／R 旋轉、滾輪縮放。角色四方向相對相機計算（面向鏡頭顯示南面）。

---

## 4. 語言呈現規則 / Language rules

對話框內聯切換，**永遠至少顯示一種**：

1. **雙語**：繁中正文＋羅馬拼音達悟語（或關鍵詞行）
2. **僅繁中**
3. **僅族語**（羅馬拼音）

原型中較長的族語行標為「教學草稿」，資料裡也有 `dialogues.json` 的 `notes` 欄說明。Phase C 應與族語老師／協作者逐句校訂，並可再加入聲音檔（非本階段）。

用詞原則：

- 自稱 **Tao**、島名 **Pongso no Tao**。
- 祭儀名優先使用文化知識網站與文獻常見形式：`meyvanwa`（亦作 mivanwa）、`rayon`、`manoyotoyon`（文獻亦有 panoyotoyon／manoytoyon）、收藏祭在資料中備註為 `mamoka`／`manoporoy`（完整歲時留給 Phase C）。
- 飛魚 `alibangbang`；小船 `tatala`；大船 `cinedkeran`；水芋 `soli`；涼亭 `tagakal`。
- `alibaong`：部分資料指芋頭田，**詞義待校訂**，詞卡已註明。

---

## 5. 遊戲循環與原型範圍 / Gameplay (Phase A)

### 開局
選部落或訪客 → 放置在該部落廣場或開元港 → 專屬開場問候 → 解鎖里程碑「踏上 Pongso no Tao」。之後共享全島任務。

### 可玩互動（至少 2–3 個）
1. **長輩對話**：雙語切換，解鎖詞卡（`Pongso no Tao`、`meyvanwa`、`rayon`、`alibangbang`、`tatala`、`soli`、`alibaong` 等）。
2. **紅頭衛生所**：護理師講解「飛魚與水芋的營養搭配」——蛋白質／Omega-3 與複合碳水／鉀的互補；同時尊重「飛魚不可與某些食物混煮」的傳統飲食禮。營養說明是補充，不是取代禮俗。
3. **水芋田採收**或**港口飛魚時機互動**（簡單 timing bar）。飛魚體驗**只在 rayon**開放；招魚祭時先學名字與等待；終食祭／休漁期則說明為何此時不捕、不食。此為教學體驗點，不是模擬神聖儀式或火把招魚本身。

### 圖鑑手札四頁
族語詞卡、傳統食材與食譜、營養與健康（衛生所筆記）、里程碑成就（含隱藏：四種光、歲時走一輪、望見小蘭嶼）。

### NPC
依時段與季節在部落、水芋田、港口、機場之間走動。遊客較常出現在機場／港口／東清，休漁期更明顯。

---

## 6. 資料架構 / Data schema

全部放在 `public/data/*.json`（可在不重編程式的情況下擴充，利於 Phase C）：

- `places.json` — 部落與設施座標、方位說明
- `glossary.json` — 詞卡（`id`, `tao`, `zh`, `aka`, `category`, `detail`）
- `recipes.json` — `ingredients[]`、`recipes[]`（營養、步驟、`unlockedBy`）
- `npcs.json` — `schedule[]`：`seasons`、`times`、`waypoints`（`*` 為萬用）
- `dialogues.json` — 開場與互動台詞（`zh` / `tao` / `unlocks`）
- `milestones.json` — 成就
- `asset_manifest.json` — 由 `scripts/generate_sprites.py` 產出的素材索引

解鎖寫在 `GameState`（記憶體；Phase C 可接 localStorage）。

---

## 7. 技術架構 / Technical architecture

```
Vite 6 + TypeScript + Three.js 0.170
base: './'          → 可放在 /Tao-rpg/ 或任何子路徑，亦可本機 npm run dev
src/core            Game, Assets, Input, State, TimeSeason
src/world           heightfield, Island albedo, SkyLighting, Ocean shader, buildings, populate
src/entities        Y-billboard characters, Player, scheduled NPCs
src/ui              田野手札 DOM UI
public/assets/sprites   可替換 PNG
public/data             JSON
```

操作摘要：

- 移動：WASD／方向鍵／虛擬搖桿（相機相對）
- 視角：滑鼠拖曳、**Q／R** 旋轉、滾輪縮放
- 互動：**E／F／空白鍵／Enter** 或右下「互動」（E 不作旋轉，避免衝突）
- 手札：J 或右上按鈕；Esc 關閉

---

## 8. 文化與倫理備註 / Care notes

- 這是**仍在生活中的文化**，不是凍結的標本。遊戲同時呈現傳統與現代（衛生所、教會、機場、遊客、雜貨店）。
- 拼板舟、地下屋、曬魚架是族人的生活與財產；開場即以訪客／返鄉者口吻提醒先問再靠近。
- 不戲仿祭儀、不把禁忌當笑點。教學小遊戲與真實漁團儀式分開說明。
- 船體不做舷外浮木。
- 族語文本須經校訂；不要把原型草稿當成「正確全句」。
- 建議 Phase C 與蘭嶼協作者、族語老師共同審美術圖案（避免誤用特定家族船紋）與文本。

---

## 9. 下一步 / Phase A → Phase C

Phase A（本原型已覆蓋）：地圖藍圖、可旋轉 3D 島、開局選擇、時段歲時、雙語對話、手札、2–3 個互動迴圈、可替換素材、子路徑建置。

Phase C 建議優先：

1. 與協作者校訂族語全文、詞義（尤其 `alibaong`）與祭儀時序（加入收藏祭 mamoka 等）。
2. 完整六部落差異化 NPC、歷史事件年表、隱藏故事。
3. 深化四類小遊戲：拼板舟航行物理、烹飪搭配、潮間帶生態辨識、族語對答題庫。
4. 正式細緻像素／部分手繪替換（覆蓋同名 PNG 即可）；船紋與服飾請族人審美。
5. 小蘭嶼航渡、夜間火把「觀看」事件（非讓玩家主持儀式）。
6. 100% 收藏、本機存檔、無障礙（字級、色對比、鍵盤完整操作）。
7. 部署到協作者 GitHub repo 的 `/Tao-rpg/`（GitHub Pages）。

