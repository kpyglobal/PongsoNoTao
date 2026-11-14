// Style test v2: harbour from the target-ref angle (UI hidden), several season × time looks.
// node scripts/capture-style-v2.mjs  env: OUT dir, TAG prefix, SHOTS "season:period,..."  (local static server, closed at the end)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-style/v2');
const TAG = process.env.TAG || 'new';
const SHOTS = (process.env.SHOTS || 'rayon:day').split(',').map((s) => s.split(':'));
const CAM = JSON.parse(process.env.CAM || '{"yaw":0.7,"pitch":0.72,"dist":30}');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8872) });
const errors = [];
const b = await launchBrowser();
try {
  const page = await b.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  const ev = (fn, a) => page.evaluate(fn, a);
  const boot = async () => {
    await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  };
  await boot();
  await ev(() => window.__TAO_RPG__.clearSave());
  await boot();
  await page.waitForSelector('#btn-origin-ivalino', { visible: true, timeout: 30000 });
  await page.click('#btn-origin-ivalino');
  await page.click('#btn-gender-m');
  await page.click('#origin-go');
  await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
  for (let i = 0; i < 40 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(100); }
  await page.addStyleTag({ content: 'body *{visibility:hidden !important} canvas{visibility:visible !important}' });
  await ev((cam) => {
    const g = window.__TAO_RPG__; g.closeAll();
    const p = g.places.harbor; const q = g.roadPointNear(p.x, p.z, 20) || p;
    g.teleport(q.x, q.z); g.gatherParty(); g.setCamera({ ...cam, snap: true });
  }, CAM);
  await sleep(2500);
  for (const [season, period] of SHOTS) {
    await ev(({ season, period }) => { const g = window.__TAO_RPG__; g.setSeason(season); g.setTime(period); }, { season, period });
    await sleep(1800);
    const f = path.join(OUT, `${TAG}-${season}-${period}.png`);
    await page.screenshot({ path: f });
    console.log('shot', f);
  }
} finally {
  await b.close();
  await srv.close?.();
}
console.log(errors.length ? `errors ${errors.length}: ${errors.slice(0, 3).join(' | ')}` : '0 console errors');
