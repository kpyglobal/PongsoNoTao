"""Review sheet for the 8-direction player sheets -> screenshots-cast/player-8dir.png (run from the repo root)."""
import os, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cast import CAST, PLAYERS, OUTFIT_SHEETS
FT = 'fonts-src/Iansui-Regular.ttf'
Fm, Fs, Fh = (ImageFont.truetype(FT, n) for n in (20, 15, 26))
BG, CARD, INK, SUB = (69, 98, 105), (246, 241, 230), (40, 40, 40), (120, 116, 108)
SP = 'public/assets/sprites/characters'
DIRS = ['南', '西南', '西', '西北', '北', '東北', '東', '東南']
WALK_IDLE = [4, 12, 5, 13, 6, 14, 7, 15]
VEH = [0, 4, 1, 5, 2, 6, 3, 7]


def cell(path, fw, col, row, z):
    sh = Image.open(path).convert('RGBA')
    return sh.crop((col * fw, row * 96, col * fw + fw, row * 96 + 96)).resize((round(fw * z), round(96 * z)), Image.NEAREST)


def ctext(d, cx, y, t, f, col):
    d.text((cx - d.textlength(t, font=f) / 2, y), t, fill=col, font=f)


keys = PLAYERS[:4] + list(OUTFIT_SHEETS)
pad, cw, chh = 12, 1830, 300
img = Image.new('RGBA', (pad * 2 + cw, 54 + len(keys) * (chh + pad)), BG + (255,)); d = ImageDraw.Draw(img)
d.text((pad, 12), '玩家角色八方向・待機（南→東南）＋西南行走 4 格／騎車／划船（西南・西北・東北・東南為新增斜向）', fill=(240, 240, 235), font=Fh)
for i, k in enumerate(keys):
    x, y = pad, 54 + i * (chh + pad)
    d.rounded_rectangle((x, y, x + cw, y + chh), 6, fill=CARD)
    d.text((x + 10, y + 8), f"{CAST[k]['name']}　{k}_8dir_sheet.png / ride_{k}_8dir_sheet.png / canoe_{k}_8dir_sheet.png", fill=INK, font=Fm)
    for j, row in enumerate(WALK_IDLE):
        img.alpha_composite(cell(f'{SP}/{k}_8dir_sheet.png', 64, 0, row, 1.5), (x + 10 + j * 92, y + 30))
        ctext(d, x + 10 + j * 92 + 48, y + 172, DIRS[j], Fs, SUB)
    for c in range(4):
        img.alpha_composite(cell(f'{SP}/{k}_8dir_sheet.png', 64, c, 8, 1.5), (x + 800 + c * 92, y + 30))
    ctext(d, x + 800 + 2 * 92, y + 172, '西南 行走 4 格', Fs, SUB)
    for j, row in enumerate(VEH):
        img.alpha_composite(cell(f'{SP}/ride_{k}_8dir_sheet.png', 96, 0, row, 1.0), (x + 10 + j * 90, y + 190))
        img.alpha_composite(cell(f'{SP}/canoe_{k}_8dir_sheet.png', 128, 0, row, 1.0), (x + 760 + j * 132, y + 190))
    ctext(d, x + 10 + 4 * 90, y + 280, '騎車 南・西南・西・西北・北・東北・東・東南', Fs, SUB)
    ctext(d, x + 760 + 4 * 132, y + 280, '划船 南・西南・西・西北・北・東北・東・東南', Fs, SUB)
os.makedirs('screenshots-cast', exist_ok=True)
img.convert('RGB').save('screenshots-cast/player-8dir.png', optimize=True)
print(img.size, os.path.getsize('screenshots-cast/player-8dir.png'))
