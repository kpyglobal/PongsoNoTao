/**
 * Derived quest places (shop / school / rental / dive shop / dive spots / host-family spots).
 * Pure functions so the game and scripts/check-roads.mjs resolve the very same coordinates.
 */
import { type Structure, coastT, fromOld, ROAD_W, VILLAGE_DEFS, vlocal } from './layout';
import { fishRacks } from './racks';
import { insetPoint } from './coast';
import { hostNames, wname } from './names';
import { ALL_STRUCTURES, getHeight, getSlope, inTaroBasin, WALK_MAX_SLOPE, WALK_WATER_MARGIN, WATER_LEVEL } from './height';

export interface PlaceLike {
  id: string;
  zh: string;
  tao: string;
  x: number;
  z: number;
  kind: string;
  flavor?: string;
}

/** a point just outside a structure's front door */
export function frontOf(st: Structure, gap = 1.4): { x: number; z: number } {
  return {
    x: st.x + Math.sin(st.yaw) * (st.hd + gap),
    z: st.z + Math.cos(st.yaw) * (st.hd + gap),
  };
}

/** dry, gentle, walkable ground at least `gap` from every building footprint */
function openGround(x: number, z: number, gap: number): boolean {
  const h = getHeight(x, z);
  if (h < WATER_LEVEL + WALK_WATER_MARGIN + 0.12 || getSlope(x, z) > WALK_MAX_SLOPE * 0.6 || inTaroBasin(x, z)) return false;
  for (const st of ALL_STRUCTURES) {
    const dx = x - st.x;
    const dz = z - st.z;
    const c = Math.cos(st.yaw);
    const sn = Math.sin(st.yaw);
    const lx = Math.abs(dx * c - dz * sn) - st.hw;
    const lz = Math.abs(dx * sn + dz * c) - st.hd;
    if (Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) < gap) return false;
  }
  return true;
}

/** the nearest point (rings of 0.4 m, out to 8 m) where every offset spot is open ground; else p itself */
export function clearOfBuildings(p: { x: number; z: number }, offs: [number, number][] = [[0, 0]], gap = 1.6): { x: number; z: number } {
  const ok = (x: number, z: number): boolean => offs.every(([ox, oz]) => openGround(x + ox, z + oz, gap));
  if (ok(p.x, p.z)) return p;
  for (let r = 0.4; r <= 8; r += 0.4) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / 0.4));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (ok(x, z)) return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
    }
  }
  return p;
}

/** shop / school in 椰油, the rental + dive shop by 開元港, the two dive spots (adds only missing ids) */
export function addQuestPlaces(P: Record<string, PlaceLike>): void {
  const mk = (id: string, zh: string, p: { x: number; z: number }): void => {
    if (!P[id]) P[id] = { id, zh: wname(id, zh), tao: '', x: p.x, z: p.z, kind: 'facility' };
  };
  {
    // the same (road-cleared) structures the world builds
    const st = ALL_STRUCTURES.filter((x) => x.village === 'yayo');
    const shop = st.find((x) => x.kind === 'shop');
    const school = st.find((x) => x.kind === 'modern');
    if (shop) mk('yayo_shop', '椰油的雜貨店', frontOf(shop));
    if (school) mk('yayo_school', '椰油的學校', frontOf(school));
  }
  const h = P.harbor;
  if (h) mk('rental', '租車行', { x: h.x + 4.6, z: h.z + 2.2 });
  if (h) mk('dive_shop', '潛水店', { x: h.x + 6.4, z: h.z - 2.0 });
  // the clinic yard beside the door (the nurse stands at the door itself), for the doctor + dietitian
  const c = P.clinic;
  if (c) mk('clinic_yard', '衛生所前庭', { x: c.x + 2.6, z: c.z + 3.4 });
  // 0.1.4: 母雞岩 is on the north shore between 朗島 and 雙獅岩 (real spot); the bay spot is on the beach below it
  {
    const t = coastT(121.5488, 22.0868);
    const p = insetPoint(t, 2.6);
    mk('hen_rock_bay', '母雞岩下方海灣', p);
  }
  // the 0.1.3 spots, carried over relative to their village (fromOld)
  mk('yayo_dive', '椰油港外潛點', fromOld(-35.5, 1.5));
  // 東清 recipe (RECIPE_KEEPERS.md): intertidal gathering spot for 貝類 / 海菜, on the shore below the village
  // 0.1.4: the new layout put a tagakal right on the old spot (the 貝類 node sat inside its walls), so step clear of buildings
  mk('tide_iranmeylek', '東清灣潮間帶', clearOfBuildings(fromOld(23.3, -19.0), [[0, 0], [0, -1.6], [1.4, 0]]));
  for (const id of ['yayo_shop', 'yayo_school']) if (!P[id] && P.yayo) mk(id, id, { x: P.yayo.x + 2, z: P.yayo.z + 2 });
}

export type HostPlaceId = 'host_home' | 'host_taro' | 'host_weave' | 'host_tagakal' | 'host_fishrack';
export const HOST_PLACE_IDS: HostPlaceId[] = ['host_home', 'host_taro', 'host_weave', 'host_tagakal', 'host_fishrack'];

/**
 * host-family spots for 族人分工 quests: home village, its taro field, the weaver's porch,
 * 0.1.4: the family's 涼亭 (the village tagakal nearest the plaza; you stand on its road side)
 * and its fish rack (you stand on the road beside it)
 */
export function hostPlaces(P: Record<string, PlaceLike>, home: string, memberHome = false): Record<HostPlaceId, PlaceLike> | null {
  const v = P[home] ?? P.yayo;
  if (!v) return null;
  const vid = P[home] ? home : 'yayo';
  const taro = P[`taro_${vid}`] ?? v;
  const vd = VILLAGE_DEFS.find((d) => d.id === vid);
  const mk = (id: HostPlaceId, zh: string, p: { x: number; z: number }): PlaceLike => ({ id, zh, tao: '', x: p.x, z: p.z, kind: 'facility' });
  let tag = { x: v.x + 3, z: v.z };
  const tg = ALL_STRUCTURES.filter((s) => s.village === vid && s.kind === 'tagakal').sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z))[0];
  if (tg) tag = frontOf({ ...tg, yaw: tg.yaw + Math.PI }, 1.2);
  let rack = { x: v.x - 3, z: v.z };
  const rk = fishRacks().filter((r) => r.village === vid).sort((a, b) => Math.abs(a.u) - Math.abs(b.u))[0];
  if (rk && vd) rack = vlocal(vd, rk.u, ROAD_W);
  // 0.1.5: a Tao member's own home that is not the 主人家 is just 「<village>的家」
  // 0.1.5 English: the same names in English (names.ts)
  const n = hostNames(v.zh, memberHome, taro.zh);
  return {
    host_home: mk('host_home', n.home, { x: v.x + 1.8, z: v.z + 2.4 }),
    host_taro: mk('host_taro', n.taro, taro),
    host_weave: mk('host_weave', n.weave, { x: v.x - 2.2, z: v.z + 1.6 }),
    host_tagakal: mk('host_tagakal', n.tagakal, tag),
    host_fishrack: mk('host_fishrack', n.fishrack, rack),
  };
}
