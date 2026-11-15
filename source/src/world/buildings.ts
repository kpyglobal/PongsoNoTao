/**
 * Hand-built architectural props for Pongso no Tao｜蘭嶼文化島.
 * Everything is accumulated into a shared ArchBuilder and merged per material,
 * so 6 villages + landmarks render in a handful of draw calls.
 *
 * Local frame of every structure: +Z = front (faces the sea), +X = along the row.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stoneTex, thatchTex, woodTex, plasterTex, sheetTex, tatalaTex, rng } from './textures';
import { BUILDING_ALBEDO as A } from '../render/styleConfig';

export type MatKey =
  | 'stone' | 'stoneDark' | 'woodDark' | 'wood' | 'woodPale' | 'thatch' | 'thatchGold'
  | 'plaster' | 'paintBlue' | 'paintMint' | 'paintPink' | 'paintCream'
  | 'roofBlue' | 'roofRed' | 'roofGreen' | 'roofGrey' | 'concrete' | 'asphalt'
  | 'red' | 'black' | 'white' | 'glass' | 'hearth' | 'window' | 'lamp' | 'metal' | 'tatala' | 'tatalaIn'
  // 0.1.4 arrival vehicles (art-ref/arrival/palette.md)
  | 'vWhite' | 'vBelly' | 'vBlue' | 'vNavy' | 'vGlass' | 'vDark' | 'vAntifoul' | 'vSeat' | 'vSteel';

let MATS: Record<MatKey, THREE.Material> | null = null;

export function archMaterials(): Record<MatKey, THREE.Material> {
  if (MATS) return MATS;
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  MATS = {
    stone: std({ map: stoneTex(), color: A.stone }),
    stoneDark: std({ map: stoneTex(), color: A.stoneDark }),
    woodDark: std({ map: woodTex(A.woodDark) }),
    wood: std({ map: woodTex(A.wood) }),
    woodPale: std({ map: woodTex(A.woodPale) }),
    thatch: std({ map: thatchTex(true), color: A.thatchTint }),
    thatchGold: std({ map: thatchTex(false) }),
    plaster: std({ map: plasterTex() }),
    paintBlue: std({ map: plasterTex(), color: 0xa9cfe0 }),
    paintMint: std({ map: plasterTex(), color: 0xb9dcc6 }),
    paintPink: std({ map: plasterTex(), color: 0xf0c6c0 }),
    paintCream: std({ map: plasterTex(), color: 0xf3e3bf }),
    roofBlue: std({ map: sheetTex(), color: A.roofBlue, roughness: 0.6, metalness: 0.15 }),
    roofRed: std({ map: sheetTex(), color: 0xb5463a, roughness: 0.6, metalness: 0.15 }),
    roofGreen: std({ map: sheetTex(), color: 0x3f8a6a, roughness: 0.6, metalness: 0.15 }),
    roofGrey: std({ map: sheetTex(), color: A.roofGrey, roughness: 0.6, metalness: 0.2 }),
    concrete: std({ map: plasterTex(), color: A.concrete }),
    asphalt: std({ color: 0x55575a }),
    red: std({ color: 0xb3332a, roughness: 0.6 }),
    black: std({ color: 0x1b1714, roughness: 0.7 }),
    white: std({ color: 0xf2eee4, roughness: 0.6 }),
    glass: std({ color: 0x6fa6bf, roughness: 0.15, metalness: 0.4, emissive: new THREE.Color('#ffd890'), emissiveIntensity: 0 }),
    hearth: std({ color: 0x1a0f08, emissive: new THREE.Color('#ff8a33'), emissiveIntensity: 0.15, roughness: 1 }),
    window: std({ color: 0x2b3640, emissive: new THREE.Color('#ffd27a'), emissiveIntensity: 0.0, roughness: 0.4 }),
    lamp: std({ color: 0xf6e2b0, emissive: new THREE.Color('#ffc66b'), emissiveIntensity: 0.25, roughness: 0.5 }),
    metal: std({ color: 0x8f969c, roughness: 0.45, metalness: 0.6 }),
    tatala: std({ map: tatalaTex(1), roughness: 0.6, side: THREE.FrontSide }),
    tatalaIn: std({ map: woodTex(A.woodInside), roughness: 0.9, side: THREE.BackSide }),
    // arrival plane / yacht: hull white, light belly, livery blue (plane), deeper navy stripe (yacht), dark glass,
    // warm dark grey (props, tyres, intakes), antifouling, sand seats, warm steel rails
    vWhite: std({ color: 0xf6f2ea, roughness: 0.55 }),
    vBelly: std({ color: 0xc8c1b4, roughness: 0.6 }),
    vBlue: std({ color: 0x3f87b8, roughness: 0.5 }),
    vNavy: std({ color: 0x204c71, roughness: 0.5 }),
    vGlass: std({ color: 0x4e5f6a, roughness: 0.2, metalness: 0.3 }),
    vDark: std({ color: 0x49483f, roughness: 0.7 }),
    vAntifoul: std({ color: 0x1d2629, roughness: 0.7 }),
    vSeat: std({ color: 0xecd49c, roughness: 0.8 }),
    vSteel: std({ color: 0xb3ad9e, roughness: 0.35, metalness: 0.5 }),
  };
  return MATS;
}

/** Day→night emissive levels for lit materials. */
export function setNightGlow(level: number): void {
  const m = archMaterials();
  (m.hearth as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + level * 2.6;
  (m.window as THREE.MeshStandardMaterial).emissiveIntensity = level * 2.2;
  (m.lamp as THREE.MeshStandardMaterial).emissiveIntensity = 0.35 + level * 3.2;
  (m.glass as THREE.MeshStandardMaterial).emissiveIntensity = level * 0.9;
}

function prep(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g;
  if (!out.attributes.uv) {
    out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'uv'].includes(k)) out.deleteAttribute(k);
  out = out.clone();
  return out;
}

/** Box with world-scaled UVs so pixel textures stay crisp & consistent. */
export function boxUV(w: number, h: number, d: number, ts = 1): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * (dims[f][0] / ts), uv.getY(i) * (dims[f][1] / ts));
    }
  }
  return g;
}

/** Gable roof shell with eaves: two sloped slabs + gable infill. Ridge runs along X. */
export function gableRoof(w: number, d: number, rise: number, thick = 0.12): THREE.BufferGeometry[] {
  const half = d / 2;
  const slope = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  const out: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const slab = boxUV(w, thick, slope + 0.05, 1);
    slab.rotateX(side * ang);
    slab.translate(0, rise / 2, side * half / 2);
    out.push(slab);
  }
  return out;
}

function gableInfill(d: number, rise: number, x: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0);
  s.lineTo(d / 2, 0);
  s.lineTo(0, rise);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.rotateY(Math.PI / 2);
  g.translate(x, 0, 0);
  return g;
}

export class ArchBuilder {
  /** bucket → material → geometries. Each bucket (a village, a facility) becomes its own merged meshes,
   *  so frustum culling can drop off-screen villages in both the main and the shadow pass. */
  private buckets = new Map<string, Map<MatKey, THREE.BufferGeometry[]>>();
  private parts = new Map<MatKey, THREE.BufferGeometry[]>();
  private base = new THREE.Matrix4();
  private tmp = new THREE.Matrix4();
  private r = rng(2024);

  constructor() {
    this.bucket('main');
  }

  rand(): number {
    return this.r();
  }

  /** Route the following add() calls into a named bucket (same random stream, so the props are unchanged). */
  bucket(name: string): this {
    let b = this.buckets.get(name);
    if (!b) {
      b = new Map();
      this.buckets.set(name, b);
    }
    this.parts = b;
    return this;
  }

  /** Set the structure frame. */
  frame(x: number, y: number, z: number, yaw: number, scale = 1): this {
    this.base.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale));
    return this;
  }

  add(key: MatKey, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0): this {
    const geo = prep(g);
    this.tmp.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(this.tmp);
    geo.applyMatrix4(this.base);
    let list = this.parts.get(key);
    if (!list) {
      list = [];
      this.parts.set(key, list);
    }
    list.push(geo);
    return this;
  }

  box(key: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, ts = 1): this {
    return this.add(key, boxUV(w, h, d, ts), x, y, z, ry);
  }

  build(): THREE.Group {
    const root = new THREE.Group();
    const mats = archMaterials();
    for (const [name, parts] of this.buckets) {
      const g = new THREE.Group();
      g.name = `arch-bucket-${name}`;
      for (const [key, list] of parts) {
        if (!list.length) continue;
        const merged = mergeGeometries(list, false);
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mats[key]);
        const lit = key === 'hearth' || key === 'window' || key === 'lamp';
        mesh.castShadow = !lit && key !== 'glass';
        mesh.receiveShadow = true;
        mesh.name = `arch-${key}`;
        g.add(mesh);
      }
      if (g.children.length) root.add(g);
    }
    this.buckets.clear();
    this.bucket('main');
    return root;
  }
}

// ---------------------------------------------------------------------------
// Structures
// ---------------------------------------------------------------------------

/** Dry-laid stone course along a line (local frame), from y0 up to y1. */
function stoneWall(b: ArchBuilder, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, key: MatKey = 'stone'): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = Math.atan2(x1 - x0, z1 - z0);
  const courses = Math.max(2, Math.round((y1 - y0) / 0.2));
  const ch = (y1 - y0) / courses;
  for (let k = 0; k < courses; k++) {
    let t = (k % 2) * 0.15;
    while (t < len - 0.05) {
      const w = Math.min(len - t, 0.26 + b.rand() * 0.16);
      const mid = t + w / 2;
      const x = x0 + ((x1 - x0) * mid) / len;
      const z = z0 + ((z1 - z0) * mid) / len;
      const jitter = (b.rand() - 0.5) * 0.04;
      b.add(key, boxUV(0.26 + b.rand() * 0.06, ch * 1.02, w - 0.02, 0.5), x + Math.cos(ang) * jitter, y0 + (k + 0.5) * ch, z - Math.sin(ang) * jitter, ang);
      t += w;
    }
  }
}

/**
 * 地下屋 vahey — semi-subterranean main house. `pit` = depth below the plaza.
 * The local origin is the pit floor centre.
 */
export function addVahey(b: ArchBuilder, pit: number, hw: number, hd: number, variant: number): void {
  const top = pit + 0.12; // retaining wall cap slightly above plaza
  // pit retaining walls (front wall has a gap for the stone steps)
  stoneWall(b, -hw, -hd, hw, -hd, 0, top);
  stoneWall(b, -hw, -hd, -hw, hd, 0, top);
  stoneWall(b, hw, -hd, hw, hd, 0, top);
  stoneWall(b, -hw, hd, -0.45, hd, 0, top);
  stoneWall(b, 0.45, hd, hw, hd, 0, top);
  // cap stones
  for (const [x0, z0, x1, z1] of [[-hw, -hd, hw, -hd], [-hw, hd, -0.5, hd], [0.5, hd, hw, hd]] as [number, number, number, number][]) {
    stoneWall(b, x0, z0, x1, z1, top, top + 0.1, 'stoneDark');
  }
  // stone steps down into the pit (seaward)
  for (let s = 0; s < 4; s++) {
    const y = pit - (s + 1) * (pit / 4);
    b.box('stoneDark', 0.85, 0.12, 0.3, 0, y + 0.06, hd - 0.15 - s * 0.28, 0, 0.5);
  }
  // pebble yard paving in front of the house
  b.box('stoneDark', hw * 2 - 0.3, 0.04, 0.9, 0, 0.02, hd - 0.75, 0, 0.5);

  // house body set toward the back of the pit
  const W = hw * 2 - 0.65;
  const D = hd * 2 - 1.35;
  const zc = -hd + 0.25 + D / 2;
  const wallH = 1.0;
  b.box('woodDark', W, wallH, 0.08, 0, wallH / 2, zc - D / 2, 0, 1);
  b.box('woodDark', 0.08, wallH, D, -W / 2, wallH / 2, zc, 0, 1);
  b.box('woodDark', 0.08, wallH, D, W / 2, wallH / 2, zc, 0, 1);
  // front plank wall with 3 low doorways (glowing hearth inside at dusk)
  const doors = variant % 2 === 0 ? 3 : 2;
  const seg = W / (doors * 2 + 1);
  for (let i = 0; i < doors * 2 + 1; i++) {
    const x = -W / 2 + seg * (i + 0.5);
    if (i % 2 === 1) {
      b.box('hearth', seg * 0.95, 0.62, 0.04, x, 0.33, zc + D / 2 - 0.03, 0, 1);
      b.box('woodDark', seg, 0.36, 0.09, x, wallH - 0.18, zc + D / 2, 0, 1);
      b.box('wood', seg * 1.05, 0.06, 0.12, x, 0.02, zc + D / 2 + 0.02, 0, 1); // threshold
    } else {
      b.box('wood', seg, wallH, 0.09, x, wallH / 2, zc + D / 2, 0, 1);
    }
  }
  // carved front posts with red / white / black bands
  for (const sx of [-1, 1]) {
    b.box('woodDark', 0.12, wallH + 0.25, 0.12, sx * (W / 2 + 0.05), (wallH + 0.25) / 2, zc + D / 2 + 0.05, 0, 1);
    for (let k = 0; k < 3; k++) {
      b.box((['red', 'white', 'black'] as MatKey[])[k], 0.13, 0.06, 0.13, sx * (W / 2 + 0.05), 0.35 + k * 0.22, zc + D / 2 + 0.05, 0, 1);
    }
  }
  // low pitched dark thatch roof — eaves reach almost to the pit rim
  const rise = 0.62;
  const RW = W + 0.75;
  const RD = D + 1.05;
  const eave = wallH + 0.02;
  for (const g of gableRoof(RW, RD, rise, 0.16)) b.add('thatch', g, 0, eave, zc);
  b.add('woodDark', gableInfill(RD - 0.3, rise - 0.08, -RW / 2 + 0.15), 0, eave, zc);
  b.add('woodDark', gableInfill(RD - 0.3, rise - 0.08, RW / 2 - 0.15), 0, eave, zc);
  b.box('woodDark', RW + 0.2, 0.1, 0.16, 0, eave + rise + 0.03, zc, 0, 1); // ridge beam
  // bargeboards
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const ang = Math.atan2(rise, RD / 2);
      b.add('woodDark', boxUV(0.06, 0.08, Math.hypot(RD / 2, rise) + 0.05), sx * (RW / 2 + 0.02), eave + rise / 2, zc + sz * RD / 4, 0, -sz * ang);
    }
  }
  // stone backrests (pasaglayan) on the plaza edge in front
  for (let k = -1; k <= 1; k += 2) {
    b.box('stoneDark', 0.22, 0.55, 0.12, k * (hw - 0.4), pit + 0.27, hd + 0.55, (b.rand() - 0.5) * 0.3, 0.5);
  }
}

/** makarang — raised two-level wooden work house on a stone plinth. Origin = ground. */
export function addMakarang(b: ArchBuilder): void {
  b.box('stone', 2.3, 0.35, 2.0, 0, 0.17, 0, 0, 0.5);
  const posts: [number, number][] = [[-1, -0.85], [1, -0.85], [-1, 0.85], [1, 0.85]];
  for (const [x, z] of posts) b.box('woodDark', 0.13, 1.05, 0.13, x, 0.35 + 0.52, z, 0, 1);
  b.box('wood', 2.25, 0.1, 1.95, 0, 1.4, 0, 0, 1); // upper floor
  b.box('woodPale', 2.1, 0.75, 0.07, 0, 1.82, -0.9, 0, 1);
  b.box('woodPale', 0.07, 0.75, 1.8, -1.03, 1.82, 0, 0, 1);
  b.box('woodPale', 0.07, 0.75, 1.8, 1.03, 1.82, 0, 0, 1);
  b.box('woodPale', 0.6, 0.75, 0.07, -0.75, 1.82, 0.9, 0, 1);
  b.box('woodPale', 0.6, 0.75, 0.07, 0.75, 1.82, 0.9, 0, 1);
  b.box('window', 0.8, 0.55, 0.03, 0, 1.75, 0.88, 0, 1);
  // ladder
  for (let k = 0; k < 4; k++) b.box('wood', 0.5, 0.05, 0.06, 0, 0.5 + k * 0.25, 1.2 - k * 0.05, 0, 1);
  b.box('wood', 0.05, 1.3, 0.05, -0.24, 0.9, 1.15, 0, 1);
  b.box('wood', 0.05, 1.3, 0.05, 0.24, 0.9, 1.15, 0, 1);
  for (const g of gableRoof(2.7, 2.5, 0.85, 0.14)) b.add('thatch', g, 0, 2.2, 0);
  b.add('woodDark', gableInfill(2.0, 0.75, -1.05), 0, 2.2, 0);
  b.add('woodDark', gableInfill(2.0, 0.75, 1.05), 0, 2.2, 0);
  b.box('woodDark', 2.9, 0.1, 0.14, 0, 3.07, 0, 0, 1);
}

/** tagakal — elevated open-sided resting pavilion on stilts. Origin = ground. */
export function addTagakal(b: ArchBuilder, gold = false): void {
  const posts: [number, number][] = [[-0.95, -0.8], [0.95, -0.8], [-0.95, 0.8], [0.95, 0.8], [0, -0.8], [0, 0.8]];
  for (const [x, z] of posts) {
    b.box('woodDark', 0.11, 1.15, 0.11, x, 0.575, z, 0, 1);
    b.box('stoneDark', 0.26, 0.12, 0.26, x, 0.06, z, 0, 0.5); // footing stones
  }
  b.box('woodDark', 2.15, 0.1, 0.12, 0, 1.12, -0.8, 0, 1);
  b.box('woodDark', 2.15, 0.1, 0.12, 0, 1.12, 0.8, 0, 1);
  // slatted deck
  for (let k = 0; k < 9; k++) b.box('woodPale', 2.05, 0.05, 0.17, 0, 1.2, -0.76 + k * 0.19, 0, 1);
  // roof posts & thatch
  for (const [x, z] of posts.slice(0, 4)) b.box('wood', 0.08, 0.95, 0.08, x, 1.7, z, 0, 1);
  for (const g of gableRoof(2.6, 2.3, 0.7, 0.13)) b.add(gold ? 'thatchGold' : 'thatch', g, 0, 2.15, 0);
  b.box('woodDark', 2.8, 0.08, 0.12, 0, 2.87, 0, 0, 1);
  // little ladder
  for (let k = 0; k < 3; k++) b.box('wood', 0.45, 0.04, 0.06, 0.4, 0.3 + k * 0.3, 1.05, 0, 1);
}

/** Modern painted concrete house with roof water tank. Origin = ground. */
export function addModern(b: ArchBuilder, variant: number): void {
  const paint: MatKey = (['paintBlue', 'paintMint', 'paintPink', 'paintCream'] as MatKey[])[variant % 4];
  const roof: MatKey = (['roofBlue', 'roofRed', 'roofGreen', 'roofGrey'] as MatKey[])[(variant + 1) % 4];
  b.box(paint, 3.0, 2.0, 2.4, 0, 1.0, 0, 0, 2);
  b.box('concrete', 3.15, 0.12, 2.55, 0, 2.05, 0, 0, 2);
  for (const g of gableRoof(3.2, 2.6, 0.45, 0.06)) b.add(roof, g, 0, 2.12, 0);
  b.box('woodDark', 0.7, 1.3, 0.05, -0.6, 0.65, 1.21, 0, 1);
  for (const x of [0.55, 1.15]) b.box('window', 0.45, 0.55, 0.05, x, 1.2, 1.21, 0, 1);
  b.box('window', 0.05, 0.55, 0.6, 1.51, 1.2, 0, 0, 1);
  // stainless water tank on stilts (very typical on Lanyu)
  const tank = new THREE.CylinderGeometry(0.35, 0.35, 0.7, 10);
  b.add('metal', tank, -0.9, 2.95, -0.5);
  b.box('metal', 0.6, 0.35, 0.6, -0.9, 2.45, -0.5, 0, 1);
}

export function addShop(b: ArchBuilder): void {
  b.box('paintCream', 3.4, 2.1, 2.8, 0, 1.05, 0, 0, 2);
  b.box('concrete', 3.55, 0.14, 2.95, 0, 2.15, 0, 0, 2);
  b.box('glass', 2.2, 1.0, 0.05, 0.2, 1.0, 1.41, 0, 1);
  b.box('woodDark', 0.7, 1.4, 0.05, -1.2, 0.7, 1.41, 0, 1);
  // striped awning
  for (let k = 0; k < 8; k++) b.add(k % 2 ? 'white' : 'roofRed', boxUV(0.44, 0.04, 0.9), -1.55 + k * 0.44, 1.75, 1.75, 0, 0.35, 0);
  b.box('concrete', 0.25, 0.4, 0.25, -1.5, 2.45, -1, 0, 1);
}

export function addChurch(b: ArchBuilder): void {
  b.box('plaster', 3.2, 2.5, 5.0, 0, 1.25, 0, 0, 2);
  for (const g of gableRoof(5.3, 3.6, 1.3, 0.1)) b.add('roofGrey', g, 0, 2.5, 0, Math.PI / 2);
  b.add('plaster', gableInfill(3.2, 1.25, 0), 0, 2.5, 2.5, Math.PI / 2);
  b.add('plaster', gableInfill(3.2, 1.25, 0), 0, 2.5, -2.5, Math.PI / 2);
  // tower + cross on the seaward gable
  b.box('plaster', 1.0, 2.0, 1.0, 0, 3.0, 2.0, 0, 2);
  b.add('roofGrey', new THREE.ConeGeometry(0.78, 1.0, 4), 0, 4.5, 2.0, Math.PI / 4);
  b.box('white', 0.08, 0.7, 0.08, 0, 5.3, 2.0);
  b.box('white', 0.4, 0.08, 0.08, 0, 5.4, 2.0);
  // tatala-motif band (red/black/white) along the walls
  for (let k = 0; k < 10; k++) b.box(k % 2 ? 'red' : 'black', 0.32, 0.12, 0.03, -1.45 + k * 0.32, 0.6, 2.52, 0, 1);
  b.box('woodDark', 0.9, 1.5, 0.05, 0, 0.75, 2.52, 0, 1);
  for (const z of [-1.5, -0.3, 0.9]) {
    b.box('window', 0.05, 0.9, 0.45, 1.61, 1.4, z, 0, 1);
    b.box('window', 0.05, 0.9, 0.45, -1.61, 1.4, z, 0, 1);
  }
}

export function addClinic(b: ArchBuilder): void {
  // 蘭嶼鄉衛生所: two storeys, white with teal trim
  b.box('plaster', 5.6, 3.6, 3.4, 0, 1.8, 0, 0, 2);
  b.box('paintMint', 5.8, 0.25, 3.6, 0, 1.85, 0, 0, 2);
  b.box('concrete', 5.9, 0.18, 3.7, 0, 3.68, 0, 0, 2);
  for (const g of gableRoof(5.4, 3.0, 0.6, 0.08)) b.add('roofGreen', g, 0, 3.78, 0);
  for (const x of [-2.1, -1.1, 1.1, 2.1]) {
    b.box('window', 0.6, 0.7, 0.05, x, 1.1, 1.71, 0, 1);
    b.box('window', 0.6, 0.7, 0.05, x, 2.7, 1.71, 0, 1);
  }
  b.box('glass', 1.1, 1.5, 0.05, 0, 0.75, 1.71, 0, 1);
  b.box('concrete', 2.0, 0.12, 1.2, 0, 1.65, 2.2, 0, 1); // entrance canopy
  b.box('concrete', 0.12, 1.6, 0.12, -0.9, 0.8, 2.7, 0, 1);
  b.box('concrete', 0.12, 1.6, 0.12, 0.9, 0.8, 2.7, 0, 1);
  // red cross
  b.box('red', 0.6, 0.16, 0.05, 0, 3.2, 1.73, 0, 1);
  b.box('red', 0.16, 0.6, 0.05, 0, 3.2, 1.73, 0, 1);
}

export function addAirport(b: ArchBuilder): void {
  // 蘭嶼航空站 terminal, control cab & windsock
  b.box('plaster', 7.0, 1.9, 3.2, 0, 0.95, 0, 0, 2);
  b.box('paintBlue', 7.2, 0.3, 3.4, 0, 1.95, 0, 0, 2);
  b.box('glass', 4.0, 1.0, 0.05, -0.8, 1.0, 1.61, 0, 1);
  b.box('plaster', 1.5, 1.6, 1.5, 2.6, 2.9, -0.4, 0, 2);
  b.box('glass', 1.7, 0.7, 1.7, 2.6, 4.0, -0.4, 0, 1);
  b.box('concrete', 1.8, 0.1, 1.8, 2.6, 4.4, -0.4, 0, 1);
  b.box('metal', 0.06, 2.6, 0.06, -4.6, 1.3, 2.5, 0, 1);
  b.add('red', new THREE.ConeGeometry(0.16, 0.9, 6, 1, true), -4.25, 2.5, 2.5, 0, 0, Math.PI / 2);
  // small commuter plane (Dornier 228 style) on the apron; 0.1.4: the same model that flies the arrival opening
  // (nose toward local −x like before, scaled to the PLANE_FOOT collision box)
  // 0.1.1: parked beside the terminal; 0.1.1 moved the whole airport 0.8 m east so its wing clears the ring road
  // 0.1.4: the plane is now its own object (src/world/arrival.ts buildArrivalProps), so it can be animated later
}

/** a sub-frame inside the current ArchBuilder frame: parts placed at (ox, oy, oz), turned by `yaw`, scaled by `s` */
function subFrame(b: ArchBuilder, ox: number, oy: number, oz: number, yaw: number, s: number) {
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const at = (x: number, z: number): [number, number] => [ox + (x * c + z * sn) * s, oz + (-x * sn + z * c) * s];
  const add = (key: MatKey, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0): void => {
    g.scale(s, s, s);
    const [wx, wz] = at(x, z);
    b.add(key, g, wx, oy + y * s, wz, ry + yaw, rx, rz);
  };
  const box = (key: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0): void => add(key, boxUV(w, h, d, 1), x, y, z, ry);
  return { add, box };
}

/**
 * 0.1.4 commuter plane (Do 228-like, after art-ref/arrival/plane_*.png; generic white with a double blue cheat
 * line sweeping up the fin, no airline marks). Nose toward local +z, wheels on y = 0, about 6.4 m long.
 * `props`: false leaves the propeller blades out (the arrival scene spins its own).
 */
export function addCommuterPlane(b: ArchBuilder, ox: number, oy: number, oz: number, yaw: number, s = 1, props = true): void {
  const { add, box } = subFrame(b, ox, oy, oz, yaw, s);
  // long slender fuselage: a rounded box (two boxes + a belly), tapering nose and a long upswept tail cone
  box('vWhite', 0.6, 0.56, 3.6, 0, 0.86, 0);
  box('vBelly', 0.58, 0.14, 3.5, 0, 0.55, 0);
  const nose = new THREE.CylinderGeometry(0.06, 0.32, 1.1, 10);
  nose.scale(1, 1, 0.9);
  add('vWhite', nose, 0, 0.78, 2.35, 0, Math.PI / 2, 0);
  const tail = new THREE.CylinderGeometry(0.3, 0.07, 1.9, 10);
  add('vWhite', tail, 0, 0.98, -2.7, 0, Math.PI / 2 + 0.12, 0);
  // cockpit glass (two panes per side, raked) and the row of six square cabin windows
  for (const sd of [-1, 1]) {
    add('vGlass', boxUV(0.03, 0.16, 0.34, 1), sd * 0.27, 1.0, 1.85, sd * 0.25, 0, sd * 0.25);
    for (let k = 0; k < 6; k++) box('vGlass', 0.03, 0.13, 0.14, sd * 0.305, 0.94, 1.1 - k * 0.36);
    box('vGlass', 0.03, 0.4, 0.22, sd * 0.305, 0.8, 1.45); // the forward door outline reads as a darker panel
  }
  box('vGlass', 0.4, 0.16, 0.05, 0, 1.06, 2.02);
  // double blue cheat line along the lower fuselage
  box('vBlue', 0.62, 0.07, 4.3, 0, 0.66, -0.2);
  box('vBlue', 0.62, 0.035, 4.1, 0, 0.74, -0.3);
  // high straight wing on top of the cabin, slender, with the engines slung at its leading edge
  box('vWhite', 6.6, 0.07, 0.56, 0, 1.2, 0.35);
  box('vBelly', 6.4, 0.03, 0.5, 0, 1.15, 0.33);
  for (const sd of [-1, 1]) {
    box('vWhite', 0.26, 0.28, 1.15, sd * 1.15, 1.06, 0.6);
    box('vDark', 0.18, 0.08, 0.2, sd * 1.15, 0.94, 1.12); // intake
    add('vDark', new THREE.ConeGeometry(0.1, 0.18, 8), sd * 1.15, 1.06, 1.26, 0, Math.PI / 2, 0); // spinner
    if (props) for (let k = 0; k < 3; k++) add('vDark', boxUV(0.06, 0.95, 0.02, 1), sd * 1.15, 1.06, 1.24, 0, 0, (k / 3) * Math.PI * 2 + 0.4);
  }
  // tall swept fin with the blue band, tailplane low on the tail cone
  const fin = new THREE.Shape();
  fin.moveTo(-0.15, 0);
  fin.lineTo(0.85, 0);
  fin.lineTo(0.95, 1.05);
  fin.lineTo(0.45, 1.05);
  fin.closePath();
  const finG = new THREE.ExtrudeGeometry(fin, { depth: 0.06, bevelEnabled: false });
  finG.translate(0, 0, -0.03);
  add('vWhite', finG, 0, 1.1, -2.4, Math.PI / 2);
  add('vBlue', boxUV(0.07, 0.1, 0.9, 1), 0, 1.62, -3.0, 0, -0.35, 0);
  add('vBlue', boxUV(0.07, 0.05, 0.9, 1), 0, 1.75, -3.05, 0, -0.35, 0);
  box('vWhite', 2.1, 0.05, 0.5, 0, 1.08, -3.25);
  // fixed gear: sponsons with main wheels, nose leg
  for (const sd of [-1, 1]) {
    box('vBelly', 0.2, 0.2, 0.8, sd * 0.38, 0.42, 0.0);
    add('vDark', new THREE.CylinderGeometry(0.15, 0.15, 0.1, 12), sd * 0.46, 0.15, 0.0, 0, 0, Math.PI / 2);
  }
  box('vSteel', 0.05, 0.42, 0.05, 0, 0.3, 1.85);
  add('vDark', new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), 0, 0.1, 1.85, 0, 0, Math.PI / 2);
  // 0.1.4 detail: wingtip nav lights (red port / green starboard), tail strobe, beacon, aerials, door and hatch
  // outlines, engine exhausts, a pitot tube, the rear stairs door, wheel chocks
  add('red', boxUV(0.08, 0.06, 0.16, 1), 3.32, 1.2, 0.35);
  add('paintMint', boxUV(0.08, 0.06, 0.16, 1), -3.32, 1.2, 0.35);
  add('white', boxUV(0.06, 0.06, 0.08, 1), 0, 1.02, -3.62);
  add('red', new THREE.CylinderGeometry(0.05, 0.06, 0.07, 8), 0, 1.18, -0.9);
  add('red', new THREE.CylinderGeometry(0.04, 0.05, 0.06, 8), 0, 0.47, 0.2);
  box('vSteel', 0.02, 0.22, 0.12, 0, 1.24, -1.4, 0);
  add('vSteel', boxUV(0.015, 0.02, 0.9, 1), 0, 1.22, -0.2, 0, -0.05, 0);
  for (const sd of [-1, 1]) {
    box('vBelly', 0.025, 0.62, 0.48, sd * 0.31, 0.83, -1.15); // rear door panel
    box('vDark', 0.012, 0.6, 0.012, sd * 0.318, 0.83, -0.92);
    box('vDark', 0.012, 0.6, 0.012, sd * 0.318, 0.83, -1.38);
    box('vDark', 0.07, 0.07, 0.25, sd * 1.15 + sd * 0.1, 1.0, 0.0); // exhaust
    box('vBelly', 0.22, 0.03, 0.9, sd * 1.15, 1.205, 0.55); // nacelle top fairing
    box('vDark', 0.015, 0.05, 0.12, sd * 0.31, 1.06, 2.1); // windscreen wiper
    for (const z of [-0.18, 0.18]) box('black', 0.06, 0.08, 0.1, sd * 0.46, 0.04, z); // chocks
  }
  add('vSteel', new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), 0.42, 1.18, 0.75, 0, Math.PI / 2, 0); // pitot
  box('vBlue', 0.62, 0.02, 0.5, 0, 1.17, -2.0); // blue spine accent before the fin
}

/**
 * 0.1.4 small motor yacht (after art-ref/arrival/yacht_side.png, the master view): cream-white hull with a deep
 * navy stripe and a porthole, dark antifouling below, low raked windscreen, a hard-top on a swept arch, bow rails,
 * sand seats aft, a teak swim platform and an outboard. About 5.2 m; bow toward local +z, waterline at y = 0.
 */
export function addYacht(b: ArchBuilder, ox: number, oy: number, oz: number, yaw: number, s = 1): void {
  const { add, box } = subFrame(b, ox, oy, oz, yaw, s);
  // hull: antifouling under the waterline, white topsides with a navy stripe, a sheer that rises to the bow
  box('vAntifoul', 1.5, 0.22, 3.7, 0, -0.08, -0.4);
  box('vWhite', 1.6, 0.5, 3.8, 0, 0.27, -0.4);
  box('vNavy', 1.62, 0.13, 3.82, 0, 0.3, -0.4);
  const bow = new THREE.ConeGeometry(1.13, 1.6, 4, 1);
  bow.rotateY(Math.PI / 4);
  bow.scale(1, 1, 0.31); // flattened: a deep V bow (vertical after the turn below)
  add('vWhite', bow, 0, 0.3, 2.25, 0, Math.PI / 2, 0);
  const bowStripe = new THREE.ConeGeometry(1.15, 1.62, 4, 1);
  bowStripe.rotateY(Math.PI / 4);
  bowStripe.scale(1, 1, 0.08);
  add('vNavy', bowStripe, 0, 0.3, 2.25, 0, Math.PI / 2, 0);
  for (const sd of [-1, 1]) add('vDark', new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), sd * 0.82, 0.31, 1.25, 0, 0, Math.PI / 2); // porthole
  // deck (white foredeck with a dark hatch, sand seats aft)
  box('vWhite', 1.5, 0.05, 3.7, 0, 0.53, -0.4);
  const fore = new THREE.ConeGeometry(1.06, 1.5, 4, 1);
  fore.rotateY(Math.PI / 4);
  fore.scale(1, 1, 0.04);
  add('vWhite', fore, 0, 0.54, 2.2, 0, Math.PI / 2, 0);
  box('vGlass', 0.5, 0.02, 0.5, 0, 0.57, 1.55); // foredeck hatch
  // low cabin top and raked windscreen
  box('vWhite', 1.3, 0.24, 1.3, 0, 0.66, 0.55);
  add('vGlass', boxUV(1.24, 0.3, 0.03, 1), 0, 0.88, 0.95, 0, -1.05, 0);
  for (const sd of [-1, 1]) add('vGlass', boxUV(0.03, 0.22, 0.75, 1), sd * 0.62, 0.86, 0.45, 0, 0, sd * -0.12);
  // swept arch with a hard-top and a radome
  for (const sd of [-1, 1]) add('vWhite', boxUV(0.08, 0.95, 0.24, 1), sd * 0.55, 1.05, -0.35, 0, -0.38, 0);
  box('vWhite', 1.3, 0.06, 0.95, 0, 1.5, -0.2);
  add('vWhite', new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), 0, 1.58, -0.2);
  box('vSteel', 0.02, 0.35, 0.02, 0.25, 1.7, -0.4);
  // seats, the stern bench, teak swim platform, outboard
  box('vSeat', 0.45, 0.32, 0.4, -0.35, 0.72, -0.55);
  box('vSeat', 1.2, 0.25, 0.45, 0, 0.66, -1.8);
  box('woodPale', 1.3, 0.05, 0.4, 0, 0.12, -2.48);
  box('vDark', 0.26, 0.55, 0.3, 0, 0.3, -2.45);
  box('vSteel', 0.07, 0.45, 0.07, 0, -0.05, -2.5);
  // bow rails on stanchions (the POV shot looks over them)
  for (const sd of [-1, 1]) {
    for (const z of [0.95, 1.55, 2.1]) box('vSteel', 0.03, 0.28, 0.03, sd * (0.68 - (z - 0.9) * 0.28), 0.7, z);
    add('vSteel', boxUV(0.03, 0.03, 1.55, 1), sd * 0.52, 0.84, 1.6, sd * -0.2);
  }
  add('vSteel', boxUV(0.4, 0.03, 0.03, 1), 0, 0.84, 2.38);
  // fenders
  for (const sd of [-1, 1]) add('vWhite', new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), sd * 0.86, 0.2, -0.2);
  // 0.1.4 detail: a grey rub rail along the sheer, a second thin stripe, windscreen frame, bow cleats and anchor,
  // nav lights (red port / green starboard, white masthead), stern cleats, a swim ladder, aft fenders, the helm
  for (const sd of [-1, 1]) {
    box('vSteel', 0.04, 0.05, 3.8, sd * 0.81, 0.5, -0.4);
    box('vBlue', 0.02, 0.025, 3.4, sd * 0.81, 0.14, -0.5);
    add('vSteel', boxUV(0.03, 0.32, 0.03, 1), sd * 0.62, 0.86, 0.95, 0, -1.05, 0);
    box('vSteel', 0.05, 0.04, 0.16, sd * 0.32, 0.58, 1.95); // bow cleat
    box('vSteel', 0.05, 0.04, 0.16, sd * 0.62, 0.58, -2.1); // stern cleat
    add(sd < 0 ? 'red' : 'paintMint', boxUV(0.05, 0.05, 0.1, 1), sd * 0.66, 0.68, 1.0);
    add('vWhite', new THREE.CylinderGeometry(0.06, 0.06, 0.26, 8), sd * 0.84, 0.18, -1.7);
  }
  add('vSteel', boxUV(1.24, 0.03, 0.03, 1), 0, 1.02, 1.0, 0, -1.05, 0);
  box('vSteel', 0.12, 0.08, 0.3, 0, 0.42, 2.85); // anchor on the stem
  box('vSteel', 0.06, 0.03, 0.4, 0, 0.58, 2.5); // anchor roller / chain plate
  add('white', new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), 0, 1.66, -0.4);
  for (const y of [0.0, 0.1, 0.2]) box('vSteel', 0.3, 0.02, 0.03, 0.4, y, -2.7); // ladder rungs
  for (const sd of [-1, 1]) box('vSteel', 0.02, 0.32, 0.02, 0.4 + sd * 0.15, 0.08, -2.7);
  add('vDark', new THREE.CylinderGeometry(0.12, 0.12, 0.03, 12), 0.35, 0.86, 0.3, 0, -0.9, 0); // helm wheel
  box('vSeat', 0.45, 0.3, 0.4, 0.35, 0.71, -0.55);
}

/** 開元港 breakwater, pier, harbour lighthouse & tetrapods. Origin = harbour apron at sea level. */
export function addHarbor(b: ArchBuilder): void {
  // concrete apron + quay
  b.box('concrete', 4.0, 0.9, 9.0, -1.5, 0.1, 0, 0, 2);
  // pier stretching west into the sea
  b.box('concrete', 8.0, 0.55, 1.8, -7.0, 0.12, -0.6, 0, 2);
  for (let k = 0; k < 6; k++) b.box('concrete', 0.3, 1.4, 0.3, -4.0 - k * 1.4, -0.6, 0.25, 0, 1);
  // curved breakwater arm
  for (let k = 0; k < 9; k++) {
    const a = -0.2 - k * 0.16;
    const x = -6 + Math.cos(a) * -6.5;
    const z = -4.2 + Math.sin(a) * 6.5;
    b.box('concrete', 1.9, 1.5, 1.4, x - 3, 0.25, z, a, 2);
  }
  // harbour light (red) at the end of the breakwater
  b.add('red', new THREE.CylinderGeometry(0.32, 0.4, 2.6, 10), -15.4, 1.6, -7.2);
  b.add('white', new THREE.CylinderGeometry(0.42, 0.42, 0.22, 10), -15.4, 2.95, -7.2);
  b.add('lamp', new THREE.CylinderGeometry(0.22, 0.22, 0.4, 10), -15.4, 3.26, -7.2);
  b.add('red', new THREE.ConeGeometry(0.3, 0.35, 10), -15.4, 3.63, -7.2);
  // green light at the pier head
  b.add('roofGreen', new THREE.CylinderGeometry(0.22, 0.28, 1.6, 10), -11.0, 1.15, -0.6);
  b.add('lamp', new THREE.CylinderGeometry(0.16, 0.16, 0.3, 10), -11.0, 2.1, -0.6);
  // bollards
  for (let k = 0; k < 5; k++) b.add('black', new THREE.CylinderGeometry(0.08, 0.1, 0.25, 8), -4.2 - k * 1.5, 0.52, -1.35);
  // harbour office
  b.box('paintBlue', 2.2, 1.6, 1.8, -0.8, 1.35, 2.6, 0, 2);
  for (const g of gableRoof(2.4, 2.0, 0.4, 0.06)) b.add('roofBlue', g, -0.8, 2.15, 2.6);
  b.box('window', 0.5, 0.5, 0.05, -0.4, 1.4, 3.51, 0, 1);
}

/** Tetrapod armour blocks along the breakwater (instanced in decor). */
export function tetrapodGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const dirs = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.94, -0.33, 0), new THREE.Vector3(-0.47, -0.33, 0.82), new THREE.Vector3(-0.47, -0.33, -0.82)];
  for (const d of dirs) {
    const c = new THREE.CylinderGeometry(0.12, 0.22, 0.55, 6);
    c.translate(0, 0.27, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    c.applyQuaternion(q);
    parts.push(prep(c));
  }
  return mergeGeometries(parts)!;
}

/** Lighthouse (小蘭嶼燈塔 / headland light). Origin = ground. */
export function addLighthouse(b: ArchBuilder, h = 3.4): void {
  b.add('white', new THREE.CylinderGeometry(0.42, 0.6, h, 12), 0, h / 2, 0);
  b.add('red', new THREE.CylinderGeometry(0.43, 0.46, 0.3, 12), 0, h * 0.55, 0);
  b.add('black', new THREE.CylinderGeometry(0.58, 0.58, 0.08, 12), 0, h + 0.04, 0);
  b.add('lamp', new THREE.CylinderGeometry(0.32, 0.32, 0.5, 12), 0, h + 0.33, 0);
  b.add('red', new THREE.ConeGeometry(0.45, 0.45, 12), 0, h + 0.8, 0);
}

/** 蘭嶼氣象站 (0.1.4): a low white office, a lattice mast and a radar dome. Origin = ground. */
export function addWeatherStation(b: ArchBuilder): void {
  b.box('plaster', 2.6, 1.3, 1.9, 0, 0.65, 0, 0, 1);
  b.box('roofGrey', 2.8, 0.12, 2.1, 0, 1.36, 0, 0, 1);
  b.box('window', 0.5, 0.36, 0.02, -0.6, 0.85, 0.96, 0, 1);
  b.box('window', 0.5, 0.36, 0.02, 0.6, 0.85, 0.96, 0, 1);
  b.add('white', new THREE.SphereGeometry(0.42, 12, 8), 0.7, 1.75, -0.35);
  b.add('metal', new THREE.CylinderGeometry(0.04, 0.07, 3.2, 6), -0.95, 1.6, -0.6);
  b.box('metal', 0.5, 0.03, 0.03, -0.95, 2.9, -0.6, 0, 1);
}

/** a small roadside waterfall (0.1.4): a wet rock face, a white water ribbon and a pool. Origin = pool. */
export function addFalls(b: ArchBuilder): void {
  b.box('stoneDark', 2.4, 2.6, 0.9, 0, 1.3, -0.9, 0, 1);
  b.box('white', 0.42, 2.3, 0.08, 0, 1.25, -0.42, 0, 1);
  b.box('paintBlue', 1.5, 0.06, 1.0, 0, 0.04, 0.05, 0, 1);
}

/** Lantern post: timber post, cross-arm and a paper lantern. Origin = ground. Returns lamp height. */
export function addLanternPost(b: ArchBuilder, h = 1.7): number {
  b.box('woodDark', 0.09, h, 0.09, 0, h / 2, 0, 0, 1);
  b.box('woodDark', 0.5, 0.06, 0.07, 0.18, h - 0.05, 0, 0, 1);
  b.add('lamp', new THREE.CylinderGeometry(0.12, 0.1, 0.3, 8), 0.36, h - 0.27, 0);
  b.add('red', new THREE.CylinderGeometry(0.13, 0.13, 0.04, 8), 0.36, h - 0.1, 0);
  b.add('red', new THREE.CylinderGeometry(0.11, 0.11, 0.04, 8), 0.36, h - 0.44, 0);
  return h - 0.27;
}

/** Flying-fish drying rack (曬飛魚架). Origin = ground. */
export function addFishRack(b: ArchBuilder): void {
  for (const x of [-0.9, 0.9]) {
    b.box('woodDark', 0.06, 1.3, 0.06, x, 0.65, -0.15, 0, 1);
    b.box('woodDark', 0.06, 1.3, 0.06, x, 0.65, 0.15, 0, 1);
  }
  for (const y of [0.85, 1.2]) b.box('wood', 2.0, 0.04, 0.04, 0, y, 0, 0, 1);
  for (let k = 0; k < 12; k++) {
    const y = k % 2 ? 0.85 : 1.2;
    b.add('metal', boxUV(0.05, 0.28, 0.12), -0.82 + (k >> 1) * 0.32 + (k % 2) * 0.1, y - 0.16, 0);
  }
}

// ---------------------------------------------------------------------------
// tatala — single-hull Tao plank boat (NO outrigger)
// ---------------------------------------------------------------------------

function tatalaHull(L: number, B: number, D: number, horn: number): THREE.BufferGeometry {
  const NS = 36;
  const NT = 12;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= NS; i++) {
    const s = (i / NS) * 2 - 1;
    const as = Math.abs(s);
    const halfW = (B / 2) * Math.pow(Math.max(0, 1 - Math.pow(as, 2.4)), 0.7);
    const end = THREE.MathUtils.smoothstep(as, 0.45, 1.0);
    const sheer = D + horn * end * end; // gunwale sweeps up toward the ends
    const keel = 0.04 * as * as + end * end * end * horn * 0.8;
    const x = s * (L / 2);
    for (let j = 0; j <= NT; j++) {
      const t = (j / NT) * 2 - 1; // -1 left gunwale, 0 keel, 1 right gunwale
      const phi = t * (Math.PI / 2);
      const z = halfW * Math.sin(phi);
      const y = keel + (sheer - keel) * (1 - Math.cos(phi));
      pos.push(x, y, z);
      uv.push(i / NS, Math.abs(t));
    }
  }
  const row = NT + 1;
  for (let i = 0; i < NS; i++) {
    for (let j = 0; j < NT; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let HORN_TEX: THREE.CanvasTexture | null = null;
function hornTex(): THREE.CanvasTexture {
  if (HORN_TEX) return HORN_TEX;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f1ebdc';
  ctx.fillRect(0, 0, 32, 96);
  ctx.fillStyle = '#1b1714';
  ctx.fillRect(0, 0, 4, 96);
  ctx.fillRect(28, 0, 4, 96);
  ctx.fillStyle = '#b3332a';
  for (let y = 6; y < 96; y += 14) {
    ctx.fillRect(4, y, 24, 3);
    for (let k = 0; k < 6; k++) ctx.fillRect(10 + (k % 2) * 6, y + 4 + k, 6, 1);
  }
  ctx.fillStyle = '#1b1714';
  for (let y = 12; y < 96; y += 14) ctx.fillRect(13, y, 6, 2);
  HORN_TEX = new THREE.CanvasTexture(c);
  HORN_TEX.colorSpace = THREE.SRGBColorSpace;
  HORN_TEX.magFilter = THREE.NearestFilter;
  return HORN_TEX;
}

/** Upturned, outward-curving end blade (tatala prow/stern). Built in +X, mirrored for the stern. */
function hornGeometry(L: number): THREE.BufferGeometry {
  const H = L * 0.34;
  const s = new THREE.Shape();
  s.moveTo(0.02 * L, 0);
  s.quadraticCurveTo(0.08 * L, H * 0.5, 0.15 * L, H); // outer edge sweeping up & out
  s.lineTo(0.1 * L, H * 1.03);
  s.quadraticCurveTo(-0.04 * L, H * 0.45, -0.2 * L, H * 0.02); // inner edge — broad crescent base
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, -L * 0.07, -0.025);
  // normalise UVs to the blade so the painted bands follow its length
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const t = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y);
    const w = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x);
    uv.setXY(i, w, t);
  }
  return g;
}

// ~50 boats share these instead of each building its own materials / geometry
let HORN_MAT: THREE.MeshStandardMaterial | null = null;
let TATALA_ALT_MAT: THREE.MeshStandardMaterial | null = null;
const HULL_CACHE = new Map<number, THREE.BufferGeometry>();
const HORN_CACHE = new Map<number, THREE.BufferGeometry>();
const BALL_GEOS: THREE.SphereGeometry[] = [];

function cachedHull(L: number): THREE.BufferGeometry {
  let geo = HULL_CACHE.get(L);
  if (!geo) {
    geo = tatalaHull(L, L * 0.21, L * 0.12, L * 0.11);
    HULL_CACHE.set(L, geo);
  }
  return geo;
}

function cachedHorn(L: number): THREE.BufferGeometry {
  let geo = HORN_CACHE.get(L);
  if (!geo) {
    geo = hornGeometry(L);
    HORN_CACHE.set(L, geo);
  }
  return geo;
}

function ballGeo(k: number): THREE.SphereGeometry {
  if (!BALL_GEOS[k]) BALL_GEOS[k] = new THREE.SphereGeometry(0.03 + k * 0.006, 12, 8);
  return BALL_GEOS[k];
}

/** Builds a free-standing tatala group (needs to bob individually). */
export function makeTatala(length = 2.6, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const mats = archMaterials();
  const L = length;
  const hull = cachedHull(L);
  if (!TATALA_ALT_MAT) TATALA_ALT_MAT = new THREE.MeshStandardMaterial({ map: tatalaTex(2), roughness: 0.6 });
  // orient faces outward: test & flip if needed
  const outer = new THREE.Mesh(hull, seed % 2 ? mats.tatala : TATALA_ALT_MAT);
  outer.castShadow = true;
  outer.receiveShadow = true;
  const inner = new THREE.Mesh(hull, mats.tatalaIn);
  inner.receiveShadow = true;
  g.add(outer, inner);
  // thwarts / seats
  const seats = [-0.22, 0.0, 0.22];
  for (const s of seats) {
    const w = L * 0.19 * Math.pow(1 - Math.pow(Math.abs(s * 2), 2.4), 0.7);
    const seat = new THREE.Mesh(boxUV(0.07, 0.03, w, 1), mats.wood);
    seat.position.set(s * L, L * 0.105, 0);
    seat.castShadow = true;
    g.add(seat);
  }
  // carved upturned prow & stern blades (painted), with feather tufts on the tips
  if (!HORN_MAT) HORN_MAT = new THREE.MeshStandardMaterial({ map: hornTex(), roughness: 0.6, side: THREE.DoubleSide });
  const hornMat = HORN_MAT;
  for (const sx of [-1, 1]) {
    const blade = cachedHorn(L);
    const m = new THREE.Mesh(blade, hornMat);
    m.position.set(sx * (L / 2 - 0.06), L * 0.2, 0);
    m.scale.x = sx;
    m.castShadow = true;
    g.add(m);
    const tip = new THREE.Vector3(sx * (L / 2 - 0.06 + L * 0.125), L * 0.2 + L * 0.28, 0);
    for (let k = 0; k < 3; k++) {
      const ball = new THREE.Mesh(ballGeo(k), k === 1 ? mats.white : mats.black);
      ball.position.copy(tip).add(new THREE.Vector3(sx * 0.025 * k, 0.03 + k * 0.045, 0));
      g.add(ball);
    }
  }
  // two paddles resting inside
  for (const z of [-0.06, 0.06]) {
    const p = new THREE.Mesh(boxUV(L * 0.5, 0.025, 0.04, 1), mats.woodPale);
    p.position.set(0.05, L * 0.11, z);
    p.rotation.y = z * 2;
    g.add(p);
    const blade = new THREE.Mesh(boxUV(0.22, 0.02, 0.09, 1), mats.woodPale);
    blade.position.set(0.05 + L * 0.27, L * 0.11, z + z * 0.5);
    g.add(blade);
  }
  g.name = 'tatala';
  return g;
}
