import { outfitBaseSheet } from '../systems/outfits';
import * as THREE from 'three';
import { PLAYER_OUTFITS, type Assets, type PlayerOutfit } from '../core/assets';
import type { Input } from '../core/input';
import { distToRing, roadNear, WATER_LEVEL } from '../world/height';
import {
  canStand,
  ensureStanding,
  findSafeStand,
  findWaterNear,
  paddleMove,
  slideMove,
  PLAYER_RADIUS,
  onRoadOrPath,
  onNarrowGround,
} from '../world/collision';
import { BlobShadow, CHAR_WORLD_H, makeCharacter, SpriteBillboard } from './billboard';

export const WALK_SPEED = 6.2;
export const SCOOTER_ROAD_SPEED = 15.4;
export const SCOOTER_OPEN_SPEED = 9.6;
export const SCOOTER_NARROW_SPEED = 4.4;
export const PADDLE_SPEED = 3.6;

/** How the player gets around: on foot, on the rented scooter, or paddling a tatala. */
export type PlayerMode = 'walk' | 'scooter' | 'canoe';

/** canoe sheet: waterline on frame row 88 of 96 → sink the frame so that row sits on the sea surface */
const CANOE_SINK = -((96 - 88.5) / 96) * CHAR_WORLD_H;

export class Player {
  /** walking sheet (64x96 frames) */
  sprite: SpriteBillboard;
  /** scooter riding sheet (96x96 frames, scooter drawn in) */
  rideSprite: SpriteBillboard;
  /** tatala paddling sheet (128x96 frames, paddle animation) */
  canoeSprite: SpriteBillboard;
  shadow: BlobShadow;
  group = new THREE.Group();
  x = 0;
  z = 0;
  yaw = 0;
  mode: PlayerMode = 'walk';
  outfit: PlayerOutfit = 'player';
  private bobT = 0;
  /** last dry-land spot (where the player steps back ashore after paddling) */
  private shore = { x: 0, z: 0 };
  /** 0.1.6 tap-to-walk: waypoints to follow while the stick is idle (any stick / key input cancels) */
  autoPath: { x: number; z: number }[] | null = null;
  private autoI = 0;
  private autoCheck = { t: 0, x: 0, z: 0 };
  /** set for one read when the last waypoint is reached / when the walk was cut short */
  autoResult: 'arrived' | 'cancelled' | 'stuck' | null = null;
  /** 0.1.6: on the scooter, steer along the road while the stick points roughly along it */
  roadFollow = true;

  startAuto(path: { x: number; z: number }[]): void {
    this.autoPath = path.length ? path : null;
    this.autoI = 0;
    this.autoResult = null;
    this.autoCheck = { t: 0, x: this.x, z: this.z };
  }

  stopAuto(why: 'cancelled' | 'stuck' | null = 'cancelled'): void {
    if (!this.autoPath) return;
    this.autoPath = null;
    this.autoResult = why;
  }

  /** stick direction (world) → the road's direction when it points within ~40° of it, pulled back toward the centre */
  private followRoad(mx: number, mz: number): { mx: number; mz: number } {
    const r = roadNear(this.x, this.z, 2.6);
    if (!r) return { mx, mz };
    let { tx, tz } = r;
    let off = r.off;
    const dot = mx * tx + mz * tz;
    if (dot < 0) { tx = -tx; tz = -tz; off = -off; }
    if (Math.abs(dot) < 0.76) return { mx, mz }; // pushing across the road: the rider turns off it
    // left normal of the travel direction is (-tz, tx); steer against the sideways offset (gently)
    const pull = Math.max(-0.35, Math.min(0.35, off * 0.22));
    const nx = tx * 0.92 + mx * 0.08 + tz * pull;
    const nz = tz * 0.92 + mz * 0.08 - tx * pull;
    const L = Math.hypot(nx, nz) || 1;
    return { mx: nx / L, mz: nz / L };
  }

  constructor(assets: Assets) {
    this.sprite = makeCharacter(assets, 'player');
    this.rideSprite = new SpriteBillboard(assets.sheetClone('characters/ride_player_sheet.png'), { cols: 4, rows: 4, worldH: CHAR_WORLD_H, kind: 'ride' });
    this.canoeSprite = new SpriteBillboard(assets.sheetClone('characters/canoe_player_sheet.png'), { cols: 4, rows: 4, worldH: CHAR_WORLD_H, kind: 'canoe' });
    this.rideSprite.mesh.visible = false;
    this.canoeSprite.mesh.visible = false;
    this.shadow = new BlobShadow(0.45, 0.3);
    this.group.add(this.sprite.mesh, this.rideSprite.mesh, this.canoeSprite.mesh, this.shadow.mesh);
  }

  /** back-compat alias used by the UI / tests */
  get scooter(): boolean {
    return this.mode === 'scooter';
  }

  /** the billboard currently shown */
  get active(): SpriteBillboard {
    return this.mode === 'scooter' ? this.rideSprite : this.mode === 'canoe' ? this.canoeSprite : this.sprite;
  }

  /** 0.1.4: a plain modern canoe instead of the tatala (族女 / 旅人; only Tao men paddle a tatala) */
  canoeModern = false;

  /** the canoe sheet for an outfit: `canoe_modern_<kind>` when on a modern canoe, else the tatala `canoe_<kind>` */
  private canoeSheet(assets: Assets, kind: string, rideKind: string): string {
    const pre = this.canoeModern ? 'canoe_modern_' : 'canoe_';
    return `characters/${assets.textures.has(`characters/${pre}${kind}_sheet.png`) ? `${pre}${kind}` : `${pre}${rideKind}`}_sheet.png`;
  }

  /** switch the hull (load `canoe_modern_*` first: Assets.acquire); keeps the tatala when the sheet is missing */
  setCanoeHull(assets: Assets, modern: boolean): void {
    this.canoeModern = modern;
    const kind = this.outfit;
    const rideKind = assets.textures.has(`characters/ride_${kind}_sheet.png`) ? kind : outfitBaseSheet(kind);
    const rel = this.canoeSheet(assets, kind, rideKind);
    if (assets.textures.has(rel)) this.canoeSprite.swapSheet(assets.sheetClone(rel));
  }

  /** origin x gender → outfit; swaps all three sheets so every pose matches */
  setOutfit(assets: Assets, kind: string): void {
    if (kind === this.outfit) return;
    this.outfit = kind as PlayerOutfit;
    this.sprite.swapSheet(assets.sheetClone(`characters/${kind}_sheet.png`));
    // outfit variants (`player_trad`, `player_visitor_acc`) ride / paddle with their own sheets when drawn, else the base outfit's
    const rideKind = assets.textures.has(`characters/ride_${kind}_sheet.png`) ? kind : outfitBaseSheet(kind);
    if ((PLAYER_OUTFITS as readonly string[]).includes(rideKind) || assets.textures.has(`characters/ride_${rideKind}_sheet.png`)) {
      this.rideSprite.swapSheet(assets.sheetClone(`characters/ride_${rideKind}_sheet.png`));
      const rel = this.canoeSheet(assets, kind, rideKind);
      if (assets.textures.has(rel)) this.canoeSprite.swapSheet(assets.sheetClone(rel));
    }
  }

  private setMode(mode: PlayerMode): void {
    this.mode = mode;
    this.sprite.mesh.visible = mode === 'walk';
    this.rideSprite.mesh.visible = mode === 'scooter';
    this.canoeSprite.mesh.visible = mode === 'canoe';
    this.shadow.mesh.visible = mode !== 'canoe';
    this.shadow.mesh.scale.set(mode === 'scooter' ? 0.8 : 0.45, mode === 'scooter' ? 0.42 : 0.3, 1);
    for (const s of [this.sprite, this.rideSprite, this.canoeSprite]) s.facing = this.yaw;
    this.sync(true);
  }

  setScooter(on: boolean): void {
    if (this.mode === 'canoe') return;
    this.setMode(on ? 'scooter' : 'walk');
  }

  /**
   * Board / leave a tatala. Boarding launches from the nearest water (null when none is close);
   * leaving steps back onto the nearest dry land. Ready for the tatala quest line.
   */
  setCanoe(on: boolean, at?: { x: number; z: number }): boolean {
    if (on) {
      const from = at ?? { x: this.x, z: this.z };
      const w = findWaterNear(from.x, from.z);
      if (!w) return false;
      if (this.mode !== 'canoe') this.shore = { x: this.x, z: this.z };
      this.x = w.x;
      this.z = w.z;
      this.setMode('canoe');
      return true;
    }
    if (this.mode !== 'canoe') return true;
    const land = findSafeStand(this.x, this.z, PLAYER_RADIUS);
    const far = Math.hypot(land.x - this.x, land.z - this.z) > 30;
    const p = far ? findSafeStand(this.shore.x, this.shore.z, PLAYER_RADIUS) : land;
    this.x = p.x;
    this.z = p.z;
    this.setMode('walk');
    return true;
  }

  spawn(x: number, z: number): void {
    if (this.mode === 'canoe') {
      this.setMode('walk');
    }
    const safe = findSafeStand(x, z, PLAYER_RADIUS);
    this.x = safe.x;
    this.z = safe.z;
    this.sync();
  }

  private synced = { x: NaN, z: NaN, yaw: NaN, mode: 'walk' as PlayerMode };

  private sync(force = true): void {
    const s = this.synced;
    if (!force && this.mode !== 'canoe' && s.x === this.x && s.z === this.z && s.yaw === this.yaw && s.mode === this.mode) return;
    s.x = this.x;
    s.z = this.z;
    s.yaw = this.yaw;
    s.mode = this.mode;
    const spr = this.active;
    if (this.mode === 'canoe') {
      const bob = Math.sin(this.bobT * 2.1) * 0.035;
      spr.setPosition(this.x, this.z, CANOE_SINK + bob, WATER_LEVEL);
    } else {
      const ground = spr.setPosition(this.x, this.z);
      this.shadow.follow(this.x, this.z, ground);
    }
    spr.facing = this.yaw;
  }

  /**
   * Camera-relative movement: stick/key UP walks away from the camera along
   * the ground (into the screen), DOWN walks toward the camera, LEFT/RIGHT
   * follow screen axes. Rotating the camera therefore rotates the walk basis.
   */
  private planarFromInput(input: Input, camera: THREE.Camera): { mx: number; mz: number } {
    const camYaw = Math.atan2(camera.position.x - this.x, camera.position.z - this.z);
    // Horizontal look (toward the focus, away from the camera position).
    const fwdX = -Math.sin(camYaw);
    const fwdZ = -Math.cos(camYaw);
    const rightX = Math.cos(camYaw);
    const rightZ = -Math.sin(camYaw);
    // input.moveZ: -1 = W / stick-up, +1 = S / stick-down
    // input.moveX: +1 = D / stick-right
    let ix = input.moveX;
    let iz = input.moveZ;
    // 0.1.4: with 8-direction art the stick snaps to 45° so the walk matches the facing shown
    if (this.active.eight && (ix || iz)) {
      const m = Math.min(1, Math.hypot(ix, iz));
      const a = Math.round(Math.atan2(ix, iz) / (Math.PI / 4)) * (Math.PI / 4);
      ix = Math.sin(a) * m;
      iz = Math.cos(a) * m;
    }
    return {
      mx: fwdX * -iz + rightX * ix,
      mz: fwdZ * -iz + rightZ * ix,
    };
  }

  currentSpeed(): number {
    if (this.mode === 'canoe') return PADDLE_SPEED;
    if (this.mode === 'walk') return WALK_SPEED;
    if (onNarrowGround(this.x, this.z)) return SCOOTER_NARROW_SPEED;
    if (onRoadOrPath(this.x, this.z) || distToRing(this.x, this.z) < 2.1) return SCOOTER_ROAD_SPEED;
    return SCOOTER_OPEN_SPEED;
  }

  update(dt: number, input: Input, camera: THREE.Camera, blocked: boolean): void {
    const canoe = this.mode === 'canoe';
    this.bobT += dt;
    // If something pushed us into water / a wall, immediately step back onto land.
    if (!canoe && !canStand(this.x, this.z, PLAYER_RADIUS)) {
      const safe = ensureStanding(this.x, this.z, PLAYER_RADIUS);
      this.x = safe.x;
      this.z = safe.z;
    }
    let mx = 0;
    let mz = 0;
    if (!blocked) {
      const v = this.planarFromInput(input, camera);
      mx = v.mx;
      mz = v.mz;
    }
    const stick = Math.hypot(mx, mz) > 0.15;
    if (stick && this.autoPath) this.stopAuto('cancelled');
    if (stick && this.mode === 'scooter' && this.roadFollow) {
      const L = Math.hypot(mx, mz);
      const f = this.followRoad(mx / L, mz / L);
      mx = f.mx * L;
      mz = f.mz * L;
    }
    if (!stick && !blocked && this.autoPath && !canoe) {
      // tap-to-walk: head for the next waypoint
      let p = this.autoPath[this.autoI];
      while (p && Math.hypot(p.x - this.x, p.z - this.z) < 0.3) p = this.autoPath[++this.autoI];
      if (!p) {
        this.autoPath = null;
        this.autoResult = 'arrived';
      } else {
        const dx = p.x - this.x;
        const dz = p.z - this.z;
        const L = Math.hypot(dx, dz) || 1;
        // slow down onto the last point instead of overshooting it
        const last = this.autoI === this.autoPath.length - 1;
        const k = last ? Math.min(1, Math.max(0.35, L / (this.currentSpeed() * dt * 2))) : 1;
        mx = (dx / L) * k;
        mz = (dz / L) * k;
        // no progress for a second (someone in the way): give up
        this.autoCheck.t += dt;
        if (this.autoCheck.t > 1) {
          if (Math.hypot(this.x - this.autoCheck.x, this.z - this.autoCheck.z) < 0.25) this.stopAuto('stuck');
          this.autoCheck = { t: 0, x: this.x, z: this.z };
        }
      }
    }
    const len = Math.hypot(mx, mz);
    const spr = this.active;
    spr.walking = len > 0.15 || (!!this.autoPath && len > 0.01);
    if (len > 0.15 || (this.autoPath && len > 0.01)) {
      const sp = Math.min(1, len);
      mx /= len;
      mz /= len;
      this.yaw = Math.atan2(mx, mz);
      const step = this.currentSpeed() * dt * (this.autoPath ? sp : 1);
      const next = canoe ? paddleMove(this.x, this.z, mx * step, mz * step) : slideMove(this.x, this.z, mx * step, mz * step, PLAYER_RADIUS);
      this.x = next.x;
      this.z = next.z;
    }
    // standing still: sprite / shadow are already where they belong (the canoe keeps bobbing)
    this.sync(false);
    spr.updateBillboard(camera, dt, true);
  }
}
