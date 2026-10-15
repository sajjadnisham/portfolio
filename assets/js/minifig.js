/* =========================================================
   Minifigure Nisham: a glossy toy-brick miniature, modelled in code.

   Same idea as cartoon.js (and the same API, so hero3d.js can use either):
   built around the existing animated skeleton in its rest pose (T-pose,
   metres, facing +z), so every move, the IK hands and the look-at keep
   working. Toy parts are rigid plastic pieces riding their bones:
     head    a rounded cylinder with a printed-style face: dot eyes, thick
             brows, beard and moustache, a white-toothed grin; curly hair piece
     torso   a tapered block (bends gently with the spine) in a white lab coat:
             lapels, buttons, breast pocket with a pen, ID badge
     arms    white sleeve tubes, round shoulders, C-shaped hands
     legs    blocky charcoal hips and legs, black feet
   Static pieces are baked into one skinned mesh per material (few draw calls).
   ========================================================= */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// classic toy-brick palette: bright yellow face, hands and body; white apron
const COL = {
  skin: 0xf6c21c, body: 0xf6c21c, hair: 0x2a1a10, beard: 0x3a2414, apron: 0xfbfbf8, apronLine: 0xd9dde2,
  trousers: 0x2c3e66, feet: 0x1b1b1b, eye: 0x111111, teeth: 0xffffff, pen: 0xd0312d,
  badge: 0x1f8a9e, badgeCard: 0xffffff,
};

export function buildCartoon(avatar) { return buildMinifig(avatar); }

export function buildMinifig(avatar) {
  avatar.updateMatrixWorld(true);
  const bone = (n) => avatar.getObjectByName(n);
  const P = (n) => bone(n).getWorldPosition(new THREE.Vector3());
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ss = THREE.MathUtils.smoothstep;

  // glossy moulded plastic
  const plastic = (color, extra = {}) => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.28, ...extra,
  });
  const mat = {
    skin: plastic(COL.skin), hair: plastic(COL.hair, { roughness: 0.45 }), beard: plastic(COL.beard, { roughness: 0.5 }),
    coat: plastic(COL.body), apron: plastic(COL.apron, { roughness: 0.45, side: THREE.DoubleSide }), apronLine: plastic(COL.apronLine, { roughness: 0.5 }),
    trousers: plastic(COL.trousers), feet: plastic(COL.feet),
    eye: plastic(COL.eye, { roughness: 0.2 }), white: plastic(0xffffff, { roughness: 0.15 }), teeth: plastic(COL.teeth),
    pen: plastic(COL.pen), badge: plastic(COL.badge), badgeCard: plastic(COL.badgeCard),
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
  /* ---------- white apron: bib on the chest, skirt to the knees ---------- */
  const FRONT = T_Z + T_D / 2;
  {
    // bib: follows the torso exactly (same spine weights), a little proud of it
    const bib = new THREE.Shape(), bw0 = 0.13, bw1 = 0.17, y0 = 1.39, y1 = 0.97;
    bib.moveTo(-bw0, y0); bib.lineTo(bw0, y0); bib.lineTo(bw1, y1); bib.lineTo(-bw1, y1); bib.closePath();
    const g = new THREE.ExtrudeGeometry(bib, { depth: 0.006, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 2 });
    g.translate(0, 0, FRONT + 0.016);
    g.computeVertexNormals();
    addSkinned(g, mat.apron, spineW);
    // breast pocket with a red pen, and the ID badge on the bib
    const pk = new THREE.Shape(); pk.moveTo(-0.045, 1.33); pk.lineTo(0.045, 1.33); pk.lineTo(0.045, 1.25); pk.lineTo(-0.045, 1.25); pk.closePath();
    const pg = new THREE.ExtrudeGeometry(pk, { depth: 0.004, bevelEnabled: false });
    pg.translate(0.06, 0, FRONT + 0.028); addSkinned(pg, mat.apronLine, spineW);
    const pen = new THREE.CylinderGeometry(0.0065, 0.0065, 0.07, 12); pen.translate(0.04, 1.335, FRONT + 0.034); addSkinned(pen, mat.pen, spineW);
    const badge = new THREE.BoxGeometry(0.055, 0.075, 0.006); badge.translate(-0.075, 1.28, FRONT + 0.03); addSkinned(badge, mat.badge, spineW);
    const card = new THREE.BoxGeometry(0.042, 0.038, 0.004); card.translate(-0.075, 1.272, FRONT + 0.035); addSkinned(card, mat.badgeCard, spineW);
    // neck straps from the bib's top corners up and over the shoulders
    for (const sx of [-1, 1]) {
      const st = new THREE.BoxGeometry(0.03, 0.14, 0.008);
      st.rotateX(-0.55); st.translate(sx * 0.105, 1.45, FRONT - 0.02);
      addSkinned(st, mat.apron, spineW);
    }
    // waist band with ties
    const band = new THREE.BoxGeometry(0.44, 0.035, T_D + 0.024); band.translate(0, 1.0, T_Z); addSkinned(band, mat.apron, spineW);
  }
  {
    // skirt: two halves from the waist to the knees; the front follows the
    // thighs (so he can stride and sit), the top stays with the hips
    const knee = P('LeftLeg').y;
    for (const sx of [-1, 1]) {
      const ytop = 1.0, ybot = knee + 0.06, w = 0.208;
      const g = new THREE.PlaneGeometry(w, ytop - ybot, 2, 14);       // subdivided so it bends smoothly
      g.translate(sx * (0.006 + w / 2), (ytop + ybot) / 2, 0);
      // stand clear of the thigh blocks (front at ~0.09 m) with a gentle outward curve
      { const q = g.attributes.position; for (let i = 0; i < q.count; i++) { const u = (q.getX(i) - sx * 0.006) / (sx * w); q.setZ(i, FRONT + 0.03 - 0.025 * u * u); } }
      g.computeVertexNormals();
      addSkinned(g, mat.apron, (p) => {
        const depth = ss(1.0 - p.y, 0.02, 0.16);
        return [['Hips', 1 - depth], [sx > 0 ? 'LeftUpLeg' : 'RightUpLeg', depth]];
      });
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
    const shoe = roundBox(0.168, 0.085, 0.27, 0.03, mat.feet);
    shoe.position.set(foot.x, 0.043, (foot.z + toe.z) / 2 + 0.02); addRigid(shoe, `${sd}Foot`);
  }

  /* ---------- arms: white sleeves, round shoulders, C-shaped hands ---------- */
  for (const [sd, sx] of [['Left', 1], ['Right', -1]]) {
    const arm = P(`${sd}Arm`), fore = P(`${sd}ForeArm`), hand = P(`${sd}Hand`), mid = P(`${sd}HandMiddle1`);
    const sh = mesh(new THREE.SphereGeometry(0.068, 24, 16), mat.coat); sh.position.copy(arm).add(V(-sx * 0.03, -0.03, 0)); addRigid(sh, `${sd}Arm`);
    addRigid(capsule(arm, fore, 0.062, mat.coat), `${sd}Arm`);
    addRigid(capsule(fore, hand.clone().lerp(fore, 0.12), 0.056, mat.coat), `${sd}ForeArm`);
    // wrist + C hand (the classic open grip), opening forward
    const dir = mid.clone().sub(hand).normalize();
    const wrist = capsule(hand.clone().addScaledVector(dir, -0.01), hand.clone().addScaledVector(dir, 0.035), 0.03, mat.skin);
    const c = mesh(new THREE.TorusGeometry(0.038, 0.019, 12, 24, Math.PI * 1.55), mat.skin);
    c.position.copy(hand).addScaledVector(dir, 0.075);
    // the C lies in the plane of arm and palm: its gap faces away from the wrist
    c.quaternion.setFromUnitVectors(V(1, 0, 0), dir);
    c.rotateZ(Math.PI * 0.225);
    const handG = new THREE.Group(); handG.add(wrist, c);
    addRigid(handG, `${sd}Hand`);
  }

  /* ---------- head: rounded cylinder with a printed-style face ---------- */
  const R = 0.13, HH = 0.235;
  const C = V(0, headP.y + 0.005, 0.0);                             // the head turns about its middle
  const H = new THREE.Group(); H.position.copy(C);
  {
    const e = 0.03, pts = [];
    pts.push(new THREE.Vector2(0, -HH / 2));
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push(new THREE.Vector2(R - e + Math.sin(a) * e, -HH / 2 + e - Math.cos(a) * e)); }
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push(new THREE.Vector2(R - e + Math.cos(a) * e, HH / 2 - e + Math.sin(a) * e)); }
    pts.push(new THREE.Vector2(0, HH / 2));
    H.add(mesh(new THREE.LatheGeometry(pts, 64), mat.skin));
    const neck = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 24), mat.skin); neck.position.y = -HH / 2 - 0.02; H.add(neck);
  }
  // features sit on the curved front (z = surface at angle)
  const onFace = (x, y, lift = 0.0015) => V(x, y, Math.sqrt(Math.max(0, (R + lift) ** 2 - x * x)));
  // beard + sideburns: a thin shell on the lower face, with a soft printed edge
  {
    const g = new THREE.CylinderGeometry(R + 0.0018, R + 0.0018, HH * 0.62, 96, 24, true);
    g.translate(0, -HH / 2 + HH * 0.31 + 0.004, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const ang = Math.atan2(x, z);                                   // 0 = straight ahead
      const side = Math.min(1, Math.abs(ang) / 1.5);
      const top = THREE.MathUtils.lerp(-0.042, 0.025, ss(side, 0.35, 0.95));   // beard line: low at the mouth, up the jaw to the sideburns
      const keep = Math.abs(ang) < 1.75 && y < top;
      if (!keep) p.setXYZ(i, x * 0.9, y, z * 0.9);                    // tucked inside the head
    }
    g.computeVertexNormals();
    H.add(mesh(g, mat.beard));
  }
  // eyes (blink by squashing), brows, moustache, grin
  const eyes = [], brows = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.copy(onFace(sx * 0.038, 0.022, 0.0));
    const dot = mesh(new THREE.SphereGeometry(0.0135, 18, 12), mat.eye); dot.scale.set(0.9, 1.15, 0.35);
    const hl = mesh(new THREE.SphereGeometry(0.0038, 8, 6), mat.white); hl.position.set(0.004, 0.006, 0.004);
    eg.add(dot, hl); eg.lookAt(eg.position.clone().multiplyScalar(2));
    H.add(eg); eyes.push(eg);
    const br = mesh(new THREE.CapsuleGeometry(0.0075, 0.03, 4, 10), mat.beard);
    br.position.copy(onFace(sx * 0.04, 0.056, 0.003)); br.rotation.set(0, Math.atan2(br.position.x, br.position.z), Math.PI / 2 + sx * 0.12);
    br.scale.z = 0.5; H.add(br); brows.push(br);
  }
  const mous = mesh(new THREE.TorusGeometry(0.026, 0.0085, 8, 20, Math.PI), mat.beard);
  mous.scale.set(1.2, 0.5, 0.6); mous.position.copy(onFace(0, -0.03, 0.004)); H.add(mous);
  const grin = (s) => new THREE.QuadraticBezierCurve3(V(-0.03 - 0.004 * s, -0.052 + 0.008 * s, 0), V(0, -0.058 - 0.01 * s, 0), V(0.03 + 0.004 * s, -0.052 + 0.008 * s, 0));
  const m0 = new THREE.TubeGeometry(grin(0), 20, 0.0055, 8, false), m1 = new THREE.TubeGeometry(grin(1), 20, 0.0055, 8, false);
  m0.morphAttributes.position = [m1.attributes.position];
  const mouth = mesh(m0, mat.teeth); mouth.position.z = R + 0.004; mouth.scale.z = 0.4; mouth.updateMorphTargets();
  H.add(mouth);
  // hair piece: a moulded curly cap
  {
    const cap = new THREE.SphereGeometry(R * 1.1, 56, 28, 0, Math.PI * 2, 0, Math.PI * 0.62);
    const p = cap.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const front = ss(z / R, 0.3, 0.75);
      const minY = THREE.MathUtils.lerp(-0.03, 0.035, front);       // lower at the back and sides, up off the brow
      p.setXYZ(i, x, Math.max(y * 0.8 + HH / 2 - 0.03, HH / 2 - 0.035 + minY), z);
    }
    cap.computeVertexNormals();
    H.add(mesh(cap, mat.hair));
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const curls = [];
    const R1 = R * 1.1, dome = (rho) => 0.8 * Math.sqrt(Math.max(0, R1 * R1 - rho * rho)) + HH / 2 - 0.03;   // the cap's surface
    for (let i = 0; i < 150; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * R * 1.06;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (z > R * 0.75) continue;                                     // keep the forehead clear
      const g = new THREE.SphereGeometry(0.019 + rnd() * 0.01, 10, 8);
      g.translate(x * 1.02, dome(Math.min(rr, R1 * 0.98)) + 0.004 + rnd() * 0.008, z * 1.02);
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
  const parts = new THREE.Group(); parts.name = 'minifig';
  avatar.add(parts); parts.updateMatrixWorld(true);
  for (const [geo, material] of skinnedParts) {
    const m = new THREE.SkinnedMesh(geo, material);
    m.frustumCulled = false; m.userData.cartoon = true;
    parts.add(m); m.updateMatrixWorld(true);
    m.bind(skel, m.matrixWorld);
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
      for (const e of eyes) e.scale.y = 1 - 0.88 * Math.min(1, blink);
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
    head: { centre: headBone.worldToLocal(C.clone()), radius: R, scale: 1, maskScale: 1.4, maskDrop: 0.045 },
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
