/**
 * Content loader: every JSON file under content/ is bundled at build time (Vite import.meta.glob) and merged
 * per type folder, so a new quest / item / NPC / side story is a new file or entry, never a code change.
 * The merged result is checked once (./validate.ts) and handed to the game as one read-only ContentDB.
 */
import type { QuestDef, QuestFile, Role, SongDef } from '../quests/types';
import type { GlossaryEntry, MilestoneEntry, UiContent } from '../core/content';
import type { ContentMeta, DialogueSet, GatherNodeDef, ItemDef, NpcDef, OutfitDef, PhotoSpotDef, PlaceRec, RecipeDef } from './types';
import { validateContent } from './validate';
import { contentEnDict, localizeContent } from './localize';
import { setContentEn, uiLang } from '../ui/i18n';

type Json = Record<string, unknown>;

export interface ContentDB {
  meta: ContentMeta;
  places: Record<string, PlaceRec>;
  /** ids computed by code (src/world/places.ts) and the landmark ids (src/world/layout.ts) */
  derivedPlaces: string[];
  landmarks: string[];
  questFile: QuestFile;
  quests: QuestDef[];
  items: Map<string, ItemDef>;
  recipes: RecipeDef[];
  npcs: NpcDef[];
  dialogues: Map<string, DialogueSet>;
  photoSpots: PhotoSpotDef[];
  gatherNodes: GatherNodeDef[];
  outfits: OutfitDef[];
  glossary: GlossaryEntry[];
  milestones: MilestoneEntry[];
  ui: UiContent;
  songs: Record<string, SongDef>;
}

/** raw files: path (from the repo root, e.g. /content/quests/open.json) → parsed JSON */
export type RawContent = Record<string, unknown>;

/** Vite bundles every content file at build time (Node scripts pass their own RawContent: scripts/dev/content-node.ts) */
const zhBundled = (): RawContent => import.meta.glob('/content/**/*.json', { eager: true, import: 'default' }) as RawContent;
/** 0.1.6: English fields of the content (same file paths and shape; vite.config.ts contentSplit), when loaded */
let enOverlay: RawContent | null = null;
let merged: RawContent | null = null;
function overlay(base: unknown, en: unknown): unknown {
  if (en === undefined || en === null || en === 0) return base;
  if (Array.isArray(base) && Array.isArray(en)) return base.map((x, i) => overlay(x, en[i]));
  if (base && typeof base === 'object' && en && typeof en === 'object' && !Array.isArray(en)) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(en as Record<string, unknown>)) out[k] = k in out ? overlay(out[k], v) : v;
    return out;
  }
  return base === undefined ? en : base;
}
const bundled = (): RawContent => {
  const zh = zhBundled();
  if (!enOverlay) return zh;
  if (!merged) {
    merged = {};
    for (const [p, v] of Object.entries(zh)) merged[p] = overlay(v, enOverlay[p]);
  }
  return merged;
};
/** load the English half of the content before the first content() call (English and 中文＋English only) */
export async function loadContentLang(): Promise<void> {
  if (uiLang() === 'zh' || enOverlay) return;
  try {
    enOverlay = ((await import('virtual:tao-content-en')) as { default: RawContent }).default;
  } catch (e) {
    console.warn('English content did not load; showing Chinese', e);
  }
}

/** entries of every file in a type folder: arrays are concatenated, objects merged by key (key → id) */
function collect<T>(raw: RawContent, dir: string, key: string): (T & { __file: string })[] {
  const out: (T & { __file: string })[] = [];
  const prefix = `/content/${dir}/`;
  for (const path of Object.keys(raw).sort()) {
    if (!path.startsWith(prefix)) continue;
    const v = (raw[path] as Json)?.[key];
    const file = path.slice('/content/'.length);
    if (Array.isArray(v)) for (const x of v) out.push({ ...(x as T), __file: file });
    else if (v && typeof v === 'object') for (const [id, x] of Object.entries(v as Json)) out.push({ id, ...(x as T), __file: file });
  }
  return out;
}
const one = <T>(raw: RawContent, name: string): T => {
  const v = raw[`/content/${name}.json`];
  if (v === undefined) throw new Error(`content/${name}.json is missing`);
  return v as T;
};
const strip = <T extends { __file?: string }>(x: T): Omit<T, '__file'> => {
  const { __file, ...rest } = x;
  void __file;
  return rest;
};

export function buildContent(raw: RawContent = bundled()): ContentDB {
  const meta = one<ContentMeta>(raw, 'meta');
  const placesFile = one<{ places: Record<string, PlaceRec>; derived?: { ids: string[] }; landmarks?: string[]; proposed?: { places: Record<string, { zh: string; x?: number; z?: number; kind?: string }> } }>(raw, 'places');
  const places: Record<string, PlaceRec> = { ...placesFile.places };
  // proposed places (Phase A) with real coords join the place table; ones without coords stay code-derived
  for (const [id, p] of Object.entries(placesFile.proposed?.places ?? {})) {
    if (typeof p.x === 'number' && typeof p.z === 'number' && !places[id]) places[id] = { id, zh: p.zh, tao: '', x: p.x, z: p.z, kind: p.kind ?? 'facility' };
  }
  const questsRaw = collect<QuestDef>(raw, 'quests', 'quests');
  const quests = questsRaw.map((q) => ({ ...strip(q), group: q.arc ?? q.group }) as QuestDef);
  const items = collect<ItemDef>(raw, 'items', 'items');
  const recipes = collect<RecipeDef>(raw, 'recipes', 'recipes');
  const npcs = collect<NpcDef>(raw, 'npcs', 'npcs');
  const dialogues = collect<DialogueSet>(raw, 'dialogue', 'dialogues');
  const photoSpots = collect<PhotoSpotDef>(raw, 'photoSpots', 'photoSpots');
  const gatherNodes = collect<GatherNodeDef>(raw, 'gatherNodes', 'gatherNodes');
  const outfits = collect<OutfitDef>(raw, 'outfits', 'outfits');
  const songs = (one<{ songs: Record<string, SongDef> }>(raw, 'songs').songs ?? {});
  const phrases = one<{ phrases: QuestFile['phrases'] }>(raw, 'phrases').phrases ?? {};

  validateContent({
    meta, places, derived: placesFile.derived?.ids ?? [], landmarks: placesFile.landmarks ?? [],
    quests: questsRaw, items, recipes, npcs, dialogues, photoSpots, gatherNodes, outfits, songs,
  });

  const itemMap = new Map(items.map((i) => [i.id, strip(i) as ItemDef]));
  const questFile: QuestFile = {
    roles: meta.roles as Record<Role, { zh: string; icon: string }>,
    respect: meta.respect,
    items: Object.fromEntries([...itemMap.values()].map((i) => [i.id, { zh: i.name.zh }])),
    phrases,
    songs,
    elders: meta.elders,
    quests,
  };
  return {
    meta,
    places,
    derivedPlaces: placesFile.derived?.ids ?? [],
    landmarks: placesFile.landmarks ?? [],
    questFile,
    quests,
    items: itemMap,
    recipes: recipes.map((r) => strip(r) as RecipeDef),
    npcs: npcs.map((n) => strip(n) as NpcDef),
    dialogues: new Map(dialogues.map((d) => [d.id, strip(d) as DialogueSet])),
    photoSpots: photoSpots.map((p) => strip(p) as PhotoSpotDef),
    gatherNodes: gatherNodes.map((g) => strip(g) as GatherNodeDef),
    outfits: outfits.map((o) => strip(o) as OutfitDef),
    glossary: one<{ entries: GlossaryEntry[] }>(raw, 'glossary').entries,
    milestones: one<{ milestones: MilestoneEntry[] }>(raw, 'milestones').milestones,
    ui: one<UiContent>(raw, 'ui'),
    songs,
  };
}

let cached: ContentDB | null = null;
/** the bundled content, built + validated once (in the interface language: ./localize.ts) */
export function content(): ContentDB {
  if (!cached && uiLang() === 'zhen') setContentEn(contentEnDict(bundled()));
  return (cached ??= buildContent(localizeContent(bundled(), uiLang())));
}
