/**
 * Quest engine: data-driven prerequisites (AND / OR / 任 N 個 / flags / respect / meters / counters),
 * finish conditions (season / time / tide), item gates, hidden quests and party-member requirements.
 * Pure logic, no DOM / three.js; Game feeds it the world context and runs the dialogue.
 */
import type { Period, Season } from '../core/timeSeason';
import type { Windowed } from '../content/types';
import { PartySplit, type MemberState, type PartySplitJSON } from '../systems/partySplit';
import { windowOk } from '../systems/timeWindow';
import type { MemberTask, QuestDef, QuestFile, QuestStep, Req, RespectId, Role, SplitTask, StepGives } from './types';

export { ROLES_ALL, type MemberState } from '../systems/partySplit';
export { FISHING_SEASONS, tideAt, periodZh } from '../systems/timeWindow';

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
  /** unlocked outfits (content/outfits) and what each member wears (optional so older saves still load) */
  outfits?: string[];
  wear?: Partial<Record<Role, string>>;
  /** party split (optional so older saves still load): member states, solo member, regroup point, finished member tasks */
  members?: PartySplitJSON['members'];
  solo?: Role | null;
  meet?: string | null;
  tasksDone?: string[];
}

const RESPECT: RespectId[] = ['first', 'learning', 'trusted', 'friend'];

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
  /** unlocked outfit ids and what each member wears (src/systems/outfits.ts) */
  outfits = new Set<string>();
  wear: Partial<Record<Role, string>> = {};
  /** party split state (src/systems/partySplit.ts); the getters below keep the older call sites working */
  readonly party = new PartySplit();
  get members(): Record<Role, MemberState> { return this.party.members; }
  get solo(): Role | null { return this.party.solo; }
  get meet(): string | null { return this.party.meet; }
  get tasksDone(): Set<string> { return this.party.tasksDone; }
  /** fired when member states change (Game moves the followers / HUD) */
  onParty?: () => void;
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
    if ('item' in r) return (this.items[r.item] ?? 0) >= r.min;
    return false; // pending: waits for the community
  }

  /** progress on an 任 N 個 prerequisite, for the log (e.g. Q05 2/4) */
  reqProgress(q: QuestDef): { have: number; need: number } | null {
    const st = this.step(q);
    const r = st?.until ?? q.req;
    if (typeof r === 'object' && 'count' in r) return { have: Math.min(this.counter(r.count), r.min), need: r.min };
    if (typeof r === 'object' && 'any' in r && (r.n ?? 1) > 1) return { have: r.any.filter((x) => this.evalReq(x)).length, need: r.n ?? 1 };
    if (typeof r === 'object' && 'all' in r && r.all.every((x) => typeof x === 'object' && 'item' in x)) {
      const items = r.all as { item: string; min: number }[];
      return { have: items.reduce((n, x) => n + Math.min(this.items[x.item] ?? 0, x.min), 0), need: items.reduce((n, x) => n + x.min, 0) };
    }
    if (st?.kind === 'tasks' && st.tasks) return { have: st.tasks.filter((_, k) => this.taskDone(q, k)).length, need: st.tasks.length };
    return null;
  }

  /** can the quest / node / spot be done right now (time / season / tide)? reason in zh-TW when not */
  windowOk(w: Windowed | undefined): { ok: boolean; why: string } {
    return windowOk(w, this.ctx);
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

  // ------------------------------------------------------------------ party split

  private taskKey(q: QuestDef, k: number): string {
    return `${q.id}:${this.active.get(q.id)}:${k}`;
  }

  taskDone(q: QuestDef, k: number): boolean {
    return this.tasksDone.has(this.taskKey(q, k));
  }

  /** the step(s) that can be done now: the current step, or the unfinished member parts of a `tasks` step (sub = part index) */
  openSteps(q: QuestDef): { st: QuestStep; sub: number }[] {
    const st = this.step(q);
    if (!st) return [];
    if (st.kind !== 'tasks' || !st.tasks) return [{ st, sub: -1 }];
    return st.tasks.map((t, k) => ({ t, k })).filter(({ k }) => !this.taskDone(q, k)).map(({ t, k }) => ({ st: taskStep(t), sub: k }));
  }

  /** zh-TW reason a member cannot be switched to / act right now (null = fine) */
  memberBlock(r: Role): string | null {
    return this.party.block(r);
  }

  /** members that are not with the party (away or waiting somewhere) */
  awayRoles(): Role[] {
    return this.party.awayRoles();
  }

  isSplit(): boolean {
    return this.party.isSplit();
  }

  /** a member part of a `tasks` step is done: rewards, the member waits at the regroup point; all parts → the step finishes */
  completeTask(q: QuestDef, k: number): QuestEvent[] {
    const st = this.step(q);
    const t = st?.tasks?.[k];
    if (!st || !t || this.taskDone(q, k)) return [];
    this.tasksDone.add(this.taskKey(q, k));
    if (t.gives) this.applyGives(t.gives, q);
    this.party.partDone(t.role);
    this.onParty?.();
    if (st.tasks!.every((_, j) => this.taskDone(q, j))) return this.advance(q);
    return [];
  }

  private applyParty(st: QuestStep, q: QuestDef, idx: number): void {
    if (st.split) this.party.split(st.split as Partial<Record<Role, SplitTask>>, q.id, st.meet);
    if (st.solo) this.party.startSolo(st.solo, q.id, idx);
    if (st.regroup) this.party.regroup();
    if (st.split || st.solo || st.regroup) this.onParty?.();
  }

  regroupAll(): void {
    this.party.regroup();
  }

  /** lines for 放棄出海 (from the solo step), shown by Game */
  soloGiveUpLines(): QuestStep['lines'] {
    return this.party.soloGiveUp ?? undefined;
  }

  /** 放棄出海: the solo member gives up; the quest goes back to its abortTo step and everyone regroups */
  abortSolo(): QuestDef | null {
    if (!this.solo) return null;
    const qid = this.members[this.solo].quest ?? this.party.soloFrom?.quest;
    const q = qid ? this.byId.get(qid) : undefined;
    if (q && this.active.has(q.id)) this.active.set(q.id, q.abortTo ?? 0);
    this.regroupAll();
    this.onParty?.();
    return q ?? null;
  }

  /** debug: send members away (ctrl = switchable) / make one member solo */
  forceSplit(spec: Partial<Record<Role, SplitTask>>, meet?: string): void {
    this.applyParty({ kind: 'auto', text: '', split: spec, meet }, { id: 'debug' } as QuestDef, 0);
  }

  forceSolo(role: Role, at = 'harbor', waitAt = 'harbor', task = '出海'): void {
    this.applyParty({ kind: 'auto', text: '', solo: { role, at, task, waitAt } }, { id: 'debug' } as QuestDef, 0);
  }

  forceRegroup(): void {
    this.regroupAll();
    this.onParty?.();
  }

  private applyGives(g: StepGives, q: QuestDef): void {
    g.flags?.forEach((f) => this.flags.add(f));
    g.items?.forEach((it) => (this.items[it] = (this.items[it] ?? 0) + 1));
    g.outfits?.forEach((o) => this.outfits.add(o));
    if (g.consume) for (const [it, n] of Object.entries(g.consume)) this.items[it] = Math.max(0, (this.items[it] ?? 0) - n);
    if (g.respect) this.respect = Math.max(this.respect, RESPECT.indexOf(g.respect));
    this.onGives?.(g, q);
    if (g.relation) this.stats.relation = (this.stats.relation ?? 0) + g.relation;
    if (g.counter) for (const [k, v] of Object.entries(g.counter)) this.counters[k] = (this.counters[k] ?? 0) + v;
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
        if (st?.kind === 'auto' && !st.lines?.length && this.windowOk(q).ok && !this.outfitMissing(q).length && (!st.until || this.evalReq(st.until))) {
          ev.push(...this.advance(q));
          changed = true;
        }
      }
      if (!changed) break;
    }
    if (this.tracked && !this.active.has(this.tracked)) this.tracked = null;
    return ev;
  }

  /**
   * 0.1.4: members still to change into the outfit the quest needs before its first step ([] = fine).
   * Only the first step checks, so a member may change back to everyday clothes mid-quest.
   */
  outfitMissing(q: QuestDef): { role: 'm' | 'f'; outfit: string }[] {
    if (!q.requiresOutfit || (this.active.get(q.id) ?? 0) !== 0) return [];
    const out: { role: 'm' | 'f'; outfit: string }[] = [];
    for (const [r, o] of Object.entries(q.requiresOutfit) as ['m' | 'f', string][]) if (o && this.wear[r] !== o) out.push({ role: r, outfit: o });
    return out;
  }

  /** finish the current step of q (rewards are applied by the caller via gives) */
  advance(q: QuestDef): QuestEvent[] {
    const i = this.active.get(q.id);
    if (i === undefined) return [];
    const st = q.steps[i];
    // a tasks step finished early (debug / forceDone): the parts not done yet still give their rewards
    if (st?.kind === 'tasks' && st.tasks) st.tasks.forEach((t, k) => { if (!this.taskDone(q, k) && t.gives) this.applyGives(t.gives, q); });
    for (const k of [...this.tasksDone]) if (k.startsWith(`${q.id}:${i}:`)) this.tasksDone.delete(k);
    if (st?.gives) this.applyGives(st.gives, q);
    if (st) this.applyParty(st, q, i);
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
    if (this.tracked && this.active.has(this.tracked) && !this.byId.get(this.tracked)?.silent) return this.byId.get(this.tracked)!;
    const act = this.defs.filter((q) => this.active.has(q.id) && q.playable && !q.silent);
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
      outfits: [...this.outfits],
      wear: { ...this.wear },
      ...this.party.toJSON(),
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
    this.outfits = new Set(strs(j.outfits));
    this.wear = {};
    if (j.wear && typeof j.wear === 'object') for (const r of ['m', 'f', 't'] as Role[]) { const id = (j.wear as Record<string, unknown>)[r]; if (typeof id === 'string' && this.outfits.has(id)) this.wear[r] = id; }
    // party split: unknown / broken member entries fall back to "in the party"
    this.party.load(j);
    // a split whose quest is gone / finished cannot be finished any more → regroup
    const owner = this.party.ownerQuest();
    if (owner && !this.active.has(owner)) this.regroupAll();
  }

  reset(): void {
    this.load({});
  }
}

const taskCache = new WeakMap<MemberTask, QuestStep>();
/** a member part as a step (talk / spot) for the shared talk / spot / marker code */
export function taskStep(t: MemberTask): QuestStep {
  let s = taskCache.get(t);
  if (!s) {
    s = { kind: t.kind, npc: t.npc, spot: t.spot, r: t.r, actor: [t.role], need: [], text: t.text, lines: t.lines, gives: t.gives };
    taskCache.set(t, s);
  }
  return s;
}
