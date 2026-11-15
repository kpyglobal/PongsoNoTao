# 0.1.4 選單音效 / Arrival audio API

## Named sound effects

```ts
import { sfx, type SfxName, type MenuSfxId } from '../systems/audio/sfx'; // adjust relative path

sfx.play('menu_move');     // focus / keyboard cursor changed, or pointer entered a new enabled option
sfx.play('menu_confirm');  // selected / OK
sfx.play('menu_cancel');   // back / close
sfx.play('menu_open');     // optional: panel opened
sfx.play('menu_toggle');   // optional: tab, switch, checkbox
sfx.preload();             // optional; automatically done by preloadStings() when audio unlocks
```

All use the shared 音效 bus (♪ panel), including 音效 on/off + volume and the saved settings. Music settings are
independent. No playback before audio is unlocked by a tap/key; the first click can wait for the context to resume.
No event listeners are installed in UI files. The start-menu / arrival worker should wire these in.

- Call `menu_move` only when the selected option actually changes; not every pointermove or render.
- Move is throttled to 35 ms and replaces its previous tick (no overlap pile-up); confirm/cancel to 80 ms,
  open to 100 ms, toggle to 50 ms. A sound is dropped if the initial fetch/resume would make it >250 ms late.
- Don't double-trigger on pointerdown + click. Touch users need only the confirm on click, not a hover sound.
- Existing names also work: `sfx.play('item' | 'milestone' | 'quest')` (same ranked/merged stings as `sfxSting`),
  `sfx.play('shutter')`. Existing `sfxBlip`, `sfxBlipReset`, `sfxShutter`, `sfxSting` exports are unchanged.
- `sfx.names` lists all valid names. `window.__sfxPlay(name)` / `window.__sfx.menu` are debug/test helpers.

| Name / file in `public/assets/audio/sfx/` | Duration | Timbre | RMS before SFX settings |
|---|---:|---|---:|
| `menu_move.mp3` | 70 ms | soft marimba tick, A5 | −27 dBFS |
| `menu_confirm.mp3` | 220 ms | A4 + D5 ukulele pluck, nylon attack + glockenspiel D6 | −24.5 dBFS |
| `menu_cancel.mp3` | 180 ms | lower ukulele / nylon pluck down A4 → D4 | −26.5 dBFS |
| `menu_open.mp3` | 200 ms | two marimba notes up D5 → A5 | −26 dBFS |
| `menu_toggle.mp3` | 120 ms | soft kalimba F♯5 | −27 dBFS |

Files are 1.6–3.4 KB each. Realistic GeneralUser GS instruments, original notes, no pitch bends/glides, quiet
(7–9.5 dB below the item/milestone/quest stings). The SFX slider applies on top (default 50%).
Rebuild just these: `/workspace/.audiovenv/bin/python scripts/audio/make_bgm.py ui`.

## Music / segue

Both files: D major, 112 BPM, 4/4, **bar = 2.142857 s**. Shared: Rhodes / piano chord comping (no melody), string pad, pulsing fingered bass, light kit and room / vinyl texture;
the title's bed is brighter (piano top note on A5, airy high strings, choir in the lift, glockenspiel sparkle). No sliding guitar.

| File in `public/assets/audio/bgm/` | File duration | `loopStart` | `loopEnd` | Loop length |
|---|---:|---:|---:|---:|
| `menu.mp3` | 17.2125 s | 0.0348 s | 17.1777 s | 17.1429 s (8 bars) |
| `title.mp3` (v8: intro kept, new bed) | 45.392 s | 11.0714 s | 45.3571 s | 34.2857 s (16 bars) |

`loopStart`/`loopEnd` are seconds in the decoded file, not including MP3 encoder delay (Web Audio strips it).
The ~35 ms wrapped-audio guards at the file edges are not part of the loop. Use the manifest, not these rounded
numbers in code. Title: play from 0 for the epic opening; loop only `[loopStart, loopEnd)` for loading and the
modern start area (開元港 / airport). To enter that area directly, start at `loopStart`, not 0.

Menu v3 (Larry 11:42 PM): **no melody at all**, lo-fi atmosphere on the light forward 112 BPM groove. Rhodes comps
rootless maj7 / add9 voicings in a gentle syncopated rhythm; a soft piano plays the voicing's top two notes an octave up
on off-beats (a colour, not a tune). Voicings are fixed and voice-led so the top note barely moves (F#4 F#4 F#4 E4).
Soft string pad, warm pulsing 8th-note bass, kick on 1 / 3 + backbeat, hats from 8ths to 16ths in bars 5–8, a small fill
in bar 8, quiet room tone + soft vinyl ticks. Bars 7–8 build: pad swell (velocity + expression) and a soft noise riser
(band opening 400 Hz → 2.8 kHz, ≈ −30 dB under the music, eased out at the bar line). `gain: 0.7` vs title `0.9` makes it
≈2.2 dB quieter at the shared music volume. Chords Imaj9–IVmaj9–vi9–Vadd9 twice; the last V leads into the title
intro's I. It is safe to cut on any bar line with a short crossfade, best at the loop end after V (where the riser peaks).

Existing `src/systems/audio/bgm.ts` from the arrival-flow worker already exposes:

```ts
import { segueToTitle, titleIntroSeconds } from '../systems/audio/bgm';
const secondsUntilTitleFirstBeat = segueToTitle();
// align the arrival scene to that beat; titleIntroSeconds() currently returns 11.0714 (intro + crossfade).
```

That function preloads title while menu plays, schedules title at t=0 on the next menu bar line and fades menu
out over 350 ms. If implementing another player: bar lines are counted from `loopStart`; use absolute
AudioContext times, not a JS timer for the start; predecode both files. If the music is muted/not unlocked,
continue the scene silently. No UI files were changed for this audio task.

Seams checked after MP3 decode: title wrap step 0.0179 (ordinary waveform step 99th percentile 0.0277; no click
spike), menu wrap 0.051, inside bar 1's downbeat attack (the downbeats' own steps reach 0.052–0.062; no separate click). No gaps, no clipping. Subjective
listening review still belongs to Larry.

## Title v8 bed = modern-zone music (Larry 11:58 PM)

The title's intro (0–8.57 s) is spliced in from the approved master (`scripts/audio/approved/title_intro_v7.wav`), so it
does not change when the main section does. After it, a 2.5 s equal-power crossfade hands over to a 16-bar melody-free
bed (loop 11.0714 → 45.3571 s). `content/audio/bgm.json` `startZone.facilities` maps the modern zones to that loop:
`harbor` (開元港), `runway` + `terminal` (蘭嶼機場), `clinic` (衛生所, radius 12), `scooterShop` (radius 10), `hotel`
(radius 12). Keys are `FACILITIES` in `src/world/layout.ts`; `scooterShop` / `hotel` are not in the world yet and are
skipped until they are added there. `harbour_day.mp3` stays as the default island theme everywhere else.
