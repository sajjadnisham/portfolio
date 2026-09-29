"""
Round portrait for the final "Connect" scene, from the photo in
tools/source/photo.webp: background removed, placed on a soft grey studio
gradient (the site is black & white), cropped to head and shoulders.

  python tools/make_avatar.py
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from rembg import new_session, remove

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "source", "photo.webp")
OUT = os.path.join(HERE, "..", "assets", "img", "avatar.webp")
SIZE = 480


def main():
    im = Image.open(SRC).convert("RGB")
    cut = remove(im, session=new_session("isnet-general-use"))
    w, h = im.size
    side = int(w * 1.15)          # head and shoulders with a little air above the hair
    cx, cy = w // 2, int(h * 0.4)
    box = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
    fg = cut.crop(box).resize((SIZE, SIZE), Image.LANCZOS)
    # the cyan backdrop spills onto hair edges and the white shirt: pull any
    # cyan cast (green and blue above red) back toward neutral
    a = np.array(fg).astype(np.int16)
    r, gg, b = a[..., 0], a[..., 1], a[..., 2]
    cyan = (gg > r + 6) & (b > r + 6)
    a[..., 1] = np.where(cyan, np.minimum(gg, r + 4), gg)
    a[..., 2] = np.where(cyan, np.minimum(b, r + 6), b)
    fg = Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")

    # studio backdrop: light grey centre falling off to charcoal
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    r = np.hypot(xx - SIZE * 0.5, yy - SIZE * 0.38) / (SIZE * 0.75)
    g = np.clip(205 - r * 150, 55, 210).astype(np.uint8)
    bg = Image.fromarray(np.dstack([g, g, g + 2]).astype(np.uint8)).convert("RGBA")
    bg.alpha_composite(fg)

    circle = Image.new("L", (SIZE * 4, SIZE * 4), 0)
    ImageDraw.Draw(circle).ellipse((0, 0, SIZE * 4 - 1, SIZE * 4 - 1), fill=255)
    bg.putalpha(circle.resize((SIZE, SIZE), Image.LANCZOS))
    bg.save(OUT, "WEBP", quality=90, method=6)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
