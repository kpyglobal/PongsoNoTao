import * as THREE from 'three';
import { uCharGlow, uCharGlowShape } from '../render/spriteGlow';
import type { Assets } from '../core/assets';
import { surfaceHeight, FEET_BIAS } from '../world/collision';

const DIRS = ['s', 'w', 'n', 'e'] as const;
export type Dir = (typeof DIRS)[number];

export function dirFromRelative(rel: number): Dir {
  // rel = facingYaw - cameraYaw, wrapped -PI..PI (yaw = atan2(dx, dz), camYaw = atan2 of the
  // camera offset from the sprite). 0 means facing the camera (show south / front).
  // +90° = moving along the camera's screen-right axis (cos camYaw, -sin camYaw) → the sheet's
  // 'e' row (figure faces screen-right); -90° → 'w' (faces screen-left). 0.1.0 had these two
  // swapped, so walking right showed the left-facing row.
  const a = ((rel + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  const deg = (a * 180) / Math.PI;
  if (deg >= -45 && deg < 45) return 's';
  if (deg >= 45 && deg < 135) return 'e';
  if (deg >= -135 && deg < -45) return 'w';
  return 'n';
}

/** Unlit sprites: cap luminance just under the bloom threshold (0.82) so white coats / rim pixels never glow like a specular hit. */
const NO_SHINE_CAP = 0.78;
function noShine(mat: THREE.MeshBasicMaterial): void {
  mat.onBeforeCompile = (sh) => {
    // night halo (render/spriteGlow.ts, CHARACTER_GLOW in styleConfig.ts): transparent texels next to the
    // silhouette are kept and painted with a faint warm glow instead of being discarded
    sh.uniforms.uCharGlow = uCharGlow;
    sh.uniforms.uCharGlowShape = uCharGlowShape;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uCharGlow;\nuniform vec2 uCharGlowShape;')
      .replace('#include <alphatest_fragment>', `float tHalo = 0.0;
       #if defined( USE_ALPHATEST ) && defined( USE_MAP )
       if (diffuseColor.a < alphaTest) {
         if (uCharGlow.a > 0.0) {
           vec2 tx = uCharGlowShape.x / vec2(textureSize(map, 0));
           float m = max(max(texture2D(map, vMapUv + vec2(tx.x, 0.0)).a, texture2D(map, vMapUv - vec2(tx.x, 0.0)).a),
                         max(texture2D(map, vMapUv + vec2(0.0, tx.y)).a, texture2D(map, vMapUv - vec2(0.0, tx.y)).a));
           float m2 = max(max(texture2D(map, vMapUv + tx * 0.7).a, texture2D(map, vMapUv - tx * 0.7).a),
                          max(texture2D(map, vMapUv + vec2(tx.x, -tx.y) * 0.7).a, texture2D(map, vMapUv + vec2(-tx.x, tx.y) * 0.7).a));
           tHalo = smoothstep(0.2, 0.9, max(m, m2 * 0.8));
         }
         if (tHalo <= 0.0) discard;
       }
       #else
       #include <alphatest_fragment>
       #endif`)
      .replace(
      '#include <opaque_fragment>',
      `outgoingLight += outgoingLight * uCharGlowShape.y + uCharGlow.rgb * uCharGlowShape.y * 0.15;
       if (tHalo > 0.0) { outgoingLight = uCharGlow.rgb; diffuseColor.a = tHalo * uCharGlow.a; }
       { float lum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
         if (lum > ${NO_SHINE_CAP.toFixed(2)}) outgoingLight *= ${NO_SHINE_CAP.toFixed(2)} / lum; }
       #include <opaque_fragment>`,
    );
  };
  mat.customProgramCacheKey = () => 'tao-sprite-noshine';
}

/** tint targets: shade zones dim to ~0.75, the farther of two overlapping characters to ~0.85 */
export const SHADE_TINT = 0.75;
export const OVERLAP_TINT = 0.85;
/** opacity of the farther character while it overlaps a nearer one (fades in / out smoothly) */
export const OVERLAP_OPACITY = 0.6;
const ALPHA_TEST = 0.55;

const IDLE_BREATH_PERIOD = 1.9; // s: ~0.95 s at rest, ~0.95 s inhaled
const IDLE_BLINK_MIN = 2.5; // s between blinks
const IDLE_BLINK_MAX = 6.0;
const IDLE_BLINK_MS = 110;

export class SpriteBillboard {
  mesh: THREE.Mesh;
  tex: THREE.Texture;
  cols: number;
  rows: number;
  worldW: number;
  worldH: number;
  groundY = 0;
  facing = 0; // yaw, 0 = toward +Z (south)
  walking = false;
  frame = 0;
  /** direction row last shown (s / w / n / e; debug + tests) */
  dir: Dir = 's';
  private acc = 0;
  kind: string;
  /** walk sheets with 8 rows carry idle rows 4-7 (s, w, n, e): [rest, inhale, blink, rest] */
  readonly hasIdle: boolean;
  // idle: breathing only (1px chest/shoulder lift) + an occasional blink; random phase per instance
  private breathT = Math.random() * IDLE_BREATH_PERIOD;
  private blinkIn = IDLE_BLINK_MIN + Math.random() * (IDLE_BLINK_MAX - IDLE_BLINK_MIN);
  private blinkLeft = 0;
  /** 0..1 shade-zone coverage at the feet (set per frame by the tint pass) */
  shade = 0;
  /** true when another character overlaps this one on screen and is closer to the camera */
  behind = false;
  private tint = 1;
  private fade = 1;

  constructor(
    tex: THREE.Texture,
    opts: {
      cols: number; rows: number; worldH: number; kind?: string; anchor?: 'feet' | 'center';
      /** the sheet is a sub-rectangle of an atlas texture: pixel rect (top-left origin) + atlas size */
      region?: { x: number; y: number; w: number; h: number; atlasW: number; atlasH: number };
    },
  ) {
    this.tex = tex;
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.worldH = opts.worldH;
    const r = opts.region;
    // UV window of the sheet (flipY texture: v grows upward, so the sheet's bottom edge is 1 - (y + h) / H)
    this.uv = r ? { u0: r.x / r.atlasW, v0: 1 - (r.y + r.h) / r.atlasH, uw: r.w / r.atlasW, vh: r.h / r.atlasH } : { u0: 0, v0: 0, uw: 1, vh: 1 };
    const sw = r ? r.w : tex.image?.width ?? 64;
    const sh = r ? r.h : tex.image?.height ?? 64;
    this.worldW = opts.worldH * (sw / opts.cols) / (sh / opts.rows);
    this.kind = opts.kind ?? 'sprite';
    this.hasIdle = opts.rows >= 8;
    this.tex.repeat.set(this.uv.uw / this.cols, this.uv.vh / this.rows);
    this.setFrame(0, 0);
    this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping;
    // MeshBasic = unlit: no specular, no env reflection; luminance capped below the bloom threshold
    const mat = new THREE.MeshBasicMaterial({
      map: this.tex,
      transparent: true,
      alphaTest: ALPHA_TEST,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
      reflectivity: 0,
    });
    noShine(mat);
    const geo = new THREE.PlaneGeometry(this.worldW, this.worldH);
    const feet = opts.anchor === 'feet' || opts.rows >= 4;
    // Character sheets (and scooters) put the pivot at the feet so the sprite
    // sits on docks / plazas / slopes instead of sinking at its geometric center.
    if (feet) geo.translate(0, this.worldH * 0.5, 0);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = true;
    if (feet) this.mesh.renderOrder = 2;
  }

  /** free the GPU side: texture clone, plane geometry, material (NPC streaming) */
  dispose(): void {
    this.mesh.removeFromParent();
    this.tex.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  /** swap to another sheet with the same grid (e.g. protagonist outfit) */
  swapSheet(tex: THREE.Texture): void {
    // swapped sheets are always whole single sheets (player outfits)
    this.uv = { u0: 0, v0: 0, uw: 1, vh: 1 };
    tex.repeat.set(1 / this.cols, 1 / this.rows);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.offset.copy(this.tex.offset);
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
    this.tex.dispose();
    this.tex = tex;
  }

  /** ease the material tint toward shade / overlap targets (one colour uniform, no extra passes) */
  applyTint(dt: number): void {
    // floor so shade + overlap together never go muddy
    const target = Math.max(0.7, (1 - (1 - SHADE_TINT) * this.shade) * (this.behind ? OVERLAP_TINT : 1));
    const k = 1 - Math.exp(-dt * 6);
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    const next = this.tint + (target - this.tint) * k;
    if (Math.abs(next - this.tint) >= 1e-4) {
      this.tint = next;
      mat.color.setScalar(next);
    }
    // farther of two overlapping characters goes see-through; alphaTest scales with it so the
    // cut-out silhouette stays the same. Characters stay depth-sorted (transparent queue, back to
    // front) and keep depthWrite, so there is no z-fighting with the nearer one.
    const fadeTarget = this.behind ? OVERLAP_OPACITY : 1;
    if (this.fade !== fadeTarget) {
      const f = this.fade + (fadeTarget - this.fade) * k;
      this.fade = Math.abs(f - fadeTarget) < 2e-3 ? fadeTarget : f;
      mat.opacity = this.fade;
      mat.alphaTest = ALPHA_TEST * this.fade;
    }
  }

  get tintValue(): number {
    return this.tint;
  }

  get opacityValue(): number {
    return this.fade;
  }

  /** sheet UV window inside its texture (whole texture for single sheets, a slot for NPC atlases) */
  private uv: { u0: number; v0: number; uw: number; vh: number };

  setFrame(col: number, row: number): void {
    const u = this.uv;
    this.tex.offset.set(u.u0 + (col / this.cols) * u.uw, u.v0 + (1 - (row + 1) / this.rows) * u.vh);
  }

  setCell(dir: Dir, frame: number): void {
    this.dir = dir;
    const row = DIRS.indexOf(dir);
    this.setFrame(frame % this.cols, row);
  }

  /** Returns the ground height it sampled so callers (blob shadows) can reuse it. */
  setPosition(x: number, z: number, yOff = 0, ground?: number): number {
    this.groundY = ground ?? surfaceHeight(x, z);
    // feet sit on the surface (dock / plaza / terrain) plus a small bias so slopes don't swallow them
    this.mesh.position.set(x, this.groundY + FEET_BIAS + yOff, z);
    return this.groundY;
  }

  updateBillboard(camera: THREE.Camera, dt: number, animate = true): void {
    const p = this.mesh.position;
    const cam = camera.position;
    const camYaw = Math.atan2(cam.x - p.x, cam.z - p.z);
    this.mesh.rotation.y = camYaw;
    if (animate && this.rows >= 4) {
      if (this.walking) {
        this.acc += dt * 7;
        if (this.acc > 1) {
          this.acc -= 1;
          this.frame = (this.frame + 1) % this.cols;
        }
        const dir = dirFromRelative(this.facing - camYaw);
        this.setCell(dir, this.frame);
        return;
      }
      this.frame = 0;
      this.acc = 0;
      const dir = dirFromRelative(this.facing - camYaw);
      if (!this.hasIdle) {
        this.setCell(dir, 0);
        return;
      }
      this.dir = dir;
      this.setFrame(this.idleFrame(dt), 4 + DIRS.indexOf(dir));
    }
  }

  /** 0 = rest, 1 = inhale (1px lift), 2 = blink at rest. No sideways motion at all. */
  private idleFrame(dt: number): number {
    const step = Math.min(dt, 0.1);
    this.breathT = (this.breathT + step) % IDLE_BREATH_PERIOD;
    if (this.blinkLeft > 0) {
      this.blinkLeft -= step;
    } else {
      this.blinkIn -= step;
      if (this.blinkIn <= 0) {
        this.blinkLeft = IDLE_BLINK_MS / 1000;
        this.blinkIn = IDLE_BLINK_MIN + Math.random() * (IDLE_BLINK_MAX - IDLE_BLINK_MIN);
      }
    }
    const inhale = this.breathT >= IDLE_BREATH_PERIOD / 2;
    if (inhale) return 1;
    return this.blinkLeft > 0 ? 2 : 0;
  }
}

/**
 * 方案二 歧路旅人風 (5-head HD-2D pixel) characters: 64x96 frames, feet on row ~92.
 * Walk sheets are 4 cols x 8 rows: rows 0-3 walk (s, w, n, e), rows 4-7 idle (breathing + blink).
 * The figure is ~69 px tall, so a 2.65-unit frame shows a ~1.9-unit adult (elders ~1.8) beside the buildings.
 * Pose sheets (scooter 96x96, tatala 128x96 frames, 4x4) use the same px-per-unit, i.e. the same worldH.
 */
export const CHAR_WORLD_H = 2.65;

export function makeCharacter(assets: Assets, kind: string, worldH = CHAR_WORLD_H): SpriteBillboard {
  const file = `characters/${kind}_sheet.png`;
  const tex = assets.sheetClone(file);
  return new SpriteBillboard(tex, { cols: 4, rows: 8, worldH, kind });
}

/** NPC from a streamed sheet ref (atlas slot or single sheet); the texture must already be acquired */
export function makeNpcCharacter(assets: Assets, ref: { rel: string; region?: { x: number; y: number; w: number; h: number; atlasW: number; atlasH: number } }, kind: string, worldH = CHAR_WORLD_H): SpriteBillboard {
  const tex = assets.sheetClone(ref.rel);
  return new SpriteBillboard(tex, { cols: 4, rows: 8, worldH, kind, region: ref.region });
}

export function makeProp(
  assets: Assets,
  file: string,
  worldH: number,
  cols = 1,
  rows = 1,
): SpriteBillboard {
  const tex = assets.sheetClone(file);
  return new SpriteBillboard(tex, { cols, rows, worldH, kind: file });
}

export class BlobShadow {
  mesh: THREE.Mesh;
  constructor(rx = 0.4, rz = 0.28) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 16), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.scale.set(rx, rz, 1);
    this.mesh.renderOrder = 1;
  }
  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
  follow(x: number, z: number, ground?: number): void {
    this.mesh.position.set(x, (ground ?? surfaceHeight(x, z)) + 0.04, z);
  }
}
