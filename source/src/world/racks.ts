/**
 * Road-edge props shared by the world (populate.ts) and the quest places (places.ts): the village fish
 * racks (曬魚架) and the free-spot search the lantern posts use too.
 */
import { ALL_STRUCTURES, getHeight } from './height';
import { FOOTPRINT, ROAD_W, VILLAGE_DEFS, type VillageDef, villageYaw, vlocal } from './layout';

/**
 * 0.1.1: slide a road-edge prop (lantern post, fish rack) along the road until it is `margin` clear of
 * every building footprint and on dry ground; null = no room within 3.2 m (the prop is left out).
 */
export function freeEdgeU(v: VillageDef, u: number, w: number, margin: number): number | null {
  for (let i = 0; i <= 16; i++) {
    const du = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.4;
    const p = vlocal(v, u + du, w);
    if (getHeight(p.x, p.z) < 0.1) continue;
    const hit = ALL_STRUCTURES.some((st) => {
      const f = FOOTPRINT[st.kind];
      const dx = p.x - st.x;
      const dz = p.z - st.z;
      const c = Math.cos(st.yaw);
      const sn = Math.sin(st.yaw);
      return Math.abs(dx * c - dz * sn) < f.hw + margin && Math.abs(dx * sn + dz * c) < f.hd + margin;
    });
    if (!hit) return u + du;
  }
  return null;
}

export interface FishRack { village: string; u: number; x: number; z: number; yaw: number }

/** seaward road edge, clear of the road corridor (0.1.1) */
export const RACK_W = ROAD_W + 1.75;
let RACKS: FishRack[] | null = null;

/**
 * two fish racks per village on the seaward road edge (0.1.4: more candidate spots, so every
 * village, 椰油 included, gets both)
 */
export function fishRacks(): FishRack[] {
  if (RACKS) return RACKS;
  const out: FishRack[] = [];
  for (const v of VILLAGE_DEFS) {
    let n = 0;
    for (const u0 of [-5.5, 6.2, -9.2, 9.8, -12.6, 13.2, -2.2]) {
      if (n >= 2) break;
      const u = freeEdgeU(v, u0, RACK_W, 1.0);
      if (u === null) continue;
      const p = vlocal(v, u, RACK_W);
      if (out.some((r) => Math.hypot(r.x - p.x, r.z - p.z) < 2.8)) continue;
      out.push({ village: v.id, u, x: p.x, z: p.z, yaw: villageYaw(v) });
      n++;
    }
  }
  RACKS = out;
  return out;
}
