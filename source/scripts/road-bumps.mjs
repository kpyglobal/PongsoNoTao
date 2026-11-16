#!/usr/bin/env node
/**
 * Measure how bumpy the 環島公路 is (height along the road centreline).
 *   node scripts/road-bumps.mjs [out.json]
 */
import { build } from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const out = path.join(os.tmpdir(), `road-bumps-${process.pid}.mjs`);
await build({ entryPoints: ['scripts/dev/road-bumps.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: { '.json': 'json' } });
// the measurement prints its JSON report when imported; the bundled world code leaves timers alive, so exit explicitly
let json = '';
const log = console.log;
console.log = (s) => { json += s; };
await import(pathToFileURL(out).href);
console.log = log;
fs.rmSync(out, { force: true });
if (process.argv[2]) fs.writeFileSync(process.argv[2], json + '\n');
log(json);
process.exit(0);
