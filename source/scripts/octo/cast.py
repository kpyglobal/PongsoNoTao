"""方案二 (歧路旅人風) cast: six player looks + eight NPC types. Everyday island / travel clothes, no costumes."""

SKIN = {'tan': '#D4956A', 'deep': '#B47650', 'light': '#EDC29E', 'fair': '#F2CDAE', 'brown': '#9A6040', 'golden': '#E2AB74', 'golden_m': '#D9A06A'}
HAIR = {'black': '#3A2F3C', 'grey': '#C2BDB6', 'brown': '#4B3528', 'sandy': '#B98A52', 'greyblk': '#77737A', 'chestnut': '#6A4630'}

CAST = {
    # ---------------- players (each also gets ride_ and canoe_ sheets)
    'player': dict(name='族人男青年', sex='m', skin='golden_m', hair=('wavy', 'black'),
                   top=dict(kind='shirt', short=True, tee='#34363C', shirt='#62656C', pocket=('#B33A30', '#EDE3CE', '#22202A')),
                   bottom=dict(kind='shorts', col='#8C7D5E'), shoes='sandal', beads=True),
    'player_f': dict(name='族人女青年', sex='f', skin='golden', hair=('lowtail', 'black'), tie=('#B33A30', '#EDE3CE', '#22202A'),
                     top=dict(kind='shirt', tee='#F4F1EA', shirt='#8DAED0'),
                     bottom=dict(kind='skirt', col='#34477E', hem='#EDE3CE'), shoes='sandal', beads=True),
    # 臺灣本島旅人 (matches the painted visitor_m / visitor portraits: brown wavy hair, olive-green open shirt over a white tee)
    'player_visitor': dict(name='本島男旅人', sex='m', skin='light', hair=('wavy', 'chestnut'),
                           top=dict(kind='shirt', tee='#F4F1EA', shirt='#788C50'),
                           bottom=dict(kind='shorts', col='#C4AE84'), shoes='shoe', shoe='#5C534C',
                           pack='#6A7646', camera=True),
    'player_visitor_f': dict(name='本島女旅人', sex='f', skin='light', hair=('wavylong', 'chestnut'), hat=('bucket', '#E3D5B0'),
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
    'elder': dict(name='部落長輩', sex='m', skin='deep', hair=('elder', 'grey'), elder=True,
                  top=dict(kind='vest', tee='#2D3654', vest='#EFE7D8', stripe='#B33A30', stripe2='#22202A', taririk=True),
                  bottom=dict(kind='shorts', col='#3A3A42'), shoes='sandal', beads=True, prop='stick'),
    'farmer': dict(name='芋田阿嬤', sex='f', skin='deep', hair=('bun', 'grey'), elder=True, hat=('scarf', '#3E5A8C'),
                   top=dict(kind='tee', tee='#8A6A9A', hstripe='#EDE3CE'),
                   bottom=dict(kind='longskirt', col='#2E3A5E', hem='#B33A30'), shoes='sandal', prop='basket'),
    'fisher': dict(name='拼板舟漁人', sex='m', skin='deep', hair=('short', 'black'), hat=('headband', '#B33A30'),
                   top=dict(kind='vest', tee='#E9E2D2', vest='#2F4F86', stripe='#EDE3CE', stripe2='#1D2848', hband=True),
                   bottom=dict(kind='shorts', col='#26304A'), shoes='sandal', beads=True),
    'clinic': dict(name='衛生所護理師', sex='f', skin='tan', hair=('bun', 'black'),
                   top=dict(kind='coat', tee='#4FA79A', coat='#F4F2EE'),
                   bottom=dict(kind='pants', col='#3F8F86'), shoes='shoe', shoe='#F0EBE2', lanyard=True, prop='clipboard'),
    'harbor': dict(name='港務人員', sex='m', skin='tan', hair=('short', 'black'), hat=('cap', '#2B3A5C'),
                   top=dict(kind='hivis', tee='#2B3A5C', vest='#F2B632'),
                   bottom=dict(kind='pants', col='#2B3550'), shoes='shoe', shoe='#2E2A2C'),
    'tourist': dict(name='觀光客', sex='m', skin='light', hair=('short', 'black'), hat=('cap', '#F2F0EA'),
                    top=dict(kind='tee', tee='#E07A66'),
                    bottom=dict(kind='shorts', col='#B9A57E'), shoes='shoe', shoe='#5C534C', pack='#7C8088', camera=True),
    'villager': dict(name='部落族人', sex='m', skin='tan', hair=('short', 'black'),
                     top=dict(kind='tee', tee='#3E8F8A'),
                     bottom=dict(kind='shorts', col='#2D3654'), shoes='sandal', beads=True),
    'player_researcher': dict(name='研究訪客', sex='f', skin='light', hair=('long', 'brown'), hat=('sunhat', '#E2CB8E'),
                              top=dict(kind='vest', tee='#F2EEE6', vest='#B9A06A', stripe='#B9A06A', stripe2='#9C8452', plain=True),
                              bottom=dict(kind='pants', col='#6E7A52'), shoes='shoe', shoe='#5C534C',
                              pack='#8A6A48', prop='notebook'),
}
PLAYERS = ['player', 'player_f', 'player_visitor', 'player_visitor_f']  # 外國 looks kept in CAST for reference only (removed from the game 2026-11)
NPCS = ['elder', 'farmer', 'fisher', 'clinic', 'harbor', 'tourist', 'villager', 'player_researcher']


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
