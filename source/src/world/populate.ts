import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Assets } from '../core/assets';
import { getHeight, PIT_DEPTH, ALL_STRUCTURES } from './height';
import {
  VILLAGE_DEFS,
  TARO_FIELDS,
  FACILITIES,
  LANDMARKS,
  vlocal,
  villageYaw,
  villageExtent,
  type VillageDef,
} from './layout';
import {
  ArchBuilder,
  addVahey,
  addMakarang,
  addTagakal,
  addModern,
  addShop,
  addChurch,
  addClinic,
  addAirport,
  addHarbor,
  addLighthouse,
  addLanternPost,
  addFishRack,
  makeTatala,
  tetrapodGeometry,
  archMaterials,
  setNightGlow,
} from './buildings';
import { rng } from './textures';
import { GlowBatch, type GlowSpec } from './glows';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeProp } from '../entities/billboard';
import type { Period, Season } from '../core/timeSeason';

export interface PlaceRec {
  id: string;
  zh: string;
  tao: string;
  x: number;
  z: number;
  kind: string;
  flavor?: string;
}

interface Lantern extends GlowSpec {
  base: number;
  phase: number;
  kind: 'lantern' | 'hearth' | 'torch' | 'beacon';
  /** torches only burn at night in the fishing seasons (set in applyTime) */
  enabled: boolean;
}

interface Boat {
  g: THREE.Group;
  floating: boolean;
  baseY: number;
  seasons: Season[] | null;
  nightOnly?: boolean;
}

export class WorldDecor {
  group = new THREE.Group();
  fish: ReturnType<typeof makeProp>[] = [];
  fishBase: { x: number; z: number; phase: number }[] = [];
  boats: Boat[] = [];
  labels: CSS2DObject[] = [];
  private labelPos: THREE.Vector3[] = [];
  lanterns: Lantern[] = [];
  /** every glow above, drawn as one instanced batch (built once all lanterns are placed) */
  private glows!: GlowBatch;
  private glowsShown = 0;
  lights: THREE.PointLight[] = [];
  seasonal: { obj: THREE.Object3D; seasons: Season[] }[] = [];
  interactables: { id: string; kind: string; x: number; z: number; r: number; label: string }[] = [];
  private beam?: THREE.Mesh;
  private night = 0;

  constructor(
    private assets: Assets,
    places: Record<string, PlaceRec>,
  ) {
    const b = new ArchBuilder();
    this.buildVillages(b);
    this.buildFacilities(b);
    this.group.add(b.build());
    const racks = new ArchBuilder();
    this.buildRacks(racks);
    const rackGroup = racks.build();
    this.group.add(rackGroup);
    this.seasonal.push({ obj: rackGroup, seasons: ['rayon', 'manoyotoyon'] });
    this.buildBoats();
    this.glows = new GlowBatch(this.lanterns);
    this.group.add(this.glows.mesh);
    this.buildTetrapods();
    this.buildFish(places);
    this.buildLabels(places);
    this.buildInteractables(places);
  }

  // ------------------------------------------------------------------ villages
  private buildVillages(b: ArchBuilder): void {
    let vi = 0;
    for (const s of ALL_STRUCTURES) {
      b.bucket(nearestVillage(s.x, s.z));
      const g = getHeight(s.x, s.z);
      switch (s.kind) {
        case 'vahey': {
          b.frame(s.x, g, s.z, s.yaw);
          addVahey(b, PIT_DEPTH, s.hw, s.hd, vi++);
          // hearth glow light source at the doorway
          this.addLantern(s.x + Math.sin(s.yaw) * 0.3, g + 0.4, s.z + Math.cos(s.yaw) * 0.3, 'hearth', 0.9);
          break;
        }
        case 'makarang':
          b.frame(s.x, g - 0.05, s.z, s.yaw);
          addMakarang(b);
          break;
        case 'tagakal':
          b.frame(s.x, Math.max(0.1, g) - 0.05, s.z, s.yaw);
          addTagakal(b, vi % 3 === 0);
          break;
        case 'modern':
          b.frame(s.x, g - 0.05, s.z, s.yaw);
          addModern(b, vi++);
          break;
        case 'shop':
          b.frame(s.x, g - 0.05, s.z, s.yaw);
          addShop(b);
          break;
        case 'church':
          b.frame(s.x, g - 0.05, s.z, s.yaw);
          addChurch(b);
          break;
      }
    }
    // lantern posts around each plaza + one warm point light per village
    for (const v of VILLAGE_DEFS) {
      b.bucket(v.id);
      const ext = villageExtent(v);
      const spots: [number, number][] = [[-ext.hu + 2.5, 0.6], [ext.hu - 2.5, 0.6], [0, 1.6], [-3.5, -0.7], [3.5, -0.7], [-1.2, 4.4], [2.4, 4.4]];
      for (const [u, w] of spots) {
        const p = vlocal(v, u, w);
        const gh = Math.max(0.15, getHeight(p.x, p.z));
        b.frame(p.x, gh, p.z, villageYaw(v) + u * 0.1);
        const lampY = addLanternPost(b);
        const off = new THREE.Vector3(0.36, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), villageYaw(v) + u * 0.1);
        this.addLantern(p.x + off.x, gh + lampY, p.z + off.z, 'lantern', 1);
      }
      const c = vlocal(v, 0, -0.5);
      const light = new THREE.PointLight(0xffa851, 0, 13, 1.6);
      light.position.set(c.x, getHeight(c.x, c.z) + 2.4, c.z);
      this.lights.push(light);
      this.group.add(light);
    }
  }

  private buildRacks(b: ArchBuilder): void {
    for (const v of VILLAGE_DEFS) {
      b.bucket(v.id);
      for (const u of [-5.5, 6.2]) {
        const p = vlocal(v, u, 1.2);
        b.frame(p.x, getHeight(p.x, p.z) - 0.03, p.z, villageYaw(v));
        addFishRack(b);
      }
    }
  }

  // ---------------------------------------------------------------- facilities
  private buildFacilities(b: ArchBuilder): void {
    const cl = FACILITIES.clinic;
    b.bucket('clinic');
    b.frame(cl.x, getHeight(cl.x, cl.z) - 0.05, cl.z, cl.yaw);
    addClinic(b);
    this.addLantern(cl.x + Math.sin(cl.yaw) * 2.8, getHeight(cl.x, cl.z) + 1.6, cl.z + Math.cos(cl.yaw) * 2.8, 'lantern', 1.2);
    const clLight = new THREE.PointLight(0xffe2b0, 0, 10, 1.6);
    clLight.position.set(cl.x + Math.sin(cl.yaw) * 3, getHeight(cl.x, cl.z) + 2.5, cl.z + Math.cos(cl.yaw) * 3);
    this.lights.push(clLight);
    this.group.add(clLight);

    const t = FACILITIES.terminal;
    b.bucket('airport');
    b.frame(t.x, getHeight(t.x, t.z) - 0.05, t.z, t.yaw);
    addAirport(b);
    this.addLantern(t.x - 1.7, getHeight(t.x, t.z) + 1.7, t.z, 'lantern', 1);

    const h = FACILITIES.harbor;
    b.bucket('harbor');
    b.frame(h.x + 1.5, 0.25, h.z, 0);
    addHarbor(b);
    this.addLantern(h.x + 1.5 - 15.4, 3.3, h.z - 7.2, 'beacon', 1.8);
    this.addLantern(h.x + 1.5 - 11.0, 2.1, h.z - 0.6, 'beacon', 1.3);
    for (const dz of [-3, 0, 3]) {
      b.frame(h.x + 3.2, 0.7, h.z + dz, Math.PI / 2);
      const ly = addLanternPost(b, 1.9);
      this.addLantern(h.x + 3.2, 0.7 + ly, h.z + dz - 0.36, 'lantern', 1);
    }
    const hl = new THREE.PointLight(0xffb060, 0, 14, 1.6);
    hl.position.set(h.x - 2, 3, h.z);
    this.lights.push(hl);
    this.group.add(hl);

    // 小蘭嶼燈塔 on Jimagaod + rotating beam
    const jl = FACILITIES.jimagaodLight;
    const jh = getHeight(jl.x, jl.z);
    b.bucket('jimagaod');
    b.frame(jl.x, jh - 0.1, jl.z, 0);
    addLighthouse(b, 3.0);
    this.addLantern(jl.x, jh + 3.25, jl.z, 'beacon', 2.2);
    const beamGeo = new THREE.ConeGeometry(1.6, 14, 16, 1, true);
    beamGeo.translate(0, -7, 0);
    beamGeo.rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true }));
    beam.position.set(jl.x, jh + 3.25, jl.z);
    this.beam = beam;
    this.group.add(beam);
  }

  private addLantern(x: number, y: number, z: number, kind: Lantern['kind'], base: number): void {
    const color = kind === 'beacon' ? 0xfff0c8 : kind === 'hearth' ? 0xff8a3a : 0xffb35c;
    const size = kind === 'beacon' ? 2.4 : kind === 'hearth' ? 1.5 : kind === 'torch' ? 1.6 : 1.15;
    this.lanterns.push({ x, y, z, size, color, base, phase: Math.random() * 6.28, kind, enabled: true });
  }

  // --------------------------------------------------------------------- boats
  private shorePoint(v: VillageDef, u: number): { x: number; z: number; h: number } | null {
    for (let w = 2; w < 26; w += 0.25) {
      const p = vlocal(v, u, w);
      const h = getHeight(p.x, p.z);
      if (h < 0.42) {
        const q = vlocal(v, u, w - 0.9);
        return { x: q.x, z: q.z, h: Math.max(0.1, getHeight(q.x, q.z)) };
      }
    }
    return null;
  }

  private buildBoats(): void {
    // beached boats never move: bake them into a few merged meshes (per village, per material);
    // floating ones keep their own group so they can bob, but with their parts merged per material
    const beached: THREE.Group[] = [];
    const festival: THREE.Group[] = [];
    let seed = 1;
    const r = rng(77);
    for (const v of VILLAGE_DEFS) {
      const yawSea = Math.atan2(-v.fz, v.fx); // local +X of the hull points to the sea
      const n = v.id === 'iranmeylek' || v.id === 'iraraley' || v.id === 'imorod' ? 5 : 3;
      for (let k = 0; k < n; k++) {
        const u = (k - (n - 1) / 2) * 1.25;
        const sp = this.shorePoint(v, u);
        if (!sp) continue;
        const g = makeTatala(2.5 + (k % 2) * 0.5, seed++);
        g.position.set(sp.x, sp.h + 0.02, sp.z);
        g.rotation.y = yawSea + (r() - 0.5) * 0.15;
        beached.push(g);
      }
      // festival line-up: more boats on the beach during 招魚祭
      for (let k = 0; k < 3; k++) {
        const sp = this.shorePoint(v, 5 + k * 1.3);
        if (!sp) continue;
        const g = makeTatala(3.2, seed++);
        g.position.set(sp.x, sp.h + 0.02, sp.z);
        g.rotation.y = yawSea;
        festival.push(g);
      }
    }
    // moored in 開元港
    const h = FACILITIES.harbor;
    for (const [dx, dz, yaw] of [[-6, 1.2, 0.1], [-8, 1.4, -0.1], [-5.5, -2.4, 0.2]] as [number, number, number][]) {
      const g = mergeBoatGroups([makeTatala(2.6, seed++)], false);
      g.position.set(h.x + dx, 0.0, h.z + dz);
      g.rotation.y = yaw;
      this.group.add(g);
      this.boats.push({ g, floating: true, baseY: -0.02, seasons: null });
    }
    // flying-fish season: night torch-fishing boats offshore (with torch glow)
    for (const [x, z] of [[-45, -10], [-48, -4], [37, -24], [40, -18], [36, 18]] as [number, number][]) {
      const g = mergeBoatGroups([makeTatala(2.8, seed++)], false);
      g.position.set(x, -0.02, z);
      g.rotation.y = r() * Math.PI;
      this.group.add(g);
      this.boats.push({ g, floating: true, baseY: -0.02, seasons: ['rayon', 'meyvanwa'] });
      // torch glow: only lit at dusk / night in the fishing seasons (see applyTime)
      this.addLantern(x, 1.2, z, 'torch', 1.6);
    }
    const still = mergeBoatGroups(beached, true);
    still.name = 'tatala-beached';
    this.group.add(still);
    const fest = mergeBoatGroups(festival, true);
    fest.name = 'tatala-festival';
    this.group.add(fest);
    this.seasonal.push({ obj: fest, seasons: ['meyvanwa'] });
  }

  private buildTetrapods(): void {
    const h = FACILITIES.harbor;
    const geo = tetrapodGeometry();
    const im = new THREE.InstancedMesh(geo, archMaterials().concrete, 40);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const r = rng(5);
    for (let i = 0; i < 40; i++) {
      const a = -0.25 - (i / 40) * 1.35;
      const rad = 7.6 + r() * 0.8;
      const x = h.x + 1.5 - 9 + Math.cos(a) * -rad;
      const z = h.z - 4.2 + Math.sin(a) * rad;
      q.setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6));
      m.compose(new THREE.Vector3(x, -0.2 + r() * 0.4, z), q, new THREE.Vector3(1.1, 1.1, 1.1));
      im.setMatrixAt(i, m);
    }
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    this.group.add(im);
  }

  private buildFish(places: Record<string, PlaceRec>): void {
    const centers = [places.fishzone_west, places.fishzone_east].filter(Boolean);
    for (const c of centers) {
      for (let i = 0; i < 9; i++) {
        const spr = makeProp(this.assets, 'props/flying_fish_sheet.png', 0.3, 4, 1);
        const x = c.x + (i % 4) * 1.8 - 2.2 + Math.sin(i) * 0.8;
        const z = c.z + Math.floor(i / 4) * 2.2 - 1.2 + Math.cos(i * 1.3) * 1.0;
        spr.mesh.position.set(x, 0.35, z);
        this.group.add(spr.mesh);
        this.fish.push(spr);
        this.fishBase.push({ x, z, phase: i * 0.8 });
      }
    }
  }

  private buildLabels(places: Record<string, PlaceRec>): void {
    const want = ['yayo', 'iraraley', 'iranmeylek', 'ivalino', 'imorod', 'iratay', 'harbor', 'clinic', 'airport', 'jimagaod'];
    for (const id of want) {
      const p = places[id];
      if (!p) continue;
      const el = document.createElement('div');
      el.className = `world-label ${p.kind === 'tribe' ? 'is-tribe' : 'is-facility'}`;
      const zh = document.createElement('span');
      zh.className = 'zh';
      zh.textContent = p.zh;
      el.append(zh);
      if (p.tao) {
        const small = document.createElement('small');
        small.textContent = p.tao;
        el.append(small);
      }
      const obj = new CSS2DObject(el);
      const y = Math.max(0, getHeight(p.x, p.z)) + (id === 'jimagaod' ? 6.5 : p.kind === 'tribe' ? 4.2 : 4.6);
      obj.position.set(p.x, y, p.z);
      this.group.add(obj);
      this.labels.push(obj);
    }
    for (const l of LANDMARKS) {
      const el = document.createElement('div');
      el.className = 'world-label is-landmark';
      const zh = document.createElement('span');
      zh.className = 'zh';
      zh.textContent = l.zh;
      el.append(zh);
      const obj = new CSS2DObject(el);
      obj.position.set(l.x, Math.max(0, getHeight(l.x, l.z)) + l.lift, l.z);
      this.group.add(obj);
      this.labels.push(obj);
    }
  }

  private buildInteractables(places: Record<string, PlaceRec>): void {
    for (const v of VILLAGE_DEFS) {
      const p = places[v.id];
      this.interactables.push({ id: `tribe-${v.id}`, kind: 'place', x: v.cx, z: v.cz, r: 3.2, label: p ? `${p.zh} ${p.tao}` : v.id });
    }
    const cl = FACILITIES.clinic;
    this.interactables.push({
      id: 'clinic',
      kind: 'clinic',
      x: cl.x + Math.sin(cl.yaw) * 2.6,
      z: cl.z + Math.cos(cl.yaw) * 2.6,
      r: 3.4,
      label: '蘭嶼衛生所',
    });
    for (const f of TARO_FIELDS) {
      const p = places[f.id];
      // stand at the lower (seaward) edge of the terraces
      const u = (f.tiers * f.cellU) / 2 + 0.9;
      this.interactables.push({
        id: `taro-${f.id}`,
        kind: 'taro',
        x: f.cx + f.fx * u,
        z: f.cz + f.fz * u,
        r: 3.8,
        label: p?.zh || '水芋田 soli',
      });
    }
    const h = FACILITIES.harbor;
    this.interactables.push({ id: 'harbor-fish', kind: 'fish', x: h.x - 1, z: h.z, r: 4.2, label: '飛魚海域／拼板舟 tatala' });
    const im = VILLAGE_DEFS.find((v) => v.id === 'imorod')!;
    const look = vlocal(im, -2, 3.6);
    this.interactables.push({ id: 'look-jimagaod', kind: 'look', x: look.x, z: look.z, r: 4.5, label: '眺望小蘭嶼 Jimagaod' });
  }

  // -------------------------------------------------------------- atmosphere
  applyTime(period: Period, season: Season): void {
    const night = period === 'night' ? 1 : period === 'dusk' ? 0.62 : period === 'dawn' ? 0.35 : 0;
    this.night = night;
    setNightGlow(night);
    for (const l of this.lights) {
      l.intensity = night * (period === 'night' ? 26 : 16);
      // a 0-intensity light still costs a loop iteration in every lit fragment, so drop it by day
      l.visible = night > 0;
    }
    for (const s of this.seasonal) {
      s.obj.visible = s.seasons.includes(season);
    }
    for (const b of this.boats) {
      if (!b.seasons) continue;
      b.g.visible = b.seasons.includes(season);
    }
    if (this.beam) (this.beam.material as THREE.MeshBasicMaterial).opacity = period === 'night' ? 0.16 : period === 'dusk' ? 0.06 : 0;
    // torches (sea) only burn after dark
    for (const l of this.lanterns) {
      if (l.kind === 'torch') {
        const on = (period === 'night' || period === 'dusk') && (season === 'rayon' || season === 'meyvanwa');
        l.enabled = on;
      }
    }
  }

  update(dt: number, camera: THREE.Camera, time: number, showFish: boolean): void {
    this.fish.forEach((f, i) => {
      f.mesh.visible = showFish;
      if (!showFish) return;
      const b = this.fishBase[i];
      const leap = Math.max(0, Math.sin(time * 1.6 + b.phase));
      f.mesh.position.set(b.x + Math.sin(time * 0.3 + b.phase) * 1.2, 0.25 + leap * 0.9, b.z + Math.cos(time * 0.25 + b.phase) * 1.0);
      f.setFrame(Math.floor(time * 8 + i) % 4, 0);
      f.updateBillboard(camera, dt, false);
    });
    for (const b of this.boats) {
      if (!b.floating) continue;
      b.g.position.y = b.baseY + Math.sin(time * 1.3 + b.g.position.x) * 0.04;
      b.g.rotation.z = Math.sin(time * 0.9 + b.g.position.z) * 0.035;
      b.g.rotation.x = Math.sin(time * 0.7 + b.g.position.x) * 0.02;
    }
    const lanterns = this.lanterns;
    // one buffer write per frame; the batch is not drawn at all while every glow is off (daytime)
    this.glowsShown = this.glows.setAlphas((i) => {
      const l = lanterns[i];
      if (!l.enabled) return 0;
      const flick = l.kind === 'beacon' ? 1 : 0.88 + Math.sin(time * 7 + l.phase) * 0.06 + Math.sin(time * 13.7 + l.phase * 2) * 0.04;
      const k = l.kind === 'beacon' ? Math.max(this.night, 0.15) : this.night;
      return Math.min(1, k * l.base * flick * (l.kind === 'hearth' ? 0.75 : 0.95));
    });
    if (this.beam) this.beam.rotation.y = time * 0.6;
    // declutter: when the camera is close, only nearby place names stay on screen
    const maxD = 26 + camera.position.y * 2.4;
    if (this.labelPos.length !== this.labels.length) {
      // labels never move: read their world positions once
      this.labelPos = this.labels.map((o) => o.getWorldPosition(new THREE.Vector3()));
    }
    for (let i = 0; i < this.labels.length; i++) {
      this.labels[i].visible = this.labelPos[i].distanceTo(camera.position) < maxD;
    }
  }

  /** Force point lights on/off (boot pre-warms both shader variants so the first dusk is not a compile stall). */
  setLightsVisible(on: boolean): void {
    for (const l of this.lights) l.visible = on;
  }

  /** visible point lights + glow sprites (debug / verify) */
  lightsVisibleCount(): { lights: number; sprites: number; totalLights: number; totalSprites: number } {
    return {
      lights: this.lights.filter((l) => l.visible).length,
      sprites: this.glowsShown,
      totalLights: this.lights.length,
      totalSprites: this.lanterns.length,
    };
  }
}

/** Closest village id to a world point (which merge bucket a structure belongs to). */
function nearestVillage(x: number, z: number): string {
  let best = VILLAGE_DEFS[0].id;
  let bd = Infinity;
  for (const v of VILLAGE_DEFS) {
    const d = (v.cx - x) ** 2 + (v.cz - z) ** 2;
    if (d < bd) {
      bd = d;
      best = v.id;
    }
  }
  return best;
}

/**
 * Bake boat groups into one mesh per material (and per shadow flags).
 * `world = true`: the groups' own transforms are baked in and the result is grouped per village-sized cell
 * so culling still works; `world = false`: a single boat is merged in its local frame (it keeps bobbing).
 */
function mergeBoatGroups(groups: THREE.Group[], world: boolean): THREE.Group {
  const out = new THREE.Group();
  const buckets = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; geos: THREE.BufferGeometry[] }>();
  const m = new THREE.Matrix4();
  for (const g of groups) {
    g.updateMatrixWorld(true);
    const inv = world ? null : new THREE.Matrix4().copy(g.matrixWorld).invert();
    const cell = world ? `${Math.round(g.position.x / 24)},${Math.round(g.position.z / 24)}` : '';
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      m.copy(mesh.matrixWorld);
      if (inv) m.premultiply(inv);
      let geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      geo.applyMatrix4(m);
      // a mirrored part (the stern blade, scale.x = -1) was drawn with flipped front faces; keep that winding
      if (m.determinant() < 0) geo = flipWinding(geo);
      const mat = mesh.material as THREE.Material;
      const key = `${cell}|${mat.uuid}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}`;
      let b = buckets.get(key);
      if (!b) {
        b = { mat, cast: mesh.castShadow, recv: mesh.receiveShadow, geos: [] };
        buckets.set(key, b);
      }
      b.geos.push(geo);
    });
  }
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    out.add(mesh);
  }
  out.name = 'tatala';
  return out;
}

function flipWinding(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.getAttribute(name) as THREE.BufferAttribute;
    const n = a.itemSize;
    const arr = a.array as Float32Array;
    for (let t = 0; t + 2 < a.count; t += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (t + 1) * n + k;
        const i2 = (t + 2) * n + k;
        const tmp = arr[i1];
        arr[i1] = arr[i2];
        arr[i2] = tmp;
      }
    }
    a.needsUpdate = true;
  }
  return geo;
}
