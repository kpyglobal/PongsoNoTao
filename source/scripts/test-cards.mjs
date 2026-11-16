// 0.1.5 cards + notebook (phase 6): first-unlock postcard → flies into the 圖鑑手札 button, a queue of 2,
// recipe scroll (greyed ？？？ ingredient → the 族語老師 teaches the names), notebook item grid + grow / shrink,
// a new quest opens its own page (fast typing, tap skips, tap closes), gathering shows only a small +1 icon,
// scenic photo with the traveller (flash, printed photo, 📸 line) / without (leader's remark, nothing saved),
// revisit = camera icon, an older save keeps what it knew without cards. zh / en / zhen; desktop + iPhone.
// node scripts/test-cards.mjs   (DIST=dist, OUT=screenshots-cards)
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const OUT = path.resolve(process.env.OUT || 'screenshots-cards');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve(process.env.DIST || 'dist'), port: Number(process.env.PORT || 8877) });
const fails = [];
const errors = [];
const http4xx = [];
const check = (name, ok, info) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`, info !== undefined ? JSON.stringify(info).slice(0, 300) : ''); if (!ok) fails.push(name); };
const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const b = await launchBrowser();

async function session(name, { ui, viewport, full }) {
  if (ONLY && !ONLY.includes(name)) return;
  console.log(`--- ${name}`);
  const T = name;
  const page = await b.newPage();
  page.on('pageerror', (e) => errors.push(`${T}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${T}: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !/__[a-z_]+_sheet\.png$/.test(r.url())) http4xx.push(`${T}: ${r.status()} ${r.url()}`); });
  page.on('dialog', (d) => d.accept());
  await page.setViewport(viewport);
  const ev = (fn, a) => page.evaluate(fn, a);
  const shot = async (n, wait = 250) => { await sleep(wait); await page.screenshot({ path: path.join(OUT, `${T}-${n}.png`) }); };
  const url = debugUrl(srv.base, `cards=1&ui=${ui}`);
  const boot = async () => {
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  };
  const cards = () => ev(() => window.__TAO_RPG__.cards());
  const waitCard = async (ms = 15000) => { await page.waitForFunction(() => window.__TAO_RPG__.cards().open, { timeout: ms, polling: 100 }).catch(() => {}); await sleep(450); return cards(); };
  const waitClosed = async (ms = 8000) => { await page.waitForFunction(() => !window.__TAO_RPG__.cards().open, { timeout: ms, polling: 100 }).catch(() => {}); };
  /** close every card and dialogue (keeps a log of what showed) */
  const settle = async (max = 40) => {
    for (let i = 0; i < max; i++) {
      const s = await ev(() => ({ mode: window.__TAO_RPG__.mode(), c: window.__TAO_RPG__.cards() }));
      if (s.mode === 'dialogue') { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(60); continue; }
      if (s.c.open) { await ev(() => { window.__TAO_RPG__.finishTyping?.(); window.__TAO_RPG__.cardTap(); window.__TAO_RPG__.cardTap(); }); await waitClosed(); continue; }
      if (s.c.pending) { await sleep(400); continue; }
      if (s.mode !== 'explore') { await ev(() => window.__TAO_RPG__.closeAll()); continue; }
      return;
    }
  };
  try {
    await boot();
    await ev(() => window.__TAO_RPG__.clearSave());
    await boot();
    await page.waitForSelector('#sel-origin-m', { visible: true, timeout: 30000 });
    await page.select('#sel-origin-m', 'iratay'); await page.select('#sel-origin-f', 'iratay'); await page.click('#btn-gender-m'); await page.click('#origin-go');
    await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 90000, polling: 250 });
    await sleep(1500);
    // accepting the next quest in play (Q01 → Q02) opens that quest's own page
    for (let i = 0; i < 60; i++) {
      const s = await ev(() => ({ mode: window.__TAO_RPG__.mode(), c: window.__TAO_RPG__.cards() }));
      if (s.c.open || s.c.shown.some((k) => k.startsWith('q:'))) break;
      if (s.mode === 'dialogue') await ev(() => window.__TAO_RPG__.advanceDialogue());
      await sleep(300);
    }
    const pg = await waitCard();
    check(`${T}: a newly accepted quest opens its own notebook page`, pg.open && pg.kind === 'page' && /^q:Q0/.test(pg.key), pg);
    if (full) await shot('00-quest-page-accept', 300);
    await settle();

    // ---- first unlock of an item: postcard; gather shows only +1 icon
    await ev(() => { const g = window.__TAO_RPG__; g.setSeason('summer'); g.setTime('dawn'); g.startQuest('FD5', 1); g.goto('iranmeylek_beach'); });
    await settle();
    await ev(() => window.__TAO_RPG__.gather('gn_shellfish_im'));
    const loot = await ev(() => [...document.querySelectorAll('.loot-pop')].map((e) => ({ ico: !!e.querySelector('img.loot-ico'), t: e.textContent })));
    check(`${T}: gathering shows a small icon with +1 (no big popup)`, loot.some((l) => l.ico && l.t.trim() === '+1'), loot);
    let c = await waitCard();
    check(`${T}: first shellfish → postcard`, c.open && c.kind === 'postcard' && c.key === 'i:shellfish', c);
    const lay = await ev(() => {
      const pic = document.querySelector('#card-layer .tc-pic')?.getBoundingClientRect();
      const txt = document.querySelector('#card-layer .tc-text')?.getBoundingClientRect();
      const card = document.querySelector('#card-layer .tc-card')?.getBoundingClientRect();
      const tao = document.querySelector('#card-layer .tc-tao');
      return { picLeft: pic && txt ? pic.right <= txt.left + 1 : false, fits: card ? card.left >= 0 && card.right <= innerWidth && card.top >= 0 && card.bottom <= innerHeight : false, taoStyle: tao ? getComputedStyle(tao).fontStyle : 'none', name: document.querySelector('#card-layer .tc-name')?.textContent };
    });
    check(`${T}: postcard picture on the left, names on the right, fits the screen`, lay.picLeft && lay.fits, lay);
    await shot('01-postcard-item', 300);
    if (ui !== 'zh') {
      const txt = await ev(() => { const l = document.querySelector('#card-layer'); const cl = l.cloneNode(true); cl.querySelectorAll('[lang="tao"]').forEach((x) => x.remove()); return cl.textContent; });
      if (ui === 'en') check(`${T}: English postcard has no Chinese`, !CJK.test(txt), txt.slice(0, 200));
      if (ui === 'zhen') check(`${T}: 中文＋English postcard has the small English name`, await ev(() => !!document.querySelector('#card-layer .tc-en')), txt.slice(0, 120));
    }
    // tap → flies into the notebook button
    const btn = await ev(() => { const r = document.getElementById('btn-journal').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const r0 = await ev(() => { const r = document.querySelector('#card-layer .tc-card').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
    await ev(() => window.__TAO_RPG__.cardTap());
    // headless frames are slow: pause the flight at 400 ms and measure (then let it finish)
    const r1 = await ev(() => {
      const e = document.querySelector('#card-layer .tc-card');
      const a = e?.getAnimations().at(-1);
      if (!e || !a) return null;
      a.pause(); a.currentTime = 400;
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
    });
    if (full) await shot('02-postcard-flying', 0);
    await ev(() => document.querySelector('#card-layer .tc-card')?.getAnimations().at(-1)?.play());
    await waitClosed();
    const d0 = Math.hypot(r0.x - btn.x, r0.y - btn.y);
    const d1 = r1 ? Math.hypot(r1.x - btn.x, r1.y - btn.y) : 0;
    check(`${T}: tapped card shrinks and flies toward the 圖鑑手札 button`, !r1 || (d1 < d0 * 0.8 && r1.w < r0.w), { d0, d1, r0, r1 });
    check(`${T}: card closed after the flight`, !(await cards()).open && (await ev(() => document.getElementById('card-layer').hidden)));
    // second gather: +1 icon only, no card
    await ev(() => window.__TAO_RPG__.gather('gn_shellfish_im'));
    await sleep(1200);
    c = await cards();
    check(`${T}: gathering it again → no card (first-ever unlock only)`, !c.open && !c.pending, c);

    // ---- queue of 2
    await ev(() => { const g = window.__TAO_RPG__; g.giveItem('wakay', 1); g.giveItem('ovi', 1); });
    c = await waitCard();
    check(`${T}: two unlocks at once → one card shown, one waiting`, c.open && c.key === 'i:wakay' && c.pending === 1, c);
    await ev(() => window.__TAO_RPG__.cardTap());
    await waitClosed();
    c = await waitCard();
    check(`${T}: the waiting card shows next`, c.open && c.key === 'i:ovi' && c.pending === 0, c);
    await settle();

    // ---- recipe scroll: soli not found → greyed, Tao name + ？？？
    await ev(() => window.__TAO_RPG__.unlockRecipe('rc-taro-sweetpotato'));
    c = await waitCard();
    const rows = await ev(() => [...document.querySelectorAll('#card-layer .tc-ing')].map((li) => ({ id: li.dataset.item, unfound: li.classList.contains('unfound'), tao: li.querySelector('.tc-tao')?.textContent ?? '', name: li.querySelector('.tc-ing-name')?.textContent, n: li.querySelector('.tc-count')?.textContent })));
    const soli = rows.find((r) => r.id === 'soli');
    const wakay = rows.find((r) => r.id === 'wakay');
    check(`${T}: recipe card on the scroll; unfound ingredient greyed with Tao name + ？？？`, c.kind === 'recipe' && soli?.unfound && soli.tao === 'soli' && soli.name === '？？？' && soli.n === '0/1', rows);
    check(`${T}: found ingredient shows its name and 1/1`, wakay && !wakay.unfound && wakay.name !== '？？？' && wakay.n === '1/1', wakay);
    await shot('03-recipe-greyed', 400);
    await settle();
    // the 族語老師 teaches every ingredient's name at once
    await ev(() => window.__TAO_RPG__.talkTo('teacher_yayo'));
    await sleep(300);
    const said = await ev(() => document.querySelector('#dialogue')?.textContent ?? '');
    await settle();
    const taught = await ev(() => window.__TAO_RPG__.taught());
    check(`${T}: talking to the 族語老師 teaches the ingredient names`, taught.includes('soli') && taught.includes('alibangbang'), { taught, said: said.slice(0, 80) });

    // ---- notebook: grows from the button, item grid, cell → card view
    await ev(() => window.__TAO_RPG__.openJournal());
    const grow = await ev(() => {
      const j = document.getElementById('journal');
      const a = j.getAnimations()[0];
      if (!a) return { anims: 0, w: 0, dur: 0 };
      a.pause(); a.currentTime = 150;
      const w = j.getBoundingClientRect().width;
      const dur = a.effect.getTiming().duration;
      a.finish();
      return { anims: 1, w, dur };
    });
    await sleep(300);
    const wFull = await ev(() => document.getElementById('journal').getBoundingClientRect().width);
    check(`${T}: notebook grows out of the button (~1 s)`, grow.anims > 0 && grow.w < wFull * 0.9 && grow.dur >= 800 && grow.dur <= 1200, { grow, wFull });
    await page.click('#journal-tabs [data-tab="bag"]');
    await sleep(500);
    const grid = await ev(() => ({ cells: document.querySelectorAll('.ig-grid .ig-cell').length, counts: [...document.querySelectorAll('.ig-n')].map((x) => x.textContent), locked: document.querySelectorAll('.ig-cell.locked').length, tabs: [...document.querySelectorAll('.ig-tab')].map((x) => x.dataset.cat) }));
    check(`${T}: item grid with counts, locked cells and category tabs`, grid.cells >= 20 && grid.counts.length >= 3 && grid.locked > 0 && grid.tabs.includes('ingredient') && grid.tabs.includes('dish'), grid);
    await ev(() => document.querySelector('.ig-tab[data-cat="ingredient"]').click());
    await sleep(200);
    const ing = await ev(() => document.querySelectorAll('.ig-grid .ig-cell').length);
    check(`${T}: category tab filters the grid`, ing > 0 && ing < grid.cells, { ing, all: grid.cells });
    await ev(() => document.querySelector('.ig-cell[data-key="item:shellfish"]').click());
    await sleep(300);
    check(`${T}: tapping a cell shows its card view`, await ev(() => !!document.querySelector('.ig-detail .tc-postcard')));
    await shot('04-notebook-grid', 300);
    if (ui === 'en') {
      const t = await ev(() => { const cl = document.getElementById('journal').cloneNode(true); cl.querySelectorAll('[lang="tao"], [data-keep-lang]').forEach((x) => x.remove()); return cl.textContent; });
      check(`${T}: English item grid has no Chinese`, !CJK.test(t), (t.match(/[\u3400-\u9fff]+/g) ?? []).slice(0, 8));
    }
    await ev(() => document.querySelector('.ig-tab[data-cat="dish"]').click());
    await sleep(200);
    await ev(() => document.querySelector('.ig-cell[data-key="dish:rc-taro-sweetpotato"]')?.click());
    await sleep(300);
    const tr = await ev(() => { const li = document.querySelector('.ig-detail .tc-ing[data-item="soli"]'); return { name: li?.querySelector('.tc-ing-name')?.textContent, unfound: li?.classList.contains('unfound') }; });
    check(`${T}: after the teacher: soli shows its name, still greyed until found`, tr.name && tr.name !== '？？？' && tr.unfound, tr);
    await shot('05-recipe-taught', 300);
    await ev(() => window.__TAO_RPG__.closeJournal());
    await sleep(200);
    const closing = await ev(() => document.getElementById('journal-backdrop').classList.contains('closing'));
    await page.waitForFunction(() => !document.getElementById('journal-backdrop').classList.contains('closing'), { timeout: 20000, polling: 200 }).catch(() => {});
    const gone = await ev(() => !document.getElementById('journal-backdrop').classList.contains('closing') && !document.getElementById('journal-backdrop').classList.contains('open'));
    check(`${T}: notebook shrinks back into the button`, closing && gone, { closing, gone });

    // ---- quest page: fast typing, tap skips, tap closes
    await ev(() => { window.__taoTypeMs = 120; window.__TAO_RPG__.questPage('FD6'); });
    await page.waitForFunction(() => window.__TAO_RPG__.cards().open, { timeout: 15000, polling: 50 }).catch(() => {});
    c = await cards();
    const typing = await ev(() => { const p = document.querySelector('#card-layer .qp-obj'); const rest = p?.querySelector('span'); return { kind: window.__TAO_RPG__.cards().kind, rest: rest ? rest.textContent.length : 0, rows: document.querySelectorAll('#card-layer .qp-ings .tc-ing').length, zh: document.querySelectorAll('#card-layer .qp-p').length, en: document.querySelectorAll('#card-layer .qp-en').length }; });
    await shot('06-quest-page', 0);
    check(`${T}: quest page opens with recipe-style needed items`, c.kind === 'page' && typing.rows >= 2, typing);
    if (ui === 'zhen') check(`${T}: 中文＋English quest page: same number of Chinese and English paragraphs`, typing.zh > 0 && typing.zh === typing.en, typing);
    await ev(() => { window.__taoTypeMs = undefined; window.__TAO_RPG__.cardTap(); });
    await sleep(150);
    const skipped = await ev(() => ({ open: window.__TAO_RPG__.cards().open, rest: !!document.querySelector('#card-layer .qp-obj span') }));
    check(`${T}: first tap shows all the text, page stays open`, skipped.open && !skipped.rest, { typing, skipped });
    await shot('06b-quest-page-full', 200);
    if (ui === 'en') {
      const t = await ev(() => { const cl = document.getElementById('card-layer').cloneNode(true); cl.querySelectorAll('[lang="tao"]').forEach((x) => x.remove()); return cl.textContent; });
      check(`${T}: English quest page has no Chinese`, !CJK.test(t), (t.match(/[\u3400-\u9fff]+/g) ?? []).slice(0, 8));
    }
    await ev(() => window.__TAO_RPG__.cardTap());
    await waitClosed();
    check(`${T}: second tap closes the page`, !(await cards()).open);
    await settle();

    if (full) {
      // ---- scenic photo with the traveller
      await ev(() => { const g = window.__TAO_RPG__; g.startQuest('P23'); g.fitWhen('P23'); g.switchMember('m'); });
      const sp = await ev(() => window.__TAO_RPG__.questTarget('P23'));
      await ev(() => { const g = window.__TAO_RPG__; g.goto('iratay'); g.scenicCheck(); });
      await ev((p) => { const g = window.__TAO_RPG__; g.teleport(p.x + 1, p.z + 1); g.gatherParty(); g.scenicCheck(); }, sp);
      const flash = await ev(() => !!document.querySelector('.shutter-flash'));
      c = await waitCard(6000);
      const q23 = await ev(() => window.__TAO_RPG__.quest('P23').status);
      check(`${T}: first visit with the traveller → flash + printed photo, album +1, quest done`, flash && c.kind === 'photo' && q23 === 'done' && (await ev(() => window.__TAO_RPG__.album())).includes('ps_p23'), { flash, c, q23 });
      await shot('07-photo', 500);
      await page.waitForFunction(() => window.__TAO_RPG__.mode() === 'dialogue', { timeout: 8000, polling: 100 }).catch(() => {});
      const line = await ev(() => document.querySelector('#dialogue')?.textContent ?? '');
      check(`${T}: the printed photo flies off by itself, then the traveller says a 📸 line`, line.includes('📸'), line.slice(0, 100));
      await shot('08-photo-line', 300);
      await settle();
      // without the traveller: nothing saved, the leader remarks
      await ev(() => { const g = window.__TAO_RPG__; g.startQuest('P22'); g.fitWhen('P22'); g.forceSplit({ t: { at: 'harbor', task: '買東西' } }); });
      const sp2 = await ev(() => window.__TAO_RPG__.questTarget('P22'));
      await ev(() => { const g = window.__TAO_RPG__; g.goto('iratay'); g.scenicCheck(); });
      await ev((p) => { const g = window.__TAO_RPG__; g.teleport(p.x + 1, p.z + 1); g.scenicCheck(); }, sp2);
      await sleep(300);
      const rem = await ev(() => ({ mode: window.__TAO_RPG__.mode(), text: document.querySelector('#dialogue')?.textContent ?? '', album: window.__TAO_RPG__.album(), q: window.__TAO_RPG__.quest('P22').status, card: window.__TAO_RPG__.cards().open }));
      check(`${T}: without the traveller nothing is saved and the leader says the traveller would want a photo`, rem.mode === 'dialogue' && /旅人|traveller/i.test(rem.text) && !rem.album.includes('ps_p22') && rem.q === 'active' && !rem.card, rem);
      await shot('09-no-traveller', 300);
      await settle();
      await ev(() => window.__TAO_RPG__.forceRegroup());
      // revisit: only a small camera icon
      await ev(() => { const g = window.__TAO_RPG__; g.goto('iratay'); g.scenicCheck(); });
      await ev((p) => { const g = window.__TAO_RPG__; g.teleport(p.x + 1, p.z + 1); g.gatherParty(); g.scenicCheck(); }, sp);
      await sleep(200);
      const cam = await ev(() => ({ icon: [...document.querySelectorAll('.loot-pop img.loot-ico')].some((i) => i.src.startsWith('data:image/svg')), card: window.__TAO_RPG__.cards() }));
      check(`${T}: revisit → small camera icon only`, cam.icon && !cam.card.open && !cam.card.pending, cam);
      await shot('10-revisit-camera', 100);
      // album page: printed photo
      await ev(() => window.__TAO_RPG__.openJournal());
      await page.waitForFunction(() => !!document.querySelector('#journal-tabs [data-tab="album"]'), { timeout: 15000 }).catch(() => {});
      await sleep(600);
      // DOM click: on a loaded phone the zoom-in may still be running, so a pointer click can miss
      await ev(() => document.querySelector('#journal-tabs [data-tab="album"]')?.click());
      await page.waitForFunction(() => !!document.querySelector('.nb-item[data-key^="album:"]'), { timeout: 15000 }).catch(() => {});
      await sleep(300);
      await ev(() => { for (const b of document.querySelectorAll('.nb-item[data-key^="album:"]')) { b.click(); if (document.querySelector('.nb-detail .album-print')) break; } });
      await sleep(400);
      check(`${T}: album shows the printed photo`, await ev(() => document.querySelectorAll('.nb-detail .album-print').length === 1));
      await shot('11-album', 300);
      await ev(() => window.__TAO_RPG__.closeAll());
      // an older save (no cards / album fields): known things count as shown, album empty, nothing replays
      const r = await ev(() => {
        const g = window.__TAO_RPG__;
        g.saveNow();
        const sv = g.readSave();
        delete sv.state.cards; delete sv.state.album; delete sv.state.taught;
        return g.importSave(JSON.stringify(sv));
      });
      await sleep(1500);
      const old = await ev(() => ({ c: window.__TAO_RPG__.cards(), album: window.__TAO_RPG__.album() }));
      check(`${T}: older save: known items marked shown, album empty, no cards replayed`, r.ok && old.c.seen.includes('i:shellfish') && old.album.length === 0 && !old.c.open && !old.c.pending, { r, album: old.album, open: old.c.open, pending: old.c.pending });
      await ev(() => window.__TAO_RPG__.gather('gn_shellfish_im'));
      await sleep(900);
      check(`${T}: older save: gathering a known item → no card`, !(await cards()).open && !(await cards()).pending);
    }
  } finally {
    await page.close();
  }
}

try {
  await session('desktop-zh', { ui: 'zh', viewport: { width: 1280, height: 800, deviceScaleFactor: 1 }, full: true });
  await session('iphone-zh', { ui: 'zh', viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, full: true });
  await session('desktop-en', { ui: 'en', viewport: { width: 1280, height: 800, deviceScaleFactor: 1 }, full: false });
  await session('iphone-en', { ui: 'en', viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, full: false });
  await session('desktop-zhen', { ui: 'zhen', viewport: { width: 1280, height: 800, deviceScaleFactor: 1 }, full: false });
  await session('iphone-land-zh', { ui: 'zh', viewport: { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, full: false });
} finally {
  await b.close();
  await srv.close();
}
const ok = !fails.length && !errors.length && !http4xx.length;
fs.writeFileSync(path.join(OUT, 'report-cards.json'), JSON.stringify({ ok, fails, errors, http4xx }, null, 1));
console.log(ok ? 'PASS' : `FAIL ${JSON.stringify({ fails, errors: errors.slice(0, 5), http4xx: http4xx.slice(0, 5) })}`);
process.exit(ok ? 0 : 1);
