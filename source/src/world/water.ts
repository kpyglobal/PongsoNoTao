/**
 * Translucent reef-to-cobalt ocean with real-time planar reflections.
 * Three's Reflector owns the oblique mirrored camera/render target; our shader
 * adds depth-baked turquoise reefs, fine ripples, foam, sun glints & caustics.
 */
import * as THREE from 'three';
import { seasonLook, applyMix } from '../render/look';
import { worldStyle } from '../render/stylize';
import { WATER } from '../render/styleConfig';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { LightPreset, Period, Season } from '../core/timeSeason';
import { yieldIfBusy } from '../core/frame';
import { preferredReflectorSize } from '../core/device';
import { quality } from '../core/quality';
import { reflectHooks } from '../render/reflectHooks';

const vert = /* glsl */ `
  #include <common>
  #include <shadowmap_pars_vertex>
  uniform mat4 textureMatrix;
  varying vec4 vReflectUv;
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vReflectUv = textureMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
    // 0.1.5: the sea receives the sun's shadow map (tatala, rocks, piers, character / boat sprites)
    vec3 transformedNormal = normalMatrix * normal;
    vec4 worldPosition = wp;
    #include <shadowmap_vertex>
  }
`;

const frag = /* glsl */ `
  precision highp float;
  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>
  uniform float uShadowK;
  uniform vec3 uShadowTint;
  uniform sampler2D tDiffuse;
  uniform vec3 color;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  uniform float uWave;
  uniform float uPaint;
  uniform float uStreak;
  uniform float uStreakW;
  uniform sampler2D uLand;
  uniform vec4 uLandBox;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec4 vReflectUv;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);
  }
  float ripple(vec2 p) {
    return sin(p.x*1.7 + p.y*0.7 + uTime*0.8)*0.35
         + sin(p.x*0.8 - p.y*2.1 - uTime*1.1)*0.28
         + sin(p.x*4.2 + p.y*3.3 + uTime*1.6)*0.12
         + sin(p.x*9.0 - p.y*6.3 - uTime*2.1)*0.04;
  }
  void main() {
    vec2 p = vWorld.xz;
    vec2 uv = (p - uLandBox.xy) / (uLandBox.zw-uLandBox.xy);
    vec4 land = texture2D(uLand, clamp(uv, 0.0, 1.0));
    bool outside = uv.x<0.0 || uv.y<0.0 || uv.x>1.0 || uv.y>1.0;
    float depth = outside ? 7.0 : (1.0-land.g)*8.0;
    float shore = outside ? 0.0 : land.b;
    // wave normal: small enough to stay calm, tight enough to glitter
    float eps = 0.035;
    float dx = (ripple(p+vec2(eps,0.0))-ripple(p-vec2(eps,0.0))) / (eps*2.0);
    float dz = (ripple(p+vec2(0.0,eps))-ripple(p-vec2(0.0,eps))) / (eps*2.0);
    vec3 N = normalize(vec3(-dx*0.055*uWave,1.0,-dz*0.055*uWave));
    vec3 V = normalize(cameraPosition-vWorld);
    float fres = pow(1.0-max(dot(N,V),0.0),3.5);
    float shallow = 1.0-smoothstep(0.25,5.5,depth);
    vec3 sea = mix(uDeep,uShallow,shallow);
    float pattern = noise(p*2.8 + vec2(uTime*0.04,-uTime*0.03));
    float reef = smoothstep(0.2,0.8,land.r) * shallow;
    sea = mix(sea,sea*vec3(0.72,0.92,0.72),reef*0.38);
    // sunlit caustic ribbons on the reef shelf
    float cau = abs(sin(p.x*3.0 + sin(p.y*2.2+uTime*0.5)*1.3 + uTime*0.35));
    cau = pow(1.0-cau,8.0);
    sea += vec3(0.18,0.27,0.14)*cau*shallow*(1.0-uNight)*0.5;
    sea *= 0.94+pattern*0.12;

    vec2 ruv = vReflectUv.xy / vReflectUv.w;
    vec2 dist = N.xz * (0.012 + 0.02*min(depth/5.0,1.0));
    vec3 refl = texture2D(tDiffuse, clamp(ruv+dist,0.001,0.999)).rgb;
    // planar terrain/sky/lantern reflection, strongest at grazing angles
    float reflW = clamp(0.08+fres*0.7 + uNight*0.18,0.0,0.8);
    vec3 col = mix(sea,refl,reflW);
    vec3 H = normalize(V+normalize(uSunDir));
    float spec = pow(max(dot(N,H),0.0),160.0);
    col += uSunColor*spec*(1.6-uNight*0.8)*(1.0-uPaint*0.6);
    if (uPaint > 0.5) {
      // watercolor sea: soft-stepped washes (turquoise shallows → deep blue), reflections kept faint
      float sb = shallow*3.0;
      float q = (floor(sb) + smoothstep(0.3,0.7,fract(sb)))/3.0;
      vec3 seaP = mix(uDeep, uShallow, q);
      col = mix(col, seaP + (col - sea)*0.3, 0.72);
      // painted ripple strokes: short wavy light dashes with a darker under-stroke (more in rough seas)
      float r1 = sin(p.y*3.1 + p.x*0.4 + sin(p.x*0.7+uTime*0.25)*1.6 + uTime*0.4);
      float dash = smoothstep(0.55,0.75, noise(p*vec2(0.55,2.4)+vec2(uTime*0.05,0.0)));
      float th = 1.0 - uStreakW - 0.015*uWave;
      float lite = smoothstep(th,th+uStreakW,r1)*dash;
      float dark = smoothstep(th,th+uStreakW,-r1)*dash;
      col = mix(col, mix(uShallow, vec3(1.0), 0.5), lite*uStreak*(1.0-uNight*0.6));
      col *= 1.0 - dark*uStreak*0.25*(1.0-shallow*0.5);
    }
    float shimmer = pow(max(0.0,sin(p.x*7.0 + p.y*1.4 + uTime*1.1)),18.0);
    // sun shadow on the water surface: same shadow map (direction, length, PCF softness) as on land; the
    // shadowed sea loses the direct sun (glints) and darkens toward the scene's cool shade tone
    float lit = getShadowMask();
    float shade = (1.0 - lit) * uShadowK;
    spec *= lit;
    col *= (1.0 - shade) * (vec3(1.0) - shade * uShadowTint);
    col += uSunColor*shimmer*spec*0.9;

    // thin breathing shore foam with a broken, natural edge
    float foamNoise = noise(p*2.3 + vec2(uTime*0.12,0.0));
    float foam = shore * smoothstep(0.38,0.72,foamNoise+sin(uTime*1.3+p.x*0.6+p.y*0.4)*0.15);
    col = mix(col,vec3(0.82,0.92,0.84),foam*0.65*(1.0-uNight*0.7));
    // fine wave crests, subtle
    float crest = pow(max(0.0,ripple(p*1.25)),10.0);
    col += vec3(0.15,0.22,0.2)*crest*(1.0-uNight)*0.15;
    // water is translucent over the reef shelf; deep ocean stays opaque
    float alpha = mix(0.67,0.97,smoothstep(0.1,3.0,depth));
    alpha = max(alpha,foam*0.92);
    float fd = length(cameraPosition - vWorld);
    float fogF = smoothstep(uFogNear, uFogFar, fd);
    col = mix(col, uFogColor, fogF);
    alpha = mix(alpha, 1.0, fogF);
    gl_FragColor = vec4(col,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Ocean {
  mesh: Reflector;
  mat: THREE.ShaderMaterial;
  landTex: THREE.DataTexture;
  /** mobile tier: the planar reflection is re-rendered every Nth frame (texture + matrix stay paired) */
  private reflectEvery = quality().reflectorEvery;
  private frame = 0;

  constructor(landTex: THREE.DataTexture, box: { xMin: number; zMin: number; xMax: number; zMax: number }) {
    this.landTex = landTex;
    const shader = {
      name: 'TaoReefOcean',
      uniforms: {
        color: { value: new THREE.Color(1, 1, 1) },
        tDiffuse: { value: null },
        textureMatrix: { value: new THREE.Matrix4() },
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color('#125578') },
        uShallow: { value: new THREE.Color('#4bc8b6') },
        uSunDir: { value: new THREE.Vector3(-0.35, 0.88, 0.28) },
        uSunColor: { value: new THREE.Color('#fff3d0') },
        uNight: { value: 0 },
        uWave: { value: 1 },
        uPaint: { value: 1 },
        uStreak: { value: WATER.streak },
        uStreakW: { value: WATER.streakWidth },
        uLand: { value: landTex },
        uLandBox: { value: new THREE.Vector4(box.xMin, box.zMin, box.xMax, box.zMax) },
        uFogColor: { value: new THREE.Color('#cfe6ef') },
        uFogNear: { value: 60 },
        uFogFar: { value: 220 },
        uShadowK: { value: 0.5 },
        uShadowTint: { value: new THREE.Vector3(0.06, 0.03, -0.03) }, // a touch cooler, like the shade on sand
        ...THREE.UniformsLib.lights,
      },
      vertexShader: vert,
      fragmentShader: frag,
    };
    const rtSize = preferredReflectorSize();
    this.mesh = new Reflector(new THREE.PlaneGeometry(900, 900), {
      textureWidth: rtSize,
      textureHeight: rtSize,
      clipBias: 0.002,
      multisample: 0,
      shader,
    });
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = -0.015;
    this.mesh.renderOrder = 2;
    this.mesh.name = 'reef-ocean-reflector';
    this.mat = this.mesh.material as THREE.ShaderMaterial;
    this.mat.lights = true;
    this.mesh.receiveShadow = true;
    this.mat.transparent = true;
    this.mat.depthWrite = false;
    this.mat.uniforms.uLand.value = landTex;
    const renderReflection = this.mesh.onBeforeRender;
    this.mesh.onBeforeRender = (...args) => {
      if (this.reflectEvery > 1 && this.frame % this.reflectEvery !== 0) return;
      reflectHooks.before?.();
      try {
        renderReflection.apply(this.mesh, args);
      } finally {
        reflectHooks.after?.();
      }
    };
  }

  apply(preset: LightPreset, period: Period, season: Season): void {
    const u = this.mat.uniforms;
    (u.uDeep.value as THREE.Color).copy(preset.waterDeep);
    (u.uShallow.value as THREE.Color).copy(preset.waterShallow);
    (u.uSunDir.value as THREE.Vector3).copy(preset.sunDir);
    (u.uSunColor.value as THREE.Color).copy(preset.sunColor);
    u.uNight.value = period === 'night' ? 1 : period === 'dusk' ? 0.35 : 0;
    // season look (src/render/styleConfig.ts SEASON_LOOK): vivid summer turquoise, rough grey-blue monsoon sea
    const look = seasonLook(season);
    const k = period === 'night' ? 0.3 : 1;
    u.uWave.value = look.wave;
    applyMix(u.uDeep.value as THREE.Color, [look.waterDeep[0], look.waterDeep[1] * k]);
    applyMix(u.uShallow.value as THREE.Color, [look.waterShallow[0], look.waterShallow[1] * k]);
    // shadow strength from the light rig (share of the direct sun in a lit surface's light), calibrated so that by day
    // shade on the water is as dark as shade on the sand (≈ 0.6× lit in the 0.1.4 shots); weaker at dawn / dusk / night
    const sun = preset.sunIntensity * look.sunMul * Math.max(0.2, preset.sunDir.clone().normalize().y);
    const sky = preset.hemiIntensity + preset.ambientExtra;
    u.uShadowK.value = Math.min(0.45, (sun / (sun + sky)) * 0.58);
  }

  update(t: number, fog?: THREE.Fog | null): void {
    this.frame++;
    const u = this.mat.uniforms;
    u.uTime.value = t;
    u.uPaint.value = worldStyle() === 'watercolor' ? 1 : 0;
    if (fog) {
      (u.uFogColor.value as THREE.Color).copy(fog.color);
      u.uFogNear.value = fog.near;
      u.uFogFar.value = fog.far;
    }
  }
}

/** R = reef roughness, G = packed depth (1 surface, 0 at -8), B = shore ring */
function fillLandFieldRows(
  data: Uint8Array<ArrayBuffer>,
  xMin: number, zMin: number, xMax: number, zMax: number,
  sampleFn: (x: number, z: number) => { height: number; mask: number },
  size: number, j0: number, j1: number,
): void {
  for (let j = j0; j < j1; j++) {
    for (let i = 0; i < size; i++) {
      const x = xMin + (i / (size - 1)) * (xMax - xMin);
      const z = zMin + (j / (size - 1)) * (zMax - zMin);
      const s = sampleFn(x, z);
      const depth = Math.max(0, -s.height);
      const packed = Math.max(0, Math.min(1, 1 - depth / 8));
      const foam = 1 - Math.min(1, Math.abs(s.height - 0.03) / 0.38);
      const reef = (Math.sin(x * 1.3 + Math.sin(z * 0.7)) * Math.sin(z * 1.1) * 0.5 + 0.5) * (1 - Math.min(1, depth / 2.8));
      const idx = (j * size + i) * 4;
      data[idx] = Math.round(reef * 255);
      data[idx + 1] = Math.round(packed * 255);
      data[idx + 2] = Math.round(foam * 255);
      data[idx + 3] = 255;
    }
  }
}

function landFieldTexture(data: Uint8Array<ArrayBuffer>, size: number): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  return tex;
}

/** Bake the land/height field for the reef shader, yielding so the boot UI can stay responsive on iOS. */
export async function bakeLandFieldAsync(
  xMin: number, zMin: number, xMax: number, zMax: number,
  sampleFn: (x: number, z: number) => { height: number; mask: number },
  size = 512,
  onProgress?: (p: number) => void,
): Promise<THREE.DataTexture> {
  const data = new Uint8Array(size * size * 4);
  const step = 16;
  for (let j = 0; j < size; j += step) {
    fillLandFieldRows(data, xMin, zMin, xMax, zMax, sampleFn, size, j, Math.min(size, j + step));
    onProgress?.(Math.min(1, (j + step) / size));
    await yieldIfBusy();
  }
  return landFieldTexture(data, size);
}
