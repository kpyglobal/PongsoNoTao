// Phase 1 batch 1 verify: party switch, quest engine (playable chain), Tao-hint translation, quest log,
// autosave + reload. Desktop + mobile, fails on any console error / 4xx.
// OUT=screenshots-phase1 node scripts/verify-phase1.mjs
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-phase1');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8830) });
const report = { errors: [], http4xx: [], checks: {}, fails: [] };
const check = (name, ok, info) => {
  report.checks[name] = { ok: !!ok, info };
  if (!ok) report.fails.push(name);
  console.log(ok ? 'ok  ' : 'FAIL', name, info !== undefined ? JSON.stringify(info).slice(0, 200) : '');
};
let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1440, height: 900, deviceScaleFactor: 1 } },
    { tag: 'mobile', v: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  ]) {
    const T = vp.tag;
    const page = await browser.newPage();
    page.on('pageerror', (e) => report.errors.push(`${T}: ${e}`));
    page.on('dialog', (d) => d.accept()); // S2 confirm before overwriting a save
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${T}: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400) report.http4xx.push(`${r.status()} ${r.url()}`); });
    await page.setViewport(vp.v);
    const boot = async () => {
      await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    };
    await boot();
    const ev = (fn, a) => page.evaluate(fn, a);
    const shot = async (name, wait = 1600) => { await sleep(wait); await page.screenshot({ path: path.join(OUT, `${T}-${name}.png`) }); console.log('captured', `${T}-${name}`); };
    const drain = async () => {
      for (let i = 0; i < 30; i++) {
        const m = await ev(() => window.__TAO_RPG__.mode());
        if (m !== 'dialogue') return;
        await ev(() => window.__TAO_RPG__.advanceDialogue());
        await sleep(60);
      }
    };
    const q = (id) => ev((i) => window.__TAO_RPG__.quest(i), id);
    const talk = async (npc, { gather = true, keep = false } = {}) => {
      await ev(({ npc, gather }) => {
        const g = window.__TAO_RPG__;
        g.closeAll();
        const p = g.npcAt(npc);
        g.teleport(p.x + 1.1, p.z + 0.6);
        if (gather) g.gatherParty();
        g.talkTo(npc);
      }, { npc, gather });
      if (!keep) await drain();
    };

    // 1) character select: home village + traveller
    await ev(() => window.__TAO_RPG__.clearSave());
    await boot(); // fresh cover without the 繼續 block (the desktop run left a save)
    await shot('01-character-select', 600);
    await page.waitForSelector('#sel-origin-m', { visible: true, timeout: 15000 });
    await page.select('#sel-origin-m', 'ivalino'); await page.select('#sel-origin-f', 'ivalino');
    await page.waitForSelector('#btn-gender-f', { visible: true, timeout: 15000 });
    await page.click('#btn-gender-f');
    await page.waitForSelector('#origin-go', { visible: true, timeout: 15000 });
    await page.click('#origin-go');
    await sleep(900);
    await shot('02-q01-arrival-statement', 900);
    const p0 = await ev(() => window.__TAO_RPG__.party());
    check(`${T}: party is 族男 + 族女 + chosen traveller, 族男 controlled`, p0.controlled === 'm' && p0.outfits.m === 'player' && p0.outfits.f === 'player_f' && p0.outfits.t === 'player_visitor_f', p0);
    await drain();
    check(`${T}: Q01 done → Q02/Q03/Q04 active`, (await q('Q01')).status === 'done' && (await q('Q02')).status === 'active' && (await q('Q04')).status === 'active');
    await ev(() => window.__TAO_RPG__.toggleScooter());
    check(`${T}: scooter locked before Q02`, (await ev(() => window.__TAO_RPG__.playerPos().mode)) === 'walk');
    await ev(() => window.__TAO_RPG__.setTime('day'));
    await shot('03-party-at-harbor', 1800);

    // 2) party switch (HUD button)
    await page.click('#party-bar .pm[data-role="f"]');
    await sleep(500);
    const p1 = await ev(() => window.__TAO_RPG__.party());
    check(`${T}: switch via party bar → 族女`, p1.controlled === 'f' && (await ev(() => window.__TAO_RPG__.outfit())) === 'player_f', p1.controlled);
    // walk a bit so the followers trail behind
    for (let i = 0; i < 14; i++) await ev(() => window.__TAO_RPG__.stepMove(0.6, -1, 0.12));
    await shot('04-party-switched-to-f', 1400);
    const p2 = await ev(() => window.__TAO_RPG__.party());
    const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    check(`${T}: followers stay close`, d(p2.pos.m, p2.pos.f) < 9 && d(p2.pos.t, p2.pos.f) < 9, p2.pos);

    // 3) Q02 rental → many unlocks
    await talk('rental_owner');
    check(`${T}: Q02 done, scooter unlocked`, (await q('Q02')).status === 'done' && (await ev(() => window.__TAO_RPG__.questState().flags)).includes('has_scooter'));
    await shot('05-quest-unlock-toast', 500);
    const ids = await ev(() => window.__TAO_RPG__.questIds());
    check(`${T}: Q02 unlocks K1–K6, X01, I1, S1–S3`, ['K1', 'K6', 'X01', 'I1', 'S1', 'S3'].every((i) => ids.active.includes(i)), ids.active);

    // 4) role gate: Q03 needs 族男/族女 — traveller is refused
    await ev(() => window.__TAO_RPG__.switchMember('t'));
    await talk('elder_ivalino'); // traveller can still do the side visit K6 here
    // Phase B: village side quests (e.g. IV-M1, summer) can run here for the traveller first; keep talking until the Q03 gate shows
    let blocked = '';
    for (let i = 0; i < 4; i++) {
      await talk('elder_ivalino', { keep: true });
      blocked = await ev(() => document.getElementById('dlg-zh').textContent);
      if (/族男或族女/.test(blocked)) break;
      await drain();
    }
    check(`${T}: traveller cannot do Q03 (role gate)`, /族男或族女/.test(blocked), blocked);
    await drain();
    await ev(() => window.__TAO_RPG__.switchMember('m'));
    await talk('elder_ivalino');
    // 0.1.4: Q03 has a second step: the elder takes everyone to the host family's 涼亭 (host_tagakal)
    check(`${T}: Q03 step 1 → host_tagakal`, (await q('Q03')).status === 'active' && (await q('Q03')).step === 1 && (await ev(() => { const g = window.__TAO_RPG__; const t = g.questTarget('Q03'); const h = g.places.host_tagakal; return !!(t && h && t.kind === 'spot' && Math.hypot(t.x - h.x, t.z - h.z) < 0.5); })), [await q('Q03'), await ev(() => window.__TAO_RPG__.questTarget('Q03'))]);
    await ev(() => { const g = window.__TAO_RPG__; const t = g.questTarget('Q03'); g.teleport(t.x, t.z); g.gatherParty(); g.useSpot(); });
    await drain();
    check(`${T}: Q03 done by 族男 (report home, then the 涼亭)`, (await q('Q03')).status === 'done', await q('Q03'));

    // 5) K visits; 紅頭 elder gives the Tao-only hint for Q05
    await talk('elder_imorod', { keep: true });
    for (let i = 0; i < 12; i++) {
      const tao = await ev(() => document.getElementById('dlg-tao').textContent);
      if (tao.includes('mangay')) break;
      await ev(() => window.__TAO_RPG__.advanceDialogue());
      await sleep(80);
    }
    await shot('06-tao-only-hint', 700);
    await drain();
    for (const n of ['villager_iratay', 'elder_yayo', 'elder_iraraley']) await talk(n);
    check(`${T}: Q05 auto-done after 任四個 K`, (await q('Q05')).status === 'done', await ev(() => window.__TAO_RPG__.questIds().done));

    // 6) 族語老師: X01, X02, then X03 translates the Tao hint
    await ev(() => window.__TAO_RPG__.setTime('day'));
    await talk('teacher_yayo');
    await talk('teacher_yayo');
    check(`${T}: X01 + X02 done (akokey learned)`, (await q('X02')).status === 'done' && (await ev(() => [...window.__TAO_RPG__.state.glossary])).includes('akokey'));
    check(`${T}: X03 unlocked by hint`, (await q('X03')).status === 'active');
    await talk('teacher_yayo', { keep: true });
    for (let i = 0; i < 8; i++) {
      const zh = await ev(() => document.getElementById('dlg-zh').textContent);
      if (zh.includes('的意思')) break;
      await ev(() => window.__TAO_RPG__.advanceDialogue());
      await sleep(80);
    }
    await shot('07-tao-hint-translated', 700);
    await drain();
    check(`${T}: X03 done, Q05 hint translated`, (await q('X03')).status === 'done' && (await ev(() => window.__TAO_RPG__.questState().translated)).includes('Q05'));

    // 7) Q04 needs traveller + one 族人 present
    await ev(() => window.__TAO_RPG__.switchMember('t'));
    await ev(() => window.__TAO_RPG__.teleport(window.__TAO_RPG__.places.iraraley.x, window.__TAO_RPG__.places.iraraley.z));
    await ev(() => window.__TAO_RPG__.gatherParty());
    await talk('elder_yayo', { gather: false, keep: true });
    const miss = await ev(() => document.getElementById('dlg-zh').textContent);
    check(`${T}: Q04 blocked while 族人 are away`, /還需要/.test(miss), miss);
    await drain();
    await talk('elder_yayo');
    check(`${T}: Q04 done (respect 初訪)`, (await q('Q04')).status === 'done' && (await ev(() => window.__TAO_RPG__.questState().respect)) === 0);
    // Q07 is a 3-way split since the party split & recipes batch (PARTY_SPLIT.md): split → three parts → regroup → rules
    const q07 = await ev(() => window.__TAO_RPG__.runQuest('Q07'));
    check(`${T}: Q07 done (3-way split + regroup at the host's 涼亭)`, q07.done && (await q('Q07')).status === 'done', q07.trace.slice(-1));

    if (T === 'desktop') {
      // 8) tide clock, intertidal (族女, low tide), photo (traveller only), item gate (headlamp)
      await talk('harbor_staff');
      // headless swiftshader renders ~0.5–2 fps here; the pill updates on the next quest tick
      await page.waitForFunction(() => !document.getElementById('tide-pill').hidden, { timeout: 15000, polling: 250 }).catch(() => {});
      check(`${T}: I1 done → tide pill`, (await q('I1')).status === 'done' && !(await ev(() => document.getElementById('tide-pill').hidden)), [await q('I1'), await ev(() => document.getElementById('tide-pill').textContent)]);
      await ev(() => window.__TAO_RPG__.setTime('dawn'));
      await ev(() => window.__TAO_RPG__.switchMember('f'));
      const sp = await ev(() => window.__TAO_RPG__.questTarget('I2'));
      await ev((p) => { const g = window.__TAO_RPG__; g.teleport(p.x, p.z); g.gatherParty(); g.useSpot(); }, sp);
      await drain();
      check(`${T}: I2 done at low tide by 族女`, (await q('I2')).status === 'done', [await q('I2'), sp]);
      await ev(() => window.__TAO_RPG__.setTime('day'));
      const ph = await ev(() => window.__TAO_RPG__.questTarget('P23'));
      await ev((p) => { const g = window.__TAO_RPG__; g.teleport(p.x + 2, p.z + 2); g.gatherParty(); g.useSpot(); }, ph);
      // 0.1.5: anyone can lead the photo as long as the traveller is in the party (the traveller holds the camera)
      await drain();
      const p23 = await ev(() => { const g = window.__TAO_RPG__; return { q: g.quest('P23'), ctl: g.questState?.().members ?? null, mode: g.mode(), dlg: document.querySelector('#dialogue')?.textContent?.slice(0, 120) ?? '', toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).slice(-2) }; });
      check(`${T}: P23 photo with 族女 leading and the traveller in the party`, p23.q.status === 'done', [p23, ph]);
      await ev(() => window.__TAO_RPG__.switchMember('t'));
      await ev(() => window.__TAO_RPG__.setTime('night'));
      await ev(() => window.__TAO_RPG__.switchMember('f'));
      const c1 = await ev(() => window.__TAO_RPG__.questTarget('C1'));
      await ev((p) => { const g = window.__TAO_RPG__; g.teleport(p.x, p.z); g.gatherParty(); g.useSpot(); }, c1);
      await drain();
      check(`${T}: C1 blocked without headlamp`, (await q('C1')).status === 'active');
      await ev(() => window.__TAO_RPG__.setTime('day'));
      await talk('shop_yayo');
      await ev(() => window.__TAO_RPG__.setTime('night'));
      await ev((p) => { const g = window.__TAO_RPG__; g.closeAll(); g.teleport(p.x, p.z); g.gatherParty(); g.useSpot(); }, c1);
      await drain();
      check(`${T}: C1 done with headlamp at night`, (await q('C1')).status === 'done');
      await ev(() => window.__TAO_RPG__.setTime('day'));
      await ev(() => window.__TAO_RPG__.switchMember('t'));
      await talk('villager_taro');
      check(`${T}: V1 done (respect 學習中)`, (await q('V1')).status === 'done' && (await ev(() => window.__TAO_RPG__.questState().respect)) === 1);
      // a debug-forced unlock chain: placeholder quests still unlock correctly
      await ev(() => window.__TAO_RPG__.completeQuest('R1'));
      check(`${T}: placeholder unlocks (R1 → R2)`, (await q('R2')).status === 'active');
    }

    // 9) quest log
    const counts = await ev(() => window.__TAO_RPG__.questCounts());
    check(`${T}: 163 quests (41/88/34: content/)`, counts.total === 163 && counts.main === 41 && counts.side === 88 && counts.photo === 34, counts);
    await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); g.fastTravel('yayo'); });
    await sleep(1500);
    await shot('08-hud-tracker', 600);
    await ev(() => window.__TAO_RPG__.openQuests());
    await shot('09-quest-log-active', 700);
    // notebook (2026-11): filters are tucked behind 篩選; the list is paged (title + status mark)
    const openFilters = () => ev(() => { if (!document.querySelector('.qf')) document.querySelector('.nb-filter-btn')?.click(); });
    await openFilters();
    await ev(() => document.querySelector('.qf[data-qf="done"]').click());
    await ev(() => document.querySelector('.nb-item')?.click());
    await shot('10-quest-log-done', 500);
    await ev(() => document.querySelector('.nb-back')?.click());
    await openFilters();
    await ev(() => document.querySelector('.qf[data-qf="locked"]').click());
    const lockedNames = await ev(() => [...document.querySelectorAll('.nb-item.st-locked .nb-t')].slice(0, 3).map((e) => e.textContent));
    check(`${T}: locked quests show ？？？`, lockedNames.length > 0 && lockedNames.every((n) => n === '？？？'), lockedNames);
    // walk every page of the full list: hidden quests never appear
    await ev(() => document.querySelector('.qf[data-qf="all"]').click());
    const allIds = await ev(async () => {
      const ids = new Set();
      for (let i = 0; i < 40; i++) {
        document.querySelectorAll('.nb-item[data-qid]').forEach((b) => ids.add(b.dataset.qid));
        const nx = document.querySelector('.nb-pg.next');
        if (!nx || nx.disabled) break;
        nx.click();
      }
      return [...ids];
    });
    check(`${T}: hidden quests not listed (all pages)`, allIds.length > 50 && !allIds.includes('H1'), allIds.length);
    await ev(() => document.querySelector('.qf[data-qf="locked"]').click());
    await shot('11-quest-log-locked', 500);
    await ev(() => document.querySelector('.qf[data-qf="all"]').click());
    await ev(() => window.__TAO_RPG__.closeAll());

    // 10) autosave + reload + continue
    const before = await ev(() => ({ q: window.__TAO_RPG__.questState(), p: window.__TAO_RPG__.party() }));
    await ev(() => window.__TAO_RPG__.saveNow());
    await boot();
    const hasCont = await ev(() => !document.getElementById('origin-continue').hidden);
    await shot('12-continue-after-reload', 600);
    await page.click('#btn-continue');
    await sleep(1200);
    const after = await ev(() => ({ q: window.__TAO_RPG__.questState(), p: window.__TAO_RPG__.party() }));
    check(`${T}: save survives reload (quests, items, party)`, hasCont && after.q.done.length === before.q.done.length && JSON.stringify(after.q.items) === JSON.stringify(before.q.items) && after.p.controlled === before.p.controlled, { before: before.q.done.length, after: after.q.done.length, ctl: after.p.controlled });
    await shot('13-resumed', 1600);
    await page.close();
  }
  report.ok = report.fails.length === 0 && report.errors.length === 0 && report.http4xx.length === 0;
  fs.writeFileSync(path.join(OUT, 'report-phase1.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, fails: report.fails, errors: report.errors, http4xx: report.http4xx }, null, 1));
  process.exitCode = report.ok ? 0 : 1; // 0.1.4: a FAIL line (or a console error / 4xx) fails the run
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
