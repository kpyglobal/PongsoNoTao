#!/usr/bin/env node
/**
 * Simulate NPC wandering and fail if anyone ends up inside a building or stuck.
 *   node scripts/check-npcs.mjs
 */
import { build } from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const out = path.join(os.tmpdir(), `npc-audit-${process.pid}.mjs`);
await build({ entryPoints: ['scripts/dev/npc-audit.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: { '.json': 'json' } });
const { runNpcAudit } = await import(pathToFileURL(out).href);
const t0 = Date.now();
const r = runNpcAudit();
const f = (n) => n.toFixed(1);
console.log(`npcs ${r.actors}  simulated ${r.seconds}s × ${r.periods.join(', ')}  (${Date.now() - t0} ms)`);
console.log(`longest walk to one spot ${f(r.longestLeg.seconds)} s (${r.longestLeg.id}); farthest from its nearest spot ${f(r.farthest.d)} m (${r.farthest.id})`);
let fails = 0;
for (const x of r.faults) {
  fails++;
  console.log(`NPC ${x.why}: ${x.id} at (${f(x.x)}, ${f(x.z)})`);
}
console.log(fails ? `FAIL: ${fails} problem(s)` : 'OK: NPCs stayed on walkable ground and did not get stuck');
process.exit(fails ? 1 : 0);
