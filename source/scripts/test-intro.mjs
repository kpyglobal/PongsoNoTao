// 0.1.5 arrival opening: title screen → party → 搭飛機／搭船 (shared Lanyu vista) → 2.5D ride (pull back to the
// window / bow and hold while loading; then the plane flies out from behind the camera rear → bank → descend, or the
// yacht seen from behind drives off toward the island) → notebook stamps 抵達蘭嶼 complete → the party starts at the matching
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
    // 0.1.5: narrow landscape phone (window frame / bow must not be cropped there either)
    { tag: 'iphone-land', v: { width: 852, height: 393, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
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
        // 音樂 / 音效 toggles on the start screens (語言 sits in the same bar, but is not a sound toggle)
        const ms = await ev(() => ({
          sound: [...document.querySelectorAll('#title-screen .menu-sound button[data-ch]')].map((b) => b.textContent),
          lang: [...document.querySelectorAll('#title-screen .menu-sound .lang-toggle [data-lang]')].map((b) => b.dataset.lang),
        }));
        check(`${W}: start menu has 音樂 / 音效 toggles`, ms.sound.length === 2 && ms.sound[0].includes('音樂') && ms.sound[1].includes('音效'), ms.sound);
        check(`${W}: start menu has 語言 next to the sound toggles`, ms.lang.join() === 'both,zh,tao', ms.lang);
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
      await page.select('#sel-origin-m', 'yayo'); await page.select('#sel-origin-f', 'yayo'); // 0.1.5 tribe dropdowns
      await press('#btn-gender-f');
      if (way === 'plane') {
        // 0.1.5: the 踏上 button never sits over the 男生／女生 buttons (phones: the language row made the card taller)
        const ov = await ev(() => {
          const r = (s) => document.querySelector(s).getBoundingClientRect();
          const go = r('#origin-go');
          const hit = ['#btn-gender-m', '#btn-gender-f', '#cs-traveller', '#sel-origin-m', '#sel-origin-f'].some((s) => { const b = r(s); return go.left < b.right && go.right > b.left && go.top < b.bottom - 1 && go.bottom > b.top + 1; });
          return { hit, go: Math.round(go.top), m: Math.round(r('#btn-gender-m').bottom) };
        });
        check(`${W}: start button clear of the 男生／女生 buttons`, !ov.hit, ov);
      }
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
        } else await shot(`14-arrival-choice-${T}.png`);
      }
      await press(`#btn-arrive-${way}`);
      await sleep(250);
      a = await arr();
      check(`${W}: painted ride playing (separate intro scene)`, a.playing && a.way === way && a.phase === 'intro' && a.introScene && a.introMode === way && a.screen === 'intro', a);
      check(`${W}: title music keeps playing (no game start yet)`, !(await ev(() => window.__TAO_RPG__.state.started)));
      // the island loads in the background: loading bar centred and see-through until it is done
      const lb = await ev(() => { const e = document.getElementById('ai-load'); const r = e.getBoundingClientRect(); return { shown: getComputedStyle(e).display !== 'none' && r.width > 0, mid: Math.round(r.left + r.width / 2), top: r.top, bottom: r.bottom, h: innerHeight, w: innerWidth, op: +getComputedStyle(e).opacity, label: document.getElementById('ai-load-label').textContent }; });
      check(`${W}: loading bar centred and semi-transparent`, lb.shown && Math.abs(lb.mid - lb.w / 2) < 4 && lb.op > 0.3 && lb.op < 0.95 && lb.top > 0 && lb.bottom < lb.h, lb);
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
        const fr = a.introPose.overlayRect;
        const ar = a.introPose.area;
        check(`${W}: whole window frame on screen (not cropped)`, fr.w > 0 && fr.x >= ar.x - 1 && fr.y >= ar.y - 1 && fr.x + fr.w <= ar.x + ar.w + 1 && fr.y + fr.h <= ar.y + ar.h + 1, { fr, ar });
        // loading loop: the clouds drift and the window bobs a little (no big moves)
        await ev(() => window.__TAO_RPG__.freezeIntro(5, null));
        await sleep(300);
        const l1 = (await arr()).introPose;
        await ev(() => window.__TAO_RPG__.freezeIntro(7, null));
        await sleep(300);
        const l2 = (await arr()).introPose;
        await ev(() => { const g = window.__TAO_RPG__; g.freezeIntro(4, null); g.freezeIntro(null); });
        check(`${W}: loading loop: clouds drift, gentle bob`, l1.cloudDrift !== l2.cloudDrift && Math.abs(l1.cloudDrift - l2.cloudDrift) < 60 && Math.abs(l1.pitch) <= 1 && Math.abs(l2.pitch) <= 1 && l1.overlay > 0.9, { d1: l1.cloudDrift, d2: l2.cloudDrift, p1: l1.pitch, p2: l2.pitch });
        // the finale's beats, held frame by frame (the live run below still plays it end to end)
        const at = async (f) => { await ev((f) => window.__TAO_RPG__.freezeIntro(5, f), f); await sleep(300); return (await arr()).introPose; };
        const o1 = await at(1.6);
        const p1 = await at(5.0);
        const p2 = await at(7.0);
        const p3 = await at(9.6);
        const frames = new Set();
        for (const f of [6.0, 6.03, 6.07, 6.1]) frames.add((await at(f)).prop);
        await ev(() => { const g = window.__TAO_RPG__; g.freezeIntro(4, null); g.freezeIntro(null); });
        check(`${W}: out through the window (frame and wing go, island stays)`, o1.overlay < 0.5 && o1.vehicle.a === 0, { overlay: o1.overlay });
        check(`${W}: island turns to the closer angle`, p1.island > 0.9 && o1.island < p1.island, { o1: o1.island, p1: p1.island });
        check(`${W}: plane flies out from behind the camera: rear → bank → descend, shrinking`, p1.vehicle.pose === 'rear' && p2.vehicle.pose === 'bank' && p3.vehicle.pose === 'descend' && p1.vehicle.w > p2.vehicle.w && p2.vehicle.w > p3.vehicle.w, [p1.vehicle, p2.vehicle, p3.vehicle]);
        check(`${W}: propellers spin (frames cycle), wingtip trails on`, frames.size >= 2 && p2.trails > 0.5, { frames: [...frames], trails: p2.trails });
        check(`${W}: plane stays on screen`, [p1, p2, p3].every((p) => p.vehicle.x > p.area.x && p.vehicle.x < p.area.x + p.area.w && p.vehicle.y > p.area.y && p.vehicle.y < p.area.y + p.area.h), [p1, p2, p3].map((p) => [Math.round(p.vehicle.x), Math.round(p.vehicle.y)]));
        if (T === 'desktop') await shot('09-arrival-plane-clouds.png');
        else await shot(`17-arrival-plane-${T}.png`);
      } else {
        await ev(() => window.__TAO_RPG__.seekIntro(2.6));
        await sleep(500);
        a = await arr();
        check(`${W}: yacht bow revealed over the painted sea (pitch / roll)`, a.introPose && a.introPose.mode === 'boat' && a.introPose.layers >= 3 && a.introPose.overlay > 0.7 && Math.abs(a.introPose.pitch) <= 1 && Math.abs(a.introPose.roll) < 0.05, a.introPose);
        const br = a.introPose.overlayRect;
        const ar = a.introPose.area;
        check(`${W}: whole bow on screen (not cropped)`, br.w > 0 && br.x >= ar.x - 1 && br.x + br.w <= ar.x + ar.w + 1 && br.y >= ar.y - 1 && br.y + br.h <= ar.y + ar.h + 1, { br, ar });
        // loading loop: the wave phases cross-fade (no long scroll), the bow pitches gently
        const at = async (t, f) => { await ev(([t, f]) => window.__TAO_RPG__.freezeIntro(t, f), [t, f]); await sleep(300); return (await arr()).introPose; };
        const w1 = await at(5, null);
        const w2 = await at(6.2, null);
        check(`${W}: loading loop: wave phases cross-fade, gentle pitch`, w1.waves.join() !== w2.waves.join() && Math.abs(w1.pitch) <= 1 && Math.abs(w2.pitch) <= 1, { w1: w1.waves, w2: w2.waves });
        const y1 = await at(5, 1.0);
        const y2 = await at(5, 3.0);
        const y3 = await at(5, 8.6);
        const r1 = (await at(5.9, 3.0)).hullRock;
        await ev(() => { const g = window.__TAO_RPG__; g.freezeIntro(4, null); g.freezeIntro(null); });
        check(`${W}: cut to the yacht from behind (bow gone, wake and spray on)`, y1.overlay < 0.2 && y1.vehicle.a > 0.8 && y1.wake > 0.2, { overlay: y1.overlay, veh: y1.vehicle, wake: y1.wake });
        check(`${W}: yacht drives off and shrinks into the centre left`, y3.vehicle.w < y1.vehicle.w * 0.3 && y3.vehicle.x < y3.area.x + y3.area.w * 0.5 && y3.vehicle.x > y3.area.x, { y1: y1.vehicle, y3: y3.vehicle });
        check(`${W}: wake / spray fade in with speed and out with distance`, y2.wake > y1.wake && y3.spray < y2.spray, { w: [y1.wake, y2.wake, y3.wake], s: [y1.spray, y2.spray, y3.spray] });
        check(`${W}: hull rocks on its own pivot`, Math.abs(r1 - y2.hullRock) > 0.005, { r1, r2: y2.hullRock });
        check(`${W}: island cross-fades to the closer angle`, y1.island < 0.2 && y3.island > 0.9, { y1: y1.island, y3: y3.island });
        if (T === 'desktop') await shot('10-arrival-yacht.png');
        else await shot(`15-arrival-yacht-${T}.png`);
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
        await ev(() => window.__TAO_RPG__.freezeIntro(4, 3.0));
        await sleep(500);
        await shot('27-yacht-driveoff.png');
        await ev(() => { const g = window.__TAO_RPG__; g.freezeIntro(4, null); g.freezeIntro(null); });
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
      const st = await ev(() => { const g = window.__TAO_RPG__; return { q1: g.quest('Q01').status, q2: g.quest('Q02').status, q3: g.quest('Q03').status, q4: g.quest('Q04').status, log: g.questLogIds(), tracked: g.trackedQuest(), save: g.readSave()?.state?.arrival, pos: g.playerPos(), lead: g.party().controlled, outfits: g.party().outfits, places: { harbor: g.places.harbor, airport: g.places.airport } }; });
      check(`${W}: Q01 done, Q02/Q03/Q04 active`, st.q1 === 'done' && st.q2 === 'active' && st.q3 === 'active' && st.q4 === 'active', st);
      check(`${W}: 族男 leads at the start`, st.lead === 'm' && st.outfits.t !== 'player' && st.outfits.t !== 'player_f', { lead: st.lead, outfits: st.outfits });
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
