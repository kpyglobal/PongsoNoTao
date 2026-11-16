import { PERIODS, SEASONS, type Period, type Season } from './timeSeason';

export type LangMode = 'both' | 'zh' | 'tao';
export const LANG_KEY = 'tao-rpg.lang';
export function isLangMode(v: unknown): v is LangMode {
  return v === 'both' || v === 'zh' || v === 'tao';
}
/** last chosen dialogue language, remembered even before a journey starts */
export function readStoredLang(): LangMode | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return isLangMode(v) ? v : null;
  } catch {
    return null;
  }
}
export function writeStoredLang(m: LangMode): void {
  try {
    localStorage.setItem(LANG_KEY, m);
  } catch {
    /* private mode: not remembered */
  }
}
/** Player character: 男生 (m) or 女生 (f). Chosen on the origin screen, saved with the journal. */
export type Gender = 'm' | 'f';
/** 0.1.4: how the party reached the island (arrival screen). Older saves have none and skip the intro. */
export type ArrivalWay = 'plane' | 'boat';
export type OriginId = 'yayo' | 'iraraley' | 'iranmeylek' | 'ivalino' | 'imorod' | 'iratay' | 'visitor' | 'random';

/** Plain-JSON snapshot of the journal / settings (groundwork for a versioned save, see audit P3-1). */
export interface GameStateJSON {
  v: 1;
  /** the party's 主人家 (where everyone stays) = the 族男's village */
  origin: OriginId | null;
  /** 0.1.5: each Tao member's own village (missing in older saves: both = origin) */
  originM?: OriginId | null;
  originF?: OriginId | null;
  /** optional so older saves (before the 男生／女生 choice) still load as 'm' */
  gender?: Gender;
  /** legacy (before 2026-11: 'tw' | 'intl' traveller); ignored on load, no longer written */
  travelerFrom?: string;
  period: Period;
  season: Season;
  lang: LangMode;
  seenTimes: Period[];
  seenSeasons: Season[];
  glossary: string[];
  recipes: string[];
  ingredients: string[];
  milestones: string[];
  started: boolean;
  /** 0.1.4: 搭飛機 / 搭船 (missing in older saves) */
  arrival?: ArrivalWay;
  /** 0.1.5 cards: unlock cards already shown (w:/i:/r:/o: keys). Missing = an older save: everything known then counts as shown */
  cards?: string[];
  /** 0.1.5: printed photos in the traveller's album (photo spot ids); missing = empty */
  album?: string[];
  /** 0.1.5: recipe ingredients whose names the 族語老師 has taught (item ids) */
  taught?: string[];
}

let freshHook: ((kind: 'glossary' | 'recipes' | 'ingredients', ids: string[]) => void) | null = null;

export class GameState {
  /** 主人家 (= originM; kept as its own field so older code and saves keep working) */
  origin: OriginId | null = null;
  /** 0.1.5: 族男's / 族女's own village (may differ) */
  originM: OriginId | null = null;
  originF: OriginId | null = null;
  gender: Gender = 'm';
  period: Period = 'day';
  season: Season = 'rayon';
  lang: LangMode = 'both';
  seenTimes = new Set<Period>(['day']);
  seenSeasons = new Set<Season>(['rayon']);
  glossary = new Set<string>();
  recipes = new Set<string>();
  ingredients = new Set<string>();
  milestones = new Set<string>();
  started = false;
  /** 0.1.4: 搭飛機 / 搭船; null for saves made before the arrival screen */
  arrival: ArrivalWay | null = null;
  /** 0.1.5 cards (see systems/discoveries.ts) */
  cards = new Set<string>();
  /** false only for a save written before the cards existed: Game marks what it already knows as shown */
  cardsSeeded = true;
  album = new Set<string>();
  taught = new Set<string>();

  /** 0.1.5 cards: told about every fresh journal unlock (module level, so Object.assign of a loaded state keeps it) */
  static setFreshHook(fn: ((kind: 'glossary' | 'recipes' | 'ingredients', ids: string[]) => void) | null): void {
    freshHook = fn;
  }

  /** Add ids to one of the journal sets; returns only the ids that were new. */
  unlock(set: Set<string>, ids: readonly string[] | undefined): string[] {
    const fresh: string[] = [];
    for (const id of ids ?? []) {
      if (!set.has(id)) {
        set.add(id);
        fresh.push(id);
      }
    }
    if (fresh.length && freshHook) {
      const kind = set === this.glossary ? 'glossary' : set === this.recipes ? 'recipes' : set === this.ingredients ? 'ingredients' : null;
      if (kind) freshHook(kind, fresh);
    }
    return fresh;
  }

  unlockMilestone(id: string): boolean {
    return this.unlock(this.milestones, [id]).length > 0;
  }

  toJSON(): GameStateJSON {
    return {
      v: 1,
      origin: this.origin,
      originM: this.originM,
      originF: this.originF,
      gender: this.gender,
      period: this.period,
      season: this.season,
      lang: this.lang,
      seenTimes: [...this.seenTimes],
      seenSeasons: [...this.seenSeasons],
      glossary: [...this.glossary],
      recipes: [...this.recipes],
      ingredients: [...this.ingredients],
      milestones: [...this.milestones],
      started: this.started,
      ...(this.arrival ? { arrival: this.arrival } : {}),
      cards: [...this.cards],
      album: [...this.album],
      taught: [...this.taught],
    };
  }

  static fromJSON(j: Partial<GameStateJSON>): GameState {
    const s = new GameState();
    if (j.gender === 'm' || j.gender === 'f') s.gender = j.gender;
    // 2026-11: one traveller per gender. Old 外國 (intl) saves load as the same-gender traveller
    // (`travelerFrom` is ignored; `gender` is kept, so a foreign woman becomes the female traveller).
    // S4: whitelist, so an old or edited save never feeds an unknown value into the sky / schedule
    if (PERIODS.some((p) => p.id === j.period)) s.period = j.period as Period;
    if (SEASONS.some((x) => x.id === j.season)) s.season = j.season as Season;
    if (j.lang === 'both' || j.lang === 'zh' || j.lang === 'tao') s.lang = j.lang;
    const ORIGINS = ['yayo', 'iraraley', 'iranmeylek', 'ivalino', 'imorod', 'iratay', 'visitor', 'random'];
    if (j.origin === null || ORIGINS.includes(j.origin as string)) s.origin = j.origin ?? null;
    // 0.1.5: a save from before the split hometowns gives both Tao members the old shared village
    s.originM = ORIGINS.includes(j.originM as string) ? (j.originM as OriginId) : s.origin;
    s.originF = ORIGINS.includes(j.originF as string) ? (j.originF as OriginId) : s.origin;
    if (Array.isArray(j.seenTimes)) s.seenTimes = new Set(j.seenTimes.filter((p) => PERIODS.some((x) => x.id === p)));
    if (Array.isArray(j.seenSeasons)) s.seenSeasons = new Set(j.seenSeasons.filter((p) => SEASONS.some((x) => x.id === p)));
    if (Array.isArray(j.glossary)) s.glossary = new Set(j.glossary);
    if (Array.isArray(j.recipes)) s.recipes = new Set(j.recipes);
    if (Array.isArray(j.ingredients)) s.ingredients = new Set(j.ingredients);
    if (Array.isArray(j.milestones)) s.milestones = new Set(j.milestones);
    if (typeof j.started === 'boolean') s.started = j.started;
    if (j.arrival === 'plane' || j.arrival === 'boat') s.arrival = j.arrival;
    const strs = (a: unknown): string[] => (Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : []);
    if (Array.isArray(j.cards)) s.cards = new Set(strs(j.cards));
    else s.cardsSeeded = false;
    s.album = new Set(strs(j.album));
    s.taught = new Set(strs(j.taught));
    return s;
  }
}
