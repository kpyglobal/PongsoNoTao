#!/usr/bin/env python3
"""
Fine-pixel 16-bit / HD-2D character sprite generator for Pongso no Tao.

Every character is painted procedurally on a 64x96 logical frame:
  * natural ~6-head proportions (no square heads / stick limbs)
  * every body part is a shaded volume (sphere / capsule / tapered cylinder)
    lit from the upper-left-front and quantised into 4-tone hue-shifted ramps
    (warm highlights, cool shadows) -- the classic SNES/HD-2D look
  * garment patterns (taririk indigo stripes, woven bands, hi-vis tape) are
    sampled per pixel *before* shading so folds stay readable
  * selective coloured outline + internal contour where a front part overlaps
    a back part
Output: public/assets/sprites/characters/<kind>_sheet.png  (4 cols x 4 rows)
  rows: s (front), w (facing screen-left), n (back), e (mirror of w)
  cols: 0 stand/pass, 1 step A, 2 pass (bob), 3 step B
"""
import colorsys, math, os
import numpy as np
from PIL import Image

FW, FH = 64, 96
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sprites', 'characters')
L = np.array([-0.45, -0.6, 0.66]); L = L / np.linalg.norm(L)


def hx(s):
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def shade(rgb, lvl):
    """hue-shifted ramp: lvl -3..+1"""
    r, g, b = [c / 255 for c in rgb]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if lvl > 0:
        v = min(1, v * 1.13 + 0.04); s = s * 0.86
        h = h + (0.12 - h) * 0.06 if s > 0.05 else h  # nudge toward warm
    elif lvl < 0:
        k = {-1: 0.8, -2: 0.62, -3: 0.4}[lvl]
        v = v * k; s = min(1, s * (1 + 0.08 * -lvl) + 0.02 * -lvl)
        if s > 0.05:
            if h < 0.2 or h > 0.85:  # warm hues: shadows drift toward red-violet
                hh = h if h < 0.5 else h - 1
                h = hh - 0.012 * -lvl
            else:  # cool hues drift toward blue
                h = h + (0.64 - h) * 0.05 * -lvl
    r, g, b = colorsys.hsv_to_rgb(h % 1, max(0, min(1, s)), max(0, min(1, v)))
    return (int(r * 255), int(g * 255), int(b * 255))


def level(n):
    d = float(np.dot(n, L))
    if d > 0.8: return 1
    if d > 0.4: return 0
    if d > 0.05: return -1
    return -2


class Canvas:
    def __init__(self):
        self.col = np.zeros((FH, FW, 3), np.uint8)
        self.a = np.zeros((FH, FW), bool)
        self.part = np.full((FH, FW), -1, np.int32)
        self.order = 0
        self.nolines = set()

    def put(self, x, y, rgb, pid):
        if 0 <= x < FW and 0 <= y < FH:
            self.col[y, x] = rgb; self.a[y, x] = True; self.part[y, x] = pid

    def new_part(self, contour=True):
        self.order += 1
        if not contour: self.nolines.add(self.order)
        return self.order

    # --- shaded volumes ------------------------------------------------------
    def ellipse(self, cx, cy, rx, ry, base, pid=None, flat=0.0, lvl_bias=0):
        pid = pid or self.new_part()
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
                d2 = dx * dx + dy * dy
                if d2 <= 1.0:
                    n = np.array([dx * (1 - flat), dy * (1 - flat), math.sqrt(max(0, 1 - d2)) + flat])
                    c = base(x, y) if callable(base) else base
                    self.put(x, y, shade(c, max(-2, min(1, level(n / np.linalg.norm(n)) + lvl_bias))), pid)
        return pid

    def capsule(self, pts, r, base, pid=None, r_end=None, lvl_bias=0):
        """poly-line capsule (limb) through pts with radius r (tapering to r_end)."""
        pid = pid or self.new_part()
        r_end = r if r_end is None else r_end
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        R = max(r, r_end) + 1
        segs = list(zip(pts[:-1], pts[1:]))
        total = sum(math.dist(a, b) for a, b in segs) or 1
        for y in range(int(min(ys) - R), int(max(ys) + R) + 1):
            for x in range(int(min(xs) - R), int(max(xs) + R) + 1):
                px, py = x + 0.5, y + 0.5
                best = None; acc = 0
                for (ax, ay), (bx, by) in segs:
                    vx, vy = bx - ax, by - ay
                    ll = vx * vx + vy * vy or 1e-6
                    t = max(0, min(1, ((px - ax) * vx + (py - ay) * vy) / ll))
                    qx, qy = ax + vx * t, ay + vy * t
                    d = math.hypot(px - qx, py - qy)
                    tt = (acc + t * math.sqrt(ll)) / total
                    rr = r + (r_end - r) * tt
                    if d <= rr and (best is None or d / rr < best[0]):
                        best = (d / rr, (px - qx) / rr, (py - qy) / rr)
                    acc += math.sqrt(ll)
                if best:
                    _, nx, ny = best
                    n = np.array([nx, ny * 0.6, math.sqrt(max(0.02, 1 - nx * nx - ny * ny * 0.36))])
                    c = base(x, y) if callable(base) else base
                    self.put(x, y, shade(c, max(-2, min(1, level(n / np.linalg.norm(n)) + lvl_bias))), pid)
        return pid

    def profile(self, y0, y1, fn, base, pid=None, lvl_bias=0, round_top=0.0):
        """tapered cylinder: fn(y)->(cx, half_width). Rows y0..y1 inclusive."""
        pid = pid or self.new_part()
        for y in range(int(y0), int(y1) + 1):
            cx, hw = fn(y)
            if hw <= 0: continue
            t = (y - y0) / max(1, (y1 - y0))
            for x in range(int(math.floor(cx - hw)), int(math.ceil(cx + hw))):
                nx = (x + 0.5 - cx) / hw
                if abs(nx) > 1: continue
                ny = -0.35 * (1 - t) * round_top + 0.15
                n = np.array([nx * 0.9, ny, math.sqrt(max(0.05, 1 - nx * nx))])
                c = base(x, y) if callable(base) else base
                self.put(x, y, shade(c, max(-2, min(1, level(n / np.linalg.norm(n)) + lvl_bias))), pid)
        return pid

    def px(self, x, y, rgb, pid=None):
        self.put(int(x), int(y), rgb, pid or self.order)

    def line(self, x0, y0, x1, y1, rgb, pid=None):
        pid = pid or self.new_part(False)
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            t = i / max(1, n)
            self.put(int(round(x0 + (x1 - x0) * t)), int(round(y0 + (y1 - y0) * t)), rgb, pid)
        return pid

    def finish(self):
        col = self.col.copy(); a = self.a
        part = self.part
        # internal contours: back-part pixel touching a front part gets darkened
        for y in range(FH):
            for x in range(FW):
                if not a[y, x]: continue
                p = part[y, x]
                if p in self.nolines: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < FW and 0 <= yy < FH and a[yy, xx]:
                        q = part[yy, xx]
                        if q > p and q not in self.nolines:
                            col[y, x] = shade(tuple(int(v) for v in self.col[y, x]), -2)
                            break
        # selective coloured silhouette outline
        out = np.zeros((FH, FW, 4), np.uint8)
        out[..., :3] = col; out[..., 3] = a * 255
        for y in range(FH):
            for x in range(FW):
                if a[y, x]: continue
                nb = None
                for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < FW and 0 <= yy < FH and a[yy, xx]:
                        nb = self.col[yy, xx]; break
                if nb is not None:
                    c = shade(tuple(int(v) for v in nb), -3)
                    out[y, x] = (*[int(v * 0.85) for v in c], 255)
        return Image.fromarray(out, 'RGBA')


# ---------------------------------------------------------------------------
# patterns
def solid(c):
    return lambda x, y: c


def vstripes(base, stripes, period=6, cx=32, widths=(1,)):
    """taririk-style vertical indigo/black stripes on off-white ramie"""
    def f(x, y):
        k = (x - cx) % period
        for i, w in enumerate(widths):
            if k == i + 1 and i < len(stripes): return stripes[i]
        return base
    return f


def hstripes(base, stripes, period=5, y0=0):
    def f(x, y):
        k = (y - y0) % period
        if k == 0: return stripes[0]
        if k == 1 and len(stripes) > 1: return stripes[1]
        return base
    return f


def weave(f, amt=10):
    """subtle woven-ramie texture"""
    def g(x, y):
        c = f(x, y)
        d = amt if (x + y) % 2 == 0 else -amt // 2
        return tuple(max(0, min(255, v + d)) for v in c)
    return g


# ---------------------------------------------------------------------------
SKIN = {'tan': hx('c98a5c'), 'deep': hx('a8693f'), 'medium': hx('d9a07a'), 'light': hx('e9bf9b')}


def draw(spec, view, frame):
    """view: 's' front, 'n' back, 'w' side facing screen-left"""
    cv = Canvas()
    sk = SKIN[spec['skin']]
    bob = -1 if frame in (0, 2) and frame == 2 else 0
    if frame in (1, 3): bob = 1
    step = {0: 0, 1: 1, 2: 0, 3: -1}[frame]
    by = bob  # whole-body vertical offset
    elder = spec.get('elder', False)
    stoop = 1 if elder else 0
    cx = 32
    hipY = 56 + by; kneeY = 72 + by; ankY = 88
    shoulderY = 28 + by + stoop
    headY = 17 + by + stoop * 2
    headX = cx - (1 if view == 'w' and elder else 0)
    bottom = spec['bottom']
    acc = spec.get('acc', [])
    legc = spec.get('legc', sk)
    shoe = spec.get('shoe', hx('5a3b28'))

    def legs_front(far_first=False):
        # front/back view legs; step lifts one foot (knee bend) and pushes the other forward
        for side in (-1, 1):
            lift = 2 if step == side else 0
            fwd = 1 if step == -side else 0
            hx_ = cx + side * 4
            pts = [(hx_, hipY), (hx_ + side * 0.3, kneeY - lift * 0.5), (hx_ + side * 0.6, ankY - lift + fwd)]
            if bottom in ('shorts', 'skirt'):
                cv.capsule(pts, 3.4, legc, r_end=2.5)
            else:
                cv.capsule(pts, 3.3, spec['pantc'], r_end=2.8)
            fx, fy = pts[-1]
            cv.ellipse(fx + side * 0.4, fy + 2.2, 3.4, 1.9, shoe, flat=0.3)

    def legs_side():
        # side view: forward leg (toward screen-left = -x) and back leg
        swing = {0: 0, 1: 6, 2: 0, 3: -6}[frame]
        for k, sgn in ((0, 1), (1, -1)):  # draw far leg first (darker)
            s = swing * sgn
            far = k == 0
            fx = cx - s + 1
            knee = (cx - s * 0.45 + (1 if abs(s) > 0 else 0), kneeY - (1 if s < 0 else 0))
            pts = [(cx + 1, hipY), knee, (fx, ankY - (2 if s < 0 else 0))]
            c = legc if bottom in ('shorts', 'skirt') else spec['pantc']
            if far: c = shade(c, -1)
            cv.capsule(pts, 3.0 if bottom in ('shorts', 'skirt') else 3.3, c, r_end=2.5)
            sc = shade(shoe, -1) if far else shoe
            cv.ellipse(fx - 2, pts[-1][1] + 2.2, 3.6, 1.8, sc, flat=0.3)

    def pants_top():
        # shorts / trousers seat & thighs
        pc = spec['pantc']
        if view == 'w':
            cv.profile(hipY - 4, hipY + (8 if bottom == 'shorts' else 6), lambda y: (cx + 1, 6.2), pc)
        else:
            cv.profile(hipY - 4, hipY + (8 if bottom == 'shorts' else 6), lambda y: (cx, 8.6 - max(0, y - hipY - 4) * 0.2), pc)
            cv.line(cx, hipY + 1, cx, hipY + 7, shade(pc, -2), cv.new_part(False))

    def skirt():
        pat = spec['skirt']
        w0, w1 = (6.5, 7.5) if view == 'w' else (8.5, 11.0)
        y1 = spec.get('skirt_len', 82) + by
        cv.profile(hipY - 5, y1, lambda y: (cx + (1 if view == 'w' else 0), w0 + (w1 - w0) * (y - hipY + 5) / max(1, y1 - hipY + 5)), pat)
        if spec.get('apron') and view != 'n':
            ac = spec['apron']
            cv.profile(hipY - 3, y1 - 6, lambda y: (cx - (2 if view == 'w' else 0), 5.0 if view != 'w' else 3.5), ac)

    def torso():
        tf = spec['torsof']
        if view == 'w':
            fn = lambda y: (cx + 1 + (0.6 if elder else 0), 6.6 - max(0, y - shoulderY - 14) * 0.05)
        else:
            def fn(y):
                t = (y - shoulderY) / (hipY - shoulderY)
                hw = 10.5 - 3.3 * min(1, t * 1.3) + max(0, t - 0.8) * 4
                if spec.get('female'): hw = 9.5 - 3.0 * min(1, t * 1.3) + max(0, t - 0.75) * 6
                return (cx, hw)
        cv.profile(shoulderY, hipY - 1, fn, tf, round_top=1.0)
        # neck
        cv.capsule([(headX, headY + 6), (cx, shoulderY + 1)], 2.6, shade(sk, -1))

    def arm(side, far=False):
        # side=-1 screen-left arm, +1 screen-right
        sw = {0: 0, 1: 1, 2: 0, 3: -1}[frame]
        sleeve = spec.get('sleeve')
        if view == 'w':
            s = (5 if far else -5) * sw
            pts = [(cx + 1, shoulderY + 2), (cx + 1 + s * 0.4, shoulderY + 12), (cx + 1 + s, shoulderY + 22)]
        else:
            fwd = sw * side
            ax = cx + side * 10.5
            pts = [(ax, shoulderY + 2), (ax + side * 1.2, shoulderY + 12 - fwd), (ax + side * 1.0, shoulderY + 22 - fwd * 2)]
        hold = spec.get('hold', {}).get(view if view != 'n' else 's', {}).get(side if view != 'w' else ('far' if far else 'near'))
        if hold == 'bent':
            if view == 'w':
                pts = [pts[0], (cx + 2, shoulderY + 11), (cx - 4, shoulderY + 14)]
            else:
                pts = [pts[0], (pts[0][0] + side * 1, shoulderY + 11), (cx + side * 4, shoulderY + 15)]
        skc = shade(sk, -1) if far else sk
        cv.capsule(pts, 2.8, skc, r_end=2.1)
        if sleeve:
            sc = sleeve if not far else shade(sleeve, -1)
            ln = spec.get('sleeve_len', 0.4)
            p0 = pts[0]; p1 = pts[1]
            q = (p0[0] + (p1[0] - p0[0]) * min(1, ln * 2), p0[1] + (p1[1] - p0[1]) * min(1, ln * 2))
            seg = [p0, q] if ln <= 0.5 else [p0, p1, (p1[0] + (pts[2][0] - p1[0]) * (ln - 0.5) * 2, p1[1] + (pts[2][1] - p1[1]) * (ln - 0.5) * 2)]
            cv.capsule(seg, 3.2, sc, r_end=3.0)
        hx_, hy_ = pts[-1]
        cv.ellipse(hx_, hy_ + 1.5, 2.3, 2.5, skc)
        return (hx_, hy_ + 1.5)

    def head():
        hc = spec['hair']
        if view == 'w':
            cv.ellipse(headX, headY, 6.4, 7.4, sk)
            # nose & chin profile
            cv.px(headX - 7, headY + 1, shade(sk, 0)); cv.px(headX - 7, headY + 2, shade(sk, -1))
            cv.px(headX - 6, headY + 5, shade(sk, -1))
            # eye, brow, mouth
            cv.new_part(False)
            cv.px(headX - 4, headY + 1, hx('2a1a14')); cv.px(headX - 4, headY, hx('2a1a14'))
            cv.px(headX - 3, headY + 1, (250, 245, 235))
            cv.px(headX - 4, headY - 2, shade(hc, -1)); cv.px(headX - 3, headY - 2, shade(hc, -1))
            cv.px(headX - 5, headY + 4, shade(hx('b5584a'), 0))
            if spec.get('blush'): cv.px(headX - 2, headY + 2, shade(hx('e07a6a'), 0))
            # ear
            cv.ellipse(headX + 1.5, headY + 1, 1.4, 2.0, shade(sk, -1))
        elif view == 's':
            cv.ellipse(headX - 6.6, headY + 1.5, 1.5, 2.2, shade(sk, -1)); cv.ellipse(headX + 6.6, headY + 1.5, 1.5, 2.2, shade(sk, -1))
            cv.ellipse(headX, headY, 6.6, 7.5, sk)
            cv.new_part(False)
            ey = headY + 1 + (1 if elder else 0)
            for ex in (headX - 3, headX + 2):
                cv.px(ex, ey, hx('2a1a14')); cv.px(ex + 1, ey, hx('2a1a14'))
                cv.px(ex, ey - 1, hx('3b2620')); cv.px(ex + 1, ey - 1, hx('3b2620'))
                cv.px(ex + (1 if ex < headX else 0), ey - 1, (250, 245, 235))
                bc = hx('e8e4dc') if elder else shade(hc, -1)
                cv.px(ex, ey - 2, bc); cv.px(ex + 1, ey - 2, bc)
            cv.px(headX, ey + 2, shade(sk, -1)); cv.px(headX - 1, ey + 2, shade(sk, 1))
            mc = shade(hx('b5584a'), 0)
            smile = spec.get('smile', True)
            cv.px(headX - 1, headY + 5, mc); cv.px(headX, headY + 5, mc); cv.px(headX + 1, headY + 5, shade(hx('b5584a'), -1))
            if smile: cv.px(headX - 2, headY + 4, shade(sk, -2)); cv.px(headX + 1, headY + 4, shade(sk, -2))
            if spec.get('blush'):
                cv.px(headX - 4, headY + 3, shade(hx('e07a6a'), 0)); cv.px(headX + 3, headY + 3, shade(hx('e07a6a'), 0))
            if elder:
                cv.px(headX - 5, ey + 1, shade(sk, -1)); cv.px(headX + 4, ey + 1, shade(sk, -1))
            if spec.get('stubble'):
                for xx in range(headX - 3, headX + 3):
                    if xx % 2 == 0: cv.px(xx, headY + 6, shade(sk, -2))
        else:  # back
            cv.ellipse(headX, headY, 6.6, 7.5, sk)
            cv.ellipse(headX - 6.7, headY + 1, 1.3, 2.0, shade(sk, -1)); cv.ellipse(headX + 6.7, headY + 1, 1.3, 2.0, shade(sk, -1))

    def hair():
        hc = spec['hair']; st = spec['hair_style']
        hp = cv.new_part()
        def blob(cx_, cy_, rx, ry):
            cv.ellipse(cx_, cy_, rx, ry, hc, pid=hp)
        if view == 'n':
            blob(headX, headY - 1, 7.2, 7.6)
            if st == 'bun': blob(headX, headY + 3, 3.4, 3.0)
            if st == 'bob': cv.profile(headY, headY + 8, lambda y: (headX, 7.4), hc, pid=hp)
            if st == 'long': cv.profile(headY, headY + 12, lambda y: (headX, 6.8), hc, pid=hp)
        elif view == 's':
            blob(headX, headY - 5, 7.0, 4.2)
            if st in ('short', 'spiky', 'elder_m'):
                for i, xx in enumerate(range(headX - 6, headX + 7, 2)):
                    cv.px(xx, headY - 1 - (i % 2), shade(hc, 0), hp)
                cv.px(headX - 7, headY - 1, shade(hc, -1), hp); cv.px(headX + 6, headY - 1, shade(hc, -1), hp)
                if st == 'spiky':
                    for xx in range(headX - 5, headX + 6, 3): cv.px(xx, headY - 9, shade(hc, 0), hp)
            if st in ('bob', 'long'):
                cv.profile(headY - 3, headY + (6 if st == 'bob' else 10), lambda y: (headX - 6.2, 1.8), hc, pid=hp)
                cv.profile(headY - 3, headY + (6 if st == 'bob' else 10), lambda y: (headX + 6.2, 1.8), hc, pid=hp)
                for xx in range(headX - 5, headX + 5): cv.px(xx, headY - 2 + (xx % 3 == 0), shade(hc, 0), hp)
            if st == 'bun':
                blob(headX + 5, headY - 6, 2.6, 2.4)
                for xx in range(headX - 5, headX + 6): cv.px(xx, headY - 2, shade(hc, 0), hp)
        else:
            blob(headX + 1, headY - 4, 6.6, 4.4)
            cv.profile(headY - 3, headY + 3, lambda y: (headX + 4, 3.0), hc, pid=hp)
            if st == 'bun': blob(headX + 6, headY - 1, 2.8, 2.6)
            if st in ('bob', 'long'): cv.profile(headY - 2, headY + (6 if st == 'bob' else 10), lambda y: (headX + 3.5, 3.6), hc, pid=hp)
            if st == 'spiky':
                for yy in range(headY - 8, headY - 2, 2): cv.px(headX + 7, yy, shade(hc, 0), hp)
            cv.px(headX - 4, headY - 3, shade(hc, 0), hp); cv.px(headX - 5, headY - 2, shade(hc, 0), hp)
        # headwear
        hw = spec.get('headwear')
        if hw == 'headband':
            hb = spec['headband']
            p = cv.new_part()
            for xx in range(headX - 7, headX + 8):
                if view == 'w' and xx < headX - 6: continue
                c = hb(xx, 0)
                cv.px(xx, headY - 4, shade(c, 0), p); cv.px(xx, headY - 3, shade(c, -1), p)
            if view == 'n': cv.capsule([(headX, headY - 3), (headX + 2, headY + 3)], 1.0, hb(0, 0))
        elif hw == 'scarf':
            sc = spec['scarf']
            cv.ellipse(headX + (1 if view == 'w' else 0), headY - 5, 7.8, 4.4, sc)
            if view == 'n': cv.ellipse(headX, headY - 1, 7.6, 6.0, sc)
            if view != 's': cv.capsule([(headX + (4 if view == 'w' else 0), headY), (headX + (6 if view == 'w' else 1), headY + 7)], 2.0, sc)
        elif hw == 'cap':
            cc = spec['capc']
            cv.ellipse(headX + (1 if view == 'w' else 0), headY - 4, 7.1, 4.4, cc)
            if view == 's': cv.profile(headY - 1, headY, lambda y: (headX, 7.6), shade(cc, -1))
            elif view == 'w': cv.capsule([(headX - 3, headY - 1), (headX - 9, headY - 1)], 1.1, shade(cc, -1))
        elif hw == 'bucket':
            bc = spec['hatc']
            cv.ellipse(headX + (1 if view == 'w' else 0), headY - 4, 6.8, 4.6, bc)
            cv.profile(headY - 1, headY + 1, lambda y: (headX + (1 if view == 'w' else 0), 9.4 - (y - headY + 1) * 0.6), bc)
        elif hw == 'sunhat':
            bc = spec['hatc']
            cv.ellipse(headX + (1 if view == 'w' else 0), headY - 5, 5.6, 3.8, bc)
            cv.profile(headY - 2, headY - 1, lambda y: (headX + (1 if view == 'w' else 0), 11), weave(solid(bc), 14))

    def torso_details():
        # garment-specific overlays on the front/back/side torso
        t = spec['top_kind']
        if t == 'vest' and view == 's':
            # open vest front: undershirt / skin V
            inner = spec.get('inner', sk)
            p = cv.new_part()
            for yy in range(shoulderY, shoulderY + 16):
                hw_ = max(0, 3.2 - (yy - shoulderY) * 0.12) if spec.get('inner') else max(0, 2.6 - (yy - shoulderY) * 0.18)
                for xx in range(int(cx - hw_), int(math.ceil(cx + hw_))):
                    cv.px(xx, yy, shade(inner, 0 if abs(xx - cx) < hw_ - 1 else -1), p)
        if t == 'coat' and view == 's':
            inner = spec['inner']
            p = cv.new_part()
            for yy in range(shoulderY, hipY - 1):
                hw_ = 3.3 if yy < shoulderY + 14 else 2.0
                for xx in range(int(cx - hw_), int(math.ceil(cx + hw_))):
                    cv.px(xx, yy, shade(inner, 0 if yy > shoulderY + 1 else -1), p)
            cv.line(cx - 4, shoulderY, cx - 1, shoulderY + 7, shade(hx('e8eef0'), -1))
            cv.line(cx + 3, shoulderY, cx, shoulderY + 7, shade(hx('e8eef0'), -1))
        if t == 'hivis':
            p = cv.new_part(False)
            tape = hx('d9dccf')
            for yy in (shoulderY + 15, shoulderY + 16):
                for xx in range(cx - 10, cx + 11):
                    if cv.part[yy, xx] == cv.part[shoulderY + 10, cx + (0 if view == 'w' else 6)]:
                        cv.px(xx, yy, shade(tape, 1 if (xx + yy) % 3 else 0), p)
            if view == 's':
                for yy in range(shoulderY, hipY - 2):
                    cv.px(cx, yy, shade(spec['inner'], -1), p); cv.px(cx - 1, yy, shade(spec['inner'], 0), p)
        if 'belt' in spec and view != 'w':
            p = cv.new_part()
            for xx in range(cx - 8, cx + 9):
                cv.px(xx, hipY - 3, spec['belt'](xx, 0), p); cv.px(xx, hipY - 2, shade(spec['belt'](xx, 1), -1), p)

    def necklace():
        if 'beads' not in acc or view == 'n': return
        p = cv.new_part(False)
        cols = [hx('e0902c'), hx('f2efe6'), hx('b2452a'), hx('f0b450')]
        if view == 's':
            for i, a in enumerate(np.linspace(0.15, math.pi - 0.15, 11)):
                xx = cx + math.cos(a) * 5.0; yy = shoulderY + 1 + math.sin(a) * 6.0
                cv.px(xx, yy, cols[i % 4], p)
        else:
            for i in range(6):
                cv.px(cx - 4 + i * 0.5, shoulderY + 1 + i, cols[i % 4], p)

    def lanyard():
        if 'lanyard' not in acc or view == 'n': return
        p = cv.new_part(False)
        lc = hx('2c4a8c')
        if view == 's':
            for i in range(9):
                cv.px(cx - 3 + i * 0.3, shoulderY + i, lc, p); cv.px(cx + 3 - i * 0.3, shoulderY + i, lc, p)
            for yy in range(shoulderY + 9, shoulderY + 13):
                for xx in range(cx - 1, cx + 2): cv.px(xx, yy, hx('f4f4ee') if yy < shoulderY + 11 else hx('c8443a'), p)
            cv.px(cx, shoulderY + 12, hx('1e1e1e'), p)
        else:
            cv.line(cx - 3, shoulderY, cx - 3, shoulderY + 10, lc, p)
            cv.px(cx - 3, shoulderY + 11, hx('f4f4ee'), p)

    def backpack(front_layer):
        if 'backpack' not in acc: return
        bc = spec.get('packc', hx('6b6a45'))
        if view == 'n' and front_layer:
            cv.profile(shoulderY + 2, shoulderY + 20, lambda y: (cx, 7.5), bc, round_top=1.0)
            cv.profile(shoulderY + 12, shoulderY + 18, lambda y: (cx, 5.0), shade(bc, -1))
        elif view == 's' and front_layer:
            p = cv.new_part(False)
            for side in (-1, 1):
                for yy in range(shoulderY, shoulderY + 14):
                    cv.px(cx + side * 6, yy, shade(bc, -1), p); cv.px(cx + side * 7, yy, shade(bc, 0), p)
        elif view == 'w' and not front_layer:
            cv.profile(shoulderY + 2, shoulderY + 20, lambda y: (cx + 8, 3.6), shade(bc, 0), round_top=1.0)

    def held(hand_far, hand_near, hand_l, hand_r):
        h = spec.get('item')
        if not h: return
        if h == 'stick':
            hxp = hand_near if view == 'w' else hand_r
            if hxp is None: return
            cv.capsule([(hxp[0] - (1 if view == 'w' else 0), hxp[1] - 4), (hxp[0] - (2 if view == 'w' else -1), ankY + 3)], 1.1, hx('7a5534'))
        elif h == 'adze':
            hxp = hand_near if view == 'w' else hand_r
            if hxp is None: return
            cv.capsule([(hxp[0], hxp[1] + 4), (hxp[0], hxp[1] - 7)], 1.0, hx('7a5534'))
            cv.capsule([(hxp[0] - 1, hxp[1] - 7), (hxp[0] - 4, hxp[1] - 5)], 1.4, hx('6f6e6a'))
        elif h == 'paddle':
            hxp = hand_near if view == 'w' else hand_r
            if hxp is None: return
            x0, y0 = hxp
            cv.capsule([(x0 + 2, y0 - 18), (x0 - 1, y0 + 6)], 1.0, hx('8a5d36'))
            pid = cv.new_part()
            def blade(x, y):
                d = math.hypot(x - (x0 - 1.5), y - (y0 + 12))
                return hx('b8352b') if d < 1.6 else hx('f0ead8') if d < 3.0 else hx('1f1b18') if d < 3.8 else hx('a8763f')
            cv.ellipse(x0 - 1.5, y0 + 12, 3.0, 6.5, blade, pid=pid, flat=0.5)
        elif h == 'basket':
            hxp = hand_l if view != 'w' else hand_near
            if hxp is None: return
            x0, y0 = hxp
            bx = x0 - (2 if view != 'w' else 3)
            cv.profile(y0 - 4, y0 + 5, lambda y: (bx, 5.0 - (y - y0 + 4) * 0.12), weave(hstripes(hx('b48a4e'), [hx('8a6533')], 2), 16), round_top=0.3)
            cv.ellipse(bx - 1, y0 - 6, 2.6, 2.4, hx('6d4a6e'))  # taro corm
            cv.ellipse(bx + 2, y0 - 6, 2.2, 2.0, hx('7a5779'))
            cv.ellipse(bx - 1, y0 - 10, 3.4, 2.6, hx('5c9a3c'), flat=0.3)  # taro leaf
        elif h == 'clipboard':
            hxp = hand_l if view != 'w' else hand_near
            if hxp is None: return
            x0, y0 = hxp
            pid = cv.new_part()
            for yy in range(int(y0 - 8), int(y0 + 2)):
                for xx in range(int(x0 - 3), int(x0 + 3)):
                    c = hx('b08a58') if xx in (int(x0 - 3), int(x0 + 2)) or yy in (int(y0 - 8), int(y0 + 1)) else hx('f6f1e3')
                    if yy == int(y0 - 5) or yy == int(y0 - 3): c = hx('8fb07a') if xx % 2 else c
                    cv.px(xx, yy, c, pid)
        elif h == 'rope':
            hxp = hand_l if view != 'w' else hand_near
            if hxp is None: return
            x0, y0 = hxp
            cv.ellipse(x0, y0 + 3, 4.2, 4.6, weave(solid(hx('c4a574')), 18), flat=0.2)
            cv.ellipse(x0, y0 + 3, 1.8, 2.2, shade(hx('c4a574'), -2), flat=0.8)
        elif h == 'camera':
            if view == 'n': return
            pid = cv.new_part()
            yy0 = shoulderY + 12
            xx0 = cx + (2 if view == 's' else -4)
            for yy in range(yy0, yy0 + 4):
                for xx in range(xx0 - 2, xx0 + 3):
                    cv.px(xx, yy, hx('2d2d30') if yy > yy0 else hx('555558'), pid)
            cv.px(xx0, yy0 + 2, hx('7fa8c8'), pid)
            p = cv.new_part(False)
            cv.line(cx - 6, shoulderY + 1, xx0 - 2, yy0, hx('3a2a1e'), p)
        elif h == 'notebook':
            hxp = hand_l if view != 'w' else hand_near
            if hxp is None: return
            x0, y0 = hxp
            pid = cv.new_part()
            for yy in range(int(y0 - 3), int(y0 + 4)):
                for xx in range(int(x0 - 2), int(x0 + 2)):
                    cv.px(xx, yy, hx('6b4a30') if xx == int(x0 - 2) else hx('8a6440'), pid)

    # ------------------------------------------------------------------ order
    hand = {}
    if view == 'w':
        backpack(False)
        hand['far'] = arm(1, far=True)
        legs_side()
        if bottom.startswith('skirt'): skirt()
        elif bottom in ('shorts', 'pants'): pants_top()
        torso(); torso_details(); necklace(); lanyard()
        head(); hair()
        hand['near'] = arm(-1)
        held(hand.get('far'), hand.get('near'), None, None)
    else:
        if view == 'n': backpack(False)
        legs_front()
        if bottom.startswith('skirt'): skirt()
        elif bottom in ('shorts', 'pants'): pants_top()
        torso(); torso_details(); necklace(); lanyard()
        if view == 'n':
            backpack(True)
        hl = arm(-1); hr = arm(1)
        if view == 's': backpack(True)
        head(); hair()
        if view == 'n' and spec.get('item') == 'stick':
            pass
        held(None, None, hl, hr)
    return cv.finish()


def sheet(spec):
    img = Image.new('RGBA', (FW * 4, FH * 4), (0, 0, 0, 0))
    for row, view in enumerate(['s', 'w', 'n', 'e']):
        for col in range(4):
            v = 'w' if view == 'e' else view
            fr = draw(spec, v, col)
            if view == 'e': fr = fr.transpose(Image.FLIP_LEFT_RIGHT)
            img.alpha_composite(fr, (col * FW, row * FH))
    return bleed(img)


def bleed(img, passes=6):
    """copy edge colours into fully transparent texels so trilinear mips never fringe dark/black"""
    arr = np.asarray(img).copy()
    rgb = arr[..., :3].astype(np.int32); a = arr[..., 3] > 0
    filled = a.copy()
    for _ in range(passes):
        acc = np.zeros_like(rgb); cnt = np.zeros(a.shape, np.int32)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(filled, dy, 0), dx, 1)
            shc = np.roll(np.roll(rgb, dy, 0), dx, 1)
            acc += shc * sh[..., None]; cnt += sh
        new = (~filled) & (cnt > 0)
        rgb[new] = acc[new] // cnt[new][:, None]
        filled |= new
    arr[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


# ---------------------------------------------------------------------------
OFFWHITE = hx('eee5cf'); INDIGO = hx('2f4f8f'); INK = hx('1f2230')
taririk = weave(vstripes(OFFWHITE, [INDIGO, INDIGO, INK], period=6, widths=(1, 1, 1)), 8)
taririk2 = weave(vstripes(OFFWHITE, [INDIGO, INK], period=5, widths=(1, 1)), 8)
woven_band = lambda x, y: [INDIGO, OFFWHITE, hx('b8352b'), OFFWHITE][x % 4]

CAST = {
    # returning Tao youth: taririk vest over charcoal tee, navy shorts, backpack + notebook
    'player': dict(skin='tan', hair=hx('1d1714'), hair_style='spiky', top_kind='vest', torsof=taririk, inner=hx('4a4c52'),
                   sleeve=hx('4a4c52'), sleeve_len=0.3, bottom='shorts', pantc=hx('2c3a4f'), shoe=hx('3d2d22'),
                   acc=['beads', 'backpack'], packc=hx('7a7350'), item='notebook', blush=True),
    # visitor / coastal researcher: bucket hat, olive field shirt, jeans, camera
    'player_visitor': dict(skin='light', hair=hx('201816'), hair_style='bob', female=True, headwear='bucket', hatc=hx('d8c9a3'),
                           top_kind='shirt', torsof=weave(solid(hx('6f7c4a')), 6), sleeve=hx('6f7c4a'), sleeve_len=0.75,
                           bottom='pants', pantc=hx('3d5675'), shoe=hx('e6e1d6'), acc=['backpack'], packc=hx('8a5a3a'),
                           item='camera', blush=True),
    # researcher variant: sun hat, khaki vest over white tee, cargo shorts
    'player_researcher': dict(skin='medium', hair=hx('2a1c16'), hair_style='short', headwear='sunhat', hatc=hx('cdb27a'),
                              top_kind='vest', torsof=weave(solid(hx('a89466')), 8), inner=hx('f2f0ea'), sleeve=hx('f2f0ea'),
                              sleeve_len=0.3, bottom='shorts', pantc=hx('6f6650'), shoe=hx('4a3a2a'), acc=['backpack'],
                              packc=hx('3f5a5a'), item='notebook'),
    # 部落耆老: silver hair, taririk vest, beads, walking stick / adze
    'elder': dict(skin='deep', hair=hx('dcdad4'), hair_style='elder_m', elder=True, top_kind='vest', torsof=taririk,
                  bottom='shorts', pantc=hx('2a2f3d'), shoe=hx('5a3b28'), acc=['beads'], item='stick',
                  belt=woven_band, smile=True),
    # 漁人 / 造舟師: sun-tanned, woven headband, taririk vest, paddle with eye motif
    'fisher': dict(skin='deep', hair=hx('16110f'), hair_style='spiky', headwear='headband', headband=woven_band,
                   top_kind='vest', torsof=taririk2, bottom='shorts', pantc=hx('243650'), shoe=hx('4a3426'),
                   acc=['beads'], item='paddle', belt=woven_band),
    # 水芋田長輩: scarf, striped wrap top, woven skirt & apron, taro basket
    'farmer': dict(skin='tan', hair=hx('9a958c'), hair_style='bun', female=True, elder=True, headwear='scarf', scarf=hx('34508a'),
                   top_kind='wrap', torsof=weave(hstripes(OFFWHITE, [INDIGO, hx('6b7fae')], 5), 8), sleeve=OFFWHITE, sleeve_len=0.8,
                   bottom='skirt', skirt=weave(hstripes(hx('2f4a7a'), [OFFWHITE, hx('b8352b')], 6), 8), skirt_len=86,
                   apron=weave(solid(hx('e7dcc0')), 6), shoe=hx('6b4a33'), item='basket', blush=True),
    # 衛生所護理師: white coat over teal scrubs, island lanyard, clipboard
    'clinic': dict(skin='medium', hair=hx('17110e'), hair_style='bun', female=True, top_kind='coat', torsof=solid(hx('eef2f2')),
                   inner=hx('5fb3a6'), sleeve=hx('eef2f2'), sleeve_len=0.8, bottom='pants', pantc=hx('5fb3a6'),
                   shoe=hx('f2f2ee'), acc=['lanyard'], item='clipboard', blush=True),
    # 港務人員: navy cap, hi-vis vest over light-blue shirt, mooring rope
    'harbor': dict(skin='tan', hair=hx('1a1412'), hair_style='short', headwear='cap', capc=hx('24366a'), top_kind='hivis',
                   torsof=weave(solid(hx('f08a24')), 6), inner=hx('8fb4dc'), sleeve=hx('8fb4dc'), sleeve_len=0.35,
                   bottom='pants', pantc=hx('2b3446'), shoe=hx('2a2522'), acc=['lanyard'], item='rope', stubble=True),
    # 訪客 (outsider tourist): sun-visor-ish cap, bright tee, shorts, camera
    'tourist': dict(skin='light', hair=hx('3a2a20'), hair_style='short', headwear='cap', capc=hx('e8e2d2'), top_kind='shirt',
                    torsof=weave(solid(hx('e0675a')), 4), sleeve=hx('e0675a'), sleeve_len=0.35, bottom='shorts',
                    pantc=hx('c9b48a'), shoe=hx('3d6f8a'), acc=['backpack'], packc=hx('3d4a5a'), item='camera'),
    # 部落族人 (general villager): plain work tee + woven band, shorts
    'villager': dict(skin='tan', hair=hx('1d1714'), hair_style='short', top_kind='shirt', torsof=weave(solid(hx('3f6f78')), 5),
                     sleeve=hx('3f6f78'), sleeve_len=0.35, bottom='shorts', pantc=hx('39352f'), shoe=hx('4a3426'),
                     belt=woven_band, acc=['beads']),
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    preview = Image.new('RGBA', (FW * 4 * 3, FH * 4 * ((len(CAST) + 2) // 3)), (92, 120, 96, 255))
    for i, (k, spec) in enumerate(CAST.items()):
        sh = sheet(spec)
        sh.save(os.path.join(OUT, f'{k}_sheet.png'))
        preview.alpha_composite(sh, ((i % 3) * FW * 4, (i // 3) * FH * 4))
        print('wrote', k)
    preview.save(os.path.join(OUT, '..', 'CHARACTERS_V3.png'))
