"""Write the 方案二 (歧路旅人風) character sheets into public/assets/sprites/characters/."""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import poses
import diag
import kayak
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
        for k in keep(PLAYERS + list(OUTFIT_SHEETS)):
            save(poses.ride_sheet(k), f'ride_{k}_sheet.png')
    if 'canoe' in jobs:
        for k in keep(PLAYERS + list(OUTFIT_SHEETS)):
            save(poses.canoe_sheet(k), f'canoe_{k}_sheet.png')
    # 8-direction sheets for the playable characters (base + outfit looks); base sheets are left as they are
    eight = keep(PLAYERS + list(OUTFIT_SHEETS))
    if 'walk8' in jobs:
        for k in eight:
            save(diag.walk8_sheet(k), f'{k}_8dir_sheet.png')
    if 'ride8' in jobs:
        for k in eight:
            save(diag.ride8_sheet(k), f'ride_{k}_8dir_sheet.png')
    if 'canoe8' in jobs:
        for k in eight:
            save(diag.canoe8_sheet(k), f'canoe_{k}_8dir_sheet.png')
    # modern sea kayak (canoe_modern_*: 族女 / 旅人; only Tao men paddle a tatala)
    if 'kayak' in jobs:
        for k in eight:
            save(kayak.kayak_sheet(k), f'canoe_modern_{k}_sheet.png')
    if 'kayak8' in jobs:
        for k in eight:
            save(kayak.kayak8_sheet(k), f'canoe_modern_{k}_8dir_sheet.png')


if __name__ == '__main__':
    main(sys.argv[1:] or ['walk', 'ride', 'canoe'])
