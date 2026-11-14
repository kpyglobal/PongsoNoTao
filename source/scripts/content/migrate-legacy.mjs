// One-off: split the legacy public/data/*.json into the modular content/ tree (Phase A, 2026-11-14).
// After this ran once, content/ is the source of truth; hand-edit content/ and do not re-run.
// Re-running refuses to overwrite unless --force is given.
// Adds the new fields: quests get time / seasons / periods / tide / village / arc (from the old `when`),
// items get codex / icon / illustration keys, NPCs get role / duties / village / dialogue keys.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PUB = path.join(ROOT, 'public/data');
const OUT = path.join(ROOT, 'content');
const force = process.argv.includes('--force');
if (fs.existsSync(path.join(OUT, 'quests/open.json')) && !force) {
  console.error('content/ already migrated; pass --force to overwrite the migrated files (hand edits would be lost).');
  process.exit(1);
}
const rd = (f) => JSON.parse(fs.readFileSync(path.join(PUB, f), 'utf8'));
const wr = (rel, data) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
  console.log('wrote', rel);
};

const Q = rd('quests.json');
const R = rd('recipes.json');
const N = rd('npcs.json');
const D = rd('dialogues.json');

// ---------------------------------------------------------------- quests
const GROUP_TIME = { open: 'any', main: 'day', taro: 'day', tide: 'day', visitor: 'day', tatala: 'day', modern: 'any', lang: 'day', later: 'any', photo: 'any', member: 'day', recipe: 'any' };
const TIME_OVERRIDE = { Q06: 'any', Q07: 'any', K1: 'any', K2: 'any', K3: 'any', K4: 'any', K5: 'any', K6: 'any', X04: 'any', X05: 'any', V3: 'any', V5: 'any', H1: 'day', H2: 'day', H4: 'day', W4: 'day', B2: 'day', E3: 'day', Y1: 'day', Y2: 'day', Y3: 'day' };
const K_VILLAGE = { K1: 'imorod', K2: 'iratay', K3: 'yayo', K4: 'iraraley', K5: 'iranmeylek', K6: 'ivalino' };
const FILE_OF = { open: 'open', main: 'main-flyingfish', taro: 'taro', tide: 'tide', visitor: 'visitor', tatala: 'tatala', modern: 'modern', lang: 'language', later: 'later', photo: 'photo', member: 'member', recipe: 'recipes' };

function timeOf(qd) {
  const p = qd.when?.period;
  if (p && p.length) {
    const night = p.includes('night');
    if (night && p.length === 1) return 'night';
    if (!night) return 'day';
    return 'any';
  }
  return TIME_OVERRIDE[qd.id] ?? GROUP_TIME[qd.group] ?? 'any';
}
function seasonsOf(qd) {
  const s = qd.when?.season;
  return s === 'fishing' ? ['summer'] : s === 'nonFishing' ? ['winter'] : [];
}
const buckets = {};
for (const qd of Q.quests) {
  const { when, ...rest } = qd;
  const out = {
    id: qd.id,
    line: qd.line,
    arc: qd.group,
    village: K_VILLAGE[qd.id] ?? qd.recipe?.village ?? null,
    name: qd.name,
    time: timeOf(qd),
    seasons: seasonsOf(qd),
    ...(when?.period ? { periods: when.period } : {}),
    ...(when?.tide ? { tide: when.tide } : {}),
    ...rest,
  };
  delete out.group;
  const f = FILE_OF[qd.group] ?? qd.group;
  (buckets[f] ??= []).push(out);
}
for (const [f, quests] of Object.entries(buckets)) {
  wr(`quests/${f}.json`, { file: f, source: 'migrated from public/data/quests.json (scripts/build-quests.mjs, planning Page)', quests });
}

// songs + phrases (quest-side shared tables)
wr('songs.json', { songs: Q.songs });
wr('phrases.json', { phrases: Q.phrases });

// ---------------------------------------------------------------- items (legacy ids)
const NUT = Object.fromEntries(R.ingredients.map((i) => [i.id, i]));
const ITEM_META = {
  headlamp: { cat: 'tool', desc: '晚上走潮間帶或回部落時照路用。', codex: '頭燈讓雙手空出來。夜晚觀察生物時，請把光壓低、別直射動物的眼睛。' },
  sunscreen: { cat: 'tool', desc: '島上的陽光很強，下水和走潮間帶前先擦。', codex: '選對珊瑚礁比較友善的防曬，或改穿長袖防曬衣。' },
  water: { cat: 'tool', desc: '一瓶飲水，自己喝或帶給忙碌的家人。', codex: '在田裡、海邊工作時記得補水。島上的水得來不易，喝多少裝多少。' },
  lifejacket: { cat: 'tool', desc: '向租車行老闆借來的救生衣。', codex: '下水、上船前都要穿好。海況不好時，族人也會說「今天不要下去」。' },
  alibangbang: { cat: 'ingredient', desc: '飛魚季從海上帶回來的飛魚。', codex: '飛魚是 Tao 文化的核心。怎麼捕、怎麼分、怎麼煮、何時停，都有規矩；遊戲只呈現族人同意公開的部分。', sensitive: true },
  soli: { cat: 'ingredient', desc: '水芋田裡採收的水芋。', codex: '水芋是 Tao 的主食，由女性長輩帶領種植與照顧。田是家族的，要採之前一定要先問。' },
  wakay: { cat: 'ingredient', desc: '地瓜，飽足又耐放。', codex: '地瓜種在旱田，是水芋之外重要的主食。旅人多半在雜貨店買。族語名暫定，還要請族人確認。' },
  ovi: { cat: 'ingredient', desc: '山邊採來的山藥。', codex: '山藥口感滑順、好消化。採集的地點與時節還要請族人確認；族語名暫定。', sensitive: true },
  shellfish: { cat: 'ingredient', desc: '退潮時在潮間帶撿的貝類。', codex: '太小的不撿、只拿需要的量。哪些能撿、什麼時候撿，各部落有自己的規矩。', sensitive: true },
  seaweed: { cat: 'ingredient', desc: '潮間帶採的海菜。', codex: '退潮時在礁石上採。海菜含碘與礦物質，常和芋頭、地瓜一起吃。族語名還要請族人確認。' },
};
const items = [];
for (const [id, v] of Object.entries(Q.items)) {
  const m = ITEM_META[id];
  const n = NUT[id];
  items.push({
    id,
    name: { zh: v.zh, tao: n?.tao ?? '' },
    category: m.cat,
    collectible: true,
    description: m.desc,
    codex: m.codex,
    ...(n?.nutrition ? { nutrition: n.nutrition } : {}),
    icon: `icon_${id}`,
    illustration: `illus_${id}`,
    ...(Q.ingredients?.[id] ? { how: Q.ingredients[id].how } : {}),
    ...(m.sensitive ? { review: true } : {}),
  });
}
// coconut: codex-only (seen at 小蘭嶼, not collected)
const coco = NUT.coconut;
items.push({ id: 'coconut', name: { zh: '椰子', tao: '' }, category: 'observe', collectible: false, description: '從紅頭望向小蘭嶼時提到的椰子。', codex: '小蘭嶼一帶的椰子常被族人一併提起。遊戲裡只看不採。', nutrition: coco.nutrition, icon: 'icon_coconut', illustration: 'illus_coconut' });
wr('items/legacy.json', { items });

// ---------------------------------------------------------------- recipes
const VZ = { 野銀: 'ivalino', 紅頭: 'imorod', 椰油: 'yayo', 朗島: 'iraraley', 東清: 'iranmeylek', 漁人: 'iratay' };
const recipeQuest = Object.fromEntries(Q.quests.filter((x) => x.recipe).map((x) => [x.recipe.id, x]));
const recipes = R.recipes.map((r) => {
  const qd = recipeQuest[r.id];
  const until = qd?.steps.find((s) => s.kind === 'auto')?.until;
  const ing = {};
  for (const c of until?.all ?? []) if (c.item) ing[c.item] = c.min;
  return {
    id: r.id,
    name: { zh: r.zh, tao: r.tao },
    village: r.village ? VZ[r.village] : null,
    keeper: qd?.recipe?.keeper ?? null,
    quest: qd?.id ?? null,
    ingredients: Object.keys(ing).length ? ing : r.id === 'fish-and-taro' ? { alibangbang: 1, soli: 1 } : {},
    seasons: qd ? seasonsOf(qd) : [],
    unlockedBy: r.unlockedBy,
    steps: r.steps,
    nutrition: r.nutrition,
    ...(r.clinicNote ? { clinicNote: true } : {}),
    icon: `dish_${r.id}`,
    illustration: `illus_dish_${r.id}`,
    review: true,
  };
});
wr('recipes/recipes.json', { recipes });

// ---------------------------------------------------------------- npcs
const ROLE = {
  elder_yayo: ['akey', ['flyingfish', 'net'], '飛魚季出海、漁網與漁團'],
  elder_iraraley: ['akey', ['boat'], '造拼板舟、上山選木'],
  elder_iranmeylek: ['akey', ['boat', 'flyingfish'], '拼板舟出海、繩索與划槳'],
  elder_ivalino: ['akey', ['flyingfish'], '飛魚季的規矩與漁獲分配'],
  elder_imorod: ['akey', ['hunt'], '上山（照顧羊群）與山林'],
  elder_iratay: ['akey', ['flyingfish'], '飛魚季出海與分魚'],
  elder_f_yayo: ['akes', ['food'], '食物：煮食與保存'],
  elder_f_iraraley: ['akes', ['field'], '田地：山藥與小米'],
  elder_f_iranmeylek: ['akes', ['food', 'tide'], '潮間帶採集與料理'],
  villager_taro: ['akes', ['taro'], '水芋田'],
  weaver_elder: ['akes', ['weaving'], '織布'],
  elder_f_iratay: ['akes', ['field', 'taro'], '田地：地瓜與水芋'],
};
const KEEPER = { elder_f_yayo: 'rc-dried-flyingfish', elder_f_iraraley: 'rc-boiled-yam', elder_f_iranmeylek: 'rc-shellfish-seaweed', villager_taro: 'rc-boiled-taro', weaver_elder: 'rc-boiled-flyingfish', elder_f_iratay: 'rc-taro-sweetpotato' };
const OUTSIDER = new Set(['tourist_a', 'tourist_b', 'clinic_doctor', 'nutritionist', 'geologist']);
const QUEST_VILLAGER = new Set(['villager_iranmeylek', 'villager_iratay']);
const VILLAGES = ['yayo', 'iraraley', 'iranmeylek', 'ivalino', 'imorod', 'iratay'];
const villageOf = (n) => {
  if (VILLAGES.includes(n.home)) return n.home;
  if (['yayo_shop', 'yayo_school', 'rental', 'dive_shop', 'harbor'].includes(n.home)) return 'yayo';
  if (['clinic', 'clinic_yard'].includes(n.home)) return 'imorod';
  if (n.home === 'airport') return 'iratay';
  return null;
};
const npcs = N.npcs.map((n) => {
  const r = ROLE[n.id];
  let role = r ? (r[0] === 'akey' ? 'elder_m' : 'elder_f') : QUEST_VILLAGER.has(n.id) ? 'questVillager' : /_[abc]$/.test(n.id) ? 'ambient' : OUTSIDER.has(n.id) ? 'outsider' : 'service';
  return {
    id: n.id,
    name: n.name,
    role,
    village: villageOf(n),
    ...(r ? { duties: r[1], dutyText: r[2] } : {}),
    ...(KEEPER[n.id] ? { recipeKeeper: KEEPER[n.id] } : {}),
    outsider: OUTSIDER.has(n.id),
    talkable: role !== 'ambient',
    dialogue: n.interact ?? null,
    ...n,
  };
});
// the dialogue id the new dialogue files define for each talkable NPC without one
for (const n of npcs) {
  if (n.role === 'elder_m' || n.role === 'elder_f' || n.role === 'questVillager') n.dialogue = `dlg_${n.id}`;
  if (['clinic_doctor', 'nutritionist', 'culture_worker', 'geologist'].includes(n.id)) n.dialogue = `dlg_${n.id}`;
  delete n.interact;
}
wr('npcs/cast.json', { note: 'role: elder_m = a akey (漁獵、拼板舟), elder_f = a akes (芋頭、食物、紡織); recipeKeeper = recipe id she teaches.', npcs });

// ---------------------------------------------------------------- dialogue (legacy, as is)
const { notes, ...dialogues } = D;
wr('dialogue/legacy.json', { note: notes, dialogues });

// ---------------------------------------------------------------- photo spots (legacy quests P01–P27 + U)
const spots = [];
for (const qd of Q.quests.filter((x) => x.line === 'photo')) {
  const st = qd.steps.find((s) => s.spot);
  const ps = st ? Q.photoSpots[st.spot] : null;
  spots.push({
    id: `ps_${qd.id.toLowerCase()}`,
    quest: qd.id,
    name: { zh: qd.name.zh.replace(/^拍/, '') },
    ...(ps?.landmark ? { landmark: ps.landmark } : {}),
    ...(ps?.place ? { place: ps.place } : {}),
    ...(st && !ps ? { place: st.spot } : {}),
    r: st?.r ?? null,
    time: timeOf(qd),
    seasons: seasonsOf(qd),
    ...(qd.when?.period ? { periods: qd.when.period } : {}),
    status: st ? 'placed' : 'placeholder',
    distanceOnly: /遠拍|只拍景|先問/.test(qd.name.zh),
  });
}
wr('photoSpots/legacy.json', { photoSpots: spots });

// ---------------------------------------------------------------- meta / places / misc
const P = rd('places.json');
wr('places.json', {
  world: P.world,
  places: P.places,
  derived: {
    note: 'Code computes these positions (src/world/places.ts addQuestPlaces / hostPlaces). Listed so content can reference them.',
    ids: ['yayo_shop', 'yayo_school', 'rental', 'dive_shop', 'clinic_yard', 'hen_rock_bay', 'yayo_dive', 'tide_iranmeylek', 'host_home', 'host_taro', 'host_weave'],
  },
  landmarks: ['hongtoushan', 'dasenshan', 'qingqing', 'battleship', 'twinlions'],
});
fs.copyFileSync(path.join(PUB, 'glossary.json'), path.join(OUT, 'glossary.json'));
fs.copyFileSync(path.join(PUB, 'milestones.json'), path.join(OUT, 'milestones.json'));
console.log('copied glossary.json, milestones.json');
wr('meta.json', {
  version: 1,
  notes: Q.notes,
  roles: Q.roles,
  respect: Q.respect,
  elders: Q.elders,
  villages: VILLAGES,
  times: ['day', 'night', 'any'],
  periods: ['dawn', 'day', 'dusk', 'night'],
  seasons: {
    summer: { zh: '夏季・飛魚季', gameSeasons: ['meyvanwa', 'rayon', 'manoyotoyon'], note: '晴朗、海色鮮亮' },
    winter: { zh: '冬季・東北季風', gameSeasons: ['off'], note: '天色灰藍、浪大，植物仍是綠的。不會下雪。' },
  },
  tokens: {
    '@host': '主人家的長輩', '@giver': '依任務 giver（f / m）找主人家部落的 a akes / a akey', '@hostf': '主人家部落的 a akes（在簷廊）',
    '@m': '族男', '@f': '族女', '@t': '旅人', '@npc': '目前對話的 NPC', '@me': '目前操控的隊員', 旁白: '旁白', 文化聲明: '文化聲明',
  },
  externalFlags: {
    party_created: '建立隊伍（角色選擇後）', injured: '受傷事件', crab_season: '陸蟹季（季節事件）', met_coconut_crab: '遇到椰子蟹',
    year_done: '一年結束', tao_hint_heard: '聽到長輩的族語提示', met_dietitian: '遇到營養師', met_npc_dive_coach: '和潛水教練說過話',
    u1_by_t: '旅人完成 U1', met_thatch_elder: '遇到割茅草的長輩', saw_goats: '看到山上的羊',
    saw_scops_owl: '夜晚在路邊聽到蘭嶼角鴞', heard_gathering: '在部落聽到晚會的消息',
  },
  externalProgress: {
    respect: '尊重分數由遊戲事件累積（Q04 = first、V1 = learning；trusted / friend 由尊重事件達成）',
    count: '計數器（photos、lowTideOnTime…）由遊戲事件累積',
  },
});
