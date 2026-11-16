// Shared test harness for the verify / peek scripts: a safe static server for dist/ and a headless
// Chrome launcher. Both are always torn down by `withHarness` (try/finally), even when a step throws.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

/** Serve `root` under `prefix` (default /Tao-rpg/, like the GitHub Pages path) on 127.0.0.1:port. */
export async function startStaticServer({ root = path.resolve('dist'), prefix = '/Tao-rpg/', port = 8814 } = {}) {
  const rootAbs = path.resolve(root);
  const served = [];
  const server = http.createServer((req, res) => {
    let p;
    try {
      p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      res.writeHead(400);
      return res.end();
    }
    if (!p.startsWith(prefix)) {
      res.writeHead(404);
      return res.end();
    }
    const rel = p.slice(prefix.length) || 'index.html';
    // normalise and refuse anything that resolves outside the served root (`..`, absolute paths)
    const file = path.resolve(rootAbs, path.normalize(rel));
    if (file !== rootAbs && !file.startsWith(rootAbs + path.sep)) {
      served.push([403, p]);
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (e, d) => {
      if (e) {
        served.push([404, p]);
        res.writeHead(404);
        return res.end();
      }
      served.push([200, p]);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(d);
    });
  });
  await new Promise((r, j) => {
    server.once('error', j);
    server.listen(port, '127.0.0.1', r);
  });
  return {
    server,
    served,
    origin: `http://127.0.0.1:${port}/`,
    base: `http://127.0.0.1:${port}${prefix}`,
    close: () => new Promise((r) => server.close(() => r())),
  };
}

const CHROME_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

/** CHROME / CHROME_PATH / PUPPETEER_EXECUTABLE_PATH, else the first installed Chrome / Chromium. */
export function findChrome() {
  const env = process.env.CHROME || process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env) return env;
  const hit = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('No Chrome / Chromium found. Set CHROME=/path/to/chrome.');
  return hit;
}

/** Headless Chrome with software WebGL (SwiftShader), the same flags every script used before. */
/**
 * 0.1.5: with no saved interface language the game follows the browser language (Chinese → 中文, else 中文 + English).
 * Headless Chrome reports en-US, so pages pretend to be a zh-TW browser unless BROWSER_LANG (or opts.lang) says
 * otherwise; `pageLang(page, 'en-US')` changes it for one page (before its first load).
 */
export async function pageLang(page, lang) {
  await page.evaluateOnNewDocument((l) => {
    Object.defineProperty(navigator, 'language', { get: () => l, configurable: true });
    Object.defineProperty(navigator, 'languages', { get: () => [l], configurable: true });
  }, lang);
}
export async function launchBrowser(extraArgs = [], opts = {}) {
  const b = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', ...extraArgs],
  });
  const lang = opts.lang ?? process.env.BROWSER_LANG ?? 'zh-TW';
  const newPage = b.newPage.bind(b);
  b.newPage = async (...a) => { const p = await newPage(...a); await pageLang(p, lang); return p; };
  return b;
}

/** Start server + browser, run `fn`, and always close both. Returns fn's result. */
export async function withHarness(opts, fn) {
  const srv = await startStaticServer(opts);
  let browser = null;
  try {
    browser = await launchBrowser();
    return await fn({ ...srv, browser });
  } finally {
    if (browser) await browser.close().catch(() => {});
    await srv.close();
  }
}

/** The game only exposes window.__TAO_RPG__ in dev builds or with ?debug (see src/core/game.ts). */
export function debugUrl(base, extra = '') {
  return `${base}?debug${extra ? `&${extra}` : ''}`;
}
