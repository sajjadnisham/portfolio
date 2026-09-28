"""
Cut the scroll-story layers out of the 8-page storyboard PDF.

The storyboard pages are flat images, so this script:
  * pulls each page image out of the PDF,
  * separates the character / desk / plane from their backgrounds (rembg),
  * rebuilds clean background plates with the character and baked-in text
    removed (LaMa inpainting),
  * writes everything as WebP into assets/img/.

All "stage" layers keep the page's 941x1672 canvas so they line up exactly
when stacked with `position:absolute; inset:0`.

Usage:
  pip install pymupdf pillow opencv-python-headless "rembg[cpu]" torch simple-lama-inpainting
  python tools/extract_assets.py path/to/portfolio.pdf

If you later get real, separately drawn layers from the illustrator, just drop
them into assets/img/ with the same file names and skip this script.
"""
import sys
import os

import cv2
import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFilter
from rembg import new_session, remove
from simple_lama_inpainting import SimpleLama

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "img")
W, H = 941, 1672


def pages(pdf_path):
    doc = pymupdf.open(pdf_path)
    out = []
    for page in doc:
        xref = page.get_images()[0][0]
        data = doc.extract_image(xref)["image"]
        im = Image.open(__import__("io").BytesIO(data)).convert("RGB")
        if im.size != (W, H):
            im = im.resize((W, H), Image.LANCZOS)
        out.append(im)
    return out


def save(im, name, q=86):
    im.save(os.path.join(OUT, name), "WEBP", quality=q, method=6)
    print("wrote", name, im.size)


def alpha_mask(rgba, thresh=12, grow=0):
    a = np.array(rgba.split()[-1])
    m = (a > thresh).astype(np.uint8) * 255
    if grow:
        m = cv2.dilate(m, np.ones((grow, grow), np.uint8))
    return m


def keep_largest(rgba, n=1):
    """Keep the n largest connected blobs of an RGBA cut-out (drops stray specks)."""
    a = np.array(rgba.split()[-1])
    cnt, lab, stats, _ = cv2.connectedComponentsWithStats((a > 20).astype(np.uint8))
    order = np.argsort(-stats[1:, cv2.CC_STAT_AREA])[:n] + 1
    keep = np.isin(lab, order)
    keep = cv2.dilate(keep.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    arr = np.array(rgba)
    arr[..., 3] = np.where(keep, arr[..., 3], 0)
    return Image.fromarray(arr)


def rect_mask(box):
    m = np.zeros((H, W), np.uint8)
    x0, y0, x1, y1 = box
    m[y0:y1, x0:x1] = 255
    return m


def main(pdf):
    os.makedirs(OUT, exist_ok=True)
    p = pages(pdf)
    rb = new_session("isnet-general-use")
    lama = SimpleLama()

    def inpaint(im, mask):
        res = lama(im, Image.fromarray(mask).convert("L"))
        return res.crop((0, 0, W, H)).convert("RGB")

    def cut(im):
        return keep_largest(remove(im, session=rb))

    # ---- Scene 2 portrait (page 2, right side) --------------------------
    p2 = p[1]
    crop = p2.crop((640, 440, W, H))
    pc = keep_largest(remove(crop, session=rb))
    portrait = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    portrait.paste(pc, (640, 440), pc)
    save(portrait, "portrait.webp", 88)

    # ---- Scenes 3-5 Mission Hospital -------------------------------------
    p3, p4, p5 = p[2], p[3], p[4]
    stand = cut(p3)
    masked = cut(p4)
    clip = cut(p5)

    # Align the clipboard pose (page 5 is framed slightly closer) to page 4:
    # same height and same feet position, so the crossfade doesn't jump.
    def bbox(rgba):
        return rgba.split()[-1].point(lambda v: 255 if v > 20 else 0).getbbox()

    bx4, bx5 = bbox(masked), bbox(clip)
    s = (bx4[3] - bx4[1]) / (bx5[3] - bx5[1])
    c5 = clip.crop(bx5)
    c5 = c5.resize((round(c5.width * s), round(c5.height * s)), Image.LANCZOS)
    # anchor on the head/body centre of page 4 (clipboard sticks out on the right)
    cx4 = (bx4[0] + bx4[2]) / 2
    x = round(cx4 - c5.width * 0.44)
    y = bx4[3] - c5.height
    clip_al = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    clip_al.paste(c5, (x, y), c5)

    save(stand, "char-stand.webp")
    save(masked, "char-mask.webp")
    save(clip_al, "char-clipboard.webp")

    # Plain hospital plate: remove character, heading text and logo.
    m = alpha_mask(stand, grow=31) | alpha_mask(masked, grow=31)
    m |= rect_mask((0, 0, 140, 140))
    hosp = inpaint(p3, m)
    arr = np.array(hosp)
    arr[:560, :740] = 0  # heading area of the page is pure black
    hosp = Image.fromarray(arr)
    save(hosp, "hospital.webp", 84)

    # Page 5 plate (blurred, NABH sign): remove character, text, logo.
    m5 = alpha_mask(clip, grow=31) | rect_mask((0, 0, 140, 140))
    for box in [(50, 225, 710, 372), (55, 380, 675, 472), (55, 488, 165, 508), (55, 525, 685, 612)]:
        m5 |= rect_mask(box)  # baked heading / body copy / divider
    nabh = inpaint(p5, m5)
    save(nabh, "hospital-nabh.webp", 84)

    # The same plate with "(NABH)" painted out, so the word can be revealed.
    nabh_quad = [(526, 812), (526, 744), (662, 692), (662, 762)]  # follows the sign's slant
    nabh_box = (505, 675, 680, 830)
    quad = Image.new("L", (W, H), 0)
    ImageDraw.Draw(quad).polygon(nabh_quad, fill=255)
    plain = inpaint(nabh, np.array(quad))
    save(plain, "hospital-blur.webp", 84)

    # Just the "(NABH)" word as its own layer (feathered patch of the sign).
    patch = quad.filter(ImageFilter.GaussianBlur(4))
    word = nabh.convert("RGBA")
    word.putalpha(patch)
    save(word.crop(nabh_box), "nabh-word.webp", 90)
    print("nabh box", nabh_box)

    # ---- Scene 6 plane + clouds -----------------------------------------
    p6 = p[5]
    top = p6.crop((0, 300, W, 960))
    cut6 = remove(top, session=rb)
    a = np.array(cut6.split()[-1])
    cnt, lab, stats, _ = cv2.connectedComponentsWithStats((a > 20).astype(np.uint8))
    blobs = sorted(range(1, cnt), key=lambda i: -stats[i, cv2.CC_STAT_AREA])[:4]
    arr6 = np.array(cut6)
    clouds = 0
    for rank, i in enumerate(blobs):
        x0, y0, w, h = stats[i, :4]
        keep = cv2.dilate((lab == i).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
        layer = arr6.copy()
        layer[..., 3] = np.where(keep, layer[..., 3], 0)
        img = Image.fromarray(layer).crop((max(x0 - 4, 0), max(y0 - 4, 0), x0 + w + 4, y0 + h + 4))
        if rank == 0:
            save(img, "plane.webp", 90)
            print("plane box", x0, y0 + 300, w, h)
        else:
            # rembg is unreliable on soft white clouds; they sit on pure black,
            # so luminance makes a clean alpha.
            clouds += 1
            box = (max(x0 - 4, 0), max(y0 - 4, 0), x0 + w + 4, y0 + h + 4)
            rgb = top.crop(box)
            lum = np.array(rgb.convert("L")).astype(np.float32)
            a = np.clip((lum - 14) * 2.4, 0, 255).astype(np.uint8)
            img = rgb.convert("RGBA")
            img.putalpha(Image.fromarray(a))
            save(img, f"cloud-{clouds}.webp", 88)

    # ---- Scene 7 IGMH ---------------------------------------------------
    p7 = p[6]
    desk_all = cut(p7.crop((0, 0, W, 1060)))
    desk_full = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    desk_full.paste(desk_all, (0, 0), desk_all)
    m7 = alpha_mask(desk_full, grow=25)
    igmh = inpaint(p7, m7)
    arr = np.array(igmh)
    arr[1050:] = 0  # baked caption under the desk
    igmh = Image.fromarray(arr)
    save(igmh, "igmh.webp", 84)

    # Split the desk group: props (desk top, books, plant) vs seated character.
    DESK_TOP = 992
    arr = np.array(desk_full)
    props = np.zeros_like(arr)
    props[DESK_TOP:] = arr[DESK_TOP:]
    # pencil cup, book stack, plant + medicine box (the sleeve above the books stays with him)
    for (x0, y0, x1, y1) in [(170, 895, 282, 975), (176, 970, 318, DESK_TOP), (636, 895, 770, DESK_TOP)]:
        props[y0:y1, x0:x1] = arr[y0:y1, x0:x1]
    seated = arr.copy()
    seated[..., 3] = np.where(props[..., 3] > 0, 0, seated[..., 3])
    save(Image.fromarray(props), "desk.webp", 88)
    save(Image.fromarray(seated), "seated.webp", 88)

    # ---- Scene 9 round portrait ------------------------------------------
    p8 = p[7]
    cx, cy, r = 470, 830, 186
    av = p8.crop((cx - r, cy - r, cx + r, cy + r)).resize((480, 480), Image.LANCZOS)
    circ = Image.new("L", (480 * 4, 480 * 4), 0)
    ImageDraw.Draw(circ).ellipse((0, 0, 480 * 4, 480 * 4), fill=255)
    av = av.convert("RGBA")
    av.putalpha(circ.resize((480, 480), Image.LANCZOS))
    save(av, "avatar.webp", 90)

    # ---- Open Graph image --------------------------------------------------
    og = Image.new("RGB", (1200, 630), (0, 0, 0))
    src = p2.crop((0, 380, W, 1260)).resize((round(W * 630 / 880), 630), Image.LANCZOS)
    og.paste(src, ((1200 - src.width) // 2, 0))
    og.save(os.path.join(OUT, "og.jpg"), quality=86)
    print("wrote og.jpg")


if __name__ == "__main__":
    main(sys.argv[1])
