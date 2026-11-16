/**
 * 0.1.5: 族男 and 族女 may come from different villages.
 *
 * - `homes.m` / `homes.f`: each Tao member's own village; `homes.host` = the party's 主人家 (the 族男's village).
 * - Every quest is tied to one village by a fixed rule (questHome): its giver's member, else the only Tao
 *   member in its roles, else the 主人家.
 * - resolveQuests() rewrites each quest's steps for the current homes (from a pristine copy, so a new game with
 *   other villages starts clean): @host / @hostf / @giver (and @host.m / @host.f / @hostf.m / @hostf.f) become NPC
 *   ids, host_* places of a village other than the 主人家 become `host_*@<village>`, a hard-coded NPC that is the
 *   quest's own host elder switches to the step's `alt`, and a quest with `twoHomes` uses that variant when the
 *   two villages differ.
 * Pure data, no DOM; scripts/test-tribe-split.mjs checks it through the game's debug API.
 */
import type { QuestDef, QuestFile, QuestStep, Role, StepLine } from '../quests/types';

export type VillageId = 'yayo' | 'iraraley' | 'iranmeylek' | 'ivalino' | 'imorod' | 'iratay';
export const VILLAGES: VillageId[] = ['yayo', 'iraraley', 'iranmeylek', 'ivalino', 'imorod', 'iratay'];
export const isVillage = (v: unknown): v is VillageId => typeof v === 'string' && (VILLAGES as string[]).includes(v);

export interface Homes {
  m: VillageId;
  f: VillageId;
  /** 主人家: where the party stays (= the 族男's village) */
  host: VillageId;
}

export const HOST_PLACES = ['host_home', 'host_taro', 'host_weave', 'host_tagakal', 'host_fishrack'];

/** the village a quest's host tokens / places point at */
export function questHome(q: Pick<QuestDef, 'giver' | 'roles'>, h: Homes): VillageId {
  if (q.giver === 'm' || q.giver === 'f') return h[q.giver];
  const tao = (q.roles ?? []).filter((r): r is 'm' | 'f' => r === 'm' || r === 'f');
  if (tao.length === 1) return h[tao[0]];
  return h.host;
}

type Elders = QuestFile['elders'];
export function elderM(v: string, el: Elders): string {
  return el?.m?.[v] ?? `elder_${v}`;
}
export function elderF(v: string, el: Elders): string {
  return el?.f?.[v] ?? 'weaver_elder';
}

/** NPC id behind a host token for village v (null: not a host token) */
export function tokenNpc(tok: string, q: Pick<QuestDef, 'giver'>, v: string, h: Homes, el: Elders): string | null {
  const m = /^@(host|hostf|giver)(?:\.(m|f))?$/.exec(tok);
  if (!m) return null;
  const vv = m[2] ? h[m[2] as 'm' | 'f'] : v;
  if (m[1] === 'host') return elderM(vv, el);
  if (m[1] === 'hostf') return elderF(vv, el);
  return (q.giver ?? 'm') === 'f' ? elderF(vv, el) : elderM(vv, el);
}

/** host_* place of village v (the 主人家 keeps the plain id, so older saves and scripts still find it) */
export function hostPlaceId(id: string | undefined, v: string, h: Homes): string | undefined {
  if (!id || !HOST_PLACES.includes(id) || v === h.host) return id;
  return `${id}@${v}`;
}

interface Pristine { steps: QuestStep[]; hint: QuestDef['hint']; text: QuestDef['text']; n: number }
const pristine = new WeakMap<QuestDef, Pristine>();
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function fixLines(ls: StepLine[] | undefined, q: QuestDef, v: string, h: Homes, el: Elders): StepLine[] | undefined {
  // @giver in a line = the elder being talked to; it stays a token
  return ls?.map((l) => (l.who.startsWith('@') && !l.who.startsWith('@giver') ? { ...l, who: tokenNpc(l.who, q, v, h, el) ?? l.who } : l));
}

/** rewrite every quest for these homes; returns the ids of quests whose steps changed shape (twoHomes) */
export function resolveQuests(defs: QuestDef[], h: Homes, el: Elders): string[] {
  const shaped: string[] = [];
  for (const q of defs) {
    let p = pristine.get(q);
    if (!p) {
      p = { steps: clone(q.steps), hint: clone(q.hint), text: clone(q.text), n: q.n };
      pristine.set(q, p);
    }
    const two = q.twoHomes && h.m !== h.f ? q.twoHomes : null;
    if (two) shaped.push(q.id);
    const steps = clone(two ? two.steps : p.steps);
    q.hint = clone(two?.hint ?? p.hint);
    q.text = { ...clone(p.text), ...(two?.text ?? {}) };
    q.n = two?.n ?? p.n;
    const v = questHome(q, h);
    // the quest's own host elders (a hard-coded visit to one of them uses the step's alt instead)
    const own = new Set<string>();
    const used = (tok: string | undefined): void => {
      const id = tok ? tokenNpc(tok, q, v, h, el) : null;
      if (id) own.add(id);
    };
    for (const s of steps) {
      used(s.npc);
      s.lines?.forEach((l) => used(l.who));
      s.tasks?.forEach((t) => used(t.npc));
    }
    q.steps = steps.map((s0) => {
      let s = s0;
      if (s.alt && s.npc && !s.npc.startsWith('@') && own.has(s.npc)) {
        const { alt, ...rest } = s;
        s = { ...rest, npc: alt.npc, text: alt.text ?? rest.text, lines: alt.lines ?? rest.lines };
      }
      const out: QuestStep = { ...s };
      if (s.npc) out.npc = tokenNpc(s.npc, q, v, h, el) ?? s.npc;
      out.lines = fixLines(s.lines, q, v, h, el);
      if (!out.lines) delete out.lines;
      if (s.spot) out.spot = hostPlaceId(s.spot, v, h);
      if (s.meet) out.meet = hostPlaceId(s.meet, v, h);
      if (s.split) out.split = Object.fromEntries(Object.entries(s.split).map(([r, t]) => [r, t ? { ...t, at: hostPlaceId(t.at, v, h)! } : t]));
      if (s.solo) out.solo = { ...s.solo, at: hostPlaceId(s.solo.at, v, h)!, waitAt: hostPlaceId(s.solo.waitAt, v, h)! };
      if (s.tasks) {
        out.tasks = s.tasks.map((t) => {
          const o = { ...t };
          if (t.npc) o.npc = tokenNpc(t.npc, q, v, h, el) ?? t.npc;
          o.lines = fixLines(t.lines, q, v, h, el);
          if (!o.lines) delete o.lines;
          if (t.spot) o.spot = hostPlaceId(t.spot, v, h);
          return o;
        });
      }
      delete out.alt;
      return out;
    });
  }
  return shaped;
}

/** the village every role's own home is in ('t' = the 主人家, where the traveller stays) */
export function roleHome(r: Role, h: Homes): VillageId {
  return r === 'm' ? h.m : r === 'f' ? h.f : h.host;
}
