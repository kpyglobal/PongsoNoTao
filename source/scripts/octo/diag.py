"""8-direction support for the playable characters: 45-degree diagonal frames, rendered by the same figure code
(fig.py / poses.py) on a warped canvas, so palette, outline, shading and frame timing stay identical.

  walk  (sw / nw): the front (s) / back (n) view turned ~45 deg: face / back centre slides toward the facing side,
                   the far half of head, torso and hips is foreshortened (per-row cylinder warp).
  ride / canoe (sw / nw): the side (w) view seen at 45 deg: length foreshortened to ~80 %, front end sheared
                   down (toward the camera, sw) or up (away, nw).
  se / ne are mirrors of sw / nw, exactly as e is the mirror of w in the base sheets.

Sheet layouts: the first rows are the base sheet unchanged; the diagonal rows follow (see docs/phase1/ASSET_MANIFEST.md).
"""
import math
from contextlib import contextmanager
import numpy as np
from PIL import Image, ImageOps
import poses
from poses import FW, FH, RW, CW, WL, frontal_frame, side_frame, walk_sheet, ride_side, canoe_side, ride_sheet, canoe_sheet
from px16 import Cv, hx
from fig import Fig, C

DIAG = ('sw', 'nw', 'ne', 'se')


class WarpCv(Cv):
    """Canvas whose pixel grid samples a warped model space: every mask / light / pattern is evaluated at the
    model coordinates of each screen pixel; px() marks land on the screen pixels covering that model texel."""

    def __init__(s, w, h, style, warp):
        super().__init__(w, h, style)
        s.X, s.Y = warp(s.X, s.Y)
        s._fx, s._fy = np.floor(s.X).astype(int), np.floor(s.Y).astype(int)

    def poly(s, pts):  # even-odd point-in-polygon on the model coordinates
        x, y = s.X, s.Y
        inside = np.zeros(x.shape, bool)
        n = len(pts)
        for i in range(n):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
            if y0 == y1:
                continue
            c = ((y0 > y) != (y1 > y)) & (x < (x1 - x0) * (y - y0) / (y1 - y0) + x0)
            inside ^= c
        return inside

    def fill(s, m, rp, shade=('flat',), pattern=None, **kw):
        if pattern is not None:
            fx, fy, pat = s._fx, s._fy, pattern
            pattern = lambda x, y: pat(int(fx[y, x]), int(fy[y, x]))
        return super().fill(m, rp, shade, pattern=pattern, **kw)

    def screen_of(s, x, y):
        m = (s._fx == int(x)) & (s._fy == int(y))
        if not m.any():
            d2 = (s.X - (int(x) + 0.5)) ** 2 + (s.Y - (int(y) + 0.5)) ** 2
            k = int(np.argmin(d2))
            if d2.flat[k] > 0.8:
                return np.zeros_like(m)
            m = np.zeros_like(m); m.flat[k] = True
        return m

    def px(s, x, y, col):
        m = s.screen_of(x, y)
        s.c[m] = col
        s.pid[m] = 0


@contextmanager
def warped(warp):
    old = poses.Cv
    poses.Cv = lambda w, h, style: WarpCv(w, h, style, warp)
    old_foam = poses._foam

    def foam(cv, x0, x1, extra=()):  # foam dots on the (now slanted) waterline
        for x in range(int(x0), int(x1)):
            m = cv.screen_of(x, WL)
            if (x % 5) != 0 and m.any() and (cv.c[m][:, 3] > 0).all():
                cv.px(x, WL, hx(C['foam']))
        for (x, y) in extra:
            cv.px(x, y, hx(C['foam']))
    poses._foam = foam
    try:
        yield
    finally:
        poses.Cv, poses._foam = old, old_foam


# ---------------------------------------------------------------- warps
def turn_warp(key, cx, side):
    """3/4 turn of a front / back view. side=-1: the visible centre line slides screen-left."""
    d = Fig(key).dims()
    hh = d['hh']
    rows = np.arange(FH) + 0.5
    neck0, neck1 = d['cy'] + d['ry'] * 0.6, d['sy'] + 0.15 * hh
    t = np.clip((rows - neck0) / max(1e-3, neck1 - neck0), 0, 1)          # 0 = head, 1 = body
    hip0, hip1 = d['crotch'] - 0.2 * hh, d['crotch'] + 0.6 * hh
    tl = np.clip((rows - hip0) / max(1e-3, hip1 - hip0), 0, 1)            # 1 = legs
    R = (d['rx'] + 1.0) * (1 - t) + (d['sw'] + 1.0) * t
    R = R * (1 - tl) + (d['hw'] + 0.9) * tl
    c = side * ((0.46 * (d['rx'] + 1.0)) * (1 - t) + (0.30 * (d['sw'] + 1.0)) * t)
    c = c * (1 - tl) + side * 0.22 * (d['hw'] + 0.9) * tl

    kw = 0.96 * (1 - t) + 0.86 * t                                          # torso / hips foreshortened
    off = side * (1.0 * (1 - t) + 0.3 * t)                                  # head leads the turn
    kn0, an = d['knee'] - 0.6 * hh, d['ankle']
    g = side * 0.16 * np.clip((rows - kn0) / max(1e-3, an - kn0), 0, 1)    # near foot a little lower

    def warp(X, Y):
        yi = Y.astype(int).clip(0, FH - 1)
        Rr, cc = R[yi] * kw[yi], c[yi] * kw[yi]
        s_ = (X - off[yi] - cx) / kw[yi]
        Rr, cc = R[yi], c[yi]
        a = cc / (Rr * Rr)
        with np.errstate(invalid='ignore', divide='ignore'):
            u = np.where(np.abs(a) < 1e-9, s_, (1 - np.sqrt(np.clip(1 - 4 * a * (s_ - cc), 0, None))) / (2 * a))
        u = np.where(np.abs(s_) <= Rr, u, s_)
        return cx + u, Y + g[yi] * u
    return warp


def oblique_warp(cx, toward_camera, k=0.20, kx=0.80, rider_top=None):
    """side view seen at 45 deg: foreshorten length about cx; front (screen-left) end down (toward camera) or up"""
    sg = 1 if toward_camera else -1

    def warp(X, Y):
        kxr = kx if rider_top is None else np.where(Y < rider_top, min(1.0, kx + 0.12), kx)
        xm = cx + (X - cx) / kxr
        return xm, Y + sg * k * (xm - cx)
    return warp


# ---------------------------------------------------------------- frames / sheets
def walk_diag(key, nw, i=None, breath=0, blink=False):
    with warped(turn_warp(key, FW / 2, +1 if nw else -1)):
        return frontal_frame(key, nw, i, breath, blink)


def walk8_sheet(key):
    """256x1536: rows 0-7 = base walk sheet; 8-11 walk sw, nw, ne, se; 12-15 idle sw, nw, ne, se"""
    base = walk_sheet(key)
    sheet = Image.new('RGBA', (FW * 4, FH * 16), (0, 0, 0, 0))
    sheet.alpha_composite(base, (0, 0))
    for i in range(4):
        sw, nw = walk_diag(key, False, i), walk_diag(key, True, i)
        for r, im in enumerate((sw, nw, ImageOps.mirror(nw), ImageOps.mirror(sw))):
            sheet.alpha_composite(im, (i * FW, (8 + r) * FH))
    sw = [walk_diag(key, False, None, 0), walk_diag(key, False, None, 1), walk_diag(key, False, None, 0, True)]
    nw = [walk_diag(key, True, None, 0), walk_diag(key, True, None, 1)]
    nw.append(nw[0])
    idle = dict(sw=sw, nw=nw, ne=[ImageOps.mirror(m) for m in nw], se=[ImageOps.mirror(m) for m in sw])
    for r, k in enumerate(DIAG):
        fr = idle[k] + [idle[k][0]]
        for c in range(4):
            sheet.alpha_composite(fr[c], (c * FW, (12 + r) * FH))
    return sheet


def _veh8(key, base, fw, side_fn, k, rider_top):
    sheet = Image.new('RGBA', (fw * 4, FH * 8), (0, 0, 0, 0))
    sheet.alpha_composite(base, (0, 0))
    for i in range(4):
        with warped(oblique_warp(fw / 2, True, k, 0.80, rider_top)):
            sw = side_fn(key, i)
        with warped(oblique_warp(fw / 2, False, k, 0.80, rider_top)):
            nw = side_fn(key, i)
        for r, im in enumerate((sw, nw, ImageOps.mirror(nw), ImageOps.mirror(sw))):
            sheet.alpha_composite(im, (i * fw, (4 + r) * FH))
    return sheet


def ride8_sheet(key):
    """384x768: rows 0-3 = base ride sheet (s, w, n, e); rows 4-7 = sw, nw, ne, se"""
    return _veh8(key, ride_sheet(key), RW, ride_side, 0.18, None)


def canoe8_sheet(key):
    """512x768: rows 0-3 = base canoe sheet (s, w, n, e); rows 4-7 = sw, nw, ne, se"""
    return _veh8(key, canoe_sheet(key), CW, canoe_side, 0.10, None)
