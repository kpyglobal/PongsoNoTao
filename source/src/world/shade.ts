/**
 * Cheap "shade zones" for the unlit character sprites: precomputed boxes (eaves / building sides)
 * and discs (tree canopies), bucketed in a coarse grid. Characters query shadeAt() once per frame
 * and dim their tint toward ~0.75 — no real-time shadow maps for sprites.
 */
import { ALL_STRUCTURES } from './height';
import { FACILITIES } from './layout';
import { FOOT } from './collision';

interface Box { x: number; z: number; c: number; s: number; hw: number; hd: number }
interface Circ { x: number; z: number; r: number }

const CELL = 6;
const FEATHER = 0.45; // soft edge (world units) so the tint fades in / out smoothly
const boxes: Box[] = [];
const circs: Circ[] = [];
const grid = new Map<number, { b: number[]; c: number[] }>();
let built = false;

const key = (i: number, j: number): number => (i + 512) * 2048 + (j + 512);
function bucket(x0: number, z0: number, x1: number, z1: number, fn: (cell: { b: number[]; c: number[] }) => void): void {
  for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
    for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
      const k = key(i, j);
      let cell = grid.get(k);
      if (!cell) grid.set(k, (cell = { b: [], c: [] }));
      fn(cell);
    }
  }
}

function addBox(x: number, z: number, yaw: number, hw: number, hd: number): void {
  const idx = boxes.length;
  boxes.push({ x, z, c: Math.cos(yaw), s: Math.sin(yaw), hw, hd });
  const r = Math.hypot(hw, hd) + FEATHER;
  bucket(x - r, z - r, x + r, z + r, (cell) => cell.b.push(idx));
}

function addCirc(x: number, z: number, r: number): void {
  const idx = circs.length;
  circs.push({ x, z, r });
  const R = r + FEATHER;
  bucket(x - R, z - R, x + R, z + R, (cell) => cell.c.push(idx));
}

/**
 * Build once after flora is registered. Buildings: footprint + a narrow eave band (0.25–0.55
 * around the walls). Trees: only the big canopies (tree / palm).
 */
export function buildShade(trees: readonly { kind: string; x: number; z: number; h: number }[]): void {
  if (built) return;
  built = true;
  for (const st of ALL_STRUCTURES) {
    const f = FOOT[st.kind];
    // narrow eave bands so only characters right under / against a building dim (not whole villages)
    const eave = st.kind === 'vahey' ? 0.25 : st.kind === 'makarang' || st.kind === 'tagakal' ? 0.4 : 0.55;
    addBox(st.x, st.z, st.yaw, f.hw + eave, f.hd + eave);
  }
  const cl = FACILITIES.clinic;
  addBox(cl.x, cl.z, cl.yaw, 3.0 + 0.55, 1.9 + 0.55);
  const h = FACILITIES.harbor;
  addBox(h.x + 1.5 - 0.8, h.z + 2.6, 0, 1.25 + 0.5, 1.05 + 0.5);
  for (const t of trees) {
    if (t.kind === 'palm' && t.h >= 3.2) addCirc(t.x, t.z, 0.85);
    else if ((t.kind === 'tree_a' || t.kind === 'tree_b') && t.h >= 2.4) addCirc(t.x, t.z, Math.min(1.0, 0.28 * t.h));
  }
}

const smooth = (e: number): number => {
  const t = Math.max(0, Math.min(1, e));
  return t * t * (3 - 2 * t);
};

/** 0 = full sun, 1 = fully inside a shade zone (soft-edged). */
export function shadeAt(x: number, z: number): number {
  const cell = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!cell) return 0;
  let best = 0;
  for (const i of cell.b) {
    const b = boxes[i];
    const dx = x - b.x;
    const dz = z - b.z;
    const lx = Math.abs(dx * b.c - dz * b.s) - b.hw;
    const lz = Math.abs(dx * b.s + dz * b.c) - b.hd;
    const out = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0);
    best = Math.max(best, smooth(-out / FEATHER + 1));
    if (best >= 1) return 1;
  }
  for (const i of cell.c) {
    const c = circs[i];
    const d = Math.hypot(x - c.x, z - c.z) - c.r;
    best = Math.max(best, smooth(-d / FEATHER + 1));
    if (best >= 1) return 1;
  }
  return best;
}

export function shadeStats(): { boxes: number; trees: number } {
  return { boxes: boxes.length, trees: circs.length };
}
