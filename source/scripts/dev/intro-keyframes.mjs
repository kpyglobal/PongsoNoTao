// 0.1.5 dev: keyframes of the 2.5D arrival intro for both routes (no assertions, see scripts/test-intro.mjs).
//   OUT=screenshots-015-intro VP=desktop,iphone,iphone-land WAY=plane,boat NB=1 node scripts/dev/intro-keyframes.mjs
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from '../lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-015-intro');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VPS = {
  desktop: { width: 1280, height: 800, deviceScaleFactor: 1 },
  iphone: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'iphone-land': { width: 852, height: 393, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const KEYS = {
  plane: [['01-reveal', 0.7, null], ['02-window-hold', 4, null], ['03-out-window', 4, 1.3], ['04-island-turn', 4, 3.0], ['05-plane-from-behind', 4, 3.6], ['06-plane-rear', 4, 5.2], ['07-plane-bank', 4, 7.0], ['08-plane-descend', 4, 9.4], ['09-fade', 4, 10.95]],
  boat: [['01-dissolve', 0.45, null], ['02-bow-hold', 4, null], ['03-cut-rear', 4, 0.8], ['04-drive', 4, 2.4], ['05-island-turn', 4, 4.5], ['06-shrink', 4, 6.8], ['07-near-island', 4, 8.8], ['08-fade', 4, 9.45]],
};
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8874) });
const browser = await launchBrowser();
const log = {};
try {
  for (const vpName of (process.env.VP || 'desktop,iphone,iphone-land').split(',')) {
    for (const way of (process.env.WAY || 'plane,boat').split(',')) {
      const page = await browser.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      const vp = VPS[vpName];
      await page.setViewport(vp);
      const ev = (fn, a) => page.evaluate(fn, a);
      const press = async (sel) => { await page.waitForSelector(sel, { visible: true, timeout: 20000 }); if (vp.hasTouch) await page.tap(sel); else await page.click(sel); };
      const shot = async (n) => { const f = `${vpName}-${way}-${n}.png`; await page.screenshot({ path: path.join(OUT, f) }); console.log('captured', f); };
      await page.goto(debugUrl(srv.base, 'intro=1'), { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
      await ev(() => window.__TAO_RPG__.clearSave());
      await page.goto(debugUrl(srv.base, 'intro=1'), { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
      await sleep(1200);
      if (way === 'plane') await shot('00a-title');
      await press('#btn-title-start');
      await sleep(400);
      await press('#btn-origin-yayo');
      await press('#btn-gender-f');
      await sleep(300);
      if (way === 'plane') await shot('00b-party');
      await press('#origin-go');
      await sleep(700);
      await shot('00c-choice');
      await press(`#btn-arrive-${way}`);
      await ev(() => window.__TAO_RPG__.freezeIntro(0.05, null));
      // wait until every intro layer is in
      for (let i = 0; i < 200; i++) { const p = await ev(() => window.__TAO_RPG__.arrival().introPose); if (p && p.layers >= 59) break; await sleep(150); }
      for (const [n, t, f] of KEYS[way]) {
        await ev(([t, f]) => {
          window.__TAO_RPG__.freezeIntro(t, f);
          // in the game the logo, caption and loading bar have faded before the finale
          for (const s of ['#arrival-intro .ai-logo', '#arrival-intro .ai-caption', '#ai-load']) { const e = document.querySelector(s); if (e) { e.style.transition = 'none'; e.style.opacity = f === null ? '' : '0'; } }
        }, [t, f]);
        await sleep(700);
        await shot(n);
        log[`${vpName}-${way}-${n}`] = await ev(() => window.__TAO_RPG__.arrival().introPose);
      }
      if (process.env.NB) {
        await ev(() => { for (const s of ['#arrival-intro .ai-logo', '#arrival-intro .ai-caption', '#ai-load']) { const e = document.querySelector(s); if (e) e.style.opacity = ''; } });
        await ev(() => { const g = window.__TAO_RPG__; g.holdArrivalNotebook(true); g.freezeIntro(4, null); g.freezeIntro(null); });
        for (let i = 0; i < 900; i++) { const a = await ev(() => window.__TAO_RPG__.arrival()); if (a.phase === 'notebook' || !a.playing) break; await sleep(100); }
        await sleep(1500);
        await shot('10-notebook');
        await ev(() => window.__TAO_RPG__.holdArrivalNotebook(false));
      }
      if (errs.length) console.log('errors', vpName, way, errs.slice(0, 5));
      await page.close();
    }
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'keyframes.json'), JSON.stringify(log, null, 1));
  await browser.close();
  await srv.close();
  process.exit(0);
}
