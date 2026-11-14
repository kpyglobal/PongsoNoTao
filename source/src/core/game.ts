import * as THREE from 'three';
import { seasonLook } from '../render/look';
import { setPaintLook, worldStyle } from '../render/stylize';
import { PAINT } from '../render/styleConfig';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Assets } from './assets';
import { Input, type InputAction } from './input';
import { GameState, type Gender, type LangMode } from './state';
import { PRESETS, type Period, type Season } from './timeSeason';
import { PostFX } from './post';
import { SkyLighting } from '../world/sky';
import { Ocean, bakeLandFieldAsync } from '../world/water';
import { WorldDecor, type PlaceRec } from '../world/populate';
import { addQuestPlaces, hostPlaces } from '../world/places';
import { TaroTerraces } from '../world/paddies';
import { sample, sampleHM, gridAsync, TERRAIN_BOX, distToRing } from '../world/height';
import { Player, type PlayerMode } from '../entities/player';
import { NpcSystem, NPC_LOAD_AHEAD, type NpcActor } from '../entities/npcs';
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
import { initCollision, canStand, PLAYER_RADIUS } from '../world/collision';
import { buildShade, shadeAt, shadeStats } from '../world/shade';
import type { SpriteBillboard } from '../entities/billboard';
import { LANDMARKS } from '../world/layout';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Party, ROLES } from '../entities/party';
import { QuestEngine, tideAt, type QuestEvent } from '../quests/engine';
import type { QuestDef, QuestStep, Role, StepLine } from '../quests/types';
import { readSave, writeSave, clearSave, validateSave, type SaveJSON } from './save';
import { CHAR_WORLD_H } from '../entities/billboard';
import type { QuestCardVM } from '../ui/dom';
import { closeImagePopup, showDive, showSongCard, renderAlbum, renderSaveTab, type AlbumVM, type SongVM } from '../ui/phase1b';

const ROLE_ZH: Record<Role, string> = { m: '族男', f: '族女', t: '旅人' };
type DlgLine = { who: string; zh: string; tao: string; portrait?: string; unlocks?: DialogueUnlocks };

/** What the player is doing; overlays (journal / travel / help) sit on top of it. */
type Activity = 'cover' | 'explore' | 'dialogue' | 'minigame';
/** The one explicit game mode the loop, input routing and the UI read. */
export type Mode = Activity | Overlay;

/** The test / debug API is only exposed in dev builds or with ?debug in the URL. */
const DEBUG_API = import.meta.env.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'));

/** default view ~1.3x the old 17; the old default is now the closest zoom; max frames a whole village */
const CAM_DEFAULT = { yaw: 0.7, pitch: 0.58, dist: 22 };
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
  private activity: Activity = 'cover';
  private overlay: Overlay | null = null;
  private content!: UiContent;
  private camCur = { yaw: 0.55, pitch: 0.62, dist: 22, x: 0, y: 0, z: 0 };
  private player!: Player;
  private npcs!: NpcSystem;
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
  private camDist = 22;
  private camBtn = 0;
  private dlgQueue: DlgLine[] = [];
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

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ui = new UI(document.getElementById('ui-root')!);
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
      onOrigin: (id, gender) => {
        // S2: one save slot — ask before a new journey replaces it
        const meta = this.saveMeta(readSave());
        if (meta && !window.confirm(`開始新旅程會覆蓋現有存檔：\n${meta}\n\n確定要重新開始嗎？（想保留可以先到手札「存檔」匯出）`)) return;
        this.begin(id, gender, 't');
      },
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
      onContinue: () => {
        const sv = readSave();
        if (sv) this.resume(sv);
      },
    };
    this.ui.onTrack = (id) => {
      this.quests.tracked = id;
      this.questDirty = true;
      this.refreshQuestUi(true);
    };
    // batch 1b: 手札 pages drawn by src/ui/phase1b.ts
    this.ui.tabRenderers.album = (pages) => renderAlbum(pages, this.albumVM());
    this.ui.tabRenderers.save = (pages) =>
      renderSaveTab(pages, { code: () => this.saveCode(), download: () => this.downloadSave(), importText: (t) => this.importSave(t) });
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
    if (!this.ready) return;
    if (a === 'escape') {
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
      const a0 = performance.now();
      await this.assets.load((p, label) => this.ui.setLoad(p * 0.62, label));
      this.timings.assets = performance.now() - a0;
      this.ui.setLoad(0.64, '雕塑火山稜線與海灣……');
      await yieldToUi(true);
      const g0 = performance.now();
      await gridAsync((p) => this.ui.setLoad(0.64 + p * 0.12, '雕塑火山稜線與海灣……'));
      this.timings.grid = performance.now() - g0;
      initCollision();
      this.ui.bakeMinimap(drawMinimap);
      this.ui.setLoad(0.77, '為島嶼上色……');
      await yieldToUi(true);
      const w0 = performance.now();
      await this.buildWorld();
      this.timings.world = performance.now() - w0;
      this.timings.paint = lastPaintMs;
      this.ui.setLoad(0.97, '烘上島嶼的光……');
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
      this.post.render(0);
      this.ui.setLoad(1, '完成');
      // cover: slow orbit over the whole island behind the title card
      this.focus = { x: -2, z: 6 };
      this.camYaw = 0.75;
      this.camPitch = 0.66;
      this.camDist = 92;
      this.snapCam = true;
      this.ui.showOrigin();
      try {
        this.ui.showContinue(this.saveMeta(readSave()));
      } catch (e) {
        console.warn('save unreadable', e);
        this.ui.showContinue(null);
      }
      this.ready = true;
      this.timings.boot = performance.now() - boot0;
      this.expose();
      this.loop();
    } catch (err) {
      console.error(err);
      this.ui.setLoad(1, '載入失敗，請重新整理頁面再試一次。');
      this.ui.setOverlayOpen(true);
      this.ui.el('#boot-screen').style.display = 'flex';
      throw err;
    }
  }

  private async buildWorld(): Promise<void> {
    this.db = content();
    this.places = JSON.parse(JSON.stringify(this.db.places)) as Record<string, PlaceRec>;
    this.dlg = new Dialogue(this.db.dialogues);
    this.content = checkShape<UiContent>('ui', this.db.ui);
    checkShape('glossary', this.db.glossary);
    checkShape('milestones', this.db.milestones);
    this.ui.setContent(this.content);

    this.island = new Island(this.assets);
    await this.island.build((p) => this.ui.setLoad(0.77 + p * 0.12, '為島嶼上色……'));
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

    this.ui.setLoad(0.90, '描上海岸與礁棚……');
    await yieldToUi(true);
    const landTex = await bakeLandFieldAsync(
      WORLD_BOX.xMin, WORLD_BOX.zMin, WORLD_BOX.xMax, WORLD_BOX.zMax,
      (x, z) => sampleHM(x, z),
      512,
      (p) => this.ui.setLoad(0.90 + p * 0.03, '描上海岸與礁棚……'),
    );
    this.ocean = new Ocean(landTex, WORLD_BOX);
    this.scene.add(this.ocean.mesh);

    this.ui.setLoad(0.94, '砌石田埂、地下屋與拼板舟……');
    await yieldToUi(true);
    this.terraces = new TaroTerraces(this.island.flora);
    this.scene.add(this.terraces.group);
    this.island.finishFlora();
    buildShade(this.island.flora.items);

    this.decor = new WorldDecor(this.assets, this.places);
    this.scene.add(this.decor.group);

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
    });
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
      if (g.glossary?.length) {
        const fresh = this.state.unlock(this.state.glossary, g.glossary);
        if (fresh.length) this.ui.toast('族語詞卡', `學會 ${fresh.length} 個新詞，已寫進手札。`);
      }
      if (g.recipe) this.state.unlock(this.state.recipes, [g.recipe]);
      const ing = (g.items ?? []).filter((i) => this.db.items.get(i)?.category === 'ingredient');
      if (ing.length) this.state.unlock(this.state.ingredients, ing);
      g.items?.forEach((i) => this.quests.collect.add(`item:${i}`));
      if (g.outfits?.length) {
        for (const o of g.outfits) void this.outfits.ensure(o, (rel) => this.assets.acquire(rel));
        if (!g.toast) this.ui.toast('解鎖服裝', `${g.outfits.map((o) => this.outfits.byId.get(o)?.name.zh ?? o).join('、')}：在手札的「背包」頁可以換穿。`);
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
   * New game. The party is fixed (族男 + 族女 + traveller); `id` is the 族人 home village (主人家).
   * `lead` = who is controlled first (the UI starts with the traveller). Debug / older scripts:
   * selectOrigin('visitor', g) → traveller lead; selectOrigin(village, g) → 族男 / 族女 lead by g.
   */
  private begin(id: PlayableOrigin, gender: Gender = this.state.gender, lead?: Role): void {
    const T = this.content.text;
    try {
      const home = id === 'visitor' ? 'yayo' : id;
      if (!this.places[home]) throw new Error(`no home village ${home}`);
      const controlled: Role = lead ?? (id === 'visitor' ? 't' : gender === 'f' ? 'f' : 'm');
      this.closeAll();
      // S3: a fresh journal (nothing left over from an earlier or half-loaded run); keep the language setting
      Object.assign(this.state, new GameState(), { lang: this.state.lang, period: this.state.period, season: this.state.season });
      this.state.gender = gender === 'f' ? 'f' : 'm';
      this.state.origin = home;
      this.state.started = true;
      this.setHostPlaces(home);
      this.state.unlockMilestone('arrive');
      // the whole party lands together at 開元港 (Q01; plane / boat cut-scenes come in Phase 3)
      const hp = this.places.harbor;
      this.player.setScooter(false);
      this.player.spawn(hp.x + 1.6, hp.z + 1.2);
      this.player.yaw = Math.PI * 0.5;
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
      this.memberKey = {};
      this.syncStay(false);
      this.syncQuestCtx();
      this.quests.refresh();
      this.refreshPartyUi();
      const q1 = this.quests.get('Q01');
      const st = q1 ? this.quests.step(q1) : null;
      if (q1 && st) this.runStep(q1, st, null);
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
      this.quests.load(sv.quests);
      this.setHostPlaces(this.state.origin && this.places[this.state.origin] ? this.state.origin : 'yayo');
      const c: Role = ROLES.includes(sv.party.controlled) ? sv.party.controlled : 't';
      const pos = sv.party.pos ?? ({} as SaveJSON['party']['pos']);
      const me = pos[c] ?? { x: this.places.harbor.x, z: this.places.harbor.z };
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
      this.ui.toast('讀取存檔', '從上次離開的地方繼續。');
    } catch (err) {
      console.error(err);
      this.ui.toast('存檔讀取失敗', '請重新開始一段旅程。');
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
    this.island.setSeason(s);
    this.decor.applyTime(p, s);
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
    this.ui.syncChips(this.state.period, this.state.season, m);
    if (this.dlgQueue.length) {
      const cur = this.dlgQueue[0];
      this.ui.openDialogue(cur.who, cur.zh, cur.tao, m, this.dlgQueue.length === 1, cur.portrait);
    }
  }

  private maybeMilestone(id: string, title: string, body: string): void {
    if (this.state.unlockMilestone(id)) this.ui.toast(title, body);
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
      if (this.activity === 'dialogue') this.activity = 'explore';
      const cb = this.afterDialogue;
      this.afterDialogue = null;
      cb?.();
    }
  }

  /** every layer that should swallow world interaction and movement */
  private isModalOpen(): boolean {
    return this.mode !== 'explore' || this.diveOpen;
  }

  /** close every modal layer: mini-game, dialogue queue, journal, travel sheet, help */
  private closeAll(): void {
    if (this.mg) this.cancelMinigame();
    if (this.diveOpen) closeImagePopup(); // the dive counts as seen; playDive finishes the step
    this.dlgQueue = [];
    this.afterDialogue = null;
    this.ui.closeDialogue();
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
    this.setHostPlaces('yayo');
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
    if (m.st === 'wait') return `在${this.placeZh(m.at)}等${m.task && !m.task.includes('等') ? `（${m.task}）` : ''}`;
    return `離隊：${m.task ?? ''}${m.at ? `（${this.placeZh(m.at)}）` : ''}`;
  }

  /** the a akes (女性長輩) of a village: npcs.json elder 'f' (quests.json elders.f) */
  private hostFemaleId(v: string = this.state.origin ?? 'yayo'): string {
    return this.quests.file.elders?.f?.[v] ?? 'weaver_elder';
  }

  /** who an NPC token in quest data means: @host = the host family's elder, @hostf = the host village's a akes, @giver = the quest's 女／男耆老 */
  private npcFor(token: string | undefined, q: QuestDef): string {
    if (token === '@host') return this.hostId();
    if (token === '@hostf') return this.hostFemaleId();
    if (token === '@giver') return this.giverId(q);
    return token ?? '';
  }

  private giverId(q: QuestDef): string {
    const v = this.state.origin ?? 'yayo';
    const g = q.giver ?? 'm';
    return this.quests.file.elders?.[g]?.[v] ?? (g === 'm' ? `elder_${v}` : 'weaver_elder');
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
        this.ui.toast(`換成${ROLE_ZH[next]}`, why || `現在操控${ROLE_ZH[next]}。`);
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
    this.ui.toast('放棄出海', `${q ? `「${q.name.zh}」回到上一步。` : ''}大家在岸邊會合了，之後可以再試。`);
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
      this.ui.toast('先上岸', '划船時不能換人。');
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
      this.ui.toast(`切換到${ROLE_ZH[role]}`, E.members[role].st === 'party' ? '回到隊伍這邊。' : this.memberStatus(role));
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
    return lines.map((l) => ({ ...this.speaker(l.who, npc), zh: l.zh, tao: l.tao ?? '' }));
  }

  private openQueue(lines: DlgLine[], after?: () => void): void {
    this.dlgQueue = lines.slice();
    this.afterDialogue = after ?? null;
    this.showCurrentLine();
  }

  /** run a step's dialogue, then complete it (extra lines: Tao hints / translations said in the same talk) */
  private runStep(q: QuestDef, st: QuestStep, npc: NpcActor | null, extra: DlgLine[] = [], onDone?: () => void, sub = -1): void {
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
    for (const e of ev) if (e.type === 'done') this.ui.toast('任務完成', `${e.q.id}｜${e.q.name.zh}`);
    const fresh = ev.filter((e) => e.type === 'unlock').map((e) => e.q);
    const hidden = fresh.filter((q) => q.hidden);
    for (const q of hidden) this.ui.toast('發現隱藏任務', `${q.id}｜${q.name.zh}`);
    const open = fresh.filter((q) => !q.hidden);
    if (open.length === 1) this.ui.toast('新任務', `${open[0].id}｜${open[0].name.zh}`);
    else if (open.length > 1) {
      const main = open.filter((q) => q.line === 'main');
      const lead = (main[0] ?? open[0]);
      this.ui.toast('新任務', `${lead.id}｜${lead.name.zh} 等 ${open.length} 項（按 L 或點任務條查看）`);
    }
  }

  /** why the controlled member cannot do this step right now (null = go) */
  private stepBlock(q: QuestDef, st: QuestStep): string | null {
    const role = this.party.controlled;
    const E = this.quests;
    // party split: a solo trip blocks everything else; quests whose members are all away wait for them
    if (E.solo && E.members[E.solo].quest !== q.id) return `${ROLE_ZH[E.solo]}正在${E.members[E.solo].task ?? '外面'}，先完成或放棄出海再來。`;
    const roles = st.actor ?? q.roles;
    if (!roles.includes(role)) {
      const away = roles.filter((r) => E.memberBlock(r));
      if (away.length && away.length === roles.length) return `${away.map((r) => `${ROLE_ZH[r]}${this.memberStatus(r)}`).join('；')}，暫時不能做這件事。`;
    }
    for (const r of st.requires ?? []) if (E.members[r].st !== 'party') return `${ROLE_ZH[r]}還沒回隊（${this.memberStatus(r)}）。`;
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
    return `elder_${this.state.origin ?? 'yayo'}`;
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
        this.ui.toast(why.q.name.zh, `${why.msg}（點左上角頭像切換）`);
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
        this.ui.toast('需要換人', `點左上角頭像切換到${need}（鍵盤 1／2／3）。`);
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
        const can = this.quests.canAct(st, q, me) && (st.kind !== 'photo' || me === 't');
        const score = d + (can ? 0 : 1000) + (can && this.stepBlock(q, st) ? 500 : 0);
        if (score < bd) {
          bd = score;
          best = { q, st, sub, d, ready: score < 500 };
        }
      }
    }
    return best;
  }

  private useQuestSpot(q: QuestDef, st: QuestStep, sub = -1): void {
    if (st.kind === 'photo' && this.party.controlled !== 't') {
      this.ui.toast('只有旅人能拍照', '點左上角的旅人頭像（或按 3）再來拍。');
      return;
    }
    const why = this.stepBlock(q, st);
    if (why) {
      this.ui.toast(q.name.zh, why);
      return;
    }
    if (st.kind === 'photo') {
      this.ui.flash();
      this.ui.toast('相簿＋1', `${this.spotName(st)}（${q.id}）`);
      this.completeStep(q);
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
      if (st.canoe) this.setCanoe(true);
      this.startMinigame(st.minigame, (ok) => {
        if (st.canoe && this.player.mode === 'canoe') this.setCanoe(false);
        if (ok) this.runStep(q, st, null, [], undefined, sub);
        else this.ui.toast(q.name.zh, this.quests.solo ? '沒抓到時機。再試一次，或按「放棄出海」回岸邊和大家會合。' : '沒抓到時機，再試一次。');
      });
      return;
    }
    this.runStep(q, st, null, [], undefined, sub);
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
      this.ui.toast('圖鑑＋1', `${d?.name.zh ?? n.item}：${d?.description ?? ''}（遠遠看就好，不要打擾）`);
      this.syncQuestCtx();
      this.handleQuestEvents(this.quests.refresh());
      this.questDirty = true;
      this.saveNow();
      return;
    }
    this.addIngredient(n.item, 1, '採集');
  }

  private addIngredient(id: string, n = 1, how = ''): void {
    this.inv.add(id, n);
    if (this.db.items.get(id)?.category === 'ingredient') this.state.unlock(this.state.ingredients, [id]);
    const cat = this.db.items.get(id)?.category === 'ingredient' ? '食材' : '物品';
    this.ui.toast(`${cat}＋${n}`, `${this.inv.name(id)}${how ? `（${how}）` : ''}｜背包裡有 ${this.inv.count(id)} 份`);
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
      if (status === 'hidden') continue;
      const st = this.quests.step(q);
      const blocks: string[] = [];
      if (status === 'active' && st && q.playable) {
        const w = this.questWindow(q);
        if (!w.ok) blocks.push(`現在不行：${w.why}`);
        const mi = this.quests.missingItem(q);
        if (mi) blocks.push(`需要道具：${mi.zh}（${mi.from} 可以取得）`);
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
        placeholder: !q.playable,
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
  private setHostPlaces(home: string): void {
    const P = this.places;
    const hp = hostPlaces(P, home);
    if (!hp) return;
    Object.assign(P, hp);
    // the host village's a akes (女性長輩, NPC cast rev) waits on the host family's porch for J1–J3 / Q07
    if (this.npcs) {
      const id = this.hostFemaleId(home);
      if (this.npcs.byId(id)) {
        this.npcs.applySchedule(this.state.period, this.state.season);
        this.npcs.place(id, P.host_weave.x, P.host_weave.z);
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
    const photoQs = this.quests.defs.filter((q) => q.group === 'photo' && q.id.startsWith('P'));
    return {
      photos: photoQs.filter((q) => this.quests.done.has(q.id)).map((q) => ({ id: q.id, name: q.name.zh })),
      photoTotal: photoQs.length,
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
    const home = this.places[sv.state?.origin ?? '']?.zh ?? '';
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
  }

  private nearestPrompt(): string | null {
    if (!this.state.started || this.isModalOpen()) return null;
    const near = this.nearestTarget();
    if (!near) return null;
    if ('npc' in near) return fmt(this.content.text.talkPrompt, { name: near.npc.def.name.zh });
    if ('spot' in near) {
      const { q, st } = near.spot;
      if (st.kind === 'photo') return this.party.controlled === 't' ? `拍照：${this.spotName(st)}` : '拍照（只有旅人能拍）';
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

    // one interact edge per frame, routed by mode
    const pressed = this.input.consumeInteract();
    const mode = this.mode;
    if (pressed) {
      if (mode === 'explore') this.tryInteract();
      else if (mode === 'dialogue') this.advanceDialogue();
      else if (mode === 'minigame') this.hitMinigame();
    }

    const blocked = !this.state.started || this.isModalOpen();
    this.player.update(dt, this.input, this.camera, blocked);
    if (this.state.started) this.party.update(dt, this.camera, this.player);
    if (this.streamTick <= 0 || performance.now() - this.streamAt > 400) this.streamNpcs();
    this.npcs.update(dt, this.camera);
    this.updateCharacterTint(dt);
    this.decor.update(dt, this.camera, t, this.state.season === 'rayon' || this.state.season === 'meyvanwa');
    this.ocean.update(t, this.scene.fog as THREE.Fog);
    this.terraces.update(t, this.scene.fog as THREE.Fog);
    this.island.flora.update(t);
    this.sky.update(t);

    if (!this.state.started && !this.coverHold) this.camYaw += dt * 0.035;
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
    const fy = Math.max(0, this.island.heightAt(fx, fz)) + 1.1;
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
    this.post.setTilt(((c.dist < 30 ? 2.4 : c.dist < 60 ? 1.6 : 1.0) - near * 0.9) * (worldStyle() === 'watercolor' ? PAINT.tiltShift : 1), 0.5, (c.dist < 30 ? 0.2 : 0.26) + near * 0.08);

    this.ui.setPrompt(this.nearestPrompt());
    if (this.state.started) this.questFrame(dt);
    if (this.state.started) this.ui.updateMinimap(this.player.x, this.player.z, this.camYaw);

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
      this.ui.toast('還沒有機車', '先到開元港旁的租車行租機車（任務 Q02）。');
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
      selectOrigin: (id: PlayableOrigin, gender?: Gender) => this.begin(id, gender),
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
      setCanoe: (on: boolean, x?: number, z?: number) => this.setCanoe(on, x !== undefined && z !== undefined ? { x, z } : undefined),
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
      openJournal: () => this.setOverlay('journal', true),
      closeJournal: () => this.setOverlay('journal', false),
      interactNearest: () => this.tryInteract(),
      teleport: (x: number, z: number) => {
        this.player.spawn(x, z);
        this.streamTick = 0;
      },
      places: this.places,
      /** sheet row the controlled character shows (0.1.1 facing check) */
      facing: () => ({ dir: this.player.active.dir, yaw: this.player.yaw, mode: this.player.mode, walking: this.player.active.walking }),
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
          if (this.party.controlled !== r) return { ok: false, why: `cannot switch to ${r}` };
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

function drawMinimap(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const { xMin, zMin, xMax, zMax } = TERRAIN_BOX;
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
      } else if (s.height > -1.4) {
        r = 62; gch = 110; b = 122;
      }
      d[i] = r; d[i + 1] = gch; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
