import * as THREE from 'three';
import { PLAYER_OUTFITS, type Assets, type PlayerOutfit } from '../core/assets';
import type { Input } from '../core/input';
import { distToRing, WATER_LEVEL } from '../world/height';
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

  /** origin x gender → outfit; swaps all three sheets so every pose matches */
  setOutfit(assets: Assets, kind: string): void {
    if (kind === this.outfit) return;
    this.outfit = kind as PlayerOutfit;
    this.sprite.swapSheet(assets.sheetClone(`characters/${kind}_sheet.png`));
    if ((PLAYER_OUTFITS as readonly string[]).includes(kind)) {
      this.rideSprite.swapSheet(assets.sheetClone(`characters/ride_${kind}_sheet.png`));
      this.canoeSprite.swapSheet(assets.sheetClone(`characters/canoe_${kind}_sheet.png`));
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
    const ix = input.moveX;
    const iz = input.moveZ;
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
    const len = Math.hypot(mx, mz);
    const spr = this.active;
    spr.walking = len > 0.15;
    if (len > 0.15) {
      mx /= len;
      mz /= len;
      this.yaw = Math.atan2(mx, mz);
      const step = this.currentSpeed() * dt;
      const next = canoe ? paddleMove(this.x, this.z, mx * step, mz * step) : slideMove(this.x, this.z, mx * step, mz * step, PLAYER_RADIUS);
      this.x = next.x;
      this.z = next.z;
    }
    // standing still: sprite / shadow are already where they belong (the canoe keeps bobbing)
    this.sync(false);
    spr.updateBillboard(camera, dt, true);
  }
}
