# content/

這裡放遊戲所有的文字與設計資料：任務、物品、食譜、人物、對話、拍照點、採集點、服裝。
每一種內容一個資料夾；要新增內容，就在資料夾裡加一筆資料或加一個檔案，不用改程式。

改完請執行：`node scripts/validate-content.mjs`，它會檢查編號有沒有重複、引用的人物和地點存不存在，以及每個任務是不是都做得完。
加上 `--review` 會列出需要請族人（文化顧問）確認的內容。

格式說明：`docs/phase1/CONTENT_SCHEMA.md`。設計說明：`docs/phase1/CONTENT_PHASE_A.md`。

遊戲在建置時會把這裡的檔案全部打包進去（`src/content/loader.ts`），開機時再檢查一次；資料有錯，遊戲會停下來並列出錯在哪裡。
新的路人或其他人物：在 `npcs/passersby.json` 加一筆就好。新地點：加到 `places.json` 後執行 `node scripts/check-roads.mjs`。
程式架構與「怎麼加任務、物品、支線」：`docs/phase1/ARCHITECTURE.md`。

## English (0.1.5)

Every player-facing text has an English sibling right after it: `zh` → `en`, any other text field `k` → `kEn`
(for example `text` → `textEn`, `toast` → `toastEn`, a list `kind` → `kindEn` with the same number of entries).
Keep Tao words in Tao and keep `{…}` slots. Words to use: docs/en-glossary.md.
Not translated yet: content/places.json and the fast-travel list `ui.json → travel` (after the map phase).
Dev-only fields (`notes`, `review`, `unlockedBy` …) need no English — see scripts/content/i18n-rules.mjs.

- `node scripts/content/i18n-extract.mjs out.json` lists texts still missing English
- `node scripts/content/i18n-apply.mjs table.json` fills them from a `{ "中文": "English" }` table
- `npm run content:check` fails when any English is missing
