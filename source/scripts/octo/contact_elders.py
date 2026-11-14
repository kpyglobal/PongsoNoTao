"""Contact sheet: male / female elder of every village (portrait + south / west / north sprite frames).
    /tmp/imgvenv/bin/python scripts/octo/contact_elders.py  ->  screenshots-cast/elders-by-village.png"""
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype('fonts-src/NotoSansTC-Medium.otf', 22); Fs = ImageFont.truetype('fonts-src/NotoSansTC-Medium.otf', 17)
rows = [('椰油 Yayo', 'elder_yayo', '飛魚季出海、漁團', 'elder_f_yayo', '食物：煮食與保存｜飛魚乾'),
        ('朗島 Iraraley', 'elder_iraraley', '造拼板舟、選木', 'elder_f_iraraley', '山藥與小米｜水煮山藥'),
        ('東清 Iranmeylek', 'elder_iranmeylek', '拼板舟出海、繩索', 'elder_f_iranmeylek', '潮間帶與料理｜水煮貝類與海菜'),
        ('野銀 Ivalino', 'elder_ivalino', '飛魚季的規矩', 'villager_taro', '水芋田｜水煮芋頭'),
        ('紅頭 Imorod', 'elder_imorod', '上山打獵與山林', 'weaver_elder', '織布｜水煮飛魚'),
        ('漁人 Iratay', 'elder_iratay', '飛魚季出海與分魚', 'elder_f_iratay', '地瓜與水芋｜芋頭與地瓜')]
PW, PH, S = 165, 210, 2
SW, SHh = 64 * S, 96 * S
cw = PW + 3 * SW + 12; RH = PH + 40
img = Image.new('RGBA', (200 + 2 * (cw + 160), 40 + RH * len(rows)), (236, 230, 214, 255)); d = ImageDraw.Draw(img)
d.text((10, 8), '各部落的男性長輩 a akey／女性長輩 a akes（食譜傳承者｜料理）', fill=(40, 40, 40), font=F)


def put(k, x, y):
    img.alpha_composite(Image.open(f'public/assets/portraits/{k}.webp').convert('RGBA').resize((PW, PH), Image.LANCZOS), (x, y))
    sh = Image.open(f'public/assets/sprites/characters/{k}_sheet.png').convert('RGBA')
    for j, (cx, cy) in enumerate([(0, 384), (0, 96), (0, 192)]):
        img.alpha_composite(sh.crop((cx, cy, cx + 64, cy + 96)).resize((SW, SHh), Image.NEAREST), (x + PW + 4 + j * SW, y + PH - SHh))


for i, (v, m, mr, f, fr) in enumerate(rows):
    y = 40 + i * RH
    d.text((10, y + PH // 2 - 12), v, fill=(30, 30, 30), font=F)
    put(m, 200, y); d.text((200, y + PH + 6), f'{m}：{mr}', fill=(30, 50, 90), font=Fs)
    x = 200 + cw + 160; put(f, x, y); d.text((x, y + PH + 6), f'{f}：{fr}', fill=(110, 40, 40), font=Fs)
img.convert('RGB').save('screenshots-cast/elders-by-village.png')
