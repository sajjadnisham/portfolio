/* =========================================================
   Disney-style Nisham, modelled in code.

   A stylised "toy figure" built around the existing animated skeleton
   (assets/3d/nisham.glb), so every move, the IK hands and the look-at keep
   working unchanged. Two kinds of parts:
     · skinned (they bend): lab coat, sleeves, trousers, neck — vertices are
       weighted to the bones they follow, blended across each joint
     · rigid (they ride one bone): head with hair, beard and face, hands and
       fingers, shoes, coat details
   Everything is built in the skeleton's rest pose (T-pose, metres, facing +z).

   Look (animated-feature style): big friendly head, a mop of wavy curly
   black hair (spiral locks, a curl falling on the forehead), big glossy
   eyes, a round button nose, thick dark arched brows, rosy cheeks, full
   beard and moustache, warm brown skin, knee-length white lab coat with
   a pen in the breast pocket, charcoal trousers, black shoes.
   ========================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const COL = {
  skin: 0xb9784e, hair: 0x18110d, coat: 0xf4f4f2, coatShade: 0xdadcdf,
  trousers: 0x33363b, shoe: 0x111111, sole: 0x2a2a2a, iris: 0x3a2214,
  lip: 0x5a2a20, pen: 0x2457c5,
};

export function buildCartoon(avatar) {
  avatar.updateMatrixWorld(true);
  const bone = (n) => avatar.getObjectByName(n);
  const P = (n) => bone(n).getWorldPosition(new THREE.Vector3());
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ss = THREE.MathUtils.smoothstep;

  const M = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
  const mat = {
    skin: M(COL.skin, 0.5), hair: M(COL.hair, 0.6), coat: M(COL.coat, 0.75, { side: THREE.DoubleSide }),
    coatShade: M(COL.coatShade, 0.8, { side: THREE.DoubleSide }), trousers: M(COL.trousers, 0.85),
    shoe: M(COL.shoe, 0.35), sole: M(COL.sole, 0.9), white: M(0xffffff, 0.3), iris: M(COL.iris, 0.35),
    black: M(0x050505, 0.3), lip: M(COL.lip, 0.6), brow: M(0x0a0705, 0.9, { side: THREE.DoubleSide }), nose: M(0xc0825a, 0.5), blush: M(0xd0805f, 0.7, { transparent: true, opacity: 0.55 }), pen: M(COL.pen, 0.4), metal: M(0xb9bec4, 0.3, { metalness: 0.6 }),
  };

  /* ---------------- skinning helpers ---------------- */
  const bones = [];
  const bi = (b) => { const o = typeof b === 'string' ? bone(b) : b; let i = bones.indexOf(o); if (i < 0) { bones.push(o); i = bones.length - 1; } return i; };
  const skinnedParts = [];
  // geometry (world rest coords) + per-vertex weights [[bone, w], …]
  function addSkinned(geo, material, weightOf) {
    const pos = geo.attributes.position, n = pos.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(pos, i);
      const ws = weightOf(p, i).filter((w) => w[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const tot = ws.reduce((a, w) => a + w[1], 0) || 1;
      ws.forEach(([b, w], k) => { si[i * 4 + k] = bi(b); sw[i * 4 + k] = w / tot; });
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    skinnedParts.push([geo, material]);
  }
  // rigid part: built in world rest coords, then carried by one bone
  const rigid = [];
  function addRigid(obj, boneName) { rigid.push([obj, bone(boneName)]); return obj; }
  const mesh = (geo, material) => new THREE.Mesh(geo, material);

  /* A tube along a chain of points (one bone per segment), radius per point,
     with weights blended across each joint over `blend` metres. */
  function chainTube(pts, radii, chainBones, material, { around = 20, per = 10, blend = 0.05, endBone = null, squash = 1 } = {}) {
    const rings = [], params = [];
    for (let s = 0; s < pts.length - 1; s++) {
      for (let k = 0; k < per; k++) {
        const f = k / per;
        rings.push([pts[s].clone().lerp(pts[s + 1], f), THREE.MathUtils.lerp(radii[s], radii[s + 1], f), s, f]);
      }
    }
    rings.push([pts[pts.length - 1].clone(), radii[radii.length - 1], pts.length - 2, 1]);
    const REF = V(0, 0, 1);
    const verts = [], idx = [], info = [];
    rings.forEach(([c, r, s, f], ri) => {
      const t = pts[s + 1].clone().sub(pts[s]).normalize();
      const nrm = t.clone().cross(REF).normalize(), bin = nrm.clone().cross(t).normalize();
      for (let a = 0; a <= around; a++) {
        const ang = (a / around) * Math.PI * 2;
        const v = c.clone().addScaledVector(nrm, Math.cos(ang) * r).addScaledVector(bin, Math.sin(ang) * r * squash);
        verts.push(v.x, v.y, v.z); info.push([s, f]);
      }
      if (ri > 0) {
        const b0 = (ri - 1) * (around + 1), b1 = ri * (around + 1);
        for (let a = 0; a < around; a++) idx.push(b0 + a, b1 + a, b0 + a + 1, b0 + a + 1, b1 + a, b1 + a + 1);
      }
    });
    // end caps
    const cap = (ri, c, flip) => {
      const ci = verts.length / 3; verts.push(c.x, c.y, c.z); info.push(ri === 0 ? [0, 0] : [pts.length - 2, 1]);
      const b = ri * (around + 1);
      for (let a = 0; a < around; a++) flip ? idx.push(ci, b + a + 1, b + a) : idx.push(ci, b + a, b + a + 1);
    };
    cap(0, pts[0], false); cap(rings.length - 1, pts[pts.length - 1], true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const segLen = pts.slice(1).map((q, i) => q.distanceTo(pts[i]));
    addSkinned(geo, material, (p, i) => {
      const [s, f] = info[i];
      const d0 = f * segLen[s], d1 = (1 - f) * segLen[s];
      const out = [[chainBones[s], 1]];
      const next = chainBones[s + 1] || (s === pts.length - 2 ? endBone : null);
      if (next && d1 < blend) { const k = 0.5 * (1 - d1 / blend); out[0][1] -= k; out.push([next, k]); }
      if (s > 0 && d0 < blend) { const k = 0.5 * (1 - d0 / blend); out[0][1] -= k; out.push([chainBones[s - 1], k]); }
      return out;
    });
  }

  /* ---------------- bones in the rest pose ---------------- */
  const hips = P('Hips'), spine2 = P('Spine2'), neck = P('Neck'), head = P('Head');
  const SPINE = [['Hips', hips.y], ['Spine', P('Spine').y], ['Spine1', P('Spine1').y], ['Spine2', spine2.y], ['Neck', neck.y]];

  /* ---------------- lab coat: body + knee-length skirt ---------------- */
  {
    // [y, half-width, half-depth, z-centre]
    const prof = [
      [1.545, 0.062, 0.056, -0.03], [1.53, 0.12, 0.08, -0.03], [1.50, 0.2, 0.1, -0.025], [1.47, 0.215, 0.112, -0.02],
      [1.42, 0.205, 0.12, -0.01], [1.34, 0.19, 0.125, 0.0], [1.24, 0.172, 0.12, 0.0], [1.12, 0.163, 0.114, 0.0],
      [1.02, 0.18, 0.125, 0.0], [0.94, 0.198, 0.138, 0.0], [0.82, 0.21, 0.145, 0.0], [0.68, 0.22, 0.15, 0.0], [0.55, 0.228, 0.155, 0.0],
    ];
    const N = 56, rows = [];
    for (let r = 0; r < prof.length - 1; r++) for (let k = 0; k < 4; k++) {
      const a = prof[r], b = prof[r + 1], f = k / 4;
      rows.push(a.map((v, i) => THREE.MathUtils.lerp(v, b[i], f)));
    }
    rows.push(prof[prof.length - 1]);
    const verts = [], idx = [];
    rows.forEach(([y, rx, rz, zc], ri) => {
      const gap = 0.36 * ss(1.0 - y, 0, 0.42);                       // the coat opens below the last button
      for (let j = 0; j <= N; j++) {
        const ang = Math.PI / 2 + gap + (Math.PI * 2 - 2 * gap) * (j / N);
        // a touch of flare at the hem, and a flatter back
        const back = Math.sin(ang) < 0 ? 0.9 : 1;
        verts.push(Math.cos(ang) * rx, y, zc + Math.sin(ang) * rz * back);
      }
      if (ri > 0) {
        const b0 = (ri - 1) * (N + 1), b1 = ri * (N + 1);
        for (let j = 0; j < N; j++) idx.push(b0 + j, b0 + j + 1, b1 + j, b0 + j + 1, b1 + j + 1, b1 + j);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    addSkinned(geo, mat.coat, (p) => {
      const out = [];
      if (p.y >= hips.y) {
        // up the spine, blending across each joint
        let w = [];
        for (let i = 0; i < SPINE.length; i++) {
          const lo = SPINE[i][1], hi = i + 1 < SPINE.length ? SPINE[i + 1][1] : 9;
          const inSeg = ss(p.y, lo - 0.035, lo + 0.035) * (1 - ss(p.y, hi - 0.035, hi + 0.035));
          if (inSeg > 0) w.push([SPINE[i][0], inSeg]);
        }
        // shoulders ride the collarbones
        const sh = ss(Math.abs(p.x), 0.1, 0.2) * ss(p.y, 1.36, 1.46) * 0.75;
        if (sh > 0) { w = w.map(([b, v]) => [b, v * (1 - sh)]); w.push([p.x > 0 ? 'LeftShoulder' : 'RightShoulder', sh]); }
        return w.length ? w : [['Hips', 1]];
      }
      // skirt: the front follows the thighs (so he can stride and sit), the back stays with the hips
      const depth = ss(hips.y - p.y, 0.04, 0.4);
      const front = ss(p.z / 0.14, -0.2, 0.7);
      const wt = depth * (0.3 + 0.45 * front);
      out.push(['Hips', 1 - wt], [p.x >= 0 ? 'LeftUpLeg' : 'RightUpLeg', wt]);
      return out;
    });

    // coat details on the chest (ride Spine2) and the skirt (ride the hips)
    const chest = new THREE.Group();
    const at = (y, i) => {                                           // profile value at height y
      const k = prof.findIndex((q) => q[0] <= y);
      if (k <= 0) return prof[Math.max(k, 0)][i];
      const a = prof[k - 1], b = prof[k], f = (a[0] - y) / (a[0] - b[0]);
      return THREE.MathUtils.lerp(a[i], b[i], f);
    };
    const frontZ = (y) => at(y, 3) + at(y, 2);
    const surfZ = (x, y) => { const u = Math.min(0.98, Math.abs(x) / at(y, 1)); return at(y, 3) + at(y, 2) * Math.sqrt(1 - u * u); };
    // lapels: two flat wedges from the collar to the top button
    for (const sx of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(sx * 0.02, 1.53); sh.lineTo(sx * 0.115, 1.47); sh.lineTo(sx * 0.07, 1.36); sh.lineTo(sx * 0.012, 1.2); sh.lineTo(sx * 0.012, 1.5);
      const g = new THREE.ShapeGeometry(sh);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, surfZ(pos.getX(i), pos.getY(i)) + 0.004);
      g.computeVertexNormals();
      chest.add(mesh(g, mat.coatShade));
    }
    // breast pocket with a pen (his left side), buttons down the front
    const pocket = mesh(new THREE.BoxGeometry(0.07, 0.075, 0.006), mat.coatShade);
    pocket.position.set(0.1, 1.31, surfZ(0.1, 1.31) + 0.002); pocket.rotation.y = 0.45; chest.add(pocket);
    const pen = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.06, 10), mat.pen);
    pen.position.set(0.085, 1.345, surfZ(0.085, 1.31) + 0.002); chest.add(pen);
    const clipP = mesh(new THREE.BoxGeometry(0.003, 0.03, 0.003), mat.metal);
    clipP.position.set(0.085, 1.36, surfZ(0.085, 1.31) + 0.009); chest.add(clipP);
    addRigid(chest, 'Spine2');
    const btns = new THREE.Group();
    for (const y of [1.28, 1.17, 1.06]) {
      const b = mesh(new THREE.SphereGeometry(0.008, 12, 8), mat.coatShade);
      b.scale.z = 0.5; b.position.set(0.0, y, frontZ(y) + 0.002); btns.add(b);
    }
    addRigid(btns, 'Spine1');
    const skirtD = new THREE.Group();
    for (const sx of [-1, 1]) {
      const pk = mesh(new THREE.BoxGeometry(0.085, 0.075, 0.006), mat.coatShade);
      const x = sx * 0.12, rx = at(0.86, 1), rz = at(0.86, 2), u = x / rx;
      pk.position.set(x, 0.86, rz * Math.sqrt(1 - u * u) + 0.003);
      pk.rotation.y = Math.atan2(rz * u, rx * Math.sqrt(1 - u * u)) * 1.0; skirtD.add(pk);
    }
    addRigid(skirtD, 'Hips');
    // collar: a stand-up band around the neck, open at the front
    const collar = mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.05, 28, 1, true, Math.PI * 0.12, Math.PI * 1.76), mat.coat);
    collar.position.set(0, 1.535, -0.025);
    addRigid(collar, 'Spine2');
  }

  /* ---------------- sleeves, trousers, neck ---------------- */
  for (const [sd, sx] of [['Left', 1], ['Right', -1]]) {
    const sh = P(`${sd}Shoulder`), arm = P(`${sd}Arm`), fore = P(`${sd}ForeArm`), hand = P(`${sd}Hand`);
    const start = V(sx * 0.115, arm.y - 0.035, arm.z);
    const cuff = hand.clone().lerp(fore, 0.04);
    chainTube([start, arm, fore, cuff], [0.06, 0.06, 0.052, 0.048], [`${sd}Shoulder`, `${sd}Arm`, `${sd}ForeArm`], mat.coat, { endBone: `${sd}Hand`, blend: 0.06 });
    void sh;
    const up = P(`${sd}UpLeg`), knee = P(`${sd}Leg`), foot = P(`${sd}Foot`);
    chainTube([up.clone().add(V(0, 0.07, 0)), knee, foot.clone().add(V(0, -0.025, 0))], [0.08, 0.064, 0.052],
      [`${sd}UpLeg`, `${sd}Leg`], mat.trousers, { endBone: `${sd}Foot`, blend: 0.07 });
  }
  chainTube([neck.clone().add(V(0, -0.03, 0.01)), head.clone().add(V(0, 0.05, 0.02))], [0.056, 0.054], ['Neck'], mat.skin, { endBone: 'Head', blend: 0.06 });
  // pelvis (under the coat, closes the gap between the legs)
  const pelvis = mesh(new THREE.SphereGeometry(1, 24, 16), mat.trousers);
  pelvis.scale.set(0.15, 0.1, 0.1); pelvis.position.copy(hips).add(V(0, -0.035, 0));
  addRigid(pelvis, 'Hips');

  /* ---------------- shoes ---------------- */
  for (const sd of ['Left', 'Right']) {
    const f = P(`${sd}Foot`), toe = P(`${sd}ToeBase`);
    const g = new THREE.Group();
    const up = mesh(new THREE.SphereGeometry(1, 24, 16), mat.shoe);
    up.scale.set(0.056, 0.05, 0.125); up.position.set(f.x, 0.05, (f.z + toe.z) / 2 - 0.005);
    const sole = mesh(new THREE.CylinderGeometry(1, 1, 1, 24), mat.sole);
    sole.scale.set(0.058, 0.014, 0.13); sole.position.set(f.x, 0.008, (f.z + toe.z) / 2 - 0.005);
    g.add(up, sole);
    addRigid(g, `${sd}Foot`);
  }

  /* ---------------- hands ---------------- */
  for (const sd of ['Left', 'Right']) {
    const hand = P(`${sd}Hand`), mid = P(`${sd}HandMiddle1`);
    const dir = mid.clone().sub(hand).normalize();
    const palm = mesh(new THREE.SphereGeometry(1, 20, 14), mat.skin);
    palm.scale.set(0.05, 0.021, 0.042);
    palm.position.copy(hand).addScaledVector(dir, 0.045);
    palm.quaternion.setFromUnitVectors(V(1, 0, 0), dir);
    addRigid(palm, `${sd}Hand`);
    for (const fn of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      const pts = [1, 2, 3].map((k) => P(`${sd}Hand${fn}${k}`));
      const last = pts[2].clone().sub(pts[1]);
      pts.push(pts[2].clone().addScaledVector(last.normalize(), pts[2].distanceTo(pts[1]) * 0.9));
      const r = fn === 'Thumb' ? 0.0115 : fn === 'Pinky' ? 0.0085 : 0.0098;
      for (let k = 0; k < 3; k++) {
        const a = pts[k], b = pts[k + 1], len = a.distanceTo(b);
        const seg = mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat.skin);
        seg.position.copy(a).lerp(b, 0.5);
        seg.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
        addRigid(seg, `${sd}Hand${fn}${k + 1}`);
      }
    }
  }

  /* ---------------- head ---------------- */
  const R = 0.125;
  const HEAD_K = 1.2;                                               // overall head size (built at R, then scaled)
  const C = head.clone().add(V(0, 0.12, 0.035));                    // centre of the cartoon head
  const H = new THREE.Group();
  H.position.copy(C);
  // skull: a soft egg, narrower at the jaw
  const skullG = new THREE.SphereGeometry(R, 56, 40);
  {
    const p = skullG.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const low = ss(-y / R, 0.1, 1);
      x *= 1 - 0.2 * low; z *= 1 - 0.06 * low;
      if (z < 0) z *= 0.95;                                         // flatter back of the head
      p.setXYZ(i, x, y * 1.06, z);
    }
    skullG.computeVertexNormals();
  }
  const skull = mesh(skullG, mat.skin);
  H.add(skull);
  // find the face surface: z of the skull at (x, y), by ray
  const rc = new THREE.Raycaster();
  H.updateMatrixWorld(true);
  const faceZ = (x, y) => {
    rc.set(V(x, y, 1).add(C), V(0, 0, -1));
    const hit = rc.intersectObject(skull, false)[0];
    return hit ? hit.point.z - C.z : 0;
  };
  // ears
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(1, 16, 12), mat.skin);
    ear.scale.set(0.016, 0.03, 0.022); ear.position.set(sx * R * 0.92, -0.01, -0.005);
    H.add(ear);
  }
  // shell helper: a sphere slightly larger than the skull, keeping only a region
  function shell(scale, keep, material, seg = 64) {
    const g = new THREE.SphereGeometry(R * scale, seg, seg * 0.75);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const low = ss(-y / (R * scale), 0.1, 1);
      x *= 1 - 0.2 * low; z *= 1 - 0.06 * low; if (z < 0) z *= 0.95; y *= 1.06;
      const m = ss(keep(x, y, z), -0.01, 0.01);                    // soft edge
      const k = THREE.MathUtils.lerp(0.93 / scale, 1, m);           // outside the region it tucks inside the skull
      p.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    return mesh(g, material);
  }
  // hair: a cap with a natural hairline, then a crown of curls
  // hair region as a margin (metres, > 0 inside): forehead line, above the ears,
  // sideburns, down the back
  const hairline = (x, y, z) => {
    const side = Math.abs(x) / R, fr = THREE.MathUtils.clamp(z / R, -1, 1);
    const front = ss(fr, 0.15, 0.55);                                 // 1 at the forehead
    const burns = ss(side, 0.8, 0.95) * (1 - ss(fr, 0.15, 0.4));      // sideburn columns
    const line = THREE.MathUtils.lerp(THREE.MathUtils.lerp(R * 0.14, -R * 0.45, ss(-fr, 0.05, 0.5)), R * (0.66 - 0.1 * side), front);
    return y - (line - burns * R * 0.3);
  };
  H.add(shell(1.03, hairline, mat.hair));
  {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const vol = [], locks = [];
    // soft volume underneath
    for (let i = 0; i < 90; i++) {
      const th = Math.acos(1 - rnd() * 1.2), ph = rnd() * Math.PI * 2;
      const d = V(Math.sin(th) * Math.cos(ph), Math.cos(th) * 1.06, Math.sin(th) * Math.sin(ph));
      const pt = d.clone().multiplyScalar(R);
      if (hairline(pt.x, pt.y, pt.z) < 0.006 || pt.z > R * 0.6) continue;
      const top = ss(pt.y / R, 0.2, 0.95);
      const g = new THREE.SphereGeometry(0.026 + rnd() * 0.012, 10, 8);
      g.translate(...pt.clone().multiplyScalar(1.04 + 0.08 * top).toArray());
      vol.push(g);
    }
    // wavy curls: short spiral locks springing out of the scalp
    const lock = (base, out, turns, rad, len, tube) => {
      const n = out.clone().normalize();
      const t1 = new THREE.Vector3(0, 1, 0).cross(n); if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0); t1.normalize();
      const t2 = n.clone().cross(t1);
      const pts = [];
      for (let k = 0; k <= 24; k++) {
        const u = k / 24, a = u * turns * Math.PI * 2, r = rad * (1 - 0.35 * u);
        pts.push(base.clone().addScaledVector(n, u * len).addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, tube, 7, false);
    };
    for (let i = 0; i < 260 && locks.length < 70; i++) {
      const th = Math.acos(1 - rnd() * 1.15), ph = rnd() * Math.PI * 2;
      const d = V(Math.sin(th) * Math.cos(ph), Math.cos(th) * 1.06, Math.sin(th) * Math.sin(ph));
      const pt = d.clone().multiplyScalar(R);
      if (hairline(pt.x, pt.y, pt.z) < 0.01 || pt.z > R * 0.58) continue;
      const top = ss(pt.y / R, 0.2, 0.95);
      const base = pt.clone().multiplyScalar(1.1 + 0.08 * top);
      const out = d.clone().add(V(0, 0.4, 0)).add(V((rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6));
      locks.push(lock(base, out, 1.2 + rnd() * 0.8, 0.011 + rnd() * 0.005, 0.016 + 0.012 * top, 0.0085 + rnd() * 0.003));
    }
    // the signature curl falling onto the forehead, and two smaller waves
    const fz = faceZ(0, R * 0.62);
    locks.push(lock(V(0.012, R * 0.86, fz * 0.7), V(0.25, -1, 1.1), 1.6, 0.013, 0.05, 0.0095));
    locks.push(lock(V(-0.034, R * 0.82, fz * 0.62), V(-0.3, -0.7, 1), 1.2, 0.011, 0.034, 0.0085));
    locks.push(lock(V(0.05, R * 0.78, fz * 0.58), V(0.5, -0.6, 1), 1.1, 0.01, 0.03, 0.008));
    H.add(mesh(mergeGeometries(vol), mat.hair));
    H.add(mesh(mergeGeometries(locks), mat.hair));
  }
  // beard: cheeks, jaw and chin, joining the sideburns
  // beard: jaw and chin, rising along the jawline into the sideburns; the
  // cheeks above it stay clear
  const beard = shell(1.042, (x, y, z) => {
    const side = Math.abs(x) / R;
    const top = R * (-0.46 + 0.5 * ss(side, 0.45, 0.92));            // the beard line
    return Math.min(top - y, z + R * 0.12);
  }, mat.hair, 80);
  H.add(beard);

  // eyes with lids
  const lids = [], eyesG = [];
  for (const sx of [-1, 1]) {
    const ex = sx * 0.047, ey = 0.006;
    const ez = faceZ(ex, ey) - 0.017;
    const eye = new THREE.Group(); eye.position.set(ex, ey, ez);
    const scl = mesh(new THREE.SphereGeometry(0.031, 28, 20), mat.white);
    const iris = mesh(new THREE.SphereGeometry(0.0195, 24, 16), mat.iris); iris.position.z = 0.0215; iris.scale.z = 0.6;
    const pup = mesh(new THREE.SphereGeometry(0.0105, 16, 12), mat.black); pup.position.z = 0.0285; pup.scale.z = 0.5;
    const hl = mesh(new THREE.SphereGeometry(0.0048, 10, 8), mat.white); hl.position.set(0.007, 0.008, 0.0325);
    const hl2 = mesh(new THREE.SphereGeometry(0.0022, 8, 6), mat.white); hl2.position.set(-0.006, -0.006, 0.033);
    eye.add(scl, iris, pup, hl, hl2);
    eye.scale.set(1, 1.1, 1);
    // lid: a skin-coloured half shell that rolls down over the eye to blink
    const lid = mesh(new THREE.SphereGeometry(0.0345, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.skin);
    eye.add(lid); lids.push(lid); eyesG.push(eye);
    H.add(eye);
  }
  // brows: thick and dark
  const brows = [];
  for (const sx of [-1, 1]) {
    const by = 0.047, bx = sx * 0.05;
    const arc = new THREE.QuadraticBezierCurve3(V(-0.026, -0.006, 0), V(-0.004, 0.012, 0.004), V(0.026, -0.002, 0));
    const g = new THREE.TubeGeometry(arc, 20, 0.0108, 8, false);
    { // taper toward the outer end
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = THREE.MathUtils.clamp((p.getX(i) + 0.026) / 0.052, 0, 1);
        const k = 1 - 0.45 * u, cy = arc.getPoint(u).y;
        p.setY(i, cy + (p.getY(i) - cy) * k);
      }
      g.computeVertexNormals();
    }
    const b = mesh(g, mat.brow);
    b.scale.set(sx, 1, 0.7);                                          // mirrored: thick inner end
    b.position.set(bx, by, faceZ(bx, by) + 0.002);
    H.add(b); brows.push(b);
  }
  // rosy cheeks
  for (const sx of [-1, 1]) {
    const c = mesh(new THREE.SphereGeometry(0.018, 14, 10), mat.blush);
    c.scale.set(1.2, 0.75, 0.3); c.position.set(sx * 0.068, -0.03, faceZ(sx * 0.068, -0.03) - 0.002);
    H.add(c);
  }
  // nose
  // a round button nose
  const nose = mesh(new THREE.SphereGeometry(0.025, 22, 16), mat.nose);
  nose.scale.set(1.05, 0.95, 0.95); nose.position.set(0, -0.028, faceZ(0, -0.028) + 0.008);
  H.add(nose);
  // moustache: a soft arc over the mouth
  const mous = mesh(new THREE.TorusGeometry(0.026, 0.0085, 8, 20, Math.PI), mat.hair);
  mous.scale.set(1.15, 0.55, 0.8);                                  // arc over the mouth, ends drooping
  mous.position.set(0, -0.058, faceZ(0, -0.066) + 0.004);
  H.add(mous);
  // mouth: a line that curves into a smile (morph target)
  const mouthCurve = (smile) => new THREE.QuadraticBezierCurve3(
    V(-0.028 - 0.004 * smile, -0.08 + 0.009 * smile, 0), V(0, -0.084 - 0.008 * smile, 0.006), V(0.028 + 0.004 * smile, -0.08 + 0.009 * smile, 0));
  const mz = faceZ(0, -0.082) + 0.006;
  const m0 = new THREE.TubeGeometry(mouthCurve(0), 20, 0.0042, 8, false);
  const m1 = new THREE.TubeGeometry(mouthCurve(1), 20, 0.0042, 8, false);
  m0.morphAttributes.position = [m1.attributes.position];
  const mouth = mesh(m0, mat.lip);
  mouth.position.z = mz;
  mouth.updateMorphTargets();
  H.add(mouth);
  H.scale.setScalar(HEAD_K);
  addRigid(H, 'Head');

  /* ---------------- assemble ---------------- */
  // hide the original realistic meshes; keep their skeleton
  avatar.traverse((o) => { if (o.isMesh && !o.userData.cartoon) o.visible = false; });
  // Parts that move on their own (lids, brows, mouth) or get hidden under the
  // mask stay separate objects on their bones. Every other rigid part is baked
  // into one skinned mesh per material (each vertex fully on its own bone):
  // the same look, but a handful of draw calls instead of ~75, so phones hold a
  // steady frame rate.
  for (const o of [...lids, ...brows, nose, mous, mouth]) o.userData.live = true;
  const bake = new Map();                                            // material → [geometry, bone]
  for (const [obj, b] of rigid) {
    obj.updateMatrixWorld(true);                                    // world rest pose (no parent yet)
    const statics = [];
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry.index) return;
      let live = false; o.traverseAncestors((x) => { if (x.userData.live) live = true; });
      if (o.userData.live || live) return;
      statics.push(o);
    });
    for (const o of statics) {
      const g = o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(o.matrixWorld);
      const n = g.attributes.position.count, k = bi(b);
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? k : 0)), 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
      if (!bake.has(o.material)) bake.set(o.material, []);
      bake.get(o.material).push(g);
      o.parent ? o.parent.remove(o) : (o.userData.gone = true);
    }
  }
  for (const [material, geos] of bake) {
    for (const g of geos) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
    const merged = mergeGeometries(geos);
    if (merged) skinnedParts.push([merged, material]);
  }

  const skel = new THREE.Skeleton(bones);                            // inverses from the current rest pose
  const parts = new THREE.Group(); parts.name = 'cartoon';
  avatar.add(parts);
  parts.updateMatrixWorld(true);
  for (const [geo, material] of skinnedParts) {
    const m = new THREE.SkinnedMesh(geo, material);
    m.frustumCulled = false; m.userData.cartoon = true;
    parts.add(m); m.updateMatrixWorld(true);
    m.bind(skel, m.matrixWorld);
  }
  // what's left of the rigid parts (the live face pieces) rides its bone
  for (const [obj, b] of rigid) {
    if (obj.userData.gone) continue;
    let any = false; obj.traverse((o) => { if (o.isMesh) any = true; });
    if (!any) continue;
    obj.updateMatrixWorld(true);
    b.attach(obj);
    obj.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.userData.cartoon = true; } });
  }
  parts.traverse((o) => { if (o.isMesh) o.userData.cartoon = true; });

  /* ---------------- face controls ---------------- */
  const LID_OPEN = -0.6, LID_SHUT = 1.5;
  const browY = brows.map((b) => b.position.y);
  const face = {
    set(blink, smile) {
      for (const l of lids) l.rotation.x = THREE.MathUtils.lerp(LID_OPEN, LID_SHUT, Math.min(1, blink));
      mouth.morphTargetInfluences[0] = smile;
      brows.forEach((b, i) => { b.position.y = browY[i] + 0.004 * smile; });
    },
    // under the surgical mask, what would poke through it is hidden
    masked(on) { nose.visible = mouth.visible = mous.visible = !on; },
  };
  face.set(0, 0);
  // head geometry for the props: centre and radius, in Head-bone space
  const headBone = bone('Head');
  return {
    face, materials: Object.values(mat),
    head: { centre: headBone.worldToLocal(C.clone()), radius: R * HEAD_K, scale: HEAD_K },
    headRestQ: headBone.getWorldQuaternion(new THREE.Quaternion()),
  };
}

/* Natural blinking: every 2.5–5.5 s, sometimes a double blink; ~150 ms each. */
export function blinker() {
  let next = 1.5, t0 = -1, doubles = 0;
  return (time) => {
    if (t0 < 0 && time >= next) { t0 = time; }
    if (t0 >= 0) {
      const k = (time - t0) / 0.16;
      if (k >= 1) {
        t0 = -1;
        if (doubles === 0 && Math.random() < 0.2) { doubles = 1; next = time + 0.12; }
        else { doubles = 0; next = time + 2.5 + Math.random() * 3; }
        return 0;
      }
      return k < 0.4 ? THREE.MathUtils.smoothstep(k, 0, 0.4) : 1 - THREE.MathUtils.smoothstep(k, 0.4, 1);
    }
    return 0;
  };
}
