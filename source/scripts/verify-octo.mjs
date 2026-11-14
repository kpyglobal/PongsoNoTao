// 方案二 歧路旅人風 verifier: character select (族人／臺灣本島／外國 traveller x 男女, 隨機), save,
// walk + idle sheets (8 rows), scooter / tatala, portraits, scale beside buildings, idle GIF frames.
// Desktop 1440x900 and iPhone 16 Pro (390x844 @3x).
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-octo');
const PORT = Number(process.env.PORT || 8816);
fs.mkdirSync(OUT, { recursive: true });
const IDLE_DIR = path.join(OUT, 'idle-frames');
fs.mkdirSync(IDLE_DIR, { recursive: true });
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
    // ---- character select: 族人 first (來自 hidden), then 外來訪客 → 外國 → 女生 ----
    await page.waitForSelector('#origin-screen', { visible: true, timeout: 60000 }).catch(() => {});
    await page.click('#btn-origin-ivalino');
    await sleep(200);
    report.checks[`${T}-fromHiddenForLocal`] = await ev(page, () => document.getElementById('from-pick').hidden);
    await page.click('#btn-origin-visitor');
    await sleep(200);
    await page.click('#btn-from-intl');
    await page.click('#btn-gender-f');
    await sleep(400);
    report.checks[`${T}-selectUi`] = await ev(page, () => ({
      fromVisible: !document.getElementById('from-pick').hidden,
      intlChecked: document.getElementById('btn-from-intl').getAttribute('aria-checked'),
      fChecked: document.getElementById('btn-gender-f').getAttribute('aria-checked'),
      previewF: getComputedStyle(document.querySelector('#btn-gender-f .gp-sprite')).backgroundImage,
    }));
    await page.$eval('#gender-pick', (el) => el.scrollIntoView({ block: 'center' }));
    await shot(page, `${T}-01-character-select.png`, 700);
    await page.click('#origin-go');
    await sleep(900);
    report.checks[`${T}-start`] = await ev(page, () => {
      const g = window.__TAO_RPG__;
      return { save: g.saveState(), outfit: g.outfit(), mode: g.playerMode(), portrait: g.portrait(),
        dlgPortrait: document.querySelector('#dlg-portrait img')?.getAttribute('src') };
    });
    console.log(T, 'start', report.checks[`${T}-start`]);
    await shot(page, `${T}-02-foreign-traveller-start-dialogue.png`, 1500);

    // ---- 族男 / 族女 in Ivalino ----
    await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.closeAll();
      g.selectOrigin('ivalino', 'm');
      g.closeAll(); g.setTime('day'); g.setSeason('rayon');
      const p = g.places.ivalino;
      g.teleport(p.x - 1.5, p.z + 3.5);
      g.setCamera({ yaw: -0.3, pitch: 0.42, dist: innerWidth < 600 ? 9.5 : 8.5, snap: true });
      g.clearFocus();
    });
    report.checks[`${T}-localM`] = await ev(page, () => ({ outfit: window.__TAO_RPG__.outfit(), portrait: window.__TAO_RPG__.portrait() }));
    await sleep(1200);
    await moving(page, 'KeyD', `${T}-03-tao-male-village.png`);
    await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.setGender('f');
      const p = g.places.ivalino;
      g.teleport(p.x - 1.0, p.z + 5.0);
      g.setCamera({ yaw: -0.3, pitch: 0.42, dist: innerWidth < 600 ? 9.5 : 8.5, snap: true });
      g.clearFocus();
    });
    report.checks[`${T}-localF`] = await ev(page, () => ({ outfit: window.__TAO_RPG__.outfit(), portrait: window.__TAO_RPG__.portrait(), save: window.__TAO_RPG__.saveState().gender }));
    await sleep(1200);
    await moving(page, 'KeyA', `${T}-04-tao-female-village.png`);

    // ---- traveller with NPCs and buildings ----
    await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.selectOrigin('visitor', 'm', 'intl');
      g.closeAll();
      g.stageCast(29.6, 13.1, 1.45, ['elder_ivalino', 'villager_taro', 'villager_harbor', '@player', 'clinic_nurse', 'harbor_staff', 'tourist_b']);
      g.setCamera({ yaw: 1.45, pitch: 0.36, dist: innerWidth < 600 ? 11 : 9, x: 29.6, z: 13.1, snap: true });
    });
    report.checks[`${T}-foreignM`] = await ev(page, () => ({ outfit: window.__TAO_RPG__.outfit(), portrait: window.__TAO_RPG__.portrait(), save: window.__TAO_RPG__.saveState() }));
    await shot(page, `${T}-05-traveller-with-npcs-and-houses.png`, 2500);
    await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.setTraveler('tw'); g.setGender('f');
      g.stageCast(-36.6, -5.2, -1.4, ['tourist_a', 'villager_iranmeylek', '@player', 'villager_harbor', 'harbor_staff']);
      g.setCamera({ yaw: -1.7, pitch: 0.34, dist: innerWidth < 600 ? 13 : 12, x: -36.6, z: -5.4, snap: true });
    });
    await shot(page, `${T}-06-taiwan-traveller-harbor.png`, 2500);

    // ---- scooter ----
    await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.setTraveler('intl'); g.setGender('f');
      const road = g.roadPointNear(-21, -20.5) ?? { x: -21, z: -20.5 };
      g.teleport(road.x, road.z);
      g.setScooter(true);
      g.setCamera({ yaw: -2.4, pitch: 0.42, dist: innerWidth < 600 ? 8 : 7, snap: true });
      g.clearFocus();
    });
    report.checks[`${T}-scooter`] = await ev(page, () => window.__TAO_RPG__.playerPos());
    await sleep(1200);
    await moving(page, 'KeyA', `${T}-07-scooter-side.png`, 700);
    await ev(page, () => { const g = window.__TAO_RPG__; g.selectOrigin('iratay', 'm'); g.closeAll();
      const road = g.roadPointNear(-21, -20.5) ?? { x: -21, z: -20.5 }; g.teleport(road.x, road.z); g.setScooter(true);
      g.setCamera({ yaw: -2.4, pitch: 0.42, dist: innerWidth < 600 ? 8 : 7, snap: true }); g.clearFocus(); });
    await sleep(800);
    await moving(page, 'KeyS', `${T}-07b-scooter-front.png`, 700);

    // ---- tatala ----
    await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.setScooter(false);
      const h = g.places.harbor;
      g.teleport(h.x, h.z);
      g.setCanoe(true, h.x - 12, h.z + 6);
      g.setCamera({ yaw: -1.3, pitch: 0.4, dist: innerWidth < 600 ? 9 : 8, snap: true });
      g.clearFocus();
    });
    report.checks[`${T}-canoe`] = await ev(page, () => window.__TAO_RPG__.playerPos());
    await sleep(1500);
    await moving(page, 'KeyA', `${T}-08-canoe-side.png`, 1100);
    await ev(page, () => window.__TAO_RPG__.setGender('f'));
    await sleep(400);
    await moving(page, 'KeyS', `${T}-08b-canoe-front.png`, 900);
    report.checks[`${T}-ashore`] = await ev(page, () => {
      const g = window.__TAO_RPG__;
      g.setCanoe(false);
      const p = g.playerPos();
      return { ...p, canStand: g.canStandAt(p.x, p.z) };
    });

    // ---- NPC dialogue with portraits ----
    for (const [id, file] of [['elder_ivalino', '09-dialogue-elder'], ['clinic_nurse', '10-dialogue-nurse'], ['harbor_staff', '11-dialogue-harbor']]) {
      await ev(page, (id) => {
        const g = window.__TAO_RPG__;
        g.closeAll();
        g.stageCast(29.6, 13.1, 1.45, [id, '@player']);
        g.setCamera({ yaw: 1.45, pitch: 0.36, dist: innerWidth < 600 ? 8 : 7, x: 29.6, z: 13.1, snap: true });
        g.talkTo(id);
      }, id);
      const src = await ev(page, () => document.querySelector('#dlg-portrait img')?.getAttribute('src'));
      report.checks[`${T}-${id}-portrait`] = src;
      await shot(page, `${T}-${file}.png`, 1600);
    }

    // ---- idle close-up frames (desktop only → GIF) ----
    if (T === 'desktop') {
      await ev(page, () => {
        const g = window.__TAO_RPG__;
        g.closeAll();
        g.selectOrigin('ivalino', 'f');
        g.closeAll();
        g.stageCast(29.6, 13.1, 1.45, ['elder_ivalino', '@player', 'villager_harbor']);
        g.setCamera({ yaw: 1.45, pitch: 0.3, dist: 4.6, x: 29.6, z: 13.1, snap: true });
      });
      await sleep(2500);
      const clip = { x: 420, y: 180, width: 600, height: 520 };
      for (let i = 0; i < 40; i++) {
        await page.screenshot({ path: path.join(IDLE_DIR, `f${String(i).padStart(2, '0')}.png`), clip });
        await sleep(70);
      }
      report.checks.idleFrames = 40;
    }
    await page.close();
  }
  const c = report.checks;
  const ok = ['desktop', 'mobile'].every((t) =>
    c[`${t}-fromHiddenForLocal`] === true && c[`${t}-selectUi`].fromVisible && c[`${t}-selectUi`].intlChecked === 'true'
    && c[`${t}-start`].save.gender === 'f' && c[`${t}-start`].save.travelerFrom === 'intl' && c[`${t}-start`].outfit === 'player_foreign_f'
    && c[`${t}-start`].portrait === 'visitor_intl_f' && (c[`${t}-start`].dlgPortrait || '').includes('visitor_intl_f')
    && c[`${t}-localM`].outfit === 'player' && c[`${t}-localF`].outfit === 'player_f' && c[`${t}-localF`].portrait === 'local_f'
    && c[`${t}-foreignM`].outfit === 'player_foreign' && c[`${t}-foreignM`].portrait === 'visitor_intl_m'
    && c[`${t}-scooter`].mode === 'scooter' && c[`${t}-canoe`].mode === 'canoe'
    && c[`${t}-ashore`].mode === 'walk' && c[`${t}-ashore`].canStand && !!c[`${t}-elder_ivalino-portrait`]);
  report.ok = ok && report.errors.length === 0 && report.http4xx.length === 0;
  fs.writeFileSync(path.join(OUT, 'report-octo.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, errors: report.errors, http4xx: report.http4xx, checks: report.checks }, null, 1));
  exitCode = report.ok ? 0 : 2;
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
  process.exit(exitCode);
}
