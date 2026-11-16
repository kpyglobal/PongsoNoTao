// 0.1.4 sound check: no festival track yet (cultural scenes keep the location music), ukulele stings; silent before the first tap; the menu loop on the start screens, the title loop in the start zone (開元港 / 機場); quiet defaults (音樂 35%); the right loop per place / mountain /
// sea / night; the ♪ panel (two sliders + 開/關, saved, also by touch); dialogue typing blips (throttled, tap
// shows the rest); the photo shutter; every loop decodes at its loop length; no console errors.
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8841) });
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); };
const TRACKS = ['menu', 'title', 'harbour_day', 'night', 'sea', 'mountain', 'imorod', 'ivalino', 'iranmeylek']; // festival: 0.1.5
// every manifest track must exist, and its 'loop' must match the decoded file (seamless loop point)
const MAN = JSON.parse(fs.readFileSync('content/audio/bgm.json', 'utf8'));
let browser = null;
try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || /\[bgm\]/.test(m.text())) errs.push(m.text()); });
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  const ev = (fn, a) => page.evaluate(fn, a);
  await ev(() => { window.__TAO_RPG__.clearSave(); localStorage.removeItem('tao-rpg.bgm'); localStorage.removeItem('tao-rpg.audio'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  const st = () => ev(() => window.__bgm());
  let s = await st();
  ok(!s.unlocked && s.playing === null, 'silent before first interaction');
  ok(s.settings.music === 0.35 && s.settings.sfx === 0.5 && s.settings.musicOn && s.settings.sfxOn, `quiet defaults ${JSON.stringify(s.settings)}`);
  await page.click('#btn-gender-m'); // first tap: the menu loop starts on the start screens (0.1.4)
  await page.select('#sel-origin-m', 'yayo'); await page.select('#sel-origin-f', 'yayo');
  await page.waitForFunction(() => window.__bgm().playing, { timeout: 30000 }).catch(() => {});
  ok((await st()).playing === 'menu', `start screen → ${(await st()).playing} (want menu)`);
  await page.click('#btn-gender-f');
  await page.click('#origin-go');
  await sleep(2500);
  // dialogue typing: blips while typing, the first tap shows the rest (does not skip the line)
  const typing = await ev(async () => {
    const g = window.__TAO_RPG__;
    const wait = async (fn, ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 20)); } return false; };
    const out = { open: await wait(() => g.mode() === 'dialogue', 5000) };
    if (!out.open) return out;
    const el = document.getElementById('dlg-zh');
    const b0 = window.__sfx.blips;
    const t0 = performance.now();
    // re-show the current line (setLang re-opens it), so it types out again from the start
    g.setLang('both');
    out.partial = await wait(() => el.querySelector('span')?.style.color === 'transparent', 3000);
    await wait(() => window.__sfx.blips > b0, 4000);
    await new Promise((r) => setTimeout(r, 200));
    out.blips = window.__sfx.blips - b0;
    out.chars = Math.round((performance.now() - t0) / 32);
    const line = el.textContent;
    const who = document.getElementById('dlg-who').textContent;
    out.stillTyping = !!el.querySelector('span');
    document.getElementById('dlg-next').click();
    out.sameLine = el.textContent === line && document.getElementById('dlg-who').textContent === who && !el.querySelector('span');
    return out;
  });
  ok(typing.open, 'opening dialogue shown');
  if (typing.open) {
    ok(typing.partial || typing.sameLine === undefined, 'dialogue text types out');
    ok(typing.blips >= 1 && typing.blips <= Math.ceil(typing.chars / 2) + 1, `blips throttled (${typing.blips} for ~${typing.chars} chars)`);
    ok(!typing.stillTyping || typing.sameLine, `first tap shows the rest of the line ${JSON.stringify(typing)}`);
  }
  await ev(() => { const g = window.__TAO_RPG__; for (let i = 0; i < 40 && g.mode() === 'dialogue'; i++) g.advanceDialogue(); g.closeAll(); });
  s = await st();
  ok(s.unlocked, 'audio unlocked after tap');
  await page.waitForFunction(() => window.__bgm().playing === 'title', { timeout: 30000 }).catch(() => {});
  s = await st();
  ok(s.playing === 'title', `game started at 開元港: the menu crossfades into the title's loop (start-zone music) → ${s.playing}`);
  const go = async (label, fn, want, arg) => {
    await ev(fn, arg);
    await page.waitForFunction((w) => window.__bgm().playing === w, { timeout: 30000 }).catch(() => {});
    s = await st();
    ok(s.playing === want, `${label} → ${s.playing} (want ${want})`);
  };
  for (const id of ['imorod', 'ivalino', 'iranmeylek']) await go(id, (q) => window.__TAO_RPG__.goto(q), id, id);
  await go('back at 開元港 (start zone)', (q) => window.__TAO_RPG__.goto(q), 'title', 'harbor');
  await go('蘭嶼機場 (start zone)', (q) => window.__TAO_RPG__.goto(q), 'title', 'airport');
  await go('衛生所 (modern zone)', (q) => window.__TAO_RPG__.goto(q), 'title', 'clinic_nurse');
  await go('朗島 (no village theme) → island theme', (q) => window.__TAO_RPG__.goto(q), 'harbour_day', 'iraraley');
  // mountain: high ground (place ids 紅頭山一帶 / 山坡上的茅草地)
  for (const id of ['peak']) {
    await go(`mountain (${id})`, (q) => window.__TAO_RPG__.goto(q), 'mountain', id);
    console.log(`     ground height there: ${(await st()).h}`);
  }
  await go('canoe at sea', () => window.__TAO_RPG__.setCanoe(true), 'sea');
  await go('ashore', () => { window.__TAO_RPG__.setCanoe(false); window.__TAO_RPG__.goto('iranmeylek'); }, 'iranmeylek');
  await go('night', () => window.__TAO_RPG__.setTime('night'), 'night');
  if (s.playing !== 'night') console.log('     clock:', JSON.stringify(await ev(() => window.__TAO_RPG__.clock())), 'mode:', await ev(() => window.__TAO_RPG__.mode()));
  await go('day again (東清)', () => window.__TAO_RPG__.setTime('day'), 'iranmeylek');
  // festival / culture rule + title intro
  // 0.1.4 ships without the festival loop (Larry): cultural scenes fall back to the normal location music
  ok(MAN.culture?.enabled === false && !MAN.tracks.festival, 'festival track disabled in the manifest (0.1.5)');
  ok(await ev(() => window.__bgmPick({ x: 0, z: 0, night: true, sea: true, culture: true }) === 'sea'), 'cultural scene at sea → sea (no festival in 0.1.4)');
  ok(await ev(() => window.__bgmPick({ x: 0, z: 0, night: true, sea: false, culture: true }) === 'night'), 'cultural scene at night → night');
  // checked on disk + from Node (a browser fetch of a missing file would log a console 404)
  ok(!fs.existsSync(path.resolve('dist/assets/audio/bgm/festival.mp3')) && !fs.existsSync(path.resolve('public/assets/audio/bgm/festival.mp3')), 'festival.mp3 not shipped');
  ok(await ev(() => window.__bgmPick({ x: 0, z: 0, night: false, sea: false, menu: true, culture: true }) === 'menu'), 'start screens → menu loop');
  ok(await ev(() => window.__bgmPick({ x: 0, z: 0, night: false, sea: false, title: true, culture: true }) === 'title'), 'arrival cut-scene → title (from its intro)');
  ok(MAN.startZone?.track === 'title' && (MAN.tracks.menu?.bpm === MAN.tracks.title?.bpm), `start zone plays the title loop; menu and title share a tempo for the segue ${JSON.stringify(MAN.startZone)}`);
  {
    const fz = MAN.startZone?.facilities ?? [];
    ok(['harbor', 'runway', 'terminal', 'clinic', 'scooterShop', 'hotel'].every((k) => fz.includes(k)), `modern zones (harbour, airport, clinic, scooter shop, hotel) → title loop ${JSON.stringify(fz)}`);
  }
  ok((MAN.tracks.title.loopStart ?? 0) > 5, `title has a one-time intro (${MAN.tracks.title.loopStart} s) before its loop`);
  // ukulele stings: item / milestone / quest, merged when they fire together
  const st0 = await ev(() => ({ ...window.__sfx.stings }));
  await ev(() => window.__sfxSting('item'));
  await sleep(600);
  await ev(() => { window.__sfxSting('item'); window.__sfxSting('quest'); window.__sfxSting('milestone'); });
  await sleep(600);
  await ev(() => window.__sfxSting('milestone'));
  await sleep(600);
  const st1 = await ev(() => window.__sfx.stings);
  const stg = Object.fromEntries(['item', 'quest', 'milestone'].map((k) => [k, (st1[k] ?? 0) - (st0[k] ?? 0)]));
  ok(stg.item === 1 && stg.quest === 1 && stg.milestone === 1, `stings play, simultaneous ones merge to the top one ${JSON.stringify(stg)}`);
  const sk = await ev(async () => { const o = {}; for (const id of ['item', 'milestone', 'quest']) { const r = await fetch(`assets/audio/sfx/${id}.mp3`); const ab = await r.arrayBuffer(); const b = await new AudioContext().decodeAudioData(ab); o[id] = b.duration; } return o; });
  ok(sk.item <= 0.65 && sk.milestone <= 1.05 && sk.quest <= 1.25, `stings: item ≤ 0.6 s, milestone ≤ 1.0 s, quest ≤ 1.2 s ${JSON.stringify(sk)}`);
  // menu UI sounds: named API, quiet short real-instrument files, cursor ticks throttled
  const mu = await ev(async () => {
    const o = {};
    for (const id of ['menu_move', 'menu_confirm', 'menu_cancel', 'menu_open', 'menu_toggle']) {
      const b = await new AudioContext().decodeAudioData(await (await fetch(`assets/audio/sfx/${id}.mp3`)).arrayBuffer());
      const d = b.getChannelData(0); let e = 0; for (const v of d) e += v * v;
      o[id] = { dur: Math.round(b.duration * 1000), rms: Math.round(10 * Math.log10(e / d.length + 1e-12)) };
    }
    return o;
  });
  ok(mu.menu_move.dur >= 40 && mu.menu_move.dur <= 80 && mu.menu_confirm.dur >= 150 && mu.menu_confirm.dur <= 250 && mu.menu_cancel.dur >= 120 && mu.menu_cancel.dur <= 200 && mu.menu_open.dur <= 250 && mu.menu_toggle.dur <= 150, `menu sounds: lengths ${JSON.stringify(Object.fromEntries(Object.entries(mu).map(([k, v]) => [k, v.dur])))} ms`);
  ok(Object.values(mu).every((v) => v.rms <= -23), `menu sounds quieter than the stings (RMS dB ${JSON.stringify(Object.fromEntries(Object.entries(mu).map(([k, v]) => [k, v.rms])))})`);
  const m0 = await ev(() => ({ ...window.__sfx.menu }));
  await ev(() => { window.__sfxPlay('menu_confirm'); window.__sfxPlay('menu_move'); window.__sfxPlay('menu_move'); window.__sfxPlay('menu_move'); });
  await sleep(400);
  await ev(() => { window.__sfxPlay('menu_cancel'); window.__sfxPlay('menu_open'); window.__sfxPlay('menu_toggle'); });
  await sleep(400);
  const m1 = await ev(() => window.__sfx.menu);
  const md = Object.fromEntries(['menu_move', 'menu_confirm', 'menu_cancel', 'menu_open', 'menu_toggle'].map((k) => [k, (m1[k] ?? 0) - (m0[k] ?? 0)]));
  ok(md.menu_move === 1 && md.menu_confirm === 1 && md.menu_cancel === 1 && md.menu_open === 1 && md.menu_toggle === 1, `sfx.play(menu_*) plays; rapid cursor ticks throttled ${JSON.stringify(md)}`);
  // photo shutter
  const sh0 = await ev(() => window.__sfx.shutters);
  await ev(() => window.__sfxShutter());
  ok((await ev(() => window.__sfx.shutters)) === sh0 + 1, 'photo shutter plays');
  // all loops decode at their loop length and stay small
  const durs = await ev(async (ids) => {
    const ctx = new AudioContext({ sampleRate: 32000 });
    const out = {};
    for (const id of ids) {
      const ab = await (await fetch(`assets/audio/bgm/${id}.mp3`)).arrayBuffer();
      const kb = Math.round(ab.byteLength / 1024);
      const b = await ctx.decodeAudioData(ab);
      out[id] = { dur: b.duration, kb };
    }
    return out;
  }, TRACKS);
  ok(Object.keys(MAN.tracks).sort().join() === [...TRACKS].sort().join(), `manifest tracks = ${Object.keys(MAN.tracks).join(', ')}`);
  for (const [id, d] of Object.entries(durs)) ok(MAN.tracks[id].loop >= (id === 'menu' ? 15 : 29.9) && d.kb < 500 && Math.abs((MAN.tracks[id].loopEnd ?? 0) - (MAN.tracks[id].loopStart ?? 0) - MAN.tracks[id].loop) < 0.001 && Math.abs(d.dur - (MAN.tracks[id].loopStart ?? 0) - MAN.tracks[id].loop) < 0.05, `${id}: ${d.dur.toFixed(2)} s (intro ${MAN.tracks[id].loopStart ?? 0} + loop ${MAN.tracks[id].loop}), ${d.kb} KB`);
  // settings panel: opens from ♪, two sliders + 開/關, saved
  await page.click('#btn-bgm');
  ok(await ev(() => !document.getElementById('audio-panel').hidden), '♪ opens 聲音設定');
  ok(await ev(() => document.getElementById('ap-music').value === '35' && document.getElementById('ap-sfx').value === '50'), 'sliders show 35 / 50');
  await ev(() => { const r = document.getElementById('ap-music'); r.value = '60'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  ok((await st()).settings.music === 0.6, 'music slider → 60%');
  await page.click('.ap-tg[data-ch=music]');
  await sleep(700);
  s = await st();
  ok(!s.settings.musicOn && s.playing === null, '音樂 關 stops music');
  await page.click('.ap-tg[data-ch=sfx]');
  s = await st();
  ok(!s.settings.sfxOn && s.settings.musicOn === false, '音效 關 (separate)');
  const mOff0 = await ev(() => window.__sfx.menu.menu_confirm ?? 0);
  await ev(() => window.__sfxPlay('menu_confirm'));
  await sleep(300);
  ok((await ev(() => window.__sfx.menu.menu_confirm ?? 0)) === mOff0, 'menu sounds respect 音效 關');
  ok(await ev(() => document.getElementById('btn-bgm').textContent === '♪̸'), 'both off → ♪̸');
  const saved = await ev(() => JSON.parse(localStorage.getItem('tao-rpg.audio')));
  ok(saved.music === 0.6 && saved.musicOn === false && saved.sfxOn === false, `saved ${JSON.stringify(saved)}`);
  const b0 = await ev(() => window.__sfx.blips);
  await ev(() => window.__TAO_RPG__.goto('iranmeylek'));
  await page.click('.ap-tg[data-ch=music]');
  await page.click('.ap-tg[data-ch=sfx]');
  await page.waitForFunction(() => window.__bgm().playing, { timeout: 10000 }).catch(() => {});
  ok((await st()).playing === 'iranmeylek', 'music 開 resumes');
  void b0;
  await page.mouse.click(40, 760);
  ok(await ev(() => document.getElementById('audio-panel').hidden), 'tap outside closes the panel');
  ok((await st()).decoded.length <= 3, `decoded cache ≤ 3 (${(await st()).decoded.length})`);
  // mobile: panel works by touch (close the desktop page first: two WebGL pages stall the box)
  try {
    await page.close();
    const m = await browser.newPage();
    m.on('pageerror', (e) => errs.push(`mobile ${e}`));
    await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await m.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
    await m.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
    // stays on the cover (starting the game on a second WebGL page times out on a busy box); the panel is the same
    await m.evaluate(() => document.getElementById('btn-bgm').click());
    const mob = await m.evaluate(() => { const p = document.getElementById('audio-panel'); const r = p.getBoundingClientRect(); return { open: !p.hidden, inView: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
    ok(mob.open && mob.inView, `mobile: panel opens, fits the screen ${JSON.stringify(mob)}`);
    await m.evaluate(() => document.querySelector('.ap-tg[data-ch=sfx]').click());
    ok(await m.evaluate(() => window.__bgm().settings.sfxOn === false), 'mobile: 音效 toggle');
    await m.screenshot({ path: 'screenshots-audio/panel-mobile.png' });
  } catch (e) {
    ok(false, `mobile check could not run (box busy?): ${String(e).slice(0, 120)}`);
  }
  ok(errs.length === 0, `no console errors ${errs.join(' | ')}`);
} finally {
  await browser?.close();
  await srv.close?.();
}
if (fails.length) { console.log(`test-bgm: ${fails.length} FAILED`); process.exit(1); }
console.log('test-bgm: OK');
