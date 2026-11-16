# Pongso no Tao｜蘭嶼文化島

> [!WARNING]
> This is an experimental prototype.
>
> - Characters, relationships, options and story do not reflect any real persons, real personal relationships or real choices.
> - Cultural content is provisional and unverified, and is not authorized for reuse without the community's consent.
> - Nothing in this project implies endorsement by any person, community, organization or institution.

**Version 0.1.6**

Pongso no Tao is a browser RPG set on Lanyu (Pongso no Tao). Players walk the island with a small party and learn about Tao language, culture, traditional food, ingredients and nutrition. The current build is an early prototype for review, not a finished or authorized cultural work.

- Play: <https://kpyglobal.github.io/PongsoNoTao/>
- 攻略 / Guide: <https://kpyglobal.github.io/PongsoNoTao/guide.html> (a separate page; the game itself does not link to it)

Rights are held by Kristen Pin-Chun Yang, PhD and Larry Syu-Heng Lai, PhD. See [LICENSE](./LICENSE). Third-party material (the game engine, fonts, and provisional language or song sources) keeps its own terms; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

### What's new in 0.1.6

- **Faster loading:** on a simulated phone network, the first visit downloads about 1.8 MB before the title screen instead of about 2.8 MB, and the wait drops from about 15 to about 11 seconds. The font comes in two parts (the start screens' characters first, the rest in the background). Chinese-only players no longer download the English text. Character art and music files are about 40% smaller and look and sound the same. Cards, portraits and album thumbnails download quietly in the background while you play, with a small chip at the bottom; nothing is downloaded ahead on Data Saver. When you head toward a village, its people, music and scenic photos are prepared first.
- **Tap someone or something nearby to walk there:** within about 12 m, tap a villager and the party walks over along walkable ground and starts talking; tap something you can gather and it is gathered on arrival. Taps further away do nothing. Push the stick or a direction key to stop and walk yourself.
- **One "Menu" at the bottom right:** view, zoom, walk / scooter and the guide arrow fold into "Menu". The "Interact" button is bigger and stands on its own. Works on phones held upright or sideways and on computers.
- **The scooter follows the road:** push forward and the scooter turns with the road; push sideways to leave it.
- **"Continue your last journey":** with a save, the title screen offers this button; it skips the party screen and the plane / boat opening and puts you back where you saved.
- **Camera and guidance:** the camera moves in when you enter a village and out when you leave; your own zoom stays until the next village. A small guide arrow points to the next place of the tracked quest, with the distance; turn it off in "Menu" or in the notebook settings.
- **Collect all:** when several cards unlock at once, a "Collect all" button sends them all into the notebook with one tap.
- **More English in Chinese + English mode:** buttons, notebook tabs and notebook text get a small English line. Tao words get none and are never italic.
- **Map:** Imorod and Iratay are a little further apart (village centres about 42 m → 47 m). Old saves move the party to the same spot in the village's new position.

### What was new in 0.1.5

- **Chinese, English, or both:** you can play in Chinese, English, or Chinese + English. Pick a language on the start screens or later in the notebook settings, next to music and sound. The choice is remembered. If you have never picked one, a Chinese-language browser starts in Chinese, and any other browser starts in Chinese + English. In the bilingual mode, a smaller English line sits under the Chinese; with one language the sizes stay as before. Tao words stay in Tao (akokey, soli, tatala …), with an explanation wherever the Chinese gives one. Villages use their Tao names: Yayo, Iraraley, Iranmeylek, Ivalino, Imorod, Iratay. "Grandma" is always used for 外婆.
- **New fonts:** the type set is now「霞光書卷」: LXGW WenKai TC for Chinese titles, text and the notebook, and Cormorant Garamond for English and Tao. Tao words are never in italics. The bundled fonts are about 1 MB, smaller than before.
- **A new arrival opening:** after you choose plane or boat, you watch from the cabin window or the bow while the island loads. Then the plane flies in on an arc and descends toward Lanyu, or the yacht sails away toward the island, and the notebook stamps 抵達蘭嶼 as done. The window frame and the bow stay in view on a phone held upright or sideways.
- **New party screen:** the three portraits sit side by side in the middle, with a line that says the three travel together, each with their own purpose. The two Tao members are fixed; tap the traveller to switch male or female. Each Tao member has a small village menu, set to "random" by default, so they may come from the same village or from two different ones. When the villages differ, the party stays at the male member's home (the host family). "Coming home" is two check-ins, then a meeting at the host family's pavilion. Tasks from a woman elder take place at the female member's home; tasks from a man elder take place at the male member's home. Old saves still load, with both members from the same village as before.
- **A bigger island:** the whole island is about 40% bigger. Imorod now sits in its real place, next to Iratay. A new cross-island road runs over the hills from Imorod to Ivalino, past the weather station. Every house, work house, pavilion, church and school stands on a level terrace cut into the slope, and every building has a small path from its door to the road. "Round-island travel" now opens a map of the island; tap a place to go there. A red arrow shows where you are. 0.1.4 saves still load, with each member placed on the road near the same village or place.
- **Cards and the field notebook:** the first time you learn a Tao word, get an item, learn a dish or finish a set of clothes, a postcard appears, then shrinks into the notebook button at the top right. A recipe card is a torn scroll, with a row for each ingredient; ingredients you have not seen yet are grey and show "???". The bag is now a grid of pictures you can tap. Accepting a quest opens its own notebook page. With the traveller nearby, the first visit to a scenic spot takes a photo for the album; later visits only show a small camera icon.
- **Play-testing fixes:** a new game is now led by the male Tao member. The default view is a little farther out. Trees no longer hide buildings or their doors. The round-island road is smoother, with no new cliffs and no flooded road. Notices sit at the top right with shorter text; pickups such as "ingredient +1" appear as small text above the party. Villagers stay near their own spots and walk more slowly in the background. Goats graze and wander in small herds, mostly black. The stern of the yacht at the harbour is now white, matching the opening art. The version number shows on the title screen and in the notebook settings.

### What was new in 0.1.4

- **A new opening:** after the title screen you pick your party, then choose to arrive by plane or by boat. Before the choice you see a painted view of the real island; after it the camera pulls back to a cabin window and wing, or to the bow of a small yacht. The logo and title music play while the game loads in the background (a bar at the lower left). When loading is done the logo fades, then the plane banks toward the island, or the yacht drives forward out of view. The notebook then opens and marks 抵達蘭嶼 as done, and play starts. Both starts are next to a road and lead to the same scooter rental. Older saves skip the opening.
- **Menu music and sounds:** the start menu has its own light loop that leads into the title music, and short sounds for moving, confirming and going back. Music and sound effects can be turned on or off on the start screens, with the same setting as in the game.
- **Plane and yacht:** a small plane stands at the airport and a yacht is moored at 開元港, both solid 3D objects.
- **The real island shape:** the island now follows Lanyu's real coastline (from OpenStreetMap) and is a little bigger. The six villages, the harbour, the airport and the landmarks sit where they really are in relation to each other. Older saves move to the same spot in their village.
- **Every quest playable:** all 163 quests can now be played from start to finish (78 in 0.1.3). There are six new places to visit or to see from the road, including 五孔洞, 小天池, 大天池 and the 八代灣 lookout.
- **Clothing for some quests:** some festival, boat-fishing and village-event quests ask a Tao party member to put on traditional clothing first. The quest card says who needs to change.
- **Boats:** only Tao men paddle the tatala. Women and the visitor paddle a modern sea kayak, with shadows and water reflections that match the scene.
- **Music and sound:** new original music for the title screen (the big opening stays, followed by a relaxed modern island tune), the harbour, the sea, night, the hills and three villages, plus short ukulele-and-bell sounds when you find an item, reach a milestone or finish a quest. Music starts quietly. The ♪ button opens a sound panel with separate music and sound-effect sliders. No Tao traditional song is quoted or imitated; see [`source/docs/AUDIO_CREDITS.md`](./source/docs/AUDIO_CREDITS.md).
- **Eight directions:** characters now face eight directions when walking, riding and paddling.
- **Smoother ground:** village paths and roads no longer look like a checkerboard. They now look like packed earth with patches of paving.
- **Fixes:** the shellfish at 東清 can be gathered again (a pavilion had been built on the spot). Three buildings and a fish-drying rack that had no room in 0.1.3 are now in place. The checks run before each release are more reliable.

### What was new in 0.1.3

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

### 0.1.6 更新

- **載入更快：** 模擬一般手機網路時，第一次打開、標題畫面出現前要下載的東西從約 2.8 MB 變成約 1.8 MB，等待從約 15 秒縮短到約 11 秒。字型分成兩份（開頭畫面用到的字先下載，其他的在背景下載）。只玩中文的玩家不再下載英文內容。人物圖和音樂檔案小了約四成，看起來、聽起來都一樣。卡片、頭像和相簿縮圖會在玩的時候在背景慢慢下載，畫面下方有一個小提示；省流量模式下不會預先下載。走近一個部落時，那裡的村民、音樂和景點照片會先準備好。
- **點一下附近的人或東西就會走過去：** 大約 12 公尺內，點村民，大家會沿著可以走的路走過去，然後開始對話；點可以採集的東西，走到就會採。點太遠的地方不會有反應。途中推搖桿或按方向鍵就會停下來，改成自己走。
- **右下角收成一個「選單」：** 視角、縮放、步行／機車和導引箭頭都收進「選單」。「互動」按鈕變大，單獨放在旁邊。手機直拿、橫拿和電腦都適用。
- **機車會沿著公路騎：** 往前推，機車會順著路轉彎；往旁邊推就能離開公路。
- **「繼續上次的旅程」：** 有存檔時，標題畫面會有這個按鈕，按下去會跳過選角色和搭飛機／搭船的開場，直接回到上次存檔的地方。
- **鏡頭與指引：** 走進部落時鏡頭拉近，離開時拉遠；自己縮放的話，會保持到下一次進出部落。一個小小的導引箭頭會指向目前追蹤任務的下一個地點，並顯示距離；可以在「選單」或手札設定裡關掉。
- **全部收下：** 一次解鎖好幾張卡片時，點「全部收下」就會全部一起飛進手札。
- **中英雙語更完整：** 按鈕、手札分頁和手札內文也加上小字英文。族語不加英文，也不會變成斜體。
- **地圖：** 紅頭和漁人稍微拉開了一點（兩村中心從約 42 公尺變成約 47 公尺）。舊存檔會把隊伍移到同一個部落新位置的同一個地方。

### 0.1.5 更新

- **可以選中文、英文，或兩種一起：** 開頭畫面或手札設定裡就能選語言（中文／English／中文＋English），就在音樂、音效旁邊，選好會記住。如果還沒選過，用中文瀏覽器會開中文，其他瀏覽器會開「中文＋English」。兩種並列時，中文下面會再出一行比較小的英文；只選一種時，字的大小和以前一樣。族語詞仍用族語（akokey、soli、tatala……），華語有解釋的地方，英文也會有。部落用族語名：Yayo、Iraraley、Iranmeylek、Ivalino、Imorod、Iratay。「外婆」在英文裡一律寫 Grandma。
- **新字型：** 字型組改成「霞光書卷」：中文用霞鶩文楷 TC，英文和族語用 Cormorant Garamond。族語詞任何地方都不會用斜體。打包進去的字型大約 1 MB，比以前小。
- **新的抵達開場：** 選好搭飛機或搭船之後，會先從機窗或船頭看著島嶼載入。接著小飛機畫一道弧線朝蘭嶼降落，或遊艇駛向島嶼，然後手札把「抵達蘭嶼」記成已完成。直拿或橫拿手機時，機窗的框和船頭都看得到，不會被切掉。
- **新的角色選擇畫面：** 三個人的頭像並排在畫面中間，上面一句話說三個人一起旅行，各有各的目的。兩位族人是固定的；點旅人的頭像就能換男生或女生。男族人、女族人各有一個小的部落下拉選單，預設都是「隨機」，可以來自同一個部落，也可以來自兩個不同的部落。兩人不同部落時，大家住在男族人的家（主人家）。「回家報到」變成兩段，再一起到主人家的涼亭集合。女性長輩交代的事在女族人的家，男性長輩交代的事在男族人的家。舊存檔照樣可以讀，兩位族人都算同一個部落，跟以前一樣。
- **更大的島：** 整座島放大約四成。紅頭現在在真實的位置，就在漁人旁邊。新增一條從紅頭到野銀、經過氣象站的中橫公路。每一棟房子、工作屋、涼亭、教堂和學校都蓋在一塊整平的平台上，每棟房子門口都有小路接到公路。「環島旅行」現在會打開一張島嶼地圖，點一個地點就能去，紅色箭頭標出你在哪裡。0.1.4 的存檔照樣可以讀，隊員會被放到原本那個部落或地點附近的路上。
- **卡片和圖鑑手札：** 第一次學到族語詞、拿到東西、學會一道菜或做完整套衣服時，會出現一張明信片，點一下就會縮小飛進右上角的手札按鈕。食譜卡是一張捲軸，每樣食材一行；還沒見過的食材是灰色的，名稱顯示「???」。背包改成一格一格的圖片，點一下就能看。接到新任務會打開任務頁。旅人在隊伍裡而且就在旁邊時，第一次走到景點會自動拍照存進相簿；之後再去只會看到一個小相機圖示。
- **試玩回饋修正：** 新遊戲改由男族人帶頭。預設視野拉遠一點。建築物前面和門口的樹清掉了。環島公路比較平順，沒有新的斷崖，也沒有路面泡水。提醒框移到右上角，文字變短；拿到東西（例如「食材＋1」）會在角色頭上冒出一行小字。村民會在自己的地方附近走動，背景走動的速度也放慢了。山羊變成一小群一小群，會吃草、慢慢走動，大多是黑色的。港邊遊艇的船尾改成白色，跟開場插畫一樣。開頭畫面和手札設定裡會顯示目前的版本。

### 0.1.4 更新

- **新的開場：** 標題畫面之後先選隊伍，再選「搭飛機」或「搭船」來到蘭嶼。選好之前，先看到手繪的蘭嶼真實景色；選好之後，相機會往後拉，從機窗看見機翼，或站在遊艇船頭。開場時螢幕上有標誌和標題音樂，遊戲在背後載入，左下角有載入條。載好、標誌淡出之後，飛機會轉向蘭嶼，或遊艇向前駛離畫面。接著手札會打開，把「抵達蘭嶼」記成已完成，再開始遊戲。兩個起點都在路旁，也都會帶你去同一家機車出租店。舊存檔會跳過開場。
- **選單音樂和音效：** 開始選單有自己的輕快音樂，接到標題音樂；移動、確定、返回都有短音效。開始選單上就能開關音樂和音效，和遊戲裡的設定是同一個。
- **飛機和遊艇：** 機場停著一架小飛機，開元港停著一艘遊艇，都是可以碰撞的立體物件。
- **真實的島嶼形狀：** 島的海岸線改成照蘭嶼真實的形狀（資料來自 OpenStreetMap），島也稍微變大。六個部落、港口、機場和地標之間的相對位置都和真實一樣。舊存檔會移到原本部落裡相同的位置。
- **所有任務都能玩：** 163 個任務全部可以從頭玩到尾（0.1.3 是 78 個）。新增六個可以去看、或從路邊遠看的地點，像是五孔洞、小天池、大天池和八代灣觀景點。
- **部分任務要換服裝：** 有些祭典、出海捕魚和部落活動的任務，需要族人隊員先換上傳統服飾，任務卡會寫明是誰要換。
- **划船：** 只有達悟族男性划拼板舟（tatala）。女性和旅人划現代海上獨木舟，船的影子和水面倒影會跟著場景變化。
- **音樂與音效：** 新的原創音樂，包括標題畫面（保留氣勢磅礡的開場，接著是輕鬆的現代海島曲調）、港口、海上、夜晚、山上和三個部落；撿到東西、達成里程碑和完成任務時，會有烏克麗麗加鐘琴的短音效。音樂預設很小聲，按 ♪ 可以分別調整音樂和音效的音量。沒有引用或模仿任何達悟傳統歌謠，來源見 [`source/docs/AUDIO_CREDITS.md`](./source/docs/AUDIO_CREDITS.md)。
- **八個方向：** 走路、騎車和划船時，角色可以面向八個方向。
- **地面更自然：** 部落小路和道路不再像棋盤格，改成夯實的泥土地，夾雜一塊塊鋪面。
- **修正：** 東清的貝類又採得到了（之前有一座涼台蓋在採集點上）；0.1.3 擺不下的三棟建築和一座曬魚架現在都放好了；每次發佈前跑的檢查也更穩定。

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

版本 0.1.6。權利由 Kristen Pin-Chun Yang, PhD 與 Larry Syu-Heng Lai, PhD 持有，詳見 LICENSE。
