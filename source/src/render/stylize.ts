/**
 * Watercolor + ink world style (prototype, 2026-11-14, "# Watercolor-ink style" in docs/phase1/PROGRESS.md).
 *
 * Replaces the composer's RenderPass. With the style on, a frame is drawn in three steps:
 *   1. the world (everything except the pixel-art character sprites) into an own target with a depth texture;
 *   2. one full-screen "paint" pass: wobbled colour sampling (pigment bleed), soft value banding (washes),
 *      edge darkening (pigment pooling), paper grain + low-frequency wash blotches, dark-brown ink contours
 *      from linear-depth silhouettes + creases (Laplacian), light cross-hatching in shadows (high tier only).
 *      It writes the world depth back (gl_FragDepth) so step 3 is still depth-tested;
 *   3. the character sprites on top, untouched (no ink, no paper), same as before.
 * Bloom / tilt-shift / grade / output then run as before. With the style off it is exactly a RenderPass.
 *
 * Switch: 設定 (操作說明 sheet) 風格：水彩／原始, saved in localStorage 'tao-style'; URL ?style=original|watercolor;
 * debug hook window.__TAO_STYLE__ = { get, set(style), params }.
 */
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { quality } from '../core/quality';
import type { Period, Season } from '../core/timeSeason';
import { PAINT, PERIOD_LOOK } from './styleConfig';
import { paintScene, setPaintMaterials } from './paintMaterials';
import { setCharacterGlow } from './spriteGlow';

const high = () => quality().tier === 'high';
const passes = new Set<{ mat: THREE.ShaderMaterial }>();
let lookPeriod: Period = 'day';

/** copy PAINT (+ the current time-of-day PERIOD_LOOK) into the paint-pass uniforms */
function applyPaint(u: Record<string, THREE.IUniform>, hi: boolean): void {
  const pl = PERIOD_LOOK[lookPeriod];
  (u.uInk.value as THREE.Color).set(PAINT.ink);
  (u.uPaper.value as THREE.Color).set(PAINT.paper);
  u.uPaperTint.value = pl.paperTint;
  u.uLine.value = PAINT.line * pl.ink;
  u.uLineW.value = hi ? PAINT.lineWidth.high : PAINT.lineWidth.mobile;
  (u.uSil.value as THREE.Vector2).set(...PAINT.silhouette);
  (u.uCrease.value as THREE.Vector2).set(...PAINT.crease);
  u.uCreaseK.value = PAINT.creaseStrength;
  (u.uFade.value as THREE.Vector2).set(...PAINT.inkFade);
  u.uWobble.value = PAINT.wobble; u.uBand.value = PAINT.band; u.uPool.value = PAINT.pool;
  u.uGrain.value = PAINT.grain; u.uWash.value = PAINT.wash;
  u.uHatch.value = PAINT.hatch * pl.hatch; u.uLift.value = pl.lift;
  u.uAiry.value = PAINT.airy * pl.airy; u.uSimplify.value = PAINT.simplify; u.uBright.value = pl.bright;
  setCharacterGlow(pl.glow);
  (u.uPal.value as THREE.Color[]).forEach((c, i) => c.set(PAINT.palette[i] ?? '#808080'));
  u.uPalK.value = PAINT.paletteK * pl.palette; u.uPalV.value = PAINT.paletteValue; u.uPalSigma.value = PAINT.paletteSigma;
  (u.uShadowTint.value as THREE.Color).set(PAINT.shadowTint); u.uShadowTintK.value = PAINT.shadowTintK;
}

/** time of day / season changed (game.ts applyAtmosphere) */
export function setPaintLook(period: Period, _season: Season): void {
  lookPeriod = period;
  passes.forEach((p) => applyPaint(p.mat.uniforms, high()));
}

export type WorldStyle = 'watercolor' | 'original';
const KEY = 'tao-style';
/** sprites are recognised by their material's program cache key (set in entities/billboard.ts noShine) */
const SPRITE_KEY = 'tao-sprite-noshine';

function initialStyle(): WorldStyle {
  try {
    const q = new URLSearchParams(window.location.search).get('style');
    if (q === 'original' || q === 'watercolor') return q;
    const s = localStorage.getItem(KEY);
    if (s === 'original' || s === 'watercolor') return s;
  } catch { /* no storage */ }
  return 'watercolor';
}

let current: WorldStyle = typeof window !== 'undefined' ? initialStyle() : 'original';
const listeners = new Set<(s: WorldStyle) => void>();
export function worldStyle(): WorldStyle { return current; }
export function setWorldStyle(s: WorldStyle, save = true): void {
  current = s;
  if (save) { try { localStorage.setItem(KEY, s); } catch { /* private mode */ } }
  listeners.forEach((f) => f(s));
}

/** tileable RGBA noise: R fine paper grain, G low-frequency wash blotches, B/A wobble field (pigment bleed) */
function paperTexture(): THREE.DataTexture {
  const N = 256;
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const octave = (cells: number) => {
    const g = new Float32Array(cells * cells).map(() => rnd());
    const out = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = (x / N) * cells, fy = (y / N) * cells;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i: number, j: number) => g[((j % cells) * cells) + (i % cells)];
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      out[y * N + x] = a + (b - a) * sy;
    }
    return out;
  };
  const fbm = (base: number, n: number) => {
    const acc = new Float32Array(N * N); let amp = 1, tot = 0;
    for (let o = 0; o < n; o++) { const v = octave(base << o); for (let i = 0; i < acc.length; i++) acc[i] += v[i] * amp; tot += amp; amp *= 0.5; }
    return acc.map((v) => v / tot);
  };
  const grain = fbm(64, 3), blot = fbm(4, 4), wx = fbm(8, 3), wy = fbm(8, 3);
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const fibre = rnd() * 0.25; // a bit of pure white noise on top of the grain
    data[i * 4] = Math.round(Math.min(1, grain[i] * 0.8 + fibre) * 255);
    data[i * 4 + 1] = Math.round(blot[i] * 255);
    data[i * 4 + 2] = Math.round(wx[i] * 255);
    data[i * 4 + 3] = Math.round(wy[i] * 255);
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

const PaintShader = {
  defines: { HATCH: 1, POOL: 1 },
  uniforms: {
    tColor: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    tPaper: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPr: { value: 1 },
    uNear: { value: 0.2 },
    uFar: { value: 1400 },
    // all values come from src/render/styleConfig.ts PAINT / PERIOD_LOOK (see applyPaint)
    uInk: { value: new THREE.Color() },
    uPaper: { value: new THREE.Color() },
    uPaperTint: { value: 0.06 },
    uLine: { value: 1.0 },
    uLineW: { value: 1.0 },
    uSil: { value: new THREE.Vector2(0.02, 0.06) },
    uCrease: { value: new THREE.Vector2(0.004, 0.014) },
    uCreaseK: { value: 0.85 },
    uFade: { value: new THREE.Vector2(80, 190) },
    uWobble: { value: 1.6 },
    uBand: { value: 0.35 },
    uPool: { value: 0.55 },
    uGrain: { value: 0.16 },
    uWash: { value: 0.14 },
    uHatch: { value: 0.32 },
    uLift: { value: 0.05 },
    uAiry: { value: 0.0 },
    uSimplify: { value: 0.0 },
    uBright: { value: 1.0 },
    uPal: { value: Array.from({ length: 8 }, () => new THREE.Color()) },
    uPalK: { value: 0.0 },
    uPalV: { value: 0.0 },
    uPalSigma: { value: 0.12 },
    uShadowTint: { value: new THREE.Color(1, 1, 1) },
    uShadowTintK: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tPaper;
    uniform vec2 uRes; uniform float uPr; uniform float uNear; uniform float uFar;
    uniform vec3 uInk; uniform vec3 uPaper; uniform float uPaperTint;
    uniform vec2 uSil, uCrease, uFade; uniform float uCreaseK, uAiry, uSimplify, uBright;
    uniform vec3 uPal[8]; uniform float uPalK, uPalV, uPalSigma;
    uniform vec3 uShadowTint; uniform float uShadowTintK;
    uniform float uLine, uLineW, uWobble, uBand, uPool, uGrain, uWash, uHatch, uLift;
    varying vec2 vUv;
    float lin(float d) { return uNear * uFar / (uFar - d * (uFar - uNear)); }
    float ldAt(vec2 uv) { return lin(texture2D(tDepth, uv).x); }
    float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    void main() {
      vec2 px = 1.0 / uRes;
      vec2 frag = vUv * uRes / uPr;              // CSS-pixel coordinates: patterns keep their size on any DPR
      vec4 P = texture2D(tPaper, frag / 256.0);   // fine grain
      vec4 Pl = texture2D(tPaper, frag / 900.0);  // large wash blotches + wobble field
      float dRaw = texture2D(tDepth, vUv).x;
      gl_FragDepth = dRaw;
      bool sky = dRaw > 0.99999;
      // pigment bleed: sample the scene through a low-frequency wobble field
      vec2 wob = (Pl.ba - 0.5) * 2.0 * uWobble * uPr * px;
      vec3 c = texture2D(tColor, vUv + wob).rgb;
      // simplify: soften fine texture detail (small 4-tap blur, rotated by the paper so it never looks like a filter)
      if (uSimplify > 0.0) {
        vec2 so = 1.6 * uPr * px * (0.8 + 0.4 * P.g);
        vec3 sb = texture2D(tColor, vUv + wob + vec2(so.x, so.y * 0.5)).rgb + texture2D(tColor, vUv + wob - vec2(so.x, so.y * 0.5)).rgb
                + texture2D(tColor, vUv + wob + vec2(-so.x * 0.5, so.y)).rgb + texture2D(tColor, vUv + wob + vec2(so.x * 0.5, -so.y)).rgb;
        c = mix(c, sb * 0.25, uSimplify);
      }
      vec3 c0 = c;
      // washes: soft value banding in perceptual space (4 bands, soft steps)
      float l = max(lum(c), 1e-4);
      float pl = sqrt(l) * 4.0;
      float band = (floor(pl) + smoothstep(0.3, 0.7, fract(pl))) / 4.0;
      c *= mix(1.0, (band * band) / l, uBand);
#if POOL
      // pigment pooling: darken where the colour changes (edge darkening of a drying wash)
      vec2 o = 2.5 * uPr * px;
      vec3 avg = (texture2D(tColor, vUv + wob + vec2(o.x, 0.0)).rgb + texture2D(tColor, vUv + wob - vec2(o.x, 0.0)).rgb
                + texture2D(tColor, vUv + wob + vec2(0.0, o.y)).rgb + texture2D(tColor, vUv + wob - vec2(0.0, o.y)).rgb) * 0.25;
      float pool = smoothstep(0.015, 0.12, length(c0 - avg) / (lum(avg) + 0.08));
      c *= 1.0 - uPool * 0.35 * pool;
#endif
      // translucent washes: lift towards the paper, a bit less saturated
      // watercolor never goes really dark: lift the darks most (screen towards white), then tint by the paper
      float dk = 1.0 - smoothstep(0.02, 0.35, lum(c));
      c = 1.0 - (1.0 - c) * (1.0 - uLift * (0.45 + 0.9 * dk));
      if (!sky && uPalK > 0.0) {
        // palette pull: hue/saturation (and a little value) toward the nearest colours of the target painting
        float lc = max(lum(c), 1e-3);
        vec3 cc = c / lc;
        vec3 acc = vec3(0.0); float ws = 0.0;
        for (int i = 0; i < 8; i++) {
          float lp = max(lum(uPal[i]), 1e-3);
          vec3 dc = cc - uPal[i] / lp;
          float dl = lc - lp;
          float w = exp(-dot(dc, dc) / uPalSigma - dl * dl * 6.0);
          acc += uPal[i] * w; ws += w;
        }
        vec3 tg = acc / max(ws, 1e-5);
        vec3 tgL = tg * (lc / max(lum(tg), 1e-3));
        c = mix(c, mix(tgL, tg, uPalV), uPalK * clamp(ws * 6.0, 0.0, 1.0));
      }
      // gentle shadows: darker tones lean blue-violet instead of black
      float shd = 1.0 - smoothstep(0.05, 0.4, lum(c));
      c *= mix(vec3(1.0), uShadowTint, shd * uShadowTintK);
      c *= mix(vec3(1.0), uPaper, uPaperTint);
      // airy: wash everything toward the paper, darks least (keeps contrast but lifts the key)
      float la = lum(c);
      c = mix(c, uPaper, uAiry * (0.35 + 0.4 * la));
      c = mix(vec3(lum(c)), c, 1.0 - uAiry * 0.1);
      c *= uBright;
      // paper: blotchy wash density + granulation (stronger where the pigment is dense)
      float dens = 1.0 - smoothstep(0.02, 0.5, lum(c));
      c *= 1.0 + uWash * (Pl.g - 0.5) * 2.0;
      c *= 1.0 - uGrain * (P.r - 0.35) * (0.6 + 0.8 * dens);
      float ink = 0.0;
      if (!sky) {
        // ink contours: silhouettes (nearer side of a depth jump) + creases (depth Laplacian), CSS-px width
        float w = uLineW * uPr * (0.85 + 0.3 * P.r);
        float d0 = lin(dRaw);
        float dl = ldAt(vUv - vec2(w * px.x, 0.0)), dr = ldAt(vUv + vec2(w * px.x, 0.0));
        float du = ldAt(vUv + vec2(0.0, w * px.y)), dd = ldAt(vUv - vec2(0.0, w * px.y));
        float jump = max(max(dl - d0, dr - d0), max(du - d0, dd - d0)) / d0;
        float sil = smoothstep(uSil.x, uSil.y, jump);
        float lap = abs(dl + dr + du + dd - 4.0 * d0) / d0;
        float crease = smoothstep(uCrease.x, uCrease.y, lap) * uCreaseK;
        float fade = 1.0 - smoothstep(uFade.x, uFade.y, d0); // far contours dissolve into the wash
        ink = max(sil, crease) * fade * uLine * (0.75 + 0.5 * Pl.r);
#if HATCH
        // light hatching only in shadows: diagonal strokes, broken up by the paper
        float shade = 1.0 - smoothstep(0.035, 0.12, l);
        float hp = abs(fract((frag.x + frag.y) / 5.0) - 0.5);
        float h = (1.0 - smoothstep(0.08, 0.2, hp)) * smoothstep(0.25, 0.6, P.r + Pl.g * 0.5);
        ink = max(ink, h * shade * uHatch * fade);
#endif
      }
      c = mix(c, uInk, clamp(ink, 0.0, 1.0));
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

/** Drop-in replacement for RenderPass (post.ts). */
export class StylizePass extends Pass {
  private rtWorld: THREE.WebGLRenderTarget | null = null;
  private quad: FullScreenQuad;
  readonly mat: THREE.ShaderMaterial;
  private sprites: THREE.Object3D[] = [];
  private scanAt = 0;
  private water: THREE.Mesh | undefined;
  readonly params: Record<string, { value: unknown }>;
  /** last frame's CPU time of this pass, ms (debug) */
  cpuMs = 0;

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    super();
    this.needsSwap = false;
    const high = quality().tier === 'high';
    this.mat = new THREE.ShaderMaterial({
      defines: { HATCH: high ? 1 : 0, POOL: high ? 1 : 0 },
      uniforms: THREE.UniformsUtils.clone(PaintShader.uniforms),
      vertexShader: PaintShader.vertexShader,
      fragmentShader: PaintShader.fragmentShader,
      depthTest: true,
      depthWrite: true,
      depthFunc: THREE.AlwaysDepth,
    });
    this.mat.uniforms.tPaper.value = paperTexture();
    passes.add(this);
    applyPaint(this.mat.uniforms, high);
    this.params = this.mat.uniforms as unknown as Record<string, { value: unknown }>;
    this.quad = new FullScreenQuad(this.mat);
    if (typeof window !== 'undefined') {
      (window as unknown as { __TAO_STYLE__: unknown }).__TAO_STYLE__ = {
        get: worldStyle, set: (s: WorldStyle) => setWorldStyle(s, false), params: this.mat.uniforms,
        tier: high ? 'high' : 'mobile', pass: this,
      };
      mountStyleToggle();
    }
  }

  setSize(w: number, h: number): void {
    this.rtWorld?.setSize(w, h);
    (this.mat.uniforms.uRes.value as THREE.Vector2).set(w, h);
  }

  dispose(): void {
    passes.delete(this);
    this.rtWorld?.depthTexture?.dispose();
    this.rtWorld?.dispose();
    this.mat.dispose();
    this.quad.dispose();
  }

  /** sprite meshes are found by their material key; rescanned twice a second (NPCs stream in and out) */
  private scanSprites(): void {
    const now = performance.now();
    if (now - this.scanAt < 500) return;
    this.scanAt = now;
    this.sprites.length = 0;
    this.water = this.scene.getObjectByName('reef-ocean-reflector') as THREE.Mesh | undefined;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && !Array.isArray(m) && m.customProgramCacheKey && m.customProgramCacheKey() === SPRITE_KEY) {
        this.sprites.push(o);
        o.layers.enable(31);
      }
    });
  }

  private ensureTarget(read: THREE.WebGLRenderTarget): THREE.WebGLRenderTarget {
    const rt = this.rtWorld;
    if (rt && rt.width === read.width && rt.height === read.height && rt.samples === read.samples) return rt;
    rt?.depthTexture?.dispose();
    rt?.dispose();
    const t = new THREE.WebGLRenderTarget(read.width, read.height, {
      type: read.texture.type, samples: read.samples, depthBuffer: true, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    t.depthTexture = new THREE.DepthTexture(read.width, read.height, THREE.UnsignedIntType);
    this.rtWorld = t;
    (this.mat.uniforms.uRes.value as THREE.Vector2).set(read.width, read.height);
    return t;
  }

  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    const target = this.renderToScreen ? null : read;
    setPaintMaterials(current === 'watercolor');
    if (current !== 'watercolor') {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(this.scene, this.camera);
      return;
    }
    const t0 = performance.now();
    this.scanSprites();
    paintScene(this.scene, high(), this.mat.uniforms.tPaper.value as THREE.Texture);
    const rt = this.ensureTarget(read);
    // 1. world without the character sprites
    const vis = this.sprites.map((s) => s.visible);
    for (const s of this.sprites) s.visible = false;
    // the sea writes depth here so the sea floor under it gets no ink and the shoreline gets a contour
    const sea = this.water?.material as THREE.Material | undefined;
    const seaDW = sea?.depthWrite ?? false;
    if (sea) sea.depthWrite = true;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    if (sea) sea.depthWrite = seaDW;
    for (let i = 0; i < this.sprites.length; i++) this.sprites[i].visible = vis[i];
    // 2. paint pass into the composer target, world depth written back
    const u = this.mat.uniforms;
    u.tColor.value = rt.texture; u.tDepth.value = rt.depthTexture;
    u.uNear.value = this.camera.near; u.uFar.value = this.camera.far;
    u.uPr.value = renderer.getPixelRatio();
    renderer.setRenderTarget(target);
    renderer.clear();
    this.quad.render(renderer);
    // 3. sprites only (layer 31), depth-tested against the world; no background, no second shadow-map update
    const bg = this.scene.background, mask = this.camera.layers.mask, auto = renderer.autoClear, sm = renderer.shadowMap.autoUpdate;
    this.scene.background = null; this.camera.layers.set(31); renderer.autoClear = false; renderer.shadowMap.autoUpdate = false;
    renderer.render(this.scene, this.camera);
    this.scene.background = bg; this.camera.layers.mask = mask; renderer.autoClear = auto; renderer.shadowMap.autoUpdate = sm;
    this.cpuMs = performance.now() - t0;
  }
}

/** 風格 水彩／原始 row in the 操作說明 sheet, next to 文字大小 (reuses its .text-size styles; no shared-file edit) */
function mountStyleToggle(): void {
  const tryMount = () => {
    const sheet = document.querySelector('#help-sheet .help-sheet');
    if (!sheet) return false;
    if (document.getElementById('style-toggle')) return true;
    const row = document.createElement('div');
    row.className = 'text-size';
    row.id = 'style-toggle';
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', '風格');
    row.innerHTML = `<span class="ts-label">風格</span>
      <button type="button" data-style="watercolor" role="radio">水彩</button>
      <button type="button" data-style="original" role="radio">原始</button>`;
    sheet.appendChild(row);
    const sync = (s: WorldStyle) => row.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.style === s; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    row.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b?.dataset.style) setWorldStyle(b.dataset.style as WorldStyle);
    });
    listeners.add(sync);
    sync(current);
    return true;
  };
  if (!tryMount()) {
    const obs = new MutationObserver(() => { if (tryMount()) obs.disconnect(); });
    obs.observe(document.body, { childList: true, subtree: true });
  }
}
