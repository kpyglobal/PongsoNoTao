"""Chroma-key painted art (green or magenta screen) into clean alpha PNG/WebP.
Usage: python3 scripts/key_art.py portraits [name ...] | plants
Portrait sources on a white background (detected from the border) are keyed by flood fill instead of chroma."""
import sys, glob, os
import numpy as np
from PIL import Image, ImageFilter

def key(path, screen='green'):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if screen == 'green':
        d = g - np.maximum(r, b)
    else:  # magenta / any flat screen: distance to the sampled border colour
        border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
        bg = np.median(border, axis=0)
        d = 150.0 - np.sqrt(((a - bg) ** 2).sum(-1))
    alpha = np.clip(1.0 - (d - 40.0) / 70.0, 0, 1) if screen == 'green' else np.clip(1.0 - (d - 50.0) / 50.0, 0, 1)
    # despill on semi/near-edge pixels
    if screen == 'green':
        lim = np.maximum(r, b)
        g2 = np.where(g > lim, lim + (g - lim) * 0.15, g)
        a[..., 1] = g2
    else:
        lim = g + 10
        a[..., 0] = np.where(r > lim + 60, np.minimum(r, np.maximum(g, b) + 30) , r) if False else r
        m = np.minimum(r, b)
        over = np.clip(m - g, 0, None)
        a[..., 0] = r - over * 0.5
        a[..., 2] = b - over * 0.5
    al = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert('RGBA')
    out.putalpha(al)
    return out

def key_white(path):
    """White-background art: remove only near-white regions connected to the border (keeps the white tee and
    notebook pages), then soften the edge and un-blend the white halo."""
    from scipy import ndimage
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    mn, mx = a.min(-1), a.max(-1)
    near = (mn > 226) & (mx - mn < 22)
    lab, n = ndimage.label(near)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    # big pure-white pockets enclosed by the figure (e.g. between arm and body) are background too
    sizes = ndimage.sum(near, lab, range(1, n + 1))
    for i, sz in enumerate(sizes, 1):
        if sz > 2500 and not bg[lab == i].any():
            reg = lab == i
            if a[reg].min(-1).mean() > 246:
                bg |= reg
    # small off-white pockets trapped between hair strands next to the background
    nearbg = ndimage.binary_dilation(bg, iterations=14)
    near2 = (mn > 214) & (mx - mn < 30) & ~bg
    lab2, n2 = ndimage.label(near2)
    if n2:
        sz2 = ndimage.sum(near2, lab2, range(1, n2 + 1))
        hit = ndimage.maximum(nearbg, lab2, range(1, n2 + 1))
        ok = np.zeros(n2 + 1, bool)
        ok[1:] = (sz2 < 3000) & (hit > 0)
        # pure-white pockets a little deeper in the hair (still small and close to the outline)
        far = ndimage.binary_dilation(bg, iterations=60)
        hit2 = ndimage.maximum(far, lab2, range(1, n2 + 1))
        mnm = ndimage.mean(mn, lab2, range(1, n2 + 1))
        sat = ndimage.mean(mx - mn, lab2, range(1, n2 + 1))
        ok[1:] |= (sz2 < 3000) & (hit2 > 0) & (mnm > 238) & (sat < 10)
        bg |= ok[lab2]
    zone = ndimage.binary_dilation(bg, iterations=3) & ~bg
    alpha = np.where(bg, 0.0, 1.0)
    soft = np.clip((255.0 - mn) / 45.0, 0, 1)
    alpha = np.where(zone, np.minimum(alpha, soft), alpha)
    al = np.clip(alpha, 1e-3, 1)[..., None]
    rgb = np.where(zone[..., None], (a - 255.0 * (1 - al)) / al, a)
    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert('RGBA')
    out.putalpha(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)))
    return out


def portraits(names=None):
    os.makedirs('public/assets/portraits', exist_ok=True)
    for p in sorted(glob.glob('art-src/portraits/*.jpg')):
        name = os.path.splitext(os.path.basename(p))[0]
        if names and name not in names:
            continue
        b = np.asarray(Image.open(p).convert('RGB'))
        white = np.median(np.concatenate([b[0], b[-1], b[:, 0], b[:, -1]]), axis=0).min() > 230
        im = key_white(p) if white else key(p, 'green')
        bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        im = im.crop((bb[0], bb[1], bb[2], im.height))
        # fit into 440x560 canvas, anchored bottom-centre
        s = min(440 / im.width, 560 / im.height)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        can = Image.new('RGBA', (440, 560), (0, 0, 0, 0))
        can.alpha_composite(im, ((440 - im.width) // 2, 560 - im.height))
        can.save(f'public/assets/portraits/{name}.webp', 'WEBP', quality=90, method=6)
        print(name, os.path.getsize(f'public/assets/portraits/{name}.webp'))


def plants():
    """Pack keyed botanical sprites into one atlas (4x3 cells of 384px), bottom-centre anchored."""
    import json
    src = {}
    for n in ['tree_a', 'tree_b', 'palm', 'pandanus', 'taro']:
        src[n] = key(f'art-src/plants/{n}.jpg', 'magenta')
    sheet = key('art-src/plants/small_sheet.jpg', 'magenta')
    W, H = sheet.size
    for i, n in enumerate(['bush', 'grass', 'morning_glory', 'lily']):
        cx, cy = i % 2, i // 2
        src[n] = sheet.crop((cx * W // 2, cy * H // 2, (cx + 1) * W // 2, (cy + 1) * H // 2))
    order = ['tree_a', 'tree_b', 'palm', 'pandanus', 'bush', 'grass', 'morning_glory', 'lily', 'taro']
    C, cols = 384, 4
    rows = (len(order) + cols - 1) // cols
    atlas = Image.new('RGBA', (C * cols, C * rows), (0, 0, 0, 0))
    meta = {}
    pad = 6
    for i, n in enumerate(order):
        im = src[n]
        bb = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
        im = im.crop(bb)
        s = min((C - 2 * pad) / im.width, (C - 2 * pad) / im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        # crisp alpha edge (no halos): binarise alpha, premultiply-safe colour bleed
        a = np.asarray(im.getchannel('A')).astype(np.float32)
        a = np.where(a > 110, 255, 0).astype(np.uint8)
        rgb = im.convert('RGB')
        im = rgb.convert('RGBA'); im.putalpha(Image.fromarray(a))
        cx, cy = i % cols, i // cols
        ox = cx * C + (C - im.width) // 2
        oy = cy * C + C - pad - im.height
        atlas.alpha_composite(im, (ox, oy))
        meta[n] = {'u': ox / atlas.width, 'v': 1 - (oy + im.height) / atlas.height,
                   'w': im.width / atlas.width, 'h': im.height / atlas.height, 'aspect': im.width / im.height}
    # bleed colours into transparent texels so mip levels don't fringe magenta/black
    arr = np.asarray(atlas).copy()
    alpha = arr[..., 3] > 0
    blur = Image.fromarray(arr[..., :3]).filter(ImageFilter.GaussianBlur(3))
    b = np.asarray(blur)
    arr[..., :3] = np.where(alpha[..., None], arr[..., :3], b)
    # PNG master lives in art-src/; the game ships a high-quality WebP (exact=True keeps the bled RGB under alpha=0)
    Image.fromarray(arr).save('art-src/plants/flora_atlas.png', optimize=True)
    Image.fromarray(arr).save('public/assets/sprites/props/flora_atlas.webp', 'WEBP', quality=92, method=6, exact=True, alpha_quality=100)
    json.dump(meta, open('src/world/flora_atlas.json', 'w'), indent=1)
    print(json.dumps(meta, indent=1))

if __name__ == '__main__':
    if sys.argv[1] == 'portraits':
        portraits(sys.argv[2:] or None)
    else:
        {'plants': plants}[sys.argv[1]]()
