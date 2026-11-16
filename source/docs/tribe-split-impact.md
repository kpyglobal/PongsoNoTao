# Split hometowns for 族男 / 族女 — impact note (0.1.5)

Read-only investigation. No code was changed for this note.
Date: 2026-11-15 (America/Chicago). Working copy: `/workspace/tao-rpg`.

## English summary

Today the party has **one shared hometown** (`GameState.origin`), shown as「族人的家鄉部落（主人家）」. `@host`, `@hostf`, `@giver`, and the `host_*` places all resolve through that single village. **59 of 163 quests** use those tokens or places. Village side-quests (YY/IO/IM/IR/IT/IV, 16 quests) and the six recipe quests are **not** keyed off origin and would keep working.

If 族男 and 族女 may come from different villages:

- Personal quests (造船, 芋田/織布, 尋根 OF1/OF2) would send both members to the same house unless tokens are resolved per member.
- Joint “主人家” quests (Q03 回家報到, Q07 規矩, MS1, 全家吃飯, …) assume one house and, in Q03, that **both** grew up there.
- The save format has only `state.origin`. Old saves can migrate by copying it to both members.
- Pre-existing collisions (OF1 visits hardcoded 野銀/椰油 elders; W2 delivers to hardcoded 椰油/朗島/野銀 relatives) get slightly worse if that village is one member’s home.

**Recommendation (simplest consistent design):** store `originM` and `originF`, keep `origin` as the party’s **主人家** (default: 族男’s village, since he leads a new game). Resolve each quest’s host tokens/places by a fixed rule: if the quest has `giver`, use that member’s village; else if only one of 族男/族女 is in `roles`, use that member’s village; else use the 主人家. Special-case Q03 when the two homes differ (two check-ins, then meet at the 主人家 涼亭). Rewrite two or three Q03 lines. Effort: **about 1.5–2.5 days**, including save migration, tests, and the already-planned character-select UI.

## 現況：一個共享的家鄉

角色選擇畫面（`src/ui/dom.ts`）寫的是「先選兩位族人的家鄉部落（主人家）」：六部落 + 隨機，兩人共用。`visitor`（外來訪客）仍在 `content/ui.json`，但網格已跳過，隨機池也不含它。

遊戲開始時（`src/core/game.ts` `begin`）：

- `state.origin = home`（若選了已隱藏的 visitor，會落到椰油）
- `setHostPlaces(home)` 把 `host_home` / `host_taro` / `host_weave` / `host_tagakal` / `host_fishrack` 全部對到這個部落（`src/world/places.ts`）
- 並把該部落的女性長輩（`hostFemaleId`）搬到 `host_weave` 簷廊

之後所有「主人家」都指向這一處。

## 共用部落的假設在哪裡

### 存檔與狀態

| 位置 | 現況 | 若兩人不同部落 |
| --- | --- | --- |
| `GameState.origin` / `GameStateJSON.origin`（`src/core/state.ts`） | 單一 `OriginId` | 不夠用。建議加 `originM`、`originF`，並保留 `origin` 當主人家（或別名） |
| `SaveJSON`（`src/core/save.ts`）包著 `state` | 版本仍是 `v: 1` | 舊存檔沒有新欄位：載入時把既有 `origin` 填進兩人與主人家即可，不必升 `v` |
| 繼續遊戲摘要（`saveMeta`） | 「家鄉：椰油｜完成 n 項…」 | 要能顯示兩個家鄉（相同時維持一句） |
| 除錯 API `selectOrigin(id, gender, way)` | 只收一個部落 | 測試腳本（`scripts/test-quests.mjs` 點 `#btn-origin-iratay`，以及 `test-npc-speed`、若干 capture 腳本）都要跟著改 |

`quests` 存檔本身不存部落。部落關係 `stats.relation` 是全島一個數字，不是按部落，不受影響。

### 程式如何把「主人家」對到 NPC 與地點

全部在 `src/core/game.ts`，都讀 `this.state.origin ?? 'yayo'`：

- `@host` → `hostId()` → `elder_<origin>`
- `@hostf` → `hostFemaleId()` → `content/meta.json` `elders.f[origin]`（野銀是 `villager_taro`，紅頭是 `weaver_elder`）
- `@giver` → `giverId(q)` → 依任務的 `giver: "m"|"f"` 在**同一個** origin 查 `elders`
- 任務步驟的 `spot` / `meet` / `at`: `host_home`、`host_taro`、`host_weave`、`host_tagakal`、`host_fishrack`

`setHostPlaces` 在開新遊戲、讀檔、以及開局前 `addQuestPlaces()`（先暫定椰油）時呼叫。兩個家鄉同時進行時，不能再只維護一套座標，也不能只把一位女性長輩傳送到單一簷廊（另一村的長輩會從自己的行程裡消失）。

較乾淨的作法：解析某個任務步驟時，依該任務的「相關部落」臨時算出 NPC 與 `host_*`，不必改 content 裡的地點 id。

### 任務（content/）

全遊戲 163 則任務，**59 則**用到上述 token 或 `host_*` 地點。`q.village` 只是註記（這個任務發生在哪一村），引擎不用它來過濾「是不是自己的部落」。

以下用「若兩人不同村、但程式仍只認一個 origin」時會怎樣來分類。數字依建議規則（有 `giver` 跟該性別的村；否則看單一族人角色；否則用主人家）重算後，有幾則是跨戶的，會在各段註明。

#### 1. 開場・回家報到（一定要改流程或台詞）

- **Q03 回家報到**（`content/quests/open.json`）：`roles: [m, f]`、`n: 1`（兩人任一即可）、找 `@host`，再到 `host_tagakal`。台詞假設兩人是同一家的孩子，而且旅人住進來：
  - 「家裡都準備好了，**你們的朋友也一起住下來**。」
  - 「**你們小時候，就是在這裡聽我們說話長大的。**」
  - 提示：「由族男或族女回家鄉部落，找主人家的長輩。」
- **Q07 聽主人家長輩說明島上的規矩**：三人到同一個主人家，分頭辦事，再在 `host_tagakal` 集合。這則可以維持「住在哪一家就在哪一家聽規矩」，不必做兩次。

若只改 token、不改 Q03：其中一位等於沒回家，卻被寫成「在這裡長大」。這是最大的敘事風險。

#### 2. 造船（tatala，T1–T8）

`content/quests/tatala.json`。T1「拜師」起都是 `@giver`（男耆老），T4 在 `host_home` 拼板，T5（選用，男女一起）用 `@host` / `@hostf`。提示寫「部落的人都認識族男了，他可以請男性長輩教他造船。」

NPC 已按主人家部落替換，這點本來就對。若兩人不同村，拜師與造船應跟**族男的村**，不必跟族女。T5 下水獻芋頭牽涉「主人家」男女長輩，建議跟主人家（或族男的家），不要拆成兩村各做一次。

#### 3. 尋根 / 族服（OF1、OF2、OF3）

`content/quests/outfits.json`。

- **OF1 尋根：阿公的船組**（僅族男）：先問 `@host`，再去問寫死的 `elder_ivalino`、`elder_yayo`，最後由 `@hostf` 交衣服。跨村拜訪是刻意的（「去問野銀和椰油的長輩，他們跟他一起出過海」），不是「只能問同村」。若族男的家就是野銀或椰油，會對同一位長輩講兩段不同的話（**現在單一家鄉時就有這個問題**）。`@host` / `@hostf` 應改為族男的村。
- **OF2 尋根：外婆的織布與水芋田**（僅族女）：寫死先找紅頭 `weaver_elder`、再找野銀 `villager_taro`，再到 `host_taro`、`@hostf`。台詞寫「她的水芋田在野銀」「那塊田現在是你家的長輩在照顧」。若族女不是野銀人，`host_taro` 與「外婆的田」會對不上（同樣是現有問題）。`host_taro` / `@hostf` 應改為族女的村；寫死的跨村拜訪可保留，必要時加一句解釋。
- **OF3** 在 `host_weave` 幫旅人編小袋：跟族女的簷廊即可。

這三則都不必因為「不同部落」而鎖住或重寫整條尋根；只要主人家 token 跟對的那一位，並處理與寫死 NPC 重疊的情況。

#### 4. 族人分工（芋田、織布、飼養）

- 芋田 R1–R6、G1（`taro.json`）：幾乎都是 `giver: f` + `@giver` + `host_taro` / `host_home`。R1 雖是族男去幫忙，田仍是女方那一家的。**應跟族女的村。**
- 織布與家務 J1–J4、A3（`member.json`）：J1–J4 在 `host_weave` / `@hostf` / `host_home`，同樣跟族女。A3 修田埂是 `giver: f` + `host_taro`，也跟族女。

#### 5. 飛魚主線裡的主人家

`content/quests/main-flyingfish.json` 等：

- 出海、灘頭（M1、M3、M4、F2、G4、A2）：`giver: m`，跟**族男的村**（船組、男耆老）。
- 曬魚、煮飯、入倉（M6、M7、M10、G2）：`giver: f`，跟**族女的村**。
- **M5 交接飛魚**（男女都有，`giver: m`，卻用 `@hostf` + `host_home`）：魚要交給「家裡的女人」。若不同戶，應送到**族女的家**（或主人家，若決定全隊住那裡），不要送到族男船上用的那一戶卻找不到女長輩。
- **F1**（男女，`giver: m`，同時有 `@giver` 與 `@hostf`）：前半在男耆老、後半問女長輩，可能跨兩村，步驟上要能接受。
- 旅人 / 全家：M8（`@host`）、M9 全家吃飯、Z1 年終在涼亭說一句 → **主人家**。

#### 6. 其他「到主人家」的聯合任務（約 20 則）

用同一個 主人家即可，不必改成兩次：

- 開場 Q07；分頭 MS1（`split.json`）
- 夜晚 NT1、NT5（`night.json`）
- 旅人 V2–V5（`visitor.json`；V6 學結網在 `host_home`，較適合族男的家或主人家）
- later：W1 糧倉、W5 陸蟹回報、H1 錄長輩的話、H2 營養師先問主人家
- modern：E1、E4、N1 親從子名
- tide：C3 椰子蟹（跟 `@host` 說）

**W2 把芋頭分給三戶親族**（`later.json`，`giver: f`）：從 `@hostf` 出發，採 `host_taro`，再寫死送到 `elder_f_yayo`、`elder_f_iraraley`、`villager_taro`。若主人家／族女的家就是這三村之一，會把芋頭送給同一位長輩兩次（現有問題）。應跟族女的村出發，並在目的地與 `@hostf` 重疊時改送另一村。

#### 7. 不受 origin 影響、可維持現狀

- 六部落拜訪 K1–K6，以及 `content/quests/villages/*.json` 共 16 則（YY/IO/IM/IR/IT/IV）：解鎖條件是「去過該村關鍵人物」（例如 YY-F1 要 K3），**不是**「那裡是不是自己的家鄉」。
- 六則食譜 FD1–FD6：老師寫死在各村（`recipe.village` + `keeper`），與隊伍家鄉無關。
- 拍照、語言、多數潮間帶／現代生活任務：沒有 `@host` / `host_*`。
- `content/dialogue/legacy.json` 裡依部落而寫的歡迎詞（椰油「歡迎回家」等）目前沒有程式呼叫，不算這次的阻擋項。

### 對話裡已經把「兩人同一家」寫死的句子

最關鍵的是 Q03 那兩句（見上）。其餘「家裡的長輩」「家裡的女人」在單一相關成員的任務裡，改 token 之後仍然通順。K2「機場就在我們部落旁邊」、NT4「這是我們部落的晚會」講的是該村本身，與隊伍家鄉無關。

### 介面

角色選擇的文案與單一網格要改成兩個小下拉（預設隨機），這本來就在 0.1.5 角色選擇重做的範圍。`pendingStart` 與 `onOrigin` 目前只帶一個 `id`。

## 建議的設計（最簡單、還能前後一致）

1. **每人一個家鄉，另外保留一個主人家。**
   - `originM`、`originF`：角色選擇各一個下拉，預設隨機（可抽到同一村）。
   - `origin`（主人家，全隊借住、聯合任務集合處）：預設為族男的村（新遊戲由他帶頭）。兩人同一村時三者相同。若之後覺得需要，再加「這次住哪一家」，不必第一版就做。
2. **解析 `@host` / `@hostf` / `@giver` / `host_*` 的規則（每個任務套用一次）：**
   - 有 `giver` → 用該性別的家鄉（芋田／織布／女耆老 → 族女；造船／船組／男耆老 → 族男）。
   - 否則若 `roles` 只含族男或只含族女 → 用那一位的家鄉。
   - 否則（三人、旅人為主、沒有 giver）→ 用主人家。
   - 例外：M5 交接飛魚雖然 `giver: m`，交魚與 `@hostf` 應落到族女的家（或主人家，若與族女同住）。實作時用一小張例外表比再發明一套規則安全。
3. **Q03：** 兩人同村則維持現況。不同村則改成兩步報到（各回自家），再在主人家涼亭集合；「你們小時候……長大的」改成只對該戶的孩子說，並加一句歡迎同學借住。工作量比維持單一步但讓其中一人沒回家要值得。
4. **OF1 / W2（以及 OF2 若 `host_taro` 與寫死的野銀田撞在一起）：** 寫死的拜訪／送禮對象若已是主人，就改指另一村，或跳過重複步驟。這本來就該修。
5. **存檔：** 寫入 `originM` / `originF`；讀舊檔時兩者與主人家都等於舊的 `origin`。繼續遊戲那一行在兩村不同時寫「家鄉：椰油／野銀」。
6. **不要**把六部落支線改成「只在自己村解鎖」。現在「先拜訪再幫忙」的結構是對的，不同家鄉反而更合理。

## 工作量粗估

| 區塊 | 預估 |
| --- | --- |
| 狀態、存檔遷移、`npcFor` / `host_*` 依任務解析、停掉「只傳送一位女長輩」 | 0.5–1 天 |
| Q03 不同村的兩段報到 + 少數台詞 | 0.5 天 |
| M5 例外、OF1／W2（／OF2）與寫死 NPC 重疊 | 0.25–0.5 天 |
| 角色選擇兩個下拉（併進已規劃的重做）+ `selectOrigin` 與測試 | 0.5 天 |
| **合計** | **約 1.5–2.5 天** |

不算大改地圖。不建議做「每個聯合任務都跑兩次」或「兩套完整 host 地點寫進 content」——前者會把主線拉長，後者要改 59 則任務的資料。

若只做「兩個下拉、但後端仍寫同一個 origin」，選擇會是假的，Q03 與尋根都會說錯話，不建議。
