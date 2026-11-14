"""Write the 方案二 (歧路旅人風) character sheets into public/assets/sprites/characters/."""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import poses
from cast import PLAYERS, NPCS, OUTFIT_SHEETS

OUT = os.environ.get('OCTO_OUT') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'assets', 'sprites', 'characters')


def bleed(img, passes=6):
    """copy edge colours into transparent texels so trilinear mips never fringe dark"""
    arr = np.asarray(img).copy()
    rgb = arr[..., :3].astype(np.int32)
    a = arr[..., 3] > 0
    filled = a.copy()
    for _ in range(passes):
        acc = np.zeros_like(rgb)
        cnt = np.zeros(a.shape, np.int32)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(filled, dy, 0), dx, 1)
            shc = np.roll(np.roll(rgb, dy, 0), dx, 1)
            acc += shc * sh[..., None]
            cnt += sh
        new = (~filled) & (cnt > 0)
        rgb[new] = acc[new] // cnt[new][:, None]
        filled |= new
    arr[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


def save(img, name):
    p = os.path.join(OUT, name)
    bleed(img).save(p, optimize=True)
    print('wrote', name, img.size)


def main(jobs):
    """OCTO_ONLY=a,b limits which cast keys are written (others stay untouched)."""
    os.makedirs(OUT, exist_ok=True)
    only = [k for k in os.environ.get('OCTO_ONLY', '').split(',') if k]
    keep = (lambda ks: [k for k in ks if k in only]) if only else (lambda ks: ks)
    if 'walk' in jobs:
        for k in keep(PLAYERS + NPCS + list(OUTFIT_SHEETS)):
            save(poses.walk_sheet(k), f'{k}_sheet.png')
    if 'ride' in jobs:
        for k in keep(PLAYERS):
            save(poses.ride_sheet(k), f'ride_{k}_sheet.png')
    if 'canoe' in jobs:
        for k in keep(PLAYERS):
            save(poses.canoe_sheet(k), f'canoe_{k}_sheet.png')


if __name__ == '__main__':
    main(sys.argv[1:] or ['walk', 'ride', 'canoe'])
