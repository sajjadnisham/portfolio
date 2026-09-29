"""
Recolour the avatar's outfit into the storyboard's pharmacist look:
white coat (was the denim jacket) over dark scrubs (was the beige hoodie);
the jeans stay black.

  python tools/make_coat.py

The outfit is one texture atlas, and the jacket and the jeans are both dark
denim, so the jacket is found through the 3D mesh: every face above the
waist (bind pose) is rasterised into a UV mask, and only those texels change.
Writes assets/3d/coat.webp (hero3d.js swaps it onto the outfit material).
"""
import io
import json
import os
import struct

import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "source", "3d", "avatar.glb")
OUT = os.path.join(HERE, "..", "assets", "3d", "coat.webp")
WAIST = 0.9          # metres: jacket / hoodie hem in the bind pose


def outfit_texture():
    b = open(SRC, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    bin0 = 20 + jl + 8
    mat = next(m for m in j["materials"] if m["name"] == "avaturn_look_0_material")
    src = j["textures"][mat["pbrMetallicRoughness"]["baseColorTexture"]["index"]]["source"]
    bv = j["bufferViews"][j["images"][src]["bufferView"]]
    o = bin0 + bv.get("byteOffset", 0)
    return Image.open(io.BytesIO(b[o:o + bv["byteLength"]])).convert("RGB")


def main():
    tex = outfit_texture()
    W, H = tex.size
    g = trimesh.load(SRC, process=False).geometry["avaturn_look_0"]
    v, f, uv = g.vertices, g.faces, g.visual.uv
    # classify whole fabric pieces (UV islands), so the jeans' waistband stays
    # with the jeans and the jacket's hem stays with the jacket
    cy = v[f][:, :, 1].mean(1)
    comps = trimesh.graph.connected_components(g.face_adjacency, nodes=np.arange(len(f)), min_len=1)
    top = np.zeros(len(f), bool)
    for c in comps:
        c = np.asarray(c)
        if cy[c].mean() > WAIST:
            top[c] = True
    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    for tri in f[top]:
        pts = [(uv[i][0] * W, (1 - uv[i][1]) * H) for i in tri]   # trimesh flips v on load
        d.polygon(pts, fill=255)
    mask = mask.filter(ImageFilter.MaxFilter(5))                  # cover seams between islands
    m = np.array(mask) > 127

    rgb = np.array(tex).astype(np.float32) / 255
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    sat = rgb.max(-1) - rgb.min(-1)
    warm = (rgb[..., 0] - rgb[..., 2]) > 0.05
    beige = m & (lum > 0.33) & (sat > 0.05) & warm                # the hoodie (tan, warm)
    denim = m & ~beige

    out = rgb.copy()
    # denim → white cotton: keep the weave and stitching as soft grey detail
    base = np.median(lum[denim]) if denim.any() else 0.12
    white = np.clip(0.93 - (lum - base) * 0.9, 0.72, 0.97)
    out[denim] = np.stack([white[denim] * 0.985, white[denim] * 0.99, white[denim]], -1)
    # hoodie → dark scrubs, keeping its folds
    hb = np.median(lum[beige]) if beige.any() else 0.5
    dark = np.clip(0.11 + (lum - hb) * 0.35, 0.04, 0.2)
    out[beige] = np.stack([dark[beige]] * 3, -1)

    Image.fromarray((out * 255).astype(np.uint8)).save(OUT, "WEBP", quality=90, method=6)
    print("wrote", OUT, "top faces", int(top.sum()), "of", len(f), "denim texels", int(denim.sum()), "hoodie texels", int(beige.sum()))


if __name__ == "__main__":
    main()
