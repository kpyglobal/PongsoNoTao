/**
 * 0.1.5: roaming goat herds (山羊群) that graze and wander in small groups.
 * Mostly black Lanyu goats, with a few brown or white coats. Ideas reused from
 * the parked 0.1.5 world work, without pens, pigs, or scooter road-blocks.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canStand, findSafeStand } from './collision';
import { distToRing, getHeight, getSlope } from './height';
import { LANDMARKS, RING_ROAD, VILLAGE_DEFS, type Vec2 } from './layout';
import { rng } from './textures';
import { wname } from './names';

export type GoatCoat = 'black' | 'brown' | 'white';
export type AnimalPeriod = 'dawn' | 'day' | 'dusk' | 'night';
export interface HerdDef {
  id: string;
  zh: string;
  owner: string;
  n: number;
  spots: { kind: 'graze' | 'shore' | 'cliff' | 'road'; x: number; z: number }[];
  home: Vec2;
}

interface Goat { x: number; z: number; vx: number; vz: number; yaw: number; coat: GoatCoat; herd: number; phase: number; graze: number }
interface Herd { def: HerdDef; target: number; tx: number; tz: number; dwell: number }

const GOAT_R = 0.22;
const SPEED = 0.55;
const ACTIVE_R = 75;

/** [id, zh, place or landmark id, n, brown, white] — the rest are black */
const HERD_SEEDS: [string, string, string, number, number, number][] = [
  ['herd_hutou', '虎頭坡的羊群', 'hutou_slope', 7, 1, 1],
  ['herd_hongtou', '紅頭山的羊群', 'hongtoushan', 6, 1, 1],
  ['herd_thatch', '茅草坡的羊群', 'thatch_field', 5, 1, 0],
  ['herd_badai', '八代灣的羊群', 'badai_view', 8, 1, 2],
  ['herd_dasen', '大天池下的羊群', 'big_lake_view', 6, 1, 1],
  ['herd_tianchi', '小天池旁的羊群', 'small_lake_view', 4, 1, 0],
];

function goatOk(x: number, z: number): boolean {
  return getHeight(x, z) > 0.28 && canStand(x, z, GOAT_R);
}

function seedPos(places: Record<string, { x: number; z: number }>, id: string): Vec2 | null {
  if (places[id]) return { x: places[id].x, z: places[id].z };
  const l = LANDMARKS.find((x) => x.id === id);
  return l ? { x: l.x, z: l.z } : null;
}

/** 0.1.5: goats walk straight between their spots, so the line there must be open ground (no house in the way) */
function lineOk(a: Vec2, x: number, z: number): boolean {
  const L = Math.hypot(x - a.x, z - a.z);
  const n = Math.ceil(L / 0.3);
  for (let i = 1; i < n; i++) if (!goatOk(a.x + ((x - a.x) * i) / n, a.z + ((z - a.z) * i) / n)) return false;
  return true;
}

function findSpot(seed: Vec2, kind: 'shore' | 'cliff' | 'road'): Vec2 | null {
  let best: Vec2 | null = null;
  let bd = Infinity;
  for (let r = 1.5; r <= 16; r += 1.0) {
    const n = Math.round(r * 6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = seed.x + Math.cos(a) * r;
      const z = seed.z + Math.sin(a) * r;
      if (!goatOk(x, z)) continue;
      const h = getHeight(x, z);
      const ok = kind === 'shore' ? h < 0.85 && distToRing(x, z) > 1.8
        : kind === 'cliff' ? getSlope(x, z) > 0.9 && getSlope(x, z) < 2.2 && distToRing(x, z) > 1.8
        : distToRing(x, z) < 0.5;
      if (ok && r < bd && lineOk(seed, x, z)) { bd = r; best = { x, z }; }
    }
    if (best) return best;
  }
  return best;
}

export function herdDefs(places: Record<string, { x: number; z: number }>): { def: HerdDef; brown: number; white: number }[] {
  const out: { def: HerdDef; brown: number; white: number }[] = [];
  for (const [id, zh, place, n, brown, white] of HERD_SEEDS) {
    const p = seedPos(places, place);
    if (!p) continue;
    const seed = findSafeStand(p.x, p.z, GOAT_R);
    const spots: HerdDef['spots'] = [{ kind: 'graze', x: seed.x, z: seed.z }];
    for (const k of ['shore', 'cliff', 'road'] as const) {
      const s = findSpot(seed, k);
      if (s) spots.push({ kind: k, ...s });
    }
    if (!spots.some((s) => s.kind === 'road')) {
      let best: Vec2 | null = null;
      let bd = 14; // 0.1.5: a nearby, open stretch of road only (long walks string the herd out)
      for (let k = 1; k < RING_ROAD.length; k++) {
        const [ax, az] = RING_ROAD[k - 1];
        const [bx, bz] = RING_ROAD[k];
        for (let u = 0; u <= 1; u += 0.1) {
          const x = ax + (bx - ax) * u, z = az + (bz - az) * u;
          const d = Math.hypot(x - seed.x, z - seed.z);
          if (d < bd && goatOk(x, z) && lineOk(seed, x, z)) { bd = d; best = { x, z }; }
        }
      }
      if (best) spots.push({ kind: 'road', ...best });
    }
    const v = VILLAGE_DEFS.reduce((a, b) => (Math.hypot(b.cx - seed.x, b.cz - seed.z) < Math.hypot(a.cx - seed.x, a.cz - seed.z) ? b : a));
    const d = Math.hypot(seed.x - v.cx, seed.z - v.cz) || 1;
    const k = Math.min(13, d * 0.8) / d;
    const home = findSafeStand(v.cx + (seed.x - v.cx) * k, v.cz + (seed.z - v.cz) * k, GOAT_R);
    out.push({ def: { id, zh: wname(id, zh), owner: v.id, n, spots, home }, brown, white });
  }
  return out;
}

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, col: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.translate(x, y, z);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  return g;
}

function goatGeometry(): THREE.BufferGeometry {
  const coat = new THREE.Color(1, 1, 1);
  const horn = new THREE.Color(0.12, 0.1, 0.09);
  const parts = [
    boxAt(0.22, 0.22, 0.52, 0, 0.42, 0, coat),
    boxAt(0.14, 0.16, 0.2, 0, 0.58, 0.32, coat),
    boxAt(0.03, 0.12, 0.03, -0.04, 0.7, 0.28, horn),
    boxAt(0.03, 0.12, 0.03, 0.04, 0.7, 0.28, horn),
    boxAt(0.05, 0.05, 0.05, 0, 0.52, -0.27, coat),
  ];
  for (const [lx, lz] of [[-0.07, 0.18], [0.07, 0.18], [-0.07, -0.18], [0.07, -0.18]]) {
    parts.push(boxAt(0.05, 0.31, 0.05, lx, 0.155, lz, coat));
  }
  return mergeGeometries(parts)!;
}

const COAT_COLOR: Record<GoatCoat, THREE.Color> = {
  black: new THREE.Color('#2a2420'),
  brown: new THREE.Color('#6b4528'),
  white: new THREE.Color('#ece5d6'),
};

export class GoatHerds {
  readonly group = new THREE.Group();
  readonly defs: HerdDef[] = [];
  private goats: Goat[] = [];
  private herds: Herd[] = [];
  private mesh: THREE.InstancedMesh;
  private r = rng(9090);
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3(1, 1, 1);
  private p = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private pitch = new THREE.Quaternion();
  private period: AnimalPeriod = 'day';

  constructor(places: Record<string, { x: number; z: number }>) {
    const seeds = herdDefs(places);
    seeds.forEach(({ def, brown, white }, hi) => {
      this.defs.push(def);
      const g0 = def.spots[0];
      this.herds.push({ def, target: 0, tx: g0.x, tz: g0.z, dwell: 6 + this.r() * 10 });
      for (let i = 0; i < def.n; i++) {
        const a = this.r() * Math.PI * 2;
        const d = 0.6 + this.r() * 1.8;
        let x = g0.x + Math.cos(a) * d;
        let z = g0.z + Math.sin(a) * d;
        if (!goatOk(x, z)) { x = g0.x; z = g0.z; }
        const coat: GoatCoat = i < white ? 'white' : i < white + brown ? 'brown' : 'black';
        this.goats.push({ x, z, vx: 0, vz: 0, yaw: this.r() * 6.28, coat, herd: hi, phase: this.r() * 100, graze: this.r() * 4 });
      }
    });
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, vertexColors: true });
    this.mesh = new THREE.InstancedMesh(goatGeometry(), mat, Math.max(1, this.goats.length));
    this.goats.forEach((g, i) => this.mesh.setColorAt(i, COAT_COLOR[g.coat]));
    this.mesh.count = this.goats.length;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    this.writeAll();
  }

  setPeriod(p: AnimalPeriod): void {
    if (p === this.period) return;
    this.period = p;
    for (const h of this.herds) {
      if (p === 'dusk' || p === 'night') { h.tx = h.def.home.x; h.tz = h.def.home.z; }
      else {
        const s = h.def.spots[0];
        h.target = 0; h.tx = s.x; h.tz = s.z; h.dwell = 4 + this.r() * 6;
      }
    }
  }

  private centre(hi: number): Vec2 {
    let x = 0, z = 0, n = 0;
    for (const g of this.goats) if (g.herd === hi) { x += g.x; z += g.z; n++; }
    return n ? { x: x / n, z: z / n } : { x: 0, z: 0 };
  }

  update(dt: number, px: number, pz: number): void {
    const step = Math.min(dt, 0.05);
    this.herds.forEach((h, hi) => {
      const c = this.centre(hi);
      if (Math.hypot(c.x - px, c.z - pz) > ACTIVE_R) return;
      const roam = this.period === 'dawn' || this.period === 'day';
      if (roam && Math.hypot(c.x - h.tx, c.z - h.tz) < 2.2) {
        h.dwell -= step;
        if (h.dwell <= 0) {
          // 0.1.5: back to the grazing spot between two other spots (each spot has an open straight line to it)
          h.target = h.target !== 0 || h.def.spots.length < 2 ? 0 : 1 + Math.floor(this.r() * (h.def.spots.length - 1));
          const s = h.def.spots[h.target];
          h.tx = s.x; h.tz = s.z;
          h.dwell = (s.kind === 'shore' ? 14 : s.kind === 'road' ? 5 : 10) + this.r() * 8;
        }
      }
      for (const g of this.goats) {
        if (g.herd !== hi) continue;
        g.graze -= step;
        const grazing = g.graze > 0 && Math.hypot(h.tx - g.x, h.tz - g.z) < 2.8;
        if (g.graze < -2.5) g.graze = 2 + this.r() * 5;
        let ax = 0, az = 0;
        const dx = h.tx - g.x, dz = h.tz - g.z;
        const dl = Math.hypot(dx, dz);
        if (dl > 1.2) { ax += (dx / dl) * 0.9; az += (dz / dl) * 0.9; }
        ax += (c.x - g.x) * 0.25; az += (c.z - g.z) * 0.25;
        for (const o of this.goats) {
          if (o === g || o.herd !== hi) continue;
          const sx = g.x - o.x, sz = g.z - o.z;
          const sd = Math.hypot(sx, sz);
          if (sd > 0 && sd < 0.65) { ax += (sx / sd) * (0.65 - sd) * 4; az += (sz / sd) * (0.65 - sd) * 4; }
        }
        g.phase += step * 0.6;
        if (!grazing) {
          ax += Math.sin(g.phase * 1.7 + g.herd) * 0.35;
          az += Math.cos(g.phase * 1.3) * 0.35;
        }
        const damp = grazing ? 0.7 : 0.85;
        g.vx = g.vx * damp + ax * step * (grazing ? 0.4 : 1.6);
        g.vz = g.vz * damp + az * step * (grazing ? 0.4 : 1.6);
        const sp = Math.hypot(g.vx, g.vz);
        const max = grazing ? SPEED * 0.25 : SPEED;
        if (sp > max) { g.vx *= max / sp; g.vz *= max / sp; }
        const nx = g.x + g.vx * step, nz = g.z + g.vz * step;
        if (goatOk(nx, nz)) { g.x = nx; g.z = nz; } else { g.vx *= -0.3; g.vz *= -0.3; }
        if (sp > 0.06) g.yaw = Math.atan2(g.vx, g.vz);
      }
    });
    this.writeAll();
  }

  private writeAll(): void {
    this.goats.forEach((g, i) => {
      this.q.setFromAxisAngle(this.up, g.yaw);
      // head dips a little while grazing
      if (g.graze > 0) {
        this.pitch.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.18);
        this.q.multiply(this.pitch);
      }
      this.p.set(g.x, getHeight(g.x, g.z), g.z);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  herdInfo(): { id: string; zh: string; owner: string; n: number; coats: Record<GoatCoat, number>; home: Vec2; spots: HerdDef['spots']; centre: Vec2; goats: { x: number; z: number; coat: GoatCoat }[] }[] {
    return this.herds.map((h, hi) => {
      const goats = this.goats.filter((g) => g.herd === hi);
      const coats = { black: 0, brown: 0, white: 0 } as Record<GoatCoat, number>;
      for (const g of goats) coats[g.coat]++;
      return { id: h.def.id, zh: h.def.zh, owner: h.def.owner, n: h.def.n, coats, home: h.def.home, spots: h.def.spots, centre: this.centre(hi), goats: goats.map((g) => ({ x: g.x, z: g.z, coat: g.coat })) };
    });
  }

  placeHerd(id: string, x: number, z: number): boolean {
    const hi = this.herds.findIndex((h) => h.def.id === id);
    if (hi < 0) return false;
    const h = this.herds[hi];
    h.tx = x; h.tz = z; h.dwell = 30;
    let k = 0;
    for (const g of this.goats) if (g.herd === hi) {
      const a = (k++ / h.def.n) * Math.PI * 2;
      const gx = x + Math.cos(a) * 0.55, gz = z + Math.sin(a) * 0.55;
      if (goatOk(gx, gz)) { g.x = gx; g.z = gz; } else { g.x = x; g.z = z; }
      g.vx = 0; g.vz = 0;
    }
    this.writeAll();
    return true;
  }
}
