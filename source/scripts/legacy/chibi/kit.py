"""Style-A (Q 版 2.5 頭身) pixel drawing kit: shaded shape fills, sel-out soft outline, speck cleanup."""
import colorsys
from collections import Counter
import numpy as np
from PIL import Image, ImageDraw


def hx(s):
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


def _hsv(c):
    return colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)


def _rgb(h, s, v):
    r, g, b = colorsys.hsv_to_rgb(h % 1, max(0, min(1, s)), max(0, min(1, v)))
    return (int(r * 255), int(g * 255), int(b * 255), 255)


def R(hi, base, sh, line):
    return dict(hi=hx(hi), base=hx(base), sh=hx(sh), line=hx(line))


def auto(base):
    """bright readable ramp from one colour: warm highlight, cool/violet-ish shadow, dark coloured line"""
    c = hx(base)
    h, s, v = _hsv(c)
    hi = _rgb(h + (0.08 - h) * 0.05 if s > 0.08 else h, s * 0.8, min(1, v * 1.12 + 0.06))
    hs = h + (0.7 - h) * 0.06 if s > 0.08 else h
    sh = _rgb(hs, min(1, s * 1.08 + 0.05), v * 0.8)
    ln = _rgb(hs + (0.02 if s > 0.08 else 0), min(1, s * 1.05 + 0.18), v * 0.42)
    return dict(hi=hi, base=c, sh=sh, line=ln)


def dark(rp):
    return dict(hi=rp['base'], base=rp['sh'], sh=rp['sh'], line=rp['line'])


class Cv:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.c = np.zeros((h, w, 4), np.uint8)
        s.pid = np.full((h, w), -1, np.int32)
        s.lines = {}
        s.n = 0
        yy, xx = np.mgrid[0:h, 0:w]
        s.X = xx + 0.5
        s.Y = yy + 0.5

    # ---- masks
    def ell(s, cx, cy, rx, ry):
        return ((s.X - cx) / rx) ** 2 + ((s.Y - cy) / ry) ** 2 <= 1.0

    def cap(s, p0, p1, r):
        (x0, y0), (x1, y1) = p0, p1
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy or 1e-6
        t = np.clip(((s.X - x0) * dx + (s.Y - y0) * dy) / L2, 0, 1)
        px, py = x0 + t * dx, y0 + t * dy
        return (s.X - px) ** 2 + (s.Y - py) ** 2 <= r * r

    def poly(s, pts):
        im = Image.new('L', (s.w, s.h), 0)
        ImageDraw.Draw(im).polygon([(float(x), float(y)) for x, y in pts], fill=1)
        return np.array(im).astype(bool)

    def rect(s, x0, y0, x1, y1):
        return (s.X >= x0) & (s.X < x1) & (s.Y >= y0) & (s.Y < y1)

    def ring(s, cx, cy, rx, ry, t):
        return s.ell(cx, cy, rx, ry) & ~s.ell(cx, cy, max(0.1, rx - t), max(0.1, ry - t))

    # ---- painting
    def fill(s, m, ramp, shade='edge', center=None, pattern=None, contour=True, hi=False, sh=(1, 1),
             clip=None, thr=(0.55, -0.38)):
        if clip is not None:
            m = m & clip
        if not m.any():
            return m
        s.n += 1
        pid = s.n
        s.lines[pid] = ramp['line']
        tone = np.zeros(m.shape, np.int8)
        if shade == 'ell' and center is not None:
            cx, cy, rx, ry = center
            nx = (s.X - cx) / rx
            ny = (s.Y - cy) / ry
            d = -0.62 * nx - 0.72 * ny
            tone[d > thr[0]] = 1
            tone[d < thr[1]] = -1
        elif shade == 'edge':
            dx, dy = sh
            shifted = np.zeros_like(m)
            if dx >= 0 and dy >= 0:
                shifted[:m.shape[0] - dy, :m.shape[1] - dx] = m[dy:, dx:]
            tone[m & ~shifted] = -1
            if hi:
                up = np.zeros_like(m)
                up[1:, 1:] = m[:-1, :-1]
                tone[m & ~up & (tone == 0)] = 1
        cols = {1: ramp['hi'], 0: ramp['base'], -1: ramp['sh']}
        border = s._border(m)
        ys, xs = np.nonzero(m)
        for y, x in zip(ys, xs):
            t = int(tone[y, x])
            col = cols[t]
            if pattern is not None:
                pc = pattern(x, y, t)
                if pc is not None:
                    col = pc
            if contour and border[y, x] and s._touches_other(m, x, y):
                col = ramp['line']
            s.c[y, x] = col
            s.pid[y, x] = pid
        return m

    def erase(s, m):
        s.c[m] = 0
        s.pid[m] = -1

    def _border(s, m):
        p = np.pad(m, 1)
        nb = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        return m & ~nb

    def _touches_other(s, m, x, y):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            xx, yy = x + dx, y + dy
            if 0 <= xx < s.w and 0 <= yy < s.h and not m[yy, xx] and s.c[yy, xx, 3] > 0:
                return True
        return False

    def px(s, x, y, col):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h:
            s.c[y, x] = col
            s.pid[y, x] = 0  # hand-placed detail: never cleaned

    def outline(s, color=None):
        a = s.c[..., 3] > 0
        out = s.c.copy()
        for y in range(s.h):
            for x in range(s.w):
                if a[y, x]:
                    continue
                for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < s.w and 0 <= yy < s.h and a[yy, xx]:
                        out[y, x] = color if color is not None else s.lines.get(int(s.pid[yy, xx]), hx('#3A2638'))
                        break
        s.c = out

    def clean(s):
        c = s.c.copy()
        for y in range(1, s.h - 1):
            for x in range(1, s.w - 1):
                if c[y, x, 3] == 0 or s.pid[y, x] <= 0:
                    continue
                nb = [tuple(c[y + dy, x + dx]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                me = tuple(c[y, x])
                if me in nb or any(n[3] == 0 for n in nb):
                    continue
                k, v = Counter(nb).most_common(1)[0]
                if v >= 3 and s.pid[y, x] == s.pid[y + 1, x] == s.pid[y - 1, x]:
                    s.c[y, x] = k

    def img(s):
        return Image.fromarray(s.c, 'RGBA')


def bleed(img, passes=6):
    """copy edge colours into fully transparent texels so trilinear mips never fringe dark"""
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


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
