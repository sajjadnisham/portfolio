/* =========================================================
   Nisham as a late-90s TV-cartoon scientist, modelled in code.

   The look of that era's lab cartoons: bold geometric shapes, flat cel
   shading (two or three tones, no gradients), thick black outlines, a big
   boxy head on a small body, chunky gloves and boots. Same skeleton and API
   as minifig.js / cartoon.js, so every move, the IK hands and the physics
   keep working.
     head    a wide, rounded box with thick black glasses (white lenses, dot
             pupils that blink), brows, short curly hair, beard and moustache
     body    white lab coat (lapels, pocket + pen, ID badge, skirt to the knees)
     hands   purple rubber gloves      feet   black boots
   Outlines: an inverted hull per skinned mesh (back faces pushed out along
   the skinned normal in the vertex shader), so they bend with him.
   ========================================================= */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// flat TV-cartoon palette
const COL = {
  skin: 0xc68857, glove: 0x7b4fc4, hair: 0x1d140e, beard: 0x2b1d14, apron: 0xffffff, apronLine: 0xc9d3e6,
  trousers: 0x2f3440, feet: 0x15151a, eye: 0x101010, teeth: 0xffffff, pen: 0xe0402f,
  badge: 0x2bb3c4, badgeCard: 0xffffff, frame: 0x101010, lens: 0xf4fbff,
};
const OUTLINE = 0.014;                       // metres


export function buildCartoon(avatar) { return buildLabToon(avatar); }

export function buildLabToon(avatar) {
  avatar.updateMatrixWorld(true);
  const bone = (n) => avatar.getObjectByName(n);
  const P = (n) => bone(n).getWorldPosition(new THREE.Vector3());
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ss = THREE.MathUtils.smoothstep;

  // flat cel shading: three hard tones
  const ramp = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
  const plastic = (color, extra = {}) => {
    const { roughness, clearcoat, clearcoatRoughness, metalness, ...rest } = extra;   // (no gloss in a cel look)
    return new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...rest });
  };
  const mat = {
    skin: plastic(COL.skin), hair: plastic(COL.hair, { roughness: 0.45 }), beard: plastic(COL.beard, { roughness: 0.5 }),
    coat: plastic(COL.apron, { roughness: 0.42 }), apron: plastic(COL.apron, { roughness: 0.45, side: THREE.DoubleSide }), apronLine: plastic(COL.apronLine, { roughness: 0.5 }),
    trousers: plastic(COL.trousers), feet: plastic(COL.feet),
    eye: plastic(COL.eye, { roughness: 0.2 }), white: plastic(0xffffff, { roughness: 0.15 }), teeth: plastic(COL.teeth),
    pen: plastic(COL.pen), badge: plastic(COL.badge), badgeCard: plastic(COL.badgeCard),
    glove: plastic(COL.glove), frame: plastic(COL.frame), lens: new THREE.MeshBasicMaterial({ color: COL.lens }),
  };
  const mesh = (g, m) => new THREE.Mesh(g, m);

  /* ---------- skinning + rigid helpers (as in cartoon.js) ---------- */
  const bones = [];
  const bi = (b) => { const o = typeof b === 'string' ? bone(b) : b; let i = bones.indexOf(o); if (i < 0) { bones.push(o); i = bones.length - 1; } return i; };
  const skinnedParts = [];
  function addSkinned(geo, material, weightOf) {
    const pos = geo.attributes.position, n = pos.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(pos, i);
      const ws = weightOf(p).filter((w) => w[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const tot = ws.reduce((a, w) => a + w[1], 0) || 1;
      ws.forEach(([b, w], k) => { si[i * 4 + k] = bi(b); sw[i * 4 + k] = w / tot; });
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    skinnedParts.push([geo, material]);
  }
  const rigid = [];
  const addRigid = (obj, boneName) => { rigid.push([obj, bone(boneName)]); return obj; };
  // a capsule between two world points
  const capsule = (a, b, r, m) => {
    const len = a.distanceTo(b);
    const c = mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 18), m);
    c.position.copy(a).lerp(b, 0.5);
    c.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    return c;
  };
  // a box with rounded edges (moulded look): w × h × d, centred
  const roundBox = (w0, h0, d, r, m) => {
    const b = r * 0.9, w = w0 - 2 * b, h = h0 - 2 * b;               // the bevel grows the outline by b
    const s = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r;
    s.moveTo(-x, -h / 2); s.lineTo(x, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -y);
    s.lineTo(w / 2, y); s.quadraticCurveTo(w / 2, h / 2, x, h / 2); s.lineTo(-x, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, y); s.lineTo(-w / 2, -y); s.quadraticCurveTo(-w / 2, -h / 2, -x, -h / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelSize: b, bevelThickness: r, bevelSegments: 4, curveSegments: 6 });
    g.translate(0, 0, -(d - 2 * r) / 2);
    g.computeVertexNormals();
    return mesh(g, m);
  };

  /* ---------- rest-pose landmarks ---------- */
  const hips = P('Hips'), spine2 = P('Spine2'), headP = P('Head');
  const SPINE = [['Hips', hips.y], ['Spine', P('Spine').y], ['Spine1', P('Spine1').y], ['Spine2', spine2.y], ['Neck', P('Neck').y]];

  /* ---------- torso: a tapered block, gently skinned to the spine ---------- */
  const T_BOT = 0.955, T_TOP = 1.5, T_D = 0.2, T_Z = -0.012;
  const halfW = (y) => THREE.MathUtils.lerp(0.215, 0.16, (y - T_BOT) / (T_TOP - T_BOT));   // wider at the hips
  // weights up the spine, blended across each joint (torso and apron bib share them)
  const spineW = (p) => {
    const w = [];
    for (let i = 0; i < SPINE.length; i++) {
      const lo = SPINE[i][1], hi = i + 1 < SPINE.length ? SPINE[i + 1][1] : 9;
      const k = ss(p.y, lo - 0.05, lo + 0.05) * (1 - ss(p.y, hi - 0.05, hi + 0.05));
      if (k > 0) w.push([SPINE[i][0], k]);
    }
    return w.length ? w : [['Hips', 1]];
  };
  {
    const b = 0.02, sh = new THREE.Shape();
    sh.moveTo(-halfW(T_BOT) + b, T_BOT + b); sh.lineTo(halfW(T_BOT) - b, T_BOT + b);
    sh.lineTo(halfW(T_TOP) - b, T_TOP - b); sh.lineTo(-halfW(T_TOP) + b, T_TOP - b); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: T_D - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 4 });
    g.translate(0, 0, T_Z - (T_D - 2 * b) / 2);
    g.computeVertexNormals();
    addSkinned(g, mat.coat, spineW);
  }
  /* ---------- full clinical coat: white body and sleeves (above), collar,
     lapels, buttons, pockets with a red pen, ID badge, and a skirt that wraps
     all the way round to the knees ---------- */
  const FRONT = T_Z + T_D / 2;
  {
    // lapels + collar band, following the torso (same spine weights)
    for (const sx of [-1, 1]) {
      const l = new THREE.Shape();
      l.moveTo(sx * 0.02, T_TOP - 0.01); l.lineTo(sx * 0.13, T_TOP - 0.03); l.lineTo(sx * 0.075, 1.3); l.lineTo(sx * 0.012, 1.16); l.closePath();
      const g = new THREE.ExtrudeGeometry(l, { depth: 0.006, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 2 });
      g.translate(0, 0, FRONT + 0.006); g.computeVertexNormals();
      addSkinned(g, mat.apronLine, spineW);
    }
    const collar = new THREE.CylinderGeometry(0.085, 0.095, 0.045, 32, 1, true, Math.PI * 0.15, Math.PI * 1.7);
    collar.translate(0, T_TOP + 0.005, T_Z); addSkinned(collar, mat.apron, spineW);
    for (const y of [1.24, 1.14, 1.04]) {
      const btn = new THREE.CylinderGeometry(0.009, 0.009, 0.006, 14); btn.rotateX(Math.PI / 2); btn.translate(0, y, FRONT + 0.006);
      addSkinned(btn, mat.apronLine, spineW);
    }
    const pk = new THREE.BoxGeometry(0.075, 0.07, 0.006); pk.translate(0.1, 1.3, FRONT + 0.004); addSkinned(pk, mat.apronLine, spineW);
    const pen = new THREE.CylinderGeometry(0.0065, 0.0065, 0.07, 12); pen.translate(0.085, 1.335, FRONT + 0.011); addSkinned(pen, mat.pen, spineW);
    const badge = new THREE.BoxGeometry(0.055, 0.075, 0.006); badge.translate(-0.1, 1.29, FRONT + 0.005); addSkinned(badge, mat.badge, spineW);
    const card = new THREE.BoxGeometry(0.042, 0.038, 0.004); card.translate(-0.1, 1.282, FRONT + 0.01); addSkinned(card, mat.badgeCard, spineW);
  }
  {
    // the coat's skirt: an open-fronted wrap from the waist to the knees. Each
    // side follows its thigh (front fully, back partly), so he can stride and sit.
    const knee = P('LeftLeg').y, ytop = 1.03, ybot = knee + 0.03;
    const N = 48, ROWS = 16, GAP = 0.18, verts = [], idx = [];
    for (let r = 0; r <= ROWS; r++) {
      const v = r / ROWS, y = ytop + (ybot - ytop) * v;
      const rx = 0.245 + 0.025 * v, rz = 0.155 + 0.02 * v;           // roomy over the hips, a little flare toward the hem
      for (let j = 0; j <= N; j++) {
        const ang = Math.PI / 2 + GAP + (Math.PI * 2 - 2 * GAP) * (j / N);
        verts.push(Math.cos(ang) * rx, y, T_Z + Math.sin(ang) * rz);
      }
      if (r > 0) { const b0 = (r - 1) * (N + 1), b1 = r * (N + 1); for (let j = 0; j < N; j++) idx.push(b0 + j, b1 + j, b0 + j + 1, b0 + j + 1, b1 + j, b1 + j + 1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx); g.computeVertexNormals();
    addSkinned(g, mat.apron, (p) => {
      const depth = ss(ytop - p.y, 0.02, 0.18);
      const front = ss((p.z - T_Z) / 0.155, -0.6, 0.7);               // 0 at the back … 1 at the front
      const side = ss(Math.abs(p.x) / 0.23, 0.05, 0.35);             // the centre back stays with the hips
      const wt = depth * (0.35 + 0.65 * front) * Math.max(side, front);
      return [['Hips', 1 - wt], [p.x >= 0 ? 'LeftUpLeg' : 'RightUpLeg', wt]];
    });
    // hip pockets
    for (const sx of [-1, 1]) {
      const hp = new THREE.BoxGeometry(0.08, 0.075, 0.006); hp.rotateY(sx * 0.5);
      hp.translate(sx * 0.16, 0.86, T_Z + 0.135);
      addSkinned(hp, mat.apronLine, () => [['Hips', 1 - 0.4], [sx > 0 ? 'LeftUpLeg' : 'RightUpLeg', 0.4]]);
    }
  }

  /* ---------- hips and legs: blocky charcoal, black feet ---------- */
  const hipBlock = roundBox(0.42, 0.11, 0.19, 0.02, mat.trousers);
  hipBlock.position.set(0, 0.935, -0.005); addRigid(hipBlock, 'Hips');
  for (const sd of ['Left', 'Right']) {
    const up = P(`${sd}UpLeg`), knee = P(`${sd}Leg`), foot = P(`${sd}Foot`), toe = P(`${sd}ToeBase`);
    const thigh = roundBox(0.165, up.y - knee.y + 0.02, 0.185, 0.022, mat.trousers);
    thigh.position.set(up.x, (up.y + knee.y) / 2, up.z - 0.005); addRigid(thigh, `${sd}UpLeg`);
    const kneeJ = mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.158, 24), mat.trousers);
    kneeJ.rotation.z = Math.PI / 2; kneeJ.position.copy(knee).setZ(knee.z - 0.005); addRigid(kneeJ, `${sd}Leg`);
    const shin = roundBox(0.165, knee.y - 0.075, 0.185, 0.022, mat.trousers);
    shin.position.set(knee.x, (knee.y + 0.075) / 2 + 0.01, knee.z - 0.005); addRigid(shin, `${sd}Leg`);
    const shoe = roundBox(0.19, 0.11, 0.3, 0.04, mat.feet);
    shoe.position.set(foot.x, 0.055, (foot.z + toe.z) / 2 + 0.03); addRigid(shoe, `${sd}Foot`);
  }

  /* ---------- arms: white sleeves, round shoulders, C-shaped hands ---------- */
  for (const [sd, sx] of [['Left', 1], ['Right', -1]]) {
    const arm = P(`${sd}Arm`), fore = P(`${sd}ForeArm`), hand = P(`${sd}Hand`), mid = P(`${sd}HandMiddle1`);
    const sh = mesh(new THREE.SphereGeometry(0.068, 24, 16), mat.coat); sh.position.copy(arm).add(V(-sx * 0.03, -0.03, 0)); addRigid(sh, `${sd}Arm`);
    addRigid(capsule(arm, fore, 0.062, mat.coat), `${sd}Arm`);
    addRigid(capsule(fore, hand.clone().lerp(fore, 0.12), 0.056, mat.coat), `${sd}ForeArm`);
    // wrist + C hand (the classic open grip), opening forward
    const dir = mid.clone().sub(hand).normalize();
    const wrist = capsule(hand.clone().addScaledVector(dir, -0.03), hand.clone().addScaledVector(dir, 0.035), 0.042, mat.glove);   // glove cuff
    const c = mesh(new THREE.TorusGeometry(0.04, 0.022, 12, 24, Math.PI * 1.55), mat.glove);
    c.position.copy(hand).addScaledVector(dir, 0.075);
    // the C lies in the plane of arm and palm: its gap faces away from the wrist
    c.quaternion.setFromUnitVectors(V(1, 0, 0), dir);
    c.rotateZ(Math.PI * 0.225);
    const handG = new THREE.Group(); handG.add(wrist, c);
    addRigid(handG, `${sd}Hand`);
  }

  /* ---------- head: a big, wide rounded box ---------- */
  const HW = 0.33, HH = 0.27, HD = 0.25;
  const R = HD / 2;                                                 // (front of the face, for the mask)
  const C = V(0, headP.y + 0.035, 0.012);
  const H = new THREE.Group(); H.position.copy(C);
  H.add(roundBox(HW, HH, HD, 0.06, mat.skin));
  const neck = mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.08, 20), mat.skin); neck.position.y = -HH / 2 - 0.02; H.add(neck);
  for (const sx of [-1, 1]) {                                       // ears
    const ear = mesh(new THREE.SphereGeometry(0.03, 14, 10), mat.skin); ear.scale.set(0.5, 1, 0.8);
    ear.position.set(sx * HW / 2, -0.01, -0.01); H.add(ear);
  }
  const FZ = HD / 2;                                                // the face plane
  const onFace = (x, y, lift = 0.0015) => V(x, y, FZ + lift);
  // beard: a block over the jaw and chin with sideburns up the sides
  {
    const bd = roundBox(HW + 0.014, 0.12, HD * 0.75, 0.05, mat.beard);
    bd.position.set(0, -HH / 2 + 0.06, HD * 0.13 + 0.006); H.add(bd);
    for (const sx of [-1, 1]) {
      const sb = roundBox(0.03, 0.12, HD * 0.5, 0.012, mat.beard);
      sb.position.set(sx * (HW / 2 + 0.002), 0.0, -0.005); H.add(sb);
    }
  }
  // glasses: thick black frames, white lenses; the pupils behind them blink
  const eyes = [], brows = [];
  for (const sx of [-1, 1]) {
    const cx = sx * 0.072, cy = 0.03;
    const rim = mesh(new THREE.TorusGeometry(0.052, 0.012, 10, 32), mat.frame); rim.position.copy(onFace(cx, cy, 0.012)); H.add(rim);
    const lens = mesh(new THREE.CircleGeometry(0.05, 32), mat.lens); lens.position.copy(onFace(cx, cy, 0.006)); H.add(lens);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, HD * 0.55), mat.frame);
    arm.position.set(sx * (HW / 2 + 0.004), cy, FZ - HD * 0.27); H.add(arm);
    const eg = new THREE.Group(); eg.position.copy(onFace(cx + sx * 0.008, cy - 0.004, 0.009));
    const dot = mesh(new THREE.CircleGeometry(0.014, 20), mat.eye);
    eg.add(dot); H.add(eg); eyes.push(eg);
    const br = mesh(new THREE.BoxGeometry(0.075, 0.017, 0.012), mat.beard);
    br.position.copy(onFace(cx, cy + 0.075, 0.006)); br.rotation.z = -sx * 0.14;
    H.add(br); brows.push(br);
  }
  const bridge = mesh(new THREE.BoxGeometry(0.04, 0.012, 0.012), mat.frame); bridge.position.copy(onFace(0, 0.036, 0.012)); H.add(bridge);
  // moustache and a wide cartoon grin on the beard
  const BZ = HD * 0.13 + 0.006 + HD * 0.375;                       // beard front
  const mous = roundBox(0.12, 0.028, 0.02, 0.008, mat.beard);
  mous.position.set(0, -0.045, BZ + 0.004); H.add(mous);
  const grin = (s) => new THREE.QuadraticBezierCurve3(V(-0.045 - 0.006 * s, -0.075 + 0.012 * s, 0), V(0, -0.085 - 0.014 * s, 0), V(0.045 + 0.006 * s, -0.075 + 0.012 * s, 0));
  const m0 = new THREE.TubeGeometry(grin(0), 20, 0.007, 8, false), m1 = new THREE.TubeGeometry(grin(1), 20, 0.007, 8, false);
  m0.morphAttributes.position = [m1.attributes.position];
  const mouth = mesh(m0, mat.teeth); mouth.position.z = BZ + 0.004; mouth.scale.z = 0.4; mouth.updateMorphTargets();
  H.add(mouth);
  // hair: a flat-topped mass of tight curls
  {
    const cap = roundBox(HW + 0.03, 0.075, HD + 0.03, 0.03, mat.hair);
    cap.position.set(0, HH / 2 + 0.01, -0.01); H.add(cap);
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const curls = [];
    for (let i = 0; i < 110; i++) {
      const x = (rnd() - 0.5) * (HW + 0.02), z = (rnd() - 0.5) * (HD + 0.02) - 0.01;
      const g = new THREE.SphereGeometry(0.022 + rnd() * 0.01, 10, 8);
      g.translate(x, HH / 2 + 0.045 + rnd() * 0.012, z);
      curls.push(g);
    }
    for (let i = 0; i < 9; i++) {                                    // a fringe of curls over the forehead
      const g = new THREE.SphereGeometry(0.026, 10, 8);
      g.translate(-HW / 2 + 0.03 + i * (HW - 0.06) / 8, HH / 2 - 0.005, HD / 2 + 0.006);
      curls.push(g);
    }
    H.add(mesh(mergeGeometries(curls), mat.hair));
  }
  addRigid(H, 'Head');

  /* ---------- assemble (static pieces baked into skinned meshes) ---------- */
  avatar.traverse((o) => { if (o.isMesh) o.visible = false; });        // hide the realistic avatar's meshes
  const live = new Set([...eyes, ...brows, mous, mouth]);
  for (const o of live) o.traverse((c) => { c.userData.live = true; });
  const bake = new Map();
  for (const [obj, b] of rigid) {
    obj.updateMatrixWorld(true);
    const statics = [];
    obj.traverse((o) => { if (o.isMesh && !o.userData.live && o.geometry.index) statics.push(o); });
    for (const o of statics) {
      const g = o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {};
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(o.matrixWorld);
      const n = g.attributes.position.count, k = bi(b);
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? k : 0)), 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
      if (!bake.has(o.material)) bake.set(o.material, []);
      bake.get(o.material).push(g);
      if (o.parent) o.parent.remove(o); else o.userData.gone = true;
    }
  }
  for (const [material, geos] of bake) {
    const merged = mergeGeometries(geos);
    if (merged) skinnedParts.push([merged, material]);
  }
  // one skinned mesh per material (fewer draw calls)
  {
    const byMat = new Map();
    for (const [g, m] of skinnedParts) { if (!byMat.has(m)) byMat.set(m, []); byMat.get(m).push(g.index ? g.toNonIndexed() : g); }
    skinnedParts.length = 0;
    for (const [m, gs] of byMat) { const mg = gs.length > 1 ? mergeGeometries(gs) : gs[0]; if (mg) skinnedParts.push([mg, m]); }
  }
  const skel = new THREE.Skeleton(bones);
  const parts = new THREE.Group(); parts.name = 'labtoon';
  avatar.add(parts); parts.updateMatrixWorld(true);
  // the ink line: back faces of a copy pushed out along the (skinned) normal
  const ink = new THREE.MeshBasicMaterial({ color: 0x0b0b0e, side: THREE.BackSide });
  ink.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <skinning_vertex>', `#include <skinning_vertex>
      transformed += normalize( objectNormal ) * ${OUTLINE.toFixed(4)};`);
  };
  const hullOf = (geo) => {
    // smooth normals across hard edges so the outline doesn't crack at corners
    const g = new THREE.BufferGeometry();
    for (const k of ['position', 'skinIndex', 'skinWeight']) g.setAttribute(k, geo.attributes[k]);
    if (geo.index) g.setIndex(geo.index);
    const m = mergeVertices(g, 1e-4);
    m.computeVertexNormals();
    return m;
  };
  for (const [geo, material] of skinnedParts) {
    const m = new THREE.SkinnedMesh(geo, material);
    m.frustumCulled = false; m.userData.cartoon = true;
    parts.add(m); m.updateMatrixWorld(true);
    m.bind(skel, m.matrixWorld);
    if (material === mat.pen || material === mat.badgeCard || material === mat.lens) continue;
    const o = new THREE.SkinnedMesh(hullOf(geo), ink);
    o.frustumCulled = false; o.userData.cartoon = true; o.renderOrder = -1;
    parts.add(o); o.updateMatrixWorld(true);
    o.bind(skel, m.matrixWorld);
  }
  for (const [obj, b] of rigid) {
    if (obj.userData.gone) continue;
    let any = false; obj.traverse((o) => { if (o.isMesh) any = true; });
    if (!any) continue;
    obj.updateMatrixWorld(true);
    b.attach(obj);
    obj.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.userData.cartoon = true; } });
  }

  /* ---------- face controls ---------- */
  const browY = brows.map((b) => b.position.y);
  const face = {
    set(blink, smile) {
      for (const e of eyes) e.scale.y = 1 - 0.9 * Math.min(1, blink);
      mouth.morphTargetInfluences[0] = smile;
      brows.forEach((b, i) => { b.position.y = browY[i] + 0.004 * smile; });
    },
    masked(on) { mouth.visible = mous.visible = !on; },
  };
  face.set(0, 0);
  const headBone = bone('Head');
  return {
    face, materials: Object.values(mat),
    // the surgical mask: centred on the head's axis at mouth level, sized to the cylinder
    head: { centre: headBone.worldToLocal(C.clone()), radius: R, scale: 1, maskScale: 1.55, maskDrop: 0.06 },
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
