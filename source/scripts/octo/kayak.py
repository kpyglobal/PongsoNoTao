"""Modern sea kayak (現代獨木舟 / canoe_modern_*) for 族女 / 旅人: slim pointed hull, cockpit coaming, deck lines + bungees,
double-bladed paddle with an alternating left / right stroke. Same 128x96 frames, waterline row and sheet layout as the
tatala canoe sheets (poses.canoe_sheet / diag.canoe8_sheet), drawn by the same figure renderer."""
import math
import numpy as np
from PIL import Image, ImageOps
import poses
from poses import FH, CW, WL, STYLE, _shoulder
from fig import Fig, RP, darker, ik
from px16 import hx

K = dict(deck='#B4573F', hull='#E4DBC6', seam='#4E3530', rim='#2E2C32', seat='#3A3438', line='#D9C7AE', bungee='#2A2A30',
         shaft='#3B3C44', blade='#E4BE5A')
STROKE_S = [0.9, 0.3, -0.9, -0.3]   # roll of the paddle: + = near / left blade down
# side view: (near end, far end) offsets from the shaft centre in head units; near blade in the water on 0-1, far blade on 2-3
SIDE_ENDS = [((-1.7, 9), (1.7, -2.2)), ((-0.5, 9), (1.0, -2.4)), ((-1.6, -2.1), (1.2, 9)), ((-1.9, -1.4), (0.4, 9))]  # dy 9 = blade tip in the water


def _blade(cv, end, other, S, rp):
    dx, dy = end[0] - other[0], end[1] - other[1]
    L = math.hypot(dx, dy) or 1
    ux, uy = dx / L, dy / L
    a = (end[0] - ux * 5.5 * S, end[1] - uy * 5.5 * S)
    cv.fill(cv.cap(a, end, 1.6 * S, 2.4 * S), rp, ('ell', end[0] - 2, end[1] - 3, 4 * S, 5 * S))


def _shaft(cv, p0, p1, rp):
    cv.fill(cv.cap(p0, p1, 0.75), rp, ('cyl', p0, p1, 1.0))


def kayak_side(key, i):
    f = Fig(key)
    d = f.dims()
    hh, H = f.hh, f.H
    cv = poses.Cv(CW, FH, STYLE)
    cx = CW / 2
    S = H / 64.0
    deck = RP(K['deck']); hullc = RP(K['hull']); seam = RP(K['seam']); shaft = RP(K['shaft']); blade = RP(K['blade'])
    x0, x1 = 8, CW - 8
    half = (x1 - x0) / 2
    deck_y = WL - 5.0 * S
    hip = (cx + 4, deck_y + 0.15 * hh)
    tilt = 6 if i in (0, 2) else 2
    sh = _shoulder(f, d, hip, tilt)
    C = (sh[0] - 0.55 * hh, sh[1] + 0.45 * hh)
    (nx, ny), (fx, fy) = SIDE_ENDS[i]
    wy = WL + 1.5 - C[1]
    near = (C[0] + nx * hh, C[1] + (wy if ny == 9 else ny * hh))
    far = (C[0] + fx * hh, C[1] + (wy - 2 if fy == 9 else fy * hh))
    ny = (near[1] - C[1]) / hh; fy = (far[1] - C[1]) / hh
    gn = (C[0] + nx * hh * 0.28, C[1] + ny * hh * 0.28)
    gf = (C[0] + fx * hh * 0.28, C[1] + fy * hh * 0.28)
    eln = ik(sh, gn, d['La'], d['Lf'], bend=-1)
    elf = ik(sh, gf, d['La'], d['Lf'], bend=-1)
    # far half of the paddle behind the paddler
    _shaft(cv, C, far, darker(shaft)); _blade(cv, far, C, S, darker(blade))
    P = dict(hip=hip, tilt=tilt, legs=None, far_arm=(elf, gf), near_arm=(eln, gn), prop=False)
    f.side(cv, P)
    X, Y = cv.X, cv.Y
    t = (X - cx) / half
    at = np.abs(t)
    top = deck_y - 1.6 * S * t ** 4 - np.where(at > 0.86, (at - 0.86) * 9 * S, 0)
    keel = WL + 4
    bottom = keel - np.clip((at - 0.5) / 0.5, 0, 1) ** 1.4 * (keel - (deck_y - 2.2 * S))
    hm = (at <= 1.0) & (Y >= top - 1.5) & (Y <= bottom)

    def hp(x, y):
        tt = (x + 0.5 - cx) / half
        a_ = abs(tt)
        ty = deck_y - 1.6 * S * tt ** 4 - (max(0, a_ - 0.86) * 9 * S)
        dy = y + 0.5 - ty
        if 1.0 <= dy < 1.9 and 0.2 < a_ < 0.84 and abs(x + 0.5 - hip[0]) > 0.9 * hh:
            return RP(K['line'])  # perimeter deck line
        if dy < 3.4:
            return deck
        if dy < 4.3:
            return seam
        return None
    cv.fill(hm, hullc, ('soft', cx - 12, deck_y, 60, 10, 0.35), pattern=hp)
    # bungee X cords fore and aft of the cockpit
    bc = hx(K['bungee'])
    for bx in (cx - 0.40 * half, cx - 0.60 * half, cx + 0.50 * half):
        for k in (-2, -1, 0, 1, 2):
            cv.px(int(bx + k), int(deck_y - 1 + (k + 2) // 2), bc); cv.px(int(bx - k), int(deck_y - 1 + (k + 2) // 2), bc)
    # cockpit coaming around the paddler's waist
    rim = RP(K['rim'])
    cv.fill(cv.ell(hip[0] - 0.05 * hh, deck_y - 0.6, 0.85 * hh, 1.3) & ~cv.ell(hip[0] - 0.05 * hh, deck_y - 1.2, 0.7 * hh, 0.7), rim, ('flat', 0.5))
    # near half of the paddle in front
    _shaft(cv, C, near, shaft); _blade(cv, near, C, S, blade)
    cv.fill(cv.ell(gn[0], gn[1], d['rf'] + 0.5, d['rf'] + 0.6), f.skin, ('ell', gn[0] - 2, gn[1] - 2, 4, 4))
    poses._waterline(cv, x0, x1)
    cv = f.finish(cv)
    splash = []
    for e in (near, far):
        if e[1] > WL - 2:
            splash += [(int(e[0]) + k, WL - (1 if abs(k) == 1 else 0)) for k in (-3, -1, 1, 3)]
    poses._foam(cv, x0 + 8, x1 - 8, splash)
    return cv.img()


def kayak_end(key, i, back=False):
    """bow-on (s) / stern-on (n): slim deck pointing at the camera, paddle across the body rocking left / right"""
    f = Fig(key)
    hh, H = f.hh, f.H
    S = H / 64.0
    cv = poses.Cv(CW, FH, STYLE)
    cx = CW / 2
    deck = RP(K['deck']); hullc = RP(K['hull']); shaft = RP(K['shaft']); blade = RP(K['blade']); rim = RP(K['rim'])
    deck_y = WL - 5.0 * S
    d0 = f.dims()
    yoff = (deck_y + 0.1 * hh) - d0['crotch']
    d = f.dims(0, yoff)
    s = STROKE_S[i] * (-1 if back else 1)
    C = (cx, d['sy'] + 0.95 * hh)
    Lh, Lv = 2.7 * hh, 1.1 * hh
    left = (C[0] - Lh, C[1] + Lv * s)
    right = (C[0] + Lh, C[1] - Lv * s)
    hl = (C[0] - 0.62 * hh, C[1] + 0.23 * Lv * s)
    hr = (C[0] + 0.62 * hh, C[1] - 0.23 * Lv * s)
    # stern / bow deck behind the paddler (peeks out beside the hips)
    rear = cv.poly([(cx - 0.95 * hh, deck_y), (cx - 0.35 * hh, deck_y - 4 * S), (cx, deck_y - 5 * S), (cx + 0.35 * hh, deck_y - 4 * S), (cx + 0.95 * hh, deck_y)])
    cv.fill(rear, deck, ('soft', cx - 3, deck_y - 3, 10, 6, 0.4))
    f.frontal(cv, cx, back=back, legs=False, hands=(hl, hr), yoff=yoff, prop=False, before_arms=None)
    for e in (left, right):
        _shaft(cv, C, e, shaft); _blade(cv, e, C, S, blade)
    for h in (hl, hr):
        cv.fill(cv.ell(h[0], h[1] + 0.1 * hh, d['rf'] + 0.45, d['rf'] + 0.6), f.skin, ('ell', h[0] - 2, h[1] - 2, 4, 4))
    poses._waterline(cv, 0, CW)
    # deck toward the camera: cream hull flanks, red deck, centre deck line, bungee cross, coaming in front of the lap
    tip = WL + 6
    flank = cv.poly([(cx - 1.05 * hh, deck_y + 0.5), (cx + 1.05 * hh, deck_y + 0.5), (cx + 0.5 * hh, WL + 2), (cx, tip + 1), (cx - 0.5 * hh, WL + 2)])
    cv.fill(flank, hullc, ('soft', cx - 4, deck_y, 12, 8, 0.4))
    dk = cv.poly([(cx - 0.95 * hh, deck_y - 0.5), (cx + 0.95 * hh, deck_y - 0.5), (cx + 0.36 * hh, WL + 1), (cx, tip), (cx - 0.36 * hh, WL + 1)])
    lc = RP(K['line'])

    def dp(x, y):
        if abs(x + 0.5 - cx) < 0.6 and y > deck_y + 2:
            return lc
        return None
    cv.fill(dk, deck, ('soft', cx - 3, deck_y, 10, 10, 0.4), pattern=dp)
    bc = hx(K['bungee'])
    by = deck_y + 5
    for k in range(-2, 3):
        cv.px(int(cx + k), int(by + k), bc); cv.px(int(cx - k), int(by + k), bc)
    cv.fill(cv.ell(cx, deck_y, 0.9 * hh, 1.4) & ~cv.ell(cx, deck_y - 0.8, 0.75 * hh, 0.8), rim, ('flat', 0.5))
    cv = f.finish(cv)
    splash = []
    for e in (left, right):
        if e[1] > WL - 2:
            splash += [(int(e[0]) + k, WL - (1 if abs(k) == 1 else 0)) for k in (-3, -1, 1, 3)]
    poses._foam(cv, cx - 1.1 * hh, cx + 1.1 * hh, splash)
    return cv.img()


def kayak_sheet(key):
    """512x384, like canoe_sheet: rows s, w, n, e x 4 stroke frames"""
    sheet = Image.new('RGBA', (CW * 4, FH * 4), (0, 0, 0, 0))
    for i in range(4):
        w_ = kayak_side(key, i)
        for r, im in enumerate((kayak_end(key, i), w_, kayak_end(key, i, True), ImageOps.mirror(w_))):
            sheet.alpha_composite(im, (i * CW, r * FH))
    return sheet


def kayak8_sheet(key):
    """512x768, like diag.canoe8_sheet: rows 0-3 = kayak_sheet, rows 4-7 = sw, nw, ne, se"""
    import diag
    return diag._veh8(key, kayak_sheet(key), CW, kayak_side, 0.10, None)
