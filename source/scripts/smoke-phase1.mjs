// Quick smoke: boot, cover guide link, start, journal guide link, guide page loads, 紅頭 = Imorod, no console errors.
// (Playwright is not installed on the box; uses the project's puppeteer-core harness.)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-phase1', 'smoke');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8832) });
const rep = { errors: [], http4xx: [], checks: {} };
let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1440, height: 900, deviceScaleFactor: 1 } },
    { tag: 'mobile', v: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  ]) {
    const T = vp.tag;
    const page = await browser.newPage();
    page.on('pageerror', (e) => rep.errors.push(`${T} ${e}`));
    page.on('console', (m) => { if (m.type() === 'error') rep.errors.push(`${T} ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400) rep.http4xx.push(`${r.status()} ${r.url()}`); });
    await page.setViewport(vp.v);
    await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    const ev = (fn, a) => page.evaluate(fn, a);
    await ev(() => window.__TAO_RPG__.clearSave());
    rep.checks[`${T}-coverGuide`] = await ev(() => { const a = document.getElementById('cover-guide'); return a && a.offsetParent !== null ? { href: a.getAttribute('href'), target: a.target } : null; });
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, `${T}-cover-guide-link.png`) });
    rep.checks[`${T}-imorod`] = await ev(() => document.body.innerText.includes('Imorod') && !document.body.innerText.includes('Imowrod'));
    await page.click('#btn-origin-imorod');
    await page.click('#btn-gender-m');
    await page.click('#origin-go');
    await sleep(1200);
    await ev(() => { const g = window.__TAO_RPG__; for (let i = 0; i < 20 && g.mode() === 'dialogue'; i++) g.advanceDialogue(); g.closeAll(); });
    await page.click('#btn-journal');
    await sleep(900);
    rep.checks[`${T}-journalGuide`] = await ev(() => { const a = document.getElementById('journal-guide'); return a && a.offsetParent !== null ? { href: a.getAttribute('href'), target: a.target } : null; });
    await page.screenshot({ path: path.join(OUT, `${T}-journal-guide-link.png`) });
    rep.checks[`${T}-party`] = await ev(() => window.__TAO_RPG__.party().controlled);
    await page.close();
  }
  const g = await browser.newPage();
  g.on('pageerror', (e) => rep.errors.push(`guide ${e}`));
  const res = await g.goto(new URL("guide.html", srv.base).href, { waitUntil: 'load', timeout: 60000 });
  rep.checks.guideStatus = res.status();
  await g.close();
  const c = rep.checks;
  rep.ok = rep.errors.length === 0 && rep.http4xx.length === 0 && c.guideStatus === 200
    && ['desktop', 'mobile'].every((t) => c[`${t}-coverGuide`]?.target === '_blank' && c[`${t}-journalGuide`]?.target === '_blank' && c[`${t}-imorod`]);
  fs.writeFileSync(path.join(OUT, 'report-smoke.json'), JSON.stringify(rep, null, 2));
  console.log(JSON.stringify(rep, null, 1));
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
