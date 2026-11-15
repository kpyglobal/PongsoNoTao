// 0.1.4 dev: screenshots of the parked plane / moored yacht props (no assertions). OUT=dir
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from '../lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || '/workspace/tao014-logs/props');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8871) });
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 120000 });
  for (const s of ['#btn-origin-yayo', '#btn-gender-f', '#origin-go']) { await page.click(s).catch((e) => console.log('click', s, String(e))); await sleep(400); }
  await sleep(2500);
  await page.evaluate(() => window.__TAO_RPG__.closeAll?.());
  await sleep(1500);
  const pr = await page.evaluate(() => window.__TAO_RPG__.arrivalProps());
  for (const [k, o] of Object.entries(pr)) {
    for (const [tag, yaw, dist, pitch] of [['a', 0.7, 16, 0.5], ['b', -0.9, 12, 0.42]]) {
      await page.evaluate((o, yaw, dist, pitch) => { const g = window.__TAO_RPG__; g.closeAll?.(); g.setCamera({ x: o.x, z: o.z, dist, pitch, yaw, snap: true }); }, o, yaw, dist, pitch);
      await sleep(1800);
      await page.screenshot({ path: path.join(OUT, `${k}-${tag}.png`) });
    }
  }
  console.log(JSON.stringify(pr));
} finally {
  await browser.close();
  await srv.close();
}
