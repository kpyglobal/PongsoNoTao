"""方案二 歧路旅人風 figure renderer: 5-head, sel-out outline, 4-tone hue-shifted shading, cool right rim light.
Views: front 's', back 'n', side 'w' (facing screen-left; 'e' is its mirror)."""
import math
import colorsys
import numpy as np
from px16 import Cv, ramp, darker, hx
from cast import CAST, SKIN, HAIR

STYLE = 'octo'
GY = 90            # feet baseline inside a 96px-tall frame
H0, HEADS = 64, 5.0

C = dict(sandal='#7A5236', sole='#4A3426', bead1='#A8743F', bead2='#3C6FA8', bead3='#E9E1D0', strap='#3A3430',
         cam='#2E2C30', lens='#7FA8C8', eye='#2A1C24', iris='#5A3424', sclera='#F4EEE6',
         helmet='#F2C94C', helmet2='#7FD1C3', scooter='#8FD3C9', scooter2='#F4EEDF',
         tire='#2C2A30', rim='#B8BCC4', seat='#3A3036', lamp='#FFF3B0', paddle='#D29A5C', stick='#8C6542',
         hull='#F1EBDD', red='#C0392F', ink='#1F1D26', foam='#EAF7FB', rattan='#C79A5A', board='#9A6A40',
         paper='#F6F2E8', silver='#D9DEE6', card='#F4F2EE', book='#8A4B3A')


def grade(c):
    c = hx(c) if isinstance(c, str) else c
    h, s_, v = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
    r, g, b = colorsys.hsv_to_rgb(h, min(1, s_ * 0.92), v)
    return (int(r * 255), int(g * 255), int(b * 255), 255)


def RP(c):
    return ramp(grade(c), STYLE)


# front-view walk cycle: (left ankle dy, right ankle dy, left hand dy, right hand dy)
FWALK = [(1.5, -2.0, 1.0, -1.0), (0.0, -1.0, 0.0, 0.0), (-2.0, 1.5, -1.0, 1.0), (-1.0, 0.0, 0.0, 0.0)]


class Fig:
    def __init__(s, key):
        s.key = key
        s.r = CAST[key]
        s.rp = RP
        s.skin = RP(SKIN[s.r['skin']])
        s.hair = RP(HAIR[s.r['hair'][1]])
        H = H0 * (0.95 if s.r.get('elder') else 1.0)
        s.H, s.hh = H, H / HEADS
        s.f = s.r['sex'] == 'f'
        top = s.r['top']
        s.tee = RP(top['tee'])
        s.bot = RP(s.r['bottom']['col'])
        s.shoe = RP(s.r.get('shoe', C['sandal']))

    # ------------------------------------------------------------------ proportions
    def dims(s, breath=0, yoff=0.0):
        H, hh = s.H, s.hh
        top = GY - H + yoff
        d = dict(top=top, hh=hh)
        d['cy'] = top + hh * 0.53 - breath
        d['rx'], d['ry'] = hh * 0.40, hh * 0.47
        d['sy'] = top + hh * 1.18 - breath
        d['crotch'] = top + H * 0.53
        d['ankle'] = GY - max(1.5, hh * 0.12) + yoff
        d['hipj'] = d['crotch'] - hh * 0.22
        d['knee'] = d['hipj'] + (d['ankle'] - d['hipj']) * 0.5
        d['waist'] = top + hh * 1.18 + (d['crotch'] - top - hh * 1.18) * 0.62 - breath * 0.5
        if s.f:
            d.update(sw=hh * 0.70, ww=hh * 0.48, hw=hh * 0.68)
        else:
            d.update(sw=hh * 0.84, ww=hh * 0.58, hw=hh * 0.62)
        d['rt'], d['rs'] = hh * 0.25, hh * 0.19
        d['ra'], d['rf'] = hh * 0.19, hh * 0.16
        d['La'], d['Lf'] = hh * 0.70, hh * 0.64
        return d

    # ================================================================== FRONT / BACK
    def frontal(s, cv, cx, back=False, walk=None, breath=0, blink=False, legs=True, hands=None, yoff=0.0,
                before_arms=None, helmet=None, prop=True):
        d = s.dims(breath, yoff)
        hh = s.hh
        sy, crotch, waist, cy = d['sy'], d['crotch'], d['waist'], d['cy']
        kind = s.r['hair'][0]
        wk = FWALK[walk] if walk is not None else (0, 0, 0, 0)
        if back:  # mirror the gait so the swing reads as walking away
            wk = (wk[1], wk[0], wk[3], wk[2])
        # back hair masses that sit behind the body in the front view
        if not back and kind == 'long' and not helmet:
            m = cv.cap((cx, cy + 0.15 * hh), (cx, cy + 0.95 * hh), d['rx'] + 0.18 * hh, d['rx'] + 0.05 * hh)
            cv.fill(m, darker(s.hair), ('flat', 0.4))
        if not back and kind == 'wavylong' and not helmet:
            m = cv.cap((cx, cy + 0.15 * hh), (cx, cy + 0.6 * hh), d['rx'] + 0.2 * hh, d['rx'] + 0.14 * hh)
            cv.fill(m, s.hair, ('soft', cx - 0.2 * hh, cy, d['rx'] * 1.4, hh, 0.35), pattern=s._wave_pat())
        if legs:
            for sg, ady in ((-1, wk[0]), (1, wk[1])):
                hj = (cx + sg * 0.34 * hh, d['hipj'])
                kn = (cx + sg * 0.31 * hh, d['knee'] + ady * 0.5)
                an = (cx + sg * 0.29 * hh, d['ankle'] + ady)
                legc = s.bot if s.r['bottom']['kind'] == 'pants' else s.skin
                cv.fill(cv.cap(kn, an, d['rs'], d['rs'] * 0.8), legc, ('cyl', kn, an, d['rs']))
                cv.fill(cv.cap(hj, kn, d['rt'], d['rs']), legc, ('cyl', hj, kn, d['rt']))
                s.foot_front(cv, an[0], an[1] - d['ankle'] + yoff, d, back, lifted=ady < -0.5)
            s.bottoms_front(cv, cx, d, wk)
        # back: pack goes over the torso later; front: big pack peeks out at the sides
        if not back and s.r.get('bigpack'):
            pk = s.rp(s.r['pack'])
            m = cv.rect(cx - d['sw'] - 0.05 * hh, sy - 0.25 * hh, cx + d['sw'] + 0.05 * hh, waist + 0.25 * hh)
            cv.fill(m, darker(pk), ('flat', 0.4))
        s.torso_front(cv, cx, d, back)
        nk = cv.rect(cx - 0.17 * hh, cy + d['ry'] * 0.5, cx + 0.17 * hh, sy + 1.5)
        cv.fill(nk, s.skin, ('flat', 0.1 if not back else -0.05), contour=False)
        if not back:
            s.details_front(cv, cx, d)
        else:
            s.pack_back(cv, cx, d)
        if before_arms:
            before_arms(cv, d)
        for sg in (-1, 1):
            sh_ = (cx + sg * (d['sw'] - 0.20 * hh), sy + 0.24 * hh)
            if hands:
                wr = hands[0 if sg < 0 else 1]
                mid = ((sh_[0] + wr[0]) / 2 + sg * 0.25 * hh, (sh_[1] + wr[1]) / 2 + 0.1 * hh)
                el = mid
            else:
                hdy = wk[2] if sg < 0 else wk[3]
                el = (cx + sg * (d['sw'] + 0.02 * hh), waist - 0.15 * hh + hdy * 0.5)
                wr = (cx + sg * (d['sw'] - 0.04 * hh), crotch - 0.12 * hh + hdy)
            s.arm(cv, sh_, el, wr, d)
        if prop and s.r.get('prop') and not hands:
            s.prop_front(cv, cx, d, back, wk)
        s.head_frontal(cv, cx, cy, d, back, blink, helmet)
        return d

    def foot_front(s, cv, x, dy, d, back, lifted=False):
        hh = s.hh
        y = GY + dy
        if lifted:  # heel raised: shorter, thinner foot
            ry = 0.12 * hh + 0.3
        else:
            ry = 0.16 * hh + 0.4
        if s.r['shoes'] == 'sandal':
            f = cv.ell(x, y - 0.6, 0.30 * hh, ry)
            cv.fill(f & (cv.Y < y - 0.6), s.skin, ('ell', x - 0.2 * hh, y - 2, 0.4 * hh, 0.3 * hh))
            cv.fill(f & (cv.Y >= y - 0.6), s.rp(C['sole']), ('flat', 0.5), contour=False)
            if not back:
                cv.px(int(x), int(y - 2), s.rp(C['sandal'])['base'])
        else:
            f = cv.ell(x, y - 1.0, 0.31 * hh, ry + 0.2)
            cv.fill(f, s.shoe, ('ell', x - 0.2 * hh, y - 3, 0.4 * hh, 0.3 * hh))
            cv.fill(f & (cv.Y >= y - 0.5), s.rp('#F4F0E8' if s.shoe['base'][0] < 150 else '#8A7E70'), ('flat', 0.5), contour=False)

    def bottoms_front(s, cv, cx, d, wk):
        b = s.r['bottom']
        hh = s.hh
        if b['kind'] == 'shorts':
            for sg, ady in ((-1, wk[0]), (1, wk[1])):
                hj = (cx + sg * 0.34 * hh, d['hipj'])
                kn = (cx + sg * 0.33 * hh, d['hipj'] + (d['knee'] + ady * 0.5 - d['hipj']) * 0.62)
                cv.fill(cv.cap(hj, kn, d['rt'] + 0.6), s.bot, ('cyl', hj, kn, d['rt'] + 0.6))
        elif b['kind'] in ('skirt', 'longskirt'):
            ky = d['knee'] + 0.08 * hh if b['kind'] == 'skirt' else d['ankle'] - 0.42 * hh
            fl = 1.08 if b['kind'] == 'skirt' else 1.0
            pts = [(cx - d['hw'] * 0.95, d['waist'] + 1), (cx + d['hw'] * 0.95, d['waist'] + 1),
                   (cx + d['hw'] * fl, ky), (cx - d['hw'] * fl, ky)]
            hem = s.rp(b['hem'])

            def pat(x, y):
                return hem if ky - 2.2 < y + 0.5 <= ky - 1.0 else None
            cv.fill(cv.poly(pts), s.bot, ('ell', cx - 0.3 * hh, d['crotch'] - 0.2 * hh, d['hw'] * 1.6, hh * 1.4), pattern=pat)

    def _vest_pat(s, cx, d, gap, side=False, x0=0):
        top = s.r['top']
        s1, s2 = s.rp(top['stripe']), s.rp(top['stripe2'])
        sy = d['sy']
        if top.get('plain'):
            return None
        if top.get('taririk') or top.get('hband'):
            per = 5 if top.get('taririk') else 4

            def vpat(x, y):
                k = int(y - sy) % per
                if top.get('hband'):
                    return s1 if k == 1 else None
                return s1 if k == 2 else (s2 if k == 3 and (x % 2) else None)
            return vpat

        def vpat(x, y):
            k = (int(x - x0 + 40) if side else int(abs(x + 0.5 - cx) - gap)) % 4
            return s1 if k == 1 else (s2 if k == 2 and (y % 2) else None)
        return vpat

    def _hivis_pat(s, d):
        sv = s.rp(C['silver'])
        a0, a1 = d['sy'] + 0.62 * s.hh, d['waist'] + 0.05 * s.hh

        def p(x, y):
            yy = y + 0.5
            return sv if (a0 <= yy < a0 + 1.3) or (a1 <= yy < a1 + 1.3) else None
        return p

    def torso_front(s, cv, cx, d, back):
        hh = s.hh
        sy, waist, crotch = d['sy'], d['waist'], d['crotch']
        sw, ww, hw = d['sw'], d['ww'], d['hw']
        pts = [(cx - sw + 0.25 * hh, sy - 0.04 * hh), (cx + sw - 0.25 * hh, sy - 0.04 * hh),
               (cx + sw, sy + 0.22 * hh), (cx + sw - 0.08 * hh, sy + 0.55 * hh), (cx + ww, waist),
               (cx + hw, crotch - 0.25 * hh), (cx + hw * 0.6, crotch + 0.6), (cx - hw * 0.6, crotch + 0.6),
               (cx - hw, crotch - 0.25 * hh), (cx - ww, waist), (cx - sw + 0.08 * hh, sy + 0.55 * hh), (cx - sw, sy + 0.22 * hh)]
        body = cv.poly(pts)
        top = s.r['top']
        lit = ('ell', cx - 0.3 * hh, sy + 0.25 * hh, sw * 1.35, (crotch - sy) * 0.95)
        tee_bot = waist + 0.30 * hh if top['kind'] != 'shirt' else waist + 0.25 * hh
        pat = None
        if top.get('band'):
            b1, b2 = s.rp(top['band'][0]), s.rp(top['band'][1])
            by = sy + 0.42 * hh

            def pat(x, y):
                yy = y + 0.5
                if by <= yy < by + 1 or by + 2.2 <= yy < by + 3.2:
                    return b2
                if by + 1 <= yy < by + 2.2:
                    return b1 if (x % 3) else b2
                return None
        elif top.get('hstripe'):
            hs = s.rp(top['hstripe'])

            def pat(x, y):
                return hs if int(y - sy) % 4 == 2 else None
        cv.fill(body & (cv.Y < tee_bot), s.tee, lit, pattern=pat)
        cv.fill(body & (cv.Y >= tee_bot), s.bot, ('ell', cx - 0.3 * hh, crotch - 0.3 * hh, hw * 1.4, hh * 0.6))
        k = top['kind']
        if k in ('vest', 'shirt', 'hivis', 'coat'):
            gap = {'vest': 0.20, 'shirt': 0.26, 'hivis': 0.16, 'coat': 0.18}[k] * hh
            if back:
                gap = -99
            if k == 'vest':
                vr, vpat, vb = s.rp(top['vest']), s._vest_pat(cx, d, gap), waist + 0.22 * hh
            elif k == 'hivis':
                vr, vpat, vb = s.rp(top['vest']), s._hivis_pat(d), waist + 0.28 * hh
            elif k == 'coat':
                vr, vpat, vb = s.rp(top['coat']), None, d['knee'] - 0.1 * hh
            else:
                vr, vpat, vb = s.rp(top['shirt']), (s._floral_pat() if top.get('floral') else None), waist + 0.55 * hh
            wb = ww + 0.12 * hh if k != 'coat' else hw + 0.12 * hh
            pts2 = [(cx - sw + 0.2 * hh, sy - 0.05 * hh), (cx + sw - 0.2 * hh, sy - 0.05 * hh), (cx + sw + 0.05 * hh, sy + 0.25 * hh),
                    (cx + sw - 0.05 * hh, sy + 0.6 * hh), (cx + wb, vb), (cx - wb, vb),
                    (cx - sw + 0.05 * hh, sy + 0.6 * hh), (cx - sw - 0.05 * hh, sy + 0.25 * hh)]
            open_ = np.abs(cv.X - cx) > gap + np.clip((sy + 0.5 * hh - cv.Y) * 0.25, 0, 99) + np.clip((cv.Y - waist) * 0.12, 0, 99) * (k == 'coat')
            cv.fill(cv.poly(pts2) & open_, vr, lit, pattern=vpat)

    def details_front(s, cv, cx, d):
        hh = s.hh
        sy, waist = d['sy'], d['waist']
        if s.r.get('beads'):
            cols = [C['bead1'], C['bead2'], C['bead3']]
            for i in range(-4, 5):
                t = i / 4.2
                cv.px(int(cx + t * 0.36 * hh), int(sy + 0.10 * hh + (1 - t * t) * 0.32 * hh), hx(cols[(i + 4) % 3]))
        if s.r.get('lanyard'):
            for t in np.linspace(0, 1, 8):
                cv.px(int(cx - 0.3 * hh + t * 0.3 * hh), int(sy + t * 0.55 * hh), hx('#3C6FA8'))
                cv.px(int(cx + 0.3 * hh - t * 0.3 * hh), int(sy + t * 0.55 * hh), hx('#3C6FA8'))
            cv.fill(cv.rect(cx - 1.5, sy + 0.55 * hh, cx + 1.5, sy + 0.55 * hh + 3), s.rp(C['card']), ('flat', 0.6))
        if s.r.get('pack'):
            st = s.rp(C['strap'])
            for sg in (-1, 1):
                x = int(cx + sg * 0.52 * hh - (1 if sg < 0 else 0))
                for y in range(int(sy), int(waist + 0.1 * hh)):
                    cv.px(x, y, st['base'] if sg < 0 else st['sh'])
        if s.r.get('camera'):
            x0, y0 = cx - 0.5 * hh, sy + 0.05 * hh
            x1, y1 = cx + 0.35 * hh, waist - 0.05 * hh
            for t in np.linspace(0, 1, 24):
                cv.px(int(x0 + (x1 - x0) * t), int(y0 + (y1 - y0) * t), hx(C['strap']))
            cv.fill(cv.rect(x1 - 1.5, y1 - 1, x1 + 2.5, y1 + 2.2), s.rp(C['cam']), ('flat', 0.5))
            cv.px(int(x1), int(y1), hx(C['lens']))

    def pack_back(s, cv, cx, d):
        if not s.r.get('pack'):
            return
        hh = s.hh
        pk = s.rp(s.r['pack'])
        y0 = d['sy'] + 0.05 * hh - (0.35 * hh if s.r.get('bigpack') else 0)
        y1 = d['waist'] + (0.45 if s.r.get('bigpack') else 0.2) * hh
        w = 0.58 * hh if s.r.get('bigpack') else 0.5 * hh
        m = cv.rect(cx - w, y0, cx + w, y1) & ~(cv.rect(cx - w, y0, cx - w + 1, y0 + 1) | cv.rect(cx + w - 1, y0, cx + w, y0 + 1))
        cv.fill(m, pk, ('ell', cx - 0.3 * hh, y0 + 0.3 * hh, w * 1.6, (y1 - y0) * 1.1))
        fl = cv.rect(cx - w * 0.7, y0 + (y1 - y0) * 0.45, cx + w * 0.7, y1 - 1)
        cv.fill(fl, darker(pk), ('flat', 0.5))
        cv.fill(cv.rect(cx - w + 1, y0 + 1, cx + w - 1, y0 + 2), RP(C['strap']), ('flat', 0.5), contour=False)

    def arm(s, cv, sh_, el, wr, d, far=False):
        hh = s.hh
        skin = darker(s.skin) if far else s.skin
        top = s.r['top']
        cv.fill(cv.cap(sh_, el, d['ra'], d['rf']), skin, ('cyl', sh_, el, d['ra']))
        cv.fill(cv.cap(el, wr, d['rf'], d['rf'] * 0.9), skin, ('cyl', el, wr, d['rf']))
        hand = cv.ell(wr[0] + (wr[0] - el[0]) * 0.18, wr[1] + 0.12 * hh, d['rf'] + 0.45, d['rf'] + 0.7)
        cv.fill(hand, skin, ('ell', wr[0] - 0.2 * hh, wr[1], 0.4 * hh, 0.4 * hh))
        if top['kind'] in ('shirt', 'coat'):
            sl = s.rp(top['shirt' if top['kind'] == 'shirt' else 'coat'])
            sl = darker(sl) if far else sl
            f_ = 1.12 if top['kind'] == 'shirt' else 1.0
            if top['kind'] == 'coat':  # long sleeve to the wrist
                cv.fill(cv.cap(sh_, el, d['ra'] + 0.6, d['rf'] + 0.6), sl, ('cyl', sh_, el, d['ra'] + 0.6))
                w2 = (el[0] + (wr[0] - el[0]) * 0.85, el[1] + (wr[1] - el[1]) * 0.85)
                cv.fill(cv.cap(el, w2, d['rf'] + 0.6), sl, ('cyl', el, w2, d['rf'] + 0.6))
            else:
                e2 = (sh_[0] + (el[0] - sh_[0]) * f_, sh_[1] + (el[1] - sh_[1]) * f_)
                cv.fill(cv.cap(sh_, e2, d['ra'] + 0.7, d['rf'] + 0.9), sl, ('cyl', sh_, e2, d['ra'] + 0.7),
                        pattern=s._floral_pat() if top.get('floral') and not far else None)
        else:
            sl = darker(s.tee) if far else s.tee
            e2 = (sh_[0] + (el[0] - sh_[0]) * 0.40, sh_[1] + (el[1] - sh_[1]) * 0.40)
            s0 = (sh_[0] + (el[0] - sh_[0]) * -0.05, sh_[1] + (el[1] - sh_[1]) * -0.05)
            cv.fill(cv.cap(s0, e2, d['ra'] + 0.45, d['ra'] + 0.55), sl, ('cyl', s0, e2, d['ra'] + 0.5))

    def prop_front(s, cv, cx, d, back, wk):
        p = s.r['prop']
        hh = s.hh
        sg = -1 if back else 1           # the character's right hand
        hx_ = cx + sg * (d['sw'] - 0.04 * hh)
        hy = d['crotch'] - 0.12 * hh + (wk[2] if back else wk[3]) + 0.15 * hh
        if p == 'stick':
            x = cx + sg * (d['sw'] + 0.1 * hh) - (1 if sg < 0 else 0)
            rp = s.rp(C['stick'])
            cv.fill(cv.rect(x - 0.2, hy - 0.4 * hh, x + 1.3, GY + 0.5), rp, ('cyl', (x + 0.5, 0), (x + 0.5, 96), 1.0))
            cv.fill(cv.ell(x + 0.5, hy - 0.4 * hh, 1.6, 1.1), rp, ('flat', 0.9))
            # hand closes over the stick again
            cv.fill(cv.ell(hx_ + sg * 0.6, hy, d['rf'] + 0.45, d['rf'] + 0.6), s.skin, ('ell', hx_ - 2, hy - 2, 4, 4))
        elif p == 'basket':
            rr = s.rp(C['rattan'])
            bx, by = hx_ + sg * 0.25 * hh, hy + 0.35 * hh
            m = cv.ell(bx, by + 0.15 * hh, 0.42 * hh, 0.36 * hh) & (cv.Y > by - 0.1 * hh)

            def wv(x, y):
                return darker(rr) if (x + y) % 3 == 0 else None
            cv.fill(m, rr, ('ell', bx - 2, by - 1, 0.5 * hh, 0.5 * hh), pattern=wv)
            cv.fill(cv.ell(bx, by - 0.1 * hh, 0.42 * hh, 0.1 * hh + 0.5), darker(rr), ('flat', 0.4))
            handle = cv.ell(bx, by - 0.12 * hh, 0.3 * hh, 0.4 * hh) & ~cv.ell(bx, by - 0.12 * hh, 0.3 * hh - 1, 0.4 * hh - 1) & (cv.Y < by - 0.12 * hh)
            cv.fill(handle, rr, ('flat', 0.4), contour=False)
            cv.fill(cv.ell(hx_, hy - 0.05 * hh, d['rf'] + 0.45, d['rf'] + 0.6), s.skin, ('ell', hx_ - 2, hy - 2, 4, 4))
        elif p in ('clipboard', 'notebook'):
            if p == 'clipboard':
                m = cv.rect(hx_ - 2.5 + sg * 1.5, hy - 0.55 * hh, hx_ + 2.5 + sg * 1.5, hy + 0.25 * hh)
                cv.fill(m, s.rp(C['board']), ('flat', 0.4))
                if not back:
                    cv.fill(m & cv.rect(hx_ - 1.5 + sg * 1.5, hy - 0.45 * hh, hx_ + 1.5 + sg * 1.5, hy + 0.15 * hh), s.rp(C['paper']), ('flat', 0.6), contour=False)
            else:
                m = cv.rect(hx_ - 2 + sg * 1.2, hy - 0.4 * hh, hx_ + 2 + sg * 1.2, hy + 0.2 * hh)
                cv.fill(m, s.rp(C['book']), ('flat', 0.5))
            cv.fill(cv.ell(hx_, hy, d['rf'] + 0.45, d['rf'] + 0.6), s.skin, ('ell', hx_ - 2, hy - 2, 4, 4))

    # ------------------------------------------------------------------ heads (front / back)
    def head_frontal(s, cv, cx, cy, d, back, blink, helmet=None):
        hh, rx, ry = s.hh, d['rx'], d['ry']
        kind = s.r['hair'][0]
        if helmet and kind in ('spiky', 'puff', 'bun', 'wavy'):
            kind = 'short'
        if helmet and kind == 'wavylong':
            kind = 'bob'
        X, Y = cv.X, cv.Y
        if back and not helmet:
            if kind == 'ponytail':
                pass
            if kind == 'long':  # long hair falls over the upper back
                m = cv.cap((cx, cy), (cx, cy + 1.05 * hh), rx + 0.16 * hh, rx + 0.02 * hh)
                cv.fill(m, s.hair, ('soft', cx - 0.2 * hh, cy, rx * 1.4, hh, 0.35))
            if kind == 'wavylong':  # shoulder-length waves over the nape
                m = cv.cap((cx, cy), (cx, cy + 0.78 * hh), rx + 0.2 * hh, rx + 0.14 * hh)
                m &= cv.Y < cy + 0.78 * hh - ((np.floor(cv.X) % 4) < 2) * 1.0
                cv.fill(m, s.hair, ('soft', cx - 0.2 * hh, cy, rx * 1.4, hh, 0.35), pattern=s._wave_pat())
        for sg in (-1, 1):
            cv.fill(cv.ell(cx + sg * (rx + 0.02 * hh), cy + 0.08 * hh, max(1.0, 0.11 * hh), 0.15 * hh), s.skin,
                    ('ell', cx + sg * rx, cy, 0.3 * hh, 0.3 * hh))
        face = cv.ell(cx, cy, rx, ry) | cv.ell(cx, cy + ry * 0.35, rx * 0.86, ry * 0.68)
        cv.fill(face, s.skin, ('soft', cx - 0.05 * hh, cy - 0.05 * hh, rx, ry, 0.30))
        if not back:
            s.face_front(cv, cx, cy, d, blink)
        s.hair_frontal(cv, cx, cy, d, kind, back, helmet)
        if helmet:
            s.helmet_frontal(cv, cx, cy, d, helmet, back)
        elif s.r.get('hat'):
            s.hat_frontal(cv, cx, cy, d, back)

    def face_front(s, cv, cx, cy, d, blink=False):
        hh, rx = s.hh, d['rx']
        ey = int(math.floor(cy + 0.08 * hh))
        dd = max(2, int(round(rx * 0.42)))
        icx = int(round(cx))
        L, Rr = icx - dd - 1, icx + dd
        eye = hx(C['eye'])
        elder = s.r.get('elder')
        browc = s.hair['line'] if not elder else s.hair['deep']
        for x, w in ((L, -1), (Rr, 1)):
            if blink:
                cv.px(x, ey + 1, s.skin['deep'] if elder else eye)
                cv.px(x + w, ey + 1, s.skin['sh'])
            else:
                cv.px(x, ey, eye); cv.px(x, ey + 1, s.skin['deep'] if elder else hx(C['iris']))
                if not elder:
                    cv.px(x + w, ey + 1, hx(C['sclera']))
                cv.px(x + w, ey, s.skin['sh'])
        if s.f and not elder and not blink:
            cv.px(L - 2, ey, eye); cv.px(Rr + 2, ey, eye)
        for x in (L - 1, L, Rr, Rr + 1):
            cv.px(x, ey - 2, browc)
        cv.px(icx, ey + 2, s.skin['sh'])
        if elder:
            cv.px(icx - 1, ey - 3, s.skin['sh']); cv.px(icx, ey - 3, s.skin['sh'])
        my = int(round(cy + 0.25 * hh))
        cv.px(icx - 1, my, s.skin['sh']); cv.px(icx, my, s.skin['deep'])

    def hair_frontal(s, cv, cx, cy, d, kind, back, helmet):
        hh, rx, ry = s.hh, d['rx'], d['ry']
        X, Y = cv.X, cv.Y
        sh = ('ell', cx - 0.25 * hh, cy - 0.45 * hh, rx * 1.4, ry * 1.2)
        big = cv.ell(cx, cy - 0.10 * hh, rx + 0.10 * hh, ry * 0.92 + 0.05 * hh)
        hl = cy - 0.22 * hh
        if back:
            nape = {'elder': cy + 0.12, 'short': cy + 0.30, 'spiky': cy + 0.32, 'bun': cy + 0.2,
                    'bob': cy + 0.55, 'long': cy + 0.6, 'ponytail': cy + 0.25, 'puff': cy + 0.35,
                    'wavy': cy + 0.40, 'wavylong': cy + 0.6}[kind]
            m = (big | cv.ell(cx, cy, rx + 0.06 * hh, ry + 0.02 * hh)) & (Y < cy + (nape - cy) * hh)
            if kind == 'spiky':
                for k in (-1, 0, 1):
                    tx = cx + k * rx * 0.6
                    m |= cv.poly([(tx - 2.4, cy - 0.52 * hh), (tx + 0.6 + k * 1.6, cy - 0.74 * hh), (tx + 2.4, cy - 0.50 * hh)])
            if kind == 'bob':
                m |= cv.rect(cx - rx - 0.14 * hh, cy - 0.1 * hh, cx + rx + 0.14 * hh, cy + 0.5 * hh) & cv.ell(cx, cy + 0.1 * hh, rx + 0.16 * hh, ry + 0.1 * hh)
            if kind == 'puff':
                m |= cv.ell(cx, cy - 0.22 * hh, rx + 0.24 * hh, ry * 0.9)
            if helmet:
                m &= Y > cy - 0.1 * hh
            cv.fill(m, s.hair, ('soft', cx - 0.2 * hh, cy - 0.3 * hh, rx * 1.4, ry * 1.2, 0.35),
                    pattern=s._wave_pat() if kind in ('wavy', 'wavylong') else None)
            if kind == 'ponytail' and not helmet:
                pt = cv.cap((cx, cy - 0.15 * hh), (cx + 0.5, cy + 0.85 * hh), 0.22 * hh, 0.13 * hh)
                cv.fill(pt, s.hair, ('cyl', (cx, cy), (cx, cy + hh), 0.22 * hh))
            if kind in ('bun', 'puff') and not helmet and not s.r.get('hat'):
                r_ = 0.24 * hh if kind == 'bun' else 0.34 * hh
                cv.fill(cv.ell(cx, cy - 0.5 * hh, r_, r_ * 0.85), s.hair, ('ell', cx - 1, cy - 0.6 * hh, r_ * 1.3, r_ * 1.3))
            if kind == 'wavy':
                m |= cv.ell(cx, cy - 0.16 * hh, rx + 0.16 * hh, ry * 0.95) & (Y < cy + 0.36 * hh - ((np.floor(X) % 3) == 1) * 1.0)
            if s.r.get('elder') or kind in ('short', 'spiky'):
                for i in range(-1, 2):
                    cv.px(int(cx + i * 2), int(cy + (nape - cy) * hh) - 1, s.hair['sh'])
            return
        if kind == 'spiky':
            jag = ((np.floor(X) % 3) == 1) * 1.6
            m = big & (Y < hl + jag)
            m |= big & (np.abs(X - cx) > rx * 0.86) & (Y < cy + 0.04 * hh)
            for k in (-1, 0, 1):
                tx = cx + k * rx * 0.6
                m |= cv.poly([(tx - 2.4, cy - 0.52 * hh), (tx + 0.6 + k * 1.6, cy - 0.74 * hh), (tx + 2.4, cy - 0.50 * hh)])
            cv.fill(m, s.hair, sh)
        elif kind in ('short', 'ponytail'):
            m = big & (Y < hl + ((X - cx) > 0) * 0.8)
            m |= big & (np.abs(X - cx) > rx * 0.86) & (Y < cy + 0.06 * hh)
            if kind == 'ponytail':
                m |= big & (Y < hl + 1.6) & (X < cx - 0.5)
            cv.fill(m, s.hair, sh)
        elif kind == 'bob':
            m = big & (Y < hl + 0.8)
            for sg in (-1, 1):
                m |= cv.cap((cx + sg * (rx + 0.10 * hh), cy - 0.1 * hh), (cx + sg * (rx + 0.14 * hh), cy + 0.42 * hh), 0.18 * hh, 0.17 * hh)
            m |= big & (np.abs(X - cx) > rx * 0.84) & (Y < cy + 0.42 * hh)
            cv.fill(m, s.hair, sh)
        elif kind == 'long':
            m = big & (Y < hl + np.clip((cx - X) * 0.35, 0, 2.5))
            for sg in (-1, 1):
                m |= cv.cap((cx + sg * (rx + 0.06 * hh), cy - 0.1 * hh), (cx + sg * (rx + 0.16 * hh), cy + 0.80 * hh), 0.22 * hh, 0.17 * hh)
            m |= big & (np.abs(X - cx) > rx * 0.86) & (Y < cy + 0.3 * hh)
            cv.fill(m, s.hair, sh)
            for i in range(3):
                cv.px(int(cx - rx * 0.6) + i, int(cy - 0.44 * hh) + (1 if i == 2 else 0), s.hair['hi'])
        elif kind in ('elder', 'bun'):
            m = big & (Y < hl - 0.08 * hh)
            m |= big & (np.abs(X - cx) > rx * 0.82) & (Y < cy + 0.04 * hh)
            cv.fill(m, s.hair, sh)
            if kind == 'bun' and not s.r.get('hat') and not helmet:
                cv.fill(cv.ell(cx, cy - 0.62 * hh, 0.22 * hh, 0.17 * hh), s.hair, ('ell', cx - 1, cy - 0.7 * hh, 0.3 * hh, 0.3 * hh))
        elif kind == 'wavy':  # medium-short, tousled waves with a soft fringe
            vol = cv.ell(cx, cy - 0.16 * hh, rx + 0.16 * hh, ry * 0.95 + 0.06 * hh)
            wave = ((np.floor(X) % 4) < 2) * 1.2 + ((np.floor(X) % 4) == 2) * 0.5
            m = vol & (Y < hl + 0.4 + wave)
            m |= vol & (np.abs(X - cx) > rx * 0.84) & (Y < cy + 0.16 * hh)
            for k in (-1, 0, 1):  # tufts breaking the crown outline
                tx = cx + k * rx * 0.62
                m |= cv.ell(tx + k * 0.6, cy - (0.60 if k == 0 else 0.54) * hh, 0.15 * hh, 0.11 * hh)
            cv.fill(m, s.hair, sh, pattern=s._wave_pat())
            for i in range(2):
                cv.px(int(cx - rx * 0.5) + i, int(cy - 0.46 * hh), s.hair['hi'])
        elif kind == 'wavylong':  # shoulder-length waves framing the face
            m = big & (Y < hl + np.clip((cx - X) * 0.3, 0, 2.0) + ((np.floor(X) % 3) == 0) * 0.8)
            m |= big & (np.abs(X - cx) > rx * 0.86) & (Y < cy + 0.3 * hh)
            cur = np.zeros_like(m)
            for sg in (-1, 1):
                cur |= cv.cap((cx + sg * (rx + 0.06 * hh), cy - 0.1 * hh), (cx + sg * (rx + 0.20 * hh), cy + 0.58 * hh), 0.19 * hh, 0.17 * hh)
            cur &= Y < cy + 0.62 * hh - ((np.floor(X) % 3) == 1) * 1.2  # wavy ends
            cv.fill(cur & ~m, s.hair, ('soft', cx - 0.3 * hh, cy - 0.1 * hh, rx * 2.2, hh, 0.35), pattern=s._wave_pat())
            cv.fill(m, s.hair, sh, pattern=s._wave_pat())
            for i in range(3):
                cv.px(int(cx - rx * 0.6) + i, int(cy - 0.44 * hh) + (1 if i == 2 else 0), s.hair['hi'])
        elif kind == 'puff':  # soft curly volume + top puff
            vol = cv.ell(cx, cy - 0.2 * hh, rx + 0.24 * hh, ry * 0.92)
            m = vol & ((Y < hl + ((np.floor(X) % 2) == 0) * 1.0) | (np.abs(X - cx) > rx * 0.88)) & (Y < cy + 0.25 * hh)
            if not helmet:
                m |= cv.ell(cx, cy - 0.72 * hh, 0.30 * hh, 0.24 * hh)

            def curl(x, y):
                return darker(s.hair) if (x * 3 + y * 5) % 7 == 0 else None
            cv.fill(m, s.hair, sh, pattern=curl)

    def _wave_pat(s):
        dk = darker(s.hair)

        def wv(x, y):  # sparse diagonal strands read as waves at 1px
            return dk if (x * 2 + y * 3) % 7 == 0 and (y % 3) else None
        return wv

    def _floral_pat(s):
        top = s.r['top']
        a, b = s.rp(top['floral'][0]), s.rp(top['floral'][1])

        def fp(x, y):
            if (x * 3 + y * 5) % 7 == 0:
                return a
            if (x * 5 + y * 2) % 9 == 4:
                return b
            return None
        return fp

    def hat_frontal(s, cv, cx, cy, d, back):
        kind, col = s.r['hat']
        rp = s.rp(col)
        hh, rx, ry = s.hh, d['rx'], d['ry']
        X, Y = cv.X, cv.Y
        if kind == 'bucket':
            dome = cv.ell(cx, cy - 0.42 * hh, rx * 0.98, 0.36 * hh) & (Y < cy - 0.24 * hh)
            cv.fill(dome, rp, ('ell', cx - 0.2 * hh, cy - 0.6 * hh, rx * 1.2, 0.5 * hh))
            brim = cv.ell(cx, cy - 0.24 * hh, rx + 0.32 * hh, 0.12 * hh + 0.6)
            cv.fill(brim, rp, ('ell', cx - 0.2 * hh, cy - 0.35 * hh, rx * 1.6, 0.3 * hh))
            cv.fill(cv.rect(cx - rx, cy - 0.36 * hh, cx + rx, cy - 0.30 * hh + 0.8) & dome, darker(rp), ('flat', 0.5), contour=False)
        elif kind == 'sunhat':
            dome = cv.ell(cx, cy - 0.40 * hh, rx * 0.96, 0.32 * hh) & (Y < cy - 0.24 * hh)
            cv.fill(dome, rp, ('ell', cx - 0.2 * hh, cy - 0.6 * hh, rx * 1.2, 0.5 * hh))
            brim = cv.ell(cx, cy - 0.25 * hh, rx + 0.55 * hh, 0.13 * hh + 0.6)
            cv.fill(brim, rp, ('ell', cx - 0.3 * hh, cy - 0.4 * hh, rx * 2.0, 0.3 * hh))
            cv.fill(cv.rect(cx - rx, cy - 0.36 * hh, cx + rx, cy - 0.30 * hh + 0.8) & dome, s.rp('#7A4E3A'), ('flat', 0.5), contour=False)
        elif kind == 'cap':
            dome = cv.ell(cx, cy - 0.30 * hh, rx + 0.08 * hh, 0.36 * hh) & (Y < cy - 0.16 * hh)
            cv.fill(dome, rp, ('ell', cx - 0.2 * hh, cy - 0.5 * hh, rx * 1.2, 0.5 * hh))
            if not back:
                brim = cv.ell(cx, cy - 0.16 * hh, rx * 0.95, 0.09 * hh + 0.6) & (Y > cy - 0.2 * hh)
                cv.fill(brim, darker(rp), ('flat', 0.5))
            else:
                cv.fill(cv.rect(cx - 1.5, cy - 0.22 * hh, cx + 1.5, cy - 0.12 * hh), darker(rp), ('flat', 0.5), contour=False)
            cv.px(int(cx), int(cy - 0.6 * hh), rp['hi'])
        elif kind == 'headband':
            w_ = s.rp('#EDE3CE'); k_ = s.rp('#22202A')
            y0 = cy - 0.30 * hh

            def bp(x, y):
                yy = y + 0.5 - y0
                return w_ if yy < 1 else (rp if yy < 2 else k_) if (x % 3) else w_
            m = cv.rect(cx - rx - 0.12 * hh, y0, cx + rx + 0.12 * hh, y0 + 2.6) & cv.ell(cx, cy - 0.1 * hh, rx + 0.16 * hh, ry + 0.1 * hh)
            cv.fill(m, rp, ('flat', 0.5), pattern=bp)
            if back:  # knot tails
                cv.fill(cv.cap((cx, y0 + 1.5), (cx + 1.5, y0 + 0.45 * hh), 0.9), rp, ('flat', 0.5))
        elif kind == 'scarf':
            dots = s.rp('#EDE3CE')

            def dp(x, y):
                return dots if (x % 4 == 1 and y % 3 == 0) else None
            m = cv.ell(cx, cy - 0.16 * hh, rx + 0.16 * hh, ry * 0.92 + 0.06 * hh) & (Y < cy - 0.12 * hh)
            cv.fill(m, rp, ('soft', cx - 0.2 * hh, cy - 0.5 * hh, rx * 1.4, ry * 1.2, 0.4), pattern=dp)
            if back:
                cv.fill(cv.cap((cx - 1, cy - 0.1 * hh), (cx + 1, cy + 0.3 * hh), 1.4), rp, ('flat', 0.4), pattern=dp)

    def helmet_frontal(s, cv, cx, cy, d, col, back):
        hr = s.rp(col)
        hh, rx, ry = s.hh, d['rx'], d['ry']
        dome = cv.ell(cx, cy - 0.16 * hh, rx + 0.18 * hh, ry * 0.86 + 0.06 * hh) & (cv.Y < cy + (0.02 if not back else 0.18) * hh)
        cv.fill(dome, hr, ('ell', cx - 0.2 * hh, cy - 0.5 * hh, rx * 1.3, ry * 1.2))
        cv.fill(cv.rect(cx - rx, cy - 0.32 * hh, cx + rx, cy - 0.26 * hh + 0.6) & dome, darker(hr), ('flat', 0.5), contour=False)
        if not back:
            for sg in (-1, 1):
                cv.fill(cv.rect(cx + sg * (rx + 0.06 * hh) - 0.5, cy, cx + sg * (rx + 0.06 * hh) + 0.5, cy + 0.42 * hh), RP(C['strap']), ('flat', 0.5), contour=False)

    # ================================================================== SIDE ('w', facing screen-left)
    def side(s, cv, P):
        d = s.dims()
        hh = s.hh
        hip = P['hip']
        tilt = math.radians(P.get('tilt', 0))
        breath = P.get('breath', 0)
        T = (d['crotch'] - 0.3 * hh) - d['sy'] + breath
        piv = (hip[0], hip[1] - 0.08 * hh)

        def tp(dx, dy):
            px, py = dx * hh, dy * hh
            c, s_ = math.cos(tilt), math.sin(tilt)
            return (piv[0] + px * c + py * s_, piv[1] - px * s_ + py * c)
        s._tp = tp
        Tn = T / hh
        sh_pt = tp(0.02, -Tn + 0.2)
        neck = tp(-0.04, -Tn - 0.02)
        legs = P['legs']
        if P.get('far_arm'):
            el, wr = P['far_arm']
            s.arm(cv, sh_pt, el, wr, d, far=True)
        if legs:
            s.leg_side(cv, hip, legs[1], d, far=True)
        kind = s.r['hair'][0]
        helmet = P.get('helmet')
        if helmet and kind in ('spiky', 'puff', 'bun', 'wavy'):
            kind = 'short'
        if helmet and kind == 'wavylong':
            kind = 'bob'
        hc = (neck[0] - 0.06 * hh, neck[1] - 0.58 * hh)
        if kind == 'ponytail' and not helmet:
            pt = cv.cap((hc[0] + 0.40 * hh, hc[1] - 0.18 * hh), (hc[0] + 0.66 * hh, hc[1] + 0.62 * hh), 0.20 * hh, 0.11 * hh)
            cv.fill(pt, s.hair, ('cyl', (hc[0] + 0.4 * hh, hc[1]), (hc[0] + 0.66 * hh, hc[1] + hh), 0.2 * hh))
        if s.r.get('pack') and not P.get('nopack'):
            pk = s.rp(s.r['pack'])
            big = s.r.get('bigpack')
            pts = [tp(0.26, -Tn + (-0.2 if big else 0.18)), tp(0.80 if big else 0.74, -Tn + (-0.1 if big else 0.26)),
                   tp(0.84 if big else 0.78, -0.05 if big else -0.25), tp(0.30, 0.0 if big else -0.12)]
            cv.fill(cv.poly(pts), pk, ('ell', *tp(0.4, -Tn + 0.4), 0.6 * hh, 0.8 * hh))
            fl = cv.poly([tp(0.5, -Tn + 0.55), tp(0.86 if big else 0.8, -Tn + 0.6), tp(0.86 if big else 0.8, -0.4), tp(0.5, -0.38)])
            cv.fill(fl, darker(pk), ('flat', 0.5))
        f = 1.06 if s.f else 1.0
        up = [(0.30, -Tn), (-0.18, -Tn - 0.02), (-0.40 * f, -Tn + 0.36), (-0.36, -Tn + 0.8), (-0.32, -0.30),
              (-0.36, -0.05), (-0.32, 0.30), (0.30, 0.30), (0.42 if s.f else 0.38, 0.02), (0.30, -0.55), (0.36, -Tn + 0.4)]
        body = cv.poly([tp(*p) for p in up])
        top = s.r['top']
        lit = ('ell', *tp(-0.3, -Tn + 0.3), 0.75 * hh, T * 1.1)
        cut = tp(0, -0.08 if top['kind'] != 'shirt' else 0.0)[1]
        wl = cv.Y < cut
        pat = None
        if top.get('band'):
            b1, b2 = s.rp(top['band'][0]), s.rp(top['band'][1])
            by = tp(0, -Tn + 0.42)[1]

            def pat(x, y):
                yy = y + 0.5
                if by <= yy < by + 1 or by + 2.2 <= yy < by + 3.2:
                    return b2
                if by + 1 <= yy < by + 2.2:
                    return b1 if (x % 3) else b2
                return None
        elif top.get('hstripe'):
            hs = s.rp(top['hstripe'])
            y00 = tp(0, -Tn)[1]

            def pat(x, y):
                return hs if int(y - y00) % 4 == 2 else None
        cv.fill(body & wl, s.tee, lit, pattern=pat)
        cv.fill(body & ~wl, s.bot, ('ell', *tp(-0.3, -0.1), 0.6 * hh, 0.6 * hh))
        k = top['kind']
        if k in ('vest', 'shirt', 'hivis', 'coat'):
            dd = dict(d); dd['sy'] = tp(0, -Tn)[1] + 0.0
            if k == 'vest':
                vr, vpat, vb = s.rp(top['vest']), s._vest_pat(hip[0], dd, 0, side=True, x0=hip[0]), 0.0
            elif k == 'hivis':
                dd['waist'] = tp(0, -0.55)[1]
                vr, vpat, vb = s.rp(top['vest']), s._hivis_pat(dd), 0.05
            elif k == 'coat':
                vr, vpat, vb = s.rp(top['coat']), None, 0.22
            else:
                vr, vpat, vb = s.rp(top['shirt']), (s._floral_pat() if top.get('floral') else None), 0.22
            front_x = -0.10 if k != 'coat' else -0.20
            vp = [(0.32, -Tn - 0.02), (front_x, -Tn - 0.04), (-0.30, -Tn + 0.4), (-0.24, vb), (0.34, vb), (0.40, -Tn + 0.4)]
            cv.fill(cv.poly([tp(*p) for p in vp]), vr, lit, pattern=vpat)
        if s.r['bottom']['kind'] in ('skirt', 'longskirt') and legs:
            s.skirt_side(cv, hip, legs, d, tp)
        nk = cv.cap(neck, (neck[0] - 0.02 * hh, neck[1] - 0.4 * hh), 0.17 * hh)
        cv.fill(nk, s.skin, ('flat', 0.1), contour=False)
        if s.r.get('beads'):
            cols = [C['bead1'], C['bead2'], C['bead3']]
            for i in range(5):
                cv.px(int(neck[0] - 0.30 * hh + i * 0.6), int(neck[1] + 0.1 * hh + i * 0.35), hx(cols[i % 3]))
        if s.r.get('lanyard'):
            for i in range(6):
                cv.px(int(neck[0] - 0.2 * hh - i * 0.3), int(neck[1] + 0.1 * hh + i * 0.9), hx('#3C6FA8'))
        if kind in ('long', 'bob', 'wavylong') and not helmet:
            L_ = {'long': 0.95, 'bob': 0.5, 'wavylong': 0.74}[kind]
            m = cv.cap((hc[0] + 0.22 * hh, hc[1]), (hc[0] + 0.30 * hh, hc[1] + L_ * hh), 0.30 * hh, 0.2 * hh)
            cv.fill(m, s.hair, ('cyl', (hc[0] + 0.2 * hh, hc[1]), (hc[0] + 0.3 * hh, hc[1] + hh), 0.3 * hh))
        s.head_side(cv, hc, d, P, kind, helmet)
        if legs:
            s.leg_side(cv, hip, legs[0], d, far=False)
            if s.r['bottom']['kind'] in ('skirt', 'longskirt'):
                s.skirt_side(cv, hip, legs, d, tp)
        if k == 'coat' and legs:  # coat tail over the thighs
            k0, _ = s.leg_pts(hip, legs[0], d)
            k1, _ = s.leg_pts(hip, legs[1], d)
            ky = min(k0[1], k1[1]) - 0.1 * hh
            pts = [tp(-0.38, -0.2), tp(0.42, -0.2), (max(k0[0], k1[0]) + 0.35 * hh, ky), (min(k0[0], k1[0]) - 0.15 * hh, ky)]
            cv.fill(cv.poly(pts), s.rp(top['coat']), ('ell', hip[0] - 0.3 * hh, hip[1], 0.9 * hh, 1.2 * hh))
        if P.get('pre_near_arm'):
            P['pre_near_arm'](cv)
        if P.get('near_arm'):
            el, wr = P['near_arm']
            s.arm(cv, sh_pt, el, wr, d)
            if P.get('prop', True) and s.r.get('prop') in ('basket', 'clipboard', 'notebook'):
                s.prop_side(cv, wr, d)
        if P.get('post'):
            P['post'](cv)
        return sh_pt

    def prop_side(s, cv, wr, d):
        p = s.r['prop']
        hh = s.hh
        hx_, hy = wr[0], wr[1] + 0.12 * hh
        if p == 'basket':
            rr = s.rp(C['rattan'])
            bx, by = hx_ + 0.05 * hh, hy + 0.35 * hh
            m = cv.ell(bx, by + 0.15 * hh, 0.4 * hh, 0.36 * hh) & (cv.Y > by - 0.1 * hh)

            def wv(x, y):
                return darker(rr) if (x + y) % 3 == 0 else None
            cv.fill(m, rr, ('ell', bx - 2, by - 1, 0.5 * hh, 0.5 * hh), pattern=wv)
            handle = cv.ell(bx, by - 0.12 * hh, 0.28 * hh, 0.4 * hh) & ~cv.ell(bx, by - 0.12 * hh, 0.28 * hh - 1, 0.4 * hh - 1) & (cv.Y < by - 0.12 * hh)
            cv.fill(handle, rr, ('flat', 0.4), contour=False)
        elif p == 'clipboard':
            m = cv.rect(hx_ - 2.5, hy - 0.5 * hh, hx_ + 0.5, hy + 0.3 * hh)
            cv.fill(m, s.rp(C['board']), ('flat', 0.4))
        else:
            cv.fill(cv.rect(hx_ - 2, hy - 0.35 * hh, hx_ + 0.5, hy + 0.2 * hh), s.rp(C['book']), ('flat', 0.5))
        cv.fill(cv.ell(hx_, hy - 0.1 * hh, d['rf'] + 0.45, d['rf'] + 0.6), s.skin, ('ell', hx_ - 2, hy - 2, 4, 4))

    def leg_side(s, cv, hip, ang, d, far=False):
        hh = s.hh
        kn, an = s.leg_pts(hip, ang, d)
        skin = darker(s.skin) if far else s.skin
        bk = s.r['bottom']['kind']
        bot = darker(s.bot) if far else s.bot
        legc = bot if bk == 'pants' else skin
        cv.fill(cv.cap(kn, an, d['rs'], d['rs'] * 0.8), legc, ('cyl', kn, an, d['rs']))
        cv.fill(cv.cap(hip, kn, d['rt'], d['rs']), legc, ('cyl', hip, kn, d['rt']))
        if bk == 'shorts':
            e = (hip[0] + (kn[0] - hip[0]) * 0.62, hip[1] + (kn[1] - hip[1]) * 0.62)
            cv.fill(cv.cap(hip, e, d['rt'] + 0.7), bot, ('cyl', hip, e, d['rt'] + 0.7))
        s.foot_side(cv, an, ang, d, far)

    def leg_pts(s, hip, ang, d):
        Lt = d['knee'] - d['hipj']
        Ls = d['ankle'] - d['knee']
        a, b = math.radians(ang[0]), math.radians(ang[1])
        kn = (hip[0] - Lt * math.sin(a), hip[1] + Lt * math.cos(a))
        an = (kn[0] - Ls * math.sin(b), kn[1] + Ls * math.cos(b))
        return kn, an

    def foot_side(s, cv, an, ang, d, far):
        hh = s.hh
        rot = math.radians(max(0, -ang[1] - 8) * 0.9) if len(ang) < 3 else math.radians(ang[2])
        c, s_ = math.cos(-rot), math.sin(-rot)

        def R(v):
            return (an[0] + v[0] * c - v[1] * s_, an[1] + v[0] * s_ + v[1] * c)
        heel, toe = R((0.06 * hh, 0.10 * hh)), R((-0.31 * hh, 0.14 * hh))
        r = 0.11 * hh + 0.35
        if s.r['shoes'] == 'sandal':
            sk = darker(s.skin) if far else s.skin
            cv.fill(cv.cap(heel, toe, r), sk, ('cyl', heel, toe, r))
            cv.fill(cv.cap((heel[0], heel[1] + r * 0.7), (toe[0], toe[1] + r * 0.7), 0.7), s.rp(C['sole']), ('flat', 0.4), contour=False)
            mid = ((heel[0] + toe[0]) / 2, (heel[1] + toe[1]) / 2 - 0.3)
            cv.px(int(mid[0]), int(mid[1]), s.rp(C['sandal'])['base'])
        else:
            sh = darker(s.shoe) if far else s.shoe
            cv.fill(cv.cap(heel, toe, r + 0.3), sh, ('cyl', heel, toe, r + 0.3))
            cv.fill(cv.cap((heel[0], heel[1] + r), (toe[0], toe[1] + r), 0.7), s.rp('#F4F0E8' if s.shoe['base'][0] < 150 else '#8A7E70'), ('flat', 0.5), contour=False)

    def skirt_side(s, cv, hip, legs, d, tp):
        hh = s.hh
        k0, a0 = s.leg_pts(hip, legs[0], d)
        k1, a1 = s.leg_pts(hip, legs[1], d)
        long_ = s.r['bottom']['kind'] == 'longskirt'
        if long_:
            fx = min(k0[0], k1[0], a0[0], a1[0]) - 0.15 * hh
            bx = max(k0[0], k1[0], a0[0], a1[0]) + 0.15 * hh
            ky = max(a0[1], a1[1]) - 0.42 * hh
        else:
            fx = min(k0[0], k1[0]) - 0.30 * hh
            bx = max(k0[0], k1[0]) + 0.30 * hh
            ky = max(k0[1], k1[1]) + 0.12 * hh
        pts = [tp(-0.36, -0.12), tp(0.40, -0.12), (bx, ky), (fx, ky)]
        hem = s.rp(s.r['bottom']['hem'])

        def pat(x, y):
            return hem if ky - 2.2 < y + 0.5 <= ky - 1.0 else None
        cv.fill(cv.poly(pts), s.bot, ('ell', hip[0] - 0.3 * hh, hip[1], 0.9 * hh, 1.2 * hh), pattern=pat)

    def head_side(s, cv, hc, d, P, kind, helmet):
        hh = s.hh
        hx_, hy = hc
        rx, ry = hh * 0.43, d['ry']
        X, Y = cv.X, cv.Y
        face = cv.ell(hx_, hy, rx, ry) | cv.ell(hx_ - 0.06 * hh, hy + ry * 0.35, rx * 0.84, ry * 0.68)
        cv.fill(face, s.skin, ('soft', hx_ - 0.1 * hh, hy - 0.05 * hh, rx, ry, 0.30))
        ey = int(math.floor(hy + 0.08 * hh))
        fx = int(math.floor(hx_ - rx))
        cv.px(fx - 1, ey + 2, s.skin['base'])
        ex = fx + max(2, int(round(rx * 0.45)))
        eye = hx(C['eye'])
        if P.get('blink'):
            cv.px(ex, ey + 1, eye); cv.px(ex - 1, ey + 1, s.skin['sh'])
        else:
            cv.px(ex, ey, eye); cv.px(ex, ey + 1, hx(C['iris']) if not s.r.get('elder') else s.skin['deep'])
        cv.px(ex, ey - 2, s.hair['line']); cv.px(ex + 1, ey - 2, s.hair['line'])
        cv.px(fx + 1, int(round(hy + 0.25 * hh)), s.skin['sh'])
        ear = cv.ell(hx_ + 0.10 * hh, hy + 0.10 * hh, 0.12 * hh + 0.3, 0.16 * hh + 0.3)
        big = cv.ell(hx_ + 0.06 * hh, hy - 0.08 * hh, rx + 0.10 * hh, ry * 0.95 + 0.05 * hh)
        shd = ('ell', hx_ - 0.2 * hh, hy - 0.5 * hh, rx * 1.4, ry * 1.2)
        if kind == 'spiky':
            jag = ((np.floor(X) % 3) == 1) * 1.5
            m = big & ((Y < hy - 0.22 * hh + jag) | (X > hx_ + 0.02 * hh))
            for k in range(3):
                tx = hx_ - 0.25 * hh + k * 0.32 * hh
                m |= cv.poly([(tx - 2.2, hy - 0.52 * hh), (tx + 1.6, hy - 0.72 * hh), (tx + 2.2, hy - 0.48 * hh)])
            m |= cv.poly([(hx_ + rx - 0.5, hy - 0.2 * hh), (hx_ + rx + 0.22 * hh, hy - 0.05 * hh), (hx_ + rx - 0.5, hy + 0.2 * hh)])
            m &= ~(ear & (Y > hy - 0.02 * hh))
            cv.fill(m, s.hair, shd)
            cv.fill(ear & ~m, s.skin, ('flat', 0.4))
        elif kind in ('short', 'ponytail', 'elder', 'bun'):
            lim = hy - (0.22 if kind in ('short', 'ponytail') else 0.28) * hh
            m = big & ((Y < lim) | (X > hx_ + 0.04 * hh))
            if kind == 'ponytail':
                m |= big & (Y < lim + 1.6) & (X < hx_ - 0.2 * hh)
            m &= ~(ear & (Y > hy - 0.02 * hh))
            cv.fill(m, s.hair, shd)
            cv.fill(ear & ~m, s.skin, ('flat', 0.4))
            if kind == 'bun' and not helmet and not s.r.get('hat'):
                cv.fill(cv.ell(hx_ + 0.42 * hh, hy - 0.42 * hh, 0.22 * hh, 0.2 * hh), s.hair, shd)
        elif kind in ('long', 'bob', 'wavylong'):
            m = big & ((Y < hy - 0.22 * hh + np.clip((hx_ - X) * 0.3, 0, 2)) | (X > hx_ - 0.04 * hh))
            m |= cv.ell(hx_ + 0.12 * hh, hy + 0.2 * hh, rx * 0.8, ry * {'long': 0.75, 'bob': 0.55, 'wavylong': 0.68}[kind]) & (X > hx_ - 0.04 * hh)
            cv.fill(m, s.hair, shd, pattern=s._wave_pat() if kind == 'wavylong' else None)
            cv.px(int(hx_ - 0.1 * hh), int(hy - 0.44 * hh), s.hair['hi'])
            cv.px(int(hx_ - 0.1 * hh) + 1, int(hy - 0.44 * hh), s.hair['hi'])
        elif kind == 'wavy':
            vol = cv.ell(hx_ + 0.08 * hh, hy - 0.12 * hh, rx + 0.14 * hh, ry * 0.95 + 0.07 * hh)
            wave = ((np.floor(X) % 4) < 2) * 1.2
            m = vol & ((Y < hy - 0.2 * hh + wave) | (X > hx_ + 0.04 * hh)) & (Y < hy + 0.34 * hh)
            for k in range(3):
                m |= cv.ell(hx_ - 0.2 * hh + k * 0.3 * hh, hy - 0.56 * hh, 0.16 * hh, 0.12 * hh)
            m |= cv.ell(hx_ - rx + 0.12 * hh, hy - 0.22 * hh, 0.16 * hh, 0.1 * hh)  # fringe tip over the brow
            m &= ~(ear & (Y > hy - 0.02 * hh))
            cv.fill(m, s.hair, shd, pattern=s._wave_pat())
            cv.fill(ear & ~m, s.skin, ('flat', 0.4))
        elif kind == 'puff':
            vol = cv.ell(hx_ + 0.12 * hh, hy - 0.16 * hh, rx + 0.2 * hh, ry * 0.9)
            m = vol & ((Y < hy - 0.2 * hh + ((np.floor(X) % 2) == 0)) | (X > hx_ + 0.0 * hh)) & (Y < hy + 0.3 * hh)
            m |= cv.ell(hx_ + 0.3 * hh, hy - 0.66 * hh, 0.3 * hh, 0.24 * hh)
            m &= ~(ear & (Y > hy - 0.02 * hh))

            def curl(x, y):
                return darker(s.hair) if (x * 3 + y * 5) % 7 == 0 else None
            cv.fill(m, s.hair, shd, pattern=curl)
            cv.fill(ear & ~m, s.skin, ('flat', 0.4))
        if helmet:
            hr = s.rp(helmet)
            dome = cv.ell(hx_ + 0.06 * hh, hy - 0.12 * hh, rx + 0.16 * hh, ry * 0.88 + 0.06 * hh) & ((Y < hy - 0.12 * hh) | (X > hx_ + 0.2 * hh))
            cv.fill(dome, hr, ('ell', hx_ - 0.2 * hh, hy - 0.5 * hh, rx * 1.3, ry * 1.2))
            cv.fill(cv.rect(hx_ + 0.12 * hh, hy - 0.1 * hh, hx_ + 0.12 * hh + 1, hy + 0.42 * hh) & ~dome, s.rp(C['strap']), ('flat', 0.5), contour=False)
            cv.fill(cv.rect(hx_ - rx * 0.6, hy - 0.3 * hh, hx_ + rx, hy - 0.22 * hh) & dome, darker(hr), ('flat', 0.5), contour=False)
        elif s.r.get('hat'):
            kh, col = s.r['hat']
            rp = s.rp(col)
            if kh in ('bucket', 'sunhat'):
                wide = 0.32 if kh == 'bucket' else 0.55
                dome = cv.ell(hx_ + 0.04 * hh, hy - 0.42 * hh, rx * 0.98, 0.36 * hh) & (Y < hy - 0.24 * hh)
                cv.fill(dome, rp, ('ell', hx_ - 0.2 * hh, hy - 0.6 * hh, rx * 1.2, 0.5 * hh))
                cv.fill(cv.ell(hx_ + 0.04 * hh, hy - 0.24 * hh, rx + wide * hh, 0.10 * hh + 0.6), rp, ('ell', hx_ - 0.2 * hh, hy - 0.35 * hh, rx * 1.6, 0.3 * hh))
            elif kh == 'cap':
                dome = cv.ell(hx_ + 0.06 * hh, hy - 0.30 * hh, rx + 0.08 * hh, 0.36 * hh) & (Y < hy - 0.16 * hh)
                cv.fill(dome, rp, ('ell', hx_ - 0.2 * hh, hy - 0.5 * hh, rx * 1.2, 0.5 * hh))
                cv.fill(cv.cap((hx_ - rx * 0.6, hy - 0.2 * hh), (hx_ - rx - 0.38 * hh, hy - 0.16 * hh), 0.07 * hh + 0.5), darker(rp), ('flat', 0.5))
            elif kh == 'headband':
                w_ = s.rp('#EDE3CE'); k_ = s.rp('#22202A')
                y0 = hy - 0.30 * hh

                def bp(x, y):
                    yy = y + 0.5 - y0
                    return w_ if yy < 1 else (rp if yy < 2 else k_) if (x % 3) else w_
                m = cv.rect(hx_ - rx - 1, y0, hx_ + rx + 0.2 * hh, y0 + 2.6) & big
                cv.fill(m, rp, ('flat', 0.5), pattern=bp)
                cv.fill(cv.cap((hx_ + rx + 0.1 * hh, y0 + 1.5), (hx_ + rx + 0.3 * hh, y0 + 0.4 * hh), 0.9), rp, ('flat', 0.5))
            elif kh == 'scarf':
                dots = s.rp('#EDE3CE')

                def dp(x, y):
                    return dots if (x % 4 == 1 and y % 3 == 0) else None
                m = cv.ell(hx_ + 0.08 * hh, hy - 0.14 * hh, rx + 0.16 * hh, ry * 0.92 + 0.06 * hh) & ((Y < hy - 0.12 * hh) | (X > hx_ + 0.22 * hh)) & (Y < hy + 0.25 * hh)
                cv.fill(m, rp, ('soft', hx_ - 0.2 * hh, hy - 0.5 * hh, rx * 1.4, ry * 1.2, 0.4), pattern=dp)

    def finish(s, cv):
        cv.clean()
        cv.rim(hx('#E6ECEE'), 0.18)  # soft edge light only (a strong cool rim read as a specular shine in game)
        cv.outline()
        return cv


def ik(S, Hd, L1, L2, bend=1):
    dx, dy = Hd[0] - S[0], Hd[1] - S[1]
    D = max(1e-3, min(math.hypot(dx, dy), L1 + L2 - 1e-3))
    a = math.atan2(dy, dx)
    c = (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D)
    b = math.acos(max(-1, min(1, c)))
    t = a + b * bend
    return (S[0] + L1 * math.cos(t), S[1] + L1 * math.sin(t))
