/**
 * 0.1.6 tap-to-walk: a short path (≤ ~12 m away) from the player to a tapped NPC or material, found with A* on a
 * 0.5 m grid of standable ground (the same collision the stick uses: buildings, walls, water, steep slopes).
 * The grid covers only the box around the two points (+6 m), so a search is a few thousand cells at most.
 */
export type StandFn = (x: number, z: number) => boolean;

const CELL = 0.5;
const PAD = 6;

/**
 * path from (sx, sz) to any cell within `reach` of (gx, gz); null when there is none.
 * Returned points are cell centres with straight runs merged, ending at the reached cell.
 */
export function findWalkPath(sx: number, sz: number, gx: number, gz: number, reach: number, stand: StandFn): { x: number; z: number }[] | null {
  const x0 = Math.min(sx, gx) - PAD;
  const z0 = Math.min(sz, gz) - PAD;
  const W = Math.ceil((Math.max(sx, gx) + PAD - x0) / CELL) + 1;
  const H = Math.ceil((Math.max(sz, gz) + PAD - z0) / CELL) + 1;
  if (W * H > 40000) return null;
  const cx = (i: number): number => x0 + i * CELL;
  const cz = (j: number): number => z0 + j * CELL;
  const ok = new Int8Array(W * H); // 0 unknown, 1 open, -1 blocked
  const open = (i: number, j: number): boolean => {
    if (i < 0 || j < 0 || i >= W || j >= H) return false;
    const k = j * W + i;
    if (!ok[k]) ok[k] = stand(cx(i), cz(j)) ? 1 : -1;
    return ok[k] === 1;
  };
  const si = Math.round((sx - x0) / CELL);
  const sj = Math.round((sz - z0) / CELL);
  const g = new Float32Array(W * H).fill(Infinity);
  const from = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const h = (i: number, j: number): number => Math.max(0, Math.hypot(cx(i) - gx, cz(j) - gz) - reach);
  // small binary heap of [f, k]
  const heap: [number, number][] = [];
  const push = (f: number, k: number): void => {
    heap.push([f, k]);
    let n = heap.length - 1;
    while (n > 0) { const p = (n - 1) >> 1; if (heap[p][0] <= heap[n][0]) break; [heap[p], heap[n]] = [heap[n], heap[p]]; n = p; }
  };
  const pop = (): [number, number] | undefined => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      heap[0] = last;
      let n = 0;
      for (;;) {
        const l = n * 2 + 1, r = l + 1;
        let m = n;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === n) break;
        [heap[m], heap[n]] = [heap[n], heap[m]];
        n = m;
      }
    }
    return top;
  };
  const sk = sj * W + si;
  g[sk] = 0;
  push(h(si, sj), sk);
  let goal = -1;
  let steps = 0;
  while (heap.length && steps++ < 20000) {
    const [, k] = pop()!;
    if (closed[k]) continue;
    closed[k] = 1;
    const i = k % W;
    const j = (k - i) / W;
    if (Math.hypot(cx(i) - gx, cz(j) - gz) <= reach) { goal = k; break; }
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (!open(ni, nj)) continue;
        // no corner cutting past a blocked cell
        if (di && dj && (!open(i + di, j) || !open(i, j + dj))) continue;
        const nk = nj * W + ni;
        const ng = g[k] + (di && dj ? 1.4142 : 1);
        if (ng < g[nk]) {
          g[nk] = ng;
          from[nk] = k;
          push(ng + h(ni, nj) / CELL, nk);
        }
      }
    }
  }
  if (goal < 0) return null;
  const cells: { x: number; z: number }[] = [];
  for (let k = goal; k >= 0 && k !== sk; k = from[k]) {
    const i = k % W;
    cells.push({ x: cx(i), z: cz((k - i) / W) });
  }
  cells.reverse();
  // merge straight runs: keep a point only where the walk can't go straight past it
  const out: { x: number; z: number }[] = [];
  let ax = sx, az = sz;
  for (let n = 0; n < cells.length; n++) {
    const next = cells[n + 1];
    if (next && clearLine(ax, az, next.x, next.z, stand)) continue;
    out.push(cells[n]);
    ax = cells[n].x;
    az = cells[n].z;
  }
  return out;
}

function clearLine(ax: number, az: number, bx: number, bz: number, stand: StandFn): boolean {
  const L = Math.hypot(bx - ax, bz - az);
  const n = Math.ceil(L / 0.25);
  for (let s = 1; s < n; s++) if (!stand(ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n)) return false;
  return true;
}
