import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import poses
from cast import PLAYERS, NPCS
what, out = sys.argv[1], sys.argv[2]
k = int(sys.argv[3]) if len(sys.argv) > 3 else 3
keys = sys.argv[4].split(',') if len(sys.argv) > 4 else PLAYERS
ims = []
for key in keys:
    sh = {'walk': poses.walk_sheet, 'ride': poses.ride_sheet, 'canoe': poses.canoe_sheet}[what](key)
    ims.append(sh)
W = sum(i.width for i in ims) + 6 * len(ims)
o = Image.new('RGBA', (W, max(i.height for i in ims)), (200, 222, 212, 255))
x = 0
for i in ims:
    o.alpha_composite(i, (x, 0)); x += i.width + 6
o.resize((o.width * k, o.height * k), Image.NEAREST).save(out)
