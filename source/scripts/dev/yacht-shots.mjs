// 0.1.5 dev: moored yacht stern shots for before/after (no assertions). DIST=dist dir, OUT=dir, TAG=before|after
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from '../lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-0141');
const TAG = process.env.TAG || 'after';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve(process.env.DIST || 'dist'), port: Number(process.env.PORT || 8879) });
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 120000 });
  for (const s of ['#btn-origin-yayo', '#btn-gender-f', '#origin-go']) { await page.click(s).catch(() => {}); await sleep(400); }
  await sleep(2500);
  await page.evaluate(() => window.__TAO_RPG__.closeAll?.());
  await sleep(1500);
  const o = (await page.evaluate(() => window.__TAO_RPG__.arrivalProps())).yacht;
  // yacht yaw is pi/2, so its stern faces world -x: camera yaw -pi/2 looks straight at the transom
  for (const [name, yaw] of [['stern', -Math.PI / 2], ['stern-quarter', -Math.PI / 2 - 0.65]]) {
    await page.evaluate((o, yaw) => { const g = window.__TAO_RPG__; g.closeAll?.(); g.setCamera({ x: o.x, z: o.z, dist: 9, pitch: 0.32, yaw, snap: true }); }, o, yaw);
    await sleep(1800);
    await page.evaluate(() => window.__TAO_RPG__.closeAll?.());
    await sleep(600);
    await page.screenshot({ path: path.join(OUT, `yacht-${name}-${TAG}.png`) });
  }
  console.log(TAG, JSON.stringify(o));
} finally {
  await browser.close();
  await srv.close();
  process.exit(0);
}
