// Capture 蘭嶼氣象站 from the default camera on the approach (player stand).
// TAG=before|after OUT=screenshots-015 PORT=8868 node scripts/dev/shot-weather.mjs
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from '../lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-015');
const TAG = process.env.TAG || 'before';
const PORT = Number(process.env.PORT || 8868);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const AT = { x: 18.1, z: 17 };      // building
const STAND = { x: 19.7, z: 14.2 }; // player / road approach
const YAW = Math.atan2(STAND.x - AT.x, STAND.z - AT.z);
const DIST = 25;
const PITCH = 0.58;

const srv = await startStaticServer({ root: path.resolve('dist'), port: PORT });
let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1280, height: 800, deviceScaleFactor: 1 } },
    { tag: 'iphone', v: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ]) {
    const page = await browser.newPage();
    await page.setViewport(vp.v);
    await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    await page.evaluate(() => {
      const g = window.__TAO_RPG__;
      g.clearSave?.();
      g.selectOrigin?.('yayo', 'm', 'boat');
      g.closeAll();
    });
    await sleep(200);
    await page.evaluate((o) => {
      const g = window.__TAO_RPG__;
      g.closeAll();
      g.teleport(o.stand.x, o.stand.z);
      g.gatherParty?.();
      g.setCamera({ x: o.at.x, z: o.at.z, yaw: o.yaw, pitch: o.pitch, dist: o.dist, snap: true });
    }, { at: AT, stand: STAND, yaw: YAW, pitch: PITCH, dist: DIST });
    await sleep(1800);
    const file = path.join(OUT, `${vp.tag}-weather-${TAG}.png`);
    await page.screenshot({ path: file });
    console.log('captured', path.relative(process.cwd(), file));
    await page.close();
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
