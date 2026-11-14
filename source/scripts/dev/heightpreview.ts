import { grid, GRID_NX, GRID_NZ, sample, getHeight, TERRAIN_BOX } from '../../src/world/height';
import { VILLAGE_DEFS, villageStructures, TARO_FIELDS } from '../../src/world/layout';
import fs from 'node:fs';
const t0 = Date.now();
const g = grid();
console.log('grid ms', Date.now() - t0);
let mx = -1e9, mn = 1e9;
for (const v of g.h) { mx = Math.max(mx, v); mn = Math.min(mn, v); }
console.log('h range', mn, mx);
// write PPM shaded preview
const W = GRID_NX, H = GRID_NZ;
const buf = Buffer.alloc(W * H * 3);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const k = j * W + i; const h = g.h[k];
  const hl = g.h[j * W + Math.max(0, i - 1)], hu = g.h[Math.max(0, j - 1) * W + i];
  const shade = Math.max(0.3, Math.min(1.4, 1 + (h - hl) * 0.9 + (h - hu) * 0.5));
  let c: number[];
  if (h < 0) c = [30, 80 + 120 * Math.max(0, 1 + h / 7), 160];
  else if (g.road[k] > 0.5) c = [200, 190, 170];
  else if (g.terrace[k] > 0.3) c = [90, 140, 170];
  else if (g.pit[k] > 0.3) c = [120, 60, 40];
  else if (g.forest[k] > 0.5) c = [40, 90, 40];
  else if (g.slope[k] > 1.2) c = [70, 65, 60];
  else c = [90 + h * 8, 150 + h * 3, 70];
  buf[k * 3] = Math.min(255, c[0] * shade); buf[k * 3 + 1] = Math.min(255, c[1] * shade); buf[k * 3 + 2] = Math.min(255, c[2] * shade);
}
fs.writeFileSync('/tmp/hp.ppm', Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), buf]));
for (const v of VILLAGE_DEFS) {
  const ss = villageStructures(v);
  const bad = ss.filter((s) => { const q = sample(s.x, s.z); return q.mask < 0.9 || q.height < 0.2; });
  console.log(v.id, 'plaza h', getHeight(v.cx, v.cz).toFixed(2), 'structs', ss.length, 'bad', bad.map((b) => `${b.kind}@${b.x.toFixed(1)},${b.z.toFixed(1)} h=${getHeight(b.x, b.z).toFixed(2)}`).join(' '));
}
for (const f of TARO_FIELDS) console.log(f.id, 'top', f.top.toFixed(2), 'center h', getHeight(f.cx, f.cz).toFixed(2));
console.log(TERRAIN_BOX);
import { FACILITIES } from '../../src/world/layout';
console.log('clinic', FACILITIES.clinic, 'h', getHeight(FACILITIES.clinic.x, FACILITIES.clinic.z).toFixed(2), sample(FACILITIES.clinic.x, FACILITIES.clinic.z).mask.toFixed(2));
const R = FACILITIES.runway;
for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const x = R.x + dx * R.hx, z = R.z + dz * R.hz; console.log('runway corner', x, z, getHeight(x, z).toFixed(2), sample(x, z).mask.toFixed(2)); }
console.log('terminal h', getHeight(FACILITIES.terminal.x, FACILITIES.terminal.z).toFixed(2));
for (const f of TARO_FIELDS) console.log(f.id, f.cx.toFixed(1), f.cz.toFixed(1));
