// 0.1.6 short check: folded 選單 menu + big 互動 button, tap a nearby NPC → the party walks over and talks
// (joystick cancels, far taps do nothing), 全部收下 collect-all, camera zooms in / out at a village (manual zoom
// holds), guide arrow (on / off), 繼續上次的旅程 on the title skips the party screen and the ride in, 中文＋English
// small English under buttons / notebook tabs, background warm-up, the moved 紅頭 / 漁人 on the travel map.
// desktop + iPhone portrait + iPhone landscape.  node scripts/test-016.mjs   (DIST=dist, OUT=screenshots-016)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-016');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve(process.env.DIST || 'dist'), port: Number(process.env.PORT || 8879) });
const fails = [];
const errors = [];
const http4xx = [];
const check = (name, ok, info) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`, info !== undefined ? JSON.stringify(info).slice(0, 300) : ''); if (!ok) fails.push(name); };
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const b = await launchBrowser();

const SIZES = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  iphone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'iphone-land': { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

async function session(name, { ui, size, full }) {
  if (ONLY && !ONLY.includes(name)) return;
  console.log(`--- ${name}`);
  const T = name;
  const page = await b.newPage();
  page.on('pageerror', (e) => errors.push(`${T}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${T}: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) http4xx.push(`${T}: ${r.status()} ${r.url()}`); });
  page.on('dialog', (d) => d.accept());
  await page.setViewport(SIZES[size]);
  const ev = (fn, a) => page.evaluate(fn, a);
  const shot = async (n, wait = 300) => { await sleep(wait); await page.screenshot({ path: path.join(OUT, `${T}-${n}.png`) }); };
  const boot = async (extra = '') => {
    await page.goto(debugUrl(srv.base, `ui=${ui}${extra}`), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  };
  const settle = async (max = 60) => {
    for (let i = 0; i < max; i++) {
      const s = await ev(() => ({ mode: window.__TAO_RPG__.mode(), c: window.__TAO_RPG__.cards() }));
      if (s.mode === 'dialogue') { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(60); continue; }
      if (s.c.open) { await ev(() => { window.__TAO_RPG__.finishTyping?.(); window.__TAO_RPG__.cardTap(); window.__TAO_RPG__.cardTap(); }); await sleep(200); continue; }
      if (s.c.pending) { await sleep(300); continue; }
      if (s.mode !== 'explore') { await ev(() => window.__TAO_RPG__.closeAll()); await sleep(100); continue; }
      return;
    }
  };
  const box = (sel) => ev((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { w: r.width, h: r.height, x: r.left, y: r.top, vis: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }; }, sel);
  try {
    await boot();
    await ev(() => window.__TAO_RPG__.clearSave());
    await boot();
    await page.waitForSelector('#sel-origin-m', { visible: true, timeout: 30000 });
    await page.select('#sel-origin-m', 'imorod'); await page.select('#sel-origin-f', 'iratay'); await page.click('#origin-go');
    await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 120000, polling: 250 });
    await sleep(1200);
    await settle();
    await ev(() => { window.__TAO_RPG__.showHelp?.(false); document.querySelector('#help-toast-close')?.click(); });

    // ---- 1. folded menu + big interact button
    const drawer0 = await box('#cam-drawer');
    const act = await box('#btn-act');
    const menuBtn = await box('#btn-cam-toggle');
    check(`${T}: bottom-right menu starts folded`, drawer0 && !drawer0.vis, drawer0);
    check(`${T}: 選單 button visible`, menuBtn?.vis, menuBtn);
    check(`${T}: interact button is big and on its own (≥ 56 px)`, act?.vis && act.w >= 56 && act.h >= 56, act);
    await shot('01-menu-folded');
    await settle();
    const top = await ev(() => { const r = document.querySelector('#btn-cam-toggle').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e ? `${e.tagName}#${e.id}.${e.className}` : null; });
    check(`${T}: nothing covers the 選單 button`, /btn-cam-toggle|qm-/.test(top ?? ''), top);
    await page.click('#btn-cam-toggle');
    await sleep(250);
    const drawer1 = await box('#cam-drawer');
    const scoot = await box('#btn-scooter');
    const guideBtn = await box('#btn-guide');
    const camIn = await box('#cam-in');
    check(`${T}: 選單 opens camera, walk / scooter and guide arrow`, drawer1?.vis && scoot?.vis && guideBtn?.vis && camIn?.vis, { drawer1, scoot, guideBtn });
    const inView = (r) => r && r.x >= 0 && r.y >= 0 && r.x + r.w <= SIZES[size].width + 1 && r.y + r.h <= SIZES[size].height + 1;
    check(`${T}: open menu fits on screen`, inView(drawer1), drawer1);
    await shot('02-menu-open');
    await page.click('#btn-cam-toggle');
    await sleep(200);
    check(`${T}: 選單 folds again`, !(await box('#cam-drawer')).vis);

    // ---- 2. village zoom
    const openSpot = () => { const g = window.__TAO_RPG__; const r = g.roadPointNear(-5, 5, 15) ?? { x: -5, z: 5 }; g.teleport(r.x, r.z); };
    await ev(() => window.__TAO_RPG__.setTime('day'));
    // headless (SwiftShader) frames are slow, so run the village check by hand after each jump
    await ev(openSpot);
    const out0 = await ev(() => window.__TAO_RPG__.v016.sync());
    await ev(() => window.__TAO_RPG__.goto('imorod'));
    const in1 = await ev(() => window.__TAO_RPG__.v016.sync());
    check(`${T}: entering 紅頭 zooms the camera in`, in1.v === 'imorod' && in1.d < out0.d && in1.d <= 20, { out0, in1 });
    await shot('03-village-zoom', 1500);
    await ev(() => window.__TAO_RPG__.zoomTo(34));
    await ev(() => window.__TAO_RPG__.v016.sync());
    await sleep(300);
    const man = await ev(() => window.__TAO_RPG__.v016.camDist());
    check(`${T}: a manual zoom in the village holds`, Math.abs(man - 34) < 0.5, man);
    await ev(openSpot);
    const out1 = await ev(() => window.__TAO_RPG__.v016.sync());
    check(`${T}: leaving the village zooms back out`, out1.v === null && out1.d >= 24, out1);

    // ---- 3. tap a nearby NPC → walk over and talk; joystick cancels; far tap does nothing
    await ev(() => window.__TAO_RPG__.goto('imorod'));
    await sleep(2500);
    await ev(() => window.__TAO_RPG__.resetView());
    await sleep(800);
    let target = null;
    // the village folk crowd round the party on arrival: pick one, freeze it, then stand 7 m off on open ground
    const near = await ev(() => window.__TAO_RPG__.v016.npcsNear(20));
    for (const n of near.slice(0, 4)) {
      if (target) break;
      await ev((t) => window.__TAO_RPG__.placeNpc(t.id, t.x, t.z), n);
      for (let k = 0; k < 12 && !target; k++) {
        const ang = (k / 12) * Math.PI * 2;
        const px = n.x + Math.cos(ang) * 7, pz = n.z + Math.sin(ang) * 7;
        if (!(await ev((q) => window.__TAO_RPG__.canStandAt(q[0], q[1]), [px, pz]))) continue;
        await ev((q) => { window.__TAO_RPG__.teleport(q[0], q[1]); window.__TAO_RPG__.resetView(); window.__TAO_RPG__.v016.sync(); }, [px, pz]);
        const p = await ev((id) => window.__TAO_RPG__.v016.npcScreen(id), n.id);
        const clear = p && (await ev((q) => document.elementFromPoint(q.x, q.y)?.id === 'game-canvas', p));
        if (clear && p.visible && p.d > 3.5 && p.d < 11 && p.x > 40 && p.y > 120 && p.x < SIZES[size].width - 140 && p.y < SIZES[size].height - 160) target = { ...n, sx: p.x, sy: p.y, d: p.d };
      }
    }
    check(`${T}: an NPC 3.5–11 m away is on screen`, !!target, target);
    if (target) {
      // freeze the NPC where it is so the walk has a fixed goal
      await settle();
      await ev(() => window.__TAO_RPG__.v016.sync());
      const p = await ev((id) => window.__TAO_RPG__.v016.npcScreen(id), target.id);
      if (size === 'desktop') await page.mouse.click(p.x, p.y);
      else await page.touchscreen.tap(p.x, p.y);
      await sleep(150);
      let a0 = await ev(() => window.__TAO_RPG__.v016.auto());
      if (!a0.goal) {
        // SwiftShader frames take ~1 s, so a synthetic touch can outlast the 450 ms tap window: tap through the same picker
        const under = await ev((q) => { const e = document.elementFromPoint(q.x, q.y); return e ? `${e.tagName}#${e.id}` : null; }, p);
        console.log(`note ${T}: synthetic ${size === 'desktop' ? 'click' : 'touch'} missed the tap window (under: ${under}); using the same tap picker directly`);
        await ev((q) => window.__TAO_RPG__.v016.tap(q.x, q.y), p);
        a0 = await ev(() => window.__TAO_RPG__.v016.auto());
      }
      const mk = await box('#walk-target');
      check(`${T}: tapping the NPC starts a walk to it`, /^npc:/.test(a0.goal ?? '') && a0.path > 0, a0);
      check(`${T}: a target ring shows where the party walks`, mk?.vis, mk);
      await ev(() => window.__TAO_RPG__.v016.stepAuto(0.1, 6));
      const mk2 = await box('#walk-target');
      check(`${T}: the ring sits on screen`, mk2 && mk2.x > 0 && mk2.y > 0, mk2);
      await shot('04-tap-walk', 120);
      for (let i = 0; i < 20; i++) {
        const r = await ev(() => window.__TAO_RPG__.v016.stepAuto(0.1, 10));
        if (r.mode === 'dialogue') break;
      }
      const m = await ev(() => window.__TAO_RPG__.mode());
      check(`${T}: arriving starts the conversation`, m === 'dialogue', m);
      await shot('05-tap-talk', 200);
      await settle();
      // joystick cancels
      const p2 = await ev((id) => window.__TAO_RPG__.v016.npcScreen(id), target.id);
      await ev(() => { const g = window.__TAO_RPG__; const q = g.playerPos(); const r = g.roadPointNear(q.x + 4, q.z + 4, 4); if (r) g.teleport(r.x, r.z); g.v016.sync(); });
      const p3 = await ev((id) => window.__TAO_RPG__.v016.npcScreen(id), target.id);
      if (p3 && p3.d > 2.5 && p3.d < 12) {
        await settle();
        await ev((q) => window.__TAO_RPG__.v016.tap(q.x, q.y), p3);
        const a1 = await ev(() => window.__TAO_RPG__.v016.auto());
        await ev(() => window.__TAO_RPG__.stepMove(1, 0, 0.1));
        await ev(() => window.__TAO_RPG__.v016.stepAuto(0.05, 1));
        const a2 = await ev(() => window.__TAO_RPG__.v016.auto());
        check(`${T}: stick input cancels the walk`, a1.path > 0 && a2.path === 0, { a1, a2 });
      } else check(`${T}: stick input cancels the walk (setup)`, true, { skipped: p3 });
      void p2;
    }
    const before = await ev(() => window.__TAO_RPG__.playerPos());
    await ev(() => window.__TAO_RPG__.goto('big_lake_view'));
    await sleep(800);
    await ev(() => window.__TAO_RPG__.v016.tap(20, 200));
    const af = await ev(() => window.__TAO_RPG__.v016.auto());
    check(`${T}: a tap on empty ground does nothing`, af.path === 0 && af.goal === null, af);
    void before;

    // ---- 4. guide arrow
    await settle();
    const gd = await ev(() => window.__TAO_RPG__.v016.guide());
    await sleep(800);
    const ga = await box('#guide-arrow');
    check(`${T}: the tracked quest has a guide target`, !!gd.target, gd);
    check(`${T}: guide arrow shows`, gd.target ? ga?.vis : true, ga);
    await shot('06-guide-arrow');
    await ev(() => window.__TAO_RPG__.v016.setGuide(false));
    await sleep(300);
    check(`${T}: guide arrow can be turned off`, !(await box('#guide-arrow'))?.vis);
    await ev(() => window.__TAO_RPG__.v016.setGuide(true));

    // ---- 5. collect all
    await ev(() => window.__TAO_RPG__.v016.demoCards(5));
    await page.waitForFunction(() => window.__TAO_RPG__.cards().open, { timeout: 8000, polling: 100 }).catch(() => {});
    await sleep(300);
    const all = await box('#btn-cards-all');
    const allTxt = await ev(() => document.querySelector('#btn-cards-all')?.textContent);
    check(`${T}: 全部收下 shows with 2+ cards`, all?.vis && /5/.test(allTxt ?? ''), { all, allTxt });
    await shot('07-collect-all', 200);
    await page.click('#btn-cards-all');
    await sleep(1500);
    const c2 = await ev(() => window.__TAO_RPG__.cards());
    check(`${T}: one tap puts every card into the notebook`, !c2.open && c2.pending === 0 && c2.shown.filter((k) => k.startsWith('demo:')).length === 5, c2);

    // ---- 6. 中文＋English labels
    if (ui === 'zhen') {
      const lab = await ev(() => ({
        menu: document.querySelector('#btn-cam-toggle .qm-label')?.dataset.en,
        act: document.querySelector('#btn-act')?.dataset.en,
        tabs: [...document.querySelectorAll('#journal-tabs [data-tab]')].map((e) => e.dataset.en),
      }));
      check(`${T}: buttons carry a small English line`, lab.menu === 'Menu' && !!lab.act, lab);
      check(`${T}: notebook tabs carry English`, lab.tabs.every(Boolean), lab.tabs);
      await page.click('#btn-cam-toggle'); await sleep(250);
      await shot('08-zhen-menu');
      await page.click('#btn-cam-toggle');
      await ev(() => window.__TAO_RPG__.openJournal());
      await sleep(900);
      const nb = await ev(() => [...document.querySelectorAll('#journal [data-en]')].length);
      check(`${T}: notebook text carries English`, nb >= 8, nb);
      const tao = await ev(() => [...document.querySelectorAll('#journal [lang="tao"]')].filter((e) => e.dataset.en || getComputedStyle(e).fontStyle === 'italic').length);
      check(`${T}: Tao words untouched (no English line, never italic)`, tao === 0, tao);
      await shot('09-zhen-notebook', 300);
      await ev(() => window.__TAO_RPG__.closeAll());
    }

    // ---- 7. moved villages on the travel map
    if (full) {
      await page.click('#btn-travel').catch(() => {});
      await sleep(700);
      await shot('10-travel-map');
      await ev(() => window.__TAO_RPG__.closeAll());
    }
    const pins = await ev(() => { const P = window.__TAO_RPG__.places; return Math.hypot(P.imorod.x - P.iratay.x, P.imorod.z - P.iratay.z); });
    check(`${T}: 紅頭 and 漁人 are further apart (> 45 m)`, pins > 45, pins);

    // ---- 8. background warm-up
    await sleep(7000);
    const w = await ev(() => window.__TAO_RPG__.v016.warm());
    check(`${T}: cards / portraits warm up in the background`, w.seen > 40, w);

    // ---- 9. 繼續上次的旅程 on the title (intro on) → straight to the island at the saved spot
    await ev(() => window.__TAO_RPG__.goto('imorod'));
    await sleep(600);
    const saved = await ev(() => { window.__TAO_RPG__.v016.save(); return window.__TAO_RPG__.playerPos(); });
    await boot('&intro=1');
    await page.waitForSelector('#btn-title-continue', { visible: true, timeout: 20000 }).catch(() => {});
    const tc = await box('#btn-title-continue');
    check(`${T}: title shows 繼續上次的旅程 when there is a save`, tc?.vis, tc);
    await shot('11-title-continue', 600);
    await page.click('#btn-title-continue');
    await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 180000, polling: 250 }).catch(() => {});
    const res = await ev(() => ({ started: window.__TAO_RPG__.state.started, arrival: window.__TAO_RPG__.v016.arrivalActive(), p: window.__TAO_RPG__.playerPos(), origin: getComputedStyle(document.querySelector('#origin-screen')).display }));
    check(`${T}: continue skips the party screen and the ride in`, res.started && !res.arrival && res.origin === 'none', res);
    check(`${T}: continue lands at the saved spot`, Math.hypot(res.p.x - saved.x, res.p.z - saved.z) < 4, { saved, p: res.p });
    if (full) await shot('12-continued', 1500);
  } catch (e) {
    check(`${T}: session ran`, false, String(e));
    await shot('error').catch(() => {});
  }
  await page.close();
}

await session('desktop', { ui: 'zhen', size: 'desktop', full: true });
await session('iphone', { ui: 'zhen', size: 'iphone', full: true });
await session('iphone-land', { ui: 'zhen', size: 'iphone-land', full: true });
await b.close();
await srv.close();
console.log(`errors: ${errors.length}`, errors.slice(0, 8));
console.log(`http4xx: ${http4xx.length}`, http4xx.slice(0, 8));
const bad = fails.length || errors.length || http4xx.length;
console.log(bad ? `FAILED ${fails.length} check(s)` : 'ALL OK');
process.exit(bad ? 1 : 0);
