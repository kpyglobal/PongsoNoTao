// NPC cast check: key NPC dialogue portraits + in-world shots of the ambient villagers in three villages.
// node scripts/capture-cast.mjs (local static server for the test only)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-cast');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8845) });
const errors = [], http4xx = [], fails = [], report = {};
const check = (name, ok, info) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`, info ? JSON.stringify(info) : ''); if (!ok) fails.push(name); };
// NPCs: every content/npcs/*.json (data-only cast; src/content/loader.ts merges them the same way)
const npcs = fs.readdirSync('content/npcs').filter((f) => f.endsWith('.json')).sort().flatMap((f) => JSON.parse(fs.readFileSync(path.join('content/npcs', f), 'utf8')).npcs ?? []);
const VILLAGES = ['yayo', 'ivalino', 'imorod'];
const b = await launchBrowser();
try {
  const page = await b.newPage();
  page.on('pageerror', (e) => errors.push(`${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) http4xx.push(`${r.status()} ${r.url()}`); });
  page.on('dialog', (d) => d.accept());
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const ev = (fn, a) => page.evaluate(fn, a);
  const boot = async () => {
    await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  };
  await boot();
  await ev(() => window.__TAO_RPG__.clearSave());
  await boot();
  const shot = async (name, wait = 1200) => { await sleep(wait); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('captured', name); };
  await page.waitForSelector('#sel-origin-m', { visible: true, timeout: 30000 });
  await page.select('#sel-origin-m', 'ivalino'); await page.select('#sel-origin-f', 'ivalino');
  await page.click('#btn-gender-m');
  await page.click('#origin-go');
  await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
  await page.waitForFunction(() => window.__TAO_RPG__.frame() > 3, { timeout: 120000, polling: 250 }).catch(() => {});
  for (let i = 0; i < 40 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(100); }
  await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); g.setTime('day'); document.getElementById('unlock-toast').style.visibility = 'hidden'; });
  // every NPC exists and stands somewhere
  const where = await ev((ids) => ids.map((id) => [id, window.__TAO_RPG__.npcAt(id)]), npcs.map((n) => n.id));
  check(`all ${npcs.length} NPCs spawned`, where.every(([, p]) => p && Number.isFinite(p.x)), where.filter(([, p]) => !p).map(([id]) => id));
  // talkable key NPCs open with their own portrait
  // (auto-fish / taro_intro start the fish / taro mini-games instead of a dialogue)
  for (const n of npcs.filter((n) => n.talkable !== false && n.portrait && !n.action)) {
    await ev(() => window.__TAO_RPG__.closeAll());
    await ev((id) => window.__TAO_RPG__.talkTo(id), n.id);
    await sleep(250);
    const src = await ev(() => document.querySelector('#dlg-portrait img')?.getAttribute('src') || '');
    check(`${n.id}: dialogue portrait ${n.portrait}`, src.endsWith(`portraits/${n.portrait}.webp`), src);
    if (n.id === 'elder_yayo' || n.id === 'weaver_elder') await shot(`dialogue-${n.id}`, 1500);
  }
  await ev(() => window.__TAO_RPG__.closeAll());
  for (const v of VILLAGES) {
    const amb = npcs.filter((n) => n.home === v && n.id.startsWith('villager_') && !['villager_taro', 'villager_harbor'].includes(n.id)).map((n) => n.id);
    // natural: let the villagers wander a few seconds, then look from the village centre
    const at = await ev((v) => {
      const g = window.__TAO_RPG__; g.closeAll();
      const p = g.places[v]; const q = g.roadPointNear(p.x, p.z, 14) || p;
      g.teleport(q.x, q.z); g.gatherParty();
      g.setCamera({ dist: 20, snap: true });
      return q;
    }, v);
    await sleep(4000);
    await shot(`village-${v}`, 800);
    // staged: the village's elder + its three ambient villagers + the player side by side
    await ev(({ q, ids }) => {
      const g = window.__TAO_RPG__;
      g.stageCast(q.x, q.z, 0, ids);
      g.setCamera({ dist: 9, yaw: 0, snap: true, x: q.x, z: q.z });
    }, { q: at, ids: [`elder_${v}`, ...amb.slice(0, 1), '@player', ...amb.slice(1)] });
    await shot(`village-${v}-lineup`, 1500);
    // release the staged NPCs (a schedule refresh sends everyone back to their routes)
    await ev(() => { const g = window.__TAO_RPG__; g.clearFocus(); g.setTime('dusk'); g.setTime('day'); });
    report[v] = { at, amb };
  }
  // key NPC lineup on the open apron of 開元港
  const q = await ev(() => { const g = window.__TAO_RPG__; const p = g.places.harbor; return g.roadPointNear(p.x, p.z, 20) || p; });
  await ev(({ q }) => {
    const g = window.__TAO_RPG__;
    g.stageCast(q.x, q.z, 0, ['villager_taro', 'weaver_elder', 'villager_harbor', 'teacher_yayo', 'shop_yayo', '@player', 'rental_owner', 'dive_coach', 'clinic_doctor', 'nutritionist', 'culture_worker', 'geologist']);
    g.setCamera({ dist: 13, yaw: 0, snap: true, x: q.x, z: q.z });
  }, { q });
  await shot('key-npcs-lineup', 1500);
  report.renderInfo = await ev(() => window.__TAO_RPG__.renderInfo());
} finally {
  await b.close();
  await srv.close?.();
}
check('0 console errors', errors.length === 0, errors.slice(0, 5));
check('0 4xx', http4xx.length === 0, http4xx.slice(0, 5));
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ fails, errors, http4xx, report }, null, 2));
console.log(fails.length ? `FAIL ${fails.length}` : 'OK');
process.exit(fails.length ? 1 : 0);
