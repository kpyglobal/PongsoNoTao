/**
 * Party split state (docs/phase1/PARTY_SPLIT.md): who is with the party, who is away on a task, who waits where,
 * the solo member (族男出海) and the regroup point. Pure data + rules; QuestEngine applies quest steps to it and
 * persists it in the save, Game renders it (followers, HUD chips, banner, markers).
 */
import type { Role, SplitTask, StepLine } from '../quests/types';

export interface MemberState {
  /** party = follows / is controlled with the group; away = on a task elsewhere; wait = waiting at a place */
  st: 'party' | 'away' | 'wait';
  at?: string;
  task?: string;
  /** away / wait members the player may switch to */
  ctrl?: boolean;
  /** the quest that sent them */
  quest?: string;
  /** last known position (Game keeps it current; persisted so a reload puts them back) */
  x?: number;
  z?: number;
}

export interface PartySplitJSON {
  members?: Record<Role, MemberState>;
  solo?: Role | null;
  meet?: string | null;
  tasksDone?: string[];
}

export const ROLES_ALL: Role[] = ['m', 'f', 't'];
export const ROLE_NAME: Record<Role, string> = { m: '族男', f: '族女', t: '旅人' };
const partyAll = (): Record<Role, MemberState> => ({ m: { st: 'party' }, f: { st: 'party' }, t: { st: 'party' } });

export class PartySplit {
  members: Record<Role, MemberState> = partyAll();
  solo: Role | null = null;
  meet: string | null = null;
  /** finished member parts of `tasks` steps: `${quest}:${step}:${part}` */
  tasksDone = new Set<string>();
  /** solo origin (quest + step) for 放棄出海 */
  soloFrom: { quest: string; step: number } | null = null;
  /** lines shown when the solo member gives up (from the solo step) */
  soloGiveUp: StepLine[] | null = null;

  /** zh-TW reason a member cannot be switched to / act right now (null = fine) */
  block(r: Role): string | null {
    const m = this.members[r];
    if (this.solo && this.solo !== r) {
      const s = this.members[this.solo];
      return `${ROLE_NAME[this.solo]}正在${s.task ?? '外面'}，只能操控${ROLE_NAME[this.solo]}；等他完成或放棄後再會合。`;
    }
    if (m.st === 'away' && !m.ctrl) return `${ROLE_NAME[r]}正在${m.task ?? '外面'}（離隊中），暫時不能操控。`;
    return null;
  }

  awayRoles(): Role[] {
    return ROLES_ALL.filter((r) => this.members[r].st !== 'party');
  }

  isSplit(): boolean {
    return !!this.solo || this.awayRoles().length > 0;
  }

  split(spec: Partial<Record<Role, SplitTask>>, quest: string, meet?: string): void {
    for (const r of ROLES_ALL) {
      const s = spec[r];
      if (s) this.members[r] = { ...this.members[r], st: 'away', at: s.at, task: s.task, ctrl: !!s.ctrl, quest };
    }
    if (meet) this.meet = meet;
  }

  startSolo(solo: { role: Role; at: string; task: string; waitAt: string; giveUp?: StepLine[] }, quest: string, step: number): void {
    for (const r of ROLES_ALL) {
      this.members[r] = r === solo.role
        ? { ...this.members[r], st: 'away', at: solo.at, task: solo.task, ctrl: true, quest }
        : { ...this.members[r], st: 'wait', at: solo.waitAt, task: `在岸邊等${ROLE_NAME[solo.role]}`, ctrl: false, quest };
    }
    this.solo = solo.role;
    this.soloFrom = { quest, step };
    this.soloGiveUp = solo.giveUp ?? null;
  }

  /** a member finished their part: wait at the regroup point */
  partDone(r: Role): void {
    const m = this.members[r];
    if (m.st !== 'party') Object.assign(m, { st: 'wait', at: this.meet ?? m.at, task: this.meet ? '在集合點等' : '完成了，等大家', ctrl: true });
  }

  regroup(): void {
    this.members = partyAll();
    this.solo = null;
    this.meet = null;
    this.soloFrom = null;
    this.soloGiveUp = null;
  }

  /** the quest that owns the split (null when together or debug) */
  ownerQuest(): string | null {
    return ROLES_ALL.map((r) => this.members[r].quest).find((x) => x && x !== 'debug') ?? null;
  }

  toJSON(): Required<PartySplitJSON> {
    return { members: JSON.parse(JSON.stringify(this.members)) as Record<Role, MemberState>, solo: this.solo, meet: this.meet, tasksDone: [...this.tasksDone] };
  }

  /** older saves have none of this → everyone in the party; broken entries fall back to "in the party" */
  load(j: PartySplitJSON): void {
    this.members = partyAll();
    const mem = j.members && typeof j.members === 'object' ? (j.members as Record<string, unknown>) : {};
    const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    for (const r of ROLES_ALL) {
      const m = mem[r] as Partial<MemberState> | undefined;
      if (!m || !['party', 'away', 'wait'].includes(m.st as string)) continue;
      this.members[r] = {
        st: m.st as MemberState['st'],
        at: typeof m.at === 'string' ? m.at : undefined,
        task: typeof m.task === 'string' ? m.task : undefined,
        ctrl: !!m.ctrl,
        quest: typeof m.quest === 'string' ? m.quest : undefined,
        x: num(m.x),
        z: num(m.z),
      };
    }
    this.solo = j.solo === 'm' || j.solo === 'f' || j.solo === 't' ? j.solo : null;
    if (this.solo && this.members[this.solo].st === 'party') this.solo = null;
    this.meet = typeof j.meet === 'string' ? j.meet : null;
    this.tasksDone = new Set(Array.isArray(j.tasksDone) ? j.tasksDone.filter((x): x is string => typeof x === 'string') : []);
    this.soloFrom = null;
    this.soloGiveUp = null;
  }
}
