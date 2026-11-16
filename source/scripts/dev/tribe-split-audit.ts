// 0.1.5 split hometowns: resolve every quest for all 36 (族男, 族女) village pairs and check the result.
// Run through scripts/test-tribe-split.mjs (esbuild bundle, like check-npcs).
import { loadContentNode } from './content-node';
import { HOST_PLACES, questHome, resolveQuests, VILLAGES, type Homes } from '../../src/systems/homes';
import type { QuestDef } from '../../src/quests/types';

export interface AuditResult { pairs: number; checks: number; fails: string[]; samples: Record<string, unknown> }

const KEEP = new Set(['@npc', '@me', '@m', '@f', '@t', '旁白', '文化聲明']);

export function runTribeSplitAudit(): AuditResult {
  const db = loadContentNode();
  const el = db.questFile.elders;
  const places = new Set([...Object.keys(db.places), ...db.derivedPlaces, ...db.landmarks]);
  for (const v of VILLAGES) for (const id of HOST_PLACES) places.add(`${id}@${v}`);
  const fails: string[] = [];
  let checks = 0;
  const ok = (c: boolean, msg: string): void => { checks++; if (!c) fails.push(msg); };
  const samples: Record<string, unknown> = {};
  const byId = (id: string): QuestDef => db.quests.find((q) => q.id === id)!;
  // original (unresolved) talk npcs per quest, to tell hard-coded visits from host tokens
  const orig = new Map(db.quests.map((q) => [q.id, q.steps.map((s) => s.npc)]));
  for (const m of VILLAGES) for (const f of VILLAGES) {
    const h: Homes = { m, f, host: m };
    const shaped = resolveQuests(db.quests, h, el);
    const tag = `${m}/${f}`;
    ok(m === f ? shaped.length === 0 : shaped.includes('Q03'), `${tag}: twoHomes only when the villages differ (${shaped})`);
    for (const q of db.quests) {
      const v = questHome(q, h);
      for (const [i, s] of q.steps.entries()) {
        const at = `${tag} ${q.id} step ${i}`;
        for (const who of [s.npc, ...(s.lines ?? []).map((l) => l.who), ...(s.tasks ?? []).flatMap((t) => [t.npc, ...(t.lines ?? []).map((l) => l.who)])]) {
          if (!who || !who.startsWith('@') || KEEP.has(who) || who === '@giver') continue;
          ok(false, `${at}: token ${who} left unresolved`);
        }
        for (const p of [s.spot, s.meet, ...Object.values(s.split ?? {}).map((x) => x?.at), s.solo?.at, s.solo?.waitAt, ...(s.tasks ?? []).map((t) => t.spot)]) {
          if (p) ok(places.has(p), `${at}: place ${p} unknown`);
          if (p && p.startsWith('host_')) ok(v === h.host ? !p.includes('@') : p.endsWith(`@${v}`), `${at}: place ${p} is not in the quest's village ${v}`);
        }
        ok(!s.alt, `${at}: alt left in a resolved step`);
      }
      // nobody visited twice as two people: a hard-coded visit is never also the quest's host elder
      if (q.id !== 'Q03') {
        const o = orig.get(q.id)!;
        const tokenIds = new Set(q.steps.filter((_, i) => o[i]?.startsWith('@')).map((s) => s.npc));
        const fixed = q.steps.filter((_, i) => o[i] && !o[i]!.startsWith('@')).map((s) => s.npc);
        for (const id of fixed) ok(!tokenIds.has(id), `${tag} ${q.id}: ${id} is both a named visit and the host elder`);
      }
    }
    // Q03: same village → one check-in; different → each member at home, then the 主人家 涼亭
    const q3 = byId('Q03');
    if (m === f) {
      ok(q3.steps.length === 2 && q3.steps[0].kind === 'talk' && q3.steps[0].npc === `elder_${m}`, `${tag} Q03 single check-in`);
    } else {
      const t = q3.steps[0].tasks ?? [];
      ok(q3.steps[0].kind === 'tasks' && t.length === 2, `${tag} Q03 two check-ins`);
      ok(t.find((x) => x.role === 'm')?.npc === `elder_${m}`, `${tag} Q03 族男 checks in at his own home`);
      ok(t.find((x) => x.role === 'f')?.npc === `elder_${f}`, `${tag} Q03 族女 checks in at her own home`);
      ok(q3.steps[1].spot === 'host_tagakal', `${tag} Q03 meets at the 主人家 涼亭`);
      const said = q3.steps.flatMap((s) => [...(s.lines ?? []), ...(s.tasks ?? []).flatMap((x) => x.lines ?? [])]).map((l) => l.zh).join('');
      ok(!said.includes('你們小時候'), `${tag} Q03 no line says both grew up in the same house`);
    }
    // giver f (芋田) → the 族女's village; giver m (造船) → the 族男's; both-member quests without giver → 主人家
    ok(questHome(byId('R1'), h) === f, `${tag} R1 follows the 族女`);
    ok(questHome(byId('T1'), h) === m, `${tag} T1 follows the 族男`);
    ok(questHome(byId('Q07'), h) === m, `${tag} Q07 at the 主人家`);
    ok(questHome(byId('OF2'), h) === f && questHome(byId('OF1'), h) === m, `${tag} 尋根 follows each member`);
    if (m === 'ivalino' && f === 'yayo') {
      samples[tag] = {
        Q03: byId('Q03').steps.map((s) => s.npc ?? s.tasks?.map((t) => `${t.role}:${t.npc}`) ?? s.spot),
        OF1: byId('OF1').steps.map((s) => s.npc ?? s.spot),
        W2: byId('W2').steps.map((s) => s.npc ?? s.spot),
        R1: byId('R1').steps.map((s) => s.npc ?? s.spot),
      };
    }
  }
  return { pairs: VILLAGES.length ** 2, checks, fails, samples };
}
