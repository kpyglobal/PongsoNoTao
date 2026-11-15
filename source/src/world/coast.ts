/**
 * 0.1.4: the real 蘭嶼 coastline (outline.ts) as a smooth signed-distance field, plus helpers to walk
 * along the coast. Used by the heightfield (coast shape), the layout (villages, ring road links,
 * airport, harbour) and the scatter loops (island bounding box).
 * Pure + deterministic, so the game and the node audit scripts agree.
 */
import { LANYU_OUTLINE } from './outline';

const PTS: [number, number][] = [];
for (let i = 0; i < LANYU_OUTLINE.length; i += 2) PTS.push([LANYU_OUTLINE[i], LANYU_OUTLINE[i + 1]]);
const N = PTS.length;

/** exact signed distance to the outline polygon, positive inland */
export function polySdf(x: number, z: number): number {
  let best = Infinity;
  let inside = false;
  for (let i = 0, j = N - 1; i < N; j = i++) {
    const [ax, az] = PTS[j];
    const [bx, bz] = PTS[i];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    const dx = bx - ax;
    const dz = bz - az;
    const L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return inside ? best : -best;
}

let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
for (const [x, z] of PTS) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }
/** the island's bounding box plus a little reef (scatter loops sample inside it) */
export const ISLAND_BOX = { xMin: Math.floor(bx0 - 4), xMax: Math.ceil(bx1 + 4), zMin: Math.floor(bz0 - 4), zMax: Math.ceil(bz1 + 4) };

// blurred SDF grid: rounds the outline's corners and small notches (1 m cells)
const G0X = ISLAND_BOX.xMin - 24;
const G0Z = ISLAND_BOX.zMin - 24;
const GNX = Math.ceil(ISLAND_BOX.xMax + 24 - G0X) + 1;
const GNZ = Math.ceil(ISLAND_BOX.zMax + 24 - G0Z) + 1;
let SDF: Float32Array<ArrayBufferLike> | null = null;
/** heavily blurred copy for road / village lines (no spikes or small dents) */
let SDF_SMOOTH: Float32Array<ArrayBufferLike> | null = null;

function blur(src: Float32Array<ArrayBufferLike>, r: number): Float32Array<ArrayBufferLike> {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let j = 0; j < GNZ; j++) {
    for (let i = 0; i < GNX; i++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const ii = i + k; if (ii < 0 || ii >= GNX) continue; s += src[j * GNX + ii]; n++; }
      tmp[j * GNX + i] = s / n;
    }
  }
  for (let j = 0; j < GNZ; j++) {
    for (let i = 0; i < GNX; i++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const jj = j + k; if (jj < 0 || jj >= GNZ) continue; s += tmp[jj * GNX + i]; n++; }
      out[j * GNX + i] = s / n;
    }
  }
  return out;
}

function sdfGrid(): Float32Array<ArrayBufferLike> {
  if (SDF) return SDF;
  let g: Float32Array<ArrayBufferLike> = new Float32Array(GNX * GNZ);
  for (let j = 0; j < GNZ; j++) for (let i = 0; i < GNX; i++) g[j * GNX + i] = polySdf(G0X + i, G0Z + j);
  SDF = blur(blur(g, 2), 2);
  SDF_SMOOTH = blur(blur(blur(g, 4), 4), 4);
  return SDF;
}

function sampleGrid(g: Float32Array<ArrayBufferLike>, x: number, z: number): number {
  const fx = x - G0X;
  const fz = z - G0Z;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const k = j * GNX + i;
  const a = g[k] + (g[k + 1] - g[k]) * tx;
  const b = g[k + GNX] + (g[k + GNX + 1] - g[k + GNX]) * tx;
  return a + (b - a) * tz;
}

/** the smoother field, for laying out roads and village lines */
export function smoothSdf(x: number, z: number): number {
  const fx = x - G0X;
  const fz = z - G0Z;
  if (fx < 0 || fz < 0 || fx >= GNX - 1 || fz >= GNZ - 1) return polySdf(x, z);
  sdfGrid();
  return sampleGrid(SDF_SMOOTH!, x, z);
}

/** sea normal of the smoother field */
export function smoothNormal(x: number, z: number, h = 3): { x: number; z: number } {
  const gx = smoothSdf(x + h, z) - smoothSdf(x - h, z);
  const gz = smoothSdf(x, z + h) - smoothSdf(x, z - h);
  const L = Math.hypot(gx, gz) || 1;
  return { x: -gx / L, z: -gz / L };
}

/** smoothed signed distance to the coast (positive inland), metres */
export function coastSdf(x: number, z: number): number {
  const fx = x - G0X;
  const fz = z - G0Z;
  if (fx < 0 || fz < 0 || fx >= GNX - 1 || fz >= GNZ - 1) return polySdf(x, z);
  return sampleGrid(sdfGrid(), x, z);
}

/** unit vector pointing out to sea (minus the SDF gradient), averaged over a few metres */
export function seaNormal(x: number, z: number, h = 3): { x: number; z: number } {
  const gx = coastSdf(x + h, z) - coastSdf(x - h, z);
  const gz = coastSdf(x, z + h) - coastSdf(x, z - h);
  const L = Math.hypot(gx, gz) || 1;
  return { x: -gx / L, z: -gz / L };
}

// ---------------------------------------------------------------- arc length along the outline
const CUM: number[] = [0];
for (let i = 0; i < N; i++) {
  const [ax, az] = PTS[i];
  const [bx, bz] = PTS[(i + 1) % N];
  CUM.push(CUM[i] + Math.hypot(bx - ax, bz - az));
}
export const COAST_LEN = CUM[N];
/** +1 when increasing arc length runs clockwise on the map (north up: W → N → E) */
export const ARC_CW: 1 | -1 = (() => {
  let a = 0;
  for (let i = 0; i < N; i++) { const [x1, z1] = PTS[i]; const [x2, z2] = PTS[(i + 1) % N]; a += x1 * z2 - x2 * z1; }
  // shoelace in (x east, z south): a > 0 is clockwise as seen on a north-up map
  return a > 0 ? 1 : -1;
})();

/** point on the raw outline at arc length t (wraps) */
export function coastPoint(t: number): { x: number; z: number } {
  t = ((t % COAST_LEN) + COAST_LEN) % COAST_LEN;
  let i = 0;
  while (i < N - 1 && CUM[i + 1] < t) i++;
  const [ax, az] = PTS[i];
  const [bx, bz] = PTS[(i + 1) % N];
  const L = CUM[i + 1] - CUM[i] || 1;
  const u = (t - CUM[i]) / L;
  return { x: ax + (bx - ax) * u, z: az + (bz - az) * u };
}

/** arc length of the outline point nearest to (x, z) */
export function coastParam(x: number, z: number): number {
  let best = Infinity;
  let bt = 0;
  for (let i = 0; i < N; i++) {
    const [ax, az] = PTS[i];
    const [bx, bz] = PTS[(i + 1) % N];
    const dx = bx - ax;
    const dz = bz - az;
    const L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; bt = CUM[i] + t * Math.sqrt(L); }
  }
  return bt;
}

/** clockwise arc distance from a to b (0 … COAST_LEN) */
export function cwDist(a: number, b: number): number {
  const d = ((b - a) * ARC_CW) % COAST_LEN;
  return d < 0 ? d + COAST_LEN : d;
}

/**
 * the point `inset` metres inland of the coast at arc t: marches in along the sea normal to that level
 * of the smoother field (so roads and village lines skip the outline's spikes and small dents)
 */
export function insetPoint(t: number, inset: number): { x: number; z: number } {
  const c = coastPoint(t);
  let x = c.x;
  let z = c.z;
  for (let k = 0; k < 80; k++) {
    const d = smoothSdf(x, z) - inset;
    if (Math.abs(d) < 0.05) break;
    const n = smoothNormal(x, z, 1.5);
    x += n.x * d * 0.8;
    z += n.z * d * 0.8;
  }
  return { x, z };
}
