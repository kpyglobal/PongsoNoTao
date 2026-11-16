/**
 * 0.1.5 English: the place names the world code writes itself (landmarks, crater lakes, the quest spots it
 * works out, goat herds, the "interact" prompts). Words follow docs/en-glossary.md; villages are their Tao names
 * (those come from content/places.json). The game sets the language once at boot, before the world is built;
 * dev scripts never set it, so they keep the Chinese.
 */
export type WorldLang = 'zh' | 'en';
let lang: WorldLang = 'zh';
export function setWorldLang(l: WorldLang): void {
  lang = l;
}
export const worldLang = (): WorldLang => lang;

/** English name by id (landmark, lake, derived place, herd or prompt id) */
export const WORLD_EN: Record<string, string> = {
  // landmarks (layout.ts LANDMARKS)
  hongtoushan: 'Mt. Hongtou',
  dasenshan: 'Mt. Dasen',
  qingqing: 'Qingqing Prairie',
  battleship: 'Battleship Rock',
  twinlions: 'Twin Lions Rock',
  hongtou_rock: 'Hongtou Rock',
  tank_rock: 'Tank Rock',
  lighthouse: 'Lanyu Lighthouse',
  jade_rock: 'Jade Maiden Rock',
  lovers_cave: "Lovers' Cave",
  skyline_gap: 'Sky Crack',
  helmet_rock: 'Helmet Rock',
  elephant_rock: 'Elephant Trunk Rock',
  dragonhead_rock: 'Dragon Head Rock',
  lanyu_falls: 'Lanyu Waterfall',
  old_man_rock: 'Old Man Rock',
  carp_rock: 'Carp Rock',
  weather_station: 'Lanyu Weather Station',
  // crater lakes (layout.ts LAKES)
  small_lake: 'Little Heaven Lake',
  big_lake: 'Big Heaven Lake',
  // quest spots the code adds (places.ts addQuestPlaces)
  yayo_shop: 'Yayo grocery store',
  yayo_school: 'Yayo school',
  rental: 'scooter rental shop',
  dive_shop: 'dive shop',
  clinic_yard: 'health station yard',
  hen_rock_bay: 'the bay below Hen Rock',
  yayo_dive: 'dive spot outside Yayo harbour',
  tide_iranmeylek: 'Dongqing Bay tide flats',
  // goat herds (goats.ts)
  herd_hutou: 'goats on Hutou Slope',
  herd_hongtou: 'goats on Mt. Hongtou',
  herd_thatch: 'goats on the thatch slope',
  herd_badai: 'goats above Badai Bay',
  herd_dasen: 'goats below Big Heaven Lake',
  herd_tianchi: 'goats by Little Heaven Lake',
  // prompts (populate.ts interactables)
  clinic: 'Lanyu Health Station',
  taro: 'taro field (soli)',
  'harbor-fish': 'Flying fish waters / plank boat (tatala)',
  'look-jimagaod': 'Look out to Little Orchid Island (Jimagaod)',
};

/** the name to show: English by id in English mode, else the Chinese */
export function wname(id: string, zh: string): string {
  return lang === 'en' ? (WORLD_EN[id] ?? zh) : zh;
}

/** host-family spots (places.ts hostPlaces): `v` is the village name already in the interface language */
export function hostNames(v: string, memberHome: boolean, taro: string): { home: string; taro: string; weave: string; tagakal: string; fishrack: string } {
  if (lang === 'en') {
    const fam = memberHome ? 'family' : 'host family';
    return {
      home: memberHome ? `home in ${v}` : `host family home in ${v}`,
      taro,
      weave: `porch in ${v}`,
      tagakal: `${fam} pavilion (tagakal) in ${v}`,
      fishrack: `${fam} drying rack in ${v}`,
    };
  }
  const famOf = memberHome ? `${v}家` : `${v}主人家`;
  return {
    home: memberHome ? `${v}的家` : `${v}的主人家`,
    taro,
    weave: `${v}的簷廊`,
    tagakal: `${famOf}的涼亭`,
    fishrack: `${famOf}的曬魚架`,
  };
}
