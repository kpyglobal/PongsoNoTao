/**
 * Runtime content check (cheap, runs once at boot): unique ids and every cross-reference resolves.
 * The full design check (completability, split structure, 分工, wording) is scripts/validate-content.mjs,
 * which also runs in `npm run build`.
 */
import type { QuestDef, Req, StepGives, StepLine } from '../quests/types';
import type { ContentMeta, DialogueSet, GatherNodeDef, ItemDef, NpcDef, OutfitDef, PhotoSpotDef, PlaceRec, RecipeDef } from './types';

export class ContentError extends Error {
  constructor(public problems: string[]) {
    super(`content/ has ${problems.length} problem(s):\n- ${problems.slice(0, 12).join('\n- ')}`);
  }
}

type F = { __file: string };
export interface ValidateInput {
  meta: ContentMeta;
  places: Record<string, PlaceRec>;
  derived: string[];
  landmarks: string[];
  quests: (QuestDef & F)[];
  items: (ItemDef & F)[];
  recipes: (RecipeDef & F)[];
  npcs: (NpcDef & F)[];
  dialogues: (DialogueSet & F)[];
  photoSpots: (PhotoSpotDef & F)[];
  gatherNodes: (GatherNodeDef & F)[];
  outfits: (OutfitDef & F)[];
  songs: Record<string, unknown>;
}

const TOKENS = new Set(['@host', '@giver', '@hostf', '@host.m', '@host.f', '@hostf.m', '@hostf.f', '@m', '@f', '@t', '@npc', '@me', '旁白', '文化聲明']);
const TIMES = new Set(['day', 'night', 'any']);
const SEASONS = new Set(['summer', 'winter']);

export function validateContent(c: ValidateInput): void {
  const bad: string[] = [];
  const ids = <T extends { id: string } & F>(list: T[], kind: string): Set<string> => {
    const seen = new Map<string, string>();
    for (const x of list) {
      if (!x.id) bad.push(`${kind} without id (${x.__file})`);
      else if (seen.has(x.id)) bad.push(`duplicate ${kind} "${x.id}" (${seen.get(x.id)} / ${x.__file})`);
      else seen.set(x.id, x.__file);
    }
    return new Set(seen.keys());
  };
  const Q = ids(c.quests, 'quest');
  const I = ids(c.items, 'item');
  const R = ids(c.recipes, 'recipe');
  const N = ids(c.npcs, 'npc');
  const D = ids(c.dialogues, 'dialogue');
  ids(c.photoSpots, 'photo spot');
  const G = ids(c.gatherNodes, 'gather node');
  const O = ids(c.outfits, 'outfit');
  const P = new Set([...Object.keys(c.places), ...c.derived, ...c.landmarks]);
  const flags = new Set(Object.keys(c.meta.externalFlags ?? {}));
  for (const q of c.quests) for (const s of q.steps ?? []) for (const g of [s.gives, ...(s.tasks ?? []).map((t) => t.gives)]) g?.flags?.forEach((f) => flags.add(f));
  for (const n of c.gatherNodes) if (n.sets) flags.add(n.sets);

  const req = (r: Req | undefined, at: string): void => {
    if (r === undefined) return void bad.push(`${at}: missing req`);
    if (typeof r === 'string') { if (!Q.has(r)) bad.push(`${at}: unknown quest "${r}"`); return; }
    if ('all' in r) return r.all.forEach((x) => req(x, at));
    if ('any' in r) return r.any.forEach((x) => req(x, at));
    if ('flag' in r && !flags.has(r.flag)) bad.push(`${at}: flag "${r.flag}" is never set`);
    if ('item' in r && !I.has(r.item)) bad.push(`${at}: unknown item "${r.item}"`);
  };
  const npc = (id: string | undefined, at: string): void => { if (id && !N.has(id) && !TOKENS.has(id)) bad.push(`${at}: unknown npc "${id}"`); };
  const place = (id: string | undefined, at: string): void => { if (id && !P.has(id)) bad.push(`${at}: unknown place "${id}"`); };
  const lines = (ls: StepLine[] | undefined, at: string): void => ls?.forEach((l) => npc(l.who, at));
  const gives = (g: StepGives | undefined, at: string): void => {
    if (!g) return;
    g.items?.forEach((i) => { if (!I.has(i)) bad.push(`${at}: unknown item "${i}"`); });
    Object.keys(g.consume ?? {}).forEach((i) => { if (!I.has(i)) bad.push(`${at}: unknown item "${i}"`); });
    if (g.recipe && !R.has(g.recipe)) bad.push(`${at}: unknown recipe "${g.recipe}"`);
    g.outfits?.forEach((o) => { if (!O.has(o)) bad.push(`${at}: unknown outfit "${o}"`); });
  };
  const win = (o: { time?: string; seasons?: string[]; periods?: string[]; tide?: string }, at: string): void => {
    if (o.time !== undefined && !TIMES.has(o.time)) bad.push(`${at}: bad time "${o.time}"`);
    // the placeholder tide is low only at dawn / dusk: night + low tide can never open
    if (o.tide === 'low' && !o.periods?.length && o.time === 'night') bad.push(`${at}: night + low tide never happens (low tide = dawn / dusk); set periods`);
    if (o.tide === 'low' && o.periods?.length && !o.periods.some((p) => p === 'dawn' || p === 'dusk')) bad.push(`${at}: low tide only at dawn / dusk`);
    o.seasons?.forEach((s) => { if (!SEASONS.has(s)) bad.push(`${at}: bad season "${s}"`); });
  };

  for (const q of c.quests) {
    const at = `quest ${q.id} (${q.__file})`;
    win(q, at);
    req(q.req, at);
    [...(q.steps ?? []), ...(q.twoHomes?.steps ?? [])].forEach((s, i) => {
      const a = `${at} step ${i}`;
      if (s.alt) { npc(s.alt.npc, `${a} alt`); lines(s.alt.lines, `${a} alt`); }
      npc(s.npc, a);
      place(s.spot, a);
      place(s.meet, a);
      lines(s.lines, a);
      gives(s.gives, a);
      if (s.until) req(s.until, a);
      for (const t of Object.values(s.split ?? {})) place(t?.at, a);
      if (s.solo) { place(s.solo.at, a); place(s.solo.waitAt, a); }
      s.tasks?.forEach((t) => { npc(t.npc, a); place(t.spot, a); lines(t.lines, a); gives(t.gives, a); });
    });
    if (q.song && !c.songs[q.song]) bad.push(`${at}: unknown song "${q.song}"`);
  }
  for (const n of c.npcs) {
    const at = `npc ${n.id}`;
    place(n.home, at);
    if (n.dialogue && !D.has(n.dialogue)) bad.push(`${at}: unknown dialogue "${n.dialogue}"`);
    const intro = n.dialogue ? c.dialogues.find((d) => d.id === n.dialogue)?.intro : undefined;
    if (intro && !D.has(intro)) bad.push(`${at}: unknown intro dialogue "${intro}"`);
    n.schedule?.forEach((s) => s.waypoints.forEach((w) => place(w, at)));
  }
  for (const r of c.recipes) {
    Object.keys(r.ingredients ?? {}).forEach((i) => { if (!I.has(i)) bad.push(`recipe ${r.id}: unknown item "${i}"`); });
    if (r.keeper && !N.has(r.keeper)) bad.push(`recipe ${r.id}: unknown keeper "${r.keeper}"`);
  }
  for (const i of c.items) for (const s of i.sources ?? []) {
    if (s.node && !G.has(s.node)) bad.push(`item ${i.id}: unknown node "${s.node}"`);
    if (s.npc && !N.has(s.npc)) bad.push(`item ${i.id}: unknown shop "${s.npc}"`);
  }
  for (const g of c.gatherNodes) {
    place(g.place, `gather node ${g.id}`);
    win(g, `gather node ${g.id}`);
    const it = g.item ?? g.observe;
    if (it && !I.has(it)) bad.push(`gather node ${g.id}: unknown item "${it}"`);
  }
  for (const p of c.photoSpots) { place(p.place, `photo spot ${p.id}`); place(p.landmark, `photo spot ${p.id}`); win(p, `photo spot ${p.id}`); }
  for (const o of c.outfits) {
    if (o.portraitByGender && !o.who.every((r) => r === 't')) bad.push(`outfit ${o.id}: portraitByGender is for traveller accessories`);
    if (o.sheetByGender && (!o.who.every((r) => r === 't') || o.kind !== 'accessory')) bad.push(`outfit ${o.id}: sheetByGender is for traveller accessories`);
    if (o.kind === 'traditional' && o.who.includes('t')) bad.push(`outfit ${o.id}: the traveller never wears Tao traditional clothing`);
    if (!Q.has(o.unlockQuest)) bad.push(`outfit ${o.id}: unknown quest "${o.unlockQuest}"`);
  }
  for (const [g, m] of Object.entries(c.meta.elders ?? {})) for (const id of Object.values(m)) if (!N.has(id)) bad.push(`meta.elders.${g}: unknown npc "${id}"`);
  if (bad.length) throw new ContentError(bad);
}
