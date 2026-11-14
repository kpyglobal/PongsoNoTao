/**
 * Hand-painted look on 3D objects (watercolor style only): every lit world material gets
 *  - world-space watercolor washes (soft blotches + pigment granulation), so ground, rocks, roofs and walls
 *    read as painted instead of flat CG colour; one shared 256² noise texture, no per-object textures;
 *  - flat toon light: sunlight collapses to two soft-edged tones (lit / shadow), like the target painting.
 * The character sprites are skipped (they keep their pixel art). Knobs: MATERIAL in styleConfig.ts.
 * Turned off (uniform switch, no recompile) when the player picks the 原始 style.
 */
import * as THREE from 'three';
import { MATERIAL } from './styleConfig';

const SPRITE_KEY = 'tao-sprite-noshine';
const shared = {
  uPaintOn: { value: 1 },
  uPaintTex: { value: null as THREE.Texture | null },
  uWashScale: { value: MATERIAL.washScale },
  uWashK: { value: MATERIAL.washStrength.high },
  uGrainScale: { value: MATERIAL.grainScale },
  uGrainK: { value: MATERIAL.grainStrength },
  uToon: { value: MATERIAL.toon },
  uToonEdge: { value: new THREE.Vector2(...MATERIAL.toonEdge) },
  uShadowTone: { value: MATERIAL.shadowTone },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uShadowCol: { value: new THREE.Color(MATERIAL.shadowColor) },
};

export function setPaintMaterials(on: boolean): void { shared.uPaintOn.value = on ? 1 : 0; }

const done = new WeakSet<THREE.Material>();
let scanAt = 0;
let sun: THREE.DirectionalLight | null = null;

function patch(m: THREE.Material): void {
  done.add(m);
  const prev = m.onBeforeCompile.bind(m);
  const prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    Object.assign(sh.uniforms, shared);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPaintW;\nvarying vec3 vPaintN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 pw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          pw = instanceMatrix * pw;
        #endif
          pw = modelMatrix * pw; vPaintW = pw.xyz; vPaintN = mat3(modelMatrix) * objectNormal; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPaintW; varying vec3 vPaintN;
        uniform float uPaintOn, uWashScale, uWashK, uGrainScale, uGrainK, uToon, uShadowTone;
        uniform vec2 uToonEdge; uniform vec3 uSunCol; uniform vec3 uShadowCol; uniform sampler2D uPaintTex;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (uPaintOn > 0.5) {
          vec3 an = abs(normalize(vPaintN));
          vec2 puv = an.y > 0.6 ? vPaintW.xz : (an.x > an.z ? vPaintW.zy : vPaintW.xy);
          float w = texture2D(uPaintTex, puv / uWashScale).g * 0.65 + texture2D(uPaintTex, puv / (uWashScale * 0.37) + 0.31).g * 0.35;
          float wash = (w - 0.5) * 2.0;
          diffuseColor.rgb *= 1.0 + uWashK * wash;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * diffuseColor.rgb * 1.5, max(wash, 0.0) * uWashK * 0.8);
          diffuseColor.rgb *= 1.0 - uGrainK * (texture2D(uPaintTex, puv / uGrainScale).r - 0.5);
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        if (uPaintOn > 0.5 && uToon > 0.0) {
          vec3 sunD = diffuseColor.rgb * uSunCol;
          float t = dot(reflectedLight.directDiffuse, vec3(0.333)) / (dot(sunD, vec3(0.333)) + 1e-4);
          vec3 tt = mix(uShadowCol * uShadowTone, vec3(1.0), smoothstep(uToonEdge.x, uToonEdge.y, t));
          reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, sunD * tt, uToon);
        }`);
  };
  m.customProgramCacheKey = () => prevKey() + '|paint';
  m.needsUpdate = true;
}

/** patch new world materials (throttled; NPCs and props stream in) and follow the sun colour every frame */
export function paintScene(scene: THREE.Scene, high: boolean, tex: THREE.Texture): void {
  shared.uPaintTex.value = tex;
  shared.uWashK.value = high ? MATERIAL.washStrength.high : MATERIAL.washStrength.mobile;
  const now = performance.now();
  if (now - scanAt > 1000) {
    scanAt = now;
    let best = -1;
    scene.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (l.isDirectionalLight && l.intensity > best) { best = l.intensity; sun = l; }
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m || done.has(m)) continue;
        const lit = (m as THREE.MeshStandardMaterial).isMeshStandardMaterial || (m as THREE.MeshLambertMaterial).isMeshLambertMaterial
          || (m as THREE.MeshPhongMaterial).isMeshPhongMaterial;
        if (!lit) { done.add(m); continue; }
        if (m.customProgramCacheKey() === SPRITE_KEY) { done.add(m); continue; }
        patch(m);
      }
    });
  }
  if (sun) shared.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity / Math.PI);
}
