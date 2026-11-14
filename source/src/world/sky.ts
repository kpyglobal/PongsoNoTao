import * as THREE from 'three';
import { PRESETS, seasonTint, type Period, type Season, type LightPreset } from '../core/timeSeason';
import { preferredShadowMapSize } from '../core/device';

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
    gl_Position.z = gl_Position.w; // keep at far plane
  }
`;

const skyFrag = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  uniform float uCloud;
  uniform float uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);
  }
  float fbm(vec2 p) { float v=0.0,a=0.5; for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=0.5;} return v; }
  void main() {
    vec3 dir = normalize(vDir);
    float h = max(dir.y, -0.2);
    vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.75, h), 0.7));
    vec3 sd = normalize(uSunDir);
    float sun = max(dot(dir, sd), 0.0);
    // warm sunrise / sunset band hugging the horizon, stronger toward the sun
    float band = exp(-abs(h) * 9.0) * (0.35 + 0.65 * pow(sun, 3.0));
    col = mix(col, uGlow, clamp(band, 0.0, 1.0) * 0.85);
    // sun / moon disc + halo
    float disc = smoothstep(0.9985 - uNight * 0.0015, 0.9993 - uNight * 0.0012, sun);
    col += uSunColor * disc * (uNight > 0.5 ? 1.1 : 3.0);
    col += uSunColor * pow(sun, 64.0) * 0.55 + uSunColor * pow(sun, 8.0) * 0.12;
    // painterly cumulus band (HD-2D backdrop)
    vec2 cp = dir.xz / max(dir.y + 0.12, 0.05) * 0.9 + vec2(uTime * 0.004, 0.0);
    float cl = fbm(cp * 1.4);
    cl = smoothstep(0.52 - uCloud * 0.12, 0.82, cl) * smoothstep(-0.02, 0.12, h) * (1.0 - smoothstep(0.35, 0.8, h));
    vec3 cloudLit = mix(vec3(1.0), uSunColor, 0.35) * (1.0 - uNight * 0.82);
    vec3 cloudShadow = mix(uHorizon, uZenith, 0.4) * 0.92;
    vec3 cloudCol = mix(cloudShadow, cloudLit, 0.55 + 0.45 * pow(sun, 2.0));
    col = mix(col, cloudCol, cl * 0.82);
    // stars
    if (uNight > 0.3) {
      vec2 sp = dir.xz / (dir.y + 1.0) * 260.0;
      float n = hash(floor(sp));
      float tw = 0.6 + 0.4 * sin(uTime * 2.0 + n * 40.0);
      float star = step(0.9965, n) * smoothstep(0.08, 0.5, h) * uNight * tw;
      col += vec3(star * 0.9);
      // faint Milky Way
      float mw = exp(-pow(dot(dir, normalize(vec3(0.4, 0.5, -0.75))) * 3.2, 2.0)) * fbm(sp * 0.02) * uNight;
      col += vec3(0.16, 0.18, 0.26) * mw * smoothstep(0.05, 0.4, h);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class SkyLighting {
  group = new THREE.Group();
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  fill: THREE.AmbientLight;
  sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private period: Period = 'day';
  private shadowSpan = 40;
  private shadowTexels = 2048;
  private readonly snapRight = new THREE.Vector3();
  private readonly snapUp = new THREE.Vector3();
  private readonly snapC = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.hemi = new THREE.HemisphereLight(0xd7eefc, 0x4d6a3e, 0.9);
    this.sun = new THREE.DirectionalLight(0xfff3d0, 2.6);
    this.sun.castShadow = true;
    const shadowSize = preferredShadowMapSize();
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.shadowTexels = shadowSize;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 3;
    this.setShadowSpan(40);
    // cool counter-light that gives sprites & roofs an HD-2D rim
    this.rim = new THREE.DirectionalLight(0x9fc4ff, 0.35);
    this.fill = new THREE.AmbientLight(0xfff6e8, 0.2);

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color('#5da6dc') },
        uHorizon: { value: new THREE.Color('#d9eef8') },
        uGlow: { value: new THREE.Color('#fff3dc') },
        uSunDir: { value: new THREE.Vector3(0.3, 0.9, 0.2) },
        uSunColor: { value: new THREE.Color('#fff3d0') },
        uNight: { value: 0 },
        uCloud: { value: 0.5 },
        uTime: { value: 0 },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.sky.name = 'sky';

    this.group.add(this.hemi, this.sun, this.sun.target, this.rim, this.rim.target, this.fill, this.sky);
    scene.add(this.group);
    scene.fog = new THREE.Fog(0xcfe6ef, 90, 320);
  }

  setShadowSpan(span: number): void {
    // whole-unit steps: a continuously changing frustum would also make shadow edges crawl while zooming
    const s = Math.round(Math.max(18, Math.min(90, span)));
    if (Math.abs(s - this.shadowSpan) < 0.5) return;
    this.shadowSpan = s;
    const cam = this.sun.shadow.camera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.updateProjectionMatrix();
  }

  apply(period: Period, season: Season, scene: THREE.Scene): void {
    this.period = period;
    const p: LightPreset = PRESETS[period];
    const tint = seasonTint(season, period);
    this.sun.color.copy(p.sunColor);
    this.sun.intensity = p.sunIntensity;
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    this.fill.intensity = p.ambientExtra + tint.warm * 0.15;
    this.fill.color.set(period === 'night' ? '#8aa0d0' : '#ffe8c8');
    this.rim.intensity = period === 'night' ? 0.25 : period === 'dusk' ? 0.5 : 0.35;
    this.rim.color.set(period === 'dusk' ? '#8fa0ff' : period === 'night' ? '#6f86c8' : '#a8cbff');

    const fog = p.fog.clone();
    if (season === 'manoyotoyon') fog.lerp(new THREE.Color('#f0c090'), 0.12);
    if (season === 'off') fog.lerp(new THREE.Color('#b8c4cc'), 0.25);
    if (scene.fog && scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(fog);
      scene.fog.near = p.fogNear;
      scene.fog.far = p.fogFar;
    }
    scene.background = fog;

    const u = this.skyMat.uniforms;
    (u.uZenith.value as THREE.Color).copy(p.zenith);
    (u.uHorizon.value as THREE.Color).copy(p.horizon);
    (u.uGlow.value as THREE.Color).copy(p.glow);
    (u.uSunDir.value as THREE.Vector3).copy(p.sunDir);
    (u.uSunColor.value as THREE.Color).copy(p.sunColor);
    u.uNight.value = period === 'night' ? 1 : 0;
    u.uCloud.value = season === 'off' ? 1.0 : season === 'rayon' ? 0.35 : 0.55;
    if (season === 'off') (u.uZenith.value as THREE.Color).lerp(new THREE.Color('#7f95a8'), 0.35);
  }

  get preset(): LightPreset {
    return PRESETS[this.period];
  }

  update(t: number): void {
    this.skyMat.uniforms.uTime.value = t;
  }

  follow(x: number, y: number, z: number): void {
    // Stable shadows: move the shadow camera only in whole shadow-map texels (in light space), so
    // shadow edges stay put instead of shimmering while the focus glides along.
    const d0 = this.preset.sunDir;
    const c = this.snapC.set(x, y, z);
    // same basis three.js builds for the shadow camera (lookAt with up = +Y): z = sunDir, x = up × z, y = z × x
    const right = this.snapRight.set(d0.z, 0, -d0.x);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    const up = this.snapUp.crossVectors(d0, right).normalize();
    const texel = (2 * this.shadowSpan) / this.shadowTexels;
    const cr = c.dot(right);
    const cu = c.dot(up);
    c.addScaledVector(right, Math.round(cr / texel) * texel - cr).addScaledVector(up, Math.round(cu / texel) * texel - cu);
    this.sun.position.copy(c).addScaledVector(d0, 120);
    this.sun.target.position.copy(c);
    this.sun.target.updateMatrixWorld();
    const d = this.preset.sunDir;
    this.rim.position.set(x - d.x * 60, y + 40, z - d.z * 60);
    this.rim.target.position.set(x, y, z);
    this.rim.target.updateMatrixWorld();
    this.sky.position.set(x, 0, z);
  }
}
