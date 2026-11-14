"""16-bit (SNES / HD-2D) pixel kit: 4-tone hue-shifted ramps, lit shape fills, contour + outline styles."""
import colorsys
from collections import Counter
import numpy as np
from PIL import Image, ImageDraw

L = np.array([-0.55, -0.68, 0.48]); L = L / np.linalg.norm(L)


def hx(s):
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


def _hsv(c):
    return colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)


def _rgb(h, s, v):
    r, g, b = colorsys.hsv_to_rgb(h % 1, max(0, min(1, s)), max(0, min(1, v)))
    return (int(round(r * 255)), int(round(g * 255)), int(round(b * 255)), 255)


def _toward(h, t, a):
    d = ((t - h + 0.5) % 1) - 0.5
    return h + d * a


# per-style ramp recipes: (value mult, value add, sat mult, hue shift amount toward warm/cool)
RECIPES = {
    'ff6':  dict(hi=(1.16, 0.06, 0.80, 0.10), sh=(0.70, 0.0, 1.12, 0.10), deep=(0.50, 0.0, 1.18, 0.16), line=(0.26, 0.0, 1.2, 0.2)),
    'octo': dict(hi=(1.14, 0.08, 0.78, 0.08), sh=(0.78, 0.0, 1.06, 0.08), deep=(0.58, 0.0, 1.12, 0.13), line=(0.36, 0.0, 1.15, 0.16)),
    'mana': dict(hi=(1.10, 0.10, 0.82, 0.10), sh=(0.80, 0.0, 1.14, 0.09), deep=(0.62, 0.0, 1.22, 0.14), line=(0.40, 0.0, 1.3, 0.16)),
}


def ramp(base, style):
    c = hx(base) if isinstance(base, str) else base
    h, s, v = _hsv(c)
    rc = RECIPES[style]
    out = {'base': c}
    grey = s < 0.07
    for k, (vm, va, sm, hs) in rc.items():
        if k == 'hi':
            hh = h if grey else _toward(h, 0.13, hs)
        else:
            hh = h if grey else _toward(h, 0.70, hs)
        ss = s * sm + (0 if grey else (0.04 if k != 'hi' else 0))
        if grey and k != 'hi':  # neutral greys still get a faint cool shadow
            hh, ss = 0.66, min(0.18, 0.05 + (1 - vm) * 0.2)
        out[k] = _rgb(hh, ss, min(1, v * vm + va))
    return out


def darker(rp):
    """the same material one step into shadow (far limbs)"""
    return dict(hi=rp['base'], base=rp['sh'], sh=rp['deep'], deep=rp['line'], line=rp['line'])


class Cv:
    def __init__(s, w, h, style):
        s.w, s.h, s.style = w, h, style
        s.c = np.zeros((h, w, 4), np.uint8)
        s.pid = np.full((h, w), -1, np.int32)
        s.parts = {}
        s.n = 0
        yy, xx = np.mgrid[0:h, 0:w]
        s.X = xx + 0.5
        s.Y = yy + 0.5
        s.th = dict(ff6=(0.80, 0.30, -0.25), octo=(0.80, 0.36, -0.18), mana=(0.78, 0.30, -0.28))[style]

    # ---- masks
    def ell(s, cx, cy, rx, ry):
        return ((s.X - cx) / rx) ** 2 + ((s.Y - cy) / ry) ** 2 <= 1.0

    def cap(s, p0, p1, r, r1=None):
        (x0, y0), (x1, y1) = p0, p1
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy or 1e-6
        t = np.clip(((s.X - x0) * dx + (s.Y - y0) * dy) / L2, 0, 1)
        px, py = x0 + t * dx, y0 + t * dy
        rr = r if r1 is None else r + (r1 - r) * t
        return (s.X - px) ** 2 + (s.Y - py) ** 2 <= rr * rr

    def poly(s, pts):
        im = Image.new('L', (s.w, s.h), 0)
        ImageDraw.Draw(im).polygon([(float(x), float(y)) for x, y in pts], fill=1)
        return np.array(im).astype(bool)

    def rect(s, x0, y0, x1, y1):
        return (s.X >= x0) & (s.X < x1) & (s.Y >= y0) & (s.Y < y1)

    # ---- lighting
    def light(s, shade):
        kind = shade[0]
        if kind == 'ell':
            _, cx, cy, rx, ry = shade
            nx = np.clip((s.X - cx) / rx, -1, 1)
            ny = np.clip((s.Y - cy) / ry, -1, 1)
            nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
            n = np.stack([nx, ny, nz], -1)
            n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-6
            return n @ L
        if kind == 'cyl':
            _, (x0, y0), (x1, y1), r = shade
            d = np.array([x1 - x0, y1 - y0], float)
            d /= np.linalg.norm(d) + 1e-6
            p = np.array([-d[1], d[0]])
            u = np.clip(((s.X - x0) * p[0] + (s.Y - y0) * p[1]) / max(r, 0.5), -1, 1)
            nz = np.sqrt(np.clip(1 - u * u, 0, 1))
            nn = np.stack([u * p[0], u * p[1], nz], -1)
            # tilt the normal a little up so the top of every limb catches light
            return nn @ L + 0.05
        if kind == 'soft':  # gentle planar gradient: lit top-left, never deep (faces, hair masses)
            _, cx, cy, rx, ry, k = shade
            nx = np.clip((s.X - cx) / rx, -1.2, 1.2)
            ny = np.clip((s.Y - cy) / ry, -1.2, 1.2)
            return np.maximum(0.5 - k * (0.55 * nx + 0.45 * ny), s.th[2] + 0.02)
        if kind == 'flat':
            return np.full(s.X.shape, shade[1] if len(shade) > 1 else 0.5)
        raise ValueError(kind)

    def fill(s, m, rp, shade=('flat',), pattern=None, contour=True, ao=0, clip=None, three=False):
        if clip is not None:
            m = m & clip
        if not m.any():
            return m
        s.n += 1
        pid = s.n
        s.parts[pid] = rp
        b = s.light(shade)
        if ao:  # darken the bottom rows of the shape (occlusion / cast shadow)
            ys = np.nonzero(m.any(1))[0]
            y1 = ys.max() + 1
            b = b - np.clip((s.Y - (y1 - ao)) / ao, 0, 1) * 0.45
        t0, t1, t2 = s.th
        tone = np.where(b > t0, 2, np.where(b > t1, 1, np.where(b > t2, 0, -1)))
        if three or s.style == 'ff6':
            tone = np.maximum(tone, 0) if s.style == 'ff6' else tone
        cols = {2: 'hi', 1: 'base', 0: 'sh', -1: 'deep'}
        p = np.pad(m, 1)
        inner = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        border = m & ~inner
        occ = s.c[..., 3] > 0
        ys, xs = np.nonzero(m)
        for y, x in zip(ys, xs):
            r = rp
            if pattern is not None:
                pr = pattern(x, y)
                if pr is not None:
                    r = pr
            col = r[cols[int(tone[y, x])]]
            if contour and border[y, x]:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < s.w and 0 <= yy < s.h and not m[yy, xx] and occ[yy, xx]:
                        col = rp['line'] if s.style in ('ff6', 'mana') else rp['deep']
                        if s.style == 'octo' and (dx < 0 or dy < 0):
                            col = rp['sh']
                        break
            s.c[y, x] = col
            s.pid[y, x] = pid
        return m

    def erase(s, m):
        s.c[m] = 0
        s.pid[m] = -1

    def px(s, x, y, col):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h:
            s.c[y, x] = col
            s.pid[y, x] = 0

    def outline(s):
        a = s.c[..., 3] > 0
        out = s.c.copy()
        BLACK = hx('#1E1420')
        for y in range(s.h):
            for x in range(s.w):
                if a[y, x]:
                    continue
                for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < s.w and 0 <= yy < s.h and a[yy, xx]:
                        rp = s.parts.get(int(s.pid[yy, xx]))
                        if s.style == 'ff6' or rp is None:
                            col = BLACK if s.style == 'ff6' else (rp['line'] if rp else BLACK)
                            if rp is None and s.style != 'ff6':
                                col = hx('#2A1C2A')
                        elif s.style == 'octo':
                            # sel-out: dark coloured line under / right, softer on the lit top-left
                            col = rp['line'] if (dy < 0 or dx < 0) else rp['deep']
                        else:
                            col = rp['line']
                        out[y, x] = col
                        break
        s.c = out

    def rim(s, col, amt=0.4):
        """HD-2D style cool back-light on the right-hand silhouette edge"""
        a = s.c[..., 3] > 0
        right_open = a & ~np.pad(a, ((0, 0), (0, 1)))[:, 1:]
        top_open = a & ~np.pad(a, ((1, 0), (0, 0)))[:-1, :]
        m = right_open & ~top_open
        rc = np.array(col[:3], float)
        cur = s.c[m][:, :3].astype(float)
        s.c[m, :3] = np.clip(cur * (1 - amt) + rc * amt, 0, 255).astype(np.uint8)

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
                if v >= 3:
                    s.c[y, x] = k

    def img(s):
        return Image.fromarray(s.c, 'RGBA')
