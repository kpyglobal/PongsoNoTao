/**
 * Quest engine: data-driven prerequisites (AND / OR / 任 N 個 / flags / respect / meters / counters),
 * finish conditions (season / time / tide), item gates, hidden quests and party-member requirements.
 * Pure logic, no DOM / three.js; Game feeds it the world context and runs the dialogue.
 */
import type { Period, Season } from '../core/timeSeason';
import type { QuestDef, QuestFile, QuestStep, Req, RespectId, Role, StepGives, When } from './types';

export type QuestStatus = 'done' | 'active' | 'locked' | 'hidden';

export interface QuestCtx {
  season: Season;
  period: Period;
  /** learned glossary words */
  words: number;
}

export interface QuestEvent {
  type: 'unlock' | 'done';
  q: QuestDef;
}

export interface QuestSaveJSON {
  done: string[];
  active: Record<string, number>;
  flags: string[];
  items: Record<string, number>;
  respect: number;
  stats: Record<string, number>;
  counters: Record<string, number>;
  heard: string[];
  translated: string[];
  tracked: string | null;
  /** batch 1b (optional so batch 1 saves still load) */
  collect?: string[];
}

const RESPECT: RespectId[] = ['first', 'learning', 'trusted', 'friend'];
export const FISHING_SEASONS: Season[] = ['meyvanwa', 'rayon', 'manoyotoyon'];

/** Placeholder tide (Phase 3 brings the real tide clock): low tide at dawn and dusk. */
export function tideAt(period: Period): 'low' | 'high' {
  return period === 'dawn' || period === 'dusk' ? 'low' : 'high';
}

export class QuestEngine {
  readonly file: QuestFile;
  readonly defs: QuestDef[];
  readonly byId = new Map<string, QuestDef>();
  done = new Set<string>();
  /** unlocked, not finished: quest id → current step index */
  active = new Map<string, number>();
  flags = new Set<string>();
  items: Record<string, number> = {};
  /** traveller respect level index (-1 = not started) */
  respect = -1;
  stats: Record<string, number> = { relation: 0 };
  counters: Record<string, number> = {};
  /** quests whose Tao-only hint was heard / translated */
  heard = new Set<string>();
  translated = new Set<string>();
  tracked: string | null = null;
  /** batch 1b collections: underwater pictures (uw:A, uw:B), traveller POV set (pov:1–3), songs (song:s01) */
  collect = new Set<string>();
  private ctx: QuestCtx = { season: 'rayon', period: 'day', words: 0 };
  /** M5: called for every finished step's rewards (also auto steps finished inside refresh), so Game can apply glossary / toast */
  onGives?: (g: StepGives, q: QuestDef) => void;

  constructor(file: QuestFile) {
    this.file = file;
    this.defs = file.quests;
    for (const q of file.quests) this.byId.set(q.id, q);
  }

  setCtx(ctx: QuestCtx): void {
    this.ctx = ctx;
  }

  get(id: string): QuestDef | undefined {
    return this.byId.get(id);
  }

  status(q: QuestDef): QuestStatus {
    if (this.done.has(q.id)) return 'done';
    if (this.active.has(q.id)) return 'active';
    return q.hidden ? 'hidden' : 'locked';
  }

  respectId(): RespectId | null {
    return this.respect >= 0 ? RESPECT[this.respect] : null;
  }

  counter(key: string): number {
    if (key === 'words') return this.ctx.words;
    if (key === 'photos') return this.defs.filter((q) => q.group === 'photo' && q.id.startsWith('P') && this.done.has(q.id)).length;
    return this.counters[key] ?? 0;
  }

  evalReq(r: Req): boolean {
    if (typeof r === 'string') return this.done.has(r);
    if ('all' in r) return r.all.every((x) => this.evalReq(x));
    if ('any' in r) return r.any.filter((x) => this.evalReq(x)).length >= (r.n ?? 1);
    if ('flag' in r) return this.flags.has(r.flag);
    if ('respect' in r) {
      const k = RESPECT.indexOf(r.respect);
      return k >= 0 && this.respect >= k; // S5: an unknown id never passes
    }
    if ('stat' in r) return (this.stats[r.stat] ?? 0) >= r.min;
    if ('count' in r) return this.counter(r.count) >= r.min;
    return false; // pending: waits for the community
  }

  /** progress on an 任 N 個 prerequisite, for the log (e.g. Q05 2/4) */
  reqProgress(q: QuestDef): { have: number; need: number } | null {
    const st = this.step(q);
    const r = st?.until ?? q.req;
    if (typeof r === 'object' && 'count' in r) return { have: Math.min(this.counter(r.count), r.min), need: r.min };
    if (typeof r === 'object' && 'any' in r && (r.n ?? 1) > 1) return { have: r.any.filter((x) => this.evalReq(x)).length, need: r.n ?? 1 };
    return null;
  }

  /** can the quest be finished right now (season / time / tide)? reason in zh-TW when not */
  whenOk(w: When | undefined): { ok: boolean; why: string } {
    if (!w) return { ok: true, why: '' };
    const fishing = FISHING_SEASONS.includes(this.ctx.season);
    if (w.season === 'fishing' && !fishing) return { ok: false, why: '要等飛魚季' };
    if (w.season === 'nonFishing' && fishing) return { ok: false, why: '飛魚季不行，要等非飛魚季' };
    if (w.period && !w.period.includes(this.ctx.period)) return { ok: false, why: `時段要在${w.period.map(periodZh).join('、')}` };
    if (w.tide && tideAt(this.ctx.period) !== w.tide) return { ok: false, why: w.tide === 'low' ? '要等退潮（清晨或黃昏）' : '要等漲潮' };
    return { ok: true, why: '' };
  }

  step(q: QuestDef): QuestStep | null {
    const i = this.active.get(q.id);
    return i === undefined ? null : q.steps[i] ?? null;
  }

  /** item gate on the last step: returns the missing item (zh) and the quest that gives it */
  missingItem(q: QuestDef): { zh: string; from: string } | null {
    const g = q.needsItem;
    if (!g || (this.items[g.item] ?? 0) > 0) return null;
    return { zh: this.file.items[g.item]?.zh ?? g.item, from: g.from };
  }

  canAct(step: QuestStep, q: QuestDef, role: Role): boolean {
    return (step.actor ?? q.roles).includes(role);
  }

  /** unlock everything whose prerequisites are now met, run auto steps; returns what changed */
  refresh(): QuestEvent[] {
    const ev: QuestEvent[] = [];
    for (let guard = 0; guard < 8; guard++) {
      let changed = false;
      for (const q of this.defs) {
        if (this.done.has(q.id) || this.active.has(q.id)) continue;
        if (this.evalReq(q.req)) {
          this.active.set(q.id, 0);
          ev.push({ type: 'unlock', q });
          changed = true;
        }
      }
      for (const [id] of this.active) {
        const q = this.byId.get(id)!;
        const st = this.step(q);
        if (st?.kind === 'auto' && !st.lines?.length && this.whenOk(q.when).ok && (!st.until || this.evalReq(st.until))) {
          ev.push(...this.advance(q));
          changed = true;
        }
      }
      if (!changed) break;
    }
    if (this.tracked && !this.active.has(this.tracked)) this.tracked = null;
    return ev;
  }

  /** finish the current step of q (rewards are applied by the caller via gives) */
  advance(q: QuestDef): QuestEvent[] {
    const i = this.active.get(q.id);
    if (i === undefined) return [];
    const st = q.steps[i];
    const g = st?.gives;
    if (g) {
      g.flags?.forEach((f) => this.flags.add(f));
      g.items?.forEach((it) => (this.items[it] = (this.items[it] ?? 0) + 1));
      if (g.respect) this.respect = Math.max(this.respect, RESPECT.indexOf(g.respect));
      this.onGives?.(g, q);
      if (g.relation) this.stats.relation = (this.stats.relation ?? 0) + g.relation;
      if (g.counter) for (const [k, v] of Object.entries(g.counter)) this.counters[k] = (this.counters[k] ?? 0) + v;
    }
    if (i + 1 < q.steps.length) {
      this.active.set(q.id, i + 1);
      return [];
    }
    this.active.delete(q.id);
    this.done.add(q.id);
    return [{ type: 'done', q }, ...this.refresh()];
  }

  /** debug: force a quest done (prerequisites are not checked) */
  forceDone(id: string): QuestEvent[] {
    const q = this.byId.get(id);
    if (!q || this.done.has(id)) return [];
    if (!this.active.has(id)) this.active.set(id, 0);
    let ev: QuestEvent[] = [];
    while (this.active.has(id)) ev = ev.concat(this.advance(q));
    return ev;
  }

  /** the quest the HUD tracker shows: the tracked one, else the first active playable main quest */
  current(): QuestDef | null {
    if (this.tracked && this.active.has(this.tracked)) return this.byId.get(this.tracked)!;
    const act = this.defs.filter((q) => this.active.has(q.id) && q.playable);
    return act.find((q) => q.line === 'main') ?? act[0] ?? null;
  }

  toJSON(): QuestSaveJSON {
    return {
      done: [...this.done],
      active: Object.fromEntries(this.active),
      flags: [...this.flags],
      items: { ...this.items },
      respect: this.respect,
      stats: { ...this.stats },
      counters: { ...this.counters },
      heard: [...this.heard],
      translated: [...this.translated],
      tracked: this.tracked,
      collect: [...this.collect],
    };
  }

  /** M3: restore a save, dropping or clamping anything that no longer fits the quest data */
  load(j: Partial<QuestSaveJSON>): void {
    const strs = (a: unknown): string[] => (Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : []);
    const nums = (o: unknown): Record<string, number> => {
      const out: Record<string, number> = {};
      if (o && typeof o === 'object' && !Array.isArray(o)) for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
      return out;
    };
    this.done = new Set(strs(j.done).filter((id) => this.byId.has(id)));
    this.active = new Map();
    const act = j.active && typeof j.active === 'object' ? j.active : {};
    for (const [id, i] of Object.entries(act)) {
      const q = this.byId.get(id);
      if (!q || this.done.has(id) || !Number.isInteger(i) || i < 0) continue; // dropped → refresh() re-unlocks at step 0
      this.active.set(id, Math.min(i, Math.max(0, q.steps.length - 1))); // steps removed since the save → clamp
    }
    this.flags = new Set(strs(j.flags));
    this.items = nums(j.items);
    const r = typeof j.respect === 'number' && Number.isFinite(j.respect) ? Math.round(j.respect) : -1;
    this.respect = Math.min(Math.max(r, -1), RESPECT.length - 1);
    this.stats = { relation: 0, ...nums(j.stats) };
    this.counters = nums(j.counters);
    this.heard = new Set(strs(j.heard));
    this.translated = new Set(strs(j.translated));
    this.tracked = typeof j.tracked === 'string' && this.active.has(j.tracked) ? j.tracked : null;
    // 2026-11: one underwater picture per spot (uw:A:<outfit> → uw:A) and a 3-photo POV set
    this.collect = new Set(
      strs(j.collect)
        .map((k) => (/^uw:[AB]:/.test(k) ? k.slice(0, 4) : k))
        .filter((k) => !/^pov:[4-9]$/.test(k)),
    );
  }

  reset(): void {
    this.load({});
  }
}

export function periodZh(p: string): string {
  return p === 'dawn' ? '清晨' : p === 'day' ? '白天' : p === 'dusk' ? '黃昏' : p === 'night' ? '夜晚' : p;
}
