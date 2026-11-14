import * as THREE from 'three';
import type { Assets } from '../core/assets';
import { BlobShadow, CHAR_WORLD_H, makeNpcCharacter, type SpriteBillboard } from './billboard';
import type { NpcSheetRef } from '../core/assets';
import {
  canStand,
  findSafeStand,
  slideMove,
  NPC_RADIUS,
} from '../world/collision';
import type { Period, Season } from '../core/timeSeason';

import type { NpcDef } from '../content/types';
export type { NpcDef } from '../content/types';

/** walk sheet used when an NPC's own art is not there yet (new data-only NPCs: content/npcs/*.json) */
export function fallbackSheetOf(def: NpcDef): string {
  return def.fallbackSheet ?? (def.outsider ? 'tourist' : 'uncle');
}

/** what talking to the NPC does when no quest step runs: special action, dialogue id, or '' (ambient, no prompt) */
export function interactOf(def: NpcDef): string {
  if (def.talkable === false) return '';
  return def.action ?? def.dialogue ?? 'chat';
}

/**
 * NPC streaming radii (m), around a point a little ahead of the camera target (the camera looks one way, so the
 * visible ground lies mostly in front): load inside LOAD = BASE + PER_ZOOM × camera distance (default zoom ≈ 28 m,
 * max zoom ≈ 46 m), unload beyond LOAD + HYST (hysteresis, so walking along a village edge never thrashes).
 */
export const NPC_LOAD_BASE = 12;
export const NPC_LOAD_PER_ZOOM = 0.75;
export const NPC_HYST = 12;
/** how far ahead of the target the streaming centre sits, × camera distance */
export const NPC_LOAD_AHEAD = 0.4;

export class NpcActor {
  def: NpcDef;
  /** null while streamed out (far from the player): the actor keeps walking its route, nothing is on the GPU */
  sprite: SpriteBillboard | null = null;
  shadow: BlobShadow | null = null;
  /** streaming: wanted = inside the load radius; loading = sheet request in flight */
  wanted = false;
  private loading = false;
  /** texture path under assets/sprites (the village atlas); switches to the fallback sheet when the art is missing */
  sheet: string;
  ref: NpcSheetRef;
  /** sheet name used for the frame layout */
  sheetName: string;
  private fellBack = false;
  x = 0;
  z = 0;
  yaw = 0;
  wpIndex = 0;
  waypoints: { x: number; z: number }[] = [];
  wait = 0;
  interactId: string;
  private synced = { x: NaN, z: NaN, yaw: NaN };

  constructor(assets: Assets, def: NpcDef, home: { x: number; z: number }) {
    this.def = def;
    this.interactId = interactOf(def);
    this.sheetName = def.sheet ?? def.kind;
    this.ref = assets.npcSheet(def.id, this.sheetName);
    this.sheet = this.ref.rel;
    const homeSafe = findSafeStand(home.x + (Math.random() - 0.5) * 1.4, home.z + (Math.random() - 0.5) * 1.4, NPC_RADIUS);
    this.x = homeSafe.x;
    this.z = homeSafe.z;
    this.sync();
  }

  get groupParts(): THREE.Object3D[] {
    return this.sprite && this.shadow ? [this.sprite.mesh, this.shadow.mesh] : [];
  }

  /** on screen: streamed in and not culled */
  get visible(): boolean {
    return !!this.sprite && this.sprite.mesh.visible;
  }

  get loaded(): boolean {
    return !!this.sprite;
  }

  /** stream in: hold the sheet, build sprite + shadow, add to the NPC group (no-op when already in / loading) */
  load(assets: Assets, group: THREE.Group, zoomScale = 1): void {
    this.wanted = true;
    if (this.sprite || this.loading) return;
    this.loading = true;
    void assets.acquire(this.sheet).then(
      () => {
        this.loading = false;
        if (!this.wanted || this.sprite) {
          assets.release(this.sheet);
          return;
        }
        // one px-per-unit for everyone; elders are already drawn ~5% shorter in their sheets
        this.sprite = makeNpcCharacter(assets, this.ref, this.sheetName, CHAR_WORLD_H);
        this.sprite.mesh.scale.setScalar(zoomScale);
        this.shadow = new BlobShadow(0.4, 0.26);
        for (const p of this.groupParts) group.add(p);
        this.sync(true);
      },
      () => {
        this.loading = false;
        assets.release(this.sheet);
        // art not there (yet): use the generic sheet once and try again
        if (!this.fellBack) {
          this.fellBack = true;
          this.sheetName = fallbackSheetOf(this.def);
          this.ref = assets.npcSheet(this.def.id + '#fallback', this.sheetName);
          this.sheet = this.ref.rel;
          if (this.wanted) this.load(assets, group, zoomScale);
        }
      },
    );
  }

  /** stream out: dispose texture clone, geometry, materials; drop the sheet hold */
  unload(assets: Assets): void {
    this.wanted = false;
    if (!this.sprite) return;
    this.sprite.dispose();
    this.shadow?.dispose();
    this.sprite = null;
    this.shadow = null;
    assets.release(this.sheet);
  }

  setRoute(pts: { x: number; z: number }[]): void {
    this.waypoints = pts.length ? pts : [{ x: this.x, z: this.z }];
    this.wpIndex = 0;
  }

  /** Place sprite + shadow; skipped when the actor has not moved (idle NPCs stand still most of the time). */
  sync(force = false): void {
    if (!this.sprite || !this.shadow) return;
    const s = this.synced;
    if (!force && s.x === this.x && s.z === this.z && s.yaw === this.yaw) return;
    s.x = this.x;
    s.z = this.z;
    s.yaw = this.yaw;
    const ground = this.sprite.setPosition(this.x, this.z);
    this.sprite.facing = this.yaw;
    this.shadow.follow(this.x, this.z, ground);
  }

  update(dt: number, camera: THREE.Camera): void {
    const spr = this.sprite;
    if (this.wait > 0) {
      this.wait -= dt;
      if (spr) {
        spr.walking = false;
        this.sync();
        spr.updateBillboard(camera, dt, true);
      }
      return;
    }
    const target = this.waypoints[this.wpIndex] ?? this.waypoints[0];
    if (!target) {
      if (spr) {
        spr.walking = false;
        this.sync();
        spr.updateBillboard(camera, dt, true);
      }
      return;
    }
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.45) {
      this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      this.wait = 1.4 + Math.random() * 2.2;
      if (spr) spr.walking = false;
    } else {
      const sp = 1.55;
      const step = slideMove(this.x, this.z, (dx / dist) * sp * dt, (dz / dist) * sp * dt, NPC_RADIUS);
      this.x = step.x;
      this.z = step.z;
      this.yaw = Math.atan2(dx, dz);
      if (spr) spr.walking = true;
    }
    if (!spr) return;
    this.sync();
    spr.updateBillboard(camera, dt, true);
  }
}

export class NpcSystem {
  actors: NpcActor[] = [];
  group = new THREE.Group();

  constructor(
    private assets: Assets,
    defs: NpcDef[],
    private places: Record<string, { x: number; z: number }>,
  ) {
    for (const d of defs) {
      const home = this.places[d.home] ?? { x: 0, z: 0 };
      this.actors.push(new NpcActor(assets, d, home));
    }
  }

  /**
   * Distance streaming with hysteresis (Larry 2026-11-14 #4「到附近再載入」): an NPC's sheet / sprite exists only
   * while it is within the load radius of the camera target; it is disposed once it is HYST metres beyond it.
   * The radius grows with the camera distance so zooming out never shows an empty village.
   */
  stream(x: number, z: number, camDist: number, zoomScale = 1): { loaded: number; inRange: number } {
    const rIn = NPC_LOAD_BASE + camDist * NPC_LOAD_PER_ZOOM;
    const rOut = rIn + NPC_HYST;
    let loaded = 0;
    let inRange = 0;
    for (const a of this.actors) {
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < rIn) {
        inRange++;
        a.load(this.assets, this.group, zoomScale);
      } else if (d > rOut) a.unload(this.assets);
      if (a.loaded) loaded++;
    }
    return { loaded, inRange };
  }

  /** debug / perf: atlas groups held right now */
  loadedGroups(): string[] {
    return [...new Set(this.actors.filter((a) => a.loaded).map((a) => a.ref.group ?? a.sheet))];
  }

  /** debug / perf: which NPCs have a sprite right now */
  loadedIds(): string[] {
    return this.actors.filter((a) => a.loaded).map((a) => a.def.id);
  }

  applySchedule(period: Period, season: Season): void {
    for (const a of this.actors) {
      const rule =
        a.def.schedule.find((s) => match(s.seasons, season) && match(s.times, period)) ??
        a.def.schedule[a.def.schedule.length - 1];
      const pts = (rule?.waypoints ?? [a.def.home]).map((id) => {
        // defensive: a missing waypoint *and* home falls back to where the actor stands now
        const p = this.places[id] ?? this.places[a.def.home] ?? { x: a.x, z: a.z };
        const jitter = a.def.kind === 'clinic' ? 0.2 : 1.2;
        let x = p.x;
        let z = p.z;
        // stand in front of the clinic door (south of the building)
        if (id === 'clinic') { x = p.x + 0.2; z = p.z + 2.8; }
        else if (a.def.kind === 'elder') { x = p.x - 1.4; z = p.z + 2.6; }
        else {
          x = p.x + (Math.random() - 0.5) * jitter;
          z = p.z + (Math.random() - 0.5) * jitter;
        }
        return findSafeStand(x, z, NPC_RADIUS);
      });
      a.setRoute(pts);
      const start = pts[0];
      if (start && !canStand(a.x, a.z, NPC_RADIUS)) {
        a.x = start.x;
        a.z = start.z;
        a.sync();
      }
    }
  }

  update(dt: number, camera: THREE.Camera): void {
    for (const a of this.actors) a.update(dt, camera);
  }

  byId(id: string): NpcActor | undefined {
    return this.actors.find((a) => a.def.id === id);
  }

  /** park an NPC at a spot (used by the screenshot/demo API and scripted scenes) */
  place(id: string, x: number, z: number, yaw = 0): void {
    const a = this.byId(id);
    if (!a) return;
    const safe = findSafeStand(x, z, NPC_RADIUS);
    a.x = safe.x;
    a.z = safe.z;
    a.yaw = yaw;
    a.setRoute([{ x: safe.x, z: safe.z }]);
    a.wait = 9999;
  }

  nearest(x: number, z: number, r = 2.2): NpcActor | null {
    let best: NpcActor | null = null;
    let bd = r;
    for (const a of this.actors) {
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < bd && a.interactId) {
        bd = d;
        best = a;
      }
    }
    return best;
  }
}

function match(list: string[], value: string): boolean {
  return list.includes('*') || list.includes(value);
}
