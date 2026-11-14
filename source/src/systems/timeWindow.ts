/**
 * Time / season / tide windows shared by quests, gather nodes and photo spots.
 * Seasons follow the art style's season kinds (src/render/styleConfig.ts SEASON_KIND):
 * winter look = 東北季風 (content tag `winter`), everything else = 飛魚季 side of the year (`summer`).
 */
import { SEASON_KIND } from '../render/styleConfig';
import type { Period, Season } from '../core/timeSeason';
import type { SeasonTag, Windowed } from '../content/types';

export interface Clock {
  season: Season;
  period: Period;
}

export const FISHING_SEASONS: Season[] = ['meyvanwa', 'rayon', 'manoyotoyon'];

/** content season tag of a game season */
export function seasonTag(s: Season): SeasonTag {
  return SEASON_KIND[s] === 'winter' ? 'winter' : 'summer';
}

/** Placeholder tide (the real tide clock comes later): low tide at dawn and dusk. */
export function tideAt(period: Period): 'low' | 'high' {
  return period === 'dawn' || period === 'dusk' ? 'low' : 'high';
}

export function periodZh(p: string): string {
  return p === 'dawn' ? '清晨' : p === 'day' ? '白天' : p === 'dusk' ? '黃昏' : p === 'night' ? '夜晚' : p;
}

/** is the window open now? `why` = zh-TW reason when not */
export function windowOk(w: Windowed | undefined, c: Clock): { ok: boolean; why: string } {
  if (!w) return { ok: true, why: '' };
  if (w.seasons?.length && !w.seasons.includes(seasonTag(c.season))) {
    return { ok: false, why: w.seasons.includes('summer') ? '要等飛魚季（夏天）' : '要等東北季風的冬天' };
  }
  if (w.periods?.length) {
    if (!w.periods.includes(c.period)) return { ok: false, why: `時段要在${w.periods.map(periodZh).join('、')}` };
  } else if (w.time === 'day' && c.period === 'night') return { ok: false, why: '要等白天' };
  else if (w.time === 'night' && c.period !== 'night') return { ok: false, why: '要等晚上' };
  if (w.tide && tideAt(c.period) !== w.tide) return { ok: false, why: w.tide === 'low' ? '要等退潮（清晨或黃昏）' : '要等漲潮' };
  return { ok: true, why: '' };
}

/** a clock that satisfies the window (debug `fitWhen`), or null when none does */
export function fitClock(w: Windowed, cur: Clock): Clock | null {
  const seasons: Season[] = ['rayon', 'off', 'meyvanwa', 'manoyotoyon'];
  const periods: Period[] = ['day', 'dawn', 'dusk', 'night'];
  const ss = [cur.season, ...seasons.filter((s) => s !== cur.season)];
  const ps = [cur.period, ...periods.filter((p) => p !== cur.period)];
  for (const season of ss) for (const period of ps) if (windowOk(w, { season, period }).ok) return { season, period };
  return null;
}
