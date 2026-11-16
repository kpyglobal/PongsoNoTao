// 0.1.5 English interface: every screen in English (no Chinese left, place names and map labels included), nothing spilling out of its box, the 中文 / English switch saves and old players stay on 中文.
// Desktop, iPhone portrait and iPhone landscape. Screenshots: screenshots-english/.
// DIST=dist node scripts/test-english.mjs
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-english');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve(process.env.DIST || 'dist'), port: Number(process.env.PORT || 8873) });
const report = { errors: [], fails: [], leftovers: new Map(), overflow: [] };
const check = (name, ok, info) => {
  if (!ok) report.fails.push(name);
  console.log(ok ? 'ok  ' : 'FAIL', name, info !== undefined ? JSON.stringify(info).slice(0, 400) : '');
};
// 0.1.5 map phase done: place names, map labels and fast-travel pins are English too, so no Chinese is allowed

/** visible Chinese text and boxes whose text spills out (runs in the page) */
function scan() {
  const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
  const vis = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const cjk = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.data.trim();
    if (!t || !CJK.test(t) || t === '中文') continue;
    const p = n.parentElement;
    if (!p || p.closest('[data-keep-lang]') || !vis(p)) continue;
    cjk.push(t.slice(0, 80));
  }
  for (const e of document.querySelectorAll('[aria-label],[title],[placeholder]')) for (const a of ['aria-label', 'title', 'placeholder']) { const v = e.getAttribute(a); if (v && CJK.test(v) && !e.closest('[data-keep-lang]')) cjk.push(`@${a}:${v.slice(0, 60)}`); }
  const over = [];
  const sel = 'button, label, [role=tab], [role=radio], h1, h2, h3, h4, .nd-title, .chip, .toast, .toast *, .hud-chip, .q-chip, .qc-ground, .qc-giver, .nb-item, .ms-lang-label, .nb-set-label, select, .ap-name, .ap-desc, .cs-role, .cs-desc';
  for (const e of document.querySelectorAll(sel)) {
    if (!vis(e) || !e.textContent.trim()) continue;
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    const clipX = e.scrollWidth > e.clientWidth + 2 && s.overflowX !== 'auto' && s.overflowX !== 'scroll';
    const clipY = e.scrollHeight > e.clientHeight + 3 && (s.overflowY === 'hidden' || s.overflow === 'hidden') && s.overflowY !== 'auto';
    const off = r.right > innerWidth + 1 || r.left < -1 || (!!e.closest('.nb-ribbons') && (r.bottom > innerHeight + 1 || r.bottom > (e.closest('.notebook')?.getBoundingClientRect().bottom ?? 1e9) + 1));
    if ((clipX && e.clientWidth > 0) || clipY || off) over.push({ el: `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${[...e.classList].join('.')}`, text: e.textContent.trim().slice(0, 40), w: e.clientWidth, sw: e.scrollWidth, h: e.clientHeight, sh: e.scrollHeight, off });
  }
  return { cjk: [...new Set(cjk)], over };
}

let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1280, height: 800, deviceScaleFactor: 1 } },
    { tag: 'iphone', v: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { tag: 'iphone-land', v: { width: 852, height: 393, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ]) {
    const T = vp.tag;
    const touch = !!vp.v.hasTouch;
    const page = await browser.newPage();
    page.on('pageerror', (e) => report.errors.push(`${T}: ${e}`));
    page.on('dialog', (d) => d.accept());
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${T}: ${m.text()}`); });
    await page.setViewport(vp.v);
    const ev = (fn, a) => page.evaluate(fn, a);
    const load = async (extra = 'intro=1') => {
      await page.goto(debugUrl(srv.base, extra), { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    };
    const press = async (sel) => { await page.waitForSelector(sel, { visible: true, timeout: 20000 }); if (touch) await page.tap(sel); else await page.click(sel); };
    const shot = async (name, wait = 700) => { await sleep(wait); const f = path.join(OUT, `${T}-${name}.png`); await page.screenshot({ path: f }); console.log('captured', path.relative(process.cwd(), f)); };
    const look = async (where) => {
      const s = await ev(scan);
      const bad = s.cjk.filter((t) => /[\u3400-\u9fff]/.test(t.replace(/^@[\w-]+:/, '')));
      check(`${T} ${where}: no Chinese interface text`, bad.length === 0, bad);
      check(`${T} ${where}: English fits (nothing clipped or off screen)`, s.over.length === 0, s.over);
      if (s.over.length) report.overflow.push(...s.over.map((o) => ({ where: `${T} ${where}`, ...o })));
    };
    const drainShot = async (name) => {
      for (let i = 0; i < 40 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { if (i === 1 && name) await shot(name, 2600); await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(60); }
    };

    // 0) old players: no interface setting = 中文
    await load();
    await ev(() => { window.__TAO_RPG__.clearSave(); localStorage.removeItem('tao-rpg.ui'); });
    await load();
    const zh = await ev(() => ({ ui: document.documentElement.dataset.ui, start: document.getElementById('btn-title-start')?.textContent ?? '', on: [...document.querySelectorAll('#title-screen [data-ui-lang]')].filter((b) => b.classList.contains('on')).map((b) => b.dataset.uiLang) }));
    check(`${T}: no saved setting → 中文 (as before)`, zh.ui === 'zh' && /[\u3400-\u9fff]/.test(zh.start) && zh.on.join() === 'zh', zh);

    // 1) pick English on the title screen: saved, page rebuilt in English
    await page.waitForSelector('#title-screen [data-ui-lang="en"]', { visible: true, timeout: 20000 });
    await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 120000 }), ev(() => document.querySelector('#title-screen [data-ui-lang="en"]').click())]);
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    const en = await ev(() => ({ ui: document.documentElement.dataset.ui, stored: localStorage.getItem('tao-rpg.ui'), lang: document.documentElement.lang, title: document.title }));
    check(`${T}: English saved and applied`, en.ui === 'en' && en.stored === 'en' && en.lang === 'en' && !/[\u3400-\u9fff]/.test(en.title), en);
    await page.waitForSelector('#title-screen', { visible: true, timeout: 20000 });
    await shot('01-title', 1500);
    await look('title');

    // 2) party / character select
    await press('#btn-title-start');
    await sleep(500);
    await page.select('#sel-origin-m', 'yayo'); await page.select('#sel-origin-f', 'iraraley');
    await press('#btn-gender-f');
    await shot('02-character-select', 600);
    await look('character select');
    await press('#origin-go');
    await sleep(500);
    await shot('03-arrival-choice', 500);
    await look('arrival choice');

    // 3) straight into the island (skip the ride) for dialogue, notices and the notebook
    await load('intro=0');
    await ev(() => { const g = window.__TAO_RPG__; g.clearSave(); g.selectOrigin('ivalino', 'f'); });
    await sleep(600);
    await page.waitForFunction(() => window.__TAO_RPG__.mode() === 'dialogue', { timeout: 20000 }).catch(() => {});
    await sleep(900);
    await look('dialogue');
    await drainShot('04-dialogue');
    await sleep(400);
    await look('island HUD');
    await shot('05-hud', 400);
    // a notice (toast): finishing a quest
    await ev(() => window.__TAO_RPG__.completeQuest('Q02'));
    await sleep(250);
    await shot('06-notice', 300);
    await look('notice');
    await drainShot('');
    for (const id of ['S1', 'S2', 'S3', 'Q03', 'K1', 'X01', 'U1']) { await ev((i) => window.__TAO_RPG__.completeQuest(i), id); await drainShot(''); }
    await ev(() => { const st = window.__TAO_RPG__.state; for (const id of ['akokey', 'wawa', 'soli', 'alibangbang', 'kalang', 'pongso-no-tao']) st.glossary.add(id); st.ingredients.add('soli'); st.recipes.add('fish-and-taro'); });
    // 4) notebook: every tab, list + first item
    await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); g.openQuests(); });
    await sleep(600);
    await shot('07-notebook-quests', 400);
    await look('notebook quests');
    const tabs = await ev(() => [...document.querySelectorAll('#journal-tabs [data-tab]')].map((b) => b.dataset.tab));
    for (const t of tabs) {
      await ev((t) => document.querySelector(`#journal-tabs [data-tab="${t}"]`)?.click(), t);
      await sleep(350);
      await look(`notebook ${t}`);
      await ev(() => document.querySelector('.nb-item')?.click());
      await sleep(350);
      await look(`notebook ${t} detail`);
      if (t === 'save') {
        await ev(() => document.querySelector('.nb-item[data-save="settings"]')?.click());
        await sleep(350);
        await shot('08-notebook-settings', 300);
        await look('notebook settings');
      }
      if (t === 'glossary') await shot('09-notebook-glossary', 300);
      await ev(() => document.querySelector('.nb-back, [aria-label="Back to the list"]')?.click());
      await sleep(200);
    }
    // help sheet
    await ev(() => { window.__TAO_RPG__.closeAll(); document.getElementById('btn-help')?.click(); });
    await sleep(500);
    await look('help sheet');
    await ev(() => window.__TAO_RPG__.closeAll());
    // map phase: every place label in the world (also the ones out of view) and the fast-travel map
    const labels = await ev(() => [...document.querySelectorAll('.world-label')].map((e) => e.textContent.trim()));
    check(`${T}: world place labels are English (${labels.length})`, labels.length > 10 && labels.every((t) => !/[\u3400-\u9fff]/.test(t)), labels.filter((t) => /[\u3400-\u9fff]/.test(t)));
    check(`${T}: village labels use Tao names`, ['Yayo', 'Iraraley', 'Iranmeylek', 'Ivalino', 'Imorod', 'Iratay', 'Kaiyuan Harbour', 'Hongtou Rock'].every((n) => labels.includes(n)), labels.slice(0, 12));
    await ev(() => document.querySelector('#btn-travel')?.click());
    await sleep(1200);
    await shot('10-travel', 300);
    await look('fast travel');
    const pins = await ev(() => [...document.querySelectorAll('.travel-pin')].map((b) => ({ t: b.textContent.trim(), a: b.getAttribute('aria-label') })));
    check(`${T}: fast-travel pins are English`, pins.length >= 10 && pins.every((p) => !/[\u3400-\u9fff]/.test(p.t + p.a)) && pins.some((p) => p.a === 'Go to Iranmeylek'), pins);
    {
      const el = await page.$('.travel-pin[data-id="iranmeylek"] .lab');
      if (touch) await el.tap(); else await el.click();
      await sleep(900);
      await look('after fast travel');
      await shot('11-after-travel', 300);
    }
    await ev(() => window.__TAO_RPG__.closeAll());

    // 5) switching back to 中文 from the notebook settings saves and comes back in 中文
    await ev(() => { const g = window.__TAO_RPG__; g.openJournal(); document.querySelector('#journal-tabs [data-tab="save"]')?.click(); });
    await sleep(300);
    await ev(() => document.querySelector('.nb-item[data-save="settings"]')?.click());
    await sleep(300);
    const hasZh = await ev(() => !!document.querySelector('#nb-detail [data-ui-lang="zh"], .nb-settings [data-ui-lang="zh"]'));
    check(`${T}: notebook settings has the 中文 / English switch`, hasZh);
    const pick = await ev(() => [...document.querySelectorAll('.nb-settings [data-ui-lang]')].map((b) => b.textContent.trim()));
    check(`${T}: language picker labels stay 中文 / English / 中文＋English in English`, pick.join('|') === '中文|English|中文＋English', pick);
    if (hasZh) {
      await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 120000 }), ev(() => document.querySelector('.nb-settings [data-ui-lang="zh"]').click())]);
      await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
      const back = await ev(() => ({ ui: document.documentElement.dataset.ui, stored: localStorage.getItem('tao-rpg.ui') }));
      check(`${T}: back to 中文 is saved`, back.ui === 'zh' && back.stored === 'zh', back);
    }
    await ev(() => { localStorage.removeItem('tao-rpg.ui'); window.__TAO_RPG__.clearSave(); });
    await page.close();
  }
} catch (e) {
  report.fails.push(`crash: ${e?.stack ?? e}`);
  console.error(e);
} finally {
  await browser?.close();
  await srv.close();
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ...report, leftovers: [...report.leftovers] }, null, 1));
console.log(`errors: ${report.errors.length}${report.errors.length ? '\n  ' + report.errors.slice(0, 10).join('\n  ') : ''}`);
console.log(report.fails.length ? `FAILED ${report.fails.length}` : 'ALL OK');
process.exit(report.fails.length || report.errors.length ? 1 : 0);
