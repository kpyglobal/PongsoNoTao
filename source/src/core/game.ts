import * as THREE from 'three';
import { seasonLook } from '../render/look';
import { setPaintLook, worldStyle } from '../render/stylize';
import { PAINT } from '../render/styleConfig';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Assets } from './assets';
import { CAM_DEFAULT } from './camera';
import { Input, type InputAction } from './input';
import { GameState, isLangMode, readStoredLang, writeStoredLang, type ArrivalWay, type Gender, type LangMode } from './state';
import { arrivalSpawn, buildArrivalProps } from '../world/arrival';
import { IntroScene } from '../intro/introScene';
import { mountMenuSound, installMenuSounds, menuSfx } from '../ui/menuSound';
import { PRESETS, type Period, type Season } from './timeSeason';
import { PostFX } from './post';
import { SkyLighting } from '../world/sky';
import { Ocean, bakeLandFieldAsync } from '../world/water';
import { reflectHooks } from '../render/reflectHooks';
import { setSpriteSunYaw } from '../entities/billboard';
import { WorldDecor, type PlaceRec } from '../world/populate';
import { GoatHerds } from '../world/goats';
import { addQuestPlaces, hostPlaces } from '../world/places';
import { elderF, elderM, isVillage, questHome, resolveQuests, tokenNpc, VILLAGES, type Homes, type VillageId } from '../systems/homes';
import { TaroTerraces } from '../world/paddies';
import { sample, sampleHM, gridAsync, TERRAIN_BOX, distToRing, roadPolylines } from '../world/height';
import { Player, type PlayerMode } from '../entities/player';
import { NpcSystem, NPC_LOAD_AHEAD, type NpcActor, type NpcPace, npcWalkRate, npcWalkSpeed } from '../entities/npcs';
import { UI, type Overlay } from '../ui/dom';
import { isIOS, preferredPixelRatio } from './device';
import { quality } from './quality';
import { clamp } from './math';
import { checkShape, fmt, type DialogueNode, type DialogueUnlocks, type PlayableOrigin, type UiContent } from './content';
import { content, type ContentDB } from '../content/loader';
import { Dialogue } from '../systems/dialogue';
import { Inventory } from '../systems/inventory';
import { Gathering, type LiveNode } from '../systems/gathering';
import { PhotoSpots } from '../systems/photoSpots';
import { Recipes } from '../systems/recipes';
import { Outfits } from '../systems/outfits';
import { fitClock, seasonTag } from '../systems/timeWindow';
import { yieldToUi } from './frame';
import { lastPaintMs, Island, WORLD_BOX } from '../world/island';
import { initCollision, canStand, findSafeStand, PLAYER_RADIUS, NPC_RADIUS } from '../world/collision';
import { buildShade, shadeAt, shadeStats } from '../world/shade';
import type { SpriteBillboard } from '../entities/billboard';
import { LANDMARKS, facilityBoxes, remapSavePos, remapSavePos014, remapSavePos015, useWorldLang, VILLAGE_DEFS, FACILITIES } from '../world/layout';
import { LANYU_OUTLINE, MAP_SCALE } from '../world/outline';
import { WORLD_REV } from '../world/legacy';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Party, ROLES } from '../entities/party';
import { QuestEngine, tideAt, type QuestEvent } from '../quests/engine';
import type { QuestDef, QuestStep, Role, StepLine } from '../quests/types';
import type { PhotoSpotDef } from '../content/types';
import { readSave, writeSave, clearSave, validateSave, type SaveJSON } from './save';
import { CHAR_WORLD_H, WALK_ANIM_RATE } from '../entities/billboard';
import type { QuestCardVM } from '../ui/dom';
import { startBgm, isCultureQuest, segueToTitle, titleIntroSeconds } from '../systems/audio/bgm';
import { sfxSting } from '../systems/audio/sfx';
import { closeImagePopup, showDive, showSongCard, renderAlbum, renderSaveTab, type AlbumVM, type SongVM } from '../ui/phase1b';
import { tr, uiLang } from '../ui/i18n';
import { CardQueue, CARD_ART, photoEl, postcardEl, recipeEl, type CardJob } from '../ui/cards';
import { itemCard, itemIcon, needRows, outfitCard, photoCard, recipeCard, recipeRows, wordCard, type CardCtx } from '../ui/cardData';
import { questPageJob } from '../ui/questPage';
import { fxOn } from '../ui/fly';
import { sfxShutter } from '../systems/audio/sfx';
import { onWarmProgress, warmBackground, warmVillage, warmStats } from '../systems/prefetch';
import { villageTrackPath } from '../systems/audio/bgm';
import { findWalkPath } from '../systems/autoWalk';

const ROLE_ZH: Record<Role, string> = { m: '族男', f: '族女', t: '旅人' };
/** 0.1.5: small camera icon for a scenic spot already in the album (drawn, no emoji font needed) */
const CAMERA_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="3" y="9" width="26" height="18" rx="4" fill="#fffaf0" stroke="#2c2118" stroke-width="2"/><path d="M11 9l2-4h6l2 4" fill="#fffaf0" stroke="#2c2118" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="18" r="5.5" fill="#1f6f70" stroke="#2c2118" stroke-width="2"/><circle cx="24.5" cy="13" r="1.4" fill="#b33a32"/></svg>')}`;
type DlgLine = { who: string; zh: string; tao: string; portrait?: string; unlocks?: DialogueUnlocks };

/** What the player is doing; overlays (journal / travel / help) sit on top of it. */
type Activity = 'cover' | 'explore' | 'dialogue' | 'minigame';
/** The one explicit game mode the loop, input routing and the UI read. */
export type Mode = Activity | Overlay;

/** The test / debug API is only exposed in dev builds or with ?debug in the URL. */
const DEBUG_API = import.meta.env.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'));



/**
 * 0.1.4 arrival opening: title screen → party → 搭飛機／搭船 → arrival cut-scene. `?intro=0` turns it off,
 * `?intro=1` forces it on; automated browsers (navigator.webdriver) skip it unless `?intro=1`, so the older
 * test scripts keep starting straight at 開元港 (scripts/test-intro.mjs covers the opening itself).
 */
function introEnabled(): boolean {
  if (typeof location === 'undefined') return false;
  const v = new URLSearchParams(location.search).get('intro');
  if (v === '1') return true;
  if (v === '0') return false;
  return !(typeof navigator !== 'undefined' && navigator.webdriver);
}
/** 0.1.6: guide arrow switch (on unless turned off) */
const GUIDE_KEY = 'tao-rpg.guide';
function readGuidePref(): boolean {
  try { return localStorage.getItem(GUIDE_KEY) !== '0'; } catch { return true; }
}
const CAM_MIN_DIST = 16;
const CAM_MAX_DIST = 46;
/** gentle sprite size compensation vs zoom: ~0.93x at the closest, 1x at default, ~1.25x at the farthest */
function charZoomScale(dist: number): number {
  return clamp(Math.pow(dist / CAM_DEFAULT.dist, 0.3), 0.9, 1.3);
}



export class Game {
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private assets = new Assets();
  private input: Input;
  private state = new GameState();
  private ui: UI;
  private island!: Island;
  private sky!: SkyLighting;
  private ocean!: Ocean;
  private decor!: WorldDecor;
  private terraces!: TaroTerraces;
  private post!: PostFX;
  private focus: { x: number; z: number } | null = null;
  private coverHold = false;
  /** 0.1.4 arrival cut-scene in progress (title music keeps playing; begin() runs when it ends or is skipped) */
  private arrival: {
    /** 'intro': the painted ride while the island loads; 'notebook': the quest-log stamp for 抵達蘭嶼 */
    phase: 'intro' | 'notebook';
    t0: number;
    id: PlayableOrigin;
    /** 0.1.5: the 族女's village (id = the 族男's, which is also the 主人家) */
    idF: PlayableOrigin;
    gender: Gender;
    way: ArrivalWay;
    last: number;
    /** title music (and the logo) start; the logo may leave once loading is done and the epic part is over */
    logoAt: number;
    minEnd: number;
    logoOutAt: number | null;
    skip: boolean;
    tA: number;
    stamped?: boolean;
  } | null = null;
  /** 0.1.4 the painted intro scene (title backdrop + the ride in); disposed when the game starts */
  private intro: IntroScene | null = null;
  /** the island, assets and systems are built (with the intro on, this happens in the background) */
  private worldReady = false;
  private worldLoading: Promise<void> | null = null;
  private loadP = 0;
  private loadLabel = '';
  /** intro memory report (tests): renderer + heap before and after the intro scene is disposed */
  private introMem: { before?: Record<string, number>; after?: Record<string, number> } = {};
  /** party picked on the origin screen, waiting for the 搭飛機／搭船 choice */
  private pendingStart: { id: PlayableOrigin; idF: PlayableOrigin; gender: Gender } | null = null;
  /** cut-scene camera height override (the plane is in the air) */
  private camFy: number | null = null;
  private arrivalPeriod: Period | null = null;
  private activity: Activity = 'cover';
  private overlay: Overlay | null = null;
  private content!: UiContent;
  private camCur = { yaw: 0.55, pitch: 0.62, dist: CAM_DEFAULT.dist, x: 0, y: 0, z: 0 };
  private player!: Player;
  private npcs!: NpcSystem;
  private goats!: GoatHerds;
  private lootV = new THREE.Vector3();
  private places: Record<string, PlaceRec> = {};
  private groundFx = true;
  private diveOpen = false;
  /** bundled content (content/*.json via src/content/loader.ts) and the systems built on it */
  private db!: ContentDB;
  private dlg!: Dialogue;
  private inv!: Inventory;
  private gathering!: Gathering;
  private photos!: PhotoSpots;
  private recipeSys!: Recipes;
  private outfits!: Outfits;
  /** per-NPC talk counter (rotates chat lines) */
  private chatTurn = new Map<string, number>();
  private camYaw = 0.62;
  private camPitch = 0.6;
  private camDist = CAM_DEFAULT.dist;
  private camBtn = 0;
  private dlgQueue: DlgLine[] = [];
  /** 0.1.4 audio: the quest whose scene is open (cleared on return to exploration by the probe's mode check) */
  private audioSceneQuest: string | null = null;
  private mg: { kind: 'taro' | 'fish'; t: number; dir: number; s0: number; s1: number } | null = null;
  /** quest mini-game (sea trip): called with the result instead of the free-play rewards */
  private mgDone: ((ok: boolean) => void) | null = null;
  /** test hook: the next mini-game hits by itself */
  private mgAuto = false;
  /** party split: last state applied to each follower (`st|at`) so a member is moved only when it changes */
  private memberKey: Partial<Record<Role, string>> = {};
  /** NPC streaming: re-check distances every 0.4 s */
  private streamTick = 0;
  private streamAt = 0;

  /** load NPC sprites near the camera target, dispose far ones (hysteresis in NpcSystem.stream) */
  private streamNpcs(): void {
    this.streamTick = 1;
    this.streamAt = performance.now();
    // the title screen shows the island from far away: no NPC sprites until the journey starts
    if (!this.state.started) return;
    const c = this.focus ?? { x: this.player.x, z: this.player.z };
    // the camera sits at target + (sin yaw, cos yaw) × distance: the visible ground is the other way
    const ahead = this.camDist * NPC_LOAD_AHEAD;
    this.npcs.stream(c.x - Math.sin(this.camYaw) * ahead, c.z - Math.cos(this.camYaw) * ahead, this.camDist, charZoomScale(this.camDist));
  }
  private raf = 0;
  private frameNo = 0;
  private contextLost = false;
  private resizeRaf = 0;
  /** runs once when the current dialogue queue empties (e.g. 飛魚季 → start the fish mini-game) */
  private afterDialogue: (() => void) | null = null;
  private snapCam = true;
  private party!: Party;
  private quests!: QuestEngine;
  private questTick = 0;
  private saveTick = 0;
  private saveWarned = false;
  private questDirty = true;
  private markerRoot = new THREE.Group();
  private markers = new Map<string, { obj: CSS2DObject; el: HTMLElement; npc?: NpcActor; key: string }>();
  ready = false;
  timings = { boot: 0, assets: 0, grid: 0, paint: 0, world: 0 };
  /** 0.1.6: the village the party is in (camera zoom in / out on the way in / out) */
  private villageIn: string | null = null;
  /** 0.1.6: villages whose people / music / photos were warmed in the background */
  private villageWarm = new Set<string>();
  private bgWarmAt = 0;
  /** 0.1.6 guide arrow toward the tracked quest's next place (menu / settings switch, saved in localStorage) */
  private guideOn = readGuidePref();
  private guideTarget: { x: number; z: number } | null = null;
  /** 0.1.6 tap-to-walk: what the walk is for (talk / gather on arrival) and the marker on the ground */
  private autoGoal: { kind: 'npc'; npc: NpcActor } | { kind: 'gather'; node: LiveNode } | null = null;
  private walkMark: HTMLElement | null = null;
  private readonly gv = new THREE.Vector3();
  /** 0.1.5 unlock cards / quest pages / photos (src/ui/cards.ts) */
  private cards!: CardQueue;
  /** cards, quest pages and arrival photos run on their own (off in automated runs unless ?cards=1; tests can switch) */
  private cardsAuto = fxOn();
  /** scenic spots the party stood in at the last check (first-visit photos / revisit camera icon) */
  private scenicIn = new Set<string>();
  private scenicLast: { x: number; z: number } | null = null;
  private scenicT = 0;
  private lastSnap = '';

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ui = new UI(document.getElementById('ui-root')!);
    this.cards = new CardQueue(document.getElementById('ui-root')!, () => document.getElementById('btn-journal'));
    mountMenuSound(); // 0.1.4: 音樂／音效 toggles on the start screens + menu sounds everywhere
    installMenuSounds();
    this.ui.setOverlayOpen(true);
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        // PostFX renders into its own (MSAA on desktop) target; canvas-level AA would only resolve a fullscreen quad
        antialias: false,
        alpha: false,
        powerPreference: isIOS() ? 'default' : 'high-performance',
        stencil: false,
      });
    } catch (err) {
      console.error(err);
      this.ui.setLoad(1, '這個瀏覽器無法啟動 3D 畫面，請改用 Safari 或 Chrome 再試一次。');
      throw err;
    }
    this.renderer.setPixelRatio(preferredPixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    // PCF soft on desktop, plain PCF on the mobile tier
    this.renderer.shadowMap.type = quality().shadowType;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.input.resetHeld();
      this.ui.setLoad(1, '繪圖環境被系統回收，請稍候或重新整理頁面。');
      this.ui.el('#boot-screen').style.display = 'flex';
    });
    canvas.addEventListener('webglcontextrestored', () => {
      // three.js re-initialises its GL state on restore; resume the loop where it was
      this.contextLost = false;
      this.ui.el('#boot-screen').style.display = 'none';
      if (this.ready && !this.raf) {
        this.clock.getDelta();
        this.loop();
      }
    });

    this.camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.2, 1400);
    this.camera.position.set(12, 14, 22);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    const host = document.getElementById('css2d-root')!;
    host.appendChild(this.labelRenderer.domElement);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.inset = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';

    this.input = new Input(canvas);
    this.input.onReset = () => {
      this.camBtn = 0;
    };
    this.input.onAction = (a) => this.onAction(a);
    this.input.onAnyKey = () => this.ui.onAnyKey();
    this.ui.hooks = {
      onOrigin: (id, idF, gender) => {
        // S2: one save slot — ask before a new journey replaces it
        const meta = this.saveMeta(readSave());
        if (meta && !window.confirm(tr(`開始新旅程會覆蓋現有存檔：\n${meta}\n\n確定要重新開始嗎？（想保留可以先到手札「存檔」匯出）`))) return;
        // 0.1.4: next, how the party reaches the island (off: straight to 開元港, as before)
        if (introEnabled()) {
          this.pendingStart = { id, idF, gender };
          this.ui.showArrival();
        } else this.begin(id, gender, 'm', 'boat', false, idF);
      },
      onArrival: (way) => {
        const p = this.pendingStart;
        if (!p) return;
        this.pendingStart = null;
        this.playArrival(p.id, p.gender, way, p.idF);
      },
      onArrivalBack: () => {
        this.pendingStart = null;
        this.ui.showOrigin();
      },
      onArrivalSkip: () => this.endArrival(),
      onPeriod: (p) => this.setPeriod(p),
      onSeason: (s) => this.setSeason(s),
      onLang: (m) => this.setLang(m),
      onOverlay: (kind, open) => this.setOverlay(kind, open),
      onJournalTab: () => {
        if (this.overlay === 'journal') this.refreshJournal();
      },
      onInteract: () => this.tryInteract(),
      onDialogueNext: () => this.advanceDialogue(),
      onMinigameHit: () => this.hitMinigame(),
      onPad: (x, z, active) => this.input.setPad(x, z, active),
      onCamBtn: (dir) => {
        this.camBtn = dir;
      },
      onCamReset: () => this.resetView(),
      onZoom: (dir) => {
        this.camDist = clamp(this.camDist * (dir < 0 ? 0.78 : 1.28), CAM_MIN_DIST, CAM_MAX_DIST);
      },
      onScooter: () => this.toggleScooter(),
      onFastTravel: (id) => this.fastTravel(id),
      onSwitch: (r) => this.switchMember(r),
      onSoloAbort: () => this.abortSolo(),
      onContinue: () => void this.continueSaved(),
      onTitleContinue: () => void this.continueSaved(),
      onGuide: (on) => this.setGuide(on),
    };
    this.ui.setGuideButton(this.guideOn);
    onWarmProgress((done, total) => this.ui.setBgLoad(done, total));
    this.input.onTap = (x, y) => this.tapAt(x, y);
    this.ui.onTrack = (id) => {
      this.quests.tracked = id;
      this.questDirty = true;
      this.refreshQuestUi(true);
    };
    // batch 1b: 手札 pages drawn by src/ui/phase1b.ts
    this.ui.tabRenderers.album = (pages) => renderAlbum(pages, this.albumVM());
    this.ui.tabRenderers.save = (pages) => {
        renderSaveTab(pages, { code: () => this.saveCode(), download: () => this.downloadSave(), importText: (t) => this.importSave(t) });
        this.ui.setGuideButton(this.guideOn);
      };
    const flush = (): void => {
      if (this.state.started) this.saveNow();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });

    window.addEventListener('resize', () => this.scheduleResize());
  }

  /** Current mode: an open overlay wins over the underlying activity. */
  get mode(): Mode {
    return this.overlay ?? this.activity;
  }

  /** Keyboard actions from Input, mapped per mode. */
  private onAction(a: InputAction): void {
    if (!this.ready || !this.worldReady) return;
    if (a === 'escape' && this.cards.open) {
      this.cards.tap();
      return;
    }
    if (a === 'escape') {
      if (this.overlay) menuSfx('menu_cancel');
      if (this.overlay) this.setOverlay(this.overlay, false);
      else if (this.activity === 'minigame') this.cancelMinigame();
    } else if (a === 'journal') {
      if (this.state.started) this.setOverlay('journal', this.overlay !== 'journal');
    } else if (a === 'scooter') {
      if (this.state.started) this.toggleScooter();
    } else if (a === 'quests') {
      if (this.state.started) {
        if (this.overlay === 'journal' && this.ui.currentJournalTab === 'quests') this.setOverlay('journal', false);
        else this.ui.openJournalTab('quests');
      }
    } else if (a === 'party1' || a === 'party2' || a === 'party3') {
      this.switchMember(a === 'party1' ? 'm' : a === 'party2' ? 'f' : 't');
    } else if (a === 'partyNext') {
      const i = ROLES.indexOf(this.party.controlled);
      this.switchMember(ROLES[(i + 1) % ROLES.length]);
    }
  }

  /** Open or close one overlay layer (at most one is open; opening another replaces it). */
  private setOverlay(kind: Overlay, open: boolean): void {
    if (open) this.overlay = kind;
    else if (this.overlay === kind) this.overlay = null;
    else return;
    this.ui.renderOverlay(this.overlay);
    if (this.overlay === 'journal') this.refreshJournal();
  }

  async boot(): Promise<void> {
    const boot0 = performance.now();
    try {
      this.loadContent();
      if (introEnabled()) {
        // 0.1.4: the title, party and arrival screens run over the light painted intro scene; the island itself
        // loads in the background once the ride in starts (or at once for 繼續旅程)
        this.ui.setLoad(0.3, '準備開場……');
        this.intro = new IntroScene(window.innerWidth / window.innerHeight);
        await this.intro.load();
        this.ui.setLoad(1, '完成');
        this.ui.showTitle();
        this.afterBoot(boot0);
        return;
      }
      await this.loadWorld((p, label) => this.ui.setLoad(p, label));
      // cover: slow orbit over the whole island behind the title card
      this.focus = { x: 0, z: 2 * MAP_SCALE }; // 0.1.4: centre of the real-outline island (0.1.5: scaled with it)
      this.camYaw = 0.75;
      this.camPitch = 0.66;
      this.camDist = 92 * MAP_SCALE;
      this.snapCam = true;
      this.ui.showOrigin();
      this.afterBoot(boot0);
    } catch (err) {
      console.error(err);
      this.ui.setLoad(1, '載入失敗，請重新整理頁面再試一次。');
      this.ui.setOverlayOpen(true);
      this.ui.el('#boot-screen').style.display = 'flex';
      throw err;
    }
  }

  private afterBoot(boot0: number): void {
    try {
      const sv = readSave();
      this.ui.showContinue(this.saveMeta(sv));
      const fromSave = sv?.state?.lang;
      this.setLang(isLangMode(fromSave) ? fromSave : (readStoredLang() ?? this.state.lang));
    } catch (e) {
      console.warn('save unreadable', e);
      this.ui.showContinue(null);
      this.setLang(readStoredLang() ?? this.state.lang);
    }
    this.ready = true;
    this.timings.boot = performance.now() - boot0;
    // 0.1.6: the start screens only needed the small core fonts; fetch the full ones now, before the game needs them ('找' is not in the core set)
    window.setTimeout(() => {
      try {
        for (const w of ['400', '500']) void document.fonts?.load(`${w} 16px "LXGW WenKai TC"`, '找').catch(() => undefined);
      } catch { /* old browsers: the page fetches them when it needs them */ }
    }, 1200);
    this.expose();
    // 0.1.4 background music: picks a loop by place / night / sea (src/systems/audio/bgm.ts)
    startBgm(() => {
      const w = this.worldReady;
      return {
        menu: !this.state.started && !this.arrival,
        title: !!this.arrival,
        culture: w && this.mode !== 'explore' && !!this.audioSceneQuest && isCultureQuest(this.quests.defs.find((q) => q.id === this.audioSceneQuest)),
        x: w ? this.player.x : 0,
        z: w ? this.player.z : 0,
        h: w ? this.island.heightAt(this.player.x, this.player.z) : 0,
        night: this.state.period === 'night',
        sea: w && (this.player.mode === 'canoe' || this.diveOpen),
      };
    });
    this.loop();
  }

  /** content tables (sync; the screens before the island need places / ui text) */
  private loadContent(): void {
    if (this.db) return;
    useWorldLang(uiLang() === 'en' ? 'en' : 'zh'); // 0.1.5: landmark / quest-spot names in the interface language
    this.db = content();
    this.places = JSON.parse(JSON.stringify(this.db.places)) as Record<string, PlaceRec>;
    this.dlg = new Dialogue(this.db.dialogues);
    this.content = checkShape<UiContent>('ui', this.db.ui);
    checkShape('glossary', this.db.glossary);
    checkShape('milestones', this.db.milestones);
    this.ui.setContent(this.content);
  }

  /** assets, heightfield, island, systems, shader warm-up (once; the intro runs it in the background) */
  private loadWorld(progress: (p: number, label: string) => void): Promise<void> {
    if (this.worldLoading) return this.worldLoading;
    this.progress = progress;
    this.worldLoading = (async () => {
      const a0 = performance.now();
      await this.assets.load((p, label) => this.progress(p * 0.62, label));
      this.timings.assets = performance.now() - a0;
      this.progress(0.64, '雕塑火山稜線與海灣……');
      await yieldToUi(true);
      const g0 = performance.now();
      await gridAsync((p) => this.progress(0.64 + p * 0.12, '雕塑火山稜線與海灣……'));
      this.timings.grid = performance.now() - g0;
      initCollision();
      this.ui.bakeMinimap(drawMinimap);
      // 0.1.5: the fast-travel map (the island crop of the same painting, with a pin per destination)
      {
        const box = travelMapBox();
        const spots = this.content.travel.flatMap((t) => {
          const p = t.landmark ? LANDMARKS.find((l) => l.id === t.id) : this.places[t.id];
          return p ? [{ id: t.id, zh: t.zh, tao: t.tao, x: p.x, z: p.z, kind: (VILLAGE_DEFS.some((v) => v.id === t.id) ? 'tribe' : 'place') as 'tribe' | 'place' }] : [];
        });
        this.ui.setTravelMap(box, (ctx, w, h) => drawMinimap(ctx, w, h, box), spots);
      }
      this.progress(0.77, '為島嶼上色……');
      await yieldToUi(true);
      const w0 = performance.now();
      await this.buildWorld();
      this.timings.world = performance.now() - w0;
      this.timings.paint = lastPaintMs;
      this.progress(0.97, '烘上島嶼的光……');
      await yieldToUi(true);
      // compile shaders now, so the first cover frame is not a multi-second iOS stall
      const compile = (this.renderer as THREE.WebGLRenderer & { compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<void> }).compileAsync;
      // pre-warm both light-count variants (village point lights are hidden by day, shown at dusk/night)
      for (const lightsOn of [true, false]) {
        this.decor.setLightsVisible(lightsOn);
        if (compile) await compile.call(this.renderer, this.scene, this.camera);
        else this.renderer.compile(this.scene, this.camera);
      }
      this.decor.applyTime(this.state.period, this.state.season);
      this.progress(1, '完成');
      this.worldReady = true;
    })();
    return this.worldLoading;
  }

  private progress: (p: number, label: string) => void = () => {};

  private async buildWorld(): Promise<void> {
    this.loadContent();

    this.island = new Island(this.assets);
    await this.island.build((p) => this.progress(0.77 + p * 0.12, '為島嶼上色……'));
    // close-zoom ground crispness; `?groundfx=0` restores the old look for A/B screenshots
    this.groundFx = new URLSearchParams(location.search).get('groundfx') !== '0';
    if (this.groundFx) {
      // S11: mobile → anisotropy 4 on the painted albedo only (tiled detail textures stay at 4 from textures.ts)
      const mob = quality().tier === 'mobile';
      this.island.setAnisotropy(Math.min(this.renderer.capabilities.getMaxAnisotropy(), mob ? 4 : 16), mob);
    }
    this.island.setNearDetail(this.groundFx);
    this.scene.add(this.island.group);

    this.sky = new SkyLighting(this.scene);

    this.progress(0.90, '描上海岸與礁棚……');
    await yieldToUi(true);
    const landTex = await bakeLandFieldAsync(
      WORLD_BOX.xMin, WORLD_BOX.zMin, WORLD_BOX.xMax, WORLD_BOX.zMax,
      (x, z) => sampleHM(x, z),
      512,
      (p) => this.progress(0.90 + p * 0.03, '描上海岸與礁棚……'),
    );
    this.ocean = new Ocean(landTex, WORLD_BOX);
    this.scene.add(this.ocean.mesh);

    this.progress(0.94, '砌石田埂、地下屋與拼板舟……');
    await yieldToUi(true);
    this.terraces = new TaroTerraces(this.island.flora);
    this.scene.add(this.terraces.group);
    this.island.finishFlora();
    buildShade(this.island.flora.items);

    this.decor = new WorldDecor(this.assets, this.places);
    this.scene.add(this.decor.group);
    this.goats = new GoatHerds(this.places);
    this.scene.add(this.goats.group);
    this.goats.setPeriod(this.state.period);
    // 0.1.4: the parked plane and the moored yacht (own objects, static for now)
    this.scene.add(buildArrivalProps());

    this.post = new PostFX(this.renderer, this.scene, this.camera);
    this.applyAtmosphere();

    this.player = new Player(this.assets);
    this.player.spawn(this.places.yayo.x, this.places.yayo.z);
    this.scene.add(this.player.group);

    this.party = new Party(this.assets);
    this.party.group.visible = false;
    this.scene.add(this.party.group);
    this.quests = new QuestEngine(this.db.questFile);
    this.inv = new Inventory(this.db.items, () => this.quests);
    this.gathering = new Gathering(this.db.gatherNodes);
    this.photos = new PhotoSpots(this.db.photoSpots);
    this.outfits = new Outfits(this.db.outfits, () => this.quests);
    this.ui.codexVM = () => ({
      inv: this.inv,
      outfits: ROLES.flatMap((r) => this.outfits.available(r, this.quests.outfits).map((def) => ({ def, role: r, worn: this.outfits.equipped[r] === def.id }))),
      roleZh: ROLE_ZH,
      onWear: (r, id) => void this.wearOutfit(r, id).then(() => this.refreshJournal()),
      card: this.cardCtx(),
      recipesKnown: this.state.recipes,
    });
    // 0.1.5 cards: every first unlock (word, item, recipe) → a card
    GameState.setFreshHook((kind, ids) => {
      if (kind === 'glossary') this.discover(ids.map((i) => `w:${i}`));
      else if (kind === 'recipes') this.discover(ids.map((i) => `r:${i}`));
      else this.discover(ids.map((i) => `i:${i}`));
    });
    this.inv.onFirst = (id) => this.discover([`i:${id}`]);
    this.recipeSys = new Recipes(
      this.db.recipes,
      this.db.items,
      (id) => this.db.npcs.find((n) => n.id === id)?.name.zh ?? id,
      (id) => this.places[id]?.zh ?? id,
      (id) => {
        const n = this.db.gatherNodes.find((g) => g.id === id);
        return n ? { label: n.label, place: n.place } : null;
      },
    );
    // M5: every finished step's glossary / toast, also auto steps finished inside refresh()
    this.quests.onGives = (g) => {
      if (g.items?.length) sfxSting('item'); // 0.1.4 sound: item collection
      if (g.glossary?.length) {
        const fresh = this.state.unlock(this.state.glossary, g.glossary);
        if (fresh.length && !this.cardsAuto) this.ui.toast('族語詞卡', `學會 ${fresh.length} 詞`);
      }
      if (g.recipe) this.state.unlock(this.state.recipes, [g.recipe]);
      const ing = (g.items ?? []).filter((i) => this.db.items.get(i)?.category === 'ingredient');
      if (ing.length) this.state.unlock(this.state.ingredients, ing);
      g.items?.forEach((i) => this.inv.see(i));
      if (g.outfits?.length) {
        for (const o of g.outfits) void this.outfits.ensure(o, (rel) => this.assets.acquire(rel));
        if (!g.toast && !this.cardsAuto) this.ui.toast('解鎖服裝', g.outfits.map((o) => this.outfits.byId.get(o)?.name.zh ?? o).join('、'));
        this.discover(g.outfits.map((o) => `o:${o}`));
      }
      if (g.toast) this.ui.toast(g.toast[0], g.toast[1]);
    };
    this.quests.onParty = () => this.applyPartyState();
    this.scene.add(this.markerRoot);

    this.addQuestPlaces();
    this.npcs = new NpcSystem(this.assets, this.db.npcs, this.places);
    this.npcs.applySchedule(this.state.period, this.state.season);
    this.scene.add(this.npcs.group);

    this.ui.syncChips(this.state.period, this.state.season, this.state.lang);
  }

  /**
   * 0.1.4: the 搭飛機／搭船 ride in. The painted intro plays (title music + logo) while the island loads
   * (loading bar, lower left). The logo fades first; then the plane banks toward the island or the yacht drives
   * out of frame, the shot fades, the notebook opens on 抵達蘭嶼 and stamps it complete, and the game starts.
   */
  private playArrival(id: PlayableOrigin, gender: Gender, way: ArrivalWay, idF: PlayableOrigin = id): void {
    if (this.arrival) return;
    // the menu loop hands over to the title's epic opening on its next bar line; the logo comes in with it
    const logoAt = segueToTitle();
    const minEnd = logoAt + Math.max(6, titleIntroSeconds());
    this.arrival = { phase: 'intro', t0: performance.now(), id, idF, gender, way, last: 0, logoAt, minEnd, logoOutAt: null, skip: false, tA: 0 };
    if (!this.intro) {
      // (only when the opening is re-run without its backdrop, e.g. a test after a game start)
      this.intro = new IntroScene(window.innerWidth / window.innerHeight);
      void this.intro.load().then(() => this.intro?.setMode(way));
    } else this.intro.setMode(way);
    this.ui.showArrivalIntro(way);
    this.ui.setArrivalLoad(this.loadP, this.worldReady);
    void this.loadWorld((p, label) => {
      this.loadP = p;
      this.loadLabel = label;
    });
  }

  /** one frame of the painted ride (wall-clock time, so it lasts the same on a slow phone) */
  private introFrame(): void {
    const a = this.arrival;
    if (a && a.phase === 'intro') {
      const t = (performance.now() - a.t0) / 1000;
      a.last = t;
      if (this.worldReady && a.skip) {
        this.endArrival();
        return;
      }
      if (this.worldReady && t >= a.minEnd && a.logoOutAt === null) a.logoOutAt = t;
      // (the plane's cloud burst is painted in the intro scene itself: no DOM wash)
      this.ui.setArrivalProgress(0, t >= a.logoAt && a.logoOutAt === null, 0);
      this.ui.setArrivalLoad(this.worldReady ? 1 : this.loadP, this.worldReady, a.skip);
      // logo fading → the plane banks / the yacht drives off → fade → notebook
      if (a.logoOutAt !== null && t >= a.logoOutAt + 0.6 && this.intro && !this.intro.pushing) this.intro.startFinale();
      if (a.logoOutAt !== null && (this.intro ? this.intro.finished : t >= a.logoOutAt + 1.1)) {
        this.startNotebook();
        return;
      }
    }
    this.intro?.render(this.renderer);
  }

  private memSnapshot(): Record<string, number> {
    const m = this.renderer.info.memory;
    const pm = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return { geometries: m.geometries, textures: m.textures, programs: this.renderer.info.programs?.length ?? 0, heapMB: pm ? +(pm.usedJSHeapSize / 1048576).toFixed(1) : -1 };
  }

  /** drop the painted intro scene completely (geometry, materials, textures; it renders straight to the canvas,
   * so there is no render target of its own) */
  private disposeIntro(): void {
    if (!this.intro) return;
    this.introMem.before = this.memSnapshot();
    this.intro.dispose();
    this.intro = null;
    this.renderer.renderLists.dispose();
    this.introMem.after = this.memSnapshot();
  }

  /** the painted ride has faded: spawn at the start, open the quest log, stamp 抵達蘭嶼 */
  private startNotebook(): void {
    const a = this.arrival;
    if (!a || a.phase === 'notebook') return;
    this.ui.arrivalCut();
    this.disposeIntro();
    if (this.arrivalPeriod === null) this.arrivalPeriod = this.state.period;
    this.begin(a.id, a.gender, 'm', a.way, true, a.idF);
    this.coverHold = true;
    a.phase = 'notebook';
    a.tA = performance.now();
    a.stamped = false;
    this.ui.openJournalTab('quests');
    this.ui.hideArrivalIntro();
  }

  /** one frame of the arrival notebook beat */
  private notebookFrame(): void {
    const a = this.arrival;
    if (!a || a.phase !== 'notebook') return;
    const t = (performance.now() - a.tA) / 1000;
    if (!a.stamped && t >= 0.45) {
      a.stamped = true;
      this.ui.stampQuestDone('Q01');
    }
    if (a.skip && t >= 0.2) {
      this.finishNotebook();
      return;
    }
    if (t >= 2.5 && !this.nbHold) this.finishNotebook();
  }

  /** 0.1.5 tests / recordings: keep the arrival notebook open (a slow headless GPU spends its 2.5 s on the first frames) */
  private nbHold = false;

  /** close the notebook and play Q01's arrival lines (culture statement + scooter-rental guidance) */
  private finishNotebook(): void {
    const a = this.arrival;
    if (!a) return;
    this.setOverlay('journal', false);
    this.arrival = null;
    if (this.arrivalPeriod !== null) {
      this.state.period = this.arrivalPeriod;
      this.arrivalPeriod = null;
      this.applyAtmosphere();
    }
    this.camFy = null;
    this.coverHold = false;
    this.ui.hideArrivalIntro();
    const q1 = this.quests.get('Q01');
    const st = q1 ? this.quests.step(q1) : null;
    if (q1 && st) this.runStep(q1, st, null);
    this.questDirty = true;
    this.saveNow();
    this.input.consumeInteract();
  }

  /** skip: while loading, wait; during the painted ride, jump to the notebook; during the notebook, start the game */
  private endArrival(): void {
    const a = this.arrival;
    if (!a) return;
    if (a.phase === 'notebook') {
      this.finishNotebook();
      return;
    }
    if (!this.worldReady) {
      a.skip = true;
      return;
    }
    this.startNotebook();
  }

    /** 繼續旅程 with the intro on: the island may not be loaded yet */
  private async continueSaved(): Promise<void> {
    const sv = readSave();
    if (!sv) return;
    if (!this.worldReady) {
      this.ui.showBootLoading();
      await this.loadWorld((p, label) => this.ui.setLoad(p, label));
    }
    this.disposeIntro();
    this.resume(sv);
  }

  /**
   * New game. The party is fixed (族男 + 族女 + traveller); `id` is the 族男's village, which is also the 主人家
   * (where the party stays); `idF` is the 族女's village (0.1.5: may differ; omitted = the same village).
   * `lead` = who is controlled first (new games and the arrival opening start with the 族男).
   * Debug / older scripts may still pass a different lead; omitted lead also defaults to the 族男.
   */
  private begin(id: PlayableOrigin, gender: Gender = this.state.gender, lead?: Role, way: ArrivalWay = 'boat', holdTalk = false, idF: PlayableOrigin = id): void {
    const T = this.content.text;
    try {
      const home = id === 'visitor' ? 'yayo' : id;
      const homeF = idF === 'visitor' ? 'yayo' : idF;
      if (!this.places[home]) throw new Error(`no home village ${home}`);
      if (!this.places[homeF]) throw new Error(`no home village ${homeF}`);
      const controlled: Role = lead ?? 'm';
      this.closeAll();
      // S3: a fresh journal (nothing left over from an earlier or half-loaded run); keep the language setting
      Object.assign(this.state, new GameState(), { lang: this.state.lang, period: this.state.period, season: this.state.season });
      this.state.gender = gender === 'f' ? 'f' : 'm';
      this.state.origin = home;
      this.state.originM = home;
      this.state.originF = homeF;
      this.state.arrival = way === 'plane' ? 'plane' : 'boat';
      this.state.started = true;
      this.setHostPlaces();
      if (this.state.unlockMilestone('arrive')) sfxSting('milestone');
      // 0.1.4: the whole party starts where it arrived: 開元港 (boat) or beside the 蘭嶼機場 runway (plane)
      const sp = arrivalSpawn(this.state.arrival, this.places.harbor);
      this.player.group.visible = true;
      this.player.setScooter(false);
      this.player.spawn(sp.x, sp.z);
      this.player.yaw = sp.yaw;
      this.party.setup(this.assets, this.partyOutfits(), controlled, this.player);
      this.party.group.visible = true;
      this.player.setOutfit(this.assets, this.roleOutfit(controlled));
      this.camYaw = CAM_DEFAULT.yaw;
      this.camPitch = CAM_DEFAULT.pitch;
      this.camDist = CAM_DEFAULT.dist;
      this.ui.setScooter(this.player.scooter);
      this.focus = null;
      this.snapCam = true;
      this.activity = 'explore';
      this.ui.hideOverlaysStart();
      this.quests.reset();
      this.quests.flags.add('party_created');
      this.quests.flags.add(`arrived_${this.state.arrival}`); // Q01's lines (StepLine.if) follow the choice
      this.memberKey = {};
      this.syncStay(false);
      this.syncQuestCtx();
      this.quests.refresh();
      this.refreshPartyUi();
      if (!holdTalk) {
        const q1 = this.quests.get('Q01');
        const st = q1 ? this.quests.step(q1) : null;
        if (q1 && st) this.runStep(q1, st, null);
      }
      this.questDirty = true;
      this.saveNow();
    } catch (err) {
      console.error(err);
      this.state.started = false;
      this.activity = 'cover';
      this.ui.showOrigin();
      this.ui.toast(T.startErrorTitle, T.startErrorBody);
    }
  }

  /** continue from the autosave (party, quests, inventory, journal) */
  private resume(sv: SaveJSON): void {
    try {
      this.closeAll();
      const st = GameState.fromJSON(sv.state);
      Object.assign(this.state, st);
      this.state.started = true;
      this.setHostPlaces();
      this.quests.load(sv.quests);
      this.seedCards();
      const c: Role = ROLES.includes(sv.party.controlled) ? sv.party.controlled : 't';
      const pos0 = sv.party.pos ?? ({} as SaveJSON['party']['pos']);
      // 0.1.4: a save from the old oval island keeps each member near the same village on the new map
      // 0.1.5: a 0.1.4 save (world 2) keeps each member near the same village / facility on the bigger island
      const rev = sv.world ?? 1;
      // 0.1.6: a 0.1.5 save (world 3) follows 紅頭 / 漁人 to their new spots
      const remap = rev < 2 ? remapSavePos : rev < 3 ? remapSavePos014 : rev < WORLD_REV ? remapSavePos015 : null;
      const pos = remap
        ? (Object.fromEntries(Object.entries(pos0).map(([r, p]) => [r, p ? remap(p.x, p.z) : p])) as SaveJSON['party']['pos'])
        : pos0;
      const me = pos[c] ?? { x: this.places.harbor.x, z: this.places.harbor.z };
      this.player.group.visible = true;
      this.player.setScooter(false);
      this.player.spawn(me.x, me.z);
      this.party.setup(this.assets, this.partyOutfits(), c, this.player, pos);
      this.party.group.visible = true;
      this.player.setOutfit(this.assets, this.roleOutfit(c));
      // worn outfits: load their art (missing art keeps the everyday look), then dress everyone
      const worn = Object.values(this.quests.wear).filter((x): x is string => !!x);
      if (worn.length) void Promise.all(worn.map((id) => this.outfits.ensure(id, (rel) => this.assets.acquire(rel)))).then(() => this.applyOutfits());
      if (sv.party.scooter && this.quests.flags.has('has_scooter')) this.player.setScooter(true);
      this.ui.setScooter(this.player.scooter);
      this.camYaw = CAM_DEFAULT.yaw;
      this.camPitch = CAM_DEFAULT.pitch;
      this.camDist = CAM_DEFAULT.dist;
      this.focus = null;
      this.snapCam = true;
      this.activity = 'explore';
      this.ui.hideOverlaysStart();
      this.setPeriod(this.state.period);
      this.setSeason(this.state.season);
      this.setLang(this.state.lang);
      this.syncQuestCtx();
      this.handleQuestEvents(this.quests.refresh(), true); // M4: silent, but marks the log dirty
      // party split: members stay where the save put them (no re-placing at their task spot)
      this.memberKey = {};
      this.syncStay(false);
      if (this.quests.memberBlock(c)) this.applyPartyState();
      this.refreshPartyUi();
      this.questDirty = true;
      this.ui.toast('讀取存檔', '從上次的地方繼續');
    } catch (err) {
      console.error(err);
      this.ui.toast('存檔讀取失敗', '這個存檔讀不到，重新開始一段旅程吧。');
      // S3: do not leave a half-loaded journal behind
      Object.assign(this.state, new GameState(), { lang: this.state.lang });
      this.quests.reset();
      this.state.started = false;
      this.activity = 'cover';
      this.ui.showOrigin();
    }
  }

  private setPeriod(p: Period): void {
    // gathering: daily limits reset when the night ends
    if (this.quests && Gathering.newDay(this.state.period, p)) this.gathering.resetDay(this.quests.counters);
    this.state.period = p;
    this.state.seenTimes.add(p);
    if (this.state.seenTimes.size === 4) this.maybeMilestone('all-times', this.content.text.allTimesTitle, this.content.text.allTimesBody);
    this.applyAtmosphere();
    this.npcs.applySchedule(p, this.state.season);
    this.goats?.setPeriod(p);
    this.ui.syncChips(p, this.state.season, this.state.lang);
    this.onClockChange();
  }

  private setSeason(s: Season): void {
    this.state.season = s;
    this.state.seenSeasons.add(s);
    if (this.state.seenSeasons.size === 4) this.maybeMilestone('all-seasons', this.content.text.allSeasonsTitle, this.content.text.allSeasonsBody);
    this.applyAtmosphere();
    this.npcs.applySchedule(this.state.period, s);
    this.ui.syncChips(this.state.period, s, this.state.lang);
    this.onClockChange();
  }

  /** time / season changed: quest conditions (tide, night, season) and the tide pill update at once */
  private onClockChange(): void {
    if (!this.quests) return;
    this.syncQuestCtx();
    this.questDirty = true;
  }

  private applyAtmosphere(): void {
    const p = this.state.period;
    const s = this.state.season;
    this.sky.apply(p, s, this.scene);
    const pre = PRESETS[p];
    this.ocean.apply(pre, p, s);
    // 0.1.5: character / boat sprite shadows face the same sun as the rest of the scene
    setSpriteSunYaw(Math.atan2(pre.sunDir.x, pre.sunDir.z));
    this.island.setSeason(s);
    this.decor.applyTime(p, s);
    this.goats?.setPeriod(p);
    this.terraces.apply({ zenith: pre.zenith, horizon: pre.horizon, sunDir: pre.sunDir, sunColor: pre.sunColor, night: p === 'night' ? 1 : p === 'dusk' ? 0.5 : 0 });
    this.renderer.toneMappingExposure = pre.exposure;
    if (this.post.bloom) {
      this.post.bloom.strength = pre.bloom * (worldStyle() === 'watercolor' ? PAINT.bloom : 1);
      this.post.bloom.threshold = p === 'night' ? 0.55 : p === 'dusk' ? 0.72 : 0.86;
    }
    if (this.post.grade) {
      const look = seasonLook(s); // src/render/styleConfig.ts
      this.post.grade.uniforms.uWarm.value = p === 'dusk' ? 0.6 : p === 'dawn' ? 0.35 : look.warm;
      this.post.grade.uniforms.uSat.value = look.sat;
      this.post.grade.uniforms.uVignette.value = worldStyle() === 'watercolor' ? PAINT.vignette : 0.28;
    }
    setPaintLook(p, s);
    document.documentElement.dataset.period = p;
    document.documentElement.dataset.season = s;
  }

  private setLang(m: LangMode): void {
    this.state.lang = m;
    writeStoredLang(m);
    this.ui.syncLang(m);
    if (this.dlgQueue.length) {
      const cur = this.dlgQueue[0];
      this.ui.openDialogue(cur.who, cur.zh, cur.tao, m, this.dlgQueue.length === 1, cur.portrait);
    }
    if (this.state.started) this.saveNow();
  }

  private maybeMilestone(id: string, title: string, body: string): void {
    if (this.state.unlockMilestone(id)) {
      sfxSting('milestone');
      this.ui.toast(title, body);
    }
  }

  private applyUnlocks(u?: DialogueUnlocks): void {
    if (!u) return;
    const st = this.state;
    const T = this.content.text;
    const g = st.unlock(st.glossary, u.glossary);
    const r = st.unlock(st.recipes, u.recipes);
    const i = st.unlock(st.ingredients, u.ingredients);
    st.unlock(st.milestones, u.milestones);
    const bits: string[] = [];
    if (g.length) bits.push(fmt(T.journalGlossary, { n: g.length }));
    if (r.length) bits.push(T.journalRecipes);
    if (i.length) bits.push(T.journalIngredients);
    if (bits.length) this.ui.toast(T.journalUpdateTitle, bits.join(' · '));
  }

  private openLines(who: string, lines: { zh: string; tao: string }[], unlocks?: DialogueUnlocks, portrait?: string): void {
    this.dlgQueue = lines.map((l, i) => ({
      who,
      portrait,
      zh: l.zh,
      tao: l.tao,
      unlocks: i === lines.length - 1 ? unlocks : undefined,
    }));
    this.showCurrentLine();
  }

  private showCurrentLine(): void {
    const cur = this.dlgQueue[0];
    if (!cur) {
      this.ui.closeDialogue();
      this.activity = 'explore';
      return;
    }
    this.activity = 'dialogue';
    this.ui.openDialogue(cur.who, cur.zh, cur.tao, this.state.lang, this.dlgQueue.length === 1, cur.portrait);
  }

  private advanceDialogue(): void {
    const cur = this.dlgQueue.shift();
    if (cur?.unlocks) this.applyUnlocks(cur.unlocks);
    if (this.dlgQueue.length) this.showCurrentLine();
    else {
      this.ui.closeDialogue();
      this.audioSceneQuest = null; // audio scene ends with its dialogue
      if (this.activity === 'dialogue') this.activity = 'explore';
      const cb = this.afterDialogue;
      this.afterDialogue = null;
      cb?.();
    }
  }

  /** every layer that should swallow world interaction and movement */
  private isModalOpen(): boolean {
    return this.mode !== 'explore' || this.diveOpen || !!this.cards?.open;
  }

  /** close every modal layer: mini-game, dialogue queue, journal, travel sheet, help */
  private closeAll(): void {
    if (this.mg) this.cancelMinigame();
    if (this.diveOpen) {
      closeImagePopup(); // the dive counts as seen; playDive finishes the step
      this.diveOpen = false; // 0.1.5: closed now (playDive's await settles a tick later; switching must not wait for it)
    }
    this.dlgQueue = [];
    this.afterDialogue = null;
    this.ui.closeDialogue();
    this.cards?.clear();
    this.overlay = null;
    this.ui.renderOverlay(null);
    this.ui.dismissHelpToast();
    if (this.activity !== 'cover') this.activity = 'explore';
  }

  /** closest NPC (preferred) or decor interactable in reach, shared by the prompt and the interact action */
  private nearestTarget(): { npc: NpcActor } | { spot: { q: QuestDef; st: QuestStep; sub: number } } | { gather: LiveNode } | { it: WorldDecor['interactables'][number] } | null {
    const px = this.player.x;
    const pz = this.player.z;
    const npc = this.npcs.nearest(px, pz, 2.4);
    // nearest gather spot in range (貝類 / 海菜 share the 東清 shore)
    const g = this.gatherSpots().filter((s) => Math.hypot(s.x - px, s.z - pz) <= s.r).sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked) || Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))[0];
    // a passer-by wandering over a gather node must not block it (they only have small talk)
    if (npc && !(g && npc.def.role === 'passerby')) return { npc };
    const spot = this.nearestQuestSpot(px, pz);
    // quest spots have wide radii (8–12 m) and would swallow the small gather nodes inside them:
    // a gather node wins when the quest step can't run now, or when the player stands closer to the node
    if (spot && g && (!spot.ready || Math.hypot(g.x - px, g.z - pz) < spot.d)) return { gather: g };
    if (spot) return { spot };
    if (g) return { gather: g };
    let best: WorldDecor['interactables'][number] | null = null;
    let bestD = Infinity;
    for (const it of this.decor.interactables) {
      const d = Math.hypot(it.x - px, it.z - pz);
      if (d <= it.r && d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best ? { it: best } : null;
  }

  private tryInteract(): void {
    if (!this.state.started || this.isModalOpen()) return;
    const near = this.nearestTarget();
    if (near && 'npc' in near) {
      this.talkToNpc(near.npc);
      return;
    }
    if (near && 'spot' in near) {
      this.useQuestSpot(near.spot.q, near.spot.st, near.spot.sub);
      return;
    }
    if (near && 'gather' in near) {
      this.useGatherNode(near.gather);
      return;
    }
    if (near) {
      const T = this.content.text;
      if (near.it.kind === 'clinic') this.runInteract('clinic_nutrition', T.clinicWho, 'nurse');
      else if (near.it.kind === 'taro') this.startMinigame('taro');
      else if (near.it.kind === 'fish') this.handleFish();
      else if (near.it.kind === 'look') this.runInteract('jimagaod_look', T.lookWho, this.protagonistPortrait());
      else this.ui.toast(near.it.label, T.placeHint);
    }
  }

  private tintList: SpriteBillboard[] = [];
  private tintBox: { s: SpriteBillboard; x0: number; x1: number; y0: number; y1: number; d: number }[] = [];
  private readonly tv = new THREE.Vector3();
  /**
   * Per-frame tint for the unlit character sprites (one colour uniform each, no extra passes):
   * shade zones (eaves, building sides, tree canopies) → ~0.75; when two characters overlap on
   * screen, the one farther from the camera → ~0.85 so the player can tell who is who.
   */
  private updateCharacterTint(dt: number): void {
    const list = this.tintList;
    list.length = 0;
    const p = this.player;
    list.push(p.mode === 'scooter' ? p.rideSprite : p.mode === 'canoe' ? p.canoeSprite : p.sprite);
    for (const a of this.npcs.actors) if (a.sprite?.mesh.visible) list.push(a.sprite);
    if (this.state.started) this.party.sprites(list);
    const cam = this.camera;
    const boxes = this.tintBox;
    boxes.length = 0;
    // gentle size compensation with zoom (feet-anchored, visual only; collision unchanged)
    const zs = this.state.started ? charZoomScale(this.camDist) : 1;
    for (const s of list) {
      if (s.mesh.scale.x !== zs) s.mesh.scale.setScalar(zs);
    }
    for (const a of this.npcs.actors) if (a.sprite && !a.sprite.mesh.visible && a.sprite.mesh.scale.x !== zs) a.sprite.mesh.scale.setScalar(zs);
    for (const s of list) {
      const m = s.mesh.position;
      s.shade = s === p.canoeSprite ? 0 : shadeAt(m.x, m.z);
      s.behind = false;
      // screen-space rectangle of the figure (≈ 45% of the frame wide, ≈ 72% of it tall)
      const v = this.tv.set(m.x, m.y, m.z).applyMatrix4(cam.matrixWorldInverse);
      const d = -v.z;
      if (d < 0.5 || d > 45) continue;
      const hw = (s.worldW * zs * 0.22) / d;
      const sx = v.x / d;
      const y0 = v.y / d;
      this.tv.set(m.x, m.y + s.worldH * zs * 0.72, m.z).applyMatrix4(cam.matrixWorldInverse);
      const y1 = this.tv.y / -this.tv.z;
      boxes.push({ s, x0: sx - hw, x1: sx + hw, y0: Math.min(y0, y1), y1: Math.max(y0, y1), d });
    }
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j];
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (ox <= 0.25 * Math.min(a.x1 - a.x0, b.x1 - b.x0) || oy <= 0) continue;
        if (Math.abs(a.d - b.d) < 0.15) continue;
        (a.d > b.d ? a : b).s.behind = true;
      }
    }
    for (const s of list) s.applyTint(dt);
  }

  /** controlled member → player sheet (walk / ride_ / canoe_ share the name) */
  private playerOutfit(): string {
    return this.roleOutfit(this.party?.controlled ?? 't');
  }

  private roleOutfit(r: Role): string {
    return this.outfits.look(r, { sheet: this.baseOutfit(r), portrait: this.basePortrait(r) }, this.state.gender === 'f' ? 'f' : 'm').sheet;
  }

  private baseOutfit(r: Role): string {
    if (r === 'm') return 'player';
    if (r === 'f') return 'player_f';
    return this.state.gender === 'f' ? 'player_visitor_f' : 'player_visitor';
  }

  private partyOutfits(): Record<Role, string> {
    return { m: this.roleOutfit('m'), f: this.roleOutfit('f'), t: this.roleOutfit('t') };
  }

  private protagonistPortrait(): string {
    return this.rolePortrait(this.party?.controlled ?? 't');
  }

  /** Painted portraits: 族男 local / 族女 local_f; traveller visitor_m / visitor (old 外國 saves migrate in GameState.fromJSON). */
  private rolePortrait(r: Role): string {
    return this.outfits.look(r, { sheet: this.baseOutfit(r), portrait: this.basePortrait(r) }, this.state.gender === 'f' ? 'f' : 'm').portrait;
  }

  private basePortrait(r: Role): string {
    if (r === 'm') return 'local';
    if (r === 'f') return 'local_f';
    return this.state.gender === 'f' ? 'visitor' : 'visitor_m';
  }

  /** wear an unlocked outfit (null = everyday clothes); swaps the sprite and the portrait, falls back when art is missing */
  private async wearOutfit(r: Role, id: string | null): Promise<boolean> {
    if (id) await this.outfits.ensure(id, (rel) => this.assets.acquire(rel));
    if (!this.outfits.equip(r, id, this.quests.outfits)) return false;
    this.applyOutfits();
    this.saveNow();
    return true;
  }

  private applyOutfits(): void {
    if (!this.state.started) return;
    const c = this.party.controlled;
    this.player.setOutfit(this.assets, this.roleOutfit(c));
    for (const f of this.party.followers) if (f.role) f.assign(this.assets, f.role, this.roleOutfit(f.role));
    this.refreshPartyUi();
  }

  /** board / leave a tatala (debug hook today; the tatala quest line will call this) */
  private setCanoe(on: boolean, at?: { x: number; z: number }): boolean {
    const ok = this.player.setCanoe(on, at);
    this.ui.setScooter(this.player.scooter);
    return ok;
  }

  private runInteract(id: string, fallbackWho: string, portrait?: string, preferWho = false): void {
    if (id === 'auto-fish') {
      this.handleFish();
      return;
    }
    if (id === 'taro_intro') {
      this.startMinigame('taro');
      return;
    }
    const node = this.dialogueNode(id);
    if (!node) {
      // first talk: the set's intro node (its words / milestones), until everything it teaches is learned
      const intro = this.dlg.get(id)?.intro;
      const iNode = intro ? this.dialogueNode(intro) : undefined;
      if (iNode && (iNode.unlocks?.glossary ?? []).some((w) => !this.state.glossary.has(w))) {
        this.openLines(preferWho ? fallbackWho : iNode.speaker?.zh || fallbackWho, iNode.lines, iNode.unlocks, portrait);
        return;
      }
      const lines = this.npcChat(id);
      if (lines.length) {
        this.openLines(fallbackWho, lines.map((l) => ({ zh: l.zh, tao: l.tao ?? '' })), undefined, portrait);
        return;
      }
      this.openLines(fallbackWho, [{ zh: this.content.text.fallbackLine, tao: '' }], undefined, portrait);
      return;
    }
    const who = preferWho ? fallbackWho : node.speaker?.zh || fallbackWho;
    this.openLines(who, node.lines, node.unlocks, portrait);
  }

  /** chat lines of an NPC dialogue set (greet / duty / idle by time and season / after-quest / recipe keeper) */
  private npcChat(id: string): { zh: string; tao?: string }[] {
    const set = this.dlg.get(id);
    if (!set) return [];
    const turn = this.chatTurn.get(id) ?? 0;
    this.chatTurn.set(id, turn + 1);
    const npc = set.npc;
    const ks = npc ? this.recipeSys.keeperState(npc, this.recipeCtx()) : null;
    const learned = npc ? this.db.recipes.some((r) => r.keeper === npc && this.state.recipes.has(r.id)) : false;
    return this.dlg.chat(id, {
      time: this.state.period === 'night' ? 'night' : 'day',
      season: seasonTag(this.state.season),
      done: (q) => this.quests.done.has(q),
      keeper: ks || learned ? { active: !!ks, learned, missing: ks ? Object.entries(ks.missing).map(([i, n]) => `${this.inv.name(i)} ×${n}`).join('、') : '' } : null,
      turn,
    });
  }

  /** a legacy dialogue node by id (notes / origins, NPC sets and unknown ids → undefined) */
  private dialogueNode(id: string): DialogueNode | undefined {
    return this.dlg.node(id) as DialogueNode | undefined;
  }

  private handleFish(): void {
    const fisher = this.content.text.fisherWho;
    if (this.state.season === 'rayon') {
      const node = this.dialogueNode('fish_rayon');
      if (!node) return;
      this.openLines(node.speaker?.zh || fisher, node.lines, undefined, 'villager_harbor');
      // the mini-game starts when this dialogue ends, however it is advanced (button, E/Space/Enter)
      this.afterDialogue = () => this.startMinigame('fish');
      return;
    }
    const key = this.state.season === 'meyvanwa' ? 'fish_meyvanwa' : 'fish_closed';
    const node = this.dialogueNode(key);
    if (!node) return;
    this.openLines(node.speaker?.zh || fisher, node.lines, node.unlocks, 'villager_harbor');
  }

  private startMinigame(kind: 'taro' | 'fish', done?: (ok: boolean) => void): void {
    this.mg = { kind, t: 0.08, dir: 1, s0: 0.62, s1: 0.78 };
    this.mgDone = done ?? null;
    const m = this.content.minigames[kind];
    this.activity = 'minigame';
    this.ui.openMinigame(m.title, m.desc);
    if (this.mgAuto) {
      this.mgAuto = false;
      this.mg.t = (this.mg.s0 + this.mg.s1) / 2;
      this.hitMinigame();
    }
  }

  private cancelMinigame(): void {
    const done = this.mgDone;
    this.mgDone = null;
    this.mg = null;
    this.ui.closeMinigame();
    if (this.activity === 'minigame') this.activity = 'explore';
    // closing a quest mini-game counts as a miss (the sea trip steps ashore)
    if (done && this.player.mode === 'canoe') this.setCanoe(false);
  }

  private hitMinigame(): void {
    if (!this.mg) return;
    const ok = this.mg.t >= this.mg.s0 && this.mg.t <= this.mg.s1;
    const m = this.content.minigames[this.mg.kind];
    const kind = this.mg.kind;
    const done = this.mgDone;
    this.mgDone = null;
    this.cancelMinigame();
    if (done) {
      done(ok);
      return;
    }
    if (ok) {
      // recipes: every success is one ingredient in the bag (水芋 from the taro field, 飛魚 from the fishing spot)
      this.addIngredient(kind === 'taro' ? 'soli' : 'alibangbang', 1, kind === 'taro' ? '水芋田採收' : '捕飛魚體驗');
      const st = this.state;
      st.unlock(st.ingredients, m.unlocks.ingredients);
      st.unlock(st.glossary, m.unlocks.glossary);
      this.maybeMilestone(m.milestone.id, m.milestone.title, m.milestone.body);
      this.ui.toast(m.success.title, m.success.body);
    } else {
      this.ui.toast(m.fail.title, m.fail.body);
    }
  }

  // ------------------------------------------------------------------ party + quests (Phase 1 batch 1)

  /** shop / school in 椰油 and the rental near 開元港: derived spots for the new quest NPCs */
  private addQuestPlaces(): void {
    addQuestPlaces(this.places);
    this.setHostPlaces();
  }

  private syncQuestCtx(): void {
    this.quests.setCtx({ season: this.state.season, period: this.state.period, words: this.state.glossary.size });
  }

  private refreshPartyUi(): void {
    const E = this.quests;
    this.ui.setParty(ROLES.map((r) => ({
      role: r,
      label: ROLE_ZH[r],
      portrait: this.rolePortrait(r),
      active: r === this.party.controlled,
      status: this.memberStatus(r),
      away: E.members[r].st !== 'party',
      locked: r !== this.party.controlled && !!E.memberBlock(r),
    })));
    // split banner: regroup point + who is where; 放棄出海 while a solo trip runs
    if (E.isSplit()) {
      const away = ROLES.filter((r) => E.members[r].st !== 'party').map((r) => `${ROLE_ZH[r]}：${this.memberStatus(r)}`);
      const meet = E.meet ? `集合點：${this.placeZh(E.meet)}｜` : '';
      this.ui.setSplit(`${E.solo ? `只能操控${ROLE_ZH[E.solo]}｜` : '分頭行動｜'}${meet}${away.join('；')}`, !!E.solo);
    } else this.ui.setSplit(null, false);
  }

  private placeZh(id?: string): string {
    if (!id) return '';
    // places first, then landmarks (e.g. dasenshan → 大森山); never show a raw id to players
    return this.places[id]?.zh ?? this.photos.resolve({ places: this.places, landmarks: LANDMARKS }, id)?.zh ?? '';
  }

  /** HUD line for a member: 在隊上 / 離隊：task（place） / 在 place 等 */
  private memberStatus(r: Role): string {
    const m = this.quests.members[r];
    if (m.st === 'party') return '在隊上';
    if (m.st === 'wait') return `在${this.placeZh(m.at)}等${m.task && !/等|^wait/i.test(m.task) ? `（${m.task}）` : ''}`;
    return `離隊：${m.task ?? ''}${m.at ? `（${this.placeZh(m.at)}）` : ''}`;
  }

  /** the a akes (女性長輩) of a village: npcs.json elder 'f' (quests.json elders.f) */
  private hostFemaleId(v: string = this.homes().host): string {
    return elderF(v, this.quests.file.elders);
  }

  /** 0.1.5: 族男's / 族女's village and the 主人家 (unknown or missing → 椰油) */
  private homes(): Homes {
    const s = this.state;
    const v = (x: string | null | undefined, d: VillageId): VillageId => (isVillage(x) ? x : d);
    const host = v(s.origin, 'yayo');
    return { m: v(s.originM, host), f: v(s.originF, host), host };
  }

  /** who an NPC token in quest data means: @host = the host family's elder, @hostf = the host village's a akes, @giver = the quest's 女／男耆老 */
  private npcFor(token: string | undefined, q: QuestDef): string {
    // quests are resolved for the party's homes at start / load (resolveQuests); tokens left here use the same rule
    if (token?.startsWith('@')) return tokenNpc(token, q, questHome(q, this.homes()), this.homes(), this.quests.file.elders) ?? token;
    return token ?? '';
  }

  private giverId(q: QuestDef): string {
    return tokenNpc('@giver', q, questHome(q, this.homes()), this.homes(), this.quests.file.elders)!;
  }

  /**
   * Party split (docs/phase1/PARTY_SPLIT.md): pin away / waiting followers, send newly away ones to their place,
   * keep control on a member who may act (solo → the solo member; busy → someone in the party), refresh the HUD.
   */
  private applyPartyState(): void {
    if (!this.party || !this.state.started) return;
    const E = this.quests;
    const me = this.party.controlled;
    if (E.memberBlock(me)) {
      const next = E.solo ?? ROLES.find((r) => r !== me && !E.memberBlock(r));
      if (next && next !== me) {
        const why = E.members[me].st !== 'party' ? `${ROLE_ZH[me]}${this.memberStatus(me)}` : '';
        this.takeControl(next);
        this.ui.toast(`換成${ROLE_ZH[next]}`, why || '');
      }
    }
    this.syncStay(true);
    this.refreshPartyUi();
    this.questDirty = true;
  }

  /** followers: away / waiting members (or everyone, when the leader is away) stay put; changed ones go to their place */
  private syncStay(move: boolean): void {
    const E = this.quests;
    const leaderAway = E.members[this.party.controlled].st !== 'party';
    for (const f of this.party.followers) {
      const m = E.members[f.role];
      f.stay = m.st !== 'party' || leaderAway;
      const key = `${m.st}|${m.at ?? ''}`;
      const prev = this.memberKey[f.role];
      this.memberKey[f.role] = key;
      if (!move || prev === key || m.st === 'party' || !m.at) continue;
      // a switchable away member who just stopped being controlled keeps standing where the player left them;
      // busy members and those who finished their part (wait) go to their place / the regroup point
      if (prev === undefined && m.st === 'away' && m.ctrl) continue;
      const p = this.places[m.at];
      if (!p) continue;
      const k = ROLES.indexOf(f.role);
      f.place(p.x + Math.cos(k * 2.1) * 1.6, p.z + Math.sin(k * 2.1) * 1.6, 0);
    }
    if (move && !leaderAway) {
      // members back in the party rejoin the leader
      const back = this.party.followers.filter((f) => !f.stay && Math.hypot(f.x - this.player.x, f.z - this.player.z) > 12);
      if (back.length) this.party.snapAround(this.player);
    }
  }

  /** 放棄出海: the solo member gives up and everyone regroups (the quest goes back to its abortTo step) */
  private abortSolo(): void {
    if (!this.quests.solo) return;
    if (this.mg) this.cancelMinigame();
    if (this.player.mode === 'canoe') this.setCanoe(false);
    const q = this.quests.abortSolo();
    this.ui.toast('放棄出海', q ? `「${q.name.zh}」已回到上一步` : '已在岸邊會合');
    this.party.snapAround(this.player);
    this.questDirty = true;
    this.saveNow();
  }

  /** take control of another member: the player swaps place / outfit with that follower */
  private switchMember(role: Role): void {
    if (!this.state.started || !this.party || role === this.party.controlled) return;
    if (this.isModalOpen()) return;
    const block = this.quests.memberBlock(role);
    if (block) {
      this.ui.toast(`不能換成${ROLE_ZH[role]}`, block);
      return;
    }
    if (this.player.mode === 'canoe') {
      this.ui.toast('先上岸', '划船的時候不能換人');
      return;
    }
    this.takeControl(role);
  }

  /** swap control (no rule checks): together → swap places; split → the camera jumps to that member's place */
  private takeControl(role: Role): void {
    const f = this.party.follower(role);
    if (!f) return;
    if (this.player.mode === 'canoe') this.setCanoe(false);
    const E = this.quests;
    const old = this.party.controlled;
    const together = E.members[role].st === 'party' && E.members[old].st === 'party';
    const ox = this.player.x;
    const oz = this.player.z;
    const oyaw = this.player.yaw;
    this.player.spawn(f.x, f.z);
    this.player.yaw = f.yaw;
    this.player.setOutfit(this.assets, this.roleOutfit(role));
    f.assign(this.assets, old, this.roleOutfit(old));
    f.place(ox, oz, oyaw);
    this.party.controlled = role;
    this.party.resetTrail(this.player);
    delete this.memberKey[role];
    delete this.memberKey[old];
    this.syncStay(true);
    this.focus = null;
    if (!together) {
      this.snapCam = true;
      this.ui.toast(`切換到${ROLE_ZH[role]}`, E.members[role].st === 'party' ? '' : this.memberStatus(role));
    }
    this.refreshPartyUi();
    this.questDirty = true;
    this.saveNow();
  }

  /** speaker tokens in quest lines → name + portrait */
  private speaker(who: string, npc: NpcActor | null): { who: string; portrait?: string } {
    if (who === '@npc' && npc) return { who: npc.def.name.zh, portrait: npc.def.portrait };
    if (who === '@me') return { who: ROLE_ZH[this.party.controlled], portrait: this.protagonistPortrait() };
    // NPC ids (content quests name the speaker directly) and @host / @hostf / @giver tokens
    const id = this.speakerNpcId(who, npc);
    if (id) {
      const d = this.npcs.byId(id)?.def ?? this.db.npcs.find((n) => n.id === id);
      if (d) return { who: d.name.zh, portrait: d.portrait };
    }
    if (who === '@m' || who === '@f' || who === '@t') {
      const r = who.slice(1) as Role;
      return { who: ROLE_ZH[r], portrait: this.rolePortrait(r) };
    }
    return { who };
  }

  /** NPC id behind a speaker token (@host 主人家男耆老, @hostf 主人家女耆老, @giver 任務分派的耆老) or an NPC id */
  private speakerNpcId(who: string, npc: NpcActor | null): string | null {
    if (who === '@host') return this.hostId();
    if (who === '@hostf') return this.hostFemaleId();
    // @giver in a line = the elder the player is talking to (the giver's own talk step)
    if (who === '@giver') return npc?.def.id ?? null;
    return this.db.npcs.some((n) => n.id === who) ? who : null;
  }

  private toDlg(lines: StepLine[], npc: NpcActor | null): DlgLine[] {
    return lines.filter((l) => !l.if || this.quests.flags.has(l.if)).map((l) => ({ ...this.speaker(l.who, npc), zh: l.zh, tao: l.tao ?? '' }));
  }

  private openQueue(lines: DlgLine[], after?: () => void): void {
    this.dlgQueue = lines.slice();
    this.afterDialogue = after ?? null;
    this.showCurrentLine();
  }

  /** run a step's dialogue, then complete it (extra lines: Tao hints / translations said in the same talk) */
  private runStep(q: QuestDef, st: QuestStep, npc: NpcActor | null, extra: DlgLine[] = [], onDone?: () => void, sub = -1): void {
    this.audioSceneQuest = q.id; // 0.1.4 audio: manifest decides whether this scene is cultural
    const lines = [...this.toDlg(st.lines ?? [], npc), ...extra];
    const idx = this.quests.active.get(q.id);
    const finish = (): void => {
      onDone?.();
      // S8: only complete the step (member part) that opened this dialogue
      if (this.quests.active.get(q.id) !== idx) return;
      if (sub >= 0 && this.quests.taskDone(q, sub)) return;
      this.completeStep(q, sub);
    };
    if (!lines.length) {
      finish();
      return;
    }
    this.openQueue(lines, finish);
  }

  private completeStep(q: QuestDef, sub = -1): void {
    // glossary / toast via quests.onGives (M5); a member part of a tasks step finishes the step when it is the last one
    const ev = sub >= 0 ? this.quests.completeTask(q, sub) : this.quests.advance(q);
    this.syncQuestCtx();
    ev.push(...this.quests.refresh());
    this.handleQuestEvents(ev);
    for (const e of ev) if (e.type === 'done' && e.q.song) this.playSong(e.q.song);
    this.questDirty = true;
    this.saveNow();
  }

  /** toasts for finished / newly unlocked quests (several unlocks at once → one toast) */
  private handleQuestEvents(ev: QuestEvent[], silent = false): void {
    if (!ev.length) return;
    this.questDirty = true;
    if (silent) return;
    for (const e of ev) if (e.type === 'done' && !e.q.silent && e.q.playable) {
      sfxSting('quest');
      this.ui.toast('任務完成', e.q.name.zh);
    }
    const fresh = ev.filter((e) => e.type === 'unlock' && !e.q.silent).map((e) => e.q);
    this.queueQuestPage(fresh);
    const hidden = fresh.filter((q) => q.hidden);
    for (const q of hidden) this.ui.toast('隱藏任務', q.name.zh);
    const open = fresh.filter((q) => !q.hidden);
    if (open.length === 1) this.ui.toast('新任務', open[0].name.zh);
    else if (open.length > 1) {
      const main = open.filter((q) => q.line === 'main');
      const lead = (main[0] ?? open[0]);
      this.ui.toast('新任務', `${lead.name.zh} 等 ${open.length} 項`);
    }
  }

  /** why the controlled member cannot do this step right now (null = go) */
  private stepBlock(q: QuestDef, st: QuestStep, as?: Role): string | null {
    const role = as ?? this.party.controlled;
    const E = this.quests;
    // party split: a solo trip blocks everything else; quests whose members are all away wait for them
    if (E.solo && E.members[E.solo].quest !== q.id) return `${ROLE_ZH[E.solo]}正在${E.members[E.solo].task ?? '外面'}，先完成或放棄出海再來。`;
    const roles = st.actor ?? q.roles;
    if (!roles.includes(role)) {
      const away = roles.filter((r) => E.memberBlock(r));
      if (away.length && away.length === roles.length) return `${away.map((r) => `${ROLE_ZH[r]}${this.memberStatus(r)}`).join('；')}，暫時不能做這件事。`;
    }
    for (const r of st.requires ?? []) if (E.members[r].st !== 'party') return `${ROLE_ZH[r]}還沒回隊（${this.memberStatus(r)}）。`;
    const dress = this.outfitHint(q);
    if (dress) return dress;
    if (!this.quests.canAct(st, q, role)) return `這件事要請${(st.actor ?? q.roles).map((r) => ROLE_ZH[r]).join('或')}來做。`;
    const w = this.questWindow(q);
    if (!w.ok) return `${w.why}再來吧。`;
    const last = this.quests.active.get(q.id) === q.steps.length - 1;
    const mi = last ? this.quests.missingItem(q) : null;
    if (mi) return `還需要${mi.zh}（${mi.from} 可以取得）。`;
    const need = st.need ?? q.need;
    if (need) {
      const miss = this.missingMembers(need);
      if (miss.length) {
        const away = ROLES.filter((r) => r !== role && E.members[r].st !== 'party' && need.some((n) => n.includes(r)));
        return `還需要${miss.join('、')}一起到場。${away.length ? `（${away.map((r) => `${ROLE_ZH[r]}${this.memberStatus(r)}`).join('；')}）` : ''}`;
      }
    }
    if (st.translate && !this.untranslated().length) return '還沒有聽到只說族語的提示。';
    return null;
  }

  /**
   * 0.1.4: festivals, boat fishing and tribal events start only in Tao clothing (quest requiresOutfit);
   * a friendly zh-TW hint naming who changes into what, or null
   */
  private outfitHint(q: QuestDef): string | null {
    const miss = this.quests.outfitMissing(q);
    if (!miss.length) return null;
    const who = miss.map((m) => `${ROLE_ZH[m.role]}換上${this.outfits.defs.find((d) => d.id === m.outfit)?.name.zh ?? '傳統服飾'}`).join('、');
    return `這是族人的活動，要穿傳統服飾參加：請先讓${who}（手札 → 背包），再來開始。`;
  }

  /** members of `need` (role sets, e.g. ['t', 'mf']) that are not within reach of the controlled member */
  private missingMembers(need: string[]): string[] {
    const pos = this.party.positions(this.player);
    const here = (r: Role): boolean => r === this.party.controlled || Math.hypot(pos[r].x - this.player.x, pos[r].z - this.player.z) < 10;
    const used = new Set<Role>();
    const miss: string[] = [];
    for (const set of [...need].sort((a, b) => a.length - b.length)) {
      const opts = set.split('') as Role[];
      const hit = opts.find((r) => !used.has(r) && here(r));
      if (hit) used.add(hit);
      else miss.push(opts.map((r) => ROLE_ZH[r]).join('或'));
    }
    return miss;
  }

  private untranslated(): QuestDef[] {
    return [...this.quests.heard].filter((id) => !this.quests.translated.has(id)).map((id) => this.quests.get(id)!).filter(Boolean);
  }

  private translateLines(npc: NpcActor | null): DlgLine[] {
    const sp = this.speaker('@npc', npc);
    const out: DlgLine[] = [];
    for (const q of this.untranslated()) {
      const ph = q.hint.phrase ? this.quests.file.phrases[q.hint.phrase] : undefined;
      if (!ph) continue;
      out.push({ ...sp, zh: `「${ph.tao}」是「${ph.zh}」的意思。`, tao: ph.tao });
      out.push({ ...sp, zh: q.hint.zh, tao: '' });
    }
    return out;
  }

  private markTranslated(): void {
    const learned: string[] = [];
    for (const q of this.untranslated()) {
      this.quests.translated.add(q.id);
      const ph = q.hint.phrase ? this.quests.file.phrases[q.hint.phrase] : undefined;
      if (ph) learned.push(...ph.words);
    }
    if (learned.length) this.state.unlock(this.state.glossary, learned);
    this.questDirty = true;
  }

  /** Tao-only hints this NPC gives for active quests (heard once; translation by the 族語老師) */
  private taoHintLines(npc: NpcActor): { lines: DlgLine[]; ids: string[] } {
    const out: DlgLine[] = [];
    const ids: string[] = [];
    for (const [id] of this.quests.active) {
      const q = this.quests.get(id)!;
      if (q.hint.tier !== 'tao' || q.hint.npc !== npc.def.id || this.quests.heard.has(id)) continue;
      const ph = q.hint.phrase ? this.quests.file.phrases[q.hint.phrase] : undefined;
      if (!ph) continue;
      ids.push(id);
      out.push({ who: npc.def.name.zh, portrait: npc.def.portrait, zh: '（長輩只用族語說了一句話。聽不懂……先記進手札，帶去椰油的學校問族語老師。）', tao: ph.tao });
    }
    return { lines: out, ids };
  }

  /** S9: Tao hints count as heard only once the dialogue that showed them has finished */
  private markHeard(ids: string[]): void {
    if (!ids.length) return;
    for (const id of ids) this.quests.heard.add(id);
    this.quests.flags.add('tao_hint_heard');
    this.questDirty = true;
  }

  private hostId(): string {
    return elderM(this.homes().host, this.quests.file.elders);
  }

  /** quest-aware talk: a runnable step wins; otherwise explain what is missing; otherwise the NPC's usual lines */
  private talkToNpc(npc: NpcActor, prefer?: string): void {
    const id = npc.def.id;
    // batch 1b: 第一次見到某人 (U2 needs the dive coach) — refresh so a quest unlocked by meeting is runnable now
    if (!this.quests.flags.has(`met_npc_${id}`)) {
      this.quests.flags.add(`met_npc_${id}`);
      this.handleQuestEvents(this.quests.refresh());
    }
    const cands: { q: QuestDef; st: QuestStep; sub: number }[] = [];
    for (const [qid] of this.quests.active) {
      const q = this.quests.get(qid)!;
      for (const o of this.quests.openSteps(q)) {
        if (o.st.kind === 'talk' && this.npcFor(o.st.npc, q) === id) cands.push({ q, st: o.st, sub: o.sub });
      }
    }
    const rank = (q: QuestDef): number => (q.line === 'main' ? 0 : q.line === 'side' ? 1 : 2);
    cands.sort((a, b) => (a.q.id === prefer ? -1 : 0) - (b.q.id === prefer ? -1 : 0) || rank(a.q) - rank(b.q));
    let run: { q: QuestDef; st: QuestStep; sub: number } | null = null;
    let why: { q: QuestDef; msg: string } | null = null;
    for (const c of cands) {
      const msg = this.stepBlock(c.q, c.st);
      if (!msg) {
        run = c;
        break;
      }
      if (!why) why = { q: c.q, msg };
    }
    const { lines: tao, ids: taoIds } = this.taoHintLines(npc);
    const teacher = id === 'teacher_yayo';
    if (run) {
      const extra = run.st.translate ? this.translateLines(npc) : [];
      const tr = run.st.translate;
      this.runStep(run.q, run.st, npc, [...extra, ...tao], () => {
        if (tr) this.markTranslated();
        this.markHeard(taoIds);
      }, run.sub);
      if (why && why.q.line === 'main' && why.msg.startsWith('這件事要請')) {
        this.ui.toast(why.q.name.zh, `${why.msg}（點頭像切換）`);
      }
      return;
    }
    if (this.shopIngredient(npc)) return;
    if (teacher && this.quests.done.has('X03') && this.untranslated().length) {
      const lines = [{ ...this.speaker('@npc', npc), zh: '又聽到族語了？我來翻譯。', tao: '' }, ...this.translateLines(npc)];
      this.openQueue(lines, () => {
        this.markTranslated();
        this.saveNow();
      });
      return;
    }
    if (teacher && this.untaughtIngredients().length) {
      this.teachIngredients(npc);
      return;
    }
    if (tao.length) {
      this.openQueue([{ ...this.speaker('@npc', npc), zh: '……', tao: '' }, ...tao], () => {
        this.markHeard(taoIds);
        this.syncQuestCtx();
        this.handleQuestEvents(this.quests.refresh());
        this.questDirty = true;
        this.saveNow();
      });
      return;
    }
    if (why) {
      this.openQueue([{ ...this.speaker('@npc', npc), zh: `「${why.q.name.zh}」……${why.msg}`, tao: '' }]);
      if (why.msg.startsWith('這件事要請')) {
        const need = (this.quests.step(why.q)?.actor ?? why.q.roles).map((r) => ROLE_ZH[r]).join('或');
        this.ui.toast('需要換人', `點頭像換成${need}`);
      }
      return;
    }
    this.runInteract(npc.interactId, npc.def.name.zh, npc.def.portrait, true);
  }

  private spotPos(st: QuestStep): { x: number; z: number } | null {
    const p = st.spot ? this.photos.resolve({ places: this.places, landmarks: LANDMARKS }, st.spot) : null;
    return p ? { x: p.x, z: p.z } : null;
  }

  private spotName(st: QuestStep): string {
    return (st.spot ? this.photos.resolve({ places: this.places, landmarks: LANDMARKS }, st.spot)?.zh : '') || st.spot || '';
  }

  /** a quest's own window plus its photo spot's window (time / season / periods / tide) */
  private questWindow(q: QuestDef): { ok: boolean; why: string } {
    const w = this.quests.windowOk(q);
    if (!w.ok) return w;
    const ps = this.photos.window(q.id);
    return ps ? this.quests.windowOk(ps) : w;
  }

  private nearestQuestSpot(px: number, pz: number): { q: QuestDef; st: QuestStep; sub: number; d: number; ready: boolean } | null {
    let best: { q: QuestDef; st: QuestStep; sub: number; d: number; ready: boolean } | null = null;
    let bd = Infinity;
    for (const [qid] of this.quests.active) {
      const q = this.quests.get(qid)!;
      for (const { st, sub } of this.quests.openSteps(q)) {
        if (st.kind !== 'spot' && st.kind !== 'photo') continue;
        const p = this.spotPos(st);
        if (!p) continue;
        // several quests can share a spot (e.g. the host taro field): steps the controlled member can do win
        const d = Math.hypot(p.x - px, p.z - pz);
        if (d > (st.r ?? 6)) continue;
        // photo steps belong to the traveller; a step that would only show a "not now" toast loses to one that can run
        const me = this.party.controlled;
        const can = st.kind === 'photo' ? this.travellerHere() : this.quests.canAct(st, q, me);
        const score = d + (can ? 0 : 1000) + (can && this.stepBlock(q, st, st.kind === 'photo' ? 't' : undefined) ? 500 : 0);
        if (score < bd) {
          bd = score;
          best = { q, st, sub, d, ready: score < 500 };
        }
      }
    }
    return best;
  }

  private useQuestSpot(q: QuestDef, st: QuestStep, sub = -1): void {
    this.audioSceneQuest = q.id; // 0.1.4 audio: also cover a mini-game before its dialogue
    if (st.kind === 'photo') {
      this.takePhoto(q, st, sub);
      return;
    }
    const why = this.stepBlock(q, st);
    if (why) {
      this.ui.toast(q.name.zh, why);
      return;
    }
    if (st.dive) {
      void this.playDive(st.dive).then(() => {
        this.runStep(q, st, null, [], undefined, sub);
      });
      return;
    }
    if (st.minigame) {
      // sea trip: board the tatala, play the timing game; success finishes the step, a miss can be retried (or given up)
      if (st.canoe) {
        // 0.1.4 (Larry): only Tao men paddle a tatala; 族女 / 旅人 take a modern canoe (canoeKind "modern")
        const modern = st.canoeKind === 'modern';
        if (!modern && !this.tatalaRoles().includes(this.party.controlled)) {
          this.ui.toast(q.name.zh, '拼板舟由族裡的男人划。可到港邊租獨木舟，在岸邊划划看。');
          return;
        }
        // a tatala (or an already-loaded modern sheet) boards at once, so the step runs in the same tick as before
        if (!modern || this.modernHullReady()) {
          this.player.setCanoeHull(this.assets, modern);
          this.setCanoe(true);
          this.startSeaGame(q, st, sub);
        } else void this.boardCanoe(modern).then(() => this.startSeaGame(q, st, sub));
        return;
      }
      this.startSeaGame(q, st, sub);
      return;
    }
    this.runStep(q, st, null, [], undefined, sub);
  }

  // ------------------------------------------------------------------ 0.1.5 cards, quest pages, scenic photos

  private cardCtx(): CardCtx {
    return {
      items: this.db.items,
      recipes: this.db.recipes,
      glossary: this.db.glossary,
      outfits: this.db.outfits,
      spots: this.db.photoSpots,
      count: (i) => this.inv.count(i),
      known: (i) => this.inv.known(i),
      taught: (i) => this.state.taught.has(i),
    };
  }

  /** first unlocks → cards (each key once per save; several at once wait in the queue) */
  private discover(keys: string[]): void {
    const fresh = keys.filter((k) => !this.state.cards.has(k));
    if (!fresh.length) return;
    fresh.forEach((k) => this.state.cards.add(k));
    if (!this.cardsAuto || !this.state.started) return;
    const c = this.cardCtx();
    const words = fresh.filter((k) => k.startsWith('w:')).map((k) => k.slice(2));
    const push = (job: CardJob | null): void => {
      if (job) this.cards.push(job);
    };
    if (words.length >= 3) {
      const w = wordCard(c, words);
      if (w) push({ el: postcardEl(w), kind: 'postcard', key: w.key });
    } else {
      for (const id of words) {
        const w = wordCard(c, [id]);
        if (w) push({ el: postcardEl(w), kind: 'postcard', key: w.key });
      }
    }
    for (const k of fresh) {
      const id = k.slice(2);
      if (k.startsWith('i:')) {
        const d = itemCard(c, id);
        if (d) push({ el: postcardEl(d), kind: 'postcard', key: d.key });
      } else if (k.startsWith('o:')) {
        const d = outfitCard(c, id);
        if (d) push({ el: postcardEl(d), kind: 'postcard', key: d.key });
      } else if (k.startsWith('r:')) {
        const d = recipeCard(c, id);
        if (d) push({ el: recipeEl(d), kind: 'recipe', key: d.key });
      }
    }
  }

  /** a save from before the cards: everything it already knows counts as shown (no cards replayed) */
  private seedCards(): void {
    if (this.state.cardsSeeded) return;
    const st = this.state;
    for (const g of st.glossary) st.cards.add(`w:${g}`);
    for (const r of st.recipes) st.cards.add(`r:${r}`);
    for (const id of this.db.items.keys()) if (this.inv.known(id)) st.cards.add(`i:${id}`);
    for (const o of this.quests.outfits) st.cards.add(`o:${o}`);
    st.cardsSeeded = true;
  }

  /** the traveller is with the party and close by (or is the one being played) */
  private travellerHere(): boolean {
    if (this.party.controlled === 't') return true;
    if (this.quests.members.t.st !== 'party') return false;
    return this.missingMembers(['t']).length === 0;
  }

  private snapLine(spot: string): DlgLine | null {
    const lines = this.db.photoSpots.find((p) => p.id === spot)?.snap ?? [];
    if (!lines.length) return null;
    const pool = lines.length > 1 ? lines.filter((l) => l.zh !== this.lastSnap) : lines;
    const l = pool[Math.floor(Math.random() * pool.length)];
    this.lastSnap = l.zh;
    return { ...this.speaker('@t', null), zh: l.zh, tao: '' };
  }

  /** without the traveller nothing is saved; whoever leads says the traveller would want a photo */
  private photoNoTraveller(): void {
    const lines = ['這裡好漂亮……旅人一定會想拍一張。等旅人回隊再一起來吧。', '旅人不在，相機也不在。下次帶旅人一起來拍吧。'];
    const zh = lines[Math.floor(Math.random() * lines.length)];
    this.openQueue([{ ...this.speaker(`@${this.party.controlled}`, null), zh, tao: '' }]);
  }

  /** flash (no flash for the owl) + shutter, the printed photo flies into the album, then the traveller's 📸 line */
  private snapEffects(spot: string | null, lines: DlgLine[]): void {
    const def = spot ? this.db.photoSpots.find((p) => p.id === spot) : undefined;
    if (def?.noFlash) sfxShutter();
    else this.ui.flash();
    if (!this.cardsAuto || !spot) {
      this.ui.popLoot('相簿＋1', this.player.x, this.player.z);
      return;
    }
    const d = photoCard(this.cardCtx(), spot);
    const say = this.snapLine(spot);
    const after = (): void => {
      const all = [...(say ? [say] : []), ...lines];
      if (all.length) this.openQueue(all);
    };
    if (!d) {
      after();
      return;
    }
    this.cards.push({ el: photoEl(d), kind: 'photo', key: d.key, front: true, auto: 2.4, after, hint: '收進相簿' });
  }

  /** a photo step (scenic spot): the traveller has to be in the party */
  private takePhoto(q: QuestDef, st: QuestStep, sub = -1): void {
    if (!this.travellerHere()) {
      this.photoNoTraveller();
      return;
    }
    const why = this.stepBlock(q, st, 't');
    if (why) {
      this.ui.toast(q.name.zh, why);
      return;
    }
    const spot = this.photos.forQuest(q.id)?.id ?? null;
    if (spot) this.state.album.add(spot);
    const lines = this.cardsAuto ? this.toDlg(st.lines ?? [], null) : [];
    this.completeStep(q, sub);
    this.snapEffects(spot, lines);
    for (const p of this.db.photoSpots) if (p.id === spot) this.scenicIn.add(p.id);
  }

  /** scenic spots within reach (photo spot defs with a world position) */
  private scenicHere(x: number, z: number): { def: PhotoSpotDef; q: QuestDef | undefined }[] {
    const out: { def: PhotoSpotDef; q: QuestDef | undefined }[] = [];
    for (const def of this.db.photoSpots) {
      if (def.id.startsWith('ps_u')) continue; // underwater shots come from the dives
      const at = def.place ?? def.landmark;
      const p = at ? this.photos.resolve({ places: this.places, landmarks: LANDMARKS }, at) : null;
      if (!p) continue;
      if (Math.hypot(p.x - x, p.z - z) > (def.r ?? 8)) continue;
      out.push({ def, q: def.quest ? this.quests.get(def.quest) : undefined });
    }
    return out;
  }

  /**
   * walking into a scenic spot: first visit with the traveller → photo; without → the leader's remark;
   * already in the album → just a small camera icon. A teleport (fast travel) does not count as a visit.
   */
  private scenicTick(force: boolean): void {
    if (!this.state.started || !this.cardsAuto || this.arrival) return;
    const x = this.player.x;
    const z = this.player.z;
    const last = this.scenicLast;
    this.scenicLast = { x, z };
    const jumped = !force && (!last || Math.hypot(last.x - x, last.z - z) > 12);
    const here = this.scenicHere(x, z);
    const ids = new Set(here.map((h) => h.def.id));
    const entered = here.filter((h) => !this.scenicIn.has(h.def.id));
    if (this.isModalOpen() && !force) return; // check again once the dialogue / card is gone
    this.scenicIn = ids;
    if (jumped) return;
    for (const { def, q } of entered) {
      if (this.state.album.has(def.id)) {
        this.ui.popLoot('', x, z, CAMERA_ICON);
        continue;
      }
      if (!q) continue;
      const step = this.quests.active.has(q.id) ? this.quests.openSteps(q).find((o) => o.st.kind === 'photo') : undefined;
      if (step) {
        if (!this.questWindow(q).ok) continue;
        this.takePhoto(q, step.st, step.sub);
        return;
      }
      // a photo quest finished before 0.1.5 (album empty): the first visit with the traveller prints it now
      if (this.quests.done.has(q.id) && this.quests.windowOk(def).ok) {
        if (!this.travellerHere()) {
          this.photoNoTraveller();
          return;
        }
        this.state.album.add(def.id);
        this.snapEffects(def.id, []);
        this.saveNow();
        return;
      }
    }
  }

  /** recipe ingredients whose names the party does not know yet (found or taught) */
  private untaughtIngredients(): string[] {
    const anyRecipe = this.state.recipes.size > 0 || this.db.recipes.some((r) => r.quest && (this.quests.active.has(r.quest) || this.quests.done.has(r.quest)));
    if (!anyRecipe) return [];
    const ids = new Set(this.db.recipes.flatMap((r) => Object.keys(r.ingredients)));
    return [...ids].filter((id) => !this.inv.known(id) && !this.state.taught.has(id));
  }

  /** the 族語老師 teaches every recipe ingredient's name at once */
  private teachIngredients(npc: NpcActor): void {
    const ids = this.untaughtIngredients();
    const sp = this.speaker('@npc', npc);
    this.openQueue([
      { ...sp, zh: '在找料理的食材嗎？名字不知道，問人也問不到吧。', tao: '' },
      { ...sp, zh: '我把這些食材的名字都教你們，寫進手札裡了，去看看吧。', tao: '' },
    ], () => {
      ids.forEach((id) => this.state.taught.add(id));
      this.ui.toast('族語老師', '料理食材的名字都記進手札了');
      this.questDirty = true;
      this.saveNow();
    });
  }

  /** a newly unlocked quest opens its own notebook page (one per batch: the main line first) */
  private queueQuestPage(fresh: QuestDef[]): void {
    if (!this.cardsAuto || !this.state.started) return;
    const open = fresh.filter((q) => !q.hidden && q.playable && this.quests.active.has(q.id));
    const lead = open.find((q) => q.line === 'main') ?? open.find((q) => q.line === 'side') ?? open[0];
    if (!lead) return;
    const vm = this.questCards().find((c) => c.id === lead.id);
    if (!vm) return;
    const c = this.cardCtx();
    let rows = lead.recipe ? (() => {
      const r = this.db.recipes.find((x) => x.id === lead.recipe!.id);
      return r ? recipeRows(c, r) : [];
    })() : [];
    if (!rows.length) {
      const need: Record<string, number> = {};
      if (lead.needsItem) need[lead.needsItem.item] = 1;
      for (const stp of lead.steps) for (const r of Recipes.itemReqs(stp.until)) need[r.item] = Math.max(need[r.item] ?? 0, r.min);
      rows = needRows(c, need);
    }
    const lineZh: Record<string, string> = { main: '主線', side: '支線', photo: '相簿水下' };
    this.cards.push(questPageJob({
      id: vm.id,
      line: lineZh[vm.line] ?? '',
      name: vm.name,
      roles: vm.roles,
      giver: vm.giver,
      objective: vm.objective,
      hint: vm.hint?.text,
      hintTao: vm.hint?.tao,
      rows,
    }));
  }

  /** 0.1.4: who may paddle a tatala (content/meta.json tatalaRoles, default 族男 only; open it later in data) */
  private tatalaRoles(): Role[] {
    const r = (this.db.meta as { tatalaRoles?: Role[] }).tatalaRoles;
    return Array.isArray(r) && r.length ? r : ['m'];
  }

  /** board a tatala, or a plain modern canoe (its sheet is loaded on demand) */
  private async boardCanoe(modern: boolean): Promise<void> {
    await this.loadCanoeHull(modern);
    this.setCanoe(true);
  }

  /** the modern canoe sheet for the current outfit (or its base) is already in memory */
  private modernHullReady(): boolean {
    const kind = this.player.outfit;
    return this.assets.textures.has(`characters/canoe_modern_${kind}_sheet.png`) || this.assets.textures.has(`characters/canoe_modern_${Outfits.base(kind)}_sheet.png`);
  }

  private async loadCanoeHull(modern: boolean): Promise<void> {
    if (modern) {
      const kind = this.player.outfit;
      for (const rel of [`characters/canoe_modern_${kind}_sheet.png`, `characters/canoe_modern_${Outfits.base(kind)}_sheet.png`]) {
        if (this.assets.textures.has(rel)) break;
        try { await this.assets.acquire(rel); break; } catch { /* try the base outfit's */ }
      }
    }
    this.player.setCanoeHull(this.assets, modern);
  }

  private startSeaGame(q: QuestDef, st: QuestStep, sub: number): void {
    this.startMinigame(st.minigame!, (ok) => {
      if (st.canoe && this.player.mode === 'canoe') this.setCanoe(false);
      if (ok) this.runStep(q, st, null, [], undefined, sub);
      else this.ui.toast(q.name.zh, this.quests.solo ? '差一點！再試一次，或「放棄出海」。' : '差一點！再試一次。');
    });
  }

  // ------------------------------------------------------------------ recipes: ingredients from gathering / shop / mini-games

  private recipeCtx() {
    return { active: this.quests.active, get: (id: string) => this.quests.get(id), step: (q: QuestDef) => this.quests.step(q), count: (i: string) => this.inv.count(i) };
  }

  /** ingredients the active recipe quests still need (item → missing count) */
  private neededIngredients(): Record<string, number> {
    return this.recipeSys.needed(this.recipeCtx());
  }

  /** gather / observe nodes that are live now */
  private gatherSpots(): LiveNode[] {
    return this.gathering.live({
      places: this.places,
      windowOk: (w) => this.quests.windowOk(w),
      counters: this.quests.counters,
      flags: this.quests.flags,
      count: (i) => this.inv.count(i),
      known: (i) => this.inv.known(i),
      needed: () => this.neededIngredients(),
    });
  }

  private useGatherNode(n: LiveNode): void {
    if (n.blocked) {
      this.ui.toast(n.label, n.blocked);
      return;
    }
    this.gathering.use(this.quests, n.id);
    if (n.node.sets) this.quests.flags.add(n.node.sets);
    if (n.kind === 'observe') {
      this.inv.observe(n.item);
      const d = this.db.items.get(n.item);
      if (d) this.ui.popLoot('+1', this.player.x, this.player.z, itemIcon(d));
      else this.ui.popLoot(`圖鑑＋1 ${n.item}`, this.player.x, this.player.z);
      this.syncQuestCtx();
      this.handleQuestEvents(this.quests.refresh());
      this.questDirty = true;
      this.saveNow();
      return;
    }
    this.addIngredient(n.item, 1, '採集');
  }

  private addIngredient(id: string, n = 1, _how = ''): void {
    this.inv.add(id, n);
    if (n > 0) sfxSting('item');
    if (this.db.items.get(id)?.category === 'ingredient') this.state.unlock(this.state.ingredients, [id]);
    const d = this.db.items.get(id);
    // 0.1.5: just a small icon with +n (the big card only on the first time ever)
    if (d) this.ui.popLoot(`+${n}`, this.player.x, this.player.z, itemIcon(d));
    else this.ui.popLoot(`物品＋${n}`, this.player.x, this.player.z);
    this.syncQuestCtx();
    this.handleQuestEvents(this.quests.refresh());
    this.questDirty = true;
    this.saveNow();
  }

  /** buying a needed ingredient from a shop NPC (旅人靠購買); true when it handled the talk */
  private shopIngredient(npc: NpcActor): boolean {
    const want = this.recipeSys.shopWants(npc.def.id, this.neededIngredients());
    if (!want.length) return false;
    const names = want.map((w) => `${w.zh} ×${w.n}`).join('、');
    this.openQueue([{ ...this.speaker('@npc', npc), zh: `要買${names}？好，拿去吧。`, tao: '' }], () => {
      for (const w of want) this.addIngredient(w.id, w.n, '在店裡買的');
    });
    return true;
  }

  /** per-frame quest work, throttled: unlocks / auto steps, HUD tracker, ❗ markers, autosave */
  private questFrame(dt: number): void {
    this.questTick -= dt;
    this.saveTick -= dt;
    for (const m of this.markers.values()) {
      if (m.npc?.sprite) m.obj.position.set(m.npc.x, m.npc.sprite.mesh.position.y + CHAR_WORLD_H * m.npc.sprite.mesh.scale.y + 0.25, m.npc.z);
    }
    if (this.questTick > 0 && !this.questDirty) return;
    this.questTick = 0.5;
    this.syncQuestCtx();
    if (!this.isModalOpen()) {
      this.handleQuestEvents(this.quests.refresh());
      this.runPendingAutoLines();
    }
    this.ui.setTide(this.quests.flags.has('tide_clock') ? `潮汐：${tideAt(this.state.period) === 'low' ? '退潮' : '漲潮'}` : null);
    this.refreshQuestUi(this.questDirty);
    this.updateMarkers();
    this.questDirty = false;
    if (this.saveTick <= 0) {
      this.saveTick = 15;
      this.saveNow();
    }
  }

  /**
   * M1: an `auto` step with lines (Q01's intro) is only run by whoever opened it. After a reload, or when its
   * dialogue was cut off (fast travel), nothing would run it again and the quest would stall; replay it here.
   */
  private runPendingAutoLines(): void {
    if (!this.state.started || this.activity !== 'explore' || this.isModalOpen()) return;
    for (const [id] of this.quests.active) {
      const q = this.quests.get(id);
      const st = q ? this.quests.step(q) : null;
      if (!q || !st || st.kind !== 'auto' || !st.lines?.length) continue;
      if (!this.questWindow(q).ok || (st.until && !this.quests.evalReq(st.until))) continue;
      this.runStep(q, st, null);
      return;
    }
  }

  private refreshQuestUi(cards: boolean): void {
    const q = this.quests.current();
    const st = q ? this.quests.step(q) : null;
    if (q && st) {
      const prog = this.quests.reqProgress(q);
      const warn = st.kind === 'auto' ? '' : this.stepBlock(q, st) ?? '';
      this.ui.setTracker({
        line: q.line === 'main' ? '主線' : q.line === 'side' ? '支線' : '相簿',
        name: q.name.zh,
        objective: st.text + (prog ? `（${prog.have}/${prog.need}）` : ''),
        warn,
      });
    } else this.ui.setTracker(null);
    if (cards && this.overlay === 'journal') this.ui.setQuests(this.questCards());
  }

  private questCards(): QuestCardVM[] {
    const out: QuestCardVM[] = [];
    const cur = this.quests.current();
    for (const q of this.quests.defs) {
      const status = this.quests.status(q);
      if (status === 'hidden' || q.silent) continue;
      const st = this.quests.step(q);
      const blocks: string[] = [];
      if (status === 'active' && st && q.playable) {
        const w = this.questWindow(q);
        if (!w.ok) blocks.push(`現在不行：${w.why}`);
        const mi = this.quests.missingItem(q);
        if (mi) blocks.push(`需要道具：${mi.zh}（${mi.from} 可以取得）`);
        const dress = this.quests.outfitMissing(q);
        if (dress.length) blocks.push(`要穿傳統服飾：${dress.map((m) => `${ROLE_ZH[m.role]}換上${this.outfits.defs.find((d) => d.id === m.outfit)?.name.zh ?? '傳統服飾'}`).join('、')}（手札 → 背包）`);
        const roles = st.actor ?? q.roles;
        const away = roles.filter((r) => this.quests.memberBlock(r));
        if (away.length && away.length === roles.length) blocks.push(`成員離隊：${away.map((r) => `${ROLE_ZH[r]}${this.memberStatus(r)}`).join('；')}`);
        // recipes: what is still missing and where to get it
        if (q.recipe && st.kind === 'auto') {
          const need = this.neededIngredients();
          for (const [id, n] of Object.entries(need)) {
            if (st.until && JSON.stringify(st.until).includes(`"${id}"`)) blocks.push(`還缺${this.inv.name(id)} ×${n}：${this.recipeSys.how(id)}`);
          }
        }
      }
      let hint: QuestCardVM['hint'] = null;
      if (status === 'active') {
        const h = q.hint;
        if (h.tier === 'tao') {
          const ph = h.phrase ? this.quests.file.phrases[h.phrase] : undefined;
          if (this.quests.translated.has(q.id)) hint = { tier: 'tao', from: h.from, tao: ph?.tao, text: `「${ph?.zh ?? ''}」${h.zh}`, state: 'translated' };
          else if (this.quests.heard.has(q.id)) hint = { tier: 'tao', from: h.from, tao: ph?.tao, text: '還不懂意思。帶去椰油的學校問族語老師。', state: 'heard' };
          else hint = { tier: 'tao', from: h.from, text: `${h.from}只用族語給提示，去找他聊聊。`, state: 'unheard' };
        } else hint = { tier: h.tier, from: h.from, text: h.zh };
      }
      const prog = status === 'active' ? this.quests.reqProgress(q) : null;
      out.push({
        id: q.id,
        line: q.line,
        status: status === 'done' ? 'done' : status === 'active' ? 'active' : 'locked',
        name: q.name.zh,
        roles: (st?.actor ?? q.roles).map((r) => ROLE_ZH[r]),
        coop: q.n >= 2 ? q.text.coop : '',
        objective: st?.text ?? '',
        progress: prog ? `${prog.have}/${prog.need}` : '',
        blocks,
        hint,
        placeholder: !q.playable && q.id !== 'Q01',
        tracked: cur?.id === q.id,
        ground: q.ground === 'fishing' ? '漁場（依傳統由族男出海）' : q.ground === 'dive' ? '潛點（觀光休閒，誰都能去）' : undefined,
        giver: q.giver ? `${this.db.meta.giverLabels?.[q.giver] ?? (q.giver === 'f' ? '女性長輩交辦、驗收' : '男性長輩交辦、驗收')}（${this.npcs.byId(this.giverId(q))?.def.name.zh ?? ''}）` : undefined,
        song: q.song && status !== 'locked' ? this.songVM(q.song) : null,
      });
    }
    // tracked first, then quests you can actually play now, then main → side → photo (stable)
    const lr = { main: 0, side: 1, photo: 2 } as Record<string, number>;
    const key = (c: QuestCardVM): number => (c.tracked ? 0 : 10) + (c.placeholder ? 5 : 0) + (lr[c.line] ?? 3);
    return out.map((c, i) => ({ c, i })).sort((a, b) => key(a.c) - key(b.c) || a.i - b.i).map((x) => x.c);
  }

  /** ❗ over NPCs / spots with a step to do (黃 = new quest, 藍 = next step) + who can do it */
  private updateMarkers(): void {
    const want = new Map<string, { x: number; z: number; y: number; npc?: NpcActor; cls: string; roles: Set<Role>; label?: string }>();
    const add = (key: string, rec: { x: number; z: number; y: number; npc?: NpcActor }, step0: boolean, roles: Role[]): void => {
      const cur = want.get(key);
      if (cur) {
        roles.forEach((r) => cur.roles.add(r));
        if (step0) cur.cls = 'new';
        return;
      }
      want.set(key, { ...rec, cls: step0 ? 'new' : 'next', roles: new Set(roles) });
    };
    const px = this.player.x;
    const pz = this.player.z;
    const E = this.quests;
    for (const [qid, idx] of E.active) {
      const q = E.get(qid)!;
      if (!q.playable) continue;
      // a solo trip: only its own steps are marked
      if (E.solo && E.members[E.solo].quest !== q.id) continue;
      for (const { st } of E.openSteps(q)) {
        const roles = st.actor ?? q.roles;
        if (st.kind === 'talk') {
          const a = this.npcs.byId(this.npcFor(st.npc, q));
          if (a && a.visible) add(`npc:${a.def.id}`, { x: a.x, z: a.z, y: 0, npc: a }, idx === 0, roles);
        } else if (st.kind === 'spot' || st.kind === 'photo') {
          const p = this.spotPos(st);
          if (p && Math.hypot(p.x - px, p.z - pz) < 70) add(`spot:${st.spot}`, { x: p.x, z: p.z, y: Math.max(0, this.island.heightAt(p.x, p.z)) + 2.6 }, idx === 0, roles);
        }
      }
    }
    // party split: the regroup point, and where each away member stands
    const groundY = (x: number, z: number): number => Math.max(0, this.island.heightAt(x, z));
    if (E.meet && this.places[E.meet]) {
      const p = this.places[E.meet];
      want.set('meet', { x: p.x, z: p.z, y: groundY(p.x, p.z) + 3.2, cls: 'meet', roles: new Set(ROLES), label: '集' });
    }
    for (const f of this.party.followers) {
      if (!f.stay) continue;
      want.set(`mem:${f.role}`, { x: f.x, z: f.z, y: f.active.mesh.position.y + CHAR_WORLD_H + 0.3, cls: 'member', roles: new Set(ROLES), label: this.quests.file.roles[f.role].icon });
    }
    for (const g of this.gatherSpots()) {
      if (g.blocked) continue; // no 採 marker until the node can be used; the prompt explains why when standing on it
      if (Math.hypot(g.x - px, g.z - pz) < 70) want.set(`gather:${g.id}`, { x: g.x, z: g.z, y: groundY(g.x, g.z) + 2.4, cls: 'gather', roles: new Set(ROLES), label: '採' });
    }
    if (this.quests.done.has('X03') && this.untranslated().length) {
      const t = this.npcs.byId('teacher_yayo');
      if (t) add('npc:teacher_yayo', { x: t.x, z: t.z, y: 0, npc: t }, false, ['m', 'f', 't']);
    }
    for (const [k, m] of this.markers) {
      if (!want.has(k)) {
        this.markerRoot.remove(m.obj);
        m.el.remove();
        this.markers.delete(k);
      }
    }
    const me = this.party.controlled;
    for (const [k, w] of want) {
      let m = this.markers.get(k);
      if (!m) {
        const el = document.createElement('div');
        el.className = 'q-mark';
        el.innerHTML = '<b>!</b><i></i>';
        const obj = new CSS2DObject(el);
        this.markerRoot.add(obj);
        m = { obj, el, npc: w.npc, key: '' };
        this.markers.set(k, m);
      }
      const roles = ROLES.filter((r) => w.roles.has(r));
      const key = `${w.cls}|${roles.join('')}|${me}|${w.label ?? ''}`;
      if (m.key !== key) {
        m.key = key;
        m.el.className = `q-mark ${w.cls}${w.roles.has(me) ? '' : ' other'}`;
        (m.el.querySelector('b') as HTMLElement).textContent = w.label ?? '!';
        (m.el.querySelector('i') as HTMLElement).textContent = roles.length === 3 || w.label ? '' : roles.map((r) => this.quests.file.roles[r].icon).join('');
      }
      if (!w.npc) m.obj.position.set(w.x, w.y, w.z);
    }
  }

  // ------------------------------------------------------------------ batch 1b: underwater, songs, album, save export / import

  /** host-family spots for 族人分工 quests (J1–J3, R1–R3, A3): home village, its taro field, the weaver's porch */
  private setHostPlaces(): void {
    const P = this.places;
    const h = this.homes();
    const hp = hostPlaces(P, h.host);
    if (!hp) return;
    Object.assign(P, hp);
    // 0.1.5: every village's family spots as host_*@<village> (a member's own home when it is not the 主人家)
    for (const v of VILLAGES) {
      const o = hostPlaces(P, v, true);
      if (o) for (const [id, p] of Object.entries(o)) P[`${id}@${v}`] = { ...p, id: `${id}@${v}` };
    }
    // quests point at the right village's elders and spots (Q03 becomes two check-ins when the homes differ)
    resolveQuests(this.db.quests, h, this.quests.file.elders);
    // the a akes (女性長輩) of the 主人家 and of the 族女's home wait on their family porch (J1–J3 / Q07, 芋田／織布)
    if (this.npcs) {
      this.npcs.applySchedule(this.state.period, this.state.season);
      for (const v of new Set([h.host, h.f])) {
        const id = this.hostFemaleId(v);
        const porch = v === h.host ? P.host_weave : P[`host_weave@${v}`];
        if (porch && this.npcs.byId(id)) this.npcs.place(id, porch.x, porch.z);
      }
    }
  }


  /**
   * U1 / U2 / U3: one illustration per spot pops up (same picture for everyone, 2026-11) and is collected.
   * U3 (hidden, traveller POV) opens once U1 was done with the traveller there.
   */
  private async playDive(kind: 'A' | 'B' | 'POV'): Promise<void> {
    this.diveOpen = true;
    try {
      if (kind === 'POV') {
        await showDive({ kind, title: '旅人的水下視角', caption: '旅人在水下拍的一組 3 張照片（收藏）' });
        for (let i = 1; i <= 3; i++) this.quests.collect.add(`pov:${i}`);
      } else {
        const title = kind === 'A' ? '水下美景 A｜母雞岩下方海灣（浮潛）' : '水下美景 B｜椰油港外的平台邊緣（淺水氣瓶）';
        await showDive({ kind, title, caption: '點一下畫面就收進相簿' });
        this.quests.collect.add(`uw:${kind}`);
        if (kind === 'A') {
          const pos = this.party.positions(this.player);
          const tHere = this.party.controlled === 't' || Math.hypot(pos.t.x - this.player.x, pos.t.z - this.player.z) < 12;
          if (tHere) this.quests.flags.add('u1_by_t');
        }
      }
    } finally {
      this.diveOpen = false;
    }
    this.syncQuestCtx();
    this.handleQuestEvents(this.quests.refresh()); // e.g. hidden U3 right after U1
    this.questDirty = true;
    this.saveNow();
  }

  private songVM(id: string): SongVM | null {
    const s = this.quests.file.songs?.[id];
    if (!s) return null;
    return { id, title: s.title, tao: s.tao, zh: s.zh, activity: s.activity, source: `來源：${s.source}｜${s.license}｜${s.status}，待族人校對｜${s.url}` };
  }

  private playSong(id: string): void {
    const vm = this.songVM(id);
    if (!vm) return;
    this.quests.collect.add(`song:${id}`);
    showSongCard(vm);
  }

  private albumVM(): AlbumVM {
    const c = this.quests.collect;
    return {
      // 0.1.5: printed photos (taken with the traveller in the party); a save from before keeps an empty album
      photos: this.db.photoSpots.filter((p) => this.state.album.has(p.id)).map((p) => ({ id: p.quest ?? p.id, name: p.name.zh, spot: p.id, thumb: CARD_ART.thumb(p.id) })),
      photoTotal: this.db.photoSpots.filter((p) => !p.id.startsWith('ps_u')).length,
      uw: (['A', 'B'] as const).map((kind) => ({
        have: c.has(`uw:${kind}`),
        kind,
        title: kind === 'A' ? '水下美景 A｜母雞岩下方海灣（浮潛）' : '水下美景 B｜椰油港外平台（淺水氣瓶）',
      })),
      pov: c.has('pov:1'),
      povVisible: this.quests.active.has('U3') || this.quests.done.has('U3'),
      songs: Object.keys(this.quests.file.songs ?? {}).map((id) => ({ ...(this.songVM(id) as SongVM), have: c.has(`song:${id}`) })),
    };
  }

  private buildSave(): SaveJSON {
    return {
      v: 1,
      savedAt: Date.now(),
      contentRev: this.questRev(),
      world: WORLD_REV,
      state: this.state.toJSON(),
      party: { controlled: this.party.controlled, pos: this.party.positions(this.player), scooter: this.player.scooter },
      quests: this.quests.toJSON(),
    };
  }

  /** copyable save code: "TAO1." + base64(UTF-8 JSON) */
  private saveCode(): string {
    if (!this.state.started) return '';
    const json = JSON.stringify(this.buildSave());
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `TAO1.${btoa(bin)}`;
  }

  private downloadSave(): void {
    if (!this.state.started) return;
    const blob = new Blob([JSON.stringify(this.buildSave(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = `pongso-no-tao-save-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /** import a save file (JSON) or a save code; replaces the current progress */
  private importSave(text: string): { ok: boolean; msg: string } {
    const t = text.trim();
    if (!t) return { ok: false, msg: '沒有內容。請貼上存檔碼或選擇存檔檔案。' };
    let sv: SaveJSON | null = null;
    try {
      let json = t;
      if (t.startsWith('TAO1.')) {
        const bin = atob(t.slice(5).replace(/\s+/g, ''));
        json = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
      }
      sv = JSON.parse(json) as SaveJSON;
    } catch {
      return { ok: false, msg: '看不懂這段存檔碼或檔案，請確認有完整複製。' };
    }
    sv = validateSave(sv);
    if (!sv) return { ok: false, msg: '這不是 Pongso no Tao 的存檔，或是版本不相容。' };
    if (!writeSave(sv)) return { ok: false, msg: '瀏覽器不允許儲存（可能是無痕模式），無法匯入。' };
    this.resume(sv);
    return { ok: true, msg: `已匯入：完成 ${sv.quests.done.length} 項任務，從存檔的位置繼續。` };
  }

  private saveMeta(sv: SaveJSON | null): string | null {
    if (!sv) return null;
    const zh = (id: string | null | undefined): string => this.places[id ?? '']?.zh ?? '';
    const hm = zh(sv.state?.originM ?? sv.state?.origin);
    const hf = zh(sv.state?.originF ?? sv.state?.origin);
    const home = hm === hf ? hm : `${hm}／${hf}`;
    const n = sv.quests?.done?.length ?? 0;
    const when = new Date(sv.savedAt);
    const hh = String(when.getHours()).padStart(2, '0');
    const mm = String(when.getMinutes()).padStart(2, '0');
    return `家鄉：${home}｜完成 ${n} 項任務｜${when.getMonth() + 1}/${when.getDate()} ${hh}:${mm}`;
  }

  private saveNow(): void {
    if (!this.state.started || !this.party) return;
    if (!writeSave(this.buildSave()) && !this.saveWarned) {
      // S7: tell the player once that progress is not being kept
      this.saveWarned = true;
      this.ui.toast('無法存檔', '瀏覽器不允許儲存，關閉頁面後進度會消失。');
    }
  }

  /** quests.json revision tag stored with saves (informational, see audit S1) */
  private questRev(): string {
    return `c${this.db.meta.version ?? 1}-q${this.db.quests.length}`;
  }

  private refreshJournal(): void {
    if (this.quests) this.ui.setQuests(this.questCards());
    this.ui.renderJournal(this.state, {
      glossary: this.db.glossary,
      ingredients: [...this.db.items.values()].filter((i) => i.category === 'ingredient'),
      recipes: this.db.recipes,
      milestones: this.db.milestones,
    });
    this.ui.syncLang(this.state.lang);
  }

  private nearestPrompt(): string | null {
    if (!this.state.started || this.isModalOpen()) return null;
    const near = this.nearestTarget();
    if (!near) return null;
    if ('npc' in near) return fmt(this.content.text.talkPrompt, { name: near.npc.def.name.zh });
    if ('spot' in near) {
      const { q, st } = near.spot;
      if (st.kind === 'photo') return this.travellerHere() ? `拍照：${this.spotName(st)}` : '拍照（旅人要在隊伍裡）';
      return q.name.zh;
    }
    if ('gather' in near) return near.gather.blocked ? `${near.gather.label}（${near.gather.blocked}）` : near.gather.label;
    return near.it.label;
  }

  private loop = (): void => {
    if (this.contextLost) {
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
    this.frameNo++;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    this.input.beginFrame();
    // 0.1.4: title / party / arrival screens and the painted ride run on the light intro scene
    if (this.intro && !this.state.started && (!this.arrival || this.arrival.phase === 'intro')) {
      this.input.consumeInteract();
      this.input.consumeDrag();
      this.renderer.setRenderTarget(null);
      this.introFrame();
      return;
    }

    // one interact edge per frame, routed by mode
    const pressed = this.input.consumeInteract();
    const mode = this.mode;
    if (pressed) {
      if (mode === 'explore') this.tryInteract();
      else if (mode === 'dialogue') {
        if (!this.ui.finishTyping()) this.advanceDialogue(); // 0.1.4: first press shows the rest of a typing line
      } else if (mode === 'minigame') this.hitMinigame();
    }

    if (this.state.started && !this.arrival && this.cards.pending && !this.isModalOpen()) this.cards.pump();
    this.scenicT -= dt;
    if (this.scenicT <= 0) {
      this.scenicT = 0.25;
      this.scenicTick(false);
      if (this.state.started && !this.arrival) this.villageTick();
    }
    const blocked = !this.state.started || this.isModalOpen();
    this.player.update(dt, this.input, this.camera, blocked);
    if (this.state.started) this.party.update(dt, this.camera, this.player);
    if (this.streamTick <= 0 || performance.now() - this.streamAt > 400) this.streamNpcs();
    this.npcs.update(dt, this.camera, this.player);
    this.goats?.update(dt, this.player.x, this.player.z);
    this.updateCharacterTint(dt);
    this.decor.update(dt, this.camera, t, this.state.season === 'rayon' || this.state.season === 'meyvanwa');
    this.ocean.update(t, this.scene.fog as THREE.Fog);
    reflectHooks.sprites = !this.diveOpen; // no sprite reflections while the underwater view is up
    this.terraces.update(t, this.scene.fog as THREE.Fog);
    this.island.flora.update(t);
    this.sky.update(t);

    if (this.arrival?.phase === 'notebook') this.notebookFrame();
    else if (!this.state.started && !this.coverHold) this.camYaw += dt * 0.035;
    const drag = this.input.consumeDrag();
    this.camYaw -= drag.dx * 0.005;
    this.camPitch = clamp(this.camPitch - drag.dy * 0.004, 0.2, 1.35);
    if (this.input.wantLeft || this.camBtn < 0) this.camYaw += dt * 1.2;
    if (this.input.wantRight || this.camBtn > 0) this.camYaw -= dt * 1.2;
    const wh = this.input.consumeWheel();
    if (wh) this.camDist = clamp(this.camDist * Math.exp(wh * 0.0012), CAM_MIN_DIST, CAM_MAX_DIST);
    const pinch = this.input.consumePinch();
    if (pinch) this.camDist = clamp(this.camDist * Math.exp(-pinch * 1.2), CAM_MIN_DIST, CAM_MAX_DIST);

    const fx = this.focus ? this.focus.x : this.player.x;
    const fz = this.focus ? this.focus.z : this.player.z;
    const fy = this.camFy ?? Math.max(0, this.island.heightAt(fx, fz)) + 1.1;
    // smooth, slightly springy Octopath-style orbit
    const k = this.snapCam ? 1 : 1 - Math.exp(-dt * 6);
    this.snapCam = false;
    const c = this.camCur;
    c.yaw += (this.camYaw - c.yaw) * k;
    c.pitch += (this.camPitch - c.pitch) * k;
    c.dist += (this.camDist - c.dist) * k;
    c.x += (fx - c.x) * k;
    c.y += (fy - c.y) * k;
    c.z += (fz - c.z) * k;
    this.camera.position.set(
      c.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist,
      c.y + Math.sin(c.pitch) * c.dist,
      c.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist,
    );
    // never dip the camera into a ridge
    const ground = this.island.heightAt(this.camera.position.x, this.camera.position.z);
    if (this.camera.position.y < ground + 1.2) this.camera.position.y = ground + 1.2;
    this.camera.lookAt(c.x, c.y, c.z);
    this.sky.follow(c.x, c.y, c.z);
    this.sky.setShadowSpan(c.dist * 0.95 + 8);
    const fog = this.scene.fog as THREE.Fog;
    const pre = PRESETS[this.state.period];
    fog.near = pre.fogNear + c.dist * 0.9;
    fog.far = pre.fogFar + c.dist * 1.6;
    // tilt-shift: stronger when close (diorama feel), lighter on wide shots
    // closest zoom is for looking at detail: widen the sharp band and soften the blur so the ground near the party stays crisp
    const near = this.groundFx ? 1 - THREE.MathUtils.smoothstep(c.dist, 17, 26) : 0;
    if (this.arrival) this.post.setTilt(0.5, 0.5, 0.34); // the arrival shot is a POV, not a diorama
    else this.post.setTilt(((c.dist < 30 ? 2.4 : c.dist < 60 ? 1.6 : 1.0) - near * 0.9) * (worldStyle() === 'watercolor' ? PAINT.tiltShift : 1), 0.5, (c.dist < 30 ? 0.2 : 0.26) + near * 0.08);

    this.ui.setPrompt(this.nearestPrompt());
    if (this.state.started) this.questFrame(dt);
    if (this.state.started && !this.arrival) this.frame016(dt);
    else this.ui.setGuideArrow(null);
    if (this.state.started) this.ui.updateMinimap(this.player.x, this.player.z, this.camYaw);
    {
      const cam = this.camera;
      const v = this.lootV;
      const w = this.renderer.domElement.clientWidth;
      const h = this.renderer.domElement.clientHeight;
      this.ui.updateLoots(dt, (x, y, z) => {
        v.set(x, y, z).project(cam);
        return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, vis: v.z < 1 };
      }, (x, z) => this.island.heightAt(x, z));
    }

    if (this.mg) {
      this.mg.t += this.mg.dir * dt * 0.85;
      if (this.mg.t > 1) {
        this.mg.t = 1;
        this.mg.dir = -1;
      }
      if (this.mg.t < 0) {
        this.mg.t = 0;
        this.mg.dir = 1;
      }
      this.ui.setNeedle(this.mg.t, this.mg.s0, this.mg.s1);
    }

    this.post.render(dt);
    this.labelRenderer.render(this.scene, this.camera);
  };

  /** coalesce bursts of resize events (iOS URL bar, window drags) into one per frame */
  private scheduleResize(): void {
    if (this.resizeRaf) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      this.resize();
    });
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // DPR can change when moving between monitors or zooming
    this.renderer.setPixelRatio(preferredPixelRatio());
    this.renderer.setSize(w, h);
    this.post?.setSize(w, h);
    this.intro?.resize(w / h);
    this.labelRenderer.setSize(w, h);
  }


  /** Snap the actual THREE camera to the current orbit targets (used by setCamera and tests). */
  private syncCamera(): void {
    const fx = this.focus ? this.focus.x : this.player.x;
    const fz = this.focus ? this.focus.z : this.player.z;
    const fy = Math.max(0, this.island.heightAt(fx, fz)) + 1.1;
    const c = this.camCur;
    c.yaw = this.camYaw;
    c.pitch = this.camPitch;
    c.dist = this.camDist;
    c.x = fx;
    c.y = fy;
    c.z = fz;
    this.camera.position.set(
      c.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist,
      c.y + Math.sin(c.pitch) * c.dist,
      c.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist,
    );
    const ground = this.island.heightAt(this.camera.position.x, this.camera.position.z);
    if (this.camera.position.y < ground + 1.2) this.camera.position.y = ground + 1.2;
    this.camera.lookAt(c.x, c.y, c.z);
  }

  // ------------------------------------------------------------------ 0.1.6: village zoom, warm-up, guide arrow, tap-to-walk
  /** camera distance inside a village / out on the road (a manual zoom holds until the next way in / out) */
  static readonly VILLAGE_CAM = 19;
  static readonly OPEN_CAM = 26;

  private villageTick(): void {
    const x = this.player.x;
    const z = this.player.z;
    let near: { id: string; d: number } | null = null;
    for (const v of VILLAGE_DEFS) {
      const d = Math.hypot(v.cx - x, v.cz - z);
      if (!near || d < near.d) near = { id: v.id, d };
    }
    if (!near) return;
    // in at 20 m from the centre, out past 30 m (no flicker on the edge); not on the water
    const inNow = this.player.mode === 'canoe' ? null : this.villageIn ? (near.id === this.villageIn && near.d < 30 ? this.villageIn : near.d < 20 ? near.id : null) : near.d < 20 ? near.id : null;
    if (inNow !== this.villageIn) {
      const was = this.villageIn;
      this.villageIn = inNow;
      // a fast-travel / load lands straight in a village: zoom too (the camera eases there)
      if (!this.focus) this.camDist = inNow ? Game.VILLAGE_CAM : was ? Game.OPEN_CAM : this.camDist;
    }
    // heading toward a village: warm its people, music and photo-spot pictures in the background
    if (near.d < 110 && !this.villageWarm.has(near.id)) {
      this.villageWarm.add(near.id);
      this.warmVillageAssets(near.id);
    }
    if (!this.bgWarmAt) this.bgWarmAt = performance.now() + 6000;
    else if (this.bgWarmAt > 0 && performance.now() > this.bgWarmAt) {
      this.bgWarmAt = -1;
      warmBackground();
    }
  }

  private warmVillageAssets(id: string): void {
    const v = VILLAGE_DEFS.find((d) => d.id === id);
    if (!v) return;
    const files: string[] = [`assets/sprites/npc_atlas_${id}.webp`];
    const track = villageTrackPath(id);
    if (track) files.push(track);
    for (const def of this.db.photoSpots) {
      const at = def.place ?? def.landmark;
      const p = at ? this.photos.resolve({ places: this.places, landmarks: LANDMARKS }, at) : null;
      if (p && Math.hypot(p.x - v.cx, p.z - v.cz) < 45) files.push(`assets/cards/photos/${def.id}.webp`);
    }
    warmVillage(files);
  }

  private setGuide(on: boolean): void {
    this.guideOn = on;
    try { localStorage.setItem(GUIDE_KEY, on ? '1' : '0'); } catch { /* private mode */ }
    this.ui.setGuideButton(on);
    if (!on) this.ui.setGuideArrow(null);
  }

  /** where the tracked quest goes next: its first open step the controlled member can do (NPC / spot / regroup point) */
  private guidePoint(): { x: number; z: number } | null {
    const E = this.quests;
    if (E.meet && this.places[E.meet]) return { x: this.places[E.meet].x, z: this.places[E.meet].z };
    const q = E.current();
    if (!q) return null;
    const me = this.party.controlled;
    const steps = E.openSteps(q);
    const pick = steps.find(({ st }) => (st.actor ?? q.roles).includes(me)) ?? steps[0];
    if (!pick) return null;
    const st = pick.st;
    if (st.kind === 'talk') {
      const a = this.npcs.byId(this.npcFor(st.npc, q));
      return a ? { x: a.x, z: a.z } : null;
    }
    if (st.kind === 'spot' || st.kind === 'photo') return this.spotPos(st);
    return null;
  }

  /** per frame (playing): guide arrow, tap-to-walk marker and arrival */
  private frame016(dt: number): void {
    void dt;
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    // tap-to-walk
    const pl = this.player;
    if (pl.autoResult) {
      const r = pl.autoResult;
      pl.autoResult = null;
      const goal = this.autoGoal;
      this.autoGoal = null;
      this.showWalkMark(null);
      if (r === 'arrived' && goal && this.mode === 'explore' && !this.isModalOpen()) {
        if (goal.kind === 'npc') {
          pl.yaw = Math.atan2(goal.npc.x - pl.x, goal.npc.z - pl.z);
          this.talkToNpc(goal.npc);
        } else {
          const live = this.gatherSpots().find((g) => g.id === goal.node.id);
          if (live) this.useGatherNode(live);
        }
      }
    }
    if (pl.autoPath && this.isModalOpen()) pl.stopAuto(null);
    if (this.walkMark && !this.walkMark.hidden && this.autoGoal) {
      const g = this.autoGoal.kind === 'npc' ? { x: this.autoGoal.npc.x, z: this.autoGoal.npc.z } : { x: this.autoGoal.node.x, z: this.autoGoal.node.z };
      const v = this.gv.set(g.x, Math.max(0, this.island.heightAt(g.x, g.z)) + 0.05, g.z).project(this.camera);
      this.walkMark.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px)`;
    }
    // guide arrow
    if (this.questTick === 0.5 || !this.guideTarget) this.guideTarget = this.guideOn ? this.guidePoint() : null;
    const t = this.guideOn && !this.isModalOpen() && this.mode === 'explore' ? this.guideTarget : null;
    if (!t) { this.ui.setGuideArrow(null); return; }
    const dist = Math.hypot(t.x - pl.x, t.z - pl.z);
    if (dist < 6) { this.ui.setGuideArrow(null); return; }
    const ty = Math.max(0, this.island.heightAt(t.x, t.z)) + 2.2;
    const view = this.gv.set(t.x, ty, t.z).applyMatrix4(this.camera.matrixWorldInverse);
    const inFront = view.z < -0.5;
    const v = this.gv.set(t.x, ty, t.z).project(this.camera);
    const sx = (v.x * 0.5 + 0.5) * w;
    const sy = (-v.y * 0.5 + 0.5) * h;
    const mx = 46, myTop = 96, myBot = 120;
    const label = `${Math.round(dist)} m`;
    if (inFront && sx > mx && sx < w - mx && sy > myTop && sy < h - myBot) {
      // on screen: a small arrow just above the place, pointing down at it
      this.ui.setGuideArrow({ ...this.guideClear(sx, sy - 34), deg: 180, dist: label, near: dist < 14 });
      return;
    }
    // off screen: on an ellipse around the middle of the screen, pointing the way
    const cv = this.gv.set(t.x, ty, t.z).applyMatrix4(this.camera.matrixWorldInverse);
    const a = Math.atan2(cv.x, -cv.z);
    const cx = w / 2, cy = h / 2 + 10;
    const rx = w / 2 - mx, ry = h / 2 - (myTop + myBot) / 2;
    this.ui.setGuideArrow({ ...this.guideClear(cx + Math.sin(a) * rx, cy - Math.cos(a) * ry), deg: (a * 180) / Math.PI, dist: label, near: false });
  }

  private guideAvoid: DOMRect | null = null;
  private guideAvoidAt = 0;
  /** keep the guide arrow (and its distance line) off the quest tracker card at the top left */
  private guideClear(x: number, y: number): { x: number; y: number } {
    const now = performance.now();
    if (now - this.guideAvoidAt > 500) {
      this.guideAvoidAt = now;
      const el = document.getElementById('quest-tracker');
      this.guideAvoid = el && !el.hidden ? el.getBoundingClientRect() : null;
    }
    const r = this.guideAvoid;
    const pad = 30;
    if (r && r.width > 0 && x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad + 12) {
      const h = this.renderer.domElement.clientHeight;
      // below the card when there is room, otherwise just right of it
      if (r.bottom + pad + 12 < h - 140) return { x, y: r.bottom + pad + 12 };
      return { x: r.right + pad, y };
    }
    return { x, y };
  }

  private showWalkMark(on: boolean | null): void {
    if (!this.walkMark) {
      this.walkMark = document.createElement('div');
      this.walkMark.className = 'walk-target';
      this.walkMark.id = 'walk-target';
      this.walkMark.hidden = true;
      document.getElementById('ui-root')!.append(this.walkMark);
    }
    this.walkMark.hidden = !on;
  }

  /** 0.1.6: a tap on the island — a nearby NPC or material (≤ 12 m): walk there, then talk / gather; anything else: nothing */
  private tapAt(sx: number, sy: number): void {
    if (!this.state.started || this.arrival || this.mode !== 'explore' || this.isModalOpen() || this.player.mode === 'canoe') return;
    const pl = this.player;
    const RANGE = 12;
    const PICK = 46; // px around the character / node on screen
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const scr = (x: number, y: number, z: number): { x: number; y: number } | null => {
      const v = this.gv.set(x, y, z).project(this.camera);
      if (v.z > 1) return null;
      return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
    };
    let best: { d: number; goal: NonNullable<Game['autoGoal']>; x: number; z: number; reach: number } | null = null;
    for (const a of this.npcs.actors) {
      if (!a.visible || !a.sprite?.mesh.visible) continue;
      if (Math.hypot(a.x - pl.x, a.z - pl.z) > RANGE) continue;
      const gy = a.sprite.mesh.position.y;
      // the whole figure counts: feet to head
      for (const k of [0.25, 0.6, 0.95]) {
        const p = scr(a.x, gy + CHAR_WORLD_H * k, a.z);
        if (!p) continue;
        const d = Math.hypot(p.x - sx, p.y - sy);
        if (d < PICK && (!best || d < best.d)) best = { d, goal: { kind: 'npc', npc: a }, x: a.x, z: a.z, reach: 1.7 };
      }
    }
    for (const g of this.gatherSpots()) {
      if (g.blocked || Math.hypot(g.x - pl.x, g.z - pl.z) > RANGE) continue;
      const gy = Math.max(0, this.island.heightAt(g.x, g.z));
      for (const k of [0.2, 1.2, 2.4]) {
        const p = scr(g.x, gy + k, g.z);
        if (!p) continue;
        const d = Math.hypot(p.x - sx, p.y - sy);
        if (d < PICK && (!best || d < best.d)) best = { d, goal: { kind: 'gather', node: g }, x: g.x, z: g.z, reach: Math.max(0.6, Math.min(1.4, g.r * 0.6)) };
      }
    }
    if (!best) return;
    // already there: act at once
    if (Math.hypot(best.x - pl.x, best.z - pl.z) <= best.reach + 0.2) {
      this.autoGoal = best.goal;
      pl.startAuto([]);
      pl.autoResult = 'arrived';
      return;
    }
    const path = findWalkPath(pl.x, pl.z, best.x, best.z, best.reach, (x, z) => canStand(x, z, PLAYER_RADIUS));
    if (!path || !path.length) {
      this.ui.toast('走不過去', '那邊沒有路可以走到');
      return;
    }
    this.autoGoal = best.goal;
    pl.startAuto(path);
    this.showWalkMark(true);
  }

  private resetView(): void {
    this.camYaw = CAM_DEFAULT.yaw;
    this.camPitch = CAM_DEFAULT.pitch;
    this.camDist = CAM_DEFAULT.dist;
    this.focus = null;
    this.snapCam = true;
    this.syncCamera();
  }

  private toggleScooter(): void {
    if (!this.state.started || this.player.mode === 'canoe') return;
    if (!this.player.scooter && !this.quests.flags.has('has_scooter')) {
      this.ui.toast('還沒有機車', '先到開元港旁的租車行租車');
      return;
    }
    this.player.setScooter(!this.player.scooter);
    this.ui.setScooter(this.player.scooter);
    const T = this.content.text;
    if (this.player.scooter) this.ui.toast(T.scooterOnTitle, T.scooterOnBody);
    else this.ui.toast(T.scooterOffTitle, T.scooterOffBody);
  }

  private fastTravel(id: string): void {
    if (!this.state.started) return;
    // never teleport mid-dialogue / mid-mini-game: close every layer cleanly first
    this.closeAll();
    let x = 0;
    let z = 0;
    let zh = id;
    const spot = this.content.travel.find((t) => t.id === id);
    if (spot?.landmark) {
      const lm = LANDMARKS.find((l) => l.id === id);
      if (!lm) return;
      x = lm.x;
      z = lm.z;
      zh = spot.zh;
    } else {
      const p = this.places[id];
      if (!p) return;
      x = p.x;
      z = p.z + 2.2;
      zh = p.zh;
    }
    this.player.spawn(x, z);
    this.party.snapAround(this.player);
    this.streamTick = 0;
    this.resetView();
    this.ui.toast(fmt(this.content.text.travelTitle, { name: zh }), this.content.text.travelBody);
  }

  private expose(): void {
    if (!DEBUG_API) return;
    const api = {
      ready: true,
      state: this.state,
      timings: this.timings,
      selectOrigin: (id: PlayableOrigin, gender?: Gender, way?: ArrivalWay, idF?: PlayableOrigin) => this.begin(id, gender, undefined, way, false, idF ?? id),
      /** 0.1.4 arrival opening: state of the cut-scene, and skip / play hooks */
      arrival: () => ({
        playing: !!this.arrival,
        way: this.arrival?.way ?? null,
        phase: this.arrival?.phase ?? null,
        t: this.arrival ? (performance.now() - this.arrival.t0) / 1000 : 0,
        tA: this.arrival ? (performance.now() - this.arrival.tA) / 1000 : 0,
        logoAt: this.arrival?.logoAt ?? 0,
        minEnd: this.arrival?.minEnd ?? 0,
        logoOut: this.arrival?.logoOutAt ?? null,
        skip: this.arrival?.skip ?? false,
        worldReady: this.worldReady,
        load: this.loadP,
        loadLabel: this.loadLabel,
        introScene: !!this.intro,
        introMode: this.intro?.mode ?? null,
        introPose: this.intro ? { ...this.intro.pose } : null,
        saved: this.state.arrival,
        screen: (['title', 'origin', 'arrival', 'intro'] as const).find((k) => this.ui.screenShown(k)) ?? null,
        introEnabled: introEnabled(),
      }),
      playArrival: (id: PlayableOrigin, gender: Gender, way: ArrivalWay) => this.playArrival(id, gender, way),
      skipArrival: () => this.endArrival(),
      /** 0.1.4 intro scene memory: renderer geometries / textures / programs and JS heap, before and after dispose */
      introMemory: () => ({ ...this.introMem, now: this.memSnapshot() }),
      /** jump the painted ride to t seconds (screenshots) */
      seekIntro: (t: number) => this.intro?.seek(t),
      seekFinale: (t: number) => this.intro?.seekFinale(t),
      /** 0.1.5: hold the painted intro at shot time t (and finale time f); null = live (keyframes / recordings) */
      freezeIntro: (t: number | null, f: number | null = null) => this.intro?.freeze(t, f),
      holdArrivalNotebook: (on: boolean) => { this.nbHold = on; },
      /** 0.1.4: where the parked plane and the moored yacht stand (their collision boxes) */
      arrivalProps: () => { const f = facilityBoxes(); return { plane: f[2], yacht: f[3] }; },
      outfit: () => this.playerOutfit(),
      /** shade-zone coverage (0 sun … 1 shade) and the current sprite tint, for verify scripts */
      shadeAt: (x: number, z: number) => shadeAt(x, z),
      shadeStats: () => shadeStats(),
      tints: () => [
        { id: '@player', tint: (this.player.mode === 'walk' ? this.player.sprite : this.player.mode === 'scooter' ? this.player.rideSprite : this.player.canoeSprite).tintValue },
        ...this.npcs.actors.filter((a) => a.sprite).map((a) => ({ id: a.def.id, tint: a.sprite!.tintValue, opacity: a.sprite!.opacityValue, behind: a.sprite!.behind, shade: a.sprite!.shade })),
      ],
      /** nearest spot (on standable ground) whose shade coverage is ≥ min, searching around (x, z) */
      findShade: (x: number, z: number, min = 0.95, maxR = 30) => {
        for (let r = 0; r <= maxR; r += 0.5) {
          const n = Math.max(1, Math.round(r * 6));
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            const px = x + Math.cos(a) * r;
            const pz = z + Math.sin(a) * r;
            if (shadeAt(px, pz) >= min && canStand(px, pz, PLAYER_RADIUS)) return { x: px, z: pz };
          }
        }
        return null;
      },
      /** switch 男生／女生 (re-dresses the player when already on the island) */
      setGender: (g: Gender) => {
        this.state.gender = g;
        if (this.state.started) this.player.setOutfit(this.assets, this.playerOutfit());
      },
      /** tatala pose: board at the nearest water to (x, z) / the player, or step ashore */
      /** board / leave; 族女 / 旅人 (or `modern: true`) get the modern canoe, like the quest steps (0.1.4) */
      setCanoe: async (on: boolean, x?: number, z?: number, modern?: boolean) => {
        const at = x !== undefined && z !== undefined ? { x, z } : undefined;
        if (on) await this.loadCanoeHull(modern ?? !this.tatalaRoles().includes(this.party.controlled));
        return this.setCanoe(on, at);
      },
      /** 0.1.4: what the controlled member's canoe sprite shows (8-way check, tatala rule) */
      canoeLook: () => ({ modern: this.player.canoeModern, eight: this.player.canoeSprite.eight, rows: this.player.canoeSprite.rows, dir: this.player.canoeSprite.dir }),
      playerMode: (): PlayerMode => this.player.mode,
      portrait: () => this.protagonistPortrait(),
      mode: () => this.mode,
      /** period dawn/day/dusk/night, or the content windows 'day' / 'night' */
      setTime: (p: Period) => {
        this.setPeriod(p);
        this.syncQuestCtx();
        this.questDirty = true;
      },
      /** game season (meyvanwa / rayon / manoyotoyon / off) or a content tag: 'summer' → rayon, 'winter' → off */
      setSeason: (s: Season | 'summer' | 'winter') => {
        this.setSeason(s === 'summer' ? 'rayon' : s === 'winter' ? 'off' : s);
        this.syncQuestCtx();
        this.questDirty = true;
      },
      /** current clock as content sees it */
      clock: () => ({ season: this.state.season, seasonTag: seasonTag(this.state.season), period: this.state.period, time: this.state.period === 'night' ? 'night' : 'day' }),
      setLang: (m: LangMode) => this.setLang(m),
      /** show the rest of a dialogue line that is still typing (screenshots) */
      finishTyping: () => this.ui.finishTyping(),
      openJournal: () => this.setOverlay('journal', true),
      closeJournal: () => this.setOverlay('journal', false),
      interactNearest: () => this.tryInteract(),
      teleport: (x: number, z: number) => {
        this.player.spawn(x, z);
        this.streamTick = 0;
      },
      places: this.places,
      /** sheet row the controlled character shows (0.1.1 facing check) */
      facing: () => ({ dir: this.player.active.dir, yaw: this.player.yaw, mode: this.player.mode, walking: this.player.active.walking, eight: this.player.active.eight, rows: this.player.active.rows }),
      /** flora billboards within r of a road centreline (0.1.1 road audit; grass / flowers listed separately) */
      roadFlora: (r = 1.5) => {
        const out: Record<string, number> = {};
        for (const it of this.island.flora.items) if (distToRing(it.x, it.z) < r) out[it.kind] = (out[it.kind] ?? 0) + 1;
        return out;
      },
      playerPos: () => ({ x: this.player.x, z: this.player.z, yaw: this.player.yaw, scooter: this.player.scooter, mode: this.player.mode }),
      cam: () => ({ yaw: this.camYaw, pitch: this.camPitch, dist: this.camDist }),
      camLimits: () => ({ min: CAM_MIN_DIST, def: CAM_DEFAULT.dist, max: CAM_MAX_DIST, scale: charZoomScale(this.camDist) }),
      /** zoom like the wheel / pinch (clamped to the limits) */
      zoomTo: (d: number) => { this.camDist = clamp(d, CAM_MIN_DIST, CAM_MAX_DIST); },
      resetView: () => this.resetView(),
      setScooter: (on: boolean) => {
        this.player.setScooter(on);
        this.ui.setScooter(on);
      },
      toggleScooter: () => this.toggleScooter(),
      fastTravel: (id: string) => this.fastTravel(id),
      canStandAt: (x: number, z: number) => canStand(x, z, PLAYER_RADIUS),
      /** 0.1.5 map phase: terrain box and road lines (screenshots / tests) */
      mapInfo: () => ({ box: { ...TERRAIN_BOX }, roads: roadPolylines().map((pl) => pl.map(([x, z]) => ({ x, z }))) }),
      /** distance to the ring-road centre line (verify: is the scooter really on the road?) */
      roadDist: (x: number, z: number) => distToRing(x, z),
      /** closest standable point on the ring road within r of (x, z) (verify staging) */
      roadPointNear: (x: number, z: number, r = 14) => {
        let best: { x: number; z: number } | null = null;
        let bd = Infinity;
        for (let dx = -r; dx <= r; dx += 0.5) {
          for (let dz = -r; dz <= r; dz += 0.5) {
            const px = x + dx;
            const pz = z + dz;
            const d = Math.hypot(dx, dz);
            if (d < bd && distToRing(px, pz) < 0.45 && canStand(px, pz, PLAYER_RADIUS)) {
              bd = d;
              best = { x: px, z: pz };
            }
          }
        }
        return best;
      },
      /** Apply one camera-relative input step (moveX right, moveZ down) for tests. */
      stepMove: (moveX: number, moveZ: number, dt = 0.2) => {
        this.syncCamera();
        const prev = { x: this.player.x, z: this.player.z };
        this.input.setPad(moveX, moveZ, true);
        this.player.update(dt, this.input, this.camera, false);
        this.input.setPad(0, 0, false);
        return { prev, next: { x: this.player.x, z: this.player.z }, camYaw: this.camYaw };
      },
      advanceDialogue: () => this.advanceDialogue(),
      closeMinigame: () => this.cancelMinigame(),
      setCamera: (o: { yaw?: number; pitch?: number; dist?: number; x?: number; z?: number; snap?: boolean }) => {
        if (o.yaw !== undefined) this.camYaw = o.yaw;
        if (o.pitch !== undefined) this.camPitch = o.pitch;
        if (o.dist !== undefined) this.camDist = o.dist;
        if (o.x !== undefined && o.z !== undefined) this.focus = { x: o.x, z: o.z };
        if (o.snap) {
          this.snapCam = true;
          this.syncCamera();
        }
        this.coverHold = true;
      },
      /** close every modal layer: mini-game, dialogue queue, journal, help */
      closeAll: () => this.closeAll(),
      openModals: () => {
        const open: string[] = [];
        if (this.activity === 'minigame') open.push('minigame');
        if (this.activity === 'dialogue') open.push('dialogue');
        if (this.overlay) open.push(this.overlay);
        if (this.diveOpen) open.push('dive');
        return open;
      },
      /** test hooks for the P1 regressions (fish hand-off, dialogue queue, stuck input) */
      fishTalk: () => this.handleFish(),
      frame: () => this.frameNo,
      dialogueLeft: () => this.dlgQueue.length,
      /** 0.1.4: the open dialogue (speaker + zh), the quest-log ids and the tracked quest (arrival test) */
      dialogueQueue: () => this.dlgQueue.map((l) => ({ who: l.who, zh: l.zh })),
      questLogIds: () => this.questCards().map((c) => c.id),
      trackedQuest: () => this.quests.current()?.id ?? null,
      /** 0.1.6 test hooks */
      v016: {
        villageIn: () => this.villageIn,
        frame: () => this.frameNo,
        /** headless frames are slow: run the per-tick bits by hand (camera, NPC streaming, village check) */
        sync: () => { this.syncCamera(); this.camera.updateMatrixWorld(); this.streamNpcs(); this.villageTick(); return { v: this.villageIn, d: this.camDist }; },
        /** walk the tap-to-walk path n steps without the render loop */
        stepAuto: (dt = 0.1, n = 1) => {
          for (let i = 0; i < n; i++) {
            this.syncCamera(); this.camera.updateMatrixWorld();
            this.player.update(dt, this.input, this.camera, !this.state.started || this.isModalOpen());
            this.frame016(dt);
            if (this.mode !== 'explore') break;
          }
          return { mode: this.mode, path: this.player.autoPath?.length ?? 0, x: this.player.x, z: this.player.z };
        },
        camDist: () => this.camDist,
        warm: () => warmStats(),
        guide: () => ({ on: this.guideOn, target: this.guidePoint() }),
        setGuide: (on: boolean) => this.setGuide(on),
        /** screen point of an NPC's chest (for a tap) */
        npcScreen: (id: string) => {
          const a = this.npcs.byId(id);
          if (!a || !a.sprite) return null;
          const v = this.gv.set(a.x, a.sprite.mesh.position.y + CHAR_WORLD_H * 0.6, a.z).project(this.camera);
          return { x: (v.x * 0.5 + 0.5) * this.renderer.domElement.clientWidth, y: (-v.y * 0.5 + 0.5) * this.renderer.domElement.clientHeight, d: Math.hypot(a.x - this.player.x, a.z - this.player.z), visible: a.visible };
        },
        /** the NPCs with a sprite up near the player, nearest first */
        npcsNear: (r = 12) => this.npcs.actors.filter((a) => a.visible && Math.hypot(a.x - this.player.x, a.z - this.player.z) <= r)
          .map((a) => ({ id: a.def.id, x: a.x, z: a.z, d: Math.hypot(a.x - this.player.x, a.z - this.player.z) })).sort((a, b) => a.d - b.d),
        save: () => this.saveNow(),
        arrivalActive: () => !!this.arrival,
        tap: (x: number, y: number) => this.tapAt(x, y),
        auto: () => ({ path: this.player.autoPath?.length ?? 0, goal: this.autoGoal ? (this.autoGoal.kind === 'npc' ? `npc:${this.autoGoal.npc.def.id}` : `gather:${this.autoGoal.node.id}`) : null }),
        roadFollow: (on: boolean) => { this.player.roadFollow = on; },
        /** queue n word postcards at once (collect-all check) */
        demoCards: (n: number) => {
          for (const g of this.db.glossary.slice(0, n)) this.cards.push({ el: postcardEl({ key: `demo:${g.id}`, kicker: '新的族語詞', tao: g.tao, name: g.zh }), kind: 'postcard', key: `demo:${g.id}` });
        },
        collectAll: () => this.cards.collectAll(),
      },
      resetInput: () => this.input.resetHeld(),
      lightsVisible: () => this.decor.lightsVisibleCount(),
      showHelp: (auto = false) => this.ui.showHelp(auto),
      quality: () => quality(),
      saveState: () => this.state.toJSON(),
      setOutfit: (k: string) => this.player.setOutfit(this.assets, k),
      /** Phase B: outfits — unlock (as a quest reward would), wear (null = everyday clothes), what a member looks like */
      unlockOutfit: (id: string) => {
        if (!this.outfits.byId.has(id)) return false;
        this.quests.outfits.add(id);
        this.saveNow();
        return true;
      },
      wearOutfit: (r: Role, id: string | null) => this.wearOutfit(r, id),
      outfitLook: (r: Role) => ({ sheet: this.roleOutfit(r), portrait: this.rolePortrait(r), worn: this.outfits.equipped[r] ?? null, shown: this.party.controlled === r ? this.player.outfit : this.party.followers.find((f) => f.role === r)?.outfit ?? null, unlocked: [...this.quests.outfits] }),
      /** Phase B: bag + 圖鑑 counts, and the content summary */
      codex: () => this.inv.codex().map((c) => ({ id: c.def.id, known: c.known, n: c.n })),
      content: () => ({
        quests: this.db.quests.length,
        playable: this.db.quests.filter((q) => q.playable).length,
        items: this.db.items.size,
        recipes: this.db.recipes.length,
        npcs: this.db.npcs.length,
        dialogues: this.db.dialogues.size,
        photoSpots: this.db.photoSpots.length,
        gatherNodes: this.db.gatherNodes.length,
        outfits: this.db.outfits.length,
        places: Object.keys(this.db.places).length,
        /** every place id a split / meet can name (the HUD shows their zh names) */
        splitPlaces: [...new Set(this.db.quests.flatMap((q) => q.steps.flatMap((s) => [...Object.values(s.split ?? {}).map((x) => x?.at), s.meet])).filter((x): x is string => !!x))],
      }),
      /** Phase B: use a live gather / observe node now (wherever the player stands) */
      gather: (nodeId: string) => {
        const n = this.gatherSpots().find((g) => g.id === nodeId);
        if (!n) return false;
        this.useGatherNode(n);
        return true;
      },
      /** Phase B: NPC chat lines without opening the box (dialogue sets: greet / duty / idle / keeper / after) */
      chat: (npcId: string) => {
        const d = this.db.npcs.find((n) => n.id === npcId);
        return d?.dialogue ? this.npcChat(d.dialogue) : [];
      },
      /** walk up to a named NPC and talk (demo / screenshot hook) */
      talkTo: (id: string) => {
        const a = this.npcs.byId(id);
        if (!a) return false;
        if (Math.hypot(a.x - this.player.x, a.z - this.player.z) > 6) this.player.spawn(a.x + 1.1, a.z + 0.6);
        if (this.activity !== 'cover') this.activity = 'explore';
        this.talkToNpc(a);
        return true;
      },
      popLoot: (text: string) => this.ui.popLoot(text, this.player.x, this.player.z),
      toast: (title: string, body = '') => this.ui.toast(title, body),
      /** 0.1.5 cards: switch the automatic cards / quest pages / arrival photos on or off (headless runs start off) */
      cardsAuto: (on: boolean) => { this.cardsAuto = on; document.documentElement.classList.toggle('fx', on); },
      cards: () => ({ open: this.cards.open, kind: this.cards.current?.kind ?? null, key: this.cards.current?.key ?? null, pending: this.cards.pending, shown: [...this.cards.shown], seen: [...this.state.cards] }),
      cardTap: () => this.cards.tap(),
      /** run the scenic-spot check now as if the player had walked here */
      scenicCheck: () => this.scenicTick(true),
      album: () => [...this.state.album],
      /** learn a dish now (journal recipe → its recipe card) */
      unlockRecipe: (id: string) => this.state.unlock(this.state.recipes, [id]).length > 0,
      /** show a quest's own page as if it had just been accepted */
      questPage: (id: string) => {
        const q = this.quests.get(id);
        if (!q) return false;
        if (!this.quests.active.has(id)) {
          this.quests.done.delete(id);
          this.quests.active.set(id, 0);
        }
        this.queueQuestPage([q]);
        return true;
      },
      taught: () => [...this.state.taught],
      herds: () => this.goats?.herdInfo() ?? [],
      placeHerd: (id: string, x: number, z: number) => this.goats?.placeHerd(id, x, z) ?? false,
      npcPace: (id: string) => {
        const a = this.npcs.byId(id);
        if (!a) return null;
        return { id, pace: a.pace, speed: npcWalkSpeed(a.pace), walkRate: a.sprite?.walkRate ?? npcWalkRate(a.pace), walkSteps: a.sprite?.walkSteps ?? 0, x: a.x, z: a.z, walking: a.sprite?.walking ?? false };
      },
      setNpcPace: (id: string, pace: NpcPace) => { const a = this.npcs.byId(id); if (!a) return false; a.setPace(pace); return true; },
      setNpcRoute: (id: string, pts: { x: number; z: number }[]) => { const a = this.npcs.byId(id); if (!a) return false; a.wait = 0; a.stuck = 0; a.setRoute(pts); return true; },
      loadNpc: (id: string) => {
        const a = this.npcs.byId(id);
        if (!a || !this.assets) return false;
        a.load(this.assets, this.npcs.group, 1);
        return true;
      },
      npcHasSprite: (id: string) => !!this.npcs.byId(id)?.sprite,
      placeNpc: (id: string, x: number, z: number) => {
        const a = this.npcs.byId(id);
        if (!a) return false;
        const safe = findSafeStand(x, z, NPC_RADIUS);
        a.x = safe.x; a.z = safe.z; a.wait = 0; a.stuck = 0;
        a.setRoute([{ x: safe.x, z: safe.z }]);
        a.sync(true);
        return { x: safe.x, z: safe.z };
      },
      tickNpcs: (dt: number, steps = 1) => {
        for (let i = 0; i < steps; i++) {
          this.npcs.tickMoves(dt, this.player);
          for (const a of this.npcs.actors) {
            if (!a.sprite) continue;
            a.sync();
            a.sprite.updateBillboard(this.camera, dt, true);
          }
        }
      },
      npcSpeeds: () => ({ walk: npcWalkSpeed('escort'), ambient: npcWalkSpeed('ambient'), escort: npcWalkSpeed('escort'), animFull: WALK_ANIM_RATE, animAmbient: WALK_ANIM_RATE * npcWalkRate('ambient'), scale: 1 / 3 }),
      // ---- Phase 1: party + quests + autosave
      party: () => ({ controlled: this.party.controlled, pos: this.party.positions(this.player), outfits: this.partyOutfits() }),
      switchMember: (r: Role) => this.switchMember(r),
      quest: (id: string) => {
        const q = this.quests.get(id);
        if (!q) return null;
        return { id, status: this.quests.status(q), step: this.quests.active.get(id) ?? null, playable: q.playable, block: this.quests.step(q) ? this.stepBlock(q, this.quests.step(q)!) : null };
      },
      questIds: () => ({ active: [...this.quests.active.keys()], done: [...this.quests.done] }),
      questCounts: () => {
        const c = { main: 0, side: 0, photo: 0, total: this.quests.defs.length };
        for (const q of this.quests.defs) c[q.line]++;
        return c;
      },
      /** debug: finish a quest without playing it (unlocks still run) */
      completeQuest: (id: string) => {
        const ev = this.quests.forceDone(id);
        this.syncQuestCtx();
        ev.push(...this.quests.refresh());
        this.handleQuestEvents(ev);
        this.saveNow();
        return ev.map((e) => `${e.type}:${e.q.id}`);
      },
      questState: () => this.quests.toJSON(),
      /** where a quest's current spot / NPC is (verify staging) */
      questTarget: (id: string) => {
        const q = this.quests.get(id);
        const st = q ? this.quests.step(q) : null;
        if (!q || !st) return null;
        if (st.kind === 'talk') {
          const a = this.npcs.byId(this.npcFor(st.npc, q));
          return a ? { kind: 'npc', id: a.def.id, x: a.x, z: a.z } : null;
        }
        const p = this.spotPos(st);
        return p ? { kind: st.kind, x: p.x, z: p.z, r: st.r ?? 6 } : null;
      },
      useSpot: () => {
        const s2 = this.nearestQuestSpot(this.player.x, this.player.z);
        if (s2) this.useQuestSpot(s2.q, s2.st, s2.sub);
        return !!s2;
      },
      tracker: () => this.ui.el('#quest-tracker').textContent,
      // batch 1b
      collect: () => [...this.quests.collect],
      playSong: (id: string) => this.playSong(id),
      diveOpen: () => this.diveOpen,
      saveCode: () => this.saveCode(),
      importSave: (t: string) => this.importSave(t),
      setFlag: (f: string) => {
        this.quests.flags.add(f);
        this.questDirty = true;
      },
      markerCount: () => this.markers.size,
      saveNow: () => this.saveNow(),
      readSave: () => readSave(),
      clearSave: () => clearSave(),
      continueSave: () => {
        const sv = readSave();
        if (sv) this.resume(sv);
        return !!sv;
      },
      openQuests: () => this.ui.openJournalTab('quests'),
      /** bring the two followers right behind the controlled member */
      gatherParty: () => this.party.snapAround(this.player),
      npcAt: (id: string) => {
        const a = this.npcs.byId(id);
        return a ? { x: a.x, z: a.z } : null;
      },
      /** line the cast up facing the camera at (x, z) so the new sprites can be compared side by side */
      stageCast: (x: number, z: number, yaw: number, ids?: string[]) => {
        const cast = ids ?? ['elder_ivalino', 'villager_taro', 'villager_harbor', '@player', 'clinic_nurse', 'harbor_staff', 'tourist_b'];
        const rx = Math.cos(yaw);
        const rz = -Math.sin(yaw);
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        cast.forEach((id, i) => {
          const k = (i - (cast.length - 1) / 2) * 0.92;
          const d = (i % 2) * 0.35;
          const px = x + rx * k + fx * d;
          const pz = z + rz * k + fz * d;
          if (id === '@player') {
            this.player.spawn(px, pz);
            this.player.yaw = yaw;
          } else this.npcs.place(id, px, pz, yaw + (i - (cast.length - 1) / 2) * 0.25);
        });
      },
      clearFocus: () => {
        this.focus = null;
      },
      // ---- Party split & recipes batch: test hooks (docs/phase1/TEST_HOOKS.md)
      /** teleport to a place id (places.json + derived), an NPC id, or a quest's current target */
      goto: (id: string) => {
        const a = this.npcs.byId(id);
        const p = a ? { x: a.x + 1.1, z: a.z + 0.6 } : this.places[id] ? { x: this.places[id].x, z: this.places[id].z + 1.2 } : null;
        if (!p) return false;
        const s2 = canStand(p.x, p.z, PLAYER_RADIUS) ? p : (api.roadPointNear(p.x, p.z, 6) ?? p);
        this.player.spawn(s2.x, s2.z);
        this.party.snapAround(this.player);
        this.streamTick = 0;
        return true;
      },
      setWorld: (o: { season?: Season; period?: Period }) => {
        if (o.season) this.setSeason(o.season);
        if (o.period) this.setPeriod(o.period);
        this.syncQuestCtx();
        this.questDirty = true;
        return { season: this.state.season, period: this.state.period };
      },
      /** put the clock / season where a quest's window (time / seasons / periods / tide, + its photo spot) allows it */
      fitWhen: (id: string) => {
        const q = this.quests.get(id);
        if (!q) return null;
        const ps = this.photos.window(q.id);
        const w = { ...q, ...(ps ? { time: ps.time ?? q.time, seasons: ps.seasons?.length ? ps.seasons : q.seasons, periods: ps.periods ?? q.periods } : {}) };
        const c = fitClock(w, { season: this.state.season, period: this.state.period });
        if (c) {
          if (c.season !== this.state.season) this.setSeason(c.season);
          if (c.period !== this.state.period) this.setPeriod(c.period);
        }
        this.syncQuestCtx();
        this.questDirty = true;
        return { season: this.state.season, period: this.state.period, ok: this.questWindow(q).ok };
      },
      giveItem: (id: string, n = 1) => {
        this.quests.items[id] = Math.max(0, (this.quests.items[id] ?? 0) + n);
        this.quests.collect.add(`item:${id}`);
        if (this.db.items.get(id)?.category === 'ingredient') this.state.unlock(this.state.ingredients, [id]);
        this.syncQuestCtx();
        this.handleQuestEvents(this.quests.refresh(), true);
        this.questDirty = true;
        return this.quests.items[id];
      },
      items: () => ({ ...this.quests.items }),
      recipes: () => ({ recipes: [...this.state.recipes], ingredients: [...this.state.ingredients], need: this.neededIngredients() }),
      /** unlock a quest now (prerequisites skipped), optionally at step k */
      startQuest: (id: string, k = 0) => {
        const q = this.quests.get(id);
        if (!q) return false;
        this.quests.done.delete(id);
        this.quests.active.set(id, Math.max(0, Math.min(k, q.steps.length - 1)));
        this.questDirty = true;
        return true;
      },
      /** finish the current step (or the next member part of a tasks step) without playing it; party effects apply */
      completeStep: (id: string, role?: Role) => {
        const q = this.quests.get(id);
        if (!q || !this.quests.active.has(id)) return null;
        const open = this.quests.openSteps(q);
        const o = open.find((x) => !role || x.st.actor?.includes(role)) ?? open[0];
        this.closeAll();
        this.completeStep(q, o && o.sub >= 0 ? o.sub : -1);
        return { status: this.quests.status(q), step: this.quests.active.get(id) ?? null };
      },
      /** party split state: per member status / place / position / switch block, solo, regroup point */
      members: () => {
        const pos = this.party.positions(this.player);
        return {
          controlled: this.party.controlled,
          solo: this.quests.solo,
          meet: this.quests.meet,
          split: this.quests.isSplit(),
          m: { ...this.quests.members.m, pos: pos.m, block: this.quests.memberBlock('m'), status: this.memberStatus('m') },
          f: { ...this.quests.members.f, pos: pos.f, block: this.quests.memberBlock('f'), status: this.memberStatus('f') },
          t: { ...this.quests.members.t, pos: pos.t, block: this.quests.memberBlock('t'), status: this.memberStatus('t') },
          banner: (this.ui.el('#party-split') as HTMLElement).hidden ? null : this.ui.el('#ps-text').textContent,
        };
      },
      forceSplit: (spec: Partial<Record<Role, { at: string; task: string; ctrl?: boolean }>>, meet?: string) => {
        this.quests.forceSplit(spec, meet);
        return api.members();
      },
      forceSolo: (role: Role = 'm', at = 'harbor', waitAt = 'harbor', task = '出海捕飛魚') => {
        this.quests.forceSolo(role, at, waitAt, task);
        return api.members();
      },
      forceRegroup: () => {
        this.quests.forceRegroup();
        this.party.snapAround(this.player);
        return api.members();
      },
      abortSolo: () => this.abortSolo(),
      /** next mini-game succeeds by itself (sea trip / taro / fish) */
      autoMinigame: (on = true) => {
        this.mgAuto = on;
      },
      /**
       * Play the current step of a quest for real, fast: pick a member who may do it (switching like the HUD
       * does), teleport to the NPC / spot, bring the party, talk / use the spot, auto-hit a mini-game, read
       * through the dialogue. Returns what happened and, when it could not run, the in-game reason.
       */
      runStep: (id: string, opts: { fitWhen?: boolean } = {}) => {
        const q = this.quests.get(id);
        if (!q) return { ok: false, why: 'no such quest' };
        if (!this.quests.active.has(id)) return { ok: false, why: `status ${this.quests.status(q)}` };
        if (opts.fitWhen) api.fitWhen(id);
        this.closeAll();
        const before = JSON.stringify([this.quests.active.get(id) ?? -1, this.quests.done.has(id), [...this.quests.tasksDone].length]);
        const progressed = (): boolean => JSON.stringify([this.quests.active.get(id) ?? -1, this.quests.done.has(id), [...this.quests.tasksDone].length]) !== before;
        const open = this.quests.openSteps(q);
        if (!open.length) return { ok: false, why: 'no open step' };
        const E = this.quests;
        // prefer a part / step the controlled member can do, else one whose member can be switched to
        const pick = open.find((o) => (o.st.actor ?? q.roles).includes(this.party.controlled) && !E.memberBlock(this.party.controlled))
          ?? open.find((o) => (o.st.actor ?? q.roles).some((r) => !E.memberBlock(r)))
          ?? open[0];
        const st = pick.st;
        if (st.kind === 'placeholder') return { ok: false, why: 'placeholder' };
        if (st.kind === 'auto') {
          this.syncQuestCtx();
          this.handleQuestEvents(this.quests.refresh());
          this.runPendingAutoLines();
          for (let i = 0; i < 200 && this.mode === 'dialogue'; i++) this.advanceDialogue();
          return { ok: progressed(), why: progressed() ? '' : `auto step waits: ${st.until ? JSON.stringify(st.until) : this.questWindow(q).why}` };
        }
        const roles = st.actor ?? q.roles;
        if (!roles.includes(this.party.controlled)) {
          const r = roles.find((x) => !E.memberBlock(x));
          if (!r) return { ok: false, why: roles.map((x) => E.memberBlock(x)).join(' ') };
          this.switchMember(r);
          if (this.party.controlled !== r) return { ok: false, why: `cannot switch to ${r} (mode ${this.mode}, dive ${this.diveOpen}, ${this.player.mode}, started ${this.state.started})` };
        }
        // go there
        let target: { x: number; z: number } | null = null;
        let npc: NpcActor | undefined;
        if (st.kind === 'talk') {
          npc = this.npcs.byId(this.npcFor(st.npc, q));
          if (!npc) return { ok: false, why: `npc ${st.npc} missing` };
          target = { x: npc.x + 1.1, z: npc.z + 0.6 };
        } else target = this.spotPos(st);
        if (!target) return { ok: false, why: 'no target position' };
        if (this.player.mode === 'canoe') this.setCanoe(false);
        this.player.spawn(target.x, target.z);
        this.party.snapAround(this.player);
        this.streamTick = 0;
        if (this.activity !== 'cover') this.activity = 'explore';
        if (npc) this.talkToNpc(npc, id);
        else {
          if (st.minigame) this.mgAuto = true;
          this.useQuestSpot(q, st, pick.sub);
        }
        for (let i = 0; i < 300 && (this.mode === 'dialogue' || this.dlgQueue.length); i++) this.advanceDialogue();
        this.mgAuto = false;
        const block = this.stepBlock(q, st);
        return { ok: progressed(), why: progressed() ? '' : block ?? 'did not progress', step: this.quests.active.get(id) ?? null, status: this.quests.status(q), controlled: this.party.controlled };
      },
      /** run a quest from where it is to the end with runStep (stops at the first step that cannot run) */
      runQuest: (id: string, opts: { fitWhen?: boolean; max?: number } = {}) => {
        const trace: unknown[] = [];
        for (let i = 0; i < (opts.max ?? 20) && this.quests.active.has(id); i++) {
          const r = api.runStep(id, opts);
          trace.push(r);
          if (!r.ok) break;
        }
        return { done: this.quests.done.has(id), trace };
      },
      /** world interactables (taro fields, fishing spot, clinic, lookout) — for tests that play the free mini-games */
      interactables: () => this.decor.interactables.map((it) => ({ ...it })),
      /** recipe gather spots that are live now (only for ingredients a recipe still needs) */
      gatherSpots: () => this.gatherSpots(),
      /** zh name the HUD shows for a place / landmark id ('' when unknown) */
      placeZh: (id: string) => this.placeZh(id),
      /** what E would do here: npc:<id> / spot:<quest> / gather:<item> / it:<kind> / null */
      nearTarget: () => {
        const n = this.nearestTarget();
        if (!n) return null;
        if ('npc' in n) return `npc:${n.npc.def.id}`;
        if ('spot' in n) return `spot:${n.spot.q.id}`;
        if ('gather' in n) return `gather:${n.gather.id}`;
        return `it:${n.it.kind}`;
      },
      /** NPC streaming: sprites alive now, sheets held, ids */
      npcLoaded: () => ({ loaded: this.npcs.loadedIds().length, total: this.npcs.actors.length, ...this.assets.streamStats(), groups: this.npcs.loadedGroups(), ids: this.npcs.loadedIds() }),
      renderInfo: () => ({ ...this.renderer.info.render, trees: this.island.treeCount }),
      memory: () => ({ ...this.renderer.info.memory }),
    };
    (window as unknown as { __TAO_RPG__: typeof api }).__TAO_RPG__ = api;
  }
}

/** 0.1.5: the main island (outline + 7 m of sea), for the fast-travel map */
function travelMapBox(): { xMin: number; zMin: number; xMax: number; zMax: number } {
  let xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity;
  for (let i = 0; i < LANYU_OUTLINE.length; i += 2) {
    xMin = Math.min(xMin, LANYU_OUTLINE[i]); xMax = Math.max(xMax, LANYU_OUTLINE[i]);
    zMin = Math.min(zMin, LANYU_OUTLINE[i + 1]); zMax = Math.max(zMax, LANYU_OUTLINE[i + 1]);
  }
  const h = FACILITIES.harbor;
  xMin = Math.min(xMin, h.x - 16);
  return { xMin: Math.floor(xMin - 7), zMin: Math.floor(zMin - 7), xMax: Math.ceil(xMax + 7), zMax: Math.ceil(zMax + 7) };
}

function drawMinimap(ctx: CanvasRenderingContext2D, w: number, h: number, box: { xMin: number; zMin: number; xMax: number; zMax: number } = TERRAIN_BOX): void {
  const { xMin, zMin, xMax, zMax } = box;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let py = 0; py < h; py++) {
    const z = zMin + (py / (h - 1)) * (zMax - zMin);
    for (let px = 0; px < w; px++) {
      const x = xMin + (px / (w - 1)) * (xMax - xMin);
      const s = sample(x, z);
      const i = (py * w + px) * 4;
      let r = 28, gch = 58, b = 72;
      if (s.mask > 0.45 && s.height > -0.05) {
        r = 86; gch = 124; b = 62;
        if (s.beach > 0.25) { r = 232; gch = 214; b = 160; }
        if (s.cliff > 0.45) { r = 90; gch = 86; b = 78; }
        if (s.village > 0.35) { r = 198; gch = 184; b = 140; }
        if (s.terrace > 0.2) { r = 72; gch = 96; b = 52; }
        if (s.bund > 0.25) { r = 214; gch = 204; b = 176; }
        if (s.road > 0.12 || distToRing(x, z) < 1.3) { r = 236; gch = 228; b = 206; }
        else if (s.path > 0.35) { r = 214; gch = 200; b = 168; }
      } else if (s.height > -1.4) {
        r = 62; gch = 110; b = 122;
      }
      d[i] = r; d[i + 1] = gch; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
