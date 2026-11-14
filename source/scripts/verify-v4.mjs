// v4 verifier: boot timings, all 7 origin spawns, camera-relative movement,
// collision / surface standing, scooter + fast travel, pinch/reset UI, screenshots.
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-v4');
const PORT = Number(process.env.PORT || 8814);
fs.mkdirSync(OUT, { recursive: true });

const srv = await startStaticServer({ root: path.resolve('dist'), port: PORT });
const BASE = debugUrl(srv.base);
let browser = null;
let exitCode = 1;
try {
  browser = await launchBrowser();
  const report = {
    consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], http4xx: [], externalRequests: [],
    shots: [], boot: {}, origins: {}, movement: {}, collision: {}, scooter: {}, travel: {}, ui: {},
  };

  async function openPage(viewport) {
    const page = await browser.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') report.consoleErrors.push(m.text());
      else if (m.type() === 'warning') report.consoleWarnings.push(m.text());
    });
    page.on('pageerror', (e) => report.pageErrors.push(String(e)));
    page.on('requestfailed', (r) => report.failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));
    page.on('request', (r) => { if (!r.url().startsWith(`http://127.0.0.1:${PORT}/`) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) report.externalRequests.push(r.url()); });
    page.on('response', (r) => { if (r.status() >= 400) report.http4xx.push(`${r.status()} ${r.url()}`); });
    await page.setViewport(viewport);
    const t0 = Date.now();
    await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 200 });
    const wall = Date.now() - t0;
    const timings = await page.evaluate(() => window.__TAO_RPG__.timings);
    return { page, wall, timings };
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const act = (page, s) => page.evaluate((s) => {
    const g = window.__TAO_RPG__;
    if (s.origin) g.selectOrigin(s.origin);
    if (s.closeDialogue) g.closeAll();
    if (s.period) g.setTime(s.period);
    if (s.season) g.setSeason(s.season);
    if (s.tp) g.teleport(s.tp[0], s.tp[1]);
    if (s.cam) g.setCamera({ ...s.cam, snap: true });
    if (s.lang) g.setLang(s.lang);
    if (s.talk) g.talkTo(s.talk);
    if (s.interact) g.interactNearest();
  }, s);
  async function shot(page, name, wait = 2500) {
    await sleep(wait);
    const file = path.join(OUT, name);
    await page.screenshot({ path: file });
    report.shots.push(file);
    console.log('captured', file);
  }

  // ---- desktop session ----
  const desk = await openPage({ width: 1440, height: 900, deviceScaleFactor: 1 });
  report.boot.desktop = { wallMs: desk.wall, ...desk.timings, quality: await desk.page.evaluate(() => window.__TAO_RPG__.quality().tier) };
  console.log('desktop boot', report.boot.desktop);

  const origins = ['yayo', 'iraraley', 'iranmeylek', 'ivalino', 'imorod', 'iratay', 'visitor'];
  report.origins = await desk.page.evaluate((origins) => {
    const g = window.__TAO_RPG__;
    const out = {};
    for (const id of origins) {
      g.selectOrigin(id);
      g.closeAll();
      const pos = g.playerPos();
      out[id] = {
        ...pos,
        canStand: g.canStandAt(pos.x, pos.z),
        inWater: pos /* filled below via hook */,
      };
    }
    return out;
  }, origins);
  // enrich with height via a second pass that also records canStand of a water probe
  report.origins = await desk.page.evaluate((ids) => {
    const g = window.__TAO_RPG__;
    const out = {};
    for (const id of ids) {
      g.selectOrigin(id);
      g.closeAll();
      const pos = g.playerPos();
      out[id] = { ...pos, canStand: g.canStandAt(pos.x, pos.z) };
    }
    return out;
  }, origins);
  console.log('origins', report.origins);

  // Camera-relative movement: yaw 0 (camera at +Z) → Up should decrease z
  await act(desk.page, { origin: 'yayo', closeDialogue: true, period: 'day', season: 'rayon' });
  await desk.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    // 青青草原 — open grassland, no buildings or water
    g.teleport(-31, 29.5);
    g.setCamera({ yaw: 0, pitch: 0.5, dist: 18, snap: true });
  });
  await sleep(200);
  report.movement.yaw0 = await desk.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    return { up: g.stepMove(0, -1, 0.45), down: null, right: null };
  });
  report.movement.yaw0.down = await desk.page.evaluate(() => window.__TAO_RPG__.stepMove(0, 1, 0.45));
  await desk.page.evaluate(() => {
    window.__TAO_RPG__.teleport(-31, 29.5);
    window.__TAO_RPG__.setCamera({ yaw: 0, pitch: 0.5, dist: 18, snap: true });
  });
  await sleep(80);
  report.movement.yaw0.right = await desk.page.evaluate(() => window.__TAO_RPG__.stepMove(1, 0, 0.45));

  // yaw +90° (camera at +X) → Up should decrease x
  // start a bit east of the meadow edge so there is room to walk west
  await desk.page.evaluate(() => {
    window.__TAO_RPG__.teleport(-26, 27.2);
    window.__TAO_RPG__.setCamera({ yaw: Math.PI / 2, pitch: 0.5, dist: 18, snap: true });
  });
  await sleep(80);
  report.movement.yaw90 = await desk.page.evaluate(() => window.__TAO_RPG__.stepMove(0, -1, 0.45));

  const y0u = report.movement.yaw0.up;
  const y0r = report.movement.yaw0.right;
  const y90 = report.movement.yaw90;
  report.movement.ok = {
    upGoesNorth: (y0u.next.z - y0u.prev.z) < -0.4, // -Z is north / away when camera is at +Z
    rightGoesEast: (y0r.next.x - y0r.prev.x) > 0.4,
    upAfterYaw90GoesWest: (y90.next.x - y90.prev.x) < -0.4,
  };
  console.log('movement', report.movement);

  // Collision: building, taro basin, water unstuck, dock stand
  report.collision = await desk.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    const places = g.places;
    // Ivalino village centre should be near houses
    const v = places.ivalino;
    g.teleport(v.x, v.z);
    g.closeAll();
    const plaza = g.playerPos();
    // try to walk a long step in 8 directions; we must never end inside a solid
    const walks = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.teleport(plaza.x, plaza.z);
      const before = g.playerPos();
      // repeatedly step in one world direction by temporarily pointing camera
      // Use many stepMove with camera set so forward is `a`
      g.setCamera({ yaw: Math.atan2(-Math.sin(a), -Math.cos(a)), snap: true });
    }
    // more direct: probe canStand on known structures and fields
    const taro = places.taro_ivalino;
    const basinProbe = [];
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        const x = taro.x + i * 0.6, z = taro.z + j * 0.6;
        basinProbe.push({ x, z, can: g.canStandAt(x, z) });
      }
    }
    // water far west
    const water = { x: -48, z: -8, can: g.canStandAt(-48, -8) };
    // harbor dock / apron area
    const dockPts = [
      { x: -37, z: -6.5 },
      { x: -38, z: -6.5 },
      { x: -42, z: -7.1 },
    ].map((p) => ({ ...p, can: g.canStandAt(p.x, p.z) }));
    // unstuck: teleport into water, spawn should snap out
    g.teleport(-48, -8);
    const afterWater = g.playerPos();
    // try walking into a building from plaza: record that we stay standable
    g.teleport(v.x, v.z + 2.6);
    const start = g.playerPos();
    g.setCamera({ yaw: 0, pitch: 0.5, dist: 16, snap: true });
    return { plaza, water, dockPts, afterWater, start, basinBlocked: basinProbe.filter((p) => !p.can).length, basinWalkable: basinProbe.filter((p) => p.can).length, basinProbeCount: basinProbe.length };
  });
  await sleep(200);
  // walk toward inland houses (negative z? ivalino is SE; seaward is roughly +x)
  report.collision.walkIntoVillage = await desk.page.evaluate(async () => {
    const g = window.__TAO_RPG__;
    const path = [];
    for (let i = 0; i < 18; i++) {
      const s = g.stepMove(0, -1, 0.16); // up / into the screen
      path.push({ ...s.next, can: g.canStandAt(s.next.x, s.next.z) });
    }
    return { path, alwaysStood: path.every((p) => p.can) };
  });
  console.log('collision', { ...report.collision, walkIntoVillage: report.collision.walkIntoVillage });

  // Reset view + scooter + fast travel + new HUD / help / interact
  report.ui = await desk.page.evaluate(() => {
    const ids = ['cam-reset', 'cam-in', 'cam-out', 'btn-cam-toggle', 'cam-drawer', 'btn-scooter', 'btn-act', 'btn-travel', 'vpad', 'minimap', 'travel-sheet', 'interact-prompt', 'help-toast', 'help-sheet'];
    const present = {};
    for (const id of ids) present[id] = !!document.getElementById(id);
    const g = window.__TAO_RPG__;
    const before = g.cam();
    g.setCamera({ yaw: 2.2, pitch: 1.0, dist: 48, snap: true });
    g.resetView();
    const after = g.cam();
    const travel = document.getElementById('btn-travel');
    const prompt = document.getElementById('interact-prompt');
    const scooter = document.getElementById('btn-scooter');
    const drawer = document.getElementById('cam-drawer');
    const camToggle = document.getElementById('btn-cam-toggle');
    const kbd = prompt?.querySelector('kbd');
    const kbdDisplay = kbd ? getComputedStyle(kbd).display : null;
    return {
      present,
      before,
      after,
      resetOk: Math.abs(after.dist - 17) < 0.05 && Math.abs(after.yaw - 0.7) < 0.05,
      travelInMinimap: !!travel?.closest('#minimap'),
      promptIsButton: prompt?.tagName === 'BUTTON',
      kbdVisibleOnDesktop: kbdDisplay !== 'none',
      scooterIsToggle: !!scooter?.querySelector('.seg[data-mode="walk"]') && !!scooter?.querySelector('.seg[data-mode="scooter"]'),
      drawerToggleable: !!drawer && !!camToggle,
      drawerOpenDefault: drawer ? drawer.classList.contains('is-open') && !drawer.classList.contains('is-collapsed') : false,
    };
  });
  // cam drawer toggle on desktop
  report.ui.camToggle = await desk.page.evaluate(() => {
    const toggle = document.getElementById('btn-cam-toggle');
    const drawer = document.getElementById('cam-drawer');
    const before = { open: drawer.classList.contains('is-open'), expanded: toggle.getAttribute('aria-expanded') };
    toggle.click();
    const afterClick = { open: drawer.classList.contains('is-open'), expanded: toggle.getAttribute('aria-expanded') };
    toggle.click();
    const restored = { open: drawer.classList.contains('is-open'), expanded: toggle.getAttribute('aria-expanded') };
    return { before, afterClick, restored, ok: before.open && afterClick.open === false && restored.open === true };
  });
  // first-entry toast auto-dismisses on keydown; ? opens the help sheet
  report.ui.help = await desk.page.evaluate(() => {
    const toast = document.getElementById('help-toast');
    const sheet = document.getElementById('help-sheet');
    window.__TAO_RPG__.closeAll();
    window.__TAO_RPG__.showHelp(true);
    const startToast = toast.style.display !== 'none';
    const toastCopy = document.getElementById('help-toast-msg')?.textContent?.trim() || '';
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }));
    const afterKey = toast.style.display === 'none';
    // release it again, otherwise Input keeps "holding" W and the player walks off during later staging
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true }));
    window.__TAO_RPG__.showHelp(false);
    const sheetOpen = sheet.style.display !== 'none';
    const rows = [...sheet.querySelectorAll('.help-row h4')].map((h) => h.textContent);
    document.getElementById('help-close')?.click();
    const sheetClosed = sheet.style.display === 'none';
    window.__TAO_RPG__.showHelp(false);
    sheet.click();
    const backdropClosed = sheet.style.display === 'none';
    return {
      startToast, toastCopy, afterKey, sheetOpen, rows, sheetClosed, backdropClosed,
      ok: startToast && afterKey && sheetOpen && sheetClosed && backdropClosed
        && rows.includes('移動與機車') && rows.includes('視角縮放') && rows.includes('互動與手札'),
    };
  });
  console.log('ui', report.ui);

  await desk.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    g.fastTravel('yayo');
    g.closeAll();
    g.setScooter(true);
  });
  await sleep(200);
  report.scooter = await desk.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    const onRoad = g.playerPos();
    const seg = (mode) => document.querySelector(`#btn-scooter .seg[data-mode="${mode}"]`);
    const onLabel = document.querySelector('#btn-scooter .seg.on')?.textContent;
    const pressed = document.getElementById('btn-scooter')?.getAttribute('aria-pressed');
    // from yayo, step along what should be a road-ish move
    const a = g.stepMove(0, -1, 0.25);
    const dx = Math.hypot(a.next.x - a.prev.x, a.next.z - a.prev.z);
    const riding = { label: onLabel, pressed, walkOn: seg('walk')?.classList.contains('on'), scooterOn: seg('scooter')?.classList.contains('on') };
    g.setScooter(false);
    const b = g.stepMove(0, -1, 0.25);
    const walk = Math.hypot(b.next.x - b.prev.x, b.next.z - b.prev.z);
    const walking = {
      label: document.querySelector('#btn-scooter .seg.on')?.textContent,
      pressed: document.getElementById('btn-scooter')?.getAttribute('aria-pressed'),
      walkOn: seg('walk')?.classList.contains('on'),
      scooterOn: seg('scooter')?.classList.contains('on'),
    };
    return {
      onRoad, scooterStep: dx, walkStep: walk, faster: dx > walk * 1.15,
      riding, walking,
      toggleOk: riding.scooterOn && !riding.walkOn && riding.pressed === 'true' && walking.walkOn && !walking.scooterOn && walking.pressed === 'false',
    };
  });
  console.log('scooter', report.scooter);

  report.travel = await desk.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    const hops = {};
    for (const id of ['ivalino', 'harbor', 'clinic', 'airport', 'qingqing']) {
      g.fastTravel(id);
      g.closeAll();
      const p = g.playerPos();
      hops[id] = { ...p, canStand: g.canStandAt(p.x, p.z) };
    }
    return hops;
  });
  console.log('travel', report.travel);

  // ---- P1 regression checks (real keyboard / mouse events through puppeteer) ----
  // swiftshader can run at a few fps, so wait on rendered frames rather than wall-clock time
  const waitFrames = async (page, n = 2) => {
    const f0 = await page.evaluate(() => window.__TAO_RPG__.frame());
    await page.waitForFunction((f0, n) => window.__TAO_RPG__.frame() >= f0 + n, { timeout: 30000, polling: 30 }, f0, n);
  };
  const tap = async (page, code) => {
    await page.keyboard.down(code);
    await waitFrames(page, 2); // keep it down across rAF ticks so the loop sees it
    await page.keyboard.up(code);
    await waitFrames(page, 2);
  };
  const modals = (page) => page.evaluate(() => window.__TAO_RPG__.openModals());
  report.p1 = {};
  // #1 + #8: 飛魚季 dialogue advanced by keyboard hands off to the mini-game, and E hits the mini-game
  await desk.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    g.closeAll();
    g.resetInput();
    g.setSeason('rayon');
    g.fastTravel('qingqing');
    g.closeAll();
    document.activeElement?.blur?.();
    g.fishTalk();
  });
  await sleep(200);
  {
    const before = await modals(desk.page);
    await tap(desk.page, 'KeyE');
    const afterE = await modals(desk.page);
    await tap(desk.page, 'KeyE');
    const afterHit = await modals(desk.page);
    report.p1.fishKeyboard = {
      before, afterE, afterHit,
      ok: before.includes('dialogue') && afterE.includes('minigame') && !afterE.includes('dialogue') && afterHit.length === 0,
    };
  }
  // no leftover hook: an unrelated dialogue closed with the button must not start the fish mini-game
  report.p1.noStaleFishHook = await desk.page.evaluate(async () => {
    const g = window.__TAO_RPG__;
    g.closeAll();
    g.talkTo('harbor_staff');
    const next = document.getElementById('dlg-next');
    for (let i = 0; i < 6 && document.getElementById('dialogue').classList.contains('open'); i++) next.click();
    await new Promise((r) => setTimeout(r, 150));
    const open = g.openModals();
    g.closeAll();
    return { open, ok: open.length === 0 };
  });
  // #2: Enter on the focused 「繼續」 advances exactly one line (native click only)
  await desk.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    g.closeAll();
    g.talkTo('elder_ivalino');
    document.getElementById('dlg-next').focus();
  });
  await sleep(150);
  {
    const left0 = await desk.page.evaluate(() => window.__TAO_RPG__.dialogueLeft());
    await tap(desk.page, 'Enter');
    const left1 = await desk.page.evaluate(() => window.__TAO_RPG__.dialogueLeft());
    report.p1.enterOnFocusedButton = { left0, left1, ok: left0 > 1 && left1 === left0 - 1 };
  }
  // #9: fast travel mid-dialogue closes everything cleanly; E behind the travel sheet does nothing
  report.p1.modalGate = await desk.page.evaluate(async () => {
    const g = window.__TAO_RPG__;
    const sleepIn = (ms) => new Promise((r) => setTimeout(r, ms));
    document.activeElement?.blur?.();
    g.closeAll();
    g.talkTo('elder_ivalino');
    g.fastTravel('harbor');
    const afterTravel = { open: g.openModals(), left: g.dialogueLeft() };
    g.closeAll();
    g.talkTo('elder_ivalino');
    g.closeAll();
    document.getElementById('btn-travel').click();
    g.interactNearest();
    await sleepIn(120);
    const behindSheet = g.openModals();
    g.closeAll();
    return { afterTravel, behindSheet, ok: afterTravel.open.length === 0 && afterTravel.left === 0 && behindSheet.length === 1 && behindSheet[0] === 'travel' };
  });
  // #3: a second toast keeps its full 3.2 s instead of being hidden by the first toast's timer
  report.p1.toastTimer = await desk.page.evaluate(async () => {
    const g = window.__TAO_RPG__;
    const sleepIn = (ms) => new Promise((r) => setTimeout(r, ms));
    g.toggleScooter();
    await sleepIn(2000);
    g.toggleScooter();
    await sleepIn(1600); // 3.6 s after the first toast, 1.6 s after the second
    const stillShown = document.getElementById('unlock-toast').classList.contains('show');
    return { stillShown, scooterOff: g.playerPos().scooter === false, ok: stillShown };
  });
  // #4: held W is dropped on window blur
  await desk.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    g.closeAll();
    g.teleport(-31, 29.5);
    g.setCamera({ yaw: 0, pitch: 0.5, dist: 18, snap: true });
    document.activeElement?.blur?.();
  });
  await desk.page.keyboard.down('KeyW');
  await waitFrames(desk.page, 3);
  {
    const walking = await desk.page.evaluate(() => {
      const before = window.__TAO_RPG__.playerPos();
      window.dispatchEvent(new Event('blur'));
      return before;
    });
    await waitFrames(desk.page, 4);
    const afterBlur = await desk.page.evaluate(() => window.__TAO_RPG__.playerPos());
    await desk.page.keyboard.up('KeyW');
    const drift = Math.hypot(afterBlur.x - walking.x, afterBlur.z - walking.z);
    report.p1.blurReleasesKeys = { drift, ok: drift < 0.05 };
  }
  // #5: press ↺ and release outside the button: the camera must stop turning
  {
    await desk.page.evaluate(() => {
      const drawer = document.getElementById('cam-drawer');
      if (!drawer.classList.contains('is-open')) document.getElementById('btn-cam-toggle').click();
    });
    const r = await desk.page.evaluate(() => {
      const b = document.getElementById('cam-left').getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    await desk.page.mouse.move(r.x, r.y);
    await desk.page.mouse.down();
    await sleep(150);
    await desk.page.mouse.move(r.x - 400, r.y - 300, { steps: 6 });
    await desk.page.mouse.up();
    await waitFrames(desk.page, 2);
    const yaw0 = await desk.page.evaluate(() => window.__TAO_RPG__.cam().yaw);
    await waitFrames(desk.page, 4);
    const yaw1 = await desk.page.evaluate(() => window.__TAO_RPG__.cam().yaw);
    report.p1.camButtonRelease = { yaw0, yaw1, ok: Math.abs(yaw1 - yaw0) < 1e-6 };
  }
  // #17 / #18: point lights + glow sprites are dropped by day and come back at night
  await desk.page.evaluate(() => window.__TAO_RPG__.setTime('day'));
  await waitFrames(desk.page, 2);
  {
    const day = await desk.page.evaluate(() => window.__TAO_RPG__.lightsVisible());
    await desk.page.evaluate(() => window.__TAO_RPG__.setTime('night'));
    await waitFrames(desk.page, 2);
    const night = await desk.page.evaluate(() => window.__TAO_RPG__.lightsVisible());
    await desk.page.evaluate(() => window.__TAO_RPG__.setTime('day'));
    report.p1.lights = { day, night, ok: day.lights === 0 && day.sprites < night.sprites && night.lights === night.totalLights && night.sprites > 40 };
  }
  report.p1.ok = Object.values(report.p1).every((v) => v.ok);
  console.log('p1', report.p1);

  // Screenshots — characters on surface, roads, dock, scooter, taro bunds
  await desk.page.evaluate(() => window.__TAO_RPG__.resetInput());
  await act(desk.page, { origin: 'ivalino', closeDialogue: true, period: 'day', season: 'rayon' });
  await desk.page.evaluate(() => {
    window.__TAO_RPG__.stageCast(29.6, 13.1, 1.45);
    window.__TAO_RPG__.setCamera({ yaw: 1.45, pitch: 0.38, dist: 7.4, x: 29.6, z: 13.1, snap: true });
  });
  await shot(desk.page, '01-characters-on-surface.png', 3500);

  await desk.page.evaluate(() => {
    window.__TAO_RPG__.closeAll();
    window.__TAO_RPG__.setCamera({ yaw: 0.7, pitch: 0.95, dist: 70, x: 0, z: 0, snap: true });
  });
  await shot(desk.page, '02-ring-road-overview.png', 3000);

  await act(desk.page, { closeDialogue: true, period: 'day', tp: [-36.5, -5.5], cam: { yaw: -1.7, pitch: 0.38, dist: 14, x: -37, z: -6.5 } });
  await desk.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    g.teleport(-37, -6.2);
    g.stageCast(-36.6, -5.2, -1.4, ['@player', 'villager_harbor', 'harbor_staff']);
    g.setCamera({ yaw: -1.7, pitch: 0.36, dist: 12, x: -36.6, z: -5.4, snap: true });
  });
  await shot(desk.page, '03-harbor-dock-standing.png', 3500);

  await desk.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    g.closeAll();
    g.resetInput();
    // park on an open stretch of the ring road south of Yayo (the old -29.2,-8.6 spot sat under the
    // boat-shed roofs, so the scooter was hidden in the screenshot); camera from the inland side
    const road = g.roadPointNear(-21, -20.5) ?? { x: -21, z: -20.5 };
    g.teleport(road.x, road.z);
    g.setScooter(true);
    const p = g.playerPos();
    g.setCamera({ yaw: -2.4, pitch: 0.5, dist: 9.5, x: p.x, z: p.z, snap: true });
  });
  {
    const before = await desk.page.evaluate(() => window.__TAO_RPG__.playerPos());
    await shot(desk.page, '04-scooter-on-road.png', 3000);
    const after = await desk.page.evaluate(() => window.__TAO_RPG__.playerPos());
    const drift = Math.hypot(after.x - before.x, after.z - before.z);
    // the shot frames a fixed focus, so the rider must still be parked there (and still on the scooter)
    const roadDist = await desk.page.evaluate((p) => window.__TAO_RPG__.roadDist(p.x, p.z), after);
    report.scooter.shot = { before, after, drift, roadDist, ok: drift < 0.3 && after.scooter === true && roadDist < 1.0 };
  }

  await desk.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    g.setScooter(false);
    const t = g.places.taro_ivalino;
    g.teleport(t.x + 3.2, t.z + 0.4);
    g.setCamera({ yaw: 1.2, pitch: 0.55, dist: 16, x: t.x, z: t.z, snap: true });
  });
  await shot(desk.page, '05-taro-bunds-and-paths.png', 3000);

  await desk.page.close();

  // ---- mobile iPhone 16 Pro logical viewport ----
  const mob = await openPage({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  report.boot.mobile = { wallMs: mob.wall, ...mob.timings, quality: await mob.page.evaluate(() => window.__TAO_RPG__.quality().tier) };
  console.log('mobile boot', report.boot.mobile);

  await act(mob.page, { origin: 'ivalino', closeDialogue: true, period: 'day', season: 'rayon' });
  report.ui.mobile = await mob.page.evaluate(() => {
    const ids = ['cam-reset', 'cam-in', 'cam-out', 'btn-cam-toggle', 'cam-drawer', 'btn-scooter', 'btn-act', 'btn-travel', 'vpad', 'minimap', 'interact-prompt', 'help-toast', 'help-sheet'];
    const vis = {};
    const box = (el) => {
      const r = el?.getBoundingClientRect();
      return { present: !!el, display: el ? getComputedStyle(el).display : null, w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0 };
    };
    for (const id of ids) vis[id] = box(document.getElementById(id));
    const drawer = document.getElementById('cam-drawer');
    const prompt = document.getElementById('interact-prompt');
    const kbd = prompt?.querySelector('kbd');
    const visible = (id) => {
      const v = vis[id];
      return v.present && v.display !== 'none' && v.w > 0 && v.h > 0;
    };
    const travel = document.getElementById('btn-travel');
    return {
      vis,
      travelInMinimap: !!travel?.closest('#minimap'),
      drawerCollapsed: drawer ? drawer.classList.contains('is-collapsed') && !drawer.classList.contains('is-open') : false,
      camControlsHidden: vis['cam-reset'].h === 0 && vis['cam-in'].h === 0 && vis['cam-out'].h === 0,
      thumbZone: visible('btn-cam-toggle') && visible('btn-scooter') && visible('btn-act'),
      promptIsButton: prompt?.tagName === 'BUTTON',
      kbdHidden: kbd ? getComputedStyle(kbd).display === 'none' : false,
    };
  });
  // confirm cam drawer can open on mobile then collapse again
  report.ui.mobileCamToggle = await mob.page.evaluate(() => {
    const toggle = document.getElementById('btn-cam-toggle');
    const drawer = document.getElementById('cam-drawer');
    const reset = document.getElementById('cam-reset');
    toggle.click();
    const opened = drawer.classList.contains('is-open') && reset.getBoundingClientRect().height > 0;
    toggle.click();
    const closed = drawer.classList.contains('is-collapsed') && reset.getBoundingClientRect().height === 0;
    return { opened, closed, ok: opened && closed };
  });
  report.ui.mobileHelp = await mob.page.evaluate(() => {
    const toast = document.getElementById('help-toast');
    const sheet = document.getElementById('help-sheet');
    window.__TAO_RPG__.showHelp(true);
    const shown = toast.style.display !== 'none';
    const copy = document.getElementById('help-toast-msg')?.textContent || '';
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a', bubbles: true }));
    const dismissed = toast.style.display === 'none';
    // release it: a stuck KeyA made the staged player walk away from elder_ivalino before the prompt check
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', key: 'a', bubbles: true }));
    window.__TAO_RPG__.showHelp(false);
    const sheetOpen = sheet.style.display !== 'none';
    const rows = [...sheet.querySelectorAll('.help-row h4')].map((h) => h.textContent);
    document.getElementById('help-close')?.click();
    const sheetClosed = sheet.style.display === 'none';
    return { shown, copy, dismissed, sheetOpen, rows, sheetClosed, ok: shown && dismissed && sheetOpen && sheetClosed && rows.length === 3 };
  });
  report.ui.mobileInteract = await mob.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    const act = document.getElementById('btn-act');
    const prompt = document.getElementById('interact-prompt');
    const idle = act.disabled && act.classList.contains('idle');
    // stage an NPC nearby so the prompt appears
    g.talkTo && g.stageCast(29.6, 13.1, 1.45, ['elder_ivalino', '@player']);
    g.teleport(29.6 + 1.1, 13.1 + 0.6);
    g.closeAll();
    // nearest prompt is refreshed on the rAF tick; poke setPrompt via a tiny wait from the caller
    return { idle, promptIsButton: prompt?.tagName === 'BUTTON' };
  });
  // joystick: real touch on #vpad in an open meadow, camera yaw 0 so stick-up walks -Z
  report.movement.mobilePad = await mob.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    g.teleport(-26, 27.2);
    g.setCamera({ yaw: 0, pitch: 0.5, dist: 18, snap: true });
    const start = g.playerPos();
    const pad = document.getElementById('vpad');
    const r = pad.getBoundingClientRect();
    return { start, pad: { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } };
  });
  {
    const { x, y } = report.movement.mobilePad.pad;
    const ts = mob.page.touchscreen;
    if (ts.touchStart) {
      await ts.touchStart(x, y);
      await ts.touchMove(x, y - 50);
      await sleep(450);
      await ts.touchEnd();
    } else {
      // fallback: CDP touch / mouse drag on the pad
      await mob.page.mouse.move(x, y);
      await mob.page.mouse.down();
      await mob.page.mouse.move(x, y - 50, { steps: 8 });
      await sleep(450);
      await mob.page.mouse.up();
    }
  }
  report.movement.mobilePad.after = await mob.page.evaluate(() => window.__TAO_RPG__.playerPos());
  const mp = report.movement.mobilePad;
  report.movement.mobilePad.moved = Math.hypot(mp.after.x - mp.start.x, mp.after.z - mp.start.z) > 0.15;
  console.log('mobile pad', report.movement.mobilePad);

  await mob.page.evaluate(() => {
    const g = window.__TAO_RPG__;
    g.resetInput();
    g.closeAll();
    g.stageCast(29.6, 13.1, 1.45, ['elder_ivalino', '@player', 'villager_taro']);
    g.setCamera({ yaw: 1.45, pitch: 0.42, dist: 8.5, x: 29.6, z: 13.1, snap: true });
    g.showHelp(true);
  });
  // the prompt / act button sync on the rAF tick: wait until they do (bounded), then capture
  await mob.page.waitForFunction(() => document.getElementById('interact-prompt')?.classList.contains('show'), { timeout: 4000, polling: 50 }).catch(() => {});
  report.ui.mobilePrompt = await mob.page.evaluate(() => {
    const act = document.getElementById('btn-act');
    const prompt = document.getElementById('interact-prompt');
    const shown = prompt.classList.contains('show');
    return {
      shown,
      actReady: !act.disabled && act.classList.contains('ready'),
      actIdle: act.disabled && act.classList.contains('idle'),
      promptClickable: prompt.tagName === 'BUTTON' && getComputedStyle(prompt).pointerEvents !== 'none',
      kbdHidden: getComputedStyle(prompt.querySelector('kbd')).display === 'none',
      label: document.getElementById('interact-label')?.textContent || '',
    };
  });
  await mob.page.evaluate(() => window.__TAO_RPG__.showHelp(true));
  await sleep(1200);
  // the screenshot must show the same HUD state (prompt up, act ready, slim help toast): read it right before capture
  report.ui.mobilePrompt.atShot = await mob.page.evaluate(() => ({
    shown: document.getElementById('interact-prompt').classList.contains('show'),
    actReady: !document.getElementById('btn-act').disabled,
    toast: document.getElementById('help-toast').style.display !== 'none',
  }));
  await shot(mob.page, '06-mobile-hud-and-surface.png', 0);

  await mob.page.close();

  // ---- P2 checks: quality tiers, and the debug API stays hidden without ?debug ----
  report.p2 = {};
  report.p2.quality = { desktop: report.boot.desktop.quality, mobile: report.boot.mobile.quality, ok: report.boot.desktop.quality === 'high' && report.boot.mobile.quality === 'mobile' };
  {
    const page = await browser.newPage();
    page.on('pageerror', (e) => report.pageErrors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) report.http4xx.push(`${r.status()} ${r.url()}`); });
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(srv.base, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => document.getElementById('origin-screen')?.style.display === 'flex', { timeout: 240000, polling: 200 });
    const exposed = await page.evaluate(() => typeof window.__TAO_RPG__ !== 'undefined');
    const originCards = await page.evaluate(() => document.querySelectorAll('#origin-grid .origin-card').length);
    report.p2.debugGate = { exposed, originCards, ok: !exposed && originCards === 8 };
    await page.close();
  }
  report.p2.ok = Object.values(report.p2).every((v) => typeof v !== 'object' || v.ok);
  console.log('p2', report.p2);

  const originOk = origins.every((id) => report.origins[id]?.canStand);
  const travelOk = Object.values(report.travel).every((p) => p.canStand);
  const dockOk = report.collision.dockPts.some((p) => p.can);
  const waterBlocked = report.collision.water.can === false;
  const unstuck = report.collision.afterWater && Math.hypot(report.collision.afterWater.x + 48, report.collision.afterWater.z + 8) > 1.5;
  const basinHasBlock = report.collision.basinBlocked > 4;
  const basinHasPath = report.collision.basinWalkable > 2;
  const paintDesktop = report.boot.desktop.paint;
  const paintMobile = report.boot.mobile.paint;
  const paintFast = paintDesktop < 8000 && paintMobile < 12000;

  const uiChrome = report.ui.present['cam-reset'] && report.ui.present['btn-scooter'] && report.ui.present['btn-cam-toggle']
    && report.ui.present['btn-travel'] && report.ui.present['interact-prompt'] && report.ui.present['help-toast'] && report.ui.present['help-sheet']
    && report.ui.travelInMinimap && report.ui.promptIsButton && report.ui.scooterIsToggle && report.ui.drawerOpenDefault
    && report.ui.camToggle.ok && report.ui.help.ok && report.scooter.toggleOk
    && report.ui.mobile.drawerCollapsed && report.ui.mobile.camControlsHidden && report.ui.mobile.thumbZone
    && report.ui.mobile.kbdHidden && report.ui.mobile.travelInMinimap
    && report.ui.mobileCamToggle.ok && report.ui.mobileHelp.ok
    && report.ui.mobilePrompt.promptClickable && report.ui.mobilePrompt.kbdHidden
    && report.ui.mobilePrompt.shown && report.ui.mobilePrompt.actReady && !report.ui.mobilePrompt.actIdle
    && report.ui.mobilePrompt.atShot.shown && report.ui.mobilePrompt.atShot.actReady && report.ui.mobilePrompt.atShot.toast;

  const ok = !report.consoleErrors.length && !report.pageErrors.length && !report.http4xx.length
    && !report.failedRequests.length && !report.externalRequests.length
    && originOk && report.movement.ok.upGoesNorth && report.movement.ok.rightGoesEast && report.movement.ok.upAfterYaw90GoesWest
    && report.collision.walkIntoVillage.alwaysStood && waterBlocked && unstuck && dockOk && basinHasBlock && basinHasPath
    && report.scooter.faster && report.scooter.shot.ok && report.p1.ok && travelOk && report.ui.resetOk && uiChrome
    && report.movement.mobilePad.moved && paintFast && report.p2.ok;

  fs.writeFileSync(path.join(OUT, 'verify-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    boot: report.boot,
    origins: report.origins,
    movement: { ok: report.movement.ok, mobilePadMoved: report.movement.mobilePad.moved, yaw0: report.movement.yaw0, yaw90: report.movement.yaw90 },
    collision: { waterBlocked, unstuck, dockOk, basinHasBlock, basinHasPath, basinBlocked: report.collision.basinBlocked, basinWalkable: report.collision.basinWalkable, alwaysStood: report.collision.walkIntoVillage.alwaysStood },
    scooter: report.scooter,
    p1: report.p1,
    p2: report.p2,
    travel: report.travel,
    ui: report.ui,
    consoleErrors: report.consoleErrors,
    pageErrors: report.pageErrors,
    http4xx: report.http4xx,
    failedRequests: report.failedRequests,
    paintFast,
    originOk,
  }, null, 2));
  console.log(ok ? 'VERIFY OK' : 'VERIFY FAILED');
  exitCode = ok ? 0 : 1;
} catch (err) {
  console.error('VERIFY ERROR', err);
  exitCode = 1;
} finally {
  // never leave Chrome or the static server running, even when a step throws
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
process.exit(exitCode);
