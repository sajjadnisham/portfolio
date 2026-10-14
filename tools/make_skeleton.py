"""
Strip the avatar GLB down to what the site uses: the skeleton (with its
skin and the one body mesh that binds it). The cartoon look is modelled in
code (assets/js/cartoon.js), so textures, materials and the other meshes
(hair, clothes, shoes) are dropped.

  python tools/make_skeleton.py tools/source/3d/avatar-optimised.glb assets/3d/nisham.glb

(The input is the optimised GLB; if you only have the raw Avaturn export,
any GLB with the same skeleton works.)
"""
import json
import struct
import sys

KEEP_MESH = "avaturn_body"


def main(src, dst):
    b = open(src, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    bin0 = 20 + jl + 8
    blob = b[bin0:]

    # keep only the body mesh; other mesh nodes lose their mesh and skin
    keep = next(i for i, m in enumerate(j["meshes"]) if m["name"] == KEEP_MESH)
    for n in j["nodes"]:
        if "mesh" in n and n["mesh"] != keep:
            n.pop("mesh"); n.pop("skin", None)
        elif "mesh" in n:
            n["mesh"] = 0
    mesh = j["meshes"][keep]
    for p in mesh["primitives"]:
        p.pop("material", None)
    j["meshes"] = [mesh]
    for k in ("images", "textures", "samplers", "materials"):
        j.pop(k, None)
    j["extensionsUsed"] = [e for e in j.get("extensionsUsed", []) if e != "EXT_texture_webp"]
    j["extensionsRequired"] = [e for e in j.get("extensionsRequired", []) if e != "EXT_texture_webp"]
    if not j["extensionsRequired"]:
        j.pop("extensionsRequired")

    # accessors still in use, then repack their buffer views
    used = set()
    for p in mesh["primitives"]:
        used.update(p["attributes"].values())
        if "indices" in p:
            used.add(p["indices"])
        for t in p.get("targets", []):
            used.update(t.values())
    for s in j.get("skins", []):
        if "inverseBindMatrices" in s:
            used.add(s["inverseBindMatrices"])
    amap, accs = {}, []
    for i in sorted(used):
        amap[i] = len(accs); accs.append(j["accessors"][i])
    vmap, views, out = {}, [], bytearray()
    for a in accs:
        vi = a["bufferView"]
        if vi not in vmap:
            v = dict(j["bufferViews"][vi])
            data = blob[v.get("byteOffset", 0): v.get("byteOffset", 0) + v["byteLength"]]
            while len(out) % 4:
                out.append(0)
            v["byteOffset"] = len(out); v["buffer"] = 0
            out += data
            vmap[vi] = len(views); views.append(v)
        a["bufferView"] = vmap[vi]
    for p in mesh["primitives"]:
        p["attributes"] = {k: amap[v] for k, v in p["attributes"].items()}
        if "indices" in p:
            p["indices"] = amap[p["indices"]]
        if "targets" in p:
            p["targets"] = [{k: amap[v] for k, v in t.items()} for t in p["targets"]]
    for s in j.get("skins", []):
        if "inverseBindMatrices" in s:
            s["inverseBindMatrices"] = amap[s["inverseBindMatrices"]]
    j["accessors"], j["bufferViews"] = accs, views
    while len(out) % 4:
        out.append(0)
    j["buffers"] = [{"byteLength": len(out)}]

    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out))
    glb += struct.pack("<II", len(js), 0x4E4F534A) + js
    glb += struct.pack("<II", len(out), 0x004E4942) + bytes(out)
    open(dst, "wb").write(glb)
    print("wrote", dst, len(glb), "bytes")


if __name__ == "__main__":
    main(*sys.argv[1:3])
