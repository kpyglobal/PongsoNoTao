/**
 * Shared settlement + terrace layout for Pongso no Tao｜蘭嶼文化島.
 * Used by the heightfield (to carve sunken 地下屋 pits, flatten plazas and
 * cut 水芋田 terraces) and by the decor builder (to place the actual props).
 * World axes: +X east, +Z south, sea level = 0.
 */

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

/** Rough centre of the island (seaward directions, last-resort unstuck walk). */
export const ISLAND_CENTRE = { x: 1.5, z: 4 };
const ISLAND_C = ISLAND_CENTRE;

/** Village grid (local u/w units): house spacing along the row, first row offset inland, row step. */
export const HOUSE_SPACING = 4.1;
export const ROW0_W = 3.6;
export const ROW_STEP = 3.7;
/**
 * The ring road runs through every village along its seafront at local w = ROAD_W (0.1.1):
 * houses / work houses / church / shop / school stay inland of it, the 涼亭 (tagakal) seaward,
 * each with ≥ ROAD_CLEARANCE from the road centreline (scripts/check-roads.mjs enforces it).
 */
export const ROAD_W = -0.2;
export const ROAD_CLEARANCE = 1.6;

function seaward(x: number, z: number, bias = 0): { fx: number; fz: number } {
  const a = Math.atan2(z - ISLAND_C.z, x - ISLAND_C.x) + bias;
  return { fx: Math.cos(a), fz: Math.sin(a) };
}

function mk(id: string, cx: number, cz: number, rows: number[], extras: StructKind[], bias = 0, plazaH = 1.15): VillageDef {
  const { fx, fz } = seaward(cx, cz, bias);
  return { id, cx, cz, fx, fz, rows, extras, plazaH };
}

export const VILLAGE_DEFS: VillageDef[] = [
  mk('yayo', -26.6, -6, [3, 2], ['church', 'shop', 'modern', 'modern'], 0.15),
  mk('iraraley', -2, -38, [3, 2], ['church', 'modern'], 0.05),
  mk('iranmeylek', 20.4, -18.2, [3, 2], ['shop', 'modern'], 0.05),
  mk('ivalino', 26.8, 9.6, [4, 3], [], 0.0),
  mk('imorod', 6, 32, [3, 2], ['church', 'modern'], 0.0, 1.25),
  mk('iratay', -20, 22, [3, 2], ['church', 'modern'], -0.25),
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

export function villageStructures(v: VillageDef, dry?: (x: number, z: number) => boolean, others: readonly Structure[] = []): Structure[] {
  const out: Structure[] = [];
  const yaw = villageYaw(v);
  const spacing = HOUSE_SPACING;
  const backW = -ROW0_W - (v.rows.length - 1) * ROW_STEP; // last house row
  const isDry = (st: Structure): boolean => !dry || [...boxCorners(footBox(st)), { x: st.x, z: st.z }].every((c) => dry(c.x, c.z));
  const clear = (st: Structure): boolean => {
    const box = footBox(st);
    if (out.some((o) => boxesOverlap(box, footBox(o), 0.15))) return false;
    if (others.some((o) => boxesOverlap(box, footBox(o), 0.15))) return false;
    if (facilityBoxes().some((o) => boxesOverlap(box, o, 0.15))) return false;
    if (boxRoadClear(box, ROAD_CLEARANCE + 0.05) < ROAD_CLEARANCE + 0.05) return false;
    if (TARO_FIELDS.some((tf) => boxNearField(box, tf, 1.2))) return false;
    return isDry(st);
  };
  /**
   * Place a non-house structure at (u, w), or the nearest clear spot within ~4 m: sliding along
   * `outDir` (outward along the row, inward only as a last resort) and away from the road
   * (inland for inland buildings, seaward for seaward ones). Null when nothing fits.
   */
  const place = (kind: StructKind, u: number, w: number, turn: number, outDir: number, seaward = false): Structure | null => {
    for (const [du, dw] of PLACE_CANDS) {
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
    push(place('makarang', u, -ROW0_W - k * ROW_STEP + 0.3, 0, side), 'makarang');
  }
  // tagakal (涼亭) on the seaward side of the plaza, across the road from the houses;
  // where that is sea, behind the last house row instead (0.1.1)
  const nt = Math.max(2, v.rows[0] - 1);
  for (let k = 0; k < nt; k++) {
    const u = (k - (nt - 1) / 2) * 4.6 + 0.6;
    const st =
      place('tagakal', u, ROAD_W + ROAD_CLEARANCE + FOOTPRINT.tagakal.hd + 0.05, 0, u >= 0 ? 1 : -1, true) ??
      place('tagakal', u, backW - 3.3, 0, u >= 0 ? 1 : -1);
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
    const st = place(kind, u, w, turn, -side) ?? place(kind, u, ROAD_W + ROAD_CLEARANCE + reachW + 0.05, turn, -side, true);
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

function tf(id: string, cx: number, cz: number, tiers: number, cols: number, bias = 0): TaroField {
  const { fx, fz } = seaward(cx, cz, bias);
  return { id, cx, cz, fx, fz, tiers, cols, cellU: 1.7, cellV: 2.1, drop: 0.4, top: 2 };
}

/** Taro terraces sit beside each settlement, climbing the valley slope. */
const FIELD_CFG: Record<string, { u: number; tiers: number; cols: number }> = {
  yayo: { u: 2.5, tiers: 4, cols: 4 },
  iraraley: { u: -3, tiers: 4, cols: 4 },
  iranmeylek: { u: 2, tiers: 4, cols: 3 },
  ivalino: { u: -2.5, tiers: 5, cols: 4 },
  imorod: { u: -4, tiers: 4, cols: 4 },
  iratay: { u: 3, tiers: 4, cols: 3 },
};

export const TARO_FIELDS: TaroField[] = VILLAGE_DEFS.map((v) => {
  const cfg = FIELD_CFG[v.id];
  const probe = tf('probe', 0, 0, cfg.tiers, cfg.cols);
  const U = cfg.tiers * probe.cellU;
  const lastRow = -ROW0_W - (v.rows.length - 1) * ROW_STEP;
  const p = vlocal(v, cfg.u, lastRow - 1.55 - 0.5 - U / 2);
  return tf(`taro_${v.id}`, p.x, p.z, cfg.tiers, cfg.cols);
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
// facilities & landmarks
// ---------------------------------------------------------------------------

const IMOROD = VILLAGE_DEFS.find((v) => v.id === 'imorod')!;
// set back inland of the ring road (its door faces the road and the sea)
const clinicP = vlocal(IMOROD, villageExtent(IMOROD).hu + 3.2, ROAD_W - ROAD_CLEARANCE - 1.9 - 0.1);

export const FACILITIES = {
  harbor: { x: -37, z: -6.5 },
  clinic: { x: clinicP.x, z: clinicP.z, yaw: villageYaw(IMOROD) },
  /** 蘭嶼機場 runway runs N–S along the west coast, between Yayo and Iratay */
  runway: { x: -28.4, z: 9.5, hx: 2.3, hz: 7.6 },
  terminal: { x: -24.6, z: 9.0, yaw: -Math.PI / 2 },
  jimagaodLight: { x: 8.6, z: 65.4 },
};

/** 開元港 land-side lantern posts (z offsets from the harbour); 0.1.1 dropped the middle one that stood on the spur road */
export const HARBOUR_LANTERN_DZ = [-3.2, 0];

/** commuter plane, in the terminal's local frame (local +x = world +z here) */
export const AIRPORT_PLANE = { lx: 0.6, lz: 4.6 };

/** solid facility footprints (clinic, terminal, parked plane) — collision.ts builds the same boxes */
export const CLINIC_FOOT = { hw: 3.0, hd: 1.9 };
export const TERMINAL_FOOT = { hw: 3.7, hd: 1.8 };
export const PLANE_FOOT = { hw: 2.3, hd: 2.8 };
let FACILITY_BOXES: Box2[] | null = null;
export function facilityBoxes(): Box2[] {
  if (FACILITY_BOXES) return FACILITY_BOXES;
  const cl = FACILITIES.clinic;
  const t = FACILITIES.terminal;
  const c = Math.cos(t.yaw);
  const s = Math.sin(t.yaw);
  const px = t.x + AIRPORT_PLANE.lx * c + AIRPORT_PLANE.lz * s;
  const pz = t.z - AIRPORT_PLANE.lx * s + AIRPORT_PLANE.lz * c;
  FACILITY_BOXES = [
    { x: cl.x, z: cl.z, yaw: cl.yaw, ...CLINIC_FOOT },
    { x: t.x, z: t.z, yaw: t.yaw, ...TERMINAL_FOOT },
    { x: px, z: pz, yaw: t.yaw, ...PLANE_FOOT },
  ];
  return FACILITY_BOXES;
}

export const LANDMARKS: { id: string; zh: string; tao: string; x: number; z: number; lift: number }[] = [
  { id: 'hongtoushan', zh: '紅頭山', tao: '', x: 3, z: 13, lift: 2.2 },
  { id: 'dasenshan', zh: '大森山', tao: '', x: -3, z: -12, lift: 2.2 },
  { id: 'qingqing', zh: '青青草原', tao: '', x: -31, z: 29.5, lift: 1.6 },
  { id: 'battleship', zh: '軍艦岩', tao: '', x: -45.5, z: -19, lift: 3.2 },
  { id: 'twinlions', zh: '雙獅岩', tao: '', x: -16.2, z: -35.2, lift: 3.0 },
];

// ---------------------------------------------------------------------------
// ring road (0.1.1): through each village's seafront, linked by hand-placed waypoints
// ---------------------------------------------------------------------------

const vdef = (id: string): VillageDef => VILLAGE_DEFS.find((v) => v.id === id)!;
/** village road ends (clockwise = local +u), `trim` metres short of the settlement edge */
function villageRoad(id: string, trim = 0.5, extraIn = 0, extraOut = 0): [number, number][] {
  const v = vdef(id);
  const hu = villageExtent(v).hu - trim;
  const a = vlocal(v, -hu - extraIn, ROAD_W);
  const b = vlocal(v, hu + extraOut, ROAD_W);
  return [[a.x, a.z], [b.x, b.z]];
}

/** link waypoints between consecutive villages (clockwise from 椰油) */
const LINKS: Record<string, [number, number][]> = {
  'yayo>iraraley': [[-19.5, -30]],
  'iraraley>iranmeylek': [],
  'iranmeylek>ivalino': [],
  'ivalino>imorod': [],
  'imorod>iratay': [],
  'iratay>yayo': [[-33.8, 13.6], [-33.8, 6.4]],
};
const RING_ORDER = ['yayo', 'iraraley', 'iranmeylek', 'ivalino', 'imorod', 'iratay'];
const ROAD_EXTEND: Record<string, [number, number]> = { yayo: [0, 4], iraraley: [8, 8], iranmeylek: [0, 4], imorod: [4, 10], iratay: [-2, 4] };
const ROAD_EXTEND_DEFAULT: [number, number] = [4, 4];

function buildRing(): [number, number][] {
  const pts: [number, number][] = [];
  RING_ORDER.forEach((id, i) => {
    const [ei, eo] = ROAD_EXTEND[id] ?? ROAD_EXTEND_DEFAULT;
    pts.push(...villageRoad(id, 0.5, ei, eo));
    const next = RING_ORDER[(i + 1) % RING_ORDER.length];
    pts.push(...(LINKS[`${id}>${next}`] ?? []));
  });
  pts.push(pts[0]);
  return pts;
}

export const RING_ROAD: [number, number][] = buildRing();

/** 開元港 quay → 椰油 seafront road (the spur the arriving party walks up) */
export const HARBOUR_SPUR: [number, number][] = (() => {
  const v = vdef('yayo');
  // straight up from the quay (clear of the harbour office and the 涼亭) to the seafront road
  const q = vlocal(v, -5.2, 5.0);
  const j = vlocal(v, -5.2, ROAD_W);
  return [[q.x, q.z], [j.x, j.z]];
})();

export const ROADS: [number, number][][] = [RING_ROAD, HARBOUR_SPUR];

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
