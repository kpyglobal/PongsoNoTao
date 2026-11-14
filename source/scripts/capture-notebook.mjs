// 圖鑑手札 before / after screenshots (desktop + mobile). LABEL=before|after OUT=screenshots-notebook
// node scripts/capture-notebook.mjs   (puppeteer-core harness; local static server for the test only)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const LABEL = process.env.LABEL || 'after';
const OUT = path.resolve(process.env.OUT || 'screenshots-notebook');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve(process.env.DIST || 'dist'), port: Number(process.env.PORT || 8842) });
const errors = [];
const b = await launchBrowser();
try {
  for (const vp of [
    { tag: 'desktop', v: { width: 1440, height: 900, deviceScaleFactor: 1 } },
    { tag: 'mobile', v: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  ]) {
    const T = vp.tag;
    const page = await b.newPage();
    page.on('pageerror', (e) => errors.push(`${T}: ${e}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${T}: ${m.text()}`); });
    page.on('dialog', (d) => d.accept());
    await page.setViewport(vp.v);
    await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    const ev = (fn, a) => page.evaluate(fn, a);
    const drain = async () => {
      for (let i = 0; i < 40 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(50); }
    };
    await ev(() => { const g = window.__TAO_RPG__; g.clearSave(); g.selectOrigin('ivalino', 'f'); });
    await drain();
    for (const id of ['Q02', 'S1', 'S2', 'S3', 'Q03', 'K1', 'X01', 'U1']) { await ev((i) => window.__TAO_RPG__.completeQuest(i), id); await drain(); }
    // some journal content so every page has something to show (same data for before / after)
    await ev(() => {
      const st = window.__TAO_RPG__.state;
      for (const id of ['akokey', 'wawa', 'soli', 'alibangbang', 'kalang', 'pongso-no-tao']) st.glossary.add(id);
      st.ingredients.add('soli');
      st.recipes.add('fish-and-taro');
    });
    await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); g.openQuests(); });
    const shot = async (name, wait = 900) => { await sleep(wait); await page.screenshot({ path: path.join(OUT, `${LABEL}-${T}-${name}.png`) }); console.log('captured', `${LABEL}-${T}-${name}`); };
    const tab = async (t) => { await ev((t) => document.querySelector(`#journal-tabs [data-tab="${t}"]`)?.click(), t); await sleep(300); };
    await shot('01-quests');
    // notebook: open the first item's detail (mobile flips to the detail page)
    const hasNb = await ev(() => !!document.querySelector('.nb-item'));
    if (hasNb) {
      await ev(() => document.querySelector('.nb-item.st-active')?.click());
      await shot('02-quest-detail');
    }
    await tab('glossary');
    await shot('03-glossary');
    if (hasNb) {
      await ev(() => document.querySelector('.nb-item.st-done, .nb-item')?.click());
      await shot('04-glossary-detail');
    }
    await tab('album');
    await shot('05-album');
    await tab('save');
    await shot('06-save');
    await page.close();
  }
} finally {
  await b.close();
  await srv.close();
}
console.log(errors.length ? `console errors: ${errors.join(' | ')}` : 'no console errors');
process.exit(errors.length ? 1 : 0);
