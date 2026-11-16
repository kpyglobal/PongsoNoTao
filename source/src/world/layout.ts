/**
 * Shared settlement + terrace layout for Pongso no Tao｜蘭嶼文化島.
 * Used by the heightfield (to carve sunken 地下屋 pits, flatten plazas and
 * cut 水芋田 terraces) and by the decor builder (to place the actual props).
 * World axes: +X east, +Z south, sea level = 0.
 */

import { geo, MAP_SCALE as K, MAP_SCALE } from './outline';
import { ARC_CW, COAST_LEN, coastParam, coastPoint, coastSdf, cwDist, insetPoint, smoothNormal } from './coast';
import { oldLocal } from './legacy';
import { setWorldLang, WORLD_EN, type WorldLang } from './names';

export interface Vec2 { x: number; z: number }

export type StructKind = 'vahey' | 'makarang' | 'tagakal' | 'modern' | 'shop' | 'church';

export interface Structure {
  kind: StructKind;
  x: number;
  z: number;
  /** yaw so that local +Z (front door) faces this direction */
  yaw: number;
  /** half extents of the pit (vahey) / footprint */
  hw: number;
  hd: number;
  /** owning village id */
  village?: string;
}

export interface VillageDef {
  id: string;
  cx: number;
  cz: number;
  /** unit vector pointing toward the sea */
  fx: number;
  fz: number;
  plazaH: number;
  rows: number[]; // vahey per row
  extras: StructKind[];
}

/**
 * 0.1.4: the island follows the real 蘭嶼 outline (outline.ts, coast.ts). Inland point near 紅頭山
 * (last-resort unstuck walk, title camera).
 */
export const ISLAND_CENTRE = { x: -10 * K, z: -10 * K };

/** Village grid (local u/w units): house spacing along the row, first row offset inland, row step. */
/** 0.1.5: wider than 0.1.4 (4.1 / 3.7) so each 地下屋 has its own terrace with ~1.7 m of ground between pits */
export const HOUSE_SPACING = 5.4;
export const ROW0_W = 3.6;
export const ROW_STEP = 4.9;
/**
 * The ring road runs through every village along its seafront at local w = ROAD_W (0.1.1):
 * houses / work houses / church / shop / school stay inland of it, the 涼亭 (tagakal) seaward,
 * each with ≥ ROAD_CLEARANCE from the road centreline (scripts/check-roads.mjs enforces it).
 */
export const ROAD_W = -0.2;
export const ROAD_CLEARANCE = 1.6;

/**
 * 0.1.4: villages sit where the real ones are. Each is placed from its real lon / lat: the nearest
 * point on the outline, nudged `shift` metres along the coast (clockwise = +, so neighbours and the
 * airport / clinic fit between them), then `depth` metres inland; the village faces the sea there.
 */
interface CoastVillage { id: string; lon: number; lat: number; shift: number; rows: number[]; extras: StructKind[]; depth?: number; face?: number; plazaH?: number }
export const VILLAGE_DEPTH = 6.5;

function coastFrame(t: number, depth: number): { x: number; z: number; fx: number; fz: number } {
  const c = insetPoint(t, depth);
  let nx = 0;
  let nz = 0;
  for (const dt of [-6, -3, 0, 3, 6]) {
    const q = dt === 0 ? c : insetPoint(t + dt, depth);
    const n = smoothNormal(q.x, q.z, 4);
    nx += n.x;
    nz += n.z;
  }
  const L = Math.hypot(nx, nz) || 1;
  return { x: c.x, z: c.z, fx: nx / L, fz: nz / L };
}

/** arc position (coast.ts) of a real place, shifted clockwise by `shift` metres */
export function coastT(lon: number, lat: number, shift = 0): number {
  const p = geo(lon, lat);
  return coastParam(p.x, p.z) + ARC_CW * shift;
}

function mkCoast(c: CoastVillage): VillageDef {
  const f = coastFrame(coastT(c.lon, c.lat, c.shift * K), c.depth ?? VILLAGE_DEPTH);
  let { fx, fz } = f;
  if (c.face !== undefined) { fx = Math.cos(c.face); fz = Math.sin(c.face); }
  return { id: c.id, cx: f.x, cz: f.z, fx, fz, rows: c.rows, extras: c.extras, plazaH: c.plazaH ?? 1.15 };
}

/** clockwise from 椰油 (the ring road order); lon / lat are the real settlements (OpenStreetMap) */
export const VILLAGE_DEFS: VillageDef[] = [
  // 椰油: on the west-facing shore just south of 開元港 (the harbour sits at its north end)
  mkCoast({ id: 'yayo', lon: 121.5125, lat: 22.048, shift: 18.6, rows: [3, 2], extras: ['church', 'shop', 'modern', 'modern'], face: Math.PI }),
  mkCoast({ id: 'iraraley', lon: 121.52622, lat: 22.0778, shift: 0, rows: [3, 2], extras: ['church', 'modern'] }),
  mkCoast({ id: 'iranmeylek', lon: 121.56458, lat: 22.05782, shift: -29, rows: [3, 2], extras: ['shop', 'modern'] }),
  mkCoast({ id: 'ivalino', lon: 121.56639, lat: 22.03827, shift: -14, rows: [4, 3], extras: [] }),
  // 0.1.5: 紅頭 at the real 紅頭村 (OSM), where the 中橫公路 starts; 漁人 and 紅頭 nudged apart so both fit
  // 0.1.6: a little further apart again (紅頭 −4 → −6, 漁人 19 → 21; old saves: legacy.ts WORLD_REV 4)
  mkCoast({ id: 'imorod', lon: 121.55367, lat: 22.02549, shift: -6, rows: [3, 2], extras: ['church', 'modern'], plazaH: 1.25 }),
  mkCoast({ id: 'iratay', lon: 121.54292, lat: 22.02742, shift: 21, rows: [3, 2], extras: ['church', 'modern'] }),
];

/** local (u = along coast / right, v = toward sea) -> world */
export function vlocal(v: VillageDef, u: number, w: number): Vec2 {
  const rx = -v.fz;
  const rz = v.fx;
  return { x: v.cx + rx * u + v.fx * w, z: v.cz + rz * u + v.fz * w };
}

export function villageYaw(v: VillageDef): number {
  // local +Z of a prop should point toward the sea (fx, fz)
  return Math.atan2(v.fx, v.fz);
}

/** collision footprint half-extents per structure kind (collision.ts uses these too) */
export const FOOTPRINT: Record<StructKind, { hw: number; hd: number }> = {
  vahey: { hw: 1.9, hd: 1.7 },
  makarang: { hw: 1.3, hd: 1.15 },
  tagakal: { hw: 1.25, hd: 1.15 },
  modern: { hw: 1.7, hd: 1.4 },
  shop: { hw: 1.9, hd: 1.6 },
  church: { hw: 1.85, hd: 2.7 },
};

export interface Box2 { x: number; z: number; yaw: number; hw: number; hd: number }

function boxCorners(o: Box2, grow = 0): Vec2[] {
  const c = Math.cos(o.yaw);
  const s = Math.sin(o.yaw);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const lx = a * (o.hw + grow);
    const lz = b * (o.hd + grow);
    return { x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c };
  });
}

/** separating-axis test for two yawed boxes (grow = extra gap on each) */
export function boxesOverlap(a: Box2, b: Box2, grow = 0): boolean {
  if (Math.hypot(a.x - b.x, a.z - b.z) > a.hw + a.hd + b.hw + b.hd + 2 * grow) return false;
  const A = boxCorners(a, grow);
  const B = boxCorners(b, grow);
  for (const P of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const p = P[i];
      const q = P[(i + 1) % 4];
      const nx = -(q.z - p.z);
      const nz = q.x - p.x;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const v of A) { const d = v.x * nx + v.z * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const v of B) { const d = v.x * nx + v.z * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      if (a1 <= b0 || b1 <= a0) return false;
    }
  }
  return true;
}

/** 0.1.5: half the clear gap kept between two building footprints (a footpath fits between them) */
export const BUILD_GAP = 0.65;

/** flank buildings left out because no clear spot was found (reported by scripts/check-roads.mjs) */
export const DROPPED: string[] = [];

const footBox = (st: Structure): Box2 => ({ x: st.x, z: st.z, yaw: st.yaw, ...FOOTPRINT[st.kind] });

/**
 * Village structures. `dry` (supplied by height.ts) says whether a ground point is natural land:
 * a 涼亭 that would stand in the sea moves to the inland edge instead. Flank buildings slide
 * outward / inland (never toward the road) until they overlap no other building or facility.
 */
/** placement search offsets (du, dw) in metres, nearest first (moving inward along the row costs 1.6×) */
const PLACE_CANDS: [number, number][] = (() => {
  const c: [number, number, number][] = [];
  for (let a = -15; a <= 15; a++) for (let b = 0; b <= 15; b++) c.push([a * 0.4, b * 0.4, (a < 0 ? -a * 1.6 : a) + b]);
  return c.sort((p, q) => p[2] - q[2]).map(([du, dw]) => [du, dw]);
})();
/** 0.1.4: a wider second search (to ~11 m) so no building is left out on the new island */
const PLACE_CANDS_WIDE: [number, number][] = (() => {
  const c: [number, number, number][] = [];
  for (let a = -28; a <= 28; a++) for (let b = 0; b <= 28; b++) {
    if (Math.abs(a) <= 15 && b <= 15) continue;
    c.push([a * 0.4, b * 0.4, (a < 0 ? -a * 1.6 : a) + b]);
  }
  return c.sort((p, q) => p[2] - q[2]).map(([du, dw]) => [du, dw]);
})();

export function villageStructures(v: VillageDef, dry?: (x: number, z: number) => boolean, others: readonly Structure[] = []): Structure[] {
  const out: Structure[] = [];
  const yaw = villageYaw(v);
  const spacing = HOUSE_SPACING;
  const backW = -ROW0_W - (v.rows.length - 1) * ROW_STEP; // last house row
  const isDry = (st: Structure): boolean => !dry || [...boxCorners(footBox(st)), { x: st.x, z: st.z }].every((c) => dry(c.x, c.z));
  const clear = (st: Structure): boolean => {
    const box = footBox(st);
    // 0.1.5: 1.3 m between buildings (BUILD_GAP each side), room for a footpath between them
    if (out.some((o) => boxesOverlap(box, footBox(o), BUILD_GAP))) return false;
    if (others.some((o) => boxesOverlap(box, footBox(o), BUILD_GAP))) return false;
    // (the parked plane's wingtips overhang its box: houses keep 0.6 m from it)
    if (facilityBoxes().some((o, i) => boxesOverlap(box, o, i === 2 ? 0.75 : BUILD_GAP))) return false;
    if (boxRoadClear(box, ROAD_CLEARANCE + 0.05) < ROAD_CLEARANCE + 0.05) return false;
    if (TARO_FIELDS.some((tf) => boxNearField(box, tf, 1.2))) return false;
    // stay in this village's own ground (never nearer another village's centre)
    const dOwn = Math.hypot(st.x - v.cx, st.z - v.cz);
    if (VILLAGE_DEFS.some((o) => o !== v && Math.hypot(st.x - o.cx, st.z - o.cz) < dOwn + 2)) return false;
    return isDry(st);
  };
  /**
   * Place a non-house structure at (u, w), or the nearest clear spot within ~4 m: sliding along
   * `outDir` (outward along the row, inward only as a last resort) and away from the road
   * (inland for inland buildings, seaward for seaward ones). Null when nothing fits.
   */
  const place = (kind: StructKind, u: number, w: number, turn: number, outDir: number, seaward = false, wide = false): Structure | null => {
    for (const [du, dw] of wide ? PLACE_CANDS_WIDE : PLACE_CANDS) {
      const p = vlocal(v, u + du * outDir, w + (seaward ? dw : -dw));
      const st: Structure = { kind, x: p.x, z: p.z, yaw: yaw + turn, hw: 1.6, hd: 1.4 };
      if (clear(st)) return st;
    }
    return null;
  };
  const push = (st: Structure | null, what: string): void => {
    if (st) out.push({ ...st, village: v.id });
    else DROPPED.push(`${v.id}:${what}`);
  };
  v.rows.forEach((n, ri) => {
    const w = -ROW0_W - ri * ROW_STEP; // rows step inland
    for (let k = 0; k < n; k++) {
      const u = (k - (n - 1) / 2) * spacing + (ri % 2) * 1.6;
      const p = vlocal(v, u, w);
      out.push({ kind: 'vahey', x: p.x, z: p.z, yaw, hw: 1.75, hd: 1.55, village: v.id });
    }
  });
  // raised work houses (makarang) at the ends of the house rows
  const nm = v.rows.length;
  for (let k = 0; k < nm; k++) {
    const n = v.rows[k];
    const side = k % 2 === 0 ? -1 : 1;
    const u = side * (((n - 1) / 2) * spacing + 3.4) + (k % 2) * 1.6;
    const mw = -ROW0_W - k * ROW_STEP + 0.3;
    push(place('makarang', u, mw, 0, side) ?? place('makarang', u, mw, 0, side, false, true), 'makarang');
  }
  // tagakal (涼亭) on the seaward side of the plaza, across the road from the houses;
  // where that is sea, behind the last house row instead (0.1.1)
  const nt = Math.max(2, v.rows[0] - 1);
  for (let k = 0; k < nt; k++) {
    const u = (k - (nt - 1) / 2) * 4.6 + 0.6;
    const st =
      place('tagakal', u, ROAD_W + ROAD_CLEARANCE + FOOTPRINT.tagakal.hd + 0.05, 0, u >= 0 ? 1 : -1, true) ??
      place('tagakal', u, backW - 3.3, 0, u >= 0 ? 1 : -1) ??
      place('tagakal', u, backW - 3.3, 0, u >= 0 ? 1 : -1, false, true);
    push(st, 'tagakal');
  }
  // extras on the flanks, set back inland so their (slightly turned) footprint clears the road;
  // seaward of the road when the inland flank is taken (airport, terraces, link roads)
  v.extras.forEach((kind, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const u = -side * (spacing * (v.rows[0] / 2) + 3.2 + Math.floor(i / 2) * 3.4);
    const turn = side > 0 ? -0.25 : 0.25;
    const f = FOOTPRINT[kind];
    const reachW = f.hw * Math.abs(Math.sin(turn)) + f.hd * Math.cos(turn);
    const w = Math.min(-1.2 - Math.floor(i / 2) * 1.2, ROAD_W - ROAD_CLEARANCE - reachW - 0.05 - Math.floor(i / 2) * 1.6);
    let st = place(kind, u, w, turn, -side);
    if (!st) {
      // seaward of the road: turned round so its door still faces the road
      st = place(kind, u, ROAD_W + ROAD_CLEARANCE + reachW + 0.05, turn, -side, true);
      // (0.1.5: a wider seaward search before going far along the row inland)
      st ??= place(kind, u, ROAD_W + ROAD_CLEARANCE + reachW + 0.05, turn, -side, true, true);
      if (st) st = { ...st, yaw: st.yaw + Math.PI };
    }
    st ??= place(kind, u, w, turn, -side, false, true);
    push(st, kind);
  });
  return out;
}

/** Half size of the flattened settlement rectangle in local (u, w) space. */
export function villageExtent(v: VillageDef): { hu: number; w0: number; w1: number } {
  const maxRow = Math.max(...v.rows);
  const hu = (maxRow * HOUSE_SPACING) / 2 + 4.4 + (v.extras.length > 2 ? 3.4 : 0);
  return { hu, w0: -ROW0_W - (v.rows.length - 1) * ROW_STEP - 2.4, w1: 5.2 };
}

// ---------------------------------------------------------------------------
// 水芋田 terraces
// ---------------------------------------------------------------------------

export interface TaroCell {
  x: number;
  z: number;
  level: number; // water surface height
  hu: number;
  hv: number;
  yaw: number;
  tier: number;
  dry: boolean;
}

export interface TaroField {
  id: string;
  cx: number;
  cz: number;
  fx: number;
  fz: number;
  tiers: number;
  cols: number;
  cellU: number; // along downhill
  cellV: number; // across
  drop: number;
  top: number; // filled in by height.ts
}

function tf(id: string, cx: number, cz: number, tiers: number, cols: number, fx = 0, fz = 1): TaroField {
  return { id, cx, cz, fx, fz, tiers, cols, cellU: 1.7, cellV: 2.1, drop: 0.4, top: 2 };
}

/** Taro terraces sit beside each settlement, climbing the valley slope. */
/**
 * `side` (0.1.4): the terraces sit beside the village (beyond its last house, just inland of the road)
 * instead of behind it, where the island is narrow (野銀 and 紅頭 face each other across the south-east neck).
 */
const FIELD_CFG: Record<string, { u: number; tiers: number; cols: number; side?: 1 | -1 }> = {
  yayo: { u: 2.5, tiers: 4, cols: 4 },
  iraraley: { u: -3, tiers: 4, cols: 4 },
  iranmeylek: { u: 2, tiers: 4, cols: 3 },
  ivalino: { u: -2.5, tiers: 5, cols: 4 },
  imorod: { u: 6, tiers: 4, cols: 4, side: 1 }, // 0.1.5: beside the west end (the 中橫公路 climbs behind the east end)
  iratay: { u: 3, tiers: 4, cols: 3 },
};

/**
 * 0.1.5 中橫公路 (蘭嶼橫貫公路, 東81): from the east end of 紅頭 over the hills, past 蘭嶼氣象站, down to the south end of
 * 野銀. Its middle follows the real road (OpenStreetMap way 106286207, simplified; data © OpenStreetMap contributors,
 * ODbL 1.0), carried onto this map by the 紅頭 → 野銀 village pair; both ends run up / down beside the villages (never
 * through them), then the line is rounded off (Chaikin) so it has no sharp corners.
 */
const CROSS_REAL: readonly number[] = [121.55562, 22.02441, 121.55200, 22.02801, 121.55539, 22.02938, 121.55613, 22.03267, 121.55984, 22.03578, 121.56588, 22.03395, 121.56462, 22.03552, 121.56628, 22.03920];
function chaikin(pts: [number, number][], iters: number): [number, number][] {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    const o: [number, number][] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1];
      o.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    o.push(p[p.length - 1]);
    p = o;
  }
  return p;
}
/** points ≥ `step` m apart (the road bed is profiled along them) */
function resample(pts: [number, number][], step: number): [number, number][] {
  const out: [number, number][] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc >= step || i === pts.length - 1) { out.push(pts[i]); acc = 0; }
  }
  return out;
}
/**
 * The route on this map: up beside the east end of 紅頭, over the hills behind 野銀 (inland of its houses and 水芋田, where
 * the real road climbs to the pass by the weather station), then down beside the north end of 野銀 to the ring road.
 * Waypoints are set relative to the two villages, so the road keeps clear of both however they are placed.
 */
export const CROSS_ROAD: [number, number][] = (() => {
  const a = VILLAGE_DEFS.find((v) => v.id === 'imorod')!, b = VILLAGE_DEFS.find((v) => v.id === 'ivalino')!;
  const ea = villageExtent(a), eb = villageExtent(b);
  const L = (v: VillageDef, u: number, w: number): [number, number] => { const p = vlocal(v, u, w); return [p.x, p.z]; };
  // between the two villages' back corners (they nearly meet at the island's narrow neck)
  const ca = vlocal(a, -ea.hu, ea.w0), cb = vlocal(b, eb.hu, eb.w0);
  const slot: [number, number] = [(ca.x + cb.x) / 2, (ca.z + cb.z) / 2];
  const pts: [number, number][] = [
    L(a, -ea.hu - 4.6, ROAD_W), L(a, -ea.hu - 5.0, -6), L(a, -ea.hu - 4.4, ea.w0 + 1.0), slot,
    L(b, eb.hu - 2, eb.w0 - 4.5), L(b, 0, -27), L(b, -eb.hu + 2, -25), L(b, -eb.hu - 4.5, eb.w0 - 5),
    L(b, -eb.hu - 3.4, -6), L(b, -eb.hu - 2.6, ROAD_W),
  ];
  return resample(chaikin(pts, 3), 1.6);
})();
export const TARO_FIELDS: TaroField[] = VILLAGE_DEFS.map((v) => {
  const cfg = FIELD_CFG[v.id];
  const probe = tf('probe', 0, 0, cfg.tiers, cfg.cols);
  const U = cfg.tiers * probe.cellU;
  const lastRow = -ROW0_W - (v.rows.length - 1) * ROW_STEP;
  const V = cfg.cols * probe.cellV;
  const p = cfg.side
    ? vlocal(v, cfg.side * (villageExtent(v).hu + V / 2 + 1.5), ROAD_W - ROAD_CLEARANCE - 1.4 - U / 2)
    : vlocal(v, cfg.u, lastRow - 1.55 - 0.5 - U / 2);
  // 0.1.5: slide along the village (nearest first) until the terraces are ≥ 3.5 m from the 中橫公路
  if (!cfg.side) {
    const w = lastRow - 1.55 - 0.5 - U / 2;
    const clearOf = (q: Vec2): boolean => {
      const f = tf('probe', q.x, q.z, cfg.tiers, cfg.cols, v.fx, v.fz);
      for (let i = 0; i < CROSS_ROAD.length; i++) {
        const lq = fieldLocal(f, CROSS_ROAD[i][0], CROSS_ROAD[i][1]);
        if (Math.abs(lq.u) < U / 2 + 3 && Math.abs(lq.v) < V / 2 + 3) return false;
      }
      return true;
    };
    // also off every village's ground (2 m margin)
    const offVillages = (q: Vec2): boolean => VILLAGE_DEFS.every((o) => {
      const e = villageExtent(o);
      const dx = q.x - o.cx, dz = q.z - o.cz;
      const uu = dx * -o.fz + dz * o.fx, ww = dx * o.fx + dz * o.fz;
      const R = Math.hypot(U, V) / 2 + 2;
      return Math.abs(uu) > e.hu + R || ww < e.w0 - R || ww > e.w1 + R;
    });
    const cands: [number, number][] = [];
    for (let du = -20; du <= 20; du += 1) for (let dw = -16; dw <= 2; dw += 1) cands.push([du, dw]);
    cands.sort((m, n) => Math.abs(m[0]) + Math.abs(m[1]) * 1.3 - Math.abs(n[0]) - Math.abs(n[1]) * 1.3);
    for (const [du, dw] of cands) {
      const q = vlocal(v, cfg.u + du, w + dw);
      if (clearOf(q) && (du === 0 && dw === 0 ? true : offVillages(q) && coastSdf(q.x, q.z) > VILLAGE_DEPTH + 2.7 + Math.hypot(U, V) / 2)) { p.x = q.x; p.z = q.z; break; }
    }
  }
  return tf(`taro_${v.id}`, p.x, p.z, cfg.tiers, cfg.cols, v.fx, v.fz);
});

/** Per-tier sideways jog of the paddy columns (shared by the heightfield carve and the cell list). */
export function tierShift(f: TaroField, i: number): number {
  return Math.sin(i * 1.7 + f.cx) * 0.55;
}

/** Local coordinates in the field: u downhill (toward sea), v across. */
export function fieldLocal(f: TaroField, x: number, z: number): { u: number; v: number } {
  const dx = x - f.cx;
  const dz = z - f.cz;
  return { u: dx * f.fx + dz * f.fz, v: -dx * f.fz + dz * f.fx };
}

export function fieldWorld(f: TaroField, u: number, v: number): Vec2 {
  return { x: f.cx + f.fx * u - f.fz * v, z: f.cz + f.fz * u + f.fx * v };
}

export function fieldCells(f: TaroField): TaroCell[] {
  const cells: TaroCell[] = [];
  const U = f.tiers * f.cellU;
  const V = f.cols * f.cellV;
  const yaw = Math.atan2(f.fx, f.fz);
  for (let i = 0; i < f.tiers; i++) {
    for (let j = 0; j < f.cols; j++) {
      const u = -U / 2 + (i + 0.5) * f.cellU;
      const v = -V / 2 + (j + 0.5) * f.cellV + tierShift(f, i);
      const p = fieldWorld(f, u, v);
      cells.push({
        x: p.x,
        z: p.z,
        level: f.top - i * f.drop - 0.05,
        hu: f.cellU / 2 - 0.2,
        hv: f.cellV / 2 - 0.2,
        yaw,
        tier: i,
        dry: (i * 7 + j * 3 + Math.round(f.cx)) % 9 === 0,
      });
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// ring road (0.1.1): through each village's seafront, linked by hand-placed waypoints
// ---------------------------------------------------------------------------

/** 開元港 at 椰油's north end (local u +4.5, 9.4 m out from the plaza: the 0.1.3 harbour / village spacing) */
export const HARBOUR_U = 4.5;

const vdef = (id: string): VillageDef => VILLAGE_DEFS.find((v) => v.id === id)!;
/** village road ends (clockwise = local +u), `trim` metres short of the settlement edge */
function villageRoad(id: string, trim = 0.5, extraIn = 0, extraOut = 0): [number, number][] {
  const v = vdef(id);
  const hu = villageExtent(v).hu - trim;
  const a = vlocal(v, -hu - extraIn, ROAD_W);
  const b = vlocal(v, hu + extraOut, ROAD_W);
  return [[a.x, a.z], [b.x, b.z]];
}

const RING_ORDER = ['yayo', 'iraraley', 'iranmeylek', 'ivalino', 'imorod', 'iratay'];
const ROAD_EXTEND: Record<string, [number, number]> = {};
const ROAD_EXTEND_DEFAULT: [number, number] = [1.5, 1.5];
/**
 * 蘭嶼機場 (0.1.4): the runway lies along the straight south-west shore between 椰油 and 漁人 (like the
 * real runway 13/31). The ring road runs along the beach seaward of it (as in 0.1.0–0.1.3), the terminal
 * stands on its inland side. SHORE_A → SHORE_B: that straight stretch of the outline (arc 70 → 95 m).
 */
const RUNWAY_HX = 2.3;
const RUNWAY_HZ = 7.6;
const SHORE_A = coastPoint(70 * K);
const SHORE_B = coastPoint(95 * K);
const SHORE_LEN = Math.hypot(SHORE_B.x - SHORE_A.x, SHORE_B.z - SHORE_A.z);
const SHORE_D = { x: (SHORE_B.x - SHORE_A.x) / SHORE_LEN, z: (SHORE_B.z - SHORE_A.z) / SHORE_LEN };
const SHORE_IN = coastSdf(SHORE_A.x + SHORE_D.z * 4, SHORE_A.z - SHORE_D.x * 4) > coastSdf(SHORE_A.x - SHORE_D.z * 4, SHORE_A.z + SHORE_D.x * 4)
  ? { x: SHORE_D.z, z: -SHORE_D.x }
  : { x: -SHORE_D.z, z: SHORE_D.x };
const shoreAt = (s: number, inset: number): [number, number] => [SHORE_A.x + SHORE_D.x * s + SHORE_IN.x * inset, SHORE_A.z + SHORE_D.z * s + SHORE_IN.z * inset];
/** the beach road past the airport, from 漁人's end toward 椰油 (clockwise) */
const AIRPORT_ROAD: [number, number][] = [18, 14, 10, 6].map((sd) => shoreAt((sd / 22) * SHORE_LEN, 4));
const AIRPORT = (() => {
  const [cx, cz] = shoreAt(0.5 * SHORE_LEN + 0.5, 4 + ROAD_CLEARANCE + RUNWAY_HX + 1.6);
  const c = { x: cx, z: cz };
  // runway yaw: local +x = inland, local +z = along (building-yaw convention)
  const yaw = Math.atan2(-SHORE_IN.z, SHORE_IN.x);
  const along = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const t = { x: c.x + 3.8 * SHORE_IN.x - 0.5 * along.x, z: c.z + 3.8 * SHORE_IN.z - 0.5 * along.z };
  return { c, yaw, t };
})();

/** link roads follow the coast this far inland (the villages' seafront road line) */
const LINK_INSET = VILLAGE_DEPTH + 0.2;

/** 0.1.4: link waypoints between two village road ends, following the coast clockwise */
function linkPoints(a: [number, number], b: [number, number]): [number, number][] {
  const ta = coastParam(a[0], a[1]);
  const tb = coastParam(b[0], b[1]);
  const len = cwDist(ta, tb);
  const out: [number, number][] = [];
  if (len > COAST_LEN / 2) return out; // the two road ends already overlap (neighbouring villages touch)
  const n = Math.floor(len / 5);
  for (let k = 1; k < n; k++) {
    const t = ta + ARC_CW * (len * k) / n;
    if (len * k / n < 4 || len - (len * k) / n < 4) continue;
    const p = insetPoint(t, LINK_INSET);
    out.push([p.x, p.z]);
  }
  // keep ≥ 3 m between points and drop the tiny wiggles (≤ 0.6 m off the chord)
  const simp: [number, number][] = [];
  for (const p of out) {
    const q = simp[simp.length - 1];
    if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) < 3) continue;
    simp.push(p);
  }
  return simp;
}

/** ring index of each village's clockwise road end (where its link to the next village starts) */
const LINK_START: Record<string, number> = {};

function buildRing(): [number, number][] {
  const ends = RING_ORDER.map((id) => {
    const [ei, eo] = ROAD_EXTEND[id] ?? ROAD_EXTEND_DEFAULT;
    return villageRoad(id, 0.5, ei, eo);
  });
  const pts: [number, number][] = [];
  ends.forEach((e, i) => {
    pts.push(...e);
    LINK_START[RING_ORDER[i]] = pts.length - 1;
    const next = ends[(i + 1) % ends.length];
    // 0.1.5: on the bigger island the beach road past the airport is joined to 漁人 and 椰油 along the coast too
    if (RING_ORDER[i] === 'iratay') pts.push(...linkPoints(e[1], AIRPORT_ROAD[0]), ...AIRPORT_ROAD, ...linkPoints(AIRPORT_ROAD[AIRPORT_ROAD.length - 1], next[0]));
    else pts.push(...linkPoints(e[1], next[0]));
  });
  pts.push(pts[0]);
  return pts;
}

export const RING_ROAD: [number, number][] = buildRing();

/** 開元港 quay → 椰油 seafront road (the spur the arriving party walks up) */
export const HARBOUR_SPUR: [number, number][] = (() => {
  const v = vdef('yayo');
  // straight up from the quay (clear of the harbour office and the 涼亭) to the seafront road
  const q = vlocal(v, HARBOUR_U - 0.7, 5.0);
  const j = vlocal(v, HARBOUR_U - 0.7, ROAD_W);
  return [[q.x, q.z], [j.x, j.z]];
})();

/** the 中橫公路 point farthest from both its villages (the pass), pushed `off` m away from the road's inner side */
function crossSummit(off: number): { x: number; z: number } {
  const a = vdef('imorod'), b = vdef('ivalino');
  let bi = 1, bd = -1;
  for (let i = 1; i < CROSS_ROAD.length - 1; i++) {
    const [x, z] = CROSS_ROAD[i];
    const d = Math.min(Math.hypot(x - a.cx, z - a.cz), Math.hypot(x - b.cx, z - b.cz));
    if (d > bd) { bd = d; bi = i; }
  }
  const [x, z] = CROSS_ROAD[bi];
  const [px, pz] = CROSS_ROAD[bi - 1], [nx, nz] = CROSS_ROAD[bi + 1];
  const tx = nx - px, tz = nz - pz, tl = Math.hypot(tx, tz) || 1;
  // the side away from the middle of the two villages
  let ox = -tz / tl, oz = tx / tl;
  const mx = (a.cx + b.cx) / 2, mz = (a.cz + b.cz) / 2;
  if ((x + ox - mx) ** 2 + (z + oz - mz) ** 2 < (x - mx) ** 2 + (z - mz) ** 2) { ox = -ox; oz = -oz; }
  return { x: round1(x + ox * off), z: round1(z + oz * off) };
}
/** the real road (OSM, simplified) for reference / the release notes: 3.9 km from 紅頭 to 野銀 */
export const CROSS_ROAD_REAL = CROSS_REAL;

export const ROADS: [number, number][][] = [RING_ROAD, HARBOUR_SPUR, CROSS_ROAD];


// ---------------------------------------------------------------------------
// facilities & landmarks
// ---------------------------------------------------------------------------

// set back inland of the ring road (its door faces the road and the sea)
/**
 * 0.1.4: a building beside the ring road on the link that leaves village `from`, at the road point nearest
 * the real place (lon, lat), set `off` metres inland of the road centre; yaw faces the road (and the sea).
 */
function besideLink(from: string, lon: number, lat: number, off: number, at?: Vec2): { x: number; z: number; yaw: number } {
  const next = RING_ORDER[(RING_ORDER.indexOf(from) + 1) % RING_ORDER.length];
  const i0 = LINK_START[from];
  const i1 = next === RING_ORDER[0] ? RING_ROAD.length - 1 : LINK_START[next] - 1;
  const g = at ?? geo(lon, lat);
  let best = { x: RING_ROAD[i0][0], z: RING_ROAD[i0][1], dx: 1, dz: 0 };
  let bd = Infinity;
  for (let k = i0 + 1; k <= i1; k++) {
    const [ax, az] = RING_ROAD[k - 1];
    const [bx, bz] = RING_ROAD[k];
    const L = Math.hypot(bx - ax, bz - az) || 1;
    for (let s = 0; s <= 1.0001; s += 0.05) {
      const x = ax + (bx - ax) * s;
      const z = az + (bz - az) * s;
      const d = Math.hypot(x - g.x, z - g.z);
      if (d < bd) { bd = d; best = { x, z, dx: (bx - ax) / L, dz: (bz - az) / L }; }
    }
  }
  let nx = -best.dz;
  let nz = best.dx;
  if (coastSdf(best.x + nx * 4, best.z + nz * 4) < coastSdf(best.x, best.z)) { nx = -nx; nz = -nz; }
  // front door (local +Z) faces back toward the road: yaw of (-nx, -nz)
  return { x: best.x + nx * off, z: best.z + nz * off, yaw: Math.atan2(-nx, -nz) };
}

/** 蘭嶼衛生所: beside the road on the 紅頭 → 漁人 stretch, at the real clinic (八代灣) */
// 0.1.5: the real clinic is in 紅頭 itself; on this map it stands on the road out of 紅頭 toward 漁人, past 紅頭's 水芋田
const clinicP = (() => {
  const a = villageRoad('imorod')[1], b = villageRoad('iratay')[0];
  return besideLink('imorod', 121.55469, 22.02491, ROAD_CLEARANCE + 1.9 + 0.5, { x: a[0] + (b[0] - a[0]) * 0.56, z: a[1] + (b[1] - a[1]) * 0.56 });
})();

const YAYO = VILLAGE_DEFS.find((v) => v.id === 'yayo')!;
const harbourP = vlocal(YAYO, HARBOUR_U, 9.4);

/** 小蘭嶼 Jimagaod: the real bearing from 蘭嶼 (south-east), brought in closer so it stays in view */
export const JIMAGAOD = { x: 64, z: 95 }; // 0.1.5: the same gap off the south-east cape on the bigger island

export const FACILITIES = {
  harbor: { x: harbourP.x, z: harbourP.z },
  clinic: { x: clinicP.x, z: clinicP.z, yaw: clinicP.yaw },
  /** runway centre, half width hx (across), half length hz (along), yaw (see RUNWAY_YAW) */
  runway: { x: AIRPORT.c.x, z: AIRPORT.c.z, hx: RUNWAY_HX, hz: RUNWAY_HZ, yaw: AIRPORT.yaw },
  terminal: { x: AIRPORT.t.x, z: AIRPORT.t.z, yaw: -Math.PI / 2 + AIRPORT.yaw },
  jimagaodLight: { x: JIMAGAOD.x + 0.6, z: JIMAGAOD.z - 0.6 },
};

/** runway-local coordinates of a world point: across (+ inland), along */
export function runwayLocal(x: number, z: number): { across: number; along: number } {
  const R = FACILITIES.runway;
  const dx = x - R.x;
  const dz = z - R.z;
  const c = Math.cos(R.yaw);
  const sn = Math.sin(R.yaw);
  return { across: dx * c - dz * sn, along: dx * sn + dz * c };
}

/** 開元港 land-side lantern posts (z offsets from the harbour); 0.1.1 dropped the middle one that stood on the spur road */
export const HARBOUR_LANTERN_DZ = [-3.4, -1.3]; // 0.1.4: the spur now runs due east from the quay (0.7 m south of the harbour centre)

/**
 * 0.1.4: the parked commuter plane (arrival prop) stands on the runway itself, at the 開元港 / 椰油 end in front of
 * the terminal, a little seaward of the centre line so its wingtip clears the terminal (whose front is ~2 m from the
 * centre line), nose turned slightly toward the terminal. `across` / `along`: runway-local (along signed toward the
 * harbour end), `rot`: turn from the runway heading. Its scale (0.72 of the Do 228-like model: span ≈ 4.75 m).
 */
export const PLANE_PARK = { across: -0.45, along: 3.4, rot: 0.22, scale: 0.72 };
/** world position / yaw of the parked plane (model nose = local +z; the collision box uses the same yaw) */
export function planePark(): { x: number; z: number; yaw: number } {
  const R = FACILITIES.runway;
  const al = { x: Math.sin(R.yaw), z: Math.cos(R.yaw) };
  const ac = { x: Math.cos(R.yaw), z: -Math.sin(R.yaw) }; // + inland
  const H = FACILITIES.harbor;
  const sg = (H.x - R.x) * al.x + (H.z - R.z) * al.z < 0 ? -1 : 1; // toward the harbour end
  const along = sg * PLANE_PARK.along;
  // nose toward the far end of the runway, turned a little toward the terminal (inland)
  const yaw = (sg > 0 ? R.yaw + Math.PI : R.yaw) + (sg > 0 ? PLANE_PARK.rot : -PLANE_PARK.rot);
  return { x: R.x + al.x * along + ac.x * PLANE_PARK.across, z: R.z + al.z * along + ac.z * PLANE_PARK.across, yaw };
}

/** solid facility footprints (clinic, terminal, parked plane) — collision.ts builds the same boxes */
export const CLINIC_FOOT = { hw: 3.0, hd: 1.9 };
export const TERMINAL_FOOT = { hw: 3.7, hd: 1.8 };
/** the parked plane's solid box (model frame: hw across the wings, hd along the fuselage; wingtips overhang) */
export const PLANE_FOOT = { hw: 1.9, hd: 2.15 };
/**
 * 0.1.4: the small yacht of the 搭船 arrival, moored in 開元港's basin beside the pier (south side, bow to the quay),
 * relative to FACILITIES.harbor; a solid box like the parked plane (it sits on the water, clear of the pier walk)
 */
export const HARBOUR_YACHT = { dx: -5.0, dz: -2.9, yaw: Math.PI / 2, hw: 0.75, hd: 2.3 };
let FACILITY_BOXES: Box2[] | null = null;
export function facilityBoxes(): Box2[] {
  if (FACILITY_BOXES) return FACILITY_BOXES;
  const cl = FACILITIES.clinic;
  const t = FACILITIES.terminal;
  const pp = planePark();
  FACILITY_BOXES = [
    { x: cl.x, z: cl.z, yaw: cl.yaw, ...CLINIC_FOOT },
    { x: t.x, z: t.z, yaw: t.yaw, ...TERMINAL_FOOT },
    { x: pp.x, z: pp.z, yaw: pp.yaw, ...PLANE_FOOT },
    { x: FACILITIES.harbor.x + HARBOUR_YACHT.dx, z: FACILITIES.harbor.z + HARBOUR_YACHT.dz, yaw: HARBOUR_YACHT.yaw, hw: HARBOUR_YACHT.hw, hd: HARBOUR_YACHT.hd },
  ];
  return FACILITY_BOXES;
}

/** real positions (OpenStreetMap / 臺灣地景保育網 coordinates), via outline.ts geo() */
const lm = (id: string, zh: string, lon: number, lat: number, lift: number, dx = 0, dz = 0) => {
  const p = geo(lon, lat);
  return { id, zh, tao: '', x: Math.round((p.x + dx) * 10) / 10, z: Math.round((p.z + dz) * 10) / 10, lift };
};
/** keep a sea stack `d` metres off the (smoothed) shore, along its real bearing */
function offshore<T extends { x: number; z: number }>(p: T, d: number): T {
  let x = p.x;
  let z = p.z;
  for (let k = 0; k < 60; k++) {
    const e = coastSdf(x, z) + d;
    if (Math.abs(e) < 0.05) break;
    const n = smoothNormal(x, z, 1.5);
    x += n.x * e * 0.8;
    z += n.z * e * 0.8;
  }
  return { ...p, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
}

/** a rock to draw at a landmark (island.ts sea stacks): centre, length along the shore, height, yaw */
export interface RockSpec { x: number; z: number; len: number; h: number; yaw: number; arch?: boolean }
export interface Landmark {
  id: string;
  zh: string;
  tao: string;
  /** where the player stands to see it (quest spot / label anchor) */
  x: number;
  z: number;
  lift: number;
  /** 0.1.4: shore rocks / sea stacks drawn by island.ts */
  rock?: RockSpec;
  /** 0.1.4: small built landmarks drawn by populate.ts */
  build?: 'lighthouse' | 'station' | 'falls';
  /** where the built landmark itself stands */
  at?: { x: number; z: number };
}

const wrapT = (t: number): number => ((t % COAST_LEN) + COAST_LEN) % COAST_LEN;
/** arc t `frac` of the clockwise way from a to b */
const cwBetween = (a: number, b: number, frac: number): number => wrapT(a + ARC_CW * frac * cwDist(a, b));
const round1 = (v: number): number => Math.round(v * 10) / 10;
/**
 * a shore landmark at arc t: the player's spot `inset` m inland of the shore, the rock `d` m out
 * (d < 0 = on the beach itself); the rock's long side runs along the shore
 */
function shoreLm(id: string, zh: string, t: number, rock: { d: number; len: number; h: number; arch?: boolean }, inset = 2.4, lift = 2.6): Landmark {
  const c = coastPoint(t);
  const stand = offshore({ x: c.x, z: c.z }, -inset); // `inset` m inland of the real shore
  const n = smoothNormal(c.x, c.z, 1.5);
  const r = offshore({ x: c.x, z: c.z }, rock.d);
  return {
    id, zh, tao: '', x: round1(stand.x), z: round1(stand.z), lift,
    rock: { x: r.x, z: r.z, len: rock.len, h: rock.h, yaw: Math.atan2(n.x, -n.z), arch: rock.arch },
  };
}
const T = (lon: number, lat: number): number => wrapT(coastT(lon, lat));
/** a built landmark stands at its real spot (`at`); the player's spot is `gap` m from it toward the nearest road */
/**
 * the map is smaller than the real island: the nearest spot (≤ 18 m) to (x0, z0) clear of the villages,
 * the taro terraces, the clinic and the airport, `minSdf` m inland, and `road[0]`…`road[1]` m from a road
 */
function clearSpot(x0: number, z0: number, size: number, road: [number, number], minSdf = 2): Vec2 {
  const cl = FACILITIES.clinic;
  const ok = (x: number, z: number): boolean => {
    if (VILLAGE_DEFS.some((d) => Math.hypot(x - d.cx, z - d.cz) < 16.4 + size)) return false;
    if (Math.hypot(x - cl.x, z - cl.z) < 5.4 + size || Math.hypot(x - FACILITIES.terminal.x, z - FACILITIES.terminal.z) < 7.4 + size) return false;
    const box: Box2 = { x, z, yaw: 0, hw: size, hd: size };
    if (TARO_FIELDS.some((tf) => boxNearField(box, tf, 2.5))) return false;
    if (coastSdf(x, z) < minSdf) return false;
    const rd = roadDist(x, z);
    return rd > road[0] && rd < road[1];
  };
  for (let r = 0; r <= 24; r += 0.5) {
    for (let a = 0; a < 32; a++) {
      const x = x0 + Math.cos((a / 32) * Math.PI * 2) * r, z = z0 + Math.sin((a / 32) * Math.PI * 2) * r;
      if (ok(x, z)) return { x: round1(x), z: round1(z) };
      if (r === 0) break;
    }
  }
  return { x: x0, z: z0 };
}
/** the nearest road point to (x, z) */
function nearestRoad(x: number, z: number): Vec2 {
  let bx = x, bz = z, bd = Infinity;
  for (const pl of ROADS) for (let i = 0; i < pl.length - 1; i++) {
    const [ax, az] = pl[i], [cx, cz] = pl[i + 1];
    const dx = cx - ax, dz = cz - az, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    const qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(qx - x, qz - z);
    if (d < bd) { bd = d; bx = qx; bz = qz; }
  }
  return { x: bx, z: bz };
}
function besideBuild(p0: { id: string; zh: string; tao: string; x: number; z: number; lift: number }, build: NonNullable<Landmark['build']>, gap: number, keep = false): Landmark {
  const p = keep ? { ...p0 } : { ...p0, ...clearSpot(p0.x, p0.z, 1.6, [ROAD_CLEARANCE + 2.2, 10]) };
  let bx = p.x, bz = p.z, bd = Infinity;
  for (const pl of ROADS) for (const [x, z] of pl) { const d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; bx = x; bz = z; } }
  const k = Math.min(1, gap / (bd || 1));
  return { ...p, x: round1(p.x + (bx - p.x) * k), z: round1(p.z + (bz - p.z) * k), build, at: { x: p.x, z: p.z } };
}
// real arc spots used to place the rocks whose exact position is not certain (WORLD_NEEDS.md)
const T_IRANMEYLEK = T(121.56458, 22.05782);
const T_IVALINO = T(121.56639, 22.03827);
const T_DRAGON = T(121.58854, 22.00192);
const T_IMOROD = T(121.5615, 22.0195);

/**
 * Landmarks at their real spots (OpenStreetMap names via Nominatim; ODbL). 0.1.4 adds the ring-road rocks
 * the content needs (docs/phase1/WORLD_NEEDS.md). Rocks marked "not certain" are placed between their
 * real neighbours on the ring road and are listed in PROGRESS.md for checking.
 */
export const LANDMARKS: Landmark[] = [
  lm('hongtoushan', '紅頭山', 121.53455, 22.05303, 2.2),
  lm('dasenshan', '大森山', 121.58571, 22.01032, 2.2),
  lm('qingqing', '青青草原', 121.57221, 22.00559, 1.6, -1, -3.5),
  offshore(lm('battleship', '軍艦岩', 121.579642, 22.07872, 3.2), 3.4 * K), // ~300 m off the shore
  lm('twinlions', '雙獅岩', 121.567086, 22.083503, 3.0),
  // north-west coast, 開元港 → 五孔洞 (OSM)
  shoreLm('hongtou_rock', '紅頭岩', T(121.5066, 22.0645), { d: -0.6, len: 4.2, h: 3.4, arch: true }),
  shoreLm('tank_rock', '坦克岩', T(121.50514, 22.08538), { d: 1.6, len: 3.6, h: 2.6 }),
  besideBuild(lm('lighthouse', '蘭嶼燈塔', 121.50303, 22.08089, 5.5), 'lighthouse', 3.4, true),
  shoreLm('jade_rock', '玉女岩', T(121.51739, 22.08029), { d: 1.2, len: 1.6, h: 3.8 }),
  // east coast
  shoreLm('lovers_cave', '情人洞', T(121.57351, 22.06198), { d: -0.4, len: 4.6, h: 3.6, arch: true }),
  shoreLm('skyline_gap', '一線天', cwBetween(T_IRANMEYLEK, T_IVALINO, 0.5), { d: -0.2, len: 5, h: 4.2 }), // not certain
  shoreLm('helmet_rock', '鋼盔岩', cwBetween(T_IVALINO, T_DRAGON, 0.3), { d: 1.4, len: 2.6, h: 2.2 }), // between 野銀 and 象鼻岩
  shoreLm('elephant_rock', '象鼻岩', cwBetween(T_IVALINO, T_DRAGON, 0.62), { d: 0.6, len: 4.0, h: 3.4, arch: true }),
  // south coast
  shoreLm('dragonhead_rock', '龍頭岩', T_DRAGON, { d: 1.0, len: 4.4, h: 3.6 }),
  besideBuild(lm('lanyu_falls', '蘭嶼的瀑布', 121.59481, 22.01492, 3.2), 'falls', 3.0), // OSM waterfall 利嘟娜拉 (east of 龍門)
  shoreLm('old_man_rock', '老人岩', T(121.57232, 22.00352), { d: 1.2, len: 1.8, h: 3.4 }),
  shoreLm('carp_rock', '鯉魚岩', cwBetween(T_DRAGON, T_IMOROD, 0.86), { d: 1.6, len: 3.4, h: 2.0 }), // by 紅頭 (鯉魚山); not certain
  // 0.1.5: at the top of the 中橫公路 (the real station stands on the pass), on the outer side of the road
  besideBuild({ ...lm('weather_station', '蘭嶼氣象站', 121.55834, 22.03699, 4.2), ...crossSummit(5.2) }, 'station', 3.2, true),
];

/**
 * 0.1.4: the two crater lakes, seen from a lookout only (a collider keeps you off the water; height.ts
 * cuts the basin, populate.ts draws the water). 小天池 near 五孔洞, 大天池 in the hills above 紅頭 (OSM),
 * each moved to the nearest spot clear of the villages on this smaller map.
 */
export interface Lake { id: string; zh: string; x: number; z: number; r: number; view: Vec2 }
/** nearest 1 m grid spot ≥ `inland` m from the shore and `fromRoad` m from roads, clear of the villages and terraces */
function interiorSpot(x0: number, z0: number, inland: number, fromRoad: number): Vec2 {
  let best: Vec2 = { x: x0, z: z0 }, bd = Infinity;
  for (let x = Math.round(x0) - 24; x <= Math.round(x0) + 24; x++) for (let z = Math.round(z0) - 24; z <= Math.round(z0) + 24; z++) {
    const d = Math.hypot(x - x0, z - z0);
    if (d >= bd || coastSdf(x, z) < inland || roadDist(x, z) < fromRoad) continue;
    if (VILLAGE_DEFS.some((v) => Math.hypot(x - v.cx, z - v.cz) < 14)) continue;
    if (TARO_FIELDS.some((f) => { const q = fieldLocal(f, x, z); return Math.abs(q.u) < (f.tiers * f.cellU) / 2 + 5 && Math.abs(q.v) < (f.cols * f.cellV) / 2 + 5; })) continue;
    bd = d; best = { x, z };
  }
  return best;
}
function mkLake(id: string, zh: string, c: Vec2, r: number): Lake {
  // the lookout: toward the nearest road, 3.6 m out from the water
  const q = nearestRoad(c.x, c.z);
  const d = Math.hypot(q.x - c.x, q.z - c.z) || 1;
  const k = Math.min(1, (r + 3.6) / d);
  return { id, zh, x: c.x, z: c.z, r, view: { x: round1(c.x + (q.x - c.x) * k), z: round1(c.z + (q.z - c.z) * k) } };
}
export const LAKES: Lake[] = [
  // 小天池 at its real spot on the 五孔洞 cape (between the ring road and the shore)
  mkLake('small_lake', '小天池', geo(121.5102, 22.07747), 1.7),
  // 大天池 inland, at the nearest spot clear of 紅頭 and its terraces
  mkLake('big_lake', '大天池', (() => { const g = geo(121.57281, 22.02078); return interiorSpot(g.x, g.z, 6.5, 6); })(), 2.6),
];

/** 0.1.5 English: set the world's language once at boot (before labels / quest spots are made); names.ts */
const ZH_NAMES = new Map<string, string>([...LANDMARKS, ...LAKES].map((o) => [o.id, o.zh]));
export function useWorldLang(l: WorldLang): void {
  setWorldLang(l);
  for (const o of [...LANDMARKS, ...LAKES]) o.zh = (l === 'en' && WORLD_EN[o.id]) || ZH_NAMES.get(o.id) || o.zh;
}

/** 饅頭岩: a former sea-burial place, out at sea off 椰油 with no path to it (decor only, no quest spot) */
export const MANTOU_ROCK: RockSpec = (() => {
  const t = T(121.50942, 22.04618);
  const c = coastPoint(t);
  const r = offshore({ x: c.x, z: c.z }, 7);
  return { x: r.x, z: r.z, len: 3.4, h: 4.4, yaw: 0 };
})();

/**
 * a party position from an old save (world revision 1) → near the same village on this map
 * (kept within the village and its seafront; resume / findSafeStand then picks a free spot)
 */
export function remapSavePos(x: number, z: number): Vec2 {
  // the same village on the new map, then the nearest point of the ring road there (always open ground)
  const p = fromOld(x, z, 14, [-12, 4]);
  let best = { x: p.x, z: p.z }, bd = Infinity;
  for (let i = 0; i < RING_ROAD.length; i++) {
    const [ax, az] = RING_ROAD[i], [bx, bz] = RING_ROAD[(i + 1) % RING_ROAD.length];
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / L));
    const qx = ax + dx * t, qz = az + dz * t, d = (qx - p.x) ** 2 + (qz - p.z) ** 2;
    if (d < bd) { bd = d; best = { x: qx, z: qz }; }
  }
  return best;
}

/**
 * 0.1.5: a 0.1.4 save position (the smaller real-outline island) → the same spot near the same village or facility
 * on the bigger map, on the ring road there. Anchors: the 0.1.4 place coordinates (content/places.json of 0.1.4).
 */
const ANCHORS_014: [string, number, number][] = [
  ['yayo', -39.8, -15.8], ['iraraley', -23.3, -38.2], ['iranmeylek', 14.7, -24.8], ['ivalino', 11.9, -0.3],
  ['imorod', 25, 35.9], ['iratay', -11.4, 15.4], ['harbor', -49.2, -20.3], ['airport', -21.9, -2.5], ['clinic', 9.8, 14.8],
];
export function remapSavePos014(x: number, z: number): Vec2 {
  let best = ANCHORS_014[0], bd = Infinity;
  for (const a of ANCHORS_014) { const d = (a[1] - x) ** 2 + (a[2] - z) ** 2; if (d < bd) { bd = d; best = a; } }
  const v = VILLAGE_DEFS.find((d) => d.id === best[0]);
  const to = v ? { x: v.cx, z: v.cz } : best[0] === 'harbor' ? FACILITIES.harbor : best[0] === 'airport' ? FACILITIES.terminal : FACILITIES.clinic;
  let dx = (x - best[1]) * MAP_SCALE, dz = (z - best[2]) * MAP_SCALE;
  const L = Math.hypot(dx, dz);
  if (L > 14) { dx *= 14 / L; dz *= 14 / L; }
  return nearestRingPoint(to.x + dx, to.z + dz);
}
/**
 * 0.1.6: a 0.1.5 save position (world revision 3) → the same spot after 紅頭 and 漁人 moved a little apart:
 * points near either village move with it (fading out over 30–45 m), everything else stays.
 */
const CENTRES_015: [string, number, number][] = [['imorod', 12.4, 29.9], ['iratay', -28.2, 17.8]];
export function remapSavePos015(x: number, z: number): Vec2 {
  let ox = 0, oz = 0;
  for (const [id, cx, cz] of CENTRES_015) {
    const v = VILLAGE_DEFS.find((d) => d.id === id);
    if (!v) continue;
    const d = Math.hypot(x - cx, z - cz);
    const w = d <= 30 ? 1 : d >= 45 ? 0 : (45 - d) / 15;
    ox += (v.cx - cx) * w;
    oz += (v.cz - cz) * w;
  }
  return { x: x + ox, z: z + oz };
}
function nearestRingPoint(x: number, z: number): Vec2 {
  let best = { x, z }, bd = Infinity;
  for (let i = 0; i < RING_ROAD.length; i++) {
    const [ax, az] = RING_ROAD[i], [bx, bz] = RING_ROAD[(i + 1) % RING_ROAD.length];
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    const qx = ax + dx * t, qz = az + dz * t, d = (qx - x) ** 2 + (qz - z) ** 2;
    if (d < bd) { bd = d; best = { x: qx, z: qz }; }
  }
  return best;
}

/** an old (0.1.0–0.1.3) world point → the same spot relative to its village on this map */
export function fromOld(x: number, z: number, clampU = Infinity, clampW: [number, number] = [-Infinity, Infinity]): Vec2 {
  const o = oldLocal(x, z);
  const v = VILLAGE_DEFS.find((d) => d.id === o.id)!;
  const u = Math.max(-clampU, Math.min(clampU, o.u));
  const w = Math.max(clampW[0], Math.min(clampW[1], o.w));
  return vlocal(v, u, w);
}


function roadDist(x: number, z: number): number {
  let best = Infinity;
  for (const pl of ROADS) {
    for (let k = 0; k < pl.length - 1; k++) {
      const [ax, az] = pl[k];
      const [bx, bz] = pl[k + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const L = dx * dx + dz * dz;
      const t = L > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
  }
  return best;
}

/**
 * min distance from the road centrelines to a box (sampled; 0 when a road crosses it).
 * `stopBelow`: return as soon as the distance is known to be under it (placement only needs a yes / no).
 */
export function boxRoadClear(o: Box2, stopBelow = -Infinity): number {
  if (stopBelow > -Infinity) {
    // quick yes / no from the centre (one of the samples): the box reaches at most R from it
    const dc = roadDist(o.x, o.z);
    const R = Math.hypot(o.hw, o.hd);
    if (dc - R >= stopBelow) return dc - R;
    if (dc < stopBelow) return dc;
  }
  let best = Infinity;
  const c = Math.cos(o.yaw);
  const s = Math.sin(o.yaw);
  const n = 8;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const lx = -o.hw + (2 * o.hw * i) / n;
      const lz = -o.hd + (2 * o.hd * j) / n;
      const x = o.x + lx * c + lz * s;
      const z = o.z - lx * s + lz * c;
      best = Math.min(best, roadDist(x, z));
      if (best < stopBelow) return best;
    }
  }
  return best;
}

/** true if any corner / the centre of the box is within `m` of a taro field's terraces */
function boxNearField(o: Box2, f: TaroField, m: number): boolean {
  const U = (f.tiers * f.cellU) / 2 + m;
  const V = (f.cols * f.cellV) / 2 + m + 0.6;
  return [...boxCorners(o), { x: o.x, z: o.z }].some((p) => {
    const { u, v } = fieldLocal(f, p.x, p.z);
    return Math.abs(u) < U && Math.abs(v) < V;
  });
}
