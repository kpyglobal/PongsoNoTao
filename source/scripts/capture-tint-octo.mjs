// Before / after shots for: overlap tint (farther character ~0.85), unlit no-shine sprites,
// shade zones (eaves / building side / tree → ~0.75), and 文字大小 小／中／大.
// ROOT=<dist dir> TAG=before|after node scripts/capture-tint-octo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const ROOT = path.resolve(process.env.ROOT || 'dist');
const TAG = process.env.TAG || 'after';
const OUT = path.resolve(process.env.OUT || 'screenshots-octo', 'tint');
const SPOTS = path.join(OUT, 'spots.json');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: ROOT, port: Number(process.env.PORT || (TAG === 'before' ? 8818 : 8819)) });
const report = { tag: TAG, errors: [], http4xx: [], checks: {} };
let browser = null;
try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('pageerror', (e) => report.errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) report.http4xx.push(`${r.status()} ${r.url()}`); });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 200 });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (name, wait = 2500) => { await sleep(wait); await page.screenshot({ path: path.join(OUT, `${TAG}-${name}.png`) }); console.log('captured', name); };

  await ev(() => { const g = window.__TAO_RPG__; g.selectOrigin('ivalino', 'm'); g.closeAll(); g.setTime('day'); g.setSeason('rayon'); });

  // shade spots are found once with the new debug API, then reused for the "before" build
  let spots;
  if (TAG !== 'before') {
    spots = await ev(() => {
      const g = window.__TAO_RPG__;
      // against the 開元港 harbour office on the open apron (no trees blocking the camera)
      const h = g.places.harbor;
      const eave = g.findShade(h.x + 0.7, h.z + 4.2, 0.95, 6) ?? g.findShade(g.places.ivalino.x, g.places.ivalino.z + 3, 0.95, 25);
      return { eave, stats: g.shadeStats() };
    });
    fs.writeFileSync(SPOTS, JSON.stringify(spots, null, 2));
  } else spots = JSON.parse(fs.readFileSync(SPOTS, 'utf8'));
  report.checks.spots = spots;

  // 1) overlap: a line of characters running away from the camera
  await ev(() => {
    const g = window.__TAO_RPG__;
    g.stageCast(-36.6, -5.2, -1.4, ['tourist_a', 'villager_iranmeylek', '@player', 'clinic_nurse', 'harbor_staff']);
    g.setCamera({ yaw: -1.4 + 1.2, pitch: 0.34, dist: 8, x: -36.6, z: -5.2, snap: true });
  });
  await shot('01-overlap');
  if (TAG !== 'before') report.checks.overlapTints = await ev(() => window.__TAO_RPG__.tints().filter((t) => ['@player', 'tourist_a', 'villager_iranmeylek', 'clinic_nurse', 'harbor_staff'].includes(t.id)));

  // 2) shine: white coat + hi-vis vest + rim edges in full daylight, close
  await ev(() => {
    const g = window.__TAO_RPG__;
    g.stageCast(-36.6, -5.2, -1.4, ['clinic_nurse', '@player', 'harbor_staff', 'tourist_a']);
    g.setCamera({ yaw: -1.4, pitch: 0.3, dist: 5.5, x: -36.6, z: -5.2, snap: true });
  });
  await shot('02-shine-closeup');

  // 3) shade: player under the eaves beside a house, an NPC a few steps out in the sun
  if (spots.eave) {
    await ev((s) => {
      const g = window.__TAO_RPG__;
      g.teleport(s.x, s.z);
      g.setCamera({ yaw: -1.4, pitch: 0.34, dist: 7, x: s.x, z: s.z, snap: true });
    }, spots.eave);
    await shot('03-shade-eaves', 3000);
    if (TAG !== 'before') report.checks.shadeTint = await ev(() => window.__TAO_RPG__.tints()[0]);
    // the same spot with the player stepped out into the sun
    const sun = await ev((s) => {
      const g = window.__TAO_RPG__;
      for (let r = 1.5; r < 8; r += 0.5) for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2; const x = s.x + Math.cos(a) * r; const z = s.z + Math.sin(a) * r;
        if (g.canStandAt(x, z) && (!g.shadeAt || g.shadeAt(x, z) === 0)) return { x, z };
      }
      return null;
    }, spots.eave);
    if (sun) {
      await ev((s) => { window.__TAO_RPG__.teleport(s.x, s.z); }, sun);
      await shot('04-shade-stepped-into-sun', 3000);
      if (TAG !== 'before') report.checks.sunTint = await ev(() => window.__TAO_RPG__.tints()[0]);
    }
  }

  // 4) dialogue text size (after: 小 / 中 / 大 via the 操作說明 sheet; before: original size)
  await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); g.stageCast(29.6, 13.1, 1.45, ['elder_ivalino', '@player']);
    g.setCamera({ yaw: 1.45, pitch: 0.36, dist: 7, x: 29.6, z: 13.1, snap: true }); g.talkTo('elder_ivalino'); });
  if (TAG === 'before') await shot('05-text-original', 1500);
  else {
    for (const ts of ['s', 'm', 'l']) {
      await ev((ts) => { document.querySelector(`#text-size button[data-ts="${ts}"]`).click(); }, ts);
      report.checks[`ts-${ts}`] = await ev(() => ({ v: getComputedStyle(document.documentElement).getPropertyValue('--ts').trim(), saved: localStorage.getItem('tao-rpg:textSize'),
        zhFont: getComputedStyle(document.getElementById('dlg-zh')).fontSize }));
      await shot(`05-text-${ts}`, 800);
    }
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 200 });
    report.checks.tsAfterReload = await ev(() => getComputedStyle(document.documentElement).getPropertyValue('--ts').trim());
    await ev(() => { document.querySelector('#text-size button[data-ts="m"]').click(); });
  }
  report.ok = report.errors.length === 0 && report.http4xx.length === 0;
  fs.writeFileSync(path.join(OUT, `report-${TAG}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
