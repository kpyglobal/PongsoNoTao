/**
 * Typed shapes of everything under public/data/*.json plus a small runtime shape check,
 * so a malformed edit fails loudly at load instead of as `undefined` deep in the game loop.
 */
import type { OriginId } from './state';
import type { PlaceRec } from '../world/populate';
import type { NpcDef } from '../entities/npcs';
import type { QuestFile } from '../quests/types';

export type Bilingual = { zh: string; tao: string };

export interface DialogueUnlocks {
  glossary?: string[];
  recipes?: string[];
  ingredients?: string[];
  milestones?: string[];
  clinic?: boolean;
}

export interface DialogueNode {
  speaker?: Bilingual;
  lines: Bilingual[];
  unlocks?: DialogueUnlocks;
}

export interface DialogueFile {
  notes?: string;
  origins: Record<string, Bilingual>;
  [key: string]: DialogueNode | Record<string, Bilingual> | string | undefined;
}

export interface GlossaryEntry { id: string; tao: string; zh: string; detail: string; category?: string }
export interface IngredientEntry { id: string; zh: string; tao: string; nutrition: string; unlockedBy?: string }
export interface RecipeEntry { id: string; zh: string; tao: string; steps: string; nutrition: string; clinicNote?: boolean; unlockedBy?: string }
export interface MilestoneEntry { id: string; zh: string; tao: string; detail: string; hidden?: boolean }

export type PlayableOrigin = Exclude<OriginId, 'random'>;

export interface OriginEntry {
  id: OriginId;
  zh: string;
  tao: string;
  hint: string;
  /** where the player lands (place id + offset); absent only for 'random' */
  spawn?: { place: string; ox?: number; oz?: number };
}

export interface TravelEntry { id: string; zh: string; tao: string; landmark?: boolean }
export interface HelpRow { title: string; body: string }
export interface Toast { title: string; body: string }

export interface MinigameText {
  title: string;
  desc: string;
  unlocks: { ingredients: string[]; glossary: string[] };
  milestone: { id: string; title: string; body: string };
  success: Toast;
  fail: Toast;
}

export interface UiText {
  startTitle: string;
  startBody: string;
  startErrorTitle: string;
  startErrorBody: string;
  visitorWho: string;
  originWho: string;
  allTimesTitle: string;
  allTimesBody: string;
  allSeasonsTitle: string;
  allSeasonsBody: string;
  journalUpdateTitle: string;
  journalGlossary: string;
  journalRecipes: string;
  journalIngredients: string;
  talkPrompt: string;
  placeHint: string;
  clinicWho: string;
  lookWho: string;
  fisherWho: string;
  fallbackLine: string;
  scooterOnTitle: string;
  scooterOnBody: string;
  scooterOffTitle: string;
  scooterOffBody: string;
  travelTitle: string;
  travelBody: string;
}

export interface UiContent {
  origins: OriginEntry[];
  travel: TravelEntry[];
  help: { toastTouch: string[]; toastDesktop: string[]; touch: HelpRow[]; desktop: HelpRow[] };
  minigames: { taro: MinigameText; fish: MinigameText };
  text: UiText;
}

/** name → parsed type of public/data/<name>.json */
export interface DataFiles {
  places: { places: Record<string, PlaceRec> };
  glossary: { entries: GlossaryEntry[] };
  recipes: { ingredients: IngredientEntry[]; recipes: RecipeEntry[] };
  npcs: { npcs: NpcDef[] };
  milestones: { milestones: MilestoneEntry[] };
  dialogues: DialogueFile;
  ui: UiContent;
  quests: QuestFile;
}
export type DataName = keyof DataFiles;
export const DATA_FILES: DataName[] = ['places', 'glossary', 'recipes', 'npcs', 'milestones', 'dialogues', 'ui', 'quests'];

/** `{key}` placeholders → values (copy lives in ui.json, numbers / names are filled in at runtime). */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

// ------------------------------------------------------------------ shape checks
type Check = (v: unknown, at: string) => void;

class DataError extends Error {}
const fail = (at: string, want: string): never => {
  throw new DataError(`data shape: ${at} should be ${want}`);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const str: Check = (v, at) => {
  if (typeof v !== 'string') fail(at, 'a string');
};
const num: Check = (v, at) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(at, 'a number');
};
const opt = (c: Check): Check => (v, at) => {
  if (v !== undefined) c(v, at);
};
const arr = (c: Check): Check => (v, at) => {
  if (!Array.isArray(v)) fail(at, 'an array');
  (v as unknown[]).forEach((x, i) => c(x, `${at}[${i}]`));
};
const rec = (c: Check): Check => (v, at) => {
  if (!isObj(v)) fail(at, 'an object');
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) c(x, `${at}.${k}`);
};
const obj = (shape: Record<string, Check>): Check => (v, at) => {
  if (!isObj(v)) fail(at, 'an object');
  for (const [k, c] of Object.entries(shape)) c((v as Record<string, unknown>)[k], `${at}.${k}`);
};

const bilingual = obj({ zh: str, tao: str });
const toast = obj({ title: str, body: str });
const minigame = obj({
  title: str,
  desc: str,
  unlocks: obj({ ingredients: arr(str), glossary: arr(str) }),
  milestone: obj({ id: str, title: str, body: str }),
  success: toast,
  fail: toast,
});
const dialogueNode = obj({ speaker: opt(bilingual), lines: arr(bilingual) });

const CHECKS: Record<DataName, Check> = {
  quests: obj({
    phrases: rec(obj({ tao: str, zh: str })),
    quests: arr(obj({ id: str, line: str, roles: arr(str), steps: arr(obj({ kind: str, text: str })), hint: obj({ tier: str, zh: str }) })),
  }),
  places: obj({ places: rec(obj({ id: str, zh: str, tao: str, x: num, z: num, kind: str })) }),
  glossary: obj({ entries: arr(obj({ id: str, tao: str, zh: str, detail: str })) }),
  recipes: obj({
    ingredients: arr(obj({ id: str, zh: str, tao: str, nutrition: str })),
    recipes: arr(obj({ id: str, zh: str, tao: str, steps: str, nutrition: str })),
  }),
  npcs: obj({ npcs: arr(obj({ id: str, kind: str, name: bilingual, home: str, interact: str, portrait: opt(str), schedule: arr(obj({ seasons: arr(str), times: arr(str), waypoints: arr(str) })) })) }),
  milestones: obj({ milestones: arr(obj({ id: str, zh: str, tao: str, detail: str })) }),
  dialogues: (v, at) => {
    obj({ origins: rec(bilingual) })(v, at);
    for (const [k, node] of Object.entries(v as Record<string, unknown>)) {
      if (k === 'notes' || k === 'origins') continue;
      dialogueNode(node, `${at}.${k}`);
    }
  },
  ui: obj({
    origins: arr(obj({ id: str, zh: str, tao: str, hint: str, spawn: opt(obj({ place: str, ox: opt(num), oz: opt(num) })) })),
    travel: arr(obj({ id: str, zh: str, tao: str })),
    help: obj({ toastTouch: arr(str), toastDesktop: arr(str), touch: arr(obj({ title: str, body: str })), desktop: arr(obj({ title: str, body: str })) }),
    minigames: obj({ taro: minigame, fish: minigame }),
    text: (v, at) => {
      if (!isObj(v)) fail(at, 'an object');
      for (const k of TEXT_KEYS) str((v as Record<string, unknown>)[k], `${at}.${k}`);
    },
  }),
};

const TEXT_KEYS: (keyof UiText)[] = [
  'startTitle', 'startBody', 'startErrorTitle', 'startErrorBody', 'visitorWho', 'originWho',
  'allTimesTitle', 'allTimesBody', 'allSeasonsTitle', 'allSeasonsBody', 'journalUpdateTitle',
  'journalGlossary', 'journalRecipes', 'journalIngredients', 'talkPrompt', 'placeHint', 'clinicWho',
  'lookWho', 'fisherWho', 'fallbackLine', 'scooterOnTitle', 'scooterOnBody', 'scooterOffTitle',
  'scooterOffBody', 'travelTitle', 'travelBody',
];

/** Throws a readable error (`data shape: ui.origins[3].hint should be a string`) on a malformed file. */
export function checkData<K extends DataName>(name: K, raw: unknown): DataFiles[K] {
  CHECKS[name](raw, name);
  return raw as DataFiles[K];
}
