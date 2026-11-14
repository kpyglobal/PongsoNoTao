// Traveller art check: character select + both travellers in-world with their dialogue portrait (desktop + mobile).
// node scripts/capture-traveller.mjs   (puppeteer-core harness; local static server for the test only)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-traveller');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8843) });
const errors = [], http4xx = [], fails = [], report = {};
const check = (name, ok, info) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`, info ? JSON.stringify(info) : ''); if (!ok) fails.push(name); };
const b = await launchBrowser();
try {
  for (const vp of [
    { tag: 'desktop', v: { width: 1440, height: 900, deviceScaleFactor: 1 } },
    { tag: 'mobile', v: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  ]) {
    const T = vp.tag;
    for (const g of ['m', 'f']) {
      const page = await b.newPage();
      page.on('pageerror', (e) => errors.push(`${T}: ${e}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${T}: ${m.text()}`); });
      page.on('response', (r) => { if (r.status() >= 400) http4xx.push(`${r.status()} ${r.url()}`); });
      page.on('dialog', (d) => d.accept());
      await page.setViewport(vp.v);
      const ev = (fn, a) => page.evaluate(fn, a);
      const boot = async () => {
        await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
        await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
      };
      await boot();
      await ev(() => window.__TAO_RPG__.clearSave());
      await boot();
      const shot = async (name, wait = 900) => { await sleep(wait); await page.screenshot({ path: path.join(OUT, `${T}-${name}.png`) }); console.log('captured', `${T}-${name}`); };
      await page.waitForSelector('#btn-origin-ivalino', { visible: true, timeout: 30000 });
      await page.click('#btn-origin-ivalino');
      await page.waitForSelector(`#btn-gender-${g}`, { visible: true, timeout: 15000 });
      await page.click(`#btn-gender-${g}`);
      await ev(() => document.getElementById('gender-pick').scrollIntoView({ block: 'center' }));
      const prev = await ev(() => ['m', 'f'].map((k) => getComputedStyle(document.querySelector(`#btn-gender-${k} .gp-sprite`)).backgroundImage));
      check(`${T}-${g}: select previews use the traveller sheets`, /player_visitor_sheet/.test(prev[0]) && /player_visitor_f_sheet/.test(prev[1]), prev);
      if (g === 'f' || T === 'mobile') await shot(`01-character-select-${g}`);
      await page.click('#origin-go');
      await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
      await page.waitForFunction(() => window.__TAO_RPG__.frame() > 3, { timeout: 120000, polling: 250 }).catch(() => {});
      // walk the intro until the traveller speaks (dialogue portrait = visitor / visitor_m)
      const want = g === 'f' ? 'portraits/visitor.webp' : 'portraits/visitor_m.webp';
      let src = '';
      for (let i = 0; i < 40; i++) {
        src = (await ev(() => window.__TAO_RPG__.mode() === 'dialogue' ? document.querySelector('#dlg-portrait img')?.getAttribute('src') || '' : '')) || '';
        if (src.includes(want)) break;
        if ((await ev(() => window.__TAO_RPG__.mode())) !== 'dialogue') break;
        await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(120);
      }
      if (!src.includes(want)) {
        // no traveller line in the intro: ask the traveller to say something via a quest-free talk (party switch line)
        await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); });
      }
      // the portrait loads on demand: wait until the image with that src has decoded before reading its width
      await page.waitForFunction(() => { const i = document.querySelector('#dlg-portrait img'); return !i || !i.getAttribute('src') || (i.complete && i.naturalWidth > 0); }, { timeout: 10000, polling: 100 }).catch(() => {});
      const info = await ev(() => ({ outfit: window.__TAO_RPG__.outfit(), portrait: window.__TAO_RPG__.portrait(), party: window.__TAO_RPG__.party().outfits,
        img: document.querySelector('#dlg-portrait img')?.naturalWidth || 0 }));
      report[`${T}-${g}`] = { ...info, src };
      check(`${T}-${g}: traveller outfit + portrait`, info.outfit === (g === 'f' ? 'player_visitor_f' : 'player_visitor') && info.portrait === (g === 'f' ? 'visitor' : 'visitor_m'), info);
      check(`${T}-${g}: dialogue shows the new traveller portrait`, src.includes(want) && info.img === 330, { src, w: info.img }); // 330×420 since NPC cast rev
      await ev(() => window.__TAO_RPG__.setCamera({ dist: 16, snap: true }));
      await shot(`0${g === 'm' ? 2 : 3}-traveller-${g}-dialogue`, 2500);
      // in-world close-up without the dialogue box
      for (let i = 0; i < 40 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(60); }
      await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); g.setCamera({ dist: 16, snap: true }); });
      await shot(`0${g === 'm' ? 4 : 5}-traveller-${g}-in-world`, 2500);
      await page.close();
    }
  }
} finally {
  await b.close();
  await srv.close();
}
const ok = !fails.length && !errors.length && !http4xx.length;
fs.writeFileSync(path.join(OUT, 'report-traveller.json'), JSON.stringify({ ok, fails, errors, http4xx, report }, null, 1));
console.log(JSON.stringify({ ok, fails, errors, http4xx }, null, 1));
process.exit(ok ? 0 : 1);
