# 背景音樂產生器 Music generator

`make_bgm.py` 把原創的曲子寫成 MIDI（每個聲部都有人性化的時間與力度、真實的掃弦），用 FluidSynth＋GeneralUser GS 音色庫算成立體聲，
再加上合成的空間殘響、輕微的磁帶飽和與 EQ、4 kHz 低通，壓成 44.1 kHz 立體聲 MP3（80 kbps）。祭典曲 0.1.4 不放。
`make_bgm.py` writes the original tunes as MIDI (humanized timing ±10–25 ms and velocity on every part, per-string strums),
renders stereo with FluidSynth + GeneralUser GS, then adds a synthesized convolution room, gentle tape saturation + EQ,
the 4 kHz low-pass and subtle width, and encodes 44.1 kHz stereo MP3 (80 kbps). The festival loop is not in 0.1.4 (parked in /workspace/audio-015/ for 0.1.5).

```
python scripts/audio/make_bgm.py              # all loops + the 3 stings
python scripts/audio/make_bgm.py title        # one loop
```

Needs Python with numpy, scipy and mido, plus FluidSynth and a soundfont. On the dev box: `/workspace/.audiovenv`,
`/workspace/.fluidsynth` (extracted from Debian's `fluidsynth` packages) and `/workspace/.soundfonts/GeneralUser-GS.sf2`
(from <https://github.com/mrbumpy409/GeneralUser-GS>); FluidR3_GM is the fallback. Elsewhere set `FLUIDSYNTH`,
`FLUIDSYNTH_HOME` (its libraries), `SF2` or `SF2_DIR`. Licences: `docs/AUDIO_CREDITS.md`.

It writes `public/assets/audio/bgm/*.mp3`, `public/assets/audio/sfx/{item,milestone,quest}.mp3` and, in
`content/audio/bgm.json`, `loop` (loop length) and `loopStart` (the title's intro; for the other loops a 35 ms guard
of wrapped loop audio, so MP3 frame edges never touch the seam). The shared hook is `HOOK` / `HOOK_DEV`.
