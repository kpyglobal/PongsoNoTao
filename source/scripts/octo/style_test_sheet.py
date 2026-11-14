"""One-sheet STYLE TEST: world before/after, 3 restyled portraits (before/after), u1 before/after, 3 items (pixel icon + 圖鑑 plate).
    /tmp/imgvenv/bin/python scripts/octo/style_test_sheet.py  ->  screenshots-style/style-test.png"""
from PIL import Image, ImageDraw, ImageFont
FT = 'fonts-src/NotoSansTC-Medium.otf'
H1, H2, H3 = (ImageFont.truetype(FT, n) for n in (34, 24, 18))
BG, INK = (244, 236, 216), (59, 42, 30)
W = 2400
img = Image.new('RGB', (W, 3700), BG); d = ImageDraw.Draw(img)
y = 20
d.text((30, y), 'Pongso no Tao｜風格測試：水彩＋墨線（同一套風格：世界、繪像、插畫、物品）', fill=INK, font=H1); y += 64


def fit(p, w, h=None, mode='RGB'):
    im = Image.open(p).convert('RGBA')
    s = w / im.width if h is None else min(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    bg = Image.new('RGBA', im.size, BG + (255,)); bg.alpha_composite(im)
    return bg.convert('RGB')


def label(x, yy, t, f=H3):
    d.text((x, yy), t, fill=INK, font=f)


# 1. world
d.text((30, y), '1　3D 世界（開元港，桌機視角）：原始 → 水彩＋墨線 shader（角色像素圖不套用）', fill=INK, font=H2); y += 40
w = (W - 90) // 2
for i, (p, t) in enumerate([('screenshots-style/desktop-harbor-original.png', '原始'), ('screenshots-style/desktop-harbor-watercolor.png', '水彩＋墨線')]):
    im = fit(p, w); img.paste(im, (30 + i * (w + 30), y)); label(30 + i * (w + 30), y + im.height + 6, t)
y += im.height + 46
# mobile pair, smaller
mw = 330
xs = 30
for i, (p, t) in enumerate([('screenshots-style/mobile-harbor-original.png', '手機・原始'), ('screenshots-style/mobile-harbor-watercolor.png', '手機・水彩（無排線，較省）')]):
    try:
        im = fit(p, mw); img.paste(im, (xs, y)); label(xs, y + im.height + 6, t); xs += mw + 30
    except FileNotFoundError:
        pass
# 2. portraits next to the mobile shots
px0 = xs + 40
d.text((px0, y - 4), '2　繪像：同一張臉與設計，只改上色與線條（左：現在，右：水彩＋墨線）', fill=INK, font=H2)
pw = (W - px0 - 30 - 5 * 16) // 6
for i, k in enumerate(['local', 'elder_yayo', 'visitor']):
    for j, p in enumerate([f'art-src/portraits/{k}.jpg', f'art-src/portraits/cartoon-test/{k}.jpg']):
        im = fit(p, pw); x = px0 + (2 * i + j) * (pw + 16); img.paste(im, (x, y + 40))
        label(x, y + 44 + im.height, f'{k}・{"現在" if j == 0 else "水彩墨線"}')
y += max(720, im.height + 90) + 20
# 3. underwater
d.text((30, y), '3　水下插畫 u1：現在 → 水彩＋墨線（構圖與內容不變）', fill=INK, font=H2); y += 40
for i, (p, t) in enumerate([('public/assets/underwater/u1.webp', '現在'), ('art-src/style-test/u1_watercolor.jpg', '水彩＋墨線')]):
    im = fit(p, w); img.paste(im, (30 + i * (w + 30), y)); label(30 + i * (w + 30), y + im.height + 6, t)
y += im.height + 50
# 4. items
d.text((30, y), '4　物品：小圖示（像素，配合角色圖：背包／HUD／地上）＋ 圖鑑插畫（水彩＋墨線）', fill=INK, font=H2); y += 44
cw = (W - 60 - 2 * 30) // 3
grass = Image.new('RGB', (24 * 3 + 16, 24 * 3 + 16), (126, 168, 98))
for i, (k, zh) in enumerate([('flyingfish', '飛魚 alibangbang'), ('taro', '水芋 soli'), ('sweetpotato', '地瓜')]):
    x = 30 + i * (cw + 30)
    ic = Image.open(f'art-src/style-test/icon_{k}.png')
    for j, s in enumerate([1, 2, 4]):  # 1x, 2x, 4x
        big = ic.resize((24 * s, 24 * s), Image.NEAREST)
        tile = Image.new('RGBA', (24 * s + 12, 24 * s + 12), (233, 222, 196, 255)); tile.alpha_composite(big, (6, 6))
        img.paste(tile.convert('RGB'), (x + [0, 44, 110][j], y + 110 - tile.height))
    g = grass.copy(); gi = ic.resize((72, 72), Image.NEAREST); g.paste(gi, (8, 8), gi); img.paste(g, (x + 230, y + 22))
    label(x, y + 116, '圖示 24px：1×／2×／4×，右：放在地上')
    pl = fit(f'art-src/style-test/item_{k}.jpg', cw, 520); img.paste(pl, (x + (cw - pl.width) // 2, y + 150))
    label(x, y + 156 + pl.height, f'{zh}・圖鑑插畫', H2)
y += 150 + 520 + 50
img.crop((0, 0, W, y)).save('screenshots-style/style-test.png', optimize=True)
print('size', W, y)
