// 0.1.5 map phase screenshots (desktop + iPhone), for the build before the map phase and the new one.
//   TAG=before DIST=/workspace/tao0141-logs/dist-pre-map node scripts/capture-map.mjs
//   TAG=after node scripts/capture-map.mjs        (dist/)
//   UI=en TAG=en node scripts/capture-map.mjs      (English interface)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-map');
const TAG = process.env.TAG || 'after';
const DIST = path.resolve(process.env.DIST || 'dist');
const PORT = Number(process.env.PORT || 8883);
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const info = {};

const srv = await startStaticServer({ root: DIST, port: PORT });
let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1280, height: 800, deviceScaleFactor: 1 } },
    { tag: 'iphone', v: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { tag: 'iphone-land', v: { width: 852, height: 393, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ]) {
    if (process.env.VP && !process.env.VP.split(',').includes(vp.tag)) continue;
    const page = await browser.newPage();
    await page.setViewport(vp.v);
    page.on('pageerror', (e) => console.log('pageerror', vp.tag, String(e).slice(0, 300)));
    const ev = (fn, a) => page.evaluate(fn, a);
    const want = (name) => !ONLY || ONLY.has(name);
    const shot = async (name, wait = 900) => {
      await sleep(wait);
      const file = path.join(OUT, `${vp.tag}-${name}-${TAG}.png`);
      await page.screenshot({ path: file });
      console.log('captured', path.relative(process.cwd(), file));
    };
    await page.goto(debugUrl(srv.base, process.env.UI ? `ui=${process.env.UI}` : ''), { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 300000, polling: 250 });
    await ev(() => { const g = window.__TAO_RPG__; g.clearSave?.(); g.selectOrigin('ivalino', 'm', 'boat', 'iraraley'); });
    await page.waitForFunction(() => window.__TAO_RPG__?.state?.started, { timeout: 300000, polling: 250 }).catch(() => {});
    await sleep(1500);
    await ev(() => { const g = window.__TAO_RPG__; g.arrival?.().playing && g.skipArrival?.(); for (let i = 0; i < 80 && g.mode() === 'dialogue'; i++) g.advanceDialogue(); g.closeAll(); });
    await sleep(800);
    await ev(() => { const g = window.__TAO_RPG__; for (let i = 0; i < 80 && g.mode() === 'dialogue'; i++) g.advanceDialogue(); g.closeAll(); });
    const P = await ev(() => { const g = window.__TAO_RPG__; const o = {}; for (const [k, p] of Object.entries(g.places)) o[k] = { x: p.x, z: p.z }; return o; });
    const tribes = ['yayo', 'iraraley', 'iranmeylek', 'ivalino', 'imorod', 'iratay'];
    const cx = tribes.reduce((s, t) => s + P[t].x, 0) / 6, cz = tribes.reduce((s, t) => s + P[t].z, 0) / 6;
    const span = Math.max(...tribes.map((t) => Math.hypot(P[t].x - cx, P[t].z - cz)));
    info[`${vp.tag}-span`] = span;
    const look = async (name, o, wait = 2600) => {
      if (!want(name)) return;
      await ev((o) => {
        const g = window.__TAO_RPG__;
        g.closeAll();
        const st = o.stand ? (g.roadPointNear(o.stand.x, o.stand.z, 12) || o.stand) : null;
        if (st) { g.teleport(st.x, st.z); g.gatherParty?.(); }
        g.setCamera({ x: o.x, z: o.z, yaw: o.yaw, pitch: o.pitch, dist: o.dist, snap: true });
      }, o);
      await shot(name, wait);
    };
    // the terrain box (0.1.4 builds have no mapInfo: their fixed box) and the road lines
    const M = await ev(() => window.__TAO_RPG__.mapInfo?.() ?? { box: { xMin: -72, zMin: -62, xMax: 66, zMax: 84 }, roads: [] });
    const isl = { x: (M.box.xMin + M.box.xMax) / 2, z: (M.box.zMin + M.box.zMax) / 2 - 8 * ((M.box.xMax - M.box.xMin) / 138) };
    const half = (M.box.xMax - M.box.xMin) / 2;
    info[`${vp.tag}-box`] = M.box;
    if (vp.tag === 'desktop') {
      // the same camera distance in both builds (the bigger island fills more of the frame) …
      await look('island', { x: cx, z: cz + 4, yaw: 0, pitch: 1.2, dist: 137, stand: P.harbor }, 4500);
      // … and the whole island framed in each build
      await look('island-whole', { x: isl.x, z: isl.z, yaw: 0, pitch: 1.25, dist: half * 2.05, stand: P.harbor }, 4500);
      await look('village-ivalino', { x: P.ivalino.x, z: P.ivalino.z, yaw: 1.9, pitch: 0.62, dist: 30, stand: P.ivalino });
      await look('village-iraraley', { x: P.iraraley.x, z: P.iraraley.z, yaw: 3.4, pitch: 0.62, dist: 30, stand: P.iraraley });
      await look('village-imorod', { x: P.imorod.x, z: P.imorod.z, yaw: 0.2, pitch: 0.62, dist: 30, stand: P.imorod });
      // 中橫公路 (only in the new build; the old one shows the same ground between 紅頭 and 野銀)
      const cr = M.roads[2];
      let mx = (P.imorod.x + P.ivalino.x) / 2, mz = (P.imorod.z + P.ivalino.z) / 2, dd = 60;
      if (cr && cr.length) {
        const xs = cr.map((p) => p.x), zs = cr.map((p) => p.z);
        mx = (Math.min(...xs) + Math.max(...xs)) / 2; mz = (Math.min(...zs) + Math.max(...zs)) / 2;
        dd = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * 1.45;
      }
      await look('cross-road', { x: mx, z: mz, yaw: 0.35, pitch: 1.05, dist: dd, stand: P.imorod }, 3500);
      if (cr && cr.length) {
        const top = cr[Math.floor(cr.length * 0.55)];
        await look('cross-road-close', { x: top.x, z: top.z, yaw: 0.9, pitch: 0.62, dist: 24, stand: top }, 3000);
      }
      const shop = P.yayo_shop;
      await look('quest-path-shop', { x: shop.x, z: shop.z, yaw: 1.2, pitch: 0.8, dist: 20, stand: shop });
      const cl = P.clinic;
      await look('quest-path-clinic', { x: cl.x, z: cl.z, yaw: 0.4, pitch: 0.8, dist: 22, stand: cl });
    }
    if (want('travel')) {
      await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); g.resetView(); });
      await sleep(600);
      await page.evaluate(() => document.querySelector('#btn-travel')?.click());
      await shot('travel', 1600);
      // tap a pin: the sheet closes and the player is at that village
      const pins = await ev(() => [...document.querySelectorAll('.travel-pin')].map((b) => b.dataset.id));
      if (pins.length) {
        const el = await page.$('.travel-pin[data-id="iranmeylek"] .lab');
        if (vp.v.hasTouch) await el.tap(); else await el.click();
        await sleep(800);
        const pos = await ev(() => ({ p: window.__TAO_RPG__.playerPos(), open: document.querySelector('#travel-sheet').style.display, place: (() => { const P = window.__TAO_RPG__.places; const o = typeof P === "function" ? P() : P; return o?.iranmeylek ?? null; })() }));
        info[`${vp.tag}-travel-tap`] = { pins, ...pos };
        console.log('travel tap', vp.tag, JSON.stringify(info[`${vp.tag}-travel-tap`]).slice(0, 300));
      }
      await ev(() => window.__TAO_RPG__.closeAll());
    }
    await page.close();
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
fs.writeFileSync(path.join(OUT, `info-${TAG}.json`), JSON.stringify(info, null, 2));
process.exit(0);
