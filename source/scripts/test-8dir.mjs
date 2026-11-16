#!/usr/bin/env node
/**
 * 0.1.4: 8-direction facing for the four playable characters (node part: rows, mapping, no mirroring,
 * the sheet files; browser part: the player really walks in all 8 directions with the 8dir sheets).
 *   node scripts/test-8dir.mjs            (needs a built dist/ for the browser part; --no-browser skips it)
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const out = path.join(os.tmpdir(), `dir8-${process.pid}.mjs`);
await build({ entryPoints: ['scripts/dev/dir8-check.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: { '.json': 'json' } });
const { runDir8 } = await import(pathToFileURL(out).href);
const r = runDir8();
const fails = [...r.fails];
for (const l of r.lines) console.log(l);
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };

// sheet files: every 8dir sheet is the base sheet's width and twice its height (PNG header)
const dims = (f) => { const b = fs.readFileSync(f); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };
const D = 'public/assets/sprites/characters';
for (const k of ['player', 'player_f', 'player_visitor', 'player_visitor_f', 'player_trad', 'player_f_trad', 'player_visitor_acc', 'player_visitor_f_acc']) {
  for (const pre of ['', 'ride_', 'canoe_', 'canoe_modern_']) {
    const b = `${D}/${pre}${k}_sheet.png`, e = `${D}/${pre}${k}_8dir_sheet.png`;
    if (!fs.existsSync(b)) { if (pre === '') ok(false, `${b} missing`); continue; }
    if (!fs.existsSync(e)) { ok(false, `${e} missing`); continue; }
    const B = dims(b), E = dims(e);
    ok(E.width === B.width && E.height === B.height * 2, `${pre}${k}: 8dir sheet ${E.width}×${E.height} = base + diagonal rows`);
  }
}

if (!process.argv.includes('--no-browser')) {
  const { startStaticServer, launchBrowser, debugUrl } = await import('./lib/harness.mjs');
  const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8851) });
  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 640, height: 400 });
    await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    const ev = (fn, a) => page.evaluate(fn, a);
    await ev(() => window.__TAO_RPG__.clearSave());
    await page.select('#sel-origin-m', 'yayo'); await page.select('#sel-origin-f', 'yayo');
    await page.click('#btn-gender-m');
    await page.click('#origin-go');
    await new Promise((res) => setTimeout(res, 2500));
    await ev(() => { const g = window.__TAO_RPG__; for (let i = 0; i < 30 && g.mode() === 'dialogue'; i++) g.advanceDialogue(); g.closeAll(); });
    const f0 = await ev(() => window.__TAO_RPG__.facing());
    ok(f0.eight && f0.rows === 16, `player walk sheet is 8-way (${f0.rows} rows)`);
    // keyboard: the 4 arrows and the 4 diagonals (two keys together)
    const combos = [['KeyS', 's'], ['KeyS+KeyD', 'se'], ['KeyD', 'e'], ['KeyW+KeyD', 'ne'], ['KeyW', 'n'], ['KeyW+KeyA', 'nw'], ['KeyA', 'w'], ['KeyS+KeyA', 'sw']];
    for (const [keys, want] of combos) {
      const ks = keys.split('+');
      for (const k of ks) await page.keyboard.down(k);
      // swiftshader can run at a few frames a second: hold the keys until the facing settles (≤ 8 s)
      let f = null;
      for (let t = 0; t < 40; t++) {
        await new Promise((res) => setTimeout(res, 200));
        f = await ev(() => window.__TAO_RPG__.facing());
        if (f.dir === want) break;
      }
      for (const k of ks) await page.keyboard.up(k);
      ok(f.dir === want, `keys ${keys} → facing ${f.dir} (want ${want})`);
      await new Promise((res) => setTimeout(res, 150));
    }
    // a party member in Tao clothing keeps 8 ways; the 族女's canoe is the modern hull, 8-way
    await ev(() => window.__TAO_RPG__.switchMember('f'));
    await new Promise((res) => setTimeout(res, 400));
    const ff = await ev(() => window.__TAO_RPG__.facing());
    ok(ff.eight, '族女 walk sheet is 8-way');
    await ev(() => window.__TAO_RPG__.setCanoe(true));
    const cl = await ev(() => window.__TAO_RPG__.canoeLook());
    ok(cl.modern && cl.eight && cl.rows === 8, `族女 paddles a modern canoe, 8-way (${JSON.stringify(cl)})`);
    await ev(() => window.__TAO_RPG__.setCanoe(false));
  } finally {
    await browser?.close();
    await srv.close();
  }
}
console.log(fails.length ? `FAIL: ${fails.length}` : 'OK: 8-direction facing');
process.exit(fails.length ? 1 : 0);
