// Phase 1 batch 1b: underwater (U1–U3), 族人分工 (J1–J3, A3) and the taro-field steps R1–R3 that lead to them.
// Same step grammar as playable.mjs; extra step fields:
//   dive: 'A' | 'B' | 'POV'  → plays the underwater moment, then collects the picture (one per spot)
// Content rules: no invented Tao words or customs, no ritual simulation, taboos only as narration.
// Unconfirmed details are said as「還要請族人確認」in the lines (the 暫定 marks stay in the data / Page).

export const PLAYABLE_1B = {
  U1: {
    steps: [{
      kind: 'spot', spot: 'hen_rock_bay', r: 10, dive: 'A', text: '到母雞岩下方的海灣浮潛（誰都可以，穿好救生衣）',
      lines: [
        { who: '@me', zh: '水好清，往下看就是珊瑚，小丑魚在裡面鑽來鑽去。' },
        { who: '旁白', zh: '這裡是現代的觀光浮潛點，誰都能來。飛魚季時部落灘頭不能浮潛，所以只在非飛魚季開放。' },
      ],
      gives: { toast: ['水下美景', '已收進「相簿與水下」。'] },
    }],
    hint: { tier: 'direct', from: '租車行老闆', zh: '母雞岩下方的海灣很適合浮潛。記得先借救生衣，飛魚季時不能下水。' },
  },
  U2: {
    steps: [
      {
        kind: 'talk', npc: 'dive_coach', text: '在開元港旁的潛水店，聽潛水教練說明',
        lines: [
          { who: '@npc', zh: '我是這裡的潛水教練，也是在島上長大的。今天帶你在椰油港外面的平台看看。' },
          { who: '@npc', zh: '我們只停在平台邊緣，不往斷崖下潛。飛魚季的時候椰油斷層也不能潛，要等季節過了。' },
        ],
      },
      {
        kind: 'spot', spot: 'yayo_dive', r: 10, dive: 'B', text: '跟著教練到椰油港外的平台邊緣做淺水氣瓶潛水',
        lines: [
          { who: '@me', zh: '平台外面一下子就變成深藍色，一大群魚從外海游過去。' },
        ],
        gives: { toast: ['水下美景', '已收進「相簿與水下」。'] },
      },
    ],
    hint: { tier: 'direct', from: '族人', zh: '開元港旁邊的潛水店有位族人教練，先去找他聊聊。' },
  },
  U3: {
    steps: [{
      kind: 'spot', spot: 'hen_rock_bay', r: 10, dive: 'POV', actor: ['t'], text: '旅人帶著相機再去母雞岩浮潛，拍一組水下照片',
      lines: [{ who: '@t', zh: '這次換我用相機拍，珊瑚、魚群都想留下來。' }],
      gives: { toast: ['旅人水下照片', '3 張照片已收進「相簿與水下」。'] },
    }],
    hint: { tier: 'direct', from: '旅人', zh: '浮潛的時候帶相機，應該可以拍到很不一樣的畫面。' },
  },
  R1: {
    steps: [{
      kind: 'spot', spot: 'host_taro', r: 8, actor: ['m'], text: '族男到主人家的水芋田，幫忙開墾、整地、引水',
      lines: [
        { who: '@m', zh: '先把田裡的雜石搬開，再把水道清乾淨，讓山上的水流進田裡。' },
        { who: '旁白', zh: '依文獻記載，開墾水芋田多由男子負責，種植、除草與採收多由女子負責；各家做法不同，細節還要請族人確認。' },
      ],
      gives: { flags: ['taro_field_ready'] },
    }],
    hint: { tier: 'direct', from: '主人家', zh: '主人家的水芋田要先整地、引水，請族男去幫忙。' },
  },
  R2: {
    steps: [{
      kind: 'spot', spot: 'host_taro', r: 8, actor: ['f'], text: '族女到水芋田種植水芋',
      lines: [{ who: '@f', zh: '水引進來了，可以種了。種法和時間我再問問家裡的長輩。' }],
    }],
    hint: { tier: 'direct', from: '主人家', zh: '田整好了，換族女去種水芋。' },
  },
  R3: {
    steps: [{
      kind: 'spot', spot: 'host_taro', r: 8, actor: ['f'], text: '族女到水芋田除草、照顧田地',
      lines: [{ who: '@f', zh: '把田裡的雜草拔掉，水芋才長得好。' }],
      gives: { counter: { ecology: 1 } },
    }],
    hint: { tier: 'direct', from: '主人家', zh: '水芋田要常常除草，族女會去照顧。' },
  },
  A3: {
    steps: [{
      kind: 'spot', spot: 'host_taro', r: 8, actor: ['m'], text: '飛魚季後，族男修整田埂與灌溉水道',
      lines: [
        { who: '@m', zh: '田埂被水沖壞了一點，補一補，水道也清一清。' },
        { who: '旁白', zh: '修田埂的月份還要請族人確認。' },
      ],
      gives: { counter: { ecology: 1 }, toast: ['水芋田照顧卡', '已寫進手札。'] },
    }],
    hint: { tier: 'direct', from: '主人家', zh: '非飛魚季的時候，田埂和水道要整理。' },
  },
  J1: {
    steps: [{
      kind: 'talk', npc: 'weaver_elder', actor: ['f'], text: '族女跟婦女長輩處理苧麻：剝皮、浸泡、曬乾',
      lines: [
        { who: '@npc', zh: '來，苧麻的皮這樣剝下來，泡在水裡，再拿去曬乾。' },
        { who: '@f', zh: '原來要這麼多步驟，才會變成可以織的線。' },
        { who: '旁白', zh: '依文獻記載，飛魚汛期婦女不織布，所以這件事在非飛魚季才做；各部落細節還要請族人確認。' },
      ],
      gives: { flags: ['ramie_card'], toast: ['苧麻圖鑑', '已寫進手札。'] },
    }],
    hint: { tier: 'direct', from: '主人家', zh: '部落裡的婦女長輩在處理苧麻，族女可以去幫忙。' },
  },
  J2: {
    steps: [{
      kind: 'talk', npc: 'weaver_elder', actor: ['f'], text: '族女在簷廊看婦女長輩織一小段布',
      lines: [
        { who: '@npc', zh: '這是背帶織布機，腰靠著這條帶子，線就拉緊了。你先看就好。' },
        { who: '旁白', zh: '織布有一些禁忌，例如喪忌期間不碰織布機、男子不跨過織布機。這裡只用旁白說明，遊戲不會讓你去做。' },
        { who: '旁白', zh: '織紋與禮衣不在這裡呈現，等族人校對後再決定。' },
      ],
      gives: { flags: ['weaving_card'], toast: ['織布學習卡', '已寫進手札。'] },
    }],
    hint: { tier: 'direct', from: '婦女長輩', zh: '苧麻曬好了，族女可以來簷廊看看織布。' },
  },
  J3: {
    steps: [{
      kind: 'spot', spot: 'host_home', r: 7, actor: ['f'], text: '族女在主人家附近餵豬、餵雞',
      lines: [
        { who: '@f', zh: '豬和雞都餓了，先餵牠們。', tao: 'kois' },
        { who: '@f', zh: '餵完再去看看糧倉。' },
      ],
      gives: { glossary: ['kois'], flags: ['granary'] },
    }],
    hint: { tier: 'direct', from: '主人家', zh: '家屋旁邊的豬和雞要有人餵，族女會去。' },
  },
};

/** 活動歌謠 attached to activities (shown as text with an ⓘ source line when the quest is done) */
export const SONG_OF = { M4: 's01', A2: 's01', F1: 's10', G4: 's10', F2: 's05', T3: 's09', A1: 's09', J3: 's02', P25: 's03', Q07: 's08' };
