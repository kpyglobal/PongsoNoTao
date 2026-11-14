#!/usr/bin/env python3
"""Generate crisp fine-pixel PNG assets for Pongso no Tao (Lanyu RPG).

Sprites are drawn at native pixel resolution (no upscale-then-downsample),
with 1px outlines and 2–3 shade ramps — fine-pixel, not chunky 16×16.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "sprites"
DATA = ROOT / "public" / "data"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def new(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def pset(im: Image.Image, x: int, y: int, c: tuple[int, ...]) -> None:
    w, h = im.size
    if 0 <= x < w and 0 <= y < h:
        if len(c) == 3:
            c = (*c, 255)
        im.putpixel((x, y), c)


def blend(im: Image.Image, x: int, y: int, c: tuple[int, ...], a: float = 1.0) -> None:
    w, h = im.size
    if not (0 <= x < w and 0 <= y < h):
        return
    if len(c) == 3:
        c = (*c, 255)
    r, g, b, ca = c
    ca = int(ca * a)
    sr, sg, sb, sa = im.getpixel((x, y))
    if sa == 0 or ca == 255:
        im.putpixel((x, y), (r, g, b, ca if sa == 0 else max(sa, ca)))
        if sa == 0:
            return
    out_a = ca + sa * (255 - ca) // 255
    if out_a == 0:
        return
    def ch(cv: int, sv: int) -> int:
        return (cv * ca + sv * sa * (255 - ca) // 255) // out_a
    im.putpixel((x, y), (ch(r, sr), ch(g, sg), ch(b, sb), out_a))


def rect(im: Image.Image, x0: int, y0: int, x1: int, y1: int, c: tuple[int, ...]) -> None:
    for y in range(min(y0, y1), max(y0, y1) + 1):
        for x in range(min(x0, x1), max(x0, x1) + 1):
            pset(im, x, y, c)


def fill_ellipse(im: Image.Image, cx: float, cy: float, rx: float, ry: float, c: tuple[int, ...]) -> None:
    x0, x1 = int(cx - rx) - 1, int(cx + rx) + 1
    y0, y1 = int(cy - ry) - 1, int(cy + ry) + 1
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if rx == 0 or ry == 0:
                continue
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if dx * dx + dy * dy <= 1.0:
                pset(im, x, y, c)


def fill_poly(im: Image.Image, pts: list[tuple[float, float]], c: tuple[int, ...]) -> None:
    if len(pts) < 3:
        return
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1 = int(min(xs)) - 1, int(max(xs)) + 1
    y0, y1 = int(min(ys)) - 1, int(max(ys)) + 1
    n = len(pts)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            # even-odd
            inside = False
            j = n - 1
            px, py = x + 0.5, y + 0.5
            for i in range(n):
                xi, yi = pts[i]
                xj, yj = pts[j]
                if (yi > py) != (yj > py):
                    den = (yj - yi) or 1e-9
                    inter = (xj - xi) * (py - yi) / den + xi
                    if px < inter:
                        inside = not inside
                j = i
            if inside:
                pset(im, x, y, c)


def line(im: Image.Image, x0: int, y0: int, x1: int, y1: int, c: tuple[int, ...]) -> None:
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx - dy
    while True:
        pset(im, x0, y0, c)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy


def outline_sprite(im: Image.Image, color: tuple[int, int, int, int] = (32, 24, 20, 230), diag: bool = False) -> Image.Image:
    """Add a dark 1px outline around opaque pixels, keeping interiors crisp."""
    w, h = im.size
    src = im.copy()
    out = new(w, h)
    neigh = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    if diag:
        neigh += [(-1, -1), (1, -1), (-1, 1), (1, 1)]
    for y in range(h):
        for x in range(w):
            r, g, b, a = src.getpixel((x, y))
            if a > 80:
                pset(out, x, y, (r, g, b, a))
            else:
                edge = False
                for dx, dy in neigh:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and src.getpixel((nx, ny))[3] > 80:
                        edge = True
                        break
                if edge:
                    pset(out, x, y, color)
    return out


def shadow_ellipse(im: Image.Image, cx: int, cy: int, rx: int, ry: int, alpha: int = 70) -> None:
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            dx, dy = (x + 0.5 - cx) / max(rx, 1), (y + 0.5 - cy) / max(ry, 1)
            d = dx * dx + dy * dy
            if d <= 1:
                a = int(alpha * (1 - d * 0.55))
                blend(im, x, y, (20, 24, 28, a))


def save(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG")
    print(f"  wrote {path.relative_to(ROOT)}  {im.size[0]}×{im.size[1]}")


# ---------------------------------------------------------------------------
# Palettes
# ---------------------------------------------------------------------------

INK = (32, 24, 20, 230)
SKIN = (232, 186, 148)
SKIN_S = (204, 148, 108)
SKIN_H = (244, 210, 178)
HAIR = (28, 20, 16)
HAIR_H = (58, 40, 30)
HAIR_W = (214, 208, 196)
HAIR_W_S = (168, 160, 148)
WHITE = (244, 240, 232)
RED = (180, 42, 36)
RED_S = (128, 28, 26)
BLACK = (22, 18, 16)
TEAL = (28, 92, 96)
TEAL_S = (18, 64, 68)
CREAM = (236, 220, 176)
SANDAL = (92, 62, 42)

# ---------------------------------------------------------------------------
# Character drawing
# ---------------------------------------------------------------------------

DIRS = ("s", "w", "n", "e")  # row order


def vest_pattern(im: Image.Image, x: int, y: int, w: int, h: int, facing: str) -> None:
    """Fine geometric trim (white / red / black) inspired by Tao vest motifs — not a copy of a sacred pattern."""
    for i in range(w):
        for j in range(h):
            px, py = x + i, y + j
            # vertical side stripes
            if i <= 1 or i >= w - 2:
                pset(im, px, py, RED if (j + i) % 2 == 0 else BLACK)
            elif j == 0 or j == h - 1:
                pset(im, px, py, WHITE)
            elif j == 1:
                pset(im, px, py, RED)
            else:
                # inner field — cream with tiny chevron / diamond
                pset(im, px, py, CREAM)
                if 2 <= i <= w - 3 and 3 <= j <= h - 3:
                    rel = (i + j) % 6
                    if rel == 0:
                        pset(im, px, py, RED)
                    elif rel == 3:
                        pset(im, px, py, (40, 36, 32))
    # a small stylized "eye" diamond at chest if facing S or roughly front
    if facing in ("s", "e", "w") and w >= 8 and h >= 8:
        cx = x + w // 2
        cy = y + h // 2
        pset(im, cx, cy, BLACK)
        pset(im, cx - 1, cy, WHITE)
        pset(im, cx + 1, cy, WHITE)
        pset(im, cx, cy - 1, WHITE)
        pset(im, cx, cy + 1, RED)


def draw_head(im: Image.Image, cx: int, cy: int, facing: str, hair_col=None, hair_s=None, elder=False, tourist=False) -> None:
    hair_col = hair_col or (HAIR_W if elder else HAIR)
    hair_s = hair_s or (HAIR_W_S if elder else HAIR_H)
    hx, hy, hr = cx, cy, 7
    # neck
    rect(im, cx - 2, cy + 5, cx + 2, cy + 8, SKIN)
    # face
    fill_ellipse(im, hx, hy + 1, 6.2, 7.0, SKIN)
    fill_ellipse(im, hx - 2, hy, 4.0, 5.0, SKIN_H)  # highlight
    # ears if side/front
    if facing in ("s", "n"):
        pset(im, cx - 7, cy + 1, SKIN)
        pset(im, cx - 7, cy + 2, SKIN_S)
        pset(im, cx + 7, cy + 1, SKIN)
        pset(im, cx + 7, cy + 2, SKIN_S)
    elif facing == "w":
        pset(im, cx - 7, cy + 1, SKIN)
        pset(im, cx - 7, cy + 2, SKIN_S)
    else:
        pset(im, cx + 7, cy + 1, SKIN)
        pset(im, cx + 7, cy + 2, SKIN_S)
    # hair cap
    if tourist:
        # sun hat
        fill_ellipse(im, hx, hy - 5, 9.5, 3.2, (212, 176, 72))
        fill_ellipse(im, hx, hy - 7, 5.5, 3.2, (232, 200, 92))
        rect(im, cx - 5, cy - 9, cx + 5, cy - 6, (232, 200, 92))
        rect(im, cx - 5, cy - 6, cx + 5, cy - 5, (180, 140, 48))
    elif elder:
        fill_ellipse(im, hx, hy - 3, 7.0, 5.0, hair_col)
        rect(im, cx - 7, cy - 4, cx + 7, cy - 1, hair_col)
        # short sides, receding
        for i in range(-6, 7):
            pset(im, cx + i, cy - 5, hair_s if abs(i) % 2 == 0 else hair_col)
        # slight beard
        if facing != "n":
            rect(im, cx - 3, cy + 5, cx + 3, cy + 7, hair_col)
            pset(im, cx - 4, cy + 6, hair_s)
            pset(im, cx + 4, cy + 6, hair_s)
    else:
        fill_ellipse(im, hx, hy - 3, 7.2, 5.4, hair_col)
        rect(im, cx - 7, cy - 5, cx + 7, cy + 1, hair_col)
        # bangs
        if facing != "n":
            for i in range(-5, 6):
                pset(im, cx + i, cy - 1, hair_col)
            pset(im, cx - 3, cy, hair_col)
            pset(im, cx + 2, cy, hair_col)
        # side hair down
        rect(im, cx - 7, cy, cx - 6, cy + 4, hair_col)
        rect(im, cx + 6, cy, cx + 7, cy + 4, hair_col)
        # highlight
        pset(im, cx - 2, cy - 5, hair_s)
        pset(im, cx - 1, cy - 6, hair_s)
    # face features (not on back)
    if facing != "n":
        eye_y = cy + 1
        if facing == "s":
            pset(im, cx - 3, eye_y, (28, 22, 20))
            pset(im, cx + 3, eye_y, (28, 22, 20))
            pset(im, cx - 3, eye_y - 1, (255, 255, 255, 180))
            pset(im, cx + 3, eye_y - 1, (255, 255, 255, 180))
            # brow
            pset(im, cx - 4, eye_y - 2, hair_col if not elder else hair_s)
            pset(im, cx + 4, eye_y - 2, hair_col if not elder else hair_s)
            # nose
            pset(im, cx, cy + 3, SKIN_S)
            # mouth
            pset(im, cx - 1, cy + 5, (168, 86, 80))
            pset(im, cx, cy + 5, (190, 100, 90))
            pset(im, cx + 1, cy + 5, (168, 86, 80))
        elif facing == "w":
            pset(im, cx - 3, eye_y, (28, 22, 20))
            pset(im, cx - 3, eye_y - 1, (255, 255, 255, 180))
            pset(im, cx - 2, cy + 3, SKIN_S)
            pset(im, cx - 2, cy + 5, (168, 86, 80))
        else:
            pset(im, cx + 3, eye_y, (28, 22, 20))
            pset(im, cx + 3, eye_y - 1, (255, 255, 255, 180))
            pset(im, cx + 2, cy + 3, SKIN_S)
            pset(im, cx + 2, cy + 5, (168, 86, 80))


def draw_character(
    kind: str,
    facing: str,
    frame: int,
    size: int = 64,
) -> Image.Image:
    im = new(size, size)
    # walk cycle
    bob = [0, -1, 0, -1][frame]
    leg = frame  # 0 stand/stride A, 1 lift L, 2 stride B, 3 lift R
    cx, base = size // 2, size - 6
    foot_y = base + bob
    # shadow
    shadow_ellipse(im, cx, size - 5, 10, 4, 80)

    # palette per kind
    shorts = TEAL
    shorts_s = TEAL_S
    skin = SKIN
    elder = kind == "elder"
    tourist = kind == "tourist"
    clinic = kind == "clinic"
    staff = elder

    # arm swing / leg offsets
    if facing in ("s", "n"):
        l_leg = [0, -2, 0, 2][leg]
        r_leg = [0, 2, 0, -2][leg]
        l_arm = [0, 2, 0, -2][leg]
        r_arm = [0, -2, 0, 2][leg]
    else:
        l_leg = [0, -3, 0, 2][leg]
        r_leg = [0, 2, 0, -3][leg]
        l_arm = [1, 3, 1, -1][leg]
        r_arm = [-1, -1, -1, 3][leg]

    body_top = 24 + bob
    body_bot = 40 + bob
    # legs
    leg_col = shorts if not tourist else (48, 70, 120)
    if facing == "n":
        # back: legs first, then body, then head (hair covers)
        pass

    def draw_leg(ox: int, stride: int) -> None:
        x = cx + ox
        y0 = body_bot - 1
        y1 = foot_y - 1 + (abs(stride) // 2)
        rect(im, x - 2, y0, x + 1, y1, leg_col)
        # calf shade
        rect(im, x + 1, y0 + 2, x + 1, y1, shorts_s if not tourist else (32, 48, 88))
        # foot / sandal
        fy = foot_y + (1 if stride > 0 else 0)
        if facing == "w":
            rect(im, x - 4, fy, x + 1, fy + 1, SANDAL)
        elif facing == "e":
            rect(im, x - 1, fy, x + 4, fy + 1, SANDAL)
        else:
            rect(im, x - 2, fy, x + 2, fy + 1, SANDAL)

    def draw_arm(ox: int, swing: int, front: bool) -> None:
        x = cx + ox
        y0 = body_top + 3
        y1 = body_top + 14 + swing
        col = skin
        rect(im, x - 1, y0, x + 1, y1, col)
        pset(im, x, y1 + 1, SKIN_S)
        # hand
        pset(im, x, y1 + 2, skin)
        if tourist and ox > 0 and facing in ("s", "e"):
            # camera
            rect(im, x - 1, y1, x + 3, y1 + 3, (48, 48, 52))
            pset(im, x + 1, y1 + 1, (140, 200, 220))

    # draw order depends on facing
    back_arm_first = True
    if facing == "s":
        draw_leg(-4, l_leg)
        draw_leg(3, r_leg)
        draw_arm(-8, l_arm, False)
        # torso
        rect(im, cx - 7, body_top, cx + 6, body_bot, CREAM)
        if clinic:
            rect(im, cx - 7, body_top, cx + 6, body_bot, WHITE)
            # red cross pocket
            pset(im, cx + 3, body_top + 7, RED)
            pset(im, cx + 2, body_top + 7, RED)
            pset(im, cx + 4, body_top + 7, RED)
            pset(im, cx + 3, body_top + 6, RED)
            pset(im, cx + 3, body_top + 8, RED)
            rect(im, cx - 7, body_bot - 2, cx + 6, body_bot, (220, 220, 224))
        elif tourist:
            # bright shirt
            rect(im, cx - 7, body_top, cx + 6, body_bot, (72, 168, 196))
            for i in range(-6, 7):
                if (i + body_top) % 3 == 0:
                    pset(im, cx + i, body_top + 4, (255, 220, 80))
                    pset(im, cx + i, body_top + 8, (255, 220, 80))
            # backpack straps
            rect(im, cx - 6, body_top, cx - 5, body_bot - 2, (96, 58, 36))
            rect(im, cx + 4, body_top, cx + 5, body_bot - 2, (96, 58, 36))
        else:
            vest_pattern(im, cx - 7, body_top, 14, body_bot - body_top + 1, facing)
            if elder:
                # extra red sash
                rect(im, cx - 7, body_top + 10, cx + 6, body_top + 12, RED)
        # shorts already start at legs; waist
        rect(im, cx - 7, body_bot - 3, cx + 6, body_bot, shorts if not tourist else (48, 70, 120))
        draw_arm(8, r_arm, True)
        if elder:
            # staff in front of right side
            sx = cx + 11
            line(im, sx, body_top - 6, sx, foot_y, (118, 82, 44))
            pset(im, sx, body_top - 7, (148, 108, 60))
        if tourist:
            # backpack
            rect(im, cx - 6, body_top + 1, cx + 5, body_top + 12, (128, 78, 42))
            rect(im, cx - 5, body_top + 2, cx + 4, body_top + 10, (150, 96, 52))
        draw_head(im, cx, 16 + bob, facing, elder=elder, tourist=tourist)

    elif facing == "n":
        draw_arm(-8, l_arm, False)
        draw_arm(8, r_arm, False)
        draw_leg(-4, l_leg)
        draw_leg(3, r_leg)
        rect(im, cx - 7, body_top, cx + 6, body_bot, CREAM)
        if clinic:
            rect(im, cx - 7, body_top, cx + 6, body_bot, WHITE)
        elif tourist:
            rect(im, cx - 7, body_top, cx + 6, body_bot, (72, 168, 196))
            rect(im, cx - 8, body_top, cx + 7, body_top + 14, (128, 78, 42))
            rect(im, cx - 7, body_top + 1, cx + 6, body_top + 12, (150, 96, 52))
        else:
            vest_pattern(im, cx - 7, body_top, 14, body_bot - body_top + 1, facing)
        rect(im, cx - 7, body_bot - 3, cx + 6, body_bot, shorts if not tourist else (48, 70, 120))
        if elder:
            sx = cx + 11
            line(im, sx, body_top - 6, sx, foot_y, (118, 82, 44))
        draw_head(im, cx, 16 + bob, facing, elder=elder, tourist=tourist)

    elif facing in ("w", "e"):
        sign = -1 if facing == "w" else 1
        # far leg, far arm, body, near leg, near arm
        draw_leg(-sign * 2, l_leg if facing == "w" else r_leg)
        draw_arm(-sign * 6, l_arm if facing == "w" else r_arm, False)
        rect(im, cx - 5, body_top, cx + 4, body_bot, CREAM)
        if clinic:
            rect(im, cx - 5, body_top, cx + 4, body_bot, WHITE)
        elif tourist:
            rect(im, cx - 5, body_top, cx + 4, body_bot, (72, 168, 196))
            # backpack on back (west: right of sprite if facing w... if facing west, back is east = +x)
            bx = cx + (4 if facing == "w" else -6)
            rect(im, bx, body_top + 1, bx + 5, body_top + 13, (128, 78, 42))
        else:
            vest_pattern(im, cx - 5, body_top, 10, body_bot - body_top + 1, facing)
        rect(im, cx - 5, body_bot - 3, cx + 4, body_bot, shorts if not tourist else (48, 70, 120))
        draw_leg(sign * 3, r_leg if facing == "w" else l_leg)
        draw_arm(sign * 6, r_arm if facing == "w" else l_arm, True)
        if elder:
            sx = cx + sign * 8
            line(im, sx, body_top - 6, sx, foot_y, (118, 82, 44))
            pset(im, sx, body_top - 7, (148, 108, 60))
        draw_head(im, cx, 16 + bob, facing, elder=elder, tourist=tourist)

    return outline_sprite(im, INK, diag=False)


def make_character_sheet(kind: str) -> tuple[Image.Image, dict]:
    fw = fh = 64
    cols, rows = 4, 4
    sheet = new(fw * cols, fh * rows)
    meta = {"frameWidth": fw, "frameHeight": fh, "cols": cols, "rows": rows, "dirs": list(DIRS), "frames": 4, "kind": kind, "individuals": []}
    out_dir = OUT / "characters" / kind
    out_dir.mkdir(parents=True, exist_ok=True)
    for r, d in enumerate(DIRS):
        for c in range(4):
            fr = draw_character(kind, d, c, 64)
            sheet.paste(fr, (c * fw, r * fh), fr)
            name = f"{kind}_{d}_{c}.png"
            save(fr, out_dir / name)
            meta["individuals"].append(f"characters/{kind}/{name}")
    # The in-game {kind}_sheet.png now comes from scripts/generate_octo.py (方案二 歧路旅人風);
    # this legacy v1 sheet is kept only as a reference copy so `npm run sprites` never overwrites it.
    save(sheet, out_dir / f"{kind}_v1_sheet.png")
    return sheet, meta


# ---------------------------------------------------------------------------
# Tatala (single-hull, double-ended, no outrigger)
# ---------------------------------------------------------------------------

def draw_tatala(facing: str, w: int = 128, h: int = 64) -> Image.Image:
    im = new(w, h)
    # shadow
    if facing in ("e", "w"):
        shadow_ellipse(im, w // 2, h - 8, 48, 6, 90)
        # side profile, double-ended canoe, slightly rockered
        # hull polygon
        if facing == "e":
            bow, stern = w - 10, 10
        else:
            bow, stern = 10, w - 10
        mid_y = 34
        keel_y = 48
        gunwale_y = 28
        pts = [
            (stern, mid_y + 2),
            (stern + math.copysign(8, bow - stern), gunwale_y + 2),
            ((stern + bow) / 2, gunwale_y - 2),
            (bow - math.copysign(8, bow - stern), gunwale_y),
            (bow, mid_y - 6),  # upturned stem
            (bow - math.copysign(4, bow - stern), keel_y - 8),
            ((stern + bow) / 2, keel_y),
            (stern + math.copysign(6, bow - stern), keel_y - 4),
        ]
        fill_poly(im, pts, (248, 244, 236))
        # red and black geometric bands along hull
        # waterline black
        for x in range(min(int(bow), int(stern)), max(int(bow), int(stern))):
            t = (x - 14) / (w - 28)
            y_k = int(keel_y - 4 * math.sin(t * math.pi))
            y_g = int(gunwale_y + 2)
            # black waterline
            for y in range(y_k - 3, y_k + 1):
                pset(im, x, y, BLACK)
            # red band
            for y in range(y_k - 8, y_k - 3):
                pset(im, x, y, RED if (x // 3) % 2 == 0 else RED_S)
            # white upper already there; add repeating triangles
            if 16 < x < w - 16 and x % 6 == 0:
                for k in range(3):
                    pset(im, x, y_g + 3 + k, BLACK)
                    pset(im, x - 1, y_g + 4 + k, RED)
                    pset(im, x + 1, y_g + 4 + k, RED)
        # carved eye / wave motif near bow
        ex = int(bow - math.copysign(14, bow - stern))
        ey = gunwale_y + 8
        fill_ellipse(im, ex, ey, 5, 4, WHITE)
        fill_ellipse(im, ex, ey, 3.2, 2.6, BLACK)
        fill_ellipse(im, ex + math.copysign(1, bow - stern), ey - 1, 1.4, 1.2, WHITE)
        # concentric chevrons behind the eye
        for i, col in enumerate((RED, BLACK, RED)):
            ox = int(ex - math.copysign(6 + i * 3, bow - stern))
            pset(im, ox, ey, col)
            pset(im, ox, ey - 1 - i, col)
            pset(im, ox, ey + 1 + i, col)
        # stem post (no outrigger boom!)
        line(im, int(bow), int(mid_y - 6), int(bow), int(mid_y - 14), RED)
        pset(im, int(bow), int(mid_y - 15), BLACK)
        # paddle sometimes
        px = w // 2 + (-18 if facing == "e" else 18)
        line(im, px, gunwale_y - 2, px - 2, keel_y + 8, (118, 82, 44))
        fill_ellipse(im, px - 2, keel_y + 9, 3, 2, (138, 96, 52))
    else:
        # fore/aft view: narrow, double-ended, high stem
        shadow_ellipse(im, w // 2, h - 8, 14, 5, 90)
        cx = w // 2
        # hull diamond-ish
        pts = [
            (cx, 10),  # stem tip
            (cx + 10, 30),
            (cx + 12, 46),
            (cx, 52),
            (cx - 12, 46),
            (cx - 10, 30),
        ]
        fill_poly(im, pts, (248, 244, 236))
        # black keel
        line(im, cx, 18, cx, 51, BLACK)
        # red bands
        for y in range(28, 36):
            for x in range(cx - 9, cx + 10):
                if im.getpixel((x, y))[3] > 0:
                    pset(im, x, y, RED if abs(x - cx) % 3 else RED_S)
        # eyes on both sides of bow (if south we see bow? S = looking at south face = maybe transom)
        # show eyes if facing south (bow toward camera-ish) or both
        for sign in (-1, 1):
            fill_ellipse(im, cx + sign * 6, 24, 3, 3, WHITE)
            fill_ellipse(im, cx + sign * 6, 24, 1.8, 1.8, BLACK)
        # gunwale black
        for x in range(cx - 10, cx + 11):
            pset(im, x, 30, BLACK)
    return outline_sprite(im, INK)


def make_tatala() -> dict:
    w, h = 128, 64
    sheet = new(w * 4, h)
    meta = {"frameWidth": w, "frameHeight": h, "dirs": list(DIRS), "individuals": []}
    ddir = OUT / "props" / "tatala"
    for i, d in enumerate(DIRS):
        fr = draw_tatala(d, w, h)
        sheet.paste(fr, (i * w, 0), fr)
        name = f"tatala_{d}.png"
        save(fr, ddir / name)
        meta["individuals"].append(f"props/tatala/{name}")
    save(sheet, OUT / "props" / "tatala_sheet.png")
    return meta


# ---------------------------------------------------------------------------
# Buildings & props
# ---------------------------------------------------------------------------

def draw_traditional_house() -> Image.Image:
    """Semi-subterranean stone house with low wooden/thatch roof (vahay)."""
    w, h = 128, 128
    im = new(w, h)
    shadow_ellipse(im, 64, 118, 48, 10, 90)
    # excavated berm / stone retaining
    fill_poly(im, [(16, 100), (28, 78), (100, 78), (112, 100), (104, 114), (24, 114)], (132, 118, 96))
    fill_poly(im, [(22, 100), (30, 82), (98, 82), (106, 100)], (110, 98, 80))
    # stone blocks
    for y in range(82, 112):
        for x in range(20, 108):
            if im.getpixel((x, y))[3] == 0:
                continue
            if (x // 5 + y // 4) % 3 == 0:
                pset(im, x, y, (96, 86, 70))
            elif (x + y) % 7 == 0:
                pset(im, x, y, (150, 136, 112))
    # wooden upper / doorway recess
    fill_poly(im, [(36, 86), (40, 62), (88, 62), (92, 86)], (118, 84, 52))
    rect(im, 40, 62, 88, 86, (138, 98, 58))
    # dark door (low)
    rect(im, 54, 72, 74, 96, (40, 28, 20))
    rect(im, 56, 74, 72, 94, (52, 36, 24))
    # thatch / sloped roof sitting low
    fill_poly(im, [(18, 68), (64, 28), (110, 68), (100, 74), (64, 42), (28, 74)], (146, 118, 58))
    fill_poly(im, [(24, 66), (64, 32), (104, 66), (64, 46)], (168, 138, 70))
    # thatch lines
    for i in range(-30, 31, 3):
        x = 64 + i
        y0 = 36 + abs(i) * 0.85
        y1 = 66
        line(im, x, int(y0), x, int(y1), (120, 92, 40) if i % 6 == 0 else (158, 128, 60))
    # ridge
    line(im, 64, 28, 64, 44, (96, 72, 32))
    # small drying rack / flying-fish rack suggestion on side
    rect(im, 96, 90, 97, 112, (90, 64, 36))
    rect(im, 108, 90, 109, 112, (90, 64, 36))
    rect(im, 96, 94, 108, 95, (90, 64, 36))
    return outline_sprite(im, INK)


def draw_tagakal() -> Image.Image:
    """Raised wooden work / rest pavilion (涼亭)."""
    w, h = 128, 128
    im = new(w, h)
    shadow_ellipse(im, 64, 118, 42, 9, 80)
    # posts
    posts = [(32, 108), (96, 108), (40, 88), (88, 88)]
    for i, (x, y) in enumerate(posts):
        tall = 52 if i >= 2 else 44
        rect(im, x, y - tall, x + 4, y, (120, 84, 48))
        rect(im, x + 4, y - tall, x + 4, y, (88, 60, 32))
    # platform floor
    fill_poly(im, [(24, 78), (40, 64), (104, 64), (88, 78), (88, 86), (24, 86)], (176, 140, 88))
    rect(im, 28, 76, 90, 86, (160, 124, 72))
    # floor planks
    for y in range(66, 86, 3):
        line(im, 30, y, 96, y, (130, 96, 54))
    # roof — four-slope thatch / wood
    fill_poly(im, [(16, 58), (64, 18), (112, 58), (100, 66), (64, 36), (28, 66)], (196, 86, 64))
    fill_poly(im, [(22, 56), (64, 22), (106, 56), (64, 40)], (220, 120, 80))
    for i in range(-36, 37, 4):
        line(im, 64 + i, 24 + abs(i) // 1, 64 + i, 58, (160, 60, 44) if i % 8 == 0 else (210, 110, 74))
    line(im, 64, 18, 64, 40, (120, 48, 32))
    # sitting figure suggestion? leave empty — NPC will stand near
    return outline_sprite(im, INK)


def draw_clinic() -> Image.Image:
    w, h = 96, 128
    im = new(w, h)
    shadow_ellipse(im, 48, 118, 36, 8, 80)
    # concrete modern-island clinic
    rect(im, 14, 50, 82, 114, (232, 228, 218))
    rect(im, 16, 52, 80, 112, (244, 240, 230))
    # shade
    rect(im, 76, 52, 80, 112, (214, 210, 198))
    # roof
    fill_poly(im, [(10, 54), (48, 24), (86, 54), (80, 58), (16, 58)], (46, 122, 118))
    fill_poly(im, [(16, 52), (48, 28), (80, 52)], (64, 150, 144))
    # cross sign
    fill_ellipse(im, 48, 44, 8, 8, WHITE)
    rect(im, 46, 38, 50, 50, RED)
    rect(im, 42, 42, 54, 46, RED)
    # door
    rect(im, 40, 86, 56, 112, (64, 110, 108))
    rect(im, 42, 88, 54, 110, (80, 140, 136))
    # windows
    rect(im, 20, 70, 34, 86, (160, 210, 214))
    rect(im, 62, 70, 76, 86, (160, 210, 214))
    line(im, 27, 70, 27, 86, (80, 120, 124))
    line(im, 20, 78, 34, 78, (80, 120, 124))
    line(im, 69, 70, 69, 86, (80, 120, 124))
    line(im, 62, 78, 76, 78, (80, 120, 124))
    # step
    rect(im, 36, 112, 60, 116, (200, 196, 184))
    return outline_sprite(im, INK)


def draw_shop() -> Image.Image:
    w, h = 96, 112
    im = new(w, h)
    shadow_ellipse(im, 48, 104, 34, 8, 80)
    rect(im, 12, 48, 84, 100, (214, 154, 86))
    rect(im, 14, 50, 82, 98, (228, 176, 104))
    rect(im, 78, 50, 82, 98, (188, 128, 70))
    fill_poly(im, [(8, 52), (48, 20), (88, 52)], (188, 64, 52))
    fill_poly(im, [(14, 50), (48, 24), (82, 50)], (210, 86, 64))
    # awning
    for x in range(16, 80, 6):
        col = (236, 236, 228) if (x // 6) % 2 == 0 else (200, 48, 42)
        rect(im, x, 58, x + 5, 70, col)
    # opening
    rect(im, 28, 72, 68, 98, (60, 40, 28))
    # fruit crate hint
    rect(im, 18, 88, 30, 98, (140, 80, 40))
    pset(im, 22, 86, (80, 160, 70))
    pset(im, 26, 86, (220, 80, 60))
    return outline_sprite(im, INK)


def draw_church() -> Image.Image:
    w, h = 96, 144
    im = new(w, h)
    shadow_ellipse(im, 48, 134, 34, 8, 80)
    rect(im, 20, 70, 76, 128, (236, 232, 222))
    rect(im, 22, 72, 74, 126, (248, 246, 238))
    fill_poly(im, [(16, 74), (48, 36), (80, 74)], (90, 90, 98))
    fill_poly(im, [(22, 72), (48, 40), (74, 72)], (120, 120, 128))
    # steeple
    rect(im, 44, 28, 52, 50, (236, 232, 222))
    fill_poly(im, [(40, 30), (48, 12), (56, 30)], (90, 90, 98))
    # cross
    line(im, 48, 8, 48, 18, (80, 80, 86))
    line(im, 44, 12, 52, 12, (80, 80, 86))
    # door + arch
    fill_ellipse(im, 48, 100, 10, 8, (80, 70, 60))
    rect(im, 38, 100, 58, 126, (90, 78, 64))
    rect(im, 40, 102, 56, 124, (110, 92, 74))
    # window
    fill_ellipse(im, 48, 86, 6, 8, (160, 190, 210))
    return outline_sprite(im, INK)


def draw_airport() -> Image.Image:
    w, h = 128, 96
    im = new(w, h)
    shadow_ellipse(im, 64, 88, 50, 8, 70)
    # terminal
    rect(im, 18, 40, 110, 84, (220, 224, 226))
    rect(im, 20, 42, 108, 82, (236, 240, 242))
    rect(im, 18, 36, 110, 46, (48, 110, 150))
    # control cab
    rect(im, 86, 22, 108, 42, (200, 210, 216))
    rect(im, 88, 24, 106, 38, (140, 200, 220))
    # doors / windows
    for x in (28, 46, 64):
        rect(im, x, 52, x + 14, 72, (140, 200, 220))
    rect(im, 86, 58, 104, 82, (70, 90, 110))
    return outline_sprite(im, INK)


def draw_taro(variant: int = 0) -> Image.Image:
    w = h = 48
    im = new(w, h)
    shadow_ellipse(im, 24, 42, 12, 5, 60)
    # corm / soil mound
    fill_ellipse(im, 24, 40, 8, 4, (92, 64, 36))
    # big peltate leaves (3–5)
    leaves = [
        (24, 16, 0),
        (14, 20, -40),
        (34, 20, 40),
        (18, 10, -15),
        (30, 11, 18),
    ]
    greens = [
        (46, 130, 70),
        (36, 112, 58),
        (70, 158, 86),
        (40, 120, 64),
        (58, 148, 80),
    ]
    offset = variant * 7
    for i, (lx, ly, ang) in enumerate(leaves):
        a = math.radians(ang + offset)
        ca, sa = math.cos(a), math.sin(a)
        # leaf ellipse rotated
        rx, ry = 8, 11
        for y in range(0, h):
            for x in range(0, w):
                dx, dy = x - lx, y - ly
                # rotate into leaf space
                lx_ = dx * ca + dy * sa
                ly_ = -dx * sa + dy * ca
                if (lx_ / rx) ** 2 + (ly_ / ry) ** 2 <= 1:
                    pset(im, x, y, greens[(i + variant) % len(greens)])
        # stem
        line(im, 24, 40, int(lx), int(ly + 6), (40, 90, 50))
        # vein
        line(im, int(lx), int(ly + 6), int(lx + 3 * sa), int(ly - 6), (24, 80, 40))
    return outline_sprite(im, (28, 42, 24, 230))


def draw_palm(variant: int = 0) -> Image.Image:
    w, h = 64, 128
    im = new(w, h)
    shadow_ellipse(im, 32, 122, 16, 6, 70)
    # trunk slightly curved
    curve = (-1 if variant % 2 == 0 else 1) * (2 + variant)
    for y in range(36, 122):
        t = (y - 36) / 86
        x = 32 + int(curve * t * t)
        thick = 4 + int(2 * t)
        rect(im, x - thick, y, x + thick - 1, y, (150, 112, 60) if y % 5 else (120, 86, 44))
        pset(im, x + thick - 1, y, (96, 68, 36))
    # crown
    cx, cy = 32 + curve, 34
    fronds = 7
    for i in range(fronds):
        ang = -160 + i * 40 + variant * 8
        a = math.radians(ang)
        length = 28 if i % 2 == 0 else 24
        # midrib
        points = []
        for k in range(length):
            px = cx + math.cos(a) * k
            py = cy + math.sin(a) * k + (k * k) * 0.02
            points.append((px, py))
            pset(im, int(px), int(py), (28, 90, 40))
            # leaflets
            if k > 3 and k % 2 == 0:
                side = 1 if (k // 2 + i) % 2 == 0 else -1
                pa = a + side * math.radians(55)
                for m in range(6):
                    pset(im, int(px + math.cos(pa) * m), int(py + math.sin(pa) * m),
                         (46, 140, 64) if m < 4 else (30, 100, 48))
    # coconuts
    for ox, oy in ((-3, 4), (3, 5), (0, 7)):
        fill_ellipse(im, cx + ox, cy + oy + 4, 2.4, 2.6, (92, 62, 30))
        pset(im, int(cx + ox), int(cy + oy + 3), (120, 86, 46))
    return outline_sprite(im, (28, 42, 24, 230))


def draw_flying_fish(frame: int) -> Image.Image:
    w, h = 48, 24
    im = new(w, h)
    # body
    wing_up = [0, -3, 0, 3][frame]
    fill_ellipse(im, 24, 13, 14, 4.2, (210, 220, 230))
    fill_ellipse(im, 18, 13, 6, 3.2, (70, 110, 150))  # dark back / hint of black wing species
    # eye
    pset(im, 10, 12, (20, 20, 24))
    pset(im, 11, 12, (240, 240, 244))
    # beak
    line(im, 6, 13, 10, 13, (40, 44, 50))
    # tail
    fill_poly(im, [(36, 13), (46, 8), (42, 13), (46, 18)], (180, 196, 210))
    # pectoral "wings"
    fill_poly(im, [(18, 12), (16, 12 - 8 + wing_up), (30, 11 - 6 + wing_up), (28, 12)], (36, 48, 80))
    fill_poly(im, [(20, 11), (22, 11 - 5 + wing_up), (28, 11 - 4 + wing_up)], (80, 120, 170))
    fill_poly(im, [(18, 14), (16, 18 - wing_up), (28, 16), (26, 14)], (36, 48, 80))
    return outline_sprite(im, INK)


def draw_coconut() -> Image.Image:
    im = new(16, 16)
    fill_ellipse(im, 8, 8, 6, 6.4, (110, 78, 42))
    fill_ellipse(im, 6, 6, 3, 3, (140, 102, 58))
    pset(im, 6, 5, (40, 28, 16))
    pset(im, 8, 5, (40, 28, 16))
    pset(im, 7, 7, (40, 28, 16))
    return outline_sprite(im, INK)


# ---------------------------------------------------------------------------
# UI motifs & ground textures
# ---------------------------------------------------------------------------

def draw_wave_motif(size: int = 32) -> Image.Image:
    im = new(size, size)
    # concentric wave / eye
    cx = cy = size / 2
    for r, col in ((14, RED), (11, BLACK), (8, WHITE), (5, RED), (3, BLACK)):
        # ring
        for y in range(size):
            for x in range(size):
                d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                if abs(d - r) < 1.1:
                    pset(im, x, y, col)
    pset(im, size // 2, size // 2, WHITE)
    return im


def draw_eye_motif(size: int = 24) -> Image.Image:
    im = new(size, size)
    cx = cy = size / 2
    fill_ellipse(im, cx, cy, 10, 7, WHITE)
    fill_ellipse(im, cx, cy, 8, 5.5, BLACK)
    fill_ellipse(im, cx, cy, 4, 3, RED)
    fill_ellipse(im, cx + 1, cy - 1, 1.6, 1.4, WHITE)
    return outline_sprite(im, INK)


def pixel_texture(kind: str, size: int = 128) -> Image.Image:
    im = Image.new("RGB", (size, size), (0, 0, 0))
    rng = lambda x, y, a, b: (((x * 374761393 + y * 668265263 + a * 127) ^ b) & 0xFFFFFFFF)
    for y in range(size):
        for x in range(size):
            n = rng(x, y, size, 19)
            n2 = rng(x // 2, y // 2, 7, 3)
            if kind == "grass":
                base = (58, 122, 48) if (n % 5) else (46, 108, 40)
                if n2 % 7 == 0:
                    base = (70, 138, 56)
                if (x + y * 3) % 11 == 0:
                    base = (40, 90, 36)
            elif kind == "sand":
                base = (222, 198, 148) if n % 4 else (210, 184, 132)
                if n2 % 5 == 0:
                    base = (232, 210, 164)
            elif kind == "rock":
                base = (72, 66, 68) if n % 3 else (56, 52, 54)
                if n2 % 6 == 0:
                    base = (90, 84, 86)
            elif kind == "road":
                base = (120, 108, 92) if n % 4 else (108, 96, 82)
                if y % 32 < 1 or x % 32 < 1:
                    base = (96, 86, 72)
            elif kind == "terrace":
                base = (70, 140, 72)
                if y % 8 == 0:
                    base = (48, 110, 120)  # irrigation glint
                elif n % 5 == 0:
                    base = (86, 158, 80)
            elif kind == "stone":
                bx, by = x // 8, y // 6
                mortar = (x % 8 == 0) or (y % 6 == 0)
                if mortar:
                    base = (120, 112, 100)
                else:
                    hsh = rng(bx, by, 1, 2)
                    base = (140 + hsh % 30, 128 + hsh % 20, 108 + hsh % 16)
            elif kind == "wood":
                base = (140, 98, 58) if (y // 3 + n % 2) % 2 == 0 else (124, 86, 48)
                if x % 16 == 0:
                    base = (96, 64, 36)
            elif kind == "thatch":
                base = (170, 136, 64) if (x + y) % 3 else (150, 118, 52)
                if y % 4 == 0:
                    base = (120, 92, 40)
            else:
                base = (128, 128, 128)
            im.putpixel((x, y), base)
    return im


def ui_paper_card(w: int = 64, h: int = 64) -> Image.Image:
    im = Image.new("RGBA", (w, h), (247, 239, 217, 255))
    d = ImageDraw.Draw(im)
    # fibers
    for i in range(80):
        x, y = (i * 17) % w, (i * 29) % h
        pset(im, x, y, (232, 220, 190, 180))
    # corner motif
    motif = draw_wave_motif(16)
    im.alpha_composite(motif, (2, 2))
    im.alpha_composite(motif, (w - 18, h - 18))
    return im


# ---------------------------------------------------------------------------
# Contact sheet + manifest
# ---------------------------------------------------------------------------

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest: dict = {"version": "0.1.0", "filter": "nearest", "assets": {}}

    print("Characters…")
    for kind in ("player", "elder", "villager", "clinic", "tourist"):
        _, meta = make_character_sheet(kind)
        manifest["assets"][kind] = {
            "type": "character_sheet",
            "path": f"characters/{kind}_sheet.png",
            "frameWidth": 64,
            "frameHeight": 64,
            "directions": list(DIRS),
            "framesPerDir": 4,
            "individualsDir": f"characters/{kind}/",
            **meta,
        }

    print("Tatala…")
    manifest["assets"]["tatala"] = {
        "type": "prop_directional",
        "path": "props/tatala_sheet.png",
        "frameWidth": 128,
        "frameHeight": 64,
        "notes": "Single-hull double-ended Tao plank canoe. NO outrigger / 無舷外浮木.",
        **make_tatala(),
    }

    print("Buildings…")
    buildings = {
        "house_traditional": draw_traditional_house(),
        "tagakal": draw_tagakal(),
        "clinic": draw_clinic(),
        "shop": draw_shop(),
        "church": draw_church(),
        "airport": draw_airport(),
    }
    for name, im in buildings.items():
        path = OUT / "buildings" / f"{name}.png"
        save(im, path)
        manifest["assets"][name] = {
            "type": "building_billboard",
            "path": f"buildings/{name}.png",
            "width": im.size[0],
            "height": im.size[1],
        }

    print("Plants & fish…")
    for i in range(3):
        im = draw_taro(i)
        save(im, OUT / "props" / f"taro_{i}.png")
    manifest["assets"]["taro"] = {
        "type": "prop_variants",
        "paths": [f"props/taro_{i}.png" for i in range(3)],
        "width": 48,
        "height": 48,
    }
    for i in range(3):
        im = draw_palm(i)
        save(im, OUT / "props" / f"palm_{i}.png")
    manifest["assets"]["coconut_palm"] = {
        "type": "prop_variants",
        "paths": [f"props/palm_{i}.png" for i in range(3)],
        "width": 64,
        "height": 128,
    }
    fish_sheet = new(48 * 4, 24)
    for i in range(4):
        fr = draw_flying_fish(i)
        fish_sheet.paste(fr, (i * 48, 0), fr)
        save(fr, OUT / "props" / f"flying_fish_{i}.png")
    save(fish_sheet, OUT / "props" / "flying_fish_sheet.png")
    manifest["assets"]["flying_fish"] = {
        "type": "fx_sheet",
        "path": "props/flying_fish_sheet.png",
        "frameWidth": 48,
        "frameHeight": 24,
        "frames": 4,
    }
    save(draw_coconut(), OUT / "props" / "coconut.png")
    manifest["assets"]["coconut"] = {"type": "item", "path": "props/coconut.png", "width": 16, "height": 16}

    print("UI & textures…")
    save(draw_wave_motif(32), OUT / "ui" / "motif_wave.png")
    save(draw_eye_motif(24), OUT / "ui" / "motif_eye.png")
    save(ui_paper_card(64, 64), OUT / "ui" / "paper_tile.png")
    manifest["assets"]["ui_motifs"] = {
        "wave": "ui/motif_wave.png",
        "eye": "ui/motif_eye.png",
        "paper": "ui/paper_tile.png",
    }

    tex_dir = OUT / "textures"
    for kind in ("grass", "sand", "rock", "road", "terrace", "stone", "wood", "thatch"):
        im = pixel_texture(kind, 128)
        save(im, tex_dir / f"{kind}.png")
    manifest["assets"]["textures"] = {
        k: f"textures/{k}.png" for k in ("grass", "sand", "rock", "road", "terrace", "stone", "wood", "thatch")
    }

    # contact sheet for Larry to inspect
    print("Contact sheet…")
    thumbs = []
    thumbs.append(("player S", draw_character("player", "s", 0)))
    thumbs.append(("elder S", draw_character("elder", "s", 0)))
    thumbs.append(("clinic S", draw_character("clinic", "s", 0)))
    thumbs.append(("tourist S", draw_character("tourist", "s", 0)))
    thumbs.append(("tatala E", draw_tatala("e")))
    thumbs.append(("house", draw_traditional_house().resize((64, 64), Image.Resampling.NEAREST)))
    thumbs.append(("tagakal", draw_tagakal().resize((64, 64), Image.Resampling.NEAREST)))
    thumbs.append(("clinic bldg", draw_clinic().resize((48, 64), Image.Resampling.NEAREST)))
    thumbs.append(("taro", draw_taro(0)))
    thumbs.append(("palm", draw_palm(0).resize((32, 64), Image.Resampling.NEAREST)))
    thumbs.append(("fish", draw_flying_fish(1)))
    # layout
    contact = Image.new("RGBA", (720, 280), (40, 48, 56, 255))
    x = 8
    for label, im in thumbs:
        contact.paste(im, (x, 40), im if im.mode == "RGBA" else None)
        x += im.size[0] + 12
    save(contact, OUT / "CONTACT_SHEET.png")

    DATA.mkdir(parents=True, exist_ok=True)
    man_path = DATA / "asset_manifest.json"
    man_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  wrote {man_path.relative_to(ROOT)}")
    print("Done.")


if __name__ == "__main__":
    main()
