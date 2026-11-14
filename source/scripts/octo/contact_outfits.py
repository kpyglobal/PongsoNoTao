"""Review sheet for the 換裝 outfit sprites -> screenshots-cast/outfit-sprites.png (run from the repo root)."""
import os, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cast import CAST, OUTFIT_SHEETS
FT = 'fonts-src/Iansui-Regular.ttf'
Fm, Fs, Fh = (ImageFont.truetype(FT, n) for n in (20, 15, 26))
BG, CARD, INK, SUB = (69, 98, 105), (246, 241, 230), (40, 40, 40), (120, 116, 108)
SP = 'public/assets/sprites/characters'


def frame(k, col, row, z=2):
    sh = Image.open(f'{SP}/{k}_sheet.png').convert('RGBA')
    return sh.crop((col * 64, row * 96, col * 64 + 64, row * 96 + 96)).resize((64 * z, 96 * z), Image.NEAREST)


def ctext(d, cx, y, t, f, col):
    d.text((cx - d.textlength(t, font=f) / 2, y), t, fill=col, font=f)


pad, cw, chh = 12, 1240, 250
img = Image.new('RGBA', (pad * 2 + cw, 54 + len(OUTFIT_SHEETS) * (chh + pad)), BG + (255,)); d = ImageDraw.Draw(img)
d.text((pad, 12), '換裝行走圖・族人傳統服／旅人織草配件（旅人只配戴配件，不穿達悟傳統服飾）', fill=(240, 240, 235), font=Fh)
for i, (k, portrait) in enumerate(OUTFIT_SHEETS.items()):
    base = k.rsplit('_', 1)[0]
    x, y = pad, 54 + i * (chh + pad)
    d.rounded_rectangle((x, y, x + cw, y + chh), 6, fill=CARD)
    pp = f'public/assets/portraits/{portrait}.webp'
    p = Image.open(pp if os.path.exists(pp) else f'art-src/portraits/outfits/{portrait}.jpg').convert('RGBA')
    s = min(170 / p.width, 200 / p.height); p = p.resize((round(p.width * s), round(p.height * s)), Image.LANCZOS)
    img.alpha_composite(p, (x + 6, y + 6))
    ctext(d, x + 92, y + 210, portrait, Fs, SUB)
    img.alpha_composite(frame(base, 0, 4), (x + 190, y + 10))
    ctext(d, x + 254, y + 210, '原本', Fs, SUB)
    cx = x + 340
    for j, (col, row) in enumerate([(0, 4), (0, 5), (0, 6), (0, 7), (0, 0), (1, 0), (2, 1), (3, 1)]):
        img.alpha_composite(frame(k, col, row), (cx + j * 104, y + 10))
    ctext(d, cx + 1.5 * 104 + 64, y + 204, '待機 南・西・北・東', Fs, SUB)
    ctext(d, cx + 5.5 * 104 + 64, y + 204, '行走 南・西', Fs, SUB)
    ctext(d, cx + 3.5 * 104 + 64, y + 224, f"{CAST[k]['name']}　{k}_sheet.png", Fm, INK)
os.makedirs('screenshots-cast', exist_ok=True)
img.convert('RGB').save('screenshots-cast/outfit-sprites.png', optimize=True)
print(img.size, os.path.getsize('screenshots-cast/outfit-sprites.png'))
