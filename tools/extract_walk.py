"""
Fourth pass: the back-view walk frames.

  python tools/extract_walk.py

Reads tools/source/walk-*.jpg: the five back-view frames drawn over the
page-3 hospital plate (900x1600, same framing as the storyboard).
Each is scaled to the 941x1672 canvas so the figure lands in the right
place on the stage, cut out, and written as assets/img/walk-N.webp.
Order (near → far): walk-1 standing close, walk-2..4 walking away,
walk-5 looking back over his shoulder.

The figure boxes (feet centre, feet y, height) are printed and written to
tools/walk-frames.json; script.js uses them to glide between frames.
"""
import json
import os

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "source")
OUT = os.path.join(HERE, "..", "assets", "img")
W, H = 941, 1672

# source file → output frame, near to far, then the look back
ORDER = ["walk-a.jpg", "walk-b.jpg", "walk-c.jpg", "walk-d.jpg", "walk-e.jpg"]


def keep_largest(rgba):
    a = np.array(rgba)[..., 3]
    cnt, lab, stats, _ = cv2.connectedComponentsWithStats((a > 20).astype(np.uint8))
    big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    keep = cv2.dilate((lab == big).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
    arr = np.array(rgba)
    arr[..., 3] = np.where(keep, arr[..., 3], 0)
    return Image.fromarray(arr)


def solidify(rgba):
    """Black trousers on a black road come out half-transparent: make the
    silhouette solid (close gaps, fill holes) and keep only a soft edge."""
    arr = np.array(rgba)
    a = arr[..., 3]
    m = (a > 14).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    h, w = m.shape
    flood = m.copy()
    cv2.floodFill(flood, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 255)
    m = m | cv2.bitwise_not(flood)
    m = cv2.erode(m, np.ones((3, 3), np.uint8))
    soft = cv2.GaussianBlur(m, (5, 5), 0)
    arr[..., 3] = np.maximum(a, soft)
    return Image.fromarray(arr)


def main():
    rb = new_session("isnet-general-use")
    boxes = []
    for n, name in enumerate(ORDER, 1):
        im = Image.open(os.path.join(SRC, name)).convert("RGB").resize((W, H), Image.LANCZOS)
        # cut from a crop around the figure (lower-right), so the heading and
        # sign are never mistaken for the subject
        crop_box = (430, 560, W, H)
        cut = solidify(keep_largest(remove(im.crop(crop_box), session=rb)))
        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        frame.paste(cut, crop_box[:2], cut)
        frame.save(os.path.join(OUT, f"walk-{n}.webp"), "WEBP", quality=88, method=6)
        x0, y0, x1, y1 = frame.split()[-1].point(lambda v: 255 if v > 60 else 0).getbbox()
        box = {"cx": round((x0 + x1) / 2), "feet": y1, "top": y0, "h": y1 - y0}
        boxes.append(box)
        print(f"walk-{n}.webp", box)
    with open(os.path.join(HERE, "walk-frames.json"), "w") as f:
        json.dump(boxes, f, indent=1)


if __name__ == "__main__":
    main()
