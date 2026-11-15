/**
 * 0.1.4 arrival intro, 2.5D: hand-painted layers composited in screen space with parallax.
 * A separate, tiny three.js scene (orthographic camera, one shared quad), not the game island.
 *
 * Choreography (Larry, 15 Nov): behind the title / party / 搭飛機／搭船 menus, only Lanyu — sky, sea and the
 * real island — with a slow drift, from the same starting angle for both routes. After the choice the camera
 * pulls back to reveal the cabin window and wing (plane) or the bow deck (yacht) and holds (bob / pitch, spray)
 * while the island loads (logo, title music, lower-left loading bar). The logo fades first; then the plane banks
 * and turns toward the island, or the yacht drives forward out of frame, and the shot fades out into the notebook.
 *
 * Layers (public/assets/intro25d/intro25d.json, made by scripts/art/build-intro25d.py from Digital Painter's
 * layers in art-ref/arrival/layers25d/<mode>/):
 *   plate / sky / island / sea   the vista (sea kind = waves, swell and glints on the whole layer)
 *   cloud / mist                 painted depth layers (used on the ride, not on the menu vista)
 *   spray                        yacht bow spray (three frames, cycled)
 *   overlay                      wing, cabin window frame, or bow deck (camera-locked)
 * Colours pass straight through (no tone mapping / colour-space conversion): the paint is what you see.
 */
import * as THREE from 'three';
import { assetUrl } from '../core/paths';

export type IntroMode = 'title' | 'plane' | 'boat';

type Kind = 'plate' | 'sky' | 'island' | 'sea' | 'cloud' | 'mist' | 'spray' | 'overlay';
/** layers that sit in front of the far haze / wisps / cloud burst */
const NEAR_KINDS: Kind[] = ['cloud', 'mist', 'spray', 'overlay'];
interface LayerDef {
  file: string;
  kind: Kind;
  depth?: number;
  /** sideways parallax factor (0 = fixed sky … 1 = near clouds); else from depth (14 / depth) */
  parallax?: number;
  /** far layer (atmosphere goes in front of it) */
  far?: boolean;
  drift?: number;
  rect: [number, number, number, number];
  sea?: string;
  frames?: string[];
  anchor?: [number, number];
  screen?: [number, number];
  /** wing / frame / bow — used to draw the window in front of the wing */
  role?: string;
}
interface ModeDef {
  size: [number, number];
  aspect: number;
  /** the visible frame inside the plate (x0, width as fractions of the plate width); the rest is overscan */
  frame?: [number, number];
  target: [number, number];
  /** what narrow screens centre on (default: the target) */
  focus?: [number, number];
  horizon: number;
  sun: [number, number];
  layers: LayerDef[];
  source?: string;
}
interface Manifest {
  plane?: ModeDef;
  yacht?: ModeDef;
  shared?: { burst: { file: string; aspect: number }[]; wisp: { file: string; aspect: number }[]; glint: string | null };
}

const BASE = 'assets/intro25d/';
/** kinds shown behind the title / party / choice menus (sky, sea, real island only) */
const TITLE_KINDS: Kind[] = ['plate', 'sky', 'island', 'sea'];
/** zoom of that shared Lanyu vista (pulled back to 1 to reveal the vehicle) */
const TITLE_ZOOM = 1.22;
/** seconds to pull back and reveal the window / bow after the choice */
export const REVEAL_SECONDS = 2.2;
/** seconds of the bank / drive-off after the logo fades */
export const FINALE_SECONDS = 3.4;
/** fade to the notebook at the end of the finale */
export const FADE_SECONDS = 0.85;
/** @deprecated tests that still read pushProgress: the finale plus the fade */
export const PUSH_SECONDS = FINALE_SECONDS + FADE_SECONDS;

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const NOISE = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }`;

/** painted layer; with a sea mask: moving waves, rolling swell, sun glints */
const FS_LAYER = /* glsl */ `
uniform sampler2D map;
uniform sampler2D seaMask;
uniform sampler2D glint;
uniform float hasSea;      // 0 none, 1 mask texture, 2 the whole layer is sea
uniform float opacity;
uniform float time;
uniform float horizon;     // plate v (from the top) of the horizon
uniform vec2 sun;          // plate uv of the sun
uniform vec4 rect;         // this layer's rect on the plate (x, y from the top, w, h)
uniform float aspect;      // plate w / h
uniform float wobble;      // cloud breathing
uniform float seaSkew;     // camera pan in plate-u (−pan / plateW)
uniform float seaPar0;     // the layer's rigid parallax (already applied to the mesh)
varying vec2 vUv;
${NOISE}
void main() {
  vec2 uv = vUv;
  vec2 pp = vec2(rect.x + uv.x * rect.z, rect.y + (1.0 - uv.y) * rect.w); // plate uv, v down
  float m = 0.0;
  if (hasSea > 1.5) m = 1.0; else if (hasSea > 0.5) m = texture2D(seaMask, uv).r;
  float d = clamp((pp.y - horizon) / max(0.05, 1.0 - horizon), 0.0, 1.0); // 0 horizon → 1 bottom
  if (m > 0.01) {
    // painted sea: far 0.15 … near 0.6, as a shear on top of the layer's rigid parallax
    float seaPar = mix(0.15, 0.60, d);
    uv.x += seaSkew * (seaPar - seaPar0) * m / max(rect.z, 0.001);
    float z = 1.0 / (d + 0.07);                                                  // ~distance
    float ph = z * 2.6 - time * 1.15 + sin(pp.x * aspect * 9.0 + z * 0.9) * 0.6;
    float ph2 = z * 4.1 - time * 1.7 + pp.x * aspect * 23.0;
    vec2 off = vec2(sin(ph2) * 0.0018, sin(ph) * 0.0016 + sin(ph2 * 0.7) * 0.0009) * (0.25 + d * d * 1.6);
    uv += off * m / rect.zw;
  }
  vec4 c = texture2D(map, uv);
  if (wobble > 0.0) {
    float n = fbm(pp * vec2(aspect, 1.0) * 7.0 + vec2(time * 0.05, time * 0.03));
    c.a *= smoothstep(0.08, 0.5, c.a + (n - 0.5) * wobble);
  }
  if (m > 0.01) {
    float z = 1.0 / (d + 0.07);
    // rolling swell: soft light bands that travel toward the viewer
    float sw = sin(z * 1.9 - time * 0.75 + pp.x * aspect * 1.7) * 0.5 + 0.5;
    c.rgb *= 1.0 + m * (sw - 0.5) * 0.10 * (0.3 + d);
    // glints: two scrolling tiles multiplied = twinkle; strongest on the sun path
    vec2 gu = vec2(pp.x * aspect * (2.0 + 5.0 / (d + 0.12)), z * 0.55);
    float g = texture2D(glint, gu + vec2(time * 0.011, -time * 0.035)).r * texture2D(glint, gu * 1.37 + vec2(-time * 0.017, -time * 0.022)).r;
    float path = exp(-pow((pp.x - sun.x) * aspect * (2.2 + 4.0 * d), 2.0));
    float lum = dot(c.rgb, vec3(0.3, 0.5, 0.2));
    float spark = pow(g, 2.2) * (0.35 + 2.6 * path) * (0.4 + lum);
    c.rgb += m * spark * vec3(1.0, 0.95, 0.84) * (1.0 - d * 0.35);
  }
  gl_FragColor = vec4(c.rgb, c.a * opacity);
}`;

/** yacht spray frames: cross-faded, broken up by moving noise, pulsing with the bow */
const FS_SPRAY = /* glsl */ `
uniform sampler2D f0;
uniform sampler2D f1;
uniform sampler2D f2;
uniform float time;
uniform float amount;
uniform float opacity;
varying vec2 vUv;
${NOISE}
void main() {
  float ph = time * 4.0;
  float k = fract(ph);
  float i = mod(floor(ph), 3.0);
  vec2 rise = vec2(0.0, -fract(time * 0.9) * 0.006);
  vec4 a = i < 0.5 ? texture2D(f0, vUv + rise) : i < 1.5 ? texture2D(f1, vUv + rise) : texture2D(f2, vUv + rise);
  vec4 b = i < 0.5 ? texture2D(f1, vUv) : i < 1.5 ? texture2D(f2, vUv) : texture2D(f0, vUv);
  vec4 c = mix(a, b, smoothstep(0.0, 1.0, k));
  float n = fbm(vUv * vec2(38.0, 22.0) + vec2(time * 0.6, -time * 1.9));
  float alpha = c.a * smoothstep(0.62 - amount * 0.5, 0.95 - amount * 0.3, n + c.a * 0.55);
  gl_FragColor = vec4(mix(c.rgb, vec3(1.0, 0.99, 0.96), 0.35), alpha * opacity);
}`;

/** live mist / cloud vapour: fbm sliding across the screen; `band` keeps it low over the sea */
const FS_MIST = /* glsl */ `
uniform float time;
uniform float density;
uniform vec2 speed;
uniform float scale;
uniform vec3 tint;
uniform vec4 band;         // y0, y1 (screen, 0 top), soft, on
uniform float aspect;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = vec2(vUv.x * aspect, 1.0 - vUv.y);
  vec2 q = p * scale + speed * time;
  float n = fbm(q + fbm(q * 0.6 + time * 0.04) * 1.3);
  float a = smoothstep(1.0 - density * 1.15, 1.25 - density * 0.6, n + density * 0.35);
  if (band.w > 0.5) a *= smoothstep(band.x - band.z, band.x, p.y) * (1.0 - smoothstep(band.y, band.y + band.z, p.y));
  float lit = 0.92 + 0.08 * fbm(q * 1.7);
  gl_FragColor = vec4(tint * lit, clamp(a, 0.0, 1.0) * min(1.0, density * 1.4));
}`;

interface Layer {
  def: LayerDef;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
}
interface Card {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  aspect: number;
  /** burst: start screen pos (0..1), outward dir; wisp: lane y, period, offset */
  a: number;
  b: number;
  c: number;
  d: number;
  kind: 'burst' | 'wisp';
}

const ease = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const easeInOut = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export class IntroScene {
  readonly scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
  private quad = new THREE.PlaneGeometry(1, 1);
  private man: Manifest = {};
  private tex = new Map<string, THREE.Texture>();
  private pending = new Map<string, Promise<THREE.Texture | null>>();
  private layers: Layer[] = [];
  private cards: Card[] = [];
  private mist: THREE.ShaderMaterial[] = [];
  private mistMeshes: THREE.Mesh[] = [];
  private def: ModeDef | null = null;
  private fallback: THREE.Mesh | null = null;
  private t0 = performance.now();
  private pushT0: number | null = null;
  private size = new THREE.Vector2(1, 1);
  private building = 0;
  mode: IntroMode = 'title';
  /** what the shot is doing (tests): dolly, zoom on the plate, push 0..1, mist density, layer count */
  readonly pose = {
    mode: 'title' as IntroMode,
    phase: 'drift' as 'drift' | 'reveal' | 'hold' | 'finale' | 'fade',
    zoom: 1, push: 0, reveal: 0, finale: 0, fade: 0, bank: 0, overlay: 0,
    mist: 0, layers: 0, roll: 0, pitch: 0, source: '',
  };

  constructor(_aspect: number) {
    this.scene.background = new THREE.Color('#e9d9bf');
  }

  private url(f: string): string {
    return assetUrl(BASE + f);
  }

  private loadTex(path: string): Promise<THREE.Texture | null> {
    const hit = this.tex.get(path);
    if (hit) return Promise.resolve(hit);
    const p = this.pending.get(path);
    if (p) return p;
    const pr = new Promise<THREE.Texture | null>((res) => {
      new THREE.TextureLoader().load(
        this.url(path),
        (t) => {
          t.colorSpace = THREE.NoColorSpace; // straight paint, no conversion
          t.minFilter = THREE.LinearMipmapLinearFilter;
          t.anisotropy = 2;
          this.tex.set(path, t);
          res(t);
        },
        undefined,
        () => res(null),
      );
    });
    this.pending.set(path, pr);
    return pr;
  }

  private modeDef(mode: IntroMode): ModeDef | null {
    return (mode === 'boat' ? this.man.yacht : this.man.plane) ?? null;
  }

  private dirOf(mode: IntroMode): string {
    return mode === 'boat' ? 'yacht/' : 'plane/';
  }

  private async loadMode(mode: IntroMode): Promise<void> {
    const d = this.modeDef(mode);
    if (!d) return;
    const dir = this.dirOf(mode);
    const files: string[] = [];
    for (const l of d.layers) {
      for (const f of l.frames ?? [l.file]) files.push(dir + f);
      if (l.sea) files.push(dir + l.sea);
    }
    const sh = this.man.shared;
    if (sh?.glint) files.push('shared/' + sh.glint);
    if (mode !== 'boat') for (const c of [...(sh?.burst ?? []), ...(sh?.wisp ?? [])]) files.push('shared/' + c.file);
    await Promise.all(files.map((f) => this.loadTex(f)));
  }

  /** manifest + the title / plane layers (the yacht's load in the background right after) */
  async load(): Promise<void> {
    try {
      const r = await fetch(this.url('intro25d.json'));
      if (r.ok) this.man = (await r.json()) as Manifest;
    } catch {
      /* no manifest: a plain dawn backdrop */
    }
    await this.loadMode('title');
    this.build('title');
    void this.loadMode('boat');
  }

  // ---------------------------------------------------------------- building a shot

  private clearShot(): void {
    for (const o of [...this.layers.map((l) => l.mesh), ...this.cards.map((c) => c.mesh), ...this.mistMeshes]) {
      o.removeFromParent();
      (o.material as THREE.Material).dispose();
    }
    this.layers = [];
    this.cards = [];
    this.mist = [];
    this.mistMeshes = [];
    if (this.fallback) {
      this.fallback.removeFromParent();
      (this.fallback.material as THREE.Material).dispose();
      this.fallback = null;
    }
  }

  private glintTex(): THREE.Texture | null {
    const g = this.man.shared?.glint;
    const t = g ? this.tex.get('shared/' + g) ?? null : null;
    if (t) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  private build(mode: IntroMode): void {
    this.clearShot();
    this.mode = mode;
    this.pose.mode = mode;
    const d = this.modeDef(mode);
    this.def = d;
    this.pose.source = d?.source ?? 'none';
    let order = 0;
    if (!d) {
      const m = new THREE.ShaderMaterial({
        vertexShader: VS,
        fragmentShader: 'varying vec2 vUv; void main(){ gl_FragColor = vec4(mix(vec3(0.16,0.33,0.56), vec3(0.96,0.84,0.66), smoothstep(0.2,0.75,vUv.y)), 1.0); }',
        depthTest: false,
        depthWrite: false,
      });
      this.fallback = new THREE.Mesh(this.quad, m);
      this.scene.add(this.fallback);
      return;
    }
    const dir = this.dirOf(mode);
    const glint = this.glintTex();
    for (const l of d.layers) {
      if (mode === 'title' && !TITLE_KINDS.includes(l.kind)) continue;
      if (mode !== 'title' && !this.atmosphereDone && NEAR_KINDS.includes(l.kind) && !l.far) order = this.addAtmosphere(mode, order);
      let mat: THREE.ShaderMaterial;
      if (l.kind === 'spray') {
        const fr = (l.frames ?? [l.file]).map((f) => this.tex.get(dir + f) ?? null);
        mat = new THREE.ShaderMaterial({
          vertexShader: VS,
          fragmentShader: FS_SPRAY,
          uniforms: { f0: { value: fr[0] }, f1: { value: fr[1] ?? fr[0] }, f2: { value: fr[2] ?? fr[0] }, time: { value: 0 }, amount: { value: 0.7 }, opacity: { value: 1 } },
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });
      } else {
        const sea = l.sea ? this.tex.get(dir + l.sea) ?? null : null;
        mat = new THREE.ShaderMaterial({
          vertexShader: VS,
          fragmentShader: FS_LAYER,
          uniforms: {
            map: { value: this.tex.get(dir + l.file) ?? null },
            seaMask: { value: sea },
            glint: { value: glint },
            hasSea: { value: l.kind === 'sea' ? 2 : sea && glint ? 1 : 0 },
            opacity: { value: 1 },
            time: { value: 0 },
            horizon: { value: d.horizon },
            sun: { value: new THREE.Vector2(...d.sun) },
            rect: { value: new THREE.Vector4(...l.rect) },
            aspect: { value: d.aspect },
            wobble: { value: l.kind === 'cloud' || l.kind === 'mist' ? 0.12 : 0 },
            seaSkew: { value: 0 },
            seaPar0: { value: 0 },
          },
          transparent: l.kind !== 'plate' && l.kind !== 'sky',
          depthTest: false,
          depthWrite: false,
        });
        if (!mat.uniforms.map.value) mat.visible = false;
      }
      const mesh = new THREE.Mesh(this.quad, mat);
      mesh.renderOrder = order++;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.layers.push({ def: l, mesh, mat });
      // the mist / cloud cards go in front of the far layers but behind the spray and the overlay
    }
    if (mode !== 'title' && !this.atmosphereDone) order = this.addAtmosphere(mode, order);
    // overlays and spray last
    const late = this.layers.filter((x) => x.def.kind === 'overlay' || x.def.kind === 'spray');
    for (const x of late) x.mesh.renderOrder = (x.def.kind === 'overlay' ? 500 : 400) + order++;
    // mist that passes in front of everything but the overlay (inside a cloud: in front of all)
    const front = this.addMist(order + 20, mode === 'plane' ? { scale: 2.2, speed: [-0.55, 0.04], band: null, tint: [0.99, 0.97, 0.94] } : null);
    if (front) front.renderOrder = 350; // in front of the far layers and cloud cards, behind the spray / overlay
    this.pose.layers = this.layers.length;
  }

  private atmosphereDone = false;

  private addAtmosphere(mode: IntroMode, order: number): number {
    this.atmosphereDone = true;
    // far haze / sea mist (yacht: a low band on the water; plane / title: thin cloud vapour over the island)
    const m = this.addMist(order++, mode === 'boat'
      ? { scale: 1.6, speed: [0.03, 0.0], band: [0.4, 0.62, 0.08], tint: [0.97, 0.94, 0.9] }
      : { scale: 1.3, speed: [0.025, 0.004], band: null, tint: [1.0, 0.97, 0.92] });
    if (m) m.userData.far = true;
    if (mode === 'boat') return order;
    const sh = this.man.shared;
    // wisps sliding past the window (plane) / drifting high (title)
    (sh?.wisp ?? []).forEach((w, i) => {
      for (let k = 0; k < 2; k++) {
        const card = this.addCard('shared/' + w.file, w.aspect, order++, 'wisp');
        if (!card) continue;
        card.a = 0.12 + 0.2 * ((i * 2 + k) % 3); // lane (screen y)
        card.b = mode === 'title' ? 70 : 9 + 3 * k + i * 2; // seconds per pass
        card.c = (i * 0.37 + k * 0.53) % 1; // phase
        card.d = mode === 'title' ? 0.3 : 0.38;
      }
    });
    // the cloud the plane bursts out of
    if (mode === 'plane') {
      (sh?.burst ?? []).forEach((b, i) => {
        for (let k = 0; k < 2; k++) {
          const card = this.addCard('shared/' + b.file, b.aspect, 300 + i * 2 + k, 'burst'); // behind the wing
          if (!card) continue;
          const ang = ((i * 2 + k) / 8) * Math.PI * 2 + 0.4;
          card.a = 0.5 + Math.cos(ang) * 0.18;
          card.b = 0.5 + Math.sin(ang) * 0.16;
          card.c = Math.cos(ang);
          card.d = Math.sin(ang);
        }
      });
    }
    return order;
  }

  private addCard(path: string, aspect: number, order: number, kind: 'burst' | 'wisp'): Card | null {
    const t = this.tex.get(path);
    if (!t) return null;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS_LAYER,
      uniforms: {
        map: { value: t }, seaMask: { value: null }, glint: { value: null }, hasSea: { value: 0 }, opacity: { value: 0 }, time: { value: 0 },
        horizon: { value: 0.5 }, sun: { value: new THREE.Vector2() }, rect: { value: new THREE.Vector4(0, 0, 1, 1) }, aspect: { value: aspect }, wobble: { value: 0.18 }, seaSkew: { value: 0 }, seaPar0: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.quad, mat);
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    const c: Card = { mesh, mat, aspect, a: 0, b: 0, c: 0, d: 0, kind };
    this.cards.push(c);
    return c;
  }

  private addMist(order: number, o: { scale: number; speed: [number, number]; band: [number, number, number] | null; tint: [number, number, number] } | null): THREE.Mesh | null {
    if (!o) return null;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS_MIST,
      uniforms: {
        time: { value: 0 }, density: { value: 0 }, speed: { value: new THREE.Vector2(...o.speed) }, scale: { value: o.scale },
        tint: { value: new THREE.Color(...o.tint) }, band: { value: new THREE.Vector4(...(o.band ?? [0, 1, 0]), o.band ? 1 : 0) }, aspect: { value: 1 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.quad, mat);
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.mist.push(mat);
    this.mistMeshes.push(mesh);
    return mesh;
  }

  /** start a shot: 'title' (backdrop of the start screens), 'plane' or 'boat' (the ride in) */
  setMode(mode: IntroMode): void {
    this.t0 = performance.now();
    this.pushT0 = null;
    const id = ++this.building;
    this.atmosphereDone = false;
    if (this.modeDef(mode) && mode === 'boat' && !this.tex.has(this.dirOf('boat') + this.modeDef('boat')!.layers[0].file)) {
      // the yacht's layers are still loading: keep the current backdrop up until they are in
      this.mode = mode;
      this.pose.mode = mode;
      void this.loadMode(mode).then(() => {
        if (id !== this.building) return;
        this.atmosphereDone = false;
        this.t0 = performance.now();
        this.build(mode);
      });
      return;
    }
    void this.loadMode(mode).then(() => {
      if (id !== this.building) return;
      this.atmosphereDone = false;
      this.build(mode);
    });
    this.build(mode);
  }

  /** the logo has faded: bank toward the island (plane) or drive the bow out of frame (yacht), then fade */
  startFinale(): void {
    if (this.pushT0 === null) this.pushT0 = performance.now();
  }
  /** @deprecated same as startFinale (older tests) */
  startPush(): void {
    this.startFinale();
  }

  get pushing(): boolean {
    return this.pushT0 !== null;
  }

  /** 0..1 through the bank / drive-off (not including the fade) */
  get finaleProgress(): number {
    return this.pushT0 === null ? 0 : Math.min(1, (performance.now() - this.pushT0) / 1000 / FINALE_SECONDS);
  }

  /** 0..1 through the fade that follows the finale */
  get fadeProgress(): number {
    if (this.pushT0 === null) return 0;
    const t = (performance.now() - this.pushT0) / 1000 - FINALE_SECONDS;
    return t <= 0 ? 0 : Math.min(1, t / FADE_SECONDS);
  }

  /** 0..1 through finale+fade (legacy name used by game.ts / tests) */
  get pushProgress(): number {
    if (this.pushT0 === null) return 0;
    return Math.min(1, (performance.now() - this.pushT0) / 1000 / (FINALE_SECONDS + FADE_SECONDS));
  }

  /** the painted shot has faded out and the notebook can open */
  get finished(): boolean {
    return this.fadeProgress >= 1;
  }

  /** jump the finale to t seconds (screenshots of the bank / drive-off) */
  seekFinale(t: number): void {
    this.startFinale();
    this.pushT0 = performance.now() - t * 1000;
  }

  // ---------------------------------------------------------------- per frame

  render(renderer: THREE.WebGLRenderer): void {
    renderer.getSize(this.size);
    const W = this.size.x;
    const H = this.size.y;
    this.camera.left = 0;
    this.camera.right = W;
    this.camera.top = 0;
    this.camera.bottom = -H;
    this.camera.updateProjectionMatrix();
    const t = this.time;
    const d = this.def;
    if (this.fallback) {
      this.fallback.position.set(W / 2, -H / 2, 0);
      this.fallback.scale.set(W, H, 1);
    }
    // the ride is framed between the cut-scene's letterbox bars (9vh, src/styles/app.css .ai-bar)
    const lb = this.mode === 'title' ? 0 : Math.round(H * 0.09);
    if (d) this.layout(d, W, H - 2 * lb, t, lb);
    const prevTone = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
    renderer.toneMapping = prevTone;
  }

  private layout(d: ModeDef, W: number, H: number, t: number, top = 0): void {
    const mode = this.mode;
    const [pw, ph] = d.size;
    const viewA = W / H;
    const frX0 = (d.frame?.[0] ?? 0) * pw;
    const frW = (d.frame?.[1] ?? 1) * pw;
    const frA = frW / ph;
    const S = Math.max(W / frW, H / ph) * 1.05;
    const portrait = THREE.MathUtils.clamp((frA - viewA) / (frA - 0.46), 0, 1);
    // choreography
    const reveal = mode === 'title' ? 0 : ease(Math.min(1, t / REVEAL_SECONDS));
    const fin = this.finaleProgress;
    const fade = this.fadeProgress;
    const finaleE = easeInOut(fin);
    let phase: typeof this.pose.phase = 'drift';
    if (mode === 'title') phase = 'drift';
    else if (this.pushT0 !== null && fade > 0) phase = 'fade';
    else if (this.pushT0 !== null) phase = 'finale';
    else if (reveal < 1) phase = 'reveal';
    else phase = 'hold';
    // shared Lanyu vista is slightly tighter on the island; the choice pulls the camera back to 1
    const zTitle = TITLE_ZOOM;
    const zHold = 1;
    const zBack = mode === 'plane' ? 0.9 : 1.0; // plane keeps pulling back a little during the bank
    let Z = zTitle;
    if (mode !== 'title') {
      Z = THREE.MathUtils.lerp(zTitle, zHold, reveal);
      if (fin > 0) Z = THREE.MathUtils.lerp(Z, zBack, finaleE);
    }
    const foc = d.focus ?? d.target;
    const ix = foc[0] * pw;
    const iy = foc[1] * ph;
    // slow drift on the menu; a little leftover sway on the ride, fading as the finale starts
    const driftAmp = frW * 0.012;
    const panDrift = Math.sin(t * 0.07) * driftAmp + Math.sin(t * 0.031 + 1.2) * driftAmp * 0.35;
    const panYdrift = Math.sin(t * 0.055) * ph * 0.002; // stays well under 12 px
    const towardIsland = (ix - (frX0 + frW / 2));
    // plane bank: roll and shift the stack as if turning toward the island
    const bank = mode === 'plane' ? easeInOut(THREE.MathUtils.clamp((fin - 0.12) / 0.7, 0, 1)) : 0;
    const pan = panDrift * (mode === 'title' ? 1 : 1 - finaleE * 0.6) + bank * towardIsland * 0.55;
    const panY = panYdrift * (1 - finaleE * 0.7);
    let fx = THREE.MathUtils.lerp(frX0 + frW / 2, ix, 0.7 + portrait * 0.25);
    let fy = THREE.MathUtils.lerp(ph / 2, iy, 0.55 + portrait * 0.3);
    const halfW = W / (S * Z) / 2;
    fx = THREE.MathUtils.clamp(fx, Math.min(frX0 + halfW, pw / 2), Math.max(frX0 + frW - halfW, pw / 2));
    fx += bank * (ix - fx) * 0.35;
    const cx = W / 2;
    const cy = H / 2;
    const plane = mode === 'plane';
    const boat = mode === 'boat';
    let roll = 0;
    let pitch = 0;
    let bob = 0;
    if (plane) {
      roll = (Math.sin(t * 0.42) * 0.55 + Math.sin(t * 1.07 + 1) * 0.18) * (Math.PI / 180);
      bob = (Math.sin(t * 0.9) * 2.2 + Math.sin(t * 2.3) * 0.8) * (H / 720);
      roll += bank * (-14 * Math.PI / 180); // left-wing-down turn toward the island
    } else if (boat) {
      roll = (Math.sin(t * 0.52) * 1.1 + Math.sin(t * 0.21 + 2) * 0.5) * (Math.PI / 180);
      pitch = Math.sin(t * 0.83) * 0.55 + Math.sin(t * 1.37 + 0.6) * 0.25;
    }
    const hold = reveal; // motion eases in with the reveal
    roll *= hold;
    pitch *= hold;
    bob *= hold;
    const bgDy = (boat ? pitch * 13 : bob * 0.4) * (H / 1440);
    const bgRoll = -roll;
    const cosR = Math.cos(bgRoll);
    const sinR = Math.sin(bgRoll);
    const fadeMul = 1 - fade;
    const place = (mesh: THREE.Mesh, X: number, Y: number, w: number, h: number, rot: number) => {
      mesh.position.set(X, -(Y + top), 0);
      mesh.scale.set(w, h, 1);
      mesh.rotation.z = -rot;
    };
    this.pose.zoom = Z;
    this.pose.push = this.pushProgress;
    this.pose.reveal = reveal;
    this.pose.finale = fin;
    this.pose.fade = fade;
    this.pose.bank = bank;
    this.pose.phase = phase;
    this.pose.roll = roll;
    this.pose.pitch = pitch;
    const So = Math.min(S, (W / frW) * 1.9);
    let overlayRot = 0;
    let overlayDy = 0;
    let overlayScale = 1;
    let overlayOp = mode === 'title' ? 0 : reveal;
    if (plane) {
      overlayRot = roll * 0.9;
      overlayDy = bob;
    } else if (boat) {
      overlayRot = roll * 0.35;
      overlayDy = -pitch * H * 0.006;
      // drive-off: the bow (and spray) scale forward and slide away, leaving the open sea and the island
      if (fin > 0) {
        const drv = easeInOut(fin);
        overlayScale = 1 + drv * 2.4;
        overlayDy += drv * H * 0.72;
        overlayOp *= 1 - THREE.MathUtils.smoothstep(drv, 0.55, 0.95);
      }
    }
    this.pose.overlay = overlayOp;
    for (const L of this.layers) {
      const l = L.def;
      const u = L.mat.uniforms;
      if (u.time) u.time.value = t;
      if (u.seaSkew) u.seaSkew.value = -pan / pw;
      const rw = l.rect[2] * pw;
      const rh = l.rect[3] * ph;
      const pcx = (l.rect[0] + l.rect[2] / 2) * pw;
      const pcy = (l.rect[1] + l.rect[3] / 2) * ph;
      if (l.kind === 'overlay' || l.kind === 'spray') {
        const an = l.anchor ?? (l.kind === 'spray' ? (this.layers.find((x) => x.def.kind === 'overlay')?.def.anchor ?? [0.5, 1]) : [0.5, 1]);
        const sc = l.screen ?? an;
        const ax = frX0 + an[0] * frW;
        const ay = an[1] * ph;
        const fitX = cx + (ax - (frX0 + frW / 2)) * S;
        const fitY = cy + (ay - ph / 2) * S;
        const edgeX = an[0] <= 0.001 || an[0] >= 0.999;
        const edgeY = an[1] <= 0.001 || an[1] >= 0.999;
        const bottom = an[1] >= 0.999;
        const mid = Math.abs(an[0] - 0.5) < 0.05 && Math.abs(an[1] - 0.5) < 0.05; // window frame: fill the frame
        const scrX = mid ? cx : bottom ? fitX : edgeX ? sc[0] * W : THREE.MathUtils.lerp(fitX, sc[0] * W, portrait);
        const scrY = mid ? cy : edgeY ? sc[1] * H : THREE.MathUtils.lerp(fitY, sc[1] * H, portrait);
        const k = (mid ? Math.max(W / frW, H / ph) : bottom ? S : So) * overlayScale;
        const rx = (pcx - (mid ? frX0 + frW / 2 : ax)) * k;
        const ry = (pcy - (mid ? ph / 2 : ay)) * k;
        const c = Math.cos(overlayRot);
        const s2 = Math.sin(overlayRot);
        const X = scrX + rx * c - ry * s2;
        const Y = scrY + rx * s2 + ry * c + overlayDy;
        place(L.mesh, X, Y, rw * k, rh * k, overlayRot);
        if (u.opacity) u.opacity.value = overlayOp * fadeMul;
        if (l.kind === 'spray') u.amount.value = THREE.MathUtils.clamp(0.55 + Math.max(0, -pitch) * 0.6, 0, 1) * overlayOp;
        L.mesh.visible = (u.opacity ? u.opacity.value : overlayOp) > 0.003;
        // window frame sits in front of the wing
        if (l.role === 'frame' || /frame|window/.test(l.file)) L.mesh.renderOrder = 600;
        continue;
      }
      const par = l.parallax ?? THREE.MathUtils.clamp(14 / (l.depth ?? 100), 0, 1);
      if (u.seaPar0) u.seaPar0.value = par;
      const passing = l.kind === 'cloud' || l.kind === 'mist';
      const f = Z * (1 + par * 0.03 * (1 - Math.exp(-t / 18)));
      const dx = (l.drift ?? 0) * t * frW - pan * par;
      // near sea: a small swell bob (README: ±4–8 px), still within the 12 px cap for the far layers
      const swell = (l.kind === 'sea' && par >= 0.8) ? Math.sin(t * 0.9) * 6 : 0;
      const dy = -panY * par + swell;
      const lx = (pcx + dx - fx) * S * f;
      const ly = (pcy + dy - fy) * S * f;
      const X = cx + lx * cosR - ly * sinR;
      const Y = cy + lx * sinR + ly * cosR + bgDy;
      place(L.mesh, X, Y, rw * S * f, rh * S * f, bgRoll);
      // painted clouds / mist fade in as the camera pulls back (they are hidden on the menu vista)
      const cloudIn = passing ? 0.35 + 0.65 * reveal : 1;
      if (u.opacity) u.opacity.value = cloudIn * fadeMul;
      L.mesh.visible = (u.opacity?.value ?? 1) > 0.003 && !!u.map.value;
    }
    for (const c of this.cards) {
      const u = c.mat.uniforms;
      u.time.value = t;
      if (c.kind === 'burst') {
        // the new choreography no longer bursts out of a cloud; keep the cards hidden
        u.opacity.value = 0;
        c.mesh.visible = false;
        continue;
      }
      const ph2 = ((t / c.b + c.c) % 1 + 1) % 1;
      const w = W * 0.9;
      const X = W * 1.4 - ph2 * W * 1.8;
      const Y = c.a * H + Math.sin(t * 0.3 + c.c * 6) * H * 0.02;
      place(c.mesh, X, Y, w, w / c.aspect, bgRoll);
      const pass = Math.floor(t / c.b + c.c);
      const show = (Math.sin(pass * 12.9898 + c.a * 78.233) * 43758.5453) % 1;
      const on = Math.abs(show) > 0.55 ? 1 : 0;
      u.opacity.value = c.d * 0.7 * on * Math.sin(Math.PI * ph2) * reveal * fadeMul * (1 - finaleE * 0.5);
      c.mesh.visible = u.opacity.value > 0.003;
    }
    let densFront = 0;
    if (plane) densFront = 0.12 * reveal * (1 - finaleE * 0.5);
    this.mist.forEach((m, i) => {
      m.uniforms.time.value = t;
      m.uniforms.aspect.value = viewA;
      const far = i === 0;
      m.uniforms.density.value = (far ? (boat ? 0.32 : 0.1) * reveal : densFront) * fadeMul;
      const mesh = this.mistMeshes[i];
      place(mesh, W / 2, H / 2, W, H, 0);
      mesh.visible = m.uniforms.density.value > 0.004;
    });
    this.pose.mist = densFront;
  }

  /** seconds into the current shot */
  get time(): number {
    return (performance.now() - this.t0) / 1000;
  }

  /** jump the shot to t seconds (tests / screenshots) */
  seek(t: number): void {
    this.t0 = performance.now() - t * 1000;
  }

  resize(_aspect: number): void {
    /* the layout reads the renderer size every frame */
  }

  /** free everything: materials, the shared quad, every texture (GPU and CPU side) */
  dispose(): void {
    this.building++;
    this.clearShot();
    this.quad.dispose();
    for (const t of this.tex.values()) t.dispose();
    this.tex.clear();
    this.pending.clear();
    this.def = null;
    this.scene.clear();
  }
}
