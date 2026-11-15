// 0.1.4 dev: screenshots of the painted intro at chosen times (no assertions). OUT=dir WAY=plane|boat TIMES=0,3,8
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from '../lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || '/workspace/tao014-logs/frames');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8870) });
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await page.setViewport({ width: Number(process.env.W || 1280), height: Number(process.env.H || 720), deviceScaleFactor: 1 });
  await page.goto(debugUrl(srv.base, 'intro=1'), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 120000 });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, 'title.png') });
  const way = process.env.WAY || 'plane';
  await page.evaluate((w) => window.__TAO_RPG__.playArrival('yayo', 'f', w), way);
  for (const t of (process.env.TIMES || '0.5,3,8,16,30').split(',').map(Number)) {
    await page.evaluate((t) => window.__TAO_RPG__.seekIntro(t), t);
    await sleep(600);
    await page.screenshot({ path: path.join(OUT, `${way}-${t}${process.env.TAG || ''}.png`) });
    console.log('shot', t, JSON.stringify(await page.evaluate(() => window.__TAO_RPG__.arrival())));
  }
  if (process.env.PUSH) {
    // let the ride run on: once the island has loaded and the logo is gone, catch the push at a few points
    await page.evaluate(() => window.__TAO_RPG__.seekIntro(0));
    const want = process.env.PUSH.split(',').map(Number);
    const t0 = Date.now();
    while (want.length && Date.now() - t0 < 90000) {
      const a = await page.evaluate(() => window.__TAO_RPG__.arrival());
      const p = a?.introPose?.push ?? (a?.phase === 'approach' ? 1 : 0);
      if (p >= want[0]) {
        await page.screenshot({ path: path.join(OUT, `${way}-push-${want[0]}.png`) });
        console.log('push', want[0], p.toFixed(2));
        want.shift();
      }
      await sleep(40);
    }
  }
  console.log('errors', errs.slice(0, 10));
} finally {
  await browser.close();
  await srv.close();
}
