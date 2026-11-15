// 0.1.5 kayak shots: 族女 in the modern sea kayak beside the moored tatala in 開元港 (shadow + reflection).
// PORT=89xx [NAME=05-canoe-new] [TIME=day] node scripts/capture-kayak.mjs → screenshots-014/
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-014');
const NAME = process.env.NAME || '05-canoe-new';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8953) });
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
  const frames = async (n) => { const f0 = await ev(() => window.__TAO_RPG__.frame()); await page.waitForFunction((f) => window.__TAO_RPG__.frame() >= f, { timeout: 120000, polling: 200 }, f0 + n).catch(() => {}); };
  await page.waitForSelector('#btn-origin-ivalino', { visible: true, timeout: 30000 });
  await page.click('#btn-origin-ivalino');
  await page.click('#btn-gender-m');
  await page.click('#origin-go');
  await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
  await ev((t) => { const g = window.__TAO_RPG__; for (let i = 0; i < 40 && g.mode() === 'dialogue'; i++) g.advanceDialogue(); g.closeAll(); g.setTime(t); }, process.env.TIME || 'day');
  const h = await ev(() => window.__TAO_RPG__.places.harbor);
  await ev(() => { const g = window.__TAO_RPG__; const p = g.places.harbor; g.teleport(p.x, p.z); g.switchMember('f'); });
  await new Promise((r) => setTimeout(r, 500));
  const X = h.x - 6.8 + Number(process.env.DX || 0), Z = h.z + 3.6 + Number(process.env.DZ || 0);
  const look = await ev(async ([x, z]) => { const g = window.__TAO_RPG__; await g.setCanoe(true, x, z); return g.canoeLook(); }, [X, Z]);
  console.log('canoe', JSON.stringify(look), JSON.stringify(await ev(() => window.__TAO_RPG__.playerPos())));
  await page.keyboard.down('KeyA'); await frames(6); await page.keyboard.up('KeyA');
  await ev(([yaw, pitch, dist]) => { const g = window.__TAO_RPG__; const p = g.playerPos(); g.setCamera({ x: p.x, z: p.z - 1, yaw, pitch, dist, snap: true }); },
    [Number(process.env.YAW || 0.35), Number(process.env.PITCH || 0.5), Number(process.env.DIST || 11)]);
  await frames(6);
  await page.screenshot({ path: path.join(OUT, `${NAME}.png`) });
  console.log('captured', NAME);
} finally {
  await b.close();
  srv.close?.();
}
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
process.exit(0);
