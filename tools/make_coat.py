"""
Recolour the avatar's outfit into the storyboard's pharmacist look:
white shirt/coat on top, dark trousers below (the white coat's lower half
is added in hero3d.js).

  python tools/make_coat.py

Works on tools/source/3d/avatar.glb (Avaturn: white shirt + blue jeans).
The blue denim texels become charcoal, keeping the weave, seams and pocket
stitching as soft detail; the shirt is brightened slightly to a clean white.
If a future avatar wears a dark jacket on top instead, the mesh-based split
(everything above WAIST, per fabric piece) turns that jacket white.
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
WAIST = 0.9          # metres: top/bottom split in the bind pose


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


def top_mask(W, H):
    """UV mask of the fabric pieces that sit mostly above the waist."""
    g = trimesh.load(SRC, process=False).geometry["avaturn_look_0"]
    v, f, uv = g.vertices, g.faces, g.visual.uv
    cy = v[f][:, :, 1].mean(1)
    top = np.zeros(len(f), bool)
    for c in trimesh.graph.connected_components(g.face_adjacency, nodes=np.arange(len(f)), min_len=1):
        c = np.asarray(c)
        if cy[c].mean() > WAIST:
            top[c] = True
    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    for tri in f[top]:
        d.polygon([(uv[i][0] * W, (1 - uv[i][1]) * H) for i in tri], fill=255)   # trimesh flips v
    return np.array(mask.filter(ImageFilter.MaxFilter(5))) > 127


def main():
    tex = outfit_texture()
    W, H = tex.size
    top = top_mask(W, H)
    rgb = np.array(tex).astype(np.float32) / 255
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    out = rgb.copy()

    # blue denim anywhere → charcoal trousers (weave and stitching kept faint)
    denim = (b > r + 0.08) & (b > g + 0.02) & (lum < 0.6)
    base = np.median(lum[denim]) if denim.any() else 0.25
    dark = np.clip(0.085 + (lum - base) * 0.45, 0.03, 0.2)
    out[denim] = np.stack([dark[denim]] * 3, -1)

    # a dark top (e.g. a denim jacket) → white coat
    dark_top = top & ~denim & (lum < 0.35)
    if dark_top.sum() > 0.05 * top.sum():
        tb = np.median(lum[dark_top])
        white = np.clip(0.93 - (lum - tb) * 0.9, 0.72, 0.97)
        out[dark_top] = np.stack([white[dark_top] * 0.985, white[dark_top] * 0.99, white[dark_top]], -1)

    # white shirt → a touch cleaner and brighter
    shirt = top & (lum > 0.6)
    out[shirt] = np.clip(out[shirt] * 1.04 + 0.02, 0, 1)

    Image.fromarray((out * 255).astype(np.uint8)).save(OUT, "WEBP", quality=90, method=6)
    print("wrote", OUT, "| denim texels", int(denim.sum()), "| dark-top texels", int(dark_top.sum()), "| shirt texels", int(shirt.sum()))


if __name__ == "__main__":
    main()
