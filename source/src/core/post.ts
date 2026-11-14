/**
 * HD-2D style post chain: MSAA scene → soft bloom → tilt-shift depth blur →
 * gentle vignette/grade → tone-mapped sRGB output.
 *
 * iOS Safari often cannot complete a HalfFloatType + MSAA framebuffer; we
 * feature-detect a working render target and fall back to a direct render
 * if the composer still fails.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { isCoarsePointer, isIOS } from './device';
import { quality } from './quality';
import { StylizePass } from '../render/stylize'; // [watercolor-ink style hook]

const TiltShift = {
  uniforms: {
    tDiffuse: { value: null },
    uDir: { value: new THREE.Vector2(1, 0) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uFocus: { value: 0.47 },
    uBand: { value: 0.2 },
    uAmount: { value: 2.2 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uDir;
    uniform vec2 uRes;
    uniform float uFocus;
    uniform float uBand;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      float d = max(0.0, abs(vUv.y - uFocus) - uBand);
      float r = clamp(d * 2.4, 0.0, 1.0) * uAmount;
      vec2 stepv = uDir / uRes * r;
      vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;
      sum += texture2D(tDiffuse, vUv + stepv * 1.3846153846) * 0.3162162162;
      sum += texture2D(tDiffuse, vUv - stepv * 1.3846153846) * 0.3162162162;
      sum += texture2D(tDiffuse, vUv + stepv * 3.2307692308) * 0.0702702703;
      sum += texture2D(tDiffuse, vUv - stepv * 3.2307692308) * 0.0702702703;
      gl_FragColor = sum;
    }
  `,
};

/** Mobile tier: one disc-blur pass instead of the two separable passes (same focus band / falloff). */
const TiltShiftCombined = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uFocus: { value: 0.47 },
    uBand: { value: 0.2 },
    uAmount: { value: 2.2 },
  },
  vertexShader: TiltShift.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uFocus;
    uniform float uBand;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      float d = max(0.0, abs(vUv.y - uFocus) - uBand);
      float r = clamp(d * 2.4, 0.0, 1.0) * uAmount;
      vec4 c0 = texture2D(tDiffuse, vUv);
      if (r < 0.01) { gl_FragColor = c0; return; }
      vec2 px = r / uRes;
      // 9 taps: centre, 4 on the axes at ~1.4 px·r, 4 on the diagonals at ~2.9 px·r (≈ the 2-pass Gaussian footprint)
      vec4 sum = c0 * 0.2;
      vec2 a = px * 1.4;
      sum += (texture2D(tDiffuse, vUv + vec2(a.x, 0.0)) + texture2D(tDiffuse, vUv - vec2(a.x, 0.0))
            + texture2D(tDiffuse, vUv + vec2(0.0, a.y)) + texture2D(tDiffuse, vUv - vec2(0.0, a.y))) * 0.125;
      vec2 b = px * 2.05;
      sum += (texture2D(tDiffuse, vUv + b) + texture2D(tDiffuse, vUv - b)
            + texture2D(tDiffuse, vUv + vec2(b.x, -b.y)) + texture2D(tDiffuse, vUv + vec2(-b.x, b.y))) * 0.075;
      gl_FragColor = sum;
    }
  `,
};

const Grade = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.28 },
    uWarm: { value: 0.0 },
    uSat: { value: 1.08 },
  },
  vertexShader: TiltShift.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uWarm;
    uniform float uSat;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb *= mix(vec3(1.0), vec3(1.06, 1.0, 0.9), uWarm);
      vec2 q = vUv - 0.5;
      float vig = 1.0 - dot(q, q) * uVignette * 2.2;
      c.rgb *= clamp(vig, 0.0, 1.0);
      gl_FragColor = c;
    }
  `,
};

interface RtOpts { type: THREE.TextureDataType; samples: number }

function makeTarget(w: number, h: number, opts: RtOpts): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: opts.type,
    samples: opts.samples,
    depthBuffer: true,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
}

function framebufferOk(renderer: THREE.WebGLRenderer, opts: RtOpts, w: number, h: number): boolean {
  const rt = makeTarget(w, h, opts);
  try {
    renderer.setRenderTarget(rt);
    const gl = renderer.getContext();
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    renderer.setRenderTarget(null);
    rt.dispose();
    return status === gl.FRAMEBUFFER_COMPLETE;
  } catch {
    renderer.setRenderTarget(null);
    rt.dispose();
    return false;
  }
}

function pickTarget(renderer: THREE.WebGLRenderer, cssW: number, cssH: number): THREE.WebGLRenderTarget {
  const pr = renderer.getPixelRatio();
  const w = Math.max(1, Math.floor(cssW * pr));
  const h = Math.max(1, Math.floor(cssH * pr));
  // phones / tablets (iOS and touch Android): no MSAA. Two 4× half-float multisample buffers at ~1.75× DPR cost
  // ~140 MB of GPU memory on a phone (perf-mobile.mjs, 2026-11-14); the pixel-art sprites are alpha-tested, so
  // MSAA never smoothed their edges anyway, and at that DPR the terrain edges stay clean.
  const ios = isIOS() || isCoarsePointer();
  const attempts: RtOpts[] = ios
    ? [
        { type: THREE.UnsignedByteType, samples: 0 },
        { type: THREE.HalfFloatType, samples: 0 },
      ]
    : [
        { type: THREE.HalfFloatType, samples: 4 },
        { type: THREE.HalfFloatType, samples: 0 },
        { type: THREE.UnsignedByteType, samples: 4 },
        { type: THREE.UnsignedByteType, samples: 0 },
      ];
  for (const opts of attempts) {
    if (framebufferOk(renderer, opts, w, h)) return makeTarget(w, h, opts);
  }
  return makeTarget(w, h, { type: THREE.UnsignedByteType, samples: 0 });
}

export class PostFX {
  composer: EffectComposer | null = null;
  bloom: UnrealBloomPass | null = null;
  private tiltH: ShaderPass | null = null;
  private tiltV: ShaderPass | null = null;
  grade: ShaderPass | null = null;
  fallback = false;
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
    const size = renderer.getSize(new THREE.Vector2());
    try {
      const rt = pickTarget(renderer, size.x, size.y);
      this.composer = new EffectComposer(renderer, rt);
      // [watercolor-ink style hook] StylizePass = RenderPass + watercolor/ink paint pass (src/render/stylize.ts)
      this.composer.addPass(new StylizePass(scene, camera as THREE.PerspectiveCamera));
      const q = quality();
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.25, 0.55, 0.82);
      if (q.bloomScale !== 1) {
        // lower-resolution bloom chain on the mobile tier (it is blurred anyway); the composite stays full-res
        const bloom = this.bloom;
        const setSize = bloom.setSize.bind(bloom);
        bloom.setSize = (w: number, h: number) => setSize(Math.max(2, Math.round(w * q.bloomScale)), Math.max(2, Math.round(h * q.bloomScale)));
      }
      this.composer.addPass(this.bloom);
      if (q.tiltCombined) {
        this.tiltH = new ShaderPass(TiltShiftCombined);
        this.composer.addPass(this.tiltH);
      } else {
        this.tiltH = new ShaderPass(TiltShift);
        this.tiltV = new ShaderPass(TiltShift);
        (this.tiltV.uniforms.uDir.value as THREE.Vector2).set(0, 1);
        this.composer.addPass(this.tiltH);
        this.composer.addPass(this.tiltV);
      }
      this.grade = new ShaderPass(Grade);
      this.composer.addPass(this.grade);
      this.composer.addPass(new OutputPass());
      this.setSize(size.x, size.y);
    } catch (err) {
      console.warn('PostFX init failed, using direct renderer', err);
      this.useFallback();
    }
  }

  private useFallback(): void {
    this.fallback = true;
    this.composer = null;
  }

  setSize(w: number, h: number): void {
    if (this.fallback || !this.composer) return;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    for (const p of [this.tiltH, this.tiltV]) {
      if (p) (p.uniforms.uRes.value as THREE.Vector2).set(w * pr, h * pr);
    }
  }

  setTilt(amount: number, focus = 0.47, band = 0.2): void {
    for (const p of [this.tiltH, this.tiltV]) {
      if (!p) continue;
      p.uniforms.uAmount.value = amount;
      p.uniforms.uFocus.value = focus;
      p.uniforms.uBand.value = band;
    }
  }

  render(dt: number): void {
    if (this.fallback || !this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    try {
      this.composer.render(dt);
    } catch (err) {
      console.warn('PostFX render failed, using direct renderer', err);
      this.useFallback();
      this.renderer.render(this.scene, this.camera);
    }
  }
}
