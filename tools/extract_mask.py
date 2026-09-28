"""
Fifth pass: the "puts the mask on by hand" frames.

  python tools/extract_mask.py

Reads tools/source/mask-a..d.jpg (drawn over the page-3 hospital plate,
900x1600): a) pulls the mask from his pocket, b) lifts it, c) hooks the
ear loops, d) hands down, mask on. Each is scaled to the 941x1672 canvas,
cut out, and the light-blue mask is tinted white to match the page-5 pose.
Writes assets/img/mask-1..4.webp and tools/mask-frames.json (figure boxes).
"""
import json
import os

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

from extract_walk import H, OUT, SRC, W, keep_largest, solidify

HERE = os.path.dirname(__file__)
ORDER = ["mask-a.jpg", "mask-b.jpg", "mask-c.jpg", "mask-d.jpg"]


def whiten_mask(rgba):
    """Light-blue surgical mask → white, like the storyboard's page-5 pose."""
    arr = np.array(rgba)
    hsv = cv2.cvtColor(arr[..., :3], cv2.COLOR_RGB2HSV)
    blue = (hsv[..., 0] >= 85) & (hsv[..., 0] <= 115) & (hsv[..., 1] > 35) & (hsv[..., 2] > 110)
    blue = cv2.dilate(blue.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (hsv[..., 2] > 90)
    hsv[..., 1] = np.where(blue, (hsv[..., 1] * 0.12).astype(np.uint8), hsv[..., 1])
    hsv[..., 2] = np.where(blue, np.minimum(255, hsv[..., 2].astype(int) + 18).astype(np.uint8), hsv[..., 2])
    arr[..., :3] = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
    return Image.fromarray(arr)


def torso_cx(a):
    """Horizontal centre of the body at hip height (arms and shoe shadows
    don't pull it around)."""
    ys, xs = np.nonzero(a)
    top, feet = ys.min(), ys.max()
    band = (ys > top + (feet - top) * 0.5) & (ys < top + (feet - top) * 0.62)
    return int(np.median(xs[band]))


def main():
    rb = new_session("isnet-general-use")
    boxes = []
    for n, name in enumerate(ORDER, 1):
        im = Image.open(os.path.join(SRC, name)).convert("RGB").resize((W, H), Image.LANCZOS)
        crop_box = (430, 560, W, H)
        cut = solidify(keep_largest(remove(im.crop(crop_box), session=rb)))
        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        frame.paste(cut, crop_box[:2], cut)
        frame = whiten_mask(frame)
        frame.save(os.path.join(OUT, f"mask-{n}.webp"), "WEBP", quality=88, method=6)
        a = np.array(frame)[..., 3] > 60
        ys, xs = np.nonzero(a)
        feet = int(ys.max())
        box = {"cx": torso_cx(a), "feet": feet, "top": int(ys.min()), "h": int(feet - ys.min())}
        boxes.append(box)
        print(f"mask-{n}.webp", box)
    with open(os.path.join(HERE, "mask-frames.json"), "w") as f:
        json.dump(boxes, f, indent=1)


if __name__ == "__main__":
    main()
