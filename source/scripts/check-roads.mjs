#!/usr/bin/env node
/**
 * Road network / reachability check (0.1.1). Bundles scripts/dev/road-audit.ts (which imports the
 * real src/world height, layout, collision and places code) with esbuild and runs it on the real
 * content/ (src/content/loader.ts via scripts/dev/content-node.ts). Exit 1 on any failure.
 *   node scripts/check-roads.mjs [--png out.png]
 */
import { build } from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const out = path.join(os.tmpdir(), `road-audit-${process.pid}.mjs`);
await build({ entryPoints: ['scripts/dev/road-audit.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: { '.json': 'json' } });
const { runAudit, ROAD_CLEAR } = await import(pathToFileURL(out).href);
const pi = process.argv.indexOf('--png');
const t0 = Date.now();
const r = runAudit({ png: pi > 0 ? process.argv[pi + 1] : undefined });
const f = (n) => n.toFixed(1);
console.log(`spawn (${f(r.spawn.x)}, ${f(r.spawn.z)})  walkable cells ${r.walkable}, reached from spawn ${r.reached}  targets ${r.targets}  (${Date.now() - t0} ms)`);
let fails = 0;
for (const t of r.unreachable) { fails++; console.log(`UNREACHABLE ${t.id} at (${f(t.x)}, ${f(t.z)}) r=${t.r}`); }
for (const b of r.roadBlocks) { fails++; console.log(`ON ROAD ${b.what} at (${f(b.x)}, ${f(b.z)}) clearance ${b.clear.toFixed(2)} m < ${ROAD_CLEAR}`); }
for (const l of r.layout) { fails++; console.log(l); }
const strand = new Map();
for (const s of r.strandings) { const k = `${Math.round(s.x / 4) * 4},${Math.round(s.z / 4) * 4}`; if (!strand.has(k)) strand.set(k, s); }
for (const [k, s] of strand) { fails++; console.log(`STRANDED old save spot near (${k}) → safe stand (${f(s.to.x)}, ${f(s.to.z)}) is cut off`); }
if (r.dropped.length) console.log(`note: no clear lot, left out: ${r.dropped.join(', ')}`);
console.log(`save relocation: ${r.relocSamples} spots a 0.1.0 player could stand on, ${r.strandings.length} stranded`);
const gaps = new Map();
for (const g of r.roadGaps) { const k = `${Math.round(g.x / 2) * 2},${Math.round(g.z / 2) * 2} ${g.why}`; gaps.set(k, (gaps.get(k) ?? 0) + 1); }
for (const [k, n] of gaps) { fails++; console.log(`ROAD GAP near (${k}) ×${n}`); }
const floraHits = r.floraHits ?? [];
const floraCleared = r.floraCleared ?? [];
const by = new Map();
for (const h of floraCleared) by.set(h.id, (by.get(h.id) ?? 0) + 1);
const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => `${id} ×${n}`).join(', ');
console.log(`flora: cleared ${floraCleared.length} plants from buildings${top ? ` (e.g. ${top})` : ''}, ${floraHits.length} remaining`);
const cb = r.coverBefore ?? {}, ca = r.coverAfter ?? {};
const pc = (v) => `${Math.round((v ?? 0) * 100)}%`;
const worst = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, v]) => `${id} ${pc(v)}`).join(', ');
console.log(`building view from the default camera (share hidden by plants): before worst ${worst(cb)}; after worst ${worst(ca)}`);
console.log(`weather station hidden: before ${pc(cb.weather_station)}, after ${pc(ca.weather_station)}; buildings over 25% hidden: before ${Object.values(cb).filter((v) => v > 0.25).length}, after ${Object.values(ca).filter((v) => v > 0.25).length} of ${Object.keys(ca).length}`);
const pi2 = r.pathInfo;
console.log(`footpaths: ${pi2.paths} paths for ${pi2.buildings} buildings (${pi2.questBuildings} quest / NPC spots at a building), ${pi2.metres} m in all, steepest step ${pi2.steepest}, tightest gap to another building ${pi2.tightest} m`);
for (const m of r.pathIssues) { fails++; console.log(m); }
for (const h of floraHits) { fails++; console.log(`PLANTS HIDE BUILDING ${h.id} at (${f(h.x)}, ${f(h.z)}): ${pc(h.cover)} hidden from the default camera`); }
console.log(fails ? `FAIL: ${fails} problem(s)` : 'OK: road network connected, all targets reachable, corridors clear, every building has a clear footpath');
process.exit(fails ? 1 : 0);
