/**
 * Keep trees and tall flora off every building footprint, a margin around it,
 * and the entrance path, so each building stays visible from the default camera.
 */
import { ALL_STRUCTURES, TERRAIN_BOX, distToRing, distToPath, getHeight, sample } from './height';
import { CLINIC_FOOT, FACILITIES, JIMAGAOD, LANDMARKS, TERMINAL_FOOT } from './layout';
import { ISLAND_BOX as IB } from './coast';
import { rng } from './textures';
import { CAM_DEFAULT } from '../core/camera';

export type FloraHit = { kind: string; x: number; z: number; id: string; how: 'foot' | 'enter' | 'view' };

type BoxZone = { id: string; kind: 'box'; x: number; z: number; yaw: number; hw: number; hd: number; enter: number };
type DiscZone = { id: string; kind: 'disc'; x: number; z: number; r: number };
export type PlantZone = BoxZone | DiscZone;

const ROAD_PLANT_CLEAR = 2.4;
const AREA_K = ((IB.xMax - IB.xMin) * (IB.zMax - IB.zMin)) / (90 * 100);

export function isTallFlora(kind: string): boolean {
  return kind === 'tree_a' || kind === 'tree_b' || kind === 'palm' || kind === 'pandanus' || kind === 'bush';
}

function marginOf(kind: string): number {
  if (kind === 'tree_a' || kind === 'tree_b' || kind === 'palm' || kind === 'pandanus') return 3.6;
  if (kind === 'bush') return 1.8;
  return 0;
}

function enterOf(kind: string): number {
  if (kind === 'tree_a' || kind === 'tree_b' || kind === 'palm' || kind === 'pandanus') return 4.0;
  if (kind === 'bush') return 2.4;
  return 0;
}

let ZONES: PlantZone[] | null = null;

export function plantZones(): PlantZone[] {
  if (ZONES) return ZONES;
  const z: PlantZone[] = [];
  for (const s of ALL_STRUCTURES) {
    z.push({
      id: `${s.kind}:${s.village ?? ''}:${s.x.toFixed(1)},${s.z.toFixed(1)}`,
      kind: 'box', x: s.x, z: s.z, yaw: s.yaw, hw: s.hw, hd: s.hd, enter: 3.2,
    });
  }
  const cl = FACILITIES.clinic;
  z.push({ id: 'clinic', kind: 'box', x: cl.x, z: cl.z, yaw: cl.yaw, ...CLINIC_FOOT, enter: 3.6 });
  const t = FACILITIES.terminal;
  z.push({ id: 'terminal', kind: 'box', x: t.x, z: t.z, yaw: t.yaw, ...TERMINAL_FOOT, enter: 3.6 });
  const h = FACILITIES.harbor;
  const hx = h.x + 1.5;
  const hz = h.z;
  z.push({ id: 'harbor-office', kind: 'box', x: hx - 0.8, z: hz + 2.6, yaw: 0, hw: 1.25, hd: 1.05, enter: 2.8 });
  for (const l of LANDMARKS) {
    if (!l.at || !l.build) continue;
    const face = Math.atan2(l.x - l.at.x, l.z - l.at.z);
    if (l.build === 'station') z.push({ id: l.id, kind: 'box', x: l.at.x, z: l.at.z, yaw: face, hw: 1.45, hd: 1.2, enter: 4.2 });
    else if (l.build === 'lighthouse') z.push({ id: l.id, kind: 'disc', x: l.at.x, z: l.at.z, r: 1.3 });
    else if (l.build === 'falls') z.push({ id: l.id, kind: 'box', x: l.at.x, z: l.at.z, yaw: face, hw: 1.4, hd: 1.3, enter: 3.2 });
  }
  const jl = FACILITIES.jimagaodLight;
  z.push({ id: 'jimagaod-light', kind: 'disc', x: jl.x, z: jl.z, r: 0.8 });
  ZONES = z;
  return z;
}

/** True when this plant would sit on a building, its margin, or its entrance path. */
export function plantHitsBuilding(kind: string, x: number, z: number): FloraHit | null {
  const m = marginOf(kind);
  const enterWant = enterOf(kind);
  const footOnly = m <= 0;
  for (const zn of plantZones()) {
    if (zn.kind === 'disc') {
      const r = zn.r + (footOnly ? 0.15 : m);
      if (Math.hypot(x - zn.x, z - zn.z) <= r) return { kind, x, z, id: zn.id, how: 'foot' };
      continue;
    }
    const dx = x - zn.x;
    const dz = z - zn.z;
    const c = Math.cos(zn.yaw);
    const s = Math.sin(zn.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const hw = zn.hw + (footOnly ? 0.1 : m);
    const hd = zn.hd + (footOnly ? 0.1 : m);
    if (Math.abs(lx) <= hw && Math.abs(lz) <= hd) return { kind, x, z, id: zn.id, how: 'foot' };
    if (!footOnly && enterWant > 0) {
      const enter = Math.max(zn.enter, enterWant);
      if (Math.abs(lx) <= hw && lz > hd && lz <= hd + enter) return { kind, x, z, id: zn.id, how: 'enter' };
    }
  }
  return null;
}

export interface TallPlant { kind: 'bush' | 'tree_a' | 'tree_b' | 'palm' | 'pandanus'; x: number; z: number; h: number; tint?: number; tree?: boolean }

/**
 * The forest and palm scatter that island.ts plants (one source, so the view check sees exactly
 * the same plants). Random numbers are drawn in the same order as before 0.1.5.
 */
/** 0.1.5: trees / palms keep this far (m) from a footpath centre line */
export const PATH_PLANT_CLEAR = 1.5;

export function tallFloraScatter(): TallPlant[] {
  const out: TallPlant[] = [];
  const r = rng(1234);
  const { xMin, zMin, xMax, zMax } = TERRAIN_BOX;
  const step = 1.15;
  for (let z = zMin; z < zMax; z += step) {
    for (let x = xMin; x < xMax; x += step) {
      const jx = x + (r() - 0.5) * step * 0.9;
      const jz = z + (r() - 0.5) * step * 0.9;
      const s = sample(jx, jz);
      const dens = s.forest;
      if (dens < 0.08 || r() > dens * 1.05) continue;
      const h = getHeight(jx, jz);
      if (h < 1.2) continue;
      // 0.1.1: keep tree canopies off the road corridor
      if (distToRing(jx, jz) < ROAD_PLANT_CLEAR) continue;
      // 0.1.5: and off the footpaths
      if (distToPath(jx, jz) < PATH_PLANT_CLEAR) continue;
      const pick = r();
      const sc = 0.75 + dens * 0.55 + r() * 0.35;
      if (pick < 0.16) out.push({ kind: 'bush', x: jx, z: jz, h: 0.9 * sc, tint: 0.8 + r() * 0.25, tree: true });
      else if (pick < 0.42) out.push({ kind: 'tree_b', x: jx, z: jz, h: 3.0 * sc, tint: 0.78 + r() * 0.3, tree: true });
      else out.push({ kind: 'tree_a', x: jx, z: jz, h: 2.6 * sc, tint: 0.8 + r() * 0.3, tree: true });
      // understory bush on forest margins
      if (dens < 0.5 && r() < 0.25) {
        const bx = jx + (r() - 0.5) * 1.2;
        const bz = jz + (r() - 0.5) * 1.2;
        out.push({ kind: 'bush', x: bx, z: bz, h: 0.6 + r() * 0.4 });
      }
    }
  }
  const rp = rng(99);
  let tries = 0;
  while (tries++ < Math.round(9000 * AREA_K)) {
    const x = IB.xMin + rp() * (IB.xMax - IB.xMin);
    const z = IB.zMin + rp() * (IB.zMax - IB.zMin);
    const s = sample(x, z);
    if (s.mask < 0.8 || s.height < 0.35 || s.height > 2.6 || s.slope > 0.6 || s.road > 0.2 || s.cliff > 0.6) continue;
    if (distToRing(x, z) < ROAD_PLANT_CLEAR) continue;
    if (distToPath(x, z) < PATH_PLANT_CLEAR) continue;
    if (rp() > 0.008 + s.village * 0.03) continue;
    if (rp() < 0.6) out.push({ kind: 'palm', x, z, h: 3.4 + rp() * 1.3 });
    else out.push({ kind: 'pandanus', x, z, h: 1.7 + rp() * 0.7 });
  }
  // Jimagaod grove
  for (let i = 0; i < 6; i++) {
    const x = JIMAGAOD.x + (rp() - 0.5) * 9;
    const z = JIMAGAOD.z + (rp() - 0.5) * 7;
    const h = getHeight(x, z);
    if (h < 0.4 || h > 5) continue;
    out.push({ kind: i % 2 ? 'palm' : 'pandanus', x, z, h: i % 2 ? 3.8 : 1.9 });
  }
  return out;
}

// ---- 0.1.5 view check: from the default camera, a plant must not stand between the camera and a building ----

const ASPECT: Record<string, number> = { tree_a: 0.887, tree_b: 0.597, palm: 0.696, pandanus: 0.89, bush: 1.094 };
/** visible wall / roof height used for the view rays (m above the ground at the building) */
function zoneTop(id: string): number {
  if (id.startsWith('vahey')) return 1.2; // semi-sunken house: only the roof shows
  if (id.startsWith('tagakal')) return 2.2;
  if (id.startsWith('makarang')) return 2.4;
  if (id === 'lanyu_lighthouse' || id.includes('light')) return 4;
  return 2.6;
}

type Ray = { tx: number; ty: number; tz: number };
let VIEW: { zone: PlantZone; rays: Ray[]; strict: Ray[] }[] | null = null;
const CAM_DIR = { x: Math.sin(CAM_DEFAULT.yaw) * Math.cos(CAM_DEFAULT.pitch), y: Math.sin(CAM_DEFAULT.pitch), z: Math.cos(CAM_DEFAULT.yaw) * Math.cos(CAM_DEFAULT.pitch) };

function zonePoints(zn: PlantZone, k: number): { x: number; z: number }[] {
  if (zn.kind === 'disc') return [{ x: zn.x, z: zn.z }, { x: zn.x + zn.r * k, z: zn.z }, { x: zn.x - zn.r * k, z: zn.z }, { x: zn.x, z: zn.z + zn.r * k }, { x: zn.x, z: zn.z - zn.r * k }];
  const c = Math.cos(zn.yaw), s = Math.sin(zn.yaw);
  const w = (lx: number, lz: number) => ({ x: zn.x + lx * c + lz * s, z: zn.z - lx * s + lz * c });
  const a = zn.hw * k, b = zn.hd * k;
  return [w(0, 0), w(a, b), w(-a, b), w(a, -b), w(-a, -b), w(0, b), w(a, 0), w(-a, 0), w(0, -b)];
}

function viewRays(): NonNullable<typeof VIEW> {
  if (VIEW) return VIEW;
  VIEW = plantZones().map((zone) => {
    const top = zoneTop(zone.id);
    const g = getHeight(zone.x, zone.z);
    const mk = (k: number, fr: number[]) => zonePoints(zone, k).flatMap((p) => fr.map((f) => ({ tx: p.x, ty: Math.max(g, getHeight(p.x, p.z)) + top * f, tz: p.z })));
    // strict: what planting avoids (centre, door and corners at mid height); rays: what the audit counts
    // (0.1.5 map phase: planting avoids every audit ray too, so a building on a wooded slope stays in view)
    const rays = mk(0.8, [0.35, 0.65, 0.95]);
    return { zone, strict: [...mk(0.6, [0.5, 0.9]), ...rays], rays };
  });
  return VIEW;
}

/** Does a camera-facing plant billboard at (x, z), h tall, cover the line from this building point to the default camera? */
function blocks(r: Ray, x: number, z: number, h: number, kind: string): boolean {
  const rad = (h * (ASPECT[kind] ?? 0.9)) * 0.5 * 0.8; // canopy, a little inside the sprite edge
  // closest approach (horizontal) of the ray T + t·D (t ≥ 0, up to the camera distance) to the plant axis
  const dx = x - r.tx, dz = z - r.tz;
  const hl2 = CAM_DIR.x * CAM_DIR.x + CAM_DIR.z * CAM_DIR.z;
  let t = (dx * CAM_DIR.x + dz * CAM_DIR.z) / hl2;
  if (t <= 0) return false; // plant is behind the building as seen from the camera
  t = Math.min(t, CAM_DEFAULT.dist);
  const px = r.tx + CAM_DIR.x * t - x, pz = r.tz + CAM_DIR.z * t - z;
  if (px * px + pz * pz > rad * rad) return false;
  const y = r.ty + CAM_DIR.y * t;
  const g = getHeight(x, z) - 0.04;
  return y >= g && y <= g + h * 0.97;
}

/** 0.1.5: true when this plant would hide part of a building (centre, door or corners) from the default camera. */
export function plantBlocksView(kind: string, x: number, z: number, h: number): string | null {
  if (!isTallFlora(kind)) return null;
  for (const v of viewRays()) {
    const zx = v.zone.x - x, zz = v.zone.z - z;
    if (zx * zx + zz * zz > 32 * 32) continue;
    for (const r of v.strict) if (blocks(r, x, z, h, kind)) return v.zone.id;
  }
  return null;
}

/** Share of each building's view rays hidden by these plants (audit). */
export function buildingCover(plants: TallPlant[]): { id: string; hidden: number; rays: number }[] {
  return viewRays().map((v) => {
    const near = plants.filter((p) => (p.x - v.zone.x) ** 2 + (p.z - v.zone.z) ** 2 < 32 * 32);
    const hidden = v.rays.filter((r) => near.some((p) => blocks(r, p.x, p.z, p.h, p.kind))).length;
    return { id: v.zone.id, hidden, rays: v.rays.length };
  });
}

/** Max share of a building's view rays that may be hidden by plants before the check fails. */
export const MAX_COVER = 0.25;

/**
 * The building view check (scripts/check-roads.mjs): plants before / after the 0.1.5 clearing, and how much of
 * each building the default camera can't see. `hits` (buildings above MAX_COVER) must be empty.
 */
export function auditBuildingFlora(): {
  hits: (FloraHit & { cover: number })[];
  cleared: FloraHit[];
  attempts: number;
  coverBefore: Record<string, number>;
  coverAfter: Record<string, number>;
} {
  const all = tallFloraScatter();
  const cleared: FloraHit[] = [];
  const placed: TallPlant[] = [];
  for (const p of all) {
    const hit = plantHitsBuilding(p.kind, p.x, p.z);
    const view = hit ? null : plantBlocksView(p.kind, p.x, p.z, p.h);
    if (hit) cleared.push(hit);
    else if (view) cleared.push({ kind: p.kind, x: p.x, z: p.z, id: view, how: 'view' });
    else placed.push(p);
  }
  const before = buildingCover(all);
  const after = buildingCover(placed);
  const coverBefore: Record<string, number> = {};
  const coverAfter: Record<string, number> = {};
  before.forEach((b) => { coverBefore[b.id] = b.hidden / b.rays; });
  const hits: (FloraHit & { cover: number })[] = [];
  after.forEach((b, i) => {
    coverAfter[b.id] = b.hidden / b.rays;
    if (b.hidden / b.rays > MAX_COVER) {
      const z = viewRays()[i].zone;
      hits.push({ kind: 'view', x: z.x, z: z.z, id: b.id, how: 'view', cover: b.hidden / b.rays });
    }
  });
  return { hits, cleared, attempts: all.length, coverBefore, coverAfter };
}
