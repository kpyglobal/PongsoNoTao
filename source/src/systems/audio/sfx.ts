/**
 * Sound effects (0.1.4), synthesized live (no files, all original):
 * - sfxBlip: a soft little "嘟" while dialogue text types out (every 2nd character, throttled)
 * - sfxShutter: a digital camera — two focus beeps, then the shutter click
 * - sfxSting: short ukulele stings (item ≤ 0.6 s, milestone ≤ 1.0 s, quest ≤ 1.2 s, small files in public/assets/audio/sfx/, rendered by
 *   scripts/audio/make_bgm.py): 'item' (collected), 'milestone' (achievement), 'quest' (quest complete).
 *   Several at once (a quest that also gives an item) play only the most important one.
 * - sfx.play(name): named sounds, including the 0.1.4 menu UI sounds ('menu_move', 'menu_confirm', 'menu_cancel',
 *   'menu_open', 'menu_toggle'; quiet real-instrument plucks / taps, files in public/assets/audio/sfx/). See
 *   docs/audio-menu-api.md.
 * All go through the 音效 bus, so the settings panel controls / mutes them.
 */
import { audio } from './engine';

const BLIP_GAP = 0.075; // s: never more than ~13 blips a second
const BLIP_NOTES = [0, 2, 4, 7, 9]; // pentatonic steps above the base: gentle variety, never a clash
let lastBlip = 0;
let charCount = 0;
let noise: AudioBuffer | null = null;
/** test / debug counters (scripts/test-bgm.mjs) */
export const sfxStats = { blips: 0, shutters: 0, stings: {} as Record<string, number>, menu: {} as Record<string, number> };
(window as unknown as { __sfx?: typeof sfxStats }).__sfx = sfxStats;
// the shutter is also callable from tests (the photo step itself is covered by the quest scripts)
(window as unknown as { __sfxShutter?: () => void }).__sfxShutter = () => sfxShutter();

function ready(): AudioContext | null {
  const c = audio.ctx;
  return c && audio.running && audio.sfxBus && audio.sfxGain() > 0 ? c : null;
}

function tone(c: AudioContext, t: number, f: number, dur: number, peak: number, type: OscillatorType, lp = 2400): void {
  const o = c.createOscillator();
  const g = c.createGain();
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = lp;
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  o.connect(filt).connect(g).connect(audio.sfxBus!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** call once per revealed character; skips spaces / punctuation and plays on every 2nd one */
export function sfxBlip(ch: string): void {
  if (!ch.trim() || /[，。、！？：；「」『』（）…—,.!?:;()'"]/.test(ch)) return;
  if (charCount++ % 2) return;
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  if (t - lastBlip < BLIP_GAP) return;
  lastBlip = t;
  sfxStats.blips++;
  const step = BLIP_NOTES[(ch.codePointAt(0) ?? 0) % BLIP_NOTES.length];
  tone(c, t, 520 * 2 ** (step / 12), 0.055, 0.16, 'triangle', 1800);
}

/** reset the every-2nd-character counter (new dialogue line) */
export function sfxBlipReset(): void {
  charCount = 0;
}

function noiseBuf(c: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const n = Math.round(c.sampleRate * 0.08);
  noise = c.createBuffer(1, n, c.sampleRate);
  const d = noise.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x3fffffff - 1) * (1 - i / n);
  }
  return noise;
}

function click(c: AudioContext, t: number, band: number, dur: number, peak: number): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuf(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = band;
  bp.Q.value = 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  src.connect(bp).connect(g).connect(audio.sfxBus!);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/** digital camera: bi-bip (focus) … ka-chik (shutter) */
export function sfxShutter(): void {
  const c = ready();
  if (!c) return;
  sfxStats.shutters++;
  const t = c.currentTime + 0.01;
  tone(c, t, 1480, 0.05, 0.1, 'sine', 3000);
  tone(c, t + 0.08, 1480, 0.05, 0.1, 'sine', 3000);
  click(c, t + 0.2, 2200, 0.025, 0.6);
  tone(c, t + 0.2, 180, 0.04, 0.25, 'sine', 800);
  click(c, t + 0.27, 1200, 0.04, 0.45);
}

// ---------------------------------------------------------------- ukulele stings
export type StingId = 'item' | 'milestone' | 'quest';
const STING_RANK: Record<StingId, number> = { item: 1, milestone: 2, quest: 3 };
const stingBufs = new Map<string, AudioBuffer | null>();
const stingLoads = new Map<string, Promise<AudioBuffer | null>>();
let pending: StingId | null = null;
let pendingTimer = 0;

function loadSting(c: AudioContext, id: string): Promise<AudioBuffer | null> {
  const hit = stingBufs.get(id);
  if (hit !== undefined) return Promise.resolve(hit);
  let p = stingLoads.get(id);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}assets/audio/sfx/${id}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => new Promise<AudioBuffer>((res, rej) => void c.decodeAudioData(ab, res, rej)))
      .catch(() => null)
      .then((b) => {
        stingBufs.set(id, b);
        return b;
      });
    stingLoads.set(id, p);
  }
  return p;
}

/** fetch the stings and the menu sounds once audio is unlocked (tiny files, so the first one plays on time) */
export function preloadStings(): void {
  const c = audio.ctx;
  if (!c) return;
  for (const id of Object.keys(STING_RANK)) void loadSting(c, id);
  for (const id of MENU_IDS) void loadSting(c, id);
}

/** play a sting; calls within 60 ms are merged and only the highest-ranked one plays */
export function sfxSting(id: StingId): void {
  if (!pending || STING_RANK[id] > STING_RANK[pending]) pending = id;
  if (pendingTimer) return;
  pendingTimer = window.setTimeout(() => {
    const which = pending!;
    pending = null;
    pendingTimer = 0;
    const c = ready();
    if (!c) return;
    void loadSting(c, which).then((buf) => {
      if (!buf || !ready()) return;
      const src = c.createBufferSource();
      const g = c.createGain();
      g.gain.value = 0.9;
      src.buffer = buf;
      src.connect(g).connect(audio.sfxBus!);
      src.start();
      sfxStats.stings[which] = (sfxStats.stings[which] ?? 0) + 1;
    });
  }, 60);
}
(window as unknown as { __sfxSting?: (id: StingId) => void }).__sfxSting = (id) => sfxSting(id);

// ---------------------------------------------------------------- named sounds + 0.1.4 menu UI sounds
export type MenuSfxId = 'menu_move' | 'menu_confirm' | 'menu_cancel' | 'menu_open' | 'menu_toggle';
export type SfxName = MenuSfxId | StingId | 'shutter';
/** gain on the 音效 bus, minimum gap between two plays of the same sound (s), and whether a new one cuts the last */
const MENU: Record<MenuSfxId, { gain: number; gap: number; cut: boolean }> = {
  menu_move: { gain: 1, gap: 0.035, cut: true }, // fast cursor scrolling: at most ~28 a second, never piling up
  menu_confirm: { gain: 1, gap: 0.08, cut: false },
  menu_cancel: { gain: 1, gap: 0.08, cut: false },
  menu_open: { gain: 1, gap: 0.1, cut: false },
  menu_toggle: { gain: 1, gap: 0.05, cut: true },
};
const MENU_IDS = Object.keys(MENU) as MenuSfxId[];
const lastAt = new Map<MenuSfxId, number>();
const lastSrc = new Map<MenuSfxId, AudioBufferSourceNode>();

function playMenu(id: MenuSfxId): void {
  // nothing plays while 音效 is off (or at 0 %). On the very first tap the context is still resuming (the tap is what
  // unlocks audio), so the sound waits for that, but is dropped if it would come more than ~0.25 s late.
  const c = audio.ctx;
  if (!c || !audio.sfxBus || audio.sfxGain() === 0) return;
  const def = MENU[id];
  const asked = performance.now() / 1000;
  if (asked - (lastAt.get(id) ?? -1) < def.gap) return;
  lastAt.set(id, asked);
  const resumed = audio.running ? Promise.resolve() : c.resume().catch(() => undefined);
  void resumed.then(() => loadSting(c, id)).then((buf) => {
    if (!buf || !ready() || performance.now() / 1000 - asked > 0.25) return;
    if (def.cut) {
      const prev = lastSrc.get(id);
      try {
        prev?.stop(c.currentTime + 0.01);
      } catch {
        /* already ended */
      }
    }
    const src = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = def.gain;
    src.buffer = buf;
    src.connect(g).connect(audio.sfxBus!);
    src.start();
    lastSrc.set(id, src);
    sfxStats.menu[id] = (sfxStats.menu[id] ?? 0) + 1;
  });
}

/**
 * Named sounds on the 音效 bus (respects the 音效 on/off + volume in the ♪ panel).
 *   sfx.play('menu_move')     cursor moves / hover           (70 ms soft marimba tick)
 *   sfx.play('menu_confirm')  select / OK                    (220 ms ukulele + glockenspiel pluck)
 *   sfx.play('menu_cancel')   back / close                   (180 ms lower soft pluck, stepping down)
 *   sfx.play('menu_open')     open a menu / panel            (200 ms two marimba notes up)
 *   sfx.play('menu_toggle')   switch / tab / checkbox        (120 ms kalimba)
 *   sfx.play('item' | 'milestone' | 'quest')  the ukulele stings (same as sfxSting)
 *   sfx.play('shutter')       the camera
 * sfx.preload() fetches everything (also done automatically when audio unlocks).
 */
export const sfx = {
  names: [...MENU_IDS, ...(Object.keys(STING_RANK) as StingId[]), 'shutter'] as SfxName[],
  play(name: SfxName): void {
    if (name in MENU) playMenu(name as MenuSfxId);
    else if (name in STING_RANK) sfxSting(name as StingId);
    else if (name === 'shutter') sfxShutter();
  },
  preload(): void {
    preloadStings();
  },
};
(window as unknown as { __sfxPlay?: (n: SfxName) => void }).__sfxPlay = (n) => sfx.play(n);
