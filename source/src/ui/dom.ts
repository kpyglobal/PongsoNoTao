import { assetUrl } from '../core/paths';
import type { Gender, GameState, LangMode } from '../core/state';
import { PERIODS, SEASONS, type Period, type Season } from '../core/timeSeason';
import type { GlossaryEntry, MilestoneEntry, PlayableOrigin, UiContent } from '../core/content';
import type { ItemDef, RecipeDef } from '../content/types';
import { codexPage, type CodexVM } from './codex';
import { TERRAIN_BOX } from '../world/height';
import { Notebook, h, nbTitle, nbMore, nbSource, type NbItem } from './notebook';

/** Modal layers drawn over the world; Game owns which one is open (at most one at a time). */

type TextSize = 's' | 'm' | 'l';
const TEXT_SIZE_KEY = 'tao-rpg:textSize';
/** 中 (default) is a touch smaller than the original 1.0 UI text */
const TEXT_SCALE: Record<TextSize, number> = { s: 0.84, m: 0.92, l: 1.06 };
function readTextSize(): TextSize {
  try {
    const v = localStorage.getItem(TEXT_SIZE_KEY);
    if (v === 's' || v === 'm' || v === 'l') return v;
  } catch { /* storage blocked */ }
  return 'm';
}

export type Overlay = 'journal' | 'travel' | 'help';

export interface UiHooks {
  onOrigin: (id: PlayableOrigin, gender: Gender) => void;
  onPeriod: (p: Period) => void;
  onSeason: (s: Season) => void;
  onLang: (m: LangMode) => void;
  /** a UI control asked to open / close an overlay (Game decides and calls renderOverlay) */
  onOverlay: (kind: Overlay, open: boolean) => void;
  /** the journal tab changed: Game re-renders the pages */
  onJournalTab: () => void;
  onInteract: () => void;
  onDialogueNext: () => void;
  onMinigameHit: () => void;
  onPad: (x: number, z: number, active: boolean) => void;
  onCamBtn: (dir: -1 | 1 | 0) => void;
  onCamReset: () => void;
  onZoom: (dir: -1 | 1) => void;
  onScooter: () => void;
  onFastTravel: (id: string) => void;
  /** party bar: control this member */
  onSwitch: (role: 'm' | 'f' | 't') => void;
  /** party split: the solo member gives up (放棄出海) and regroups */
  onSoloAbort?: () => void;
  /** origin screen: resume the autosave */
  onContinue: () => void;
}

/** One party member button (HUD, top-left). */
export interface PartyChipVM {
  role: 'm' | 'f' | 't';
  label: string;
  portrait: string;
  active: boolean;
  /** party split: 在隊上 / 離隊：… / 在…等 (shown under the name) */
  status?: string;
  /** away or waiting somewhere (not with the group) */
  away?: boolean;
  /** cannot be switched to right now (busy / solo) */
  locked?: boolean;
}

/** One card in the 任務 page (Game builds these from the quest engine; the UI only draws). */
export interface QuestCardVM {
  id: string;
  line: 'main' | 'side' | 'photo';
  status: 'active' | 'done' | 'locked';
  name: string;
  roles: string[];
  coop: string;
  objective: string;
  progress: string;
  blocks: string[];
  hint: { tier: 'direct' | 'vague' | 'tao'; from: string; text: string; tao?: string; state?: 'unheard' | 'heard' | 'translated' } | null;
  placeholder: boolean;
  tracked: boolean;
  /** batch 1b: 漁場（族男）／潛點（誰都能去） chip */
  ground?: string;
  /** 分工: 女耆老／男耆老 交辦、驗收 chip */
  giver?: string;
  /** batch 1b: activity song (first line, text only) + ⓘ source */
  song?: { title: string; tao: string; zh: string; source: string } | null;
}

export interface TrackerVM {
  line: string;
  name: string;
  objective: string;
  warn: string;
}


export class UI {
  root: HTMLElement;
  hooks!: UiHooks;
  private selected: UiContent['origins'][number]['id'] | null = null;
  private gender: Gender = 'm';
  private content: UiContent | null = null;
  private overlay: Overlay | null = null;
  /** element focused before a dialog layer took focus (restored when it closes) */
  private returnFocus: HTMLElement | null = null;
  private journalTab = 'quests';
  /** batch 1b: pages drawn outside this file (相簿與水下, 存檔) */
  tabRenderers: Record<string, (pages: HTMLElement) => void> = {};
  /** 背包／圖鑑 page data (Game sets it) */
  codexVM: (() => CodexVM) | null = null;
  private questFilter: 'all' | 'active' | 'done' | 'locked' = 'all';
  private questLine: 'all' | 'main' | 'side' | 'photo' = 'all';
  private lastQuests: QuestCardVM[] = [];
  /** Game hook: track a quest in the HUD */
  onTrack: ((id: string) => void) | null = null;
  private helpTimer: number | null = null;
  private helpUnbind: (() => void) | null = null;
  private camDrawerOpen = false;
  private toastTimer: number | null = null;
  private promptText: string | null | undefined = undefined;
  private mmLast = { x: NaN, z: NaN, yaw: NaN };
  private elCache = new Map<string, HTMLElement>();

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = `
      <div class="overlay-screen is-boot" id="boot-screen">
        <div class="cover-card boot-card">
          <div class="masthead">
            <div class="kicker">蘭嶼達悟 · 島嶼文化探索 RPG</div>
            <h1 class="game-title"><span class="t-tao">Pongso no Tao</span><span class="t-bar">｜</span><span class="t-zh">蘭嶼文化島</span></h1>
          </div>
          <p class="lede">正在把島嶼、海色與手札準備好……</p>
          <div class="loading-bar"><i id="load-fill"></i></div>
          <p class="load-label" id="load-label"></p>
        </div>
      </div>
      <div class="overlay-screen is-cover" id="origin-screen" style="display:none">
        <div class="cover-card">
          <div class="masthead">
            <div class="kicker">手繪田野手札 · 圖鑑</div>
            <h1 class="game-title"><span class="t-tao">Pongso no Tao</span><span class="t-bar">｜</span><span class="t-zh">蘭嶼文化島</span></h1>
            <p class="subtitle">兩位族人同學放假回島，帶著一位朋友一起來。</p>
          </div>
          <p class="lede">隊伍固定三人：族男、族女，加上一位旅人。先選兩位族人的家鄉部落（主人家），再決定旅人來自哪裡、是男生還是女生。</p>
          <div class="origin-continue" id="origin-continue" hidden>
            <button type="button" class="btn-primary" id="btn-continue">繼續上次的旅程</button>
            <span class="oc-meta" id="continue-meta"></span>
          </div>
          <div class="pick-label">族人的家鄉部落</div>
          <div class="origin-grid" id="origin-grid"></div>
          <div class="gender-pick" id="gender-pick" role="radiogroup" aria-label="旅人是男生或女生">
            <span class="gp-label">旅人</span>
            <button type="button" class="gender-card selected" id="btn-gender-m" data-g="m" role="radio" aria-checked="true"><i class="gp-sprite" aria-hidden="true"></i><span class="gp-name">男生</span></button>
            <button type="button" class="gender-card" id="btn-gender-f" data-g="f" role="radio" aria-checked="false"><i class="gp-sprite" aria-hidden="true"></i><span class="gp-name">女生</span></button>
          </div>
          <div class="origin-actions">
            <button type="button" class="btn-primary" id="origin-go" disabled>踏上 Pongso no Tao</button>
          </div>
        </div>
        <p class="cover-foot">族語拼寫採教育部原住民族語言書寫系統；文化內容為教學原型，待部落審閱。</p>
      </div>
      <div class="hud-top" id="hud" style="display:none">
        <div class="hud-left">
          <div class="hud-brand" aria-hidden="true"><b>Pongso no Tao</b><span>蘭嶼文化島</span></div>
          <div class="chipbar" role="group" aria-label="時段與歲時">
            <div class="chip-row" id="time-chips" aria-label="時段"></div>
            <div class="chip-sep"></div>
            <div class="chip-row" id="season-chips" aria-label="歲時"></div>
          </div>
          <div class="party-row">
            <div class="party-bar" id="party-bar" role="group" aria-label="隊伍：點頭像切換操控的隊員"></div>
            <span class="tide-pill" id="tide-pill" hidden></span>
          </div>
          <div class="party-split" id="party-split" hidden>
            <span class="ps-text" id="ps-text"></span>
            <button type="button" class="ps-abort" id="btn-solo-abort" hidden>放棄出海</button>
          </div>
          <button type="button" class="quest-tracker" id="quest-tracker" hidden aria-label="打開任務頁">
            <span class="qt-line" id="qt-line"></span><span class="qt-name" id="qt-name"></span>
            <span class="qt-obj" id="qt-obj"></span><span class="qt-warn" id="qt-warn"></span>
          </button>
        </div>
        <div class="hud-right">
          <button type="button" class="journal-btn" id="btn-journal"><span class="ico">✎</span>圖鑑手札</button>
          <button class="icon-btn" id="btn-help" aria-label="操作說明">?</button>
        </div>
      </div>
      <div class="minimap" id="minimap" style="display:none" aria-label="島嶼地圖">
        <canvas id="minimap-canvas" width="200" height="256"></canvas>
        <div class="minimap-pins" id="minimap-pins"></div>
        <button type="button" class="minimap-badge" id="btn-travel">環島傳送</button>
      </div>
      <div class="travel-sheet" id="travel-sheet" style="display:none" role="dialog" aria-modal="true" aria-labelledby="travel-title">
        <header>
          <h3 id="travel-title">環島傳送</h3>
          <button type="button" class="close-x" id="travel-close" aria-label="關閉">×</button>
        </header>
        <p class="travel-lead">六大部落、開元港、衛生所、機場與青青草原，點一下即可前往。</p>
        <div class="travel-grid" id="travel-grid"></div>
      </div>
      <div class="help-toast" id="help-toast" style="display:none">
        <span class="help-toast-msg" id="help-toast-msg"></span>
        <button type="button" class="help-toast-close" id="help-toast-close" aria-label="關閉">×</button>
      </div>
      <div class="help-sheet-wrap" id="help-sheet" style="display:none">
        <div class="help-sheet" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <header>
            <h3 id="help-title">操作說明</h3>
            <button type="button" class="close-x" id="help-close" aria-label="關閉">×</button>
          </header>
          <div class="help-rows" id="help-rows"></div>
          <div class="text-size" id="text-size" role="radiogroup" aria-label="文字大小">
            <span class="ts-label">文字大小</span>
            <button type="button" data-ts="s" role="radio" aria-checked="false">小</button>
            <button type="button" data-ts="m" role="radio" aria-checked="true">中</button>
            <button type="button" data-ts="l" role="radio" aria-checked="false">大</button>
          </div>
        </div>
      </div>
      <button type="button" class="interact-prompt" id="interact-prompt"><kbd>E</kbd><span id="interact-label">交談</span><span class="prompt-go" aria-hidden="true">›</span></button>
      <div class="vpad" id="vpad" style="display:none"><div class="vpad-knob" id="vpad-knob"></div></div>
      <div class="cam-btns" id="cam-btns" style="display:none">
        <button type="button" class="cam-wide" id="btn-cam-toggle" aria-expanded="false" aria-controls="cam-drawer">視角</button>
        <div class="cam-drawer" id="cam-drawer">
          <div class="cam-row">
            <button type="button" id="cam-left" aria-label="左轉">↺</button>
            <button type="button" class="cam-wide" id="cam-reset">重置</button>
            <button type="button" id="cam-right" aria-label="右轉">↻</button>
          </div>
          <div class="cam-row">
            <button type="button" id="cam-in" aria-label="拉近">＋</button>
            <button type="button" id="cam-out" aria-label="拉遠">－</button>
          </div>
        </div>
        <button type="button" class="mode-toggle" id="btn-scooter" aria-pressed="false" aria-label="切換步行或機車">
          <span class="seg on" data-mode="walk">步行</span>
          <span class="seg" data-mode="scooter">機車</span>
        </button>
        <button type="button" class="act idle" id="btn-act" disabled>互動</button>
      </div>
      <div class="dialogue" id="dialogue" role="dialog" aria-modal="false" aria-labelledby="dlg-who" aria-describedby="dlg-zh">
        <figure class="dlg-portrait" id="dlg-portrait" aria-hidden="true"><img alt="" decoding="async" /></figure>
        <div class="dlg-body">
        <div class="who" id="dlg-who"></div>
        <div class="line-zh" id="dlg-zh"></div>
        <div class="line-tao" id="dlg-tao" lang="tao"></div>
        <div class="dialogue-bar">
          <div class="lang-toggle" id="lang-toggle">
            <button type="button" data-lang="both">雙語</button>
            <button type="button" data-lang="zh">僅繁中</button>
            <button type="button" data-lang="tao">僅族語</button>
          </div>
          <button type="button" class="next" id="dlg-next">繼續</button>
        </div>
        </div>
      </div>
      <div class="unlock-toast" id="unlock-toast" role="status" aria-live="polite"></div>
      <div class="journal-backdrop" id="journal-backdrop">
        <div class="journal notebook" id="journal" role="dialog" aria-modal="true" aria-labelledby="journal-title">
          <nav class="nb-ribbons" id="journal-tabs" aria-label="手札分頁">
            <button type="button" data-tab="quests" class="on r1">任務</button>
            <button type="button" data-tab="glossary" class="r2">族語</button>
            <button type="button" data-tab="food" class="r3">食材與營養</button>
            <button type="button" data-tab="album" class="r4">相簿與水下</button>
            <button type="button" data-tab="bag" class="r7">背包</button>
            <button type="button" data-tab="milestones" class="r5">成就</button>
            <button type="button" data-tab="save" class="r6">存檔</button>
          </nav>
          <div class="nb-spread">
            <section class="nb-page nb-left">
              <header class="nb-top">
                <h2 id="journal-title">圖鑑手札</h2>
              </header>
              <div class="nb-head" id="nb-head"></div>
              <div class="nb-list" id="nb-list"></div>
              <div class="nb-pager" id="nb-pager"></div>
            </section>
            <div class="nb-binding" aria-hidden="true"></div>
            <section class="nb-page nb-right">
              <button type="button" class="nb-back" id="nb-back" aria-label="回到清單">← 清單</button>
              <div class="nb-detail" id="nb-detail" aria-live="polite"></div>
            </section>
          </div>
          <button type="button" class="close-x nb-close" id="journal-close" aria-label="關閉">×</button>
          <div class="pages" id="journal-pages" hidden></div>
        </div>
      </div>
      <div class="minigame" id="minigame" role="dialog" aria-modal="true" aria-labelledby="mg-title" aria-describedby="mg-desc">
        <h3 id="mg-title"></h3>
        <p id="mg-desc"></p>
        <div class="timing-track" id="mg-track">
          <div class="timing-sweet" id="mg-sweet"></div>
          <div class="timing-needle" id="mg-needle"></div>
        </div>
        <button type="button" class="btn-primary go" id="mg-hit">把握時機</button>
      </div>
    `;
    this.bindStatic();
    this.setOverlayOpen(true);
  }

  private bindStatic(): void {
    this.bindActivate(this.el('#origin-go'), () => {
      if (!this.selected || !this.content) return;
      let id = this.selected;
      if (id === 'random') {
        const pool = this.content.origins.filter((o) => o.spawn && o.id !== 'visitor').map((o) => o.id);
        id = pool[Math.floor(Math.random() * pool.length)];
      }
      this.hooks.onOrigin(id as PlayableOrigin, this.gender);
    });
    for (const g of ['m', 'f'] as const) {
      this.bindActivate(this.el(`#btn-gender-${g}`), () => this.setGender(g));
    }
    this.refreshGenderPreview();
    this.bindActivate(this.el('#btn-continue'), () => this.hooks.onContinue());
    this.el('#quest-tracker').addEventListener('click', () => this.openJournalTab('quests'));

    const times = this.el('#time-chips');
    for (const p of PERIODS) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.id = `time-${p.id}`;
      b.type = 'button';
      const icon = document.createElement('i');
      icon.textContent = p.icon;
      b.append(icon, p.zh);
      b.title = p.zh;
      b.addEventListener('click', () => this.hooks.onPeriod(p.id));
      times.appendChild(b);
    }
    const seas = this.el('#season-chips');
    for (const s of SEASONS) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.id = `season-${s.id}`;
      b.type = 'button';
      const dot = document.createElement('i');
      dot.className = 'dot';
      b.append(dot, s.zh);
      b.title = s.tao ? `${s.zh} ${s.tao}` : s.zh;
      b.addEventListener('click', () => this.hooks.onSeason(s.id));
      seas.appendChild(b);
    }
    this.el('#btn-journal').addEventListener('click', () => this.hooks.onOverlay('journal', true));
    this.el('#journal-close').addEventListener('click', () => this.hooks.onOverlay('journal', false));
    this.el('#journal-backdrop').addEventListener('click', (e) => {
      if (e.target === this.el('#journal-backdrop')) this.hooks.onOverlay('journal', false);
    });
    this.el('#journal-tabs').addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).dataset.tab;
      if (!t) return;
      this.journalTab = t;
      this.el('#journal-tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === t));
      this.hooks.onJournalTab();
    });
    this.el('#btn-help').addEventListener('click', () => {
      this.dismissHelpToast();
      this.hooks.onOverlay('help', this.overlay !== 'help');
    });
    this.el('#help-toast-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissHelpToast();
    });
    this.el('#help-close').addEventListener('click', () => this.hooks.onOverlay('help', false));
    this.el('#help-sheet').addEventListener('click', (e) => {
      if (e.target === this.el('#help-sheet')) this.hooks.onOverlay('help', false);
    });
    this.el('#dlg-next').addEventListener('click', () => this.hooks.onDialogueNext());
    this.el('#text-size').addEventListener('click', (e) => {
      const ts = (e.target as HTMLElement).dataset.ts;
      if (ts === 's' || ts === 'm' || ts === 'l') this.setTextSize(ts, true);
    });
    this.setTextSize(readTextSize(), false);
    this.el('#lang-toggle').addEventListener('click', (e) => {
      const lang = (e.target as HTMLElement).dataset.lang as LangMode | undefined;
      if (lang) this.hooks.onLang(lang);
    });
    this.el('#btn-act').addEventListener('click', () => this.hooks.onInteract());
    this.el('#interact-prompt').addEventListener('click', () => this.hooks.onInteract());
    this.el('#btn-cam-toggle').addEventListener('click', () => this.setCamDrawer(!this.camDrawerOpen));
    const holdRotate = (btn: HTMLElement, dir: -1 | 1): void => {
      const stop = (): void => this.hooks.onCamBtn(0);
      btn.addEventListener('pointerdown', (e: PointerEvent) => {
        // capture so releasing outside the button still delivers pointerup here
        try { btn.setPointerCapture?.(e.pointerId); } catch { /* synthetic pointer */ }
        this.hooks.onCamBtn(dir);
      });
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointercancel', stop);
      btn.addEventListener('lostpointercapture', stop);
      btn.addEventListener('pointerleave', (e: PointerEvent) => {
        if (!btn.hasPointerCapture?.(e.pointerId)) stop();
      });
    };
    holdRotate(this.el('#cam-left'), -1);
    holdRotate(this.el('#cam-right'), 1);
    this.el('#cam-in').addEventListener('click', () => this.hooks.onZoom(-1));
    this.el('#cam-out').addEventListener('click', () => this.hooks.onZoom(1));
    this.el('#cam-reset').addEventListener('click', () => this.hooks.onCamReset());
    this.el('#btn-scooter').addEventListener('click', () => this.hooks.onScooter());
    this.el('#btn-solo-abort').addEventListener('click', () => this.hooks.onSoloAbort?.());
    this.el('#btn-travel').addEventListener('click', (e) => {
      e.stopPropagation();
      this.hooks.onOverlay('travel', true);
    });
    this.el('#minimap').addEventListener('click', () => this.hooks.onOverlay('travel', true));
    this.el('#travel-close').addEventListener('click', () => this.hooks.onOverlay('travel', false));
    this.el('#mg-hit').addEventListener('click', () => this.hooks.onMinigameHit());
    this.setupPad();
  }

  private setupPad(): void {
    const pad = this.el('#vpad');
    const knob = this.el('#vpad-knob');
    let pid: number | null = null;
    // the pad never moves while a finger is on it: measure once per touch, not per pointermove
    let c = { x: 0, y: 0, s: 1 };
    const measure = () => {
      const r = pad.getBoundingClientRect();
      c = { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width / 2 || 1 };
    };
    const apply = (cx: number, cy: number) => {
      let dx = (cx - c.x) / c.s;
      let dy = (cy - c.y) / c.s;
      const len = Math.hypot(dx, dy) || 1;
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      knob.style.left = `${36 + dx * 32}px`;
      knob.style.top = `${36 + dy * 32}px`;
      this.hooks.onPad(dx, dy, true);
    };
    const end = () => {
      pid = null;
      knob.style.left = '36px';
      knob.style.top = '36px';
      this.hooks.onPad(0, 0, false);
    };
    const down = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pid = e.pointerId;
      try { pad.setPointerCapture?.(e.pointerId); } catch { /* synthetic / iOS capture miss */ }
      measure();
      apply(e.clientX, e.clientY);
    };
    const move = (e: PointerEvent) => {
      if (pid !== e.pointerId) return;
      e.preventDefault();
      apply(e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => {
      if (pid !== null && e.pointerId !== pid) return;
      end();
    };
    pad.addEventListener('pointerdown', down);
    pad.addEventListener('pointermove', move);
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    pad.addEventListener('lostpointercapture', () => end());
  }

  /** click plus pointerup — iOS Safari sometimes drops click inside a scrollable overlay. */
  private bindActivate(el: HTMLElement, fn: () => void): void {
    let armed: { id: number; x: number; y: number } | null = null;
    let handledAt = 0;
    const run = () => {
      if ((el as HTMLButtonElement).disabled) return;
      const now = performance.now();
      if (now - handledAt < 400) return;
      handledAt = now;
      fn();
    };
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button && e.button !== 0) return;
      armed = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', (e: PointerEvent) => {
      if (!armed || armed.id !== e.pointerId) return;
      const dx = e.clientX - armed.x;
      const dy = e.clientY - armed.y;
      armed = null;
      if (Math.hypot(dx, dy) > 14) return;
      run();
    });
    el.addEventListener('pointercancel', () => { armed = null; });
    el.addEventListener('click', (e) => {
      e.preventDefault();
      run();
    });
  }

  /** Static UI nodes are built once in the constructor, so refs are cached (hot per-frame paths call this). */
  el(sel: string): HTMLElement {
    const hit = this.elCache.get(sel);
    if (hit && hit.isConnected) return hit;
    const n = this.root.querySelector(sel);
    if (!n) throw new Error(sel);
    this.elCache.set(sel, n as HTMLElement);
    return n as HTMLElement;
  }

  setLoad(p: number, label: string): void {
    this.el('#load-fill').style.width = `${Math.round(p * 100)}%`;
    this.el('#load-label').textContent = label;
  }

  setOverlayOpen(open: boolean): void {
    this.root.classList.toggle('overlay-open', open);
  }

  /** 男生／女生 toggle on the origin screen (radio-group semantics, previews follow the origin's outfit) */
  setGender(g: Gender): void {
    this.gender = g;
    for (const k of ['m', 'f'] as const) {
      const b = this.el(`#btn-gender-${k}`);
      b.classList.toggle('selected', k === g);
      b.setAttribute('aria-checked', k === g ? 'true' : 'false');
    }
  }

  /** 文字大小 小／中／大 → CSS variable --ts on <html>; saved in localStorage */
  setTextSize(ts: TextSize, save: boolean): void {
    document.documentElement.style.setProperty('--ts', String(TEXT_SCALE[ts]));
    document.documentElement.dataset.textSize = ts;
    this.el('#text-size').querySelectorAll('button').forEach((b) => {
      const on = b.dataset.ts === ts;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    if (save) {
      try { localStorage.setItem(TEXT_SIZE_KEY, ts); } catch { /* private mode: keep for this session only */ }
    }
  }

  private refreshGenderPreview(): void {
    const base = 'player_visitor';
    for (const k of ['m', 'f'] as const) {
      const sheet = k === 'f' ? `${base}_f` : base;
      const i = this.el(`#btn-gender-${k}`).querySelector('.gp-sprite') as HTMLElement;
      i.style.backgroundImage = `url(${assetUrl(`assets/sprites/characters/${sheet}_sheet.png`)})`;
    }
  }

  showOrigin(): void {
    this.setOverlayOpen(true);
    this.el('#boot-screen').style.display = 'none';
    const origin = this.el('#origin-screen');
    origin.style.display = 'flex';
    origin.scrollTop = 0;
  }

  hideOverlaysStart(): void {
    this.el('#boot-screen').style.display = 'none';
    this.el('#origin-screen').style.display = 'none';
    this.setOverlayOpen(false);
    this.el('#hud').style.display = 'flex';
    this.el('#vpad').style.display = 'block';
    document.documentElement.dataset.started = '1';
    this.el('#cam-btns').style.display = 'flex';
    this.el('#minimap').style.display = 'block';
    this.setCamDrawer(!this.isCompactUi());
    this.showHelp(true);
  }

  private isCompactUi(): boolean {
    return window.matchMedia('(max-width: 640px), (pointer: coarse)').matches || window.innerWidth <= 640;
  }

  setCamDrawer(open: boolean): void {
    this.camDrawerOpen = open;
    this.el('#cam-drawer').classList.toggle('is-open', open);
    this.el('#cam-drawer').classList.toggle('is-collapsed', !open);
    const toggle = this.el('#btn-cam-toggle');
    toggle.classList.toggle('on', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /** Build the copy-driven parts of the UI (origin cards, travel sheet, help copy) from ui.json. */
  setContent(content: UiContent): void {
    this.content = content;
    const grid = this.el('#origin-grid');
    grid.replaceChildren();
    for (const o of content.origins) {
      // the traveller is always in the party now: the grid picks the 族人 home village (or 隨機)
      if (o.id === 'visitor') continue;
      const b = document.createElement('button');
      b.className = 'origin-card';
      b.type = 'button';
      b.id = `btn-origin-${o.id}`;
      b.append(span('zh', o.zh), span('tao', o.tao), span('hint', o.hint));
      this.bindActivate(b, () => {
        this.selected = o.id;
        grid.querySelectorAll('.origin-card').forEach((c) => c.classList.remove('selected'));
        b.classList.add('selected');
        (this.el('#origin-go') as HTMLButtonElement).disabled = false;
        this.refreshGenderPreview();
      });
      grid.appendChild(b);
    }
    const gridEl = this.el('#travel-grid');
    gridEl.replaceChildren();
    for (const d of content.travel) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'travel-item';
      b.dataset.id = d.id;
      b.append(span('zh', d.zh));
      if (d.tao) b.append(span('tao', d.tao));
      b.addEventListener('click', () => this.hooks.onFastTravel(d.id));
      gridEl.appendChild(b);
    }
  }

  /** First-entry hint strip (auto = true); auto = false is the 「?」 button: toggle the help sheet. */
  showHelp(auto = false): void {
    if (auto) {
      this.hooks.onOverlay('help', false);
      const chips = this.isCompactUi() ? this.content?.help.toastTouch : this.content?.help.toastDesktop;
      this.el('#help-toast-msg').replaceChildren(...(chips ?? []).map((t) => span('k', t)));
      this.el('#help-toast').style.display = 'flex';
      this.armHelpToastDismiss();
      return;
    }
    this.dismissHelpToast();
    this.hooks.onOverlay('help', this.overlay !== 'help');
  }

  private fillHelpRows(): void {
    const rows = (this.isCompactUi() ? this.content?.help.touch : this.content?.help.desktop) ?? [];
    this.el('#help-rows').replaceChildren(
      ...rows.map((r) => {
        const sec = document.createElement('section');
        sec.className = 'help-row';
        const h = document.createElement('h4');
        h.textContent = r.title;
        const para = document.createElement('p');
        para.textContent = r.body;
        sec.append(h, para);
        return sec;
      }),
    );
  }

  /**
   * Draw the overlay Game says is open (null = none) and move focus into / out of it.
   * Only one overlay is shown at a time; the dialogue / mini-game are separate (see openDialogue).
   */
  renderOverlay(next: Overlay | null): void {
    const prev = this.overlay;
    if (prev === next) return;
    this.overlay = next;
    this.el('#journal-backdrop').classList.toggle('open', next === 'journal');
    this.el('#travel-sheet').style.display = next === 'travel' ? 'block' : 'none';
    if (next === 'help') this.fillHelpRows();
    this.el('#help-sheet').style.display = next === 'help' ? 'flex' : 'none';
    if (next) {
      if (!prev) this.rememberFocus();
      const first = next === 'journal' ? '#journal-close' : next === 'travel' ? '#travel-close' : '#help-close';
      this.focusIn(first);
    } else {
      this.restoreFocus();
    }
  }

  /** Called on any key press: the first-entry hint goes away like any other key hint. */
  onAnyKey(): void {
    if (this.helpTimer !== null) this.dismissHelpToast();
  }

  private rememberFocus(): void {
    const a = document.activeElement as HTMLElement | null;
    // never "return" focus into a layer that is about to close
    this.returnFocus = a && a !== document.body && !a.closest?.('#dialogue, #minigame, #journal-backdrop, #travel-sheet, #help-sheet') ? a : null;
  }

  private focusIn(sel: string): void {
    try { this.el(sel).focus({ preventScroll: true }); } catch { /* element hidden */ }
  }

  /** Put focus back where it was, or drop it, so Enter / Space never hit a hidden button. */
  private restoreFocus(): void {
    const back = this.returnFocus;
    this.returnFocus = null;
    const a = document.activeElement as HTMLElement | null;
    if (back && back.isConnected && getComputedStyle(back).display !== 'none') back.focus({ preventScroll: true });
    else if (a && a !== document.body) a.blur();
  }

  private armHelpToastDismiss(): void {
    this.disarmHelpToastDismiss();
    this.helpTimer = window.setTimeout(() => this.dismissHelpToast(), 4500);
    // key presses reach onAnyKey() through Input (single keyboard pipeline); pointers are handled here
    const onPointer = (e: Event): void => {
      const node = e.target as HTMLElement | null;
      if (node?.closest?.('#help-toast, #help-sheet, #btn-help, #hud, #cam-btns, #minimap, #travel-sheet, #dialogue, #journal-backdrop, .overlay-screen, #interact-prompt')) return;
      this.dismissHelpToast();
    };
    window.addEventListener('pointerdown', onPointer);
    this.helpUnbind = () => {
      window.removeEventListener('pointerdown', onPointer);
    };
  }

  private disarmHelpToastDismiss(): void {
    if (this.helpTimer !== null) {
      window.clearTimeout(this.helpTimer);
      this.helpTimer = null;
    }
    if (this.helpUnbind) {
      this.helpUnbind();
      this.helpUnbind = null;
    }
  }

  dismissHelpToast(): void {
    this.disarmHelpToastDismiss();
    this.el('#help-toast').style.display = 'none';
  }

  syncChips(period: Period, season: Season, lang: LangMode): void {
    PERIODS.forEach((p) => this.el(`#time-${p.id}`).classList.toggle('on', p.id === period));
    SEASONS.forEach((s) => this.el(`#season-${s.id}`).classList.toggle('on', s.id === season));
    this.el('#lang-toggle').querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', (b as HTMLElement).dataset.lang === lang);
    });
  }

  setPrompt(text: string | null): void {
    if (text === this.promptText) return;
    this.promptText = text;
    const el = this.el('#interact-prompt');
    const act = this.el('#btn-act') as HTMLButtonElement;
    if (text) {
      this.el('#interact-label').textContent = text;
      el.classList.add('show');
      act.disabled = false;
      act.classList.add('ready');
      act.classList.remove('idle');
    } else {
      el.classList.remove('show');
      act.disabled = true;
      act.classList.add('idle');
      act.classList.remove('ready');
    }
  }

  openDialogue(who: string, zh: string, tao: string, lang: LangMode, last: boolean, portrait?: string): void {
    const box = this.el('#dialogue');
    const wasOpen = box.classList.contains('open');
    box.classList.add('open');
    const fig = this.el('#dlg-portrait');
    const img = fig.querySelector('img') as HTMLImageElement;
    if (portrait) {
      const src = assetUrl(`assets/portraits/${portrait}.webp`);
      // portraits load on demand; a missing one (new data-only NPC without art yet) just hides the frame
      img.onerror = () => box.classList.remove('has-portrait');
      if (img.getAttribute('src') !== src) {
        img.setAttribute('src', src);
        fig.classList.remove('pop');
        void fig.offsetWidth; // restart the little entrance bounce
        fig.classList.add('pop');
      }
    }
    box.classList.toggle('has-portrait', !!portrait);
    this.el('#dlg-who').textContent = who;
    this.el('#dlg-zh').textContent = zh;
    this.el('#dlg-tao').textContent = taoText(tao);
    // always keep at least one line visible: fall back to 繁中 if the Tao line is empty
    const taoEmpty = !tao.trim();
    this.el('#dlg-zh').classList.toggle('hidden', lang === 'tao' && !taoEmpty);
    this.el('#dlg-tao').classList.toggle('hidden', lang === 'zh' || taoEmpty);
    this.el('#dlg-next').textContent = last ? '結束對話' : '繼續';
    if (!wasOpen && !this.overlay) {
      this.rememberFocus();
      this.focusIn('#dlg-next');
    }
  }

  closeDialogue(): void {
    const box = this.el('#dialogue');
    if (!box.classList.contains('open')) return;
    box.classList.remove('open');
    if (box.contains(document.activeElement)) this.restoreFocus();
  }

  private toastQ: [string, string][] = [];
  /** queued: several toasts in a row (quest done + new quests) each get their moment */
  toast(title: string, body: string): void {
    if (this.toastTimer !== null) {
      if (this.toastQ.length < 4) this.toastQ.push([title, body]);
      return;
    }
    this.showToast(title, body);
  }

  /** camera-shutter flash (photo quests) */
  flash(): void {
    const f = document.createElement('div');
    f.className = 'shutter-flash';
    this.root.append(f);
    window.setTimeout(() => f.remove(), 420);
  }

  private showToast(title: string, body: string): void {
    const el = this.el('#unlock-toast');
    const b = document.createElement('b');
    b.textContent = title;
    el.replaceChildren(b, body);
    el.classList.add('show');
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastTimer = null;
      el.classList.remove('show');
      const next = this.toastQ.shift();
      if (next) window.setTimeout(() => this.showToast(next[0], next[1]), 160);
    }, this.toastQ.length ? 2200 : 3000);
  }

  private nbInst: Notebook | null = null;
  private get nb(): Notebook {
    if (!this.nbInst) this.nbInst = new Notebook(this.el('#nb-list'), this.el('#nb-head'), this.el('#nb-detail'), this.el('#journal'), this.el('#nb-pager'));
    return this.nbInst;
  }
  private filtersOpen = false;

  /** 圖鑑手札 (notebook): left page = short list, right page = the selected item (see ui/notebook.ts) */
  renderJournal(state: GameState, data: {
    glossary: GlossaryEntry[];
    ingredients: ItemDef[];
    recipes: RecipeDef[];
    milestones: MilestoneEntry[];
  }): void {
    let tab = this.journalTab;
    if (tab === 'recipes' || tab === 'clinic') tab = this.journalTab = 'food';
    const lockedNote = '在島上向族人請教、下田或走進衛生所後，就會記錄在這裡。';
    const lockedDetail = (box: HTMLElement): void => {
      nbTitle(box, '', '？？？');
      box.append(h('p', 'nd-body muted', lockedNote));
    };
    if (tab === 'quests') {
      this.renderQuests(this.lastQuests);
      return;
    }
    if (tab === 'glossary') {
      const got = data.glossary.filter((e) => state.glossary.has(e.id)).length;
      this.nb.show(tab, {
        heading: '族語詞卡',
        sub: `記下 ${got} / ${data.glossary.length} 個詞`,
        items: data.glossary.map((e) => {
          const have = state.glossary.has(e.id);
          return {
            key: e.id,
            title: e.zh,
            tao: taoText(e.tao),
            mark: have ? 'done' : 'locked',
            render: (box) => {
              if (!have) return lockedDetail(box);
              nbTitle(box, `族語詞卡${e.category ? `｜${e.category}` : ''}`, taoText(e.tao));
              box.append(h('div', 'nd-zh', e.zh), h('p', 'nd-body', e.detail));
              const src = (e as GlossaryEntry & { source?: string }).source;
              if (src) box.append(nbSource(src));
            },
          };
        }),
      });
      return;
    }
    if (tab === 'food') {
      const items: NbItem[] = [];
      for (const e of data.ingredients) {
        const have = state.ingredients.has(e.id);
        items.push({
          key: `i:${e.id}`, title: e.name.zh, tao: taoText(e.name.tao), mark: have ? 'done' : 'locked',
          render: (box) => {
            if (!have) return lockedDetail(box);
            nbTitle(box, '傳統食材', e.name.zh, taoText(e.name.tao));
            box.append(h('div', 'nd-label', '營養'), h('p', 'nd-body', e.nutrition ?? ''));
          },
        });
      }
      for (const e of data.recipes) {
        const have = state.recipes.has(e.id);
        items.push({
          key: `r:${e.id}`, title: e.name.zh, tao: taoText(e.name.tao), mark: have ? 'done' : 'locked',
          render: (box) => {
            if (!have) return lockedDetail(box);
            nbTitle(box, e.clinicNote ? '傳統食譜｜衛生所筆記' : '傳統食譜', e.name.zh, taoText(e.name.tao));
            box.append(h('p', 'nd-body', e.steps));
            box.append(nbMore(e.clinicNote ? '營養與健康（衛生所筆記）' : '營養', [h('p', 'nd-body', e.nutrition)]));
          },
        });
      }
      const got = items.filter((i) => i.mark !== 'locked').length;
      this.nb.show(tab, { heading: '食材與營養', sub: `記下 ${got} / ${items.length} 頁`, items });
      return;
    }
    if (tab === 'bag') {
      if (this.codexVM) this.nb.show(tab, codexPage(this.codexVM()));
      return;
    }
    if (tab === 'milestones') {
      const list = data.milestones.filter((m) => !m.hidden || state.milestones.has(m.id));
      this.nb.show(tab, {
        heading: '成就',
        sub: `達成 ${list.filter((m) => state.milestones.has(m.id)).length} / ${list.length}`,
        items: list.map((m) => {
          const have = state.milestones.has(m.id);
          return {
            key: m.id, title: m.zh, mark: have ? 'done' : 'locked',
            render: (box) => {
              if (!have) return lockedDetail(box);
              nbTitle(box, '成就', m.zh, m.tao ? taoText(m.tao) : undefined);
              box.append(h('p', 'nd-body', m.detail));
            },
          };
        }),
      });
      return;
    }
    if (tab === 'album' || tab === 'save') {
      // batch 1b renderers draw sections; each section becomes one notebook item
      const tmp = document.createElement('div');
      this.tabRenderers[tab]?.(tmp);
      const secs = [...tmp.querySelectorAll<HTMLElement>(tab === 'album' ? '.album-sec' : '.save-sec')];
      const note = tab === 'save' ? tmp.querySelector<HTMLElement>('.save-warn') : null;
      const items: NbItem[] = secs.map((sec, i) => {
        const title = sec.querySelector('h3')?.textContent ?? `第 ${i + 1} 頁`;
        const missing = tab === 'album' && /（0\//.test(title);
        return {
          key: `${tab}:${i}`,
          title: title.replace(/（\d+\/\d+）$/, ''),
          tao: tab === 'album' ? (title.match(/（\d+\/\d+）$/)?.[0].slice(1, -1) ?? '') : undefined,
          mark: tab === 'album' ? (missing ? 'none' : 'done') : 'none',
          render: (box) => {
            nbTitle(box, tab === 'album' ? `相簿與水下${title.match(/（\d+\/\d+）$/)?.[0] ?? ''}` : '存檔', title.replace(/（\d+\/\d+）$/, ''));
            box.append(sec);
          },
        };
      });
      this.nb.show(tab, {
        heading: tab === 'album' ? '相簿與水下' : '存檔',
        sub: tab === 'album' ? '照片、水下美景與活動歌謠' : '匯出備份，或在別台裝置匯入',
        note,
        items,
      });
      return;
    }
  }

  /** open the journal straight on a tab (quest tracker, L key) */
  openJournalTab(tab: string): void {
    this.journalTab = tab;
    this.el('#journal-tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === tab));
    this.hooks.onOverlay('journal', true);
    this.hooks.onJournalTab();
  }

  get currentJournalTab(): string {
    return this.journalTab;
  }

  setQuests(list: QuestCardVM[]): void {
    this.lastQuests = list;
    if (this.overlay === 'journal' && this.journalTab === 'quests') this.renderQuests(list);
  }

  /** 任務 page: short list (title + status mark); filters tucked behind 篩選; details on the right page */
  private renderQuests(list: QuestCardVM[]): void {
    const counts = { active: 0, done: 0, locked: 0 };
    for (const q of list) counts[q.status]++;
    const order = { active: 0, done: 1, locked: 2 } as const;
    const shown = list
      .filter((q) => (this.questFilter === 'all' || q.status === this.questFilter) && (this.questLine === 'all' || q.line === this.questLine))
      .map((q, i) => ({ q, i }))
      .sort((a, b) => Number(b.q.tracked) - Number(a.q.tracked) || order[a.q.status] - order[b.q.status] || a.i - b.i)
      .map((x) => x.q);
    const lineZh: Record<string, string> = { main: '主線', side: '支線', photo: '相簿水下' };
    // tucked-away filters
    const tools = h('div', `nb-tools${this.filtersOpen ? ' open' : ''}`);
    const tg = h('button', 'nb-filter-btn', this.filtersOpen ? '收起篩選' : '篩選') as HTMLButtonElement;
    tg.type = 'button';
    tg.addEventListener('click', () => {
      this.filtersOpen = !this.filtersOpen;
      this.renderQuests(this.lastQuests);
    });
    const legend = h('span', 'nb-legend', '● 進行中　✓ 完成　？？？ 未解鎖');
    tools.append(legend, tg);
    if (this.filtersOpen) {
      const seg = h('div', 'qf-seg');
      const labels = { all: '全部', active: '進行中', done: '已完成', locked: '未解鎖' } as const;
      for (const k of ['all', 'active', 'done', 'locked'] as const) {
        const b = h('button', `qf ${this.questFilter === k ? 'on' : ''}`, labels[k]) as HTMLButtonElement;
        b.type = 'button';
        b.dataset.qf = k;
        b.addEventListener('click', () => {
          this.questFilter = k;
          this.nb.resetPage('quests');
          this.renderQuests(this.lastQuests);
        });
        seg.append(b);
      }
      const lines = h('div', 'qf-lines');
      const lineLabels: Record<string, string> = { all: '全部', main: '主線', side: '支線', photo: '相簿與水下' };
      for (const k of ['all', 'main', 'side', 'photo'] as const) {
        const b = h('button', `ql ${this.questLine === k ? 'on' : ''}`, lineLabels[k]) as HTMLButtonElement;
        b.type = 'button';
        b.dataset.ql = k;
        b.addEventListener('click', () => {
          this.questLine = k;
          this.nb.resetPage('quests');
          this.renderQuests(this.lastQuests);
        });
        lines.append(b);
      }
      tools.append(seg, lines);
    }
    const cur = list.find((q) => q.tracked) ?? list.find((q) => q.status === 'active');
    this.nb.show('quests', {
      heading: '任務',
      sub: `進行中 ${counts.active}・完成 ${counts.done}・未解鎖 ${counts.locked}`,
      items: shown.map((q) => ({
        key: q.id,
        title: q.name,
        mark: q.status,
        tracked: q.tracked,
        data: { qid: q.id, line: q.line },
        render: (box) => this.questDetail(box, q, lineZh[q.line]),
      })),
      tools,
      preferKey: cur?.id,
      empty: this.questFilter === 'done' ? '還沒有完成的任務。' : this.questFilter === 'locked' ? '沒有未解鎖的任務。' : '目前沒有任務。',
    });
  }

  private questDetail(box: HTMLElement, q: QuestCardVM, lineZh: string): void {
    box.dataset.qid = q.id;
    if (q.status === 'locked') {
      nbTitle(box, lineZh, '？？？');
      box.append(h('p', 'nd-body muted', '條件還沒達成。繼續在島上走走、和族人聊聊吧。'));
      return;
    }
    nbTitle(box, `${lineZh}｜${q.id}${q.status === 'done' ? '｜✓ 完成' : ''}`, q.name);
    const chips = h('div', 'nd-chips');
    for (const r of q.roles) chips.append(h('span', 'qc-role', r));
    if (q.coop) chips.append(h('span', 'qc-coop', q.coop));
    if (q.ground) chips.append(h('span', `qc-ground g-${q.ground.startsWith('漁場') ? 'fish' : 'dive'}`, q.ground));
    if (q.giver) chips.append(h('span', `qc-giver g-${q.giver.startsWith('女') ? 'f' : 'm'}`, q.giver));
    box.append(chips);
    if (q.status === 'active') {
      box.append(h('div', 'nd-label', '目標'), h('p', 'nd-body nd-obj', q.objective + (q.progress ? `（${q.progress}）` : '')));
      for (const b of q.blocks) box.append(h('p', 'nd-block', b));
      if (q.placeholder) box.append(h('p', 'nd-tbd', '內容待後續版本'));
      if (q.hint) {
        box.append(h('div', 'nd-label', '提示'), h('p', 'nd-body nd-hint', q.hint.text));
        const more: HTMLElement[] = [];
        const tierZh = q.hint.tier === 'direct' ? '直接提示' : q.hint.tier === 'vague' ? '模糊提示' : '族語提示';
        more.push(h('p', 'nd-body muted', `${tierZh}｜${q.hint.from}`));
        if (q.hint.tao) {
          const t = h('p', 'nd-tao', q.hint.tao);
          t.lang = 'tao';
          more.push(t);
        }
        box.append(nbMore('更多提示', more));
      }
    } else {
      box.append(h('p', 'nd-body muted', `已完成：${q.objective}`));
    }
    if (q.song) box.append(songBlock(q.song));
    if (q.status === 'active' && !q.placeholder) {
      const tb = h('button', `qc-track nd-track${q.tracked ? ' on' : ''}`, q.tracked ? '✓ 追蹤中' : '在畫面上追蹤') as HTMLButtonElement;
      tb.type = 'button';
      tb.addEventListener('click', () => this.onTrack?.(q.id));
      box.append(tb);
    }
  }

  /** HUD party bar (三個頭像) */
  setParty(list: PartyChipVM[]): void {
    const bar = this.el('#party-bar');
    if (bar.childElementCount !== list.length) {
      bar.replaceChildren(
        ...list.map((m) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'pm';
          b.dataset.role = m.role;
          const img = document.createElement('img');
          img.alt = '';
          img.decoding = 'async';
          b.append(img, span('pm-name', ''), span('pm-st', ''));
          b.addEventListener('click', () => this.hooks.onSwitch(m.role));
          return b;
        }),
      );
    }
    list.forEach((m, i) => {
      const b = bar.children[i] as HTMLElement;
      b.dataset.role = m.role;
      const img = b.querySelector('img') as HTMLImageElement;
      const src = assetUrl(`assets/portraits/${m.portrait}.webp`);
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      (b.querySelector('.pm-name') as HTMLElement).textContent = m.label;
      b.classList.toggle('on', m.active);
      b.classList.toggle('away', !!m.away);
      b.classList.toggle('locked', !!m.locked);
      (b.querySelector('.pm-st') as HTMLElement).textContent = m.away ? (m.status ?? '') : '';
      b.title = m.status ?? '';
      b.setAttribute('aria-pressed', m.active ? 'true' : 'false');
      b.setAttribute('aria-label', `${m.active ? '目前操控：' : '切換到'}${m.label}${m.status ? `（${m.status}）` : ''}`);
    });
  }

  /** party split banner: who is where, regroup point, and the 放棄出海 button while a solo trip runs */
  setSplit(text: string | null, canAbort: boolean): void {
    const box = this.el('#party-split');
    box.hidden = !text;
    if (text) this.el('#ps-text').textContent = text;
    this.el('#btn-solo-abort').hidden = !canAbort;
  }

  setTide(text: string | null): void {
    const el = this.el('#tide-pill');
    el.hidden = !text;
    if (text) el.textContent = text;
  }

  private trackerKey = '';
  setTracker(vm: TrackerVM | null): void {
    const key = vm ? `${vm.line}|${vm.name}|${vm.objective}|${vm.warn}` : '';
    if (key === this.trackerKey) return;
    this.trackerKey = key;
    const el = this.el('#quest-tracker');
    el.hidden = !vm;
    if (!vm) return;
    this.el('#qt-line').textContent = vm.line;
    this.el('#qt-name').textContent = vm.name;
    this.el('#qt-obj').textContent = vm.objective;
    const w = this.el('#qt-warn');
    w.textContent = vm.warn;
    w.hidden = !vm.warn;
  }

  showContinue(meta: string | null): void {
    this.el('#origin-continue').hidden = meta === null;
    this.el('#continue-meta').textContent = meta ?? '';
  }

  openMinigame(title: string, desc: string): void {
    this.el('#minigame').classList.add('open');
    this.el('#mg-title').textContent = title;
    this.el('#mg-desc').textContent = desc;
    if (!this.overlay) {
      this.rememberFocus();
      this.focusIn('#mg-hit');
    }
  }
  closeMinigame(): void {
    const box = this.el('#minigame');
    if (!box.classList.contains('open')) return;
    box.classList.remove('open');
    if (box.contains(document.activeElement)) this.restoreFocus();
  }
  setNeedle(t: number, sweet0: number, sweet1: number): void {
    this.el('#mg-needle').style.left = `${t * 100}%`;
    const s = this.el('#mg-sweet');
    s.style.left = `${sweet0 * 100}%`;
    s.style.width = `${(sweet1 - sweet0) * 100}%`;
  }

  setScooter(on: boolean): void {
    const b = this.el('#btn-scooter');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.querySelectorAll('.seg').forEach((seg) => {
      const mode = (seg as HTMLElement).dataset.mode;
      seg.classList.toggle('on', on ? mode === 'scooter' : mode === 'walk');
    });
  }

  private minimapBase: HTMLCanvasElement | null = null;

  bakeMinimap(painter: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): void {
    const c = this.el('#minimap-canvas') as HTMLCanvasElement;
    const base = document.createElement('canvas');
    base.width = c.width;
    base.height = c.height;
    painter(base.getContext('2d')!, base.width, base.height);
    this.minimapBase = base;
    this.mmLast = { x: NaN, z: NaN, yaw: NaN };
    c.getContext('2d')!.drawImage(base, 0, 0);
  }

  updateMinimap(x: number, z: number, yaw: number): void {
    const wrap = this.el('#minimap');
    if (wrap.style.display === 'none') return;
    // only redraw when the arrow actually moved or turned
    const m = this.mmLast;
    if (Math.abs(x - m.x) < 0.02 && Math.abs(z - m.z) < 0.02 && Math.abs(yaw - m.yaw) < 0.004) return;
    m.x = x;
    m.z = z;
    m.yaw = yaw;
    const c = this.el('#minimap-canvas') as HTMLCanvasElement;
    const ctx = c.getContext('2d')!;
    if (this.minimapBase) ctx.drawImage(this.minimapBase, 0, 0);
    const { xMin, zMin, xMax, zMax } = TERRAIN_BOX;
    const px = ((x - xMin) / (xMax - xMin)) * c.width;
    const py = ((z - zMin) / (zMax - zMin)) * c.height;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(yaw);
    ctx.fillStyle = '#b33a32';
    ctx.strokeStyle = '#fffaf0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function span(cls: string, text: string): HTMLSpanElement {
  const e = document.createElement('span');
  e.className = cls;
  e.textContent = text;
  return e;
}


/** Tao orthography: the glottal-stop letter is ’ (U+2019), never a straight ASCII apostrophe. */
export function taoText(s: string): string {
  return s.replace(/[\u0027\u02BC]/g, '\u2019');
}

/** 活動歌謠: first line as text + ⓘ source toggle (no audio yet) */
export function songBlock(sg: { title: string; tao: string; zh: string; source: string }): HTMLElement {
  const box = document.createElement('div');
  box.className = 'song-block';
  const head = document.createElement('div');
  head.className = 'sb-head';
  const t = document.createElement('span');
  t.className = 'sb-title';
  t.textContent = `♪ 活動歌謠｜${sg.title}`;
  const info = document.createElement('button');
  info.type = 'button';
  info.className = 'sb-info';
  info.textContent = 'ⓘ';
  info.setAttribute('aria-label', '歌謠來源');
  head.append(t, info);
  const tao = document.createElement('div');
  tao.className = 'sb-tao';
  tao.lang = 'tao';
  tao.textContent = sg.tao;
  const zh = document.createElement('div');
  zh.className = 'sb-zh';
  zh.textContent = `大意：${sg.zh}`;
  const src = document.createElement('div');
  src.className = 'sb-src';
  src.textContent = sg.source;
  src.hidden = true;
  info.addEventListener('click', (e) => {
    e.stopPropagation();
    src.hidden = !src.hidden;
  });
  box.append(head, tao, zh, src);
  return box;
}
