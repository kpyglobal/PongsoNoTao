#!/usr/bin/env python3
"""
0.1.4 arrival intro (2.5D): rough placeholder layers cut from the two keyframes in art-ref/arrival/.

Only used while Digital Painter's real layers (art-ref/arrival/layers25d/{plane,yacht}/) are missing.
Writes PNG layers + layers.json in the same format the final layers use, to art-ref/arrival/placeholder25d/<mode>/
(art-ref is never shipped). scripts/art/build-intro25d.py then turns either set into the game's WebP assets.

Coordinates below are measured on the 1280x720 keyframes, written in the 819-wide preview scale (x 1280/819).
"""
import json, os, sys
import numpy as np, cv2

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, 'art-ref', 'arrival')
OUT = os.path.join(ART, 'placeholder25d')
K = 1280 / 819


def P(pts):
    return (np.array(pts, np.float32) * K).astype(np.int32)


def poly_mask(shape, polys, feather=2.0):
    m = np.zeros(shape[:2], np.uint8)
    for p in polys:
        cv2.fillPoly(m, [P(p)], 255)
    if feather:
        m = cv2.GaussianBlur(m, (0, 0), feather)
    return m


def lines_mask(shape, lines, width):
    m = np.zeros(shape[:2], np.uint8)
    for pl in lines:
        cv2.polylines(m, [P(pl)], False, 255, int(round(width * K)), cv2.LINE_AA)
    return m


def rgba(img, alpha):
    return np.dstack([img, alpha])


def save(mode, name, arr):
    d = os.path.join(OUT, mode)
    os.makedirs(d, exist_ok=True)
    cv2.imwrite(os.path.join(d, name), arr)


def inpaint(img, mask, r=9):
    # inpaint at half size (big holes), paste back only inside the hole
    h, w = img.shape[:2]
    sm = cv2.resize(img, (w // 2, h // 2), interpolation=cv2.INTER_AREA)
    mm = cv2.resize(mask, (w // 2, h // 2), interpolation=cv2.INTER_NEAREST)
    fill = cv2.inpaint(sm, (mm > 20).astype(np.uint8) * 255, r, cv2.INPAINT_TELEA)
    fill = cv2.GaussianBlur(cv2.resize(fill, (w, h), interpolation=cv2.INTER_CUBIC), (0, 0), 2)
    a = cv2.GaussianBlur(mask, (0, 0), 3).astype(np.float32)[..., None] / 255
    return (img * (1 - a) + fill * a).astype(np.uint8)


def sea_mask(img, horizon_y, exclude):
    b, g, r = [img[..., i].astype(np.int32) for i in range(3)]
    m = ((b - r) > 28) & (b > 70) & (b > g + 6)
    m[: int(horizon_y * K)] = False
    m = m.astype(np.uint8) * 255
    m[exclude > 40] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.GaussianBlur(m, (0, 0), 2.5)
    return m


def plane():
    img = cv2.imread(os.path.join(ART, 'keyframe_plane_clouds.png'))
    h, w = img.shape[:2]
    # wing (top right): a generous hand polygon; the bit of sky inside it matches the painted-out plate
    wing_poly = [(474, 47), (527, 34), (564, 0), (819, 0), (819, 72), (753, 81), (733, 106), (690, 116), (646, 98), (630, 82), (555, 62), (476, 60)]
    wing = poly_mask(img.shape, [wing_poly], 1.2)
    # near clouds (bottom corners): cloud = not sea-blue (shaded cloud parts included), inside hand zones
    b, g, r = [img[..., k].astype(np.float32) for k in range(3)]
    cloud = np.clip((34 - (b - r)) / 22, 0, 1) * np.clip(((r + g + b) / 3 - 95) / 40, 0, 1)
    zones_near = poly_mask(img.shape, [[(0, 298), (372, 298), (372, 461), (0, 461)], [(498, 322), (819, 322), (819, 461), (498, 461)]], 7)
    near = (cloud * zones_near).astype(np.uint8)
    near = cv2.morphologyEx(near, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    near = cv2.GaussianBlur(near, (0, 0), 1.0)
    # the plate: wing and near clouds painted out (they are their own layers)
    hole = cv2.dilate(np.maximum(wing, near), np.ones((9, 9), np.uint8))
    plate = inpaint(img, hole, 11)
    sea = sea_mask(img, 140, near)
    save('plane', '00_plate.png', plate)
    save('plane', '00_plate_seamask.png', sea)
    save('plane', '20_clouds_near.png', rgba(img, near))
    save('plane', '90_wing.png', rgba(img, wing))
    spec = {
        'size': [w, h],
        # where the push ends: 蘭嶼機場 is on the near (south-west) shore, west of the village (uv on the plate)
        'target': [0.485, 0.645],
        'horizon': 0.30,
        'sun': [0.148, 0.243],
        'layers': [
            {'file': '00_plate.png', 'kind': 'plate', 'depth': 100, 'sea': '00_plate_seamask.png'},
            {'file': '20_clouds_near.png', 'kind': 'cloud', 'depth': 14, 'drift': 0.0035},
            {'file': '90_wing.png', 'kind': 'overlay', 'anchor': [1.0, 0.0], 'screen': [1.0, 0.0]},
        ],
    }
    json.dump(spec, open(os.path.join(OUT, 'plane', 'layers.json'), 'w'), indent=1)


def yacht():
    img = cv2.imread(os.path.join(ART, 'keyframe_yacht_sea.png'))
    h, w = img.shape[:2]
    deck = [(0, 372), (60, 352), (130, 334), (200, 314), (245, 302), (300, 300), (345, 318), (390, 345), (440, 380), (500, 420), (560, 461), (0, 461)]
    rails = [
        [(0, 287), (60, 279), (130, 268), (200, 258), (252, 252)],
        [(42, 281), (30, 318), (17, 357)], [(191, 262), (182, 290), (171, 318)],
        [(292, 248), (296, 272), (302, 290)], [(300, 285), (340, 292)],
        [(326, 262), (380, 266), (440, 278), (520, 300), (600, 326), (680, 354), (740, 376), (790, 397), (819, 410)],
        [(341, 266), (345, 295), (348, 322)], [(410, 276), (418, 316), (426, 356)], [(500, 296), (515, 360), (530, 428)], [(712, 368), (728, 415), (745, 461)],
    ]
    bow = np.maximum(poly_mask(img.shape, [deck], 1.0), cv2.GaussianBlur(lines_mask(img.shape, rails, 6.5), (0, 0), 0.8))
    # spray / foam: white water near the hull, outside the deck
    b, g, r = [img[..., i].astype(np.float32) for i in range(3)]
    lum = (r + g + b) / 3
    sat = np.max(img, 2).astype(np.float32) - np.min(img, 2)
    white = np.clip((lum - 150) / 40, 0, 1) * np.clip((95 - sat) / 50, 0, 1)
    zone = poly_mask(img.shape, [[(0, 285), (260, 270), (260, 345), (0, 380)], [(330, 275), (819, 400), (819, 461), (520, 461), (330, 330)]], 8)
    spray = (white * zone / 255 * 255).astype(np.uint8)
    spray[cv2.dilate(bow, np.ones((11, 11), np.uint8)) > 40] = 0
    spray = cv2.GaussianBlur(spray, (0, 0), 0.8)
    plate = inpaint(img, cv2.dilate(bow, np.ones((9, 9), np.uint8)), 11)
    sea = sea_mask(plate, 222, np.zeros((h, w), np.uint8))
    save('yacht', '00_plate.png', plate)
    save('yacht', '00_plate_seamask.png', sea)
    # 3 spray frames: the same white water, broken up differently (the shader cross-fades them)
    rng = np.random.default_rng(7)
    files = []
    for i in range(3):
        n = cv2.GaussianBlur(rng.random((h, w)).astype(np.float32), (0, 0), 2.2)
        n = (n - n.min()) / (n.max() - n.min())
        a = np.clip(spray.astype(np.float32) * (0.55 + 0.9 * n), 0, 255).astype(np.uint8)
        dx = [0, 3, -2][i]
        a = np.roll(a, dx, 1)
        f = f'50_spray_{i}.png'
        save('yacht', f, rgba(np.roll(img, dx, 1), a))
        files.append(f)
    save('yacht', '90_bow.png', rgba(img, bow))
    spec = {
        'size': [w, h],
        # 開元港 (椰油) is on the low west coast, left of the main peak in this view
        'target': [0.40, 0.455],
        'horizon': 0.478,
        'sun': [0.132, 0.325],
        'layers': [
            {'file': '00_plate.png', 'kind': 'plate', 'depth': 100, 'sea': '00_plate_seamask.png'},
            {'file': files[0], 'kind': 'spray', 'frames': files},
            {'file': '90_bow.png', 'kind': 'overlay', 'anchor': [0.36, 1.0], 'screen': [0.5, 1.0]},
        ],
    }
    json.dump(spec, open(os.path.join(OUT, 'yacht', 'layers.json'), 'w'), indent=1)


if __name__ == '__main__':
    which = sys.argv[1:] or ['plane', 'yacht']
    if 'plane' in which:
        plane()
    if 'yacht' in which:
        yacht()
    print('placeholders ->', OUT)
