"""Style-A cast: the player (local / visitor x male / female) and every NPC kind.
Everyday island clothes: tees, work vests with taririk-like indigo stripes, woven bands; no costumes."""
from .kit import R, auto
from .character import P

PLAYER = {
    # local (returning Tao youth), male: cream tee with indigo stripes, navy shorts, sandals
    'player': dict(skin='tan', hair='black', hair_style='spiky', top_kind='tee', top=P['shirtM'], pat='stripes',
                   bottom='shorts', bot=P['navy'], shoe=P['sandal']),
    # local, female: coral tee with a white wave band, denim shorts, flower clip
    'player_f': dict(skin='tan', hair='black', hair_style='bob', female=True, flower=True, top_kind='tee', top=P['coral'],
                     pat='wave', bottom='shorts', bot=P['denim'], shoe=P['sandal']),
    # visitor, male: sky tee, khaki shorts, bucket hat, small backpack
    'player_visitor': dict(skin='light', hair='brown', hair_style='short', headwear='bucket', hw=auto('#E6D7B0'),
                           top_kind='tee', top=auto('#7CC6E8'), bottom='shorts', bot=auto('#C9B48A'),
                           shoe=auto('#4A7FA8'), acc=['backpack'], pack=auto('#E07B4A')),
    # visitor, female: mustard tee with dots, denim shorts, straw sun hat, backpack
    'player_visitor_f': dict(skin='light', hair='brown', hair_style='bob', female=True, headwear='sunhat', hw=auto('#EBD39A'),
                             hw2=P['coral'], top_kind='tee', top=auto('#F2C24E'), pat='dots', pat_ramp=P['white'],
                             bottom='shorts', bot=P['denim'], shoe=auto('#F2EEE4'), acc=['backpack'], pack=auto('#3FA39A')),
}

NPC = {
    # 部落耆老 (male elders): silver hair, smiling eyes, taririk work vest over a charcoal tee, beads, walking stick
    'elder': dict(skin='deep', hair='grey', hair_style='elder_m', elder=True, top_kind='vest', top=P['shirtM'], pat='taririk',
                  inner=auto('#5A5E6A'), sleeve='short', bottom='shorts', bot=auto('#2E3446'), shoe=P['sandal'],
                  belt=True, acc=['beads'], item='stick'),
    # 水芋田長輩 (elder woman at the taro terraces): head scarf, striped wrap top, long woven skirt, taro basket
    'farmer': dict(skin='tan', hair='grey', hair_style='bun', female=True, elder=True, headwear='scarf', hw=P['indigo'],
                   top_kind='wrap', top=P['shirtM'], pat='hstripes', pat_ramp=P['indigo'], sleeve='long',
                   bottom='skirt', bot=auto('#34508A'), bot_pat=P['white'], shoe=P['sandal'], item='basket'),
    # 拼板舟漁人: woven headband, indigo-striped vest over a grey tee, paddle
    'fisher': dict(skin='deep', hair='black', hair_style='spiky', headwear='headband', top_kind='vest', top=P['shirtM'],
                   pat='stripes', inner=auto('#6A707E'), bottom='shorts', bot=auto('#243650'), shoe=P['sandal'],
                   belt=True, acc=['beads'], item='paddle'),
    # 衛生所護理師: bun, white coat over teal scrubs, lanyard, clipboard
    'clinic': dict(skin='medium', hair='black', hair_style='bun', female=True, top_kind='coat', top=R('#FFFFFF', '#F2F6F6', '#CFDCDC', '#4A5A5E'),
                   inner=auto('#5FB3A6'), sleeve='long', sleeve_ramp=R('#FFFFFF', '#F2F6F6', '#CFDCDC', '#4A5A5E'),
                   bottom='pants', bot=auto('#5FB3A6'), shoe=P['paper'], acc=['lanyard'], item='clipboard'),
    # 港務人員: navy cap, hi-vis vest over light-blue shirt, work pants, mooring rope
    'harbor': dict(skin='tan', hair='black', hair_style='short', headwear='cap', hw=auto('#2E4580'), top_kind='hivis',
                   top=auto('#F58A2A'), inner=auto('#9CC2E8'), bottom='pants', bot=auto('#2B3446'), shoe=auto('#3A3330'),
                   item='rope'),
    # 訪客 (tourist): white cap, coral tee, beige shorts, backpack, camera
    'tourist': dict(skin='light', hair='brown', hair_style='short', headwear='cap', hw=auto('#F2EEE4'), top_kind='tee',
                    top=auto('#F07A68'), bottom='shorts', bot=auto('#D6C49A'), shoe=auto('#4A7FA8'),
                    acc=['backpack', 'camera'], pack=auto('#3D4A5A')),
    # 部落族人: teal work tee, woven belt, dark shorts, beads
    'villager': dict(skin='tan', hair='black', hair_style='short', top_kind='tee', top=auto('#3F8F98'), bottom='shorts',
                     bot=auto('#3E3A34'), shoe=P['sandal'], belt=True, acc=['beads']),
    # 旅人 / 海岸研究者 (NPC tourist_b): sun hat, khaki vest over white tee, cargo shorts, notebook, backpack
    'player_researcher': dict(skin='medium', hair='black', hair_style='bob', female=True, headwear='sunhat', hw=auto('#D9BE84'),
                              hw2=P['indigo'], top_kind='vest', top=auto('#B39D6A'), inner=P['paper'], bottom='shorts',
                              bot=auto('#7A7056'), shoe=auto('#5A4A3A'), acc=['backpack'], pack=auto('#3F6A6A'), item='notebook'),
}
