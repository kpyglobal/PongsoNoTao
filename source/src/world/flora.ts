/**
 * HD-2D botanical billboards: every tree, palm, pandanus, bush, grass tuft,
 * coastal flower and taro clump is a painted 2D sprite from one atlas
 * (public/assets/sprites/props/flora_atlas.webp; PNG master in art-src/plants/), drawn with a single
 * InstancedMesh. The vertex shader turns each quad toward the camera
 * (cylindrical / upright billboard) and adds a gentle wind sway that grows
 * toward the crown; scene lights still shade it (Lambert), so dusk and night
 * tint the foliage like the rest of the island. Soft ground shadows are a
 * second instanced mesh of radial-gradient decals.
 */
import * as THREE from 'three';
import type { Assets } from '../core/assets';
import ATLAS from './flora_atlas.json';
import { getHeight } from './height';
import { FACILITIES, planePark, runwayLocal } from './layout';

/** 0.1.4: nothing grows on the runway or around the parked plane (it was standing in bushes) */
let PLANE_CLEAR: { x: number; z: number; c: number; s: number } | null = null;
function keepOut(kind: string, x: number, z: number): boolean {
  const R = FACILITIES.runway;
  const rl = runwayLocal(x, z);
  const big = kind.startsWith('tree') || kind === 'palm' || kind === 'pandanus';
  const m = big ? 1.6 : 0.4;
  if (Math.abs(rl.across) < R.hx + m && Math.abs(rl.along) < R.hz + m) return true;
  if (!PLANE_CLEAR) {
    const p = planePark();
    PLANE_CLEAR = { x: p.x, z: p.z, c: Math.cos(p.yaw), s: Math.sin(p.yaw) };
  }
  const P = PLANE_CLEAR;
  const dx = x - P.x;
  const dz = z - P.z;
  const lx = dx * P.c - dz * P.s;
  const lz = dx * P.s + dz * P.c;
  const r = big ? 4.6 : 3.4; // span / length ≈ 4.75 / 4.6 m, plus room around it
  return Math.abs(lx) < r && Math.abs(lz) < r;
}

export type FloraKind = keyof typeof ATLAS;

interface Item {
  kind: FloraKind;
  x: number;
  y: number;
  z: number;
  h: number;
  tint: number;
  sway: number;
  flip: boolean;
  shadow: number;
}

/** relative sway strength per kind (trees barely move, grass flutters) */
const SWAY: Record<FloraKind, number> = {
  tree_a: 0.05, tree_b: 0.05, palm: 0.09, pandanus: 0.06, bush: 0.05,
  grass: 0.16, morning_glory: 0.07, lily: 0.12, taro: 0.11,
};

let shadowTexCache: THREE.Texture | null = null;
function shadowTex(): THREE.Texture {
  if (shadowTexCache) return shadowTexCache;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  shadowTexCache = new THREE.CanvasTexture(c);
  return shadowTexCache;
}

export class Flora {
  group = new THREE.Group();
  items: Item[] = [];
  private uniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
  private tex: THREE.Texture;
  count = 0;

  constructor(assets: Assets) {
    const t = assets.get('props/flora_atlas.webp').clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.NearestFilter; // crisp painted pixels up close
    t.minFilter = THREE.LinearMipmapLinearFilter; // no shimmer far away
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.needsUpdate = true;
    this.tex = t;
  }

  /** h = world height of the sprite; y defaults to terrain height. */
  add(kind: FloraKind, x: number, z: number, h: number, opts: { y?: number; tint?: number; shadow?: number; seed?: number } = {}): void {
    if (keepOut(kind, x, z)) return;
    const seed = opts.seed ?? Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    this.items.push({
      kind, x, z, h,
      y: opts.y ?? getHeight(x, z) - 0.04,
      tint: opts.tint ?? 0.88 + seed * 0.24,
      sway: seed,
      flip: seed > 0.5,
      shadow: opts.shadow ?? (kind.startsWith('tree') || kind === 'palm' || kind === 'pandanus' ? 1 : kind === 'bush' ? 0.7 : 0),
    });
  }

  build(): void {
    const n = this.items.length;
    this.count = n;
    if (!n) return;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const rect = new Float32Array(n * 4);
    const seed = new Float32Array(n * 2);
    const mat = new THREE.MeshLambertMaterial({
      map: this.tex,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      transparent: false,
    });
    const u = this.uniforms;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = u.uTime;
      sh.uniforms.uWind = u.uWind;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aRect; attribute vec2 aSeed; attribute float aSwayK; uniform float uTime; uniform float uWind;`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vec2 fuv = vec2(aSeed.y > 0.5 ? 1.0 - uv.x : uv.x, uv.y);
          vMapUv = aRect.xy + fuv * aRect.zw;`)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
        .replace('#include <project_vertex>', `
          vec3 iPos = vec3(instanceMatrix[3]);
          float sx = length(instanceMatrix[0].xyz);
          float sy = length(instanceMatrix[1].xyz);
          vec3 camR = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
          float hgt = position.y;
          float gust = sin(uTime * 1.7 + aSeed.x * 31.0 + iPos.x * 0.21) * 0.6 + sin(uTime * 2.9 + aSeed.x * 11.0 + iPos.z * 0.37) * 0.4;
          float bend = gust * hgt * hgt * uWind * aSwayK;
          vec3 wp = iPos + camR * (position.x * sx + bend * sy) + vec3(0.0, hgt * sy, 0.0);
          vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
          gl_Position = projectionMatrix * mvPosition;`)
        .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(wp, 1.0);');
    };
    mat.customProgramCacheKey = () => 'flora-billboard-v1';
    const swayK = new Float32Array(n);
    const im = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    const shadows: Item[] = [];
    this.items.forEach((it, i) => {
      const a = ATLAS[it.kind];
      const w = it.h * a.aspect;
      m.makeScale(w, it.h, 1);
      m.setPosition(it.x, it.y, it.z);
      im.setMatrixAt(i, m);
      col.setRGB(it.tint, it.tint, it.tint * 0.97);
      im.setColorAt(i, col);
      rect.set([a.u, a.v, a.w, a.h], i * 4);
      seed.set([it.sway, it.flip ? 1 : 0], i * 2);
      swayK[i] = SWAY[it.kind];
      if (it.shadow > 0) shadows.push(it);
    });
    geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(rect, 4));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 2));
    geo.setAttribute('aSwayK', new THREE.InstancedBufferAttribute(swayK, 1));
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false; // billboards are expanded in the shader
    im.castShadow = false;
    im.receiveShadow = false;
    im.name = 'flora-billboards';
    this.group.add(im);

    if (shadows.length) {
      const sg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      const sm = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const si = new THREE.InstancedMesh(sg, sm, shadows.length);
      shadows.forEach((it, i) => {
        const a = ATLAS[it.kind];
        const r = it.h * a.aspect * (it.kind.startsWith('tree') ? 0.62 : 0.5) * it.shadow;
        m.makeScale(r * 1.15, 1, r * 0.8);
        m.setPosition(it.x + 0.12 * it.h, getHeight(it.x, it.z) + 0.05, it.z + 0.06 * it.h);
        si.setMatrixAt(i, m);
      });
      si.renderOrder = 1;
      si.frustumCulled = false;
      si.name = 'flora-shadows';
      this.group.add(si);
    }
  }

  update(t: number): void {
    this.uniforms.uTime.value = t;
  }
}
