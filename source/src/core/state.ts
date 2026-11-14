import { PERIODS, SEASONS, type Period, type Season } from './timeSeason';

export type LangMode = 'both' | 'zh' | 'tao';
/** Player character: 男生 (m) or 女生 (f). Chosen on the origin screen, saved with the journal. */
export type Gender = 'm' | 'f';
/** 外來訪客 only: 臺灣本島 (tw) or 外國 (intl) traveller. Saved with the journal. */
export type TravelerFrom = 'tw' | 'intl';
export type OriginId = 'yayo' | 'iraraley' | 'iranmeylek' | 'ivalino' | 'imorod' | 'iratay' | 'visitor' | 'random';

/** Plain-JSON snapshot of the journal / settings (groundwork for a versioned save, see audit P3-1). */
export interface GameStateJSON {
  v: 1;
  origin: OriginId | null;
  /** optional so older saves (before the 男生／女生 choice) still load as 'm' */
  gender?: Gender;
  /** optional so older saves load as 'tw' */
  travelerFrom?: TravelerFrom;
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
}

export class GameState {
  origin: OriginId | null = null;
  gender: Gender = 'm';
  travelerFrom: TravelerFrom = 'tw';
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

  /** Add ids to one of the journal sets; returns only the ids that were new. */
  unlock(set: Set<string>, ids: readonly string[] | undefined): string[] {
    const fresh: string[] = [];
    for (const id of ids ?? []) {
      if (!set.has(id)) {
        set.add(id);
        fresh.push(id);
      }
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
      gender: this.gender,
      travelerFrom: this.travelerFrom,
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
    };
  }

  static fromJSON(j: Partial<GameStateJSON>): GameState {
    const s = new GameState();
    if (j.gender === 'm' || j.gender === 'f') s.gender = j.gender;
    // 2026-11: one traveller per gender. Old 外國 (intl) travellers migrate to the same-gender traveller;
    // `gender` is kept as is, so a foreign woman becomes the female traveller.
    s.travelerFrom = 'tw';
    // S4: whitelist, so an old or edited save never feeds an unknown value into the sky / schedule
    if (PERIODS.some((p) => p.id === j.period)) s.period = j.period as Period;
    if (SEASONS.some((x) => x.id === j.season)) s.season = j.season as Season;
    if (j.lang === 'both' || j.lang === 'zh' || j.lang === 'tao') s.lang = j.lang;
    const ORIGINS = ['yayo', 'iraraley', 'iranmeylek', 'ivalino', 'imorod', 'iratay', 'visitor', 'random'];
    if (j.origin === null || ORIGINS.includes(j.origin as string)) s.origin = j.origin ?? null;
    if (Array.isArray(j.seenTimes)) s.seenTimes = new Set(j.seenTimes.filter((p) => PERIODS.some((x) => x.id === p)));
    if (Array.isArray(j.seenSeasons)) s.seenSeasons = new Set(j.seenSeasons.filter((p) => SEASONS.some((x) => x.id === p)));
    if (Array.isArray(j.glossary)) s.glossary = new Set(j.glossary);
    if (Array.isArray(j.recipes)) s.recipes = new Set(j.recipes);
    if (Array.isArray(j.ingredients)) s.ingredients = new Set(j.ingredients);
    if (Array.isArray(j.milestones)) s.milestones = new Set(j.milestones);
    if (typeof j.started === 'boolean') s.started = j.started;
    return s;
  }
}
