// 0.1.5 split hometowns + new party screen.
// 1) Pure check (no browser): every quest resolved for all 36 (族男, 族女) village pairs (scripts/dev/tribe-split-audit.ts).
// 2) Browser (desktop): party screen defaults (隨機 for both, traveller portrait tap), 隨機 drawn per member,
//    differing tribes, Q03 two home check-ins then the 主人家 涼亭, save round trip, and old-save migration.
// node scripts/test-tribe-split.mjs   (OUT=… for the two in-game Q03 shots)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-charselect');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const errors = [];
const check = (name, ok, info) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`, info !== undefined ? JSON.stringify(info).slice(0, 320) : ''); if (!ok) fails.push(name); };

// ---- 1) pure resolution audit
{
  const out = path.join(os.tmpdir(), `tribe-split-audit-${process.pid}.mjs`);
  await build({ entryPoints: ['scripts/dev/tribe-split-audit.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: { '.json': 'json' } });
  const { runTribeSplitAudit } = await import(pathToFileURL(out).href);
  const r = runTribeSplitAudit();
  console.log(`audit: ${r.pairs} village pairs, ${r.checks} checks`);
  console.log('sample 族男 野銀 / 族女 椰油:', JSON.stringify(r.samples));
  for (const f of r.fails.slice(0, 30)) console.log('  audit FAIL', f);
  check(`every quest resolves for all ${r.pairs} village pairs (${r.checks} checks)`, r.fails.length === 0, r.fails.length);
  fs.rmSync(out, { force: true });
}

// ---- 2) browser
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8873) });
const b = await launchBrowser();
try {
  const page = await b.newPage();
  page.on('pageerror', (e) => errors.push(`${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const ev = (fn, a) => page.evaluate(fn, a);
  const boot = async () => {
    await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  };
  const drain = async () => { for (let i = 0; i < 80 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(25); } };
  await boot();
  await ev(() => window.__TAO_RPG__.clearSave());
  await boot();
  await page.waitForSelector('#sel-origin-m', { visible: true, timeout: 30000 });

  // party screen defaults
  const ui = await ev(() => {
    const opts = [...document.querySelectorAll('#sel-origin-m option')].map((o) => o.value);
    const src = (s) => document.querySelector(`${s} img`)?.getAttribute('src') ?? '';
    return {
      m: document.querySelector('#sel-origin-m').value, f: document.querySelector('#sel-origin-f').value, opts,
      go: document.querySelector('#origin-go').disabled,
      faces: [src('#cs-member-m'), src('#cs-member-f'), src('#cs-traveller')].map((x) => x.split('/').pop()),
      lede: document.querySelector('.cs-lede')?.textContent,
      oldGrid: !!document.querySelector('#origin-grid'),
    };
  });
  check('both tribe dropdowns default to 隨機', ui.m === 'random' && ui.f === 'random', ui);
  check('dropdown: 隨機 + six villages, no 外來訪客', ui.opts.join() === 'random,yayo,iraraley,iranmeylek,ivalino,imorod,iratay', ui.opts);
  check('start button ready without picking anything', ui.go === false);
  check('three portraits: 族男, 族女, traveller (male)', ui.faces.join() === 'local.webp,local_f.webp,visitor_m.webp', ui.faces);
  check('short line: the three travel together, each with a purpose', /三個人一起旅行/.test(ui.lede ?? ''), ui.lede);
  check('old tribe card grid is gone', !ui.oldGrid);
  await page.click('#cs-traveller');
  const tf = await ev(() => ({ face: document.querySelector('#cs-traveller img').getAttribute('src').split('/').pop(), f: document.querySelector('#btn-gender-f').getAttribute('aria-checked') }));
  check('tap the traveller portrait → female traveller', tf.face === 'visitor.webp' && tf.f === 'true', tf);
  await page.click('#btn-gender-m');
  const tm = await ev(() => document.querySelector('#cs-traveller img').getAttribute('src').split('/').pop());
  check('男生 button → male traveller again', tm === 'visitor_m.webp', tm);

  // 隨機 is drawn separately for each member: stub Math.random → first draw 椰油 (0), second 漁人 (0.99)
  // (the stub is put in only for the start-button press itself, so the game loop cannot use up the two values)
  await ev(() => {
    const r0 = Math.random;
    const arm = (e) => {
      if (!e.target.closest?.('#origin-go')) return;
      const seq = [0, 0.99];
      Math.random = () => (seq.length ? seq.shift() : r0());
      setTimeout(() => { Math.random = r0; }, 0);
    };
    for (const t of ['pointerdown', 'pointerup', 'click', 'keydown']) document.addEventListener(t, arm, true);
  });
  await page.click('#btn-gender-f');
  await page.click('#origin-go');
  await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
  let st = await ev(() => window.__TAO_RPG__.saveState());
  check('隨機 + 隨機 → each member drawn on their own (椰油 / 漁人)', st.originM === 'yayo' && st.originF === 'iratay' && st.origin === 'yayo' && st.gender === 'f', st);
  await drain();

  // differing tribes picked on the screen: 族男 椰油, 族女 野銀
  await ev(() => window.__TAO_RPG__.clearSave());
  await boot();
  await page.waitForSelector('#sel-origin-m', { visible: true, timeout: 30000 });
  await page.select('#sel-origin-m', 'yayo');
  await page.select('#sel-origin-f', 'ivalino');
  const note = await ev(() => document.querySelector('#cs-note').textContent);
  check('note says the two check in at home first, everyone stays at the 族男 home', /各自回家報到/.test(note) && /主人家/.test(note), note);
  await page.click('#origin-go');
  await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
  await drain();
  st = await ev(() => window.__TAO_RPG__.saveState());
  check('differing tribes saved: 族男 椰油, 族女 野銀, 主人家 椰油', st.originM === 'yayo' && st.originF === 'ivalino' && st.origin === 'yayo', st);

  // Q03: two home check-ins (any order), then the 主人家 涼亭
  let q = await ev(() => window.__TAO_RPG__.quest('Q03'));
  if (q?.status !== 'active') { await ev(() => window.__TAO_RPG__.startQuest('Q03')); q = await ev(() => window.__TAO_RPG__.quest('Q03')); }
  check('Q03 active at its first step', q?.status === 'active' && q.step === 0, q);
  // 族男 at his own home
  await ev(() => { const g = window.__TAO_RPG__; g.switchMember('m'); g.goto('elder_yayo'); });
  await sleep(400);
  await ev(() => window.__TAO_RPG__.talkTo('elder_yayo'));
  await sleep(300);
  const dm = await ev(() => window.__TAO_RPG__.dialogueQueue());
  await drain();
  let qs = await ev(() => window.__TAO_RPG__.questState());
  q = await ev(() => window.__TAO_RPG__.quest('Q03'));
  check('族男 checks in with his own family (椰油)', qs.tasksDone.includes('Q03:0:0') && q.step === 0, { tasks: qs.tasksDone, q, dm });
  // the 族男 cannot do the 族女's check-in
  await ev(() => { const g = window.__TAO_RPG__; g.goto('elder_ivalino'); });
  await sleep(300);
  await ev(() => window.__TAO_RPG__.talkTo('elder_ivalino'));
  await sleep(200);
  await drain();
  qs = await ev(() => window.__TAO_RPG__.questState());
  check('族男 talking to the 野銀 elder does not count for the 族女', !qs.tasksDone.includes('Q03:0:1'), qs.tasksDone);
  // 族女 at her own home (screenshot with her elder's welcome)
  await ev(() => { const g = window.__TAO_RPG__; g.switchMember('f'); g.goto('elder_ivalino'); });
  await sleep(1500);
  await ev(() => window.__TAO_RPG__.talkTo('elder_ivalino'));
  await sleep(300);
  await ev(() => window.__TAO_RPG__.advanceDialogue());
  await sleep(1400);
  await page.screenshot({ path: path.join(OUT, 'ingame-q03-1-zunv-home-ivalino.png') });
  const df = await ev(() => window.__TAO_RPG__.dialogueQueue());
  await drain();
  q = await ev(() => window.__TAO_RPG__.quest('Q03'));
  check('族女 checks in with her own family (野銀) → next: meet at the 主人家 涼亭', q.step === 1, { q, df });
  const tgt = await ev(() => ({ t: window.__TAO_RPG__.questTarget('Q03'), p: window.__TAO_RPG__.places.host_tagakal, y: window.__TAO_RPG__.places.yayo, zh: window.__TAO_RPG__.placeZh('host_tagakal') }));
  check('the meeting spot is the 涼亭 of the 椰油 主人家', tgt.t && Math.hypot(tgt.t.x - tgt.p.x, tgt.t.z - tgt.p.z) < 0.5 && Math.hypot(tgt.p.x - tgt.y.x, tgt.p.z - tgt.y.z) < 40, tgt);
  // both walk to the 涼亭 (switch back to the 族男 so both are there)
  await ev(() => { const g = window.__TAO_RPG__; g.switchMember('m'); g.goto('host_tagakal'); g.gatherParty?.(); g.resetView?.(); });
  await sleep(1500);
  await ev(() => window.__TAO_RPG__.useSpot());
  await sleep(300);
  // show the line that welcomes both (族男 grew up here; 族女's family are old friends)
  const seen = [];
  for (let i = 0; i < 8; i++) {
    const t = await ev(() => window.__TAO_RPG__.dialogueQueue()[0]?.zh ?? '');
    seen.push(t);
    if (t.includes('族男小時候')) break;
    // like a player: 繼續 (the first tap finishes the typing, the next one moves on)
    await page.click('#dlg-next').catch(() => {});
    await sleep(700);
  }
  await sleep(3000); // let the line finish typing
  await page.screenshot({ path: path.join(OUT, 'ingame-q03-2-tagakal-host.png') });
  const dt = await ev(() => window.__TAO_RPG__.dialogueQueue());
  await drain();
  q = await ev(() => window.__TAO_RPG__.quest('Q03'));
  const allLines = [...dm, ...df, ...dt].map((l) => l.zh).join('') + seen.join('');
  check('Q03 done at the 主人家 涼亭', q.status === 'done', q);
  check('no line says both grew up in the same house', !allLines.includes('你們小時候') && allLines.includes('族男小時候'), allLines.slice(0, 200));

  // save round trip keeps both villages (and the two-home Q03 shape)
  await ev(() => window.__TAO_RPG__.saveNow());
  await boot();
  const meta = await ev(() => document.querySelector('#continue-meta')?.textContent ?? '');
  check('continue line shows both homes (椰油／野銀)', meta.includes('椰油／野銀'), meta);
  await ev(() => window.__TAO_RPG__.continueSave());
  await sleep(500);
  st = await ev(() => window.__TAO_RPG__.saveState());
  check('save round trip keeps 族男 椰油 / 族女 野銀', st.originM === 'yayo' && st.originF === 'ivalino' && st.origin === 'yayo', st);

  // old save (before 0.1.5: only `origin`) → both members get that village
  await ev(() => {
    const g = window.__TAO_RPG__;
    const sv = g.readSave();
    delete sv.state.originM; delete sv.state.originF;
    sv.state.origin = 'imorod';
    sv.quests.done = sv.quests.done.filter((x) => x !== 'Q03');
    sv.quests.active.Q03 = 0;
    sv.quests.tasksDone = [];
    localStorage.setItem('tao-rpg:save:v1', JSON.stringify(sv));
    // load it right away (a page reload would autosave the running game over it first)
    g.continueSave();
  });
  await sleep(500);
  st = await ev(() => window.__TAO_RPG__.saveState());
  check('old save: both members get the old village (紅頭)', st.originM === 'imorod' && st.originF === 'imorod' && st.origin === 'imorod', st);
  const t3 = await ev(() => window.__TAO_RPG__.questTarget('Q03'));
  check('old save: Q03 stays a single check-in with the 紅頭 elder', t3?.kind === 'npc' && t3.id === 'elder_imorod', t3);
} finally {
  await b.close();
  srv.server.close();
}
const bad = errors.filter((e) => !/favicon/.test(e));
check('no console errors', bad.length === 0, bad.slice(0, 5));
console.log(fails.length ? `FAIL: ${fails.length}` : 'OK: tribe split + party screen');
process.exit(fails.length ? 1 : 0);
