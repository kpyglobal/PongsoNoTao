# Phase A: convert art-src finals -> public WebP (q80). Run with /usr/bin/python3.
import os, glob
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(R, *a)

def fit(im, w, h, top=0.0):
    sw, sh = im.size; r = w / h
    if sw / sh > r:
        cw = int(sh * r); x = (sw - cw) // 2; box = (x, 0, x + cw, sh)
    else:
        ch = int(sw / r); y = int((sh - ch) * top); box = (0, y, sw, y + ch)
    return im.crop(box).resize((w, h), Image.LANCZOS)

# portraits: keyed + fitted by scripts/key_art.py portraits (transparent bg, bottom-centre, 330x420 + guide copies)

for f in sorted(glob.glob(P('art-src/underwater/v2/*.jpg'))):
    n = os.path.splitext(os.path.basename(f))[0]
    im = Image.open(f).convert('RGB')
    fit(im, 1600, 900, 0.5).save(P('public/assets/underwater', n + '.webp'), quality=80, method=6)
    fit(im, 480, 270, 0.5).save(P('public/assets/underwater/thumbs', n + '.webp'), quality=80, method=6)

os.makedirs(P('public/assets/items/icons'), exist_ok=True)
import json
KEYS = {}  # item id -> (illustration key, icon key), from content/items/*.json
for jf in glob.glob(P('content/items/*.json')):
    d = json.load(open(jf)); L = d if isinstance(d, list) else d.get('items', d)
    for it in (L.values() if isinstance(L, dict) else L):
        KEYS[it['id']] = (it['illustration'], it['icon'])
for f in sorted(glob.glob(P('art-src/items/*.jpg'))):
    n = os.path.splitext(os.path.basename(f))[0]
    if n.startswith('icon_src_') or n not in KEYS:
        continue
    illus, icon = KEYS[n]
    im = Image.open(f).convert('RGB')
    im.resize((512, 512), Image.LANCZOS).save(P('public/assets/items', illus + '.webp'), quality=80, method=6)
    # some items get a bolder, icon-only source (readability at 24px)
    if os.path.exists(P('art-src/items', 'icon_src_' + n + '.jpg')):
        im = Image.open(P('art-src/items', 'icon_src_' + n + '.jpg')).convert('RGB')
    # pixel icon: flood-fill the paper (and pale wash shadows) from the border so
    # enclosed whites survive, crop to the object, downscale to 24px, quantise,
    # crisp alpha and a 1px dark-brown pixel outline.
    from PIL import ImageDraw, ImageFilter
    sm_ = im.resize((256, 256), Image.LANCZOS)
    hsv = sm_.convert('HSV'); g = sm_.convert('L')
    light = Image.eval(g, lambda v: 255 if v > 172 else 0)
    lowsat = hsv.getchannel('S').point(lambda v: 255 if v < 70 else 0)
    cand = Image.composite(light, Image.new('L', light.size, 0), lowsat)
    cand = cand.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    th = {'alibangbang': 200}.get(n, 150)  # faint-outline items
    ink = g.point(lambda v: 255 if v < th else 0).filter(ImageFilter.MaxFilter(7))
    m = Image.composite(Image.new('L', cand.size, 0), cand, ink)
    for xy in [(0, 0), (255, 0), (0, 255), (255, 255), (128, 0), (0, 128), (255, 128), (128, 255)]:
        if m.getpixel(xy) == 255: ImageDraw.floodfill(m, xy, 128)
    alpha = m.point(lambda v: 0 if v == 128 else 255)
    # drop detached specks / loose shadow strokes: keep components >= 8% of the largest
    import numpy as np
    from scipy import ndimage
    am = np.asarray(alpha) > 0; lab, nl = ndimage.label(am)
    if nl > 1:
        sz = ndimage.sum(am, lab, range(1, nl + 1)); keep = np.zeros(nl + 1, bool); keep[1:] = sz >= 0.08 * sz.max()
        alpha = Image.fromarray((keep[lab] * 255).astype(np.uint8))
    bb = alpha.getbbox() or (0, 0, 256, 256)
    w, h = bb[2] - bb[0], bb[3] - bb[1]; sz = max(w, h) + 8
    cx, cy = (bb[0] + bb[2]) // 2, (bb[1] + bb[3]) // 2
    box = (cx - sz // 2, cy - sz // 2, cx - sz // 2 + sz, cy - sz // 2 + sz)
    rgb = Image.new('RGB', (sz, sz), (255, 255, 255)); rgb.paste(sm_.crop(box))
    al = Image.new('L', (sz, sz), 0); al.paste(alpha.crop(box))
    S = 22
    q = rgb.resize((S, S), Image.BOX).quantize(colors=14, method=Image.MEDIANCUT).convert('RGBA')
    a = al.resize((S, S), Image.BOX).point(lambda v: 255 if v > 100 else 0)
    q.putalpha(a)
    out = Image.new('RGBA', (24, 24), (0, 0, 0, 0)); out.alpha_composite(q, (1, 1))
    ring = out.getchannel('A').filter(ImageFilter.MaxFilter(3))
    edge = Image.new('RGBA', (24, 24), (62, 44, 32, 255)); edge.putalpha(ring)
    edge.alpha_composite(out)
    edge.save(P('public/assets/items/icons', icon + '.png'))
print('ok')
