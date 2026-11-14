/**
 * All lantern / hearth / torch / beacon glows in one instanced draw call.
 * Each glow is a camera-facing quad (same look as the former THREE.Sprite + additive SpriteMaterial:
 * world-sized, fogged, additive), with per-instance position, size, colour and a per-frame alpha.
 */
import * as THREE from 'three';
import { glowTex } from './textures';

const vert = /* glsl */ `
  attribute vec3 aOffset;
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  varying vec2 vUv;
  varying vec4 vTint;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vTint = vec4(aColor, aAlpha);
    vec4 mvPosition = modelViewMatrix * vec4(aOffset, 1.0);
    mvPosition.xy += position.xy * aSize;
    // fully transparent glows collapse to nothing (no fragments at all by day)
    if (aAlpha <= 0.005) mvPosition = vec4(0.0, 0.0, 2.0, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const frag = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec4 vTint;
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vTint * texture2D(map, vUv);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export interface GlowSpec {
  x: number;
  y: number;
  z: number;
  size: number;
  color: number;
}

export class GlowBatch {
  readonly mesh: THREE.Mesh;
  private alpha: THREE.InstancedBufferAttribute;
  readonly count: number;

  constructor(specs: GlowSpec[]) {
    this.count = specs.length;
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    const off = new Float32Array(specs.length * 3);
    const size = new Float32Array(specs.length);
    const col = new Float32Array(specs.length * 3);
    const c = new THREE.Color();
    specs.forEach((s, i) => {
      off.set([s.x, s.y, s.z], i * 3);
      size[i] = s.size;
      c.set(s.color); // sRGB hex → linear working colour, same as SpriteMaterial.color
      col.set([c.r, c.g, c.b], i * 3);
    });
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(specs.length), 1);
    this.alpha.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAlpha', this.alpha);
    geo.instanceCount = specs.length;
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null } }]),
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    });
    mat.uniforms.map.value = glowTex();
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false; // instances span the island; the shader drops invisible ones
    this.mesh.renderOrder = 5;
    this.mesh.name = 'glows';
    this.mesh.visible = false;
  }

  /** Write all alphas for this frame; the whole batch is skipped (no draw call) while every glow is off. */
  setAlphas(fn: (i: number) => number): number {
    const a = this.alpha.array as Float32Array;
    let shown = 0;
    for (let i = 0; i < this.count; i++) {
      const v = fn(i);
      a[i] = v > 0.005 ? v : 0;
      if (a[i] > 0) shown++;
    }
    this.alpha.needsUpdate = true;
    this.mesh.visible = shown > 0;
    return shown;
  }
}
