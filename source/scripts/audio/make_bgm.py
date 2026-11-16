#!/usr/bin/env python3
"""Background music + UI stings (0.1.4, v5 "less digital, more real"): seamless loops, all original melodies.

Compositions are written here as MIDI (key, chords, the shared hook, arrangement) and rendered in stereo with
FluidSynth using the GeneralUser GS 2.0.3 soundfont (free licence, S. Christian Collins; FluidR3_GM, MIT, is the
fallback; see docs/AUDIO_CREDITS.md). Every part is humanized (timing ±10–25 ms, velocity), strums sweep string by
string, the soundfont's own reverb / chorus are off; post: synthesized convolution room, gentle tape saturation + EQ,
the 4 kHz low-pass, subtle stereo width. (The festival / culture loop is not in 0.1.4; its generator is parked in
/workspace/audio-015/make_festival.py for 0.1.5.)
Nothing is sampled from recordings and no song is quoted: Tao traditional songs are cultural property and are NOT
used or imitated. Mood only: a happy, sunny Pacific-island soundtrack.

  python scripts/audio/make_bgm.py [track ...]      # needs numpy, scipy, mido + fluidsynth (see README)

Output: public/assets/audio/bgm/<track>.mp3 (44.1 kHz stereo, 80 kbps), public/assets/audio/sfx/<sting>.mp3. Loop
lengths and "loopStart" are written back into content/audio/bgm.json.

Seamless loops: each MIDI holds the loop three times; post-processing runs on the whole linear render, and the middle
copy (which carries the room / note tails of the copy before it) is the loop. The title keeps its one-time intro in
front (file = intro + loop); the other files wrap a 35 ms guard of loop audio around the loop so MP3 frame edges never
touch the seam. The game loops [loopStart, loopStart + loop).

The not-shrill limits stay: a 4th-order 4 kHz low-pass, equal loudness (RMS), a soft limiter.
"""
import json, os, subprocess, sys, wave
import numpy as np
from scipy.signal import fftconvolve, butter, sosfiltfilt  # type: ignore
import mido  # type: ignore

SR = 44100
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'audio', 'bgm')
OUT_SFX = os.path.join(ROOT, 'public', 'assets', 'audio', 'sfx')
FS_HOME = os.environ.get('FLUIDSYNTH_HOME', '/workspace/.fluidsynth')
FLUIDSYNTH = os.environ.get('FLUIDSYNTH', os.path.join(FS_HOME, 'usr/bin/fluidsynth'))
# v5: GeneralUser GS 2.0.3 (S. Christian Collins; free licence, see docs/AUDIO_CREDITS.md) — warmer, more natural
# nylon / steel guitars, strings and percussion than FluidR3_GM, which stays as the fallback.
SF2_DIR = os.environ.get('SF2_DIR', '/workspace/.soundfonts')
SF2 = os.environ.get('SF2') or next((f for f in (os.path.join(SF2_DIR, 'GeneralUser-GS.sf2'),
                                                os.path.join(FS_HOME, 'usr/share/sounds/sf2/FluidR3_GM.sf2')) if os.path.exists(f)))
MAJOR = [0, 2, 4, 5, 7, 9, 11]
PENTA = [0, 1, 2, 4, 5]
TPB = 480
TARGET_RMS = 0.12  # about -18.6 dBFS for every loop (stereo RMS)
MP3_RATE = '48k'  # 0.1.6: was 80k; the loops are 4 kHz low-passed, 48 kbps sounds the same at 60 % of the size
GUARD = 1536  # samples of wrapped loop audio before / after the loop region (see render_track)  # stereo, 44.1 kHz (joint stereo keeps it small)
LP_HZ = 4000


def deg(root, d):
    o, k = divmod(d, 7)
    return root + 12 * o + MAJOR[k]


# ---------------------------------------------------------------- the shared hook
# "Pongso no Tao" hook: call (rises mi-sol-la … up to re', settles on la) + answer (comes home to do).
# Pentatonic only (do re mi sol la), so it is easy to sing. (step, length, degree) in eighth-notes, 4 bars.
HOOK = {
    8: [(0, 1, 2), (1, 1, 4), (2, 2, 5), (4, 1, 4), (5, 1, 5), (6, 2, 7),
        (8, 3, 8), (11, 1, 7), (12, 4, 5),
        (16, 1, 2), (17, 1, 4), (18, 2, 5), (20, 1, 4), (21, 1, 2), (22, 2, 1),
        (24, 6, 0)],
    6: [(0, 2, 2), (2, 1, 4), (3, 2, 5), (5, 1, 7),
        (6, 3, 8), (9, 1, 7), (10, 2, 5),
        (12, 2, 2), (14, 1, 4), (15, 2, 5), (17, 1, 1),
        (18, 6, 0)],
}
# developed answer: the call again, then the answer climbs a step higher before coming home
HOOK_DEV = {
    8: HOOK[8][:9] + [(16, 1, 5), (17, 1, 7), (18, 2, 8), (20, 1, 7), (21, 1, 5), (22, 2, 4),
                      (24, 2, 2), (26, 1, 1), (27, 5, 0)],
    6: HOOK[6][:7] + [(12, 2, 5), (14, 1, 7), (15, 2, 8), (17, 1, 7), (18, 2, 4), (20, 1, 2), (21, 3, 0)],
}
HOOK_CHORDS = [0, 3, 4, 0]  # I IV V I
B_CHORDS = [5, 3, 0, 4]  # vi IV I V


def bridge(rng, steps, lo=2, hi=9):
    """4-bar contrasting phrase over B_CHORDS: chord tones on strong beats, pentatonic steps between."""
    rhythms = {8: [[2, 2, 2, 2], [3, 1, 2, 2], [2, 1, 1, 4], [1, 1, 2, 2, 2], [4, 2, 2]],
               6: [[3, 3], [2, 1, 3], [1, 1, 1, 3], [3, 2, 1]]}[steps]
    pent = [o * 7 + p for o in range(3) for p in PENTA if lo <= o * 7 + p <= hi]
    out, cur = [], 5
    for b, c in enumerate(B_CHORDS):
        rh = rhythms[rng.integers(len(rhythms))] if b < 3 else ([4, 4] if steps == 8 else [6])
        pos = 0
        for L in rh:
            if pos == 0 or pos == steps // 2:
                ct = [p for p in range(lo, hi + 1) if p % 7 in {c % 7, (c + 2) % 7, (c + 4) % 7}]
                cur = min(ct, key=lambda x: abs(x - cur) + rng.random())
            else:
                i = min(range(len(pent)), key=lambda j: abs(pent[j] - cur)) + int(rng.choice([-1, 1, 1, -1, 2]))
                cur = pent[max(0, min(len(pent) - 1, i))]
            out.append((b * steps + pos, L, int(cur)))
            pos += L
    if b == 3 and out[-1][2] % 7 not in {4, 1, 6}:  # end the bridge on the V chord's tone, leading back to the hook
        s, L, _ = out[-1]
        out[-1] = (s, L, 4)
    return out


# ---------------------------------------------------------------- MIDI building
class Song:
    def __init__(self, bpm, steps, root):
        self.bpm, self.steps, self.root = bpm, steps, root
        self.notes = []  # (ch, beat, dur, pitch, vel)
        self.cc = []  # (ch, beat, cc, value)
        self.prog = {}
        self.pb = []  # (ch, beat, bend -1..1)
        self.check = []  # (role, nominal beat, length, pitch) for check_harmony
        self.chords = []  # (start beat, chord degree)

    def program(self, ch, p):
        self.prog[ch] = p  # int, or (program, bank) for the GS variation banks

    def n(self, ch, beat, dur, pitch, vel):
        self.notes.append((ch, beat, max(0.05, dur), int(pitch), int(max(1, min(127, vel)))))

    def bar_beats(self):
        return self.steps / 2

    def write(self, path, reps=3, intro_bars=0):
        """intro once, then the loop body `reps` times (events with beat >= intro are the body)."""
        mid = mido.MidiFile(ticks_per_beat=TPB)
        tr = mido.MidiTrack()
        mid.tracks.append(tr)
        ev = [(0, mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(self.bpm)))]
        for ch, p in self.prog.items():
            p, bank = p if isinstance(p, tuple) else (p, 0)
            ev.append((0, mido.Message('control_change', channel=ch, control=0, value=bank)))
            ev.append((0, mido.Message('program_change', channel=ch, program=p)))
            ev.append((0, mido.Message('control_change', channel=ch, control=91, value=0)))  # room comes from the IR
            ev.append((0, mido.Message('control_change', channel=ch, control=93, value=0)))  # no digital chorus
            ev.append((0, mido.Message('control_change', channel=ch, control=10, value=PAN_POS.get(ch, 64))))
        intro = intro_bars * self.bar_beats()
        body = self.body_bars * self.bar_beats()

        def copies(beat):
            if beat < intro - 0.1:
                return [beat]
            return [beat + r * body for r in range(reps)]

        for ch, beat, dur, pitch, vel in self.notes:
            for b in copies(beat):
                ev.append((int(b * TPB), mido.Message('note_on', channel=ch, note=pitch, velocity=vel)))
                ev.append((int((b + dur) * TPB), mido.Message('note_off', channel=ch, note=pitch, velocity=0)))
        for ch, beat, c, v in self.cc:
            for b in copies(beat):
                ev.append((int(b * TPB), mido.Message('control_change', channel=ch, control=c, value=int(v))))
        for ch, beat, v in self.pb:
            for b in copies(beat):
                ev.append((int(b * TPB), mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, v * 8192))))))
        end = intro + body * reps + 8
        ev.append((int(end * TPB), mido.MetaMessage('end_of_track')))
        ev = [(max(0, t), m) for t, m in ev]
        ev.sort(key=lambda e: (e[0], 0 if e[1].type in ('note_off', 'control_change', 'program_change', 'set_tempo', 'pitchwheel') else 1))
        last = 0
        for t, m in ev:
            m.time = t - last
            last = t
            tr.append(m)
        mid.save(path)
        return intro * 60 / self.bpm, body * 60 / self.bpm


# drum lanes: char -> (GM percussion note, velocity)
DRUM = {'k': (36, 70), 'K': (35, 95), 'c': (63, 62), 'C': (62, 58), 'l': (64, 70), 'b': (60, 55), 'B': (61, 50),
        's': (70, 34), 'S': (70, 50), 'x': (39, 88), 'X': (39, 110), 'q': (75, 45), 'w': (77, 50)}
CH = dict(lead=0, lead2=1, strum=2, pick=3, bass=4, pad=5, choir=6, taiko=7, solo=8, drums=9, choir2=10)
# subtle stereo stage: lead centre, its double / picking a little right, strums a little left
PAN_POS = {0: 64, 1: 78, 2: 46, 3: 84, 4: 64, 5: 64, 6: 72, 7: 58, 8: 64, 9: 64, 10: 56, 11: 50, 12: 74}


def chord_pitches(root, c, lo, hi):
    pcs = {(deg(root, c + i)) % 12 for i in (0, 2, 4)}
    return [p for p in range(lo, hi + 1) if p % 12 in pcs]


def human(rng, bpm, sd_ms=12, clip_ms=25):
    """a player's timing: normal spread (sd ~12 ms, clipped to ±25 ms), returned in beats"""
    return float(np.clip(rng.normal(0, sd_ms), -clip_ms, clip_ms)) / 1000 * bpm / 60


def hv(rng, v, spread=9):
    return int(v + rng.integers(-spread, spread + 1))



# ---------------------------------------------------------------- island groove (v6: title main section, harbour_day)
# A clear Pacific / Austronesian island groove: ukulele strums the island pattern D-DU-UDU, a Hawaiian (lap-steel
# style) or slack-key guitar sings the melody with slides between notes, warm upright bass on roots and fifths, a
# woody log-drum figure, shaker, soft kick / side-stick, and a soft marimba answering in the melody's gaps.
# One simple chord loop per 4 bars: I – V – vi – IV. Melodies are major pentatonic (plus the V chord's own ti),
# short phrases, the hook's contour (rise mi-sol-la-do', peak on re', come home). check_harmony() verifies every
# melodic note against the chord under it.
ISLAND_CHORDS = [0, 4, 5, 3]  # I V vi IV (scale degrees of the chord roots)
INTRO_CHORDS = [0, 5, 3, 4]  # the title intro: I vi IV V -> lands on I where the groove starts
# (step, length, degree) in eighth notes; degree 0 = do, 7 = do'. One list per bar.
ISLAND_A = [  # the hook, sung: "mi sol la, sol la do' | re' — ti sol — | mi sol la, mi do | la sol do —"
    [(0, 1, 2), (1, 1, 4), (2, 2, 5), (4, 1, 4), (5, 1, 5), (6, 2, 7)],
    [(0, 3, 8), (3, 1, 6), (4, 4, 4)],
    [(0, 1, 2), (1, 1, 4), (2, 2, 5), (4, 2, 2), (6, 2, 0)],
    [(0, 2, 5), (2, 2, 4), (4, 4, 0)],
]
ISLAND_A2 = ISLAND_A[:2] + [  # the repeat climbs: "la do' mi', do' la | do' la sol la —"
    [(0, 1, 5), (1, 1, 7), (2, 2, 9), (4, 2, 7), (6, 2, 5)],
    [(0, 2, 7), (2, 1, 5), (3, 1, 4), (4, 4, 5)],
]
ISLAND_B = [  # breather: long sliding notes, the marimba answers each bar
    [(0, 3, 4), (3, 1, 5), (4, 4, 2)],
    [(0, 3, 1), (3, 1, 2), (4, 4, 4)],
    [(0, 3, 2), (3, 1, 4), (4, 4, 5)],
    [(0, 4, 5), (4, 2, 7), (6, 2, 5)],
]
ISLAND_B2 = [  # harbour's own breather: a little call that skips up and settles
    [(0, 2, 7), (2, 2, 4), (4, 4, 2)],
    [(0, 2, 4), (2, 2, 6), (4, 4, 8)],
    [(0, 2, 9), (2, 2, 7), (4, 4, 5)],
    [(0, 2, 7), (2, 2, 5), (4, 2, 3), (6, 2, 5)],
]
ISLAND_PHRASES = {'A': ISLAND_A, 'A2': ISLAND_A2, 'B': ISLAND_B, 'B2': ISLAND_B2}
UKULELE, HAWAIIAN = (24, 8), (26, 8)  # GS variation banks in GeneralUser GS: Ukulele, Hawaiian Guitar
CH_ISLAND = dict(lead=0, marimba=1, uke=2, logd=3, bass=4, uke_layer=11)  # 11: nylon layer under the ukulele
BEND_RANGE = 5  # semitones (RPN 0) on the slide guitar


def island_check_note(S, role, beat, length, pitch):
    S.check.append((role, beat, length, pitch))


def island_body(S, spec, rng, off):
    root, bb, bpm = S.root, 4, S.bpm
    form = spec.get('form', ['A', 'A2', 'B', 'A'])
    S.body_bars = 4 * len(form)
    lead_ch, slides = CH_ISLAND['lead'], spec.get('slides', 1.0)
    S.program(CH_ISLAND['uke_layer'], NYLON)
    bends = spec.get('bends', False)  # v7 (Larry t164u): no slides, glides, bends or vibrato on the melody
    dbl = spec.get('double')  # (channel, program, velocity): a soft unison double of the melody
    if dbl and dbl[0] != CH_ISLAND['marimba']:
        S.program(dbl[0], dbl[1])
    lead_oct = spec.get('lead_oct', 1)
    # pitch-bend range for the slide guitar
    for c, v in ((101, 0), (100, 0), (6, BEND_RANGE), (38, 0)) if bends else ():
        S.cc.append((lead_ch, off - 0.02 if off else 0, c, v))
    prev = None  # (pitch, end beat) of the last melody note
    seq = []
    for pi, key in enumerate(form):
        for b, bar in enumerate(ISLAND_PHRASES[key]):
            for st, ln, d in bar:
                seq.append((off + (pi * 4 + b) * bb + st / 2, ln / 2, deg(root + 12 * lead_oct, d), b, st, ln))
    for i, (t, ln, p, b, st, L) in enumerate(seq):
        nxt = seq[(i + 1) % len(seq)][0] if i + 1 < len(seq) else off + S.body_bars * bb + seq[0][0] - off
        tt = t + human(rng, bpm, 7, 15)
        dur = max(0.12, min(ln, nxt - t) - 0.04)  # one string, one note at a time
        accent = 8 if st == 0 else (4 if st == 4 else 0)
        S.n(lead_ch, tt, dur, p, hv(rng, spec.get('lead_vel', 92) + accent, 7))
        island_check_note(S, 'melody', t, ln, p)
        if dbl:
            S.n(dbl[0], tt + human(rng, bpm, 6, 12), dur, p, hv(rng, dbl[2] + accent // 2, 5))
            island_check_note(S, 'melody double', t, ln, p)
        if not bends:
            prev = (p, t + ln)
            continue
        # slide into the note from the previous one when they are close and joined (lap-steel style)
        if prev is not None and abs(t - prev[1]) < 0.3 and 0 < abs(prev[0] - p) <= BEND_RANGE and rng.random() < slides:
            start = (prev[0] - p) / BEND_RANGE
            ramp = min(0.22, 0.09 * bpm / 60 * abs(prev[0] - p) ** 0.5)  # ~80–150 ms glide
            for k in range(7):
                f = k / 6
                S.pb.append((lead_ch, tt + f * ramp, start * (1 - f) ** 1.6))
        else:
            S.pb.append((lead_ch, tt - 0.005, 0.0))
        # a gentle vibrato on long notes (like the bar shaking on a steel guitar)
        if ln >= 1.5:
            n_v = int((dur - 0.35) / 0.05)
            for k in range(max(0, n_v)):
                tv = tt + 0.35 + k * 0.05
                depth = 0.12 / BEND_RANGE * min(1, k / 8)
                S.pb.append((lead_ch, tv, depth * np.sin(2 * np.pi * 5.2 * (tv - tt) * 60 / bpm)))
            S.pb.append((lead_ch, tt + dur + 0.01, 0.0))
        prev = (p, t + ln)
    # marimba answers in the gaps: wherever the melody holds a long note from beat 3, three soft chord tones
    for pi, key in enumerate(form):
        for b, bar in enumerate(ISLAND_PHRASES[key]):
            c = ISLAND_CHORDS[b]
            last = bar[-1]
            if last[0] == 4 and last[1] == 4 or key.startswith('B'):
                t0 = off + (pi * 4 + b) * bb
                tones = [p for p in chord_pitches(root, c, root + 12, root + 24)][:4]
                pattern = [(5, tones[0]), (6, tones[1]), (7, tones[2])] if not key.startswith('B') else \
                          [(4, tones[2]), (5, tones[1]), (6, tones[0]), (7, tones[1])]
                for st, p in pattern:
                    S.n(CH_ISLAND['marimba'], t0 + st / 2 + human(rng, bpm, 9, 18), 0.45, p, hv(rng, spec.get('marimba_vel', 58), 6))
                    island_check_note(S, 'marimba', t0 + st / 2, 0.5, p)
    for bar in range(S.body_bars):
        t0 = off + bar * bb
        c = ISLAND_CHORDS[bar % 4]
        r = deg(root, c) % 12
        # ukulele: the island strum D . D U . U D U, re-entrant voicing (high g string first)
        cp = chord_pitches(root, c, root - 2, root + 12)
        notes = cp[:4] if len(cp) >= 4 else cp
        down = [notes[2], notes[0], notes[1], notes[3]] if len(notes) == 4 else notes
        for i, ch in enumerate('D.DU.UDU'):
            if ch == '.':
                continue
            strings = down if ch == 'D' else down[::-1][:3]
            per = (rng.uniform(11, 17) if ch == 'D' else rng.uniform(7, 11)) / 1000 * bpm / 60
            ts = t0 + i / 2 + human(rng, bpm, 9, 20)
            v = {0: 80, 2: 68, 6: 70}.get(i, 54) if ch == 'D' else 52
            for j, p in enumerate(strings):
                S.n(CH_ISLAND['uke'], ts + j * per, 0.42 if i in (3, 5) else 0.8, p, hv(rng, v - 2 * j, 6))
                S.n(CH_ISLAND['uke_layer'], ts + j * per + 0.002, 0.42 if i in (3, 5) else 0.8, p, hv(rng, (v - 2 * j) * UKE_LAYER, 4))
                island_check_note(S, 'ukulele', t0 + i / 2, 0.5, p)
        # upright bass: root on 1, root on the and of 2, fifth on 3, fifth (octave up) on the and of 4
        br = deg(root - 24, c)
        if br - (root - 24) > 7:
            br -= 12
        for s0, iv, ln, v in ((0, 0, 1.4, 84), (1.5, 0, 0.45, 64), (2, 7, 1.4, 78), (3.5, 7, 0.45, 60)):
            S.n(CH_ISLAND['bass'], t0 + s0 + human(rng, bpm, 8, 18), ln, br + iv, hv(rng, v, 6))
            island_check_note(S, 'bass', t0 + s0, ln, br + iv)
        # log drum: a woody figure on root / fifth (1, a-of-2, 3, and-of-4)
        lr = deg(root - 12, c)
        for s0, iv, v in ((0, 0, 70), (1.75, 7, 52), (2, 0, 62), (3.5, 7, 56)):
            S.n(CH_ISLAND['logd'], t0 + s0 + human(rng, bpm, 8, 16), 0.22, lr + iv, hv(rng, v, 6))
            island_check_note(S, 'log drum', t0 + s0, 0.25, lr + iv)
        # light island beat: soft kick on 1 / 3, side-stick on 2 / 4, shaker 16ths, a conga answer
        for lane in ('k.......k.......', '....r.......r...', 'S.s.S.s.S.s.S.s.', '..........c..C..'):
            for i, ch in enumerate(lane):
                if ch in DRUM_ISLAND:
                    note, v = DRUM_ISLAND[ch]
                    S.n(CH['drums'], t0 + i / 4 + human(rng, bpm, 8, 18), 0.2, note, hv(rng, v, 7))
    S.chords += [(off + bar * bb, ISLAND_CHORDS[bar % 4]) for bar in range(S.body_bars)]


DRUM_ISLAND = {'k': (36, 56), 'r': (37, 46), 's': (70, 30), 'S': (70, 44), 'c': (63, 46), 'C': (62, 44)}


def check_harmony(S, key_root):
    """every melodic note against the chord under it. Allowed: a chord tone; or a short (≤ 1 beat) major-pentatonic
    passing / neighbour note off the strong beats (1 and 3) that is not a semitone from any chord tone."""
    penta = {(key_root + MAJOR[i]) % 12 for i in (0, 1, 2, 4, 5)}
    bars = sorted(S.chords)
    rep = dict(notes=0, chord_tones=0, passing=0, violations=[])
    for role, beat, ln, p in S.check:
        cands = [c for b0, c in bars if b0 <= beat + 1e-6]
        c = cands[-1] if cands else bars[0][1]
        b0 = max(b0 for b0, cc in bars if b0 <= beat + 1e-6) if cands else bars[0][0]
        pcs = {deg(key_root, d) % 12 for d in c} if isinstance(c, tuple) else {deg(key_root, c + i) % 12 for i in (0, 2, 4)}
        pc = p % 12
        rep['notes'] += 1
        if pc in pcs:
            rep['chord_tones'] += 1
            continue
        pos = round((beat - b0) * 2) / 2
        semis = min(min((pc - x) % 12, (x - pc) % 12) for x in pcs)
        bad = []
        if pos in (0.0, 2.0):
            bad.append('strong beat')
        if ln > 1.0:
            bad.append('long')
        if pc not in penta:
            bad.append('not pentatonic')
        if semis <= 1:
            bad.append('semitone clash')
        if bad:
            rep['violations'].append(dict(role=role, beat=round(beat, 2), pitch=p, chord=c, why=bad))
        else:
            rep['passing'] += 1
    return rep



# ---------------------------------------------------------------- modern cozy groove (v8: title main section, harbour_day)
# Larry 10:26 PM: no slides, no old hula / lounge feel. A contemporary cozy island-adventure sound: syncopated
# ukulele (with muted chucks) + steel-string acoustic arpeggios, soft string pad in add9 / sus voicings, a moving
# fingered bass, a tight light kit (kick, clap / rim, hats, shaker, tambourine), and a clean catchy lead
# (piano / pizzicato) softly doubled an octave up by glockenspiel. No pitch bends, glides or vibrato anywhere.
# Chords (scale degrees, 0 = do): IVadd9 – V – vi7 – Iadd9 for the A phrases; vi7 – IVadd9 – Iadd9 – V for the lift.
MOD_A = [(3, 5, 7, 4), (4, 6, 8), (5, 7, 9, 11), (0, 2, 4, 1)]
MOD_B = [(5, 7, 9, 11), (3, 5, 7, 4), (0, 2, 4, 1), (4, 6, 8)]
# melody (step, length, degree) per bar, eighth-note steps; the hook's contour: rise to the peak, then home
MOD_MEL = {
    'A': [[(0, 1, 5), (1, 1, 7), (2, 2, 8), (4, 1, 7), (5, 1, 8), (6, 2, 11)],
          [(0, 3, 8), (3, 1, 6), (4, 4, 4)],
          [(0, 1, 2), (1, 1, 4), (2, 2, 5), (4, 2, 4), (6, 2, 2)],
          [(0, 2, 1), (2, 2, 2), (4, 4, 0)]],
    'A2': None,  # filled below: A's first half, then the answer climbs
    'B': [[(0, 3, 9), (3, 1, 7), (4, 4, 5)],
          [(0, 3, 7), (3, 1, 5), (4, 4, 4)],
          [(0, 3, 4), (3, 1, 2), (4, 4, 1)],
          [(0, 2, 1), (2, 2, 4), (4, 4, 6)]],
}
# menu (8 bars): Iadd9 – IVadd9 – vi7 – V twice; ending on V so the next bar can be the title intro's I (or bar 1 again)
MOD_M = [(0, 2, 4, 1), (3, 5, 7, 4), (5, 7, 9, 11), (4, 6, 8)]
MOD_MEL['M1'] = [[(0, 1, 2), (1, 1, 4), (2, 2, 5), (4, 4, 4)],
                 [(0, 2, 5), (2, 2, 7), (4, 4, 4)],
                 [(0, 1, 2), (1, 1, 4), (2, 2, 5), (4, 4, 7)],
                 [(0, 3, 8), (3, 1, 6), (4, 4, 4)]]
MOD_MEL['M2'] = [[(0, 2, 7), (2, 2, 8), (4, 4, 9)],
                 [(0, 2, 7), (2, 2, 5), (4, 4, 4)],
                 [(0, 2, 4), (2, 2, 2), (4, 4, 0)],
                 [(0, 2, 4), (2, 2, 6), (4, 4, 1)]]  # ... ti -> re: leads up to the intro's first "mi"
MOD_MEL['A2'] = MOD_MEL['A'][:2] + [[(0, 1, 5), (1, 1, 7), (2, 2, 9), (4, 2, 7), (6, 2, 4)],
                                    [(0, 2, 8), (2, 2, 7), (4, 4, 4)]]
CH_MOD = dict(lead=0, double=1, uke=2, gtr=3, bass=4, pad=5, uke_layer=11)
DRUM_MOD = {'k': (36, 62), 'K': (36, 74), 'p': (39, 52), 'r': (37, 44), 'h': (42, 34), 'H': (42, 46), 'o': (46, 34),
            's': (70, 28), 'S': (70, 40), 't': (54, 30)}
MOD_DRUMS = ['K.....k.K.....k.', '....p.......p...', '..h.h.H.h.h.H.h.', 's.s.S.s.s.s.S.s.', '............t...']
UKE_MOD = 'D..UxUDUD..UxUDU'  # syncopated 16ths, muted chucks (x) on the backbeat


def tones(root, chord, lo, hi):
    pcs = {deg(root, d) % 12 for d in chord}
    return [p for p in range(lo, hi + 1) if p % 12 in pcs]


def modern_body(S, spec, rng, off):
    root, bb, bpm = S.root, 4, S.bpm
    form = spec.get('form', ['A', 'A2', 'B', 'A'])
    S.body_bars = 4 * len(form)
    for k in ('double', 'gtr', 'uke_layer'):
        pass
    S.program(CH_MOD['uke_layer'], NYLON)
    lead_v, dbl = spec.get('lead_vel', 90), spec.get('double')
    seq = []
    for pi, key in enumerate(form):
        for b, bar in enumerate(MOD_MEL[key]):
            for st, ln, d in bar:
                seq.append((off + (pi * 4 + b) * bb + st / 2, ln / 2, deg(root + 12 * spec.get('lead_oct', 0), d), st))
    for i, (t, ln, p, st) in enumerate(seq):
        tt = t + human(rng, bpm, 8, 16)
        accent = 8 if st == 0 else (4 if st == 4 else 0)
        S.n(CH_MOD['lead'], tt, ln * spec.get('legato', 0.88), p, hv(rng, lead_v + accent, 7))
        island_check_note(S, 'melody', t, ln, p)
        if dbl:  # glockenspiel an octave up, soft (same pitch class, so the harmony check covers it)
            S.n(CH_MOD['double'], tt + human(rng, bpm, 5, 10), min(ln, 0.5), p + 12, hv(rng, dbl + accent // 2, 5))
            island_check_note(S, 'glockenspiel double', t, ln, p + 12)
    for bar in range(S.body_bars):
        key = form[bar // 4]
        chord = (MOD_M if key.startswith('M') else MOD_B if key.startswith('B') else MOD_A)[bar % 4]
        light = spec.get('light', False)
        t0 = off + bar * bb
        S.chords.append((t0, tuple(chord)))
        # ukulele: syncopated 16th strum with muted chucks, re-entrant voicing (high g first on downs)
        ut = tones(root, chord, root - 2, root + 11)[:4]
        down = [ut[2], ut[0], ut[1], ut[3]] if len(ut) == 4 else ut
        for i, ch in enumerate(UKE_MOD):
            if ch == '.':
                continue
            strings = down if ch in 'Dx' else down[::-1][:3]
            per = (rng.uniform(9, 14) if ch != 'U' else rng.uniform(6, 10)) / 1000 * bpm / 60
            ts = t0 + i / 4 + human(rng, bpm, 7, 16)
            v = (70 if i in (0, 8) else 60) if ch == 'D' else (46 if ch == 'U' else 38)
            if light:
                if ch == 'x' and bar % 8 < 4:
                    continue  # menu: gentle first half; the chucks join in the second half (builds anticipation)
                v = int(v * (0.78 if bar % 8 < 4 else 0.86))
            dur = 0.06 if ch == 'x' else (0.3 if ch == 'U' else 0.45)
            for j, p in enumerate(strings):
                S.n(CH_MOD['uke'], ts + j * per, dur, p, hv(rng, v - 2 * j, 5))
                S.n(CH_MOD['uke_layer'], ts + j * per + 0.002, dur, p, hv(rng, (v - 2 * j) * UKE_LAYER, 3))
                island_check_note(S, 'ukulele', t0 + i / 4, 0.25, p)
        # steel-string acoustic: open add9 arpeggio in 8ths (root low, then 5th / 9th / 3rd up), let ring
        gt = tones(root, chord, root - 14, root + 9)
        bass_p = [p for p in gt if p % 12 == deg(root, chord[0]) % 12][0]
        upper = [p for p in gt if p > bass_p + 5][:4]
        order = [bass_p] + [upper[k % len(upper)] for k in (1, 0, 2, 1, 3, 2, 0)]
        for i, p in enumerate(order):
            S.n(CH_MOD['gtr'], t0 + i / 2 + human(rng, bpm, 9, 18), 1.2 if i == 0 else 0.9, p, hv(rng, 58 if i == 0 else 46, 6))
            island_check_note(S, 'acoustic guitar', t0 + i / 2, 0.5, p)
        # soft string pad: the chord's top 4 tones, sustained
        for p in tones(root, chord, root + 2, root + 16)[:4]:
            S.n(CH_MOD['pad'], t0 + human(rng, bpm, 14, 25), bb * 0.98, p, hv(rng, spec.get('pad_vel', 30), 4))
            island_check_note(S, 'string pad', t0, bb, p)
        # fingered bass with movement: root, fifth, root, a passing chord tone up, octave pickup
        br = deg(root - 24, chord[0])
        if br - (root - 24) > 6:
            br -= 12
        bt = tones(root, chord, br, br + 13)
        third = bt[1] if len(bt) > 1 else br + 7
        # menu (Larry 11:28 PM): keep it moving at 112, a pulsing 8th-note bass instead of long notes
        pts = tuple((k / 2, (br, br, br + 7, br, br + 12, br, br + 7, br + 12)[k], 0.4, (64, 46, 54, 48, 58, 46, 52, 50)[k])
                    for k in range(8)) if light else \
              ((0, br, 0.7, 78), (0.75, br, 0.2, 52), (1.5, br + 7, 0.45, 64), (2, br, 0.7, 72),
               (2.75, third, 0.2, 54), (3.25, br + 7, 0.25, 58), (3.5, br + 12, 0.45, 62))
        for s0, p, ln, v in pts:
            S.n(CH_MOD['bass'], t0 + s0 + human(rng, bpm, 7, 15), ln, p, hv(rng, v, 6))
            island_check_note(S, 'bass', t0 + s0, ln, p)
        # tight light kit
        if light:  # forward, not half-time: kick on 1 / 3 (+ a push), backbeat, hats moving up from 8ths to 16ths
            mb = bar % 8
            lanes = ['K.....k.K.......' if mb < 4 else 'K.....k.K.....k.', '....r.......r...' if mb < 4 else '....p.......p...',
                     'h.h.h.h.h.h.h.h.' if mb < 4 else 'h.hhh.hhh.hhh.hH', 's.s.S.s.s.s.S.s.']
            if mb == 7:  # the last bar leans into what comes next (menu bar 1 or the title intro's first hit)
                lanes[1] = '....p.......pp.p'
                lanes.append('............t.t.')
        else:
            lanes = None
        lanes = lanes if light else MOD_DRUMS if not key.startswith('B') else ['K.......K.......', '....p.......p.p.', 'h.h.h.h.h.h.h.h.', MOD_DRUMS[3]]
        for lane in lanes:
            for i, ch in enumerate(lane):
                if ch in DRUM_MOD:
                    note, v = DRUM_MOD[ch]
                    S.n(CH['drums'], t0 + i / 4 + human(rng, bpm, 6, 14), 0.15, note, hv(rng, v, 6))


# ---------------------------------------------------------------- menu v3 (Larry 11:42 PM): no melody at all
# Lo-fi atmosphere at the light 112 BPM groove: rootless Rhodes maj7 / add9 voicings comped in a gentle syncopated
# rhythm, a soft piano dyad doubling the voicing's top two notes (a sustained colour, not a tune), soft string pad,
# warm pulsing bass, the light kit. Voicings are fixed per chord and voice-led so the top note barely moves
# (F#4 F#4 F#4 E4): nothing reads as a line. Bars 7–8: pad swell (velocity + CC11) and a soft noise riser (in post).
# Chords (degrees in D): Imaj9 – IVmaj9 – vi9 – Vadd9, twice; the last bar is V, so any bar line can segue to the
# title intro's I.
COMP_CHORDS = [(0, 2, 4, 6, 1), (3, 5, 7, 9, 4), (5, 7, 9, 11, 6), (4, 6, 8, 5)]
COMP_VOICE = [(57, 61, 64, 66), (57, 59, 62, 66), (54, 57, 61, 62), (57, 59, 61, 64)]  # A3 C#4 E4 F#4 / ... (root D4 = 62)
COMP_RH = [[(0, 1.3, 60), (1.75, 0.6, 50), (2.5, 0.9, 56), (3.5, 0.4, 46)],
           [(0, 1.3, 60), (1.5, 0.4, 48), (2.5, 1.2, 56), (3.75, 0.25, 44)]]
COMP_RH_LAST = [(0, 0.9, 60), (1.5, 0.4, 50), (2.5, 0.4, 54), (3.0, 0.4, 56), (3.5, 0.45, 60)]


def menu_comp_body(S, spec, rng, off):
    root, bb, bpm = S.root, 4, S.bpm
    S.body_bars = 8
    pv = spec.get('pad_vel', 34)
    S.cc.append((CH_MOD['pad'], off, 11, 92))
    for bar in range(S.body_bars):
        ci = bar % 4
        chord, voice = COMP_CHORDS[ci], COMP_VOICE[ci]
        t0 = off + bar * bb
        S.chords.append((t0, chord))
        assert all(p % 12 in {deg(root, d) % 12 for d in chord} for p in voice)
        # Rhodes comp: rolled a little (8–15 ms) like a player's hand, soft dynamics
        rh = COMP_RH_LAST if bar == 7 else COMP_RH[bar % 2]
        for s0, ln, v in rh:
            per = rng.uniform(8, 15) / 1000 * bpm / 60
            ts = t0 + s0 + human(rng, bpm, 6, 14)
            for j, p in enumerate(voice):
                S.n(CH_MOD['lead'], ts + j * per, ln * 0.95, p, hv(rng, v - 3 + j, 4))
                island_check_note(S, 'rhodes comp', t0 + s0, ln, p)
        # soft piano: the voicing's top two notes an octave up, on the "and" of 4 (from bar 5 also the "and" of 2)
        dy = [p + 12 for p in voice[-2:]]
        for s0 in ((1.5, 3.5) if bar >= 4 else (3.5,)):
            for j, p in enumerate(dy):
                S.n(CH_MOD['double'], t0 + s0 + human(rng, bpm, 6, 12) + j * 0.01, 0.45, p, hv(rng, 34 + 2 * j, 4))
                island_check_note(S, 'piano dyad', t0 + s0, 0.45, p)
        # soft string pad, swelling in bars 7–8
        pvb = pv + (8 if bar == 6 else 16 if bar == 7 else 0)
        for p in tones(root, chord, root + 2, root + 16)[:4]:
            S.n(CH_MOD['pad'], t0 + human(rng, bpm, 14, 25), bb * 0.98, p, hv(rng, pvb, 3))
            island_check_note(S, 'string pad', t0, bb, p)
        # warm pulsing 8th-note bass (root / fifth / octave)
        br = deg(root - 24, chord[0])
        if br - (root - 24) > 6:
            br -= 12
        for k in range(8):
            p = (br, br, br + 7, br, br + 12, br, br + 7, br + 12)[k]
            v = (64, 44, 52, 46, 56, 44, 50, 48)[k]
            S.n(CH_MOD['bass'], t0 + k / 2 + human(rng, bpm, 7, 15), 0.4, p, hv(rng, v, 5))
            island_check_note(S, 'bass', t0 + k / 2, 0.4, p)
        # light kit: kick on 1 / 3 (+ a push), backbeat rim -> clap, hats 8ths -> 16ths, shaker; a small fill in bar 8
        mb = bar % 8
        lanes = ['K.....k.K.......' if mb < 4 else 'K.....k.K.....k.', '....r.......r...' if mb < 4 else '....p.......p...',
                 'h.h.h.h.h.h.h.h.' if mb < 4 else 'h.hhh.hhh.hhh.hH', 's.s.S.s.s.s.S.s.']
        if mb == 7:
            lanes[1] = '....p.......pp.p'
            lanes.append('............t.t.')
        for lane in lanes:
            for i, ch in enumerate(lane):
                if ch in DRUM_MOD:
                    note, v = DRUM_MOD[ch]
                    S.n(CH['drums'], t0 + i / 4 + human(rng, bpm, 6, 14), 0.15, note, hv(rng, v - 4, 6))
    # pad swell (expression) across bars 7–8, back to the resting level at bar 1
    for k in range(32):
        S.cc.append((CH_MOD['pad'], off + 6 * bb + k * 0.25, 11, 92 + int(35 * (k / 31) ** 1.5)))


# ---------------------------------------------------------------- title main section v8 (Larry 11:58 PM)
# After the epic intro: an open, fresh "new world" bed in the v3-menu manner, no melody. 16 bars at 112 BPM:
# soft piano chords in a bright upper voicing whose top note stays on A5 (common to every chord), Rhodes underneath
# in the menu's mid voicings, airy high strings + a soft choir in the lift, warm pulsing bass, the light kit, a sparse
# glockenspiel sparkle (two chord tones a bar, not a tune), room tone / vinyl ticks. Bar 1 resolves the intro's V
# (its ukulele + piano pickup) with a soft ukulele strum. Bars 9–16 lift (hats to 16ths, piano 8th pulses, choir,
# more sparkle); bar 16 has a small fill, a pad swell and a soft riser back to bar 1.
# I – IV – vi – V | I – IV – vi – V | IV – V – vi – I | IV – I – IV – V   (maj9 / add9 colours)
BED_CH = {0: 'I', 3: 'IV', 5: 'vi', 4: 'V'}
BED_CHORDS = {'I': (0, 2, 4, 6, 1), 'IV': (3, 5, 7, 9, 4), 'vi': (5, 7, 9, 11, 6), 'V': (4, 6, 8, 5)}
BED_PROG = ['I', 'IV', 'vi', 'V', 'I', 'IV', 'vi', 'V', 'IV', 'V', 'vi', 'I', 'IV', 'I', 'IV', 'V']
BED_RHODES = {'I': (57, 61, 64, 66), 'IV': (57, 59, 62, 66), 'vi': (54, 57, 61, 62), 'V': (57, 59, 61, 64)}
BED_PIANO = {'I': (73, 76, 78, 81), 'IV': (71, 74, 78, 81), 'vi': (71, 73, 78, 81), 'V': (71, 73, 76, 81)}  # top A5
BED_SPARK = {'I': (88, 81), 'IV': (86, 81), 'vi': (85, 81), 'V': (83, 81)}  # E6/D6/C#6/B5 + A5, glockenspiel
BED_PIANO_RH = [[(0.0, 0.9, 50), (1.5, 0.45, 42), (2.5, 0.9, 46), (3.5, 0.4, 40)],
                [(0.0, 0.9, 50), (1.75, 0.5, 42), (2.5, 0.45, 44), (3.0, 0.9, 46)]]


def title_bed_body(S, spec, rng, off):
    root, bb, bpm = S.root, 4, S.bpm
    S.body_bars = 16
    S.program(CH_MOD['uke_layer'], NYLON)
    rh_ch, pf_ch, gl_ch = CH['solo'], CH['lead'], CH['lead2']
    S.cc += [(CH['pad'], off, 11, 108), (CH['choir'], off, 11, 96)]
    for bar in range(S.body_bars):
        name = BED_PROG[bar]
        chord = BED_CHORDS[name]
        t0 = off + bar * bb
        lift = bar >= 8
        S.chords.append((t0, chord))
        pcs = {deg(root, d) % 12 for d in chord}
        for v in (BED_RHODES[name], BED_PIANO[name], BED_SPARK[name]):
            assert all(p % 12 in pcs for p in v), (name, v)
        # Rhodes: long, soft chords (beat 1 and the "and" of 3) — the warm floor
        for s0, ln, v in ((0, 2.3, 50), (2.5, 1.4, 44)):
            per = rng.uniform(8, 14) / 1000 * bpm / 60
            ts = t0 + s0 + human(rng, bpm, 6, 14)
            for j, p in enumerate(BED_RHODES[name]):
                S.n(rh_ch, ts + j * per, ln, p, hv(rng, v - 2 + j, 4))
                island_check_note(S, 'rhodes', t0 + s0, ln, p)
        # piano: bright upper voicing, top note fixed on A5; syncopated stabs, 8th-note pulses in the lift
        hits = BED_PIANO_RH[bar % 2]
        if lift:
            hits = hits + [(s, 0.3, 34) for s in (0.5, 2.0) if all(abs(s - h[0]) > 0.3 for h in hits)]
        if bar == 15:
            hits = [(0.0, 0.9, 50), (1.5, 0.4, 42), (2.5, 0.4, 44), (3.0, 0.4, 46), (3.5, 0.45, 48)]
        for s0, ln, v in hits:
            per = rng.uniform(6, 11) / 1000 * bpm / 60
            ts = t0 + s0 + human(rng, bpm, 6, 12)
            for j, p in enumerate(BED_PIANO[name]):
                S.n(pf_ch, ts + j * per, ln, p, hv(rng, v - 4 + 2 * j, 4))
                island_check_note(S, 'piano comp', t0 + s0, ln, p)
        # glockenspiel sparkle: two soft chord tones a bar (three in the lift), off the beat
        for s0, p in (((1.25, BED_SPARK[name][0]), (3.75, BED_SPARK[name][1])) +
                      (((2.75, BED_SPARK[name][1]),) if lift else ())):
            S.n(gl_ch, t0 + s0 + human(rng, bpm, 5, 10), 0.4, p, hv(rng, 30 if not lift else 34, 3))
            island_check_note(S, 'glockenspiel sparkle', t0 + s0, 0.4, p)
        # airy high strings (open voicing above the piano), choir "aah" softly in the lift
        vel = spec.get('pad_vel', 30) + (6 if lift else 0) + (8 if bar == 15 else 0)
        for p in tones(root, chord, root + 9, root + 24)[:4]:
            S.n(CH['pad'], t0 + human(rng, bpm, 14, 25), bb * 0.98, p, hv(rng, vel, 3))
            island_check_note(S, 'string pad', t0, bb, p)
        if lift:
            for p in tones(root, chord, root - 2, root + 10)[:3]:
                S.n(CH['choir'], t0 + human(rng, bpm, 14, 25), bb * 0.98, p, hv(rng, 26, 3))
                island_check_note(S, 'choir pad', t0, bb, p)
        # ukulele: one soft open strum on beat 1 of bars 1, 5, 9, 13 (bar 1 resolves the intro's ukulele on V)
        if bar % 4 == 0:
            ut = tones(root, chord, root - 2, root + 11)[:4]
            down = [ut[2], ut[0], ut[1], ut[3]] if len(ut) == 4 else ut
            ts = t0 + human(rng, bpm, 6, 12)
            for j, p in enumerate(down):
                v = 52 if bar == 0 else 40
                S.n(CH_MOD['uke'], ts + j * 0.022, 1.6, p, hv(rng, v - 2 * j, 3))
                S.n(CH_MOD['uke_layer'], ts + j * 0.022 + 0.002, 1.6, p, hv(rng, (v - 2 * j) * UKE_LAYER, 3))
                island_check_note(S, 'ukulele', t0, 1.0, p)
        # warm pulsing 8th-note bass
        br = deg(root - 24, chord[0])
        if br - (root - 24) > 6:
            br -= 12
        for k in range(8):
            p = (br, br, br + 7, br, br + 12, br, br + 7, br + 12)[k]
            v = (66, 46, 54, 48, 58, 46, 52, 50)[k]
            S.n(CH['bass'], t0 + k / 2 + human(rng, bpm, 7, 15), 0.4, p, hv(rng, v, 5))
            island_check_note(S, 'bass', t0 + k / 2, 0.4, p)
        # light kit: forward, not half-time
        lanes = ['K.....k.K.......' if not lift else 'K.....k.K.....k.', '....r.......r...' if not lift else '....p.......p...',
                 'h.h.h.h.h.h.h.h.' if not lift else 'h.hhh.hhh.hhh.hH', 's.s.S.s.s.s.S.s.']
        if bar == 0:
            lanes[0] = 'K.......K.......'  # bar 1: settle in under the intro's tail
        if bar in (7, 15):
            lanes[1] = '....p.......pp.p'
            lanes.append('............t.t.')
        for lane in lanes:
            for i, ch in enumerate(lane):
                if ch in DRUM_MOD:
                    note, v = DRUM_MOD[ch]
                    S.n(CH['drums'], t0 + i / 4 + human(rng, bpm, 6, 14), 0.15, note, hv(rng, v - 4, 6))
    # pad swell into bar 1 again (bar 16)
    for k in range(16):
        S.cc.append((CH['pad'], off + 15 * bb + k * 0.25, 11, 108 + int(19 * (k / 15) ** 1.5)))


def arrange(spec):
    rng = np.random.default_rng(spec['seed'])
    S = Song(spec['bpm'], spec['steps'], spec['root'])
    steps, root = S.steps, S.root
    bb = S.bar_beats()
    intro_bars = spec.get('intro', 0)
    for k, p in spec['programs'].items():
        S.program(CH[k], p)
    # ---- intro (title only): strings + choir swell, big hand drums / taiko, a hint of the hook
    if intro_bars:
        for b in range(intro_bars):
            c = [0, 5, 3, 4][b % 4]
            for p in chord_pitches(root, c, 50, 74):
                S.n(CH['pad'], b * bb + human(rng, S.bpm, 15, 25), bb + 0.1, p, hv(rng, 40 + 12 * b, 5))
            for p in chord_pitches(root, c, 57, 69)[:3]:
                S.n(CH['choir'], b * bb + human(rng, S.bpm, 15, 25), bb, p, hv(rng, 30 + 14 * b, 5))
        steps_cc = int(intro_bars * bb * 4)
        for i in range(steps_cc + 1):
            S.cc.append((CH['pad'], i / 4, 11, 40 + 87 * i / steps_cc))
            S.cc.append((CH['choir'], i / 4, 11, 30 + 90 * i / steps_cc))
        for b in range(intro_bars):  # taiko: one big hit a bar, then a rolling crescendo into the groove
            S.n(CH['taiko'], b * bb + human(rng, S.bpm, 8, 18), 1.5, 38, hv(rng, 90 + 8 * b, 5))
            if b >= 1:
                S.n(CH['taiko'], b * bb + 2.5 + human(rng, S.bpm, 10, 20), 0.8, 43, hv(rng, 70 + 8 * b, 6))
        for i in range(8):
            S.n(CH['taiko'], (intro_bars - 1) * bb + 2 + i * 0.25 + human(rng, S.bpm, 8, 16), 0.3, 43 if i % 2 else 40, hv(rng, 60 + 7 * i, 5))
        if spec.get('island'):
            # the hook's call, slow and broad on the strings' top line, each note a tone of its chord:
            # "mi sol | la | do' la | re' —", then the ukulele and the slide guitar's pickup lead into the groove
            line = [(0, 2, 2), (2, 2, 4), (4, 4, 5), (8, 2, 7), (10, 2, 5), (12, 4, 8)]
            for i, (b0, L, d) in enumerate(line):
                S.n(CH['pad'], b0 + human(rng, S.bpm, 15, 25), L + (0.6 if i == 5 else 0.15), deg(root + 12, d), hv(rng, 50 + 8 * i, 4))
                island_check_note(S, 'intro strings', b0, L, deg(root + 12, d))
            for b in range(intro_bars):
                S.chords.append((b * bb, INTRO_CHORDS[b % 4]))
                for p in chord_pitches(root, INTRO_CHORDS[b % 4], 50, 74):
                    island_check_note(S, 'intro pad', b * bb, bb, p)
            lb = (intro_bars - 1) * bb
            cV = INTRO_CHORDS[(intro_bars - 1) % 4]
            cp = chord_pitches(root, cV, root - 2, root + 12)[:4]
            down = [cp[2], cp[0], cp[1], cp[3]]
            for k, (bt, v) in enumerate(((2.0, 46), (3.0, 56), (3.5, 50))):  # ukulele fades in on the V chord
                for j, p in enumerate(down if k != 2 else down[::-1][:3]):
                    tj = lb + bt + j * 0.025 + human(rng, S.bpm, 8, 16)
                    S.n(CH_ISLAND['uke'], tj, 0.6, p, hv(rng, v, 4))
                    S.n(CH_ISLAND['uke_layer'], tj + 0.002, 0.6, p, hv(rng, v * UKE_LAYER, 3))
                    island_check_note(S, 'intro ukulele', lb + bt, 0.5, p)
            # slide-guitar pickup: re (a tone of V) gliding up into the groove's first "mi"
            S.n(CH_ISLAND['lead'], lb + 3.5, 0.45, deg(root + 12 * spec.get('lead_oct', 1), 1), 70)
            island_check_note(S, 'intro pickup', lb + 3.5, 0.5, deg(root + 12 * spec.get('lead_oct', 1), 1))
        else:
            span = bb * intro_bars / 6
            for i, (st, L, d) in enumerate(HOOK[steps][:6]):  # the hook's call, slow and broad on the strings' top line
                S.n(CH['pad'], i * span + human(rng, S.bpm, 15, 25), span + 0.2, deg(root + 12, d), hv(rng, 50 + 9 * i, 4))
    off = intro_bars * bb
    if spec.get('style') == 'bed':
        title_bed_body(S, spec, rng, off)
        return S, intro_bars
    if spec.get('style') == 'comp':
        menu_comp_body(S, spec, rng, off)
        return S, intro_bars
    if spec.get('style') == 'modern':
        modern_body(S, spec, rng, off)
        return S, intro_bars
    if spec.get('island'):
        island_body(S, spec, rng, off)
        return S, intro_bars
    # ---- body: hook, hook developed, bridge, hook (16 bars) — or the spec's own form
    form = spec.get('form', ['H', 'D', 'B', 'H'])
    phrases = {'H': (HOOK[steps], HOOK_CHORDS), 'D': (HOOK_DEV[steps], HOOK_CHORDS),
               'B': (bridge(rng, steps), B_CHORDS), 'R': ([], HOOK_CHORDS), 'r': ([], B_CHORDS)}
    S.body_bars = 4 * len(form)
    L = spec['lead']
    lead_oct = L.get('oct', 0)
    for pi, key in enumerate(form):
        mel, chords = phrases[key]
        p0 = off + pi * 4 * bb
        for st, ln, d in mel:
            t = p0 + st / 2 + human(rng, S.bpm, 11, 22)
            # phrase-shaped dynamics: a little louder on the phrase peak, softer on the way home
            accent = 6 if d >= 7 else (-4 if st % 2 else 0)
            S.n(CH['lead'], t, ln / 2 * L.get('legato', 0.92), deg(root + 12 * lead_oct, d), hv(rng, L.get('vel', 92) + accent, 10))
            if L.get('double'):  # the second player is not glued to the first
                S.n(CH['lead2'], p0 + st / 2 + human(rng, S.bpm, 14, 25), ln / 2 * 0.95, deg(root + 12 * L.get('double_oct', 0), d),
                    hv(rng, L.get('double_vel', 55), 8))
        for b, c in enumerate(chords):
            t0 = p0 + b * bb
            # strummed guitar (nylon / steel): D down, U up
            for i, ch in enumerate(spec.get('strum', '')):
                if ch not in 'DU' or i >= steps:
                    continue
                notes = chord_pitches(root, c, spec.get('strum_lo', 52), spec.get('strum_hi', 69))[:5]
                if ch == 'U':
                    notes = notes[::-1][:3]
                # a real strum: the hand sweeps across the strings (down 14–22 ms / up 9–14 ms per string),
                # the whole stroke drifts with the player's timing, strings ring a touch unevenly
                per = (rng.uniform(14, 22) if ch == 'D' else rng.uniform(9, 14)) / 1000 * S.bpm / 60
                t_s = t0 + i / 2 + human(rng, S.bpm, 10, 22)
                base = (64 if ch == 'D' else 44) + (6 if i == 0 else 0)
                for j, p in enumerate(notes):
                    S.n(CH['strum'], t_s + j * per, 0.9, p, hv(rng, base - 2 * j * (ch == 'U'), 8))
            # slack-key-style picking: thumb on the root / fifth, fingers on chord tones
            pk = spec.get('pick', '')
            if pk:
                cp = chord_pitches(root, c, 50, 74)
                bassn = [p for p in cp if p < 60][:2] or cp[:1]
                top = [p for p in cp if p >= 60][:3] or cp[-3:]
                for i, ch in enumerate(pk):
                    if i >= steps:
                        break
                    if ch == 'T':
                        S.n(CH['pick'], t0 + i / 2 + human(rng, S.bpm, 9, 20), 1.2, bassn[(i // 2) % len(bassn)], hv(rng, 62, 7))
                    elif ch == 'x':
                        S.n(CH['pick'], t0 + i / 2 + human(rng, S.bpm, 12, 24), 0.9, top[i % len(top)], hv(rng, 50, 9))
            # bass
            br = deg(root - 24, c % 7)
            pts = {'pop': [(0, 0, 1.4), (1.5, 12, 0.4), (2, 7, 0.9), (3.5, 12, 0.4)],
                   'two': [(0, 0, 1.8), (2, 7, 1.8)],
                   'six': [(0, 0, 1.4), (1.5, 7, 1.2)],
                   'calm': [(0, 0, 3.6)]}[spec.get('bass', 'pop')]
            for s0, iv, ln in pts:
                if s0 < bb:
                    S.n(CH['bass'], t0 + s0 + human(rng, S.bpm, 9, 20), ln, br + iv, hv(rng, 78 - (6 if iv == 12 else 0), 8))
            # pad (strings / choir) — soft sustained chord
            if spec.get('pad'):
                for p in chord_pitches(root, c, 55, 74)[:4]:
                    S.n(CH['pad'], t0 + human(rng, S.bpm, 15, 25), bb, p, hv(rng, spec.get('pad_vel', 38), 5))
            # percussion lanes (16th notes)
            for lane in spec.get('drums', []):
                for i, ch in enumerate(lane):
                    if ch in DRUM and i < steps * 2:
                        note, v = DRUM[ch]
                        S.n(CH['drums'], t0 + i / 4 + human(rng, S.bpm, 10, 22), 0.2, note, hv(rng, v - (4 if i % 2 else 0), 10))
            for i, ch in enumerate(spec.get('taiko', '')):
                if ch in 'tT' and i < steps * 2:
                    S.n(CH['taiko'], t0 + i / 4 + human(rng, S.bpm, 8, 18), 0.6, 38 if ch == 'T' else 43, hv(rng, 80 if ch == 'T' else 60, 8))
    return S, intro_bars


# ---------------------------------------------------------------- render + post (room, tape, EQ, width) + master
def fluid(mid, wav):
    env = dict(os.environ, LD_LIBRARY_PATH=os.path.join(FS_HOME, 'usr/lib/x86_64-linux-gnu'))
    # soundfont's own reverb / chorus off: the room is a convolution IR in post, the chorus sounded digital
    subprocess.run([FLUIDSYNTH, '-ni', '-q', '-g', '0.5', '-r', str(SR), '-o', 'synth.reverb.active=0',
                    '-o', 'synth.chorus.active=0', '-F', wav, SF2, mid], check=True, env=env, stdout=subprocess.DEVNULL)
    with wave.open(wav) as w:
        ch, n = w.getnchannels(), w.getnframes()
        x = np.frombuffer(w.readframes(n), '<i2').astype(np.float64) / 32768
    x = x.reshape(-1, ch)
    return x if ch == 2 else np.repeat(x, 2, axis=1)


def make_ir(kind, seed=7):
    """synthesised stereo impulse responses (decorrelated L/R noise tails + early reflections), no recordings.
    'hall': a warm wooden room / small hall (~1.5 s); 'open': an open-air gathering (ground + far walls, ~1.2 s)."""
    rng = np.random.default_rng(seed)
    if kind == 'open':
        T, decay, lp, er = 1.3, 5.0, 2600, [(0.012, 0.35), (0.041, 0.18), (0.067, 0.12), (0.118, 0.08), (0.19, 0.05)]
    else:
        T, decay, lp, er = 1.6, 4.2, 3200, [(0.009, 0.25), (0.017, 0.2), (0.026, 0.15), (0.037, 0.11), (0.052, 0.08), (0.071, 0.05)]
    n = int(T * SR); t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        tail = rng.normal(0, 1, n) * np.exp(-t * decay) * np.minimum(1, t / 0.02)
        # high frequencies die faster than lows (air / wood absorption)
        tail = 0.6 * sosfiltfilt(butter(2, lp, fs=SR, output='sos'), tail) + 0.4 * sosfiltfilt(butter(2, 700, fs=SR, output='sos'), tail)
        ir[:, c] = tail * 0.012
        for dt, v in er:
            ir[int((dt + rng.uniform(-0.002, 0.002)) * SR), c] += v * rng.uniform(0.8, 1.1)
    return ir


IRS = {}
HARMONY, HARM_OUT = {}, {}
FESTIVAL = SYNTH_FESTIVAL = None  # set by /workspace/audio-015/make_festival.py (0.1.5)


def post(x, kind='hall', wet=0.2, drive=1.6, width=1.18):
    """x: (N, 2) linear render. Gentle EQ, tape-style saturation, convolution room, 4 kHz low-pass, subtle width."""
    x = x - x.mean(axis=0)
    hp = butter(2, 40, btype='high', fs=SR, output='sos')
    x = sosfiltfilt(hp, x, axis=0)
    # EQ: a little low-mid warmth (~+1.5 dB around 120–300 Hz) and a softened upper-mid
    warm = sosfiltfilt(butter(2, [110, 320], btype='band', fs=SR, output='sos'), x, axis=0)
    harsh = sosfiltfilt(butter(2, [2200, 3800], btype='band', fs=SR, output='sos'), x, axis=0)
    x = x + 0.19 * warm - 0.25 * harsh
    # tape: soft asymmetric saturation (adds warm low harmonics, rounds transients)
    pk = np.abs(x).max() + 1e-9
    y = x / pk * 0.9
    y = (np.tanh(drive * (y + 0.04)) - np.tanh(drive * 0.04)) / np.tanh(drive)
    x = y * pk / 0.9
    if kind not in IRS:
        IRS[kind] = make_ir(kind)
    ir = IRS[kind]
    wetx = np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], axis=1)
    x = x + wet * wetx / (np.sqrt(np.mean(wetx ** 2)) + 1e-9) * np.sqrt(np.mean(x ** 2))
    x = sosfiltfilt(butter(4, LP_HZ, btype='low', fs=SR, output='sos'), x, axis=0)
    m, s = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2
    s = s * width  # subtle width; the mid (lead, bass, kick) stays centred and mono-safe
    return np.stack([m + s, m - s], axis=1)


def lowpass(x, hz_cut, circular=True):
    sos = butter(4, hz_cut, btype='low', fs=SR, output='sos')
    if not circular:
        return sosfiltfilt(sos, x, axis=0)
    y = sosfiltfilt(sos, np.concatenate([x, x, x]), axis=0)
    return y[len(x):2 * len(x)]


def spectrum_report(x):
    stereo = x.ndim == 2
    m = x.mean(axis=1) if stereo else x
    X = np.abs(np.fft.rfft(m)) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR)
    tot = X.sum() + 1e-12
    rep = dict(above4k=round(float(X[f > 4000].sum() / tot * 100), 3), above2k=round(float(X[f > 2000].sum() / tot * 100), 2),
               centroid=round(float((X * f).sum() / tot)), rms_db=round(float(20 * np.log10(np.sqrt(np.mean(x ** 2)))), 1),
               peak=round(float(np.abs(x).max()), 2))
    if stereo:
        L, R = x[:, 0] - x[:, 0].mean(), x[:, 1] - x[:, 1].mean()
        rep['lr_corr'] = round(float((L * R).sum() / (np.sqrt((L ** 2).sum() * (R ** 2).sum()) + 1e-12)), 2)
    return rep


def master(x, ref):
    x = x - x.mean(axis=0)
    x = x / (np.sqrt(np.mean(ref ** 2)) + 1e-9) * TARGET_RMS
    return np.tanh(x / 0.8) * 0.8


def mp3(x, path, kbps=None):
    wav = path.replace('.mp3', '.tmp.wav')
    ch = 2 if x.ndim == 2 else 1
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(ch); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', kbps or MP3_RATE, '-ac', str(ch),
                    '-ar', str(SR), path], check=True)
    os.remove(wav)


def render_track(name, spec):
    fest = spec.get('kind') == 'festival'
    S, intro_bars = (FESTIVAL(spec) if fest else arrange(spec))
    if spec.get('island') or spec.get('style'):
        HARMONY[name] = check_harmony(S, spec['root'])
    mid = f'/tmp/bgm_{name}.mid'
    intro_s, body_s = S.write(mid, reps=3, intro_bars=intro_bars)
    I, Lb = int(round(intro_s * SR)), int(round(body_s * SR))
    if fest:
        raw = np.tile(SYNTH_FESTIVAL(S, body_s), (3, 1))
        x = post(raw, 'open', wet=0.3, drive=1.3, width=1.1)
    else:
        x = post(fluid(mid, f'/tmp/bgm_{name}_raw.wav'), 'hall', wet=spec.get('wet', 0.2))
    # post runs on the whole linear render (intro + 3 loop copies): the middle copy already carries the room /
    # note tails of the copy before it and its own tails spill into the next one, so it is seamless as a loop
    loop = x[I + Lb: I + 2 * Lb].copy()
    if spec.get('ambience'):
        # warm lo-fi texture only (Larry 11:28 PM): a quiet room tone and a few soft vinyl ticks, ≈ −42 / −36 dB under
        # the music, band-limited 250 Hz – 3.5 kHz, generated circularly at the loop length so the seam stays clean
        rng_a = np.random.default_rng(7)
        room = rng_a.normal(0, 1, (Lb, 2))
        band = butter(2, [250, 3500], btype='band', fs=SR, output='sos')
        room = np.concatenate([room, room, room])
        room = sosfiltfilt(band, room, axis=0)[Lb:2 * Lb]
        room *= 10 ** (-42 / 20) / (np.sqrt(np.mean(room ** 2)) + 1e-12) * np.sqrt(np.mean(loop ** 2)) / 0.12
        ticks = np.zeros((Lb, 2))
        for _ in range(int(Lb / SR * 3)):  # ~3 ticks a second
            i0 = int(rng_a.integers(0, Lb - 200))
            k = rng_a.uniform(0.2, 1.0) * np.exp(-np.arange(120) / 18)
            ticks[i0:i0 + 120, int(rng_a.integers(0, 2))] += k * rng_a.choice([-1, 1])
        ticks = np.concatenate([ticks, ticks, ticks])
        ticks = sosfiltfilt(butter(2, [700, 3200], btype='band', fs=SR, output='sos'), ticks, axis=0)[Lb:2 * Lb]
        ticks *= 10 ** (-36 / 20) * np.sqrt(np.mean(loop ** 2)) / (np.abs(ticks).max() + 1e-12) * 4
        loop = loop + room + ticks
    if spec.get('riser'):
        # soft riser into the next bar line (menu bar 1 or the title intro): band noise over the last 1.5 bars whose
        # centre opens 400 Hz -> 2.8 kHz and level swells to ≈ −30 dB under the music, easing out over 60 ms
        bar_n = Lb / 8
        n = int(bar_n * 1.5)
        rng_r = np.random.default_rng(11)
        nz = rng_r.normal(0, 1, (n, 2))
        seg = 8
        out_r = np.zeros_like(nz)
        for k in range(seg):  # stepped band-pass, cross-faded per segment (cheap time-varying filter)
            f = 400 * (2800 / 400) ** ((k + 0.5) / seg)
            band = sosfiltfilt(butter(2, [f * 0.6, min(f * 1.6, 3800)], btype='band', fs=SR, output='sos'), nz, axis=0)
            w = np.clip(1 - np.abs(np.linspace(0, seg, n) - (k + 0.5)), 0, 1)[:, None]
            out_r += band * w
        env = np.linspace(0, 1, n) ** 2.5
        fo = int(0.06 * SR)
        env[-fo:] *= np.linspace(1, 0, fo) ** 2
        out_r *= env[:, None]
        out_r *= 10 ** (spec['riser'] / 20) * np.sqrt(np.mean(loop ** 2)) / (np.sqrt(np.mean(out_r[-n // 3:] ** 2)) + 1e-12)
        loop[-n:] += out_r
    if spec.get('seam_ms'):
        # A very short cosine easing across the loop boundary keeps MP3's joint-stereo frame smear from clicking.
        # 4 ms only: much shorter than an attack, no perceptible musical pause.
        n = int(spec['seam_ms'] / 1000 * SR)
        f = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, n))
        loop[:n] *= f[:, None]
        loop[-n:] *= f[::-1, None]
    xf = 0
    if I:
        # intro once, a 64 ms blend into the steady loop, then the loop rotated by that blend length:
        # the loop region [I + xf, I + xf + Lb) is a rotation of the circular loop, so it stays seamless
        xf = int(spec.get('intro_xfade', 0.064) * SR)  # the title: 2.5 s, so the intro's string tails fade under the groove
        fade = np.linspace(0, 1, xf)[:, None]
        if spec.get('xfade_power'):  # equal-power: no level dip while the intro's tails hand over to the bed
            blend = x[I:I + xf] * np.cos(fade * np.pi / 2) + loop[:xf] * np.sin(fade * np.pi / 2)
        else:
            blend = x[I:I + xf] * (1 - fade) + loop[:xf] * fade
        out = np.concatenate([x[:I], blend, loop[xf:], loop[:xf]])
        out = np.concatenate([out, loop[xf:xf + GUARD]])
        start = I + xf
    else:
        # MP3 frames smear the first / last few samples of a file: wrap ~35 ms of the loop's own audio around it
        # (head guard = loop tail, tail guard = loop head) so the looped region [loopStart, loopStart + loop)
        # never touches the file edges and the seam stays click-free in every decoder
        out = np.concatenate([loop[-GUARD:], loop, loop[:GUARD]])
        start = GUARD
    out = master(out, loop) * spec.get('level', 1.0)
    if I and spec.get('intro_rms'):
        # keep the intro exactly as loud as the approved version, whatever the groove's level does; the gain
        # eases back to 1 across the intro -> groove crossfade (the loop itself stays at the shared loudness)
        g = spec['intro_rms'] / (np.sqrt(np.mean(out[:I] ** 2)) + 1e-9)
        env = np.ones(len(out))
        env[:I] = g
        env[I:I + xf] = np.linspace(g, 1, xf)
        out = out * env[:, None]
    if I and spec.get('intro_master'):
        # Larry 11:58 PM: keep the approved epic intro exactly. The post chain normalises over the whole render, so a
        # new main section would shift the intro by ~−30 dB of processing differences: splice the approved v7 intro
        # master back in (the v7 generator's own master, re-rendered; sample for sample up to 80 ms before the groove), crossfading into the new render there.
        with wave.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), spec['intro_master'])) as w:
            A = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64).reshape(-1, 2) / 32767
        assert len(A) == I, (len(A), I)
        c = int(0.08 * SR)
        f = (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, c)))[:, None]
        out[:I - c] = A[:I - c]
        out[I - c:I] = A[I - c:I] * (1 - f) + out[I - c:I] * f
    mp3(out, os.path.join(OUT, f'{name}.mp3'))
    return out, round(start / SR, 4), round(Lb / SR, 4), master(loop, loop)


# ---------------------------------------------------------------- stings (GeneralUser GS "Ukulele", GS bank 8)
# Real-ukulele behaviour: re-entrant g-C-E-A tuning, strums sweep the 4 strings (high g first on a down stroke),
# notes ring until the end and decay naturally; dry with a touch of room. Key of C.
UKE_LAYER = 0.62  # nylon layer velocity (≈ −8 dB under the ukulele)
UKE_C = ['G4', 'C4', 'E4', 'C5']  # C chord, open strings + 3rd fret A-string, in string order g C E A
UKE_G = ['G4', 'D4', 'G4', 'B4']  # G chord (0-2-3-2)


def strum(t, chord, v, up=False, spread=0.012):
    strings = chord[::-1] if up else chord
    return [(t + i * spread, n, v - (3 * i if up else 0) + (2 if i == len(strings) - 1 else 0)) for i, n in enumerate(strings)]


STINGS = {
    # item: a quick two-note upward pluck (sol -> do')
    'item': dict(sec=0.55, notes=[(0.0, 'G4', 82), (0.075, 'C5', 94)], glock=[(0.075, 'C6', 52)]),
    # milestone: rising arpeggio do-mi-sol-do' (plucked), then a bright C major strum
    'milestone': dict(sec=1.0, notes=[(0.0, 'C4', 74), (0.075, 'E4', 78), (0.15, 'G4', 82), (0.225, 'C5', 86)]
                      + strum(0.34, UKE_C, 96, spread=0.011), glock=[(0.34, 'C6', 50), (0.42, 'E6', 44)]),
    # quest complete: a happy little flourish on G (down-up-down) resolving to a ringing C chord
    'quest': dict(sec=1.18, notes=strum(0.0, UKE_G, 80, spread=0.009) + strum(0.11, UKE_G, 62, up=True, spread=0.007)
                  + strum(0.2, UKE_G, 74, spread=0.008) + strum(0.36, UKE_C, 100, spread=0.013) + [(0.37, 'E5', 70)],
                  glock=[(0.36, 'G5', 46), (0.44, 'C6', 50), (0.52, 'E6', 44)]),
}


def note_num(s):
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    return 12 * (int(s[-1]) + 1) + names[s[0]] + (1 if '#' in s else 0)


def render_stings():
    os.makedirs(OUT_SFX, exist_ok=True)
    info = {}
    for name, spec in STINGS.items():
        mid = mido.MidiFile(ticks_per_beat=TPB)
        tr = mido.MidiTrack(); mid.tracks.append(tr)
        ev = [(0, mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(120))),
              (0, mido.Message('control_change', channel=0, control=0, value=UKULELE[1])),
              (0, mido.Message('program_change', channel=0, program=UKULELE[0])),
              (0, mido.Message('control_change', channel=0, control=91, value=0)),
              (0, mido.Message('control_change', channel=0, control=93, value=0)),
              # layer: GU's Ukulele sample is very round (little above the 2nd harmonic); a quieter nylon-guitar
              # layer on the same notes adds the fingertip pluck and upper harmonics of a real uke
              (0, mido.Message('program_change', channel=1, program=NYLON)),
              (0, mido.Message('control_change', channel=1, control=91, value=0)),
              (0, mido.Message('control_change', channel=1, control=93, value=0)),
              # v8: a soft glockenspiel sparkle on top (modern cozy-RPG feedback)
              (0, mido.Message('program_change', channel=2, program=GLOCK)),
              (0, mido.Message('control_change', channel=2, control=91, value=0))]
        end = spec['sec']
        held = {}
        for t, n, v in spec['notes']:  # 120 BPM: 1 beat = 0.5 s; a re-struck string stops its previous note
            p = note_num(n)
            for c, vv in ((0, v), (1, v * UKE_LAYER)):
                if p in held:
                    ev.append((int(t * 2 * TPB) - 1, mido.Message('note_off', channel=c, note=p, velocity=0)))
                ev.append((int(t * 2 * TPB), mido.Message('note_on', channel=c, note=p, velocity=int(min(127, vv)))))
            held[p] = t
        for t, n, v in spec.get('glock', []):
            ev.append((int(t * 2 * TPB), mido.Message('note_on', channel=2, note=note_num(n), velocity=v)))
            ev.append((int(end * 2 * TPB), mido.Message('note_off', channel=2, note=note_num(n), velocity=0)))
        for p in held:
            for c in (0, 1):
                ev.append((int(end * 2 * TPB), mido.Message('note_off', channel=c, note=p, velocity=0)))
        ev.append((int((end + 0.5) * 2 * TPB), mido.MetaMessage('end_of_track')))
        ev.sort(key=lambda e: (e[0], 0 if e[1].type == 'note_off' else 1))
        last = 0
        for t, m in ev:
            m.time = max(0, t - last); last = max(last, t); tr.append(m)
        mid.save(f'/tmp/sting_{name}.mid')
        # dry with a touch of room; no extra filtering beyond the shared 4 kHz limit, so the pluck attack stays natural
        x = post(fluid(f'/tmp/sting_{name}.mid', f'/tmp/sting_{name}.wav'), 'hall', wet=0.08, drive=1.1, width=1.0)
        n = int(end * SR)
        x = x.mean(axis=1)[:n].copy()
        fl = int(0.1 * SR)
        x[-fl:] *= np.linspace(1, 0, fl) ** 1.5
        # same loudness as the v4 stings (≈ −17.5 dB RMS), peaks ≤ 0.7
        x = x * min(0.7 / (np.abs(x).max() + 1e-9), 10 ** (-17.5 / 20) / (np.sqrt(np.mean(x ** 2)) + 1e-9))
        path = os.path.join(OUT_SFX, f'{name}.mp3')
        mp3(x, path, '96k')
        info[name] = dict(sec=round(len(x) / SR, 2), kb=round(os.path.getsize(path) / 1024, 1), **spectrum_report(x))
        print('sting', name, info[name])
    return info


# ---------------------------------------------------------------- tracks
SHAKE = 's.S.s.S.s.S.s.S.'
NYLON, STEEL, STRINGS, CHOIR, OOHS, MARIMBA, FLUTE, PAN, HARP, ABASS, TAIKO, WARM = 24, 25, 48, 52, 53, 12, 73, 75, 46, 32, 116, 89
PIANO, GLOCK, PIZZ, FBASS, KALIMBA, RHODES = 0, 9, 45, 33, 108, 4
TRACKS = {
    # 標題曲 Pongso no Tao: broad intro (strings + choir swell, taiko), then the uke / guitar groove with the hook
    # Larry 11:58 PM: the intro is unchanged; the main section is now a melody-free "fresh new world" bed in the v3
    # menu's manner (title_bed_body): piano / Rhodes chords, airy strings + choir, pulsing bass, light kit, sparkle.
    # It is also the music of the modern zones (bgm.json startZone).
    'title': dict(seed=101, bpm=112, steps=8, root=62, intro=4, island=True, style='bed', intro_xfade=2.5, intro_rms=0.0817, intro_master='approved/title_intro_v7.wav', xfade_power=True,
                  pad_vel=30, ambience=True, riser=-33,
                  programs=dict(lead=PIANO, lead2=GLOCK, strum=UKULELE, pick=STEEL, bass=FBASS, pad=STRINGS, choir=CHOIR, taiko=TAIKO,
                                solo=RHODES)),
    # 選單 menu (0.1.4, v3 Larry 11:42 PM): no melody, lo-fi atmosphere in the title's key and tempo (D, 112 BPM):
    # Rhodes maj7 / add9 comping + soft piano dyads, string pad, pulsing bass, light kit, room tone / vinyl ticks, a pad
    # swell + soft riser in bars 7–8. Imaj9 – IVmaj9 – vi9 – Vadd9 twice: every pass ends on V, so the title's intro
    # (which opens on I) can start on any bar line (src/systems/audio/bgm.ts segueToTitle). No slides, no bends.
    'menu': dict(seed=131, bpm=112, steps=8, root=62, style='comp', pad_vel=34, ambience=True, riser=-30,
                 programs=dict(lead=RHODES, lead2=PIANO, bass=FBASS, pad=STRINGS)),
    # 開元港／島嶼主題（白天）: the same modern groove, brighter at 120 BPM; pizzicato strings lead + glockenspiel
    'harbour_day': dict(seed=11, bpm=120, steps=8, root=65, style='modern', lead_vel=106, double=56, pad_vel=30, legato=0.6,
                        form=['A', 'A2', 'B', 'A'],
                        programs=dict(lead=PIZZ, lead2=GLOCK, strum=UKULELE, pick=STEEL, bass=FBASS, pad=STRINGS)),
    # 夜晚：calm but moving — harp / nylon picking, soft strings, soft congas
    'night': dict(seed=23, bpm=96, steps=8, root=62, programs=dict(lead=NYLON, lead2=HARP, pick=HARP, bass=ABASS, pad=STRINGS),
                  lead=dict(vel=84, double=True, double_vel=40), pick='T.x.Tx.x', pad=True, pad_vel=30, bass='two',
                  drums=['....C.......C...', 's...s...s...s...']),
    # 外海／拼板舟：lilting 6/8 adventure
    'sea': dict(seed=37, bpm=116, steps=6, root=67, form=['H', 'D', 'B', 'H', 'R'],
                programs=dict(lead=STEEL, lead2=FLUTE, strum=NYLON, bass=ABASS, pad=STRINGS, taiko=TAIKO),
                lead=dict(vel=92, double=True, double_vel=42), strum='D.UD.U', strum_lo=55, strum_hi=74, pad=True, pad_vel=30,
                bass='six', drums=['l.....c...c.', 's.S.s.s.S.s.'], taiko='t...........'),
    # 山上／島內：bright upbeat adventure
    'mountain': dict(seed=79, bpm=122, steps=8, root=62, programs=dict(lead=PAN, lead2=STEEL, strum=STEEL, bass=ABASS, taiko=TAIKO),
                     lead=dict(vel=90, double=True, double_vel=46), strum='D.DUDUDU', strum_lo=52, strum_hi=71, bass='pop',
                     drums=['k...k...k...k...', '..C...c...C.c.l.', SHAKE], taiko='T.......t.......'),
    # 紅頭 Imorod：warm and sunny
    'imorod': dict(seed=41, bpm=108, steps=8, root=60, programs=dict(lead=NYLON, lead2=MARIMBA, strum=NYLON, pick=STEEL, bass=ABASS),
                   lead=dict(vel=96, double=True, double_vel=44), strum='D..U.UDU', strum_lo=55, strum_hi=74, pick='T...T...',
                   bass='pop', drums=['k.......k.......', '....l.......c.l.', SHAKE]),
    # 野銀 Ivalino：easy-going
    'ivalino': dict(seed=53, bpm=104, steps=8, root=63, programs=dict(lead=FLUTE, lead2=HARP, strum=NYLON, bass=ABASS, pad=STRINGS),
                    lead=dict(vel=86, double=True, double_vel=44), strum='D.DU.U.U', strum_lo=55, strum_hi=74, pad=True, pad_vel=28,
                    bass='pop', drums=['k.......k.......', '..C...c...C.c.l.', 's.s.s.s.s.s.s.s.']),
    # 東清 Iranmeylek：east-coast sunrise, the bounciest
    'iranmeylek': dict(seed=67, bpm=120, steps=8, root=62, programs=dict(lead=MARIMBA, lead2=STEEL, strum=NYLON, bass=ABASS),
                       lead=dict(vel=96, double=True, double_vel=46), strum='D.DUDUDU', strum_lo=55, strum_hi=74, bass='pop',
                       drums=['k.....k...k.....', '....C.......C.l.', SHAKE]),
    # 祭典・文化 'festival': not in 0.1.4 (Larry); parked with its generator in /workspace/audio-015/ for 0.1.5
}


# ---------------------------------------------------------------- menu UI sounds (0.1.4): quiet, real instruments, key of D
# (channel, program, bank, note, start s, velocity); short dry plucks / taps with a touch of room, no bends.
UI_SFX = {
    # cursor move / hover: a soft marimba tick
    'menu_move': dict(sec=0.07, fade=0.03, rms=-27.0, notes=[(0, MARIMBA, 0, 'A5', 0.0, 62)]),
    # confirm: a bright ukulele double-stop pluck (A4 + D5) with a glockenspiel D6 on top
    'menu_confirm': dict(sec=0.22, fade=0.08, rms=-24.5, notes=[(0, UKULELE[0], UKULELE[1], 'A4', 0.0, 84), (0, UKULELE[0], UKULELE[1], 'D5', 0.008, 90),
                                                               (1, NYLON, 0, 'D5', 0.008, 50), (2, GLOCK, 0, 'D6', 0.01, 52)]),
    # cancel / back: a lower, softer pluck stepping down (A4 -> D4), nylon + ukulele
    'menu_cancel': dict(sec=0.18, fade=0.07, rms=-26.5, notes=[(0, UKULELE[0], UKULELE[1], 'A4', 0.0, 66), (1, NYLON, 0, 'A4', 0.0, 40),
                                                              (0, UKULELE[0], UKULELE[1], 'D4', 0.055, 70), (1, NYLON, 0, 'D4', 0.055, 44)]),
    # open a menu / panel: two quick marimba notes up (D5 -> A5)
    'menu_open': dict(sec=0.2, fade=0.07, rms=-26.0, notes=[(0, MARIMBA, 0, 'D5', 0.0, 60), (0, MARIMBA, 0, 'A5', 0.045, 66)]),
    # toggle a switch / tab: one soft kalimba note
    'menu_toggle': dict(sec=0.12, fade=0.05, rms=-27.0, notes=[(0, KALIMBA, 0, 'F#5', 0.0, 70)]),
}


def render_ui_sfx():
    os.makedirs(OUT_SFX, exist_ok=True)
    info = {}
    for name, spec in UI_SFX.items():
        mid = mido.MidiFile(ticks_per_beat=TPB)
        tr = mido.MidiTrack(); mid.tracks.append(tr)
        ev = [(0, mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(120)))]
        seen = set()
        for ch, prog, bank, n, t, v in spec['notes']:
            if ch not in seen:
                seen.add(ch)
                ev += [(0, mido.Message('control_change', channel=ch, control=0, value=bank)),
                       (0, mido.Message('program_change', channel=ch, program=prog)),
                       (0, mido.Message('control_change', channel=ch, control=91, value=0)),
                       (0, mido.Message('control_change', channel=ch, control=93, value=0))]
            p = note_num(n)
            ev.append((int((0.05 + t) * 2 * TPB), mido.Message('note_on', channel=ch, note=p, velocity=v)))
            ev.append((int((0.05 + spec['sec'] + 0.2) * 2 * TPB), mido.Message('note_off', channel=ch, note=p, velocity=0)))
        ev.append((int((spec['sec'] + 0.8) * 2 * TPB), mido.MetaMessage('end_of_track')))
        ev.sort(key=lambda e: (e[0], 0 if e[1].type != 'note_on' else 1))
        last = 0
        for t, m in ev:
            m.time = max(0, t - last); last = max(last, t); tr.append(m)
        mid.save(f'/tmp/ui_{name}.mid')
        x = post(fluid(f'/tmp/ui_{name}.mid', f'/tmp/ui_{name}.wav'), 'hall', wet=0.06, drive=1.05, width=1.0).mean(axis=1)
        # the notes start at 50 ms in the render (pre-roll for the filters): cut from just before the attack
        on = int(0.05 * SR)
        lead = max(0, on - int(0.002 * SR) + int(np.argmax(np.abs(x[on - int(0.01 * SR):]) > np.abs(x).max() * 0.02)) - int(0.008 * SR))
        x = x[lead:lead + int(spec['sec'] * SR)].copy()
        x[:32] *= np.linspace(0, 1, 32)
        fl = int(spec['fade'] * SR)
        x[-fl:] *= np.linspace(1, 0, fl) ** 2
        x = x * min(0.45 / (np.abs(x).max() + 1e-9), 10 ** (spec['rms'] / 20) / (np.sqrt(np.mean(x ** 2)) + 1e-9))
        path = os.path.join(OUT_SFX, f'{name}.mp3')
        mp3(x, path, '96k')
        info[name] = dict(sec=round(len(x) / SR, 3), kb=round(os.path.getsize(path) / 1024, 1), **spectrum_report(x))
        print('ui', name, info[name])
    return info


def main():
    os.makedirs(OUT, exist_ok=True)
    only = {a for a in sys.argv[1:] if not a.startswith('-')}
    info = {}
    for name, spec in TRACKS.items():
        if only and name not in only:
            continue
        out, intro, loop_len, loop = render_track(name, spec)
        if name in HARMONY:
            hr = HARMONY.pop(name)
            print(f"  harmony {name}: {hr['notes']} notes, {hr['chord_tones']} chord tones, {hr['passing']} passing, "
                  f"{len(hr['violations'])} violations", hr['violations'][:5])
            if hr['violations']:
                raise SystemExit(f'{name}: melody notes clash with the chords')
            HARM_OUT[name] = {k: (len(v) if k == 'violations' else v) for k, v in hr.items()}
        rep = spectrum_report(loop)
        info[name] = dict(loopStart=intro, loop=loop_len, sec=round(len(out) / SR, 2), kb=round(os.path.getsize(os.path.join(OUT, f'{name}.mp3')) / 1024), **rep)
        print(name, info[name])
    if not only or 'stings' in only:
        render_stings()
    if not only or 'ui' in only:
        render_ui_sfx()
    man_p = os.path.join(ROOT, 'content', 'audio', 'bgm.json')
    man = json.load(open(man_p, encoding='utf8'))
    for name, i in info.items():
        if name in man['tracks']:
            man['tracks'][name]['loop'] = i['loop']
            man['tracks'][name]['loopEnd'] = round(i['loopStart'] + i['loop'], 4)
            if i['loopStart']:
                man['tracks'][name]['loopStart'] = i['loopStart']
            else:
                man['tracks'][name].pop('loopStart', None)
    with open(man_p, 'w', encoding='utf8') as f:
        json.dump(man, f, ensure_ascii=False, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
