# Third-party notices

This project includes or refers to material that remains under its own terms. The repository LICENSE does not replace those terms.

## three.js

The game uses [three.js](https://github.com/mrdoob/three.js) 0.170.0, licensed under the MIT License.

## Fonts (SIL Open Font License 1.1)

The following fonts are included as subsetted WOFF2 files and remain under the SIL Open Font License, Version 1.1.

**Game fonts (0.1.5 set「霞光書卷」):**

- **LXGW WenKai TC（霞鶩文楷 TC）** — The LXGW WenKai Project Authors ([lxgw/LxgwWenkaiTC](https://github.com/lxgw/LxgwWenkaiTC)). Used for Chinese titles, body text and the notebook. The OFL text is at [`source/fonts-src/LXGWWenKaiTC-OFL.txt`](./source/fonts-src/LXGWWenKaiTC-OFL.txt).
- **Cormorant Garamond** — The Cormorant Project Authors ([CatharsisFonts/Cormorant](https://github.com/CatharsisFonts/Cormorant)). Used for English and Tao text. No italic face is shipped; Tao words are never shown in italics. The OFL text is at [`source/fonts-src/Cormorant-OFL.txt`](./source/fonts-src/Cormorant-OFL.txt).

**Guide page fonts** (the separate guide page still uses these):

- **Iansui (芫荽)** — The Iansui Project Authors ([ButTaiwan/iansui](https://github.com/ButTaiwan/iansui)). The OFL text is at [`guide/fonts/OFL-Iansui.txt`](./guide/fonts/OFL-Iansui.txt) (also `source/public/guide/fonts/OFL-Iansui.txt`).
- **Literata** — The Literata Project Authors (TypeTogether / [googlefonts/literata](https://github.com/googlefonts/literata)). The OFL text is at [`guide/fonts/OFL-Literata.txt`](./guide/fonts/OFL-Literata.txt) (also `source/public/guide/fonts/OFL-Literata.txt`).

## Map data (OpenStreetMap, ODbL 1.0)

Since 0.1.4 the island's coastline and the real positions of villages and landmarks are based on [OpenStreetMap](https://www.openstreetmap.org/copyright) data (the Lanyu island polygon, relation 10730513, and place names and positions looked up through Nominatim). Data © OpenStreetMap contributors, available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Only a heavily simplified coastline and a list of positions are used (`source/src/world/outline.ts`, made by `source/scripts/dev/make-outline.py`, and `source/src/world/layout.ts`); no map images are included.

## Music and sound effects

The background music and the short UI sounds (since 0.1.4) are original compositions made for this project and rendered with the **GeneralUser GS 2.0.3** soundfont (© S. Christian Collins, free licence that allows use in software projects) using **FluidSynth** as an offline tool. The **FluidR3_GM** soundfont (MIT License) is a fallback used only by the generator. Neither soundfont nor FluidSynth is shipped in this repository; only the rendered audio is. No Tao traditional song is quoted, sampled or imitated. Full credits and licence texts: [`source/docs/AUDIO_CREDITS.md`](./source/docs/AUDIO_CREDITS.md) and [`assets/audio/CREDITS.txt`](./assets/audio/CREDITS.txt).

## Language and song sources (provisional / 暫定)

Tao-language phrases, glossary items, and short song-text snippets in the game data are marked **暫定** (provisional) and are attributed in the data files themselves. They are not authorized for reuse without the relevant community's consent. Sources noted in the data include:

- **族語 E 樂園** (Indigenous Language E-Park), including lesson material (for example「生活常用語」and specific lessons) and the **歌謠篇** (Yami / Tao songs) produced by 財團法人原住民族語言研究發展基金會 (Indigenous Languages Research and Development Foundation). In the data, the song texts are licensed as **CC BY-NC-SA 4.0** (non-commercial use, attribution required; other uses may require a separate request to the Foundation) and are marked 暫定.
- **何德華、董瑪女《達悟語：語料、參考語法、及詞彙》** — noted as a provisional source for some glossary items.

Item-level attribution is in the `source` (and, for songs, `license` and `status`) fields of `source/public/data/glossary.json` and `source/public/data/quests.json`.
