"""Frames for every sheet: walk (s/w/n/e x 4) + idle (s/w/n/e x [rest, inhale, blink, rest]),
scooter riding (4 dirs x 4) and tatala paddling (4 dirs x 4)."""
import math
import numpy as np
from PIL import Image, ImageOps
from px16 import Cv, hx
from fig import Fig, GY, C, ik, darker, RP, STYLE, CARRY

FW, FH = 64, 96
RW = 96
CW = 128
WL = 88

SWALK = [  # side walk: ((near thigh, shin), (far thigh, shin)), (near arm, far arm) swing degrees
    (((24, 8), (-18, -36)), (-20, 22)),
    (((3, 0), (16, -34)), (-4, 6)),
    (((-18, -36), (24, 8)), (22, -20)),
    (((16, -34), (3, 0)), (6, -4)),
]
SIDLE = (((3, 0), (-3, -1)), (-3, 5))


def _arm_pts(d, sh, ang, extra):
    a = math.radians(ang)
    el = (sh[0] - d['La'] * math.sin(a), sh[1] + d['La'] * math.cos(a))
    b = math.radians(ang + extra)
    return el, (el[0] - d['Lf'] * math.sin(b), el[1] + d['Lf'] * math.cos(b))


def _shoulder(f, d, hip, tilt, breath=0):
    hh = f.hh
    T = (d['crotch'] - 0.3 * hh) - d['sy'] + breath
    tl = math.radians(tilt)
    piv = (hip[0], hip[1] - 0.08 * hh)
    return (piv[0] + 0.02 * hh + (-T + 0.2 * hh) * math.sin(tl), piv[1] + (-T + 0.2 * hh) * math.cos(tl))


# ------------------------------------------------------------------ walk / idle, one frame
def side_frame(key, i=None, breath=0, blink=False):
    """i = walk frame index, or None for the standing idle pose"""
    f = Fig(key)
    d = f.dims()
    hh = f.hh
    legs, arms = SWALK[i] if i is not None else SIDLE
    elder = f.r.get('elder')
    cx = FW / 2 + 0.05 * hh
    lows = [f.leg_pts((cx, 0.0), a, d)[1][1] for a in legs]
    hip = (cx, d['ankle'] - max(lows))
    tilt = 10 if elder else (3 if i is not None else 1)
    cv = Cv(FW, FH, STYLE)
    sh = _shoulder(f, d, hip, tilt, breath)
    near = _arm_pts(d, sh, arms[0], 14 if arms[0] > 0 else 8)
    far = _arm_pts(d, sh, arms[1], 14 if arms[1] > 0 else 8)
    P = dict(hip=hip, tilt=tilt, legs=legs, near_arm=near, far_arm=far, breath=breath, blink=blink)
    if f.r.get('prop') in ('stick', 'paddle'):
        wr = (sh[0] - 0.55 * hh, sh[1] + 1.25 * hh)
        el = ik(sh, wr, d['La'], d['Lf'], bend=-1)
        P['near_arm'] = (el, wr)
        paddle = f.r.get('prop') == 'paddle'
        rp = RP(C['paddle'] if paddle else C['stick'])
        tipx = wr[0] - 0.15 * hh * ((1 if i in (0, 3) else -0.5) if i is not None else 0.3)

        def stick(cv):
            m = cv.cap((wr[0] - 0.1 * hh, wr[1] - (1.0 if paddle else 0.3) * hh), (tipx, GY), 0.75)
            cv.fill(m, rp, ('cyl', (wr[0], wr[1]), (tipx, GY), 1.0))
            if paddle:
                cv.fill(cv.ell(tipx + 0.2, GY - 0.55 * hh, 1.6, 0.55 * hh), rp, ('cyl', (tipx, 0), (tipx, 96), 1.6))
        P['pre_near_arm'] = stick
    elif f.r.get('prop') in CARRY:
        # carry hand stays low and still so the prop doesn't flail
        P['near_arm'] = _arm_pts(d, sh, -2 if i is None else arms[0] * 0.3, 10)
    f.side(cv, P)
    return f.finish(cv).img()


def frontal_frame(key, back=False, i=None, breath=0, blink=False):
    f = Fig(key)
    cv = Cv(FW, FH, STYLE)
    f.frontal(cv, FW / 2, back=back, walk=i, breath=breath, blink=blink)
    return f.finish(cv).img()


def walk_sheet(key):
    """256x768: rows 0-3 walk (s, w, n, e), rows 4-7 idle (s, w, n, e) = [rest, inhale, blink, rest]"""
    sheet = Image.new('RGBA', (FW * 4, FH * 8), (0, 0, 0, 0))
    for i in range(4):
        s_ = frontal_frame(key, False, i)
        w_ = side_frame(key, i)
        n_ = frontal_frame(key, True, i)
        for r, im in enumerate((s_, w_, n_, ImageOps.mirror(w_))):
            sheet.alpha_composite(im, (i * FW, r * FH))
    idle = {
        's': [frontal_frame(key, False, None, 0), frontal_frame(key, False, None, 1), frontal_frame(key, False, None, 0, True)],
        'w': [side_frame(key, None, 0), side_frame(key, None, 1), side_frame(key, None, 0, True)],
        'n': [frontal_frame(key, True, None, 0), frontal_frame(key, True, None, 1)],
    }
    idle['n'].append(idle['n'][0])
    idle['e'] = [ImageOps.mirror(im) for im in idle['w']]
    for r, k in enumerate('swne'):
        fr = idle[k] + [idle[k][0]]
        for c in range(4):
            sheet.alpha_composite(fr[c], (c * FW, (4 + r) * FH))
    return sheet


# ------------------------------------------------------------------ scooter
def _scooter_side(f, cv, cx, yb, i, S):
    rw = 6.2 * S
    fwx, rwx = cx - 28 * S, cx + 24 * S
    wy = GY - rw
    body = RP(C['scooter']); cream = RP(C['scooter2']); tire, rim = RP(C['tire']), RP(C['rim'])
    for wx in (rwx, fwx):
        cv.fill(cv.ell(wx, wy, rw, rw), tire, ('ell', wx - 2, wy - 2, rw * 1.3, rw * 1.3))
        cv.fill(cv.ell(wx, wy, rw * 0.5, rw * 0.5), rim, ('ell', wx - 1, wy - 1, rw * 0.7, rw * 0.7), contour=False)
        a = i * 1.57
        cv.px(int(wx + math.cos(a) * rw * 0.28), int(wy + math.sin(a) * rw * 0.28), rim['deep'])
    cowl = cv.ell(rwx - 4 * S, GY - 17 * S + yb, 17 * S, 9.5 * S) & (cv.Y < GY - 7 * S + yb)
    cv.fill(cowl, body, ('ell', rwx - 10 * S, GY - 24 * S + yb, 20 * S, 12 * S))
    cv.fill(cv.rect(cx - 16 * S, GY - 12 * S + yb, cx + 6 * S, GY - 7.5 * S + yb), cream, ('flat', 0.4))
    col = cv.poly([(cx - 22 * S, GY - 9 * S + yb), (cx - 13 * S, GY - 9 * S + yb), (cx - 13 * S, GY - 33 * S + yb), (cx - 19.5 * S, GY - 37 * S + yb)])
    cv.fill(col, body, ('soft', cx - 20 * S, GY - 30 * S + yb, 6 * S, 16 * S, 0.5))
    fend = cv.ell(fwx, wy - 1, rw + 2, rw + 1.5) & (cv.Y < wy - 1.5) & ~cv.ell(fwx, wy, rw + 0.5, rw + 0.5)
    cv.fill(fend, body, ('ell', fwx - 3, wy - 6, rw * 1.6, rw))
    seat = cv.cap((cx + 2 * S, GY - 27.5 * S + yb), (cx + 24 * S, GY - 26.5 * S + yb), 2.6 * S)
    cv.fill(seat, RP(C['seat']), ('cyl', (cx, GY - 27 * S), (cx + 24 * S, GY - 27 * S), 2.6 * S))
    return rwx


def ride_side(key, i):
    f = Fig(key)
    d = f.dims()
    hh, H = f.hh, f.H
    cv = Cv(RW, FH, STYLE)
    cx = RW / 2
    S = H / 64.0
    yb = -(1 if i % 2 else 0)
    rwx = _scooter_side(f, cv, cx, yb, i, S)
    hip = (cx + 5 * S, GY - 30.5 * S + yb)
    tilt = 4
    foot = (cx - 9 * S, GY - 14.5 * S + yb)
    Lt, Ls = d['knee'] - d['hipj'], d['ankle'] - d['knee']
    kn = ik(hip, foot, Lt, Ls, bend=1)
    t = math.degrees(math.atan2(-(kn[0] - hip[0]), kn[1] - hip[1]))
    s_ = math.degrees(math.atan2(-(foot[0] - kn[0]), foot[1] - kn[1]))
    leg = (t, s_, 0)
    sh = _shoulder(f, d, hip, tilt)
    grip = (cx - 15.5 * S, GY - 39 * S + yb)
    el = ik(sh, grip, d['La'], d['Lf'] + 0.1 * hh, bend=-1)
    g2 = (grip[0] + 1, grip[1] + 0.5)
    elf = ik(sh, g2, d['La'], d['Lf'] + 0.1 * hh, bend=-1)
    helmet = C['helmet'] if f.r['sex'] == 'm' else C['helmet2']
    P = dict(hip=hip, tilt=tilt, legs=(leg, (leg[0] - 2, leg[1] + 4, 0)), near_arm=(el, grip), far_arm=(elf, g2),
             helmet=helmet, prop=False)

    def bar(cv):
        dk = RP('#3B3A42')
        cv.fill(cv.cap((cx - 20 * S, GY - 39.5 * S + yb), (cx - 13.5 * S, GY - 40 * S + yb), 1.4 * S), dk, ('flat', 0.5))
        cv.fill(cv.ell(cx - 20.5 * S, GY - 35 * S + yb, 2.0 * S, 2.4 * S), RP(C['lamp']), ('ell', cx - 22 * S, GY - 36 * S, 3 * S, 3 * S))
        cv.px(int(cx - 17 * S), int(GY - 43 * S + yb), dk['base']); cv.px(int(cx - 17 * S), int(GY - 42 * S + yb), dk['base'])
        cv.fill(cv.ell(cx - 17 * S, GY - 44.5 * S + yb, 1.6, 1.1), RP(C['rim']), ('flat', 0.6), contour=False)
    P['pre_near_arm'] = bar
    f.side(cv, P)
    cv.fill(cv.rect(rwx + 11 * S, GY - 20 * S + yb, rwx + 13.5 * S, GY - 17 * S + yb), RP('#E04A3A'), ('flat', 0.8), contour=False)
    return f.finish(cv).img()


def ride_end(key, i, back=False):
    """front (s) / back (n) view of the rider on the scooter"""
    f = Fig(key)
    hh, H = f.hh, f.H
    S = H / 64.0
    cv = Cv(RW, FH, STYLE)
    cx = RW / 2
    yb = -(1 if i % 2 else 0)
    body = RP(C['scooter']); tire = RP(C['tire']); dk = RP('#3B3A42')
    helmet = C['helmet'] if f.r['sex'] == 'm' else C['helmet2']
    gy = GY - 39 * S + yb
    grips = ((cx - 12.5 * S, gy + 0.5), (cx + 12.5 * S, gy + 0.5))
    rw = 6.2 * S
    # wheel (thin, end-on) behind everything else of the scooter
    cv.fill(cv.ell(cx, GY - rw, 2.6 * S, rw), tire, ('ell', cx - 1, GY - rw - 2, 3 * S, rw))
    if back:
        # seat + rear cowl in front of the legs, rider's back above
        def lower(cv, d):
            seat = cv.ell(cx, GY - 27 * S + yb, 6.5 * S, 2.6 * S)
            cv.fill(seat, RP(C['seat']), ('flat', 0.4))
            cowl = cv.ell(cx, GY - 16 * S + yb, 10.5 * S, 10 * S) & (cv.Y > GY - 25 * S + yb) & (cv.Y < GY - 7 * S + yb)
            cv.fill(cowl, body, ('ell', cx - 4 * S, GY - 22 * S + yb, 12 * S, 12 * S))
            cv.fill(cv.rect(cx - 3 * S, GY - 19 * S + yb, cx + 3 * S, GY - 16.5 * S + yb), RP('#E04A3A'), ('flat', 0.8), contour=False)
            cv.fill(cv.rect(cx - 3.5 * S, GY - 13 * S + yb, cx + 3.5 * S, GY - 9 * S + yb), RP('#F2EFE6'), ('flat', 0.6))
            hb = cv.cap((cx - 13 * S, gy), (cx + 13 * S, gy), 1.2 * S)
            cv.fill(hb & (np.abs(cv.X - cx) > d['sw'] - 1), dk, ('flat', 0.5), contour=False)
            for sg in (-1, 1):
                cv.fill(cv.ell(cx + sg * 14 * S, gy - 6 * S, 1.6, 1.2), RP(C['rim']), ('flat', 0.6), contour=False)
                cv.fill(cv.cap((cx + sg * 13 * S, gy), (cx + sg * 14 * S, gy - 5 * S), 0.6), dk, ('flat', 0.5), contour=False)
        f.frontal(cv, cx, back=True, legs=False, hands=grips, yoff=yb, before_arms=lower, helmet=helmet, prop=False)
    else:
        def shield(cv, d):
            # knees peek out beside the apron
            for sg in (-1, 1):
                kc = (cx + sg * 6.0 * S, GY - 24 * S + yb)
                kneec = f.bot if f.r['bottom']['kind'] != 'shorts' else f.skin
                cv.fill(cv.ell(kc[0], kc[1], 2.8 * S, 3.2 * S), kneec, ('soft', kc[0] - 2, kc[1] - 2, 4 * S, 4 * S, 0.3), contour=False)
            # front fender hugging the wheel
            fen = cv.ell(cx, GY - rw - 1.5 * S, 3.6 * S, 3.4 * S) & (cv.Y < GY - rw + 1.5 * S)
            cv.fill(fen, body, ('ell', cx - 1.5, GY - rw - 4 * S, 4 * S, 4 * S))
            # leg-shield apron: narrow at the steering column, flaring to the floorboard
            ap = cv.poly([(cx - 3.2 * S, GY - 36 * S + yb), (cx + 3.2 * S, GY - 36 * S + yb),
                          (cx + 7.0 * S, GY - 15 * S + yb), (cx + 6.0 * S, GY - 11 * S + yb),
                          (cx - 6.0 * S, GY - 11 * S + yb), (cx - 7.0 * S, GY - 15 * S + yb)])
            cv.fill(ap, body, ('soft', cx - 3 * S, GY - 30 * S, 7 * S, 18 * S, 0.45))
            # cream centre stripe + small turn-signal dots like a classic scooter
            cv.fill(cv.rect(cx - 1.0 * S, GY - 33 * S + yb, cx + 1.0 * S, GY - 13 * S + yb), RP(C['scooter2']), ('flat', 0.4), contour=False)
            for sg in (-1, 1):
                cv.px(int(cx + sg * 4.5 * S), int(GY - 30 * S + yb), hx('#F2A23A'))
            # handlebar with the round headlight in its centre and mirrors
            cv.fill(cv.cap((cx - 13 * S, gy), (cx + 13 * S, gy), 1.2 * S), dk, ('flat', 0.5))
            cv.fill(cv.ell(cx, gy - 0.5 * S, 4.0 * S, 2.6 * S), body, ('ell', cx - 1.5 * S, gy - 2 * S, 4 * S, 3 * S))
            cv.fill(cv.ell(cx, gy - 0.3 * S, 2.3 * S, 2.0 * S), RP(C['lamp']), ('ell', cx - 1 * S, gy - 1.5 * S, 2.5 * S, 2.5 * S))
            for sg in (-1, 1):
                cv.fill(cv.cap((cx + sg * 11 * S, gy), (cx + sg * 13.5 * S, gy - 6 * S), 0.6), dk, ('flat', 0.5), contour=False)
                cv.fill(cv.ell(cx + sg * 13.8 * S, gy - 7 * S, 1.8, 1.3), RP(C['rim']), ('flat', 0.6))
        f.frontal(cv, cx, back=False, legs=False, hands=grips, yoff=yb, before_arms=shield, helmet=helmet, prop=False)
    return f.finish(cv).img()


def ride_sheet(key):
    sheet = Image.new('RGBA', (RW * 4, FH * 4), (0, 0, 0, 0))
    for i in range(4):
        w_ = ride_side(key, i)
        for r, im in enumerate((ride_end(key, i), w_, ride_end(key, i, True), ImageOps.mirror(w_))):
            sheet.alpha_composite(im, (i * RW, r * FH))
    return sheet


# ------------------------------------------------------------------ tatala
STROKE = [((-2.4, 2), (-0.55, -1.30)), ((-1.4, 3), (-0.20, -1.25)), ((0.35, 1), (0.25, -1.15)), ((-2.1, -7), (-0.75, -1.40))]


def _waterline(cv, x0, x1, blade=None):
    cv.erase(cv.Y > WL + 0.5)


def _foam(cv, x0, x1, extra=()):
    for x in range(int(x0), int(x1)):
        if cv.c[WL, x, 3] > 0 and (x % 5) != 0:
            cv.px(x, WL, hx(C['foam']))
    for (x, y) in extra:
        cv.px(x, y, hx(C['foam']))


def canoe_side(key, i):
    f = Fig(key)
    d = f.dims()
    hh, H = f.hh, f.H
    cv = Cv(CW, FH, STYLE)
    cx = CW / 2
    S = H / 64.0
    hull = RP(C['hull']); red = RP(C['red']); ink = RP(C['ink']); pr = RP(C['paddle'])
    gun = WL - 7.5 * S
    x0, x1 = 18, CW - 18
    hip = (cx + 2, gun - 0.45 * hh)
    tilt = 8 if i in (0, 3) else (2 if i == 1 else -2)
    blade_d, top_d = STROKE[i]
    blade = (hip[0] + blade_d[0] * hh, WL + blade_d[1])
    sh = _shoulder(f, d, hip, tilt)
    top = (sh[0] + top_d[0] * hh, sh[1] + 0.30 * hh + (top_d[1] + 1.3) * 0.5 * hh)
    tl_ = max(0.2, min(0.75, ((gun - 0.35 * hh) - top[1]) / max(1e-3, blade[1] - top[1])))
    low = (top[0] + (blade[0] - top[0]) * tl_, top[1] + (blade[1] - top[1]) * tl_)
    eln = ik(sh, low, d['La'], d['Lf'], bend=-1)
    elf = ik(sh, top, d['La'], d['Lf'], bend=1)
    P = dict(hip=hip, tilt=tilt, legs=None, far_arm=(elf, top), near_arm=(eln, low), prop=False)

    def paddle(cv):
        dx0, dy0 = blade[0] - top[0], blade[1] - top[1]
        L0 = math.hypot(dx0, dy0)
        knob = (top[0] - dx0 / L0 * 0.45 * hh, top[1] - dy0 / L0 * 0.45 * hh)
        cv.fill(cv.cap(knob, blade, 1.05), pr, ('cyl', top, blade, 1.0))
        ux, uy = dx0 / L0, dy0 / L0
        bc = (blade[0] - ux * 1.5, blade[1] - uy * 1.5)
        cv.fill(cv.cap((bc[0] - ux * 3.5 * S, bc[1] - uy * 3.5 * S), (bc[0] + ux * 2.5 * S, bc[1] + uy * 2.5 * S), 2.3 * S), pr, ('ell', bc[0] - 1, bc[1] - 2, 3 * S, 5 * S))

    def post(cv):
        paddle(cv)
        cv.fill(cv.ell(low[0], low[1], d['rf'] + 0.5, d['rf'] + 0.6), f.skin, ('ell', low[0] - 2, low[1] - 2, 4, 4))
        cv.fill(cv.ell(top[0], top[1] + 0.5, d['rf'] + 0.4, d['rf'] + 0.5), darker(f.skin), ('flat', 0.5))
    P['post'] = post
    f.side(cv, P)
    X, Y = cv.X, cv.Y
    t = (X - cx) / ((x1 - x0) / 2)
    at = np.abs(t)
    sheer = gun - 1.5 - 5 * S * t ** 2 - np.where(at > 0.78, (at - 0.78) * 70 * S, 0)
    keel = WL + 6
    tip = gun - 1.5 - 5 * S - 0.22 * 70 * S
    bottom = keel - np.clip((at - 0.62) / 0.38, 0, 1) ** 1.6 * (keel - tip - 3)
    hm = (at <= 1.0) & (Y >= sheer) & (Y <= bottom)

    def hp(x, y):
        tt = abs((x + 0.5 - cx) / ((x1 - x0) / 2))
        sy_ = gun - 1.5 - 5 * S * tt ** 2 - (max(0, tt - 0.78) * 70 * S)
        dy = y + 0.5 - sy_
        if dy < 1.2:
            return ink
        if dy < 2.4:
            return red
        if 3.4 <= dy < 4.6 and (int(x) % 4) in (0, 1):
            return ink
        if 5.6 <= dy < 6.8:
            return red
        return None
    cv.fill(hm, hull, ('soft', cx - 10, gun, 60, 14, 0.35), pattern=hp)
    ex, ey = cx - 0.62 * (x1 - x0) / 2, gun + 3.5 * S
    for r, c_ in ((2.8 * S, ink), (1.9 * S, hull), (1.1 * S, red)):
        cv.fill(cv.ell(ex, ey, r, r), c_, ('flat', 0.5), contour=False)
    cv.px(int(ex), int(ey), ink['base'])
    _waterline(cv, x0, x1)
    cv = f.finish(cv)
    splash = [(int(blade[0]) + k, WL - (1 if abs(k) == 1 else 0)) for k in (-3, -1, 1, 3)] if blade[1] > WL - 2 else []
    _foam(cv, x0 + 6, x1 - 6, splash)
    return cv.img()


def canoe_end(key, i, back=False):
    """bow-on (s) / stern-on (n) view: narrow hull, short carved spire, paddle alternating sides"""
    f = Fig(key)
    hh, H = f.hh, f.H
    S = H / 64.0
    cv = Cv(CW, FH, STYLE)
    cx = CW / 2
    hull = RP(C['hull']); red = RP(C['red']); ink = RP(C['ink']); pr = RP(C['paddle'])
    gun = WL - 7.5 * S
    side = -1 if i < 2 else 1           # paddle side on screen
    if back:
        side = -side
    pull = i % 2                         # 0 = catch (blade forward/low), 1 = pull (blade back/out)
    d0 = f.dims()
    yoff = (gun - 0.45 * hh) - d0['crotch']
    d = f.dims(0, yoff)
    sh_y = d['sy'] + 0.24 * hh
    blade = (cx + side * (23 + 2 * pull) * S, WL + (2 if not pull else 0))
    top = (cx + side * (1 + 2 * pull) * S, sh_y + (2.5 if not pull else 4.0) * S)
    tl_ = max(0.3, min(0.8, ((gun - 0.5 * hh) - top[1]) / max(1e-3, blade[1] - top[1])))
    low = (top[0] + (blade[0] - top[0]) * tl_, top[1] + (blade[1] - top[1]) * tl_)
    hands = (top, low) if side < 0 else (low, top)
    hands = (low, top) if side < 0 else (top, low)
    # interior of the hull behind the rider
    inner = cv.ell(cx, gun - 1, 20 * S, 3.8 * S)
    cv.fill(inner, RP('#9A7A58'), ('flat', 0.2))

    def paddle(cv):
        dx0, dy0 = blade[0] - top[0], blade[1] - top[1]
        L0 = math.hypot(dx0, dy0)
        knob = (top[0] - dx0 / L0 * 0.4 * hh, top[1] - dy0 / L0 * 0.4 * hh)
        cv.fill(cv.cap(knob, blade, 1.05), pr, ('cyl', top, blade, 1.0))
        cv.fill(cv.ell(blade[0], blade[1] - 1, 2.2 * S, 4.0 * S), pr, ('ell', blade[0] - 1, blade[1] - 3, 3 * S, 4 * S))
    f.frontal(cv, cx, back=back, legs=False, hands=hands, yoff=yoff, prop=False,
              before_arms=None)
    paddle(cv)
    for (hx_, hy_) in hands:
        cv.fill(cv.ell(hx_, hy_ + 0.1 * hh, d['rf'] + 0.45, d['rf'] + 0.6), f.skin, ('ell', hx_ - 2, hy_ - 2, 4, 4))
    # hull face (end-on) in front of the rider's lap
    face = cv.ell(cx, gun, 21 * S, 3.6 * S) | (cv.rect(cx - 20.5 * S, gun - 8 * S, cx + 20.5 * S, WL + 6) & cv.ell(cx, gun - 3, 21 * S, 17 * S))
    face &= cv.Y > gun - 2.2 - np.clip((np.abs(cv.X - cx) - 12 * S) / (8.5 * S), 0, 1) ** 2 * 7 * S

    def hp(x, y):
        dy = y + 0.5 - (gun - 2.2 - min(1, max(0, (abs(x + 0.5 - cx) - 12 * S) / (8.5 * S))) ** 2 * 7 * S)
        if dy < 1.5:
            return ink
        if dy < 3.0:
            return red
        if 5.0 <= dy < 6.2 and (int(x) % 4) in (0, 1):
            return ink
        return None
    cv.fill(face, hull, ('soft', cx - 6 * S, gun, 16 * S, 8 * S, 0.4), pattern=hp)
    for sg in (-1, 1):
        ex, ey = cx + sg * 12 * S, gun + 3.0 * S
        for r, c_ in ((2.4 * S, ink), (1.6 * S, hull), (0.9 * S, red)):
            cv.fill(cv.ell(ex, ey, r, r), c_, ('flat', 0.5), contour=False)
    _waterline(cv, 0, CW)
    cv = f.finish(cv)
    splash = [(int(blade[0]) + k, WL - (1 if abs(k) == 1 else 0)) for k in (-3, -1, 1, 3)] if blade[1] > WL - 2 else []
    _foam(cv, cx - 21 * S, cx + 21 * S, splash)
    return cv.img()


def canoe_sheet(key):
    sheet = Image.new('RGBA', (CW * 4, FH * 4), (0, 0, 0, 0))
    for i in range(4):
        w_ = canoe_side(key, i)
        for r, im in enumerate((canoe_end(key, i), w_, canoe_end(key, i, True), ImageOps.mirror(w_))):
            sheet.alpha_composite(im, (i * CW, r * FH))
    return sheet
