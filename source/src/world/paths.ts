/**
 * 0.1.5: footpaths (小徑) from every building's door to the road network.
 *
 * Pure 2D planning (no height grid needed, so height.ts can shape the ground along the result): a small grid
 * A* per building from just outside its door to the nearest road bed or an already planned path, keeping the
 * walk clear of every building box, facility box and blocked spot (water, taro basins, lakes, rocks).
 */
import type { Box2 } from './layout';

export interface PathTarget {
  /** e.g. `vahey:yayo:-58.1,-12.4` */
  id: string;
  box: Box2;
  /** door point (path start); when absent the box side nearest the road is used */
  door?: { x: number; z: number };
}
export interface Footpath {
  id: string;
  /** door → road (or another path), ~0.4 m apart */
  pts: { x: number; z: number }[];
  /** joins: 'road' | id of the path it joins */
  joins: string;
}
export interface PathEnv {
  /** every solid box (buildings + facilities) */
  boxes: Box2[];
  /** extra blocked ground (sea, taro basins, lakes, rocks …) */
  blocked: (x: number, z: number) => boolean;
  /** distance to the nearest road centre line */
  roadDist: (x: number, z: number) => number;
  /** nearest road centre-line point */
  roadPoint: (x: number, z: number) => { x: number; z: number };
}

/** half width of the painted path (m) */
export const PATH_HALF = 0.55;
/** clearance from path centre to any building box (m) */
export const PATH_CLEAR = 0.6;
/** a path ends once it is this far onto the road bed */
const ON_ROAD = 0.9;
const CELL = 0.3;

/** distance from (x, z) to a box (0 inside) */
export function boxDist(b: Box2, x: number, z: number, grow = 0): number {
  const dx = x - b.x, dz = z - b.z;
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  const lx = Math.abs(dx * c - dz * s) - (b.hw + grow);
  const lz = Math.abs(dx * s + dz * c) - (b.hd + grow);
  return Math.hypot(Math.max(0, lx), Math.max(0, lz)) + Math.min(0, Math.max(lx, lz));
}

/** box sides' mid points `gap` outside it (local +Z = front first) */
export function boxSides(b: Box2, gap: number): { x: number; z: number; front: boolean }[] {
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  const at = (lx: number, lz: number, front: boolean) => ({ x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c, front });
  return [at(0, b.hd + gap, true), at(0, -b.hd - gap, false), at(b.hw + gap, 0, false), at(-b.hw - gap, 0, false)];
}

function nearestOnPaths(paths: Footpath[], x: number, z: number): { d: number; id: string; x: number; z: number } {
  let best = { d: Infinity, id: '', x, z };
  for (const p of paths) for (const q of p.pts) {
    const d = Math.hypot(q.x - x, q.z - z);
    if (d < best.d) best = { d, id: p.id, x: q.x, z: q.z };
  }
  return best;
}

function chaikin(pts: { x: number; z: number }[]): { x: number; z: number }[] {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    out.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function resample(pts: { x: number; z: number }[], ds: number): { x: number; z: number }[] {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    let t = ds - carry;
    while (t <= L) { out.push({ x: a.x + ((b.x - a.x) * t) / L, z: a.z + ((b.z - a.z) * t) / L }); t += ds; }
    carry = L - (t - ds);
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(tail.x - last.x, tail.z - last.z) > ds * 0.3) out.push(last);
  else out[out.length - 1] = last;
  return out.map((p) => ({ x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 }));
}

/**
 * Plan one path per target. Targets nearest the road go first, so back-row houses can join the path of the
 * house in front of them.
 */
export function planFootpaths(targets: PathTarget[], env: PathEnv): { paths: Footpath[]; failed: string[] } {
  const paths: Footpath[] = [];
  const failed: string[] = [];
  const doorOf = (t: PathTarget): { x: number; z: number } => {
    if (t.door) return t.door;
    const sides = boxSides(t.box, 0.45).filter((p) => !env.blocked(p.x, p.z));
    const all = sides.length ? sides : boxSides(t.box, 0.45);
    all.sort((a, b) => env.roadDist(a.x, a.z) - (a.front ? 1.5 : 0) - (env.roadDist(b.x, b.z) - (b.front ? 1.5 : 0)));
    return all[0];
  };
  const order = targets.map((t) => ({ t, d: doorOf(t) })).sort((a, b) => env.roadDist(a.d.x, a.d.z) - env.roadDist(b.d.x, b.d.z));

  for (const { t, d } of order) {
    const solid = (x: number, z: number, grow: number): boolean => {
      for (const b of env.boxes) {
        if (Math.abs(b.x - x) > 9 || Math.abs(b.z - z) > 9) continue;
        const g = b.x === t.box.x && b.z === t.box.z ? Math.min(grow, 0.45) : grow;
        if (boxDist(b, x, z, 0) < g) return true;
      }
      return env.blocked(x, z);
    };
    if (env.roadDist(d.x, d.z) <= ON_ROAD + 0.6) {
      const r = env.roadPoint(d.x, d.z);
      paths.push({ id: t.id, pts: resample([d, r], 0.4), joins: 'road' });
      continue;
    }
    let done: Footpath | null = null;
    for (const grow of [PATH_CLEAR, 0.45]) {
      done = astar(t.id, d, grow, solid, env, paths);
      if (done) break;
    }
    if (done) paths.push(done);
    else failed.push(t.id);
  }
  return { paths, failed };
}

function astar(
  id: string,
  d: { x: number; z: number },
  grow: number,
  solid: (x: number, z: number, grow: number) => boolean,
  env: PathEnv,
  paths: Footpath[],
): Footpath | null {
  const rp = env.roadPoint(d.x, d.z);
  const M = 9;
  const x0 = Math.min(d.x, rp.x) - M, x1 = Math.max(d.x, rp.x) + M;
  const z0 = Math.min(d.z, rp.z) - M, z1 = Math.max(d.z, rp.z) + M;
  const nx = Math.ceil((x1 - x0) / CELL) + 1, nz = Math.ceil((z1 - z0) / CELL) + 1;
  const N = nx * nz;
  const cx = (i: number) => x0 + i * CELL, cz = (j: number) => z0 + j * CELL;
  const block = new Uint8Array(N); // 0 free, 1 solid, 2 goal
  const near = new Float32Array(N); // extra cost close to solids (keep to the middle of a gap)
  // existing path points in the window
  const pp: { x: number; z: number; id: string }[] = [];
  for (const p of paths) for (const q of p.pts) if (q.x > x0 && q.x < x1 && q.z > z0 && q.z < z1) pp.push({ ...q, id: p.id });
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = cx(i), z = cz(j);
    if (env.roadDist(x, z) < ON_ROAD) { block[k] = 2; continue; }
    if (solid(x, z, grow)) { block[k] = 1; continue; }
    if (pp.some((q) => Math.abs(q.x - x) < 0.25 && Math.abs(q.z - z) < 0.25)) block[k] = 2;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (block[k] !== 0) continue;
    let c = 0;
    for (let r = 1; r <= 3 && !c; r++) {
      for (const [a, b] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        if (block[jj * nx + ii] === 1) { c = (4 - r) * 0.35; break; }
      }
    }
    near[k] = c;
  }
  const si = Math.round((d.x - x0) / CELL), sj = Math.round((d.z - z0) / CELL);
  const s = sj * nx + si;
  const g = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  // binary heap of [f, k]
  const heap: number[] = [];
  const hf: number[] = [];
  const push = (k: number, f: number): void => {
    heap.push(k); hf.push(f);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= hf[i]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]];
      i = p;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const lk = heap.pop()!, lf = hf.pop()!;
    if (heap.length) {
      heap[0] = lk; hf[0] = lf;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && hf[l] < hf[m]) m = l;
        if (r < heap.length && hf[r] < hf[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]];
        i = m;
      }
    }
    return top;
  };
  const hRoad = (k: number) => Math.max(0, env.roadDist(cx(k % nx), cz(Math.floor(k / nx))) - ON_ROAD);
  g[s] = 0;
  push(s, hRoad(s));
  let goal = -1;
  const D8: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heap.length) {
    const k = pop();
    if (closed[k]) continue;
    closed[k] = 1;
    if (block[k] === 2) { goal = k; break; }
    const i = k % nx, j = (k - i) / nx;
    for (const [a, b, w] of D8) {
      const ii = i + a, jj = j + b;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const n = jj * nx + ii;
      if (closed[n] || block[n] === 1) continue;
      // no corner cutting past a solid cell
      if (a && b && (block[j * nx + ii] === 1 || block[jj * nx + i] === 1)) continue;
      const ng = g[k] + w * CELL * (1 + near[n]);
      if (ng < g[n]) { g[n] = ng; from[n] = k; push(n, ng + hRoad(n)); }
    }
  }
  if (goal < 0) return null;
  const cells: { x: number; z: number }[] = [];
  for (let k = goal; k >= 0; k = from[k]) cells.push({ x: cx(k % nx), z: cz(Math.floor(k / nx)) });
  cells.reverse();
  cells[0] = { x: d.x, z: d.z };
  // join: onto the road centre or the joined path point
  const end = cells[cells.length - 1];
  let joins = 'road';
  let tip: { x: number; z: number };
  if (env.roadDist(end.x, end.z) < ON_ROAD + 0.05) tip = env.roadPoint(end.x, end.z);
  else { const q = nearestOnPaths(paths, end.x, end.z); joins = q.id; tip = { x: q.x, z: q.z }; }
  cells.push(tip);
  // string-pull: keep the farthest visible cell (straight runs, fewer zig-zags)
  const clear = (a: { x: number; z: number }, b: { x: number; z: number }): boolean => {
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(L / 0.15);
    for (let q = 1; q < n; q++) {
      const x = a.x + ((b.x - a.x) * q) / n, z = a.z + ((b.z - a.z) * q) / n;
      if (env.roadDist(x, z) < ON_ROAD) continue;
      if (solid(x, z, grow)) return false;
    }
    return true;
  };
  const simple = [cells[0]];
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    while (j > i + 1 && !clear(cells[i], cells[j])) j--;
    simple.push(cells[j]);
    i = j;
  }
  let sm = chaikin(chaikin(simple));
  // keep the rounded corners only when they stay clear
  for (let q = 0; q < sm.length - 1; q++) if (!clear(sm[q], sm[q + 1])) { sm = simple; break; }
  return { id, pts: resample(sm, 0.4), joins };
}
