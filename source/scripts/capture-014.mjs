// 0.1.4 shots for Larry: the new island from far away, a village, the coast road, the modern canoe.
// PORT=89xx node scripts/capture-014.mjs   → screenshots-014/
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-014');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8951) });
const errors = [];
const b = await launchBrowser();
try {
  const page = await b.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  await ev(() => window.__TAO_RPG__.clearSave());
  // frames settle slowly in software GL: wait for a fixed number of rendered frames
  const frames = async (n) => { const f0 = await ev(() => window.__TAO_RPG__.frame()); await page.waitForFunction((f) => window.__TAO_RPG__.frame() >= f, { timeout: 120000, polling: 200 }, f0 + n).catch(() => {}); };
  const hideUi = (on) => ev((on) => {
    let s = document.getElementById('cap014');
    if (!s) { s = document.createElement('style'); s.id = 'cap014'; document.head.appendChild(s); }
    s.textContent = on ? 'body > *:not(canvas):not(#app):not(#game), #hud, .hud, #title, .title, #origin, .toast, #toasts { visibility: hidden !important; } canvas { visibility: visible !important; }' : '';
  }, on);
  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('captured', name); };

  // start a journey (野銀, 族男), daylight
  await page.waitForSelector('#btn-origin-ivalino', { visible: true, timeout: 30000 });
  await page.click('#btn-origin-ivalino');
  await page.click('#btn-gender-m');
  await page.click('#origin-go');
  await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
  await ev(() => { const g = window.__TAO_RPG__; for (let i = 0; i < 40 && g.mode() === 'dialogue'; i++) g.advanceDialogue(); g.closeAll(); g.setTime('day'); });

  if (!process.env.ONLY_CANOE) {
  // 2) a village: 野銀 (ivalino) houses and the host family
  await ev(() => { const g = window.__TAO_RPG__; const p = g.places.ivalino; g.teleport(p.x, p.z); g.gatherParty?.(); g.setCamera({ x: p.x, z: p.z, yaw: 0.7, pitch: 0.62, dist: 24, snap: true }); });
    await frames(4);
  await shot('01-village-ivalino');

  // 3) the coast road on the east side (between 東清 and 野銀)
  await ev(() => {
    const g = window.__TAO_RPG__; const a = g.places.iranmeylek, c = g.places.ivalino;
    const r = g.roadPointNear((a.x + c.x) / 2, (a.z + c.z) / 2, 14) || a;
    g.teleport(r.x, r.z); g.setScooter?.(true);
    g.setCamera({ x: r.x, z: r.z, yaw: 1.9, pitch: 0.42, dist: 20, snap: true });
  });
  await frames(4);
  await shot('02-coast-road');
  await ev(() => window.__TAO_RPG__.setScooter?.(false));

  }
  // 4) 族女 on the plain modern canoe (only Tao men paddle the tatala)
  // open water off the 野銀 shore (away from the harbour buildings)
  await ev(() => { const g = window.__TAO_RPG__; const v = g.places.ivalino; g.teleport(v.x, v.z); g.switchMember('f'); });
  await sleep(500);
  const look = await ev(async () => { const g = window.__TAO_RPG__; const v = g.places.ivalino; await g.setCanoe(true, v.x + 6, v.z + 2); if (g.paddle) g.paddle(4); return g.canoeLook(); });
  console.log('canoe', JSON.stringify(look));
  // paddle out a little (east, away from the shore)
  await page.keyboard.down('KeyD'); await frames(25); await page.keyboard.up('KeyD');
  console.log('at', JSON.stringify(await ev(() => window.__TAO_RPG__.playerPos())));
  await ev(() => { const g = window.__TAO_RPG__; const p = g.playerPos(); g.setCamera({ x: p.x, z: p.z, yaw: 0.9, pitch: 0.6, dist: 10, snap: true }); });
  await frames(4);
  await shot('03-modern-canoe-at-sea');
} finally {
  await b.close();
  srv.close?.();
}
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
process.exit(0);
