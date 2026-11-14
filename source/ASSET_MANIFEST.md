# 素材清單 / Asset Manifest

所有路徑相對 `public/assets/sprites/`（建置後同樣出現在 `dist/assets/sprites/`）。
機器可讀索引：`public/data/asset_manifest.json`（由 `npm run sprites` 重新產生）。

渲染慣例：角色與道具 PNG 放大時使用 **nearest-neighbor**（角色縮小時用 trilinear mipmap 防閃爍）。角色是**不受光（unlit）**的 `MeshBasicMaterial`：沒有高光、沒有環境反射，著色器把亮度壓在 0.78 以下（低於 bloom 門檻 0.82），白袍與邊緣光不會發亮。

角色色調（`src/core/game.ts` 的 `updateCharacterTint`，每幀每個角色只改一個顏色 uniform，不加渲染 pass）：站在屋簷下、緊貼建築或大樹樹冠下時，平滑變暗到約 0.75（陰影區在 `src/world/shade.ts` 預先由建築外框與樹木位置算好）；兩個角色在畫面上重疊時，離鏡頭較遠的那位約 0.85；兩者相乘最低 0.7。地形着色器貼圖可使用 anisotropic filtering。

## 如何替換 / How to swap

1. 維持**檔名、畫布尺寸、精靈表排版**即可直接覆蓋 PNG，不必改 TypeScript。
2. 角色表（方案二「歧路旅人風」，5 頭身 HD-2D 像素）：走路＋待機表 `256×768`，4 欄 × 8 列，每幀 `64×96`。第 0–3 列為走路（上到下 `s / w / n / e`，各 4 幀，`e` 為 `w` 鏡像）；第 4–7 列為待機（同樣 `s / w / n / e`），欄位依序為「靜止、吸氣（胸肩上抬 1px）、眨眼、靜止」，**只有呼吸起伏與偶爾眨眼，頭部完全不左右晃**。騎機車表 `ride_<outfit>_sheet.png` 每幀 `96×96`（4×4，機車畫在幀內），划 tatala 表 `canoe_<outfit>_sheet.png` 每幀 `128×96`（4×4，第 88 列為水線，以下已裁掉）。
3. 角色錨點：腳底在第 90 列（輪廓到第 92 列），水平置中。遊戲內角色 `worldH = CHAR_WORLD_H = 2.65`（`src/entities/billboard.ts`），成人可見身高約 1.9（長輩在圖上已矮約 5%，約 1.8）。待機動畫在 `SpriteBillboard.updateBillboard`：每個角色隨機相位，約 0.95 秒靜止／0.95 秒吸氣，每 2.5–6 秒隨機眨眼 110 毫秒。
   重新生成：`npm run sprites:chars`（或 `python3 scripts/generate_octo.py walk|ride|canoe`），原始碼在 `scripts/octo/`（`cast.py` 為每位角色的髮型、服裝、配色與道具；`fig.py` 為人體與服裝繪製；`poses.py` 為走路、待機、騎車、划船姿勢）。舊的 Q 版產生器封存在 `scripts/legacy/`，不在建置流程中。
4. tatala 表：`512×64`，四方向各 `128×64`，順序 `s w n e`。**不可加上舷外浮木／outrigger。** 場景中的 3D 船是程序幾何，與 PNG 並存；若要改 3D 船，編輯 `src/world/buildings.ts` 的 `makeTatala`。
5. 重新生成預設像素稿：`npm run sprites`（會覆寫未改名的生成檔；請先把你的手繪稿備份到別的資料夾）。它的舊版 v1 角色表只寫到 `characters/<kind>/<kind>_v1_sheet.png` 當參考，不會蓋掉遊戲用的角色表。

## 角色 / Characters（方案二 歧路旅人風，幀 64×96，走路＋待機表 256×768）

| ID | Sheet | 說明 |
| --- | --- | --- |
| player / player_f | `characters/player_sheet.png`、`player_f_sheet.png` | 族人主角（男生：短刺髮、織紋背心、串珠；女生：長髮、珊瑚色織帶上衣、靛藍裙） |
| player_visitor / player_visitor_f | `characters/player_visitor_sheet.png`、`player_visitor_f_sheet.png` | 臺灣本島旅人（男生／女生：漁夫帽、橄欖綠襯衫、背包、相機） |
| player_foreign / player_foreign_f | `characters/player_foreign_sheet.png`、`player_foreign_f_sheet.png` | 外國旅人（男生：沙金短髮、藍綠 T 恤、大登山包；女生：捲髮蓬髻、芥末黃 T 恤、深藍背包） |
| ride_* | `characters/ride_<outfit>_sheet.png`（384×384） | 上列六種主角的騎機車姿勢（四方向），含安全帽 |
| canoe_* | `characters/canoe_<outfit>_sheet.png`（512×384） | 上列六種主角坐 tatala 划槳（四方向）；無 outrigger |
| elder | `characters/elder_sheet.png` | 長輩：灰白髮、織紋背心、手杖 |
| farmer | `characters/farmer_sheet.png` | 芋田阿嬤：灰髮髻、點紋頭巾、條紋上衣、長裙、竹籃 |
| fisher | `characters/fisher_sheet.png` | 漁人：紅頭帶、條紋背心、串珠 |
| clinic | `characters/clinic_sheet.png` | 衛生所護理師：白袍、識別證、夾板 |
| harbor | `characters/harbor_sheet.png` | 港務人員：深藍帽、反光背心 |
| tourist | `characters/tourist_sheet.png` | 訪客：白帽、背包、相機 |
| villager | `characters/villager_sheet.png` | 一般族人：藍綠 T 恤、串珠 |
| player_researcher | `characters/player_researcher_sheet.png` | 研究訪客（NPC tourist_b）：遮陽帽、背心、筆記本 |

對話半身像：`public/assets/portraits/*.webp`（440×560，手繪水彩風；原稿為 `art-src/portraits/*.jpg` 綠幕，由 `npm run art` 去背）。主角：族人 `local`（男生）／`local_f`（女生）；臺灣本島旅人 `visitor_m`（男生）／`visitor`（女生）；外國旅人 `visitor_intl_m`（男生）／`visitor_intl_f`（女生）。Q 版半身像已退回，封存在 `style-proposals/chibi-portraits-archive/`。

## 拼板舟 / Tatala

| 檔案 | 尺寸 | 備註 |
| --- | --- | --- |
| `props/tatala_sheet.png` | 512×64 | 四方向 |
| `props/tatala/tatala_{s,w,n,e}.png` | 128×64 | 單體雙尖、紅白黑、船眼；無 outrigger |

## 建築 Billboard 參考圖（場景以 3D 體塊為主，PNG 供檢視／日後也可改 billboard）

| 檔案 | 尺寸 | 說明 |
| --- | --- | --- |
| `buildings/house_traditional.png` | 128×128 | 半地下石牆傳統家屋 |
| `buildings/tagakal.png` | 128×128 | 高架涼亭 |
| `buildings/clinic.png` | 96×128 | 衛生所 |
| `buildings/shop.png` | 96×112 | 雜貨店 |
| `buildings/church.png` | 96×144 | 教會 |
| `buildings/airport.png` | 128×96 | 航空站 |

3D 建築貼圖來自下方 `textures/`。

## 植物、飛魚、道具

| 檔案 | 尺寸 | 說明 |
| --- | --- | --- |
| `props/taro_0.png`–`taro_2.png` | 48×48 | 水芋葉叢，三變體 |
| `props/palm_0.png`–`palm_2.png` | 64×128 | 椰子樹 |
| `props/flying_fish_sheet.png` | 192×24 | 4 幀 × 48×24 |
| `props/flying_fish_0.png`–`_3.png` | 48×24 | 單幀 |
| `props/coconut.png` | 16×16 | 椰子道具圖示 |

## UI 紋樣

| 檔案 | 尺寸 |
| --- | --- |
| `ui/motif_wave.png` | 32×32 波紋／眼紋簡化 |
| `ui/motif_eye.png` | 24×24 |
| `ui/paper_tile.png` | 64×64 手帳紙張 |

## 地形與建築貼圖 / Tile textures（128×128，可 repeat）

`textures/grass.png`, `sand.png`, `rock.png`, `road.png`, `terrace.png`, `stone.png`, `wood.png`, `thatch.png`

島嶼著色器會把這些 paint 進 1024×1024 的 runtime albedo（見 `src/world/island.ts`）。

## 總覽接觸表

`CONTACT_SHEET.png`（720×280）— 給美術快速檢視生成稿。

## 資料檔 / Data files（`public/data/`）

見 `DESIGN_BLUEPRINT.md` 第 6 節。欄位以 UTF-8 JSON、繁體中文＋羅馬拼音書寫。


## 字型 / Fonts

| 檔案 | 字族 | 字重 | 用途 | 授權 |
|---|---|---|---|---|
| `public/fonts/noto-serif-tc-600.woff2` | Noto Serif TC | 600 | 副標、按鈕 | SIL OFL 1.1 |
| `public/fonts/noto-serif-tc-700.woff2` | Noto Serif TC | 700 | 標題、地名標籤 | SIL OFL 1.1 |
| `public/fonts/noto-sans-tc-400.woff2` | Noto Sans TC | 400 | 內文、對話 | SIL OFL 1.1 |
| `public/fonts/noto-sans-tc-500.woff2` | Noto Sans TC | 500 | 介面標籤 | SIL OFL 1.1 |
| `public/fonts/noto-sans-tc-700.woff2` | Noto Sans TC | 700 | 強調 | SIL OFL 1.1 |

由 `scripts/build-fonts.py` 自 `fonts-src/*.otf` 子集化；`public/fonts/fonts.css` 以相對路徑宣告。

## 程序化 3D 場景

地形（`src/world/height.ts`、`island.ts`）、海水（`water.ts`）、水芋田（`paddies.ts`）、建築與 tatala（`buildings.ts`）、聚落配置（`layout.ts`、`populate.ts`）皆為程式生成，無外部模型檔。

## Camera zoom (octo)
- `CAM_DEFAULT.dist` 22 (≈1.3× the old 17); wheel / pinch / ± buttons clamp to 16–46 (46 frames a whole village). 重置 returns to 22.
- Character sprites get gentle size compensation: `clamp((dist/22)^0.3, 0.9, 1.3)` (feet-anchored, visual only). Overlap boxes use the same factor.
- Overlap: the farther sprite fades to opacity 0.6 (plus tint 0.85) only while overlapping a nearer one; alphaTest scales with opacity, depthWrite stays on.
- Shots: `screenshots-octo/zoom/{desktop,mobile}-zoom-{1-min,2-default,3-max}.png`, `screenshots-octo/before-after-overlap-opacity.png`.
