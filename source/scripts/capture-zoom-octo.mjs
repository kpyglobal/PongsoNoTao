// Camera zoom limits (min / default / max, reset → default) + overlap see-through shot.
// Writes screenshots-octo/zoom/*.png and screenshots-octo/tint/after2-01-overlap-fade.png
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-octo');
fs.mkdirSync(path.join(OUT, 'zoom'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'tint'), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8820) });
const report = { errors: [], http4xx: [], checks: {} };
let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1440, height: 900, deviceScaleFactor: 1 } },
    { tag: 'mobile', v: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  ]) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) report.http4xx.push(`${r.status()} ${r.url()}`); });
    await page.setViewport(vp.v);
    await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 200 });
    const ev = (fn, a) => page.evaluate(fn, a);
    const T = vp.tag;
    const shot = async (name, wait = 2600) => { await sleep(wait); await page.screenshot({ path: path.join(OUT, name) }); console.log('captured', name); };
    await ev(() => { const g = window.__TAO_RPG__; g.selectOrigin('ivalino', 'f'); g.closeAll(); g.setTime('day'); });
    report.checks[`${T}-startCam`] = await ev(() => window.__TAO_RPG__.cam());
    await ev(() => window.__TAO_RPG__.zoomTo(1));
    report.checks[`${T}-min`] = await ev(() => ({ ...window.__TAO_RPG__.camLimits(), dist: window.__TAO_RPG__.cam().dist }));
    await shot(`zoom/${T}-zoom-1-min.png`);
    await ev(() => window.__TAO_RPG__.zoomTo(999));
    report.checks[`${T}-max`] = await ev(() => ({ ...window.__TAO_RPG__.camLimits(), dist: window.__TAO_RPG__.cam().dist }));
    await shot(`zoom/${T}-zoom-3-max.png`);
    // reset button → new default
    await page.click('#btn-cam-toggle').catch(() => {});
    await sleep(300);
    const resetVisible = await ev(() => { const b = document.getElementById('cam-reset'); return !!b && b.offsetParent !== null; });
    if (resetVisible) await page.click('#cam-reset'); else await ev(() => window.__TAO_RPG__.resetView());
    report.checks[`${T}-reset`] = await ev(() => ({ ...window.__TAO_RPG__.camLimits(), dist: window.__TAO_RPG__.cam().dist }));
    report.checks[`${T}-resetViaButton`] = resetVisible;
    await shot(`zoom/${T}-zoom-2-default.png`);
    if (T === 'desktop') {
      await ev(() => {
        const g = window.__TAO_RPG__;
        g.stageCast(-36.6, -5.2, -1.4, ['clinic_nurse', '@player', 'harbor_staff', 'tourist_a']);
        g.setCamera({ yaw: -1.4, pitch: 0.3, dist: 5.5, x: -36.6, z: -5.2, snap: true });
      });
      await shot('tint/after2-02-overlap-fade.png', 3000);
      report.checks.overlap = await ev(() => window.__TAO_RPG__.tints().filter((t) => ['@player', 'clinic_nurse', 'harbor_staff', 'tourist_a'].includes(t.id)));
    }
    await page.close();
  }
  const c = report.checks;
  report.ok = report.errors.length === 0 && report.http4xx.length === 0 && ['desktop', 'mobile'].every((t) =>
    Math.abs(c[`${t}-startCam`].dist - c[`${t}-reset`].def) < 0.01 && c[`${t}-min`].dist === c[`${t}-min`].min
    && c[`${t}-max`].dist === c[`${t}-max`].max && Math.abs(c[`${t}-reset`].dist - c[`${t}-reset`].def) < 0.01);
  fs.writeFileSync(path.join(OUT, 'zoom', 'report-zoom.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
