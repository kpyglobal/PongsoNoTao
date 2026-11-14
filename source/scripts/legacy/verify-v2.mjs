// v2 verifier: serves dist/ at /Tao-rpg/, checks console/pageerrors/404s + self-hosted font loading,
// and captures the screenshots-v2/ set.  Usage: npm run build && node scripts/verify-v2.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const DIST = path.resolve('dist');
const OUT = path.resolve('screenshots-v2');
const PORT = Number(process.env.PORT || 8811);
const BASE = `http://127.0.0.1:${PORT}/Tao-rpg/`;
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const served = [];
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith('/Tao-rpg/')) { res.writeHead(404); return res.end(); }
  const rel = p.slice('/Tao-rpg/'.length) || 'index.html';
  fs.readFile(path.join(DIST, rel), (e, d) => {
    if (e) { served.push([404, p]); res.writeHead(404); return res.end(); }
    served.push([200, p]);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});
const report = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], http4xx: [], externalRequests: [], fonts: {}, shots: [] };

async function openPage(viewport) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') report.consoleErrors.push(m.text());
    else if (m.type() === 'warning') report.consoleWarnings.push(m.text());
  });
  page.on('pageerror', (e) => report.pageErrors.push(String(e)));
  page.on('requestfailed', (r) => report.failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('request', (r) => { if (!r.url().startsWith(`http://127.0.0.1:${PORT}/`) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) report.externalRequests.push(r.url()); });
  page.on('response', (r) => { if (r.status() >= 400) report.http4xx.push(`${r.status()} ${r.url()}`); });
  await page.setViewport(viewport);
  await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 500 });
  return page;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const act = (page, s) => page.evaluate((s) => {
  const g = window.__TAO_RPG__;
  if (s.origin) g.selectOrigin(s.origin);
  if (s.closeDialogue) { g.closeMinigame(); for (let i = 0; i < 6; i++) g.advanceDialogue(); }
  if (s.period) g.setTime(s.period);
  if (s.season) g.setSeason(s.season);
  if (s.tp) g.teleport(s.tp[0], s.tp[1]);
  if (s.cam) g.setCamera({ ...s.cam, snap: true });
  if (s.interact) g.interactNearest();
}, s);
async function shot(page, name, wait = 3000) {
  await sleep(wait);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file });
  report.shots.push(file);
  console.log('captured', file);
}
const fontProbe = (page) => page.evaluate(async () => {
  await document.fonts.ready;
  const readyStatus = document.fonts.status;
  const faces = [...document.fonts].map((f) => ({ family: f.family.replace(/"/g, ''), weight: f.weight, status: f.status }));
  const probe = async (spec) => { await document.fonts.load(spec, '蘭嶼文化島'); return document.fonts.check(spec, '蘭嶼文化島'); };
  const checks = {
    'sans 400': await probe('400 16px "Noto Sans TC"'),
    'sans 500': await probe('500 16px "Noto Sans TC"'),
    'sans 700': await probe('700 16px "Noto Sans TC"'),
    'serif 600': await probe('600 16px "Noto Serif TC"'),
    'serif 700': await probe('700 16px "Noto Serif TC"'),
  };
  const facesAfter = [...document.fonts].map((f) => `${f.family.replace(/"/g, '')} ${f.weight}: ${f.status}`);
  const h1 = document.querySelector('.game-title');
  return {
    title: document.title, readyStatus, facesBefore: faces, checks, facesAfter,
    titleFont: h1 ? getComputedStyle(h1).fontFamily : null,
    bodyFont: getComputedStyle(document.body).fontFamily,
    titleText: h1 ? h1.textContent : null,
  };
});

// ---- desktop session ----
const page = await openPage({ width: 1440, height: 900, deviceScaleFactor: 1 });
report.fonts.desktop = await fontProbe(page);
await page.click('#btn-origin-ivalino');
await shot(page, '01-title-cover-desktop.png', 3500);
await act(page, { origin: 'yayo', closeDialogue: true, period: 'day', season: 'rayon', cam: { yaw: 0.85, pitch: 0.66, dist: 88, x: -2, z: 4 } });
await shot(page, '02-island-day-overview.png', 3500);
const taro = await page.evaluate(() => window.__TAO_RPG__.places.taro_ivalino);
await act(page, { tp: [taro.x, taro.z], cam: { yaw: 2.35, pitch: 0.55, dist: 15, x: taro.x - 2.2, z: taro.z + 1.5 } });
await sleep(800);
await act(page, { interact: true });
await shot(page, '03-village-taro-closeup.png', 3500);
await act(page, { closeDialogue: true, period: 'dusk', season: 'rayon', tp: [-36, -4], cam: { yaw: -1.9, pitch: 0.36, dist: 30, x: -37, z: -6.5 } });
await shot(page, '04-dusk-harbor-tatala.png', 3500);
report.fonts.inGame = await page.evaluate(() => [...document.fonts].map((f) => `${f.family.replace(/"/g, '')} ${f.weight}: ${f.status}`));
await page.close();

// ---- mobile session ----
const m = await openPage({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
report.fonts.mobile = await m.evaluate(async () => { await document.fonts.ready; return { status: document.fonts.status, sans: document.fonts.check('400 16px "Noto Sans TC"', '蘭嶼'), serif: document.fonts.check('700 16px "Noto Serif TC"', '蘭嶼') }; });
await act(m, { origin: 'imorod', closeDialogue: true, period: 'day', season: 'rayon', cam: { yaw: 0.4, pitch: 0.66, dist: 36 } });
await m.evaluate(() => window.__TAO_RPG__.clearFocus());
await sleep(600);
await sleep(7000); // let the auto help toast fade
await act(m, { interact: true });
await shot(m, '05-mobile-portrait.png', 2500);
await m.close();

await browser.close();
server.close();
report.fontRequests = served.filter(([, p]) => p.includes('/fonts/'));
report.served404 = served.filter(([c]) => c === 404);
fs.writeFileSync(path.join(OUT, 'verify-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, consoleWarnings: report.consoleWarnings.slice(0, 10) }, null, 2));
const ok = !report.consoleErrors.length && !report.pageErrors.length && !report.http4xx.length && !report.failedRequests.length && !report.externalRequests.length && Object.values(report.fonts.desktop.checks).every(Boolean);
console.log(ok ? 'VERIFY OK' : 'VERIFY FAILED');
process.exit(ok ? 0 : 1);
