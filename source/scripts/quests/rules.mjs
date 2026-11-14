// Structured prerequisites / conditions / roles for all 116 quests (source: planning Page v2,
// docs/phase1/quests-raw.json). Text fields come from the Page verbatim; this file only adds the
// machine-readable parts. Req grammar:
//   'Q01'                       quest done
//   { all: [Req…] }             AND
//   { any: [Req…], n? }         OR / 任 N 個
//   { flag: 'x' }               story flag
//   { respect: 'learning' }     traveller respect level ≥ (first < learning < trusted < friend)
//   { stat: 'relation', min }   shared meter ≥
//   { count: 'words', min }     collection counters (words, photos, lowTideOnTime, photoSet:north…)
//   { pending: true }           content not confirmed by the community yet → never unlocks
const K = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'];
const NORTH = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P08', 'P09'];
const EAST = ['P10', 'P11', 'P12', 'P13', 'P14', 'P15'];

export const REQ = {
  Q01: { flag: 'party_created' },
  Q02: 'Q01', Q03: 'Q01', Q04: 'Q01',
  Q05: 'Q02', // finishes when 任四個 K are done (auto step, see playable.mjs)
  Q06: { flag: 'injured' },
  Q07: { all: ['Q03', 'Q04'] },
  M1: 'Q05', M2: { flag: 'new_year' }, M3: { all: ['M1', 'M2'] }, M4: 'M3', M5: 'M4', M6: 'M5', M7: 'M6', M8: 'M4',
  M9: { all: ['M7', 'M8'] }, M10: 'M9', M11: 'M10',
  F1: 'Q05', F2: 'F1',
  R1: 'Q03', R2: 'R1', R3: 'R2', R4: 'R3', R5: { all: ['R3', { respect: 'learning' }] }, R6: 'R4',
  I1: 'Q02', I2: 'I1', I3: 'I2',
  C1: 'I2', C2: { all: ['Q02', { flag: 'crab_season' }] }, C3: { flag: 'met_coconut_crab' },
  V1: 'Q04', V2: { respect: 'learning' }, V3: { respect: 'trusted' }, V4: { all: [{ respect: 'trusted' }, 'T2'] },
  V5: { respect: 'friend' }, V6: { respect: 'learning' },
  T1: { all: ['Q05', { stat: 'relation', min: 4 }] }, T2: 'T1', T3: 'T2', T4: 'T3', T5: { all: ['T4', 'R4'] },
  T6: { all: ['T4', 'M2'] }, T7: 'T6', T8: 'T4',
  E1: 'Q05', E2: 'R3', E3: 'Q05', E4: 'Q05', E5: { pending: true }, N1: { flag: 'year_done' },
  K1: 'Q02', K2: 'Q02', K3: 'Q02', K4: 'Q02', K5: 'Q02', K6: 'Q02',
  X01: 'Q02', X02: 'X01', X03: { all: ['X01', { flag: 'tao_hint_heard' }] }, X04: 'X03', X05: 'X04',
  S1: 'Q02', S2: 'Q02', S3: 'Q02',
  G1: 'R4', G2: 'M6', G3: 'I3', G4: 'F1',
  W1: { all: ['G1', 'G2'] }, W2: { any: ['R4', 'G1'] }, W3: 'V6', W4: 'X04', W5: 'C2',
  H1: 'X05', H2: { flag: 'met_dietitian' }, H3: { count: 'lowTideOnTime', min: 3 }, H4: { count: 'photos', min: 6 },
  Z1: { all: ['M11', 'X03'] },
  B1: 'Q04', B2: { all: ['B1', ...NORTH] }, B3: 'B1',
  D1: 'Q02', D2: 'D1', D3: { all: ['D2', ...EAST] },
  Y1: 'Q06', Y2: { any: ['Q06', 'E1'] }, Y3: { all: ['Y2', 'G1'] },
  // batch 1b: underwater (modern recreational dive spots, anyone) + 族人分工
  U1: { all: ['Q02', 'S3'] }, U2: { all: ['U1', { flag: 'met_npc_dive_coach' }] }, U3: { flag: 'u1_by_t' },
  J1: 'R3', J2: 'J1', J3: 'Q03', J4: { flag: 'met_thatch_elder' },
  A1: 'T3', A2: 'M4', A3: 'R1', A4: { flag: 'saw_goats' },
};
for (let i = 1; i <= 27; i++) {
  const id = `P${String(i).padStart(2, '0')}`;
  REQ[id] = ['P05', 'P07', 'P18'].includes(id) ? { all: ['Q04', 'B1'] } : 'Q04';
}

/** hidden: not even ？？？ in the log until the prerequisite is met */
export const HIDDEN = new Set(['H1', 'H2', 'H3', 'H4', 'U3', 'J4', 'A4']);

/** when the quest can be *done* (it can be unlocked / started any time) */
export const WHEN = {
  M3: { season: 'fishing' }, M4: { season: 'fishing' }, M5: { season: 'fishing' }, M6: { season: 'fishing' },
  M7: { season: 'fishing' }, M8: { season: 'fishing' }, M9: { season: 'fishing' }, G2: { season: 'fishing' },
  T6: { season: 'fishing' }, T7: { season: 'fishing', period: ['night'] },
  G4: { season: 'nonFishing' }, V4: { season: 'nonFishing' }, P27: { season: 'nonFishing' },
  I2: { tide: 'low' }, I3: { tide: 'low' }, G3: { tide: 'low' }, H3: { tide: 'low' },
  C1: { period: ['night'] }, C2: { period: ['night'] }, W5: { period: ['night'] },
  X01: { period: ['dawn', 'day', 'dusk'] }, X03: { period: ['dawn', 'day', 'dusk'] },
  D1: { period: ['dawn', 'day'] }, D2: { period: ['dawn', 'day'] }, D3: { period: ['dawn', 'day'] },
  P09: { period: ['night'] }, P13: { period: ['dawn'] }, P20: { period: ['dusk'] },
  // dive spots: closed in flying-fish season (部落灘頭與椰油斷層禁潛), daytime only
  U1: { season: 'nonFishing', period: ['day'] }, U2: { season: 'nonFishing', period: ['day'] }, U3: { season: 'nonFishing', period: ['day'] },
  J1: { season: 'nonFishing' }, J2: { season: 'nonFishing' }, J4: { season: 'nonFishing' },
  A2: { season: 'fishing' }, A3: { season: 'nonFishing' }, A4: { period: ['dawn', 'day', 'dusk'] },
};
for (const id of ['P01', 'P02', 'P03', 'P07', 'P08', 'P10', 'P12', 'P14', 'P15', 'P16', 'P17', 'P18', 'P19', 'P22', 'P23', 'P24', 'P25']) {
  WHEN[id] = { period: ['dawn', 'day'] };
}

/** start early, but the last step needs an item from another (side) quest */
export const NEEDS_ITEM = {
  C1: { item: 'headlamp', from: 'S1' },
  V4: { item: 'lifejacket', from: 'S3' },
  G3: { item: 'sunscreen', from: 'S2' },
};

/** sacred / possibly sacred places: photograph from outside, at a distance only */
export const DISTANCE_ONLY = { P05: 30, P07: 30, P18: 30, P10: 0 };

/** fishing grounds (出海捕魚的地點) follow tradition: 族男 space. Dive spots are modern recreation: anyone. */
export const GROUND = { M3: 'fishing', T2: 'fishing', T6: 'fishing', T7: 'fishing', G4: 'fishing', U1: 'dive', U2: 'dive', U3: 'dive' };

/**
 * Activity songs (planning Page「活動歌謠（暫定）」): first line only, text only (no audio yet).
 * Source: 族語 E 樂園 歌謠篇 雅美語（財團法人原住民族語言研究發展基金會）, CC BY-NC-SA 4.0; to be checked against
 * the 歌謠篇 itself before release. status 暫定 = waiting for community review.
 */
const SONG_SRC = '族語 E 樂園 歌謠篇（雅美語，財團法人原住民族語言研究發展基金會製作）';
export const SONGS = {
  s01: { title: '01 aibangbang 漁獲歌', tao: 'Teyaro aibangbang na nitawaz ni ama', zh: '爸爸網到了很多飛魚', quests: ['M4', 'A2'], activity: '飛魚返航、分配漁獲' },
  s10: { title: '10 asa vasit 釣魚歌', tao: 'asa vasit adwa kawi', zh: '帶著一支 vasit 竹和二支 kawi 竹做的釣魚竿', quests: ['F1', 'G4'], activity: '近岸釣魚、魚類分類' },
  s05: { title: '05 o sikalopi 釣魚記', tao: 'O Sikalopi mi vavahay do rarahan', zh: '喔！住在路邊的 sikalopi', quests: ['F2'], activity: '漁獲裝滿網袋回家' },
  s09: { title: '09 mita mangayo 砍材歌', tao: 'mita mangayo dojim Nazagi', zh: '我們去 Nazag 砍木材', quests: ['T3', 'A1'], activity: '上山認樹、搬造舟木材' },
  s02: { title: '02 zing zing zing 小胖豬', tao: 'Zing zing zing kwak kwak kwak', zh: '小豬在沙灘上抖動及甩掉身上的沙子', quests: ['J3'], activity: '餵豬餵雞' },
  s03: { title: '03 jika cimoy 雨停吧', tao: 'Jika cimoy mo peyreherehep', zh: '天上一片烏雲，不要下雨', quests: ['P25'], activity: '下雨天、氣象站' },
  s08: { title: '08 tana lilikey 頑皮兄妹', tao: 'tana lilikei namen sira wari', zh: '雖然我們兄弟姐妹還小', quests: ['Q07'], activity: '主人家爐灶邊的日常' },
};
for (const s of Object.values(SONGS)) {
  s.source = SONG_SRC;
  s.license = 'CC BY-NC-SA 4.0（非商業、標示來源；商業用途需另向基金會申請）';
  s.url = 'https://web.klokah.tw/text/main.php?user=sing42';
  s.status = '暫定';
}
