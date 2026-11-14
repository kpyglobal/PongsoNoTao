// In-game idle close-up (breathing + blink only) → screenshots-octo/idle-frames/*.png,
// then `python3 scripts/dev/idle-gif.py` turns them into desktop-12-idle-in-game.gif.
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-octo', 'idle-frames');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8817) });
let browser = null;
const errors = [];
try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 200 });
  await page.evaluate(() => {
    const g = window.__TAO_RPG__;
    g.selectOrigin('ivalino', 'f');
    g.closeAll();
    g.setTime('day');
    g.stageCast(29.6, 13.1, 1.45, ['elder_ivalino', '@player', 'clinic_nurse']);
    const p = g.playerPos();
    g.setCamera({ yaw: 1.45, pitch: 0.32, dist: 6.5, x: p.x, z: p.z, snap: true });
  });
  await sleep(3000);
  const clip = { x: 400, y: 160, width: 640, height: 560 };
  for (let i = 0; i < 48; i++) {
    await page.screenshot({ path: path.join(OUT, `f${String(i).padStart(2, '0')}.png`), clip });
    await sleep(60);
  }
  console.log(JSON.stringify({ ok: errors.length === 0, errors }));
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
