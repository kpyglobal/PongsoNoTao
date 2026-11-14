"""Shift visitor_m's skin toward visitor's skin (Lab mean of hand-picked cheek/neck samples).
Skin mask = YCrCb/HSV skin range limited to face/neck/hand boxes. Usage: python3 scripts/skin_match.py [strength]"""
import sys
import numpy as np, cv2
K = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
SRC = 'art-src/portraits/visitor_m.jpg'; REF = 'art-src/portraits/visitor.jpg'
REF_S = [(380, 330, 470, 380), (440, 440, 520, 490)]          # her cheek, neck (864x1152)
TGT_S = [(400, 320, 500, 360), (420, 410, 500, 470)]          # his cheek, neck
REGION = [(280, 130, 640, 540), (0, 640, 175, 900)]           # his face+neck, hand
def mean_lab(lab, boxes):
    return np.concatenate([lab[y0:y1, x0:x1].reshape(-1, 3) for x0, y0, x1, y1 in boxes]).mean(0)
t = cv2.imread(SRC); r = cv2.imread(REF)
lt = cv2.cvtColor(t, cv2.COLOR_BGR2LAB).astype(np.float32); lr = cv2.cvtColor(r, cv2.COLOR_BGR2LAB).astype(np.float32)
d = mean_lab(lr, REF_S) - mean_lab(lt, TGT_S); print('delta Lab', d.round(1))
ycc = cv2.cvtColor(t, cv2.COLOR_BGR2YCrCb).astype(int); hsv = cv2.cvtColor(t, cv2.COLOR_BGR2HSV)
m = (ycc[..., 1] > 135) & (ycc[..., 2] < 130) & (ycc[..., 0] > 80) & (hsv[..., 0] < 22) & (hsv[..., 1] > 30)
reg = np.zeros(m.shape, bool)
for x0, y0, x1, y1 in REGION: reg[y0:y1, x0:x1] = True
m = (m & reg).astype(np.uint8) * 255
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
soft = cv2.GaussianBlur(m, (0, 0), 2.5).astype(np.float32)[..., None] / 255.0
out = np.clip(lt + d * K * soft, 0, 255).astype(np.uint8)
cv2.imwrite(SRC, cv2.cvtColor(out, cv2.COLOR_LAB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 95])
cv2.imwrite('/tmp/skinmask.png', m)
