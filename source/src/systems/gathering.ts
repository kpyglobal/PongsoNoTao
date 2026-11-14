/**
 * Gathering / observation nodes (content/gatherNodes). A gather node is live while its item is still needed by
 * an active recipe (or `always` is set), its time / season / tide window is open, its `requires` is met and its
 * daily count is not used up; an observe node is live until its animal / plant is in the 圖鑑.
 * Daily counts are quest counters `gather:<node>`, cleared when a new day starts (night → dawn / day).
 */
import type { GatherNodeDef, Windowed } from '../content/types';
import type { Period } from '../core/timeSeason';

export interface GatherCtx {
  places: Record<string, { x: number; z: number; zh: string }>;
  windowOk: (w: Windowed) => { ok: boolean; why: string };
  counters: Record<string, number>;
  flags: Set<string>;
  count: (item: string) => number;
  known: (item: string) => boolean;
  /** items still needed by active recipe quests (item → missing) */
  needed: () => Record<string, number>;
}

export interface LiveNode {
  id: string;
  /** item gathered or observed */
  item: string;
  kind: 'gather' | 'observe';
  x: number;
  z: number;
  r: number;
  label: string;
  node: GatherNodeDef;
  /** `requires` unmet: the node shows this hint instead of gathering */
  blocked?: string;
}

export class Gathering {
  constructor(readonly nodes: GatherNodeDef[]) {}

  live(c: GatherCtx): LiveNode[] {
    const need = c.needed();
    const out: LiveNode[] = [];
    for (const n of this.nodes) {
      const item = n.item ?? n.observe;
      if (!item) continue;
      const p = c.places[n.place];
      if (!p) continue;
      if (n.kind === 'gather') {
        if (!need[item] && !(n as GatherNodeDef & { always?: boolean }).always) continue;
        if (n.perDay && (c.counters[`gather:${n.id}`] ?? 0) >= n.perDay) continue;
      } else if (c.known(item)) continue;
      if (!c.windowOk(n).ok) continue;
      const unmet = n.requires && !('flag' in n.requires ? c.flags.has(n.requires.flag) : c.count(n.requires.item) >= n.requires.min);
      out.push({ id: n.id, item, kind: n.kind, x: p.x + (n.ox ?? 0), z: p.z + (n.oz ?? 0), r: n.r, label: n.label, node: n, ...(unmet ? { blocked: n.requiresHint ?? '還不能在這裡採集。' } : {}) });
    }
    return out;
  }

  /** count one use of the node (perDay) */
  use(c: Pick<GatherCtx, 'counters'>, id: string): void {
    c.counters[`gather:${id}`] = (c.counters[`gather:${id}`] ?? 0) + 1;
  }

  /** a new day starts when the night ends */
  static newDay(prev: Period, next: Period): boolean {
    return prev === 'night' && next !== 'night';
  }

  resetDay(counters: Record<string, number>): void {
    for (const k of Object.keys(counters)) if (k.startsWith('gather:')) delete counters[k];
  }
}
