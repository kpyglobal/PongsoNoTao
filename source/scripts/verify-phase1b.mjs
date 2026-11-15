// Phase 1 batch 1b verify: dive spots (season gate, ❗, underwater moment, per-member variants), hidden U3,
// U2 with the dive coach, 族人分工 (R1–R3 → J1/J2, J3 + song card, A3), album, save export / import.
// Desktop + mobile; fails on any console error / 4xx. (Playwright is not installed; puppeteer-core harness.)
// OUT=screenshots-phase1b node scripts/verify-phase1b.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const OUT = path.resolve(process.env.OUT || 'screenshots-phase1b');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8834) });
const report = { errors: [], http4xx: [], checks: {}, fails: [] };
const check = (name, ok, info) => {
  report.checks[name] = { ok: !!ok, info };
  if (!ok) report.fails.push(name);
  console.log(ok ? 'ok  ' : 'FAIL', name, info !== undefined ? JSON.stringify(info).slice(0, 220) : '');
};
let browser = null;
try {
  browser = await launchBrowser();
  for (const vp of [
    { tag: 'desktop', v: { width: 1440, height: 900, deviceScaleFactor: 1 } },
    { tag: 'mobile', v: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
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
    const shot = async (name, wait = 1400) => { await sleep(wait); await page.screenshot({ path: path.join(OUT, `${T}-${name}.png`) }); console.log('captured', `${T}-${name}`); };
    const drain = async () => {
      for (let i = 0; i < 30; i++) {
        const m = await ev(() => window.__TAO_RPG__.mode());
        if (m !== 'dialogue') return;
        await ev(() => window.__TAO_RPG__.advanceDialogue());
        await sleep(60);
      }
    };
    const q = (id) => ev((i) => window.__TAO_RPG__.quest(i), id);
    const talk = async (npc, { keep = false } = {}) => {
      await ev((npc) => {
        const g = window.__TAO_RPG__;
        g.closeAll();
        const p = g.npcAt(npc);
        g.teleport(p.x + 1.1, p.z + 0.6);
        g.gatherParty();
        g.talkTo(npc);
      }, npc);
      if (!keep) await drain();
    };
    const goSpot = async (id, dx = 0, dz = 0) => {
      const t = await ev((i) => window.__TAO_RPG__.questTarget(i), id);
      await ev(({ t, dx, dz }) => { const g = window.__TAO_RPG__; g.closeAll(); g.teleport(t.x + dx, t.z + dz); g.gatherParty(); }, { t, dx, dz });
      return t;
    };
    // image popup (Larry's illustrations): returns the shown file names, all decoded
    const popupImgs = () => ev(() => [...document.querySelectorAll('#dive-scene .dive-img')].map((i) => ({ f: i.getAttribute('src').split('/').pop(), ok: i.complete && i.naturalWidth > 0 })));
    const diveKeep = async (expect) => {
      await page.waitForSelector('#dive-keep', { timeout: 8000 });
      await sleep(500);
      if (expect) {
        const imgs = await popupImgs();
        check(`${T}: dive popup shows ${expect.join(', ')}`, imgs.length === expect.length && imgs.every((x, i) => x.ok && x.f === `${expect[i]}.webp`), imgs);
      }
      await page.click('#dive-keep');
      await sleep(600);
      await drain();
    };

    // 0) new game (home ivalino), Q02 scooter + S3 lifejacket
    await ev(() => window.__TAO_RPG__.clearSave());
    await page.waitForSelector('#btn-origin-ivalino', { visible: true, timeout: 15000 });
    await page.click('#btn-origin-ivalino');
    await page.waitForSelector('#btn-gender-f', { visible: true, timeout: 15000 });
    await page.click('#btn-gender-f');
    await page.waitForSelector('#origin-go', { visible: true, timeout: 15000 });
    await page.click('#origin-go');
    await sleep(900);
    await drain();
    await talk('rental_owner');
    await ev(() => window.__TAO_RPG__.switchMember('t'));
    await talk('rental_owner');
    check(`${T}: U1 unlocked after Q02 + S3`, (await q('U1')).status === 'active', await q('U1'));
    check(`${T}: 163 quests (content/)`, (await ev(() => window.__TAO_RPG__.questCounts())).total === 163, await ev(() => window.__TAO_RPG__.questCounts()));

    // 1) flying-fish season: dive spot closed (❗ still shows the first visit)
    await ev(() => { const g = window.__TAO_RPG__; g.setSeason('rayon'); g.setTime('day'); });
    const u1 = await goSpot('U1', -4, 0.5);
    await ev(() => window.__TAO_RPG__.useSpot());
    await sleep(1200);
    check(`${T}: U1 closed in 飛魚季`, (await q('U1')).status === 'active' && !(await ev(() => window.__TAO_RPG__.diveOpen())), await q('U1'));
    // markers refresh on the 0.5 s (game time) quest tick; at headless frame rates that can take seconds (QA L5)
    await page.waitForFunction(() => window.__TAO_RPG__.markerCount() > 0, { timeout: 15000, polling: 250 }).catch(() => {});
    check(`${T}: ❗ marker at the dive spot`, (await ev(() => window.__TAO_RPG__.markerCount())) > 0);
    await shot('01-u1-first-visit-marker', 1200);

    // 2) 休漁期: 族女 snorkels (any member may) → underwater still (族女 variant) → collected
    await ev(() => { const g = window.__TAO_RPG__; g.setSeason('off'); g.setTime('day'); g.switchMember('f'); });
    await goSpot('U1', -4, 0.5);
    await ev(() => window.__TAO_RPG__.useSpot());
    await sleep(300);
    check(`${T}: underwater moment opens`, await ev(() => window.__TAO_RPG__.diveOpen()));
    await shot('02-u1-underwater-zunu', 1500);
    await diveKeep(['u1']);
    check(`${T}: U1 done by 族女, picture collected (one per spot)`, (await q('U1')).status === 'done' && (await ev(() => window.__TAO_RPG__.collect())).includes('uw:A'), await ev(() => window.__TAO_RPG__.collect()));

    // 3) the traveller was there (party follows) → hidden U3 unlocks; no re-dive any more (one picture per spot)
    await sleep(700);
    check(`${T}: hidden U3 unlocks after U1 with the traveller there`, (await q('U3')).status === 'active', await q('U3'));
    await ev((p) => { const g = window.__TAO_RPG__; g.closeAll(); g.teleport(p.x - 4, p.z + 0.5); g.gatherParty(); }, u1);
    await sleep(500);
    const prompt = await ev(() => document.getElementById('interact-prompt')?.textContent ?? '');
    check(`${T}: no re-dive prompt at a finished spot`, !/再浮潛|再潛/.test(prompt), prompt);
    await shot('03-u1-done-no-redive', 600);
    await ev(() => window.__TAO_RPG__.switchMember('f'));
    await goSpot('U3', -4, 0.5);
    await ev(() => window.__TAO_RPG__.useSpot());
    await sleep(300);
    check(`${T}: U3 traveller only`, !(await ev(() => window.__TAO_RPG__.diveOpen())) && (await q('U3')).status === 'active');
    await ev(() => window.__TAO_RPG__.switchMember('t'));
    await goSpot('U3', -4, 0.5);
    await ev(() => window.__TAO_RPG__.useSpot());
    await shot('04-u3-traveller-pov-set', 1500);
    await diveKeep(['u3_01', 'u3_02', 'u3_03']);
    check(`${T}: U3 done, 3 POV photos`, (await q('U3')).status === 'done' && (await ev(() => window.__TAO_RPG__.collect().filter((k) => k.startsWith('pov:')).length)) === 3);

    // 4) U2: meet the dive coach (Tao local) → shallow scuba at the 椰油港 platform edge
    check(`${T}: U2 locked before meeting the coach`, (await q('U2')).status === 'locked');
    await talk('dive_coach');
    check(`${T}: U2 step 1 done with the coach`, (await q('U2')).step === 1, await q('U2'));
    await ev(() => window.__TAO_RPG__.switchMember('m'));
    await goSpot('U2', 4, 0);
    await ev(() => window.__TAO_RPG__.useSpot());
    await shot('05-u2-dropoff-zunan', 1500);
    // QA M6: closeAll (also used by fast travel) closes the dive popup and still finishes the step; openModals lists it
    await page.waitForSelector('#dive-keep', { timeout: 8000 });
    await sleep(500);
    check(`${T}: openModals() lists the dive popup`, (await ev(() => window.__TAO_RPG__.openModals())).includes('dive'), await ev(() => window.__TAO_RPG__.openModals()));
    await ev(() => window.__TAO_RPG__.closeAll());
    await sleep(600);
    await drain();
    check(`${T}: closeAll() closes the dive popup`, !(await ev(() => window.__TAO_RPG__.diveOpen())) && !(await ev(() => !!document.getElementById('dive-scene'))));
    check(`${T}: U2 done, picture collected`, (await q('U2')).status === 'done' && (await ev(() => window.__TAO_RPG__.collect())).includes('uw:B'));

    // 5) 族人分工: J3 (族女, song card), R1–R3, A3 (族男), J1 / J2 with the weaver (族女, non-fishing season)
    await ev(() => window.__TAO_RPG__.completeQuest('Q03'));
    await sleep(600);
    // since the party split & recipes batch (2026-11-14) each 分工 job starts and ends at its 女／男耆老 (@giver:
    // the host village's a akes / elder); the real step runner walks the wrapped steps
    const runQ = (id) => ev((i) => window.__TAO_RPG__.runQuest(i, { fitWhen: true }), id);
    const j3 = await runQ('J3');
    await sleep(500);
    check(`${T}: J3 done, kois learned, song card shown`, j3.done && (await ev(() => !!document.getElementById('song-card'))), j3.trace.slice(-2));
    await ev(() => document.querySelector('#song-card .sb-info')?.click());
    await shot('06-song-card-source', 700);
    await ev(() => document.getElementById('song-card')?.remove());
    for (const id of ['R1', 'R2', 'R3']) await runQ(id);
    check(`${T}: R1 (族男) → R2 → R3 (族女)`, (await q('R3')).status === 'done', await ev(() => window.__TAO_RPG__.questIds().done));
    // J1 is a 族女 job: the traveller is turned away at the a akes
    await ev(() => window.__TAO_RPG__.setSeason('off'));
    const jt = await ev(() => window.__TAO_RPG__.questTarget('J1'));
    await ev(() => window.__TAO_RPG__.switchMember('t'));
    // (the same a akes also gives 族男 jobs, so ask the quest itself why the traveller can't take it)
    const jb = await q('J1');
    check(`${T}: J1 needs 族女`, /族女/.test(jb.block || ''), jb);
    await ev(() => window.__TAO_RPG__.switchMember('f'));
    const j1 = await runQ('J1');
    const j2 = await runQ('J2');
    check(`${T}: J1 + J2 done`, j1.done && j2.done && (await q('J2')).status === 'done', { j1: j1.trace.slice(-1), j2: j2.trace.slice(-1) });
    await ev(() => window.__TAO_RPG__.switchMember('m'));
    const a3 = await runQ('A3');
    check(`${T}: A3 done by 族男`, a3.done && (await q('A3')).status === 'done', a3.trace.slice(-1));

    // 6) quest log (相簿與水下 line, ground chip), album page
    await ev(() => window.__TAO_RPG__.openQuests());
    await sleep(400);
    // notebook: filters tucked behind 篩選, then open U1's detail page
    await ev(() => { if (!document.querySelector('.qf')) document.querySelector('.nb-filter-btn')?.click(); });
    await ev(() => document.querySelector('.qf[data-qf="done"]').click());
    await sleep(200);
    await ev(() => document.querySelector('.ql[data-ql="photo"]').click());
    await sleep(200);
    await ev(() => document.querySelector('.nb-item[data-qid="U1"]')?.click());
    await sleep(200);
    check(`${T}: dive chip on the U1 detail page`, await ev(() => !!document.querySelector('.nb-detail [data-qid="U1"] .qc-ground.g-dive')));
    await shot('08-quest-log-underwater', 600);
    await ev(() => document.querySelector('#journal-tabs [data-tab="album"]').click());
    await sleep(600);
    // notebook: each album section is one item; count the thumbnails over all of them
    const thumbs = await ev(async () => {
      let n = 0;
      for (const b of [...document.querySelectorAll('.nb-item[data-key^="album:"]')]) {
        b.click();
        n += document.querySelectorAll('.nb-detail .album-thumb').length;
      }
      document.querySelector('.nb-item[data-key="album:0"]')?.click();
      return n;
    });
    check(`${T}: album shows underwater variants`, thumbs >= 3, thumbs);
    await shot('09-album', 900);
    // tap a thumbnail → full image popup, tap to close
    await ev(() => document.querySelector('.nb-detail .album-open')?.click());
    await page.waitForSelector('#dive-scene .dive-img', { timeout: 8000 }).catch(() => {});
    const big = await popupImgs();
    check(`${T}: album thumbnail opens the full image`, big.length === 1 && big[0].ok && big[0].f === 'u1.webp', big);
    await shot('09b-album-full-image', 600);
    await ev(() => document.getElementById('dive-scene')?.click());
    await sleep(300);
    check(`${T}: full image closes on tap`, !(await ev(() => !!document.getElementById('dive-scene'))));

    // 7) save export / import
    await ev(() => document.querySelector('#journal-tabs [data-tab="save"]').click());
    await sleep(400);
    await ev(() => document.querySelector('.nb-item[data-key="save:0"]')?.click());
    await sleep(200);
    check(`${T}: save warning shown`, await ev(() => /清除瀏覽器資料/.test(document.querySelector('.save-warn')?.textContent ?? '')));
    await shot('10-save-export-import', 600);
    const code = await ev(() => document.getElementById('save-code-out').value);
    const doneBefore = (await ev(() => window.__TAO_RPG__.questIds().done)).length;
    const collBefore = (await ev(() => window.__TAO_RPG__.collect())).length;
    check(`${T}: save code`, code.startsWith('TAO1.') && code.length > 200, code.length);
    // wipe the browser save, start over, then import
    await ev(() => window.__TAO_RPG__.clearSave());
    await boot();
    await page.waitForSelector('#btn-origin-yayo', { visible: true, timeout: 15000 });
    await page.click('#btn-origin-yayo');
    await page.waitForSelector('#btn-gender-m', { visible: true, timeout: 15000 });
    await page.click('#btn-gender-m');
    await page.click('#origin-go');
    await sleep(900);
    await drain();
    await page.click('#btn-journal');
    await sleep(300);
    await ev(() => document.querySelector('#journal-tabs [data-tab="save"]').click());
    await sleep(300);
    await ev(() => document.querySelector('.nb-item[data-key="save:1"]')?.click());
    await sleep(300);
    if (T === 'desktop') {
      await page.type('#save-code-in', code.slice(0, 40));
      await ev((c) => { document.getElementById('save-code-in').value = c; }, code);
      await page.click('#save-import');
    } else {
      const f = path.join(os.tmpdir(), `tao-save-${Date.now()}.json`);
      const json = Buffer.from(code.slice(5), 'base64').toString('utf8');
      fs.writeFileSync(f, json);
      const input = await page.$('#save-file');
      await input.uploadFile(f);
    }
    await sleep(1200);
    const after = await ev(() => ({ done: window.__TAO_RPG__.questIds().done.length, coll: window.__TAO_RPG__.collect().length, origin: window.__TAO_RPG__.saveState().origin }));
    check(`${T}: import (${T === 'desktop' ? 'save code' : 'file'}) restores progress`, after.done === doneBefore && after.coll === collBefore && after.origin === 'ivalino', { doneBefore, collBefore, after });
    await shot('11-after-import', 1200);
    await page.close();
  }
  report.ok = report.fails.length === 0 && report.errors.length === 0 && report.http4xx.length === 0;
  fs.writeFileSync(path.join(OUT, 'report-phase1b.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, fails: report.fails, errors: report.errors, http4xx: report.http4xx }, null, 1));
  process.exitCode = report.ok ? 0 : 1; // 0.1.4: a FAIL line (or a console error / 4xx) fails the run
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
