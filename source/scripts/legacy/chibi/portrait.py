"""Half-body dialogue portraits in style A (pixel art, 88x112 logical, x5 = 440x560 webp)."""
import math, os
import numpy as np
from PIL import Image
from .kit import Cv, R, dark, hx, auto
from . import character as C
from .character import P, SKIN, HAIR, BEADS, EC, BLUSH, MOUTH, TONGUE
from .cast import PLAYER, NPC

PW, PH = 88, 112
Z = 5
K = 2.2

PORTRAITS = {
    'local': PLAYER['player'], 'local_f': PLAYER['player_f'],
    'traveler': PLAYER['player_visitor'], 'traveler_f': PLAYER['player_visitor_f'],
    'elder': NPC['elder'], 'farmer': NPC['farmer'], 'fisher': NPC['fisher'], 'harbor': NPC['harbor'],
    'nurse': NPC['clinic'], 'visitor': NPC['tourist'], 'researcher': NPC['player_researcher'], 'villager': NPC['villager'],
}
IRIS = [hx('#4A2A3A'), hx('#6E3E38'), hx('#A8653F')]


def eye(cv, ex, ey, ew, eh, fem, outer):
    m = cv.ell(ex, ey, ew / 2, eh / 2)
    ys, xs = np.nonzero(m)
    top = ey - eh / 2
    for y, x in zip(ys, xs):
        f = (y + 0.5 - top) / eh
        col = IRIS[0] if f < 0.45 else IRIS[1] if f < 0.75 else IRIS[2]
        if f < 0.1:
            col = EC['K']
        cv.px(x, y, col)
    pm = cv.ell(ex, ey + 0.6, ew * 0.2, eh * 0.24)
    for y, x in zip(*np.nonzero(pm)):
        cv.px(x, y, EC['K'])
    for y, x in zip(*np.nonzero(cv.ell(ex - ew * 0.2, ey - eh * 0.12, 2.0, 2.4))):
        cv.px(x, y, EC['W'])
    cv.px(ex + ew * 0.22, ey + eh * 0.26, EC['W'])
    # lash line a touch wider than the eye
    for x in range(int(ex - ew / 2 - 0.5), int(ex + ew / 2 + 0.6)):
        cv.px(x, top, EC['K'])
    ox = ex + outer * (ew / 2 + 0.5)
    cv.px(ox, top + 0.5, EC['K'])
    if fem:
        cv.px(ox + outer, top - 0.5, EC['K'])
        cv.px(ox + outer * 2, top - 1.5, EC['K'])


def face(cv, sp, cx, cy, expr=None):
    rx, ry = C.ST['rx'], C.ST['ry']
    fem = sp.get('female')
    ey = cy + ry * 0.16
    dx = rx * 0.42
    ew, eh = 8.0, 11.0
    for sgn in (-1, 1):
        ex = cx + sgn * dx
        if sp.get('elder'):
            arc = cv.ring(ex, ey + 2.5, 4.2, 3.6, 1.6) & (cv.Y < ey + 2.2)
            for y, x in zip(*np.nonzero(arc)):
                cv.px(x, y, EC['K'])
            brow = cv.cap((ex - 3, ey - 5.5), (ex + 3, ey - 6.2 + sgn * 0.4), 0.8)
            for y, x in zip(*np.nonzero(brow)):
                cv.px(x, y, HAIR[sp['hair']]['sh'])
            by = ey + 4.5
        else:
            eye(cv, ex, ey, ew, eh, fem, sgn)
            by = ey + eh * 0.62
        bl = cv.ell(ex + sgn * 2.2, by, 3.6, 1.6)
        for y, x in zip(*np.nonzero(bl)):
            cv.px(x, y, BLUSH)
        cv.px(ex + sgn * 2.2 - 1, by - 0.6, hx('#FFD2C8'))
    cv.px(cx - 0.5, cy + ry * 0.4, SKIN[sp['skin']]['sh'])
    my = cy + ry * 0.62
    if sp.get('elder'):
        sm = cv.ring(cx, my - 2.2, 3.6, 3.0, 1.1) & (cv.Y > my - 1.2)
        for y, x in zip(*np.nonzero(sm)):
            cv.px(x, y, MOUTH)
    else:
        mo = cv.ell(cx, my - 0.3, 3.8, 3.0) & (cv.Y >= my - 0.6)
        for y, x in zip(*np.nonzero(mo)):
            cv.px(x, y, MOUTH)
        for y, x in zip(*np.nonzero(cv.ell(cx, my + 1.4, 1.8, 0.9) & mo)):
            cv.px(x, y, TONGUE)


def scaled_pattern(sp, cx, top):
    pat = sp.get('pat')
    pr = sp.get('pat_ramp', P['indigo'])
    x0 = int(cx)
    if pat == 'stripes':
        return lambda x, y, t: (pr['sh'] if t < 0 else pr['base']) if (x - x0) % 7 in (0, 1) else None
    if pat == 'taririk':
        def f(x, y, t):
            k = (x - x0) % 9
            if k in (0, 1):
                return pr['sh'] if t < 0 else pr['base']
            if k == 4:
                return P['ink']['base']
            return None
        return f
    if pat == 'wave':
        band = int(top + 13)

        def g(x, y, t):
            k = (x - x0) % 8
            d = y - band
            if 0 <= d < 4 and (k == d or k == 7 - d):
                return P['white']['sh' if t < 0 else 'base']
            return None
        return g
    if pat == 'hstripes':
        return lambda x, y, t: (pr['sh'] if t < 0 else pr['base']) if (y - int(top)) % 7 in (0, 1) else None
    if pat == 'dots':
        return lambda x, y, t: (pr['sh'] if t < 0 else pr['base']) if (x - x0) % 8 in (2, 3) and (y - int(top)) % 8 in (3, 4) else None
    return None


def bust(cv, sp, cx, top):
    skin = SKIN[sp['skin']]
    cv.fill(cv.rect(cx - 5, top - 8, cx + 5, top + 6), skin, 'edge')
    m = cv.ell(cx, top + 34, 30, 36) & (cv.Y >= top)
    neck = cv.ell(cx, top + 0.5, 6.5, 4.5)
    kind = sp['top_kind']
    if kind in ('tee', 'wrap'):
        cv.fill(m & ~neck, sp['top'], 'ell', (cx, top + 20, 30, 30), pattern=scaled_pattern(sp, cx, top), thr=(0.78, -0.72))
    else:
        inner = sp['inner']
        cv.fill(m & ~neck, inner, 'ell', (cx, top + 20, 30, 30), thr=(0.78, -0.72))
        if kind == 'coat':
            panel = m & (np.abs(cv.X - cx) > (cv.Y - top) * 0.32 + 3)
        else:
            panel = m & (np.abs(cv.X - cx) > 7)
        if kind == 'hivis':
            tape = lambda x, y, t: P['tape']['base'] if (y - int(top)) in (14, 15, 24, 25) else None
            cv.fill(panel, sp['top'], 'ell', (cx, top + 20, 30, 30), pattern=tape, thr=(0.78, -0.72))
        else:
            cv.fill(panel, sp['top'], 'ell', (cx, top + 20, 30, 30), pattern=scaled_pattern(sp, cx, top), thr=(0.78, -0.72))
    acc = sp.get('acc', [])
    if 'beads' in acc:
        for i in range(9):
            a = math.pi * (0.15 + 0.7 * i / 8)
            bx, by = cx + math.cos(a) * 9, top + 1 + math.sin(a) * 7
            cv.fill(cv.ell(bx, by, 1.4, 1.4), R('#FFFFFF', *(['#%02X%02X%02X' % BEADS[i % 4][:3]] * 1), '#8A8A8A', '#3A2A2A'), 'flat', contour=False)
    if 'backpack' in acc:
        pk = sp.get('pack', P['wood'])
        for sgn in (-1, 1):
            cv.fill(cv.rect(cx + sgn * 13 - 2, top + 2, cx + sgn * 13 + 2, PH), pk, 'edge', hi=True)
    if 'lanyard' in acc:
        cv.fill(cv.cap((cx - 6, top + 1), (cx - 1, top + 16), 0.7) | cv.cap((cx + 6, top + 1), (cx + 1, top + 16), 0.7), P['indigo'], 'flat', contour=False)
        cv.fill(cv.rect(cx - 4, top + 16, cx + 4, top + 26), P['paper'], 'edge')
        cv.fill(cv.rect(cx - 2.5, top + 18, cx + 0.5, top + 21), auto('#5FB3A6'), 'flat', contour=False)
    if 'camera' in acc:
        cv.fill(cv.cap((cx - 13, top + 2), (cx - 6, top + 16), 0.8) | cv.cap((cx + 13, top + 2), (cx + 6, top + 16), 0.8), P['ink'], 'flat', contour=False)
        cv.fill(cv.rect(cx - 8, top + 15, cx + 8, top + 25), P['ink'], 'edge', hi=True)
        cv.fill(cv.ell(cx, top + 20, 3.4, 3.4), R('#C8E8FF', '#8FB8D8', '#5A7FA0', '#22303C'), 'ell', (cx, top + 20, 3.4, 3.4))
        cv.px(cx - 1, top + 18.5, EC['W'])


def prop(cv, sp, cx, top):
    it = sp.get('item')
    skin = SKIN[sp['skin']]
    if it == 'stick':
        cv.fill(cv.cap((cx + 30, top - 4), (cx + 30, PH + 2), 2.0), P['wood'], 'edge', hi=True)
        cv.fill(cv.ell(cx + 30, top + 22, 4.6, 4.0), skin, 'ell', (cx + 30, top + 22, 4.6, 4))
    elif it == 'paddle':
        cv.fill(cv.cap((cx + 22, PH + 2), (cx + 33, top - 26), 1.8), P['wood'], 'edge', hi=True)
        bl = cv.ell(cx + 34, top - 32, 5.5, 12)
        cv.fill(bl, P['wood'], 'ell', (cx + 34, top - 32, 5.5, 12),
                pattern=lambda x, y, t: P['red']['base'] if (y - int(top - 44)) % 8 in (2, 3) else P['ink']['base'] if (y - int(top - 44)) % 8 == 5 else P['white']['base'] if (y - int(top - 44)) % 8 in (4, 6) else None)
        cv.fill(cv.ell(cx + 25, top + 20, 4.6, 4.0), skin, 'ell', (cx + 25, top + 20, 4.6, 4))
    elif it == 'clipboard':
        cv.fill(cv.rect(cx + 5, top + 14, cx + 25, top + 40), P['wood'], 'edge', hi=True)
        cv.fill(cv.rect(cx + 7, top + 17, cx + 23, top + 38), P['paper'], 'flat', contour=False)
        for k in range(4):
            cv.fill(cv.rect(cx + 9, top + 21 + k * 4, cx + 21 - (k % 2) * 4, top + 22 + k * 4), P['indigo'], 'flat', contour=False)
        cv.fill(cv.rect(cx + 11, top + 12.5, cx + 19, top + 16), P['tape'], 'edge')
        cv.fill(cv.ell(cx + 5, top + 28, 4.4, 4.0), skin, 'ell', (cx + 5, top + 28, 4.4, 4))
    elif it == 'rope':
        rr = R('#F0D9A6', '#CFAF72', '#A88748', '#5A4220')
        cv.fill(cv.ring(cx - 21, top + 14, 11, 12, 4.2), rr, 'ell', (cx - 21, top + 14, 11, 12),
                pattern=lambda x, y, t: rr['sh'] if (x + y) % 4 in (0, 1) else None)
    elif it == 'basket':
        for lx, ly, a in ((-33, top + 8, 0), (-25, top + 4, 1), (-18, top + 10, 2)):
            cv.fill(cv.ell(cx + lx, ly, 6.5, 4.6), P['leaf'], 'ell', (cx + lx, ly, 6.5, 4.6))
        weave = lambda x, y, t: P['rattan']['sh'] if (x + y) % 5 in (0, 1) or (x - y) % 5 == 0 else None
        cv.fill(cv.poly([(cx - 40, top + 12), (cx - 10, top + 12), (cx - 13, PH + 2), (cx - 37, PH + 2)]), P['rattan'], 'edge', pattern=weave)
        cv.fill(cv.ell(cx - 12, top + 18, 4.4, 4.0), skin, 'ell', (cx - 12, top + 18, 4.4, 4))
    elif it == 'notebook':
        cv.fill(cv.rect(cx + 6, top + 14, cx + 24, top + 38), R('#F2B866', '#D98E3A', '#B06A28', '#5A3010'), 'edge', hi=True)
        cv.fill(cv.rect(cx + 8, top + 18, cx + 22, top + 22), P['paper'], 'flat', contour=False)
        cv.fill(cv.ell(cx + 6, top + 28, 4.4, 4.0), skin, 'ell', (cx + 6, top + 28, 4.4, 4))


def portrait(sp):
    saved = dict(C.ST)
    C.ST.update(rx=12.5 * K, ry=11.5 * K, k=K)
    try:
        cv = Cv(PW, PH)
        cx, cy = PW / 2, 47
        top = cy + C.ST['ry'] - 2
        C.back_hair(cv, sp, cx, cy, 's')
        if sp.get('item') == 'paddle':
            pass
        bust(cv, sp, cx, top)
        prop(cv, sp, cx, top)
        C.head(cv, sp, cx, cy, 's', face=face)
        cv.clean()
        cv.outline()
        return cv.img()
    finally:
        C.ST.clear()
        C.ST.update(saved)


def build_all(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for name, sp in PORTRAITS.items():
        im = portrait(sp).resize((PW * Z, PH * Z), Image.NEAREST)
        path = os.path.join(out_dir, f'{name}.webp')
        im.save(path, 'WEBP', lossless=True, method=6)
        print('portrait', name, os.path.getsize(path))
