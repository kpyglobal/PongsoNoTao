import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import poses
keys = sys.argv[2].split(','); out = sys.argv[1]; cells = sys.argv[3].split(',')  # e.g. s0,w0,n0,e0,is,iw,in
k = int(sys.argv[4]) if len(sys.argv) > 4 else 5
rows = []
for key in keys:
    sh = poses.walk_sheet(key)
    row = []
    for c in cells:
        r = {'s': 0, 'w': 1, 'n': 2, 'e': 3}[c[-2] if c[0] == 'i' else c[0]] + (4 if c[0] == 'i' else 0)
        col = int(c[-1]) if c[0] != 'i' else int(c[2])
        row.append(sh.crop((col * 64 + 4, r * 96 + 16, col * 64 + 60, r * 96 + 94)))
    rows.append(row)
W = len(cells) * 58; H = len(keys) * 80
o = Image.new('RGBA', (W, H), (200, 222, 212, 255))
for j, row in enumerate(rows):
    for i, im in enumerate(row):
        o.alpha_composite(im, (i * 58, j * 80))
o.resize((W * k, H * k), Image.NEAREST).save(out)
