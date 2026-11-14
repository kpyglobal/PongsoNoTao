"""Review sheet for the passers-by + new kids (portrait + in-game sprite, front and side frames).
    python3 scripts/octo/contact_passersby.py  ->  screenshots-cast/passersby.png"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cast import CAST, PASSERSBY, KIDS_NEW
FT = 'fonts-src/Iansui-Regular.ttf'
Fm, Fs, Fh = (ImageFont.truetype(FT, n) for n in (20, 15, 26))
BG, CARD, INK, SUB, TAG = (69, 98, 105), (246, 241, 230), (40, 40, 40), (120, 116, 108), (176, 70, 50)
NOTE = {'kid_quest_tourist': '任務角色', 'kid_quest_local': '任務角色', 'geologist': '改為男性'}


def frame(k, col, row):
    sh = Image.open(f'public/assets/sprites/characters/{k}_sheet.png').convert('RGBA')
    return sh.crop((col * 64, row * 96, col * 64 + 64, row * 96 + 96)).resize((128, 192), Image.NEAREST)


def ctext(d, cx, y, t, f, col):
    d.text((cx - d.textlength(t, font=f) / 2, y), t, fill=col, font=f)


ids = PASSERSBY + KIDS_NEW + ['geologist']
cols, cw, chh, pad = 5, 330, 330, 12
rows = (len(ids) + cols - 1) // cols
img = Image.new('RGBA', (pad + cols * (cw + pad), 54 + rows * (chh + pad)), BG + (255,)); d = ImageDraw.Draw(img)
d.text((pad, 12), f'路人與孩子・{len(ids) - 1} 位新角色（外地旅客穿一般度假服裝，不穿達悟傳統服飾）＋ 地質學家改男性', fill=(240, 240, 235), font=Fh)
for i, k in enumerate(ids):
    x, y = pad + (i % cols) * (cw + pad), 54 + (i // cols) * (chh + pad)
    d.rounded_rectangle((x, y, x + cw, y + chh), 6, fill=CARD)
    p = Image.open(f'public/assets/portraits/{k}.webp').convert('RGBA')
    s = min(170 / p.width, 240 / p.height); p = p.resize((round(p.width * s), round(p.height * s)), Image.LANCZOS)
    img.alpha_composite(p, (x + 6, y + 6 + 240 - p.height))
    sp = frame(k, 0, 4); img.alpha_composite(sp, (x + 180, y + 254 - 192))
    ctext(d, x + cw / 2, y + 258, CAST[k]['name'], Fm, INK)
    ctext(d, x + cw / 2, y + 284, k, Fs, SUB)
    if k in NOTE:
        ctext(d, x + cw / 2, y + 304, NOTE[k], Fs, TAG)
os.makedirs('screenshots-cast', exist_ok=True)
img.convert('RGB').save('screenshots-cast/passersby.png', optimize=True)
print(img.size, os.path.getsize('screenshots-cast/passersby.png'))
