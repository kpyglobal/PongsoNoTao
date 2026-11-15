/**
 * 0.1.4 arrival opening: after the party is picked, the player chooses 搭飛機 or 搭船. The painted ride in is a
 * separate light scene (src/intro/introScene.ts). This file holds the start spots (shared with scripts/check-roads)
 * and the static parked-plane / moored-yacht props left behind at 蘭嶼機場 / 開元港.
 */
import * as THREE from 'three';
import { ArchBuilder, addCommuterPlane, addYacht } from './buildings';
import { FACILITIES, HARBOUR_YACHT, PLANE_PARK, planePark } from './layout';
import { distToRing, getHeight } from './height';
import { canStand, findSafeStand, PLAYER_RADIUS } from './collision';
import type { ArrivalWay } from '../core/state';

export const ARRIVAL_WAYS: ArrivalWay[] = ['plane', 'boat'];

/** where the party starts after each arrival (both on the ring road network) */
export function arrivalSpawn(way: ArrivalWay, harbour: { x: number; z: number } = FACILITIES.harbor): { x: number; z: number; yaw: number } {
  if (way === 'boat') {
    // same spot as 0.1.0–0.1.3 (the 開元港 quay, at the spur road); `harbour` = the places.json 開元港
    const h = harbour;
    const p = findSafeStand(h.x + 1.6, h.z + 1.2, PLAYER_RADIUS);
    return { ...p, yaw: Math.PI * 0.5 };
  }
  // the ring road beside the runway's 椰油 / 開元港 end (the terminal is just across the runway), so both starts
  // are a short walk from the same rental shop
  const R = FACILITIES.runway;
  const al = { x: Math.sin(R.yaw), z: Math.cos(R.yaw) };
  const ex = R.x - al.x * (R.hz - 1);
  const ez = R.z - al.z * (R.hz - 1);
  const H = FACILITIES.harbor;
  const towardHarbour = (H.x - R.x) * al.x + (H.z - R.z) * al.z < 0;
  const cx = towardHarbour ? ex : R.x + al.x * (R.hz - 1);
  const cz = towardHarbour ? ez : R.z + al.z * (R.hz - 1);
  let best: { x: number; z: number } | null = null;
  let bd = Infinity;
  for (let dx = -14; dx <= 14; dx += 0.5) {
    for (let dz = -14; dz <= 14; dz += 0.5) {
      const d = Math.hypot(dx, dz);
      if (d >= bd) continue;
      const x = cx + dx;
      const z = cz + dz;
      if (distToRing(x, z) < 0.45 && canStand(x, z, PLAYER_RADIUS)) {
        bd = d;
        best = { x, z };
      }
    }
  }
  const p = best ?? findSafeStand(cx, cz, PLAYER_RADIUS);
  // face the runway (the plane they just left)
  return { ...p, yaw: Math.atan2(R.x - p.x, R.z - p.z) };
}

// ------------------------------------------------------------------ the parked plane and the moored yacht

/**
 * 0.1.4: the arrival vehicles left behind as static v7 props: the plane on the 蘭嶼機場 apron, the yacht in the
 * 開元港 basin. Each is a real 3D object with its own group / transform (named 'arrival-prop-plane' /
 * 'arrival-prop-yacht') so it can be animated later; collision stays the PLANE_FOOT / HARBOUR_YACHT boxes.
 */
export function buildArrivalProps(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'arrival-props';
  const one = (name: string, make: (b: ArchBuilder) => void, x: number, y: number, z: number, yaw: number, s = 1): void => {
    const b = new ArchBuilder();
    b.frame(0, 0, 0, 0);
    make(b);
    const g = new THREE.Group();
    g.name = name;
    g.add(b.build());
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    g.scale.setScalar(s);
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    root.add(g);
  };
  // on the runway at the harbour end, in front of the terminal (layout.ts planePark), the PLANE_FOOT box
  const pp = planePark();
  one('arrival-prop-plane', (b) => addCommuterPlane(b, 0, 0, 0, 0, 1), pp.x, getHeight(pp.x, pp.z) - 0.02, pp.z, pp.yaw, PLANE_PARK.scale);
  const h = FACILITIES.harbor;
  one('arrival-prop-yacht', (b) => addYacht(b, 0, 0, 0, 0, 1), h.x + HARBOUR_YACHT.dx, -0.02, h.z + HARBOUR_YACHT.dz, HARBOUR_YACHT.yaw);
  return root;
}
