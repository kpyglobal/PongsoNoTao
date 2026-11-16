# Pongso no Tao｜蘭嶼文化島 0.1.6

> 這一版主要是讓遊戲在手機上更快打開，也讓操作更順手。
> This version is mostly about opening faster on phones and making the controls easier.

## 載入更快 Faster loading

- 第一次打開，標題畫面出現前要下載的東西少了約三分之一（模擬一般手機網路：約 2.8 MB → 1.8 MB），等待時間從約 15 秒縮短到約 11 秒。
  The first visit downloads about a third less before the title screen appears (simulated phone network: about 2.8 MB → 1.8 MB), and the wait drops from about 15 to about 11 seconds.
- 字體分成兩份：開頭畫面只用到的字先下載（很小），其他的字在標題畫面出現後才在背景下載。
  The font is split in two: the few characters the start screens need come first (a small file); the rest download in the background after the title appears.
- 中文玩家不再下載英文內容；選英文或中英雙語時才會下載。
  Chinese-only players no longer download the English text; it is only fetched for English or Chinese + English.
- 人物圖改用更小的檔案格式，畫面一模一樣，但大小只剩約四成。
  Character art uses a smaller file format: it looks exactly the same at about 40% of the size.
- 背景音樂重新壓縮，聽起來一樣，檔案小了約四成。
  The music is re-compressed: it sounds the same and the files are about 40% smaller.
- 卡片、頭像和相簿縮圖會在玩的時候慢慢在背景下載，打開時就不用等；畫面下方會有一個小小的「背景下載」提示。省流量模式下不會預先下載。
  Cards, portraits and album thumbnails download quietly in the background while you play, so they open without waiting. A small "Downloading" chip shows at the bottom while this happens. Nothing is downloaded ahead on Data Saver.
- 走近一個部落時，那裡的村民、音樂和景點照片會先在背景準備好。
  When you head toward a village, its people, music and scenic photos are prepared in the background first.

## 操作 Controls

- **點一下附近的人或東西就會走過去**：在大約 12 公尺內，點村民，大家會沿著可以走的路走過去，然後開始對話；點可以採集的東西，走過去就會採。點太遠的地方不會有反應。走的途中推一下搖桿（或按方向鍵）就會停下來，改成自己走。
  **Tap someone or something nearby to walk there**: within about 12 m, tap a villager and the party walks over along walkable ground and starts talking; tap something you can gather and it is gathered on arrival. Taps further away do nothing. Push the stick (or a direction key) on the way to stop and walk yourself.
- **右下角收成一個「選單」**：轉視角、重置、拉近拉遠、步行／機車、導引箭頭都收進「選單」裡，畫面更乾淨。「互動」按鈕變大，單獨放在旁邊。手機直向、橫向和電腦都適用。
  **The bottom-right buttons fold into one "Menu"**: turning the view, reset, zoom, walk / scooter and the guide arrow are inside "Menu", so the screen is cleaner. The "Interact" button is bigger and stands on its own. Works on phones (portrait and landscape) and computers.
- **機車會沿著公路騎**：騎在公路上時，往前推，機車會自己順著路轉彎；往旁邊推就能離開公路。
  **The scooter follows the road**: on a road, push forward and the scooter turns with the road by itself; push sideways to leave the road.
- **「繼續上次的旅程」直接回到島上**：有存檔時，標題畫面就有這個按鈕，按下去會跳過選角色和搭飛機／搭船的開場，直接回到上次存檔的地方。
  **"Continue your last journey" goes straight back to the island**: when there is a save, the title screen shows this button. It skips the party screen and the plane / boat opening and puts you back where you saved.

## 鏡頭與指引 Camera and guidance

- 走進部落時鏡頭會慢慢拉近，離開時再拉遠。中途自己縮放的話，會保持你設定的距離，直到下一次進出部落。
  The camera moves in gently when you walk into a village and back out when you leave. If you zoom yourself, your choice stays until you next enter or leave a village.
- **導引箭頭**：畫面上會有一個小箭頭指向目前追蹤任務的下一個地點，並顯示距離；目標在畫面外時，箭頭會停在畫面邊緣指出方向。可以在「選單」或手札「存檔」頁的「設定」裡關掉。
  **Guide arrow**: a small arrow points to the next place of the quest you are tracking, with the distance. When the place is off screen, the arrow waits at the screen edge and points the way. Turn it off in "Menu" or in the notebook's "Save" page under "Settings".

## 卡片 Cards

- 一次解鎖好幾張卡片時（例如拍照任務），卡片下方會出現「全部收下」，點一下全部一起飛進手札。
  When several cards unlock at once (for example after a photo quest), a "Collect all" button appears under the card: one tap sends them all into the notebook.

## 中英雙語 Chinese + English

- 中英雙語模式下，按鈕、手札分頁和手札內文也加上小字英文（英文小很多，中文也稍微縮小），就像對話框一樣。族語不加英文，也不會變成斜體。
  In Chinese + English mode, buttons, notebook tabs and notebook text now also get a small English line (much smaller English, slightly smaller Chinese), like the dialogue box. Tao words get no English line and are never italic.

## 地圖 Map

- 紅頭和漁人兩個部落稍微拉開了一點（兩村中心從約 42 公尺變成約 47 公尺），比較不會擠在一起。道路、步道全部重新檢查過。
  Imorod (紅頭) and Iratay (漁人) are a little further apart (village centres about 42 m → 47 m), so they feel less crowded. All roads and footpaths were checked again.
- 舊存檔會自動把隊伍移到同一個部落的新位置附近。
  Old saves move the party to the same spot in the village's new position.
