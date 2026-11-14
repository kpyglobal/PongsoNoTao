"""方案二 (歧路旅人風) cast: six player looks + eight NPC types. Everyday island / travel clothes, no costumes."""

SKIN = {'tan': '#D4956A', 'deep': '#B47650', 'light': '#EDC29E', 'fair': '#F2CDAE', 'brown': '#9A6040'}
HAIR = {'black': '#3A2F3C', 'grey': '#C2BDB6', 'brown': '#4B3528', 'sandy': '#B98A52', 'greyblk': '#77737A', 'chestnut': '#6A4630'}

CAST = {
    # ---------------- players (each also gets ride_ and canoe_ sheets)
    'player': dict(name='族人男青年', sex='m', skin='tan', hair=('spiky', 'black'),
                   top=dict(kind='vest', tee='#4C505C', vest='#EDE3CE', stripe='#2E4B8C', stripe2='#1D2848'),
                   bottom=dict(kind='shorts', col='#2D3654'), shoes='sandal', beads=True),
    'player_f': dict(name='族人女青年', sex='f', skin='tan', hair=('long', 'black'),
                     top=dict(kind='tee', tee='#E2775A', band=('#2E4B8C', '#EDE3CE')),
                     bottom=dict(kind='skirt', col='#34477E', hem='#EDE3CE'), shoes='sandal', beads=True),
    # 臺灣本島旅人 (matches the painted visitor_m / visitor portraits: brown wavy hair, beige linen / cream floral shirt)
    'player_visitor': dict(name='本島男旅人', sex='m', skin='light', hair=('wavy', 'chestnut'),
                           top=dict(kind='shirt', tee='#F4F1EA', shirt='#D8C9A6'),
                           bottom=dict(kind='shorts', col='#4A5D7E'), shoes='shoe', shoe='#5C534C',
                           pack='#6A7646', camera=True),
    'player_visitor_f': dict(name='本島女旅人', sex='f', skin='light', hair=('wavylong', 'chestnut'), hat=('bucket', '#E3D5B0'),
                             top=dict(kind='shirt', tee='#F6F3EC', shirt='#EEE3C6', floral=('#D9806E', '#8BA064')),
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
PLAYERS = ['player', 'player_f', 'player_visitor', 'player_visitor_f', 'player_foreign', 'player_foreign_f']
NPCS = ['elder', 'farmer', 'fisher', 'clinic', 'harbor', 'tourist', 'villager', 'player_researcher']
