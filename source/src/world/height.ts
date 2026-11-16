/**
 * Deterministic sculpted volcanic heightfield for Pongso no Tao｜蘭嶼文化島.
 * +X east, +Z south, sea level = 0.
 *
 * The raw function is fairly expensive (ridges, warped ridged-multifractal
 * erosion, coves, reef shelf, terraces, sunken-house pits), so it is baked once
 * into a cached grid. All runtime queries (player, props, water bake, albedo)
 * bilinearly sample that grid so everything agrees with the rendered mesh.
 */
import {
  FACILITIES,
  LANDMARKS,
  LAKES,
  type Lake,
  JIMAGAOD,
  runwayLocal,
  VILLAGE_DEFS,
  TARO_FIELDS,
  villageStructures,
  villageExtent,
  fieldLocal,
  tierShift,
  ROADS,
  CROSS_ROAD,
  type Structure,
  type TaroField,
  type Box2,
  FOOTPRINT,
  facilityBoxes,
  CLINIC_FOOT,
} from './layout';
import { planFootpaths, PATH_HALF, type Footpath, type PathTarget } from './paths';
import { yieldIfBusy, yieldToUi } from '../core/frame';
import { coastSdf, seaNormal } from './coast';
import { geo, MAP_SCALE as K } from './outline';
import { lerp, clamp01, smoothstep } from '../core/math';

// kept as re-exports: island.ts and others import these from the heightfield module
export { lerp, clamp01, smoothstep };

export interface Sample {
  height: number;
  mask: number;
  beach: number;
  road: number;
  terrace: number;
  sand: number;
  rock: number;
  grass: number;
  seabed: number;
  cliff: number;
  village: number;
  forest: number;
  slope: number;
  bund: number;
  /** 0.1.5: footpath (小徑) weight */
  path: number;
}

// ---------------------------------------------------------------------------
// noise helpers
// ---------------------------------------------------------------------------
function fract(n: number): number {
  return n - Math.floor(n);
}
function hash(x: number, z: number): number {
  return fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453);
}
function fade(t: number): number {
  return t * t * (3 - 2 * t);
}
export function noise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fade(fx);
  const uz = fade(fz);
  return lerp(
    lerp(hash(ix, iz), hash(ix + 1, iz), ux),
    lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), ux),
    uz,
  );
}
export function fbm(x: number, z: number, oct = 4): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += a * noise(x * f + i * 17.3, z * f - i * 9.1);
    a *= 0.5;
    f *= 2.03;
  }
  return v;
}
/** Ridged multifractal, 0..~1, high values = sharp crests. */
function ridged(x: number, z: number, oct = 5): number {
  let v = 0;
  let a = 0.55;
  let f = 1;
  let w = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(noise(x * f + i * 31.7, z * f + i * 11.3) * 2 - 1);
    n *= n;
    n *= w;
    w = clamp01(n * 1.6);
    v += n * a;
    norm += a;
    a *= 0.5;
    f *= 2.1;
  }
  return v / norm;
}

function gauss(x: number, z: number, cx: number, cz: number, rx: number, rz: number): number {
  const dx = (x - cx) / rx;
  const dz = (z - cz) / rz;
  return Math.exp(-(dx * dx + dz * dz));
}

function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): { d: number; t: number } {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz || 1;
  const t = clamp01(((x - ax) * abx + (z - az) * abz) / len2);
  return { d: Math.hypot(x - (ax + abx * t), z - (az + abz * t)), t };
}

// ---------------------------------------------------------------------------
// island shape
// ---------------------------------------------------------------------------

/** 0.1.4: inland distance (m) that counts as s = 1 (the old oval island's radius scale) */
const COAST_R = 32 * K;

/** Coastal field: < 1 is land. 0.1.4: the real 蘭嶼 outline (coast.ts), with a little noise on top. */
function coastField(x: number, z: number): number {
  let d = 1 - coastSdf(x, z) / COAST_R;
  d += (fbm((x * 0.05) / K, (z * 0.05) / K) - 0.5) * 0.06;
  d += (fbm((x * 0.13) / K, (z * 0.13) / K) - 0.5) * 0.03;
  d += (fbm(x * 0.32, z * 0.32, 3) - 0.5) * 0.014;
  return d;
}

interface RidgeNode { x: number; z: number; h: number }
interface Ridge { nodes: RidgeNode[]; w: number; sharp: number }

/** 0.1.4: real relief: 紅頭山 (548 m) north-west of centre, 大森山 (480 m) in the south-east lobe, a spine between */
const P_HONGTOU = geo(121.53455, 22.05303);
const P_DASEN = geo(121.58571, 22.01032);
const RIDGES_014: Ridge[] = [
  // main spine: north-west corner → 紅頭山 → saddle → 大森山 → south-east cape
  { nodes: [{ x: -40, z: -36, h: 4.5 }, { x: -29, z: -25, h: 9.5 }, { x: P_HONGTOU.x / K, z: P_HONGTOU.z / K, h: 14.5 }, { x: -4, z: 0, h: 10.5 }, { x: 12, z: 14, h: 9.0 }, { x: 28, z: 28, h: 10.5 }, { x: P_DASEN.x / K, z: P_DASEN.z / K, h: 12.5 }, { x: 48, z: 40, h: 4.5 }], w: 20, sharp: 1.05 },
  // north ridge toward 雙獅岩 (the north-east corner)
  { nodes: [{ x: P_HONGTOU.x / K, z: P_HONGTOU.z / K, h: 13 }, { x: -4, z: -26, h: 10.5 }, { x: 8, z: -36, h: 7.5 }, { x: 16, z: -44, h: 3.5 }], w: 16, sharp: 1.0 },
  // east-central hills between 東清 and 野銀 (kept off the shore)
  { nodes: [{ x: -4, z: 0, h: 10 }, { x: 6, z: -6, h: 7.5 }, { x: 6, z: -18, h: 6.5 }], w: 12, sharp: 1.0 },
  // spur down toward 椰油 (west; it stops short of the airport's coastal flat)
  { nodes: [{ x: P_HONGTOU.x / K, z: P_HONGTOU.z / K, h: 13 }, { x: -24, z: -10, h: 7 }, { x: -27, z: -9, h: 4.0 }], w: 9, sharp: 1.0 },
  // spur toward 漁人 / 紅頭 (south)
  { nodes: [{ x: -4, z: 0, h: 10 }, { x: 0, z: 10, h: 6 }, { x: 2, z: 15, h: 3 }], w: 10, sharp: 1.0 },
  // south-east lobe: 大森山 down to 青青草原
  { nodes: [{ x: P_DASEN.x / K, z: P_DASEN.z / K, h: 12 }, { x: 32, z: 40, h: 5.5 }, { x: 26, z: 43, h: 2.5 }], w: 10, sharp: 1.0 },
];
/** 0.1.5: the 0.1.4 ridge lines (written in 0.1.4 units), scaled up with the island */
const RIDGES: Ridge[] = RIDGES_014.map((r) => ({ ...r, w: r.w * K, nodes: r.nodes.map((n) => ({ x: n.x * K, z: n.z * K, h: n.h })) }));

function ridgeField(x: number, z: number): number {
  let best = 0;
  let second = 0;
  for (const r of RIDGES) {
    for (let i = 0; i < r.nodes.length - 1; i++) {
      const a = r.nodes[i];
      const b = r.nodes[i + 1];
      const { d, t } = segDist(x, z, a.x, a.z, b.x, b.z);
      if (d > r.w) continue;
      const h = lerp(a.h, b.h, t);
      const u = d / r.w;
      const k = Math.pow(1 - u, r.sharp) * (0.55 + 0.45 * (1 - u)) * h;
      if (k > best) {
        second = best;
        best = k;
      } else if (k > second) second = k;
    }
  }
  // smooth max so saddles between ridges stay sculpted, not flat
  return best + second * 0.08;
}

/** 0..1 how rocky/cliffy the coastline is at this spot. */
const QQ = LANDMARKS.find((l) => l.id === 'qingqing')!;
const TL = LANDMARKS.find((l) => l.id === 'twinlions')!;

function cliffiness(x: number, z: number): number {
  let c = noise((x * 0.07) / K + 5, (z * 0.07) / K - 3) * 1.25 - 0.32;
  // 0.1.4: Pacific-facing east and south-east shores (sea normal pointing east)
  const n = seaNormal(x, z, 3);
  c += smoothstep(0.15, 0.7, n.x) * 0.55;
  c += smoothstep(0.3, 0.9, -n.z) * 0.25; // north shore
  c += gauss(x, z, QQ.x, QQ.z, 7 * K, 5 * K) * 0.9; // 青青草原 sea cliffs
  c += gauss(x, z, TL.x, TL.z, 8 * K, 6 * K) * 0.6; // 雙獅岩 headland
  // calm, sandy settlement bays
  for (const v of VILLAGE_DEFS) c -= gauss(x, z, v.cx + v.fx * 6, v.cz + v.fz * 6, 9, 9) * 1.4;
  c -= gauss(x, z, FACILITIES.harbor.x, FACILITIES.harbor.z, 6, 5) * 1.5; // Kaiyuan harbour
  c -= gauss(x, z, FACILITIES.runway.x, FACILITIES.runway.z, 9, 9) * 0.8; // airport shore
  return clamp01(c);
}

/** villageExtent() is constant per village; computed once instead of per height sample. */
const VILLAGE_EXT = new Map(VILLAGE_DEFS.map((v) => [v, villageExtent(v)] as const));

function villageRectDist(v: (typeof VILLAGE_DEFS)[number], x: number, z: number): { dist: number; w: number } {
  const dx = x - v.cx;
  const dz = z - v.cz;
  const u = dx * -v.fz + dz * v.fx;
  const w = dx * v.fx + dz * v.fz;
  const ext = VILLAGE_EXT.get(v) ?? villageExtent(v);
  const du = Math.max(0, Math.abs(u) - ext.hu);
  const dw = w < ext.w0 ? ext.w0 - w : w > ext.w1 ? w - ext.w1 : 0;
  return { dist: Math.hypot(du, dw), w };
}

/** 0..1 proximity to a settlement: mountains relax into gentle coastal terraces there. */
function settleProx(x: number, z: number): number {
  let p = 0;
  for (const v of VILLAGE_DEFS) {
    const { dist } = villageRectDist(v, x, z);
    p = Math.max(p, 1 - smoothstep(0, 14, dist));
  }
  // 0.1.4: the airport and the clinic sit on gentle coastal flats too
  const { across, along } = runwayLocal(x, z);
  const R = FACILITIES.runway;
  p = Math.max(p, 1 - smoothstep(0, 14, Math.hypot(Math.max(0, Math.abs(across) - R.hx - 6), Math.max(0, Math.abs(along) - R.hz))));
  const cl = FACILITIES.clinic;
  p = Math.max(p, 1 - smoothstep(0, 12, Math.max(0, Math.hypot(x - cl.x, z - cl.z) - 4)));
  return p;
}

/** 0.1.5: the 中橫公路 runs through a pass: the ridges are lowered along its corridor (1 = untouched) */
const CROSS_BOX = (() => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of CROSS_ROAD) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return { x0: x0 - 20, x1: x1 + 20, z0: z0 - 20, z1: z1 + 20 };
})();
const PASS_IN = 3, PASS_OUT = 18;
function crossPass(x: number, z: number): number {
  if (x < CROSS_BOX.x0 || x > CROSS_BOX.x1 || z < CROSS_BOX.z0 || z > CROSS_BOX.z1) return 1;
  let best = Infinity;
  for (let i = 0; i < CROSS_ROAD.length - 1; i++) {
    const [ax, az] = CROSS_ROAD[i], [bx, bz] = CROSS_ROAD[i + 1];
    if (Math.min(ax, bx) - PASS_OUT > x || Math.max(ax, bx) + PASS_OUT < x || Math.min(az, bz) - PASS_OUT > z || Math.max(az, bz) + PASS_OUT < z) continue;
    best = Math.min(best, segDist(x, z, ax, az, bx, bz).d);
  }
  return 1 - 0.7 * (1 - smoothstep(PASS_IN, PASS_OUT, best));
}

/** natural terrain before any human shaping. */
function naturalRaw(x: number, z: number): { h: number; s: number; cliff: number } {
  const d = coastField(x, z);
  const s = 1 - d; // > 0 inland
  const cliff = cliffiness(x, z);

  // domain warp for organic ridges
  const wx = x + (fbm((x * 0.045) / K + 3.1, (z * 0.045) / K) - 0.5) * 9 * K;
  const wz = z + (fbm((x * 0.045) / K, (z * 0.045) / K + 7.7) - 0.5) * 9 * K;
  const R = ridgeField(wx, wz) * crossPass(x, z);
  const rn = ridged((wx * 0.085) / K, (wz * 0.085) / K, 5);
  const inland = smoothstep(-0.02, 0.2, s);
  const prox = settleProx(x, z);
  let mountain = (R * inland + smoothstep(0.05, 0.75, s) * 3.2) * (1 - 0.82 * prox);
  // eroded crests and carved gullies (valleys) — strongest on mid slopes
  mountain *= 0.84 + 0.3 * rn;
  mountain -= Math.pow(1 - rn, 2.0) * 0.26 * R * smoothstep(0.05, 0.3, s);
  mountain += (fbm(x * 0.21, z * 0.21, 3) - 0.5) * 0.9 * inland;

  let h: number;
  if (s >= 0) {
    const beachH = s * 6.5 + smoothstep(0.02, 0.2, s) * 0.5;
    const capH = (2.2 + noise(x * 0.11, z * 0.11) * 2.6) * smoothstep(0.0, 0.03, s);
    const cliffH = capH + s * 6.5;
    h = lerp(beachH, cliffH, cliff) + Math.max(0, mountain);
    // soft terracing of grassy mid slopes (ridged agricultural / erosion steps)
    // (style v2: kept away from the shore so the beach slope meets the sea without a step)
    const zone = smoothstep(2, 4, h) * (1 - smoothstep(10, 14, h)) * smoothstep(0.1, 0.25, s);
    const step = 1.35;
    const t = h / step;
    const terr = (Math.floor(t) + smoothstep(0.25, 0.75, fract(t))) * step;
    h = lerp(h, terr, 0.32 * zone);
  } else {
    // fringing reef shelf, rock ledges with tidal pools, then drop-off
    const reefW = 0.045 + noise(x * 0.09, z * 0.09) * 0.05;
    const n1 = fbm(x * 0.35, z * 0.35, 3);
    const shelf = -0.42 + (n1 - 0.5) * 0.55;
    const deep = -7.2 + fbm(x * 0.08, z * 0.08) * 1.6;
    h = lerp(shelf, deep, smoothstep(reefW, reefW + 0.13, -s));
    // rock ledge just off cliffy coasts (sits at/above water with pools)
    const ledge = cliff * (1 - smoothstep(0.0, 0.03, -s));
    const pool = smoothstep(0.55, 0.7, noise(x * 0.9 + 3, z * 0.9 - 2));
    const ledgeH = 0.22 + (n1 - 0.5) * 0.5 - pool * 0.45;
    h = lerp(h, ledgeH, ledge);
    // sandy beach slope into the water elsewhere
    // (style v2: continues the land slope under water, then eases onto the reef shelf; no lip at the waterline)
    h = lerp(h, lerp(s * 5.0, h, smoothstep(0.0, 0.08, -s)), 1 - cliff);
  }
  return { h, s, cliff };
}

/** Little Lanyu — Jimagaod. */
function jimagaod(x: number, z: number): { h: number; mask: number } {
  const lx = JIMAGAOD.x;
  const lz = JIMAGAOD.z;
  const ld = Math.hypot((x - lx) / 6.8, (z - lz) / 5.6) + (fbm(x * 0.2, z * 0.2) - 0.5) * 0.18;
  const mask = smoothstep(1.12, 0.9, ld);
  if (ld > 1.6) return { h: -100, mask: 0 };
  const rn = ridged(x * 0.18, z * 0.18, 4);
  const top = Math.pow(clamp01(1 - ld), 1.2) * 6.2 + gauss(x, z, lx + 0.6, lz - 0.5, 2.6, 2.2) * 2.2;
  let h = (mask > 0 ? 0.9 * smoothstep(0, 0.06, 1 - ld) : 0) + top * (0.85 + rn * 0.3);
  if (ld > 1) h = lerp(-0.4, -7, smoothstep(1.0, 1.4, ld)) + (fbm(x * 0.4, z * 0.4) - 0.5) * 0.5;
  return { h, mask };
}

// ---------------------------------------------------------------------------
// human shaping: ring road, villages, pits, runway, harbour, taro terraces
// ---------------------------------------------------------------------------

/** Ring road + harbour spur (layout.ts ROADS, 0.1.1). */
/** reclaimed quay box (flat |dx| < 0.55 hx, |dz| < 0.55 hz, sloping into the sea beyond) */
export const HARBOUR_QUAY = { x: FACILITIES.harbor.x + 4.4, z: FACILITIES.harbor.z + 0.1, hx: 4.7, hz: 5.5 };

/** top of the coastal road embankment */
const ROAD_BANK_H = 0.62;

const ROAD_SEGS: [number, number, number, number][] = ROADS.flatMap((pl) => pl.slice(0, -1).map((p, i) => [p[0], p[1], pl[i + 1][0], pl[i + 1][1]] as [number, number, number, number]));

/** read-only view of the road centrelines (road audit / map overlays) */
export function roadPolylines(): readonly (readonly [number, number])[][] {
  return ROADS;
}

/**
 * 0.1.6 scooter road-follow: the nearest road centreline within `maxD` — its unit direction (tx, tz) and the
 * signed sideways offset (positive = left of the direction); null when no road is that close
 */
export function roadNear(x: number, z: number, maxD: number): { tx: number; tz: number; off: number; d: number } | null {
  let best: { tx: number; tz: number; off: number; d: number } | null = null;
  for (const [ax, az, bx, bz] of ROAD_SEGS) {
    if (Math.min(ax, bx) - maxD > x || Math.max(ax, bx) + maxD < x || Math.min(az, bz) - maxD > z || Math.max(az, bz) + maxD < z) continue;
    const r = segDist(x, z, ax, az, bx, bz);
    if (r.d > maxD || (best && r.d >= best.d)) continue;
    const L = Math.hypot(bx - ax, bz - az) || 1;
    const tx = (bx - ax) / L, tz = (bz - az) / L;
    // cross product sign: which side of the centreline the point is on
    const off = (tx * (z - az) - tz * (x - ax));
    best = { tx, tz, off, d: r.d };
  }
  return best;
}

export function distToRing(x: number, z: number): number {
  let best = 1e9;
  for (const [ax, az, bx, bz] of ROAD_SEGS) best = Math.min(best, segDist(x, z, ax, az, bx, bz).d);
  return best;
}

const LAKE_SURF = new Map<string, number>();
/** a lake's water level: the natural ground at its centre (kept above the sea) */
export function lakeSurface(lk: Lake): number {
  let v = LAKE_SURF.get(lk.id);
  if (v === undefined) {
    v = Math.max(1.2, naturalRaw(lk.x, lk.z).h);
    LAKE_SURF.set(lk.id, v);
  }
  return v;
}

/** 0.1.1: tagakal check the natural ground so none stands in the sea */
export const ALL_STRUCTURES: Structure[] = (() => {
  const all: Structure[] = [];
  for (const v of VILLAGE_DEFS) all.push(...villageStructures(v, (x, z) => naturalRaw(x, z).h > 0.3, all));
  return all;
})();

const VAHEY = ALL_STRUCTURES.filter((s) => s.kind === 'vahey');
export const PIT_DEPTH = 0.95;

function flattenRect(h: number, x: number, z: number, cx: number, cz: number, hx: number, hz: number, target: number, soft = 0.4): number {
  const dx = Math.abs(x - cx) / hx;
  const dz = Math.abs(z - cz) / hz;
  const d = Math.max(dx, dz);
  if (d > 1) return h;
  const t = smoothstep(1, soft, d);
  return lerp(h, target, t);
}

function initFieldTops(): void {
  for (const f of TARO_FIELDS) {
    // upper (inland) edge height of the natural slope
    const U = f.tiers * f.cellU;
    const ux = f.cx - f.fx * U * 0.5;
    const uz = f.cz - f.fz * U * 0.5;
    const lx = f.cx + f.fx * U * 0.5;
    const lz = f.cz + f.fz * U * 0.5;
    const top = naturalRaw(ux, uz).h;
    const bottom = Math.max(1.1, naturalRaw(lx, lz).h);
    f.drop = Math.max(0.36, Math.min(1.05, (top - bottom) / f.tiers));
    f.top = Math.max(bottom + f.drop * (f.tiers - 0.5), Math.min(top, bottom + f.drop * f.tiers + 0.6));
  }
}
initFieldTops();


function taroAt(f: TaroField, x: number, z: number): { w: number; h: number; inCell: number } | null {
  const { u, v } = fieldLocal(f, x, z);
  const U = f.tiers * f.cellU;
  const V = f.cols * f.cellV;
  const m = 3.6;
  if (Math.abs(u) > U / 2 + m || Math.abs(v) > V / 2 + m) return null;
  const du = Math.max(0, Math.abs(u) - U / 2);
  const dv = Math.max(0, Math.abs(v) - V / 2 - 0.6);
  const w = 1 - smoothstep(0, m, Math.hypot(du, dv));
  const i = Math.max(0, Math.min(f.tiers - 1, Math.floor((u + U / 2) / f.cellU)));
  const level = f.top - i * f.drop;
  // cell-local position for basin + stone rim
  const lu = u + U / 2 - (i + 0.5) * f.cellU;
  const vv = v + V / 2 - tierShift(f, i);
  const j = Math.max(0, Math.min(f.cols - 1, Math.floor(vv / f.cellV)));
  const lv = vv - (j + 0.5) * f.cellV;
  const eu = f.cellU / 2 - Math.abs(lu);
  const ev = f.cellV / 2 - Math.abs(lv);
  const edge = Math.min(eu, ev);
  const inside = du === 0 && dv === 0 ? smoothstep(0.12, 0.3, edge) : 0;
  return { w, h: level - inside * 0.16, inCell: inside };
}

interface Raw {
  h: number;
  land: number;
  cliff: number;
  road: number;
  terrace: number;
  bund: number;
  village: number;
  pit: number;
  runway: number;
  path: number;
}


/** the village ground band (stepped, gentle) applied to a natural height */
function villageBand(x: number, z: number, h0: number, s0: number): { h: number; village: number } {
  let h = h0;
  let village = 0;
  for (const v of VILLAGE_DEFS) {
    const { dist, w } = villageRectDist(v, x, z);
    if (dist > 3.5) continue;
    const k = 1 - smoothstep(0, 3.5, dist);
    const lo = v.plazaH + Math.max(0, -w) * 0.05;
    const hi = v.plazaH + 0.3 + Math.max(0, -w) * 0.22 + Math.max(0, -w - 5) * 0.5;
    const target = Math.min(hi, Math.max(lo, h));
    if (h > 0.25 || s0 > 0.01) {
      h = lerp(h, target, k * smoothstep(-0.02, 0.03, s0));
      village = Math.max(village, k);
    }
  }
  return { h, village };
}

/**
 * 0.1.5: every village building stands on its own level terrace cut into the slope (no corner floats above the
 * ground): the pad is the village ground at the building's centre, `PAD_MARGIN` m beyond its footprint, easing back
 * to the slope over `PAD_EASE` m (a short bank / retaining edge on the uphill side).
 */
const PAD_MARGIN: Record<string, number> = { vahey: 1.0, makarang: 0.7, tagakal: 0.6, modern: 0.8, shop: 0.8, church: 0.9 };
const PAD_EASE = 1.6;
interface Pad { x: number; z: number; c: number; s: number; px: number; pz: number; h: number; r: number }
let PADS: Pad[] | null = null;
function pads(): Pad[] {
  if (PADS) return PADS;
  PADS = ALL_STRUCTURES.map((st) => {
    const n = naturalRaw(st.x, st.z);
    const m = PAD_MARGIN[st.kind] ?? 0.7;
    const px = st.hw + m, pz = st.hd + m;
    // the terrace level: the village ground at the centre, but never below the lowest corner's ground by more
    // than 0.35 m (a fill that tall would read as the house floating on a mound)
    let h = villageBand(st.x, st.z, n.h, n.s).h;
    const c = Math.cos(st.yaw), sn = Math.sin(st.yaw);
    let lo = Infinity;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const wx = st.x + a * st.hw * c + b * st.hd * sn, wz = st.z - a * st.hw * sn + b * st.hd * c;
      const q = naturalRaw(wx, wz);
      lo = Math.min(lo, villageBand(wx, wz, q.h, q.s).h);
    }
    h = Math.min(h, lo + 0.35);
    if (st.kind === 'tagakal') h = Math.max(h, 0.45);
    return { x: st.x, z: st.z, c, s: sn, px, pz, h, r: Math.hypot(px, pz) + PAD_EASE };
  });
  return PADS;
}
/** terrace pads at (x, z): blended target height and weight (0 = none) */
function padAt(x: number, z: number): { h: number; k: number } {
  let ws = 0, hs = 0, kmax = 0;
  for (const p of pads()) {
    const dx = x - p.x, dz = z - p.z;
    if (Math.abs(dx) > p.r || Math.abs(dz) > p.r) continue;
    const lx = Math.abs(dx * p.c - dz * p.s) - p.px;
    const lz = Math.abs(dx * p.s + dz * p.c) - p.pz;
    const d = Math.hypot(Math.max(0, lx), Math.max(0, lz));
    if (d >= PAD_EASE) continue;
    const k = 1 - smoothstep(0, PAD_EASE, d);
    ws += k; hs += k * p.h; kmax = Math.max(kmax, k);
  }
  return ws > 0 ? { h: hs / ws, k: kmax } : { h: 0, k: 0 };
}

function shaped(x: number, z: number): Raw {
  const nat = naturalRaw(x, z);
  let h = nat.h;
  let land = smoothstep(-0.005, 0.02, nat.s);

  let village = 0;
  for (const v of VILLAGE_DEFS) {
    const { dist, w } = villageRectDist(v, x, z);
    if (dist > 3.5) continue;
    const k = 1 - smoothstep(0, 3.5, dist);
    // stepped village ground: clamp natural slope into a gentle band
    const lo = v.plazaH + Math.max(0, -w) * 0.05;
    const hi = v.plazaH + 0.3 + Math.max(0, -w) * 0.22 + Math.max(0, -w - 5) * 0.5;
    const target = Math.min(hi, Math.max(lo, h));
    if (h > 0.25 || nat.s > 0.01) {
      h = lerp(h, target, k * smoothstep(-0.02, 0.03, nat.s));
      village = Math.max(village, k);
    }
  }
  // 0.1.5: level terraces under the buildings
  {
    const pd = padAt(x, z);
    if (pd.k > 0 && (h > 0.25 || nat.s > 0.01)) h = lerp(h, pd.h, pd.k * (pd.k * (3 - 2 * pd.k)));
  }

  // sunken underground-house pits (地下屋 vahey)
  let pit = 0;
  for (const s of VAHEY) {
    const dx = x - s.x;
    const dz = z - s.z;
    if (Math.abs(dx) > 3 || Math.abs(dz) > 3) continue;
    const c = Math.cos(s.yaw);
    const sn = Math.sin(s.yaw);
    const lx = dx * c - dz * sn;
    const lz = dx * sn + dz * c;
    const e = Math.max(Math.abs(lx) / s.hw, Math.abs(lz) / s.hd);
    if (e < 1.08) {
      const k = 1 - smoothstep(0.9, 1.06, e);
      h -= PIT_DEPTH * k;
      pit = Math.max(pit, k);
    }
  }

  // runway (蘭嶼機場) + Kaiyuan harbour apron
  let runway = 0;
  const R = FACILITIES.runway;
  if (nat.s > -0.03) {
    // 0.1.4: the runway is turned to follow the shore (runway-local across / along)
    const { across, along } = runwayLocal(x, z);
    const rw = flattenRect(h, across, along, 0, 0, R.hx + 2.4, R.hz + 2.4, 1.05, 0.72);
    runway = smoothstep(1, 0.8, Math.max(Math.abs(across) / (R.hx + 0.2), Math.abs(along) / (R.hz + 0.2)));
    h = rw;
    // terminal apron (its long side along the runway)
    const T = FACILITIES.terminal;
    const tl = runwayLocal(T.x, T.z);
    h = flattenRect(h, across, along, tl.across, tl.along, 3.6, 6.0, 1.1, 0.55);
  }
  if (nat.s > -0.02) h = flattenRect(h, x, z, FACILITIES.harbor.x + 3.5, FACILITIES.harbor.z + 0.3, 6.5, 3.4, 0.75);
  // 0.1.1: reclaimed quay joining the 開元港 apron to the shore (in 0.1.0 a 4–5 m strip of sea
  // separated the apron from the island, so the arriving party could never walk off the dock)
  {
    const qd = Math.max(Math.abs(x - HARBOUR_QUAY.x) / HARBOUR_QUAY.hx, Math.abs(z - HARBOUR_QUAY.z) / HARBOUR_QUAY.hz);
    if (qd < 1) {
      h = Math.max(h, flattenRect(h, x, z, HARBOUR_QUAY.x, HARBOUR_QUAY.z, HARBOUR_QUAY.hx, HARBOUR_QUAY.hz, 0.75, 0.55));
      land = Math.max(land, 1 - smoothstep(0.6, 0.85, qd));
    }
  }
  // clinic pad (Imorod)
  h = flattenRect(h, x, z, FACILITIES.clinic.x, FACILITIES.clinic.z, 4.0, 4.0, 1.3, 0.5);

  // taro terraces: basin (sunken water / crop) vs stone bund path
  let terrace = 0;
  let bund = 0;
  for (const f of TARO_FIELDS) {
    const t = taroAt(f, x, z);
    if (!t) continue;
    h = lerp(h, t.h, t.w);
    terrace = Math.max(terrace, t.inCell * t.w);
    bund = Math.max(bund, t.w * (1 - t.inCell));
  }

  return { h, land, cliff: nat.cliff, road: 0, terrace, bund, village, pit, runway, path: 0 };
}

// 0.1.5: flatten the 環島公路 bed to an along-path moving average and blend the shoulders,
// so walking is less bumpy without cliffs, water ingress, or floating buildings.
const ROAD_WIN = 14;
const ROAD_BED = 1.35;
const ROAD_SHOULDER = 3.6;
/** blend width (m) where two road lines meet */
const ROAD_JOIN = 3.0;
/** steepest climb on the 中橫公路 (rise per metre) */
const ROAD_GRADE = 0.2;

type RoadProf = { pts: { x: number; z: number; s: number; h: number }[]; closed: boolean; len: number };
let ROAD_PROF: RoadProf[] | null = null;

function bankedShaped(x: number, z: number): number {
  const r = shaped(x, z);
  let h = r.h;
  if (r.pit === 0 && h < ROAD_BANK_H && h > -3) h = ROAD_BANK_H;
  return Math.max(0.6, h);
}

function ensureRoadProfile(): void {
  if (ROAD_PROF) return;
  const DS = 0.4;
  const out: RoadProf[] = [];
  for (const pl of ROADS) {
    const pts: { x: number; z: number; s: number; h: number }[] = [];
    let s = 0;
    for (let i = 0; i < pl.length - 1; i++) {
      const ax = pl[i][0], az = pl[i][1], bx = pl[i + 1][0], bz = pl[i + 1][1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 1e-6) continue;
      const n = Math.max(1, Math.ceil(L / DS));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        pts.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, s, h: 0 });
        s += L / n;
      }
    }
    const last = pl[pl.length - 1];
    const first = pl[0];
    const closed = Math.hypot(last[0] - first[0], last[1] - first[1]) < 0.45;
    if (!closed) pts.push({ x: last[0], z: last[1], s, h: 0 });
    const len = closed ? s : (pts[pts.length - 1]?.s ?? 0);
    const hs = pts.map((pt) => bankedShaped(pt.x, pt.z));
    for (let i = 0; i < pts.length; i++) {
      let wsum = 0, hsum = 0;
      for (let j = 0; j < pts.length; j++) {
        let ds = Math.abs(pts[j].s - pts[i].s);
        if (closed && len > 0) ds = Math.min(ds, len - ds);
        if (ds > ROAD_WIN) continue;
        const w = 1 - ds / ROAD_WIN;
        wsum += w;
        hsum += w * hs[j];
      }
      pts[i].h = wsum > 0 ? hsum / wsum : hs[i];
    }
    // 0.1.5: the 中橫公路 climbs at most ROAD_GRADE (a cutting through the crest instead of a steep pitch)
    if (pl === CROSS_ROAD) {
      // both ends sit on the ring road: start from its (already smoothed) bed there
      const ring = out[0];
      const ringH = (x: number, z: number): number => {
        let bd = Infinity, bh = pts[0].h;
        for (const q of ring.pts) { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < bd) { bd = d; bh = q.h; } }
        return bh;
      };
      pts[0].h = ringH(pts[0].x, pts[0].z);
      pts[pts.length - 1].h = ringH(pts[pts.length - 1].x, pts[pts.length - 1].z);
      for (let i = 1; i < pts.length; i++) pts[i].h = Math.min(pts[i].h, pts[i - 1].h + ROAD_GRADE * (pts[i].s - pts[i - 1].s));
      for (let i = pts.length - 2; i >= 0; i--) pts[i].h = Math.min(pts[i].h, pts[i + 1].h + ROAD_GRADE * (pts[i + 1].s - pts[i].s));
      // round the crests / dips (vertical curves) without moving the two ends
      const h0 = pts.map((q) => q.h);
      const W = 9;
      for (let i = 1; i < pts.length - 1; i++) {
        const half = Math.min(W, pts[i].s, len - pts[i].s);
        let ws = 0, hs2 = 0;
        for (let j = 0; j < pts.length; j++) {
          const ds = Math.abs(pts[j].s - pts[i].s);
          if (ds > half) continue;
          const w = 1 - ds / (half + 1e-6);
          ws += w; hs2 += w * h0[j];
        }
        if (ws > 0) pts[i].h = Math.min(h0[i] + 0.05, hs2 / ws);
      }
    }
    out.push({ pts, closed, len });
  }
  ROAD_PROF = out;
}

function roadTarget(x: number, z: number): { d: number; H: number } {
  const d = distToRing(x, z);
  if (d > 5.5 && (d > CROSS_BANK || distToCross(x, z) > CROSS_BANK)) return { d, H: ROAD_BANK_H };
  ensureRoadProfile();
  // nearest point on each road line; where a side road meets the ring the lines are blended by distance,
  // so their smoothed beds join without a step
  const near: { d: number; H: number }[] = [];
  for (const pr of ROAD_PROF!) {
    const pts = pr.pts;
    const n = pts.length;
    let best = 1e18, H = ROAD_BANK_H;
    for (let i = 0; i < n; i++) {
      const pt = pts[i];
      const dd = (pt.x - x) * (pt.x - x) + (pt.z - z) * (pt.z - z);
      if (dd >= best) continue;
      best = dd;
      const q = pts[i + 1 < n ? i + 1 : (pr.closed ? 0 : i)];
      const vx = q.x - pt.x, vz = q.z - pt.z;
      const L2 = vx * vx + vz * vz;
      const u = L2 > 0 ? Math.max(0, Math.min(1, ((x - pt.x) * vx + (z - pt.z) * vz) / L2)) : 0;
      H = pt.h + (q.h - pt.h) * u;
    }
    if (n) near.push({ d: Math.sqrt(best), H });
  }
  if (!near.length) return { d, H: ROAD_BANK_H };
  const dMin = Math.min(...near.map((c) => c.d));
  let ws = 0, hs = 0;
  for (const c of near) {
    const w = Math.max(0, 1 - (c.d - dMin) / ROAD_JOIN);
    ws += w * w;
    hs += w * w * c.H;
  }
  return { d, H: hs / ws };
}

const CROSS_BANK = 10;
function distToCross(x: number, z: number): number {
  if (x < CROSS_BOX.x0 || x > CROSS_BOX.x1 || z < CROSS_BOX.z0 || z > CROSS_BOX.z1) return Infinity;
  let best = Infinity;
  for (let i = 0; i < CROSS_ROAD.length - 1; i++) {
    const [ax, az] = CROSS_ROAD[i], [bx, bz] = CROSS_ROAD[i + 1];
    if (Math.min(ax, bx) - CROSS_BANK > x || Math.max(ax, bx) + CROSS_BANK < x || Math.min(az, bz) - CROSS_BANK > z || Math.max(az, bz) + CROSS_BANK < z) continue;
    best = Math.min(best, segDist(x, z, ax, az, bx, bz).d);
  }
  return best;
}

function applyRoad(r: Raw, x: number, z: number): void {
  const { d, H } = roadTarget(x, z);
  if (d > CROSS_BANK) return;
  const pit = r.pit;
  if (d < 5.0 && pit === 0 && r.h < ROAD_BANK_H && r.h > -3) {
    const k = 1 - smoothstep(1.5, 5.0, d);
    r.h = lerp(r.h, ROAD_BANK_H, k * k * (3 - 2 * k));
    r.land = Math.max(r.land, 1 - smoothstep(1.9, 2.4, d));
  }
  if (d < ROAD_SHOULDER && pit < 0.85) {
    const bed = 1 - smoothstep(0.85, ROAD_BED, d);
    const sh = 1 - smoothstep(ROAD_BED, ROAD_SHOULDER, d);
    const w = (bed * 0.97 + (sh - bed) * 0.5) * (1 - pit);
    r.h = lerp(r.h, Math.max(0.6, H), w);
  }
  // 0.1.5: the 中橫公路 cuts through hillsides: lay its uphill bank back over CROSS_BANK m (a slope, not a wall)
  if (d < CROSS_BANK && r.h > H + 0.3 && r.village < 0.05 && pit === 0) {
    const dc = distToCross(x, z);
    if (dc < CROSS_BANK) {
      const pd = padAt(x, z);
      const k = (1 - smoothstep(ROAD_SHOULDER - 1.2, CROSS_BANK, dc)) * (1 - pd.k);
      r.h = lerp(r.h, Math.max(H, lerp(H, r.h, 0.3)), k);
    }
  }
  if (r.land > 0.5 && r.h > 0.35) r.road = smoothstep(1.25, 0.55, d) * (1 - pit);
  else r.road = 0;
  if (d < 2.4 && pit === 0) r.land = Math.max(r.land, 1 - smoothstep(1.9, 2.4, d));
}



/**
 * 0.1.5: the 氣象站 yard: a level strip from the 中橫公路 to the station (it stood on the bank above the road cut).
 * Capsule from the nearest road point to the station, at the road's bed height.
 */
type Yard = { ax: number; az: number; bx: number; bz: number; ha: number; hb: number; r: number };
let YARDS: Yard[] | null = null;
function yards(): Yard[] {
  if (YARDS) return YARDS;
  const out: Yard[] = [];
  for (const l of LANDMARKS) {
    if (!l.at || l.build !== 'station') continue;
    const rp = nearestRoadPoint(l.at.x, l.at.z);
    const H = roadTarget(rp.x, rp.z).H;
    // extend a little past the station so its whole footprint is level
    const dx = l.at.x - rp.x, dz = l.at.z - rp.z, L = Math.hypot(dx, dz) || 1;
    out.push({ ax: rp.x, az: rp.z, bx: l.at.x + (dx / L) * 1.2, bz: l.at.z + (dz / L) * 1.2, ha: H, hb: H + 0.15, r: 2.4 });
  }
  YARDS = out;
  return out;
}
const YARD_EASE = 2.2;
function applyYards(r: Raw, x: number, z: number): void {
  for (const y of yards()) {
    if (x < Math.min(y.ax, y.bx) - y.r - YARD_EASE || x > Math.max(y.ax, y.bx) + y.r + YARD_EASE) continue;
    if (z < Math.min(y.az, y.bz) - y.r - YARD_EASE || z > Math.max(y.az, y.bz) + y.r + YARD_EASE) continue;
    const { d, t } = segDist(x, z, y.ax, y.az, y.bx, y.bz);
    const e = d - y.r;
    if (e >= YARD_EASE) continue;
    // level with the road beside it (following its grade), and the road bed itself left alone
    const rt = roadTarget(x, z);
    const k = (e <= 0 ? 1 : 1 - smoothstep(0, YARD_EASE, e)) * smoothstep(1.0, 2.6, rt.d);
    if (k <= 0) continue;
    r.h = lerp(r.h, rt.H + 0.15 * t, k);
  }
}

// ---------------------------------------------------------------------------
// 0.1.5: footpaths (小徑) from every building door to the road network
// ---------------------------------------------------------------------------

/** nearest point on the road centre lines */
export function nearestRoadPoint(x: number, z: number): { x: number; z: number } {
  let best = Infinity, bx = x, bz = z;
  for (const [ax, az, cx, cz] of ROAD_SEGS) {
    const vx = cx - ax, vz = cz - az;
    const L2 = vx * vx + vz * vz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)) : 0;
    const px = ax + vx * t, pz = az + vz * t;
    const d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < best) { best = d; bx = px; bz = pz; }
  }
  return { x: bx, z: bz };
}

/** every building / facility a footpath leads to (id = kind:village:x,z like the flora audit) */
export function pathTargets(): PathTarget[] {
  const out: PathTarget[] = [];
  for (const st of ALL_STRUCTURES) {
    const f = FOOTPRINT[st.kind];
    const box: Box2 = { x: st.x, z: st.z, yaw: st.yaw, hw: f.hw, hd: f.hd };
    // front door (local +Z faces the road / sea); 涼亭 are open all round, so the side nearest the road
    const door = st.kind === 'tagakal' ? undefined : { x: st.x + Math.sin(st.yaw) * (f.hd + 0.45), z: st.z + Math.cos(st.yaw) * (f.hd + 0.45) };
    out.push({ id: `${st.kind}:${st.village ?? '-'}:${st.x.toFixed(1)},${st.z.toFixed(1)}`, box, door });
  }
  const cl = FACILITIES.clinic;
  out.push({ id: 'clinic', box: { x: cl.x, z: cl.z, yaw: cl.yaw, ...CLINIC_FOOT }, door: { x: cl.x + Math.sin(cl.yaw) * (CLINIC_FOOT.hd + 0.45), z: cl.z + Math.cos(cl.yaw) * (CLINIC_FOOT.hd + 0.45) } });
  const fb = facilityBoxes();
  out.push({ id: 'terminal', box: fb[1] });
  for (const l of LANDMARKS) {
    if (!l.at) continue;
    if (l.build === 'station') out.push({ id: `station:${l.id}`, box: { x: l.at.x, z: l.at.z, yaw: 0, hw: 1.5, hd: 1.2 } });
    if (l.build === 'lighthouse') out.push({ id: `lighthouse:${l.id}`, box: { x: l.at.x, z: l.at.z, yaw: 0, hw: 1.3, hd: 1.3 } });
  }
  return out;
}

/** solid boxes the paths keep clear of (buildings, clinic, terminal, plane, yacht, built landmarks) */
export function pathSolidBoxes(): Box2[] {
  const boxes: Box2[] = ALL_STRUCTURES.map((st) => ({ x: st.x, z: st.z, yaw: st.yaw, ...FOOTPRINT[st.kind] }));
  boxes.push(...facilityBoxes());
  for (const l of LANDMARKS) {
    if (l.at && l.build === 'station') boxes.push({ x: l.at.x, z: l.at.z, yaw: 0, hw: 1.5, hd: 1.2 });
    if (l.at && l.build === 'lighthouse') boxes.push({ x: l.at.x, z: l.at.z, yaw: 0, hw: 1.3, hd: 1.3 });
  }
  return boxes;
}

/** ground a footpath must not cross: sea, taro basins (and their bunds), crater lakes, shore rocks */
export function pathBlocked(x: number, z: number): boolean {
  const n = naturalRaw(x, z);
  if (n.s < 0.03 && Math.hypot(x - HARBOUR_QUAY.x, z - HARBOUR_QUAY.z) > 6) return true;
  for (const f of TARO_FIELDS) {
    const { u, v } = fieldLocal(f, x, z);
    if (Math.abs(u) < (f.tiers * f.cellU) / 2 + 0.35 && Math.abs(v) < (f.cols * f.cellV) / 2 + 0.95) return true;
  }
  for (const lk of LAKES) if (Math.hypot(x - lk.x, z - lk.z) < lk.r + 1.0) return true;
  for (const l of LANDMARKS) if (l.rock && Math.hypot(x - l.rock.x, z - l.rock.z) < Math.min(1.6, l.rock.len * 0.32 + 0.4) + 0.6) return true;
  return false;
}

let FOOT: { paths: Footpath[]; failed: string[] } | null = null;
/** the planned footpaths (door → road / another path) */
export function footpaths(): { paths: Footpath[]; failed: string[] } {
  if (!FOOT) FOOT = planFootpaths(pathTargets(), { boxes: pathSolidBoxes(), blocked: pathBlocked, roadDist: distToRing, roadPoint: nearestRoadPoint });
  return FOOT;
}

/** path profile: segments (a → b) with the eased ground height at both ends, bucketed on a 3 m hash */
type PathSeg = { ax: number; az: number; bx: number; bz: number; ha: number; hb: number };
let PATH_HASH: Map<number, PathSeg[]> | null = null;
const PH = 3;
const phKey = (i: number, j: number): number => (i + 500) * 1000 + (j + 500);
function pathHash(): Map<number, PathSeg[]> {
  if (PATH_HASH) return PATH_HASH;
  const map = new Map<number, PathSeg[]>();
  const base = (x: number, z: number): number => {
    const r = shaped(x, z);
    applyRoad(r, x, z);
    applyYards(r, x, z);
    applyLakes(r, x, z);
    return r.h;
  };
  for (const p of footpaths().paths) {
    const pts = p.pts;
    if (pts.length < 2) continue;
    const s: number[] = [0];
    for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    const hs = pts.map((q) => base(q.x, q.z));
    const W = 2.2;
    const sm = hs.map((_, i) => {
      let ws = 0, hsum = 0;
      for (let j = 0; j < pts.length; j++) {
        const d = Math.abs(s[j] - s[i]);
        if (d > W) continue;
        const w = 1 - d / W;
        ws += w; hsum += w * hs[j];
      }
      return hsum / ws;
    });
    // ends meet the door terrace and the road (or the joined path) exactly
    const L = s[s.length - 1];
    const d0 = hs[0] - sm[0], d1 = hs[hs.length - 1] - sm[sm.length - 1];
    const E = Math.min(1.6, L / 2);
    for (let i = 0; i < pts.length; i++) {
      sm[i] += d0 * Math.max(0, 1 - s[i] / E) + d1 * Math.max(0, 1 - (L - s[i]) / E);
    }
    // gentle ramps: relax any step steeper than PATH_GRADE (cut the high side, fill the low side; ends stay put)
    for (let it = 0; it < 60; it++) {
      let moved = false;
      for (let i = 1; i < pts.length; i++) {
        const ds = Math.max(0.05, s[i] - s[i - 1]);
        const ex = Math.abs(sm[i] - sm[i - 1]) - PATH_GRADE * ds;
        if (ex <= 1e-3) continue;
        moved = true;
        const dir = Math.sign(sm[i] - sm[i - 1]);
        const a0 = i - 1 === 0 ? 0 : 0.5, a1 = i === pts.length - 1 ? 0 : 0.5;
        const tot = a0 + a1 || 1;
        sm[i - 1] += (dir * ex * a0) / tot;
        sm[i] -= (dir * ex * a1) / tot;
      }
      if (!moved) break;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const sg = { ax: pts[i].x, az: pts[i].z, bx: pts[i + 1].x, bz: pts[i + 1].z, ha: sm[i], hb: sm[i + 1] };
      const i0 = Math.floor((Math.min(sg.ax, sg.bx) - 1.6) / PH), i1 = Math.floor((Math.max(sg.ax, sg.bx) + 1.6) / PH);
      const j0 = Math.floor((Math.min(sg.az, sg.bz) - 1.6) / PH), j1 = Math.floor((Math.max(sg.az, sg.bz) + 1.6) / PH);
      for (let a = i0; a <= i1; a++) for (let b = j0; b <= j1; b++) {
        const k = phKey(a, b);
        let arr = map.get(k);
        if (!arr) map.set(k, (arr = []));
        arr.push(sg);
      }
    }
  }
  PATH_HASH = map;
  return map;
}

/** distance to the nearest footpath centre line and its eased height there (d = Infinity when none near) */
export function pathTarget(x: number, z: number): { d: number; H: number } {
  const arr = pathHash().get(phKey(Math.floor(x / PH), Math.floor(z / PH)));
  if (!arr) return { d: Infinity, H: 0 };
  let best = Infinity, H = 0;
  for (const g of arr) {
    const vx = g.bx - g.ax, vz = g.bz - g.az;
    const L2 = vx * vx + vz * vz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - g.ax) * vx + (z - g.az) * vz) / L2)) : 0;
    const d = Math.hypot(g.ax + vx * t - x, g.az + vz * t - z);
    if (d < best) { best = d; H = g.ha + (g.hb - g.ha) * t; }
  }
  return { d: best, H };
}

/** distance to the nearest footpath centre line */
export function distToPath(x: number, z: number): number {
  return pathTarget(x, z).d;
}

const PATH_EASE = 1.35;
/** steepest footpath ramp (rise per metre) */
const PATH_GRADE = 0.42;
function applyPath(r: Raw, x: number, z: number): void {
  const { d, H } = pathTarget(x, z);
  if (d >= PATH_EASE) return;
  const k = 1 - smoothstep(PATH_HALF - 0.1, PATH_EASE, d);
  const notRoad = 1 - r.road;
  if (r.pit < 0.3) r.h = lerp(r.h, H, k * (3 - 2 * k) * k * (1 - r.pit) * (0.15 + 0.85 * notRoad));
  r.path = smoothstep(PATH_HALF + 0.06, PATH_HALF - 0.22, d) * notRoad * (1 - r.pit);
}

/** 0.1.4: crater lakes (小天池 / 大天池): a flat bed under the water and a low rim around it */
function applyLakes(r: Raw, x: number, z: number): void {
  for (const lk of LAKES) {
    const d = Math.hypot(x - lk.x, z - lk.z);
    if (d > lk.r + 2.6) continue;
    const surf = lakeSurface(lk);
    const target = d < lk.r ? surf - 0.45 : surf + 0.12;
    const k = 1 - smoothstep(lk.r + 0.2, lk.r + 2.6, d);
    r.h = lerp(r.h, target, k);
  }
}

function raw(x: number, z: number): Raw {
  const r = shaped(x, z);
  applyRoad(r, x, z);
  applyYards(r, x, z);
  applyLakes(r, x, z);
  // 0.1.5: footpaths last, so nothing re-shapes them
  applyPath(r, x, z);
  let h = r.h;
  let land = r.land;
  const pit = r.pit;

  // Jimagaod
  const j = jimagaod(x, z);
  if (j.h > h) {
    h = j.h;
  }
  land = Math.max(land, j.mask);
  if (land > 0.5 && h < 0.06 && pit === 0) h = 0.06;

  r.h = h;
  r.land = land;
  return r;
}

// ---------------------------------------------------------------------------
// baked grid
// ---------------------------------------------------------------------------

/** 0.1.4: the bigger real-outline island (≈ ±58 m) + the 開元港 breakwater (west) + 小蘭嶼 (south-east); ~0.34 m cells */
/** 0.1.5: the 0.1.4 box scaled with the island (小蘭嶼 kept the same gap off the south-east cape); ~0.37 m cells */
export const TERRAIN_BOX = { xMin: Math.floor(-72 * K), zMin: Math.floor(-62 * K), xMax: Math.ceil(66 * K), zMax: Math.ceil(JIMAGAOD.z + 10) };
export const GRID_NX = Math.round((TERRAIN_BOX.xMax - TERRAIN_BOX.xMin) / 0.37) + 1;
export const GRID_NZ = Math.round((TERRAIN_BOX.zMax - TERRAIN_BOX.zMin) / 0.37) + 1;
const CX = (TERRAIN_BOX.xMax - TERRAIN_BOX.xMin) / (GRID_NX - 1);
const CZ = (TERRAIN_BOX.zMax - TERRAIN_BOX.zMin) / (GRID_NZ - 1);

export interface Grid {
  h: Float32Array;
  land: Float32Array;
  cliff: Float32Array;
  road: Float32Array;
  terrace: Float32Array;
  /** 0.1.5: footpaths */
  path: Float32Array;
  bund: Float32Array;
  village: Float32Array;
  pit: Float32Array;
  runway: Float32Array;
  slope: Float32Array;
  curv: Float32Array;
  forest: Float32Array;
}

let GRID: Grid | null = null;

function allocGrid(): Grid {
  const n = GRID_NX * GRID_NZ;
  return {
    h: new Float32Array(n),
    land: new Float32Array(n),
    cliff: new Float32Array(n),
    road: new Float32Array(n),
    terrace: new Float32Array(n),
    path: new Float32Array(n),
    bund: new Float32Array(n),
    village: new Float32Array(n),
    pit: new Float32Array(n),
    runway: new Float32Array(n),
    slope: new Float32Array(n),
    curv: new Float32Array(n),
    forest: new Float32Array(n),
  };
}

function fillRawRows(g: Grid, j0: number, j1: number): void {
  for (let j = j0; j < j1; j++) {
    const z = TERRAIN_BOX.zMin + j * CZ;
    for (let i = 0; i < GRID_NX; i++) {
      const x = TERRAIN_BOX.xMin + i * CX;
      const r = raw(x, z);
      const k = j * GRID_NX + i;
      g.h[k] = r.h;
      g.land[k] = r.land;
      g.cliff[k] = r.cliff;
      g.road[k] = r.road;
      g.terrace[k] = r.terrace;
      g.path[k] = r.path;
      g.bund[k] = r.bund;
      g.village[k] = r.village;
      g.pit[k] = r.pit;
      g.runway[k] = r.runway;
    }
  }
}

function fillSlope(g: Grid): void {
  // slope + curvature (concavity => gullies / AO; convexity => ridge highlights)
  for (let j = 0; j < GRID_NZ; j++) {
    for (let i = 0; i < GRID_NX; i++) {
      const k = j * GRID_NX + i;
      const iL = Math.max(0, i - 1);
      const iR = Math.min(GRID_NX - 1, i + 1);
      const jU = Math.max(0, j - 1);
      const jD = Math.min(GRID_NZ - 1, j + 1);
      const hl = g.h[j * GRID_NX + iL];
      const hr = g.h[j * GRID_NX + iR];
      const hu = g.h[jU * GRID_NX + i];
      const hd = g.h[jD * GRID_NX + i];
      const gx = (hr - hl) / ((iR - iL) * CX);
      const gz = (hd - hu) / ((jD - jU) * CZ);
      g.slope[k] = Math.hypot(gx, gz);
      g.curv[k] = (hl + hr + hu + hd) * 0.25 - g.h[k];
    }
  }
}

function fillForestRows(g: Grid, j0: number, j1: number): void {
  // forest density: mid-slope, not on roads / villages / terraces / bare cliffs
  for (let j = j0; j < j1; j++) {
    const z = TERRAIN_BOX.zMin + j * CZ;
    for (let i = 0; i < GRID_NX; i++) {
      const x = TERRAIN_BOX.xMin + i * CX;
      const k = j * GRID_NX + i;
      const h = g.h[k];
      if (g.land[k] < 0.9 || h < 1.6) continue;
      const n = fbm(x * 0.075 + 40, z * 0.075 - 12, 4);
      const n2 = noise(x * 0.3 + 7, z * 0.3 - 2);
      // forests gather in gullies & sheltered mid-slopes; convex ridgelines stay open grass/rock
      let f = smoothstep(0.5, 0.66, n * 0.85 + g.curv[k] * 5.5 + smoothstep(3, 9, h) * 0.18 - smoothstep(16, 21, h) * 0.3 + n2 * 0.12);
      f *= 1 - smoothstep(0.02, 0.12, -g.curv[k]) * 0.8;
      f *= 1 - smoothstep(2.0, 3.0, g.slope[k]);
      f *= 1 - g.village[k];
      f *= 1 - g.road[k];
      f *= 1 - g.path[k];
      f *= 1 - g.runway[k];
      f *= 1 - smoothstep(0.0, 0.3, g.terrace[k]);
      // 青青草原 grassland headland stays open
      f *= 1 - gauss(x, z, QQ.x, QQ.z, 7 * K, 5 * K); // 青青草原 stays open grass
      // keep taro field surroundings and coastal belt open
      for (const tfld of TARO_FIELDS) f *= 1 - gauss(x, z, tfld.cx, tfld.cz, 6, 6) * 0.9;
      g.forest[k] = clamp01(f);
    }
  }
}

function finishGrid(g: Grid): Grid {
  GRID = g;
  return g;
}

export function grid(): Grid {
  if (GRID) return GRID;
  const g = allocGrid();
  fillRawRows(g, 0, GRID_NZ);
  fillSlope(g);
  fillForestRows(g, 0, GRID_NZ);
  return finishGrid(g);
}

/** Same bake as grid(), but yields so iOS Safari can paint the boot screen and not kill a long script. */
export async function gridAsync(onProgress?: (p: number) => void): Promise<Grid> {
  if (GRID) return GRID;
  const g = allocGrid();
  const rawStep = 4;
  for (let j = 0; j < GRID_NZ; j += rawStep) {
    fillRawRows(g, j, Math.min(GRID_NZ, j + rawStep));
    onProgress?.(0.82 * Math.min(1, (j + rawStep) / GRID_NZ));
    await yieldIfBusy();
  }
  fillSlope(g);
  onProgress?.(0.86);
  await yieldToUi();
  const forestStep = 10;
  for (let j = 0; j < GRID_NZ; j += forestStep) {
    fillForestRows(g, j, Math.min(GRID_NZ, j + forestStep));
    onProgress?.(0.86 + 0.14 * Math.min(1, (j + forestStep) / GRID_NZ));
    await yieldIfBusy();
  }
  return finishGrid(g);
}

function bilerp(arr: Float32Array, x: number, z: number, outside: number): number {
  const fx = (x - TERRAIN_BOX.xMin) / CX;
  const fz = (z - TERRAIN_BOX.zMin) / CZ;
  if (fx < 0 || fz < 0 || fx > GRID_NX - 1 || fz > GRID_NZ - 1) return outside;
  const i = Math.min(GRID_NX - 2, Math.floor(fx));
  const j = Math.min(GRID_NZ - 2, Math.floor(fz));
  const tx = fx - i;
  const tz = fz - j;
  const k = j * GRID_NX + i;
  const a = arr[k];
  const b = arr[k + 1];
  const c = arr[k + GRID_NX];
  const d = arr[k + GRID_NX + 1];
  // match the terrain mesh triangulation exactly: island.ts splits each cell along the b–c diagonal
  // (triangles a,c,b and b,c,d), so interpolate inside the matching triangle instead of plain bilinear.
  if (tx + tz < 1) return a + (b - a) * tx + (c - a) * tz;
  return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
}

export function getHeight(x: number, z: number): number {
  return bilerp(grid().h, x, z, -7.5);
}

export function sample(x: number, z: number): Sample {
  const g = grid();
  const h = bilerp(g.h, x, z, -7.5);
  const land = bilerp(g.land, x, z, 0);
  const cliff = bilerp(g.cliff, x, z, 0);
  const road = bilerp(g.road, x, z, 0);
  const terrace = bilerp(g.terrace, x, z, 0);
  const path = bilerp(g.path, x, z, 0);
  const bund = bilerp(g.bund, x, z, 0);
  const village = bilerp(g.village, x, z, 0);
  const slope = bilerp(g.slope, x, z, 0);
  const forest = bilerp(g.forest, x, z, 0);
  const rock = clamp01(smoothstep(1.35, 2.2, slope) * (1 - forest) + cliff * smoothstep(0.6, 1.3, slope) * 0.5) * land;
  const beach = land * (1 - cliff) * smoothstep(1.4, 0.45, h) * (1 - village * 0.5);
  const sand = Math.max(beach, (1 - land) * smoothstep(-1.2, -0.1, h));
  const grass = Math.max(0, land - sand - rock * 0.8 - terrace * 0.8 - road * 0.8);
  return {
    height: h,
    mask: land,
    beach,
    road,
    terrace,
    path,
    sand,
    rock,
    grass,
    seabed: h < 0 ? 1 : 0,
    cliff,
    village,
    forest,
    slope,
    bund,
  };
}

/** Light sampler for hot bakes that only need height + land mask (land field). */
export function sampleHM(x: number, z: number): { height: number; mask: number } {
  const g = grid();
  return { height: bilerp(g.h, x, z, -7.5), mask: bilerp(g.land, x, z, 0) };
}

export function getSlope(x: number, z: number): number {
  return bilerp(grid().slope, x, z, 0);
}

export const WATER_LEVEL = 0;
export const WALK_WATER_MARGIN = 0.16;
export const WALK_MAX_HEIGHT = 12.5;
export const WALK_MAX_SLOPE = 2.6;

/** Sunken 水芋田 basin (not the surrounding stone bund). */
export function inTaroBasin(x: number, z: number): boolean {
  return bilerp(grid().terrace, x, z, 0) > 0.42;
}

