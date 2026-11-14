// Audit regression checks (M1 Q01 replay after reload, M2 malformed save, M3 bad step index, S1 backup, S4 whitelist).
// node scripts/test-audit.mjs  (puppeteer-core harness; local static server only for the test)
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: 8841 });
const fails = [];
const errors = [];
const check = (n, ok, info) => { if (!ok) fails.push(n); console.log(ok ? 'ok  ' : 'FAIL', n, info !== undefined ? JSON.stringify(info).slice(0, 200) : ''); };
const b = await launchBrowser();
try {
  const page = await b.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.setViewport({ width: 1280, height: 800 });
  const boot = async () => {
    await page.goto(debugUrl(srv.base), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  };
  const ev = (fn, a) => page.evaluate(fn, a);
  await boot();
  // M1: start, reload while the Q01 intro is open, continue → the intro replays and Q01 can finish
  await ev(() => { const g = window.__TAO_RPG__; g.clearSave(); g.selectOrigin('ivalino', 'f'); g.saveNow(); });
  check('M1 intro open after new game', (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue');
  await boot();
  await ev(() => window.__TAO_RPG__.continueSave());
  await sleep(1500);
  const m1 = await ev(() => ({ mode: window.__TAO_RPG__.mode(), q: window.__TAO_RPG__.quest('Q01') }));
  check('M1 Q01 intro replays after reload', m1.mode === 'dialogue' && m1.q.status === 'active', m1);
  for (let i = 0; i < 30 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(50); }
  await sleep(800);
  check('M1 Q01 completes after replay', (await ev(() => window.__TAO_RPG__.quest('Q01').status)) === 'done');
  // M2 / S1: malformed save → no Continue, no crash, raw copy kept as backup (fresh page first: a started game flushes its save on pagehide)
  await boot();
  await ev(() => localStorage.setItem('tao-rpg:save:v1', JSON.stringify({ v: 1, savedAt: 1, state: {}, party: { controlled: 'x' }, quests: { done: 3 } })));
  await boot();
  const m2 = await ev(() => ({ save: window.__TAO_RPG__.readSave(), backup: !!localStorage.getItem('tao-rpg:save:backup'), cont: !!document.querySelector('#btn-continue:not([hidden])') }));
  check('M2 malformed save ignored, backup kept', m2.save === null && m2.backup, m2);
  await ev(() => localStorage.setItem('tao-rpg:save:v1', JSON.stringify({ v: 2, savedAt: 1 })));
  await boot();
  check('S1 newer version not loaded', (await ev(() => window.__TAO_RPG__.readSave())) === null);
  // M3 / S4: bad indexes, respect and period in a structurally valid save
  await ev(() => { const g = window.__TAO_RPG__; g.clearSave(); g.selectOrigin('ivalino', 'f'); g.closeAll(); g.saveNow(); });
  const good = await ev(() => localStorage.getItem('tao-rpg:save:v1'));
  await boot();
  await ev((good) => {
    localStorage.setItem('tao-rpg:save:v1', good);
    const s = JSON.parse(localStorage.getItem('tao-rpg:save:v1'));
    s.quests.active = { Q01: 99, Q02: -1, Q03: 0.5, NOPE: 0 };
    s.quests.respect = 42;
    s.quests.tracked = 'Q99';
    s.state.period = 'noon';
    s.state.season = 'winter';
    s.state.travelerFrom = 'intl'; // 2026-11: 外國 traveller removed → same-gender traveller
    s.state.gender = 'f';
    s.quests.collect = ['uw:A:player_foreign_f', 'uw:B:player', 'pov:2', 'pov:5'];
    localStorage.setItem('tao-rpg:save:v1', JSON.stringify(s));
  }, good);
  await boot();
  await ev(() => window.__TAO_RPG__.continueSave());
  await sleep(1200);
  const m3 = await ev(() => { const g = window.__TAO_RPG__; return { q1: g.quest('Q01'), st: { p: g.state.period, s: g.state.season }, started: g.state.started, from: g.state.travelerFrom, saved: (g.saveNow(), JSON.parse(localStorage.getItem('tao-rpg:save:v1') || '{}').state?.travelerFrom), tOut: g.party().outfits.t, coll: g.collect() }; });
  check('M3 out-of-range step clamped, game resumes', m3.started && m3.q1.status === 'active', m3);
  check('old intl traveller save → female traveller, field dropped, one picture per spot', m3.from === undefined && m3.tOut === 'player_visitor_f' && m3.coll.includes('uw:A') && m3.coll.includes('uw:B') && !m3.coll.includes('pov:5') && !m3.coll.some((k) => /^uw:[AB]:/.test(k)), { from: m3.from, tOut: m3.tOut, coll: m3.coll });
  check('old intl field not written back on next save', m3.saved === undefined, { saved: m3.saved });
  check('S4 bad period / season fall back', m3.st.p === 'day' || ['dawn', 'day', 'dusk', 'night'].includes(m3.st.p), m3.st);
} finally {
  await b.close();
  await srv.close();
}
check('no console errors', errors.length === 0, errors);
process.exit(fails.length ? 1 : 0);
