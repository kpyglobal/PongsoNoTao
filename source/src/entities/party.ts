/**
 * The fixed party: 族男 (m) + 族女 (f) + the traveller chosen at character select (t).
 * The controlled member is the Player; the other two are light followers that trail the leader
 * along its own footsteps (a breadcrumb trail of positions the leader actually stood on, so they
 * never cut through buildings or taro fields). Followers ride when the leader rides.
 */
import * as THREE from 'three';
import type { Assets } from '../core/assets';
import { BlobShadow, CHAR_WORLD_H, makeCharacter, SpriteBillboard } from './billboard';
import { canStand, findSafeStand, slideMove, NPC_RADIUS } from '../world/collision';
import type { Player } from './player';
import type { Role } from '../quests/types';

export const ROLES: Role[] = ['m', 'f', 't'];

export class Follower {
  role: Role;
  outfit = '';
  sprite: SpriteBillboard;
  ride: SpriteBillboard;
  shadow = new BlobShadow(0.42, 0.28);
  x = 0;
  z = 0;
  yaw = 0;
  riding = false;
  hidden = false;
  /** small per-follower sideways offset so the line looks loose, not a conga line */
  side: number;
  stuck = 0;

  constructor(assets: Assets, role: Role, outfit: string, side: number) {
    this.role = role;
    this.side = side;
    this.sprite = makeCharacter(assets, outfit, CHAR_WORLD_H);
    this.ride = new SpriteBillboard(assets.sheetClone(`characters/ride_${outfit}_sheet.png`), { cols: 4, rows: 4, worldH: CHAR_WORLD_H, kind: 'ride' });
    this.ride.mesh.visible = false;
    this.outfit = outfit;
  }

  get parts(): THREE.Object3D[] {
    return [this.sprite.mesh, this.ride.mesh, this.shadow.mesh];
  }

  get active(): SpriteBillboard {
    return this.riding ? this.ride : this.sprite;
  }

  assign(assets: Assets, role: Role, outfit: string): void {
    this.role = role;
    if (outfit === this.outfit) return;
    this.outfit = outfit;
    this.sprite.swapSheet(assets.sheetClone(`characters/${outfit}_sheet.png`));
    this.ride.swapSheet(assets.sheetClone(`characters/ride_${outfit}_sheet.png`));
  }

  place(x: number, z: number, yaw = this.yaw): void {
    const s = canStand(x, z, NPC_RADIUS) ? { x, z } : findSafeStand(x, z, NPC_RADIUS);
    this.x = s.x;
    this.z = s.z;
    this.yaw = yaw;
    this.sync();
  }

  setVis(hidden: boolean, riding: boolean): void {
    this.hidden = hidden;
    this.riding = riding;
    this.sprite.mesh.visible = !hidden && !riding;
    this.ride.mesh.visible = !hidden && riding;
    this.shadow.mesh.visible = !hidden;
    this.shadow.mesh.scale.set(riding ? 0.8 : 0.42, riding ? 0.42 : 0.28, 1);
  }

  sync(): void {
    const spr = this.active;
    const ground = spr.setPosition(this.x, this.z);
    spr.facing = this.yaw;
    this.shadow.follow(this.x, this.z, ground);
  }
}

export class Party {
  group = new THREE.Group();
  followers: Follower[] = [];
  controlled: Role = 't';
  outfits: Record<Role, string> = { m: 'player', f: 'player_f', t: 'player_visitor' };
  /** leader footsteps, newest last */
  private trail: { x: number; z: number }[] = [];

  constructor(assets: Assets) {
    this.followers = [new Follower(assets, 'm', 'player', -0.45), new Follower(assets, 'f', 'player_f', 0.45)];
    for (const f of this.followers) for (const p of f.parts) this.group.add(p);
  }

  follower(role: Role): Follower | undefined {
    return this.followers.find((f) => f.role === role);
  }

  /** (re)build the party around the leader; positions default to a short line behind it */
  setup(assets: Assets, outfits: Record<Role, string>, controlled: Role, leader: { x: number; z: number; yaw: number }, pos?: Partial<Record<Role, { x: number; z: number }>>): void {
    this.outfits = outfits;
    this.controlled = controlled;
    const others = ROLES.filter((r) => r !== controlled);
    others.forEach((r, i) => {
      const f = this.followers[i];
      f.assign(assets, r, outfits[r]);
      const p = pos?.[r];
      const bx = leader.x - Math.sin(leader.yaw) * 1.4 * (i + 1) + f.side;
      const bz = leader.z - Math.cos(leader.yaw) * 1.4 * (i + 1);
      f.place(p?.x ?? bx, p?.z ?? bz, leader.yaw);
      f.setVis(false, false);
    });
    this.resetTrail(leader);
  }

  /** S10: seed the trail with footsteps behind the leader, so followers keep their gap instead of walking into the player */
  resetTrail(at: { x: number; z: number; yaw?: number }): void {
    const yaw = at.yaw ?? 0;
    const bx = -Math.sin(yaw);
    const bz = -Math.cos(yaw);
    this.trail = [];
    for (let k = 6; k >= 1; k--) {
      const x = at.x + bx * k;
      const z = at.z + bz * k;
      this.trail.push(canStand(x, z, NPC_RADIUS) ? { x, z } : { x: at.x, z: at.z });
    }
    this.trail.push({ x: at.x, z: at.z });
  }

  /** put the followers right behind the leader (fast travel, loading a save) */
  snapAround(leader: { x: number; z: number; yaw: number }): void {
    this.followers.forEach((f, i) => {
      f.place(leader.x - Math.sin(leader.yaw) * 1.4 * (i + 1) + f.side, leader.z - Math.cos(leader.yaw) * 1.4 * (i + 1), leader.yaw);
    });
    this.resetTrail(leader);
  }

  /** point on the trail `gap` metres behind the leader (walking back along the footsteps) */
  private trailPoint(leader: { x: number; z: number }, gap: number): { x: number; z: number } {
    let px = leader.x;
    let pz = leader.z;
    let left = gap;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const q = this.trail[i];
      const d = Math.hypot(q.x - px, q.z - pz);
      if (d >= left && d > 1e-4) {
        const k = left / d;
        return { x: px + (q.x - px) * k, z: pz + (q.z - pz) * k };
      }
      left -= d;
      px = q.x;
      pz = q.z;
    }
    return { x: px, z: pz };
  }

  update(dt: number, camera: THREE.Camera, leader: Player): void {
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(leader.x - last.x, leader.z - last.z) > 0.3) {
      this.trail.push({ x: leader.x, z: leader.z });
      if (this.trail.length > 200) this.trail.splice(0, this.trail.length - 200);
    }
    const riding = leader.mode === 'scooter';
    const hidden = leader.mode === 'canoe';
    this.followers.forEach((f, i) => {
      if (f.hidden !== hidden || f.riding !== riding) {
        f.setVis(hidden, riding);
        f.sync();
      }
      if (hidden) return;
      const gap = (riding ? 3.0 : 1.55) * (i + 1);
      const t = this.trailPoint(leader, gap);
      // loose formation: a little sideways offset, perpendicular to the leader's heading
      const tx = t.x + Math.cos(leader.yaw) * f.side * 0.6;
      const tz = t.z - Math.sin(leader.yaw) * f.side * 0.6;
      const goal = canStand(tx, tz, NPC_RADIUS) ? { x: tx, z: tz } : t;
      const dx = goal.x - f.x;
      const dz = goal.z - f.z;
      const d = Math.hypot(dx, dz);
      const far = Math.hypot(leader.x - f.x, leader.z - f.z);
      const spr = f.active;
      if (far > 28) {
        f.place(goal.x, goal.z, leader.yaw);
        spr.walking = false;
      } else if (d > 0.45) {
        const top = riding ? 17 : 7.2;
        const sp = Math.min(top, Math.max(2.2, d * 2.6));
        const step = Math.min(d, sp * dt);
        const next = slideMove(f.x, f.z, (dx / d) * step, (dz / d) * step, NPC_RADIUS);
        // stuck timer: blocked by a wall / taro field edge for a while → hop onto the leader's trail
        const moved = Math.hypot(next.x - f.x, next.z - f.z);
        f.stuck = moved < step * 0.25 && d > 2.5 ? f.stuck + dt : 0;
        if (f.stuck > 1.6) {
          f.stuck = 0;
          f.place(goal.x, goal.z, leader.yaw);
          spr.walking = false;
          spr.updateBillboard(camera, dt, true);
          return;
        }
        f.x = next.x;
        f.z = next.z;
        f.yaw = Math.atan2(dx, dz);
        spr.walking = true;
        f.sync();
      } else {
        spr.walking = false;
      }
      spr.updateBillboard(camera, dt, true);
    });
  }

  /** visible follower sprites (tint / zoom-scale pass) */
  sprites(out: SpriteBillboard[]): void {
    for (const f of this.followers) if (!f.hidden) out.push(f.active);
  }

  positions(leader: { x: number; z: number }): Record<Role, { x: number; z: number }> {
    const r = {} as Record<Role, { x: number; z: number }>;
    r[this.controlled] = { x: leader.x, z: leader.z };
    for (const f of this.followers) r[f.role] = { x: f.x, z: f.z };
    return r;
  }
}
