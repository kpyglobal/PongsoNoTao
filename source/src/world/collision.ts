/**
 * 2D footprint collision, raised walkable surfaces (docks / piers),
 * and safe standing queries. Keeps characters on dry land or paved decks
 * and sliding around buildings, walls, and sunken 水芋田 basins.
 */
import { MAP_SCALE } from './outline';
import { planePark, HARBOUR_YACHT, CLINIC_FOOT, FOOTPRINT, PLANE_FOOT, TERMINAL_FOOT, FACILITIES, HARBOUR_LANTERN_DZ, ISLAND_CENTRE, LAKES, LANDMARKS } from './layout';
import {
  TERRAIN_BOX,
  ALL_STRUCTURES,
  getHeight,
  getSlope,
  distToRing,
  inTaroBasin,
  WATER_LEVEL,
  WALK_WATER_MARGIN,
  WALK_MAX_HEIGHT,
  WALK_MAX_SLOPE,
} from './height';

export const FEET_BIAS = 0.07;
export const PLAYER_RADIUS = 0.36;
export const NPC_RADIUS = 0.32;

interface Obb {
  x: number;
  z: number;
  yaw: number;
  hw: number;
  hd: number;
  top?: number;
  kind: 'solid' | 'pad';
  /** cached cos/sin of yaw (static colliders, so trig is computed once) */
  c: number;
  s: number;
}

interface Disc {
  x: number;
  z: number;
  r: number;
  kind: 'solid';
  top?: number;
}


const solids: Obb[] = [];
const pads: Obb[] = [];
const discs: Disc[] = [];
let ready = false;

function addSolid(x: number, z: number, yaw: number, hw: number, hd: number): void {
  solids.push({ x, z, yaw, hw, hd, kind: 'solid', c: Math.cos(yaw), s: Math.sin(yaw) });
}
function addPad(x: number, z: number, yaw: number, hw: number, hd: number, top: number): void {
  pads.push({ x, z, yaw, hw, hd, top, kind: 'pad', c: Math.cos(yaw), s: Math.sin(yaw) });
}
function addDisc(x: number, z: number, r: number): void {
  discs.push({ x, z, r, kind: 'solid' });
}

/**
 * Build static colliders once (after the height grid is ready).
 * Harbor frame is placed at (harbor.x + 1.5, harbor.z) with yaw 0,
 * matching `WorldDecor.buildFacilities`.
 */
export function initCollision(): void {
  if (ready) return;
  solids.length = 0;
  pads.length = 0;
  discs.length = 0;

  for (const s of ALL_STRUCTURES) {
    const f = FOOTPRINT[s.kind];
    addSolid(s.x, s.z, s.yaw, f.hw, f.hd);
  }

  const cl = FACILITIES.clinic;
  addSolid(cl.x, cl.z, cl.yaw, CLINIC_FOOT.hw, CLINIC_FOOT.hd);

  const t = FACILITIES.terminal;
  addSolid(t.x, t.z, t.yaw, TERMINAL_FOOT.hw, TERMINAL_FOOT.hd);
  // 0.1.4: the parked commuter plane on the runway (layout.ts planePark)
  const plane = planePark();
  addSolid(plane.x, plane.z, plane.yaw, PLANE_FOOT.hw, PLANE_FOOT.hd);
  // 0.1.4: the arrival yacht moored in 開元港 (on the water beside the pier)
  addSolid(FACILITIES.harbor.x + HARBOUR_YACHT.dx, FACILITIES.harbor.z + HARBOUR_YACHT.dz, HARBOUR_YACHT.yaw, HARBOUR_YACHT.hw, HARBOUR_YACHT.hd);

  const h = FACILITIES.harbor;
  const hx = h.x + 1.5;
  const hz = h.z;
  // concrete apron + quay (walkable deck)
  addPad(hx - 1.5, hz, 0, 2.15, 4.65, 0.8);
  // pier stretching west (walkable)
  addPad(hx - 7.0, hz - 0.6, 0, 4.15, 1.05, 0.65);
  // harbour office (solid)
  addSolid(hx - 0.8, hz + 2.6, 0, 1.25, 1.05);
  // curved breakwater arm
  for (let k = 0; k < 9; k++) {
    const a = -0.2 - k * 0.16;
    const lx = -6 + Math.cos(a) * -6.5 - 3;
    const lz = -4.2 + Math.sin(a) * 6.5;
    addSolid(hx + lx, hz + lz, a, 1.1, 0.85);
  }
  // lights / posts at the pier and breakwater tips
  addDisc(hx - 15.4, hz - 7.2, 0.55);
  addDisc(hx - 11.0, hz - 0.6, 0.4);
  // land-side lantern posts
  for (const dz of HARBOUR_LANTERN_DZ) addDisc(h.x + 3.2, h.z + dz, 0.28);

  // 0.1.4: shore rocks you could otherwise walk through, and the built landmarks
  for (const l of LANDMARKS) {
    if (l.rock) {
      const k = l.rock;
      if (k.arch) {
        const c = Math.cos(k.yaw), sn = Math.sin(k.yaw);
        for (const side of [-1, 1]) addDisc(k.x + c * side * k.len * 0.36, k.z + sn * side * k.len * 0.36, k.len * 0.2 + 0.4);
      } else addDisc(k.x, k.z, Math.min(1.6, k.len * 0.32 + 0.4));
    }
    if (l.at && l.build === 'lighthouse') addDisc(l.at.x, l.at.z, 1.3);
    if (l.at && l.build === 'station') addSolid(l.at.x, l.at.z, 0, 1.5, 1.2);
  }

  // 0.1.4: the crater lakes are seen from the lookout only
  for (const lk of LAKES) addDisc(lk.x, lk.z, lk.r + 0.4);

  const jl = FACILITIES.jimagaodLight;
  addDisc(jl.x, jl.z, 0.7);

  ready = true;
}

/** static colliders for audits / map overlays (solid boxes, walkable pads, solid discs) */
export function staticColliders(): {
  solids: readonly { x: number; z: number; yaw: number; hw: number; hd: number }[];
  pads: readonly { x: number; z: number; yaw: number; hw: number; hd: number; top?: number }[];
  discs: readonly { x: number; z: number; r: number }[];
} {
  if (!ready) initCollision();
  return { solids, pads, discs };
}

function localOn(obb: Obb, x: number, z: number): { lx: number; lz: number } {
  const dx = x - obb.x;
  const dz = z - obb.z;
  const c = obb.c;
  const sn = obb.s;
  return { lx: dx * c - dz * sn, lz: dx * sn + dz * c };
}

function circleHitsObb(x: number, z: number, r: number, obb: Obb): boolean {
  const { lx, lz } = localOn(obb, x, z);
  const qx = Math.max(-obb.hw, Math.min(obb.hw, lx));
  const qz = Math.max(-obb.hd, Math.min(obb.hd, lz));
  const dx = lx - qx;
  const dz = lz - qz;
  return dx * dx + dz * dz < r * r;
}

function onPad(x: number, z: number, r = 0): number {
  let top = -Infinity;
  for (const p of pads) {
    if (circleHitsObb(x, z, r, p)) top = Math.max(top, p.top ?? 0);
  }
  return top;
}

/** Height of the surface a character should stand on (terrain, plaza, or dock). */
export function surfaceHeight(x: number, z: number): number {
  return Math.max(getHeight(x, z), onPad(x, z, 0.05));
}

export function onWalkablePad(x: number, z: number, r = 0.1): boolean {
  return onPad(x, z, r) > -Infinity;
}

export function hitsSolid(x: number, z: number, r: number): boolean {
  if (!ready) initCollision();
  for (const s of solids) {
    if (circleHitsObb(x, z, r, s)) return true;
  }
  for (const d of discs) {
    const dx = x - d.x;
    const dz = z - d.z;
    if (dx * dx + dz * dz < (r + d.r) * (r + d.r)) return true;
  }
  return false;
}

/** True if a character of the given radius may stand here. */
export function canStand(x: number, z: number, radius = PLAYER_RADIUS): boolean {
  if (!ready) initCollision();
  const surf = surfaceHeight(x, z);
  if (surf > WALK_MAX_HEIGHT) return false;
  const padded = onWalkablePad(x, z, radius * 0.4);
  if (!padded) {
    if (surf < WATER_LEVEL + WALK_WATER_MARGIN) return false;
    if (getSlope(x, z) > WALK_MAX_SLOPE) return false;
  }
  if (hitsSolid(x, z, radius)) return false;
  if (inTaroBasin(x, z)) return false;
  return true;
}

const ROOMY_PAD = 0.65;

/** Spiral search for the nearest dry, unblocked standing point. */
export function findSafeStand(x: number, z: number, radius = PLAYER_RADIUS): { x: number; z: number } {
  if (!ready) initCollision();
  if (canStand(x, z, radius)) return { x, z };
  // 0.1.1: look for a roomy spot first (a 1 m clear disc), so a position inside a building is not moved into
  // the thin gap between two neighbouring buildings, a pocket the party cannot walk out of
  // (old saves; scripts/check-roads.mjs checks every spot a 0.1.0 player could stand on).
  for (const need of [radius + ROOMY_PAD, radius]) {
    for (let i = 1; i <= 56; i++) {
      const rad = i * 0.4;
      const steps = Math.max(8, i * 8);
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2 + i * 0.17;
        const nx = x + Math.cos(a) * rad;
        const nz = z + Math.sin(a) * rad;
        // (both radii: a wider circle touches a dock / plaza pad sooner, so it alone could pass over water)
        if (canStand(nx, nz, need) && (need === radius || canStand(nx, nz, radius))) return { x: nx, z: nz };
      }
    }
  }
  // last resort: walk toward the island centre
  const cx = ISLAND_CENTRE.x;
  const cz = ISLAND_CENTRE.z;
  for (let t = 0; t < 40; t++) {
    const u = t / 40;
    const nx = x + (cx - x) * u;
    const nz = z + (cz - z) * u;
    if (canStand(nx, nz, radius)) return { x: nx, z: nz };
  }
  return { x, z };
}

export function ensureStanding(x: number, z: number, radius = PLAYER_RADIUS): { x: number; z: number } {
  return canStand(x, z, radius) ? { x, z } : findSafeStand(x, z, radius);
}

/**
 * Move with axis-aligned slide: if the full step is blocked, try X and Z
 * independently so the character glides along shorelines, buildings, and
 * 水芋田 bunds instead of freezing in place.
 */
export function slideMove(x: number, z: number, dx: number, dz: number, radius = PLAYER_RADIUS): { x: number; z: number } {
  const nx = x + dx;
  const nz = z + dz;
  if (canStand(nx, nz, radius)) return { x: nx, z: nz };
  if (Math.abs(dx) > 1e-6 && canStand(nx, z, radius)) return { x: nx, z };
  if (Math.abs(dz) > 1e-6 && canStand(x, nz, radius)) return { x, z: nz };
  for (const t of [0.7, 0.4, 0.2]) {
    const sx = x + dx * t;
    const sz = z + dz * t;
    if (canStand(sx, sz, radius)) return { x: sx, z: sz };
  }
  // QA H3: head-on into a collider corner (e.g. the 開元港 quay edge with 8-way arrow keys) neither the straight
  // move nor the single-axis slides work; try the move turned ±30° / ±60° (along the corner) at a shorter length
  const len = Math.hypot(dx, dz);
  if (len > 1e-6) {
    for (const a of [0.52, -0.52, 1.05, -1.05]) {
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const k = Math.max(0.5, c);
      const tx = x + (dx * c - dz * sn) * k;
      const tz = z + (dx * sn + dz * c) * k;
      if (canStand(tx, tz, radius)) return { x: tx, z: tz };
    }
  }
  return ensureStanding(x, z, radius);
}

export function onRoadOrPath(x: number, z: number): boolean {
  return distToRing(x, z) < 1.55;
}

export function onNarrowGround(x: number, z: number): boolean {
  if (onWalkablePad(x, z, 0.2)) return true;
  if (inTaroBasin(x, z)) return true;
  // close to a taro bund (narrow) — use a slightly larger basin probe
  return inTaroBasin(x + 0.6, z) || inTaroBasin(x - 0.6, z) || inTaroBasin(x, z + 0.6) || inTaroBasin(x, z - 0.6);
}

// ------------------------------------------------------------------- tatala (canoe) water movement
const PADDLE_DEPTH = 0.35;

/** True where a one-person tatala can float: open water, clear of piers, breakwater and posts. */
export function canPaddle(x: number, z: number, radius = 0.6): boolean {
  if (!ready) initCollision();
  const { xMin, zMin, xMax, zMax } = TERRAIN_BOX;
  if (x < xMin + 2 || x > xMax - 2 || z < zMin + 2 || z > zMax - 2) return false;
  if (getHeight(x, z) > WATER_LEVEL - PADDLE_DEPTH) return false;
  if (onWalkablePad(x, z, radius * 0.6)) return false;
  return !hitsSolid(x, z, radius);
}

/** Nearest floatable point (spiral search), or null when no water is within ~maxR. */
/** (0.1.5: the search reach grew with the island, 24 m × MAP_SCALE) */
export function findWaterNear(x: number, z: number, maxR = 24 * MAP_SCALE): { x: number; z: number } | null {
  if (canPaddle(x, z)) return { x, z };
  for (let rad = 0.5; rad <= maxR; rad += 0.5) {
    const steps = Math.max(12, Math.round(rad * 10));
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const nx = x + Math.cos(a) * rad;
      const nz = z + Math.sin(a) * rad;
      if (canPaddle(nx, nz)) return { x: nx, z: nz };
    }
  }
  return null;
}

/** slideMove for the water: glide along the shoreline instead of beaching. */
export function paddleMove(x: number, z: number, dx: number, dz: number): { x: number; z: number } {
  if (canPaddle(x + dx, z + dz)) return { x: x + dx, z: z + dz };
  if (Math.abs(dx) > 1e-6 && canPaddle(x + dx, z)) return { x: x + dx, z };
  if (Math.abs(dz) > 1e-6 && canPaddle(x, z + dz)) return { x, z: z + dz };
  return { x, z };
}
