// Quick smoke: boot, no guide link on the cover / in the journal (0.1.1: the guide is a separate page), start, guide page still loads, 紅頭 = Imorod, no console errors.
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
    { tag: 'mobile', v: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
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
    rep.checks[`${T}-coverGuideLinks`] = await ev(() => document.querySelectorAll('a[href*="guide"]').length);
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, `${T}-cover.png`) });
    rep.checks[`${T}-imorod`] = await ev(() => document.body.innerText.includes('Imorod') && !document.body.innerText.includes('Imowrod'));
    await page.select('#sel-origin-m', 'imorod'); await page.select('#sel-origin-f', 'imorod');
    await page.click('#btn-gender-m');
    await page.click('#origin-go');
    await sleep(1200);
    await ev(() => { const g = window.__TAO_RPG__; for (let i = 0; i < 20 && g.mode() === 'dialogue'; i++) g.advanceDialogue(); g.closeAll(); });
    await page.click('#btn-journal');
    await sleep(900);
    rep.checks[`${T}-journalGuideLinks`] = await ev(() => document.querySelectorAll('a[href*="guide"]').length);
    await page.screenshot({ path: path.join(OUT, `${T}-journal.png`) });
    // QA M5: every 手札 tab is visible inside the notebook and clear of the ✕ (390 px phones wrap them to 2 rows)
    rep.checks[`${T}-tabsVisible`] = await ev(() => {
      const nb = document.getElementById('journal').getBoundingClientRect();
      const x = document.getElementById('journal-close').getBoundingClientRect();
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const tabs = [...document.querySelectorAll('#journal-tabs button')].map((b) => ({ t: b.textContent, r: b.getBoundingClientRect() }));
      const bad = tabs.filter(({ r }) => r.width === 0 || r.left < nb.left - 60 || r.right > nb.right + 60 || r.right > window.innerWidth || hit(r, x)).map((b) => b.t);
      return bad.length ? bad : true;
    });
    // QA M3 / M4: the 族語 tab shows Traditional Chinese only (no English categories, no developer notes)
    await page.click('#journal-tabs [data-tab="glossary"]');
    await sleep(500);
    rep.checks[`${T}-glossaryZhOnly`] = await ev(() => { const t = document.getElementById('journal').innerText; return !/｜(phrase|nature|food)|Phase [A-Z]/.test(t) || t.slice(0, 300); });
    await page.screenshot({ path: path.join(OUT, `${T}-journal-glossary.png`) });
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
    && ['desktop', 'mobile'].every((t) => c[`${t}-coverGuideLinks`] === 0 && c[`${t}-journalGuideLinks`] === 0 && c[`${t}-imorod`] && c[`${t}-tabsVisible`] === true && c[`${t}-glossaryZhOnly`] === true);
  fs.writeFileSync(path.join(OUT, 'report-smoke.json'), JSON.stringify(rep, null, 2));
  console.log(JSON.stringify(rep, null, 1));
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
