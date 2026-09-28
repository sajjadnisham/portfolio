"""
Second pass: extra sprites for the character-acting beats.
Run after tools/extract_assets.py (it reads some of its outputs).

  python tools/extract_sprites.py path/to/portfolio.pdf

Writes into assets/img/:
  portrait.webp     close-up WITH coat and shoulders (solid silhouette)
  mask-item.webp    the surgical mask on its own (flies from pocket to face)
  pilot.webp        the pilot, lifted out of the plane
  plane-empty.webp  the plane with an empty cockpit
  chair.webp        empty office chair (stage canvas)
  sitter.webp       the seated character without chair/laptop (stage canvas)
  desk.webp         desk + books + plant + laptop (stage canvas)
"""
import io
import json
import os
import sys

import cv2
import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFilter
from simple_lama_inpainting import SimpleLama

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "assets", "img")
W, H = 941, 1672


def pages(pdf_path):
    doc = pymupdf.open(pdf_path)
    out = []
    for page in doc:
        data = doc.extract_image(page.get_images()[0][0])["image"]
        im = Image.open(io.BytesIO(data)).convert("RGB")
        out.append(im if im.size == (W, H) else im.resize((W, H), Image.LANCZOS))
    return out


def save(im, name, q=88):
    im.save(os.path.join(OUT, name), "WEBP", quality=q, method=6)
    print("wrote", name, im.size)


def load(name):
    return Image.open(os.path.join(OUT, name)).convert("RGBA")


def fill_holes(m):
    """Fill enclosed holes of a binary uint8 mask."""
    h, w = m.shape
    flood = m.copy()
    ff = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 255)
    return m | cv2.bitwise_not(flood)


def main(pdf):
    p = pages(pdf)
    lama = SimpleLama()
    boxes = {}

    def inpaint(im, mask):
        return lama(im.convert("RGB"), Image.fromarray(mask).convert("L")).crop((0, 0, im.width, im.height)).convert("RGB")

    # ---------------------------------------------------------------- portrait
    # Page 2 sits on pure black, so a luminance silhouette (holes filled) keeps
    # the white coat and makes the face fully opaque.
    p2 = p[1]
    g = np.array(p2.convert("L"))
    m = (g > 9).astype(np.uint8) * 255
    m[:, :650] = 0                       # heading copy lives left of x=650
    m[:600, :700] = 0
    cnt, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    m = ((lab == big) * 255).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    m = fill_holes(m)
    m = cv2.erode(m, np.ones((3, 3), np.uint8))
    a = Image.fromarray(m).filter(ImageFilter.GaussianBlur(1.2))
    portrait = p2.convert("RGBA")
    portrait.putalpha(a)
    save(portrait, "portrait.webp")

    # ------------------------------------------------------------- mask sprite
    # The pages aren't pixel-identical, so pick the mask by colour: bright,
    # unsaturated pixels inside its box on page 4 (eye whites sit just above).
    masked = np.array(load("char-mask.webp"))
    hsv = cv2.cvtColor(masked[..., :3], cv2.COLOR_RGB2HSV)
    zone = np.zeros((H, W), bool)
    zone[944:1002, 712:792] = True
    mk = (zone & (hsv[..., 2] > 150) & (hsv[..., 1] < 60) & (masked[..., 3] > 100)).astype(np.uint8) * 255
    mk = cv2.morphologyEx(mk, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    mk = fill_holes(mk)
    cnt, lab, stats, _ = cv2.connectedComponentsWithStats(mk)
    keep = ((lab == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))) * 255).astype(np.uint8)
    keep = np.array(Image.fromarray(keep).filter(ImageFilter.GaussianBlur(0.8)))
    x, y, w, h = cv2.boundingRect(keep)
    item = masked.astype(np.uint8).copy()
    item[..., 3] = np.minimum(item[..., 3], keep)
    sprite = Image.fromarray(item).crop((x, y, x + w, y + h))
    save(sprite, "mask-item.webp", 92)
    boxes["mask"] = [int(x), int(y), int(w), int(h)]

    # ---------------------------------------------------- pilot / empty plane
    plane = load("plane.webp")
    OX, OY = 141, 461                     # plane.webp origin on the page
    pa = np.array(plane)
    region = np.zeros(pa.shape[:2], np.uint8)
    region[max(0, 460 - OY):625 - OY, 395 - OX:628 - OX] = 255
    region[625 - OY:702 - OY, 405 - OX:506 - OX] = 255
    pil_a = np.minimum(pa[..., 3], region)
    pilot = pa.copy()
    pilot[..., 3] = pil_a
    x, y, w, h = cv2.boundingRect((pil_a > 20).astype(np.uint8))
    save(Image.fromarray(pilot).crop((x, y, x + w, y + h)), "pilot.webp", 92)
    boxes["pilot"] = [int(x), int(y), int(w), int(h)]    # relative to plane.webp

    # empty cockpit: inpaint the pilot on black, then re-derive alpha
    on_black = Image.new("RGB", plane.size, (0, 0, 0))
    on_black.paste(plane, (0, 0), plane)
    hole = cv2.dilate((pil_a > 10).astype(np.uint8) * 255, np.ones((9, 9), np.uint8))
    filled = np.array(inpaint(on_black, hole))
    lum = cv2.cvtColor(filled, cv2.COLOR_RGB2GRAY).astype(np.float32)
    new_a = np.where(hole > 0, np.clip((lum - 18) * 6, 0, 255), pa[..., 3]).astype(np.uint8)
    new_a = np.array(Image.fromarray(new_a).filter(ImageFilter.MedianFilter(3)))
    empty = np.dstack([np.where(hole[..., None] > 0, filled, pa[..., :3]), new_a]).astype(np.uint8)
    save(Image.fromarray(empty), "plane-empty.webp", 90)

    # ------------------------------------------------ chair / sitter / laptop
    seated = np.array(load("seated.webp"))
    desk = np.array(load("desk.webp"))
    lum = cv2.cvtColor(seated[..., :3], cv2.COLOR_RGB2GRAY)
    alpha = seated[..., 3] > 20

    chair_m = np.zeros((H, W), bool)
    for (x0, y0, x1, y1) in [(322, 776, 412, 905), (512, 776, 586, 845)]:
        chair_m[y0:y1, x0:x1] = True
    chair_m &= alpha & (lum < 95)

    # laptop → desk layer (keep his skin on the right edge with him)
    lap = np.zeros((H, W), bool)
    lap[902:993, 335:534] = True
    r, gg, b = [seated[..., i].astype(int) for i in range(3)]
    skin = (r > gg + 18) & (r > b + 25)
    lap &= alpha & ~skin

    # empty chair: real chair edges + a leather back drawn between them
    chair = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(chair)
    d.rounded_rectangle((334, 781, 580, 1000), radius=26, fill=(38, 38, 40, 255))
    shade = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shade).rounded_rectangle((360, 800, 556, 990), radius=20, fill=255)
    shade = shade.filter(ImageFilter.GaussianBlur(14))   # soft padded-leather highlight
    ca = np.array(chair)
    sh = np.array(shade).astype(np.float32) / 255
    ca[..., :3] = np.clip(ca[..., :3] + sh[..., None] * 16, 0, 255).astype(np.uint8)
    ca[chair_m] = seated[chair_m]
    ca[..., 3] = np.where(ca[..., 3] > 0, ca[..., 3], 0)
    ca[993:, :, 3] = 0                                  # the desk covers the rest
    save(Image.fromarray(ca), "chair.webp")

    # sitter: seated minus chair minus laptop; repaint the torso behind the laptop
    sit = seated.copy()
    sit[..., 3] = np.where(chair_m | lap, 0, sit[..., 3])
    body = (sit[..., 3] > 20).astype(np.uint8) * 255
    torso_hole = np.zeros((H, W), np.uint8)
    torso_hole[lap] = 255
    torso_hole = cv2.dilate(torso_hole, np.ones((5, 5), np.uint8))
    on_black = Image.new("RGB", (W, H), (0, 0, 0))
    on_black.paste(Image.fromarray(sit), (0, 0), Image.fromarray(sit))
    rep = np.array(inpaint(on_black, torso_hole))
    # the torso behind the laptop: between the arms, below the chest
    fill_zone = np.zeros((H, W), np.uint8)
    fill_zone[900:993, 350:520] = 255
    fill_zone &= torso_hole
    sit[..., :3] = np.where(fill_zone[..., None] > 0, rep, sit[..., :3])
    sit[..., 3] = np.where(fill_zone > 0, 255, sit[..., 3])
    sit[993:, :, 3] = 0
    save(Image.fromarray(sit), "sitter.webp")

    dk = desk.copy()
    dk[lap] = seated[lap]
    save(Image.fromarray(dk), "desk.webp")

    with open(os.path.join(HERE, "sprite-boxes.json"), "w") as f:
        json.dump(boxes, f, indent=1)
    print(boxes)


if __name__ == "__main__":
    main(sys.argv[1])
