"""
SUPERSEDED (0.1.5): the canoe_modern_* sheets are now a drawn sea kayak, see scripts/octo/kayak.py
(cd scripts/octo && python3 build.py kayak kayak8). Running this script would overwrite them with the old repaint.

0.1.4: modern canoe (現代獨木舟) sheets for 族女 / 旅人, made from the tatala canoe sheets.
Only Tao men paddle a tatala (Larry, 2026-11-14). Each canoe_<key>[_8dir]_sheet.png is copied to
canoe_modern_<key>[_8dir]_sheet.png with the hull repainted one plain colour (no red / white tatala
paint, no eye motif) and the raised carved prow ends cut down to the gunwale. The paddler is untouched.
  /tmp/imgvenv/bin/python scripts/art/make-modern-canoe.py
"""
import glob, os
from PIL import Image

D = 'public/assets/sprites/characters'
FW, FH = 128, 96
# plain rental-kayak orange: light / base / shade / outline
LIGHT, BASE, SHADE, LINE = (240, 190, 96), (222, 152, 58), (178, 112, 40), (86, 54, 30)


def is_hull(p):
    r, g, b, a = p
    if a == 0:
        return False
    mx, mn = max(r, g, b), min(r, g, b)
    if mx - mn < 30:            # cream / grey / dark outline of the tatala
        return True
    if r > 140 and g < 112 and b < 104 and r - g > 60:   # red paint
        return True
    if r > 225 and g > 225 and b > 215:  # white highlight
        return True
    return False


def frame(im, ox, oy):
    px = im.load()
    hull = [[False] * FW for _ in range(FH)]
    for y in range(FH):
        for x in range(FW):
            hull[y][x] = is_hull(px[ox + x, oy + y])
    # the hull band: rows where most opaque pixels in the lower half are hull pixels
    cols = [x for x in range(FW) if any(hull[y][x] for y in range(FH // 2, FH))]
    if not cols:
        return
    x0, x1 = min(cols), max(cols)
    mid = [x for x in cols if x0 + (x1 - x0) * 0.3 <= x <= x0 + (x1 - x0) * 0.7]
    tops = sorted(min(y for y in range(FH // 2, FH) if hull[y][x]) for x in mid if any(hull[y][x] for y in range(FH // 2, FH)))
    gun = max(68, tops[len(tops) // 2] if tops else FH // 2)  # below the paddler (front / back views)
    # cut the raised ends (carved prow / stern) down to the gunwale
    for x in range(FW):
        if x0 + (x1 - x0) * 0.25 <= x <= x0 + (x1 - x0) * 0.75:
            continue
        for y in range(FH // 3, gun - 1):
            if hull[y][x]:
                px[ox + x, oy + y] = (0, 0, 0, 0)
                hull[y][x] = False
    # repaint: outline at the hull's edge, one colour inside (shaded by the old brightness)
    for y in range(gun - 1, FH):
        for x in range(FW):
            if not hull[y][x]:
                continue
            p = px[ox + x, oy + y]
            edge = any(not (0 <= x + dx < FW and 0 <= y + dy < FH) or px[ox + x + dx, oy + y + dy][3] == 0
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            lum = (p[0] * 3 + p[1] * 6 + p[2]) / 10
            if edge:
                c = LINE
            elif y <= gun:
                c = LIGHT
            elif lum < 110 and y > gun + 1 and y >= FH - 4:
                c = SHADE
            else:
                c = BASE if lum > 150 or y < FH - 6 else SHADE
            px[ox + x, oy + y] = (*c, 255)


def main():
    raise SystemExit('superseded by scripts/octo/kayak.py (build.py kayak kayak8)')
    n = 0
    for f in sorted(glob.glob(f'{D}/canoe_player*_sheet.png')):
        name = os.path.basename(f)
        if name.startswith('canoe_modern_'):
            continue
        out = f'{D}/canoe_modern_{name[len("canoe_"):]}'
        im = Image.open(f).convert('RGBA')
        for oy in range(0, im.height, FH):
            for ox in range(0, im.width, FW):
                frame(im, ox, oy)
        im.save(out, optimize=True)
        n += 1
        print('wrote', out)
    print(n, 'sheets')


if __name__ == '__main__':
    main()
