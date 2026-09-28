"""
Third pass: cut the standing character into a puppet rig so he can walk.

  python tools/extract_rig.py

Reads assets/img/char-stand.webp and writes (all on the 941x1672 canvas):
  hero-upper.webp   everything above the coat hem (head, torso, arms, coat)
  hero-leg-l.webp   left leg (viewer's left), extended upward behind the coat
  hero-leg-r.webp   right leg, same
Hip pivots (used in script.js): left (665, 1290), right (745, 1290).
"""
import os

import cv2
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "img")
W, H = 941, 1672
HEM = 1336      # coat hem; below this only trousers and shoes
SPLIT_X = 700   # between the legs, where they meet under the coat
GAP_Y = 1400    # below this the legs are separate shapes
TROUSER = (20, 20, 24, 255)


def save(arr, name):
    Image.fromarray(arr).save(os.path.join(OUT, name), "WEBP", quality=88, method=6)
    print("wrote", name)


def main():
    stand = np.array(Image.open(os.path.join(OUT, "char-stand.webp")).convert("RGBA"))
    a = stand[..., 3] > 20
    lum = cv2.cvtColor(stand[..., :3], cv2.COLOR_RGB2GRAY)
    ys, xs = np.mgrid[0:H, 0:W]

    coat = (lum > 140) & (ys < GAP_Y)            # white coat flaps dipping below the hem
    legs = a & (ys >= HEM) & ~coat

    left = legs & (xs < SPLIT_X)
    right = legs & (xs >= SPLIT_X)
    # below the gap, assign by connected component so a crossing shoe stays whole
    low = (legs & (ys >= GAP_Y)).astype(np.uint8)
    cnt, lab, stats, cents = cv2.connectedComponentsWithStats(low)
    big = sorted(range(1, cnt), key=lambda i: -stats[i, cv2.CC_STAT_AREA])[:2]
    for i in big:
        comp = lab == i
        side = cents[i][0] < SPLIT_X
        left = np.where(comp, side, left)
        right = np.where(comp, not side, right)
    left &= legs
    right &= legs

    def leg(mask, x0, x1):
        out = np.zeros_like(stand)
        out[mask] = stand[mask]
        # extend the trouser up behind the coat so rotating never shows a gap
        ext = (ys >= 1262) & (ys < HEM + 6) & (xs >= x0) & (xs < x1) & (out[..., 3] < 200)
        out[ext] = TROUSER
        return out

    save(leg(left, 634, SPLIT_X + 2), "hero-leg-l.webp")
    save(leg(right, SPLIT_X - 2, 790), "hero-leg-r.webp")

    # clear everything below the hem that isn't coat, including faint edge
    # pixels, so no ghost outline of the legs stays behind
    upper = stand.copy()
    below = (ys >= HEM) & ~coat
    upper[..., 3] = np.where(below | left | right, 0, upper[..., 3])
    save(upper, "hero-upper.webp")


if __name__ == "__main__":
    main()
