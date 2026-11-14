// Steps + hints for the quests that are playable end-to-end in Phase 1 batch 1.
// Everything else gets one placeholder step (see build-quests.mjs).
// Speakers: '@npc' = the NPC talked to, '@me' = the controlled member, '@m' / '@f' / '@t' = a party member,
// any other string is shown as is. Tao text is only taken from the sourced 暫定 table on the planning Page.
//
// step.kind: talk (npc), spot (place / landmark within r), photo (traveller only), auto (completes by itself)
// step.actor: roles that may do the step ('m' 族男, 'f' 族女, 't' 旅人; omitted = anyone)
// step.need:  who must be present (each entry is a set of roles, e.g. ['t', 'mf'] = traveller + one 族人)

const keyVisit = (id, npc, village, extra) => ({
  steps: [{
    kind: 'talk', npc,
    text: `到${village}，拜訪部落的關鍵人物`,
    lines: [
      { who: '@npc', zh: `你們來啦，歡迎到${village}。` },
      ...extra,
      { who: '@npc', zh: '有空再來坐坐，部落的事慢慢認識就好。' },
    ],
    gives: { flags: [`met_${id}`], relation: 1 },
  }],
  hint: { tier: 'vague', from: '村民', zh: `聽說${village}有位長輩很照顧來訪的人，去部落裡問問看。` },
});

export const PLAYABLE = {
  Q01: {
    steps: [{
      kind: 'auto', text: '全隊一起搭船抵達開元港',
      lines: [
        { who: '文化聲明', zh: '遊戲中呈現的男女分工、禁忌與飲食規範，以達悟族傳統文化中的一般性做法為設計起點，不代表所有家庭、部落或時代都完全如此。' },
        { who: '文化聲明', zh: '各部落在祭儀時程、禁忌細節與飲食習慣上各有差異，現代家庭的分工也已有許多變化。遊戲中不模擬祭儀本身，只呈現族人同意公開的飲食與生活面向。' },
        { who: '@m', zh: '到了！船靠岸了。這裡就是開元港。' },
        { who: '@f', zh: '先去港口旁的租車行租機車，再回家跟家人報到吧。' },
        { who: '@t', zh: '好期待！你們帶路，我跟著走。' },
      ],
    }],
    hint: { tier: 'direct', from: '族人', zh: '全隊已經一起上島了。' },
  },
  Q02: {
    steps: [{
      kind: 'talk', npc: 'rental_owner', text: '到開元港旁的租車行租機車',
      lines: [
        { who: '@npc', zh: '要租機車嗎？一台給你們，三個人輪流騎都可以。' },
        { who: '@npc', zh: '環島公路晚上要騎慢一點，路上常有陸蟹過馬路。' },
      ],
      gives: { flags: ['has_scooter'], toast: ['機車租好了', '全隊都能騎。按「機車」或 M 鍵切換。'] },
    }],
    hint: { tier: 'direct', from: '族人', zh: '開元港旁邊就有租車行，老闆就站在店門口。' },
  },
  Q03: {
    steps: [{
      kind: 'talk', npc: '@host', actor: ['m', 'f'], text: '族男或族女回到家鄉部落，向主人家長輩報到',
      lines: [
        { who: '@npc', zh: '回來啦！路上累了吧？' },
        { who: '@npc', zh: '家裡都準備好了，你們的朋友也一起住下來。糧倉在屋子旁邊，以後一起照顧。' },
      ],
      gives: { flags: ['host_family', 'granary'], toast: ['回家報到', '主人家庭與糧倉已加入筆記本。'] },
    }],
    hint: { tier: 'direct', from: '族人', zh: '由族男或族女回家鄉部落，找主人家的長輩。' },
  },
  Q04: {
    steps: [{
      kind: 'talk', npc: 'elder_yayo', actor: ['t'], need: ['t', 'mf'], text: '旅人和一位族人一起，請椰油的長輩帶路認識部落',
      lines: [
        { who: '@npc', zh: '這裡是椰油，開元港就在旁邊，很多人從這裡上島。' },
        { who: '@npc', zh: '走在部落裡先打招呼。想拍人或家屋，記得先問一聲。' },
        { who: '@t', zh: '好，我會先問。謝謝您！' },
      ],
      gives: { respect: 'first', toast: ['尊重值：初訪', '旅人的文化尊重開始記錄。'] },
    }],
    hint: { tier: 'direct', from: '主人家', zh: '請旅人和一位族人一起去椰油，找椰油的長輩。' },
  },
  Q05: {
    steps: [{ kind: 'auto', text: '拜訪六部落關鍵人物中的任四位（K1–K6）', until: { any: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'], n: 4 } }],
    hint: { tier: 'tao', from: '紅頭的長輩', npc: 'elder_imorod', phrase: 'mangay', zh: '長輩說自己也要先去找一找——意思是：別等人來，自己去各部落找人。拜訪六部落的關鍵人物吧。' },
  },
  Q07: {
    steps: [{
      kind: 'talk', npc: '@host', need: ['m', 'f', 't'], text: '全隊到主人家，聽長輩說明島上的規矩',
      lines: [
        { who: '@npc', zh: '大家都到了，我說說島上的規矩。' },
        { who: '@npc', zh: '飛魚季的時候，灘頭和拼板舟有很多規矩。旅人不要進灘頭，也不要碰船。' },
        { who: '@npc', zh: '女孩子在飛魚季不碰拼板舟、不上船。' },
        { who: '@npc', zh: '部落的祭儀不要靠近，也不要拍。想拍人或家屋，先問一聲。' },
        { who: '@npc', zh: '曬魚架上的魚，是一家人一整年的糧食，不要隨便碰。' },
        { who: '@npc', zh: '每個家庭、每個部落做法不太一樣，不懂就問。' },
      ],
      gives: { flags: ['rules_page', 'respect_scoring'], toast: ['規矩頁', '筆記本加上「島上的規矩」，尊重事件開始計分。'] },
    }],
    hint: { tier: 'direct', from: '主人家', zh: '回報到、導覽都完成後，三個人一起到主人家找長輩。' },
  },
  K1: keyVisit('K1', 'elder_imorod', '紅頭', [{ who: '@npc', zh: '衛生所也在紅頭這一帶，受傷了就去那裡。' }]),
  K2: keyVisit('K2', 'villager_iratay', '漁人', [{ who: '@npc', zh: '機場就在我們部落旁邊，飛機起降都看得到。' }]),
  K3: keyVisit('K3', 'elder_yayo', '椰油', [{ who: '@npc', zh: '開元港的船都在這裡靠岸。' }]),
  K4: keyVisit('K4', 'elder_iraraley', '朗島', [{ who: '@npc', zh: '朗島在北岸，潮間帶很寬。' }]),
  K5: keyVisit('K5', 'villager_iranmeylek', '東清', [{ who: '@npc', zh: '東清灣是島上最早看到日出的地方之一。' }]),
  K6: keyVisit('K6', 'elder_ivalino', '野銀', [{ who: '@npc', zh: '野銀的地下屋保存得很完整，拍照之前要先問屋主。' }]),
  X01: {
    steps: [{
      kind: 'talk', npc: 'teacher_yayo', text: '白天到椰油的學校找族語老師',
      lines: [
        { who: '@npc', zh: '你們好，我在這裡的學校教族語。' },
        { who: '@npc', zh: '聽到長輩說的族語，不懂的話就記下來，帶來問我。學會的詞會寫進筆記本的詞彙表。' },
      ],
      gives: { flags: ['vocab_page'], toast: ['族語詞彙表', '筆記本的「族語詞卡」可以開始收集了。'] },
    }],
    hint: { tier: 'direct', from: '租車行老闆', zh: '族語老師白天在椰油的學校。' },
  },
  X02: {
    steps: [{
      kind: 'talk', npc: 'teacher_yayo', text: '跟族語老師學第一句：akokey（你好）',
      lines: [
        { who: '@npc', zh: '第一句就學打招呼。', tao: 'akokey' },
        { who: '@npc', zh: '見到長輩就說 akokey，大家都會很高興。' },
      ],
      gives: { glossary: ['akokey'] },
    }],
    hint: { tier: 'direct', from: '族語老師', zh: '再跟族語老師說一次話，學第一句。' },
  },
  X03: {
    steps: [{
      kind: 'talk', npc: 'teacher_yayo', text: '把長輩只說族語的提示帶給族語老師翻譯',
      translate: true,
      lines: [
        { who: '@npc', zh: '長輩跟你們說了族語？我看看筆記。' },
      ],
      gives: { glossary: ['wawa'], toast: ['翻譯流程', '之後聽到只說族語的提示，都可以帶來給老師翻譯。'] },
    }],
    hint: { tier: 'direct', from: '族語老師', zh: '聽到長輩只說族語的提示後，帶回椰油的學校給老師翻譯。' },
  },
  V1: {
    steps: [{
      kind: 'talk', npc: 'villager_taro', actor: ['t'], text: '旅人主動問族人：有什麼可以幫忙的？',
      lines: [
        { who: '@t', zh: '請問有什麼我可以幫忙的嗎？' },
        { who: '@npc', zh: '好啊，謝謝你主動問。先幫忙把田埂上的草拔一拔。' },
        { who: '@npc', zh: '下次跟著家裡的人一起來田裡，再慢慢學。' },
      ],
      gives: { respect: 'learning', toast: ['尊重值：學習中', '旅人可以跟族人一起體驗潮間帶與水芋田了。'] },
    }],
    hint: { tier: 'vague', from: '村民', zh: '芋頭田那邊常有長輩在忙，問問看能不能幫忙吧。' },
  },
  I1: {
    steps: [{
      kind: 'talk', npc: 'harbor_staff', text: '請開元港港務人員教你看潮汐時鐘',
      lines: [
        { who: '@npc', zh: '出海、下潮間帶前都要先看潮汐。' },
        { who: '@npc', zh: '一天大約有兩次退潮。我把潮汐時鐘放在你們的畫面上方，退潮時才去潮間帶。' },
      ],
      gives: { flags: ['tide_clock'], toast: ['潮汐時鐘', '畫面上方會顯示漲潮或退潮。（目前簡化成清晨與黃昏退潮）'] },
    }],
    hint: { tier: 'direct', from: '租車行老闆', zh: '開元港的港務人員最懂潮汐。' },
  },
  I2: {
    steps: [{
      kind: 'spot', spot: 'iraraley', r: 10, actor: ['f'], text: '退潮時，族女到朗島的潮間帶（旅人可以跟著去）',
      lines: [
        { who: '@f', zh: '退潮了，礁岩露出來了。' },
        { who: '@f', zh: '貝類、海藻的族語名稱還要請族人告訴我們，今天先用中文記下來。' },
      ],
      gives: { flags: ['tidepool_seen'], counter: { lowTideOnTime: 1 } },
    }],
    hint: { tier: 'tao', from: '朗島的長輩', npc: 'elder_iraraley', phrase: 'ikongo', zh: '長輩問「海裡有什麼呢？」——意思是要你們退潮時去潮間帶看看。先看懂潮汐時鐘，再請族女帶路。' },
  },
  S1: {
    steps: [{
      kind: 'talk', npc: 'shop_yayo', text: '到椰油的雜貨店買頭燈',
      lines: [{ who: '@npc', zh: '頭燈嗎？晚上走路用得到。電池也幫你裝好了。' }],
      gives: { items: ['headlamp'], toast: ['取得：頭燈', '夜晚的陸蟹（C1）需要它。'] },
    }],
    hint: { tier: 'direct', from: '族人', zh: '椰油的雜貨店什麼都有。' },
  },
  S2: {
    steps: [{
      kind: 'talk', npc: 'shop_yayo', text: '到雜貨店買防曬與飲水',
      lines: [{ who: '@npc', zh: '島上太陽很大，防曬和水都帶著。' }],
      gives: { items: ['sunscreen', 'water'], toast: ['取得：防曬、飲水', '潮間帶撿貝類（G3）需要防曬。'] },
    }],
    hint: { tier: 'direct', from: '族人', zh: '椰油的雜貨店有防曬和水。' },
  },
  S3: {
    steps: [{
      kind: 'talk', npc: 'rental_owner', actor: ['t'], text: '旅人向租車行老闆借救生衣',
      lines: [
        { who: '@t', zh: '請問可以借救生衣嗎？' },
        { who: '@npc', zh: '可以啊。下水一定要穿好，安全第一。' },
      ],
      gives: { items: ['lifejacket'], toast: ['取得：救生衣', '母雞岩浮潛（U1）與非飛魚季拼板舟體驗（V4）需要它。'] },
    }],
    hint: { tier: 'direct', from: '租車行老闆', zh: '救生衣可以跟租車行借。' },
  },
  C1: {
    steps: [{
      kind: 'spot', spot: 'iraraley', r: 12, actor: ['f'], text: '夜裡，族女帶著頭燈在朗島附近看看陸蟹（旅人可以跟著去）',
      lines: [
        { who: '@f', zh: '頭燈照到了，路邊有螃蟹在走。', tao: 'kalang' },
        { who: '@f', zh: '陸蟹的季節和規矩還要請族人確認，今晚先只看、不抓。' },
      ],
      gives: { glossary: ['kalang'] },
    }],
    hint: { tier: 'vague', from: '村民', zh: '晚上路邊常看得到螃蟹，記得帶頭燈。' },
  },
  X04: {
    steps: [{ kind: 'auto', text: '詞彙表收集 10 個詞', until: { count: 'words', min: 10 } }],
    hint: { tier: 'direct', from: '族語老師', zh: '多跟長輩、族人說話，學到的詞會自動寫進詞彙表。' },
  },
  P09: { photo: 'twinlions', hint: { tier: 'vague', from: '村民', zh: '沒有月亮的晚上，雙獅岩那邊的星星很多。' } },
  P10: { photo: 'battleship', hint: { tier: 'vague', from: '村民', zh: '軍艦岩在西北外海，只能從岸上遠遠地拍。' } },
  P20: { photo: 'qingqing', hint: { tier: 'vague', from: '村民', zh: '黃昏的時候去青青草原看看。' } },
  P23: { photo: 'harbor', hint: { tier: 'direct', from: '港務人員', zh: '白天在開元港就能拍。' } },
  P24: { photo: 'airport', hint: { tier: 'direct', from: '族人', zh: '機場在漁人部落旁，只拍景，不拍旅客。' } },
};
