"""0.1.6: lossless WebP copies of the sprite PNGs (exact RGB under transparent pixels, so mipmaps match the PNG).
The PNGs stay the art masters in public/assets/sprites/ (the art scripts read and write them); the game loads the
.webp twins and the build leaves the PNGs out of dist/ (vite.config.ts assetPipeline). Run after regenerating sprites:
    python3 scripts/sprites-webp.py
"""
from PIL import Image
import glob, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
a = b = 0
for f in sorted(glob.glob('public/assets/sprites/**/*.png', recursive=True)):
    out = f[:-4] + '.webp'
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(f):
        continue
    Image.open(f).save(out, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    a += os.path.getsize(f); b += os.path.getsize(out)
print('sprites png', a, '-> webp', b)
