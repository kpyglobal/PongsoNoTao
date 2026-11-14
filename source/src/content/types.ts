/**
 * Shapes of the files under content/ (docs/phase1/CONTENT_SCHEMA.md). The loader merges every *.json of a
 * type folder, so these describe one entry each. Quests reuse the engine's QuestDef (src/quests/types.ts).
 */
import type { Role } from '../quests/types';

export type TimeWindow = 'day' | 'night' | 'any';
export type SeasonTag = 'summer' | 'winter';
export type PeriodId = 'dawn' | 'day' | 'dusk' | 'night';

/** the time / season / tide window shared by quests, gather nodes and photo spots */
export interface Windowed {
  time?: TimeWindow;
  seasons?: SeasonTag[];
  periods?: PeriodId[];
  tide?: 'low' | 'high';
}

export interface ItemSource {
  kind: 'shop' | 'minigame' | 'gather' | 'observe';
  npc?: string;
  id?: 'fish' | 'taro';
  node?: string;
  seasons?: SeasonTag[];
}

export interface ItemDef {
  id: string;
  name: { zh: string; tao: string };
  category: 'tool' | 'ingredient' | 'material' | 'accessory' | 'observe';
  /** false = 圖鑑 only (observed, never in the bag) */
  collectible: boolean;
  description: string;
  codex: string;
  /** pixel icon key → assets/items/icons/<icon>.(webp|png) */
  icon: string;
  /** watercolor illustration key → assets/items/<illustration>.webp */
  illustration: string;
  nutrition?: string;
  review?: boolean;
  unlockFlag?: string;
  sources?: ItemSource[];
  equip?: { who: Role[]; slot: string; outfit: string };
  outsiderSafe?: boolean;
}

export interface RecipeDef {
  id: string;
  name: { zh: string; tao: string };
  village: string | null;
  keeper: string | null;
  quest: string | null;
  ingredients: Record<string, number>;
  seasons: SeasonTag[];
  unlockedBy: string;
  steps: string;
  nutrition: string;
  clinicNote?: boolean;
  icon: string;
  illustration: string;
}

export interface NpcSchedule { seasons: string[]; times: string[]; waypoints: string[] }

/** one NPC (content/npcs/*.json). New NPCs are data-only: an entry here + (optional) sheet / portrait art. */
export interface NpcDef {
  id: string;
  name: { zh: string; tao: string };
  role?: 'elder_m' | 'elder_f' | 'questVillager' | 'service' | 'outsider' | 'ambient' | 'passerby';
  village?: string | null;
  duties?: string[];
  dutyText?: string;
  recipeKeeper?: string;
  outsider?: boolean;
  /** false = ambient, never offers a talk prompt */
  talkable?: boolean;
  /** dialogue id (content/dialogue) */
  dialogue?: string | null;
  /** special action instead of a dialogue when no quest step runs: 'auto-fish' | 'taro_intro' */
  action?: string;
  kind: string;
  home: string;
  /** walk sheet name; defaults to kind. Missing art → the loader falls back to `fallbackSheet` or a generic sheet */
  sheet?: string;
  fallbackSheet?: string;
  portrait?: string;
  elder?: 'f';
  schedule: NpcSchedule[];
}

export interface DialogueLine { zh: string; tao?: string }
export interface DialogueSet {
  id: string;
  npc?: string;
  /** legacy nodes (elder_home, clinic_nutrition …) */
  speaker?: { zh: string; tao: string };
  lines?: DialogueLine[];
  unlocks?: { glossary?: string[]; recipes?: string[]; ingredients?: string[]; milestones?: string[]; clinic?: boolean };
  /** new sets */
  greet?: DialogueLine[];
  duty?: DialogueLine[];
  idle?: { when?: { time?: TimeWindow; seasons?: SeasonTag[] }; lines: DialogueLine[] }[];
  keeper?: { invite: DialogueLine[]; missing: DialogueLine[]; teach: DialogueLine[]; after: DialogueLine[] };
  after?: Record<string, DialogueLine[]>;
  /** a legacy node (e.g. elder_home, the first 族語 words) told once, on the first talk, before the usual chat */
  intro?: string;
}

export interface PhotoSpotDef extends Windowed {
  id: string;
  quest?: string;
  name: { zh: string };
  landmark?: string;
  place?: string;
  r: number | null;
  status: string;
  distanceOnly?: boolean;
  noFlash?: boolean;
}

export interface GatherNodeDef extends Windowed {
  id: string;
  kind: 'gather' | 'observe';
  item?: string;
  observe?: string;
  place: string;
  r: number;
  ox?: number;
  oz?: number;
  label: string;
  perDay?: number;
  requires?: { item: string; min: number } | { flag: string };
  /** shown instead of the gather prompt while `requires` is unmet (default: a generic line) */
  requiresHint?: string;
  sets?: string;
}

export interface OutfitDef {
  id: string;
  who: Role[];
  kind: 'traditional' | 'accessory';
  name: { zh: string; tao?: string };
  unlockQuest: string;
  /** walk sheet base name (characters/<sheet>_sheet.png, ride_ / canoe_ variants optional) */
  sheet?: string;
  portrait?: string;
  /** traveller accessories: portrait per traveller gender (visitor_m_acc / visitor_acc) */
  portraitByGender?: { m: string; f: string };
  /** traveller accessories: walk sheet per traveller gender (characters/<name>_sheet.png) */
  sheetByGender?: { m: string; f: string };
  item?: string;
  layer?: string;
  icon?: string;
  outsiderSafe?: boolean;
}

export interface PlaceRec { id: string; zh: string; tao: string; x: number; z: number; kind: string; flavor?: string; aka?: string[] }

export interface ContentMeta {
  version: number;
  roles: Record<Role, { zh: string; icon: string }>;
  respect: { id: 'first' | 'learning' | 'trusted' | 'friend'; zh: string }[];
  elders: { m: Record<string, string>; f: Record<string, string> };
  villages: string[];
  seasons: Record<SeasonTag, { zh: string; gameSeasons: string[] }>;
  externalFlags: Record<string, string>;
  /** quest card line for who gives / approves a quest (分工) */
  giverLabels?: { f: string; m: string };
}
