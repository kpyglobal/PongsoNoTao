import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'screenshots');
const PORT = 8765;
const BASE = `http://127.0.0.1:${PORT}/Tao-rpg/`;

fs.mkdirSync(SHOTS, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const u = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  let p = decodeURIComponent(u.pathname);
  if (p === '/Tao-rpg') p = '/Tao-rpg/';
  if (!p.startsWith('/Tao-rpg/')) {
    res.writeHead(404);
    res.end('not in subpath');
    return;
  }
  let rel = p.slice('/Tao-rpg/'.length);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('missing ' + rel);
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log('serving', DIST, 'at', BASE);

const errors = [];
const pageErrors = [];
const logs = [];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--hide-scrollbars',
    '--font-render-hinting=none',
  ],
});

async function shot(page, name) {
  const dest = path.join(SHOTS, name);
  await page.screenshot({ path: dest, type: 'png' });
  console.log('shot', name, fs.statSync(dest).size);
}

try {
  const page = await browser.newPage();
  page.on('console', (msg) => {
    const t = `${msg.type()}: ${msg.text()}`;
    logs.push(t);
    if (msg.type() === 'error') errors.push(t);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err));
    console.error('PAGEERROR', err);
  });
  page.on('requestfailed', (req) => {
    const u = req.url();
    if (u.includes('favicon')) return;
    const f = `${u} ${req.failure()?.errorText}`;
    errors.push('requestfailed ' + f);
    console.error('REQFAIL', f);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      const u = res.url();
      if (u.includes('favicon')) return;
      errors.push(`HTTP ${res.status()} ${u}`);
      console.error('HTTP', res.status(), u);
    }
  });

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.__TAO_RPG__ && window.__TAO_RPG__.ready, { timeout: 60000 });
  await page.waitForSelector('#origin-screen', { visible: true, timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, '01-origin-desktop-1440x900.png');

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 300));
  await shot(page, '01-origin-mobile-390x844.png');

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluate(() => window.__TAO_RPG__.selectOrigin('yayo'));
  await page.waitForSelector('#hud', { visible: true, timeout: 10000 });
  // dismiss opening dialogue after a beat so the island is visible, but first shoot with dialogue
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, '02-yayo-day-dialogue-1440x900.png');

  // language toggles
  await page.evaluate(() => window.__TAO_RPG__.setLang('zh'));
  await new Promise((r) => setTimeout(r, 200));
  await shot(page, '03-dialogue-zh-only-1440x900.png');
  await page.evaluate(() => window.__TAO_RPG__.setLang('tao'));
  await new Promise((r) => setTimeout(r, 200));
  await shot(page, '03-dialogue-tao-only-1440x900.png');
  await page.evaluate(() => window.__TAO_RPG__.setLang('both'));
  await page.evaluate(() => window.__TAO_RPG__.advanceDialogue());
  await new Promise((r) => setTimeout(r, 400));

  await shot(page, '04-island-day-yayo-1440x900.png');

  // rotate camera a bit
  await page.mouse.move(720, 450);
  await page.mouse.down();
  await page.mouse.move(880, 420, { steps: 12 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, '05-camera-rotated-1440x900.png');

  // times of day
  for (const [period, name] of [
    ['dawn', '06-dawn'],
    ['dusk', '06-dusk'],
    ['night', '06-night'],
    ['day', '06-day-restore'],
  ]) {
    await page.evaluate((p) => window.__TAO_RPG__.setTime(p), period);
    await new Promise((r) => setTimeout(r, 350));
    await shot(page, `${name}-1440x900.png`);
  }

  await page.evaluate(() => window.__TAO_RPG__.setSeason('meyvanwa'));
  await new Promise((r) => setTimeout(r, 300));
  await shot(page, '07-season-meyvanwa-1440x900.png');
  await page.evaluate(() => window.__TAO_RPG__.setSeason('rayon'));

  // pull camera back to show more of the island
  await page.evaluate(() => {
    const api = window.__TAO_RPG__;
    api.teleport(0, 8);
  });
  // zoom out via wheel
  await page.mouse.move(720, 450);
  await page.mouse.wheel({ deltaY: 1800 });
  await new Promise((r) => setTimeout(r, 500));
  await shot(page, '08-island-overview-1440x900.png');

  await page.evaluate(() => window.__TAO_RPG__.teleport(4, 22));
  await page.mouse.move(720, 450);
  await page.mouse.wheel({ deltaY: 900 });
  await new Promise((r) => setTimeout(r, 500));
  await shot(page, '08-south-overview-1440x900.png');

  // clinic + journal
  await page.evaluate(() => {
    const c = window.__TAO_RPG__.places.clinic;
    window.__TAO_RPG__.teleport(c.x + 0.2, c.z + 2.55);
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => window.__TAO_RPG__.interactNearest());
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, '09-clinic-dialogue-1440x900.png');
  await page.evaluate(() => {
    window.__TAO_RPG__.advanceDialogue();
    window.__TAO_RPG__.advanceDialogue();
    window.__TAO_RPG__.advanceDialogue();
  });
  await new Promise((r) => setTimeout(r, 300));

  await page.evaluate(() => window.__TAO_RPG__.openJournal());
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, '10-journal-glossary-1440x900.png');
  await page.click('#journal-tabs button[data-tab="clinic"]');
  await new Promise((r) => setTimeout(r, 250));
  await shot(page, '10-journal-clinic-1440x900.png');
  await page.click('#journal-tabs button[data-tab="milestones"]');
  await new Promise((r) => setTimeout(r, 250));
  await shot(page, '10-journal-milestones-1440x900.png');
  await page.evaluate(() => window.__TAO_RPG__.closeJournal());

  // mobile gameplay
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.evaluate(() => {
    const y = window.__TAO_RPG__.places.yayo;
    window.__TAO_RPG__.teleport(y.x + 1, y.z + 1);
    window.__TAO_RPG__.setTime('dusk');
  });
  await new Promise((r) => setTimeout(r, 500));
  await shot(page, '11-gameplay-mobile-390x844.png');

  const webgl = await page.evaluate(() => {
    const c = document.getElementById('game-canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return {
      ok: Boolean(gl),
      renderer: gl ? gl.getParameter(gl.RENDERER) : null,
      size: [c.width, c.height],
    };
  });
  console.log('WEBGL', JSON.stringify(webgl));

  const report = {
    base: BASE,
    webgl,
    pageErrors,
    consoleErrors: errors,
    logs: logs.slice(-40),
  };
  fs.writeFileSync(path.join(SHOTS, 'verify-report.json'), JSON.stringify(report, null, 2));
  console.log('PAGE_ERRORS', pageErrors.length, pageErrors);
  console.log('CONSOLE_ERRORS', errors.length, errors);
} finally {
  await browser.close();
  server.close();
}

if (pageErrors.length || errors.length) {
  console.error('VERIFICATION_HAS_ISSUES');
  process.exitCode = 2;
} else {
  console.log('VERIFICATION_OK');
}
