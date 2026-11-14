// Style A (Q 版 2.5 頭身) verifier: gender choice + save, player walk / scooter / tatala poses,
// NPC portraits, scale beside buildings. Desktop 1440x900 and iPhone 16 Pro (390x844 @3x).
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-styleA');
const PORT = Number(process.env.PORT || 8815);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = await startStaticServer({ root: path.resolve('dist'), port: PORT });
const BASE = debugUrl(srv.base);
const report = { errors: [], http4xx: [], checks: {}, shots: [] };
let browser = null;
let exitCode = 1;
try {
  browser = await launchBrowser();
  async function openPage(viewport) {
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    page.on('response', (r) => { if (r.status() >= 400) report.http4xx.push(`${r.status()} ${r.url()}`); });
    await page.setViewport(viewport);
    await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 200 });
    return page;
  }
  async function shot(page, name, wait = 2200) {
    await sleep(wait);
    const file = path.join(OUT, name);
    await page.screenshot({ path: file });
    report.shots.push(file);
    console.log('captured', file);
  }
  const ev = (page, fn, arg) => page.evaluate(fn, arg);
  /** hold a movement key while capturing so the walk / ride / paddle frames are mid-animation */
  async function moving(page, key, name, hold = 900) {
    await page.keyboard.down(key);
    await sleep(hold);
    const file = path.join(OUT, name);
    await page.screenshot({ path: file });
    await page.keyboard.up(key);
    report.shots.push(file);
    console.log('captured', file);
  }

  for (const vp of [
    { tag: 'desktop', v: { width: 1440, height: 900, deviceScaleFactor: 1 } },
    { tag: 'mobile', v: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  ]) {
    const page = await openPage(vp.v);
    const T = vp.tag;
    // ---- gender-select screen: pick 女生 through the real UI ----
    await page.waitForSelector('#origin-screen', { visible: true, timeout: 60000 }).catch(() => {});
    await page.click('#btn-origin-ivalino').catch(() => {});
    await page.click('#btn-gender-f');
    await sleep(300);
    report.checks[`${T}-genderUi`] = await ev(page, () => ({
      fChecked: document.getElementById('btn-gender-f').getAttribute('aria-checked'),
      mChecked: document.getElementById('btn-gender-m').getAttribute('aria-checked'),
      preview: getComputedStyle(document.querySelector('#btn-gender-f .gp-sprite')).backgroundImage,
    }));
    await page.$eval('#gender-pick', (el) => el.scrollIntoView({ block: 'center' }));
    await shot(page, `${T}-01-gender-select.png`, 600);
    await page.click('#origin-go');
    await sleep(800);
    report.checks[`${T}-start`] = await ev(page, () => {
      const g = window.__TAO_RPG__;
      return { save: g.saveState(), mode: g.playerMode(), portrait: g.portrait(),
        dlgPortrait: document.querySelector('#dlg-portrait img')?.getAttribute('src') };
    });
    console.log(T, 'start', report.checks[`${T}-start`]);
    await shot(page, `${T}-02-female-start-dialogue.png`, 1500);

    // ---- female walking in Ivalino village ----
    await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.closeAll(); g.setTime('day'); g.setSeason('rayon');
      const p = g.places.ivalino;
      g.teleport(p.x - 1.0, p.z + 5.0);
      g.setCamera({ yaw: -0.3, pitch: 0.42, dist: vpDist(), snap: true });
      g.clearFocus();
      function vpDist() { return innerWidth < 600 ? 9 : 8; }
    });
    await sleep(1500);
    await moving(page, 'KeyA', `${T}-03-female-walking-village.png`);

    // ---- male walking ----
    await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.setGender('m');
      const p = g.places.ivalino;
      g.teleport(p.x - 1.5, p.z + 3.5);
      g.setCamera({ yaw: -0.3, pitch: 0.42, dist: innerWidth < 600 ? 9 : 8, snap: true });
      g.clearFocus();
    });
    report.checks[`${T}-male`] = await ev(page, () => ({ save: window.__TAO_RPG__.saveState().gender, portrait: window.__TAO_RPG__.portrait() }));
    await sleep(1200);
    await moving(page, 'KeyD', `${T}-04-male-walking-village.png`);

    // ---- scooter (ride sheet replaces the walker; no separate scooter sprite) ----
    await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.setGender('f');
      const road = g.roadPointNear(-21, -20.5) ?? { x: -21, z: -20.5 };
      g.teleport(road.x, road.z);
      g.setScooter(true);
      g.setCamera({ yaw: -2.4, pitch: 0.42, dist: innerWidth < 600 ? 9 : 8, snap: true });
      g.clearFocus();
    });
    report.checks[`${T}-scooter`] = await ev(page, () => window.__TAO_RPG__.playerPos());
    await sleep(1200);
    await moving(page, 'KeyA', `${T}-05-scooter-riding.png`, 700);
    await ev(page, () => window.__TAO_RPG__.setGender('m'));
    await sleep(500);
    await moving(page, 'KeyW', `${T}-05b-scooter-riding-male.png`, 700);

    // ---- tatala paddling off the harbour ----
    await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.setScooter(false);
      const h = g.places.harbor;
      g.teleport(h.x, h.z);
      g.setCanoe(true, h.x - 12, h.z + 6);
      g.setCamera({ yaw: -1.3, pitch: 0.4, dist: innerWidth < 600 ? 10 : 9, snap: true });
      g.clearFocus();
    });
    report.checks[`${T}-canoe`] = await ev(page, () => window.__TAO_RPG__.playerPos());
    console.log(T, 'canoe', report.checks[`${T}-canoe`]);
    await sleep(1500);
    await moving(page, 'KeyA', `${T}-06-canoe-paddling.png`, 1100);
    await ev(page, () => window.__TAO_RPG__.setGender('f'));
    await sleep(400);
    await moving(page, 'KeyS', `${T}-06b-canoe-paddling-front.png`, 900);
    report.checks[`${T}-canoeMove`] = await ev(page, () => window.__TAO_RPG__.playerPos());
    report.checks[`${T}-ashore`] = await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.setCanoe(false);
      const p = g.playerPos();
      return { ...p, canStand: g.canStandAt(p.x, p.z) };
    });

    // ---- scale: player beside NPCs and buildings ----
    await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.setGender('m');
      g.closeAll();
      g.stageCast(29.6, 13.1, 1.45, ['elder_ivalino', 'villager_taro', 'villager_harbor', '@player', 'clinic_nurse', 'harbor_staff', 'tourist_b']);
      g.setCamera({ yaw: 1.45, pitch: 0.36, dist: innerWidth < 600 ? 11 : 9, x: 29.6, z: 13.1, snap: true });
    });
    await shot(page, `${T}-07-scale-cast-and-houses.png`, 2500);
    await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.stageCast(-36.6, -5.2, -1.4, ['tourist_a', 'villager_iranmeylek', '@player', 'villager_harbor', 'harbor_staff']);
      g.setCamera({ yaw: -1.7, pitch: 0.34, dist: innerWidth < 600 ? 13 : 12, x: -36.6, z: -5.4, snap: true });
    });
    await shot(page, `${T}-08-scale-harbor.png`, 2500);

    // ---- NPC dialogue with the new portraits ----
    for (const [id, file] of [['elder_ivalino', '09-dialogue-elder'], ['villager_harbor', '10-dialogue-fisher'], ['clinic_nurse', '11-dialogue-nurse']]) {
      await ev(page, (id) => {
        const g = window.__TAO_RPG__;
        g.closeAll();
        g.talkTo(id);
      }, id);
      const src = await ev(page, () => document.querySelector('#dlg-portrait img')?.getAttribute('src'));
      report.checks[`${T}-${id}-portrait`] = src;
      await shot(page, `${T}-${file}.png`, 1600);
    }
    await page.close();
  }
  const c = report.checks;
  const ok = ['desktop', 'mobile'].every((t) =>
    c[`${t}-genderUi`].fChecked === 'true' && c[`${t}-start`].save.gender === 'f' && c[`${t}-start`].portrait === 'local_f'
    && c[`${t}-male`].save === 'm' && c[`${t}-scooter`].mode === 'scooter' && c[`${t}-canoe`].mode === 'canoe'
    && c[`${t}-ashore`].mode === 'walk' && c[`${t}-ashore`].canStand && !!c[`${t}-elder_ivalino-portrait`]);
  report.ok = ok && report.errors.length === 0 && report.http4xx.length === 0;
  fs.writeFileSync(path.join(OUT, 'report-styleA.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, errors: report.errors, http4xx: report.http4xx, checks: report.checks }, null, 1));
  exitCode = report.ok ? 0 : 2;
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
  process.exit(exitCode);
}
