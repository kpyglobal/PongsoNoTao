import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Flora } from './flora';
import {
  grid,
  GRID_NX,
  GRID_NZ,
  TERRAIN_BOX,
  getHeight,
  sample,
  noise,
  smoothstep,
  clamp01,
  distToRing,
  HARBOUR_QUAY,
} from './height';
import { terrainDetail, terrainFine, rng } from './textures';
import { FACILITIES } from './layout';
import type { Assets } from '../core/assets';
import { yieldToUi } from '../core/frame';
import type { Season } from '../core/timeSeason';
import { preferredTerrainPaintSize } from '../core/device';
import { surfaceHeight } from './collision';
import { bilerp } from '../core/math';
import { quality } from '../core/quality';

/** trees / palms / rocks stay this far from a road centreline (1.5 m corridor + canopy) */
const ROAD_PLANT_CLEAR = 2.4;

export const WORLD_BOX = TERRAIN_BOX;

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const c = new THREE.Color(h);
  return [c.r * 255, c.g * 255, c.b * 255];
};
// paintTerrain calls these ~15× per pixel over ~1.35 M pixels: write into a small ring of scratch
// colours instead of allocating a new array per call (no GC spikes during the iOS boot).
// Every result is consumed within a few calls, far fewer than the ring size.
const RING = 64;
const scratch: RGB[] = Array.from({ length: RING }, () => [0, 0, 0] as RGB);
let ringI = 0;
const mix = (a: RGB, b: RGB, t: number): RGB => {
  const o = scratch[ringI = (ringI + 1) & (RING - 1)];
  o[0] = a[0] + (b[0] - a[0]) * t;
  o[1] = a[1] + (b[1] - a[1]) * t;
  o[2] = a[2] + (b[2] - a[2]) * t;
  return o;
};
const mul = (a: RGB, k: number): RGB => {
  const o = scratch[ringI = (ringI + 1) & (RING - 1)];
  o[0] = a[0] * k;
  o[1] = a[1] * k;
  o[2] = a[2] * k;
  return o;
};

const C = {
  runwayPaint: hex('#f2f0e6'),
  runwayEdge: hex('#e9e6da'),
  grassLush: hex('#5d8e3a'),
  grassDeep: hex('#3f6f2e'),
  grassGold: hex('#b4a554'),
  grassOlive: hex('#8c9a47'),
  forestFloor: hex('#416a30'),
  basalt: hex('#45423d'),
  basaltLight: hex('#6d675e'),
  tuff: hex('#6e5747'),
  sand: hex('#f3e7bf'),
  sandWet: hex('#a89468'),
  pebble: hex('#8f8a80'),
  mud: hex('#5a5230'),
  earth: hex('#c2b48c'),
  paver: hex('#d2c9b6'),
  pitFloor: hex('#7c766c'),
  road: hex('#e8e0ce'),
  roadEdge: hex('#8a8070'),
  asphalt: hex('#5f605f'),
  seabedSand: hex('#d8d2a6'),
  coral: hex('#6f8a68'),
  coralRed: hex('#8a6a5a'),
  seabedDeep: hex('#2c5866'),
};

/** Fixed "painter's light" for baked shading accents (matches day sun). */
const PAINT_SUN = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();

export let lastPaintMs = 0;

const NOISE_S = 256;
const NOISE_TILE = (() => {
  const t = new Float32Array(NOISE_S * NOISE_S);
  for (let y = 0; y < NOISE_S; y++) {
    for (let x = 0; x < NOISE_S; x++) t[y * NOISE_S + x] = noise(x * 0.37, y * 0.31);
  }
  return t;
})();

function tileNoise(x: number, z: number): number {
  const S = NOISE_S;
  let fx = x % S; if (fx < 0) fx += S;
  let fz = z % S; if (fz < 0) fz += S;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const i1 = ix + 1 < S ? ix + 1 : 0;
  const j1 = iz + 1 < S ? iz + 1 : 0;
  const a = NOISE_TILE[iz * S + ix];
  const b = NOISE_TILE[iz * S + i1];
  const c = NOISE_TILE[j1 * S + ix];
  const d = NOISE_TILE[j1 * S + i1];
  return bilerp(a, b, c, d, tx, tz);
}

async function paintTerrain(width: number, height: number, onProgress?: (p: number) => void): Promise<{ albedo: THREE.CanvasTexture; mask: THREE.DataTexture }> {
  const g = grid();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const d = img.data;
  const { xMin, zMin, xMax, zMax } = TERRAIN_BOX;
  const cx = (xMax - xMin) / (GRID_NX - 1);
  const cz = (zMax - zMin) / (GRID_NZ - 1);

  const maskData = new Uint8Array(GRID_NX * GRID_NZ * 4);
  const t0 = performance.now();
  let lastYield = t0;

  const at = (arr: Float32Array, fx: number, fz: number): number => {
    const i = Math.max(0, Math.min(GRID_NX - 2, Math.floor(fx)));
    const j = Math.max(0, Math.min(GRID_NZ - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - i));
    const tz = Math.max(0, Math.min(1, fz - j));
    const k = j * GRID_NX + i;
    return (arr[k] * (1 - tx) + arr[k + 1] * tx) * (1 - tz) + (arr[k + GRID_NX] * (1 - tx) + arr[k + GRID_NX + 1] * tx) * tz;
  };

  for (let py = 0; py < height; py++) {
    const fz = (py / (height - 1)) * (GRID_NZ - 1);
    const z = zMin + fz * cz;
    for (let pxl = 0; pxl < width; pxl++) {
      const fx = (pxl / (width - 1)) * (GRID_NX - 1);
      const x = xMin + fx * cx;
      const h = at(g.h, fx, fz);
      const land = at(g.land, fx, fz);
      const slope = at(g.slope, fx, fz);
      const curv = at(g.curv, fx, fz);
      const cliff = at(g.cliff, fx, fz);
      const road = at(g.road, fx, fz);
      const terr = at(g.terrace, fx, fz);
      const vil = at(g.village, fx, fz);
      const pit = at(g.pit, fx, fz);
      const runway = at(g.runway, fx, fz);
      const forest = at(g.forest, fx, fz);

      // approximate normal for painter's light
      const hx = at(g.h, fx + 1, fz) - at(g.h, fx - 1, fz);
      const hz = at(g.h, fx, fz + 1) - at(g.h, fx, fz - 1);
      const nx = -hx / (2 * cx);
      const nz = -hz / (2 * cz);
      const inv = 1 / Math.hypot(nx, 1, nz);
      const lambert = Math.max(0, (nx * PAINT_SUN.x + PAINT_SUN.y + nz * PAINT_SUN.z) * inv);

      const n1 = tileNoise(x * 1.7, z * 1.7);
      const n2 = tileNoise(x * 0.22, z * 0.22) * 0.55 + tileNoise(x * 0.45 + 20, z * 0.45) * 0.3 + tileNoise(x * 0.9, z * 0.9) * 0.15;
      const n3 = tileNoise(x * 0.6 + 9, z * 0.6 - 4);
      const dither = (((pxl * 73856093) ^ (py * 19349663)) & 255) / 255 - 0.5;

      let col: RGB;
      if (land < 0.5 && h < 0.02) {
        // seabed under translucent water
        const depth = -h;
        col = mix(C.seabedSand, C.seabedDeep, smoothstep(0.3, 4.5, depth));
        const coral = smoothstep(0.55, 0.75, n3) * (1 - smoothstep(1.2, 3, depth));
        col = mix(col, n1 > 0.5 ? C.coral : C.coralRed, coral * 0.75);
        col = mix(col, C.basalt, cliff * (1 - smoothstep(0.0, 1.2, depth)) * 0.65);
        col = mul(col, 0.92 + n1 * 0.16);
      } else {
        // --- grass with gold-olive highlights on sunny convex ridges, deep green in gullies
        const sunny = smoothstep(0.55, 0.98, lambert);
        const crest = smoothstep(0.0, -0.06, curv); // convex
        const gully = smoothstep(0.0, 0.08, curv);
        col = mix(C.grassLush, C.grassOlive, smoothstep(0.35, 0.75, n2));
        col = mix(col, C.grassGold, clamp01(sunny * 0.45 + crest * 0.5 + smoothstep(9, 15, h) * 0.25) * (0.6 + n1 * 0.5));
        col = mix(col, C.grassDeep, gully * 0.7);
        // 青青草原 open grassland: brighter, golden
        const meadow = Math.exp(-(((x + 30) / 7) ** 2 + ((z - 29) / 5) ** 2));
        col = mix(col, mix(C.grassGold, C.grassLush, 0.45), meadow * 0.55);
        col = mix(col, C.forestFloor, smoothstep(0.15, 0.6, forest));

        // --- basalt cliffs with strata
        const rockW = clamp01(smoothstep(1.35, 2.2, slope) * (1 - smoothstep(0.3, 0.8, forest)) + cliff * smoothstep(0.55, 1.3, slope) * 0.7 * smoothstep(5.0, 1.0, h) + smoothstep(17, 21, h) * 0.3);
        if (rockW > 0.01) {
          const band = 0.5 + 0.5 * Math.sin(h * 5.5 + n2 * 6);
          let rock = mix(C.basalt, C.basaltLight, band * 0.55 + n1 * 0.25);
          rock = mix(rock, C.tuff, smoothstep(0.6, 0.85, n3) * 0.6);
          col = mix(col, rock, rockW);
        }

        // --- beaches: sand bays vs pebble / rock shores
        const beach = land * smoothstep(1.35, 0.4, h) * (1 - vil * 0.6) * (1 - smoothstep(0.9, 1.4, slope));
        if (beach > 0.01) {
          let sandC = mix(C.sand, C.sandWet, smoothstep(0.45, 0.08, h));
          sandC = mix(sandC, C.pebble, cliff * 0.85);
          col = mix(col, sandC, beach);
        }
        // coastal rock ledges right at the waterline on cliffy shores
        col = mix(col, mix(C.basalt, C.basaltLight, n1 * 0.6), cliff * smoothstep(0.9, 0.1, h) * land);

        // --- settlements: packed earth with stone pavers; sunken pits paved
        if (vil > 0.02) {
          const tile = ((Math.floor(x * 2.2) + Math.floor(z * 2.2)) & 1) === 0 ? 1.04 : 0.95;
          const ground = mul(mix(C.earth, C.paver, smoothstep(0.4, 0.7, n3)), tile);
          col = mix(col, ground, smoothstep(0.28, 0.9, vil) * 0.9 * (1 - smoothstep(0.45, 0.9, slope)));
        }
        if (pit > 0.02) col = mix(col, mul(C.pitFloor, 0.9 + 0.2 * n1), pit);
        // taro paddies (water surface drawn separately): dark mud
        if (terr > 0.02) col = mix(col, C.mud, terr);
        // ring road: concrete with darker kerb
        if (road > 0.03) {
          const kerb = smoothstep(0.12, 0.42, road) * (1 - smoothstep(0.72, 0.98, road));
          col = mix(col, mix(C.road, C.roadEdge, kerb * 0.9), smoothstep(0.04, 0.38, road));
        }
        // 蘭嶼機場 runway
        if (runway > 0.05) {
          let rc = C.asphalt;
          const R = FACILITIES.runway;
          const across = Math.abs(x - R.x);
          const along = Math.abs(z - R.z);
          if (across < 0.07 && along % 1.6 < 0.9 && along < R.hz - 1.2) rc = C.runwayPaint;
          if (across > R.hx - 0.22 && across < R.hx - 0.1) rc = C.runwayEdge;
          if (along > R.hz - 0.9 && along < R.hz - 0.3 && Math.floor(x * 3.2) % 2 === 0) rc = C.runwayPaint;
          col = mix(col, rc, smoothstep(0.2, 0.75, runway));
        }
        // 水芋田 stone bunds — pale masonry rims so walkable paths read clearly
        const bund = at(g.bund, fx, fz);
        if (bund > 0.05) col = mix(col, mix(C.paver, C.road, 0.35), smoothstep(0.06, 0.65, bund) * 0.9);
        // 開元港 apron / boardwalk approach
        const hdx = x - FACILITIES.harbor.x;
        const hdz = z - FACILITIES.harbor.z;
        const hd2 = hdx * hdx + hdz * hdz;
        // 0.1.1: the reclaimed quay reads as paved concrete, not beach
        const Q = HARBOUR_QUAY;
        const qd = Math.max(Math.abs(x - Q.x) / Q.hx, Math.abs(z - Q.z) / Q.hz);
        const quay = (1 - smoothstep(0.5, 0.62, qd)) * land;
        if (hd2 < 130 || quay > 0) {
          const apron = Math.max(hd2 < 130 ? smoothstep(11.4, 4.2, Math.sqrt(hd2)) * land * 0.62 : 0, quay * 0.85);
          col = mix(col, mix(C.road, C.paver, 0.4), apron);
        }
        // stronger shoreline / cliff contrast so the walkable edge is obvious
        col = mix(col, mul(C.sand, 1.06), beach * 0.2);
        // baked painterly light + ambient occlusion from curvature
        const ao = clamp01(1 - Math.max(0, curv) * 2.8);
        col = mul(col, (0.82 + lambert * 0.3) * (0.78 + 0.22 * ao) * (0.96 + n1 * 0.08));
      }
      // pixel dither keeps the HD-2D "crisp pixel" grain
      col = mul(col, 1 + dither * 0.05);
      const idx = (py * width + pxl) * 4;
      d[idx] = col[0] < 0 ? 0 : col[0] > 255 ? 255 : col[0];
      d[idx + 1] = col[1] < 0 ? 0 : col[1] > 255 ? 255 : col[1];
      d[idx + 2] = col[2] < 0 ? 0 : col[2] > 255 ? 255 : col[2];
      d[idx + 3] = 255;
    }
    const now = performance.now();
    if (now - lastYield > 8) {
      onProgress?.(py / height);
      await yieldToUi();
      lastYield = performance.now();
    }
  }
  lastPaintMs = performance.now() - t0;
  ctx.putImageData(img, 0, 0);

  // mask texture on the grid: R rock, G sand/beach, B built (road/village/pit/runway), A grass weight
  for (let k = 0; k < GRID_NX * GRID_NZ; k++) {
    const slope = g.slope[k];
    const land = g.land[k];
    const h = g.h[k];
    const rock = clamp01(smoothstep(1.35, 2.2, slope) * (1 - smoothstep(0.3, 0.8, g.forest[k])) + g.cliff[k] * smoothstep(0.55, 1.3, slope) * 0.7 * smoothstep(5.0, 1.0, h)) * (land > 0.5 ? 1 : 0);
    const sand = land > 0.5 ? smoothstep(1.35, 0.4, h) * (1 - g.village[k] * 0.6) : 1;
    const built = clamp01(Math.max(g.road[k], g.village[k] * 0.9, g.pit[k], g.runway[k], g.terrace[k]));
    const grassW = land > 0.5 ? clamp01(1 - rock - sand - built) : 0;
    maskData[k * 4] = rock * 255;
    maskData[k * 4 + 1] = sand * 255;
    maskData[k * 4 + 2] = built * 255;
    maskData[k * 4 + 3] = grassW * 255;
  }
  const mask = new THREE.DataTexture(maskData, GRID_NX, GRID_NZ, THREE.RGBAFormat);
  mask.magFilter = THREE.LinearFilter;
  mask.minFilter = THREE.LinearFilter;
  mask.needsUpdate = true;

  const albedo = new THREE.CanvasTexture(canvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.flipY = false;
  albedo.anisotropy = 8;
  albedo.wrapS = albedo.wrapT = THREE.ClampToEdgeWrapping;
  albedo.needsUpdate = true;
  return { albedo, mask };
}

function terrainGeometry(): THREE.BufferGeometry {
  const g = grid();
  const { xMin, zMin, xMax, zMax } = TERRAIN_BOX;
  const n = GRID_NX * GRID_NZ;
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  for (let j = 0; j < GRID_NZ; j++) {
    for (let i = 0; i < GRID_NX; i++) {
      const k = j * GRID_NX + i;
      pos[k * 3] = xMin + (i / (GRID_NX - 1)) * (xMax - xMin);
      pos[k * 3 + 1] = g.h[k];
      pos[k * 3 + 2] = zMin + (j / (GRID_NZ - 1)) * (zMax - zMin);
      uv[k * 2] = i / (GRID_NX - 1);
      uv[k * 2 + 1] = j / (GRID_NZ - 1);
    }
  }
  const idx = new Uint32Array((GRID_NX - 1) * (GRID_NZ - 1) * 6);
  let p = 0;
  for (let j = 0; j < GRID_NZ - 1; j++) {
    for (let i = 0; i < GRID_NX - 1; i++) {
      const a = j * GRID_NX + i;
      const b = a + 1;
      const c = a + GRID_NX;
      const d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b;
      idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function terrainMaterial(albedo: THREE.Texture, mask: THREE.Texture): { mat: THREE.MeshStandardMaterial; uniforms: Record<string, THREE.IUniform> } {
  const mat = new THREE.MeshStandardMaterial({ map: albedo, roughness: 0.93, metalness: 0.0 });
  const uniforms: Record<string, THREE.IUniform> = {
    uMask: { value: mask },
    uDetail: { value: terrainDetail() },
    uFine: { value: terrainFine() },
    // close-zoom detail fades in under uNear.x m from the camera, gone past uNear.y (wide shots skip it)
    // S11: mobile fades the detail out over 10–20 m (default camera is 22 m away, so the usual view pays little)
    uNear: { value: quality().tier === 'mobile' ? new THREE.Vector2(10, 20) : new THREE.Vector2(19, 34) },
    uSeason: { value: new THREE.Color(1, 1, 1) },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWPos;
         varying vec3 vWNrm;
         uniform sampler2D uMask;
         uniform sampler2D uDetail;
         uniform sampler2D uFine;
         uniform vec2 uNear;
         uniform vec3 uSeason;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         vec4 msk = texture2D(uMask, vMapUv);
         vec3 an = abs(normalize(vWNrm));
         an /= (an.x + an.y + an.z);
         vec4 dTop = texture2D(uDetail, vWPos.xz * 0.85);
         float rockTri = texture2D(uDetail, vWPos.xy * 0.7).g * an.z + texture2D(uDetail, vWPos.zy * 0.7).g * an.x + dTop.g * an.y;
         float det = dTop.r;
         det = mix(det, dTop.b, msk.g);
         det = mix(det, 0.5 + (dTop.b - 0.5) * 0.6, msk.b);
         det = mix(det, rockTri, msk.r);
         diffuseColor.rgb *= 0.62 + det * 0.76;
         // close zoom: crisper ground — painted-map local contrast (unsharp vs. a coarser mip) + fine micro detail
         float nearK = 1.0 - smoothstep(uNear.x, uNear.y, distance(cameraPosition, vWPos));
         if (nearK > 0.003) {
           vec3 soft = texture2D(map, vMapUv, 2.0).rgb;
           float lS = dot(soft, vec3(0.299, 0.587, 0.114));
           float lA = dot(sampledDiffuseColor.rgb, vec3(0.299, 0.587, 0.114));
           diffuseColor.rgb *= clamp(1.0 + (lA - lS) / max(lS, 0.04) * 1.1 * nearK, 0.7, 1.4);
           vec4 dF = texture2D(uFine, vWPos.xz * 3.1 + vec2(0.37, 0.11));
           #ifdef TAO_LITE
           float fRock = dF.g; // mobile tier: skip the two extra side projections
           #else
           float fRock = texture2D(uFine, vWPos.xy * 2.6).g * an.z + texture2D(uFine, vWPos.zy * 2.6).g * an.x + dF.g * an.y;
           #endif
           float fd = dF.r;
           fd = mix(fd, dF.b, msk.g);
           fd = mix(fd, 0.5 + (dF.b - 0.5) * 0.7, msk.b);
           fd = mix(fd, fRock, msk.r);
           diffuseColor.rgb *= mix(1.0, 0.66 + fd * 0.68, nearK);
         }
         // horizontal basalt strata on steep faces (world-space, reads on cliffs)
         float strata = 0.5 + 0.5 * sin(vWPos.y * 6.0 + sin(vWPos.x * 0.7 + vWPos.z * 0.5) * 1.6);
         diffuseColor.rgb *= mix(1.0, 0.8 + strata * 0.32, msk.r * (1.0 - an.y));
         // seasonal grass tint (golden 終食祭, cool 休漁期 …)
         diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uSeason, msk.a);`,
      );
  };
  if (quality().tier === 'mobile') mat.defines = { ...(mat.defines ?? {}), TAO_LITE: '' };
  mat.customProgramCacheKey = () => `tao-terrain-v3-${quality().tier}`;
  return { mat, uniforms };
}

// ---------------------------------------------------------------------------
// vegetation & rocks
// ---------------------------------------------------------------------------

function colorize(geo: THREE.BufferGeometry, bottom: THREE.Color, top: THREE.Color, y0: number, y1: number): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = clamp01((pos.getY(i) - y0) / (y1 - y0));
    c.copy(bottom).lerp(top, t);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

function rockGeometry(seed: number): THREE.BufferGeometry {
  // smooth, water-worn basalt boulder (no hard facets): subdivided sphere with low-frequency lumps
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(0.5, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const r = rng(seed);
  const f = [r() * 6, r() * 6, r() * 6];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const lump = 1 + 0.16 * Math.sin(n.x * 3.1 + f[0]) * Math.cos(n.z * 2.7 + f[1]) + 0.09 * Math.sin(n.y * 5.3 + f[2]) + 0.04 * Math.sin((n.x + n.z) * 9.0 + f[0]);
    const flatBottom = n.y < -0.35 ? 0.75 : 1;
    v.copy(n).multiplyScalar(0.5 * lump);
    v.y *= flatBottom;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.scale(1, 0.65, 1);
  g.computeVertexNormals();
  return colorize(g, new THREE.Color('#2a2928'), new THREE.Color('#615c55'), -0.35, 0.35);
}

export class Island {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  private uniforms!: Record<string, THREE.IUniform>;
  treeCount = 0;
  flora: Flora;

  constructor(assets: Assets) {
    this.flora = new Flora(assets);
  }

  async build(onProgress?: (p: number) => void): Promise<void> {
    const geo = terrainGeometry();
    onProgress?.(0.08);
    await yieldToUi(true);
    const sz = preferredTerrainPaintSize();
    const { albedo, mask } = await paintTerrain(sz.width, sz.height, (p) => onProgress?.(0.08 + p * 0.78));
    const { mat, uniforms } = terrainMaterial(albedo, mask);
    this.uniforms = uniforms;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    // the terrain self-shadow pass is the biggest shadow-map cost; the mobile tier skips it
    this.mesh.castShadow = quality().terrainCastShadow;
    this.mesh.name = 'island';
    this.group.add(this.mesh);

    // distant sea floor beyond the sculpted box
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({ color: 0x163f52, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -7.6;
    this.group.add(floor);

    onProgress?.(0.9);
    await yieldToUi(true);
    this.buildForest();
    onProgress?.(0.95);
    await yieldToUi(true);
    this.buildPalms();
    this.buildRocks();
    this.buildTufts();
    this.buildCoastFlowers();
    onProgress?.(1);
  }

  /** call after every system has registered its plants (taro paddies add theirs too) */
  finishFlora(): void {
    this.flora.build();
    this.group.add(this.flora.group);
  }

  private buildForest(): void {
    // HD-2D painted tree billboards (were faceted low-poly blobs)
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
        const pick = r();
        const sc = 0.75 + dens * 0.55 + r() * 0.35;
        if (pick < 0.16) this.flora.add('bush', jx, jz, 0.9 * sc, { tint: 0.8 + r() * 0.25 });
        else if (pick < 0.42) this.flora.add('tree_b', jx, jz, 3.0 * sc, { tint: 0.78 + r() * 0.3 });
        else this.flora.add('tree_a', jx, jz, 2.6 * sc, { tint: 0.8 + r() * 0.3 });
        this.treeCount++;
        // understory bush on forest margins
        if (dens < 0.5 && r() < 0.25) this.flora.add('bush', jx + (r() - 0.5) * 1.2, jz + (r() - 0.5) * 1.2, 0.6 + r() * 0.4);
      }
    }
  }

  private buildPalms(): void {
    const r = rng(99);
    let tries = 0;
    while (tries++ < 9000) {
      const x = -45 + r() * 90;
      const z = -50 + r() * 100;
      const s = sample(x, z);
      if (s.mask < 0.8 || s.height < 0.35 || s.height > 2.6 || s.slope > 0.6 || s.road > 0.2 || s.cliff > 0.6) continue;
      if (distToRing(x, z) < ROAD_PLANT_CLEAR) continue;
      if (r() > 0.008 + s.village * 0.03) continue;
      if (r() < 0.6) this.flora.add('palm', x, z, 3.4 + r() * 1.3);
      else this.flora.add('pandanus', x, z, 1.7 + r() * 0.7);
    }
    // Jimagaod grove
    for (let i = 0; i < 6; i++) {
      const x = 8 + (r() - 0.5) * 9;
      const z = 66 + (r() - 0.5) * 7;
      const h = getHeight(x, z);
      if (h < 0.4 || h > 5) continue;
      this.flora.add(i % 2 ? 'palm' : 'pandanus', x, z, i % 2 ? 3.8 : 1.9);
    }
  }

  private buildCoastFlowers(): void {
    // 馬鞍藤 beach morning glory on the sand line, 文殊蘭 crinum lilies at the scrub edge
    const r = rng(2026);
    let n = 0;
    for (let i = 0; i < 40000 && n < 900; i++) {
      const x = -48 + r() * 96;
      const z = -52 + r() * 124;
      const s = sample(x, z);
      if (s.mask < 0.6 || s.height < 0.25 || s.height > 2.2 || s.road > 0.1 || s.village > 0.4 || s.cliff > 0.5) continue;
      if (Math.abs(x - HARBOUR_QUAY.x) < HARBOUR_QUAY.hx * 0.62 && Math.abs(z - HARBOUR_QUAY.z) < HARBOUR_QUAY.hz * 0.62) continue; // paved quay
      if (s.beach > 0.35 && r() < 0.5) { this.flora.add('morning_glory', x, z, 0.32 + r() * 0.18); n++; }
      else if (s.beach > 0.1 && s.beach < 0.6 && r() < 0.18) { this.flora.add('lily', x, z, 0.55 + r() * 0.25); n++; }
    }
  }

  private buildRocks(): void {
    const r = rng(555);
    const geos = [rockGeometry(1), rockGeometry(2), rockGeometry(3)];
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
    const lists: THREE.Matrix4[][] = [[], [], []];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const add = (x: number, y: number, z: number, s: number, flat = 1) => {
      e.set((r() - 0.5) * 0.5, r() * Math.PI * 2, (r() - 0.5) * 0.5);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s * (0.8 + r() * 0.5), s * flat * (0.7 + r() * 0.6), s * (0.8 + r() * 0.5)));
      lists[Math.floor(r() * 3)].push(m.clone());
    };
    // shoreline boulders & reef ledges on cliffy coasts
    for (let i = 0; i < 26000; i++) {
      const x = -50 + r() * 100;
      const z = -54 + r() * 130;
      const s = sample(x, z);
      if (s.height < -0.9 || s.height > 1.2) continue;
      if (s.cliff < 0.35 || r() > s.cliff * 0.5) continue;
      if (distToRing(x, z) < ROAD_PLANT_CLEAR) continue;
      add(x, s.height + 0.05, z, 0.35 + r() * 0.9 * s.cliff, 0.8);
    }
    // talus & outcrops on steep slopes
    for (let i = 0; i < 9000; i++) {
      const x = -45 + r() * 90;
      const z = -50 + r() * 100;
      const s = sample(x, z);
      if (s.mask < 0.9 || s.slope < 1.0 || s.height < 2) continue;
      if (r() > 0.25) continue;
      if (distToRing(x, z) < ROAD_PLANT_CLEAR) continue;
      add(x, s.height, z, 0.3 + r() * 0.5, 0.7);
    }
    // iconic sea stacks: 軍艦岩 (Battleship Rock) off the NW coast, 雙獅岩 (Twin Lions) on the N coast
    const stack = (cx: number, cz: number, len: number, hgt: number, yaw: number) => {
      for (let i = 0; i < 18; i++) {
        const t = (i / 17 - 0.5) * len;
        const x = cx + Math.cos(yaw) * t + (r() - 0.5) * 0.6;
        const z = cz + Math.sin(yaw) * t + (r() - 0.5) * 0.6;
        const hh = hgt * (1 - Math.abs(t / (len * 0.55))) + r() * 0.6;
        add(x, -0.6 + hh * 0.45, z, 1.4 + r() * 0.8 + hh * 0.35, 1.3);
      }
    };
    stack(-45.5, -19, 7, 4.2, 0.5); // 軍艦岩
    stack(-17.5, -34.8, 3, 3.6, 0.2); // 雙獅岩 (two humps)
    stack(-14.8, -35.6, 2.6, 3.2, 0.2);
    lists.forEach((l, i) => {
      if (!l.length) return;
      const im = new THREE.InstancedMesh(geos[i], mat, l.length);
      l.forEach((mm, k) => im.setMatrixAt(k, mm));
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.group.add(im);
    });
  }

  private buildTufts(): void {
    const r = rng(808);
    let n = 0;
    for (let i = 0; i < 60000 && n < 5200; i++) {
      const x = -45 + r() * 90;
      const z = -50 + r() * 100;
      const s = sample(x, z);
      if (s.mask < 0.9 || s.height < 0.6 || s.slope > 1.0 || s.road > 0.1 || s.village > 0.3 || s.terrace > 0.05 || s.forest > 0.5) continue;
      if (s.beach > 0.5) continue;
      this.flora.add('grass', x, z, 0.32 + r() * 0.3, { tint: 0.85 + r() * 0.25 });
      n++;
    }
  }

  /** max anisotropic filtering for the grazing-angle ground (cheap on the GPU, clamped per tier by the caller) */
  setAnisotropy(n: number, albedoOnly = false): void {
    const m = this.mesh.material as THREE.MeshStandardMaterial;
    const list = albedoOnly ? [m.map] : [m.map, this.uniforms.uDetail.value as THREE.Texture, this.uniforms.uFine.value as THREE.Texture];
    for (const t of list) {
      if (!t || t.anisotropy === n) continue;
      t.anisotropy = n;
      t.needsUpdate = true;
    }
  }

  /** close-zoom micro detail on/off (`?groundfx=0` A/B comparison) */
  setNearDetail(on: boolean): void {
    const mob = quality().tier === 'mobile';
    (this.uniforms.uNear.value as THREE.Vector2).set(on ? (mob ? 10 : 19) : -2, on ? (mob ? 20 : 34) : -1);
  }

  setSeason(season: Season): void {
    const c = this.uniforms.uSeason.value as THREE.Color;
    if (season === 'manoyotoyon') c.setRGB(1.16, 1.02, 0.74); // late-summer gold
    else if (season === 'off') c.setRGB(0.9, 0.97, 0.98); // winter / NE monsoon, cooler
    else if (season === 'meyvanwa') c.setRGB(0.98, 1.02, 0.94);
    else c.setRGB(1.02, 1.05, 0.96); // rayon: lush
  }

  heightAt(x: number, z: number): number {
    return surfaceHeight(x, z);
  }
}
