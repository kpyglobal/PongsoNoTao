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
  VILLAGE_DEFS,
  TARO_FIELDS,
  villageStructures,
  villageExtent,
  fieldLocal,
  tierShift,
  type Structure,
  type TaroField,
} from './layout';
import { yieldIfBusy, yieldToUi } from '../core/frame';
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

/** Coastal field: < 1 is land. */
function coastField(x: number, z: number): number {
  const widen = 1 - 0.14 * Math.max(0, (z - 4) / 42);
  const rx = 33 / widen;
  const rz = 45;
  let d = Math.hypot(x / rx, (z - 2) / rz);
  d += (fbm(x * 0.05, z * 0.05) - 0.5) * 0.1;
  d += (fbm(x * 0.13, z * 0.13) - 0.5) * 0.045;
  d += (fbm(x * 0.32, z * 0.32, 3) - 0.5) * 0.018;
  // Bays: Dongqing (NE), Yayo/Kaiyuan (W), Badai (S), east coves, Iraraley (N)
  d += gauss(x, z, 32, -18, 9, 7) * 0.28;
  d += gauss(x, z, -38, -7, 8, 6) * 0.26;
  d += gauss(x, z, 2, 42, 9, 6) * 0.2;
  d += gauss(x, z, 34, 12, 6, 5) * 0.14;
  d += gauss(x, z, -4, -46, 7, 4) * 0.08;
  d += gauss(x, z, -24, 30, 6, 5) * 0.08;
  // headlands that stick out: NW nose, 青青草原 SW cape, east capes, north cape
  d -= gauss(x, z, -16, -30, 8, 6) * 0.06;
  d -= gauss(x, z, -32, 30, 6, 4) * 0.07;
  d -= gauss(x, z, 33, -4, 4, 5) * 0.07;
  d -= gauss(x, z, 20, -36, 5, 4) * 0.05;
  d -= gauss(x, z, 22, 30, 5, 4) * 0.05;
  return d;
}

interface RidgeNode { x: number; z: number; h: number }
interface Ridge { nodes: RidgeNode[]; w: number; sharp: number }

const RIDGES: Ridge[] = [
  // 紅頭山 Hongtoushan massif (highest, south-centre)
  { nodes: [{ x: -15, z: 25, h: 4.1 }, { x: -6, z: 20, h: 9.02 }, { x: 3, z: 13, h: 14.5 }, { x: 10, z: 6, h: 10.66 }, { x: 17, z: -1, h: 7.38 }], w: 20.8, sharp: 1.05 },
  // 大森山 Dasenshan — north-central ridge
  { nodes: [{ x: -14, z: -31, h: 4.1 }, { x: -8, z: -21, h: 9.84 }, { x: -3, z: -12, h: 11.07 }, { x: 4, z: -4, h: 9.02 }, { x: 10, z: 6, h: 9.84 }], w: 19.5, sharp: 1.05 },
  // east coast ridge (steep basalt cliffs toward the Pacific)
  { nodes: [{ x: 19, z: -27, h: 3.28 }, { x: 19, z: -12, h: 7.38 }, { x: 22, z: 0, h: 6.56 }, { x: 19, z: 15, h: 4.92 }, { x: 15, z: 22, h: 3.28 }], w: 11.7, sharp: 1.0 },
  // west spur toward Yayo
  { nodes: [{ x: -24, z: -15, h: 2.87 }, { x: -14, z: -10, h: 5.74 }, { x: -3, z: -12, h: 10.25 }], w: 11.7, sharp: 1.0 },
  // south spur down to Imorod
  { nodes: [{ x: 3, z: 13, h: 12.3 }, { x: 6, z: 21, h: 6.56 }, { x: 8, z: 26, h: 2.46 }], w: 10.4, sharp: 1.0 },
  // SW spur to 青青草原 headland
  { nodes: [{ x: -6, z: 20, h: 9.02 }, { x: -19, z: 27, h: 3.69 }, { x: -30, z: 30, h: 2.62 }], w: 11.1, sharp: 1.0 },
  // NE spur to Iraraley / Dongqing
  { nodes: [{ x: -3, z: -12, h: 10.25 }, { x: 8, z: -24, h: 5.33 }, { x: 14, z: -33, h: 2.46 }], w: 11.7, sharp: 1.0 },
];

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
function cliffiness(x: number, z: number): number {
  let c = noise(x * 0.07 + 5, z * 0.07 - 3) * 1.25 - 0.32;
  c += smoothstep(14, 26, x) * 0.55; // Pacific-facing east coast
  c += smoothstep(-30, -42, z) * 0.3; // north cape
  c += gauss(x, z, -32, 30, 7, 5) * 0.9; // 青青草原 sea cliffs
  c += gauss(x, z, -16, -30, 8, 6) * 0.6; // 雙獅岩 headland
  c += gauss(x, z, 33, -4, 5, 6) * 0.6;
  c += gauss(x, z, 21, 30, 6, 5) * 0.6;
  // calm, sandy settlement bays
  for (const v of VILLAGE_DEFS) c -= gauss(x, z, v.cx + v.fx * 6, v.cz + v.fz * 6, 9, 9) * 1.4;
  c -= gauss(x, z, -38, -7, 6, 5) * 1.5; // Kaiyuan harbour
  c -= gauss(x, z, -26, 21, 7, 5) * 0.8; // airport shore
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
  return p;
}

/** natural terrain before any human shaping. */
function naturalRaw(x: number, z: number): { h: number; s: number; cliff: number } {
  const d = coastField(x, z);
  const s = 1 - d; // > 0 inland
  const cliff = cliffiness(x, z);

  // domain warp for organic ridges
  const wx = x + (fbm(x * 0.045 + 3.1, z * 0.045) - 0.5) * 9;
  const wz = z + (fbm(x * 0.045, z * 0.045 + 7.7) - 0.5) * 9;
  const R = ridgeField(wx, wz);
  const rn = ridged(wx * 0.085, wz * 0.085, 5);
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
    const zone = smoothstep(2, 4, h) * (1 - smoothstep(10, 14, h));
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
    h = lerp(h, lerp(0.05, h, smoothstep(0, 0.025, -s)), 1 - cliff);
  }
  return { h, s, cliff };
}

/** Little Lanyu — Jimagaod. */
function jimagaod(x: number, z: number): { h: number; mask: number } {
  const lx = 8;
  const lz = 66;
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

/** Ring-road polyline through the six tribes + harbour (clockwise). */
const RING: [number, number][] = [
  [-36.5, -6.5], [-29.5, -9], [-22, -20], [-12, -32], [-2, -41.5], [10, -37], [20, -27],
  [27.5, -23], [31, -8], [31.5, 6], [27, 16], [19, 25], [7, 36], [-6, 32.5],
  [-14, 26.5], [-23.5, 26], [-25, 17.5], [-25.6, 4], [-27, -3], [-29.5, -9],
];

export function distToRing(x: number, z: number): number {
  let best = 1e9;
  for (let i = 0; i < RING.length - 1; i++) {
    const [ax, az] = RING[i];
    const [bx, bz] = RING[i + 1];
    best = Math.min(best, segDist(x, z, ax, az, bx, bz).d);
  }
  return best;
}

export const ALL_STRUCTURES: Structure[] = VILLAGE_DEFS.flatMap((v) => villageStructures(v));

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
}

function raw(x: number, z: number): Raw {
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
    const rw = flattenRect(h, x, z, R.x, R.z, R.hx + 2.4, R.hz + 2.4, 1.05, 0.72);
    runway = smoothstep(1, 0.8, Math.max(Math.abs(x - R.x) / (R.hx + 0.2), Math.abs(z - R.z) / (R.hz + 0.2)));
    h = rw;
    // terminal apron
    h = flattenRect(h, x, z, FACILITIES.terminal.x, FACILITIES.terminal.z, 2.6, 5.5, 1.1, 0.5);
  }
  if (nat.s > -0.02) h = flattenRect(h, x, z, -33.5, -6.2, 6.5, 3.4, 0.75);
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

  // ring road: gentle cut, packed concrete
  const rd = distToRing(x, z);
  let road = 0;
  if (land > 0.5 && h > 0.35) {
    road = smoothstep(1.25, 0.55, rd) * (1 - pit);
    if (road > 0) h = lerp(h, Math.max(0.6, Math.min(h, h * 0.94)), road * 0.6);
  }

  // Jimagaod
  const j = jimagaod(x, z);
  if (j.h > h) {
    h = j.h;
  }
  land = Math.max(land, j.mask);
  if (land > 0.5 && h < 0.06 && pit === 0) h = 0.06;

  return { h, land, cliff: nat.cliff, road, terrace, bund, village, pit, runway };
}

// ---------------------------------------------------------------------------
// baked grid
// ---------------------------------------------------------------------------

export const TERRAIN_BOX = { xMin: -52, zMin: -56, xMax: 52, zMax: 78 };
export const GRID_NX = 326;
export const GRID_NZ = 420;
const CX = (TERRAIN_BOX.xMax - TERRAIN_BOX.xMin) / (GRID_NX - 1);
const CZ = (TERRAIN_BOX.zMax - TERRAIN_BOX.zMin) / (GRID_NZ - 1);

export interface Grid {
  h: Float32Array;
  land: Float32Array;
  cliff: Float32Array;
  road: Float32Array;
  terrace: Float32Array;
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
      f *= 1 - g.runway[k];
      f *= 1 - smoothstep(0.0, 0.3, g.terrace[k]);
      // 青青草原 grassland headland stays open
      f *= 1 - gauss(x, z, -30, 29, 7, 5);
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

