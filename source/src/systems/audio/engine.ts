/**
 * Shared audio engine (0.1.4): one AudioContext, a music bus and a sound-effect bus, and the player's
 * sound settings (音樂 / 音效 volume + on/off), saved in this browser. Nothing makes sound until the
 * first tap / key (mobile autoplay rules).
 */
export interface AudioSettings {
  /** 0..1 */
  music: number;
  sfx: number;
  musicOn: boolean;
  sfxOn: boolean;
}
const KEY = 'tao-rpg.audio';
const OLD_KEY = 'tao-rpg.bgm';
/** quiet by default (Larry 0.1.4: "default 不要 play 太大聲") */
export const DEFAULT_AUDIO: AudioSettings = { music: 0.35, sfx: 0.5, musicOn: true, sfxOn: true };

const clamp01 = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<AudioSettings>;
      return {
        music: clamp01(j.music, DEFAULT_AUDIO.music),
        sfx: clamp01(j.sfx, DEFAULT_AUDIO.sfx),
        musicOn: typeof j.musicOn === 'boolean' ? j.musicOn : true,
        sfxOn: typeof j.sfxOn === 'boolean' ? j.sfxOn : true,
      };
    }
    // first 0.1.4 build stored only 開／小聲／關 for music
    const old = JSON.parse(localStorage.getItem(OLD_KEY) ?? '{}') as { level?: number };
    if (old.level === 2) return { ...DEFAULT_AUDIO, musicOn: false };
  } catch {
    /* unreadable: defaults */
  }
  return { ...DEFAULT_AUDIO };
}

type Listener = () => void;

class AudioEngine {
  ctx: AudioContext | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  settings: AudioSettings = loadSettings();
  private listeners: Listener[] = [];
  private armed = false;

  /** install the first-interaction unlock (idempotent) */
  arm(): void {
    if (this.armed) return;
    this.armed = true;
    const unlock = (): void => {
      this.ensure();
      if (this.ctx && this.ctx.state !== 'running' && !document.hidden) void this.ctx.resume().then(() => this.emit());
      else this.emit();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  get running(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  ensure(): void {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC({ sampleRate: 32000 }); // files are 44.1 kHz stereo (content ≤ 4 kHz), decoded at 32 kHz: smaller buffers on phones
    } catch {
      this.ctx = new AC();
    }
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.connect(this.ctx.destination);
    this.sfxBus.connect(this.ctx.destination);
    this.applyGains(true);
  }

  musicGain(): number {
    return this.settings.musicOn ? this.settings.music : 0;
  }
  sfxGain(): number {
    return this.settings.sfxOn ? this.settings.sfx : 0;
  }

  set(patch: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      /* private mode: not remembered */
    }
    this.ensure();
    this.applyGains(false);
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().then(() => this.emit());
    else this.emit();
  }

  onChange(fn: Listener): void {
    this.listeners.push(fn);
  }

  offChange(fn: Listener): void {
    this.listeners = this.listeners.filter((f) => f !== fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private applyGains(instant: boolean): void {
    if (!this.ctx || !this.musicBus || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    for (const [bus, g] of [
      [this.musicBus, this.musicGain()],
      [this.sfxBus, this.sfxGain()],
    ] as const) {
      bus.gain.cancelScheduledValues(now);
      if (instant) bus.gain.setValueAtTime(g, now);
      else bus.gain.setTargetAtTime(g, now, 0.08);
    }
  }
}

export const audio = new AudioEngine();
