# 音樂與音效來源 Audio credits

## 背景音樂與 UI 音效（0.1.4 v6）Background music and UI stings
- 作曲與編曲：本專案原創，由 `scripts/audio/make_bgm.py` 寫成 MIDI 後合成。沒有引用、取樣或模仿任何達悟（雅美）傳統歌謠；傳統歌謠是族人的文化財產。
  Compositions: original to this project, written as MIDI by `scripts/audio/make_bgm.py`. No Tao (Yami) traditional song is quoted, sampled or imitated; those songs are the community's cultural property.
- 音色庫 Soundfont（v5 起）：**GeneralUser GS 2.0.3** — © S. Christian Collins, <https://www.schristiancollins.com/generaluser>.
  License v2.0: "You may use GeneralUser GS without restriction for your own music creation, private or commercial … feel free to use it in your software projects." Contained samples allow full use in music production. (The bank itself is not shipped; only audio rendered with it.) Full licence text below.
- 備用音色庫 Fallback soundfont：**FluidR3_GM.sf2** — © 2000–2002, 2008 Frank Wen, 2008 Toby Smithe. **MIT License** (Debian `fluid-soundfont-gm` 3.1-6). Used by the generator only if GeneralUser GS is missing.
- 合成器 Synthesizer：**FluidSynth 2.4.4** (LGPL-2.1+), used offline as a tool only; it is not shipped with the game.
- 殘響 Reverb：程式合成的空間脈衝響應（木造小廳／露天廣場），沒有使用錄音。
  Reverb: convolution with impulse responses synthesized by the generator (`make_ir`: a warm small hall, an open-air gathering); no recorded IR.
- 烏克麗麗音效 Ukulele stings（item / milestone / quest）：GeneralUser GS 的 "Ukulele"（GS bank 8）＋一層輕的 "Nylon Guitar"，同上授權。
  Ukulele stings: GeneralUser GS "Ukulele" (GS bank 8) layered with a quieter "Nylon Guitar"; same licence as above.
- 選單循環 `menu` 與選單音效 `menu_move` / `menu_confirm` / `menu_cancel` / `menu_open` / `menu_toggle`：原創，GeneralUser GS 的電鋼琴（Rhodes）、鋼琴、鐵琴、烏克麗麗（GS bank 8）、尼龍／鋼弦吉他、木琴、拇指琴、弦樂、貝斯與打擊樂，同上授權。
  Menu loop and menu UI sounds: original, rendered with GeneralUser GS instruments (Rhodes electric piano, piano, glockenspiel, ukulele, nylon / steel-string guitar, marimba, kalimba, strings, bass, percussion); same licence as above.
- 祭典／文化曲：0.1.4 不放（0.1.5 改用 AI 音樂模型或真人錄音重做）。The festival / culture loop does not ship in 0.1.4.
- 對話「嘟」聲與相機快門：程式即時合成（`src/systems/audio/sfx.ts`）。
  Dialogue blip and camera shutter: synthesized live in the browser.

### GeneralUser GS License v2.0
```
*** GeneralUser GS v2.0.3 ***
***      License v2.0     ***

** License of the complete work **
You may use GeneralUser GS without restriction for your own music creation,
private or commercial. This SoundFont bank is provided to the community free of
charge. Please feel free to use it in your software projects, and to modify the
SoundFont bank or its packaging to suit your needs.

** License of contained samples **
GeneralUser GS inherits the usage rights of the samples contained within, all of
which allow full use in music production, including the ability to make profit
from musical recordings created with GeneralUser GS.

Many of the samples are original, but some were taken from other banks freely
(and legally) available on the Internet from various SoundFont websites. Because
GeneralUser GS originated as a personal project with no intention for
publication, I cannot be 100% sure where all of the samples originated, although
I do know that none of them came from commercially published SoundFont packages
or sample CDs. Regardless, many "free" SoundFonts available on the web may
indeed contain samples of questionable origin. My understanding of the
copyrights of all samples is only as good as the information provided by the
original sources. If you become aware of any restricted samples being used in
GeneralUser GS, please let me know so I can replace them.

This uncertainty may concern you if you intend to use GeneralUser GS in a
commercial software product. That being said, I have never received any
complaint regarding sample ownership since I published the original GeneralUser
GS back in 2000, and as far as I am aware, neither have any of the companies
creating commercial software products using GeneralUser GS.

** More info **
If you plan to feature GeneralUser GS on your own website, please do not link
directly to my download files. Either link to my website, or provide your own
local copy instead.

I hope you enjoy GeneralUser GS! This SoundFont bank is the product of many
years of hard work.

You can find updates to GeneralUser GS and more of my virtual instruments at:
http://www.schristiancollins.com

I can be reached via the contact page on my website here:
https://www.schristiancollins.com/contact

Thank you!
-~Chris
```

### MIT License (FluidR3_GM)
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
