// Party art check: character select + all 4 party members (族男, 族女, male / female traveller) in-world with their
// dialogue portraits, desktop + mobile. node scripts/capture-party.mjs (local static server for the test only)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-party');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8844) });
const errors = [], http4xx = [], fails = [], report = {};
const check = (name, ok, info) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`, info ? JSON.stringify(info) : ''); if (!ok) fails.push(name); };
const OUTFIT = { m: 'player', f: 'player_f', tm: 'player_visitor', tf: 'player_visitor_f' };
const PORTRAIT = { m: 'local', f: 'local_f', tm: 'visitor_m', tf: 'visitor' };
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
      await page.waitForSelector('#sel-origin-m', { visible: true, timeout: 30000 });
      await page.select('#sel-origin-m', 'ivalino'); await page.select('#sel-origin-f', 'ivalino');
      await page.waitForSelector(`#btn-gender-${g}`, { visible: true, timeout: 15000 });
      await page.click(`#btn-gender-${g}`);
      await ev(() => document.getElementById('gender-pick').scrollIntoView({ block: 'center' }));
      if (g === 'f') await shot('01-character-select');
      await page.click('#origin-go');
      await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
      await page.waitForFunction(() => window.__TAO_RPG__.frame() > 3, { timeout: 120000, polling: 250 }).catch(() => {});
      await ev(() => window.__TAO_RPG__.setCamera({ dist: 16, snap: true }));
      // intro: 族男 (@m), 族女 (@f) and the traveller (@t) each speak once
      const tKey = g === 'f' ? 'tf' : 'tm';
      const want = g === 'm' ? ['m', 'f', tKey] : [tKey];
      const seen = new Set();
      for (let i = 0; i < 40 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) {
        const src = await ev(() => document.querySelector('#dlg-portrait img')?.getAttribute('src') || '');
        for (const k of want) {
          if (!seen.has(k) && src.endsWith(`portraits/${PORTRAIT[k]}.webp`)) {
            seen.add(k);
            // portraits load on demand: wait for this one to decode before reading its width (was a race → 0 / old width)
            await page.waitForFunction((want) => { const i = document.querySelector('#dlg-portrait img'); return i && i.getAttribute('src')?.endsWith(want) && i.complete && i.naturalWidth > 0; }, { timeout: 10000, polling: 100 }, `portraits/${PORTRAIT[k]}.webp`).catch(() => {});
            const w = await ev(() => document.querySelector('#dlg-portrait img')?.naturalWidth || 0);
            check(`${T}: ${k} dialogue portrait ${PORTRAIT[k]}`, w === 330, { src, w }); // portraits are 330×420 since NPC cast rev (2026-11-14)
            await shot(`02-dialogue-${k}`, 2000);
          }
        }
        await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(120);
      }
      check(`${T}-${g}: intro showed portraits for ${want.join(',')}`, want.every((k) => seen.has(k)), [...seen]);
      const party = await ev(() => window.__TAO_RPG__.party().outfits);
      check(`${T}-${g}: party outfits`, party.m === OUTFIT.m && party.f === OUTFIT.f && party.t === OUTFIT[tKey], party);
      const bar = await ev(() => [...document.querySelectorAll('#party-bar img')].map((i) => i.getAttribute('src')));
      check(`${T}-${g}: party bar portraits`, bar.some((s) => s.includes('/local.webp')) && bar.some((s) => s.includes('/local_f.webp')) && bar.some((s) => s.includes(`/${PORTRAIT[tKey]}.webp`)), bar);
      report[`${T}-${g}`] = { party, bar, seen: [...seen] };
      // in-world close-ups: the controlled member leads, so take control of each in turn
      // open ground for the close-ups (the pier spawn sits behind the harbour hut); hide the unlock toast for the shot only
      const moved = await ev(() => {
        const g = window.__TAO_RPG__; g.closeAll();
        const p = g.playerPos(); const q = g.roadPointNear(p.x, p.z, 40);
        if (q) g.teleport(q.x, q.z);
        g.gatherParty();
        document.getElementById('unlock-toast').style.visibility = 'hidden';
        return q;
      });
      report[`${T}-${g}-closeupAt`] = moved;
      const roles = g === 'm' ? [['m', 'm'], ['f', 'f'], ['t', tKey]] : [['t', tKey]];
      for (const [r, k] of roles) {
        await ev((r) => window.__TAO_RPG__.switchMember(r), r);
        await ev(() => window.__TAO_RPG__.setCamera({ dist: 16, snap: true }));
        const o = await ev(() => window.__TAO_RPG__.outfit());
        check(`${T}: controlling ${k} wears ${OUTFIT[k]}`, o === OUTFIT[k], o);
        await shot(`03-in-world-${k}`, 2500);
      }
      await page.close();
    }
  }
} finally {
  await b.close();
  await srv.close();
}
const ok = !fails.length && !errors.length && !http4xx.length;
fs.writeFileSync(path.join(OUT, 'report-party.json'), JSON.stringify({ ok, fails, errors, http4xx, report }, null, 1));
console.log(JSON.stringify({ ok, fails, errors, http4xx }, null, 1));
process.exit(ok ? 0 : 1);
