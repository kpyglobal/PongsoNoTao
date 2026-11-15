// 0.1.4 arrival opening: title screen → party → 搭飛機／搭船 (shared Lanyu vista) → painted ride (pull back to
// the window / bow, then bank or drive-off) → notebook stamps 抵達蘭嶼 complete → the party starts at the matching
// spot (plane: the ring road by 蘭嶼機場; boat: 開元港). Checks the culture statement still opens the game, Q01 is
// in the quest log as done, Q02–Q04 unlock, the choice is saved, skipping works and an older save skips the opening.
// Desktop + iPhone-size touch. Screenshots → screenshots-014/.
//   PORT=8860 node scripts/test-intro.mjs   (needs `npm run build` first; LIVE_URL=… for a deployed site)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-014');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = process.env.LIVE_URL ? { base: process.env.LIVE_URL, close: async () => {} } : await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8860) });
const report = { errors: [], http4xx: [], fails: [] };
const check = (name, ok, info) => {
  if (!ok) report.fails.push(name);
  console.log(ok ? 'ok  ' : 'FAIL', name, info !== undefined ? JSON.stringify(info).slice(0, 260) : '');
};
let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1280, height: 800, deviceScaleFactor: 1 } },
    { tag: 'iphone', v: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ]) {
    const T = vp.tag;
    const touch = !!vp.v.hasTouch;
    const page = await browser.newPage();
    page.on('pageerror', (e) => report.errors.push(`${T}: ${e}`));
    page.on('dialog', (d) => d.accept());
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${T}: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400) report.http4xx.push(`${r.status()} ${r.url()}`); });
    await page.setViewport(vp.v);
    const ev = (fn, a) => page.evaluate(fn, a);
    const press = async (sel) => { await page.waitForSelector(sel, { visible: true, timeout: 20000 }); if (touch) await page.tap(sel); else await page.click(sel); };
    const shot = async (name) => { await page.screenshot({ path: path.join(OUT, name) }); console.log('captured', name); };
    const load = async () => {
      await page.goto(debugUrl(srv.base, 'intro=1'), { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    };
    const arr = () => ev(() => window.__TAO_RPG__.arrival());
    const waitT = async (t, max = 120000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < max) { const a = await arr(); if (!a.playing || a.t >= t) return a; await sleep(150); }
      return arr();
    };
    const waitStarted = async (max = 120000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < max) { if (await ev(() => window.__TAO_RPG__.state.started && !window.__TAO_RPG__.arrival().playing)) return true; await sleep(200); }
      return false;
    };
    const drain = async () => {
      const seen = [];
      for (let i = 0; i < 40; i++) {
        if ((await ev(() => window.__TAO_RPG__.mode())) !== 'dialogue') break;
        seen.push(...(await ev(() => window.__TAO_RPG__.dialogueQueue().slice(0, 1))));
        await ev(() => window.__TAO_RPG__.advanceDialogue());
        await sleep(60);
      }
      return seen;
    };

    for (const way of ['plane', 'boat']) {
      const W = `${T} ${way}`;
      await load();
      await ev(() => window.__TAO_RPG__.clearSave());
      await load();
      let a = await arr();
      check(`${W}: title screen first`, a.screen === 'title' && a.introEnabled, a);
      if (T === 'desktop' && way === 'plane') { await sleep(1500); await shot('07-title-screen.png'); }
      if (way === 'plane') {
        // 音樂 / 音效 toggles on the start screens: same saved settings as the in-game ♪ panel
        const ms = await ev(() => [...document.querySelectorAll('#title-screen .menu-sound button')].map((b) => b.textContent));
        check(`${W}: start menu has 音樂 / 音效 toggles`, ms.length === 2 && ms[0].includes('音樂') && ms[1].includes('音效'), ms);
        await press('#title-screen .ms-music');
        await sleep(150);
        const st1 = await ev(() => ({ saved: JSON.parse(localStorage.getItem('tao-rpg.audio') || '{}').musicOn, label: document.querySelector('#title-screen .ms-music').textContent, still: !!document.querySelector('#title-screen') && getComputedStyle(document.getElementById('title-screen')).display !== 'none', panel: document.querySelector('#audio-panel .ap-tg[data-ch=music]')?.textContent }));
        check(`${W}: music toggle off is saved and matches the ♪ panel`, st1.saved === false && st1.label.includes('關') && st1.still && (st1.panel ?? '關') === '關', st1);
        await press('#title-screen .ms-music');
        await sleep(150);
        const st2 = await ev(() => JSON.parse(localStorage.getItem('tao-rpg.audio') || '{}').musicOn);
        check(`${W}: music toggle back on`, st2 === true, st2);
      }
      await press('#btn-title-start');
      await sleep(400);
      check(`${W}: title → party screen`, (await arr()).screen === 'origin');
      await press('#btn-origin-yayo');
      await press('#btn-gender-f');
      await press('#origin-go');
      await sleep(500);
      a = await arr();
      check(`${W}: party → 搭飛機／搭船 screen`, a.screen === 'arrival' && !a.playing, a);
      const labels = await ev(() => [...document.querySelectorAll('#arrival-screen .ap-name')].map((n) => n.textContent));
      check(`${W}: choices 搭飛機 / 搭船`, labels.join(',') === '搭飛機,搭船', labels);
      if (way === 'plane') {
        // the back button returns to the party screen, then forward again
        await press('#btn-arrive-back');
        await sleep(300);
        check(`${W}: 回上一步 → party screen`, (await arr()).screen === 'origin');
        await page.hover('#btn-gender-m').catch(() => {});
        await sleep(200);
        const ms2 = await ev(() => ({ menu: { ...(window.__sfx?.menu ?? {}) }, running: window.__TAO_RPG__.audioState?.()?.unlocked ?? null }));
        check(`${W}: menu sounds play (confirm on select, cancel on back, move on hover)`, (ms2.menu.menu_confirm ?? 0) > 0 && (ms2.menu.menu_cancel ?? 0) > 0 && (ms2.menu.menu_move ?? 0) > 0, ms2);
        await press('#origin-go');
        await sleep(500);
        if (T === 'desktop') {
          await shot('08-arrival-choice.png');
          await shot('20-pre-island.png'); // shared Lanyu vista behind the choice (same angle for both routes)
        } else await shot('14-arrival-choice-iphone.png');
      }
      await press(`#btn-arrive-${way}`);
      await sleep(250);
      a = await arr();
      check(`${W}: painted ride playing (separate intro scene)`, a.playing && a.way === way && a.phase === 'intro' && a.introScene && a.introMode === way && a.screen === 'intro', a);
      check(`${W}: title music keeps playing (no game start yet)`, !(await ev(() => window.__TAO_RPG__.state.started)));
      // the island loads in the background: loading bar lower left until it is done
      const lb = await ev(() => { const e = document.getElementById('ai-load'); const r = e.getBoundingClientRect(); return { shown: getComputedStyle(e).display !== 'none' && r.width > 0, left: r.left, bottom: r.bottom, h: innerHeight, w: innerWidth, label: document.getElementById('ai-load-label').textContent }; });
      check(`${W}: loading bar at the lower left`, lb.shown && lb.left < lb.w * 0.2 && lb.bottom > lb.h * 0.6, lb);
      if (way === 'plane' && T === 'desktop') await shot('16-arrival-loading-bar.png');
      if (way === 'plane') {
        // pull back from the shared Lanyu vista to reveal the cabin window and the wing, then hold (bob) while loading
        await ev(() => window.__TAO_RPG__.seekIntro(0.15));
        await sleep(250);
        a = await arr();
        check(`${W}: plane starts pulling back (window / wing coming in)`, a.introPose && a.introPose.mode === 'plane' && a.introPose.layers >= 3 && (a.introPose.phase === 'reveal' || a.introPose.reveal < 1), a.introPose);
        await ev(() => window.__TAO_RPG__.seekIntro(2.6));
        await sleep(400);
        a = await arr();
        check(`${W}: window and wing revealed, island in view, holding`, a.introPose && a.introPose.overlay > 0.7 && a.introPose.phase === 'hold' && a.introPose.finale === 0, a.introPose);
        if (T === 'desktop') await shot('09-arrival-plane-clouds.png');
        else await shot('17-arrival-plane-iphone.png');
      } else {
        await ev(() => window.__TAO_RPG__.seekIntro(2.6));
        await sleep(500);
        a = await arr();
        check(`${W}: yacht bow revealed over the painted sea (pitch / roll)`, a.introPose && a.introPose.mode === 'boat' && a.introPose.layers >= 3 && a.introPose.overlay > 0.7 && Math.abs(a.introPose.pitch) <= 1 && Math.abs(a.introPose.roll) < 0.05, a.introPose);
        if (T === 'desktop') await shot('10-arrival-yacht.png');
        else await shot('15-arrival-yacht-iphone.png');
      }
      const logo = await ev(() => document.getElementById('arrival-intro').classList.contains('logo-on'));
      a = await arr();
      check(`${W}: logo shown with the title music`, logo || a.t < a.logoAt + 0.2, { logo, t: a.t, logoAt: a.logoAt });
      if (way === 'plane') {
        // logo stays until loading is done and the title's epic opening is over; it fades before the bank
        const t0 = Date.now();
        let sawLoadedLogo = false;
        let sawFinale = 0;
        let sawBank = 0;
        let sawNotebook = false;
        let tookBank = false;
        let tookNb = false;
        let heapBefore = null;
        let heapAfter = null;
        let heldLogoOut = null;
        let heldMinEnd = 0;
        const cdp = await page.target().createCDPSession();
        const gcHeap = async () => { await cdp.send('HeapProfiler.collectGarbage'); const h = await cdp.send('Runtime.getHeapUsage'); return +(h.usedSize / 1048576).toFixed(1); };
        while (Date.now() - t0 < 180000) {
          a = await arr();
          if (a.logoOut != null) { heldLogoOut = a.logoOut; heldMinEnd = a.minEnd; }
          if (a.worldReady && a.phase === 'intro' && a.introScene && heapBefore === null) heapBefore = await gcHeap();
          if (a.worldReady && a.phase === 'intro' && a.logoOut === null && a.t > a.logoAt + 0.2) sawLoadedLogo = sawLoadedLogo || (await ev(() => document.getElementById('arrival-intro').classList.contains('logo-on')));
          if (a.introPose && (a.introPose.finale > 0 || a.introPose.phase === 'finale' || a.introPose.phase === 'fade')) {
            sawFinale = Math.max(sawFinale, a.introPose.finale || a.introPose.push || 0);
            sawBank = Math.max(sawBank, a.introPose.bank || 0);
            if (T === 'desktop' && !tookBank && (a.introPose.bank > 0.35 || a.introPose.finale > 0.45)) {
              await shot('23-plane-bank.png');
              tookBank = true;
            }
          }
          if (a.phase === 'notebook') {
            sawNotebook = true;
            if (heapAfter === null) heapAfter = await gcHeap();
            if (T === 'desktop' && !tookNb && a.t) {
              await sleep(500);
              await shot('28-notebook-complete.png');
              tookNb = true;
            }
          }
          if (!a.playing) break;
          await sleep(150);
        }
        check(`${W}: logo held until loaded + epic opening over`, heldLogoOut !== null && heldLogoOut >= heldMinEnd - 0.01 && sawLoadedLogo, { logoOut: heldLogoOut, minEnd: heldMinEnd, sawLoadedLogo, phase: a.phase });
        check(`${W}: logo faded before the bank / drive-off`, sawFinale > 0.3, { sawFinale, logoOut: heldLogoOut });
        check(`${W}: plane banks and turns toward the island`, sawBank > 0.25 || tookBank, { sawBank, tookBank });
        check(`${W}: notebook opens on 抵達蘭嶼`, sawNotebook, { phase: a.phase, sawNotebook });
        if (heapAfter === null) heapAfter = await gcHeap();
        const mem = await ev(() => window.__TAO_RPG__.introMemory());
        mem.gcHeapMB = { introAlive: heapBefore, introDisposed: heapAfter };
        console.log('intro memory', JSON.stringify(mem));
        check(`${W}: intro scene disposed (fewer textures / geometries)`, !a.introScene && mem.before && mem.after && mem.after.textures < mem.before.textures && mem.after.geometries < mem.before.geometries, mem);
        report.mem = report.mem || {};
        report.mem[T] = mem;
      } else if (T === 'desktop') {
        // drive-off frame, then skip the rest of the painted shot (notebook still runs, or a second skip starts the game)
        await ev(() => window.__TAO_RPG__.seekFinale?.(1.4));
        await sleep(400);
        await shot('27-yacht-driveoff.png');
      }
      // plane: let it play to the end; boat: skip (key on desktop, tap on the phone); a skip while loading waits
      const tSkip = Date.now();
      if (way === 'boat') {
        if (touch) await page.tap('#arrival-intro');
        else await page.keyboard.press('Space');
      }
      const started = await waitStarted(way === 'plane' ? 120000 : 90000);
      a = await arr();
      check(`${W}: game starts after the ride${way === 'boat' ? ' (skipped)' : ''}`, started && !a.playing && !a.introScene, { a, ms: Date.now() - tSkip });
      if (way === 'boat') check(`${W}: skip is quick (or waits only for loading)`, Date.now() - tSkip < 60000, Date.now() - tSkip);
      await sleep(400);
      const q0 = await ev(() => window.__TAO_RPG__.dialogueQueue());
      check(`${W}: culture statement opens the game`, q0[0]?.who === '文化聲明' && q0.filter((l) => l.who === '文化聲明').length === 2, q0.slice(0, 2));
      const want = way === 'plane' ? '蘭嶼機場' : '這裡就是開元港';
      const other = way === 'plane' ? '這裡就是開元港' : '蘭嶼機場';
      check(`${W}: arrival line matches the choice`, q0.some((l) => l.zh.includes(want)) && !q0.some((l) => l.zh.includes(other)), q0.map((l) => l.zh.slice(0, 14)));
      const seen = await drain();
      check(`${W}: whole arrival talk shown`, seen.length === q0.length, { seen: seen.length, q: q0.length });
      await sleep(300);
      const st = await ev(() => { const g = window.__TAO_RPG__; return { q1: g.quest('Q01').status, q2: g.quest('Q02').status, q3: g.quest('Q03').status, q4: g.quest('Q04').status, log: g.questLogIds(), tracked: g.trackedQuest(), save: g.readSave()?.state?.arrival, pos: g.playerPos(), places: { harbor: g.places.harbor, airport: g.places.airport } }; });
      check(`${W}: Q01 done, Q02/Q03/Q04 active`, st.q1 === 'done' && st.q2 === 'active' && st.q3 === 'active' && st.q4 === 'active', st);
      check(`${W}: Q01 抵達蘭嶼 is in the quest log as done, not tracked`, st.log.includes('Q01') && st.tracked !== 'Q01' && st.log.includes('Q02') && st.q1 === 'done', { tracked: st.tracked, first: st.log.slice(0, 6) });
      check(`${W}: choice saved`, st.save === way, st.save);
      const P = way === 'plane' ? st.places.airport : st.places.harbor;
      const d = Math.hypot(st.pos.x - P.x, st.pos.z - P.z);
      check(`${W}: party starts at ${way === 'plane' ? '蘭嶼機場' : '開元港'}`, d < (way === 'plane' ? 16 : 4), { d: +d.toFixed(1), pos: st.pos });
      const rental = await ev(() => { const g = window.__TAO_RPG__; const p = g.playerPos(); const r = g.places.rental; return r ? Math.hypot(r.x - p.x, r.z - p.z) : null; });
      check(`${W}: rental shop (Q02) within a short walk`, rental !== null && rental < 40, rental);
      if (T === 'desktop') {
        // the plane / yacht stay behind as static props
        const pr = await ev(() => window.__TAO_RPG__.arrivalProps());
        const o = way === 'plane' ? pr.plane : pr.yacht;
        await ev((o) => { const g = window.__TAO_RPG__; g.closeAll(); g.setCamera({ x: o.x, z: o.z, dist: 18, pitch: 0.5, yaw: 0.7 + (o.yaw || 0) * 0, snap: true }); }, o);
        await sleep(2500);
        await shot(way === 'plane' ? '12-prop-parked-plane.png' : '13-prop-moored-yacht.png');
        await ev(() => window.__TAO_RPG__.setCamera({ snap: true }));
        await ev(() => window.__TAO_RPG__.resetView?.());
      }
      const road = await ev(() => { const g = window.__TAO_RPG__; const p = g.playerPos(); const r = g.roadPointNear(p.x, p.z, 4); return r ? Math.hypot(r.x - p.x, r.z - p.z) : null; });
      check(`${W}: start spot is on / next to a road`, road !== null && road <= 3.2, road);
    }

    // an older save (no arrival field) continues without the opening (edited after the reload: the page saves on exit)
    await load();
    await ev(() => {
      const s = window.__TAO_RPG__.readSave();
      delete s.state.arrival;
      localStorage.setItem('tao-rpg:save:v1', JSON.stringify(s));
    });
    await press('#btn-title-start');
    await sleep(300);
    await press('#btn-continue');
    for (let k = 0; k < 300 && !(await ev(() => window.__TAO_RPG__.state.started)); k++) await sleep(200);
    await sleep(400);
    const old = await ev(() => ({ started: window.__TAO_RPG__.state.started, a: window.__TAO_RPG__.arrival() }));
    check(`${T}: older save continues with no opening`, old.started && !old.a.playing && old.a.screen === null && old.a.saved === null, old);
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
