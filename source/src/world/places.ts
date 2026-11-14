/**
 * Derived quest places (shop / school / rental / dive shop / dive spots / host-family spots).
 * Pure functions so the game and scripts/check-roads.mjs resolve the very same coordinates.
 */
import { type Structure } from './layout';
import { ALL_STRUCTURES } from './height';

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

/** shop / school in 椰油, the rental + dive shop by 開元港, the two dive spots (adds only missing ids) */
export function addQuestPlaces(P: Record<string, PlaceLike>): void {
  const mk = (id: string, zh: string, p: { x: number; z: number }): void => {
    if (!P[id]) P[id] = { id, zh, tao: '', x: p.x, z: p.z, kind: 'facility' };
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
  mk('hen_rock_bay', '母雞岩下方海灣', { x: 16.5, z: -40.5 });
  mk('yayo_dive', '椰油港外潛點', { x: -35.5, z: 1.5 });
  // 東清 recipe (RECIPE_KEEPERS.md): intertidal gathering spot for 貝類 / 海菜, on the shore below the village
  mk('tide_iranmeylek', '東清灣潮間帶', { x: 23.3, z: -19.0 });
  for (const id of ['yayo_shop', 'yayo_school']) if (!P[id] && P.yayo) mk(id, id, { x: P.yayo.x + 2, z: P.yayo.z + 2 });
}

/** host-family spots for 族人分工 quests: home village, its taro field, the weaver's porch */
export function hostPlaces(P: Record<string, PlaceLike>, home: string): Record<'host_home' | 'host_taro' | 'host_weave', PlaceLike> | null {
  const v = P[home] ?? P.yayo;
  if (!v) return null;
  const taro = P[`taro_${home}`] ?? v;
  return {
    host_home: { id: 'host_home', zh: `${v.zh}的主人家`, tao: '', x: v.x + 1.8, z: v.z + 2.4, kind: 'facility' },
    host_taro: { id: 'host_taro', zh: taro.zh, tao: '', x: taro.x, z: taro.z, kind: 'facility' },
    host_weave: { id: 'host_weave', zh: `${v.zh}的簷廊`, tao: '', x: v.x - 2.2, z: v.z + 1.6, kind: 'facility' },
  };
}
