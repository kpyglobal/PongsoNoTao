/**
 * 0.1.5 arrival intro, 2.5D (v2 art): hand-painted layers composited in screen space with parallax.
 * A separate, tiny three.js scene (orthographic camera in screen pixels, one shared quad), not the game island.
 *
 * Choreography (Larry, 15 Nov):
 * - Title / party / 搭飛機／搭船 menus: only Lanyu, from the same angle for both routes (plane set, v1 island).
 * - Plane: pull back to the cabin window and wing, gentle bob while the island loads (clouds drift, mist breathes).
 *   After loading: out through the window (frame and wing go back past the camera), the island turns to the closer
 *   v2 angle, then the plane itself flies out from behind the camera on an arc (rear → bank → descend), props
 *   spinning, wingtip trails on; fade to the notebook.
 * - Yacht: pull back to the bow, gentle wave pitch while loading. After loading: cut to the yacht seen from behind
 *   (hull rocking on its own pivot over the wake and spray); it drives toward the island and shrinks to the centre
 *   left while the island cross-fades to the closer v2 angle and grows; fade to the notebook.
 * - Phones: the window frame and the bow are never cropped (they are fitted, the cabin wall fills around the
 *   window); the world covers the screen around a safe centre; vehicles are scaled to the visible width.
 *
 * Art: public/assets/intro25d/ (scripts/art/build-intro25d-v2.py from art-ref/arrival/layers25d{,-v2}/).
 * Every image is placed in the painter's pixels: world plates are 3072×1440 with 256 px overscan (frame x = plate
 * x − 256), camera-locked layers 2560×1440, sprites on their own canvas. Colours pass straight through.
 */
import * as THREE from 'three';
import { assetUrl } from '../core/paths';

export type IntroMode = 'title' | 'plane' | 'boat';
type SetName = 'plane' | 'yacht';

interface ImageDef {
  file: string;
  canvas: [number, number];
  rect: [number, number, number, number];
  px: [number, number];
  wrap?: boolean;
}
interface Manifest {
  version?: number;
  plane?: { images: Record<string, ImageDef> };
  yacht?: { images: Record<string, ImageDef> };
}

const BASE = 'assets/intro25d/';
/** painter's frame */
const FW = 2560;
const FH = 1440;
const OVERSCAN = 256;
/** zoom of the shared Lanyu vista behind the menus (pulled back to 1 to reveal the vehicle) */
const TITLE_ZOOM = 1.22;
/** seconds to pull back and reveal the window / bow after the choice */
export const REVEAL_SECONDS = 2.2;
/** seconds of the plane / yacht finale after the logo fades (before the fade) */
export const FINALE_SECONDS_PLANE = 10.5;
export const FINALE_SECONDS_BOAT = 9.0;
/** @deprecated the longer of the two finales */
export const FINALE_SECONDS = FINALE_SECONDS_PLANE;
/** fade to the notebook at the end of the finale */
export const FADE_SECONDS = 0.9;
/** @deprecated tests that still read pushProgress */
export const PUSH_SECONDS = FINALE_SECONDS + FADE_SECONDS;
/** yacht: cross-dissolve from the shared menu vista into the yacht's own sea-level view */
const BOAT_DISSOLVE = 0.9;
/** colours */
const CABIN_WALL = new THREE.Vector4(0.8, 0.76, 0.69, 1);
const FADE_COL = new THREE.Color('#e9d9bf');

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** one painted image; uvX maps the quad to texture uv (offset, scale); outside 0..1 → fill (camera-locked layers) */
const FS = /* glsl */ `
uniform sampler2D map;
uniform float opacity;
uniform vec4 uvX;
uniform vec4 fill;
uniform float useFill;
varying vec2 vUv;
void main() {
  vec2 uv = uvX.xy + vUv * uvX.zw;
  if (useFill > 0.5 && (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)) {
    // the cabin wall: a soft shade away from the window
    vec2 o = max(vec2(0.0), max(-uv, uv - 1.0));
    float shade = 1.0 - 0.16 * smoothstep(0.0, 0.9, length(o * vec2(1.0, 1.6)));
    gl_FragColor = vec4(fill.rgb * shade, fill.a * opacity);
    return;
  }
  vec4 c = texture2D(map, uv);
  gl_FragColor = vec4(c.rgb, c.a * opacity);
}`;

const FS_SOLID = /* glsl */ `
uniform vec3 color;
uniform float opacity;
void main() { gl_FragColor = vec4(color, opacity); }`;

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const ease = (x: number): number => smooth(0, 1, x);
const easeInOut = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const TAU = Math.PI * 2;

interface Quad {
  mesh: THREE.Mesh;
  u: Record<string, THREE.IUniform>;
  img: ImageDef | null;
}

/** what the world camera is doing this frame */
interface View {
  /** screen centre of the content area */
  sx: number;
  sy: number;
  /** base frame → screen scale */
  S: number;
  /** zoom of the nearest layer (parallax 1) */
  Z: number;
  /** frame point at the screen centre */
  cx: number;
  cy: number;
  /** camera pan (frame px); layers move by −pan × parallax */
  panX: number;
  panY: number;
  roll: number;
  /** vehicles: extra fit factor on narrow screens */
  vf: number;
}

export class IntroScene {
  readonly scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
  private quad = new THREE.PlaneGeometry(1, 1);
  private man: Manifest = {};
  private tex = new Map<string, THREE.Texture>();
  private pending = new Map<string, Promise<THREE.Texture | null>>();
  private quads = new Map<string, Quad>();
  private fadeQuad: Quad | null = null;
  private loaded: Record<SetName, boolean> = { plane: false, yacht: false };
  private t0 = performance.now();
  private finT0: number | null = null;
  private size = new THREE.Vector2(1, 1);
  private building = 0;
  /** what the finale runs (the mode it was started in) */
  mode: IntroMode = 'title';
  /** what the shot is doing (tests) */
  readonly pose = {
    mode: 'title' as IntroMode,
    phase: 'drift' as 'drift' | 'reveal' | 'hold' | 'finale' | 'fade',
    zoom: 1, push: 0, reveal: 0, finale: 0, fade: 0, bank: 0, overlay: 0,
    mist: 0, layers: 0, roll: 0, pitch: 0, source: '',
    /** 0 = v1 island angle, 1 = the closer v2 angle */
    island: 0,
    /** plane / yacht chase sprite on screen (px): centre, width, alpha; pose name */
    vehicle: { x: 0, y: 0, w: 0, a: 0, pose: '' },
    /** window frame / bow deck rect on screen (px) and the screen content area (no-crop checks) */
    overlayRect: { x: 0, y: 0, w: 0, h: 0 },
    area: { x: 0, y: 0, w: 0, h: 0 },
    /** prop frame index (spinning) and trail alpha */
    prop: 0, trails: 0, wake: 0, spray: 0, hullRock: 0,
    /** wave tile weights (a, b, c) and cloud drift (px) */
    waves: [0, 0, 0] as number[], cloudDrift: 0,
  };

  constructor(_aspect: number) {
    this.scene.background = new THREE.Color('#bcd2df');
  }

  private url(f: string): string {
    return assetUrl(BASE + f);
  }

  private loadTex(path: string, wrap: boolean): Promise<THREE.Texture | null> {
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
          if (wrap) t.wrapS = THREE.RepeatWrapping;
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

  private images(set: SetName): Record<string, ImageDef> {
    return this.man[set]?.images ?? {};
  }

  /** load a whole set (plane: also the title vista) and make its quads */
  private async loadSet(set: SetName, only?: string[]): Promise<void> {
    const im = this.images(set);
    const ids = only ?? Object.keys(im);
    await Promise.all(ids.filter((k) => im[k]).map((k) => this.loadTex(im[k].file, !!im[k].wrap)));
    for (const k of ids) if (im[k]) this.makeQuad(`${set}:${k}`, im[k]);
    if (!only) this.loaded[set] = true;
    this.pose.layers = this.quads.size;
  }

  private makeQuad(key: string, img: ImageDef): void {
    if (this.quads.has(key)) return;
    const t = this.tex.get(img.file) ?? null;
    if (!t) return;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      uniforms: {
        map: { value: t },
        opacity: { value: 1 },
        uvX: { value: new THREE.Vector4(0, 0, 1, 1) },
        fill: { value: new THREE.Vector4(0, 0, 0, 0) },
        useFill: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.quad, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.scene.add(mesh);
    this.quads.set(key, { mesh, u: mat.uniforms, img });
  }

  /** manifest + the title vista (plane sky / sea / v1 island); everything else loads in the background */
  async load(): Promise<void> {
    try {
      const r = await fetch(this.url('intro25d.json'));
      if (r.ok) this.man = (await r.json()) as Manifest;
    } catch {
      /* no manifest: a plain dawn backdrop */
    }
    const mat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS_SOLID,
      uniforms: { color: { value: FADE_COL.clone() }, opacity: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const fm = new THREE.Mesh(this.quad, mat);
    fm.frustumCulled = false;
    fm.renderOrder = 10000;
    this.scene.add(fm);
    this.fadeQuad = { mesh: fm, u: mat.uniforms, img: null };
    this.pose.source = this.man.version === 2 ? 'v2' : 'none';
    await this.loadSet('plane', ['sky', 'sea', 'lanyu1']);
    void this.loadSet('plane').then(() => this.loadSet('yacht'));
  }

  /** start a shot: 'title' (backdrop of the start screens), 'plane' or 'boat' (the ride in) */
  setMode(mode: IntroMode): void {
    const id = ++this.building;
    this.mode = mode;
    this.pose.mode = mode;
    this.finT0 = null;
    this.t0 = performance.now();
    const set: SetName = mode === 'boat' ? 'yacht' : 'plane';
    if (mode !== 'title' && !this.loaded[set]) {
      // still loading: hold the menu vista, start the shot's clock when its layers are in
      void (set === 'yacht' ? this.loadSet('plane').then(() => this.loadSet('yacht')) : this.loadSet('plane')).then(() => {
        if (id === this.building) this.t0 = performance.now();
      });
    }
  }

  /** the logo has faded: the plane flies in / the yacht drives off, then fade */
  startFinale(): void {
    if (this.frozen) return;
    if (this.finT0 === null) this.finT0 = performance.now();
  }
  /** @deprecated same as startFinale (older tests) */
  startPush(): void {
    this.startFinale();
  }

  get pushing(): boolean {
    return this.finT0 !== null;
  }

  private get finSeconds(): number {
    return this.mode === 'boat' ? FINALE_SECONDS_BOAT : FINALE_SECONDS_PLANE;
  }

  private get finT(): number {
    if (this.frozen) return this.frozen.f ?? 0;
    return this.finT0 === null ? 0 : (performance.now() - this.finT0) / 1000;
  }

  /** tests / recordings: hold the shot at t seconds (and the finale at f seconds, or none); null = run live */
  private frozen: { t: number; f: number | null } | null = null;
  freeze(t: number | null, f: number | null = null): void {
    if (t === null) {
      if (this.frozen) {
        this.t0 = performance.now() - this.frozen.t * 1000;
        if (this.frozen.f !== null) this.finT0 = performance.now() - this.frozen.f * 1000;
      }
      this.frozen = null;
      return;
    }
    this.frozen = { t, f };
    this.finT0 = f === null ? null : performance.now() - f * 1000;
  }

  /** 0..1 through the finale (not including the fade) */
  get finaleProgress(): number {
    return this.finT0 === null ? 0 : Math.min(1, this.finT / this.finSeconds);
  }

  /** 0..1 through the fade that follows the finale */
  get fadeProgress(): number {
    if (this.finT0 === null) return 0;
    const t = this.finT - this.finSeconds;
    return t <= 0 ? 0 : Math.min(1, t / FADE_SECONDS);
  }

  /** 0..1 through finale + fade */
  get pushProgress(): number {
    if (this.finT0 === null) return 0;
    return Math.min(1, this.finT / (this.finSeconds + FADE_SECONDS));
  }

  /** the painted shot has faded out and the notebook can open */
  get finished(): boolean {
    return this.fadeProgress >= 1;
  }

  /** jump the finale to t seconds (screenshots) */
  seekFinale(t: number): void {
    if (this.frozen) {
      this.freeze(this.frozen.t, t);
      return;
    }
    this.startFinale();
    this.finT0 = performance.now() - t * 1000;
  }

  /** seconds into the current shot */
  get time(): number {
    if (this.frozen) return this.frozen.t;
    return (performance.now() - this.t0) / 1000;
  }

  /** jump the shot to t seconds (tests / screenshots) */
  seek(t: number): void {
    if (this.frozen) this.frozen.t = t;
    this.t0 = performance.now() - t * 1000;
  }

  resize(_aspect: number): void {
    /* the layout reads the renderer size every frame */
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
    for (const q of this.quads.values()) q.mesh.visible = false;
    // the ride is framed between the cut-scene's letterbox bars (9vh, src/styles/app.css .ai-bar)
    const lb = this.mode === 'title' ? 0 : Math.round(H * 0.09);
    const area = { x: 0, y: lb, w: W, h: H - 2 * lb };
    this.pose.area = area;
    this.order = 0;
    const t = this.time;
    const boatReady = this.loaded.yacht;
    const planeReady = this.loaded.plane;
    let fadeA = 0;
    if (this.mode === 'boat' && boatReady) {
      fadeA = this.drawBoat(area, t);
      // the shared menu vista dissolves into the yacht's sea-level view
      const d = 1 - smooth(0, BOAT_DISSOLVE, t);
      if (d > 0.002) this.drawTitle(area, t, d, 1);
    } else if (this.mode === 'plane' && planeReady) {
      fadeA = this.drawPlane(area, t);
    } else {
      this.drawTitle(area, t, 1, this.mode === 'title' ? 0 : 0);
      this.pose.phase = 'drift';
    }
    if (this.fadeQuad) {
      this.fadeQuad.u.opacity.value = fadeA;
      this.fadeQuad.mesh.visible = fadeA > 0.002;
      this.put(this.fadeQuad, W / 2, H / 2, W, H, 0);
    }
    const prevTone = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
    renderer.toneMapping = prevTone;
  }

  private order = 0;

  /** place a quad: centre (screen px, y down), size, rotation (radians, clockwise on screen) */
  private put(q: Quad, x: number, y: number, w: number, h: number, rot: number): void {
    q.mesh.position.set(x, -y, 0);
    q.mesh.scale.set(w, h, 1);
    q.mesh.rotation.z = -rot;
  }

  private q(set: SetName, id: string): Quad | null {
    return this.quads.get(`${set}:${id}`) ?? null;
  }

  /** draw one world image (frame coords from its canvas: plates are offset by the overscan) */
  private world(v: View, set: SetName, id: string, par: number, o: { alpha?: number; dx?: number; dy?: number; zoom?: number; about?: [number, number]; drift?: number; parX?: number } = {}): void {
    const q = this.q(set, id);
    if (!q || !q.img) return;
    const a = o.alpha ?? 1;
    if (a <= 0.002) return;
    const img = q.img;
    const plate = img.canvas[0] === FW + 2 * OVERSCAN;
    const ox = plate ? -OVERSCAN : 0;
    let [rx, ry, rw, rh] = img.rect;
    rx += ox + (o.dx ?? 0);
    ry += o.dy ?? 0;
    // optional extra zoom about a frame point (island push-ins)
    if (o.zoom && o.zoom !== 1) {
      const [ax, ay] = o.about ?? [FW / 2, FH / 2];
      rx = ax + (rx - ax) * o.zoom;
      ry = ay + (ry - ay) * o.zoom;
      rw *= o.zoom;
      rh *= o.zoom;
    }
    const zl = 1 + (v.Z - 1) * (0.4 + 0.6 * par);
    const s = v.S * zl;
    const px = o.parX ?? par;
    const mx = rx + rw / 2 - v.cx - v.panX * px;
    const my = ry + rh / 2 - v.cy - v.panY * par;
    const c = Math.cos(v.roll);
    const sn = Math.sin(v.roll);
    const X = v.sx + (mx * c - my * sn) * s;
    const Y = v.sy + (mx * sn + my * c) * s;
    q.u.opacity.value = a;
    q.u.useFill.value = 0;
    if (img.wrap) {
      // seamless loop tile: slide the texture inside its band (wrap at the painted 3072 px)
      const shift = (o.drift ?? 0) / img.canvas[0];
      q.u.uvX.value.set(-shift, 0, 1, 1);
    } else q.u.uvX.value.set(0, 0, 1, 1);
    q.mesh.renderOrder = this.order++;
    q.mesh.visible = true;
    this.put(q, X, Y, rw * s, rh * s, v.roll);
  }

  /** camera-locked layer: fitted so its safe rect is fully on screen; returns the frame's screen rect */
  private locked(area: { x: number; y: number; w: number; h: number }, set: SetName, id: string, o: { alpha: number; scale: number; dx?: number; dy?: number; fit: 'contain' | 'width'; anchor: 'center' | 'bottom'; fill?: THREE.Vector4 | null; aboutY?: number }): { x: number; y: number; w: number; h: number } | null {
    const q = this.q(set, id);
    if (!q || !q.img || o.alpha <= 0.002) return null;
    const img = q.img;
    const base = o.fit === 'contain' ? Math.min(area.w / FW, area.h / FH) : area.w / FW;
    const s = base * o.scale;
    // frame rect on screen
    const fw = FW * s;
    const fh = FH * s;
    const cx = area.x + area.w / 2 + (o.dx ?? 0) * base;
    let top = o.anchor === 'bottom' ? area.y + area.h - FH * base : area.y + (area.h - FH * base) / 2;
    // scale about a frame row (the bow scales about its bottom, the window about its centre)
    const ay = o.aboutY ?? FH / 2;
    top = top + ay * base - ay * s + (o.dy ?? 0) * base;
    const left = cx - fw / 2;
    const [rx, ry, rw, rh] = img.rect;
    q.u.opacity.value = o.alpha;
    q.mesh.renderOrder = this.order++;
    q.mesh.visible = true;
    if (o.fill) {
      // full-screen quad: the window's rim continues as the cabin wall all round
      q.u.useFill.value = 1;
      q.u.fill.value.copy(o.fill);
      const sx0 = (area.x - (left + rx * s)) / (rw * s);
      const sy0 = (area.y - (top + ry * s)) / (rh * s);
      const sw = area.w / (rw * s);
      const sh = area.h / (rh * s);
      // uv y is up in three; flip
      q.u.uvX.value.set(sx0, 1 - (sy0 + sh), sw, sh);
      this.put(q, area.x + area.w / 2, area.y + area.h / 2, area.w, area.h, 0);
    } else {
      q.u.useFill.value = 0;
      q.u.uvX.value.set(0, 0, 1, 1);
      this.put(q, left + (rx + rw / 2) * s, top + (ry + rh / 2) * s, rw * s, rh * s, 0);
    }
    return { x: left, y: top, w: fw, h: fh };
  }

  /** a sprite on its own canvas: `at` = where canvas point `pivot` lands (frame coords), scale = frame px per canvas px */
  private sprite(v: View, set: SetName, id: string, at: [number, number], pivot: [number, number], scale: number, o: { alpha: number; rot?: number; sy?: number }): { x: number; y: number; w: number; h: number } | null {
    const q = this.q(set, id);
    if (!q || !q.img || o.alpha <= 0.002) return null;
    const img = q.img;
    const [rx, ry, rw, rh] = img.rect;
    // vehicles are framed by the camera centre (no parallax), scaled to fit narrow screens
    const s = v.S * v.Z * scale * v.vf;
    const mx = (at[0] - v.cx) * v.S * v.Z * v.vf;
    const my = (at[1] - v.cy) * v.S * v.Z * Math.max(v.vf, 0.6);
    const c = Math.cos(v.roll);
    const sn = Math.sin(v.roll);
    const PX = v.sx + mx * c - my * sn;
    const PY = v.sy + mx * sn + my * c;
    const rot = v.roll + (o.rot ?? 0);
    const sy = o.sy ?? 1;
    // rect centre relative to the pivot, rotated
    const dx = (rx + rw / 2 - pivot[0]) * s;
    const dy = (ry + rh / 2 - pivot[1]) * s * sy;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    q.u.opacity.value = o.alpha;
    q.u.useFill.value = 0;
    q.u.uvX.value.set(0, 0, 1, 1);
    q.mesh.renderOrder = this.order++;
    q.mesh.visible = true;
    this.put(q, PX + dx * cr - dy * sr, PY + dx * sr + dy * cr, rw * s, rh * s * sy, rot);
    return { x: PX, y: PY, w: img.canvas[0] * s, h: img.canvas[1] * s };
  }

  /** base view for the content area: cover the area (with margin for bob / roll) around a safe centre */
  private view(area: { x: number; y: number; w: number; h: number }, focus: [number, number], Z: number, S?: number): View {
    const cover = Math.max(area.w / FW, area.h / FH) * 1.04;
    const s = S ?? cover;
    const aspect = area.w / area.h;
    // narrow screens lean toward the shot's safe centre; 16:9 and wider keep the painter's framing
    const narrow = clamp01((FW / FH - aspect) / (FW / FH - 0.46));
    let cx = lerp(FW / 2, focus[0], narrow);
    const hw = area.w / (2 * s * Z);
    cx = Math.min(FW + OVERSCAN - hw, Math.max(-OVERSCAN + hw, cx));
    const hh = area.h / (2 * s * Z);
    // keep a margin above / below for the bob and roll (the plates are exactly 1440 tall)
    const m = Math.min(40, Math.max(0, FH / 2 - hh));
    const cy = Math.min(FH - hh - m, Math.max(hh + m, lerp(FH / 2, focus[1], narrow * 0.5)));
    const visW = area.w / (s * Z);
    return { sx: area.x + area.w / 2, sy: area.y + area.h / 2, S: s, Z, cx, cy, panX: 0, panY: 0, roll: 0, vf: Math.min(1, (visW / FW) * 1.25) };
  }

  /** the shared Lanyu vista behind the menus (plane set, v1 island); `alpha` for the dissolve into the yacht */
  private drawTitle(area: { x: number; y: number; w: number; h: number }, t: number, alpha: number, _r: number): void {
    const v = this.view(area, [1080, 600], TITLE_ZOOM);
    v.panX = Math.sin(t * 0.05) * 30;
    v.panY = Math.sin(t * 0.07) * 6;
    this.world(v, 'plane', 'sky', 0, { alpha });
    this.world(v, 'plane', 'sea', 0.3, { alpha, parX: 0.3 });
    this.world(v, 'plane', 'lanyu1', 0.35, { alpha });
    this.pose.zoom = TITLE_ZOOM;
  }

  // ---------------------------------------------------------------- plane

  private drawPlane(area: { x: number; y: number; w: number; h: number }, t: number): number {
    const P: SetName = 'plane';
    const f = this.finT;
    const fin = this.finT0 !== null;
    const R = ease(t / REVEAL_SECONDS);
    // out through the window
    const ew = fin ? easeInOut(f / 2.4) : 0;
    // island angle change v1 → v2 (with the v1 layers panning +133 px)
    const k = fin ? easeInOut((f - 1.2) / 4.6) : 0;
    const fade = fin ? clamp01((f - FINALE_SECONDS_PLANE) / FADE_SECONDS) : 0;
    const cover = Math.max(area.w / FW, area.h / FH) * 1.04;
    const contain = Math.min(area.w / FW, area.h / FH);
    // seen through the window the world is framed by the window; out of it, the world covers the screen
    const inside = R * (1 - ew);
    const S = lerp(cover, contain * 1.02, inside);
    const Z = lerp(TITLE_ZOOM, 1, R) * (1 + 0.06 * k);
    const v = this.view(area, [lerp(1080, 1300, k), 600], Z, S);
    // seen through the window the painter's framing is kept exactly (the frame hides the plate edges)
    v.cx = lerp(v.cx, FW / 2, inside);
    v.cy = lerp(v.cy, FH / 2, inside);
    // gentle bob / roll while loading; calmer once outside
    const calm = 1 - ew * 0.7;
    v.panY = Math.sin((t * TAU) / 4.2) * 6 * R * calm;
    v.panX = Math.sin(t * 0.05) * 30 * (1 - R) + Math.sin((t * TAU) / 9) * 4 * R;
    v.roll = Math.sin((t * TAU) / 6.5) * 0.004 * R * calm;
    const pan133 = 133 * k;
    const dPx = (rate: number): number => -rate * (t + f);
    // 00 sky → 01 sea → 20 far clouds → 03 island (v1 / v2) → 04 mist → 21 mid clouds → plane → 22 near clouds
    this.world(v, P, 'sky', 0, { dx: pan133 });
    this.world(v, P, 'sea', 0.3, { dx: pan133, parX: 0.3 });
    const cloudsIn = R;
    const farW = 0.5 + 0.5 * Math.sin((t * TAU) / 50);
    this.world(v, P, 'cfar_a', 0.25, { alpha: cloudsIn * (1 - farW * 0.6), dx: pan133, drift: dPx(3) });
    this.world(v, P, 'cfar_b', 0.25, { alpha: cloudsIn * (0.4 + farW * 0.6), dx: pan133, drift: dPx(3) + 900 });
    this.world(v, P, 'lanyu1', 0.35, { alpha: 1 - k, dx: pan133 - 40 * k, zoom: 1 + 0.03 * k, about: [1280, 456] });
    this.world(v, P, 'lanyu2', 0.35, { alpha: k, dx: 60 * (1 - k), zoom: 0.97 + 0.03 * k, about: [1280, 456] });
    this.world(v, P, 'mist', 0.45, { alpha: (0.85 + 0.15 * Math.sin((t * TAU) / 8)) * (1 - k * 0.6), dx: pan133 - (t + f) * 4 * 0.2 });
    this.world(v, P, 'cmid_a', 0.65, { alpha: cloudsIn, dx: pan133, drift: dPx(8) });
    // the plane: from behind the camera, forward on an arc (rear → bank → descend), shrinking toward the coast
    let veh = { x: 0, y: 0, w: 0, a: 0, pose: '' };
    let bank = 0;
    const fly = fin ? clamp01((f - 3.0) / 7.5) : 0;
    if (fin && f >= 3.0) {
      const u = fly;
      const pe = 1 - Math.pow(1 - u, 1.6); // fast out of the camera, easing on the approach
      // path (frame px of the body centre) and scale (frame px per canvas px)
      const keys = [
        { u: 0, x: 1420, y: 1950, s: 1.25 },
        { u: 0.3, x: 1290, y: 880, s: 0.52 },
        { u: 0.62, x: 1150, y: 760, s: 0.32 },
        { u: 1, x: 1400, y: 880, s: 0.15 },
      ];
      let i = 0;
      while (i < keys.length - 2 && pe > keys[i + 1].u) i++;
      const a = keys[i];
      const b = keys[i + 1];
      const lt = easeInOut((pe - a.u) / (b.u - a.u));
      const x = lerp(a.x, b.x, lt);
      const y = lerp(a.y, b.y, lt);
      const s = a.s * Math.pow(b.s / a.s, lt);
      const wRear = 1 - smooth(0.42, 0.47, pe);
      const wDesc = smooth(0.76, 0.81, pe);
      const wBank = 1 - wRear - wDesc;
      bank = wBank;
      const appear = smooth(0, 0.06, u) * (1 - smooth(0.92, 1, u) * 0.35);
      const bob = Math.sin((t * TAU) / 3.6) * 5;
      const roll = Math.sin((t * TAU) / 4.4) * 0.016;
      const frame = Math.floor((t + f) * 24) % 3;
      const trail = 0.8 + 0.2 * Math.abs(Math.sin((t + f) * TAU * 4.2));
      const poses: [string, number, [number, number], [number, number], [number, number]][] = [
        // pose, weight, body bbox centre (canvas), hub L, hub R
        ['rear', wRear, [2365, 632], [1875.7, 603.7], [2860.8, 603.2]],
        ['bank', wBank, [2160, 626], [1637.0, 602.3], [2618.2, 418.8]],
        ['descend', wDesc, [1736, 611], [1321.5, 202.2], [2162.2, 201.6]],
      ];
      for (const [pose, wgt, ctr] of poses) {
        const al = wgt * appear;
        if (al <= 0.002) continue;
        const at: [number, number] = [x, y + bob];
        this.sprite(v, P, `${pose}_trails`, at, ctr, s, { alpha: al * trail, rot: roll });
        for (const side of ['L', 'R']) {
          this.sprite(v, P, `${pose}_prop_${side}_disc`, at, ctr, s, { alpha: al * 0.6, rot: roll });
          this.sprite(v, P, `${pose}_prop_${side}_${'abc'[(frame + (side === 'R' ? 1 : 0)) % 3]}`, at, ctr, s, { alpha: al * 0.9, rot: roll });
        }
        const r = this.sprite(v, P, pose, at, ctr, s, { alpha: al, rot: roll });
        if (r && wgt >= 0.34) {
          const q = this.q(P, pose)!;
          veh = { x: r.x, y: r.y, w: q.img!.rect[2] * s * v.S * v.Z * v.vf, a: al, pose };
        }
      }
      this.pose.prop = frame;
      this.pose.trails = trail * appear;
    } else {
      this.pose.prop = Math.floor(t * 24) % 3;
      this.pose.trails = 0;
    }
    this.world(v, P, 'cnear_a', 1.0, { alpha: cloudsIn * (1 - 0.3 * fly), dx: pan133, drift: dPx(16) });
    // cabin: wing beyond the window, then the window frame with the cabin wall around it
    const ov = R * (1 - smooth(0.35, 1, ew));
    const wingA = R * (1 - smooth(0.2, 0.85, ew));
    const sway = Math.sin((t * TAU) / 3.1) * 1.5;
    this.locked(area, P, 'wing', { alpha: wingA, scale: lerp(1.6, 1, R) * (1 + 1.4 * ew), dx: 700 * ew, dy: sway - 500 * ew, fit: 'contain', anchor: 'center' });
    const frameScale = lerp(1.7, 1, R) * (1 + 2.2 * ew);
    const fr = this.locked(area, P, 'frame', { alpha: ov, scale: frameScale, fit: 'contain', anchor: 'center', fill: CABIN_WALL });
    this.pose.overlayRect = fr ?? { x: 0, y: 0, w: 0, h: 0 };
    this.pose.overlay = ov;
    this.pose.reveal = R;
    this.pose.island = k;
    this.pose.bank = bank;
    this.pose.vehicle = veh;
    this.pose.zoom = Z;
    this.pose.roll = v.roll;
    this.pose.pitch = v.panY / 10;
    this.pose.cloudDrift = dPx(16);
    this.setPhase(t, fin, f, FINALE_SECONDS_PLANE);
    return fade;
  }

  // ---------------------------------------------------------------- yacht

  private drawBoat(area: { x: number; y: number; w: number; h: number }, t: number): number {
    const Y: SetName = 'yacht';
    const f = this.finT;
    const fin = this.finT0 !== null;
    const R = ease(t / REVEAL_SECONDS);
    // cut from the bow to the chase view
    const cut = fin ? smooth(0, 1.0, f) : 0;
    // island v1 → v2
    const k = fin ? easeInOut((f - 1.0) / 6.5) : 0;
    const fade = fin ? clamp01((f - FINALE_SECONDS_BOAT) / FADE_SECONDS) : 0;
    const Z = lerp(TITLE_ZOOM, 1, R) * (1 + 0.04 * k);
    const v = this.view(area, [lerp(1650, 1150, k), 640], Z);
    // the bow pitches with the swell (the world moves, the deck stays); outside, the camera rides calmer
    const calm = 1 - 0.7 * cut;
    v.panY = Math.sin((t * TAU) / 5) * 10 * R * calm;
    v.roll = Math.sin((t * TAU) / 6.3) * 0.02 * R * calm;
    v.panX = Math.sin((t * TAU) / 11) * 6 * R;
    const tt = t + f;
    // waves: phase cross-fade a → b → c (2.5 s per step), small sway and bob; near band offset ⅓ period
    const wv = (ph: number): number[] => {
      const x = (((ph % 3) + 3) % 3);
      const w = [0, 0, 0];
      const i = Math.floor(x);
      const fr = smooth(0, 1, x - i);
      w[i] = 1 - fr;
      w[(i + 1) % 3] = fr;
      return w;
    };
    const wm = wv(tt / 2.5);
    const wn = wv(tt / 2.5 + 1);
    const swayM = Math.sin((tt * TAU) / 9) * 20;
    const swayN = Math.sin((tt * TAU) / 9 + 1.3) * 20;
    const bobM = Math.sin((tt * TAU) / 5) * 4.5;
    const bobN = Math.sin((tt * TAU) / 5 + 2.1) * 11;
    const cw = 0.5 + 0.5 * Math.sin((tt * TAU) / 50);
    // 00 sky → 20 clouds → 01 island → 02 far sea → 05 mist → 21 mid waves → 22 near waves → yacht (10, 11, 12)
    this.world(v, Y, 'sky', 0);
    this.world(v, Y, 'clouds_a', 0.02, { alpha: 1 - cw * 0.6, drift: -2 * tt });
    this.world(v, Y, 'clouds_b', 0.02, { alpha: 0.4 + cw * 0.6, drift: -2 * tt + 1100 });
    this.world(v, Y, 'lanyu1', 0.03, { alpha: 1 - k, dx: -50 * k, zoom: 1 + 0.08 * k, about: [1280, 675] });
    this.world(v, Y, 'lanyu2', 0.03, { alpha: k, dx: 60 * (1 - k), zoom: 0.96 + 0.08 * k, about: [1280, 675] });
    this.world(v, Y, 'sea_far', 0.1);
    this.world(v, Y, 'mist', 0.1, { alpha: 0.9 + 0.1 * Math.sin((tt * TAU) / 8), dx: Math.sin(tt * 0.1) * 12 });
    // the first phase layer is drawn solid (the band is opaque), the next one cross-fades over it
    const drawWaves = (pre: string, w: number[], par: number, sway: number, bob: number): void => {
      const base = w.indexOf(Math.max(...w));
      const next = (base + 1) % 3;
      const prev = (base + 2) % 3;
      const over = w[next] > w[prev] ? next : prev;
      this.world(v, Y, `${pre}_${'abc'[base]}`, par, { dx: sway, dy: bob });
      this.world(v, Y, `${pre}_${'abc'[over]}`, par, { alpha: w[over] / Math.max(0.001, w[over] + w[base]), dx: sway, dy: bob });
    };
    drawWaves('wmid', wm, 0.4, swayM, bobM);
    drawWaves('wnear', wn, 1.0, swayN, bobN);
    this.pose.waves = wm;
    // the yacht from behind: drives toward the island, shrinking to the centre left
    let veh = { x: 0, y: 0, w: 0, a: 0, pose: '' };
    if (fin) {
      const u = clamp01((f - 0.5) / (FINALE_SECONDS_BOAT - 0.5));
      // accelerate away, then ease into the distance
      const pe = easeInOut(u);
      const s = 0.8 * Math.pow(0.13 / 0.8, pe);
      const x = lerp(1280, 940, smooth(0, 1, pe));
      const py = 675 + 30 + (1010 - 705) * ((s - 0.13) / (0.8 - 0.13)); // pivot sits on the sea, rising to the horizon
      const accel = smooth(0, 0.25, u);
      const shrink = 1 - smooth(0.45, 1, u);
      const water = (0.35 + 0.65 * accel) * (0.6 + 0.4 * shrink);
      const sprayK = (0.35 + 0.65 * accel) * shrink;
      const bobPh = (tt * TAU) / 3.5;
      const bob = Math.sin(bobPh + Math.PI) * 9 * (s / 0.8);
      const rock = Math.sin((tt * TAU) / 3.4) * 0.03;
      const crest = 0.5 + 0.5 * Math.sin(bobPh + Math.PI);
      const appear = cut;
      const pivot: [number, number] = [1959, 1432];
      const at: [number, number] = [x + (1959 - 1897) * s, py];
      // hull (rocks on its own pivot), wake over it (follows, no rock), spray last
      const r = this.sprite(v, Y, 'hull', [at[0], at[1] + bob], pivot, s, { alpha: appear, rot: rock });
      this.sprite(v, Y, 'wake', at, pivot, s, { alpha: appear * water * (0.85 + 0.15 * Math.sin(tt * 5.1)), sy: 1 + 0.015 * Math.sin(tt * 2.3) });
      this.sprite(v, Y, 'spray', at, pivot, s, { alpha: appear * sprayK * (0.6 + 0.4 * crest) });
      if (r) {
        const q = this.q(Y, 'hull')!;
        veh = { x: r.x, y: r.y, w: q.img!.rect[2] * s * v.S * v.Z * v.vf, a: appear, pose: 'rear' };
      }
      this.pose.wake = appear * water;
      this.pose.spray = appear * sprayK * (0.6 + 0.4 * crest);
      this.pose.hullRock = rock;
    } else {
      this.pose.wake = 0;
      this.pose.spray = 0;
    }
    // the bow deck (camera-locked, fitted to the width so it is never cropped) and its spray
    const ov = R * (1 - cut);
    const drop = (1 - R) * 420 + cut * 380;
    const sprayW = 0.5 + 0.5 * Math.sin(tt * TAU * 0.9);
    this.locked(area, Y, 'bspray_a', { alpha: ov * (0.55 + 0.45 * (1 - sprayW)), scale: lerp(1.4, 1, R), dy: drop, fit: 'width', anchor: 'bottom', aboutY: FH });
    this.locked(area, Y, 'bspray_b', { alpha: ov * 0.8 * sprayW, scale: lerp(1.4, 1, R), dy: drop, fit: 'width', anchor: 'bottom', aboutY: FH });
    const br = this.locked(area, Y, 'bow', { alpha: ov, scale: lerp(1.4, 1, R), dy: drop, fit: 'width', anchor: 'bottom', aboutY: FH });
    if (br) {
      const img = this.q(Y, 'bow')!.img!;
      const s = br.w / FW;
      this.pose.overlayRect = { x: br.x + img.rect[0] * s, y: br.y + img.rect[1] * s, w: img.rect[2] * s, h: img.rect[3] * s };
    } else this.pose.overlayRect = { x: 0, y: 0, w: 0, h: 0 };
    this.pose.overlay = ov;
    this.pose.reveal = R;
    this.pose.island = k;
    this.pose.bank = 0;
    this.pose.vehicle = veh;
    this.pose.zoom = Z;
    this.pose.roll = v.roll;
    this.pose.pitch = v.panY / 10;
    this.pose.cloudDrift = -2 * tt;
    this.setPhase(t, fin, f, FINALE_SECONDS_BOAT);
    return fade;
  }

  private setPhase(t: number, fin: boolean, f: number, total: number): void {
    const p = this.pose;
    p.finale = fin ? Math.min(1, f / total) : 0;
    p.fade = fin ? clamp01((f - total) / FADE_SECONDS) : 0;
    p.push = fin ? Math.min(1, f / (total + FADE_SECONDS)) : 0;
    p.phase = fin ? (f >= total ? 'fade' : 'finale') : t < REVEAL_SECONDS ? 'reveal' : 'hold';
    p.mist = 0;
  }

  /** free everything: materials, the shared quad, every texture (GPU and CPU side) */
  dispose(): void {
    this.building++;
    for (const q of [...this.quads.values(), ...(this.fadeQuad ? [this.fadeQuad] : [])]) {
      q.mesh.removeFromParent();
      (q.mesh.material as THREE.Material).dispose();
    }
    this.quads.clear();
    this.fadeQuad = null;
    this.quad.dispose();
    for (const t of this.tex.values()) t.dispose();
    this.tex.clear();
    this.pending.clear();
    this.scene.clear();
  }
}
