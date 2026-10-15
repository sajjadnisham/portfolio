"""
Build the office scene (Oncology department + NURF Pharmacy counter) on the
stage's 941×1672 portrait canvas from tools/source/oncology-photo.jpg.

  python tools/make_oncology.py

Writes
  assets/img/oncology.webp        background: boards relettered ("ONCOLOGY",
                                  "NURF PHARMACY"), all the people removed, ceiling and floor extended
  assets/img/oncology-front.webp  the walls/counter in front of him once he's
                                  behind them (doorway and pharmacy window cut
                                  out; the monitors and the sign on the counter
                                  stay in front)
Camera used by hero3d.js (canvas px): horizon 671, f 1061, eye 1.6 m.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "source", "oncology-photo.jpg")
OUT = os.path.join(HERE, "..", "assets", "img")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
W, H = 941, 1672
K, OX, OY = 0.6, 10, 380                  # photo → canvas

# everyone in the photo, as rectangles or polygons (photo px); the monitors and
# the counter sign in front of the pharmacists are left untouched
PEOPLE = [
    (486, 436, 752, 1024),                                          # the customer
    (726, 452, 922, 712),                                           # the front pharmacist
    (224, 576, 340, 796),                                           # seated patient, in the department
    (304, 512, 384, 720),                                           # staff walking away, in the department
    [(936, 494), (1066, 494), (1066, 668), (1012, 668), (1012, 610), (936, 610)],   # pharmacist at the shelves
    [(1114, 536), (1264, 536), (1264, 640), (1172, 640), (1172, 730), (1114, 730)], # pharmacist at the right screen
]
PH_MASK = [(596, 108), (1158, 40), (1156, 142), (598, 198)]  # "PHARMACY"
ON_MASK = [(194, 144), (416, 180), (414, 238), (194, 206)]   # "UROLOGY"


def lama(img, mask):
    from simple_lama_inpainting import SimpleLama
    return SimpleLama()(img, mask).crop((0, 0) + img.size)


def coeffs(src, dst):
    """Perspective coefficients mapping dst quad → src rect (PIL's convention)."""
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]
        B += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()


def letter(img, text, quad, color, size=200):
    """Draw text filling the quad (TL, TR, BR, BL), in perspective."""
    f = ImageFont.truetype(FONT, size)
    l, t, r, b = f.getbbox(text)
    tw, th = r - l, b - t
    lay = Image.new("L", (tw + 8, th + 8), 0)
    ImageDraw.Draw(lay).text((4 - l, 4 - t), text, font=f, fill=255)
    rect = [(0, 0), (lay.width, 0), (lay.width, lay.height), (0, lay.height)]
    warped = lay.transform(img.size, Image.PERSPECTIVE, coeffs(rect, quad), Image.BICUBIC)
    shade = warped.filter(ImageFilter.GaussianBlur(2)).point(lambda v: v * 0.35)
    img.paste((0, 0, 0), (2, 3), Image.composite(shade, Image.new("L", img.size, 0), shade).crop((0, 0, img.width - 2, img.height - 3)))
    img.paste(color, (0, 0), warped)


def main():
    photo = Image.open(SRC).convert("RGB")
    m = Image.new("L", photo.size, 0)
    d = ImageDraw.Draw(m)
    for b in PEOPLE:
        d.polygon(b, fill=255) if isinstance(b, list) else d.rectangle(b, fill=255)
    d.polygon(PH_MASK, fill=255)
    d.polygon(ON_MASK, fill=255)
    clean = lama(photo, m.filter(ImageFilter.MaxFilter(7)))
    # relettering, in the boards' perspective
    letter(clean, "NURF PHARMACY", [(516, 132), (1150, 56), (1144, 131), (520, 195)], (24, 92, 196))
    letter(clean, "ONCOLOGY", [(203, 153), (409, 190), (409, 228), (203, 196)], (206, 211, 222))

    # canvas: photo, then ceiling and floor outpainted around it
    pw, ph = round(photo.width * K), round(photo.height * K)
    small = clean.resize((pw, ph), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), (200, 200, 200))
    canvas.paste(small, (OX, OY))
    mm = Image.new("L", (W, H), 255)
    ImageDraw.Draw(mm).rectangle([OX + 2, OY + 2, OX + pw - 3, OY + ph - 3], fill=0)
    full = lama(canvas, mm)
    keep = Image.new("L", (W, H), 0)
    ImageDraw.Draw(keep).rectangle([OX + 4, OY + 4, OX + pw - 5, OY + ph - 5], fill=255)
    full = Image.composite(canvas, full, keep.filter(ImageFilter.GaussianBlur(2)))
    a = np.asarray(full, np.float32)
    ys = np.arange(H, dtype=np.float32)[:, None, None]
    a *= np.clip(0.12 + 0.88 * (ys / 170), 0.12, 1)                  # top fades to dark
    a *= np.clip(1 - (ys - 1110) / 700, 0.18, 1)                       # floor darkens for the text
    full = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    full.save(os.path.join(OUT, "oncology.webp"), "WEBP", quality=86, method=6)

    # front layer: cut out the doorway and the pharmacy window (above the counter),
    # but keep what stands on the counter in front of him
    P = lambda x, y: (OX + x * K, OY + y * K)
    alpha = Image.new("L", (W, H), 255)
    da = ImageDraw.Draw(alpha)
    da.rectangle([*P(219, 300), *P(432, 918)], fill=0)                                  # doorway
    da.polygon([P(552, 266), P(1342, 194), P(1342, 744), P(552, 730)], fill=0)          # window
    # (the monitor behind the customer went with him, so only these remain)
    for b in [(906, 612, 1012, 716), (936, 626, 1044, 742), (1166, 638, 1322, 738)]:
        da.rectangle([*P(b[0], b[1]), *P(b[2], b[3])], fill=255)                        # middle monitor, sign, right monitor
    front = full.convert("RGBA")
    front.putalpha(alpha)
    front.save(os.path.join(OUT, "oncology-front.webp"), "WEBP", quality=88)
    print("done", pw, ph)


if __name__ == "__main__":
    main()
