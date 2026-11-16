// 0.1.5 phase 1 screenshots (desktop + iPhone size), for the old (0.1.4) and the new build.
//   TAG=before DIST=/path/to/0.1.4/dist node scripts/capture-015p1.mjs
//   TAG=after  node scripts/capture-015p1.mjs            (dist/)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-0141');
const TAG = process.env.TAG || 'after';
const DIST = path.resolve(process.env.DIST || 'dist');
const PORT = Number(process.env.PORT || 8879);
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NEW = TAG === 'after';
const STATION = { x: 18.1, z: 17 };
const info = {};

const srv = await startStaticServer({ root: DIST, port: PORT });
let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1280, height: 800, deviceScaleFactor: 1 } },
    { tag: 'iphone', v: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ]) {
    if (process.env.VP && process.env.VP !== vp.tag) continue;
    const page = await browser.newPage();
    await page.setViewport(vp.v);
    page.on('pageerror', (e) => console.log('pageerror', vp.tag, String(e).slice(0, 200)));
    const ev = (fn, a) => page.evaluate(fn, a);
    const shot = async (name, wait = 900) => {
      if (ONLY && !ONLY.has(name)) return;
      await sleep(wait);
      const file = path.join(OUT, `${vp.tag}-${name}-${TAG}.png`);
      await page.screenshot({ path: file });
      console.log('captured', path.relative(process.cwd(), file));
    };
    await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    await shot('title', 1500);

    // a new game the way the start screens begin it (0.1.4 put the traveller in front)
    await ev(() => {
      const g = window.__TAO_RPG__;
      g.clearSave?.();
      g.selectOrigin('visitor', 'm', 'boat');
    });
    await sleep(600);
    info[`${vp.tag}-lead`] = await ev(() => window.__TAO_RPG__.party().controlled);
    // opening talk (language buttons were inside the box in 0.1.4)
    await shot('dialogue', 1200);
    await ev(() => { const g = window.__TAO_RPG__; for (let i = 0; i < 60 && g.mode() === 'dialogue'; i++) g.advanceDialogue(); g.closeAll(); });
    await sleep(300);

    // leader + default camera, same spot in both builds (開元港 village road, 椰油)
    const spot = await ev(() => { const g = window.__TAO_RPG__; const p = g.places.yayo; return g.roadPointNear(p.x, p.z, 10) || p; });
    await ev((p) => { const g = window.__TAO_RPG__; g.closeAll(); g.teleport(p.x, p.z); g.gatherParty?.(); g.resetView(); }, spot);
    await sleep(300);
    info[`${vp.tag}-cam`] = await ev(() => window.__TAO_RPG__.cam());
    await shot('leader-camera', 1800);

    // weather station from the default camera angle, player on the approach road
    await ev((o) => {
      const g = window.__TAO_RPG__;
      g.closeAll();
      g.resetView();
      const st = g.roadPointNear(o.x, o.z, 8) || { x: o.x + 1.6, z: o.z - 2.8 };
      g.teleport(st.x, st.z);
      g.gatherParty?.();
      g.setCamera({ x: o.x, z: o.z, snap: true });
    }, STATION);
    await shot('weather-station', 2200);

    // notices: an ingredient gathered + the switch-character notice
    await ev(() => { const g = window.__TAO_RPG__; const p = g.places.yayo; const q = g.roadPointNear(p.x, p.z, 10) || p; g.teleport(q.x, q.z); g.gatherParty?.(); g.resetView(); });
    await sleep(800);
    const node = await ev(() => {
      const g = window.__TAO_RPG__;
      const pp = g.playerPos();
      const list = (g.gatherSpots?.() || []).filter((s) => s.ready !== false);
      list.sort((a, b) => Math.hypot(a.x - pp.x, a.z - pp.z) - Math.hypot(b.x - pp.x, b.z - pp.z));
      return list[0] ? { id: list[0].id, x: list[0].x, z: list[0].z } : null;
    });
    if (node && !NEW) {
      await ev((n) => { const g = window.__TAO_RPG__; g.teleport(n.x + 1.2, n.z + 1.2); g.gatherParty?.(); g.resetView(); }, node);
      await sleep(700);
      await ev((n) => window.__TAO_RPG__.gather(n.id), node);
      await shot('notice-item', 350);
    } else if (NEW) {
      // no gather spot open this early: a quest notice and an ingredient pick-up at the same moment
      await ev(() => { const g = window.__TAO_RPG__; g.toast('新任務', '租機車'); g.popLoot('食材＋1'); });
      await shot('notice-item', 450);
    } else {
      // 0.1.4 had no hook for this: the same notice its ingredient pick-up showed (right middle, long text)
      await ev(() => {
        const el = document.getElementById('unlock-toast');
        const b = document.createElement('b');
        b.textContent = '食材＋1';
        el.replaceChildren(b, '飛魚（採集）｜背包裡有 1 份');
        el.classList.add('show');
      });
      await shot('notice-item', 300);
      await ev(() => document.getElementById('unlock-toast').classList.remove('show'));
    }
    await sleep(3500);
    // the "switch member" notice a quest step shows when someone else has to do it
    if (NEW) await ev(() => window.__TAO_RPG__.toast('需要換人', '點頭像換成族女'));
    else {
      await ev(() => {
        const el = document.getElementById('unlock-toast');
        const b = document.createElement('b');
        b.textContent = '需要換人';
        el.replaceChildren(b, '點左上角頭像切換到族女（鍵盤 1／2／3）。');
        el.classList.add('show');
      });
    }
    await shot('notice-switch', 400);
    if (!NEW) await ev(() => document.getElementById('unlock-toast').classList.remove('show'));
    await sleep(3200);

    // goats
    const herd = await ev((isNew) => {
      const g = window.__TAO_RPG__;
      if (isNew) { const h = g.herds().find((x) => x.id === 'herd_badai') || g.herds()[0]; return { x: h.centre.x, z: h.centre.z, n: h.n, coats: h.coats }; }
      const p = g.places.hutou_slope; return p ? { x: p.x, z: p.z } : null;
    }, NEW);
    if (herd) {
      await ev((h) => { const g = window.__TAO_RPG__; g.closeAll(); const st = g.roadPointNear(h.x, h.z, 8) || h; g.teleport(st.x, st.z); g.gatherParty?.(); g.setCamera({ x: h.x, z: h.z, dist: 16, snap: true }); }, herd);
      info[`${vp.tag}-herd`] = herd;
      await shot('goats', 2500);
    }

    // background NPCs around 野銀 after a while
    await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); g.resetView(); g.goto('ivalino'); g.gatherParty?.(); });
    await sleep(9000);
    await shot('npcs-ivalino', 200);

    // the ring road where 0.1.4 was bumpiest (low camera along the road)
    await ev(() => { const g = window.__TAO_RPG__; const q = g.roadPointNear(15.7, 12.5, 6) || { x: 15.7, z: 12.5 }; g.teleport(q.x, q.z); g.gatherParty?.(); g.setCamera({ yaw: 2.3, pitch: 0.22, dist: 14, snap: true }); });
    await shot('road', 2000);

    if (NEW) {
      // notebook 存檔 → 設定: 語言 next to 音樂／音效
      await ev(() => { const g = window.__TAO_RPG__; g.resetView(); g.openJournal(); });
      await sleep(500);
      await ev(() => document.querySelector('#journal-tabs [data-tab="save"]')?.click());
      await sleep(400);
      await ev(() => document.querySelector('.nb-item[data-save="settings"]')?.click());
      await shot('notebook-settings', 800);
      await ev(() => window.__TAO_RPG__.closeJournal());
    }
    await page.close();
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
console.log(JSON.stringify(info));
fs.writeFileSync(path.join(OUT, `capture-${TAG}.json`), JSON.stringify(info, null, 2));
process.exit(0);
