#!/usr/bin/env python3
"""
0.1.4 arrival intro (2.5D parallax): turn the painted layers into the game's WebP assets + manifest.

    /workspace/pld_venv/bin/python scripts/art/build-intro25d.py            # final layers where present, else placeholders
    /workspace/pld_venv/bin/python scripts/art/build-intro25d.py --placeholders   # force the keyframe cut-outs

Sources, per mode (plane, yacht):
  1. art-ref/arrival/layers25d/<mode>/   Digital Painter's layers (PNG with alpha), when the folder has images;
  2. art-ref/arrival/placeholder25d/<mode>/   rough cut-outs of the keyframes (made by cut-intro-placeholders.py).

Layer list: <dir>/layers.json if present ({size, target, horizon, sun, layers: [{file, kind, depth, drift, sea,
frames, anchor, screen}]}). Without it the files are read in name order (far -> near) and the kind is guessed from
the name: sky / plate / island / sea / cloud / mist / spray|foam / wing|bow|overlay; numbers for depth / speed are
taken from README.md lines that mention the file ("depth 40", "speed 0.002"), else defaults by kind.

Output: public/assets/intro25d/<mode>/*.webp, public/assets/intro25d/shared/*.webp (cloud cards, glint tile) and
public/assets/intro25d/intro25d.json. Plates are capped at 2048 px wide (phones), overlays are cropped to what they
cover. Prints every file size and the total (aim: under ~1.5 MB).
"""
import json, os, re, shutil, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, 'art-ref', 'arrival')
OUT = os.path.join(ROOT, 'public', 'assets', 'intro25d')
MAX_W = 2048
MAX_W_YACHT = 1600  # yacht seas/sky are large; 1600 keeps the pack under ~1.5 MB
MASK_W = 512
DEFAULT_DEPTH = {'sky': 400, 'plate': 100, 'island': 100, 'sea': 90, 'cloud': 30, 'mist': 10, 'spray': 0, 'overlay': 0}


def guess_kind(name):
    n = name.lower()
    for k, keys in [('overlay', ['wing', 'bow', 'overlay', 'window', 'cockpit', 'deck']), ('spray', ['spray', 'foam', 'wake']),
                    ('mist', ['mist', 'haze', 'fog']), ('cloud', ['cloud']), ('sea', ['sea', 'ocean', 'water']),
                    ('island', ['island', 'lanyu', 'land']), ('sky', ['sky']), ('plate', ['plate', 'back'])]:
        if any(x in n for x in keys):
            return k
    return 'cloud'


def readme_numbers(d):
    out = {}
    p = os.path.join(d, 'README.md')
    if not os.path.exists(p):
        return out
    for line in open(p, encoding='utf-8'):
        m = re.search(r'([\w\-]+\.(?:png|webp))', line)
        if not m:
            continue
        e = {}
        for key, pat in [('depth', r'depth\D{0,4}([\d.]+)'), ('drift', r'(?:speed|drift|parallax)\D{0,4}(-?[\d.]+)')]:
            mm = re.search(pat, line, re.I)
            if mm:
                e[key] = float(mm.group(1))
        out[m.group(1)] = e
    return out



# Larry picked 1.5× island height. Digital Painter may leave the file as 03_lanyu_x1.5.png
# (or 01_lanyu_x1.5.png) or already rename it to the canonical 03_lanyu.png / 01_lanyu.png.
# Prefer the _x1.5 name when both exist; fall back to the canonical name. Ship as the canonical WebP
# so public/assets/intro25d/ never holds both.
ISLAND_SHIP = {
    '03_lanyu.png': '03_lanyu.webp', '03_lanyu_x1.5.png': '03_lanyu.webp',
    '01_lanyu.png': '01_lanyu.webp', '01_lanyu_x1.5.png': '01_lanyu.webp',
}


def resolve_src(d, fname):
    """Return the filename actually on disk for this layer."""
    x15 = None
    if fname.endswith('_x1.5.png'):
        canon, x15 = fname.replace('_x1.5.png', '.png'), fname
    elif fname in ('03_lanyu.png', '01_lanyu.png'):
        canon, x15 = fname, fname.replace('.png', '_x1.5.png')
    else:
        return fname
    if x15 and os.path.exists(os.path.join(d, x15)):
        return x15
    if os.path.exists(os.path.join(d, canon)):
        return canon
    return fname


def load_spec(d, mode):
    # 1) the folder's own layers.json, 2) our mapping of Digital Painter's set (scripts/art/intro25d-<mode>.json),
    # 3) guessed from the file names
    for p in (os.path.join(d, 'layers.json'), os.path.join(ROOT, 'scripts', 'art', f'intro25d-{mode}.json')):
        if os.path.exists(p) and (p.endswith('layers.json') or os.path.abspath(d).endswith(os.path.join('layers25d', mode))):
            spec = json.load(open(p))
            missing = [e['file'] for e in spec['layers'] if not os.path.exists(os.path.join(d, resolve_src(d, e['file'])))]
            if not missing:
                print(f'  layer list: {os.path.relpath(p, ROOT)}')
                return spec
            print(f'  ! {os.path.relpath(p, ROOT)} names missing files {missing}; guessing instead')
    files = sorted(f for f in os.listdir(d) if f.lower().endswith(('.png', '.webp')) and 'mask' not in f.lower() and not f.startswith('_') and 'alt' not in f.lower())
    nums = readme_numbers(d)
    layers = []
    for f in files:
        k = guess_kind(f)
        e = {'file': f, 'kind': k, 'depth': DEFAULT_DEPTH[k]}
        e.update(nums.get(f, {}))
        if k == 'overlay':
            e['anchor'] = [1.0, 0.0] if 'wing' in f.lower() else [0.5, 1.0]
            e['screen'] = e['anchor'][:] if 'wing' in f.lower() else [0.5, 1.0]
        sea = os.path.splitext(f)[0] + '_seamask.png'
        if os.path.exists(os.path.join(d, sea)):
            e['sea'] = sea
        layers.append(e)
    sprays = [e['file'] for e in layers if e['kind'] == 'spray']
    if len(sprays) > 1:  # several spray files = frames of one spray layer
        first = next(e for e in layers if e['kind'] == 'spray')
        first['frames'] = sprays
        layers = [e for e in layers if e['kind'] != 'spray' or e is first]
    w, h = Image.open(os.path.join(d, layers[0]['file'])).size
    print(f'  ! {d}: no layers.json, guessed kinds from file names (check target / horizon / sun)')
    return {'size': [w, h], 'target': [0.5, 0.6], 'horizon': 0.45, 'sun': [0.15, 0.3], 'layers': layers}


def has_images(d):
    return os.path.isdir(d) and any(f.lower().endswith(('.png', '.webp')) for f in os.listdir(d))


def save_webp(im, path, q=88):
    im.save(path, 'WEBP', quality=q, method=6, alpha_quality=90)
    return os.path.getsize(path)


def build_mode(mode, src, sizes):
    spec = load_spec(src, mode)
    pw, ph = spec['size']
    cap = MAX_W_YACHT if mode == "yacht" else MAX_W
    k = min(1.0, cap / pw)
    od = os.path.join(OUT, mode)
    os.makedirs(od, exist_ok=True)
    out_layers = []
    for e in spec['layers']:
        frames = e.get('frames') or [e['file']]
        src_frames = [resolve_src(src, f) for f in frames]
        ims = [Image.open(os.path.join(src, f)).convert('RGBA') for f in src_frames]
        if e.get('offset'):  # a camera-locked layer smaller than the plate (Digital Painter: 2560 frame on a 3072 plate)
            ox, oy = e['offset']
            padded = []
            for im in ims:
                c = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
                c.paste(im, (ox, oy))
                padded.append(c)
            ims = padded
        elif ims[0].size != (pw, ph):
            ims = [im.resize((pw, ph), Image.LANCZOS) for im in ims]
        opaque = e['kind'] in ('plate', 'sky')
        if opaque:
            box = (0, 0, pw, ph)
        else:  # crop to what the layer covers (union over frames), a small margin for soft edges
            boxes = [im.getchannel('A').point(lambda a: 255 if a > 6 else 0).getbbox() for im in ims]
            boxes = [b for b in boxes if b]
            if not boxes:
                continue
            box = (max(0, min(b[0] for b in boxes) - 4), max(0, min(b[1] for b in boxes) - 4), min(pw, max(b[2] for b in boxes) + 4), min(ph, max(b[3] for b in boxes) + 4))
        names = []
        for f, im in zip(frames, ims):
            c = im.crop(box)
            c = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
            if opaque:
                c = c.convert('RGB')
            n = ISLAND_SHIP.get(f, os.path.splitext(f)[0] + '.webp')
            q = (82 if opaque else 80) if mode == 'yacht' else (88 if opaque else 90)
            sizes[f'{mode}/{n}'] = save_webp(c, os.path.join(od, n), q)
            names.append(n)
        le = {k2: v for k2, v in e.items() if k2 not in ('file', 'frames', 'sea', 'offset')}
        le['file'] = names[0]
        if len(names) > 1:
            le['frames'] = names
        le['rect'] = [round(box[0] / pw, 5), round(box[1] / ph, 5), round((box[2] - box[0]) / pw, 5), round((box[3] - box[1]) / ph, 5)]
        le.setdefault('depth', DEFAULT_DEPTH.get(e['kind'], 50))
        if e.get('sea'):
            m = Image.open(os.path.join(src, e['sea'])).convert('L').crop(box)
            m = m.resize((MASK_W, max(1, round(MASK_W * m.height / m.width))), Image.LANCZOS)
            n = os.path.splitext(e['sea'])[0] + '.webp'
            sizes[f'{mode}/{n}'] = save_webp(m.convert('RGB'), os.path.join(od, n), 80)
            le['sea'] = n
        out_layers.append(le)
    fr = spec.get('frame', [0, pw])  # the visible frame inside the plate (x0, width) in source px; the rest is overscan
    return {'size': [round(pw * k), round(ph * k)], 'aspect': round(pw / ph, 5), 'frame': [round(fr[0] / pw, 5), round(fr[1] / pw, 5)],
            'target': spec.get('target', [0.5, 0.6]),
            'focus': spec.get('focus', spec.get('target', [0.5, 0.6])),
            'horizon': spec.get('horizon', 0.45), 'sun': spec.get('sun', [0.15, 0.3]), 'layers': out_layers}


def build_shared(sizes):
    src = os.path.join(ART, 'layers')
    od = os.path.join(OUT, 'shared')
    os.makedirs(od, exist_ok=True)
    out = {'burst': [], 'wisp': [], 'glint': None}
    for f, key, w in [('cloud_cumulus_a.png', 'burst', 512), ('cloud_cumulus_b.png', 'burst', 512), ('cloud_cumulus_c.png', 'burst', 512),
                      ('cloud_bank.png', 'burst', 512), ('cloud_wisp_a.png', 'wisp', 512), ('cloud_wisp_b.png', 'wisp', 512)]:
        p = os.path.join(src, f)
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGBA')
        bb = im.getchannel('A').getbbox() or (0, 0, im.width, im.height)
        im = im.crop(bb)
        im = im.resize((w, max(1, round(w * im.height / im.width))), Image.LANCZOS)
        n = f.replace('.png', '.webp')
        sizes[f'shared/{n}'] = save_webp(im, os.path.join(od, n), 86)
        out[key].append({'file': n, 'aspect': round(im.width / im.height, 4)})
    g = os.path.join(src, 'sea_glint_tile_additive.png')
    if os.path.exists(g):
        im = Image.open(g).convert('L').resize((256, 256), Image.LANCZOS)
        sizes['shared/sea_glint.webp'] = save_webp(im.convert('RGB'), os.path.join(od, 'sea_glint.webp'), 82)
        out['glint'] = 'sea_glint.webp'
    return out


def main():
    force_ph = '--placeholders' in sys.argv
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    sizes, man, used = {}, {'_note': 'generated by scripts/art/build-intro25d.py; do not edit by hand'}, {}
    for mode in ('plane', 'yacht'):
        final = os.path.join(ART, 'layers25d', mode)
        ph = os.path.join(ART, 'placeholder25d', mode)
        if has_images(final) and not force_ph:
            src, used[mode] = final, 'final'
        else:
            if not has_images(ph):
                os.system(f'{sys.executable} {os.path.join(ROOT, "scripts", "art", "cut-intro-placeholders.py")} {mode}')
            src, used[mode] = ph, 'placeholder'
        print(f'{mode}: {used[mode]} layers from {os.path.relpath(src, ROOT)}')
        man[mode] = build_mode(mode, src, sizes)
        man[mode]['source'] = used[mode]
    man['shared'] = build_shared(sizes)
    json.dump(man, open(os.path.join(OUT, 'intro25d.json'), 'w'), indent=1, ensure_ascii=False)
    sizes['intro25d.json'] = os.path.getsize(os.path.join(OUT, 'intro25d.json'))
    for k, v in sorted(sizes.items()):
        print(f'  {v / 1024:8.1f} KB  {k}')
    tot = sum(sizes.values())
    print(f'total {tot / 1024:.1f} KB ({tot / 1048576:.2f} MB){"  (over the ~1.5 MB budget!)" if tot > 1.5 * 1048576 else ""}')


if __name__ == '__main__':
    main()
