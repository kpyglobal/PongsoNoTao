// Mobile perf probe: GPU texture memory (WebGL calls counted in the page) + frame time at a phone viewport,
// in three scenes: the harbour (new game), riding between villages, standing in a village.
// node scripts/perf-mobile.mjs [label]   → prints a table and writes perf-<label>.json
// Caveat: headless Chrome renders with SwiftShader (CPU), so absolute frame times are far slower than a
// phone GPU; compare before / after runs on the same box. Texture bytes are exact for what the game uploads.
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';
const LABEL = process.argv[2] || 'run';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: path.resolve('dist'), port: Number(process.env.PORT || 8861) });
const errors = [], http4xx = [];
const b = await launchBrowser();
const out = { label: LABEL, viewport: '390x844 @2x (iPhone-class)', scenes: {} };
try {
  const page = await b.newPage();
  page.on('pageerror', (e) => errors.push(`${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) http4xx.push(`${r.status()} ${r.url()}`); });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    // texture byte accounting on every WebGL(2) context: per texture object, per (face, level)
    const BPP = { 0x8058: 4, 0x8c43: 4, 0x881a: 8, 0x8814: 16, 0x8229: 1, 0x822b: 2, 0x8051: 4, 0x822d: 2, 0x822f: 4, 0x8c3a: 4, 0x88f0: 4, 0x81a6: 4, 0x8cac: 4, 0x81a5: 2, 0x1902: 4, 0x8d48: 1 };
    const unsized = (fmt, type) => (type === 0x1406 ? 16 : type === 0x140b || type === 0x8d61 ? 8 : 4) * (fmt === 0x1903 ? 0.25 : 1);
    const S = (window.__texmem = { dims: new Map(), tex: new Map(), rb: new Map(), peak: 0, uploads: 0, deletes: 0 });
    const total = () => { let t = 0; for (const m of S.tex.values()) for (const v of m.values()) t += v; for (const v of S.rb.values()) t += v; return t; };
    S.total = total;
    for (const C of [WebGLRenderingContext, typeof WebGL2RenderingContext !== 'undefined' ? WebGL2RenderingContext : null]) {
      if (!C) continue;
      const P = C.prototype;
      const bound = new WeakMap(); // gl → { unit, map unit→{target→tex} }
      const st = (gl) => { let s = bound.get(gl); if (!s) { s = { unit: 0, u: {} }; bound.set(gl, s); } return s; };
      const cur = (gl, target) => { const s = st(gl); const t = target >= 0x8515 && target <= 0x851a ? 0x8513 : target; return s.u[s.unit]?.[t]; };
      const set = (gl, tex, key, bytes, dim) => { if (!tex) return; if (dim) S.dims.set(tex, dim); let m = S.tex.get(tex); if (!m) S.tex.set(tex, (m = new Map())); m.set(key, bytes); S.uploads++; const t = total(); if (t > S.peak) S.peak = t; };
      const oAct = P.activeTexture; P.activeTexture = function (u) { st(this).unit = u - 0x84c0; return oAct.call(this, u); };
      const oBind = P.bindTexture; P.bindTexture = function (t, tex) { const s = st(this); (s.u[s.unit] ||= {})[t] = tex; return oBind.call(this, t, tex); };
      const oImg = P.texImage2D; P.texImage2D = function (...a) {
        const [target, level, ifmt] = a; let w, h, bpp;
        if (a.length >= 8 && typeof a[3] === 'number') { w = a[3]; h = a[4]; bpp = BPP[ifmt] ?? unsized(a[6], a[7]); }
        else { const src = a[5]; w = src?.width ?? src?.videoWidth ?? 0; h = src?.height ?? src?.videoHeight ?? 0; bpp = BPP[ifmt] ?? unsized(a[3], a[4]); }
        set(this, cur(this, target), `${target}:${level}`, w * h * bpp, level === 0 ? `${w}x${h}` : null);
        return oImg.apply(this, a);
      };
      if (P.texStorage2D) { const o = P.texStorage2D; P.texStorage2D = function (target, levels, ifmt, w, h) {
        let bytes = 0; for (let l = 0; l < levels; l++) bytes += Math.max(1, w >> l) * Math.max(1, h >> l) * (BPP[ifmt] ?? 4);
        set(this, cur(this, target), `${target}:storage`, bytes * (target === 0x8513 ? 6 : 1), `${w}x${h}${target === 0x8513 ? ' cube' : ''} fmt${ifmt.toString(16)}`);
        return o.call(this, target, levels, ifmt, w, h);
      }; }
      const oMip = P.generateMipmap; P.generateMipmap = function (target) {
        const tex = cur(this, target); const m = tex && S.tex.get(tex);
        if (m) { const base = [...m.entries()].filter(([k]) => k.endsWith(':0')).reduce((s, [, v]) => s + v, 0); m.set(`${target}:mips`, Math.round(base / 3)); const t = total(); if (t > S.peak) S.peak = t; }
        return oMip.call(this, target);
      };
      const oDel = P.deleteTexture; P.deleteTexture = function (tex) { if (S.tex.delete(tex)) S.deletes++; return oDel.call(this, tex); };
      const oRb = P.renderbufferStorage; P.renderbufferStorage = function (t, f, w, h) { S.rb.set(this.getParameter(0x8ca7), w * h * (BPP[f] ?? 4)); (S.rbd ||= new Map()).set(this.getParameter(0x8ca7), `rb ${w}x${h} f${f.toString(16)}`); return oRb.call(this, t, f, w, h); };
      if (P.renderbufferStorageMultisample) { const o = P.renderbufferStorageMultisample; P.renderbufferStorageMultisample = function (t, s, f, w, h) { S.rb.set(this.getParameter(0x8ca7), w * h * (BPP[f] ?? 4) * Math.max(1, s)); (S.rbd ||= new Map()).set(this.getParameter(0x8ca7), `rb ${w}x${h} f${f.toString(16)} x${s}`); return o.call(this, t, s, f, w, h); }; }
    }
    // frame sampler
    window.__frames = { on: false, d: [], cpu: [], last: 0 };
    const oRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => oRaf((t) => { const t0 = performance.now(); try { cb(t); } finally { const F = window.__frames; if (F.on && cb.name !== 'tick') F.cpu.push(performance.now() - t0); } });
    const tick = (t) => { const F = window.__frames; if (F.on && F.last) F.d.push(t - F.last); F.last = t; oRaf(tick); };
    oRaf(tick);
  });
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 300000, polling: 250 });
  await ev(() => window.__TAO_RPG__.clearSave());
  await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 300000, polling: 250 });
  const mem = () => ev(() => ({ mb: +(window.__texmem.total() / 1048576).toFixed(1), peakMb: +(window.__texmem.peak / 1048576).toFixed(1), textures: window.__texmem.tex.size, uploads: window.__texmem.uploads, deletes: window.__texmem.deletes, heapMb: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, npcSprites: (window.__TAO_RPG__.npcLoaded?.() ?? null),
    byDim: (() => { const g = {}; for (const [t, m] of window.__texmem.tex) { const k = window.__texmem.dims.get(t) || '?'; let b = 0; for (const v of m.values()) b += v; g[k] = g[k] || { n: 0, mb: 0 }; g[k].n++; g[k].mb += b / 1048576; } for (const [r, b] of window.__texmem.rb) { const k = window.__texmem.rbd?.get(r) || 'rb?'; g[k] = g[k] || { n: 0, mb: 0 }; g[k].n++; g[k].mb += b / 1048576; } return Object.fromEntries(Object.entries(g).sort((a, b) => b[1].mb - a[1].mb).slice(0, 14).map(([k, v]) => [k, `${v.n}× ${v.mb.toFixed(1)}MB`])); })() }));
  const sample = async (ms) => {
    await ev(() => { window.__frames.d = []; window.__frames.cpu = []; window.__frames.on = true; });
    await sleep(ms);
    return ev(() => {
      const F = window.__frames; F.on = false; const d = F.d.slice().sort((a, b) => a - b);
      const q = (p) => d.length ? +d[Math.min(d.length - 1, Math.floor(p * d.length))].toFixed(1) : null;
      const avg = d.reduce((s, x) => s + x, 0) / Math.max(1, d.length);
      const c = F.cpu.slice().sort((a, b) => a - b); const cq = (p) => c.length ? +c[Math.min(c.length - 1, Math.floor(p * c.length))].toFixed(1) : null;
      return { cpuP50Ms: cq(0.5), cpuP95Ms: cq(0.95), frames: d.length, avgMs: +avg.toFixed(1), p50Ms: q(0.5), p95Ms: q(0.95), maxMs: d.length ? +d[d.length - 1].toFixed(1) : null, fps: +(1000 / Math.max(1, avg)).toFixed(1) };
    });
  };
  out.scenes.boot = await mem();
  await page.waitForSelector('#btn-origin-ivalino', { visible: true, timeout: 60000 });
  await page.click('#btn-origin-ivalino'); await page.click('#btn-gender-m'); await page.click('#origin-go');
  await page.waitForFunction(() => window.__TAO_RPG__.state.started, { timeout: 60000, polling: 250 });
  for (let i = 0; i < 40 && (await ev(() => window.__TAO_RPG__.mode())) === 'dialogue'; i++) { await ev(() => window.__TAO_RPG__.advanceDialogue()); await sleep(100); }
  await ev(() => { const g = window.__TAO_RPG__; g.closeAll(); g.setTime('day'); });
  await sleep(3000);
  out.scenes.harbour = { ...(await sample(8000)), ...(await mem()) };
  // ride the ring road yayo → iraraley → iranmeylek (two village crossings) at scooter speed
  const route = await ev(() => {
    const g = window.__TAO_RPG__; const P = g.places; const legs = [['yayo', 'iraraley'], ['iraraley', 'iranmeylek']]; const pts = [];
    for (const [a, c] of legs) for (let k = 0; k <= 30; k++) { const t = k / 30; const x = P[a].x + (P[c].x - P[a].x) * t; const z = P[a].z + (P[c].z - P[a].z) * t; const r = g.roadPointNear(x, z, 40) || { x, z }; pts.push(r); }
    return pts;
  });
  await ev((pts) => {
    const g = window.__TAO_RPG__; g.setScooter(true); g.teleport(pts[0].x, pts[0].z);
    let i = 0, f = 0; const id = setInterval(() => { f += 0.5; i = Math.floor(f); if (i >= pts.length - 1) { clearInterval(id); return; } const a = pts[i], c = pts[i + 1], t = f - i; g.teleport(a.x + (c.x - a.x) * t, a.z + (c.z - a.z) * t); }, 100);
    window.__rideDone = () => i >= pts.length - 1;
  }, route);
  out.scenes.riding = await sample(12000);
  await page.waitForFunction(() => window.__rideDone(), { timeout: 120000, polling: 250 });
  out.scenes.riding = { ...out.scenes.riding, ...(await mem()) };
  await ev(() => { const g = window.__TAO_RPG__; g.setScooter(false); const p = g.places.ivalino; const q = g.roadPointNear(p.x, p.z, 14) || p; g.teleport(q.x, q.z); g.gatherParty(); });
  await sleep(4000);
  out.scenes.village = { ...(await sample(8000)), ...(await mem()), info: await ev(() => window.__TAO_RPG__.renderInfo()) };
  out.errors = errors; out.http4xx = http4xx;
} finally {
  await b.close().catch(() => {});
  await srv.close();
}
fs.writeFileSync(`perf-${LABEL}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
