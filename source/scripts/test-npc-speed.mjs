// Ambient NPCs walk at 1/3 of the party's walk speed and step-rate;
// escort / quest-follow uses the full player speed and animation rate.
import { startStaticServer, launchBrowser, debugUrl } from './lib/harness.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startStaticServer({ root: 'dist', port: Number(process.env.PORT || 8871) });
const report = { fails: [] };
const check = (name, ok, info) => {
  if (!ok) report.fails.push(name);
  console.log(ok ? 'ok  ' : 'FAIL', name, info !== undefined ? JSON.stringify(info).slice(0, 320) : '');
};

let browser = null;
try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(debugUrl(srv.base), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__TAO_RPG__?.ready, { timeout: 240000, polling: 250 });
  const ev = (fn, a) => page.evaluate(fn, a);

  await ev(() => {
    const g = window.__TAO_RPG__;
    g.clearSave?.();
    g.selectOrigin?.('yayo', 'm', 'boat');
    g.closeAll();
  });
  await sleep(400);

  const speeds = await ev(() => window.__TAO_RPG__.npcSpeeds());
  const walk = speeds.walk;
  check('player walk speed is the escort baseline', Math.abs(walk - speeds.escort) < 1e-9, speeds);
  check('ambient speed is 1/3 of walk speed', Math.abs(speeds.ambient - walk / 3) < 1e-9, speeds);
  check('ambient anim rate is 1/3 of full step rate', Math.abs(speeds.animAmbient - speeds.animFull / 3) < 1e-9, speeds);
  check('scale is 1/3', speeds.scale === 1 / 3, speeds);
  console.log(`values: walk ${walk}  ambient ${speeds.ambient}  escort ${speeds.escort}  anim ${speeds.animFull} / ${speeds.animAmbient}`);

  // a long, clear stretch of the ring road
  const path = await ev(() => {
    const g = window.__TAO_RPG__;
    const p = g.places.ivalino || g.places.yayo;
    const a = g.roadPointNear(p.x, p.z, 8) || p;
    let b = null;
    for (const [dx, dz] of [[16, 0], [0, 16], [-16, 0], [0, -16], [12, 12], [-12, 12]]) {
      const q = g.roadPointNear(a.x + dx, a.z + dz, 10);
      if (q && Math.hypot(q.x - a.x, q.z - a.z) >= 12) { b = q; break; }
    }
    b = b || { x: a.x + 16, z: a.z };
    return { a, b, sep: Math.hypot(b.x - a.x, b.z - a.z) };
  });
  // pick a wanderer (not a clinic staffer)
  const id = await ev(() => {
    const g = window.__TAO_RPG__;
    const list = (g.npcList?.() || []);
    return list.find((n) => n.kind !== 'clinic' && n.kind !== 'elder')?.id
      || Object.keys(g.places).length && (g.debugNpcs?.()[0])
      || null;
  });
  // expose actors
  const npcId = await ev(() => {
    const g = window.__TAO_RPG__;
    const ids = g.loadedNpcIds?.() || g.npcIds?.();
    // fall back: talkTo's byId via a known id
    const known = ['villager_ivalino', 'villager_taro', 'villager_yayo', 'aunt_ivalino', 'villager_iraraley'];
    for (const k of known) if (g.npcPace(k)) return k;
    return null;
  });
  check('found an NPC to measure', !!npcId, { npcId, path });
  if (!npcId) throw new Error('no NPC id');

  const measure = async (pace) => {
    await ev((o) => {
      const g = window.__TAO_RPG__;
      g.closeAll();
      g.teleport(o.a.x, o.a.z);
      g.gatherParty?.();
      g.placeNpc(o.id, o.a.x, o.a.z);
      g.loadNpc(o.id);
      g.setNpcPace(o.id, o.pace);
      g.setNpcRoute(o.id, [o.b]);
    }, { id: npcId, a: path.a, b: path.b, pace });
    await page.waitForFunction((id) => window.__TAO_RPG__.npcHasSprite(id), { timeout: 20000 }, npcId);
    return ev((o) => {
      const g = window.__TAO_RPG__;
      g.placeNpc(o.id, o.a.x, o.a.z);
      g.setNpcPace(o.id, o.pace);
      if (o.pace === 'escort') g.teleport(o.b.x, o.b.z);
      else g.teleport(o.a.x, o.a.z);
      g.setNpcRoute(o.id, [o.b]);
      const before = g.npcPace(o.id);
      const DT = 0.05, STEPS = 12;
      g.tickNpcs(DT, STEPS);
      const after = g.npcPace(o.id);
      const dist = Math.hypot(after.x - before.x, after.z - before.z);
      return { before, after, dist, speed: dist / (DT * STEPS), steps: (after.walkSteps ?? 0) - (before.walkSteps ?? 0), dt: DT * STEPS };
    }, { id: npcId, a: path.a, b: path.b, pace });
  };

  const amb = await measure('ambient');
  const esc = await measure('escort');
  const near = (got, want, slack) => Math.abs(got - want) <= slack;

  check('ambient move speed ≈ walk/3', near(amb.speed, speeds.ambient, speeds.ambient * 0.15), amb);
  check('escort move speed ≈ walk', near(esc.speed, speeds.escort, speeds.escort * 0.15), esc);
  check('ambient is much slower than escort', amb.speed < esc.speed * 0.5, { amb: amb.speed, esc: esc.speed });
  check('ambient step rate ≈ anim/3', near(amb.steps / amb.dt, speeds.animAmbient, 1.2), amb);
  check('escort step rate ≈ full anim', near(esc.steps / esc.dt, speeds.animFull, 1.2), esc);
  check('ambient walkRate is 1/3', Math.abs((amb.after.walkRate ?? 0) - 1 / 3) < 1e-9, amb.after);
  check('escort walkRate is 1', Math.abs((esc.after.walkRate ?? 0) - 1) < 1e-9, esc.after);
} catch (e) {
  report.fails.push(String(e && e.stack || e));
  console.error(e);
} finally {
  if (browser) await browser.close().catch(() => {});
  await srv.close();
}
if (report.fails.length) {
  console.log(`FAIL: ${report.fails.length} problem(s)`);
  process.exit(1);
}
console.log('OK: ambient NPCs walk at 1/3 speed and step rate; escort uses full player speed');
