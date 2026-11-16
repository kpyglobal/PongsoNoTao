/**
 * Sync content/places.json with the world layout (src/world/layout.ts). 0.1.4: the real-outline island,
 * so every place is recomputed: villages, taro fields, facilities, 小蘭嶼, and the hand-placed spots
 * (carried over relative to their village with fromOld(), or put on the road / shore / sea by rule).
 *   npx esbuild scripts/dev/places.ts --bundle --platform=node --format=esm --outfile=/tmp/places.mjs && node /tmp/places.mjs
 */
import { VILLAGE_DEFS, TARO_FIELDS, FACILITIES, JIMAGAOD, LANDMARKS, LAKES, MANTOU_ROCK, RING_ROAD, fromOld, vlocal } from '../../src/world/layout';
import { geo } from '../../src/world/outline';
import { getHeight, TERRAIN_BOX } from '../../src/world/height';
import { coastSdf } from '../../src/world/coast';
import fs from 'node:fs';
const file = 'content/places.json';
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const P = j.places;
const r1 = (n: number) => Math.round(n * 10) / 10;
const set = (id: string, p: { x: number; z: number }) => {
  if (!P[id]) throw new Error(`no place ${id}`);
  P[id].x = r1(p.x);
  P[id].z = r1(p.z);
};
const V = (id: string) => VILLAGE_DEFS.find((v) => v.id === id)!;
// 0.1.5: the world box follows the (bigger) terrain
j.world = { ...j.world, xMin: TERRAIN_BOX.xMin, xMax: TERRAIN_BOX.xMax, zMin: TERRAIN_BOX.zMin, zMax: TERRAIN_BOX.zMax };
for (const v of VILLAGE_DEFS) set(v.id, { x: v.cx, z: v.cz });
for (const f of TARO_FIELDS) {
  const u = (f.tiers * f.cellU) / 2 + 0.9;
  set(f.id, { x: f.cx + f.fx * u, z: f.cz + f.fz * u });
}
set('harbor', FACILITIES.harbor);
set('clinic', FACILITIES.clinic);
set('airport', FACILITIES.terminal);
set('jimagaod', JIMAGAOD);
// out at sea: off 椰油 (west) and off 東清灣 (east)
set('fishzone_west', vlocal(V('yayo'), -6, 18));
set('fishzone_east', vlocal(V('iranmeylek'), 0, 20));
// 紅頭山一帶: the lower slope of 紅頭山 toward 椰油 (gather spot for the 山 recipe ingredients)
{
  const h = LANDMARKS.find((l) => l.id === 'hongtoushan')!;
  const y = V('yayo');
  set('peak', { x: h.x + (y.cx - h.x) * 0.35, z: h.z + (y.cz - h.z) * 0.35 });
}
// shore / school / field spots by their village (0.1.3 positions, same place relative to the village)
for (const [id, ox, oz] of [['iranmeylek_beach', 23, -23], ['iratay_shore', -24.5, 25.5], ['iratay_school', -17.5, 24.5], ['wakay_iratay', -24, 15]] as [string, number, number][]) {
  const o = j.__old?.[id] ?? [ox, oz];
  set(id, fromOld(o[0], o[1]));
}
// 西岸路邊樹林: beside the ring road on the 椰油 → 機場 stretch, just inland of the road
{
  let best = { x: 0, z: 0 };
  let bd = Infinity;
  const y = V('yayo');
  const target = vlocal(y, -24, -2);
  for (let k = 1; k < RING_ROAD.length; k++) {
    const [ax, az] = RING_ROAD[k - 1];
    const [bx, bz] = RING_ROAD[k];
    for (let s = 0; s <= 1; s += 0.1) {
      const x = ax + (bx - ax) * s;
      const z = az + (bz - az) * s;
      const d = Math.hypot(x - target.x, z - target.z);
      if (d < bd) { bd = d; best = { x, z }; }
    }
  }
  // 2.8 m inland of the road centre
  let p = best;
  for (const a of Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2)) {
    const q = { x: best.x + Math.cos(a) * 2.8, z: best.z + Math.sin(a) * 2.8 };
    if (coastSdf(q.x, q.z) > coastSdf(p.x, p.z)) p = q;
  }
  set('owl_road', p);
}
// ---- 0.1.4: the places docs/phase1/WORLD_NEEDS.md asks for (created when missing, then kept in sync)
const add = (id: string, zh: string, kind: string, p: { x: number; z: number }, flavor?: string) => {
  if (!P[id]) P[id] = { zh, tao: '', x: 0, z: 0, kind, ...(flavor ? { flavor } : {}) };
  set(id, p);
};
/** ring road point nearest (x, z) and its index */
const ringNear = (x: number, z: number): { i: number; x: number; z: number } => {
  let bi = 0, bd = Infinity;
  RING_ROAD.forEach(([a, b], i) => { const d = Math.hypot(a - x, b - z); if (d < bd) { bd = d; bi = i; } });
  return { i: bi, x: RING_ROAD[bi][0], z: RING_ROAD[bi][1] };
};
/** `d` m inland of a road point (the direction away from the shore) */
const inland = (p: { x: number; z: number }, d: number) => {
  let best = p, bs = -Infinity;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const q = { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d };
    const s2 = coastSdf(q.x, q.z);
    if (s2 > bs) { bs = s2; best = q; }
  }
  return best;
};
// 五孔洞: a roadside viewpoint ≥ 12 m from the cave mouths (the caves are not enterable)
{
  const cave = geo(121.51143, 22.08056);
  let p: { x: number; z: number } = ringNear(cave.x, cave.z);
  for (let k = 0; k < 20 && Math.hypot(p.x - cave.x, p.z - cave.z) < 12.5; k++) p = inland(p, 0.6);
  add('five_caves_view', '五孔洞（路邊遠看）', 'viewpoint', p);
}
add('small_lake_view', '小天池（遠看）', 'viewpoint', LAKES.find((l) => l.id === 'small_lake')!.view);
add('big_lake_view', '大天池（遠看）', 'viewpoint', LAKES.find((l) => l.id === 'big_lake')!.view);
// 八代灣: the road above the bay (OSM viewpoint), outside 漁人 and 紅頭
{
  const g = geo(121.55344, 22.02475);
  // keep clear of the clinic door (E would pick the clinic) and of 漁人 / 紅頭
  const cl = FACILITIES.clinic;
  let best = { x: g.x, z: g.z }, bs = Infinity;
  for (let i = 0; i < RING_ROAD.length - 1; i++) {
    const [ax, az] = RING_ROAD[i], [bx, bz] = RING_ROAD[i + 1];
    for (let t = 0; t <= 1; t += 0.05) {
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (Math.hypot(x - cl.x, z - cl.z) < 7.5) continue;
      if (VILLAGE_DEFS.some((v) => Math.hypot(x - v.cx, z - v.cz) < 12.5)) continue;
      const d = Math.hypot(x - g.x, z - g.z);
      if (d < bs) { bs = d; best = { x, z }; }
    }
  }
  add('badai_view', '八代灣觀景點', 'viewpoint', inland(best, 2.2));
}
// 虎頭坡: on the ring road south of 椰油 toward the airport, looking north to 饅頭岩 and south to the runway
{
  const m = ringNear(MANTOU_ROCK.x, MANTOU_ROCK.z);
  const t = FACILITIES.terminal;
  const step = Math.hypot(RING_ROAD[(m.i + 2) % RING_ROAD.length][0] - t.x, RING_ROAD[(m.i + 2) % RING_ROAD.length][1] - t.z) < Math.hypot(m.x - t.x, m.z - t.z) ? 1 : -1;
  let i = m.i, run = 0;
  while (run < 7) {
    const n = (i + step + RING_ROAD.length) % RING_ROAD.length;
    run += Math.hypot(RING_ROAD[n][0] - RING_ROAD[i][0], RING_ROAD[n][1] - RING_ROAD[i][1]);
    i = n;
  }
  add('hutou_slope', '虎頭坡', 'viewpoint', inland({ x: RING_ROAD[i][0], z: RING_ROAD[i][1] }, 2.8));
}
// 茅草地: a hillside beside the road between 椰油 and 朗島 (near the host villages)
{
  const a = V('yayo'), b = V('iraraley');
  const mid = ringNear((a.cx + b.cx) / 2, (a.cz + b.cz) / 2);
  add('thatch_field', '山坡上的茅草地', 'field', inland(mid, 4.2));
}
// the list of derived ids content may use (src/world/places.ts)
for (const id of ['host_tagakal', 'host_fishrack']) if (!j.derived.ids.includes(id)) j.derived.ids.push(id);
for (const l of LANDMARKS) if (!j.landmarks.includes(l.id)) j.landmarks.push(l.id);

fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
for (const [k, v] of Object.entries(P) as [string, { x: number; z: number }][]) console.log(k.padEnd(18), v.x, v.z, 'h', getHeight(v.x, v.z).toFixed(2));
process.exit(0);
