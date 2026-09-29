"""
Round portrait for the final "Connect" scene, from the photo in
tools/source/photo.webp, kept exactly as photographed (cyan studio
background) and cropped to head and shoulders in a circle.

  python tools/make_avatar.py
"""
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "source", "photo.webp")
OUT = os.path.join(HERE, "..", "assets", "img", "avatar.webp")
SIZE = 480


def main():
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    # head and shoulders; the photo is narrower than the square, so extend the
    # sides with the backdrop's own cyan instead of leaving gaps
    side = int(w * 1.15)
    cx, cy = w // 2, int(h * 0.4)
    backdrop = im.getpixel((12, 12))
    canvas = Image.new("RGB", (side, side), backdrop)
    canvas.paste(im, (side // 2 - cx, side // 2 - cy))
    out = canvas.resize((SIZE, SIZE), Image.LANCZOS).convert("RGBA")

    circle = Image.new("L", (SIZE * 4, SIZE * 4), 0)
    ImageDraw.Draw(circle).ellipse((0, 0, SIZE * 4 - 1, SIZE * 4 - 1), fill=255)
    out.putalpha(circle.resize((SIZE, SIZE), Image.LANCZOS))
    out.save(OUT, "WEBP", quality=90, method=6)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
