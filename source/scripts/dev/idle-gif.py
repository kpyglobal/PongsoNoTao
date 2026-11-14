"""Assemble screenshots-octo/idle-frames/*.png (in-game idle close-up) into an animated GIF."""
import glob, os, sys
from PIL import Image
src = sys.argv[1] if len(sys.argv) > 1 else 'screenshots-octo/idle-frames'
out = sys.argv[2] if len(sys.argv) > 2 else 'screenshots-octo/desktop-12-idle-in-game.gif'
files = sorted(glob.glob(os.path.join(src, 'f*.png')))
frames = [Image.open(f).convert('RGB') for f in files]
pal = frames[0].quantize(colors=255, method=Image.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.NONE) for f in frames]
# real capture cadence from file mtimes so the breathing plays at in-game speed
ts = [os.path.getmtime(f) for f in files]
dur = [max(40, int(round((ts[i + 1] - ts[i]) * 1000))) for i in range(len(ts) - 1)]
dur.append(dur[-1] if dur else 110)
q[0].save(out, save_all=True, append_images=q[1:], duration=dur, loop=0, optimize=False)
print(out, len(q), os.path.getsize(out))
