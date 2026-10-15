"""
Build the pharmacy scene (Thalassery Mission Hospital pharmacy photo) on the
stage's 941×1672 portrait canvas.

  python tools/make_pharmacy.py

From tools/source/pharmacy-photo.jpg it writes:
  assets/img/pharmacy.webp        background: photo scaled into the canvas,
                                  wall/floor extended (LaMa outpainting), the
                                  staff removed, the door leaf replaced by the
                                  dim corridor behind it
  assets/img/pharmacy-door.webp   just the door leaf (it swings open in CSS)
  assets/img/pharmacy-front.webp  the wall in front of him once he's inside:
                                  the full scene with the window glass and the
                                  doorway cut out (the steel posts stay)
Coordinates of the door, window and counter are printed for hero3d.js.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "source", "pharmacy-photo.jpg")
OUT = os.path.join(HERE, "..", "assets", "img")
W, H = 941, 1672
K = 0.52                 # photo → canvas scale
OX, OY = 70, 760         # where the photo's top-left lands

# photo coordinates (px in the 1538×1023 photo)
PEOPLE = [(483, 578, 548, 640), (535, 528, 588, 634), (603, 528, 620, 634),
          (752, 515, 902, 668), (1008, 520, 1122, 668)]
POLES = [(588, 335, 603, 672), (944, 335, 960, 672)]
WINDOW = (262, 336, 1306, 669)          # glass opening above the counter
DOOR_LEAF = (42, 428, 233, 941)         # the swinging leaf
DOOR_OPEN = (40, 426, 236, 943)         # the opening it leaves


def c(x, y):
    return (OX + x * K, OY + y * K)


def box(b):
    (x0, y0), (x1, y1) = c(b[0], b[1]), c(b[2], b[3])
    return [round(x0), round(y0), round(x1), round(y1)]


def lama(img, mask):
    from simple_lama_inpainting import SimpleLama
    return SimpleLama()(img, mask).crop((0, 0) + img.size)


# camera matched to the photo (level, principal point at the photo centre):
# 179 px per metre at the wall (counter 0.8 m, door 2.1 m), eye 1.25 m
F, HZ, EYE = 858.0, 1027.0, 1.25
PXM_WALL = 179.0
D_WALL = F / PXM_WALL


def floor_layer(sample):
    """Perspective tile floor (60 cm tiles) for rows below the horizon, tinted
    from the photo's own floor."""
    tile, grout = sample
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    below = ys > HZ + 1
    depth = np.where(below, F * EYE / np.maximum(ys - HZ, 1), 1e3)
    wx = (xs - W / 2) * depth / F                                   # metres across
    wz = depth                                                      # metres away
    u, v = wx / 0.6 + 0.37, wz / 0.6 + 0.11
    fu, fv = u - np.floor(u), v - np.floor(v)
    # grout width in tile units, fading with distance so it doesn't alias
    gw = np.clip(0.012 * (2.0 / depth) + 0.008, 0.01, 0.04)
    line = np.clip(1 - np.minimum(np.minimum(fu, 1 - fu), np.minimum(fv, 1 - fv)) / gw, 0, 1) * np.clip(2.6 / depth, 0.25, 1)
    rnd = np.sin(np.floor(u) * 12.9898 + np.floor(v) * 78.233) * 43758.5453
    rnd = (rnd - np.floor(rnd) - 0.5) * 0.06                         # tile-to-tile tone
    col = tile[None, None, :] * (1 + rnd[..., None])
    col = col * (1 - line[..., None]) + grout[None, None, :] * line[..., None]
    # soft light from the counter area, falling off toward the viewer and sides
    light = 0.86 + 0.14 * np.exp(-((xs - 470) / 520) ** 2) * np.clip(1.2 - (ys - 1250) / 900, 0.6, 1.2)
    col = col * light[..., None]
    return np.clip(col, 0, 255), below


def main():
    photo = Image.open(SRC).convert("RGB")
    # staff out, at full resolution
    m0 = Image.new("L", photo.size, 0)
    for b in PEOPLE:
        ImageDraw.Draw(m0).rectangle([b[0] - 3, b[1] - 3, b[2] + 3, b[3] + 3], fill=255)
    clean = lama(photo, m0)
    pw, ph = round(photo.width * K), round(photo.height * K)
    small = np.asarray(clean.resize((pw, ph), Image.LANCZOS), np.float32)

    out = np.zeros((H, W, 3), np.float32)
    # floor everywhere below the horizon
    fl = small[ph - 30:ph - 4, 40:pw - 40].reshape(-1, 3)
    lum = fl.mean(1)
    tile = fl[lum > np.percentile(lum, 40)].mean(0)
    grout = fl[lum < np.percentile(lum, 15)].mean(0) * 0.95
    floor, below = floor_layer((tile, grout))
    out[below] = floor[below]
    # wall: continue the photo's edge columns sideways and its top row upward,
    # fading to dark toward the top so the story text stays readable
    top = small[2]                                                  # (pw, 3)
    for y in range(0, OY + ph):
        if y < OY:
            row = np.zeros((W, 3), np.float32)
            row[OX:OX + pw] = top
            row[:OX] = top[0]; row[OX + pw:] = top[-1]
            k = np.clip((y - 260) / (OY - 260), 0, 1) ** 1.6
            out[y] = row * (0.10 + 0.9 * k)
        else:
            r = small[y - OY]
            if y < 1251:                                            # wall rows: extend the edges
                out[y, :OX] = r[2]; out[y, OX + pw:] = r[-3]
    out[OY:OY + ph, OX:OX + pw] = small                         # under the feathered edge
    # side wall columns get a gentle falloff
    xs = np.arange(W, dtype=np.float32)
    side = np.clip(1 - np.maximum(OX - xs, xs - (OX + pw)) / 140, 0.7, 1)[None, :, None]
    out[:1251] *= side
    # the photo itself, feathered into the extension
    canvas = Image.fromarray(out.clip(0, 255).astype(np.uint8))
    ph_img = Image.fromarray(small.clip(0, 255).astype(np.uint8))
    feather = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(feather).rectangle([6, 6, pw - 7, ph - 7], fill=255)
    feather = feather.filter(ImageFilter.GaussianBlur(4))
    canvas.paste(ph_img, (OX, OY), feather)
    full = canvas
    full.save(os.path.join(OUT, "pharmacy-debug.png")) if os.environ.get("DEBUG") else None

    # 2) door leaf as its own layer
    leaf_box = box(DOOR_LEAF)
    door = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    door.paste(full.crop(leaf_box), leaf_box[:2])
    door.save(os.path.join(OUT, "pharmacy-door.webp"), "WEBP", quality=88)

    # 3) background: the corridor behind the door (dim, a strip of floor)
    bg = full.copy()
    ob = box(DOOR_OPEN)
    ow, oh = ob[2] - ob[0], ob[3] - ob[1]
    g = np.zeros((oh, ow, 3), np.float32)
    t = np.linspace(0, 1, oh)[:, None]
    g[:] = (np.array([46, 42, 36]) * (1 - t) + np.array([28, 25, 22]) * t)[:, None, :]
    fl = int(oh * 0.86)
    g[fl:] = np.linspace(70, 110, oh - fl)[:, None, None] * np.array([1.0, 0.93, 0.82])
    xs = np.linspace(0, 1, ow)[None, :, None]
    g *= 0.75 + 0.25 * xs                                           # light from the right
    bg.paste(Image.fromarray(g.clip(0, 255).astype(np.uint8)), ob[:2])
    bg.save(os.path.join(OUT, "pharmacy.webp"), "WEBP", quality=86, method=6)

    # 4) front layer: everything except the glass and the doorway (posts kept,
    #    from the original photo so they stay crisp)
    front = full.convert("RGBA")
    a = Image.new("L", (W, H), 255)
    da = ImageDraw.Draw(a)
    da.rectangle(box(WINDOW), fill=0)
    da.rectangle(box(DOOR_OPEN), fill=0)
    for p in POLES:
        da.rectangle(box(p), fill=255)
    front.putalpha(a)
    front.save(os.path.join(OUT, "pharmacy-front.webp"), "WEBP", quality=88)

    print("canvas coords (px):")
    print(" floor at wall row  ", c(0, 945)[1])
    print(" counter top row    ", c(0, 669)[1])
    print(" window x0,x1       ", c(262, 0)[0], c(1306, 0)[0], " y0", c(0, 336)[1])
    print(" door x0,x1,top     ", c(42, 0)[0], c(233, 0)[0], c(0, 428)[1], " handle", c(212, 668))
    print(" door frame top     ", c(0, 218)[1], " door height px", (941 - 218) * K)
    print(" sign right end     ", c(1290, 0)[0], " sign line2 y", c(0, 268)[1])


if __name__ == "__main__":
    main()
