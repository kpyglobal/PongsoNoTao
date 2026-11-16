#!/usr/bin/env python3
"""
0.1.5 arrival intro (2.5D, v2 art): turn Digital Painter's layers into the game's WebP assets + manifest.

    /workspace/pld_venv/bin/python scripts/art/build-intro25d-v2.py

Sources: art-ref/arrival/layers25d/ (v1: title vista, cabin window / wing, bow deck, bow spray) and
art-ref/arrival/layers25d-v2/ (v2: closer islands, loop tiles, rear-view yacht, plane poses, props, trails).
Every image is cropped to what it covers and scaled down; the manifest keeps each crop in source pixels of its
own canvas (world plates 3072x1440, camera-locked layers 2560x1440, sprites their own canvas), so the scene code
places everything in the painter's coordinates. Output: public/assets/intro25d/{plane,yacht}/*.webp and
public/assets/intro25d/intro25d.json (the old folder is emptied first). Prints sizes and the total.
"""
import json, os, shutil
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
V1 = os.path.join(ROOT, 'art-ref', 'arrival', 'layers25d')
V2 = os.path.join(ROOT, 'art-ref', 'arrival', 'layers25d-v2')
OUT = os.path.join(ROOT, 'public', 'assets', 'intro25d')

WORLD = 0.75         # 3072-wide plates -> 2304
TILE = 0.5             # loop tiles are soft (clouds, swell): 1536 wide is plenty
CAM = 0.75             # wing / window frame / bow deck -> 1920 wide

# (id, source, scale, quality, opaque?, keep full width for wrapping?)
PLANE = [
    ('sky', V1 + '/plane/00_sky.png', WORLD * 0.75, 72, True, False),
    ('sea', V1 + '/plane/01_sea.png', WORLD, 74, False, False),
    ('lanyu1', V1 + '/plane/03_lanyu.png', WORLD, 80, False, False),
    ('lanyu2', V2 + '/plane/03_lanyu.png', WORLD, 80, False, False),
    ('mist', V1 + '/plane/04_mist_island.png', WORLD, 75, False, False),
    ('cfar_a', V2 + '/plane/20_clouds_far_tile_a.png', TILE, 74, False, True),
    ('cfar_b', V2 + '/plane/20_clouds_far_tile_b.png', TILE, 74, False, True),
    ('cmid_a', V2 + '/plane/21_clouds_mid_tile_a.png', TILE, 74, False, True),
    ('cnear_a', V2 + '/plane/22_clouds_near_tile_a.png', TILE, 74, False, True),
    ('wing', V1 + '/plane/07_wing.png', CAM, 82, False, False),
    ('frame', V1 + '/plane/08_window_frame.png', CAM * 0.8, 82, False, False),
]
POSES = {'rear': ('10_plane_rear', 0.5), 'bank': ('11_plane_bank', 0.4), 'descend': ('12_plane_descend', 0.3)}
for pose, (stem, sc) in POSES.items():
    PLANE.append((pose, f'{V2}/plane/{stem}.png', sc, 82, False, False))
    PLANE.append((pose + '_trails', f'{V2}/plane/{stem}_trails.png', sc * 0.6, 70, False, False))
    for side in 'LR':
        for f in ('disc', 'a', 'b', 'c'):
            PLANE.append((f'{pose}_prop_{side}_{f}', f'{V2}/plane/{stem}_prop_{side}_{f}.png', sc, 76, False, False))

YACHT = [
    ('sky', V1 + '/yacht/00_sky.png', WORLD * 0.75, 72, True, False),
    ('lanyu1', V1 + '/yacht/01_lanyu.png', WORLD, 80, False, False),
    ('lanyu2', V2 + '/yacht/01_lanyu.png', WORLD, 80, False, False),
    ('sea_far', V1 + '/yacht/02_sea_far.png', WORLD, 72, False, False),
    ('mist', V1 + '/yacht/05_sea_mist.png', WORLD, 72, False, False),
    ('clouds_a', V2 + '/yacht/20_clouds_tile_a.png', TILE, 74, False, True),
    ('clouds_b', V2 + '/yacht/20_clouds_tile_b.png', TILE, 74, False, True),
    ('wmid_a', V2 + '/yacht/21_waves_mid_tile_a.png', TILE, 70, False, True),
    ('wmid_b', V2 + '/yacht/21_waves_mid_tile_b.png', TILE, 70, False, True),
    ('wmid_c', V2 + '/yacht/21_waves_mid_tile_c.png', TILE, 70, False, True),
    ('wnear_a', V2 + '/yacht/22_waves_near_tile_a.png', TILE, 70, False, True),
    ('wnear_b', V2 + '/yacht/22_waves_near_tile_b.png', TILE, 70, False, True),
    ('wnear_c', V2 + '/yacht/22_waves_near_tile_c.png', TILE, 70, False, True),
    ('bow', V1 + '/yacht/09_bow_deck.png', CAM, 82, False, False),
    ('bspray_a', V1 + '/yacht/06_spray_a.png', CAM * 0.6, 70, False, False),
    ('bspray_b', V1 + '/yacht/07_spray_b.png', CAM * 0.6, 70, False, False),
    ('hull', V2 + '/yacht/10_yacht_rear.png', 0.66, 82, False, False),
    ('wake', V2 + '/yacht/11_yacht_wake.png', 0.45, 72, False, False),
    ('spray', V2 + '/yacht/12_yacht_spray.png', 0.45, 72, False, False),
]


def export(mode, items):
    d = os.path.join(OUT, mode)
    os.makedirs(d, exist_ok=True)
    man, total = {}, 0
    for id_, src, sc, q, opaque, wrap in items:
        im = Image.open(src).convert('RGB' if opaque else 'RGBA')
        W, H = im.size
        if opaque:
            box = (0, 0, W, H)
        else:
            bb = im.getchannel('A').point(lambda a: 255 if a > 3 else 0).getbbox() or (0, 0, 1, 1)
            box = (0, bb[1], W, bb[3]) if wrap else bb
        crop = im.crop(box)
        w = max(2, round(crop.width * sc))
        h = max(2, round(crop.height * sc))
        crop = crop.resize((w, h), Image.LANCZOS)
        f = f'{id_}.webp'
        p = os.path.join(d, f)
        kw = dict(quality=q, method=6)
        if not opaque:
            kw['alpha_quality'] = 80
        crop.save(p, 'WEBP', **kw)
        n = os.path.getsize(p)
        total += n
        man[id_] = {'file': f'{mode}/{f}', 'canvas': [W, H], 'rect': [box[0], box[1], box[2] - box[0], box[3] - box[1]], 'px': [w, h]}
        if wrap:
            man[id_]['wrap'] = True
        print(f'  {mode}/{f:28s} {w:5d}x{h:<5d} {n / 1024:7.1f} KB')
    return man, total


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    pm, pt = export('plane', PLANE)
    ym, yt = export('yacht', YACHT)
    man = {
        '_note': 'generated by scripts/art/build-intro25d-v2.py; do not edit by hand',
        'version': 2,
        'plane': {'images': pm},
        'yacht': {'images': ym},
    }
    with open(os.path.join(OUT, 'intro25d.json'), 'w') as fh:
        json.dump(man, fh, indent=1)
    js = os.path.getsize(os.path.join(OUT, 'intro25d.json'))
    print(f'plane {pt / 1048576:.2f} MB, yacht {yt / 1048576:.2f} MB, manifest {js / 1024:.1f} KB, total {(pt + yt + js) / 1048576:.2f} MB')


main()
