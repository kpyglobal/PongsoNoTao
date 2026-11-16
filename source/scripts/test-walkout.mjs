// 0.1.1 bugfix test: a fresh game spawns the party on the 開元港 dock; walk off it onto the road with
// real input only (desktop: held arrow keys; mobile: touch drag on the #vpad joystick), then check
// sprite facing for ←→↑↓ (also after a camera rotation, on the scooter and in the tatala).
// OUT=screenshots-0.1.1 node scripts/test-walkout.mjs   (needs `npm run build` first; LIVE_URL=… for a deployed site)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-0.1.1');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// LIVE_URL=https://kpyglobal.github.io/PongsoNoTao/ runs the same test against a deployed site (no local server)
const srv = process.env.LIVE_URL ? { base: process.env.LIVE_URL, close: async () => {} } : await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8851) });
const report = { errors: [], http4xx: [], fails: [] };
const check = (name, ok, info) => {
  if (!ok) report.fails.push(name);
  console.log(ok ? 'ok  ' : 'FAIL', name, info !== undefined ? JSON.stringify(info).slice(0, 240) : '');
};
// quay → spur → 椰油 seafront road (layout.ts HARBOUR_SPUR + ring)
// 0.1.4: the island layout changed, so the route is found in the game (nearest ring-road point, then a bit along the road)
let ROUTE = [];
let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1280, height: 800, deviceScaleFactor: 1 } },
    { tag: 'mobile', v: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
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
    const shot = async (name, wait = 900) => { await sleep(wait); await page.screenshot({ path: path.join(OUT, `${T}-${name}.png`) }); console.log('captured', `${T}-${name}`); };
    const drain = async () => {
      for (let i = 0; i < 40; i++) {
        if ((await ev(() => window.__TAO_RPG__.mode())) !== 'dialogue') return;
        await ev(() => window.__TAO_RPG__.advanceDialogue());
        await sleep(60);
      }
    };

    // new journey (yayo, male) → Q01 lands the whole party at 開元港
    await ev(() => window.__TAO_RPG__.clearSave());
    await page.waitForSelector('#sel-origin-m', { visible: true, timeout: 15000 });
    await page.select('#sel-origin-m', 'yayo'); await page.select('#sel-origin-f', 'yayo');
    await page.waitForSelector('#btn-gender-m', { visible: true, timeout: 15000 });
    await page.click('#btn-gender-m');
    await page.waitForSelector('#origin-go', { visible: true, timeout: 15000 });
    await page.click('#origin-go');
    await sleep(900);
    await drain();
    await ev(() => window.__TAO_RPG__.setCamera({ dist: 22 }));
    const p0 = await ev(() => window.__TAO_RPG__.playerPos());
    const hb = await ev(() => window.__TAO_RPG__.places.harbor);
    check(`${T}: spawn on the harbour`, Math.hypot(p0.x - hb.x, p0.z - hb.z) < 4, { p0, harbor: hb });
    ROUTE = await ev((p) => {
      const g = window.__TAO_RPG__;
      const r1 = g.roadPointNear(p.x, p.z, 10);
      if (!r1) return [];
      // a second road point 3–5 m on, away from the dock
      let r2 = null;
      for (let a = 0; a < 16 && !r2; a++) {
        const t = (a / 16) * Math.PI * 2;
        const c = g.roadPointNear(r1.x + Math.cos(t) * 4, r1.z + Math.sin(t) * 4, 1);
        if (c && Math.hypot(c.x - p.x, c.z - p.z) > Math.hypot(r1.x - p.x, r1.z - p.z) + 2) r2 = c;
      }
      return r2 ? [r1, r2] : [r1];
    }, p0);
    check(`${T}: found a road route off the dock`, ROUTE.length >= 1, ROUTE);
    await shot('01-harbour-spawn', 1400);

    // steer with real input toward each route point
    const vpad = T === 'mobile' ? await ev(() => { const r = document.querySelector('#vpad').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; }) : null;
    const held = new Set();
    const setKeys = async (want) => {
      for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
      for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
    };
    let touching = false;
    const setStick = async (sx, sy) => {
      const x = vpad.x + sx * vpad.r * 0.9, y = vpad.y + sy * vpad.r * 0.9;
      if (!touching) { await page.touchscreen.touchStart(vpad.x, vpad.y); touching = true; }
      await page.touchscreen.touchMove(x, y);
    };
    const release = async () => {
      if (T === 'mobile') { if (touching) await page.touchscreen.touchEnd(); touching = false; }
      else await setKeys(new Set());
    };
    const trail = [];
    let reached = 0;
    const t0 = Date.now();
    // wall-clock budget: headless swiftshader at 1440×900 runs ~10 fps here (≈80–90 s for the route), so 150 s, not 90
    while (reached < ROUTE.length && Date.now() - t0 < 150000) {
      const s = await ev(() => ({ p: window.__TAO_RPG__.playerPos(), c: window.__TAO_RPG__.cam(), m: window.__TAO_RPG__.mode() }));
      // QA H3: a story line can pop up after the arrival (auto lines on the quest tick); like a player, close it first
      if (s.m === 'dialogue') { await release(); await drain(); continue; }
      trail.push([+s.p.x.toFixed(2), +s.p.z.toFixed(2), Date.now()]);
      const tgt = ROUTE[reached];
      const dx = tgt.x - s.p.x, dz = tgt.z - s.p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.9) { reached++; continue; }
      // camera-relative basis (game.ts syncCamera: camera at focus + (sin yaw, cos yaw))
      const rx = Math.cos(s.c.yaw), rz = -Math.sin(s.c.yaw);
      const ux = -Math.sin(s.c.yaw), uz = -Math.cos(s.c.yaw);
      const sr = (dx * rx + dz * rz) / d; // + = screen right
      const su = (dx * ux + dz * uz) / d; // + = screen up (away from camera)
      if (T === 'mobile') await setStick(sr, -su);
      else {
        const want = new Set();
        if (sr > 0.38) want.add('ArrowRight');
        if (sr < -0.38) want.add('ArrowLeft');
        if (su > 0.38) want.add('ArrowUp');
        if (su < -0.38) want.add('ArrowDown');
        await setKeys(want);
      }
      await sleep(90);
      // stuck = under 0.3 m in the last 12 s of wall clock (software GL under load can drop to a few frames a second)
      const now = Date.now();
      const old = trail.findLast?.((e) => e[2] <= now - 12000);
      if (old && Math.hypot(old[0] - s.p.x, old[1] - s.p.z) < 0.3) break;
    }
    const diag = await ev(() => ({ mode: window.__TAO_RPG__.mode(), modals: window.__TAO_RPG__.openModals(), focus: document.activeElement?.id || document.activeElement?.tagName }));
    await release();
    const p1 = await ev(() => window.__TAO_RPG__.playerPos());
    const rd = await ev((p) => window.__TAO_RPG__.roadDist(p.x, p.z), p1);
    check(`${T}: walked off the dock onto the road (${T === 'mobile' ? 'joystick' : 'arrow keys'})`, reached === ROUTE.length && rd < 1.5, { reached, p1, roadDist: +rd.toFixed(2), secs: ((Date.now() - t0) / 1000).toFixed(1), steps: trail.length, diag });
    await ev(() => window.__TAO_RPG__.setCamera({ dist: 26 }));
    await shot('02-harbour-exit-on-road', 1200);

    if (T === 'desktop') {
      // facing: hold each arrow, read the sheet row the controlled sprite shows
      // software WebGL runs a few fps: wait until the character has actually moved under the held key,
      // then two more rendered frames, before reading the sheet row
      const frames = (n) => ev((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
      const face = async (key) => {
        const a = await ev(() => window.__TAO_RPG__.playerPos());
        await page.keyboard.down(key);
        const t = Date.now();
        while (Date.now() - t < 15000) {
          const b = await ev(() => window.__TAO_RPG__.playerPos());
          if (Math.hypot(b.x - a.x, b.z - a.z) > 0.15) break;
          await sleep(50);
        }
        await frames(2);
        const f = await ev(() => window.__TAO_RPG__.facing());
        await page.keyboard.up(key);
        await frames(2);
        return f;
      };
      const expect = { ArrowRight: 'e', ArrowLeft: 'w', ArrowUp: 'n', ArrowDown: 's' };
      const run = async (label) => {
        const got = {};
        for (const k of Object.keys(expect)) got[k] = (await face(k)).dir;
        check(`${T}: facing ${label}`, Object.keys(expect).every((k) => got[k] === expect[k]), got);
      };
      await ev(() => window.__TAO_RPG__.setCamera({ dist: 9 }));
      await run('walk, default camera');
      // screenshots: facing right / left mid-walk
      for (const [k, name] of [['ArrowRight', '03-facing-right'], ['ArrowLeft', '04-facing-left']]) {
        await page.keyboard.down(k);
        await sleep(350);
        await page.screenshot({ path: path.join(OUT, `${T}-${name}.png`) });
        console.log('captured', `${T}-${name}`);
        await page.keyboard.up(k);
        await sleep(150);
      }
      const yaw0 = (await ev(() => window.__TAO_RPG__.cam())).yaw;
      for (const [i, dy] of [[1, Math.PI / 2], [2, Math.PI], [3, -Math.PI / 4]]) {
        await ev((y) => window.__TAO_RPG__.setCamera({ yaw: y, snap: true }), yaw0 + dy);
        await sleep(300);
        await run(`walk, camera rotated ${Math.round((dy * 180) / Math.PI)}°`);
        void i;
      }
      await ev((y) => window.__TAO_RPG__.setCamera({ yaw: y, snap: true }), yaw0);
      await ev(() => window.__TAO_RPG__.setScooter(true));
      await sleep(200);
      await run('scooter');
      await page.keyboard.down('ArrowRight'); await sleep(300);
      await page.screenshot({ path: path.join(OUT, `${T}-05-scooter-facing-right.png`) });
      await page.keyboard.up('ArrowRight');
      await ev(() => window.__TAO_RPG__.setScooter(false));
      const boarded = await ev((p) => window.__TAO_RPG__.setCanoe(true, p.x, p.z), hb);
      await sleep(300);
      if (boarded !== false) {
        await run('tatala');
        await page.keyboard.down('ArrowRight'); await sleep(300);
        await page.screenshot({ path: path.join(OUT, `${T}-06-canoe-facing-right.png`) });
        await page.keyboard.up('ArrowRight');
        await ev(() => window.__TAO_RPG__.setCanoe(false));
      } else check(`${T}: could board a tatala for the facing check`, false);
      const flora = await ev(() => window.__TAO_RPG__.roadFlora(1.5));
      const big = Object.entries(flora).filter(([k]) => /tree|palm|pandanus|bush/.test(k));
      check(`${T}: no tree / palm / bush within 1.5 m of a road`, big.length === 0, flora);
    }
    await page.close();
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
check('no console errors', report.errors.length === 0, report.errors.slice(0, 5));
check('no 4xx', report.http4xx.length === 0, report.http4xx.slice(0, 5));
console.log(report.fails.length ? `FAIL (${report.fails.length})` : 'ALL OK');
process.exit(report.fails.length ? 1 : 0);
