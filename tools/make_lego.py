"""
Rebuild the painted backgrounds as toy-brick mosaics: every TILE×TILE block
becomes one 1×1 plastic brick (its average colour, slightly lifted and
posterised like moulded plastic) with a bevelled edge and a raised stud.

  python tools/make_lego.py

Reads the original paintings from tools/source/*-painted.webp and writes
assets/img/hospital.webp and assets/img/igmh.webp (same 941×1672 canvas,
so every layer on top still lines up).
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(__file__)
TILE = 8                     # px per brick on the 941-wide canvas (~118 bricks across)
DETAIL = 0.2                 # how much of the painting's line work shows inside each brick
JOBS = [("hospital-painted.webp", "hospital.webp"), ("igmh-painted.webp", "igmh.webp")]


def brick_sprite(t, ss=4):
    """Shading for one brick (multiplicative light map), drawn large then downsampled."""
    s = t * ss
    light = Image.new("L", (s, s), 128)
    d = ImageDraw.Draw(light)
    e = max(1, int(s * 0.07))
    # bevel: lit top/left edges, shaded bottom/right, dark gap between bricks
    d.rectangle([0, 0, s - 1, s - 1], fill=92)
    d.rectangle([e, e, s - 1 - e, s - 1 - e], fill=128)
    d.polygon([(e, e), (s - e, e), (s - 2 * e, 2 * e), (2 * e, 2 * e)], fill=150)
    d.polygon([(e, e), (2 * e, 2 * e), (2 * e, s - 2 * e), (e, s - e)], fill=145)
    d.polygon([(s - e, e), (s - e, s - e), (s - 2 * e, s - 2 * e), (s - 2 * e, 2 * e)], fill=110)
    d.polygon([(e, s - e), (s - e, s - e), (s - 2 * e, s - 2 * e), (2 * e, s - 2 * e)], fill=105)
    # stud: a raised disc with a soft shadow, a lit rim and a highlight
    r = s * 0.29
    c = s / 2
    sh = Image.new("L", (s, s), 0)
    ImageDraw.Draw(sh).ellipse([c - r + e * 0.6, c - r + e * 1.2, c + r + e * 0.6, c + r + e * 1.2], fill=255)
    sh = sh.filter(ImageFilter.GaussianBlur(s * 0.03))
    light = Image.composite(Image.new("L", (s, s), 84), light, sh)
    d = ImageDraw.Draw(light)
    d.ellipse([c - r, c - r, c + r, c + r], fill=128)
    d.arc([c - r, c - r, c + r, c + r], 160, 340, fill=175, width=max(1, int(s * 0.06)))
    d.arc([c - r, c - r, c + r, c + r], 340, 160, fill=96, width=max(1, int(s * 0.06)))
    hr = r * 0.32
    d.ellipse([c - r * 0.45 - hr, c - r * 0.45 - hr, c - r * 0.45 + hr, c - r * 0.45 + hr], fill=190)
    light = light.resize((t, t), Image.LANCZOS)
    return np.asarray(light, np.float32) / 128.0


def mosaic(src):
    im = Image.open(src).convert("RGB")
    W, H = im.size
    gw, gh = -(-W // TILE), -(-H // TILE)
    small = im.resize((gw, gh), Image.BOX)
    a = np.asarray(small, np.float32) / 255
    # moulded plastic: a little contrast and lift, posterised to a brick palette
    # brick colours: averaged, then lifted (the paintings are dark line art) and
    # posterised a little, like a set of moulded plastic tones
    a = np.clip(a, 0, 1) ** 0.72
    a = np.round(a * 15) / 15
    big = np.repeat(np.repeat(a, TILE, 0), TILE, 1)[:H, :W]
    orig = (np.asarray(im, np.float32) / 255) ** 0.72
    big = big * (1 - DETAIL) + orig * DETAIL
    shade = np.tile(brick_sprite(TILE), (gh, gw))[:H, :W, None]
    out = np.clip(big * shade + (shade - 1).clip(0) * 0.12, 0, 1)
    return Image.fromarray((out * 255).astype(np.uint8))


def main():
    for src, dst in JOBS:
        img = mosaic(os.path.join(HERE, "source", src))
        out = os.path.join(HERE, "..", "assets", "img", dst)
        img.save(out, "WEBP", quality=86, method=6)
        print("wrote", out, img.size, os.path.getsize(out) // 1024, "KB")


if __name__ == "__main__":
    main()
