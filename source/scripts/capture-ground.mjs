// Close-zoom ground crispness (before / after). Writes $OUT/ground/{tag}-{label}-{spot}.png
// Usage: LABEL=before OUT=screenshots-phase1 node scripts/capture-ground.mjs
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-phase1', 'ground');
const LABEL = process.env.LABEL || 'after';
fs.mkdirSync(OUT, { recursive: true });
// open ground of each kind: grassland, beach sand, village path, basalt slope
const SPOTS = (process.env.SPOTS || 'grass:-31:29.5,sand:-31:-2,village:-12:-30,slope:2:9')
  .split(',').map((t) => { const [n, x, z] = t.split(':'); return [n, Number(x), Number(z)]; });
const ONLY = process.env.ONLY || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8831) });
const report = { errors: [], http4xx: [], fps: {} };
let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1440, height: 900, deviceScaleFactor: 1 } },
    { tag: 'mobile', v: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  ].filter((v) => !ONLY || v.tag === ONLY)) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) report.http4xx.push(`${r.status()} ${r.url()}`); });
    await page.setViewport(vp.v);
    await page.goto(debugUrl(srv.base) + (LABEL === 'before' ? '&groundfx=0' : ''), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 200 });
    const ev = (fn, a) => page.evaluate(fn, a);
    await ev(() => { const g = window.__TAO_RPG__; g.clearSave?.(); g.selectOrigin('ivalino', 'f'); g.closeAll(); g.setTime('day'); });
    await sleep(3000);
    await ev(() => window.__TAO_RPG__.closeAll());
    for (const [spot, x, z] of SPOTS) {
      await ev(({ x, z }) => { const g = window.__TAO_RPG__; g.closeAll(); g.teleport(x, z); g.gatherParty?.(); g.zoomTo(1); }, { x, z });
      await sleep(1200);
      await ev(() => window.__TAO_RPG__.zoomTo(1));
      await sleep(2400);
      const f = path.join(OUT, `${vp.tag}-${LABEL}-${spot}.png`);
      await page.screenshot({ path: f });
      console.log('captured', f);
    }
    await page.close();
  }
  report.ok = report.errors.length === 0 && report.http4xx.length === 0;
  fs.writeFileSync(path.join(OUT, `report-${LABEL}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
