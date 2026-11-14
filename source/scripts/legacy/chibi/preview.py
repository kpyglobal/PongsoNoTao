import sys, os
from PIL import Image
def show(paths, out, z=3, bg=(214, 232, 228, 255)):
    ims = [Image.open(p) for p in paths]
    W = sum(i.width for i in ims) + 6 * len(ims); H = max(i.height for i in ims)
    s = Image.new('RGBA', (W, H), bg); x = 0
    for i in ims:
        b = Image.new('RGBA', i.size, bg); b.alpha_composite(Image.fromarray(__import__('numpy').where(__import__('numpy').array(i)[..., 3:4] > 0, __import__('numpy').array(i), 0).astype('uint8'), 'RGBA'))
        s.alpha_composite(b, (x, 0)); x += i.width + 6
    s.resize((W * z, H * z), Image.NEAREST).save(out)
if __name__ == '__main__':
    show(sys.argv[3:], sys.argv[1], int(sys.argv[2]))
