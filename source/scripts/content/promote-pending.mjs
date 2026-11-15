// Move content that waits for world places (content-pending/) into content/ once its places exist.
// node scripts/content/promote-pending.mjs [--dry]
// An entry moves when every place it uses exists in content/places.json (places, derived ids, landmarks) and every
// quest in its prerequisites is either playable in content/ or moves in the same run. It replaces the entry with the
// same id in the same file under content/. What can't move yet stays in content-pending/. Then run validate-content.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const C = path.join(ROOT, 'content'), PEND = path.join(ROOT, 'content-pending');
const dry = process.argv.includes('--dry');
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const wr = (p, j) => fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
if (!fs.existsSync(PEND)) { console.log('nothing pending'); process.exit(0); }
const pf = rd(path.join(C, 'places.json'));
const PLACES = new Set([...Object.keys(pf.places ?? {}), ...(pf.derived?.ids ?? []), ...(pf.landmarks ?? []),
  ...Object.entries(pf.proposed?.places ?? {}).filter(([, p]) => typeof p.x === 'number').map(([k]) => k)]);
const KEY = { quests: 'quests', photoSpots: 'photoSpots', gatherNodes: 'gatherNodes', npcs: 'npcs' };
const files = fs.readdirSync(PEND, { recursive: true }).map(String).filter((f) => f.endsWith('.json'));
const placeRefs = (e) => {
  const out = [];
  const add = (v) => v && out.push(v);
  add(e.place); add(e.landmark); add(e.home);
  for (const s of e.steps ?? []) { add(s.spot); add(s.meet); Object.values(s.split ?? {}).forEach((t) => add(t.at)); if (s.solo) { add(s.solo.at); add(s.solo.waitAt); } (s.tasks ?? []).forEach((t) => add(t.spot)); }
  return out;
};
const reqIds = (r, out = []) => { if (!r) return out; if (typeof r === 'string') out.push(r); else for (const k of ['all', 'any']) (r[k] ?? []).forEach((x) => reqIds(x, out)); return out; };
// live playable quests
const live = new Set();
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.json')) for (const q of rd(p).quests ?? []) if (q.playable) live.add(q.id); } };
walk(path.join(C, 'quests'));
const entries = [];
for (const rel of files) { const key = KEY[rel.split(path.sep)[0]]; for (const e of rd(path.join(PEND, rel))[key] ?? []) entries.push({ rel, key, e }); }
let ok = new Set(entries.filter((x) => placeRefs(x.e).every((p) => PLACES.has(p))).map((x) => x));
// prerequisites: drop until stable
for (let ch = true; ch;) {
  ch = false;
  const moving = new Set([...ok].filter((x) => x.key === 'quests').map((x) => x.e.id));
  for (const x of [...ok]) if (x.key === 'quests' && reqIds(x.e.req).some((d) => !live.has(d) && !moving.has(d))) { ok.delete(x); ch = true; }
}
// a photo spot moves with its quest
const movingQ = new Set([...ok].filter((x) => x.key === 'quests').map((x) => x.e.id));
for (const x of [...ok]) if (x.key === 'photoSpots' && x.e.quest && !movingQ.has(x.e.quest) && !live.has(x.e.quest)) ok.delete(x);
const stay = entries.filter((x) => !ok.has(x));
console.log(`move ${ok.size}: ${[...ok].map((x) => x.e.id).join(' ') || '-'}`);
console.log(`stay ${stay.length}: ${stay.map((x) => `${x.e.id}(${placeRefs(x.e).filter((p) => !PLACES.has(p)).join(',') || 'prereq'})`).join(' ') || '-'}`);
if (dry) process.exit(0);
for (const rel of files) {
  const key = KEY[rel.split(path.sep)[0]];
  const target = path.join(C, rel);
  const j = rd(target);
  for (const x of ok) if (x.rel === rel) { const i = j[key].findIndex((y) => y.id === x.e.id); if (i >= 0) j[key][i] = x.e; else j[key].push(x.e); }
  wr(target, j);
  const left = stay.filter((x) => x.rel === rel).map((x) => x.e);
  if (left.length) wr(path.join(PEND, rel), { [key]: left }); else fs.rmSync(path.join(PEND, rel));
}
for (const d of fs.readdirSync(PEND)) { const p = path.join(PEND, d); if (fs.statSync(p).isDirectory() && !fs.readdirSync(p).length) fs.rmdirSync(p); }
if (!fs.readdirSync(PEND).length) fs.rmdirSync(PEND);
console.log('done. Now run: node scripts/validate-content.mjs && node scripts/check-roads.mjs');
