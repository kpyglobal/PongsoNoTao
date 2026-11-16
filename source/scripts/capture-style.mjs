// Watercolor-ink style: before / after shots (original vs watercolor) + frame-time probe, desktop and mobile.
// node scripts/capture-style.mjs   (local static server for the test only) → screenshots-style/*.png + perf-style.json
// Frame times come from headless Chrome (SwiftShader = CPU rendering), so compare the two styles on the same box;
// they are a proxy for fill-rate cost, not phone numbers.
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-style');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8871) });
const errors = [], http4xx = [], perf = {};
const SC = { harbor: ['harbor', 'harbor', 20, 20], yayo: ['yayo', 'yayo', 20, 14], 'yayo-close': ['yayo-close', 'yayo', 9, 14] };
const ONLY = (process.env.ONLY || 'desktop,mobile').split(',');
const VIEWS = [
  { tag: 'desktop', v: { width: 1440, height: 900, deviceScaleFactor: 1 } },
  { tag: 'mobile', v: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
].filter((x) => ONLY.includes(x.tag));
const b = await launchBrowser();
try {
  for (const { tag, v } of VIEWS) {
    const page = await b.newPage();
    page.on('pageerror', (e) => errors.push(`${tag}: ${e}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400) http4xx.push(`${r.status()} ${r.url()}`); });
    page.on('dialog', (d) => d.accept());
    await page.setViewport(v);
    const ev = (fn, a) => page.evaluate(fn, a);
    const boot = async () => {
      await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    };
    await boot();
    await ev(() => window.__TAO_RPG__.clearSave());
    await boot();
    await page.waitForSelector('#sel-origin-m', { visible: true, timeout: 30000 });
    await page.select('#sel-origin-m', 'ivalino'); await page.select('#sel-origin-f', 'ivalino');
    await page.click('#btn-gender-m');
    await page.click('#origin-go');
    await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
    for (let i = 0; i < 40 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(100); }
    await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); g.setTime('day'); const t = document.getElementById('unlock-toast'); if (t) t.style.visibility = 'hidden'; });
    const frameMs = async (n = 12) => ev(async (n) => {
      const ts = []; let last = performance.now();
      for (let i = 0; i < n; i++) { await new Promise((r) => requestAnimationFrame(r)); const t = performance.now(); ts.push(t - last); last = t; }
      ts.sort((a, b) => a - b);
      return { median: +ts[ts.length >> 1].toFixed(1), p90: +ts[Math.floor(ts.length * 0.9)].toFixed(1), paintPassCpu: +(window.__TAO_STYLE__?.pass?.cpuMs ?? 0).toFixed(2) };
    }, n);
    const scenes = tag === 'desktop'
      ? (process.env.SCENES || 'harbor,yayo,yayo-close').split(',').map((k) => SC[k])
      : (process.env.SCENES || 'harbor').split(',').map((k) => SC[k]);
    perf[tag] = {};
    for (const [name, place, dist, near] of scenes) {
      await ev(({ place, dist, near }) => {
        const g = window.__TAO_RPG__; g.closeAll();
        const p = g.places[place]; const q = g.roadPointNear(p.x, p.z, near) || p;
        g.teleport(q.x, q.z); g.gatherParty(); g.setCamera({ dist, snap: true });
      }, { place, dist, near });
      await sleep(3000);
      perf[tag][name] = {};
      for (const style of ['original', 'watercolor']) {
        await ev((s) => window.__TAO_STYLE__.set(s), style);
        await sleep(1500);
        await page.screenshot({ path: path.join(OUT, `${tag}-${name}-${style}.png`) });
        perf[tag][name][style] = await frameMs();
        console.log(tag, name, style, JSON.stringify(perf[tag][name][style]));
      }
    }
    await page.close();
  }
} finally {
  await b.close();
  await srv.close?.();
}
fs.writeFileSync(path.join(OUT, 'perf-style.json'), JSON.stringify({ perf, errors, http4xx }, null, 2));
console.log(errors.length ? `errors ${errors.length}: ${errors.slice(0, 3).join(' | ')}` : '0 console errors', http4xx.length ? `4xx ${http4xx.length}` : '0 4xx');
