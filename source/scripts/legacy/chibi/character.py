"""Style-A chibi characters: specs, heads (front / side / back), bodies and the 4x4 walk sheet."""
import math
import numpy as np
from PIL import Image
from .kit import Cv, R, auto, dark, hx, lerp, bleed

FW, FH = 64, 96
GY = 90  # feet baseline row (outline lands on ~92, same anchor as the v3 sheets)
ST = dict(rx=12.5, ry=11.5, tw=14, th=13, leg=10, r=2.5, arm=10, shortlen=3, hand=2.3)

SKIN = {
    'tan': R('#F3BF8F', '#DD9A66', '#B8714A', '#7A3F2C'),
    'deep': R('#E8AC7C', '#CC8854', '#A6653C', '#5E3020'),
    'medium': R('#F8CDA5', '#EAB084', '#C98A62', '#7F4A33'),
    'light': R('#FFE4CC', '#F7CFAC', '#DDA886', '#8A5440'),
}
HAIR = {
    'black': R('#55476B', '#2E2538', '#1E1828', '#140F1C'),
    'grey': R('#FFFFFF', '#E2DFD8', '#B9B4AC', '#5E5A55'),
    'brown': R('#8A6450', '#5E4032', '#452E24', '#24160F'),
}
P = {
    'shirtM': R('#FFFFFF', '#F3EFE2', '#CFC9D8', '#4A4766'),
    'indigo': R('#4A6FB8', '#2F518F', '#243F73', '#1C2E55'),
    'ink': R('#3A3F55', '#262A3A', '#1A1D28', '#0E1018'),
    'navy': R('#4A63A0', '#33497E', '#25365F', '#17213D'),
    'coral': R('#FF8A73', '#EE5F4E', '#C2434A', '#6E1F2E'),
    'white': R('#FFFFFF', '#FFF6E8', '#F2D9CF', '#6E5A55'),
    'denim': R('#5C7FC0', '#41609F', '#2F4A80', '#1B2A4D'),
    'sandal': R('#A8724C', '#8A5638', '#6A3E28', '#3C2016'),
    'red': R('#E8574B', '#C8372D', '#9C2626', '#3A1414'),
    'yellow': R('#FFF08A', '#FFD23F', '#E8A82A', '#7A4A12'),
    'wood': R('#D8A56E', '#B7834F', '#8F6038', '#4A2E18'),
    'leaf': R('#9BE07A', '#5DB85A', '#3E8C4A', '#1E4A2A'),
    'rattan': R('#E8C98A', '#C9A15E', '#A07A40', '#5A3E1C'),
    'paper': R('#FFFFFF', '#F6F4EE', '#DAD6CC', '#6A665E'),
    'tape': R('#FFFFFF', '#EEF0F4', '#C8CCD6', '#6A6E78'),
    'helmM': R('#FFE58A', '#F5C83E', '#D49A2A', '#6B4515'),
    'helmF': R('#D8FFF6', '#9BE6D6', '#64BFB0', '#235A55'),
}
EC = {'K': hx('#2A1626'), 'P': hx('#4A2A3A'), 'I': hx('#B0704A'), 'W': hx('#FFFFFF')}
BLUSH = hx('#F4867E')
MOUTH = hx('#8A3B34')
TONGUE = hx('#E8626A')
BIG = ["KKK", "KWP", "PWP", "PPP", "PIP"]
ARC = [".K.", "K.K"]
BEADS = [hx('#C8372D'), hx('#F2C14E'), hx('#FFFFFF'), hx('#2F518F')]


def woven(x, y, t):
    k = x % 4
    return [P['indigo'], P['white'], P['red'], P['white']][k]['sh' if t < 0 else 'base']


# ----------------------------------------------------------------------------- patterns
def top_pattern(sp, cx, ty, which=None):
    pat = which or sp.get('pat')
    pr = sp.get('pat_ramp', P['indigo'])
    x0 = int(cx)
    if pat == 'stripes':
        return lambda x, y, t: (pr['sh'] if t < 0 else pr['base']) if (x - x0) % 3 == 0 else None
    if pat == 'taririk':
        def f(x, y, t):
            k = (x - x0) % 4
            if k == 0:
                return pr['sh'] if t < 0 else pr['base']
            if k == 2:
                return P['ink']['base']
            return None
        return f
    if pat == 'wave':
        w = P['white']
        band = int(ty + ST['th'] * 0.42)

        def g(x, y, t):
            k = (x - x0) % 4
            if (y == band and k == 0) or (y == band + 1 and k in (1, 3)) or (y == band + 2 and k == 2):
                return w['sh'] if t < 0 else w['base']
            return None
        return g
    if pat == 'hstripes':
        return lambda x, y, t: (pr['sh'] if t < 0 else pr['base']) if (y - int(ty)) % 3 == 0 else None
    if pat == 'dots':
        return lambda x, y, t: (pr['sh'] if t < 0 else pr['base']) if (x - x0) % 4 == 1 and (y - int(ty)) % 4 == 2 else None
    return None


def skirt_pattern(sp, top):
    pr = sp.get('bot_pat', P['white'])

    def f(x, y, t):
        k = (y - int(top)) % 5
        if k == 3:
            return pr['sh'] if t < 0 else pr['base']
        if k == 4 and x % 3 == 0:
            return P['red']['base']
        return None
    return f


# ----------------------------------------------------------------------------- heads
def back_hair(cv, sp, cx, cy, view):
    """long hair hanging behind the body (drawn before the torso for s / w views)"""
    if sp['hair_style'] != 'bob' or sp.get('headwear') == 'scarf':
        return
    rx, ry = ST['rx'], ST['ry']
    hair = HAIR[sp['hair']]
    if view == 's':
        cv.fill(cv.ell(cx, cy + ry * 0.35, rx * 1.12, ry * 1.0), hair, 'ell', (cx, cy, rx, ry))
    elif view == 'w':
        cv.fill(cv.ell(cx + rx * 0.42, cy + ry * 0.45, rx * 0.62, ry * 0.85), hair, 'edge')


def _spikes(cv, cx, rx, K=1.0):
    return 1.6 * K * (np.floor((cv.X - cx + rx) / (3.0 * K)) % 2)


def head(cv, sp, cx, cy, view, helmet=None, expr=None, face=None):
    rx, ry = ST['rx'], ST['ry']
    K = ST.get('k', 1.0)
    skin = SKIN[sp['skin']]
    hair = HAIR[sp['hair']]
    style = sp['hair_style']
    hw = None if helmet else sp.get('headwear')
    FT = (0.78, -0.62) if K == 1 else (0.86, -0.84)
    X, Y = cv.X, cv.Y
    if view == 's':
        for sgn in (-1, 1):
            cv.fill(cv.ell(cx + sgn * rx * 0.98, cy + ry * 0.15, 2.2 * K, 2.6 * K), skin, 'edge')
        if style == 'bun' and hw is None and not helmet:
            cv.fill(cv.ell(cx, cy - ry * 0.98, 4.6 * K, 3.6 * K), hair, 'ell', (cx, cy - ry, 4.6 * K, 3.6 * K))
        cv.fill(cv.ell(cx, cy, rx, ry), skin, 'ell', (cx, cy, rx, ry), thr=FT)
        capm = cv.ell(cx, cy - ry * 0.16, rx * 1.07, ry * 0.92)
        side = np.abs(X - cx)
        if style == 'spiky':
            capm &= (Y < cy - ry * 0.22 + _spikes(cv, cx, rx, K)) | ((side > rx * 0.8) & (Y < cy + ry * 0.15))
        elif style == 'short':
            capm &= (Y < cy - ry * 0.3 + (X - cx) / rx * 1.8) | ((side > rx * 0.82) & (Y < cy + ry * 0.05))
        elif style == 'bob':
            capm &= (Y < (cy - ry * 0.12 - 2.2 * np.cos((X - cx) / rx * 3.1))) | (side > rx * 0.72)
        elif style == 'bun':
            capm &= (Y < (cy - ry * 0.16 - 2.0 * np.cos((X - cx) / rx * 3.1))) | ((side > rx * 0.8) & (Y < cy + ry * 0.12))
        elif style == 'elder_m':
            capm &= (Y < cy - ry * 0.44 + 0.9 * np.sin((X - cx) * 0.9)) | ((side > rx * 0.86) & (Y < cy - ry * 0.02))
        cv.fill(capm, hair, 'ell', (cx, cy - ry * 0.3, rx, ry), thr=(0.72, -0.5))
        if K > 1:
            cv.fill(capm & cv.ring(cx - rx * 0.15, cy - ry * 0.42, rx * 0.62, ry * 0.36, 1.3 * K) & (Y < cy - ry * 0.45), hair, 'flat', contour=False,
                    pattern=lambda x, y, t: hair['hi'])
        if style == 'spiky' and hw is None and not helmet:
            cv.fill(cv.poly([(cx - 2 * K, cy - ry * 0.9), (cx + 1 * K, cy - ry * 1.22), (cx + 3 * K, cy - ry * 0.85)]), hair, 'flat', contour=False)
        if style == 'bob' and hw != 'scarf':
            for sgn in (-1, 1):
                cv.fill(cv.cap((cx + sgn * rx * 0.9, cy - ry * 0.2), (cx + sgn * rx * 0.92, cy + ry * 0.75), 2.3 * K), hair, 'edge')
        if helmet:
            helm(cv, cx, cy, 's', helmet)
        else:
            headwear(cv, sp, cx, cy, 's')
        (face or face_front)(cv, sp, cx, cy, expr)
        if sp.get('flower') and hw is None and not helmet:
            flower(cv, cx + rx * 0.62, cy - ry * 0.55, K)
    elif view == 'w':
        cv.fill(cv.ell(cx, cy, rx, ry), skin, 'ell', (cx, cy, rx, ry), thr=FT)
        capm = cv.ell(cx + rx * 0.12, cy - ry * 0.14, rx * 1.03, ry * 0.94)
        back = X > cx + rx * 0.08
        if style == 'spiky':
            capm &= (Y < cy - ry * 0.24 + _spikes(cv, cx, rx, K)) | (back & (Y < cy + ry * 0.45))
        elif style == 'short':
            capm &= (Y < cy - ry * 0.3) | (back & (Y < cy + ry * 0.4))
        elif style == 'bob':
            capm &= (Y < cy - ry * 0.16 - 1.8 * ((X - (cx - rx)) / rx < 0.5)) | (back & (Y < cy + ry * 0.9))
        elif style == 'bun':
            capm &= (Y < cy - ry * 0.18 - 1.6 * ((X - (cx - rx)) / rx < 0.5)) | (back & (Y < cy + ry * 0.45))
        elif style == 'elder_m':
            capm &= (Y < cy - ry * 0.44) | (back & (Y < cy + ry * 0.35))
        cv.fill(capm, hair, 'ell', (cx, cy - ry * 0.3, rx, ry), thr=(0.72, -0.5))
        if style == 'spiky' and hw is None and not helmet:
            cv.fill(cv.poly([(cx - 1, cy - ry * 0.9), (cx + 3, cy - ry * 1.22), (cx + 4, cy - ry * 0.82)]), hair, 'flat', contour=False)
        if style == 'bun' and hw is None and not helmet:
            cv.fill(cv.ell(cx + rx * 0.82, cy - ry * 0.62, 4.0, 3.8), hair, 'ell', (cx + rx * 0.8, cy - ry * 0.7, 4, 4))
        cv.fill(cv.ell(cx + rx * 0.18, cy + ry * 0.2, 2.0, 2.6), skin, 'edge')
        if helmet:
            helm(cv, cx, cy, 'w', helmet)
        else:
            headwear(cv, sp, cx, cy, 'w')
        face_side(cv, sp, cx, cy, expr)
        if sp.get('flower') and hw is None and not helmet:
            flower(cv, cx + rx * 0.35, cy - ry * 0.62)
    else:  # 'n' back of head
        for sgn in (-1, 1):
            cv.fill(cv.ell(cx + sgn * rx * 0.98, cy + ry * 0.15, 2.2 * K, 2.6 * K), skin, 'edge')
        cv.fill(cv.ell(cx, cy, rx, ry), skin, 'ell', (cx, cy, rx, ry), thr=FT)
        low = {'spiky': 0.72, 'short': 0.68, 'bob': 0.9, 'bun': 0.62, 'elder_m': 0.6}[style]
        capm = cv.ell(cx, cy - ry * 0.06, rx * 1.07, ry * 1.0) & (Y < cy + ry * low)
        if style == 'bob' and sp.get('headwear') != 'scarf':
            capm |= cv.ell(cx, cy + ry * 0.12, rx * 1.1, ry * 1.1) & (Y < cy + ry * 1.18)
        cv.fill(capm, hair, 'ell', (cx, cy - ry * 0.3, rx, ry * 1.2), thr=(0.72, -0.5))
        if style == 'spiky' and hw is None and not helmet:
            cv.fill(cv.poly([(cx - 2, cy - ry * 0.9), (cx + 1, cy - ry * 1.22), (cx + 3, cy - ry * 0.85)]), hair, 'flat', contour=False)
        if style == 'bun' and hw is None and not helmet:
            cv.fill(cv.ell(cx, cy - ry * 0.45, 5.0, 4.2), hair, 'ell', (cx, cy - ry * 0.5, 5, 4.2))
        if helmet:
            helm(cv, cx, cy, 'n', helmet)
        else:
            headwear(cv, sp, cx, cy, 'n')
        if sp.get('flower') and hw is None and not helmet:
            flower(cv, cx - rx * 0.62, cy - ry * 0.55)


def flower(cv, x, y, K=1.0):
    if K > 1:
        for a in range(5):
            ang = a * 2 * math.pi / 5 - math.pi / 2
            cv.fill(cv.ell(x + math.cos(ang) * 1.6 * K, y + math.sin(ang) * 1.6 * K, 1.3 * K, 1.3 * K), P['coral'], 'edge')
        cv.fill(cv.ell(x, y, 0.9 * K, 0.9 * K), P['yellow'], 'flat', contour=False)
        return
    x, y = int(round(x)), int(round(y))
    for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
        cv.px(x + dx, y + dy, P['coral']['hi'])
    cv.px(x, y, P['yellow']['base'])


def draw_pat(cv, x0, y0, pat):
    for j, row in enumerate(pat):
        for i, ch in enumerate(row):
            if ch != '.':
                cv.px(x0 + i, y0 + j, EC[ch])


def face_front(cv, sp, cx, cy, expr=None):
    rx, ry = ST['rx'], ST['ry']
    elder = sp.get('elder')
    fem = sp.get('female')
    ey = int(round(cy + ry * 0.12))
    dx = rx * 0.44
    lx = int(round(cx - dx - 1.5))
    rxp = int(round(cx + dx - 1.5))
    if elder:
        draw_pat(cv, lx, ey + 1, ARC)
        draw_pat(cv, rxp, ey + 1, ARC)
        by = ey + 3
    else:
        draw_pat(cv, lx, ey, BIG)
        draw_pat(cv, rxp, ey, BIG)
        if fem:
            cv.px(lx - 1, ey - 1, EC['K'])
            cv.px(rxp + 3, ey - 1, EC['K'])
        by = ey + 5
    for bx in (lx - 1, rxp + 2):
        cv.px(bx, by, BLUSH)
        cv.px(bx + 1, by, BLUSH)
    my = int(round(cy + ry * 0.62))
    mx = int(round(cx))
    if elder:
        cv.px(mx - 2, my, MOUTH); cv.px(mx - 1, my + 1, MOUTH); cv.px(mx, my + 1, MOUTH); cv.px(mx + 1, my, MOUTH)
    else:
        cv.px(mx - 1, my, MOUTH); cv.px(mx, my, MOUTH); cv.px(mx - 1, my + 1, TONGUE); cv.px(mx, my + 1, TONGUE)


def face_side(cv, sp, cx, cy, expr=None):
    rx, ry = ST['rx'], ST['ry']
    ey = int(round(cy + ry * 0.12))
    ex = int(round(cx - rx * 0.6 - 1.5))
    if sp.get('elder'):
        draw_pat(cv, ex, ey + 1, ARC)
        by = ey + 3
    else:
        draw_pat(cv, ex, ey, BIG)
        if sp.get('female'):
            cv.px(ex + 3, ey - 1, EC['K'])
        by = ey + 5
    cv.px(ex + 2, by, BLUSH)
    cv.px(ex + 3, by, BLUSH)
    my = int(round(cy + ry * 0.62))
    mx = int(round(cx - rx * 0.82))
    cv.px(mx, my, MOUTH)
    cv.px(mx + 1, my, MOUTH)


def helm(cv, cx, cy, view, ramp):
    rx, ry = ST['rx'], ST['ry']
    X, Y = cv.X, cv.Y
    if view == 's':
        m = cv.ell(cx, cy - ry * 0.2, rx * 1.16, ry * 1.0) & (Y < cy - ry * 0.22)
        cv.fill(m, ramp, 'ell', (cx, cy - ry * 0.4, rx, ry))
        cv.fill(cv.rect(cx - rx * 1.2, cy - ry * 0.32, cx + rx * 1.2, cy - ry * 0.32 + 2), ramp, 'edge',
                clip=cv.ell(cx, cy - ry * 0.2, rx * 1.2, ry * 1.05))
    elif view == 'w':
        m = cv.ell(cx + rx * 0.1, cy - ry * 0.2, rx * 1.14, ry * 1.0) & ((Y < cy - ry * 0.18) | ((X > cx + rx * 0.35) & (Y < cy + ry * 0.25)))
        cv.fill(m, ramp, 'ell', (cx, cy - ry * 0.4, rx, ry))
        cv.fill(cv.rect(cx - rx * 1.15, cy - ry * 0.32, cx + rx * 0.3, cy - ry * 0.32 + 2), ramp, 'edge', clip=m)
        for t in range(2):
            cv.px(cx + rx * 0.1 - t * 0.6, cy + ry * 0.55 + t * 1.2, ramp['sh'])
    else:
        m = cv.ell(cx, cy - ry * 0.15, rx * 1.16, ry * 1.0) & (Y < cy + ry * 0.3)
        cv.fill(m, ramp, 'ell', (cx, cy - ry * 0.4, rx, ry))
        cv.fill(cv.rect(cx - 1, cy - ry * 1.1, cx + 1, cy + ry * 0.3), dark(ramp), 'flat', contour=False, clip=m)


def headwear(cv, sp, cx, cy, view):
    hw = sp.get('headwear')
    if not hw:
        return
    rx, ry = ST['rx'], ST['ry']
    K = ST.get('k', 1.0)
    X, Y = cv.X, cv.Y
    rp = sp.get('hw', P['white'])
    if hw == 'cap':
        if view == 'w':
            dome = cv.ell(cx + rx * 0.1, cy - ry * 0.32, rx * 1.03, ry * 0.8) & (Y < cy - ry * 0.26)
            cv.fill(dome, rp, 'ell', (cx, cy - ry * 0.5, rx, ry))
            cv.fill(cv.ell(cx - rx * 0.98, cy - ry * 0.3, rx * 0.5, 1.7 * K), dark(rp), 'edge')
        else:
            dome = cv.ell(cx, cy - ry * 0.32, rx * 1.05, ry * 0.8) & (Y < cy - ry * (0.28 if view == 's' else 0.18))
            cv.fill(dome, rp, 'ell', (cx, cy - ry * 0.5, rx, ry))
            if view == 's':
                cv.fill(cv.ell(cx, cy - ry * 0.3, rx * 0.86, 2.3 * K) & (Y >= cy - ry * 0.34), dark(rp), 'edge')
                cv.px(cx - 1, cy - ry * 0.75, P['white']['base']); cv.px(cx, cy - ry * 0.75, P['white']['base'])
            else:
                cv.fill(cv.rect(cx - 2, cy - ry * 0.3, cx + 2, cy - ry * 0.18), SKIN[sp['skin']], 'flat', contour=False, clip=dome)
    elif hw in ('bucket', 'sunhat'):
        wide = 1.32 if hw == 'bucket' else 1.55
        ox = 0.6 if view == 'w' else 0
        dome = cv.ell(cx + ox, cy - ry * 0.44, rx * 0.92, ry * 0.74) & (Y < cy - ry * 0.28)
        cv.fill(cv.ell(cx + ox, cy - ry * 0.28, rx * wide, (2.7 if view != 'w' else 2.2) * K), dark(rp), 'edge')
        cv.fill(dome, rp, 'ell', (cx, cy - ry * 0.6, rx, ry))
        if hw == 'sunhat':
            band = sp.get('hw2', P['red'])
            cv.fill(dome & (Y >= cy - ry * 0.44) & (Y < cy - ry * 0.44 + 1.8 * K), band, 'flat', contour=False)
    elif hw == 'headband':
        sil = cv.ell(cx + (rx * 0.1 if view == 'w' else 0), cy - ry * 0.1, rx * 1.08, ry * 1.04)
        band = sil & (Y >= cy - ry * 0.46) & (Y < cy - ry * 0.46 + 2.6 * K)
        cv.fill(band, P['indigo'], 'flat', pattern=(lambda x, y, t: woven(int(x // K), y, t)), contour=False)
        if view == 'w':
            cv.fill(cv.cap((cx + rx * 1.0, cy - ry * 0.36), (cx + rx * 1.25, cy + ry * 0.1), 1.0), P['red'], 'flat')
        elif view == 'n':
            for sgn in (-1, 1):
                cv.fill(cv.cap((cx, cy - ry * 0.34), (cx + sgn * 2.5, cy + ry * 0.15), 0.9), P['red'], 'flat')
    elif hw == 'scarf':
        rp = sp.get('hw', P['indigo'])
        pat = lambda x, y, t: P['white']['sh' if t < 0 else 'base'] if int((y - int(cy)) // K) % 4 == 0 and int(x // K) % 2 == 0 else None
        if view == 's':
            m = (cv.ell(cx, cy - ry * 0.18, rx * 1.14, ry * 0.98) & (Y < cy - ry * 0.26)) | \
                (cv.ell(cx, cy, rx * 1.16, ry * 1.04) & (np.abs(X - cx) > rx * 0.84) & (Y < cy + ry * 0.35))
            cv.fill(m, rp, 'ell', (cx, cy - ry * 0.4, rx, ry), pattern=pat)
            cv.fill(cv.ell(cx + rx * 0.92, cy + ry * 0.42, 2.2 * K, 1.8 * K), rp, 'edge')
        elif view == 'w':
            m = cv.ell(cx + rx * 0.1, cy - ry * 0.15, rx * 1.1, ry * 0.98) & ((Y < cy - ry * 0.26) | ((X > cx + rx * 0.05) & (Y < cy + ry * 0.55)))
            cv.fill(m, rp, 'ell', (cx, cy - ry * 0.4, rx, ry), pattern=pat)
            cv.fill(cv.cap((cx + rx * 0.9, cy + ry * 0.4), (cx + rx * 1.15, cy + ry * 0.95), 1.4), rp, 'edge')
        else:
            m = cv.ell(cx, cy - ry * 0.1, rx * 1.12, ry * 1.0) & (Y < cy + ry * 0.55)
            cv.fill(m, rp, 'ell', (cx, cy - ry * 0.4, rx, ry), pattern=pat)
            cv.fill(cv.poly([(cx - 2, cy + ry * 0.45), (cx + 2, cy + ry * 0.45), (cx + 1, cy + ry * 1.0), (cx - 1, cy + ry * 1.0)]), rp, 'edge')


# ----------------------------------------------------------------------------- body parts
def ramps(sp):
    return sp['top'], sp['bot']


def leg(cv, sp, hip, foot, far=False, knee=None):
    S = ST
    top, bot = ramps(sp)
    skin = SKIN[sp['skin']]
    f = dark if far else (lambda r: r)
    pts = [hip, knee, foot] if knee else [hip, foot]
    if sp['bottom'] == 'pants':
        for a, b in zip(pts, pts[1:]):
            cv.fill(cv.cap(a, b, S['r'] + 0.3), f(bot), 'edge')
    else:
        for a, b in zip(pts, pts[1:]):
            cv.fill(cv.cap(a, b, S['r']), f(skin), 'edge')
        b = pts[1]
        L = math.hypot(b[0] - hip[0], b[1] - hip[1]) or 1
        t = min(1.0, S['shortlen'] / L * (1.4 if knee else 1))
        cv.fill(cv.cap(hip, lerp(hip, b, t), S['r'] + 0.6), f(bot), 'edge')


def foot(cv, sp, p, view, far=False):
    sh = sp.get('shoe', P['sandal'])
    if far:
        sh = dark(sh)
    if view == 's' or view == 'n':
        cv.fill(cv.ell(p[0], p[1], ST['r'] + 0.6, 1.8), sh, 'edge')
    else:
        cv.fill(cv.ell(p[0] - 1, p[1], ST['r'] + 1.4, 1.8), sh, 'edge')


def hand(cv, sp, p, far=False):
    h = ST['hand']
    sk = SKIN[sp['skin']]
    cv.fill(cv.ell(p[0], p[1], h, h), dark(sk) if far else sk, 'ell', (p[0], p[1], h, h))


def arm(cv, sp, shoulder, hp, far=False, sleeve_t=None):
    top = sleeve_ramp(sp)
    sk = SKIN[sp['skin']]
    f = dark if far else (lambda r: r)
    cv.fill(cv.cap(shoulder, hp, ST['r']), f(sk), 'edge')
    t = sleeve_t if sleeve_t is not None else (0.85 if sp.get('sleeve') == 'long' else 0.28)
    if sp.get('sleeve') != 'none':
        cv.fill(cv.cap(shoulder, lerp(shoulder, hp, t), ST['r'] + 0.45), f(top), 'edge')


def sleeve_ramp(sp):
    return sp.get('sleeve_ramp') or (sp.get('inner') if sp['top_kind'] in ('vest', 'hivis') else sp['top'])


def torso_mask(cv, cx, ty, hip, view, tw=None, lean=0.0):
    tw = tw or (ST['tw'] if view in ('s', 'n') else ST['tw'] * 0.72)
    return cv.poly([(cx - tw / 2, ty + 1), (cx - tw / 2 + 1, ty), (cx + tw / 2 - 1, ty), (cx + tw / 2, ty + 1),
                    (cx + lean + tw / 2 - (0.5 if view in ('s', 'n') else 0), hip + 1),
                    (cx + lean - tw / 2 + (0.5 if view in ('s', 'n') else 0), hip + 1)])


def torso(cv, sp, view, cx, ty, hip, tw=None, lean=0.0, cut=None):
    """shirt / vest / coat + waistband. cut = optional extra clip (e.g. hide below a boat rim)"""
    top, bot = ramps(sp)
    kind = sp['top_kind']
    tm = torso_mask(cv, cx, ty, hip, view, tw, lean)
    if cut is not None:
        tm &= cut
    tw_ = tw or (ST['tw'] if view in ('s', 'n') else ST['tw'] * 0.72)
    long_coat = kind == 'coat'
    upper = tm & (cv.Y < hip - 1)
    lower = tm & (cv.Y >= hip - 1)
    if sp['bottom'] != 'skirt' and not long_coat:
        cv.fill(lower, bot, 'edge', contour=False)
    if kind in ('tee', 'wrap'):
        cv.fill(upper, top, 'edge', pattern=top_pattern(sp, cx, ty), sh=(1, 0))
    else:
        inner = sp['inner']
        if long_coat:
            upper = tm | (torso_mask(cv, cx, hip - 2, hip + 4, view, tw_ + 1, lean) & (cut if cut is not None else True))
        if view == 's':
            cv.fill(upper, inner, 'edge', pattern=top_pattern(sp, cx, ty, sp.get('inner_pat')), sh=(1, 0))
            panel = upper & (np.abs(cv.X - (cx + lean * 0.5)) >= (2.0 if kind != 'coat' else 2.5))
        elif view == 'w':
            cv.fill(upper, inner, 'edge', sh=(1, 0))
            panel = upper & (cv.X >= cx - tw_ / 2 + 1.0)
        else:
            panel = upper
        if kind == 'hivis':
            tape = lambda x, y, t: P['tape']['base'] if (y - int(ty)) in (6, 9) else None
            cv.fill(panel, top, 'edge', pattern=tape, sh=(1, 0))
        else:
            cv.fill(panel, top, 'edge', pattern=top_pattern(sp, cx, ty), sh=(1, 0))
    if sp.get('belt') and not long_coat and sp['bottom'] != 'skirt':
        cv.fill(tm & (cv.Y >= hip - 2) & (cv.Y < hip - 1), P['indigo'], 'flat', pattern=woven, contour=False)


def details_front(cv, sp, cx, ty):
    acc = sp.get('acc', [])
    if 'beads' in acc:
        offs = [4, 5, 6, 6, 6, 6, 5, 4]
        for i, o in enumerate(offs):
            cv.px(cx - 4 + i, ty + o, BEADS[i % 4])
    if 'backpack' in acc:
        pk = sp.get('pack', P['wood'])
        for sgn in (-1, 1):
            for y in range(int(ty + 3), int(ty + 9)):
                cv.px(cx + sgn * 4 - (1 if sgn > 0 else 0), y, pk['sh'])
    if 'lanyard' in acc:
        for t in range(5):
            cv.px(cx - 3 + t * 0.5, ty + 4 + t, P['indigo']['base'])
            cv.px(cx + 2 - t * 0.5, ty + 4 + t, P['indigo']['base'])
        cv.fill(cv.rect(cx - 2, ty + 9, cx + 1, ty + 12), P['paper'], 'flat')
        cv.px(cx - 1, ty + 10, P['indigo']['base'])
    if 'camera' in acc:
        for t in range(4):
            cv.px(cx - 5 + t, ty + 3 + t, P['ink']['base'])
            cv.px(cx + 4 - t, ty + 3 + t, P['ink']['base'])
        cv.fill(cv.rect(cx - 3, ty + 6, cx + 3, ty + 10), P['ink'], 'edge', hi=True)
        cv.fill(cv.ell(cx, ty + 8, 1.6, 1.6), R('#C8E8FF', '#8FB8D8', '#5A7FA0', '#22303C'), 'flat', contour=False)


def backpack_back(cv, sp, cx, ty):
    if 'backpack' not in sp.get('acc', []):
        return
    pk = sp.get('pack', P['wood'])
    cv.fill(cv.poly([(cx - 6, ty + 3), (cx - 5, ty + 1), (cx + 5, ty + 1), (cx + 6, ty + 3), (cx + 6, ty + 11), (cx - 6, ty + 11)]), pk, 'edge', hi=True)
    cv.fill(cv.rect(cx - 4, ty + 6, cx + 4, ty + 10), dark(pk), 'edge')


def backpack_side(cv, sp, cx, ty, tws):
    if 'backpack' not in sp.get('acc', []):
        return
    pk = sp.get('pack', P['wood'])
    x0 = cx + tws / 2 - 1.5
    cv.fill(cv.poly([(x0, ty + 2), (x0 + 4, ty + 2), (x0 + 5, ty + 4), (x0 + 5, ty + 11), (x0, ty + 11)]), pk, 'edge', hi=True)


# ----------------------------------------------------------------------------- held items
def item_before_hand(cv, sp, hp, view, gy, sgn=1):
    it = sp.get('item')
    if it == 'stick':
        cv.fill(cv.cap((hp[0] + sgn * 0.5, hp[1] - 6), (hp[0] + sgn * 0.5, gy + 0.5), 1.0), P['wood'], 'edge')
    elif it == 'paddle':
        x = hp[0] + sgn * 0.5
        cv.fill(cv.cap((x, hp[1] - 15), (x, gy - 8), 0.9), P['wood'], 'edge')
        bl = cv.ell(x, gy - 4.5, 2.6, 5.0)
        band = lambda xx, yy, t: (P['red']['base'] if (yy - int(gy - 9)) in (3, 4) else P['ink']['base'] if (yy - int(gy - 9)) == 6 else P['white']['base'] if (yy - int(gy - 9)) in (5, 7) else None)
        cv.fill(bl, P['wood'], 'edge', pattern=band)
    elif it == 'basket':
        bx, by = hp[0] - sgn * 0.5, hp[1] + 2
        for lx, ly in ((-2.2, -1.5), (1.8, -2.6), (0, -3.4)):
            cv.fill(cv.ell(bx + lx, by + ly, 2.4, 1.8), P['leaf'], 'ell', (bx + lx, by + ly, 2.4, 1.8))
        weave = lambda x, y, t: P['rattan']['sh'] if (x + y) % 3 == 0 else None
        cv.fill(cv.poly([(bx - 4.5, by - 0.5), (bx + 4.5, by - 0.5), (bx + 3.5, by + 6), (bx - 3.5, by + 6)]), P['rattan'], 'edge', pattern=weave)
    elif it == 'notebook' and view != 'n':
        cv.fill(cv.rect(hp[0] - 2, hp[1] - 1, hp[0] + 2, hp[1] + 4), R('#F2B866', '#D98E3A', '#B06A28', '#5A3010'), 'edge')


def clipboard(cv, x0, y0):
    cv.fill(cv.rect(x0, y0, x0 + 6, y0 + 8), P['wood'], 'edge')
    cv.fill(cv.rect(x0 + 1, y0 + 1.5, x0 + 5, y0 + 7), P['paper'], 'flat', contour=False)
    for k in (3, 5):
        cv.px(x0 + 2, y0 + k, P['indigo']['sh']); cv.px(x0 + 3, y0 + k, P['indigo']['sh'])
    cv.px(x0 + 2, y0, P['tape']['sh']); cv.px(x0 + 3, y0, P['tape']['sh'])


def rope(cv, cx, cy):
    rr = R('#F0D9A6', '#CFAF72', '#A88748', '#5A4220')
    cv.fill(cv.ring(cx, cy, 4.2, 4.8, 2.0), rr, 'edge', pattern=lambda x, y, t: rr['sh'] if (x + y) % 2 == 0 else None)


# ----------------------------------------------------------------------------- walk frames
def finish(cv):
    cv.clean()
    cv.outline()
    return cv.img()


def walk_frame(sp, view, f):
    cv = Cv(FW, FH)
    cx = FW / 2
    gy = GY
    S = ST
    bob = -1 if f in (0, 2) and f == 2 else 0
    hip = gy - S['leg'] - 1 + bob
    ty = hip - S['th']
    hy = ty - S['ry'] + 4
    if view in ('s', 'n'):
        _front_walk(cv, sp, view, f, cx, gy, hip, ty, hy)
    else:
        _side_walk(cv, sp, f, cx, gy, hip, ty, hy)
    return finish(cv)


def _front_walk(cv, sp, view, f, cx, gy, hip, ty, hy):
    S = ST
    tw = S['tw']
    lift = {1: -1, 3: 1}.get(f, 0)
    mir = 1 if view == 's' else -1
    if view == 's':
        back_hair(cv, sp, cx, hy, 's')
    lx = tw * 0.24
    if sp['bottom'] == 'skirt':
        for sgn in (-1, 1):
            foot(cv, sp, (cx + sgn * lx, gy - 0.5 - (1 if sgn == lift else 0)), 's')
        top = hip - 1
        sk = cv.poly([(cx - tw / 2 + 0.5, top), (cx + tw / 2 - 0.5, top), (cx + tw / 2 + 1.5, gy - 2), (cx - tw / 2 - 1.5, gy - 2)])
        cv.fill(sk, sp['bot'], 'edge', pattern=skirt_pattern(sp, top), sh=(1, 0))
    else:
        for sgn in (-1, 1):
            fy = gy - 1.5 - (2 if sgn == lift else 0)
            leg(cv, sp, (cx + sgn * lx, hip), (cx + sgn * lx, fy))
            foot(cv, sp, (cx + sgn * lx, fy + 1), 's')
    torso(cv, sp, view, cx, ty, hip)
    if sp.get('top_kind') == 'coat' and sp['bottom'] == 'skirt':
        pass
    if view == 's':
        details_front(cv, sp, cx, ty)
    else:
        backpack_back(cv, sp, cx, ty)
    it = sp.get('item')
    for sgn in (-1, 1):
        sh = (cx + sgn * (tw / 2 - 0.5), ty + 2)
        swing = 0 if not lift else (1 if sgn == lift else -1)
        hp = (cx + sgn * (tw / 2 + 2.4), ty + S['arm'] - 1 - swing)
        item_side = (sgn == mir) if it in ('stick', 'paddle', 'rope', 'clipboard') else (sgn == -mir)
        if it == 'clipboard' and item_side and view == 's':
            clipboard(cv, cx + 1, ty + 4)
            hp = (cx + tw / 2 + 0.8, ty + 8)
        arm(cv, sp, sh, hp, sleeve_t=None)
        if item_side and it not in ('clipboard', 'rope'):
            item_before_hand(cv, sp, hp, view, gy, sgn)
        hand(cv, sp, hp)
    head(cv, sp, cx, hy, view)
    if it == 'rope':
        rope(cv, cx + mir * (tw / 2 + 0.5), ty + 7)


def _side_walk(cv, sp, f, cx, gy, hip, ty, hy):
    S = ST
    tws = S['tw'] * 0.72
    stride = S['leg'] * 0.5
    swing = S['arm'] * 0.45
    back_hair(cv, sp, cx - 0.5, hy, 'w')
    backpack_side(cv, sp, cx, ty, tws)
    if f == 1:
        nf, ff, nh, fh = cx - stride, cx + stride, cx + swing, cx - swing
    elif f == 3:
        nf, ff, nh, fh = cx + stride, cx - stride, cx - swing, cx + swing
    else:
        nf, ff, nh, fh = cx - 1, cx + 1.5, cx + 1, cx - 0.5
    hipp = (cx + 0.5, hip)
    it = sp.get('item')
    # far arm + far leg
    fa = (cx + 1, ty + 2)
    fhp = (fh, ty + S['arm'] - 1)
    arm(cv, sp, fa, fhp, far=True)
    hand(cv, sp, fhp, far=True)
    skirt = sp['bottom'] == 'skirt'
    if skirt:
        foot(cv, sp, (ff, gy - 0.5), 'w', far=True)
        foot(cv, sp, (nf, gy - 0.5), 'w')
    else:
        leg(cv, sp, hipp, (ff, gy - 1.5), far=True)
        foot(cv, sp, (ff, gy - 0.5), 'w', far=True)
    torso(cv, sp, 'w', cx, ty, hip)
    if skirt:
        top = hip - 1
        sk = cv.poly([(cx - tws / 2, top), (cx + tws / 2, top), (cx + tws / 2 + 2.5, gy - 2), (cx - tws / 2 - 2.5, gy - 2)])
        cv.fill(sk, sp['bot'], 'edge', pattern=skirt_pattern(sp, top), sh=(1, 0))
    else:
        leg(cv, sp, hipp, (nf, gy - 1.5))
        foot(cv, sp, (nf, gy - 0.5), 'w')
    acc = sp.get('acc', [])
    if 'camera' in acc:
        cv.fill(cv.rect(cx - tws / 2 - 2, ty + 6, cx - tws / 2 + 2, ty + 10), P['ink'], 'edge', hi=True)
    if 'beads' in acc:
        for k in range(3):
            cv.px(cx - tws / 2 + 1 + k, ty + 4 + k * 0.5, BEADS[k])
    if 'lanyard' in acc:
        cv.fill(cv.rect(cx - tws / 2 - 0.5, ty + 8, cx - tws / 2 + 2, ty + 11), P['paper'], 'flat')
    na = (cx, ty + 2)
    nhp = (nh, ty + S['arm'] - 1)
    if it == 'clipboard':
        clipboard(cv, cx - tws / 2 - 4, ty + 4)
        nhp = (cx - tws / 2 - 0.5, ty + 8)
    arm(cv, sp, na, nhp)
    if it not in ('clipboard', 'rope'):
        item_before_hand(cv, sp, nhp, 'w', gy, 1 if it != 'basket' else -1)
    hand(cv, sp, nhp)
    if it == 'rope':
        rope(cv, cx + 2.5, ty + 7)
    head(cv, sp, cx - 0.5, hy, 'w')


def sheet(sp, frame_fn=walk_frame, fw=FW, fh=FH):
    img = Image.new('RGBA', (fw * 4, fh * 4), (0, 0, 0, 0))
    for row, view in enumerate(['s', 'w', 'n', 'e']):
        for col in range(4):
            v = 'w' if view == 'e' else view
            fr = frame_fn(sp, v, col)
            if view == 'e':
                fr = fr.transpose(Image.FLIP_LEFT_RIGHT)
            img.alpha_composite(fr, (col * fw, row * fh))
    return bleed(img)
