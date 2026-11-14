/**
 * Road / reachability audit on the real world data + collision code (bundled and run by
 * scripts/check-roads.mjs). Rasterises the walkable grid, flood-fills from the 開元港 spawn,
 * checks every quest target / NPC / POI is reachable and that no collider sits on a road corridor.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { TERRAIN_BOX, roadPolylines, getHeight, WATER_LEVEL, inTaroBasin } from '../../src/world/height';
import { canStand, findSafeStand, staticColliders, PLAYER_RADIUS, NPC_RADIUS } from '../../src/world/collision';
import { DROPPED, FACILITIES, LANDMARKS, TARO_FIELDS, VILLAGE_DEFS, vlocal } from '../../src/world/layout';
import { addQuestPlaces, hostPlaces, type PlaceLike } from '../../src/world/places';

export const ROAD_CLEAR = 1.5; // m each side of the centreline that must be free of colliders
const STEP = 0.25;

interface Target { id: string; kind: string; x: number; z: number; r: number }
export interface Report {
  spawn: { x: number; z: number };
  walkable: number;
  reached: number;
  unreachable: Target[];
  /** save migration: 0.1.0 standing spots whose 0.1.1 safe stand is cut off */
  strandings: { x: number; z: number; to: { x: number; z: number } }[];
  relocSamples: number;
  /** village buildings the placement resolver found no clear lot for (informational) */
  dropped: string[];
  roadBlocks: { what: string; x: number; z: number; clear: number }[];
  roadGaps: { x: number; z: number; why: string }[];
  layout: string[];
  targets: number;
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const L = dx * dx + dz * dz;
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
function roadDist(x: number, z: number): number {
  let best = Infinity;
  for (const pl of roadPolylines()) for (let i = 0; i < pl.length - 1; i++) best = Math.min(best, segDist(x, z, pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1]));
  return best;
}
/** min distance from the road centreline to a yawed box (0 when the line crosses it) */
function obbRoadClear(o: { x: number; z: number; yaw: number; hw: number; hd: number }): number {
  // sample the box outline + interior coarsely; exact enough at 0.1 m
  const c = Math.cos(o.yaw), s = Math.sin(o.yaw);
  let best = Infinity;
  const n = 12;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const lx = -o.hw + (2 * o.hw * i) / n, lz = -o.hd + (2 * o.hd * j) / n;
    // collision.ts localOn: lx = dx*c - dz*s, lz = dx*s + dz*c  → inverse
    const x = o.x + lx * c + lz * s, z = o.z - lx * s + lz * c;
    best = Math.min(best, roadDist(x, z));
  }
  return best;
}

import { loadContentNode } from './content-node';

export function loadJSON(p: string): any {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function collectTargets(root = 'content'): Target[] {
  const db = loadContentNode(root);
  const P: Record<string, PlaceLike> = JSON.parse(JSON.stringify(db.places));
  addQuestPlaces(P);
  const out: Target[] = [];
  const npcs = db.npcs;
  const homes = VILLAGE_DEFS.map((v) => v.id);
  const allP: Record<string, PlaceLike>[] = homes.map((h) => ({ ...P, ...(hostPlaces(P, h) ?? {}) }));
  // places: land ones must be walkable-reachable within 3 m; sea / islet ones are boat-only (skipped)
  for (const [id, p] of Object.entries(P)) {
    if (p.kind === 'sea' || p.kind === 'island') continue;
    if (id === 'hen_rock_bay' || id === 'yayo_dive') continue; // dive spots: quest radius below
    out.push({ id: `place:${id}`, kind: p.kind, x: p.x, z: p.z, r: 3 });
  }
  for (const [k, hp] of allP.entries()) {
    for (const id of ['host_home', 'host_taro', 'host_weave']) {
      const p = hp[id];
      out.push({ id: `place:${id}@${homes[k]}`, kind: 'host', x: p.x, z: p.z, r: 3 });
    }
  }
  // quest spot / photo steps (and member parts of split steps) with their trigger radius
  const resolve = (spot: string): { x: number; z: number }[] => {
    if (spot.startsWith('host_')) return allP.map((m) => m[spot]).filter(Boolean);
    if (P[spot]) return [P[spot]];
    const lm = LANDMARKS.find((l) => l.id === spot);
    return lm ? [lm] : [];
  };
  for (const q of db.quests) for (const step of q.steps) {
    const parts = [step, ...(step.tasks ?? [])];
    for (const st of parts) {
      if ((st.kind !== 'spot' && st.kind !== 'photo') || !st.spot) continue;
      const r = st.r ?? 6;
      const pts = resolve(st.spot);
      if (!pts.length) out.push({ id: `quest:${q.id}:${st.spot}:MISSING`, kind: 'quest', x: NaN, z: NaN, r });
      pts.forEach((p, i) => out.push({ id: `quest:${q.id}:${st.spot}${pts.length > 1 ? '@' + homes[i] : ''}`, kind: 'quest', x: p.x, z: p.z, r: r - 0.5 }));
    }
  }
  // gather / observe nodes (src/systems/gathering.ts)
  for (const n of db.gatherNodes) {
    const p = P[n.place];
    if (!p) { out.push({ id: `gather:${n.id}:MISSING`, kind: 'gather', x: NaN, z: NaN, r: n.r }); continue; }
    out.push({ id: `gather:${n.id}`, kind: 'gather', x: p.x + (n.ox ?? 0), z: p.z + (n.oz ?? 0), r: 1.2 }); // QA L6: the node centre (where its 採 marker sits) must be walkable, not just its edge
  }
  // NPCs: every schedule waypoint (where game.ts / npcs.ts stand them), talk range 2.4
  for (const n of npcs) {
    if (n.talkable === false) continue;
    const wps = new Set<string>([n.home, ...n.schedule.flatMap((s) => s.waypoints)]);
    for (const w of wps) {
      const variants = w.startsWith('host_') ? allP.map((m) => m[w]) : [P[w]];
      variants.forEach((p, i) => {
        if (!p) { out.push({ id: `npc:${n.id}@${w}:MISSING`, kind: 'npc', x: NaN, z: NaN, r: 2.4 }); return; }
        let x = p.x, z = p.z;
        if (w === 'clinic') { x += 0.2; z += 2.8; }
        else if (n.id.startsWith('elder_')) { x -= 1.4; z += 2.6; }
        const s = findSafeStand(x, z, NPC_RADIUS);
        out.push({ id: `npc:${n.id}@${w}${variants.length > 1 ? '/' + homes[i] : ''}`, kind: 'npc', x: s.x, z: s.z, r: 2.2 });
      });
    }
  }
  // world interactables (populate.ts buildInteractables)
  for (const v of VILLAGE_DEFS) out.push({ id: `poi:tribe-${v.id}`, kind: 'poi', x: v.cx, z: v.cz, r: 3.0 });
  const cl = FACILITIES.clinic;
  out.push({ id: 'poi:clinic-door', kind: 'poi', x: cl.x + Math.sin(cl.yaw) * 2.6, z: cl.z + Math.cos(cl.yaw) * 2.6, r: 3.2 });
  for (const f of TARO_FIELDS) {
    const u = (f.tiers * f.cellU) / 2 + 0.9;
    out.push({ id: `poi:taro-${f.id}`, kind: 'poi', x: f.cx + f.fx * u, z: f.cz + f.fz * u, r: 3.6 });
  }
  const h = FACILITIES.harbor;
  out.push({ id: 'poi:harbor-fish', kind: 'poi', x: h.x - 1, z: h.z, r: 4.0 });
  const im = VILLAGE_DEFS.find((v) => v.id === 'imorod')!;
  const look = vlocal(im, -2, 3.6);
  out.push({ id: 'poi:look-jimagaod', kind: 'poi', x: look.x, z: look.z, r: 4.3 });
  for (const lm of LANDMARKS) out.push({ id: `landmark:${lm.id}`, kind: 'landmark', x: lm.x, z: lm.z, r: 10 });
  return out;
}

export function harbourSpawn(): { x: number; z: number } {
  const P = loadContentNode().places;
  // game.ts startNew: player.spawn(harbor.x + 1.6, harbor.z + 1.2)
  return findSafeStand(P.harbor.x + 1.6, P.harbor.z + 1.2, PLAYER_RADIUS);
}

export function runAudit(opts: { png?: string } = {}): Report {
  const { xMin, zMin, xMax, zMax } = TERRAIN_BOX;
  const NX = Math.floor((xMax - xMin) / STEP) + 1;
  const NZ = Math.floor((zMax - zMin) / STEP) + 1;
  const walk = new Uint8Array(NX * NZ);
  let walkable = 0;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = xMin + i * STEP, z = zMin + j * STEP;
    if (getHeight(x, z) < WATER_LEVEL - 0.5 && Math.abs(x - FACILITIES.harbor.x) > 14) continue; // open sea fast-path
    if (canStand(x, z, PLAYER_RADIUS)) { walk[j * NX + i] = 1; walkable++; }
  }
  const spawn = harbourSpawn();
  const reach = new Uint8Array(NX * NZ);
  const si = Math.round((spawn.x - xMin) / STEP), sj = Math.round((spawn.z - zMin) / STEP);
  const q: number[] = [];
  // seed from the nearest walkable cell to the spawn
  let seed = -1, sd = Infinity;
  for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
    const k = (sj + dj) * NX + (si + di);
    if (walk[k] && di * di + dj * dj < sd) { sd = di * di + dj * dj; seed = k; }
  }
  if (seed >= 0) { reach[seed] = 1; q.push(seed); }
  while (q.length) {
    const k = q.pop()!;
    const i = k % NX, j = (k - i) / NX;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const nk = nj * NX + ni;
      if (reach[nk] || !walk[nk]) continue;
      if (di && dj && !(walk[j * NX + ni] && walk[nj * NX + i])) continue; // no corner cutting
      reach[nk] = 1;
      q.push(nk);
    }
  }
  let reached = 0;
  for (let k = 0; k < reach.length; k++) reached += reach[k];
  const reachableNear = (x: number, z: number, r: number): boolean => {
    if (!Number.isFinite(x)) return false;
    const ri = Math.ceil(r / STEP);
    const ci = Math.round((x - xMin) / STEP), cj = Math.round((z - zMin) / STEP);
    for (let dj = -ri; dj <= ri; dj++) for (let di = -ri; di <= ri; di++) {
      if (di * di + dj * dj > ri * ri) continue;
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      if (reach[nj * NX + ni]) return true;
    }
    return false;
  };
  const targets = collectTargets();
  const unreachable = targets.filter((t) => !reachableNear(t.x, t.z, t.r));

  // colliders on road corridors
  const roadBlocks: Report['roadBlocks'] = [];
  const col = staticColliders();
  for (const s of col.solids) {
    const c = obbRoadClear(s);
    if (c < ROAD_CLEAR) roadBlocks.push({ what: `box ${(s.hw * 2).toFixed(1)}x${(s.hd * 2).toFixed(1)}`, x: s.x, z: s.z, clear: c });
  }
  for (const d of col.discs) {
    const c = roadDist(d.x, d.z) - d.r;
    if (c < ROAD_CLEAR) roadBlocks.push({ what: `post r${d.r}`, x: d.x, z: d.z, clear: c });
  }
  // the road centreline itself must be walkable and connected to the spawn
  const roadGaps: Report['roadGaps'] = [];
  for (const pl of roadPolylines()) for (let i = 0; i < pl.length - 1; i++) {
    const [ax, az] = pl[i], [bx, bz] = pl[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t <= L; t += 0.5) {
      const x = ax + ((bx - ax) * t) / L, z = az + ((bz - az) * t) / L;
      if (!canStand(x, z, PLAYER_RADIUS)) roadGaps.push({ x, z, why: inTaroBasin(x, z) ? 'taro basin' : 'not standable' });
      else if (!reachableNear(x, z, 0.4)) roadGaps.push({ x, z, why: 'not connected to spawn' });
    }
  }
  // buildings: not standing in the sea, not overlapping each other
  const layout: string[] = [];
  const corners = (o: { x: number; z: number; yaw: number; hw: number; hd: number }, grow = 0) => {
    const c = Math.cos(o.yaw), s = Math.sin(o.yaw);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
      const lx = a * (o.hw + grow), lz = b * (o.hd + grow);
      return { x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c };
    });
  };
  const sat = (A: { x: number; z: number }[], B: { x: number; z: number }[]): boolean => {
    for (const P of [A, B]) for (let i = 0; i < 4; i++) {
      const p = P[i], q = P[(i + 1) % 4];
      const nx = -(q.z - p.z), nz = q.x - p.x;
      const pa = A.map((v) => v.x * nx + v.z * nz), pb = B.map((v) => v.x * nx + v.z * nz);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
    return true;
  };
  const S = col.solids;
  for (let i = 0; i < S.length; i++) {
    const wet = corners(S[i]).filter((p) => getHeight(p.x, p.z) < WATER_LEVEL + 0.05).length;
    // the harbour breakwater blocks stand in the sea by design
    const harbour = Math.hypot(S[i].x - FACILITIES.harbor.x, S[i].z - FACILITIES.harbor.z) < 18;
    if (wet >= 2 && !harbour) layout.push(`IN SEA box ${(S[i].hw * 2).toFixed(1)}x${(S[i].hd * 2).toFixed(1)} at (${S[i].x.toFixed(1)}, ${S[i].z.toFixed(1)}) — ${wet}/4 corners under water`);
    for (let j = i + 1; j < S.length; j++) {
      if (Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z) > 12) continue;
      if (harbour) continue;
      if (sat(corners(S[i]), corners(S[j]))) layout.push(`OVERLAP boxes at (${S[i].x.toFixed(1)}, ${S[i].z.toFixed(1)}) and (${S[j].x.toFixed(1)}, ${S[j].z.toFixed(1)})`);
    }
  }
  // save migration: fixtures/v010-spots.json = every spot a 0.1.0 player could stand on (1 m grid, flood-filled
  // from the spawn and all fast-travel points on the 0.1.0 world). Some are now inside a moved building, on a
  // dropped lot or under the new quay; resume() runs findSafeStand on the saved position, so every old spot must
  // land on ground connected to the rest of the island (not a pocket, like the 0.1.0 harbour).
  const strandings: Report['strandings'] = [];
  const oldSpots = loadJSON('scripts/dev/fixtures/v010-spots.json') as [number, number][];
  for (const [x, z] of oldSpots) {
    for (const r of [PLAYER_RADIUS, NPC_RADIUS]) {
      const to = findSafeStand(x, z, r);
      if (!canStand(to.x, to.z, r) || !reachableNear(to.x, to.z, 0.5)) { strandings.push({ x, z, to }); break; }
    }
  }
  const relocSamples = oldSpots.length;
  if (opts.png) writeMap(opts.png, { NX, NZ, walk, reach, targets, unreachable, roadBlocks, spawn });
  return { spawn, walkable, reached, unreachable, strandings, relocSamples, dropped: [...DROPPED], roadBlocks, roadGaps, layout, targets: targets.length };
}

// ------------------------------------------------------------------ top-down overlay PNG
function writeMap(file: string, d: { NX: number; NZ: number; walk: Uint8Array; reach: Uint8Array; targets: Target[]; unreachable: Target[]; roadBlocks: Report['roadBlocks']; spawn: { x: number; z: number } }): void {
  const { xMin, zMin } = TERRAIN_BOX;
  const S = 2; // px per cell
  const W = d.NX * S, H = d.NZ * S;
  const img = new Uint8Array(W * H * 3);
  const put = (px: number, py: number, r: number, g: number, b: number) => {
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    const o = (py * W + px) * 3; img[o] = r; img[o + 1] = g; img[o + 2] = b;
  };
  const toPx = (x: number, z: number) => [Math.round(((x - xMin) / STEP) * S), Math.round(((z - zMin) / STEP) * S)];
  for (let j = 0; j < d.NZ; j++) for (let i = 0; i < d.NX; i++) {
    const k = j * d.NX + i;
    const x = xMin + i * STEP, z = zMin + j * STEP;
    const h = getHeight(x, z);
    let c: [number, number, number] = h < 0 ? [40, 70, 120] : [150, 140, 110];
    if (d.walk[k]) c = [120, 165, 100];
    if (d.reach[k]) c = [90, 190, 90];
    if (roadDist(x, z) < 1.25) c = d.reach[k] ? [235, 225, 200] : [230, 120, 60];
    if (Math.abs(x / 5 - Math.round(x / 5)) < 0.03 || Math.abs(z / 5 - Math.round(z / 5)) < 0.03) c = c.map((v) => v * 0.8) as [number, number, number];
    if (Math.abs(x / 10 - Math.round(x / 10)) < 0.03 || Math.abs(z / 10 - Math.round(z / 10)) < 0.03) c = c.map((v) => v * 0.6) as [number, number, number];
    for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) put(i * S + a, j * S + b, ...c);
  }
  const col = staticColliders();
  const box = (o: { x: number; z: number; yaw: number; hw: number; hd: number }, rgb: [number, number, number]) => {
    const c = Math.cos(o.yaw), s = Math.sin(o.yaw);
    for (let lx = -o.hw; lx <= o.hw; lx += 0.08) for (const lz of [-o.hd, o.hd]) { const [px, py] = toPx(o.x + lx * c + lz * s, o.z - lx * s + lz * c); put(px, py, ...rgb); }
    for (let lz = -o.hd; lz <= o.hd; lz += 0.08) for (const lx of [-o.hw, o.hw]) { const [px, py] = toPx(o.x + lx * c + lz * s, o.z - lx * s + lz * c); put(px, py, ...rgb); }
  };
  for (const p of col.pads) box(p, [60, 60, 200]);
  for (const s of col.solids) box(s, [200, 30, 30]);
  for (const dd of col.discs) for (let a = 0; a < 6.3; a += 0.1) { const [px, py] = toPx(dd.x + Math.cos(a) * dd.r, dd.z + Math.sin(a) * dd.r); put(px, py, 200, 30, 30); }
  const dot = (x: number, z: number, rgb: [number, number, number], r = 3) => { const [px, py] = toPx(x, z); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (a * a + b * b <= r * r) put(px + a, py + b, ...rgb); };
  const bad = new Set(d.unreachable.map((t) => t.id));
  for (const t of d.targets) if (Number.isFinite(t.x)) dot(t.x, t.z, bad.has(t.id) ? [255, 0, 255] : [20, 20, 20], 2);
  for (const b of d.roadBlocks) dot(b.x, b.z, [255, 0, 0], 4);
  dot(d.spawn.x, d.spawn.z, [255, 255, 0], 5);
  fs.writeFileSync(file, encodePNG(W, H, img));
}

function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
