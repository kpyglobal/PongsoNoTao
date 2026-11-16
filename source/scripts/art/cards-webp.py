#!/usr/bin/env python3
"""0.1.5 cards: art-ref/cards-v1 (Digital Painter masters, PNG) → public/assets/cards/*.webp (game copies).
Usage: python3 scripts/art/cards-webp.py   (Pillow). Re-run after the masters change."""
import os, glob
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'art-ref/cards-v1')
OUT = os.path.join(ROOT, 'public/assets/cards')
for d in ('', 'icons', 'sketch', 'photos', 'thumbs'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
def save(im, path, q=82, size=None):
    if size: im = im.resize(size, Image.LANCZOS)
    im.save(path, 'WEBP', quality=q, method=6)
    return os.path.getsize(path)
tot = 0
tot += save(Image.open(f'{SRC}/card_postcard_bg.png').convert('RGB'), f'{OUT}/postcard.webp', 80)
tot += save(Image.open(f'{SRC}/card_recipe_bg.png').convert('RGBA'), f'{OUT}/recipe.webp', 82)
tot += save(Image.open(f'{SRC}/photos/frame_printed_photo.png').convert('RGBA'), f'{OUT}/frame.webp', 82, (632, 526))
for p in sorted(glob.glob(f'{SRC}/icons/256/*.png')):
    n = os.path.basename(p)[:-4]
    n = n[5:] if n.startswith('icon_') else 'dish-' + n[5:]
    tot += save(Image.open(p).convert('RGBA'), f'{OUT}/icons/{n}.webp', 84)
for p in sorted(glob.glob(f'{SRC}/dish_sketches/*.png')):
    n = os.path.basename(p)[len('sketch_'):-4]
    tot += save(Image.open(p).convert('RGBA'), f'{OUT}/sketch/{n}.webp', 84, (384, 384))
for p in sorted(glob.glob(f'{SRC}/photos/photo_*.png')):
    n = os.path.basename(p)[len('photo_'):-4]
    im = Image.open(p).convert('RGB')
    tot += save(im, f'{OUT}/photos/{n}.webp', 78, (960, 720))
    tot += save(im, f'{OUT}/thumbs/{n}.webp', 74, (320, 240))
print('total', tot // 1024, 'KB')
