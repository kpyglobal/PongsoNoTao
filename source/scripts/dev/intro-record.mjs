// 0.1.5 dev: record each arrival route as a 1920x1080 30 fps mp4 for review. The painted intro is stepped frame by
// frame on a held clock (so the video is smooth on a slow headless GPU); menus and the notebook are held stills.
//   WAY=plane|boat OUT=screenshots-015-intro node scripts/dev/intro-record.mjs   (needs ffmpeg)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startStaticServer, launchBrowser, debugUrl } from '../lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-015-intro');
const WAY = process.env.WAY || 'plane';
const FPS = 30;
const HOLD = Number(process.env.HOLD || 5.5); // seconds of the loading loop before the finale
const tmp = fs.mkdtempSync(`/tmp/intro-rec-${WAY}-`);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8876) });
const browser = await launchBrowser();
let n = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const ev = (fn, a) => page.evaluate(fn, a);
  const frame = async (times = 1) => {
    const f = path.join(tmp, `f${String(n).padStart(5, '0')}.png`);
    await page.screenshot({ path: f });
    n++;
    for (let i = 1; i < times; i++) { fs.copyFileSync(f, path.join(tmp, `f${String(n).padStart(5, '0')}.png`)); n++; }
  };
  const press = async (sel) => { await page.waitForSelector(sel, { visible: true, timeout: 20000 }); await page.click(sel); };
  await page.goto(debugUrl(srv.base, 'intro=1'), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  await ev(() => window.__TAO_RPG__.clearSave());
  await page.goto(debugUrl(srv.base, 'intro=1'), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  await sleep(1500);
  await frame(FPS * 1.5);
  await press('#btn-title-start');
  await sleep(500);
  await press('#btn-origin-yayo');
  await press('#btn-gender-f');
  await sleep(400);
  await frame(FPS * 1.2);
  await press('#origin-go');
  await sleep(800);
  await frame(FPS * 1.5);
  await press(`#btn-arrive-${WAY}`);
  // keep the notebook open once it comes (the last finale frames already count as finished)
  await ev(() => { window.__TAO_RPG__.holdArrivalNotebook(true); window.__TAO_RPG__.freezeIntro(0, null); });
  for (let i = 0; i < 300; i++) { const p = await ev(() => window.__TAO_RPG__.arrival().introPose); if (p && p.layers >= 59) break; await sleep(150); }
  await sleep(1800); // logo / letterbox transitions settle
  // reveal + loading loop
  for (let i = 0; i < HOLD * FPS; i++) {
    await ev((t) => window.__TAO_RPG__.freezeIntro(t, null), i / FPS);
    await frame();
  }
  // finale (the logo and the loading bar fade first, as in the game)
  const total = (WAY === 'boat' ? 9.0 : 10.5) + 0.9;
  for (let i = 0; i <= total * FPS; i++) {
    const f = i / FPS;
    await ev(([t, f]) => {
      window.__TAO_RPG__.freezeIntro(t, f);
      const o = Math.max(0, 1 - f / 0.6);
      for (const s of ['#arrival-intro .ai-logo', '#arrival-intro .ai-caption', '#ai-load']) { const e = document.querySelector(s); if (e) { e.style.transition = 'none'; e.style.opacity = String(o * (s === '#ai-load' ? 0.72 : 1)); } }
    }, [HOLD + f, f]);
    await frame();
  }
  // the notebook stamps 抵達蘭嶼 complete (played live, held as stills)
  await ev(() => { const g = window.__TAO_RPG__; g.holdArrivalNotebook(true); g.freezeIntro(4, null); g.freezeIntro(null); });
  for (let i = 0; i < 900; i++) { const a = await ev(() => window.__TAO_RPG__.arrival()); if (a.phase === 'notebook' || !a.playing) break; await sleep(150); }
  await sleep(1500);
  for (let i = 0; i < 4; i++) { await sleep(500); await frame(Math.round(FPS * 0.6)); }
  await ev(() => window.__TAO_RPG__.holdArrivalNotebook(false));
  const mp4 = path.join(OUT, `arrival-${WAY}-1920x1080.mp4`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(tmp, 'f%05d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  console.log('wrote', mp4, n, 'frames', (fs.statSync(mp4).size / 1048576).toFixed(1), 'MB');
} catch (e) {
  console.log('FAIL', e?.stack || e);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
  await browser.close();
  await srv.close();
  process.exit(0);
}
