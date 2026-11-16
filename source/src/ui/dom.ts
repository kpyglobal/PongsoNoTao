import { Typewriter } from './typewriter';
import { sfxShutter } from '../systems/audio/sfx';
import { menuSfx } from './menuSound';
import { assetUrl } from '../core/paths';
import type { Gender, GameState, LangMode } from '../core/state';
import { PERIODS, SEASONS, type Period, type Season } from '../core/timeSeason';
import type { GlossaryEntry, MilestoneEntry, PlayableOrigin, UiContent } from '../core/content';
import type { ItemDef, RecipeDef } from '../content/types';
import { codexCells, type CodexVM } from './codex';
import { ItemGrid } from './itemGrid';
import { fxOn, zoomButton } from './fly';
import { TERRAIN_BOX } from '../world/height';
import { Notebook, h, nbTitle, nbMore, nbSource, type NbItem } from './notebook';
import { onLangPick, syncLangToggles } from './lang';
import { english, isBi } from './i18n';

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
  /** 0.1.5: 族男's village (= the 主人家), 族女's village, traveller 男生／女生 */
  onOrigin: (id: PlayableOrigin, idF: PlayableOrigin, gender: Gender) => void;
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
  /** 0.1.4 arrival screen: 搭飛機 or 搭船 picked */
  onArrival: (way: 'plane' | 'boat') => void;
  /** 0.1.4 arrival screen: back to the party screen */
  onArrivalBack: () => void;
  /** 0.1.4 arrival cut-scene: skip (tap / key) */
  onArrivalSkip: () => void;
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


/** last button activated by a pointer (ghost-click guard in bindActivate) */
let lastPointerActivate: { at: number; el: HTMLElement | null } = { at: 0, el: null };

export class UI {
  root: HTMLElement;
  hooks!: UiHooks;
  /** 0.1.5: each Tao member's village on the party screen (default 隨機) */
  private selM: UiContent['origins'][number]['id'] = 'random';
  private selF: UiContent['origins'][number]['id'] = 'random';
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
    document.documentElement.classList.toggle('fx', fxOn());
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
      <div class="overlay-screen is-cover is-title" id="title-screen" style="display:none">
        <div class="title-block">
          <div class="masthead">
            <div class="kicker">蘭嶼達悟 · 島嶼文化探索 RPG</div>
            <h1 class="game-title"><span class="t-tao">Pongso no Tao</span><span class="t-bar">｜</span><span class="t-zh">蘭嶼文化島</span></h1>
          </div>
          <button type="button" class="btn-primary title-start" id="btn-title-start">點一下開始</button>
          <p class="title-note">會播放音樂，可以在遊戲裡按 ♪ 調整音量。</p>
        </div>
        <p class="cover-foot">族語拼寫採教育部原住民族語言書寫系統；文化內容為教學原型，待部落審閱。<span class="app-ver" id="app-ver">　版本 ${__APP_VERSION__}</span></p>
      </div>
      <div class="overlay-screen is-cover" id="arrival-screen" style="display:none">
        <div class="cover-card arrival-card">
          <div class="masthead">
            <div class="kicker">出發</div>
            <h1 class="game-title"><span class="t-tao">Pongso no Tao</span><span class="t-bar">｜</span><span class="t-zh">蘭嶼文化島</span></h1>
            <p class="subtitle" id="arrival-q">要怎麼前往蘭嶼？</p>
          </div>
          <div class="arrival-grid" role="group" aria-labelledby="arrival-q">
            <button type="button" class="arrival-pick" id="btn-arrive-plane" data-way="plane">
              <span class="ap-ico" aria-hidden="true"><svg viewBox="0 0 48 32" width="48" height="32"><path d="M4 18h30l8-6h3l-4 7 4 1-1 2H6z" fill="currentColor" opacity=".18"/><path d="M4 18h30l8-6h3l-4 7m0 0 4 1-1 2H6l-2-4zM14 18l4-8h4l-2 8M15 21l3 6h4l-1-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></span>
              <span class="ap-name">搭飛機</span>
              <span class="ap-hint">從臺東搭小飛機，降落在島西岸的蘭嶼機場。</span>
            </button>
            <button type="button" class="arrival-pick" id="btn-arrive-boat" data-way="boat">
              <span class="ap-ico" aria-hidden="true"><svg viewBox="0 0 48 32" width="48" height="32"><path d="M5 20h38l-5 7H10z" fill="currentColor" opacity=".18"/><path d="M5 20h38l-5 7H10zM12 20v-6h22v6M16 14v-4h12v4M30 10V6h3v4M2 30q4-2 8 0t8 0 8 0 8 0 8 0 6 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></span>
              <span class="ap-name">搭船</span>
              <span class="ap-hint">從臺東出海，搭一艘小遊艇乘風破浪，駛進開元港。</span>
            </button>
          </div>
          <div class="arrival-actions">
            <button type="button" class="btn-ghost" id="btn-arrive-back">← 回上一步</button>
          </div>
        </div>
      </div>
      <div class="arrival-fade" id="arrival-fade" aria-hidden="true"></div>
      <div class="arrival-intro" id="arrival-intro" style="display:none" role="dialog" aria-label="抵達蘭嶼的開場動畫">
        <div class="ai-wash" id="ai-wash"></div>
        <div class="ai-bar ai-top"></div>
        <div class="ai-bar ai-bottom"></div>
        <div class="ai-logo" aria-hidden="true"><b>Pongso no Tao</b><span>蘭嶼文化島</span></div>
        <p class="ai-caption" id="ai-caption"></p>
        <button type="button" class="ai-skip" id="btn-arrival-skip">點一下或按任意鍵略過 ›</button>
        <div class="ai-progress" aria-hidden="true"><i id="ai-progress"></i></div>
        <div class="ai-load" id="ai-load" role="status" aria-live="polite"><span id="ai-load-label">正在載入島嶼……</span><div class="ai-load-track"><i id="ai-load-fill"></i></div></div>
      </div>
      <div class="overlay-screen is-cover" id="origin-screen" style="display:none">
        <div class="cover-card">
          <div class="masthead">
            <div class="kicker">手繪田野手札 · 圖鑑</div>
            <h1 class="game-title"><span class="t-tao">Pongso no Tao</span><span class="t-bar">｜</span><span class="t-zh">蘭嶼文化島</span></h1>
            <p class="subtitle">兩位族人同學放假回島，帶著一位朋友一起來。</p>
          </div>
          <div class="origin-continue" id="origin-continue" hidden>
            <button type="button" class="btn-primary" id="btn-continue">繼續上次的旅程</button>
            <span class="oc-meta" id="continue-meta"></span>
          </div>
          <p class="lede cs-lede">三個人一起旅行，各有各的目的。</p>
          <div class="cs-party" id="cs-party">
            <div class="cs-member" id="cs-member-m">
              <figure class="cs-face" aria-hidden="true"><img alt="" decoding="async" /></figure>
              <b class="cs-name">族男</b>
              <span class="cs-goal">回家學造船、出海</span>
              <label class="cs-tribe"><span class="cs-tribe-k">部落</span><select id="sel-origin-m" aria-label="族男的部落"></select></label>
            </div>
            <div class="cs-member" id="cs-member-f">
              <figure class="cs-face" aria-hidden="true"><img alt="" decoding="async" /></figure>
              <b class="cs-name">族女</b>
              <span class="cs-goal">回家學芋田、織布</span>
              <label class="cs-tribe"><span class="cs-tribe-k">部落</span><select id="sel-origin-f" aria-label="族女的部落"></select></label>
            </div>
            <div class="cs-member is-pick">
              <button type="button" class="cs-face cs-face-btn" id="cs-traveller" aria-label="旅人：點一下換男生或女生"><img alt="" decoding="async" /><i class="cs-swap" aria-hidden="true">⇄</i></button>
              <b class="cs-name">旅人</b>
              <span class="cs-goal">第一次來，跟著學</span>
              <div class="gender-pick cs-gender" id="gender-pick" role="radiogroup" aria-label="旅人是男生或女生">
                <button type="button" class="gender-card selected" id="btn-gender-m" data-g="m" role="radio" aria-checked="true"><span class="gp-name">男生</span></button>
                <button type="button" class="gender-card" id="btn-gender-f" data-g="f" role="radio" aria-checked="false"><span class="gp-name">女生</span></button>
              </div>
            </div>
          </div>
          <p class="cs-note" id="cs-note">大家住在族男的家（主人家）。</p>
          <div class="origin-actions">
            <button type="button" class="btn-primary" id="origin-go">踏上 Pongso no Tao</button>
          </div>
        </div>
        <p class="cover-foot">族語拼寫採教育部原住民族語言書寫系統；文化內容為教學原型，待部落審閱。　版本 ${__APP_VERSION__}</p>
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
        <p class="travel-lead">點地圖上的地點就能前往：六大部落、開元港、機場、衛生所與青青草原。</p>
        <div class="travel-map" id="travel-map">
          <canvas id="travel-canvas" width="4" height="4" aria-hidden="true"></canvas>
          <div class="travel-you" id="travel-you" aria-hidden="true"></div>
        </div>
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
        <div class="line-en hidden" id="dlg-en" lang="en"></div>
        <div class="line-tao" id="dlg-tao" lang="tao"></div>
        <div class="dialogue-bar">
          <button type="button" class="next" id="dlg-next">繼續</button>
        </div>
        </div>
      </div>
      <div class="unlock-toast" id="unlock-toast" role="status" aria-live="polite"></div>
      <div id="loot-layer" aria-live="polite"></div>
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
      if (!this.content) return;
      // 隨機 is drawn separately for each member (the two may land in the same village)
      const pool = this.content.origins.filter((o) => o.spawn && o.id !== 'visitor').map((o) => o.id);
      const draw = (id: string): PlayableOrigin => (id === 'random' ? pool[Math.floor(Math.random() * pool.length)] : id) as PlayableOrigin;
      this.hooks.onOrigin(draw(this.selM), draw(this.selF), this.gender);
    });
    for (const g of ['m', 'f'] as const) {
      this.bindActivate(this.el(`#btn-gender-${g}`), () => this.setGender(g));
    }
    // the traveller's portrait itself switches 男生／女生
    this.bindActivate(this.el('#cs-traveller'), () => this.setGender(this.gender === 'm' ? 'f' : 'm'));
    for (const r of ['m', 'f'] as const) {
      const sel = this.el(`#sel-origin-${r}`) as HTMLSelectElement;
      sel.addEventListener('change', () => {
        const v = sel.value as UiContent['origins'][number]['id'];
        if (r === 'm') this.selM = v;
        else this.selF = v;
        this.refreshPartyNote();
      });
    }
    this.refreshGenderPreview();
    this.bindActivate(this.el('#btn-continue'), () => this.hooks.onContinue());
    // 0.1.4 opening: title → (party) → arrival choice → cut-scene
    this.bindActivate(this.el('#btn-title-start'), () => this.leaveTitle());
    this.el('#title-screen').addEventListener('pointerup', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      this.leaveTitle();
    });
    for (const w of ['plane', 'boat'] as const) this.bindActivate(this.el(`#btn-arrive-${w}`), () => this.hooks.onArrival(w));
    this.bindActivate(this.el('#btn-arrive-back'), () => this.hooks.onArrivalBack());
    this.el('#arrival-intro').addEventListener('pointerup', () => this.hooks.onArrivalSkip());
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
    this.el('#dlg-next').addEventListener('click', () => {
      if (!this.typer.finish()) this.hooks.onDialogueNext(); // 0.1.4: first tap shows the rest of a typing line
    });
    this.el('#text-size').addEventListener('click', (e) => {
      const ts = (e.target as HTMLElement).dataset.ts;
      if (ts === 's' || ts === 'm' || ts === 'l') this.setTextSize(ts, true);
    });
    this.setTextSize(readTextSize(), false);
    onLangPick((m) => this.hooks.onLang(m));
    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest?.('.lang-toggle [data-lang]') as HTMLElement | null;
      if (!btn) return;
      const lang = btn.dataset.lang as LangMode | undefined;
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
    window.addEventListener('resize', () => this.fitTravelMap());
    window.visualViewport?.addEventListener('resize', () => this.fitTravelMap());
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
    const run = (fromClick = false) => {
      if ((el as HTMLButtonElement).disabled) return;
      const now = performance.now();
      if (now - handledAt < 400) return;
      // a tap that switched screens must not also "click" the button that appears under the finger (iPhone)
      if (fromClick && now - lastPointerActivate.at < 500 && lastPointerActivate.el !== el) return;
      handledAt = now;
      if (!fromClick) lastPointerActivate = { at: now, el };
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
      run(true);
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
    this.refreshGenderPreview();
  }

  /** party screen: one line under the portraits (who stays where) */
  private refreshPartyNote(): void {
    const differ = this.selM !== 'random' && this.selF !== 'random' && this.selM !== this.selF;
    this.el('#cs-note').textContent = differ ? '兩人不同部落：先各自回家報到，大家住在族男的家（主人家）。' : '大家住在族男的家（主人家）。';
  }

  /** 文字大小 小／中／大 → CSS variable --ts on <html>; saved in localStorage */
  setTextSize(ts: TextSize, save: boolean): void {
    document.documentElement.style.setProperty('--ts', String(TEXT_SCALE[ts]));
    document.documentElement.style.setProperty('--ts-root', String(TEXT_SCALE[ts])); // en.css scales English boxes from it
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

  /** party screen portraits (v7 painted portraits: 族男 local, 族女 local_f, traveller visitor_m / visitor) */
  private refreshGenderPreview(): void {
    const set = (sel: string, name: string): void => {
      const img = this.el(sel).querySelector('img') as HTMLImageElement;
      const src = assetUrl(`assets/portraits/${name}.webp`);
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    };
    set('#cs-member-m', 'local');
    set('#cs-member-f', 'local_f');
    set('#cs-traveller', this.gender === 'f' ? 'visitor' : 'visitor_m');
    this.el('#cs-traveller').setAttribute('aria-label', `旅人（${this.gender === 'f' ? '女生' : '男生'}）：點一下換成${this.gender === 'f' ? '男生' : '女生'}`);
  }

  /** 0.1.4: the title screen (logo over the island; the tap also lets the browser start the title music) */
  showTitle(): void {
    this.setOverlayOpen(true);
    this.el('#boot-screen').style.display = 'none';
    this.el('#title-screen').style.display = 'flex';
    this.focusIn('#btn-title-start');
  }

  private leaveTitle(): void {
    if (!this.screenShown('title')) return;
    menuSfx('menu_confirm');
    this.el('#title-screen').style.display = 'none';
    this.showOrigin();
  }

  /** which opening screen is up (tests) */
  screenShown(k: 'title' | 'origin' | 'arrival' | 'intro'): boolean {
    const id = k === 'intro' ? '#arrival-intro' : `#${k}-screen`;
    return this.el(id).style.display !== 'none';
  }

  /** 0.1.4: 搭飛機 or 搭船 */
  showArrival(): void {
    this.setOverlayOpen(true);
    this.el('#origin-screen').style.display = 'none';
    const a = this.el('#arrival-screen');
    a.style.display = 'flex';
    a.scrollTop = 0;
    this.focusIn('#btn-arrive-plane');
  }

  /** 0.1.4: the arrival cut-scene overlay (letterbox, logo, caption, skip) */
  showArrivalIntro(way: 'plane' | 'boat'): void {
    this.el('#arrival-screen').style.display = 'none';
    this.el('#origin-screen').style.display = 'none';
    this.el('#title-screen').style.display = 'none';
    this.el('#ai-caption').textContent = way === 'plane' ? '小飛機朝蘭嶼飛去，就快到了……' : '小艇切過浪頭，朝開元港前進……';
    this.el('#ai-progress').style.width = '0%';
    this.el('#ai-wash').style.opacity = way === 'plane' ? '1' : '0';
    const o = this.el('#arrival-intro');
    o.style.display = 'block';
    o.classList.remove('is-shown', 'logo-on', 'is-approach');
    void o.offsetWidth;
    o.classList.add('is-shown');
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  /** cut-scene frame: progress bar, the logo (with the title music), the cloud wash */
  setArrivalProgress(p: number, logo = true, wash = 0): void {
    this.el('#ai-progress').style.width = `${Math.round(p * 100)}%`;
    this.el('#arrival-intro').classList.toggle('logo-on', logo);
    this.el('#ai-wash').style.opacity = wash.toFixed(3);
  }

  /** 0.1.4: the island loading under the painted ride (lower-left bar) */
  setArrivalLoad(p: number, done: boolean, waiting = false): void {
    this.el('#ai-load-fill').style.width = `${Math.round(Math.min(1, p) * 100)}%`;
    const label = done ? '島嶼準備好了' : waiting ? '還在載入，好了就直接開始……' : '正在載入島嶼……';
    const l = this.el('#ai-load-label');
    if (l.textContent !== label) l.textContent = label;
    this.el('#ai-load').classList.toggle('is-done', done);
  }

  /** 0.1.4: the painted ride hands over to the in-world approach (soft cream cut; letterbox stays) */
  arrivalCut(): void {
    this.el('#arrival-intro').classList.add('is-approach');
    this.el('#arrival-intro').classList.remove('logo-on');
    this.el('#ai-wash').style.opacity = '0';
    const f = this.el('#arrival-fade');
    f.classList.remove('is-on');
    void f.offsetWidth;
    f.classList.add('is-on');
  }

  /** 0.1.4: 繼續旅程 before the island has loaded: the boot screen with its bar */
  showBootLoading(): void {
    for (const id of ['#title-screen', '#origin-screen', '#arrival-screen']) this.el(id).style.display = 'none';
    this.setOverlayOpen(true);
    this.el('#boot-screen').style.display = 'flex';
  }

  /** cut-scene over: a short soft fade into the game */
  hideArrivalIntro(): void {
    this.el('#arrival-intro').style.display = 'none';
    const f = this.el('#arrival-fade');
    f.classList.remove('is-on');
    void f.offsetWidth;
    f.classList.add('is-on');
  }

  showOrigin(): void {
    this.setOverlayOpen(true);
    this.el('#boot-screen').style.display = 'none';
    this.el('#title-screen').style.display = 'none';
    this.el('#arrival-screen').style.display = 'none';
    const origin = this.el('#origin-screen');
    origin.style.display = 'flex';
    origin.scrollTop = 0;
  }

  hideOverlaysStart(): void {
    this.el('#boot-screen').style.display = 'none';
    this.el('#origin-screen').style.display = 'none';
    this.el('#title-screen').style.display = 'none';
    this.el('#arrival-screen').style.display = 'none';
    this.el('#arrival-intro').style.display = 'none';
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
    // 0.1.5: one small dropdown per Tao member, 隨機 first and selected (the traveller is always in the party)
    const opts = [...content.origins.filter((o) => o.id === 'random'), ...content.origins.filter((o) => o.id !== 'random' && o.id !== 'visitor')];
    for (const r of ['m', 'f'] as const) {
      const sel = this.el(`#sel-origin-${r}`) as HTMLSelectElement;
      sel.replaceChildren(...opts.map((o) => {
        const op = document.createElement('option');
        op.value = o.id;
        op.textContent = o.tao && o.tao !== o.zh ? `${o.zh} ${o.tao}` : o.zh; // English: the village name is already the Tao name
        op.title = o.hint;
        return op;
      }));
      sel.value = r === 'm' ? this.selM : this.selF;
    }
    this.refreshPartyNote();
    // (0.1.5: the fast-travel destinations are pins on the big map, see bakeTravelMap)
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
    // 0.1.5: the notebook grows out of the 圖鑑手札 button and shrinks back into it (src/ui/fly.ts)
    const bd = this.el('#journal-backdrop');
    const jr = this.el('#journal');
    const nbBtn = this.root.querySelector<HTMLElement>('#btn-journal');
    if (next === 'journal') {
      this.nbAnim++;
      bd.classList.remove('closing');
      jr.getAnimations?.().forEach((a) => a.cancel());
      bd.classList.add('open');
      void zoomButton(jr, nbBtn, 'open', 900);
    } else if (prev === 'journal') {
      const tok = ++this.nbAnim;
      bd.classList.remove('open');
      bd.classList.add('closing');
      void zoomButton(jr, nbBtn, 'close', 800).then(() => {
        if (tok !== this.nbAnim) return;
        bd.classList.remove('closing');
        jr.getAnimations?.().forEach((a) => a.cancel());
      });
    }
    this.el('#travel-sheet').style.display = next === 'travel' ? 'flex' : 'none';
    if (next === 'travel') this.showTravelMap();
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
    // 0.1.4 opening: any key leaves the title / skips the arrival cut-scene (after this key's own handling)
    if (this.screenShown('intro')) window.setTimeout(() => this.hooks.onArrivalSkip(), 0);
    else if (this.screenShown('title')) window.setTimeout(() => this.leaveTitle(), 0);
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
    this.syncLang(lang);
  }

  syncLang(lang: LangMode): void {
    syncLangToggles(this.root, lang);
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
    // 0.1.5 中文 + English: a small English line under the Chinese one (whenever the Chinese line shows)
    const enEl = this.el('#dlg-en');
    const en = isBi() ? english(zh) : null;
    enEl.textContent = en ?? '';
    enEl.classList.toggle('hidden', !en || this.el('#dlg-zh').classList.contains('hidden'));
    // 0.1.4: type the visible line(s) out with a soft blip
    this.typer.start([this.el('#dlg-zh'), enEl, this.el('#dlg-tao')].filter((e) => !e.classList.contains('hidden')));
    this.el('#dlg-next').textContent = last ? '結束對話' : '繼續';
    if (!wasOpen && !this.overlay) {
      this.rememberFocus();
      this.focusIn('#dlg-next');
    }
  }

  /** 0.1.4: a tap / key while a dialogue line is typing shows the rest instead of advancing */
  readonly typer = new Typewriter();
  finishTyping(): boolean {
    return this.typer.finish();
  }

  closeDialogue(): void {
    const box = this.el('#dialogue');
    if (!box.classList.contains('open')) return;
    this.typer.finish();
    box.classList.remove('open');
    if (box.contains(document.activeElement)) this.restoreFocus();
  }

  private toastQ: [string, string][] = [];
  private loots: { el: HTMLElement; x: number; z: number; y: number; t: number }[] = [];

  /**
   * Item-gain pop (食材＋1, …) above a world point. Shows immediately, never queues
   * behind a toast or dialogue, and several can be on screen at once.
   */
  popLoot(text: string, x: number, z: number, icon?: string): void {
    const el = document.createElement('div');
    el.className = 'loot-pop';
    if (icon) {
      // 0.1.5: gathered items show only a small icon with +1
      el.classList.add('has-ico');
      const i = document.createElement('img');
      i.className = 'loot-ico';
      i.alt = '';
      i.decoding = 'async';
      i.src = icon;
      el.append(i);
      if (text) el.append(text);
    } else el.textContent = text;
    this.el('#loot-layer').append(el);
    this.loots.push({ el, x, z, y: 1.75, t: 0 });
  }

  updateLoots(
    dt: number,
    project: (x: number, y: number, z: number) => { x: number; y: number; vis: boolean },
    heightAt: (x: number, z: number) => number,
  ): void {
    const keep: typeof this.loots = [];
    for (const L of this.loots) {
      L.t += dt;
      L.y += dt * 0.9;
      if (L.t >= 1.6) { L.el.remove(); continue; }
      const p = project(L.x, heightAt(L.x, L.z) + L.y, L.z);
      const fade = L.t < 0.12 ? L.t / 0.12 : Math.max(0, 1 - (L.t - 0.95) / 0.65);
      L.el.style.opacity = p.vis ? String(fade) : '0';
      L.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      keep.push(L);
    }
    this.loots = keep;
  }

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
    sfxShutter(); // 0.1.4: digital camera click
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
    // 0.1.5 中文 + English: the notice in English too, in a small line
    if (isBi()) {
      const en = [english(title), english(body)].filter(Boolean).join(' · ');
      if (en) {
        const s = document.createElement('small');
        s.className = 'toast-en';
        s.lang = 'en';
        s.textContent = en;
        el.append(s);
      }
    }
    el.classList.add('show');
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastTimer = null;
      el.classList.remove('show');
      const next = this.toastQ.shift();
      if (next) window.setTimeout(() => this.showToast(next[0], next[1]), 160);
    }, this.toastQ.length ? 2200 : 3000);
  }

  private grid = new ItemGrid();
  private nbAnim = 0;
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
      if (this.codexVM) {
        const { cells, sub } = codexCells(this.codexVM());
        this.nb.showCustom(tab, (host) => this.grid.render(host, cells, sub));
      }
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
        const saveKind = tab === 'save' ? sec.dataset.save : undefined;
        return {
          key: `${tab}:${i}`,
          title: title.replace(/（\d+\/\d+）$/, ''),
          tao: tab === 'album' ? (title.match(/（\d+\/\d+）$/)?.[0].slice(1, -1) ?? '') : undefined,
          mark: tab === 'album' ? (missing ? 'none' : 'done') : 'none',
          data: saveKind ? { save: saveKind } : undefined,
          render: (box) => {
            nbTitle(box, tab === 'album' ? `相簿與水下${title.match(/（\d+\/\d+）$/)?.[0] ?? ''}` : '存檔', title.replace(/（\d+\/\d+）$/, ''));
            box.append(sec);
          },
        };
      });
      this.nb.show(tab, {
        heading: tab === 'album' ? '相簿與水下' : '存檔',
        sub: tab === 'album' ? '照片、水下美景與活動歌謠' : '設定、匯出備份，或在別台裝置匯入',
        note,
        items,
        preferKey: tab === 'save' ? items.find((i) => i.data?.save === 'settings')?.key : undefined,
      });
      return;
    }
  }

  /** arrival beat: mark 抵達蘭嶼 with an animated ✓ on the open quest-log page */
  stampQuestDone(id: string): void {
    const b = this.root.querySelector(`.nb-item[data-qid="${id}"]`) as HTMLElement | null;
    if (!b) return;
    b.classList.remove('st-active');
    b.classList.add('st-done', 'stamping');
    const m = b.querySelector('.nb-mark');
    if (m) {
      m.textContent = '✓';
      m.setAttribute('aria-label', '完成');
    }
    const detail = this.root.querySelector('#nb-detail');
    if (detail && (detail as HTMLElement).dataset.qid === id) {
      if (!detail.querySelector('.nd-stamped')) {
        const tag = document.createElement('p');
        tag.className = 'nd-stamped';
        tag.textContent = '✓ 完成';
        detail.insertBefore(tag, detail.firstChild);
      }
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
    if (q.giver) chips.append(h('span', `qc-giver g-${/^女|woman/i.test(q.giver) ? 'f' : 'm'}`, q.giver));
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

  // ---- 0.1.5: fast travel on a big island map (tap a pin) ----
  private travelBox: { xMin: number; zMin: number; xMax: number; zMax: number } | null = null;
  private travelPainter: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null = null;
  private travelBaked = false;

  /**
   * Set up the fast-travel map: the island crop (world box), a painter for it, and the destinations (world x / z).
   * The map itself is painted the first time it opens.
   */
  setTravelMap(box: { xMin: number; zMin: number; xMax: number; zMax: number }, painter: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, spots: { id: string; zh: string; tao: string; x: number; z: number; kind: 'tribe' | 'place' }[]): void {
    this.travelBox = box;
    this.travelPainter = painter;
    this.travelBaked = false;
    const map = this.el('#travel-map');
    map.querySelectorAll('.travel-pin').forEach((n) => n.remove());
    const bw = box.xMax - box.xMin, bh = box.zMax - box.zMin;
    map.style.setProperty('--ar', String(bw / bh));
    for (const sp of spots) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `travel-pin is-${sp.kind} lab-${TRAVEL_LABEL_SIDE[sp.id] ?? 'r'}`;
      b.dataset.id = sp.id;
      b.style.left = `${(((sp.x - box.xMin) / bw) * 100).toFixed(2)}%`;
      b.style.top = `${(((sp.z - box.zMin) / bh) * 100).toFixed(2)}%`;
      b.setAttribute('aria-label', `前往${sp.zh}`);
      const dot = document.createElement('i');
      dot.className = 'dot';
      const lab = document.createElement('span');
      lab.className = 'lab';
      lab.append(span('zh', sp.zh));
      // English: the village name already is its Tao name, so no second line
      if (sp.kind === 'tribe' && sp.tao && sp.tao !== sp.zh) lab.append(span('tao', sp.tao));
      b.append(dot, lab);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hooks.onFastTravel(sp.id);
      });
      map.appendChild(b);
    }
  }

  /** paint (once) and size the travel map to the sheet, and put the "you are here" mark on it */
  private showTravelMap(): void {
    const box = this.travelBox;
    if (!box) return;
    const c = this.el('#travel-canvas') as HTMLCanvasElement;
    const bw = box.xMax - box.xMin, bh = box.zMax - box.zMin;
    if (!this.travelBaked && this.travelPainter) {
      const W = 640;
      c.width = W;
      c.height = Math.round((W * bh) / bw);
      this.travelPainter(c.getContext('2d')!, c.width, c.height);
      this.travelBaked = true;
    }
    this.fitTravelMap();
    const you = this.el('#travel-you');
    const m = this.mmLast;
    if (Number.isFinite(m.x)) {
      you.style.display = 'block';
      you.style.left = `${(((m.x - box.xMin) / bw) * 100).toFixed(2)}%`;
      you.style.top = `${(((m.z - box.zMin) / bh) * 100).toFixed(2)}%`;
      you.style.transform = `translate(-50%, -50%) rotate(${m.yaw}rad)`;
    } else you.style.display = 'none';
  }

  /** the biggest map that fits the sheet on this screen (desktop, phone portrait or landscape) */
  fitTravelMap(): void {
    const box = this.travelBox;
    const sheet = this.el('#travel-sheet');
    if (!box || sheet.style.display === 'none') return;
    const map = this.el('#travel-map');
    const ar = (box.xMax - box.xMin) / (box.zMax - box.zMin);
    const cs = getComputedStyle(sheet);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    let above = 0;
    for (const ch of Array.from(sheet.children) as HTMLElement[]) {
      if (ch === map || getComputedStyle(ch).display === 'none') continue;
      const st = getComputedStyle(ch);
      above += ch.getBoundingClientRect().height + parseFloat(st.marginTop) + parseFloat(st.marginBottom);
    }
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const maxW = Math.min(720, vw - 20) - padX;
    const maxH = vh - 20 - padY - above;
    const w = Math.max(160, Math.min(maxW, maxH * ar));
    map.style.width = `${Math.floor(w)}px`;
    map.style.height = `${Math.floor(w / ar)}px`;
  }

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

/** which side of its pin each travel label sits on (l / r / t / b), so neighbouring labels don't overlap */
const TRAVEL_LABEL_SIDE: Record<string, 'l' | 'r' | 't' | 'b'> = {
  yayo: 'r', harbor: 't', iraraley: 'b', iranmeylek: 'l', ivalino: 'r', imorod: 'b', iratay: 'b', clinic: 't', airport: 'l', qingqing: 'r',
};

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
