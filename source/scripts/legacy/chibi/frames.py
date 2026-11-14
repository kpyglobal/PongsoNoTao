"""crop frames from sheets and show them big: frames.py out z fw fh sheet:col,row ..."""
import sys, numpy as np
from PIL import Image
out, z, fw, fh = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
crops = []
for a in sys.argv[5:]:
    p, cr = a.rsplit(':', 1); c, r = map(int, cr.split(','))
    im = np.array(Image.open(p).crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)))
    im[im[..., 3] == 0] = 0
    crops.append(Image.fromarray(im))
top = int(sys.argv[5].split('@')[0]) if '@' in sys.argv[5] else 0
W = len(crops) * (fw + 2); s = Image.new('RGBA', (W, fh), (214, 232, 228, 255))
for i, c in enumerate(crops): s.alpha_composite(c, (i * (fw + 2), 0))
s = s.crop((0, int(fh * 0.38), W, fh))
s.resize((s.width * z, s.height * z), Image.NEAREST).save(out)
