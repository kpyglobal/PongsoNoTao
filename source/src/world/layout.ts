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
export const ROW0_W = 2.6;
export const ROW_STEP = 3.7;

function seaward(x: number, z: number, bias = 0): { fx: number; fz: number } {
  const a = Math.atan2(z - ISLAND_C.z, x - ISLAND_C.x) + bias;
  return { fx: Math.cos(a), fz: Math.sin(a) };
}

function mk(id: string, cx: number, cz: number, rows: number[], extras: StructKind[], bias = 0, plazaH = 1.15): VillageDef {
  const { fx, fz } = seaward(cx, cz, bias);
  return { id, cx, cz, fx, fz, rows, extras, plazaH };
}

export const VILLAGE_DEFS: VillageDef[] = [
  mk('yayo', -26.6, -6, [3, 2], ['shop', 'church', 'modern', 'modern'], 0.15),
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

export function villageStructures(v: VillageDef): Structure[] {
  const out: Structure[] = [];
  const yaw = villageYaw(v);
  const spacing = HOUSE_SPACING;
  v.rows.forEach((n, ri) => {
    const w = -ROW0_W - ri * ROW_STEP; // rows step inland
    for (let k = 0; k < n; k++) {
      const u = (k - (n - 1) / 2) * spacing + (ri % 2) * 1.6;
      const p = vlocal(v, u, w);
      out.push({ kind: 'vahey', x: p.x, z: p.z, yaw, hw: 1.75, hd: 1.55 });
    }
  });
  // raised work houses (makarang) at the ends of the house rows
  const nm = v.rows.length;
  for (let k = 0; k < nm; k++) {
    const n = v.rows[k];
    const side = k % 2 === 0 ? -1 : 1;
    const u = side * (((n - 1) / 2) * spacing + 3.4) + (k % 2) * 1.6;
    const p = vlocal(v, u, -ROW0_W - k * ROW_STEP + 0.3);
    out.push({ kind: 'makarang', x: p.x, z: p.z, yaw, hw: 1.2, hd: 1.0 });
  }
  // tagakal (涼亭) on the seaward side of the plaza
  const nt = Math.max(2, v.rows[0] - 1);
  for (let k = 0; k < nt; k++) {
    const u = (k - (nt - 1) / 2) * 4.6 + 0.6;
    const p = vlocal(v, u, 2.6);
    out.push({ kind: 'tagakal', x: p.x, z: p.z, yaw, hw: 1.1, hd: 1.0 });
  }
  // extras on the flanks
  v.extras.forEach((kind, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const u = -side * (spacing * (v.rows[0] / 2) + 3.2 + Math.floor(i / 2) * 3.4);
    const p = vlocal(v, u, -1.2 - Math.floor(i / 2) * 1.2);
    out.push({ kind, x: p.x, z: p.z, yaw: yaw + (side > 0 ? -0.25 : 0.25), hw: 1.6, hd: 1.4 });
  });
  return out;
}

/** Half size of the flattened settlement rectangle in local (u, w) space. */
export function villageExtent(v: VillageDef): { hu: number; w0: number; w1: number } {
  const maxRow = Math.max(...v.rows);
  const hu = (maxRow * HOUSE_SPACING) / 2 + 4.4 + (v.extras.length > 2 ? 3.4 : 0);
  return { hu, w0: -ROW0_W - (v.rows.length - 1) * ROW_STEP - 2.4, w1: 4.2 };
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
const clinicP = vlocal(IMOROD, villageExtent(IMOROD).hu + 3.2, -1.4);

export const FACILITIES = {
  harbor: { x: -37, z: -6.5 },
  clinic: { x: clinicP.x, z: clinicP.z, yaw: villageYaw(IMOROD) },
  /** 蘭嶼機場 runway runs N–S along the west coast, between Yayo and Iratay */
  runway: { x: -29.2, z: 9.5, hx: 2.3, hz: 7.6 },
  terminal: { x: -25.4, z: 9.0, yaw: -Math.PI / 2 },
  jimagaodLight: { x: 8.6, z: 65.4 },
};

export const LANDMARKS: { id: string; zh: string; tao: string; x: number; z: number; lift: number }[] = [
  { id: 'hongtoushan', zh: '紅頭山', tao: '', x: 3, z: 13, lift: 2.2 },
  { id: 'dasenshan', zh: '大森山', tao: '', x: -3, z: -12, lift: 2.2 },
  { id: 'qingqing', zh: '青青草原', tao: '', x: -31, z: 29.5, lift: 1.6 },
  { id: 'battleship', zh: '軍艦岩', tao: '', x: -45.5, z: -19, lift: 3.2 },
  { id: 'twinlions', zh: '雙獅岩', tao: '', x: -16.2, z: -35.2, lift: 3.0 },
];
