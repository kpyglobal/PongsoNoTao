// dev: raster the layout (coast, village structures, taro fields, roads, facilities) to a PNG for tuning
//   npx esbuild scripts/dev/layout-png.ts --bundle --platform=node --format=esm --outfile=/tmp/lp.mjs && node /tmp/lp.mjs out.png [x0 z0 x1 z1 px/m]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { VILLAGE_DEFS, villageStructures, TARO_FIELDS, fieldLocal, ROADS, facilityBoxes, LANDMARKS, LAKES, FOOTPRINT } from '../../src/world/layout';
import { coastSdf } from '../../src/world/coast';
import { footpaths } from '../../src/world/height';
const [file = '/tmp/layout.png', ...nums] = process.argv.slice(2);
const [x0, z0, x1, z1, ppm] = nums.length ? nums.map(Number) : [-80, -75, 80, 105, 4];
const W = Math.round((x1 - x0) * ppm), H = Math.round((z1 - z0) * ppm);
const img = new Uint8Array(W * H * 3);
const put = (px: number, py: number, c: number[]) => { if (px < 0 || py < 0 || px >= W || py >= H) return; const o = (py * W + px) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; };
const all: any[] = [];
for (const v of VILLAGE_DEFS) all.push(...villageStructures(v, undefined, all));
const segD = (x: number, z: number) => { let b = 1e9; for (const pl of ROADS) for (let i = 0; i < pl.length - 1; i++) { const [ax, az] = pl[i], [bx, bz] = pl[i + 1]; const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)); b = Math.min(b, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return b; };
const inBox = (o: any, x: number, z: number) => { const c = Math.cos(o.yaw), s = Math.sin(o.yaw); const dx = x - o.x, dz = z - o.z; return Math.abs(dx * c - dz * s) <= o.hw && Math.abs(dx * s + dz * c) <= o.hd; };
const fac = facilityBoxes();
for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
  const x = x0 + px / ppm, z = z0 + py / ppm;
  let c = coastSdf(x, z) > 0 ? [170, 190, 140] : [70, 110, 160];
  if (Math.abs(x % 10) < 0.5 / ppm || Math.abs(z % 10) < 0.5 / ppm) c = c.map((v) => v * 0.8);
  for (const f of TARO_FIELDS) { const q = fieldLocal(f, x, z); if (Math.abs(q.u) < (f.tiers * f.cellU) / 2 && Math.abs(q.v) < (f.cols * f.cellV) / 2) c = [60, 120, 60]; }
  for (const l of LAKES) if (Math.hypot(x - l.x, z - l.z) < l.r) c = [40, 90, 200];
  const rd = segD(x, z);
  if (rd < 1.3) c = [235, 225, 200];
  for (const st of all) if (inBox({ ...st, ...FOOTPRINT[st.kind as keyof typeof FOOTPRINT] }, x, z)) c = st.kind === 'vahey' ? [120, 80, 50] : st.kind === 'tagakal' ? [200, 150, 60] : [150, 60, 60];
  for (const o of fac) if (inBox(o, x, z)) c = [90, 60, 160];
  put(px, py, c);
}
if (process.env.FOOT) {
  const t0 = Date.now();
  const fp = footpaths();
  console.log('paths', fp.paths.length, 'failed', fp.failed.length, fp.failed.join(' '), (Date.now() - t0) + 'ms');
  for (const p of fp.paths) for (const q of p.pts) { const cx = Math.round((q.x - x0) * ppm), cy = Math.round((q.z - z0) * ppm); const r = Math.max(1, Math.round(0.5 * ppm)); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (a * a + b * b <= r * r) put(cx + a, cy + b, [250, 200, 40]); }
}
for (const l of LANDMARKS) { const p = l.at ?? l; const cx = Math.round((p.x - x0) * ppm), cy = Math.round((p.z - z0) * ppm); for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) put(cx + a, cy + b, l.at ? [255, 0, 255] : [20, 20, 20]); }
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cc]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote', file, W, H);
process.exit(0);
