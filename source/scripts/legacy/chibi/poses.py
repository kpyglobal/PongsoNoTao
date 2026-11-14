"""Riding (scooter) and paddling (tatala) pose frames for the player outfits, 4 directions x 4 frames."""
import math
import numpy as np
from .kit import Cv, R, dark, hx, lerp
from .character import (ST, P, SKIN, back_hair, head, torso, details_front, backpack_back, backpack_side,
                        arm, hand, foot, leg, finish)

RW, RH = 96, 96
CW, CH = 128, 96
GY = 90
WL = 88  # canoe waterline row

SC = R('#9FE8FF', '#55BDEB', '#3A8FC8', '#1C3F66')
CREAM = R('#FFFBEE', '#F4EBD3', '#D7C9A6', '#5E4F35')
SEAT = R('#7A5A4A', '#5A3F35', '#3F2A25', '#21140F')
TIRE = R('#5A5A66', '#33333D', '#22222A', '#121218')
HUB = R('#E6E6EE', '#B8B8C6', '#8A8A9A', '#3A3A48')
LAMP = P['yellow']
BOAT_W = R('#FFFFFF', '#F2EEE4', '#D6CFC0', '#3A2E2A')
BOAT_R = R('#E8574B', '#C8372D', '#9C2626', '#3A1414')
BOAT_K = R('#3A3442', '#22202A', '#16141C', '#0C0B10')
INTERIOR = R('#B98A5A', '#8F6440', '#6E4A2E', '#3A2414')
FOAM = R('#FFFFFF', '#E8FBFF', '#BFEAF5', '#8FD3E6')


def helmet_for(sp):
    return P['helmF'] if sp.get('female') else P['helmM']


def _wheel(cv, x, y, r, f, side=True):
    cv.fill(cv.ell(x, y, r, r) if side else cv.ell(x, y, r * 0.62, r), TIRE, 'ell', (x, y, r, r))
    if side:
        cv.fill(cv.ell(x, y, r * 0.48, r * 0.48), HUB, 'flat', contour=False)
        xi, yi = int(math.floor(x)), int(math.floor(y))
        if f % 2 == 0:
            cv.px(xi, yi - 1, TIRE['sh']); cv.px(xi, yi + 1, TIRE['sh']); cv.px(xi - 1, yi, TIRE['sh']); cv.px(xi + 1, yi, TIRE['sh'])
        else:
            for d in (-1, 1):
                cv.px(xi + d, yi + d, TIRE['sh']); cv.px(xi + d, yi - d, TIRE['sh'])


# ----------------------------------------------------------------------------- scooter
def ride_frame(sp, view, f):
    cv = Cv(RW, RH)
    bob = -1 if f in (1, 3) else 0
    if view == 'w':
        _ride_side(cv, sp, f, bob)
    elif view == 's':
        _ride_front(cv, sp, f, bob)
    else:
        _ride_back(cv, sp, f, bob)
    return finish(cv)


def _ride_side(cv, sp, f, bob):
    S = ST
    k = 1.1
    gy = GY
    x0 = (RW - 46 * k) / 2
    wr = 4.6 * k
    wy = gy - wr
    # rear wheel + body
    _wheel(cv, x0 + 37 * k, wy, wr, f)
    body = cv.ell(x0 + 33 * k, gy - 10.5 * k + bob, 11 * k, 6.5 * k) & (cv.Y < gy - 6 * k + bob)
    cv.fill(body, SC, 'ell', (x0 + 33 * k, gy - 10.5 * k + bob, 11 * k, 6.5 * k))
    cv.fill(cv.ell(x0 + 43.6 * k, gy - 11 * k + bob, 1.3 * k, 1.4 * k), BOAT_R, 'flat', contour=False)
    cv.fill(cv.rect(x0 + 11 * k, gy - 7.5 * k + bob, x0 + 27 * k, gy - 4.5 * k + bob), CREAM, 'edge', hi=True)
    cv.fill(cv.ell(x0 + 30 * k, gy - 15.5 * k + bob, 9.5 * k, 2.6 * k), SEAT, 'ell', (x0 + 30 * k, gy - 16 * k, 9 * k, 2.6 * k))
    # rider
    tws = S['tw'] * 0.72
    hip = (x0 + 25 * k, gy - 17.5 * k + bob)
    cx = hip[0] - 1.0
    ty = hip[1] - S['th'] + 1
    hy = ty - S['ry'] + 4
    back_hair(cv, sp, cx - 0.5, hy, 'w')
    backpack_side(cv, sp, cx, ty, tws)
    grip = (cx - S['arm'] - 1.5, ty + 8.5)
    arm(cv, sp, (cx + 1, ty + 2), (grip[0] + 1.5, grip[1] - 0.5), far=True)
    torso(cv, sp, 'w', cx, ty, hip[1], lean=1.0)
    knee = (hip[0] - 8, hip[1] - 0.5)
    floor_y = gy - 7.5 * k + bob
    ft = (knee[0] - 0.5, floor_y - 2)
    leg(cv, sp, hip, ft, knee=knee)
    foot(cv, sp, (ft[0] - 0.5, floor_y - 0.5), 'w')
    # front: wheel, fender, leg shield, column, handlebar, lamp
    fx = x0 + 7 * k
    _wheel(cv, fx, wy, wr, f)
    cv.fill(cv.ell(fx, wy - 1 * k, wr + 1.4 * k, wr * 0.8) & (cv.Y < wy - 1.5 * k), SC, 'edge')
    sh_top = grip[1] + 3
    shield = cv.poly([(x0 + 5 * k, gy - 9 * k + bob), (x0 + 9 * k, sh_top), (x0 + 13.5 * k, sh_top),
                      (x0 + 13 * k, gy - 6.5 * k + bob), (x0 + 9 * k, gy - 6 * k + bob)])
    cv.fill(shield, SC, 'edge', hi=True)
    cv.fill(cv.cap((x0 + 11 * k, sh_top + 1), (grip[0] + 0.5, grip[1] + 1), 1.6), CREAM, 'edge')
    cv.fill(cv.ell(x0 + 7.8 * k, sh_top + 2.5, 1.8, 1.8), LAMP, 'flat')
    cv.fill(cv.cap((grip[0] - 2.5, grip[1]), (grip[0] + 2.5, grip[1] - 0.5), 1.0), TIRE, 'flat')
    arm(cv, sp, (cx, ty + 2), grip)
    hand(cv, sp, grip)
    head(cv, sp, cx - 0.5, hy, 'w', helmet=helmet_for(sp))


def _handlebar_front(cv, cx, y, mirrors=True):
    cv.fill(cv.cap((cx - 12, y), (cx + 12, y), 1.1), TIRE, 'flat')
    if mirrors:
        for sgn in (-1, 1):
            cv.fill(cv.cap((cx + sgn * 10, y - 1), (cx + sgn * 11.5, y - 6), 0.6), TIRE, 'flat', contour=False)
            cv.fill(cv.ell(cx + sgn * 12, y - 7, 1.8, 1.4), HUB, 'flat')


def _ride_front(cv, sp, f, bob):
    S = ST
    cx = RW / 2
    gy = GY
    hip = gy - 19 + bob
    ty = hip - S['th']
    hy = ty - S['ry'] + 4
    back_hair(cv, sp, cx, hy, 's')
    # rear body peeking at the sides
    cv.fill(cv.ell(cx, hip + 3, 10, 4), SC, 'ell', (cx, hip + 3, 10, 4))
    for sgn in (-1, 1):
        knee = (cx + sgn * 6, hip + 2)
        leg(cv, sp, (cx + sgn * 3, hip), (cx + sgn * 6.5, gy - 9 + bob), knee=knee)
    torso(cv, sp, 's', cx, ty, hip)
    details_front(cv, sp, cx, ty)
    # floorboard skirts + feet
    for sgn in (-1, 1):
        cv.fill(cv.rect(cx + sgn * 8.5 - 3, gy - 8 + bob, cx + sgn * 8.5 + 3, gy - 5 + bob), CREAM, 'edge')
        foot(cv, sp, (cx + sgn * 9, gy - 8.5 + bob), 's')
    # front wheel + fender + leg shield
    _wheel(cv, cx, gy - 5, 5.2, f, side=False)
    cv.fill(cv.ell(cx, gy - 8 + bob, 4.2, 3) & (cv.Y < gy - 7 + bob), SC, 'edge')
    shield = cv.poly([(cx - 6.5, hip - 1), (cx + 6.5, hip - 1), (cx + 8, gy - 9 + bob), (cx + 4, gy - 7 + bob),
                      (cx - 4, gy - 7 + bob), (cx - 8, gy - 9 + bob)])
    cv.fill(shield, SC, 'edge', hi=True)
    cv.fill(cv.ell(cx, hip + 3, 2.4, 2.2), LAMP, 'ell', (cx, hip + 3, 2.4, 2.2))
    cv.fill(cv.rect(cx - 1.5, hip - 5, cx + 1.5, hip - 1), CREAM, 'edge')
    hb = hip - 5
    _handlebar_front(cv, cx, hb)
    for sgn in (-1, 1):
        g = (cx + sgn * 10.5, hb)
        arm(cv, sp, (cx + sgn * (S['tw'] / 2 - 0.5), ty + 2), g)
        hand(cv, sp, g)
    head(cv, sp, cx, hy, 's', helmet=helmet_for(sp))


def _ride_back(cv, sp, f, bob):
    S = ST
    cx = RW / 2
    gy = GY
    hip = gy - 19 + bob
    ty = hip - S['th']
    hy = ty - S['ry'] + 4
    hb = hip - 5
    _handlebar_front(cv, cx, hb)
    for sgn in (-1, 1):
        g = (cx + sgn * 10.5, hb)
        hand(cv, sp, g, far=True)
        arm(cv, sp, (cx + sgn * (S['tw'] / 2 - 0.5), ty + 2), g)
    for sgn in (-1, 1):
        cv.fill(cv.rect(cx + sgn * 8.5 - 3, gy - 8 + bob, cx + sgn * 8.5 + 3, gy - 5 + bob), CREAM, 'edge')
        foot(cv, sp, (cx + sgn * 9, gy - 8.5 + bob), 'n')
    torso(cv, sp, 'n', cx, ty, hip)
    backpack_back(cv, sp, cx, ty)
    head(cv, sp, cx, hy, 'n', helmet=helmet_for(sp))
    # tail: seat edge, cowl, tail light, plate, rear wheel
    _wheel(cv, cx, gy - 5, 5.2, f, side=False)
    cv.fill(cv.ell(cx, hip + 1, 8, 2.2), SEAT, 'ell', (cx, hip, 8, 2.2))
    cowl = cv.ell(cx, gy - 11 + bob, 11, 7.5) & (cv.Y > hip + 1.5)
    cv.fill(cowl, SC, 'ell', (cx, gy - 13 + bob, 11, 7.5))
    cv.fill(cv.rect(cx - 4, gy - 13 + bob, cx + 4, gy - 11 + bob), BOAT_R, 'flat')
    cv.fill(cv.rect(cx - 3, gy - 9 + bob, cx + 3, gy - 6 + bob), P['paper'], 'edge')
    for xx in (cx - 2, cx, cx + 1):
        cv.px(xx, gy - 8 + bob, BOAT_K['base'])


# ----------------------------------------------------------------------------- tatala
def _foam_and_submerge(cv, wl, extra=()):
    below = cv.Y > wl + 1
    under = cv.c[..., 3] > 0
    cols = np.nonzero((under & (np.abs(cv.Y - (wl + 1.5)) < 0.6)).any(axis=0))[0]
    cv.erase(below)
    foam = np.zeros(cv.c.shape[:2], bool)
    if len(cols):
        x0, x1 = cols.min() - 3, cols.max() + 3
        foam |= (cv.Y > wl + 1) & (cv.Y < wl + 2.2) & (cv.X > x0) & (cv.X < x1)
        for xx in (x0 - 3, x1 + 1):
            foam |= (cv.Y > wl + 1) & (cv.Y < wl + 2.2) & (cv.X > xx) & (cv.X < xx + 2.5)
    for (fx, fy) in extra:
        foam |= cv.ell(fx, fy, 3.2, 1.4) & (cv.Y > wl)
    cv.fill(foam, FOAM, 'flat', contour=False, pattern=lambda x, y, t: FOAM['sh'] if x % 3 == 0 else None)


def _hull_bands(gun, x0):
    def pat(x, y, t):
        if y <= gun:
            return None
        d = y - gun
        if d == 1:
            return BOAT_K['base']
        if d in (2, 3):
            k = (x - int(x0)) % 4
            if (d == 2 and k in (0, 1)) or (d == 3 and k in (1, 2)):
                return BOAT_R['base']
            return None
        if d == 4:
            return BOAT_K['base']
        return None
    return pat


def _boat_eye(cv, ex, ey, r=3.6):
    cv.fill(cv.ell(ex, ey, r, r), BOAT_K, 'flat', contour=False)
    cv.fill(cv.ell(ex, ey, r - 1, r - 1), BOAT_W, 'flat', contour=False)
    cv.fill(cv.ell(ex, ey, r - 2, r - 2), BOAT_R, 'flat', contour=False)


def _tatala_side(cv, x0, x1, wl):
    mid = (x0 + x1) / 2
    half = (x1 - x0) / 2
    gun = wl - 10
    hull = cv.ell(mid, gun, half - 7, 13) & (cv.Y >= gun)
    horns = np.zeros_like(hull)
    for sgn in (-1, 1):
        base = (mid + sgn * (half - 13), gun + 4)
        p1 = (mid + sgn * (half - 6), gun - 4)
        p2 = (mid + sgn * (half - 3.5), gun - 14)
        p3 = (mid + sgn * (half - 5.5), gun - 20)
        horns |= cv.cap(base, p1, 3.6) | cv.cap(p1, p2, 2.4) | cv.cap(p2, p3, 1.7)
    cv.fill(hull | horns, BOAT_W, 'edge', pattern=_hull_bands(gun, x0), sh=(0, 1))
    hm = horns & (cv.Y < gun)
    for yy in range(int(gun - 21), int(gun)):
        row = hm & (cv.Y >= yy) & (cv.Y < yy + 1)
        if not row.any():
            continue
        band = (yy - int(gun)) % 6
        if band in (1, 2):
            cv.fill(row, BOAT_R, 'flat', contour=False)
        elif band == 4:
            cv.fill(row, BOAT_K, 'flat', contour=False)
    _boat_eye(cv, mid - half + 17, gun + 6)
    return gun


STROKE_SIDE = [  # (top hand dx, dy), (low hand dx, dy from ty+th), blade (dx, y rel wl)
    ((6, 1), (-9, -2), (-21, 1)),
    ((3, 2), (-4, 0), (-8, 2)),
    ((1, 3), (3, -1), (9, -1)),
    ((5, 0), (-6, -4), (-18, -7)),
]


def canoe_frame(sp, view, f):
    cv = Cv(CW, CH)
    if view == 'w':
        foam = _canoe_side(cv, sp, f)
    else:
        foam = _canoe_end(cv, sp, f, view)
    _foam_and_submerge(cv, WL, foam)
    return finish(cv)


def _paddle(cv, top, blade, ux, uy):
    shaft0 = (top[0] - ux * 4, top[1] - uy * 4)
    cv.fill(cv.cap(shaft0, blade, 1.0), P['wood'], 'flat')
    bl = cv.cap((blade[0] - ux * 3, blade[1] - uy * 3), (blade[0] + ux * 4, blade[1] + uy * 4), 2.6)
    cv.fill(bl, P['wood'], 'edge')
    cv.fill(cv.cap((blade[0] - ux * 0.5, blade[1] - uy * 0.5), (blade[0] + ux * 1.5, blade[1] + uy * 1.5), 1.2), BOAT_R, 'flat', contour=False)


def _canoe_side(cv, sp, f):
    S = ST
    wl = WL
    cx = CW / 2 + 3
    hipy = wl - 7
    ty = hipy - S['th']
    hy = ty - S['ry'] + 4
    tws = S['tw'] * 0.72
    (tdx, tdy), (ldx, ldy), (bdx, bdy) = STROKE_SIDE[f]
    top_h = (cx + tdx, ty + tdy)
    low_h = (cx + ldx, ty + S['th'] + ldy)
    blade = (cx + bdx, wl + bdy)
    back_hair(cv, sp, cx - 0.5, hy, 'w')
    backpack_side(cv, sp, cx, ty, tws)
    arm(cv, sp, (cx + 1, ty + 2), top_h, far=True)
    torso(cv, sp, 'w', cx, ty, hipy + 2)
    head(cv, sp, cx - 0.5, hy, 'w')
    hand(cv, sp, top_h, far=True)
    _tatala_side(cv, 14, CW - 14, wl)
    dx, dy = blade[0] - top_h[0], blade[1] - top_h[1]
    L = math.hypot(dx, dy)
    _paddle(cv, top_h, blade, dx / L, dy / L)
    arm(cv, sp, (cx, ty + 2), low_h)
    hand(cv, sp, low_h)
    return [(blade[0], wl + 1)] if bdy >= 0 else []


def _canoe_end(cv, sp, f, view):
    """bow-on (s) or stern-on (n) view: the end spire is short (seen from above)"""
    S = ST
    wl = WL
    cx = CW / 2
    gun = wl - 9
    hip = gun - 1
    ty = hip - S['th']
    hy = ty - S['ry'] + 4
    side = 1 if f < 2 else -1
    if view == 'n':
        side = -side
    pull = f % 2 == 1
    top_h = (cx - side * 6, ty + 7)
    low_h = (cx + side * 9, ty + S['th'] - 1)
    blade = (cx + side * (24 if pull else 22), wl - 4 if pull else wl + 1)
    # inside of the hull seen from above
    cv.fill(cv.ell(cx, gun + 0.5, 18.5, 4.4), INTERIOR, 'ell', (cx, gun - 2, 18, 4))
    if view == 's':
        back_hair(cv, sp, cx, hy, 's')
    cut = cv.Y < gun + 2
    torso(cv, sp, view, cx, ty, hip, cut=cut)
    if view == 's':
        details_front(cv, sp, cx, ty)
    else:
        backpack_back(cv, sp, cx, ty)
    # far (upper) arm, hull face + spire, paddle, near arm, and the head last so nothing crosses the face
    arm(cv, sp, (cx - side * (S['tw'] / 2 - 0.5), ty + 2), top_h)
    face = cv.ell(cx, gun, 20, 11) & (cv.Y >= gun) & (cv.Y <= wl + 2)
    cv.fill(face, BOAT_W, 'ell', (cx, gun, 20, 11), pattern=_hull_bands(gun, cx - 20))
    for sgn in (-1, 1):
        _boat_eye(cv, cx + sgn * 12, gun + 6.5, 2.8)
    spire = cv.cap((cx, gun + 7), (cx, gun - 3), 1.9) | cv.cap((cx, gun - 3), (cx + 1.2, gun - 6), 1.3)
    cv.fill(spire, BOAT_W, 'edge', pattern=lambda x, y, t: BOAT_R['base'] if (y - int(gun)) % 4 == 0 else BOAT_K['base'] if (y - int(gun)) % 4 == 2 else None)
    dx, dy = blade[0] - top_h[0], blade[1] - top_h[1]
    L = math.hypot(dx, dy)
    _paddle(cv, top_h, blade, dx / L, dy / L)
    hand(cv, sp, top_h)
    arm(cv, sp, (cx + side * (S['tw'] / 2 - 0.5), ty + 2), low_h)
    hand(cv, sp, low_h)
    head(cv, sp, cx, hy, view)
    return [] if pull else [(blade[0], wl + 1)]
