#!/usr/bin/env python3
"""Style A (Q 版 2.5 頭身) sprite + portrait generator for Pongso no Tao.

Writes public/assets/sprites/characters/:
  <kind>_sheet.png            256x384  walk sheet, 4 cols (frames) x 4 rows (s, w, n, e), 64x96 frames
  ride_<outfit>_sheet.png     384x384  scooter riding, 96x96 frames, scooter drawn in
  canoe_<outfit>_sheet.png    512x384  tatala paddling, 128x96 frames, waterline on row 88
and public/assets/portraits/<name>.webp (440x560 half-body, pixel art x5).
Usage: python3 scripts/generate_chibi.py [walk|ride|canoe|portraits|preview ...]
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from chibi.character import sheet, FW, FH
from chibi.cast import PLAYER, NPC

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'public', 'assets', 'sprites', 'characters')


def walk():
    for k, sp in {**PLAYER, **NPC}.items():
        sheet(sp).save(os.path.join(OUT, f'{k}_sheet.png'))
        print('walk', k)


def ride():
    from chibi.poses import ride_frame, RW, RH
    for k, sp in PLAYER.items():
        sheet(sp, ride_frame, RW, RH).save(os.path.join(OUT, f'ride_{k}_sheet.png'))
        print('ride', k)


def canoe():
    from chibi.poses import canoe_frame, CW, CH
    for k, sp in PLAYER.items():
        sheet(sp, canoe_frame, CW, CH).save(os.path.join(OUT, f'canoe_{k}_sheet.png'))
        print('canoe', k)


def portraits():
    from chibi.portrait import build_all
    # Chibi portraits were rejected; write them beside the proposals, never over the painted ones.
    build_all(os.path.join(ROOT, 'style-proposals', 'chibi-portraits-archive'))


if __name__ == '__main__':
    jobs = sys.argv[1:] or ['walk', 'ride', 'canoe']  # 'portraits' (chibi) is opt-in; the game uses the painted art-src portraits
    for j in jobs:
        globals()[j]()
