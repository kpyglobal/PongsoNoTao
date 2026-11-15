// Quest runner (0.1.4 content): plays every playable quest through the test hooks, one after another in one save.
// For each quest: start it (prerequisites skipped), wear the outfit it requires, put the items its steps consume in
// the bag, then runQuest with fitWhen (season / time window). An auto step that only waits for a counter (族語 words,
// photos) is completed with completeStep and reported as "skip-auto". Fails when a quest cannot be finished.
// node scripts/test-quests.mjs   (DIST=dist  PORT=8873  QUESTS=P26,V4 to run only some)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve(process.env.DIST || 'dist'), port: Number(process.env.PORT || 8873) });
const only = process.env.QUESTS ? new Set(process.env.QUESTS.split(',')) : null;
const errors = [], fails = [], notes = [];
const b = await launchBrowser();
let exit = 0;
try {
  const page = await b.newPage();
  page.on('pageerror', (e) => errors.push(`${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
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
  await page.waitForSelector('#btn-origin-iratay', { visible: true, timeout: 30000 });
  await page.click('#btn-origin-iratay'); await page.click('#btn-gender-f'); await page.click('#origin-go');
  await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
  for (let i = 0; i < 60 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(30); }
  const defs = {};
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.json')) for (const q of JSON.parse(fs.readFileSync(p, 'utf8')).quests) defs[q.id] = q; } };
  walk(path.resolve('content/quests'));
  // play order: prerequisites first (depth in the req graph), like a player would meet them
  const reqIds = (r, out = []) => { if (!r) return out; if (typeof r === 'string') out.push(r); else for (const k of ['all', 'any']) (r[k] ?? []).forEach((x) => reqIds(x, out)); return out; };
  const depthMemo = {};
  const depth = (id, seen = new Set()) => { if (depthMemo[id] !== undefined) return depthMemo[id]; if (seen.has(id) || !defs[id]) return 0; seen.add(id); return (depthMemo[id] = 1 + Math.max(0, ...reqIds(defs[id].req).map((d) => depth(d, seen)))); };
  const meta = JSON.parse(fs.readFileSync(path.resolve('content/meta.json'), 'utf8'));
  const EXT = new Set(Object.keys(meta.externalFlags ?? {}));
  const ids = Object.keys(defs).sort((a, b) => depth(a) - depth(b)).filter((id) => defs[id]?.playable && (!only || only.has(id)));
  let ok = 0;
  for (const id of ids) {
    const q = defs[id];
    const items = {};
    for (const s of q.steps) {
      for (const g of [s.gives, ...(s.tasks ?? []).map((t) => t.gives)]) for (const [k, n] of Object.entries(g?.consume ?? {})) items[k] = (items[k] ?? 0) + n;
      const u = s.until; for (const r of [u, ...(u?.all ?? [])]) if (r?.item) items[r.item] = Math.max(items[r.item] ?? 0, r.min);
    }
    if (q.needsItem) items[q.needsItem.item] = Math.max(items[q.needsItem.item] ?? 0, 1);
    const pre = await ev(async ({ id, items, outfit }) => {
      const g = window.__TAO_RPG__;
      g.closeAll(); g.abortSolo?.(); g.forceRegroup();
      const st = g.quest(id);
      if (st.status === 'done') return { skip: 'already done' };
      for (const [k, n] of Object.entries(items)) { const have = g.items()[k] ?? 0; if (have < n) g.giveItem(k, n - have); }
      for (const [r, o] of Object.entries(outfit ?? {})) { g.unlockOutfit(o); await g.wearOutfit(r, o); }
      if (st.status !== 'active') g.startQuest(id);
      return {};
    }, { id, items, outfit: q.requiresOutfit });
    if (pre.skip) { notes.push(`${id}: ${pre.skip}`); ok++; continue; }
    let res, skipped = 0;
    for (let round = 0, guard = 0; round < 12 && guard < 80; round++, guard++) {
      // only the traveller takes photos (a photo step of an all-member quest has no actor list)
      res = await ev(({ id, kinds }) => { const g = window.__TAO_RPG__; const k = kinds[g.quest(id).step]; if (k === 'photo') g.switchMember('t'); return g.runQuest(id, { fitWhen: true, max: 1 }); }, { id, kinds: q.steps.map((x) => x.kind) });
      if (res.trace.length && res.trace[res.trace.length - 1].ok && !res.done) { round--; continue; }
      if (res.done) break;
      const step = await ev((id) => window.__TAO_RPG__.quest(id).step, id);
      const s = q.steps[step];
      // steps driven by other systems (dive popups, flags set by game code) have their own tests: complete them here
      const ext = s?.dive || (s?.until?.flag && EXT.has(s.until.flag)) || (step === 0 && reqIds(q.req).length === 0 && JSON.stringify(q.req).match(/"flag":"([a-z0-9_]+)"/g)?.some((m) => EXT.has(m.slice(8, -1))))
        || JSON.stringify(q.req).match(/"flag":"([a-z0-9_]+)"/g)?.some((m) => EXT.has(m.slice(8, -1)) && /提示|flag/.test(res.trace.at(-1)?.why ?? ''));
      if (ext || (s?.kind === 'auto' && s.until && !JSON.stringify(s.until).includes('"item"'))) { await ev((id) => window.__TAO_RPG__.completeStep(id), id); skipped++; continue; }
      break;
    }
    if (res.done) { ok++; console.log(`ok   ${id}${skipped ? ` (skip-auto x${skipped})` : ''}`); }
    else { const last = res.trace[res.trace.length - 1]; fails.push(id); console.log(`FAIL ${id} ${JSON.stringify(last).slice(0, 240)}`); }
  }
  console.log(`\n${ok}/${ids.length} quests finished${notes.length ? `; ${notes.join('; ')}` : ''}`);
  if (errors.length) console.log('page errors:', errors.slice(0, 10));
  exit = fails.length || errors.length ? 1 : 0;
  console.log(exit ? `FAILED: ${fails.join(' ')}` : 'ALL OK');
} finally {
  await b.close(); srv.close?.();
}
process.exit(exit);
