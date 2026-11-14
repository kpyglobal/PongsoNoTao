/**
 * 水芋田 soli terraces: stepped paddies with dry-laid stone retaining walls
 * (砌石田埂), shallow mirror-like water inside every tier and dense clumps of
 * heart-shaped taro leaves.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TARO_FIELDS, fieldCells, type TaroCell } from './layout';
import { getHeight } from './height';
import { rng, stoneTex } from './textures';
import type { Flora } from './flora';

const paddyVert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const paddyFrag = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uGlow;
  uniform float uNight;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorld;
  void main() {
    vec2 p = vWorld.xz;
    float r = sin(p.x*6.0+uTime*0.9)*0.5 + sin(p.y*5.0-uTime*0.7)*0.5;
    vec3 N = normalize(vec3(cos(p.x*6.0+uTime*0.9)*0.012, 1.0, cos(p.y*5.0-uTime*0.7)*0.012));
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 R = reflect(-V, N);
    float fres = 0.25 + 0.75*pow(1.0-max(dot(N,V),0.0), 3.0);
    vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.7, R.y));
    vec3 mud = vec3(0.07,0.075,0.035);
    vec3 col = mix(mud, sky * vec3(0.78,0.88,0.86), fres*0.62);
    float spec = pow(max(dot(R, normalize(uSunDir)),0.0), 220.0);
    col += uSunColor * spec * (1.5 - uNight);
    col += uGlow * uNight * 0.08 * (0.6 + 0.4*r);
    float fd = length(cameraPosition - vWorld);
    col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, fd));
    gl_FragColor = vec4(col, 0.9);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class TaroTerraces {
  group = new THREE.Group();
  waterMat: THREE.ShaderMaterial;
  cells: TaroCell[] = [];

  constructor(flora: Flora) {
    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: paddyVert,
      fragmentShader: paddyFrag,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uZenith: { value: new THREE.Color('#5da6dc') },
        uHorizon: { value: new THREE.Color('#d9eef8') },
        uSunDir: { value: new THREE.Vector3(0.3, 0.9, 0.2) },
        uSunColor: { value: new THREE.Color('#fff3d0') },
        uGlow: { value: new THREE.Color('#ffb060') },
        uNight: { value: 0 },
        uFogColor: { value: new THREE.Color('#cfe6ef') },
        uFogNear: { value: 60 },
        uFogFar: { value: 220 },
      },
    });

    const waterGeos: THREE.BufferGeometry[] = [];
    const stoneM: THREE.Matrix4[] = [];
    const stoneC: THREE.Color[] = [];
    const r = rng(4242);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();

    for (const f of TARO_FIELDS) {
      const cells = fieldCells(f);
      this.cells.push(...cells);
      for (const c of cells) {
        // water quad
        if (!c.dry) {
          const g = new THREE.PlaneGeometry(c.hu * 2 + 0.08, c.hv * 2 + 0.08);
          g.rotateX(-Math.PI / 2);
          g.rotateY(c.yaw - Math.PI / 2);
          g.translate(c.x, c.level, c.z);
          g.deleteAttribute('uv');
          waterGeos.push(g);
        }
        // local axes: u = downhill (fx,fz), v = across
        const ux = f.fx;
        const uz = f.fz;
        const vx = -f.fz;
        const vz = f.fx;
        // stone retaining wall on the downhill edge (face toward the sea)
        const lowEdgeU = c.hu + 0.2;
        const below = c.tier < f.tiers - 1 ? c.level - f.drop : Math.min(c.level - 0.3, getHeight(c.x + ux * (lowEdgeU + 0.6), c.z + uz * (lowEdgeU + 0.6)));
        const wallH = Math.max(0.25, c.level + 0.1 - below);
        const courses = Math.max(2, Math.round(wallH / 0.17));
        const lenV = c.hv * 2 + 0.4;
        const per = Math.round(lenV / 0.3);
        for (let k = 0; k < courses; k++) {
          for (let s = 0; s < per; s++) {
            const t = -lenV / 2 + (s + 0.5 + (k % 2) * 0.5) * (lenV / per);
            if (t > lenV / 2) continue;
            const y = below + (k + 0.5) * (wallH / courses) - 0.02;
            const batter = (courses - k) * 0.025; // walls lean back into the slope
            const x = c.x + ux * (lowEdgeU + batter) + vx * t;
            const z = c.z + uz * (lowEdgeU + batter) + vz * t;
            e.set((r() - 0.5) * 0.2, c.yaw + (r() - 0.5) * 0.25, (r() - 0.5) * 0.2);
            q.setFromEuler(e);
            const sz = 0.26 + r() * 0.1;
            m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sz * 0.8, (wallH / courses) * 1.05, sz));
            stoneM.push(m.clone());
            stoneC.push(new THREE.Color().setHSL(0.08 + r() * 0.04, 0.08 + r() * 0.06, 0.36 + r() * 0.2));
          }
        }
        // low earthen/stone bund along the side edges
        for (const side of [-1, 1]) {
          for (let s = 0; s < 6; s++) {
            const t = -c.hu + (s + 0.5) * ((c.hu * 2) / 6);
            const x = c.x + ux * t + vx * side * (c.hv + 0.13);
            const z = c.z + uz * t + vz * side * (c.hv + 0.13);
            e.set(0, c.yaw + (r() - 0.5) * 0.4, 0);
            q.setFromEuler(e);
            m.compose(new THREE.Vector3(x, c.level + 0.03, z), q, new THREE.Vector3(0.22, 0.13, 0.36));
            stoneM.push(m.clone());
            stoneC.push(new THREE.Color().setHSL(0.09, 0.1, 0.42 + r() * 0.12));
          }
        }
        // taro clumps inside the paddy
        const nu = Math.max(2, Math.floor((c.hu * 2) / 0.42));
        const nv = Math.max(2, Math.floor((c.hv * 2) / 0.42));
        for (let a = 0; a < nu; a++) {
          for (let b = 0; b < nv; b++) {
            if (r() < (c.dry ? 0.75 : 0.12)) continue;
            const tu = -c.hu + (a + 0.5) * ((c.hu * 2) / nu) + (r() - 0.5) * 0.12;
            const tv = -c.hv + (b + 0.5) * ((c.hv * 2) / nv) + (r() - 0.5) * 0.12;
            const x = c.x + ux * tu + vx * tv;
            const z = c.z + uz * tu + vz * tv;
            const sc = 0.8 + r() * 0.55;
            flora.add('taro', x, z, 0.5 * sc, { y: c.level - 0.06, tint: 0.85 + r() * 0.25 });
          }
        }
      }
    }

    if (waterGeos.length) {
      const water = new THREE.Mesh(mergeGeometries(waterGeos)!, this.waterMat);
      water.renderOrder = 3;
      water.name = 'taro-paddy-water';
      this.group.add(water);
    }

    const stoneGeo = new THREE.BoxGeometry(1, 1, 1);
    const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.95, color: 0xffffff });
    const walls = new THREE.InstancedMesh(stoneGeo, stoneMat, stoneM.length);
    stoneM.forEach((mm, i) => {
      walls.setMatrixAt(i, mm);
      walls.setColorAt(i, stoneC[i].multiplyScalar(2.1));
    });
    walls.castShadow = true;
    walls.receiveShadow = true;
    walls.computeBoundingSphere();
    walls.name = 'taro-stone-walls';
    this.group.add(walls);

  }

  apply(opts: { zenith: THREE.Color; horizon: THREE.Color; sunDir: THREE.Vector3; sunColor: THREE.Color; night: number }): void {
    const u = this.waterMat.uniforms;
    (u.uZenith.value as THREE.Color).copy(opts.zenith);
    (u.uHorizon.value as THREE.Color).copy(opts.horizon);
    (u.uSunDir.value as THREE.Vector3).copy(opts.sunDir);
    (u.uSunColor.value as THREE.Color).copy(opts.sunColor);
    u.uNight.value = opts.night;
  }

  update(t: number, fog?: THREE.Fog | null): void {
    const u = this.waterMat.uniforms;
    u.uTime.value = t;
    if (fog) {
      (u.uFogColor.value as THREE.Color).copy(fog.color);
      u.uFogNear.value = fog.near;
      u.uFogFar.value = fog.far;
    }
  }
}
