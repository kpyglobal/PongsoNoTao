// 0.1.5 font set 霞光書卷 screenshots: title, character select, dialogue (中文 / English / 中文＋English), notebook
// and the travel map, and a check that nothing on screen is italic (Tao words never are),
// desktop + iPhone portrait. Output: screenshots-fonts/ (OUT=…). DIST=dist node scripts/capture-fonts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-fonts');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve(process.env.DIST || 'dist'), port: Number(process.env.PORT || 8891) });
const errors = [];
const fonts = {};
const italic = {};
/** every element with its own visible text whose computed style is not upright (runs in the page) */
function italicScan() {
  const out = [];
  for (const e of document.querySelectorAll('body *')) {
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.data.trim());
    if (!own) continue;
    const s = getComputedStyle(e);
    if (s.fontStyle !== 'normal') out.push(`${e.tagName.toLowerCase()}.${e.className}: ${e.textContent.trim().slice(0, 40)} (${s.fontStyle})`);
  }
  return out;
}
let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1280, height: 800, deviceScaleFactor: 1 } },
    { tag: 'iphone', v: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ]) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(`${vp.tag}: ${e}`));
    page.on('dialog', (d) => d.accept());
    await page.setViewport(vp.v);
    const ev = (fn, a) => page.evaluate(fn, a);
    const shot = async (name, wait = 600) => {
      await sleep(wait);
      const f = path.join(OUT, `${vp.tag}-${name}.png`);
      await page.screenshot({ path: f });
      italic[`${vp.tag}-${name}`] = await ev(italicScan);
      console.log('captured', path.relative(process.cwd(), f), italic[`${vp.tag}-${name}`].length ? `ITALIC: ${italic[`${vp.tag}-${name}`].join(' / ')}` : '(no italic)');
    };
    const open = async (ui, extra) => {
      await page.goto(debugUrl(srv.base, `ui=${ui}${extra ? `&${extra}` : ''}`), { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
      await ev(() => document.fonts.ready);
    };
    // title (中文 and English)
    for (const ui of ['zh', 'en']) {
      await open(ui, 'intro=1');
      await page.waitForSelector('#title-screen', { visible: true, timeout: 20000 }).catch(() => {});
      await shot(`title-${ui}`, 1500);
      await ev(() => document.getElementById('btn-title-start')?.click());
      await page.waitForSelector('#origin-screen', { visible: true, timeout: 20000 }).catch(() => {});
      await shot(`character-select-${ui}`, 900);
    }
    // dialogue in each interface language, then the notebook (in that language)
    for (const ui of ['zh', 'en', 'zhen']) {
      await open(ui, 'intro=0');
      await ev(() => { const g = window.__TAO_RPG__; g.clearSave(); localStorage.setItem('tao-rpg.lang', 'both'); g.setLang?.('both'); g.selectOrigin('ivalino', 'f'); });
      await page.waitForFunction(() => window.__TAO_RPG__.mode() === 'dialogue', { timeout: 30000 }).catch(() => {});
      // finish the opening talk, then talk to the Ivalino elder and stop on the first line that has Tao in it
      await sleep(600);
      for (let i = 0; i < 60 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(60); }
      await ev(() => window.__TAO_RPG__.closeAll());
      for (const npc of ['elder_ivalino', 'elder_iranmeylek', 'elder_yayo']) {
        await ev((n) => window.__TAO_RPG__.talkTo(n), npc);
        await sleep(700);
        let found = false;
        for (let i = 0; i < 20 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) {
          if (await ev(() => !!document.getElementById('dlg-tao')?.textContent.trim() && !document.getElementById('dlg-tao').classList.contains('hidden'))) { found = true; break; }
          if ((await ev(() => window.__TAO_RPG__.dialogueLeft())) <= 1) break;
          await ev(() => window.__TAO_RPG__.advanceDialogue());
          await sleep(120);
        }
        if (found) break;
        for (let i = 0; i < 40 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(50); }
      }
      await sleep(1200);
      await ev(() => window.__TAO_RPG__.finishTyping?.());
      await shot(`dialogue-${ui}`, 400);
      fonts[`${vp.tag}-${ui}`] = await ev(() => {
        const cs = (id) => { const e = document.getElementById(id); if (!e) return null; const s = getComputedStyle(e); return { size: s.fontSize, weight: s.fontWeight, style: s.fontStyle, family: s.fontFamily.split(',')[0] }; };
        return { zh: cs('dlg-zh'), en: cs('dlg-en'), tao: cs('dlg-tao'), loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`) };
      });
      for (let i = 0; i < 40 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(50); }
      await ev(() => { const st = window.__TAO_RPG__.state; for (const id of ['akokey', 'wawa', 'soli', 'alibangbang']) st.glossary.add(id); });
      await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); g.openJournal(); document.querySelector('#journal-tabs [data-tab="glossary"]')?.click(); });
      await sleep(500);
      await ev(() => document.querySelector('.nb-item')?.click());
      await shot(`notebook-${ui}`, 900);
      await ev(() => window.__TAO_RPG__.closeAll());
      await sleep(300);
      await ev(() => document.querySelector('#btn-travel')?.click());
      await shot(`travel-${ui}`, 1400);
      await ev(() => window.__TAO_RPG__.closeAll());
    }
    await ev(() => { localStorage.removeItem('tao-rpg.ui'); window.__TAO_RPG__.clearSave(); });
    await page.close();
  }
} finally {
  await browser?.close();
  await srv.close();
}
fs.writeFileSync(path.join(OUT, 'fonts.json'), JSON.stringify({ fonts, italic, errors }, null, 1));
const lean = Object.entries(italic).filter(([, v]) => v.length);
console.log(lean.length ? `ITALIC FOUND on ${lean.map(([k]) => k).join(', ')}` : 'no italic text on any screen');
console.log(JSON.stringify(fonts, null, 1).slice(0, 3000));
console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no page errors');
