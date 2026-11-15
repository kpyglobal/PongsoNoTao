// Validate the modular content/ tree (Phase A). Usage: node scripts/validate-content.mjs [--review] [--quiet]
// Checks: ids unique, enums valid, every reference resolves, party-split steps are well formed,
// every village has its a akey / a akes / recipe keeper, outsiders never get Tao clothing,
// player-facing text has no simplified characters, and every playable quest is completable from its prerequisites.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const C = path.join(ROOT, 'content');
const args = new Set(process.argv.slice(2));
const OVERLAY = process.env.CONTENT_OVERLAY ? path.resolve(ROOT, process.env.CONTENT_OVERLAY) : null;
const PENDING_DIR = path.join(ROOT, 'content-pending');
/** place ids the world worker still has to add (docs/phase1/WORLD_NEEDS.md, first table column) */
const WORLD_NEEDS = (() => { try { return new Set([...fs.readFileSync(path.join(ROOT, 'docs/phase1/WORLD_NEEDS.md'), 'utf8').matchAll(/^\| `([a-z0-9_]+)` \|/gm)].map((m) => m[1])); } catch { return new Set(); } })();
const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);
const readJson = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { err(`${path.relative(ROOT, p)}: invalid JSON (${e.message})`); return {}; }
};
/** every *.json under content/<dir> (recursive), merged on `key` */
function loadDir(dir, key) {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.json')) {
        const j = readJson(p);
        const v = j[key];
        if (!v) { err(`${path.relative(ROOT, p)}: missing "${key}"`); continue; }
        if (Array.isArray(v)) for (const x of v) out.push({ ...x, __file: path.relative(C, p) });
        else for (const [id, x] of Object.entries(v)) out.push({ id, ...x, __file: path.relative(C, p) });
      }
    }
  };
  walk(path.join(C, dir));
  // CONTENT_OVERLAY=content-pending: entries there replace the same id (quests waiting for WORLD_NEEDS places)
  if (OVERLAY) {
    const over = [];
    const walkO = (d) => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walkO(p); else if (f.endsWith('.json')) { const v = readJson(p)[key]; for (const x of (Array.isArray(v) ? v : Object.entries(v ?? {}).map(([id, y]) => ({ id, ...y })))) over.push({ ...x, __file: path.relative(OVERLAY, p) }); } } };
    walkO(path.join(OVERLAY, dir));
    for (const x of over) { const i = out.findIndex((y) => y.id === x.id); if (i >= 0) out[i] = x; else out.push(x); }
  }
  return out;
}
function index(list, kind) {
  const m = new Map();
  for (const x of list) {
    if (!x.id) { err(`${kind} without id in ${x.__file}`); continue; }
    if (m.has(x.id)) err(`duplicate ${kind} id "${x.id}" (${m.get(x.id).__file} and ${x.__file})`);
    m.set(x.id, x);
  }
  return m;
}

const meta = readJson(path.join(C, 'meta.json'));
const placesF = readJson(path.join(C, 'places.json'));
const glossary = readJson(path.join(C, 'glossary.json'));
const songs = readJson(path.join(C, 'songs.json')).songs ?? {};
const quests = index(loadDir('quests', 'quests'), 'quest');
const items = index(loadDir('items', 'items'), 'item');
const recipes = index(loadDir('recipes', 'recipes'), 'recipe');
const npcs = index(loadDir('npcs', 'npcs'), 'npc');
const dialogues = index(loadDir('dialogue', 'dialogues'), 'dialogue');
const photoSpots = index(loadDir('photoSpots', 'photoSpots'), 'photo spot');
const nodes = index(loadDir('gatherNodes', 'gatherNodes'), 'gather node');
const outfits = index(loadDir('outfits', 'outfits'), 'outfit');
const gloss = new Set((glossary.entries ?? []).map((e) => e.id));
// QA L2: Tao-name slots must hold Tao words or stay blank: no Mandarin pinyin / English place names
{
  const NOT_TAO = /^(kaiyuan|surprise|random|dongqing|badai|lanyu|hongtou|yuren|langdao|yeyin|yeyou|harbou?r)$/i;
  const walk = (o, at) => { if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${at}[${i}]`)); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'tao' && typeof v === 'string' && NOT_TAO.test(v.trim())) err(`${at}.tao: "${v}" is not a Tao word (leave it blank until the consultant gives one)`); else walk(v, `${at}.${k}`); } };
  walk(placesF, 'places.json');
  walk(readJson(path.join(C, 'ui.json')), 'ui.json');
}
// player-facing glossary text: zh categories only, no developer notes (QA M3 / M4; notes go in `review`)
for (const e of glossary.entries ?? []) {
  if (!e.category || /[A-Za-z]/.test(e.category)) err(`glossary ${e.id}: category must be Traditional Chinese (got "${e.category}")`);
  for (const k of ['zh', 'detail']) if (/Phase\s*[A-Z0-9]|TODO|FIXME/.test(e[k] ?? '')) err(`glossary ${e.id}: developer note in player text (${k}); move it to "review"`);
}

const TIMES = new Set(meta.times ?? ['day', 'night', 'any']);
const PERIODS = new Set(meta.periods ?? []);
const SEASONS = new Set(Object.keys(meta.seasons ?? {}));
const ROLES = new Set(Object.keys(meta.roles ?? { m: 1, f: 1, t: 1 }));
const VILLAGES = meta.villages ?? [];
const TOKENS = new Set(Object.keys(meta.tokens ?? {}));
const PLACES = new Set([
  ...Object.keys(placesF.places ?? {}),
  ...(placesF.derived?.ids ?? []),
  ...(placesF.landmarks ?? []),
  ...Object.keys(placesF.proposed?.places ?? {}),
  ...(OVERLAY ? WORLD_NEEDS : []),
]);
const EXTERNAL_FLAGS = new Set(Object.keys(meta.externalFlags ?? {}));

// ------------------------------------------------------------- helpers
const where = (q, i, extra = '') => `quest ${q.id}${i !== undefined ? ` step ${i}` : ''}${extra} (${q.__file})`;
const checkTime = (o, label) => {
  if (o.time !== undefined && !TIMES.has(o.time)) err(`${label}: bad time "${o.time}"`);
  for (const s of o.seasons ?? []) if (!SEASONS.has(s)) err(`${label}: bad season "${s}"`);
  for (const p of o.periods ?? []) if (!PERIODS.has(p)) err(`${label}: bad period "${p}"`);
  if (o.tide !== undefined && !['low', 'high'].includes(o.tide)) err(`${label}: bad tide "${o.tide}"`);
};
const checkRoles = (arr, label) => { for (const r of arr ?? []) if (!ROLES.has(r)) err(`${label}: bad role "${r}"`); };
/** `need` entries are role sets: 'mf' = 族男或族女 (either one is enough) */
const checkRoleSets = (arr, label) => { for (const r of arr ?? []) if (!r || ![...r].every((c) => ROLES.has(c))) err(`${label}: bad role set "${r}"`); };
const isNpcRef = (s) => npcs.has(s) || TOKENS.has(s);
const allGives = (q) => {
  const out = [];
  q.steps?.forEach((s, i) => { if (s.gives) out.push([s.gives, i]); for (const t of s.tasks ?? []) if (t.gives) out.push([t.gives, i]); });
  return out;
};

// given flags (for flag requirement resolution)
const GIVEN_FLAGS = new Set();
for (const q of quests.values()) for (const [g] of allGives(q)) for (const f of g.flags ?? []) GIVEN_FLAGS.add(f);
for (const n of nodes.values()) if (n.sets) GIVEN_FLAGS.add(n.sets);

function checkReq(r, label) {
  if (r === undefined || r === null) return err(`${label}: missing req`);
  if (typeof r === 'string') { if (!quests.has(r)) err(`${label}: req quest "${r}" not found`); return; }
  if (r.all) return r.all.forEach((x) => checkReq(x, label));
  if (r.any) return r.any.forEach((x) => checkReq(x, label));
  if (r.flag) { if (!GIVEN_FLAGS.has(r.flag) && !EXTERNAL_FLAGS.has(r.flag)) err(`${label}: flag "${r.flag}" is never set (add a quest that gives it, or list it in meta.externalFlags)`); return; }
  if (r.respect) { if (!(meta.respect ?? []).some((x) => x.id === r.respect)) err(`${label}: bad respect "${r.respect}"`); return; }
  if (r.item) { if (!items.has(r.item)) err(`${label}: item "${r.item}" not found`); return; }
  if (r.stat || r.count || r.pending) return;
  err(`${label}: unknown req ${JSON.stringify(r)}`);
}
function checkLines(lines, label) {
  for (const l of lines ?? []) {
    if (!l.zh) err(`${label}: line without zh`);
    if (l.who !== undefined && !isNpcRef(l.who)) err(`${label}: speaker "${l.who}" is not an npc id or token`);
  }
}
function checkGives(g, label) {
  for (const i of g.items ?? []) if (!items.has(i)) err(`${label}: gives unknown item "${i}"`);
  for (const i of Object.keys(g.consume ?? {})) if (!items.has(i)) err(`${label}: consumes unknown item "${i}"`);
  if (g.recipe && !recipes.has(g.recipe)) err(`${label}: unknown recipe "${g.recipe}"`);
  for (const x of g.glossary ?? []) if (!gloss.has(x)) err(`${label}: unknown glossary id "${x}"`);
  for (const o of g.outfits ?? []) if (!outfits.has(o)) err(`${label}: unknown outfit "${o}"`);
  if (g.respect && !(meta.respect ?? []).some((x) => x.id === g.respect)) err(`${label}: bad respect "${g.respect}"`);
}

// ------------------------------------------------------------- quests
for (const q of quests.values()) {
  const L = where(q);
  if (!q.name?.zh) err(`${L}: missing name.zh`);
  if (!['main', 'side', 'photo'].includes(q.line)) err(`${L}: bad line "${q.line}"`);
  if (!q.time) err(`${L}: missing time (day / night / any)`);
  checkTime(q, L);
  checkRoles(q.roles, L); checkRoleSets(q.need, L);
  if (q.village && !VILLAGES.includes(q.village)) err(`${L}: bad village "${q.village}"`);
  if (q.giver && !['f', 'm'].includes(q.giver)) err(`${L}: bad giver`);
  checkReq(q.req, L);
  if (q.song && !songs[q.song]) err(`${L}: unknown song "${q.song}"`);
  if (q.needsItem) { if (!items.has(q.needsItem.item)) err(`${L}: needsItem unknown item`); if (!quests.has(q.needsItem.from)) err(`${L}: needsItem.from quest not found`); }
  if (q.recipe) { if (!recipes.has(q.recipe.id)) err(`${L}: recipe ${q.recipe.id} not found`); if (!npcs.has(q.recipe.keeper)) err(`${L}: keeper ${q.recipe.keeper} not found`); }
  if (!Array.isArray(q.steps) || !q.steps.length) { err(`${L}: no steps`); continue; }
  let splitOpen = null; // roles currently away
  let soloOpen = false;
  q.steps.forEach((s, i) => {
    const S = where(q, i);
    if (!['talk', 'spot', 'photo', 'auto', 'placeholder', 'tasks'].includes(s.kind)) err(`${S}: bad kind "${s.kind}"`);
    if (!s.text) err(`${S}: missing text`);
    if (s.kind === 'talk' && !s.npc) err(`${S}: talk step without npc`);
    if (s.npc && !isNpcRef(s.npc)) err(`${S}: npc "${s.npc}" not found`);
    if ((s.kind === 'spot' || s.kind === 'photo') && !s.spot) err(`${S}: ${s.kind} step without spot`);
    if (s.spot && !PLACES.has(s.spot)) err(`${S}: spot "${s.spot}" is not a place / derived place / landmark`);
    if (s.kind === 'auto' && s.until) checkReq(s.until, S);
    checkRoles(s.actor, S); checkRoleSets(s.need, S); checkRoles(s.requires, S);
    checkLines(s.lines, S);
    if (s.gives) checkGives(s.gives, S);
    if (s.meet && !PLACES.has(s.meet)) err(`${S}: meet place "${s.meet}" not found`);
    if (s.split) {
      if (splitOpen) err(`${S}: split while a split is still open`);
      for (const [r, t] of Object.entries(s.split)) {
        if (!ROLES.has(r)) err(`${S}: split bad role ${r}`);
        if (!PLACES.has(t.at)) err(`${S}: split ${r}.at "${t.at}" not found`);
        if (!t.task) err(`${S}: split ${r} without task text`);
      }
      splitOpen = new Set(Object.keys(s.split));
    }
    if (s.solo) {
      if (!ROLES.has(s.solo.role)) err(`${S}: solo bad role`);
      for (const k of ['at', 'waitAt']) if (!PLACES.has(s.solo[k])) err(`${S}: solo.${k} "${s.solo[k]}" not found`);
      if (typeof q.abortTo !== 'number' || q.abortTo > i) err(`${S}: solo needs quest.abortTo (a step index ≤ ${i}) for 放棄出海`);
      if (s.solo.giveUp) checkLines(s.solo.giveUp, S + ' giveUp');
      soloOpen = true;
    }
    if (s.kind === 'tasks') {
      if (!s.tasks?.length) err(`${S}: tasks step without tasks`);
      for (const t of s.tasks ?? []) {
        const T = `${S} task ${t.role}`;
        if (!ROLES.has(t.role)) err(`${T}: bad role`);
        if (splitOpen && !splitOpen.has(t.role)) err(`${T}: member is not away on this split`);
        if (t.npc && !isNpcRef(t.npc)) err(`${T}: npc "${t.npc}" not found`);
        if (t.spot && !PLACES.has(t.spot)) err(`${T}: spot not found`);
        if (t.kind === 'talk' && !t.npc) err(`${T}: talk without npc`);
        checkLines(t.lines, T);
        if (t.gives) checkGives(t.gives, T);
      }
    }
    if (s.requires && splitOpen) for (const r of s.requires) if (splitOpen.has(r)) err(`${S}: requires ${r}, who is still away`);
    if (s.regroup) {
      if (!splitOpen && !soloOpen) warn(`${S}: regroup without an open split / solo`);
      splitOpen = null; soloOpen = false;
    }
    if (s.minigame && !['fish', 'taro'].includes(s.minigame)) err(`${S}: bad minigame`);
  });
  if (splitOpen) err(`${L}: split never regroups`);
  if (soloOpen) err(`${L}: solo never regroups`);
  if (q.time === 'night' && q.steps.some((s) => s.npc && !TOKENS.has(s.npc) && npcs.get(s.npc)?.talkable === false)) warn(`${L}: night quest talks to an NPC that is not talkable`);
}

// ------------------------------------------------------------- items / recipes / npcs / dialogue / spots / nodes / outfits
for (const it of items.values()) {
  const L = `item ${it.id} (${it.__file})`;
  for (const k of ['description', 'codex', 'icon', 'illustration']) if (!it[k]) err(`${L}: missing ${k}`);
  if (!it.name?.zh) err(`${L}: missing name.zh`);
  if (!it.category) err(`${L}: missing category`);
  for (const s of it.sources ?? []) {
    if (s.kind === 'shop' && !npcs.has(s.npc)) err(`${L}: shop npc "${s.npc}" not found`);
    if ((s.kind === 'gather' || s.kind === 'observe') && !nodes.has(s.node)) err(`${L}: node "${s.node}" not found`);
    if (s.kind === 'minigame' && !['fish', 'taro'].includes(s.id)) err(`${L}: bad minigame`);
    checkTime(s, L);
  }
  if (it.equip) { checkRoles(it.equip.who, L); if (it.equip.outfit && !outfits.has(it.equip.outfit)) err(`${L}: equip.outfit not found`); }
}
for (const r of recipes.values()) {
  const L = `recipe ${r.id}`;
  if (!r.name?.zh) err(`${L}: missing name.zh`);
  for (const i of Object.keys(r.ingredients ?? {})) if (!items.has(i)) err(`${L}: ingredient "${i}" not found`);
  if (r.keeper && !npcs.has(r.keeper)) err(`${L}: keeper "${r.keeper}" not found`);
  if (r.quest && !quests.has(r.quest)) err(`${L}: quest "${r.quest}" not found`);
  if (r.village && !VILLAGES.includes(r.village)) err(`${L}: bad village`);
  checkTime(r, L);
}
for (const n of npcs.values()) {
  const L = `npc ${n.id}`;
  if (!n.name?.zh) err(`${L}: missing name.zh`);
  if (n.dialogue && !dialogues.has(n.dialogue) && !n.dialogue.startsWith('auto-')) err(`${L}: dialogue "${n.dialogue}" not found`);
  if (n.recipeKeeper && !recipes.has(n.recipeKeeper)) err(`${L}: recipeKeeper recipe not found`);
  if (n.home && !PLACES.has(n.home)) err(`${L}: home "${n.home}" not found`);
  if (n.village && !VILLAGES.includes(n.village)) err(`${L}: bad village`);
  for (const sch of n.schedule ?? []) for (const wp of sch.waypoints ?? []) if (!PLACES.has(wp)) err(`${L}: waypoint "${wp}" not found`);
}
for (const [g, map] of Object.entries(meta.elders ?? {})) for (const [v, id] of Object.entries(map)) if (!npcs.has(id)) err(`meta.elders.${g}.${v}: npc "${id}" not found`);
for (const d of dialogues.values()) {
  const L = `dialogue ${d.id} (${d.__file})`;
  if (d.npc && !npcs.has(d.npc)) err(`${L}: npc "${d.npc}" not found`);
  const blocks = [d.lines, d.greet, d.duty, ...(d.idle ?? []).map((x) => { checkTime(x.when ?? {}, L); return x.lines; }),
    ...Object.values(d.keeper ?? {}), ...Object.values(d.after ?? {})];
  for (const b of blocks) for (const l of b ?? []) if (!l.zh) err(`${L}: line without zh`);
  for (const q of Object.keys(d.after ?? {})) if (!quests.has(q)) err(`${L}: after quest "${q}" not found`);
}
for (const p of photoSpots.values()) {
  const L = `photo spot ${p.id}`;
  if (p.quest && !quests.has(p.quest)) err(`${L}: quest not found`);
  if (p.landmark && !PLACES.has(p.landmark)) err(`${L}: landmark not found`);
  if (p.place && !PLACES.has(p.place)) err(`${L}: place "${p.place}" not found`);
  if (!p.time) err(`${L}: missing time`);
  checkTime(p, L);
}
for (const n of nodes.values()) {
  const L = `gather node ${n.id}`;
  if (n.kind === 'gather' && !items.has(n.item)) err(`${L}: item "${n.item}" not found`);
  if (n.kind === 'observe' && !items.has(n.observe)) err(`${L}: observe item not found`);
  if (!PLACES.has(n.place)) err(`${L}: place "${n.place}" not found`);
  if (!n.time) err(`${L}: missing time`);
  checkTime(n, L);
  if (n.requires) checkReq(n.requires, L);
}
for (const o of outfits.values()) {
  const L = `outfit ${o.id}`;
  checkRoles(o.who, L);
  if (o.unlockQuest && !quests.has(o.unlockQuest)) err(`${L}: unlockQuest not found`);
  if (o.item && !items.has(o.item)) err(`${L}: item not found`);
  if (o.kind === 'traditional' && o.who.includes('t')) err(`${L}: outsiders (旅人) must never wear Tao traditional clothing`);
  if (o.who.includes('t') && !o.outsiderSafe) err(`${L}: traveller accessory must be outsiderSafe`);
  const unlockedBy = [...quests.values()].some((q) => allGives(q).some(([g]) => (g.outfits ?? []).includes(o.id)));
  if (!unlockedBy) err(`${L}: no quest unlocks it`);
}

// ------------------------------------------------------------- requiresOutfit (Larry 2026-11-14: festivals, boat fishing, tribal events need Tao clothing)
{
  const reqQuestIds = (r, out = new Set()) => { if (!r) return out; if (typeof r === 'string') out.add(r); else for (const k of ['all', 'any']) (r[k] ?? []).forEach((x) => reqQuestIds(x, out)); return out; };
  const closure = (id, seen = new Set()) => { for (const d of reqQuestIds(quests.get(id)?.req)) if (!seen.has(d)) { seen.add(d); closure(d, seen); } return seen; };
  for (const q of quests.values()) {
    if (!q.requiresOutfit) continue;
    const L = where(q);
    const before = closure(q.id);
    for (const [r, o] of Object.entries(q.requiresOutfit)) {
      if (!['m', 'f'].includes(r)) err(`${L}: requiresOutfit role "${r}" (only 族男 m / 族女 f wear Tao clothing)`);
      const od = outfits.get(o);
      if (!od) { err(`${L}: requiresOutfit unknown outfit "${o}"`); continue; }
      if (!od.who.includes(r)) err(`${L}: outfit ${o} is not for role ${r}`);
      if (od.unlockQuest && !before.has(od.unlockQuest)) err(`${L}: requiresOutfit ${o}, but its unlock quest ${od.unlockQuest} is not among the prerequisites`);
    }
  }
}
// only Tao men paddle a tatala (Larry 2026-11-14): a canoe step done by 族女 / 旅人 must be a modern canoe
for (const q of quests.values()) q.steps?.forEach((s, i) => {
  if (!s.canoe) return;
  const who = s.actor ?? q.roles ?? [];
  if (s.canoeKind === 'modern') return;
  if (who.some((r) => r !== 'm')) err(`${where(q, i)}: canoe step that 族女 / 旅人 may do must be a modern canoe (canoeKind: "modern"); only 族男 paddle a tatala`);
});

// ------------------------------------------------------------- village coverage (分工 + recipe keepers)
for (const v of VILLAGES) {
  const vn = [...npcs.values()].filter((n) => n.village === v);
  if (!vn.some((n) => n.role === 'elder_m')) err(`village ${v}: no male elder (a akey)`);
  if (!vn.some((n) => n.role === 'elder_f')) err(`village ${v}: no female elder (a akes)`);
  const keepers = vn.filter((n) => n.recipeKeeper);
  if (!keepers.length) err(`village ${v}: no recipe keeper`);
  for (const k of keepers) if (![...quests.values()].some((q) => q.recipe?.keeper === k.id)) err(`village ${v}: keeper ${k.id} has no recipe quest`);
}
// division of labour: a akey give hunting / fishing / boat quests, a akes give production quests
for (const q of quests.values()) {
  if (!q.giver || q.labourNote) continue;
  const npcIds = q.steps.map((s) => s.npc).filter((x) => x && npcs.has(x));
  for (const id of npcIds) {
    const n = npcs.get(id);
    if (q.giver === 'm' && n.role === 'elder_f') warn(`${where(q)}: giver m but talks to a akes ${id}`);
    if (q.giver === 'f' && n.role === 'elder_m') warn(`${where(q)}: giver f but talks to a akey ${id}`);
  }
}

// ------------------------------------------------------------- text checks
const SIMPLIFIED = /[这们说鱼岛长门时个来对还没过见话边头岁产业东车马鸟龙网飞贝师学书写气见间问题请让给经织线丝织饭饮龟虾苹专]/;
const BAD_STRAIGHT_APOS = /[A-Za-z]'[A-Za-z]/;
function scan(o, label) {
  if (typeof o === 'string') {
    const m = o.match(SIMPLIFIED);
    if (m) err(`${label}: simplified character "${m[0]}" in "${o.slice(0, 30)}"`);
    return;
  }
  if (Array.isArray(o)) return o.forEach((x) => scan(x, label));
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
    if (k === '__file' || k === 'url' || k === 'source' || k === 'license') continue;
    if (k === 'tao' && typeof v === 'string' && BAD_STRAIGHT_APOS.test(v)) warn(`${label}: Tao text uses a straight ' (use ’ U+2019): "${v}"`);
    scan(v, label);
  }
}
for (const [kind, m] of [['quest', quests], ['item', items], ['recipe', recipes], ['dialogue', dialogues], ['npc', npcs], ['photo spot', photoSpots], ['node', nodes], ['outfit', outfits]])
  for (const x of m.values()) scan(x, `${kind} ${x.id}`);

// ------------------------------------------------------------- completability (fixpoint)
const done = new Set();
const flags = new Set(EXTERNAL_FLAGS);
const have = new Set(); // obtainable items
let relation = 0;
const reqOk = (r) => {
  if (typeof r === 'string') return done.has(r);
  if (r.all) return r.all.every(reqOk);
  if (r.any) return r.any.filter(reqOk).length >= (r.n ?? 1);
  if (r.flag) return flags.has(r.flag);
  if (r.respect) return true; // earned by game events (meta.externalProgress)
  if (r.item) return have.has(r.item);
  if (r.stat === 'relation') return relation >= r.min;
  if (r.stat || r.count) return true; // external progress
  if (r.pending) return false;
  return false;
};
const blockedReason = new Map();
/** auto-completed log entry (Q01 抵達蘭嶼): not playable, but done as soon as its req is met */
function isAutoLog(q) {
  return !q.playable && (q.steps ?? []).length > 0 && (q.steps ?? []).every((s) => s.kind === 'auto');
}
function questDoable(q) {
  if (!q.playable) return isAutoLog(q) ? null : 'not playable yet (placeholder)';
  const local = new Set(have);
  for (const [i, s] of q.steps.entries()) {
    if (s.kind === 'placeholder') return `step ${i} is a placeholder`;
    if (s.kind === 'auto' && s.until && !(function ok(r) {
      if (r.all) return r.all.every(ok);
      if (r.item) return local.has(r.item);
      return reqOk(r);
    })(s.until)) return `step ${i} waits for an item nobody can get yet`;
    const gs = [s.gives, ...(s.tasks ?? []).map((t) => t.gives)].filter(Boolean);
    for (const g of gs) for (const c of Object.keys(g.consume ?? {})) if (!local.has(c)) return `step ${i} consumes "${c}" which is not obtainable yet`;
    for (const g of gs) for (const it of g.items ?? []) local.add(it);
  }
  if (q.needsItem && !have.has(q.needsItem.item)) return `needs item ${q.needsItem.item}`;
  return null;
}
let changed = true;
while (changed) {
  changed = false;
  // item sources
  for (const it of items.values()) {
    if (have.has(it.id)) continue;
    for (const s of it.sources ?? []) {
      let ok = s.kind === 'shop' || s.kind === 'minigame';
      if (s.kind === 'gather') { const n = nodes.get(s.node); ok = n && (!n.requires || reqOk(n.requires)); }
      if (ok) { have.add(it.id); changed = true; break; }
    }
  }
  for (const n of nodes.values()) if (n.sets && !flags.has(n.sets) && (!n.requires || reqOk(n.requires))) { flags.add(n.sets); changed = true; }
  for (const q of quests.values()) {
    if (done.has(q.id) || !reqOk(q.req)) continue;
    const why = questDoable(q);
    if (why) { blockedReason.set(q.id, why); continue; }
    done.add(q.id);
    blockedReason.delete(q.id);
    for (const [g] of allGives(q)) {
      for (const f of g.flags ?? []) flags.add(f);
      for (const i of g.items ?? []) have.add(i);
      relation += g.relation ?? 0;
    }
    changed = true;
  }
}
let placeholderCount = 0;
for (const q of quests.values()) {
  if (done.has(q.id)) continue;
  if (!q.playable) { if (!isAutoLog(q)) placeholderCount++; continue; }
  const why = blockedReason.get(q.id) ?? (reqOk(q.req) ? 'unknown' : `prerequisites never met (${JSON.stringify(q.req)})`);
  err(`${where(q)}: playable but not completable — ${why}`);
}

// ------------------------------------------------------------- 族語 words play can reach (QA H1: X04 needed 10, play gave 9)
{
  const ui = readJson(path.join(C, 'ui.json'));
  const reach = new Set();
  const addG = (g) => (g?.glossary ?? []).forEach((w) => reach.add(w));
  for (const q of quests.values()) {
    if (!q.playable && !isAutoLog(q)) continue;
    for (const s of q.steps) { addG(s.gives); for (const t of s.tasks ?? []) addG(t.gives); }
  }
  // NPC dialogue: legacy nodes, a set's intro node; code-driven nodes (fish_* at the harbour, jimagaod_look)
  const used = new Set(['fish_rayon', 'fish_meyvanwa', 'fish_closed', 'jimagaod_look']);
  for (const n of npcs.values()) if (n.dialogue) { used.add(n.dialogue); const d = dialogues.get(n.dialogue); if (d?.intro) { if (!dialogues.has(d.intro)) err(`dialogue ${d.id}: unknown intro "${d.intro}"`); used.add(d.intro); } }
  for (const id of used) addG(dialogues.get(id)?.unlocks);
  for (const m of Object.values(ui.minigames ?? {})) addG(m.unlocks);
  for (const q of quests.values()) for (const s of q.steps) {
    const c = s.auto?.count === 'words' ? s.auto : s.wait?.count === 'words' ? s.wait : null;
    const min = c?.min ?? (JSON.stringify(s).match(/"count":"words","min":(\d+)/)?.[1] | 0);
    if (q.playable && min > reach.size) err(`${where(q)}: needs ${min} 族語 words, play can reach only ${reach.size} (${[...reach].join(', ')})`);
  }
  if (!args.has('--quiet')) console.log(`族語 words reachable in play: ${reach.size} of ${gloss.size}`);
}

// ------------------------------------------------------------- report
const count = (m) => m.size;
let lines = 0;
for (const q of quests.values()) for (const s of q.steps) { lines += (s.lines ?? []).length + (s.solo?.giveUp ?? []).length; for (const t of s.tasks ?? []) lines += (t.lines ?? []).length; }
let dlgLines = 0;
for (const d of dialogues.values()) for (const b of [d.lines, d.greet, d.duty, ...(d.idle ?? []).map((x) => x.lines), ...Object.values(d.keeper ?? {}), ...Object.values(d.after ?? {})]) dlgLines += (b ?? []).length;
if (!args.has('--quiet')) {
  console.log(`content/: ${count(quests)} quests (${[...quests.values()].filter((q) => q.playable).length} playable, ${placeholderCount} placeholders), ${count(items)} items, ${count(recipes)} recipes, ${count(npcs)} NPCs, ${count(dialogues)} dialogue sets (${dlgLines} lines), ${lines} quest lines, ${count(photoSpots)} photo spots, ${count(nodes)} gather nodes, ${count(outfits)} outfits`);
  console.log(`completable from prerequisites: ${done.size} quests`);
}
if (args.has('--review')) {
  console.log('\nNeeds Tao cultural review:');
  for (const [kind, m] of [['quest', quests], ['item', items], ['recipe', recipes], ['outfit', outfits], ['node', nodes]])
    for (const x of m.values()) if (x.review) console.log(`- ${kind} ${x.id} ${x.name?.zh ?? ''}${Array.isArray(x.review) ? '：' + x.review.join('；') : ''}`);
}
for (const w of warns) console.log('warn:', w);
for (const e of errors) console.log('ERROR:', e);
console.log(errors.length ? `\n${errors.length} error(s)` : '\nOK');
let pendingFail = false;
if (!OVERLAY && fs.existsSync(PENDING_DIR) && !args.has('--no-pending')) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [new URL(import.meta.url).pathname, '--quiet', ...[...args].filter((a) => a !== '--quiet')], { env: { ...process.env, CONTENT_OVERLAY: 'content-pending' }, encoding: 'utf8' });
  const n = fs.readdirSync(PENDING_DIR, { recursive: true }).filter((f) => String(f).endsWith('.json')).length;
  console.log(`\ncontent-pending/ (${n} files, checked with the WORLD_NEEDS places): ${r.status === 0 ? 'OK' : 'FAILED'}`);
  if (r.status !== 0) { pendingFail = true; console.log(r.stdout.split('\n').filter((l) => /ERROR|warn/.test(l)).join('\n')); }
}
process.exit(errors.length || pendingFail ? 1 : 0);
