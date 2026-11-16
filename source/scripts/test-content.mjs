// Phase B check (desktop): content/ loads (counts), the 5 new places are reachable by goto, time / season windows,
// gather nodes (needed-only, tide, perDay, new-day reset), observe → 圖鑑, 背包／圖鑑 page, outfits (unlock → wear →
// portrait swap, sprite falls back to the base sheet, traveller cannot wear Tao clothing), recipe keeper chat, NPC
// actions, passers-by + quest kids. Fails on page errors / any 4xx except outfit variant walk sheets (not drawn
// yet: the base sheet is the designed fallback, counted not failed).
// node scripts/test-content.mjs   (DIST=dist)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-content');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve(process.env.DIST || 'dist'), port: Number(process.env.PORT || 8871) });
const errors = [], http4xx = [], itemArt404 = [], fails = [];
const check = (name, ok, info) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`, info !== undefined ? JSON.stringify(info).slice(0, 300) : ''); if (!ok) fails.push(name); };
const b = await launchBrowser();
try {
  const page = await b.newPage();
  page.on('pageerror', (e) => errors.push(`${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) (/__[a-z_]+_sheet\.png$/.test(r.url()) ? itemArt404 : http4xx).push(`${r.status()} ${r.url()}`); });
  page.on('dialog', (d) => d.accept());
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const ev = (fn, a) => page.evaluate(fn, a);
  const boot = async () => {
    await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  };
  await boot();
  await ev(() => window.__TAO_RPG__.clearSave());
  await boot();
  await page.waitForSelector('#sel-origin-m', { visible: true, timeout: 30000 });
  await page.select('#sel-origin-m', 'iratay'); await page.select('#sel-origin-f', 'iratay'); await page.click('#btn-gender-m'); await page.click('#origin-go');
  await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
  const drain = async () => { for (let i = 0; i < 60 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(40); } };
  await drain();

  const c = await ev(() => window.__TAO_RPG__.content());
  check('content: 163 quests, 23 items, 7 recipes, 56 NPCs, 8 nodes, 4 outfits', c.quests === 163 && c.items === 23 && c.recipes === 7 && c.npcs === 56 && c.gatherNodes === 8 && c.outfits === 4, c);

  for (const id of ['iranmeylek_beach', 'iratay_shore', 'iratay_school', 'wakay_iratay', 'owl_road']) {
    const r = await ev((id) => { const g = window.__TAO_RPG__; g.closeAll(); const ok = g.goto(id); return { ok, p: g.playerPos(), stand: g.canStandAt(g.playerPos().x, g.playerPos().z) }; }, id);
    check(`goto ${id}`, !!r.ok && r.stand, r);
  }

  // QA L1: arriving at 野銀 / 東清 by goto, every party member stands on walkable ground
  for (const id of ['ivalino', 'iranmeylek', 'imorod']) {
    const r = await ev((id) => { const g = window.__TAO_RPG__; g.closeAll(); g.goto(id); const pos = g.party().pos; return Object.fromEntries(Object.entries(pos).map(([k, p]) => [k, g.canStandAt(p.x, p.z)])); }, id);
    check(`goto ${id}: whole party on standable ground`, Object.values(r).every(Boolean), r);
  }

  // windows: winter-only photo P30, night quest NT1
  let w = await ev(() => { const g = window.__TAO_RPG__; g.setSeason('summer'); g.setTime('day'); return g.clock(); });
  check('setSeason(summer) → rayon / summer', w.season === 'rayon' && w.seasonTag === 'summer', w);
  w = await ev(() => window.__TAO_RPG__.fitWhen('P30'));
  check('fitWhen(P30) → winter season (styleConfig SEASON_KIND)', w && w.ok && w.season === 'off', w);
  w = await ev(() => window.__TAO_RPG__.fitWhen('NT1'));
  check('fitWhen(NT1) → night', w && w.ok && w.period === 'night', w);

  // gathering: FD5 needs shellfish ×2 + seaweed ×2 (low tide = dawn / dusk, perDay 2)
  await ev(() => { const g = window.__TAO_RPG__; g.setSeason('summer'); g.setTime('day'); g.startQuest('FD5', 1); });
  let live = await ev(() => window.__TAO_RPG__.gatherSpots().map((s) => s.id));
  check('high tide: shellfish nodes closed', !live.includes('gn_shellfish_im'), live);
  await ev(() => window.__TAO_RPG__.setTime('dawn'));
  live = await ev(() => window.__TAO_RPG__.gatherSpots().map((s) => s.id));
  check('low tide (dawn): shellfish + seaweed nodes open, only needed items', live.includes('gn_shellfish_im') && live.includes('gn_seaweed_im') && !live.includes('gn_ovi_peak'), live);
  await ev(() => window.__TAO_RPG__.gather('gn_shellfish_im'));
  await ev(() => window.__TAO_RPG__.closeAll());
  const n1 = await ev(() => window.__TAO_RPG__.items().shellfish ?? 0);
  check('gather → bag +1', n1 === 1, n1);
  await ev(() => { const g = window.__TAO_RPG__; g.giveItem('shellfish', -1); g.gather('gn_shellfish_im'); g.closeAll(); g.giveItem('shellfish', -1); });
  live = await ev(() => window.__TAO_RPG__.gatherSpots().map((s) => s.id));
  check('perDay 2 used up → node closed', !live.includes('gn_shellfish_im'), live);
  await ev(() => { const g = window.__TAO_RPG__; g.setTime('night'); g.setTime('dawn'); });
  live = await ev(() => window.__TAO_RPG__.gatherSpots().map((s) => s.id));
  check('new day → node open again', live.includes('gn_shellfish_im'), live);

  // QA M2: split / regroup places in the HUD read as zh names, never raw ids (A1 went to dasenshan)
  const atIds = await ev(() => window.__TAO_RPG__.content().splitPlaces);
  const rawIds = await ev((ids) => ids.filter((i) => { const z = window.__TAO_RPG__.placeZh(i); return !z || z === i; }), atIds);
  check('split / regroup places have zh names in the HUD', atIds.length > 0 && rawIds.length === 0, { n: atIds.length, rawIds });
  // requires unmet: the 漁人 sweet-potato field shows a hint instead of gathering (no 採 marker)
  await ev(() => { const g = window.__TAO_RPG__; g.setTime('day'); g.startQuest('FD6', 1); });
  const wk = await ev(() => window.__TAO_RPG__.gatherSpots().find((s) => s.id === 'gn_wakay_iratay'));
  check('sweet-potato field before permission: hint, not gather', wk && typeof wk.blocked === 'string' && wk.blocked.length > 0, wk && { blocked: wk.blocked });
  const wk0 = await ev(() => window.__TAO_RPG__.items().wakay ?? 0);
  await ev(() => { window.__TAO_RPG__.gather('gn_wakay_iratay'); window.__TAO_RPG__.closeAll(); });
  check('blocked node gives nothing', (await ev(() => window.__TAO_RPG__.items().wakay ?? 0)) === wk0);
  await ev(() => window.__TAO_RPG__.setTime('dawn'));

  // keeper chat while ingredients are missing
  const chat = await ev(() => window.__TAO_RPG__.chat('elder_f_iranmeylek'));
  check('keeper chat lists the missing ingredients', chat.some((l) => /貝類/.test(l.zh)), chat);

  // observe: owl at night → 圖鑑
  await ev(() => window.__TAO_RPG__.setTime('night'));
  live = await ev(() => window.__TAO_RPG__.gatherSpots().map((s) => s.id));
  check('night: owl + land crab observation open', live.includes('gn_owl_road') && live.includes('gn_landcrab_road'), live);
  await ev(() => { window.__TAO_RPG__.gather('gn_owl_road'); window.__TAO_RPG__.closeAll(); });
  const cx = await ev(() => window.__TAO_RPG__.codex().find((x) => x.id === 'scops_owl'));
  check('observed owl is in the 圖鑑, not in the bag', cx?.known && !cx.n, cx);

  // 背包／圖鑑 page
  await ev(() => { const g = window.__TAO_RPG__; g.setTime('day'); g.giveItem('alibangbang', 2); g.giveItem('headlamp', 1); g.closeAll(); g.openJournal(); });
  await sleep(300);
  await page.click('#journal-tabs [data-tab="bag"]');
  await sleep(600);
  const bag = await ev(() => document.getElementById('nb-list')?.textContent ?? '');
  check('背包 page lists bag + 圖鑑 entries', bag.includes('飛魚') && bag.includes('頭燈') && bag.includes('？？？'), bag.slice(0, 200));
  await page.screenshot({ path: path.join(OUT, 'bag-codex.png') });

  // outfits: unlocking + wearing swaps the portrait and the walk sheet (variant sheets drawn 2026-11-14; missing art falls back to the base)
  await ev(() => window.__TAO_RPG__.closeAll());
  const before = await ev(() => window.__TAO_RPG__.outfitLook('m'));
  const wore = await ev(async () => { const g = window.__TAO_RPG__; g.unlockOutfit('outfit_m_tao'); return g.wearOutfit('m', 'outfit_m_tao'); });
  const after = await ev(() => window.__TAO_RPG__.outfitLook('m'));
  check('族男 wears the traditional outfit: portrait local_trad, walk sheet player_trad', wore && after.portrait === 'local_trad' && after.sheet === 'player_trad' && after.shown === 'player_trad' && before.sheet === 'player', { before, after });
  const fTrad = await ev(async () => { const g = window.__TAO_RPG__; g.unlockOutfit('outfit_f_tao'); await g.wearOutfit('f', 'outfit_f_tao'); return g.outfitLook('f'); });
  check('族女 wears the traditional outfit: portrait local_f_trad, walk sheet player_f_trad', fTrad.portrait === 'local_f_trad' && fTrad.sheet === 'player_f_trad', fTrad);
  // the variants have no ride / tatala sheets yet: riding falls back to the base outfit's (no 404, no page error)
  const rode = await ev(async () => { const g = window.__TAO_RPG__; g.switchMember('m'); g.setScooter(true); await new Promise((r) => setTimeout(r, 400)); const m = g.playerPos().scooter; g.setScooter(false); return m; });
  check('riding in the traditional outfit uses the base ride sheet', rode === true && !errors.length, { rode, errors: errors.slice(0, 2) });
  const tBad = await ev(async () => { const g = window.__TAO_RPG__; return g.wearOutfit('t', 'outfit_m_tao'); });
  check('traveller cannot wear Tao traditional clothing', tBad === false, tBad);
  const tAcc = await ev(async () => { const g = window.__TAO_RPG__; g.unlockOutfit('acc_t_band'); await g.wearOutfit('t', 'acc_t_band'); return g.outfitLook('t'); });
  check('traveller accessory → visitor_m_acc portrait, walk sheet player_visitor_acc', tAcc.portrait === 'visitor_m_acc' && tAcc.sheet === 'player_visitor_acc', tAcc);
  // survives a reload
  await ev(() => window.__TAO_RPG__.saveNow());
  await boot();
  await ev(() => document.getElementById('btn-continue')?.click());
  await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 }).catch(() => {});
  await sleep(1500);
  const re = await ev(() => window.__TAO_RPG__.outfitLook('m'));
  check('worn outfit persists after reload (portrait + walk sheet)', re.worn === 'outfit_m_tao' && re.portrait === 'local_trad' && re.sheet === 'player_trad' && re.shown === 'player_trad', re);
} finally {
  await b.close();
  await srv.close();
}
console.log(`item art / outfit sheets not drawn yet (fallback shown): ${itemArt404.length}`);
const ok = !fails.length && !errors.length && !http4xx.length;
fs.writeFileSync(path.join(OUT, 'report-content.json'), JSON.stringify({ ok, fails, errors, http4xx, itemArt404 }, null, 1));
console.log(ok ? 'PASS' : `FAIL ${JSON.stringify({ fails, errors: errors.slice(0, 5), http4xx: http4xx.slice(0, 5) })}`);
process.exit(ok ? 0 : 1);
