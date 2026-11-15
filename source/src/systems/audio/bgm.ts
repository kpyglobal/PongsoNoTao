/**
 * Background music (0.1.4). Self-contained: the game only calls `startBgm(probe)` once.
 * - Track choice comes from content/audio/bgm.json: cover / title screen → title theme (its intro plays
 *   once, then it loops from loopStart), a festival / cultural scene → festival (off in 0.1.4: culture.enabled false, back in 0.1.5), at sea → sea, night → night, high ground → mountain, near a themed
 *   village → that village, otherwise the default (harbour / island theme). Village positions come from the world layout,
 *   so a reshaped island needs no change here.
 * - Nothing plays until the first tap / key (mobile autoplay rules). Tracks are fetched only when first needed
 *   and only a few decoded loops are kept (phone memory).
 * - Volume / on-off live in the shared engine (./engine.ts); the ♪ button opens the settings panel (./panel.ts).
 */
import manifest from '../../../content/audio/bgm.json';
import { FACILITIES, VILLAGE_DEFS } from '../../world/layout';
import { audio } from './engine';
import { mountAudioPanel } from './panel';
import { preloadStings } from './sfx';

export interface BgmProbe {
  x: number;
  z: number;
  night: boolean;
  sea: boolean;
  /** 0.1.4: the title / party / 搭飛機・搭船 screens → the short menu loop */
  menu?: boolean;
  /** the arrival cut-scene (or older callers: the cover) → the title theme from its epic intro */
  title?: boolean;
  /** a festival / cultural scene is open (see isCultureQuest and content/audio/bgm.json "culture") */
  culture?: boolean;
  /** ground height under the player (for the mountain theme); optional */
  h?: number;
}
interface TrackDef {
  file: string;
  loop: number;
  /** seconds of one-time intro before the loop (title theme) */
  loopStart?: number;
  gain: number;
  zh: string;
  /** beats per minute (bar-line segues) */
  bpm?: number;
}
interface Manifest {
  fadeSeconds: number;
  villageRadius: number;
  default: string;
  title?: string;
  /** 0.1.4 menu loop (start screens); segues into the title's intro on a bar line */
  menu?: string;
  /**
   * 0.1.4: the title's loop is the music of the modern zones (開元港, 蘭嶼機場, 衛生所, scooter shop, hotel …).
   * `facilities`: keys of FACILITIES in world/layout (missing keys are skipped, so a zone starts working as soon as
   * the world adds it); `radii`: optional per-key radius; default keys: harbor + runway.
   */
  startZone?: { track: string; radius: number; facilities?: string[]; radii?: Record<string, number> };
  night: string;
  sea: string;
  mountain?: string;
  mountainHeight?: number;
  culture?: { enabled?: boolean; track: string; arcs?: string[]; quests?: string[]; requiresOutfit?: boolean; song?: boolean };
  villages: Record<string, string>;
  tracks: Record<string, TrackDef>;
}
const M = manifest as unknown as Manifest;

const MAX_DECODED = 3;
const BASE = `${import.meta.env.BASE_URL}assets/audio/bgm/`;

/** a quest whose scenes get the festival / culture music (rules in content/audio/bgm.json "culture") */
export function isCultureQuest(q: { id: string; arc?: string; requiresOutfit?: unknown; song?: string } | null | undefined): boolean {
  const c = M.culture;
  if (!q || !c) return false;
  return !!(c.quests?.includes(q.id) || (q.arc && c.arcs?.includes(q.arc)) || (c.requiresOutfit && q.requiresOutfit) || (c.song && q.song));
}

/** pure: which track id fits this spot (exported for tests) */
export function pickTrack(p: BgmProbe): string {
  if (p.menu && M.menu && M.tracks[M.menu]) return M.menu;
  if (p.title && M.title) return M.title;
  if (p.culture && M.culture && M.culture.enabled !== false && M.tracks[M.culture.track]) return M.culture.track;
  if (p.sea) return M.sea;
  if (p.night) return M.night;
  // up on the hills / inland slopes (villages sit low on the coast, so this never hides a village theme)
  if (M.mountain && M.mountainHeight !== undefined && (p.h ?? 0) >= M.mountainHeight) return M.mountain;
  // 0.1.4: the modern zones (開元港, 蘭嶼機場, 衛生所, …) play the title's loop (the arrival flows straight into it)
  const z = M.startZone;
  if (z && M.tracks[z.track]) {
    const r2 = z.radius * z.radius;
    const F = FACILITIES as unknown as Record<string, { x: number; z: number } | undefined>;
    for (const k of z.facilities ?? ['harbor', 'runway']) {
      const c = F[k];
      if (!c) continue;
      const r = z.radii?.[k];
      if ((c.x - p.x) ** 2 + (c.z - p.z) ** 2 < (r !== undefined ? r * r : r2)) return z.track;
    }
  }
  let best: string | null = null;
  let bd = M.villageRadius * M.villageRadius;
  for (const v of VILLAGE_DEFS) {
    const id = M.villages[v.id];
    if (!id) continue;
    const d = (v.cx - p.x) ** 2 + (v.cz - p.z) ** 2;
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best ?? M.default;
}

class Bgm {
  private want = M.default;
  private playing: { id: string; src: AudioBufferSourceNode; gain: GainNode; t0: number; off: number } | null = null;
  /** a bar-line segue is scheduled (menu → title intro): no other change until it starts */
  private segueAt = 0;
  private cache = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private timer = 0;
  private lastH = 0;
  /** the probe asked for the title with its intro (arrival cut-scene), not the start-zone loop */
  private introWanted = false;

  constructor(private probe: () => BgmProbe | null) {}

  start(): void {
    audio.arm();
    audio.onChange(() => {
      preloadStings();
      this.apply();
    });
    this.timer = window.setInterval(() => this.tick(), 1000);
    mountAudioPanel();
  }

  /** test / debug view */
  state(): { want: string; playing: string | null; unlocked: boolean; decoded: string[]; settings: typeof audio.settings; h: number } {
    return { want: this.want, playing: this.playing?.id ?? null, unlocked: audio.running, decoded: [...this.cache.keys()], settings: { ...audio.settings }, h: Math.round(this.lastH * 10) / 10 };
  }

  private tick(): void {
    const p = this.probe();
    if (p) {
      this.want = pickTrack(p);
      this.introWanted = !!p.title && !p.menu;
      this.lastH = p.h ?? 0;
    }
    // on the menu, have the title decoded already so the segue can start on the next bar line
    if (this.want === M.menu && M.title && audio.running) void this.load(M.title);
    this.apply();
  }

  /**
   * 0.1.4: the arrival starts. If the menu loop is playing and the title is decoded, start the title's intro on the
   * menu's next bar line (both are D, 112 BPM) and fade the menu out there. Returns the seconds until the title's
   * first beat (0 when the music is off / not unlocked: the cut-scene then just runs on the clock).
   */
  segueToTitle(): number {
    const ctx = audio.ctx;
    const id = M.title;
    if (!id || !ctx || !audio.running || audio.musicGain() === 0) return 0;
    this.want = id;
    const buf = this.cache.get(id);
    const cur = this.playing;
    if (!buf || !audio.musicBus) {
      this.apply();
      return 0;
    }
    if (cur?.id === id) return 0;
    const now = ctx.currentTime;
    let wait = 0.05;
    if (cur && cur.id === M.menu) {
      const d = M.tracks[cur.id];
      const bar = (60 / (d.bpm ?? 112)) * 4;
      const ls = d.loopStart ?? 0;
      const pos = now - cur.t0 + cur.off - ls; // musical time since the loop's bar 1
      if (pos >= 0) {
        const m = pos % d.loop;
        wait = bar - (m % bar);
        if (wait < 0.12) wait += bar; // too close to schedule cleanly
      } else wait = -pos;
    }
    const at = now + wait;
    const def = M.tracks[id];
    const g = ctx.createGain();
    g.gain.setValueAtTime(def.gain, at);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = def.loopStart ?? 0;
    src.loopEnd = Math.min(src.loopStart + def.loop, buf.duration);
    src.connect(g).connect(audio.musicBus);
    src.start(at, 0);
    if (cur) {
      cur.gain.gain.cancelScheduledValues(now);
      cur.gain.gain.setValueAtTime(cur.gain.gain.value, at - 0.02 > now ? at - 0.02 : now);
      cur.gain.gain.linearRampToValueAtTime(0, at + 0.35);
      cur.src.stop(at + 0.4);
    }
    this.playing = { id, src, gain: g, t0: at, off: 0 };
    this.segueAt = at;
    return wait;
  }

  private apply(): void {
    const ctx = audio.ctx;
    if (!ctx || !audio.running) return;
    if (audio.musicGain() === 0) {
      // muted: stop (no decoding / mixing in the background); resumes on un-mute
      if (this.playing) {
        const old = this.playing;
        this.playing = null;
        old.src.stop(ctx.currentTime + 0.3);
      }
      return;
    }
    if (this.playing?.id === this.want) return;
    if (this.segueAt && ctx.currentTime < this.segueAt + 0.5) return;
    this.segueAt = 0;
    const id = this.want;
    void this.load(id).then((buf) => {
      const ctx = audio.ctx;
      if (!buf || !ctx || !audio.musicBus || audio.musicGain() === 0 || this.want !== id || this.playing?.id === id) return;
      const def = M.tracks[id];
      const now = ctx.currentTime;
      const fade = M.fadeSeconds;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(def.gain, now + fade);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const ls = def.loopStart ?? 0;
      src.loopStart = ls;
      src.loopEnd = Math.min(ls + def.loop, buf.duration);
      src.connect(g).connect(audio.musicBus);
      // the title from its epic intro only for the arrival (probe.title); anywhere else straight into its loop
      const off = id === M.title && !this.introWanted ? ls : 0;
      src.start(now, off);
      const old = this.playing;
      if (old) {
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value, now);
        old.gain.gain.linearRampToValueAtTime(0, now + fade);
        old.src.stop(now + fade + 0.05);
      }
      this.playing = { id, src, gain: g, t0: now, off };
    });
  }

  private load(id: string): Promise<AudioBuffer | null> {
    const hit = this.cache.get(id);
    if (hit) {
      this.cache.delete(id); // LRU: re-insert as newest
      this.cache.set(id, hit);
      return Promise.resolve(hit);
    }
    const def = M.tracks[id];
    const ctx = audio.ctx;
    if (!def || !ctx) return Promise.resolve(null);
    let p = this.loading.get(id);
    if (!p) {
      p = fetch(BASE + def.file)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((ab) => new Promise<AudioBuffer>((res, rej) => void ctx.decodeAudioData(ab, res, rej)))
        .then((buf) => {
          this.cache.set(id, buf);
          while (this.cache.size > MAX_DECODED) {
            const oldest = [...this.cache.keys()].find((k) => k !== id && k !== this.playing?.id);
            if (!oldest) break;
            this.cache.delete(oldest);
          }
          return buf;
        })
        .catch((e: unknown) => {
          console.warn(`[bgm] ${def.file}: ${String(e)}`);
          return null;
        })
        .finally(() => this.loading.delete(id));
      this.loading.set(id, p);
    }
    return p;
  }

  dispose(): void {
    clearInterval(this.timer);
  }
}

let inst: Bgm | null = null;

/** 0.1.4 arrival: start the title's intro on the menu's next bar line; seconds until it starts (0 = music off) */
export function segueToTitle(): number {
  return inst ? inst.segueToTitle() : 0;
}

/** seconds of the title's one-time epic intro (the arrival cut-scene lasts this long, plus the approach) */
export function titleIntroSeconds(): number {
  return (M.title && M.tracks[M.title]?.loopStart) || 0;
}

/** call once after the HUD exists; `probe` returns where the player is (null = keep the current track) */
export function startBgm(probe: () => BgmProbe | null): void {
  if (inst) return;
  inst = new Bgm(probe);
  inst.start();
  (window as unknown as { __bgm?: () => ReturnType<Bgm['state']> }).__bgm = () => inst!.state();
  (window as unknown as { __bgmPick?: typeof pickTrack }).__bgmPick = pickTrack; // tests: the pick rules
}
