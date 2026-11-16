// Party split & recipes batch check (desktop): 3-way split Q07 (switch → camera jump, regroup), member away J1
// (busy 族女 cannot be switched to, the others help), male-only sea trip M3 (solo, 放棄出海, success), 女／男耆老
// givers (R1–R3 wrap), six village recipes (gather / shop / mini-game / bring back), saves mid-split,
// NPC streaming (sprites + sheets released far away). Fails on console errors / 4xx.
// node scripts/test-split.mjs   (OUT=screenshots-split for the HUD shots)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-split');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8862) });
const errors = [], http4xx = [], fails = [];
const check = (name, ok, info) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`, info !== undefined ? JSON.stringify(info).slice(0, 300) : ''); if (!ok) fails.push(name); };
const b = await launchBrowser();
try {
  const page = await b.newPage();
  page.on('pageerror', (e) => errors.push(`${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) http4xx.push(`${r.status()} ${r.url()}`); });
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
  const shot = async (name, wait = 1200) => { await sleep(wait); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('captured', name); };
  await page.waitForSelector('#sel-origin-m', { visible: true, timeout: 30000 });
  await page.select('#sel-origin-m', 'ivalino'); await page.select('#sel-origin-f', 'ivalino'); await page.click('#btn-gender-m'); await page.click('#origin-go');
  await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
  for (let i = 0; i < 40 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(60); }
  await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); g.setTime('day'); });
  const G = (fn, a) => ev(fn, a);
  const q = (id) => G((i) => window.__TAO_RPG__.quest(i), id);
  const mem = () => G(() => window.__TAO_RPG__.members());
  const run = (id, o) => G(([i, o]) => window.__TAO_RPG__.runStep(i, o), [id, o || {}]);

  // ---- 0) streaming at boot: only the harbour's NPCs exist
  await page.waitForFunction(() => window.__TAO_RPG__.npcLoaded().loaded > 0, { timeout: 60000, polling: 500 }).catch(() => {});
  const s0 = await G(() => window.__TAO_RPG__.npcLoaded());
  check('streaming: only nearby NPC sprites at the harbour', s0.loaded > 0 && s0.loaded < s0.total, { loaded: s0.loaded, total: s0.total, sheets: s0.sheets });

  // ---- 1) opening via the real step runner: Q02 rental, Q03 host, Q04 tour
  for (const id of ['Q02', 'Q03', 'Q04']) {
    const r = await G((id) => window.__TAO_RPG__.runQuest(id), id);
    check(`${id} runs end to end with runQuest`, r.done, r.trace.slice(-1));
  }
  // ---- 2) Q07: 3-way split (0.1.4 content: the regroup point is the host family's 涼亭)
  const Q07_MEET = 'host_tagakal';
  let r = await run('Q07');
  let m = await mem();
  check('Q07 step 0 → split: all three away, regroup point ' + Q07_MEET, m.split && m.meet === Q07_MEET && ['m', 'f', 't'].every((k) => m[k].st === 'away' && m[k].ctrl), m);
  check('Q07 split: HUD banner shows the regroup point', /集合點/.test(m.banner || ''), m.banner);
  await shot('q07-split-hud');
  const before = await G(() => window.__TAO_RPG__.playerPos());
  const target = m.controlled === 'f' ? 't' : 'f';
  await G((r) => window.__TAO_RPG__.switchMember(r), target);
  const after = await G(() => window.__TAO_RPG__.playerPos());
  const at = await G((r) => { const g = window.__TAO_RPG__; const id = g.members()[r].at; return g.places[id]; }, target);
  check('switch to an away member: the camera / player jumps to their place', Math.hypot(after.x - at.x, after.z - at.z) < 6 && (Math.hypot(after.x - before.x, after.z - before.z) > 3 || Math.hypot(before.x - at.x, before.z - at.z) < 6), { before, after, at });
  const q07 = await q('Q07');
  check('Q07 is a tasks step (main story waits for all three)', q07.step === 1, q07);
  for (let i = 0; i < 3; i++) { r = await run('Q07'); check(`Q07 member part ${i + 1}`, r.ok, r); }
  m = await mem();
  check('after the parts: everyone waits at the regroup point', ['m', 'f', 't'].every((k) => m[k].st === 'wait' && m[k].at === Q07_MEET), m);
  await G(() => window.__TAO_RPG__.saveNow());
  await boot();
  await G(() => window.__TAO_RPG__.continueSave());
  await sleep(500);
  m = await mem();
  check('save mid-split restores member states + regroup point', m.meet === Q07_MEET && ['m', 'f', 't'].every((k) => m[k].st === 'wait'), m);
  r = await run('Q07'); check('Q07 regroup at ' + Q07_MEET, r.ok, r);
  m = await mem();
  check('regroup: everyone back in the party, banner gone', !m.split && ['m', 'f', 't'].every((k) => m[k].st === 'party') && !m.banner, m);
  r = await run('Q07'); check('Q07 rules talk → done', (await q('Q07')).status === 'done', r);

  // ---- 3) givers: R1 wraps a 領工作 / 回報 step at the 女耆老
  const R1 = await G(() => window.__TAO_RPG__.questTarget('R1'));
  check('R1 step 0 is the host village a akes (野銀 → 水芋田長輩, NPC cast rev)', R1 && R1.kind === 'npc' && R1.id === 'villager_taro', R1);
  for (const id of ['R1', 'R2', 'R3']) {
    const t = await G((id) => window.__TAO_RPG__.runQuest(id, { fitWhen: true }), id);
    check(`${id} (giver f) done with runQuest`, t.done, t.trace.slice(-1));
  }
  // ---- 4) J1: 族女 away (busy), the others help, she comes back
  await G(() => window.__TAO_RPG__.setWorld({ season: 'off', period: 'day' }));
  r = await run('J1');
  m = await mem();
  check('J1 step 0: 族女 away & busy, control moved off her', m.f.st === 'away' && !m.f.ctrl && m.controlled !== 'f', m);
  await G(() => window.__TAO_RPG__.switchMember('f'));
  m = await mem();
  check('cannot switch to the busy 族女, with a reason', m.controlled !== 'f' && /離隊中|不能操控/.test(m.f.block || ''), { block: m.f.block });
  r = await run('J1'); check('J1: water from the shop (族男／旅人)', r.ok, r);
  r = await run('J1'); check('J1: help at the porch → 族女 rejoins', r.ok && (await mem()).f.st === 'party', r);
  r = await run('J1'); check('J1 回報 女耆老 → done', (await q('J1')).status === 'done', r);

  // ---- 5) M1 / M2 / M3: male elder, season notice, solo sea trip
  for (const k of ['K1', 'K2', 'K3', 'K4']) await G((k) => window.__TAO_RPG__.completeQuest(k), k);
  const M1t = await G(() => window.__TAO_RPG__.questTarget('M1'));
  check('M1 giver is the host village elder (男耆老)', M1t && M1t.id === 'elder_ivalino', M1t);
  const m1 = await G(() => window.__TAO_RPG__.runQuest('M1'));
  check('M1 (男耆老) done', m1.done, m1.trace.slice(-1));
  await G(() => window.__TAO_RPG__.setWorld({ season: 'rayon', period: 'day' }));
  await run('M2');
  check('M2 finishes by itself when the fishing season starts', (await q('M2')).status === 'done', await q('M2'));
  // 0.1.4: M3 needs OF1 (the family gives the 族男 his traditional clothing first) and the clothing worn (requiresOutfit)
  const of1 = await G(() => window.__TAO_RPG__.runQuest('OF1'));
  check('OF1 (阿公的船組) done before the first sea trip', of1.done, of1.trace.slice(-1));
  await G(() => window.__TAO_RPG__.wearOutfit('m', 'outfit_m_tao'));
  r = await run('M3');
  m = await mem();
  check('M3 step 0 → solo 族男, the others wait at the harbour', m.solo === 'm' && m.controlled === 'm' && m.f.st === 'wait' && m.t.st === 'wait', m);
  await G(() => window.__TAO_RPG__.switchMember('f'));
  check('solo: cannot switch to 族女', (await mem()).controlled === 'm');
  const blockOther = await G(() => window.__TAO_RPG__.quest('X01'));
  check('solo: other quests show the sea-trip reason', blockOther && /出海/.test(blockOther.block || ''), blockOther);
  await shot('m3-solo-hud');
  await G(() => window.__TAO_RPG__.abortSolo());
  m = await mem();
  check('放棄出海: regroup + quest back to its first step', !m.split && (await q('M3')).step === 0, { m, q: await q('M3') });
  const m3 = await G(() => window.__TAO_RPG__.runQuest('M3'));
  check('M3 again: solo → fish (auto mini-game) → regroup → 回報 → done', m3.done, m3.trace);
  check('M3 gave a flying fish (ingredient)', (await G(() => window.__TAO_RPG__.items())).alibangbang >= 1);

  // ---- 6) recipes: six villages
  for (const k of ['K5', 'K6']) await G((k) => window.__TAO_RPG__.completeQuest(k), k);
  const fd = ['FD1', 'FD2', 'FD3', 'FD4', 'FD5', 'FD6'];
  const act = await G((ids) => ids.map((i) => window.__TAO_RPG__.quest(i)?.status), fd);
  check('six recipe quests unlocked after the K visits', act.every((s) => s === 'active'), act);
  for (const id of fd) { const t = await run(id, { fitWhen: true }); check(`${id} keeper talk`, t.ok, t); }
  // a quest step at the shop (e.g. S1, E1, E4) runs first; talking again buys what the recipes still need
  for (let k = 0; k < 8 && ((await G(() => window.__TAO_RPG__.items())).wakay ?? 0) < 1; k++) {
    await G(() => { const g = window.__TAO_RPG__; g.closeAll(); g.talkTo('shop_yayo'); });
    for (let i = 0; i < 10 && (await G(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) await G(() => window.__TAO_RPG__.advanceDialogue());
  }
  check('shop: 地瓜 bought for the recipes', (await G(() => window.__TAO_RPG__.items())).wakay >= 1, await G(() => window.__TAO_RPG__.items()));
  // 東清 (RECIPE_KEEPERS.md): 貝類 + 海菜 on the intertidal shore below the village
  // Phase B: shore nodes follow the tide (placeholder: low at dawn / dusk); nodes are listed by node id, matched here by item
  await G(() => window.__TAO_RPG__.setTime('dawn'));
  for (const id of ['shellfish', 'seaweed']) for (let i = 0; i < 2; i++) await G((id) => { const g = window.__TAO_RPG__; g.closeAll(); const it = g.gatherSpots().find((x) => x.item === id && x.node.time !== 'night'); if (it) { g.teleport(it.x, it.z); g.interactNearest(); } }, id);
  { const it = await G(() => window.__TAO_RPG__.items()); check('gather: 貝類 ×2 + 海菜 ×2 at the 東清 shore', it.shellfish >= 2 && it.seaweed >= 2, it); }
  for (let i = 0; i < 2; i++) await G(() => { const g = window.__TAO_RPG__; g.closeAll(); g.goto('peak'); g.interactNearest(); });
  check('gather: 山藥 at the peak', (await G(() => window.__TAO_RPG__.items())).ovi >= 2, await G(() => window.__TAO_RPG__.items()));
  // taro field mini-game (free play) gives 水芋
  const soli0 = (await G(() => window.__TAO_RPG__.items())).soli ?? 0;
  await G(() => {
    const g = window.__TAO_RPG__; g.closeAll(); g.autoMinigame(true);
    const it = g.interactables().find((i) => i.id === 'taro-taro_ivalino');
    // stand on the side of the field away from any other interactable that sits close by (e.g. the clinic)
    const other = g.interactables().filter((i) => i.id !== it.id).sort((a, b) => Math.hypot(a.x - it.x, a.z - it.z) - Math.hypot(b.x - it.x, b.z - it.z))[0];
    const d = other ? Math.hypot(other.x - it.x, other.z - it.z) : 99;
    if (other && d < 6) { const k = Math.min(it.r * 0.8, 3) / (d || 1); g.teleport(it.x - (other.x - it.x) * k, it.z - (other.z - it.z) * k); } else g.teleport(it.x, it.z);
    g.interactNearest();
  });
  await sleep(300);
  // 0.1.4: a quest step at the same field (e.g. E2 weeding) may answer first; interact again for the free-play mini-game
  for (let k = 0; k < 3 && ((await G(() => window.__TAO_RPG__.items())).soli ?? 0) <= soli0; k++) {
    await G(() => { const g = window.__TAO_RPG__; for (let i = 0; i < 10 && g.mode() === 'dialogue'; i++) g.advanceDialogue(); g.closeAll(); g.interactNearest(); });
    await sleep(300);
  }
  const soli1 = (await G(() => window.__TAO_RPG__.items())).soli ?? 0;
  check('taro field mini-game gives 水芋', soli1 > soli0, { soli0, soli1 });
  await G(() => { const g = window.__TAO_RPG__; g.autoMinigame(false); g.closeAll(); g.giveItem('soli', 4); g.giveItem('alibangbang', 5); });
  for (const id of fd) { const t = await G((id) => window.__TAO_RPG__.runQuest(id, { fitWhen: true }), id); check(`${id} learned`, t.done, t.trace.slice(-1)); }
  const rc = await G(() => window.__TAO_RPG__.recipes());
  check('six recipes in the notebook', rc.recipes.filter((x) => x.startsWith('rc-')).length === 6, rc);
  await G(() => { const g = window.__TAO_RPG__; g.openJournal(); document.querySelector('[data-tab="food"]')?.click(); });
  await shot('notebook-recipes');
  await G(() => window.__TAO_RPG__.closeAll());

  // ---- 7) streaming: far away the harbour NPCs are released
  // QA L9: streaming follows frame ticks; poll (≤12 s) until the village atlas is held / released instead of a fixed sleep
  const goAt = async (p, settled) => {
    await G((p) => { const g = window.__TAO_RPG__; g.closeAll(); g.forceRegroup(); g.goto(p); }, p);
    await sleep(1500);
    await page.waitForFunction(settled, { timeout: 12000, polling: 300 }).catch(() => {});
    return G(() => ({ ...window.__TAO_RPG__.npcLoaded(), pos: window.__TAO_RPG__.playerPos(), mode: window.__TAO_RPG__.mode() }));
  };
  const s1 = await goAt('ivalino', () => window.__TAO_RPG__.npcLoaded().groups.includes('ivalino'));
  const s2 = await goAt('harbor', () => { const g = window.__TAO_RPG__.npcLoaded().groups; return !g.includes('ivalino') && g.includes('harbor') && g.includes('yayo'); });
  console.log('stream groups', JSON.stringify({ iv: s1.groups, ivPos: s1.pos, hb: s2.groups, hbPos: s2.pos }));
  check('streaming: per-village atlases — ivalino atlas near 野銀, released at the harbour (yayo + harbor atlases there)',
    s1.groups.includes('ivalino') && !s2.groups.includes('ivalino') && s2.groups.includes('harbor') && s2.groups.includes('yayo') && s1.ids.join() !== s2.ids.join(),
    { ivalino: [s1.loaded, s1.groups, s1.pos], harbour: [s2.loaded, s2.groups, s2.pos, s2.mode], sheetsH: s2.sheets });
} finally {
  await b.close().catch(() => {});
  await srv.close();
}
check('no console errors', errors.length === 0, errors.slice(0, 5));
check('no 4xx', http4xx.length === 0, http4xx.slice(0, 5));
console.log(fails.length ? `\n${fails.length} FAIL(S): ${fails.join(' | ')}` : '\nALL OK');
process.exit(fails.length ? 1 : 0);
