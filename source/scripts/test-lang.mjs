// Language control moved out of dialogue boxes: only on the start screens and in the
// 圖鑑手札「存檔」settings, next to 音樂／音效. Also checks the 族男 starts as leader,
// the 0.1.5 English interface (dialogue modes Tao + English / English only / Tao only)
// and the default camera (25) plus reset-view.
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl, pageLang } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-015');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve(process.env.DIST || 'dist'), port: Number(process.env.PORT || 8861) });
const report = { errors: [], http4xx: [], fails: [] };
const check = (name, ok, info) => {
  if (!ok) report.fails.push(name);
  console.log(ok ? 'ok  ' : 'FAIL', name, info !== undefined ? JSON.stringify(info).slice(0, 280) : '');
};

const OLD_DIST = 22;
const NEW_DIST = 25;

let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1280, height: 800, deviceScaleFactor: 1 } },
    { tag: 'iphone', v: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ]) {
    const T = vp.tag;
    const page = await browser.newPage();
    page.on('pageerror', (e) => report.errors.push(`${T}: ${e}`));
    page.on('dialog', (d) => d.accept());
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${T}: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400) report.http4xx.push(`${r.status()} ${r.url()}`); });
    await page.setViewport(vp.v);
    await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    const ev = (fn, a) => page.evaluate(fn, a);
    const shot = async (name, wait = 800) => {
      await sleep(wait);
      const file = path.join(OUT, `${T}-${name}.png`);
      await page.screenshot({ path: file });
      console.log('captured', path.relative(process.cwd(), file));
    };

    await ev(() => {
      window.__TAO_RPG__.clearSave();
      localStorage.removeItem('tao-rpg.lang');
    });
    await page.reload({ waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });

    // 1) start screen (origin, because webdriver skips the title): language sits with 音樂／音效
    await page.waitForSelector('#origin-screen', { visible: true, timeout: 15000 });
    const start = await ev(() => {
      const bar = document.querySelector('#origin-screen .menu-sound');
      const langs = [...(bar?.querySelectorAll('.lang-toggle [data-lang]') ?? [])].map((b) => ({
        id: b.dataset.lang, label: b.textContent, on: b.classList.contains('on'),
      }));
      const sound = [...(bar?.querySelectorAll('button[data-ch]') ?? [])].map((b) => b.dataset.ch);
      const inDlg = !!document.querySelector('#dialogue .lang-toggle');
      return {
        shown: getComputedStyle(document.getElementById('origin-screen')).display !== 'none',
        hasBar: !!bar,
        langs,
        sound,
        inDlg,
        label: bar?.querySelector('.ms-lang-label')?.textContent ?? '',
      };
    });
    check(`${T}: start screen shows 語言 next to 音樂／音效`, start.shown && start.hasBar && start.sound.includes('music') && start.sound.includes('sfx') && start.langs.map((l) => l.id).join() === 'both,zh,tao' && start.label === '語言' && !start.inDlg, start);
    check(`${T}: start language defaults to 雙語`, start.langs.find((l) => l.id === 'both')?.on === true, start.langs);

    // picking 僅繁中 on the start screen is kept into the opening talk
    await ev(() => document.querySelector('#origin-screen .lang-toggle [data-lang="zh"]').click());
    await page.select('#sel-origin-m', 'yayo'); await page.select('#sel-origin-f', 'yayo');
    await page.click('#btn-gender-f');
    await page.click('#origin-go');
    await page.waitForFunction(() => window.__TAO_RPG__.mode() === 'dialogue', { timeout: 15000 });
    await sleep(200);

    const dlg = await ev(() => {
      const box = document.getElementById('dialogue');
      const toggle = box.querySelector('.lang-toggle, [data-lang]');
      const labels = (box.innerText || '');
      return {
        open: box.classList.contains('open'),
        hasToggle: !!toggle,
        mentionsLang: /雙語|僅繁中|僅族語/.test(labels),
        zhHidden: document.getElementById('dlg-zh').classList.contains('hidden'),
        taoHidden: document.getElementById('dlg-tao').classList.contains('hidden'),
        lang: window.__TAO_RPG__.saveState().lang,
        lead: window.__TAO_RPG__.party().controlled,
        outfits: window.__TAO_RPG__.party().outfits,
        stored: localStorage.getItem('tao-rpg.lang'),
      };
    });
    check(`${T}: opening dialogue has no language option`, dlg.open && !dlg.hasToggle && !dlg.mentionsLang, dlg);
    check(`${T}: start-screen 僅繁中 applies to the opening talk`, dlg.lang === 'zh' && dlg.taoHidden && !dlg.zhHidden && dlg.stored === 'zh', dlg);
    check(`${T}: 族男 leads a new game`, dlg.lead === 'm', dlg);
    check(`${T}: traveller is not wearing Tao clothing`, dlg.outfits.t !== 'player' && dlg.outfits.t !== 'player_f' && /visitor/.test(dlg.outfits.t || ''), dlg.outfits);
    await shot('dialogue-no-lang', 600);

    // 2) notebook 存檔 settings: language next to sound, live switch, persist
    await ev(() => window.__TAO_RPG__.openJournal());
    await sleep(400);
    await ev(() => document.querySelector('#journal-tabs [data-tab="save"]')?.click());
    await sleep(400);
    await ev(() => document.querySelector('.nb-item[data-save="settings"]')?.click());
    await sleep(300);
    const nb = await ev(() => {
      const detail = document.getElementById('nb-detail');
      const lang = [...(detail?.querySelectorAll('.lang-toggle [data-lang]') ?? [])].map((b) => ({
        id: b.dataset.lang, label: b.textContent, on: b.classList.contains('on'),
      }));
      const music = detail?.querySelector('#nb-ap-music');
      const sfx = detail?.querySelector('#nb-ap-sfx');
      const labels = [...(detail?.querySelectorAll('.nb-set-label, .ap-row label') ?? [])].map((e) => e.textContent);
      const rLang = detail?.querySelector('.nb-set-row, .lang-toggle')?.getBoundingClientRect();
      const rMusic = music?.closest('.ap-row')?.getBoundingClientRect();
      return {
        title: detail?.querySelector('.nd-title')?.textContent ?? '',
        lang,
        hasMusic: !!music,
        hasSfx: !!sfx,
        labels,
        stacked: rLang && rMusic ? rMusic.top >= rLang.top - 2 : false,
        langOn: window.__TAO_RPG__.saveState().lang,
      };
    });
    check(`${T}: notebook 設定 has 語言 next to 音樂／音效`, nb.title === '設定' && nb.lang.map((l) => l.id).join() === 'both,zh,tao' && nb.hasMusic && nb.hasSfx && nb.labels.includes('語言') && nb.labels.includes('音樂') && nb.labels.includes('音效') && nb.stacked, nb);
    check(`${T}: notebook language shows the current 僅繁中`, nb.lang.find((l) => l.id === 'zh')?.on === true, nb.lang);
    await shot('notebook-settings', 700);

    await ev(() => document.querySelector('#nb-detail .lang-toggle [data-lang="tao"]').click());
    const afterNb = await ev(() => ({
      lang: window.__TAO_RPG__.saveState().lang,
      stored: localStorage.getItem('tao-rpg.lang'),
      on: [...document.querySelectorAll('#nb-detail .lang-toggle [data-lang]')].filter((b) => b.classList.contains('on')).map((b) => b.dataset.lang),
      zhHidden: document.getElementById('dlg-zh').classList.contains('hidden'),
      taoHidden: document.getElementById('dlg-tao').classList.contains('hidden'),
      taoText: document.getElementById('dlg-tao').textContent.trim(),
    }));
    // a line with no Tao text keeps showing 繁中 (at least one line is always visible)
    const shownRight = afterNb.taoText ? afterNb.zhHidden && !afterNb.taoHidden : !afterNb.zhHidden;
    check(`${T}: notebook 僅族語 switches live and persists`, afterNb.lang === 'tao' && afterNb.stored === 'tao' && afterNb.on.join() === 'tao' && shownRight, afterNb);

    await ev(() => window.__TAO_RPG__.closeJournal());
    await sleep(200);

    // 3) camera: before (0.1.4 default 22) / after (new default 25), reset-view, pinch-zoom still works
    await ev(() => {
      const g = window.__TAO_RPG__;
      for (let i = 0; i < 40 && g.mode() === 'dialogue'; i++) g.advanceDialogue();
      g.closeAll();
    });
    const limits = await ev(() => window.__TAO_RPG__.camLimits());
    check(`${T}: default camera is ${NEW_DIST} (was ${OLD_DIST})`, limits.def === NEW_DIST && limits.min === 16 && limits.max === 46, limits);

    await ev((d) => { const g = window.__TAO_RPG__; g.resetView(); g.setCamera({ dist: d, snap: true }); }, OLD_DIST);
    await sleep(200);
    check(`${T}: can still zoom to the old distance`, (await ev(() => window.__TAO_RPG__.cam().dist)) === OLD_DIST);
    await shot('cam-before', 1400);

    await ev(() => window.__TAO_RPG__.resetView());
    await sleep(200);
    const reset = await ev(() => window.__TAO_RPG__.cam());
    check(`${T}: reset-view returns to ${NEW_DIST}`, Math.abs(reset.dist - NEW_DIST) < 0.05, reset);
    await shot('cam-after', 1400);
    await shot('leader-male', 200);

    const leadShot = await ev(() => {
      const g = window.__TAO_RPG__;
      const bar = document.querySelector('#party-bar .pm[data-role="m"]');
      return {
        lead: g.party().controlled,
        outfit: g.outfit(),
        mOn: bar?.classList.contains('on') || bar?.classList.contains('active') || bar?.getAttribute('aria-pressed') === 'true' || bar?.classList.contains('sel'),
        mClass: bar?.className ?? null,
      };
    });
    check(`${T}: start shot is the 族男`, leadShot.lead === 'm' && leadShot.outfit === 'player', leadShot);

    await ev((d) => window.__TAO_RPG__.zoomTo(d), 16);
    check(`${T}: pinch/zoom can still reach the closest view`, (await ev(() => window.__TAO_RPG__.cam().dist)) === 16);
    await ev((d) => window.__TAO_RPG__.zoomTo(d), 46);
    check(`${T}: pinch/zoom can still reach the farthest view`, (await ev(() => window.__TAO_RPG__.cam().dist)) === 46);
    await ev(() => window.__TAO_RPG__.resetView());
    check(`${T}: reset-view after a zoom returns to ${NEW_DIST}`, Math.abs((await ev(() => window.__TAO_RPG__.cam().dist)) - NEW_DIST) < 0.05);

    // 4) language survives a reload (stored setting + save)
    await ev(() => window.__TAO_RPG__.saveNow?.());
    await page.reload({ waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    const reloaded = await ev(() => ({ stored: localStorage.getItem('tao-rpg.lang'), startOn: [...document.querySelectorAll('#origin-screen .lang-toggle [data-lang]')].filter((b) => b.classList.contains('on')).map((b) => b.dataset.lang) }));
    check(`${T}: language still 僅族語 after reload`, reloaded.stored === 'tao' && reloaded.startOn.join() === 'tao', reloaded);

    // 5) 0.1.5 English interface: same three dialogue modes, now Tao + English / English only / Tao only
    await ev(() => { window.__TAO_RPG__.clearSave(); localStorage.setItem('tao-rpg.ui', 'en'); localStorage.setItem('tao-rpg.lang', 'both'); });
    await page.reload({ waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    await page.waitForSelector('#origin-screen', { visible: true, timeout: 15000 });
    const enStart = await ev(() => {
      const bar = document.querySelector('#origin-screen .menu-sound');
      return {
        ui: document.documentElement.dataset.ui,
        modes: [...(bar?.querySelectorAll('.lang-toggle [data-lang]') ?? [])].map((b) => b.textContent),
        uiOn: [...(bar?.querySelectorAll('[data-ui-lang]') ?? [])].filter((b) => b.classList.contains('on')).map((b) => b.textContent),
        labels: [...(bar?.querySelectorAll('.ms-lang-label') ?? [])].map((e) => e.textContent),
        sound: [...(bar?.querySelectorAll('button[data-ch]') ?? [])].map((b) => b.textContent),
      };
    });
    check(`${T}: English start bar: Language 中文/English + Dialogue Tao + English / English only / Tao only`, enStart.ui === 'en' && enStart.modes.join('|') === 'Tao + English|English only|Tao only' && enStart.uiOn.join() === 'English' && enStart.labels.join('|') === 'Language|Dialogue' && enStart.sound.every((t) => /^(♪ )?(Music|Sound effects): (On|Off)$/.test(t)), enStart);
    await page.select('#sel-origin-m', 'yayo'); await page.select('#sel-origin-f', 'yayo');
    await page.click('#btn-gender-f');
    await page.click('#origin-go');
    await page.waitForFunction(() => window.__TAO_RPG__.mode() === 'dialogue', { timeout: 15000 });
    await sleep(900);
    const readDlg = () => ev(() => ({
      zh: document.getElementById('dlg-zh').textContent.trim(),
      tao: document.getElementById('dlg-tao').textContent.trim(),
      zhHidden: document.getElementById('dlg-zh').classList.contains('hidden'),
      taoHidden: document.getElementById('dlg-tao').classList.contains('hidden'),
      who: document.querySelector('#dialogue .dlg-who, #dlg-who')?.textContent ?? '',
    }));
    const d1 = await readDlg();
    check(`${T}: English + Tao + English: the translation line is English`, !d1.zhHidden && d1.zh.length > 0 && !/[\u3400-\u9fff]/.test(d1.zh + d1.who), d1);
    await ev(() => window.__TAO_RPG__.setLang?.('zh'));
    await sleep(300);
    const d2 = await readDlg();
    check(`${T}: English only hides the Tao line`, d2.taoHidden && !d2.zhHidden && !/[\u3400-\u9fff]/.test(d2.zh), d2);
    await shot('english-dialogue', 500);

    // 6) 0.1.5: 中文＋English — picker labels in both languages, a small English line under the Chinese one,
    //    the Chinese a little smaller than in 中文 only; single-language modes keep the normal size
    const dlgAt = async (ui, mode, name) => {
      await ev((a) => { window.__TAO_RPG__.clearSave(); localStorage.setItem('tao-rpg.ui', a.ui); localStorage.setItem('tao-rpg.lang', a.mode); }, { ui, mode });
      await page.reload({ waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
      await page.waitForSelector('#origin-screen', { visible: true, timeout: 15000 });
      const picker = await ev(() => [...document.querySelectorAll('#origin-screen .menu-sound [data-ui-lang]')].map((b) => ({ id: b.dataset.uiLang, t: b.textContent, on: b.classList.contains('on') })));
      await page.select('#sel-origin-m', 'yayo'); await page.select('#sel-origin-f', 'yayo');
      await page.click('#btn-gender-f');
      await page.click('#origin-go');
      await page.waitForFunction(() => window.__TAO_RPG__.mode() === 'dialogue', { timeout: 15000 });
      await sleep(900);
      await ev(() => window.__TAO_RPG__.finishTyping?.());
      const d = await ev(() => {
        const px = (id) => { const e = document.getElementById(id); return e && !e.classList.contains('hidden') ? parseFloat(getComputedStyle(e).fontSize) : 0; };
        const tx = (id) => document.getElementById(id)?.textContent.trim() ?? '';
        return { ui: document.documentElement.dataset.ui, zh: tx('dlg-zh'), en: tx('dlg-en'), zhPx: px('dlg-zh'), enPx: px('dlg-en'), taoPx: px('dlg-tao') };
      });
      if (name) { await sleep(1500); await ev(() => window.__TAO_RPG__.finishTyping?.()); await shot(name, 400); }
      return { picker, ...d };
    };
    const bi = await dlgAt('zhen', 'both', 'dialogue-bilingual');
    check(`${T}: picker shows 中文 / English / 中文＋English (never translated)`, bi.picker.map((p) => p.t).join('|') === '中文|English|中文＋English' && bi.picker.find((p) => p.on)?.id === 'zhen', bi.picker);
    check(`${T}: 中文＋English: Chinese line + a small English line`, bi.ui === 'zhen' && /[\u3400-\u9fff]/.test(bi.zh) && bi.en.length > 0 && !/[\u3400-\u9fff]/.test(bi.en) && bi.enPx > 0 && bi.enPx <= bi.zhPx * 0.85, bi);
    const biZh = await dlgAt('zhen', 'zh', '');
    const one = await dlgAt('zh', 'both', 'dialogue-zh-only');
    check(`${T}: 中文 only: no English line, normal size`, one.ui === 'zh' && one.enPx === 0 && one.zhPx > bi.zhPx, { one, bi: bi.zhPx });
    check(`${T}: 中文＋English (no Tao line) keeps the small English line`, biZh.enPx > 0 && biZh.enPx < biZh.zhPx && biZh.zhPx === bi.zhPx, biZh);
    const en1 = await dlgAt('en', 'zh', 'dialogue-en-only');
    // Cormorant runs small: English only is a little larger than 中文 only (×1.08), never smaller
    check(`${T}: English only: no second English line, a little larger than 中文 only`, en1.ui === 'en' && en1.enPx === 0 && en1.zhPx > one.zhPx && en1.zhPx <= one.zhPx * 1.12 && !/[\u3400-\u9fff]/.test(en1.zh), { en: en1.zhPx, zh: one.zhPx });
    await ev(() => { localStorage.removeItem('tao-rpg.ui'); window.__TAO_RPG__.clearSave(); });

    await page.close();
  }
  // 7) 0.1.5: no saved choice → the browser language: Chinese → 中文 only, English or other → 中文＋English
  for (const [bl, want] of [['zh-TW', 'zh'], ['zh-CN', 'zh'], ['en-US', 'zhen'], ['ja-JP', 'zhen']]) {
    const page = await browser.newPage();
    await pageLang(page, bl);
    page.on('pageerror', (e) => report.errors.push(`browser ${bl}: ${e}`));
    await page.goto(debugUrl(srv.base), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate(() => localStorage.removeItem('tao-rpg.ui'));
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => !!document.documentElement.dataset.ui, { timeout: 60000 });
    const got = await page.evaluate(() => ({ ui: document.documentElement.dataset.ui, nav: navigator.language, stored: localStorage.getItem('tao-rpg.ui') }));
    check(`browser ${bl} with no saved choice → ${want}`, got.ui === want && got.stored === null, got);
    await page.close();
  }
} catch (e) {
  report.fails.push(`crash: ${e?.stack || e}`);
  console.log('FAIL crash', e?.stack || e);
} finally {
  await browser?.close();
  await srv.close();
}
for (const e of report.errors) console.log('console error:', e);
for (const e of report.http4xx) console.log('http:', e);
const bad = report.fails.length + report.errors.length + report.http4xx.length;
console.log(bad ? `FAIL: ${report.fails.length} check(s), ${report.errors.length} console error(s), ${report.http4xx.length} 4xx` : 'ALL OK');
process.exit(bad ? 1 : 0);
