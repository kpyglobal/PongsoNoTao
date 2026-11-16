/**
 * Measure how bumpy the 環島公路 centreline is (height along the road).
 * Used to compare before/after road smoothing. Prints RMS / p95 / max of
 * slope (dh/ds) and of the residual against an 8 m moving average (the
 * short-wavelength "jitter" the player feels), plus a few steep spots.
 */
import { getHeight, roadPolylines, WATER_LEVEL, distToRing, ALL_STRUCTURES } from '../../src/world/height';
import { canStand, PLAYER_RADIUS, surfaceHeight } from '../../src/world/collision';
import { LANDMARKS, facilityBoxes } from '../../src/world/layout';

const DS = 0.25;
const WIN = 8; // m, moving-average window for the residual

export interface BumpReport {
  n: number;
  length: number;
  hMin: number;
  hMax: number;
  rmsSlope: number;
  p95Slope: number;
  maxSlope: number;
  rmsResidual: number;
  p95Residual: number;
  maxResidual: number;
  steep: { x: number; z: number; slope: number; h: number }[];
  /** 0.1.5: where the residual is over 0.5 m (first 12) */
  residualAt: { x: number; z: number; r: number }[];
  wet: number;
  unwalkable: number;
  buildingShift: { id: string; h: number }[];
  unwalkAt: { x: number; z: number }[];
}

function densify(): { x: number; z: number; s: number; closed: boolean; line: number }[] {
  const out: { x: number; z: number; s: number; closed: boolean; line: number }[] = [];
  let line = -1;
  for (const pl of roadPolylines()) {
    line++;
    const closed = Math.hypot(pl[0][0] - pl[pl.length - 1][0], pl[0][1] - pl[pl.length - 1][1]) < 0.4;
    let s = 0;
    for (let i = 0; i < pl.length - 1; i++) {
      const [ax, az] = pl[i], [bx, bz] = pl[i + 1];
      const L = Math.hypot(bx - ax, bz - az) || 1e-6;
      const steps = Math.max(1, Math.round(L / DS));
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        out.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, s, closed, line });
        s += L / steps;
      }
    }
    const last = pl[pl.length - 1];
    out.push({ x: last[0], z: last[1], s, closed, line });
  }
  return out;
}

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[i];
}

export function measureBumps(): BumpReport {
  const pts = densify();
  const h = pts.map((p) => getHeight(p.x, p.z));
  const slopes: number[] = [];
  const steep: BumpReport['steep'] = [];
  let wet = 0, unwalkable = 0;
  const unwalkAt: { x: number; z: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i + 1].line !== pts[i].line || pts[i + 1].s <= pts[i].s) continue; // new polyline
    const ds = pts[i + 1].s - pts[i].s;
    const sl = Math.abs(h[i + 1] - h[i]) / ds;
    slopes.push(sl);
    if (sl > 0.18) steep.push({ x: pts[i].x, z: pts[i].z, slope: sl, h: h[i] });
    if (h[i] < WATER_LEVEL + 0.2) wet++;
    if (distToRing(pts[i].x, pts[i].z) < 0.4 && !canStand(pts[i].x, pts[i].z, PLAYER_RADIUS)) { unwalkable++; if (unwalkAt.length < 12) unwalkAt.push({ x: +pts[i].x.toFixed(1), z: +pts[i].z.toFixed(1) }); }
  }
  // residual vs 8 m moving average (short bumps)
  const residual: number[] = [];
  const residualAt: { x: number; z: number; r: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const s0 = pts[i].s;
    let w = 0, acc = 0;
    for (let j = i; j < pts.length && pts[j].line === pts[i].line && pts[j].s - s0 <= WIN; j++) {
      const k = 1 - Math.abs(pts[j].s - s0) / WIN;
      acc += h[j] * k; w += k;
    }
    for (let j = i - 1; j >= 0 && pts[j].line === pts[i].line && s0 - pts[j].s <= WIN; j--) {
      const k = 1 - Math.abs(pts[j].s - s0) / WIN;
      acc += h[j] * k; w += k;
    }
    if (w > 0) { const r = Math.abs(h[i] - acc / w); residual.push(r); if (r > 0.5 && residualAt.length < 12) residualAt.push({ x: +pts[i].x.toFixed(1), z: +pts[i].z.toFixed(1), r: +r.toFixed(2) }); }
  }
  const ss = [...slopes].sort((a, b) => a - b);
  const rs = [...residual].sort((a, b) => a - b);
  const rms = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / Math.max(1, a.length));
  const buildingShift = [
    ...ALL_STRUCTURES.slice(0, 8).map((s) => ({ id: `${s.kind}@${s.x.toFixed(1)},${s.z.toFixed(1)}`, h: surfaceHeight(s.x, s.z) })),
    ...facilityBoxes().map((b, i) => ({ id: `facility:${i}`, h: surfaceHeight(b.x, b.z) })),
    ...LANDMARKS.filter((l) => l.at).map((l) => ({ id: l.id, h: surfaceHeight(l.at!.x, l.at!.z) })),
  ];
  steep.sort((a, b) => b.slope - a.slope);
  return {
    n: pts.length,
    length: pts.reduce((L, p, i) => L + (i && p.s > pts[i - 1].s ? p.s - pts[i - 1].s : 0), 0),
    hMin: Math.min(...h),
    hMax: Math.max(...h),
    rmsSlope: rms(slopes),
    p95Slope: pct(ss, 95),
    maxSlope: ss[ss.length - 1] ?? 0,
    rmsResidual: rms(residual),
    p95Residual: pct(rs, 95),
    maxResidual: rs[rs.length - 1] ?? 0,
    steep: steep.slice(0, 8),
    residualAt,
    wet,
    unwalkable,
    unwalkAt,
    buildingShift,
  };
}

const r = measureBumps();
const f = (n: number, d = 4) => n.toFixed(d);
console.log(JSON.stringify({
  n: r.n,
  length_m: +r.length.toFixed(1),
  hRange: [+f(r.hMin, 3), +f(r.hMax, 3)],
  slope: { rms: +f(r.rmsSlope), p95: +f(r.p95Slope), max: +f(r.maxSlope) },
  residual_vs_8m: { rms: +f(r.rmsResidual), p95: +f(r.p95Residual), max: +f(r.maxResidual) },
  wet: r.wet,
  unwalkable: r.unwalkable,
  unwalkableAt: r.unwalkAt,
  residualAt: r.residualAt,
  steepest: r.steep.map((s) => ({ x: +s.x.toFixed(1), z: +s.z.toFixed(1), slope: +s.slope.toFixed(3), h: +s.h.toFixed(2) })),
  buildings: r.buildingShift,
}, null, 2));
