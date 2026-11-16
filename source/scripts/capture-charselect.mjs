// 0.1.5 character select: screenshots on desktop, iPhone portrait and iPhone landscape.
// PREFIX=before|after (default after). After: traveller male + female, tribes differing.
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-charselect');
const PREFIX = process.env.PREFIX || 'after';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8871) });
const fails = [];
const VPS = [
  { tag: 'desktop', v: { width: 1280, height: 800, deviceScaleFactor: 1 } },
  { tag: 'iphone-portrait', v: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { tag: 'iphone-landscape', v: { width: 852, height: 393, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true } },
];
let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of VPS) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => fails.push(`${vp.tag}: ${e}`));
    await page.setViewport(vp.v);
    await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    await page.evaluate(() => window.__TAO_RPG__.clearSave());
    await page.reload({ waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    await page.waitForSelector('#origin-screen', { visible: true, timeout: 30000 });
    await sleep(1200);
    const shot = async (name) => {
      const f = path.join(OUT, `${PREFIX}-${vp.tag}-${name}.png`);
      await page.screenshot({ path: f });
      console.log('captured', path.relative(process.cwd(), f));
    };
    if (PREFIX === 'before') {
      await shot('default');
      await page.close();
      continue;
    }
    await shot('default');
    // tribes differing: 族男 朗島, 族女 野銀; traveller female (tap the portrait)
    await page.select('#sel-origin-m', 'iraraley');
    await page.select('#sel-origin-f', 'ivalino');
    await page.click('#cs-traveller');
    await sleep(500);
    await shot('tribes-differ-traveller-f');
    await page.click('#cs-traveller');
    await sleep(500);
    await shot('tribes-differ-traveller-m');
    // layout check: nothing overlaps the start button, nothing cut off
    const lay = await page.evaluate(() => {
      const r = (s) => document.querySelector(s)?.getBoundingClientRect();
      const go = r('#origin-go');
      const parts = ['#cs-member-m', '#cs-member-f', '#cs-traveller', '#sel-origin-m', '#sel-origin-f', '#btn-gender-m', '#btn-gender-f'];
      const hit = parts.filter((s) => { const b = r(s); return b && go.left < b.right && go.right > b.left && go.top < b.bottom - 1 && go.bottom > b.top + 1; });
      const off = parts.filter((s) => { const b = r(s); return !b || b.left < -1 || b.right > innerWidth + 1; });
      return { hit, off };
    });
    if (lay.hit.length || lay.off.length) fails.push(`${vp.tag}: layout ${JSON.stringify(lay)}`);
    console.log(vp.tag, 'layout', JSON.stringify(lay));
    await page.close();
  }
} finally {
  await browser?.close();
  srv.server.close();
}
if (fails.length) { console.log('FAIL', fails); process.exit(1); }
console.log('OK');
