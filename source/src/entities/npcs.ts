import * as THREE from 'three';
import type { Assets } from '../core/assets';
import { BlobShadow, CHAR_WORLD_H, makeCharacter, type SpriteBillboard } from './billboard';
import {
  canStand,
  findSafeStand,
  slideMove,
  NPC_RADIUS,
} from '../world/collision';
import type { Period, Season } from '../core/timeSeason';

export interface NpcDef {
  id: string;
  kind: string;
  name: { zh: string; tao: string };
  home: string;
  interact: string;
  portrait?: string;
  schedule: { seasons: string[]; times: string[]; waypoints: string[] }[];
}

export class NpcActor {
  def: NpcDef;
  sprite: SpriteBillboard;
  shadow: BlobShadow;
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
    this.interactId = def.interact;
    // one px-per-unit for everyone; elders are already drawn ~5% shorter in their sheets
    this.sprite = makeCharacter(assets, def.kind, CHAR_WORLD_H);
    this.shadow = new BlobShadow(0.4, 0.26);
    const homeSafe = findSafeStand(home.x + (Math.random() - 0.5) * 1.4, home.z + (Math.random() - 0.5) * 1.4, NPC_RADIUS);
    this.x = homeSafe.x;
    this.z = homeSafe.z;
    this.sync();
  }

  get groupParts(): THREE.Object3D[] {
    return [this.sprite.mesh, this.shadow.mesh];
  }

  setRoute(pts: { x: number; z: number }[]): void {
    this.waypoints = pts.length ? pts : [{ x: this.x, z: this.z }];
    this.wpIndex = 0;
  }

  /** Place sprite + shadow; skipped when the actor has not moved (idle NPCs stand still most of the time). */
  sync(force = false): void {
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
    if (this.wait > 0) {
      this.wait -= dt;
      this.sprite.walking = false;
      this.sync();
      this.sprite.updateBillboard(camera, dt, true);
      return;
    }
    const target = this.waypoints[this.wpIndex] ?? this.waypoints[0];
    if (!target) {
      this.sprite.walking = false;
      this.sync();
      this.sprite.updateBillboard(camera, dt, true);
      return;
    }
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.45) {
      this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      this.wait = 1.4 + Math.random() * 2.2;
      this.sprite.walking = false;
    } else {
      const sp = 1.55;
      const step = slideMove(this.x, this.z, (dx / dist) * sp * dt, (dz / dist) * sp * dt, NPC_RADIUS);
      this.x = step.x;
      this.z = step.z;
      this.yaw = Math.atan2(dx, dz);
      this.sprite.walking = true;
    }
    this.sync();
    this.sprite.updateBillboard(camera, dt, true);
  }
}

export class NpcSystem {
  actors: NpcActor[] = [];
  group = new THREE.Group();

  constructor(
    assets: Assets,
    defs: NpcDef[],
    private places: Record<string, { x: number; z: number }>,
  ) {
    for (const d of defs) {
      const home = this.places[d.home] ?? { x: 0, z: 0 };
      const a = new NpcActor(assets, d, home);
      this.actors.push(a);
      for (const p of a.groupParts) this.group.add(p);
    }
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
