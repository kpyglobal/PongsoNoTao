"""方案二 (歧路旅人風) cast: four player looks, key NPCs (one unique look each) and ambient villager bases + outfits. Everyday island / travel clothes, no costumes."""

SKIN = {'tan': '#D4956A', 'deep': '#B47650', 'light': '#EDC29E', 'fair': '#F2CDAE', 'brown': '#9A6040', 'golden': '#E2AB74', 'golden_m': '#D9A06A', 'golden_d': '#CB915C'}
HAIR = {'black': '#3A2F3C', 'grey': '#C2BDB6', 'brown': '#4B3528', 'sandy': '#B98A52', 'greyblk': '#77737A', 'chestnut': '#6A4630', 'white': '#E2DED8'}

CAST = {
    # ---------------- players (each also gets ride_ and canoe_ sheets)
    'player': dict(name='族人男青年', sex='m', skin='golden_m', hair=('wavy', 'black'),
                   top=dict(kind='shirt', short=True, tee='#34363C', shirt='#62656C', pocket=('#B33A30', '#EDE3CE', '#22202A')),
                   bottom=dict(kind='shorts', col='#8C7D5E'), shoes='sandal', beads=True),
    'player_f': dict(name='族人女青年', sex='f', skin='golden', hair=('lowtail', 'black'), tie=('#B33A30', '#EDE3CE', '#22202A'),
                     top=dict(kind='shirt', tee='#F4F1EA', shirt='#8DAED0'),
                     bottom=dict(kind='skirt', col='#34477E', hem='#EDE3CE'), shoes='sandal', beads=True),
    # 臺灣本島旅人 (matches the painted visitor_m / visitor portraits: brown wavy hair, olive-green open shirt over a white tee)
    'player_visitor': dict(name='本島男旅人', sex='m', skin='light', glasses='#5A4A3E', round_glasses=True, hair=('wavy', 'chestnut'),
                           top=dict(kind='shirt', tee='#F4F1EA', shirt='#788C50'),
                           bottom=dict(kind='shorts', col='#C4AE84'), shoes='shoe', shoe='#5C534C',
                           pack='#6A7646', camera=True),
    'player_visitor_f': dict(name='本島女旅人', sex='f', skin='light', glasses='#5A4A3E', round_glasses=True, hair=('wavylong', 'chestnut'), hat=('bucket', '#E3D5B0'),
                             top=dict(kind='shirt', tee='#F6F3EC', shirt='#7E9356'),
                             bottom=dict(kind='pants', col='#4F6A8F'), shoes='shoe', shoe='#ECE6DA',
                             pack='#6E7A48', camera=True),
    # 外國旅人: ordinary backpackers
    'player_foreign': dict(name='外國男旅人', sex='m', skin='fair', hair=('short', 'sandy'),
                           top=dict(kind='tee', tee='#3FA39C'),
                           bottom=dict(kind='shorts', col='#33415E'), shoes='shoe', shoe='#6B625A',
                           pack='#C2552F', bigpack=True),
    'player_foreign_f': dict(name='外國女旅人', sex='f', skin='brown', hair=('puff', 'black'),
                             top=dict(kind='tee', tee='#E7B640'),
                             bottom=dict(kind='shorts', col='#6F7A4A'), shoes='shoe', shoe='#F0EBE2',
                             pack='#2F4A6B'),
    # ---------------- NPCs
    'clinic': dict(name='衛生所護理師', sex='f', skin='golden', hair=('bun', 'black'),
                   top=dict(kind='tee', tee='#6FAAA2'),
                   bottom=dict(kind='pants', col='#5F9A92'), shoes='shoe', shoe='#F0EBE2', lanyard=True, prop='clipboard'),
    'harbor': dict(name='港務人員', sex='m', skin='tan', hair=('short', 'black'), hat=('cap', '#2B3A5C'),
                   top=dict(kind='hivis', tee='#8FB0D8', vest='#E8D84A'), beard='moustache', prop='radio',
                   bottom=dict(kind='pants', col='#2B3550'), shoes='shoe', shoe='#2E2A2C'),
    'tourist': dict(name='觀光客', sex='m', skin='light', hair=('short', 'black'), hat=('cap', '#F2F0EA'),
                    top=dict(kind='tee', tee='#E07A66'),
                    bottom=dict(kind='shorts', col='#B9A57E'), shoes='shoe', shoe='#5C534C', pack='#7C8088', camera=True),
    'player_researcher': dict(name='研究訪客', sex='f', skin='light', hair=('lowtail', 'black'), hat=('bucket', '#D9C49A'),
                              top=dict(kind='vest', tee='#F2EEE6', vest='#B9A06A', stripe='#B9A06A', stripe2='#9C8452', plain=True),
                              bottom=dict(kind='pants', col='#6E7A52'), shoes='shoe', shoe='#5C534C',
                              pack='#8A6A48', prop='notebook'),
}
PLAYERS = ['player', 'player_f', 'player_visitor', 'player_visitor_f']  # 外國 looks kept in CAST for reference only (removed from the game 2026-11)
# ---------------- key NPCs: one unique look each (matches public/assets/portraits/<id>.webp)
SANDAL = dict(shoes='sandal')
CAST.update({
    'elder_yayo': dict(name='椰油耆老', sex='m', skin='golden_d', hair=('elder', 'grey'), elder=True,
                       top=dict(kind='tee', tee='#2E3F6E'), bottom=dict(kind='shorts', col='#4A4A50'), prop='net', **SANDAL),
    'elder_iraraley': dict(name='朗島耆老', sex='m', skin='golden_d', hair=('bald', 'grey'), elder=True, scale=0.92,
                           top=dict(kind='shirt', short=True, tee='#F0ECE4', shirt='#A0503E'),
                           bottom=dict(kind='pants', col='#5A5048'), prop='stick', **SANDAL),
    'elder_iranmeylek': dict(name='東清耆老', sex='m', skin='golden_d', hair=('elder', 'greyblk'), elder=True, scale=0.97, beard='moustache',
                             top=dict(kind='shirt', short=True, tee='#E9E2D2', shirt='#6B7445'),
                             bottom=dict(kind='shorts', col='#3A3A42'), prop='rope', **SANDAL),
    'elder_ivalino': dict(name='野銀耆老', sex='m', skin='golden_d', hair=('elder', 'grey'), elder=True, scale=0.91,
                          top=dict(kind='vest', tee='#8A8C90', vest='#EFE7D8', stripe='#2F4F86', stripe2='#22202A', taririk=True),
                          bottom=dict(kind='shorts', col='#3A3A42'), beads=True, **SANDAL),
    'elder_imorod': dict(name='紅頭耆老', sex='m', skin='golden_d', hair=('elder', 'greyblk'), elder=True, hat=('cap', '#7C8A9A'), glasses='#6A5A3A',
                         top=dict(kind='shirt', short=True, tee='#E9E2D2', shirt='#7FA3CC'),
                         bottom=dict(kind='shorts', col='#4A4A50'), **SANDAL),
    'elder_iratay': dict(name='漁人耆老', sex='m', skin='golden_d', hair=('bob', 'grey'), elder=True, scale=1.0, beard='goatee',
                         top=dict(kind='tee', tee='#F2EFE8'), bottom=dict(kind='shorts', col='#3E4660'), prop='basket', **SANDAL),
    'villager_taro': dict(name='水芋田長輩', sex='f', skin='golden_d', hair=('bun', 'grey'), elder=True, hat=('scarf', '#B9A27A'),
                          top=dict(kind='shirt', tee='#C9573E', shirt='#C9573E', floral=('#E9B04A', '#6E8A4A')),
                          bottom=dict(kind='pants', col='#4A4A55'), prop='leaves', **SANDAL),
    'weaver_elder': dict(name='織布長輩', sex='f', skin='golden_d', hair=('short', 'grey'), elder=True, glasses='#8A8A92',
                         top=dict(kind='tee', tee='#7A5A94'), bottom=dict(kind='longskirt', col='#3A3A50', hem='#3A3A50'),
                         prop='cloth', **SANDAL),
    'villager_harbor': dict(name='拼板舟漁人', sex='m', skin='golden_d', hair=('elder', 'black'), beard='stubble',
                            top=dict(kind='tee', tee='#4A4C52'), bottom=dict(kind='shorts', col='#26304A'), beads=True, prop='paddle', **SANDAL),
    'teacher_yayo': dict(name='族語老師', sex='f', skin='golden', hair=('long', 'black'), glasses='#3A3434',
                         top=dict(kind='shirt', tee='#EFE6D6', shirt='#8E8E92'), bottom=dict(kind='pants', col='#3E4660'),
                         shoes='shoe', shoe='#5C534C', lanyard=True, prop='notebook'),
    'shop_yayo': dict(name='雜貨店老闆', sex='f', skin='golden', hair=('puff', 'black'),
                      top=dict(kind='vest', tee='#D2533A', vest='#355C3E', stripe='#355C3E', stripe2='#355C3E', plain=True),
                      bottom=dict(kind='pants', col='#3A3A44'), **SANDAL),
    'rental_owner': dict(name='租車行老闆', sex='m', skin='golden_m', hair=('short', 'black'),
                         top=dict(kind='tee', tee='#7E8084'), bottom=dict(kind='shorts', col='#3D4A5C'), prop='keys', **SANDAL),
    'dive_coach': dict(name='潛水教練', sex='m', skin='golden_m', hair=('ponytail', 'black'),
                       top=dict(kind='tee', tee='#1F3360', band=('#2C8C96', '#1F3360')), bottom=dict(kind='shorts', col='#1F2A44'), **SANDAL),
    'clinic_doctor': dict(name='衛生所醫師', sex='m', skin='light', hair=('short', 'black'), glasses='#9AA0AA',
                          top=dict(kind='coat', tee='#93B4DA', coat='#F4F2EE'), bottom=dict(kind='pants', col='#4A5060'),
                          shoes='shoe', shoe='#3A3436'),
    'nutritionist': dict(name='營養師', sex='f', skin='golden', hair=('bob', 'black'),
                         top=dict(kind='tee', tee='#A8D4BC'), bottom=dict(kind='skirt', col='#5A6A86', hem='#5A6A86'),
                         shoes='shoe', shoe='#ECE6DA', prop='clipboard'),
    'culture_worker': dict(name='部落文化工作者', sex='m', skin='golden_m', hair=('bun', 'black'), beard='stubble',
                           top=dict(kind='shirt', tee='#E2D6BC', shirt='#E2D6BC'), bottom=dict(kind='pants', col='#5A5244'),
                           pack='#C9B48A', **SANDAL),
    # 2026-11-14: male (Larry), field notebook + hand lens like the portrait
    'geologist': dict(name='地質學家', sex='m', skin='tan', hair=('short', 'greyblk'), hat=('bucket', '#B8A57E'), beard='stubble',
                      top=dict(kind='vest', tee='#6F8FBF', vest='#A39A70', stripe='#A39A70', stripe2='#A39A70', plain=True),
                      bottom=dict(kind='pants', col='#6E6450'), shoes='shoe', shoe='#5C534C', prop='notebook'),
    # ---------------- female elders (a akes): they lead taro, food and weaving; one per village with the men
    'elder_f_yayo': dict(name='椰油的女性長輩', sex='f', skin='golden_d', hair=('bun', 'grey'), elder=True,
                         top=dict(kind='tee', tee='#2C3A66'), bottom=dict(kind='pants', col='#4A4A55'), prop='pot', **SANDAL),
    'elder_f_iraraley': dict(name='朗島的女性長輩', sex='f', skin='golden_d', hair=('short', 'white'), elder=True, scale=0.88,
                             top=dict(kind='shirt', tee='#E9E2D2', shirt='#7A2E36'), bottom=dict(kind='pants', col='#4A4A50'),
                             prop='yams', **SANDAL),
    'elder_f_iranmeylek': dict(name='東清的女性長輩', sex='f', skin='golden_d', hair=('wavylong', 'greyblk'), elder=True, scale=0.98,
                               hat=('sunhat', '#D2B47A'), top=dict(kind='tee', tee='#7F9A6A'),
                               bottom=dict(kind='longskirt', col='#3E4A5A', hem='#3E4A5A'), prop='bucket', **SANDAL),
    'elder_f_iratay': dict(name='漁人的女性長輩', sex='f', skin='golden_d', hair=('short', 'grey'), elder=True, scale=0.97,
                           top=dict(kind='tee', tee='#E2B23A'), bottom=dict(kind='pants', col='#3E4660'), prop='basin', **SANDAL),
    # ---------------- the two quest villagers (K visits), own faces
    'villager_iranmeylek': dict(name='東清的族人', sex='m', skin='golden_m', hair=('wavy', 'black'),
                                top=dict(kind='tee', tee='#5E6B45'), bottom=dict(kind='shorts', col='#3A3A42'), towel='#EFE9DD', **SANDAL),
    'villager_iratay': dict(name='漁人的族人', sex='f', skin='golden', hair=('bob', 'black'),
                            top=dict(kind='shirt', short=True, tee='#D9604E', shirt='#D9604E'), bottom=dict(kind='pants', col='#3E4660'),
                            pack='#E2D6BC', **SANDAL),
    # ---------------- ambient villagers: 6 bases (one portrait each) x 3 outfits
    'auntie': dict(name='部落阿姨', sex='f', skin='golden', hair=('bob', 'black'), hat=('cap', '#D9B77E'),
                   top=dict(kind='tee', tee='#E0735A'), bottom=dict(kind='pants', col='#3E4660'), beads=True, **SANDAL),
    'uncle': dict(name='部落叔叔', sex='m', skin='golden_d', hair=('short', 'greyblk'),
                  top=dict(kind='tee', tee='#F0ECE4'), bottom=dict(kind='shorts', col='#2F5C8C'), **SANDAL),
    'youth_m': dict(name='部落青年', sex='m', skin='golden_m', hair=('short', 'black'),
                    top=dict(kind='tee', tee='#E07A2E', band=('#F4F1EA', '#E07A2E')), bottom=dict(kind='shorts', col='#2D3654'), **SANDAL),
    'youth_f': dict(name='部落少女', sex='f', skin='golden', hair=('ponytail', 'black'),
                    top=dict(kind='tee', tee='#E58FA2'), bottom=dict(kind='shorts', col='#3A5E8C'), **SANDAL),
    'boy': dict(name='部落男孩', sex='m', skin='golden_m', hair=('spiky', 'black'), scale=0.70, heads=4.0,
                top=dict(kind='tee', tee='#EBC03A'), bottom=dict(kind='shorts', col='#3A4A6A'), **SANDAL),
    'girl': dict(name='部落女孩', sex='f', skin='golden', hair=('pigtails', 'black'), scale=0.68, heads=4.0,
                 top=dict(kind='tee', tee='#7FA8D8'), bottom=dict(kind='skirt', col='#7FA8D8', hem='#6A94C6'), **SANDAL),
})
# ---------------- passers-by (2026-11-14): non-Tao visitors + kids. Everyday holiday clothes only;
# outsiders never wear Tao clothing. Each has its own portrait public/assets/portraits/<id>.webp.
SHOE = dict(shoes='shoe')
CAST.update({
    'pb_couple_m': dict(name='情侶旅客・男', sex='m', skin='light', hair=('short', 'black'),
                        top=dict(kind='shirt', short=True, tee='#F4F1EA', shirt='#7FA3CC'), bottom=dict(kind='shorts', col='#C9B48A'),
                        shoes='shoe', shoe='#ECE6DA', pack='#2E2E34'),
    'pb_couple_f': dict(name='情侶旅客・女', sex='f', skin='light', hair=('long', 'brown'), hat=('sunhat', '#D9B877'),
                        top=dict(kind='tee', tee='#EED36A', floral=('#F6F3EC', '#9AB46A')), bottom=dict(kind='skirt', col='#EED36A', hem='#E2C255'),
                        **SANDAL),
    'pb_middle_m': dict(name='跟團的中年旅客', sex='m', skin='light', hair=('short', 'greyblk'), hat=('cap', '#D2B98A'), lanyard=True,
                        top=dict(kind='tee', tee='#2B3A66'), bottom=dict(kind='pants', col='#B9A57E'), shoes='shoe', shoe='#5C534C'),
    'pb_middle_f': dict(name='中年女旅客', sex='f', skin='light', hair=('bob', 'black'), hat=('cap', '#2E2E34'),
                        top=dict(kind='coat', tee='#F4F1EA', coat='#B49AD2'), bottom=dict(kind='pants', col='#3E4660'),
                        shoes='shoe', shoe='#ECE6DA'),
    'pb_retiree_m': dict(name='退休旅客・男', sex='m', skin='light', hair=('elder', 'white'), elder=True, hat=('bucket', '#B8A57E'),
                         glasses='#8A8A92', top=dict(kind='vest', tee='#5E8A62', vest='#CDBB94', stripe='#CDBB94', stripe2='#CDBB94', plain=True,
                                                     hstripe='#F2EEE6'),
                         bottom=dict(kind='pants', col='#6E6450'), shoes='shoe', shoe='#5C534C', prop='stick'),
    'pb_retiree_f': dict(name='退休旅客・女', sex='f', skin='light', hair=('puff', 'grey'), elder=True, hat=('bucket', '#F2EEE6'),
                         top=dict(kind='shirt', tee='#EBB8C0', shirt='#EBB8C0', floral=('#D9707E', '#9AB46A')),
                         bottom=dict(kind='pants', col='#7A7A82'), shoes='shoe', shoe='#ECE6DA', camera=True),
    'pb_backpacker': dict(name='背包客', sex='m', skin='fair', hair=('spiky', 'sandy'), beard='stubble',
                          top=dict(kind='tee', tee='#3F8C8A'), bottom=dict(kind='shorts', col='#6F6A50'),
                          shoes='shoe', shoe='#6B625A', pack='#5A5A3A', bigpack=True),
    'pb_family_dad': dict(name='全家出遊的爸爸', sex='m', skin='light', hair=('short', 'black'), hat=('cap', '#E3D5B0'), glasses='#2E2A2C',
                          top=dict(kind='tee', tee='#8A8C90'), bottom=dict(kind='shorts', col='#3E4A5C'),
                          shoes='shoe', shoe='#5C534C', pack='#D2B98A'),
    'pb_family_mom': dict(name='全家出遊的媽媽', sex='f', skin='light', hair=('bun', 'black'), hat=('bucket', '#D9C49A'),
                          top=dict(kind='shirt', tee='#E0735A', shirt='#8DAED0'), bottom=dict(kind='pants', col='#F2EEE6'),
                          shoes='shoe', shoe='#ECE6DA'),
    # kids: two quest kids (unique faces) + two ambient kids
    'kid_quest_tourist': dict(name='好奇的小旅客', sex='m', skin='light', hair=('short', 'black'), hat=('bucket', '#2B3A66'),
                              scale=0.66, heads=4.0, camera=True,
                              top=dict(kind='tee', tee='#A8C850'), bottom=dict(kind='shorts', col='#3A4A6A'), shoes='shoe', shoe='#E07A2E'),
    'kid_quest_local': dict(name='愛畫畫的部落女孩', sex='f', skin='golden', hair=('bob', 'black'), scale=0.70, heads=4.0, prop='notebook',
                            top=dict(kind='tee', tee='#7FB0E0', band=('#F4F1EA', '#2B3A66')), bottom=dict(kind='shorts', col='#2D3654'),
                            **SANDAL),
    'kid_tourist_girl': dict(name='小旅客・女孩', sex='f', skin='light', hair=('pigtails', 'black'), hat=('bucket', '#F6F3EC'),
                             scale=0.60, heads=3.8, prop='bucket',
                             top=dict(kind='tee', tee='#F6F3EC', hstripe='#EBA0B4'), bottom=dict(kind='shorts', col='#EBA0B4'),
                             shoes='shoe', shoe='#7FA8D8'),
    'kid_local_ball': dict(name='踢球的部落男孩', sex='m', skin='golden_m', hair=('spiky', 'black'), scale=0.65, heads=3.9,
                           top=dict(kind='tee', tee='#A8382E'), bottom=dict(kind='shorts', col='#2D3654'), **SANDAL),
})
PASSERSBY = ['pb_couple_m', 'pb_couple_f', 'pb_middle_m', 'pb_middle_f', 'pb_retiree_m', 'pb_retiree_f', 'pb_backpacker',
             'pb_family_dad', 'pb_family_mom']
KIDS_NEW = ['kid_quest_tourist', 'kid_quest_local', 'kid_tourist_girl', 'kid_local_ball']
KEY_NPCS = ['elder_yayo', 'elder_iraraley', 'elder_iranmeylek', 'elder_ivalino', 'elder_imorod', 'elder_iratay',
            'villager_taro', 'weaver_elder', 'villager_harbor', 'teacher_yayo', 'shop_yayo', 'rental_owner', 'dive_coach',
            'clinic_doctor', 'nutritionist', 'culture_worker', 'geologist',
            'elder_f_yayo', 'elder_f_iraraley', 'elder_f_iranmeylek', 'elder_f_iratay', 'villager_iranmeylek', 'villager_iratay']
AMBIENT = ['auntie', 'uncle', 'youth_m', 'youth_f', 'boy', 'girl']
NPCS = ['clinic', 'harbor', 'tourist', 'player_researcher'] + KEY_NPCS + AMBIENT + PASSERSBY + KIDS_NEW


# ---------------------------------------------------------------- outfit variants (future 換裝 feature)
# An outfit is only a parameter set: a deep-merged override of a cast entry. Each variant writes its own
# walk / ride_ / canoe_ sheets as `<base>__<outfit>_sheet.png`; the game should pair it with the portrait
# `<portrait>__<outfit>.webp` so the sprite and the portrait always change together.
# Example (not registered yet):
#   variant('player_visitor', 'rain', top=dict(kind='coat', tee='#F4F1EA', coat='#E7C547'), hat=None)
OUTFITS = {}


def _merge(a, b):
    out = dict(a)
    for k, v in b.items():
        if v is None:
            out.pop(k, None)
        elif isinstance(v, dict) and isinstance(a.get(k), dict):
            out[k] = _merge(a[k], v)
        else:
            out[k] = v
    return out


def variant(base, outfit, **over):
    key = f'{base}__{outfit}'
    CAST[key] = _merge(CAST[base], over)
    OUTFITS.setdefault(base, []).append(outfit)
    if base in PLAYERS:
        PLAYERS.append(key)
    else:
        NPCS.append(key)
    return key


# ambient outfit sets (sprite only; every variant shares its base portrait)
variant('auntie', 'scarf', hat=('scarf', '#3E8C8A'), top=dict(tee='#2F8F8A'))
variant('uncle', 'cap', hat=('cap', '#2B3A5C'), top=dict(kind='shirt', short=True, tee='#E9E2D2', shirt='#34477E'), bottom=dict(kind='pants', col='#5A5048'))
variant('youth_m', 'black', hat=('bucket', '#3A3A40'), top=dict(tee='#2E2E34', band=None))
variant('youth_m', 'shirt', hair=('spiky', 'black'), top=dict(kind='shirt', short=True, tee='#F4F1EA', shirt='#4F7FB8', band=None), bottom=dict(col='#8C7D5E'))
variant('youth_f', 'stripe', top=dict(tee='#F2EEE6', hstripe='#34477E'), bottom=dict(kind='skirt', col='#2E3A5E', hem='#2E3A5E'))
variant('youth_f', 'denim', hair=('long', 'black'), top=dict(tee='#F6F3EC'), bottom=dict(col='#6F93BE'))
variant('boy', 'green', top=dict(tee='#5E9A48'))
variant('boy', 'red', hair=('short', 'black'), top=dict(tee='#C8463A'), bottom=dict(col='#2D3654'))
variant('girl', 'orange', top=dict(tee='#EE9A4A'), bottom=dict(col='#EE9A4A', hem='#D8823A'))
variant('girl', 'pink', top=dict(tee='#EBA0B4'), bottom=dict(kind='shorts', col='#4F6A8F'))


# ---------------------------------------------------------------- 換裝 outfit sheets (2026-11-14), matching the portraits in
# art-src/portraits/outfits/: local_trad / local_f_trad = 達悟傳統服飾 (Tao players only);
# visitor_m_acc / visitor_acc = everyday travel clothes + 織草 woven-grass accessories only (outsiders never wear Tao clothing).
# Written as <base>_trad_sheet.png / <base>_acc_sheet.png next to the base sheets (walk + idle only).
OUTFIT_SHEETS = {'player_trad': 'local_trad', 'player_f_trad': 'local_f_trad',
                 'player_visitor_acc': 'visitor_m_acc', 'player_visitor_f_acc': 'visitor_acc'}
GLASSES = '#5A4A3E'   # thin round frames (both travellers)
WOVEN = '#C9A365'     # 織草 woven grass
CAST['player_trad'] = _merge(CAST['player'], dict(
    name='族人男青年・傳統服', top=dict(kind='vest', tee=SKIN['golden_m'], vest='#EFE9DC', stripe='#4F6EA8', stripe2='#4F6EA8',
                                    taririk=True, sleeveless=True, short=None, shirt=None, pocket=None),
    bottom=dict(kind='loincloth', col='#2F3D66', stripe='#EDE3CE')))
CAST['player_f_trad'] = _merge(CAST['player_f'], dict(
    name='族人女青年・傳統服', tie=None, top=dict(kind='tee', tee='#EEE8DA', hstripe='#5B79B2', sleeveless=True, oneshoulder=True, shirt=None),
    bottom=dict(kind='skirt', col='#E8E2D4', hem='#4F6EA8')))
CAST['player_visitor_acc'] = _merge(CAST['player_visitor'], dict(
    name='本島男旅人・織草配件', glasses=GLASSES, round_glasses=True, pouch=WOVEN, camera=None, prop='notebook'))
CAST['player_visitor_f_acc'] = _merge(CAST['player_visitor_f'], dict(
    name='本島女旅人・織草配件', glasses=GLASSES, round_glasses=True, pouch=WOVEN, hat=('bucket', '#CDAE78'), prop='notebook'))
