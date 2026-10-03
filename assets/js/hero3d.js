/* =========================================================
   hero3d — Nisham's 3D avatar inside the illustrated scenes.

   One WebGLRenderer; its canvas is moved into whichever scene is on
   screen, so the painted layers around it still occlude him correctly:
     H  Mission Hospital  (set-a, above the plates)
     P  the aeroplane     (inside the plane's bob wrapper)
     D  IGMH desk         (between the chair and the desk)

   All acting is a pure function of the `act` timeline's state object
   (window.__story.S3D, tweened in script.js), so movement stays in sync
   with the scenes and plays backwards when scrolling up. Idle-type loops
   (breathing, piloting, sitting) run on the clock so he never freezes.

   Avatar: assets/3d/nisham.glb (Avaturn). Moves: assets/3d/moves.json
   (Mixamo clips baked by tools/bake-moves.js).
   ========================================================= */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const story = await waitFor(() => window.__story);
const { S3D, tl, act, el } = story;
const V = story.version;

const done = (ok) => { window.__hero3dDone && window.__hero3dDone(ok); };

try {
  await boot();
  done(true);
} catch (err) {
  console.warn('[hero3d] falling back to 2D:', err);
  done(false);
}

async function boot() {
  /* ---------- renderer ---------- */
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no WebGL');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'hero3d';
  canvas.setAttribute('aria-hidden', 'true');

  /* ---------- assets ---------- */
  const [gltf, moves, coatMap] = await Promise.all([
    new GLTFLoader().loadAsync(`assets/3d/nisham.glb?v=${V}`),
    fetch(`assets/3d/moves.json?v=${V}`).then((r) => { if (!r.ok) throw new Error('moves ' + r.status); return r.json(); }),
    new THREE.TextureLoader().loadAsync(`assets/3d/coat.webp?v=${V}`),   // white shirt, charcoal trousers (tools/make_coat.py)
  ]);

  const avatar = gltf.scene;
  const rig = new THREE.Group();            // world placement / heading
  rig.add(avatar);
  const bone = (n) => avatar.getObjectByName(n);
  const B = {
    hips: bone('Hips'), spine2: bone('Spine2'), head: bone('Head'), neck: bone('Neck'),
    rArm: bone('RightArm'), rFore: bone('RightForeArm'), rHand: bone('RightHand'),
    lArm: bone('LeftArm'), lFore: bone('LeftForeArm'), lHand: bone('LeftHand'),
    rMid: bone('RightHandMiddle1'), lMid: bone('LeftHandMiddle1'),
  };

  // one clipping plane shared by every material (cockpit rim / desk top)
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6);
  avatar.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => { m.clippingPlanes = [clip]; });
  });

  /* ---------- pharmacist's outfit: clean white shirt, charcoal trousers ---------- */
  const outfit = avatar.getObjectByName('avaturn_look_0');
  if (outfit) {
    coatMap.colorSpace = THREE.SRGBColorSpace;
    coatMap.flipY = false;                          // glTF texture convention
    const m = outfit.material;
    coatMap.channel = m.map ? m.map.channel : 0;
    m.map = coatMap;
    if (m.normalScale) m.normalScale.setScalar(0.35);   // soften the denim weave into cotton
    m.needsUpdate = true;
  }
  /* ---------- face: blink + smile (morph targets built from the head mesh) ---------- */
  const { buildFace, blinker } = await import(`./face.js?v=${V}`);
  const body = avatar.getObjectByName('avaturn_body');
  const face = body ? buildFace(body) : { set() {} };
  const blink = blinker();

  /* ---------- clips ---------- */
  const mixer = new THREE.AnimationMixer(avatar);
  const Y180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const root = {};                           // horizontal travel curves (x,z per key)

  function makeClip(key, turned) {
    const src = moves.clips[key];
    const tracks = [];
    for (const t of src.tracks) {
      let values = Float32Array.from(t.v);
      const times = Float32Array.from(t.t);
      if (t.n === 'Hips.position') {
        // keep the bob (y); horizontal travel is applied to the rig instead
        const curve = [];
        for (let i = 0; i < times.length; i++) {
          const x = values[i * 3], z = values[i * 3 + 2];
          curve.push([times[i], turned ? -x : x, turned ? -z : z]);
          values[i * 3] = 0; values[i * 3 + 2] = 0;
        }
        root[key + (turned ? 'B' : '')] = curve;
        tracks.push(new THREE.VectorKeyframeTrack(t.n, times, values));
      } else if (t.n.endsWith('.quaternion')) {
        if (turned && t.n === 'Hips.quaternion') {
          const q = new THREE.Quaternion();
          for (let i = 0; i < values.length; i += 4) {
            q.fromArray(values, i).premultiply(Y180).toArray(values, i);
          }
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(t.n, times, values));
      }
    }
    return new THREE.AnimationClip(key + (turned ? 'B' : ''), src.d, tracks);
  }

  const A = {};
  const addAction = (name, clipObj) => {
    const a = mixer.clipAction(clipObj);
    a.play(); a.weight = 0; a.enabled = true; a.paused = true;
    A[name] = a;
  };
  for (const k of Object.keys(moves.clips)) addAction(k, makeClip(k, false));
  addAction('turnWalkB', makeClip('turnWalk', true));   // turns from facing away back toward us
  // piloting with the left hand while the right arm waves (page 6)
  const RIGHT_ARM = /^Right(Shoulder|Arm|ForeArm|Hand)/;
  const only = (c, keep, name) => new THREE.AnimationClip(name, c.duration, c.tracks.filter((t) => keep(t.name)));
  addAction('pilotL', only(A.pilot.getClip(), (n) => !RIGHT_ARM.test(n), 'pilotL'));
  addAction('waveR', only(A.wave.getClip(), (n) => RIGHT_ARM.test(n), 'waveR'));
  addAction('idleL', only(A.idle.getClip(), (n) => !RIGHT_ARM.test(n), 'idleL'));
  addAction('typingL', only(A.typing.getClip(), (n) => !RIGHT_ARM.test(n), 'typingL'));   // typing, right hand free   // standing, right arm free to wave
  addAction('walkB', makeClip('walk', true));           // walking away from camera

  const rootAt = (key, t) => {
    const c = root[key]; if (!c) return [0, 0];
    if (t <= c[0][0]) return [c[0][1] - c[0][1], c[0][2] - c[0][2]];
    for (let i = 1; i < c.length; i++) {
      if (c[i][0] >= t) {
        const [t0, x0, z0] = c[i - 1], [t1, x1, z1] = c[i];
        const k = (t - t0) / (t1 - t0 || 1);
        return [x0 + (x1 - x0) * k - c[0][1], z0 + (z1 - z0) * k - c[0][2]];
      }
    }
    const e = c[c.length - 1];
    return [e[1] - c[0][1], e[2] - c[0][2]];
  };
  const walkDur = moves.clips.walk.d;
  const walkStride = (() => { const c = root.walk; return c[c.length - 1][2] - c[0][2]; })();   // metres per cycle
  const walkSpeed = walkStride / walkDur;
  // Scale the walk-away so the turn back ends exactly on his mark, whatever the
  // avatar's proportions (the clips' travel scales with leg length).

  /* ---------- props: surgical mask + clipboard ---------- */
  const mask = new THREE.Group();
  {
    const g = new THREE.CylinderGeometry(0.098, 0.098, 0.096, 24, 3, true, -0.95, 1.9);
    const m = new THREE.MeshStandardMaterial({ color: 0xeef3f6, roughness: 0.85, side: THREE.DoubleSide });
    const cup = new THREE.Mesh(g, m);                // an arc of a cylinder, bulging toward +z (his front)
    mask.add(cup);
    const pleat = new THREE.MeshStandardMaterial({ color: 0xd6dde2, roughness: 0.9, side: THREE.DoubleSide });
    for (const y of [-0.02, 0.012]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0985, 0.0985, 0.004, 24, 1, true, -0.95, 1.9), pleat);
      p.position.y = y; mask.add(p);
    }
    // ear loops: from the mask's edges back toward the ears
    const loopM = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.8 });
    for (const sx of [-1, 1]) for (const y of [-0.035, 0.035]) {
      const a = new THREE.Vector3(sx * 0.0795, y, 0.057), b = new THREE.Vector3(sx * 0.086, y * 0.4 + 0.03, -0.035);
      const len = a.distanceTo(b);
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, len, 6), loopM);
      strap.position.copy(a).add(b).multiplyScalar(0.5);
      strap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      mask.add(strap);
    }
  }
  const MASK_FIT = { y: 0.016, z: 0.038 };
  const board = new THREE.Group();
  {
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.32, 0.012), new THREE.MeshStandardMaterial({ color: 0x27303d, roughness: 0.6 }));
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.27, 0.002), new THREE.MeshStandardMaterial({ color: 0xf1f3f5, roughness: 0.9 }));
    paper.position.set(0, -0.015, 0.0075);
    const clipM = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.02), new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.6, roughness: 0.35 }));
    clipM.position.set(0, 0.15, 0.008);
    board.add(back, paper, clipM);
  }
  [mask, board].forEach((o) => o.traverse((c) => { if (c.material) c.material.clippingPlanes = [clip]; }));

  // blob shadow on the painted road (hospital)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 32),
    new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, opacity: 0.55 }),
  );
  shadow.rotation.x = -Math.PI / 2;

  /* ---------- scenes (one per painted frame) ---------- */
  function scene(lights) {
    const s = new THREE.Scene();
    lights.forEach((l) => s.add(l));
    return s;
  }
  const dir = (c, i, x, y, z) => { const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); return l; };
  const SC = {
    H: scene([new THREE.HemisphereLight(0xcfd8e6, 0x1a1a1a, 0.85), dir(0xfff2e4, 2.1, -2, 3, 4), dir(0xdfe8ff, 2.4, 3, 2.5, -4)]),
    P: scene([new THREE.HemisphereLight(0xffffff, 0x445566, 1.3), dir(0xffffff, 2.2, -1, 3, 4)]),
    D: scene([new THREE.HemisphereLight(0xe8ecf2, 0x222222, 1.0), dir(0xfff4e6, 2.2, -2, 3, 4), dir(0xdfe8ff, 1.6, 3, 2, -3)]),
  };

  /* Painted-frame cameras. A painting is W×H px; f is the focal length in the
     same px, `hz` the horizon row, `eye` the camera height in metres. A lens
     shift puts the horizon where the illustrator drew it. */
  function paintedCamera(W, H, f, hz, eye) {
    const fullH = 2 * Math.max(hz, H - hz);
    const cam = new THREE.PerspectiveCamera(2 * Math.atan(fullH / 2 / f) * 180 / Math.PI, W / fullH, 0.05, 80);
    cam.setViewOffset(W, fullH, 0, fullH / 2 - hz, W, H);
    cam.position.set(0, eye, 0);
    cam.lookAt(0, eye, -1);
    cam.userData = { W, H, f, hz, eye };
    return cam;
  }
  // where a point painted at (u, v) sits at depth d, and the depth for a
  // standing figure whose feet are painted on row v
  const at = (cam, u, v, d) => new THREE.Vector3((u - cam.userData.W / 2) * d / cam.userData.f, cam.userData.eye - (v - cam.userData.hz) * d / cam.userData.f, -d);
  const depthForFeet = (cam, v) => cam.userData.f * cam.userData.eye / (v - cam.userData.hz);

  // Hospital: feet on row 1613 and 748 px tall at x 713 → eye height 1.6 m.
  const camH = paintedCamera(941, 1672, 2297, 963, 1.84 * (1613 - 963) / 748);
  const dMark = depthForFeet(camH, 1613);
  const MARK = at(camH, 713, 1613, dMark); MARK.y = 0;
  const P0 = new THREE.Vector3((650 - 470.5) * 3.2 / 2297, 0, -3.2);        // where he lands (opening), right of centre
  const WALK_K = (() => {
    const need = MARK.z - P0.z - rootAt('turnWalk', 99)[1] - rootAt('turnWalkB', 99)[1];
    const natural = -walkSpeed * (S3D.waEnd - S3D.waStart);
    return THREE.MathUtils.clamp(need / natural, 0.8, 1.25);
  })();
  // IGMH desk: horizon at his eye line (row 760), 560 px per metre at the chair.
  const camD = paintedCamera(941, 1672, 2297, 760, 1.2);
  const dDesk = 2297 / 560;
  const SEAT = new THREE.Vector3((472 - 470.5) * dDesk / 2297, 0, -dDesk);
  const DESK_TOP_Y = camD.userData.eye - (992 - camD.userData.hz) * dDesk / camD.userData.f;
  // Aeroplane: orthographic, flight frame is 675×565 units, 300 units per metre.
  const PXM = 280;
  // the cockpit canvas reaches well past the plane (see .host-p) so the leap stays in view
  const EXT = { l: 0.4, r: 0.4, t: 1.2, b: 0.6 };
  const camP = new THREE.OrthographicCamera(
    -(675 / 2 + EXT.l * 675) / PXM, (675 / 2 + EXT.r * 675) / PXM,
    (565 / 2 + EXT.t * 565) / PXM, -(565 / 2 + EXT.b * 565) / PXM, 0.1, 20);
  camP.position.set(0, 0, 8);
  const fl = (u, v) => new THREE.Vector3((u - 337.5) / PXM, (282.5 - v) / PXM, 0);   // flight units → world
  const COCKPIT = fl(322, 352);           // where his hips sit (just below the rim)
  const PILOT_HIPS = moves.clips.pilot.tracks.find((t) => t.n === 'Hips.position').v[1];
  const RIM_Y = fl(0, 330).y;             // fuselage rim (everything below is hidden while seated)

  /* ---------- hosts (DOM layers the canvas moves between) ---------- */
  const hosts = { H: el.hostH, P: el.hostP, D: el.hostD };
  let frame = null;
  function useFrame(f) {
    if (f === frame) return;
    frame = f;
    hosts[f].appendChild(canvas);
    for (const s of Object.values(SC)) { s.remove(rig); s.remove(mask); s.remove(board); s.remove(shadow); }
    SC[f].add(rig, mask, board);
    if (f === 'H') SC.H.add(shadow);
    sizeCanvas();
  }
  // 1.5× is sharp and keeps the frame rate high (smoother than 2–3× native);
  // adapt() drops to 1× on devices that can't keep up
  const DPR_MAX = 1.5;
  let dprCap = DPR_MAX;
  function sizeCanvas() {
    const box = hosts[frame];
    const w = box.clientWidth, h = box.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
  }
  addEventListener('resize', () => frame && sizeCanvas());

  /* ---------- IK: two-bone analytic solver ---------- */
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qs = new THREE.Quaternion();
  function rotateBoneWorld(b, qDelta) {
    b.getWorldQuaternion(_qw);
    _qw.premultiply(qDelta);
    b.parent.getWorldQuaternion(_qp);
    b.quaternion.copy(_qp.invert().multiply(_qw));
    b.updateMatrixWorld(true);
  }
  /* Anatomical two-bone IK. The elbow is a hinge: in the rest T-pose the
     forearm flexes toward his front, about the axis restDir × forward. The
     solver orients the upper arm so that hinge lies across the bend plane
     (upper arm twisting as a real shoulder does), then bends the forearm
     about that hinge only, so the elbow can never fold backwards or sideways. */
  const FWD = new THREE.Vector3(0, 0, 1);                // his forward in rig space
  const REST = new Map();                                // bone → rest data (rig space)
  function restOf(upper, lower, end) {
    if (REST.has(upper)) return REST.get(upper);
    // measured once at boot, with the rig at the origin in the bind pose
    const qU = upper.getWorldQuaternion(new THREE.Quaternion());
    const qL = lower.getWorldQuaternion(new THREE.Quaternion());
    const pa = upper.getWorldPosition(new THREE.Vector3()), pb = lower.getWorldPosition(new THREE.Vector3());
    const pc = end.getWorldPosition(new THREE.Vector3());
    const dU = pb.clone().sub(pa).normalize(), dL = pc.clone().sub(pb).normalize();
    const hinge = dU.clone().cross(FWD).normalize();   // positive rotation = flexion toward the front
    const r = { qU, qL, dU, dL, hinge };
    REST.set(upper, r);
    return r;
  }
  const _m0 = new THREE.Matrix4(), _m1 = new THREE.Matrix4(), _qr = new THREE.Quaternion(), _qrig = new THREE.Quaternion();
  const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
  function frameQ(d, h, out) {                           // rotation of the basis (d, h, d×h)
    _z.crossVectors(d, h).normalize();
    _m0.makeBasis(d, h, _z);
    return out.setFromRotationMatrix(_m0);
  }
  function setWorldQ(b, qWorld) {
    b.parent.getWorldQuaternion(_qp);
    b.quaternion.copy(_qp.invert().multiply(qWorld));
    b.updateMatrixWorld(true);
  }
  function ik(upper, lower, end, target, pole, w) {
    if (w <= 0.001) return;
    const R = restOf(upper, lower, end);
    const q0u = upper.quaternion.clone(), q0l = lower.quaternion.clone();
    upper.getWorldPosition(_a); lower.getWorldPosition(_b); end.getWorldPosition(_c);
    const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
    // work in rig space (the rest data is), then convert back
    rig.getWorldQuaternion(_qrig);
    const inv = _qrig.clone().invert();
    const tLoc = target.clone().sub(_a).applyQuaternion(inv);
    const d = THREE.MathUtils.clamp(tLoc.length(), 0.05, (l1 + l2) * 0.999);
    const dirv = tLoc.normalize();
    const pv = pole.clone().sub(_a).applyQuaternion(inv);
    pv.sub(dirv.clone().multiplyScalar(pv.dot(dirv)));
    if (pv.lengthSq() < 1e-8) pv.copy(FWD).sub(dirv.clone().multiplyScalar(FWD.dot(dirv)));
    pv.normalize();
    const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const elbow = dirv.clone().multiplyScalar(l1 * cosA).add(pv.clone().multiplyScalar(l1 * sinA));  // rig space, from shoulder
    const d1 = elbow.clone().normalize();
    const fore = dirv.clone().multiplyScalar(d).sub(elbow).normalize();
    // hinge across the bend plane, signed so the bend is a flexion
    let h1 = d1.clone().cross(fore);
    if (h1.lengthSq() < 1e-8) h1 = d1.clone().cross(FWD);
    h1.normalize();
    // upper arm: rest frame (dU, hinge) → (d1, h1)
    const hr = R.hinge.clone().sub(R.dU.clone().multiplyScalar(R.hinge.dot(R.dU))).normalize();
    const q0 = frameQ(R.dU, hr, new THREE.Quaternion());
    const q1 = frameQ(d1, h1, new THREE.Quaternion());
    const rot = q1.multiply(q0.invert());                                     // rest → posed (rig space)
    setWorldQ(upper, _qr.copy(_qrig).multiply(rot).multiply(R.qU));
    // forearm: carried by the upper arm, then flexed about the hinge
    const bend = new THREE.Quaternion().setFromUnitVectors(R.dL.clone().applyQuaternion(rot), fore);
    setWorldQ(lower, _qr.copy(_qrig).multiply(bend).multiply(rot).multiply(R.qL));
    if (w < 1) {
      upper.quaternion.copy(q0u.slerp(upper.quaternion, w));
      lower.quaternion.copy(q0l.slerp(lower.quaternion, w));
      upper.updateMatrixWorld(true);
    }
  }

  avatar.updateMatrixWorld(true);                        // still in the bind pose here
  restOf(B.rArm, B.rFore, B.rHand);
  restOf(B.lArm, B.lFore, B.lHand);

  // turn a hand so its fingers (wrist → middle-finger base) point along `dir`,
  // and (if `face` is given) roll it so the palm faces that point
  const PALM = new Map();                                // hand → palm normal in hand space (palms down at rest)
  for (const h of [B.rHand, B.lHand]) PALM.set(h, new THREE.Vector3(0, -1, 0).applyQuaternion(h.getWorldQuaternion(new THREE.Quaternion()).invert()));
  function aimHand(hand, finger, dir, w, face) {
    if (w <= 0.001) return;
    hand.getWorldPosition(_a); finger.getWorldPosition(_b);
    const f0 = _b.clone().sub(_a).normalize();
    _q.setFromUnitVectors(f0, dir);
    if (face) {
      // roll about the finger axis until the palm points at `face`
      const palm = PALM.get(hand).clone().applyQuaternion(hand.getWorldQuaternion(_qw)).applyQuaternion(_q);
      const want = face.clone().sub(_a);
      want.sub(dir.clone().multiplyScalar(want.dot(dir)));
      palm.sub(dir.clone().multiplyScalar(palm.dot(dir)));
      if (want.lengthSq() > 1e-8 && palm.lengthSq() > 1e-8) {
        _qs.setFromUnitVectors(palm.normalize(), want.normalize());
        _q.premultiply(_qs);
      }
    }
    _qs.identity().slerp(_q, w);
    rotateBoneWorld(hand, _qs);
  }

  /* ---------- body-space helpers (his own left/right/front) ---------- */
  const _m = new THREE.Matrix4();
  // point offset (x = his left, y = up, z = his front) from a bone, in world space
  function offsetFrom(b, x, y, z, out = new THREE.Vector3()) {
    rig.updateMatrixWorld(true);
    b.getWorldPosition(out);
    const v = new THREE.Vector3(x, y, z).applyQuaternion(rig.getWorldQuaternion(_qs));
    return out.add(v);
  }
  const lerpV = (a, b, k) => a.clone().lerp(b, k);
  // A smooth hand path through waypoints (centripetal Catmull-Rom, so it
  // doesn't overshoot): p = 0 … pts.length-1, one unit per waypoint. The hand
  // never stops at a waypoint unless the timing in script.js makes it.
  const _spline = new THREE.CatmullRomCurve3([], false, 'centripetal');
  const along = (p, pts) => {
    _spline.points = pts;
    return _spline.getPoint(THREE.MathUtils.clamp(p / (pts.length - 1), 0, 1));
  };

  /* ---------- per-frame: state → pose ---------- */
  const clock = new THREE.Clock();
  let tClock = 0;
  // typing: the short clip ping-pongs gently (a straight loop would snap at the seam)
  let typeT = 0;
  const typeDur = moves.clips.typing.d;
  const typeClock = (dt) => { typeT += dt * 0.8; const k = typeT % (2 * typeDur); return k < typeDur ? k : 2 * typeDur - k; };
  const FRONT = -(root.standToSit ? root.standToSit[root.standToSit.length - 1][2] - root.standToSit[0][2] : -0.44);   // ~0.44 m
  const UP_Z = rootAt('standUp', 2.3)[1];      // where script.js stops the Stand Up clip
  const hipsAt = (k, i) => moves.clips[k].tracks.find((t) => t.n === 'Hips.position').v[i * 3 + 1];
  const SEAT_DIFF = hipsAt('standUp', 0) - hipsAt('typing', 0);                // ~0.2 m
  const setAct = (name, time, weight) => { const a = A[name]; a.time = time; a.weight = weight; };

  function pose(dt = 0) {
    const s = S3D;
    const scrollT = tl.time();
    const actT = act.time();
    const J = act.labels.files;

    // which painted frame is he in?
    const f = scrollT < 7.35 ? 'H' : (actT < J + 0.75 ? 'P' : 'D');
    useFrame(f);

    for (const k in A) A[k].weight = 0;
    clip.constant = 1e6;
    shadow.visible = false;
    mask.visible = false;
    board.visible = false;

    if (f === 'H') {
      /* Mission Hospital: drops out of the sky into the close-up, lands →
         turns → walks toward the hospital → turns back → mark, then the mask
         and the clipboard. */
      const idleT = tClock % A.idle.getClip().duration;
      setAct('land', s.tLandH, s.wLandH);
      setAct('idle', idleT, s.wIdle);
      setAct('turnWalk', s.tTW, s.wTW);
      setAct('walkB', s.tWA % walkDur, s.wWA);
      setAct('turnWalkB', s.tTB, s.wTB);

      const [rx1, rz1] = rootAt('turnWalk', s.tTW);
      const [rx2, rz2] = rootAt('turnWalkB', s.tTB);
      const walked = -walkSpeed * WALK_K * Math.max(0, s.tWA - s.waStart);   // walking away (−z), after the turn's own travel
      rig.position.set(
        THREE.MathUtils.lerp(P0.x, MARK.x, s.drift) + (s.tTW > 0 ? rx1 : 0) + (s.tTB > 0 ? rx2 : 0),
        s.gyH,                                          // still falling in from above
        P0.z + (s.tTW > 0 ? rz1 : 0) + walked + (s.tTB > 0 ? rz2 : 0),
      );
      rig.position.z += s.recoil;
      rig.rotation.set(0, 0, 0);
      shadow.visible = true;
      shadow.position.set(rig.position.x, 0.003, rig.position.z);
      // the shadow gathers under him as he comes down
      const air = s.gyH + Math.max(0, (hipsAt('land', 0) - 1) * s.wLandH * (1 - THREE.MathUtils.smoothstep(s.tLandH, 0, 0.33)));
      shadow.scale.setScalar(1 + air * 0.5);
      shadow.material.opacity = 0.55 / (1 + air * 1.5);
    } else if (f === 'P') {
      /* In the cockpit: piloting and waving, then the jump. */
      setAct('pilotL', tClock % A.pilot.getClip().duration, 1 - s.wJ);
      setAct('waveR', tClock % A.wave.getClip().duration, 1 - s.wJ);
      setAct('jump', s.tJ, s.wJ);
      rig.position.copy(COCKPIT); rig.position.y += s.gyP - PILOT_HIPS;
      rig.rotation.set(0, 0.35, 0);
      rig.scale.setScalar(1);
      clip.constant = -RIM_Y;                         // nothing below the cockpit rim: legs appear as they clear it
    } else {
      /* IGMH: drops in from above and lands on his feet in front of the chair,
         sits back into it, types; later stands up and waves goodbye. */
      const typeT = typeClock(dt);
      // Phones frame the office higher up to fit the duties list, leaving no
      // room above his head: there he waves goodbye from his chair instead.
      const sitBye = story.G.B2.y < story.G.B.y - 1;
      const bye = s.wUp + s.wBye;
      const sv = sitBye ? { ...s, wUp: 0, wBye: 0, tUp: 0 } : s;       // what drives the body below
      setAct('land', s.tLand, s.wLand);
      setAct('standToSit', s.tSTS, s.wSTS);
      setAct('typing', typeT, s.wType);
      if (sitBye) {
        // still seated at the keyboard; the right hand lifts off it and waves
        setAct('typingL', typeT, bye);
        setAct('waveR', tClock % A.wave.getClip().duration, bye);
      } else {
        setAct('standUp', s.tUp, s.wUp);
        // goodbye: standing idle with the right hand up, waving (the same wave as in the plane)
        setAct('idleL', tClock % A.idle.getClip().duration, s.wBye);
        setAct('waveR', tClock % A.wave.getClip().duration, s.wBye);
      }
      // travel from each clip's root curve, blended by weight; he lands FRONT
      // in front of the seat and Stand To Sit carries him back into it
      const [, zL] = rootAt('land', s.tLand);
      const [, zS] = rootAt('standToSit', s.tSTS);
      const [, zU] = rootAt('standUp', sv.tUp);
      const wSum = s.wLand + s.wSTS + s.wType + bye || 1;
      const z = (s.wLand * (FRONT + zL) + s.wSTS * (FRONT + zS) + sv.wUp * zU + sv.wBye * UP_Z) / wSum;
      // Stand Up starts from a taller chair: lower him by the difference until he rises
      const upDrop = -SEAT_DIFF * (1 - THREE.MathUtils.smoothstep(sv.tUp, 1.0, 2.0)) * sv.wUp / wSum;
      rig.position.set(SEAT.x, s.gyD + upDrop, SEAT.z + z);
      // the chair: swivels with him, and rocks as it takes his weight (3D only)
      const seated = (s.wType + s.wSTS * THREE.MathUtils.smoothstep(s.tSTS, 1.3, 1.6) + (sitBye ? bye : s.wUp * (1 - THREE.MathUtils.smoothstep(s.tUp, 1.0, 1.6)))) / wSum;
      gsap.set(el.chair, { yPercent: 0.7 * s.bump, rotation: -1.2 * s.bump });
      const swivel = (gsap.getProperty(el.chair, 'rotationY') || 0) * Math.PI / 180 * seated;
      rig.rotation.set(0, swivel, THREE.MathUtils.degToRad(-1.2 * s.bump) * 0.6);
      rig.position.y -= 0.006 * s.bump;
      clip.constant = -DESK_TOP_Y;                     // behind the desk
    }

    rig.rotation.y += spinStep(dt);                  // the visitor can spin him (drag sideways)
    mixer.update(0);
    avatar.updateMatrixWorld(true);
    rig.updateMatrixWorld(true);

    const snap = f !== lastFrame || dt <= 0 || dt > 0.25;   // new scene / first frame / resumed tab
    lastFrame = f;
    if (f === 'H') handsHospital(s);
    lookAtPointer(s, dt, f);
    smoothPose(dt, snap);
    avatar.updateMatrixWorld(true);
    if (f === 'H') placeMask(s);
    face.set(blink(tClock), s.smile);
  }
  let lastFrame = null;

  /* ---------- he reacts to the visitor: cursor / touch ---------- */
  // Where the pointer is (client px) and when it last moved. On touch screens
  // the finger counts while it's down and for a moment after.
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ptr = { x: 0, y: 0, t: -1e9 };
  const spin = { a: 0, v: 0, drag: false, lastX: 0, lastT: 0, released: -1e9 };
  const now = () => performance.now() / 1000;
  addEventListener('pointermove', (e) => {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = now();
    if (spin.drag && e.pointerId === spin.id) {
      const t = now(), dx = e.clientX - spin.lastX;
      const da = dx * 0.012;                                   // ~half a turn across a phone screen
      spin.a += da;
      spin.v = THREE.MathUtils.lerp(spin.v, da / Math.max(t - spin.lastT, 1 / 120), 0.5);
      spin.lastX = e.clientX; spin.lastT = t;
    }
  }, { passive: true });
  const film = document.getElementById('film');
  film.addEventListener('pointerdown', (e) => {
    if (RM || e.button > 0 || e.target.closest('a, button')) return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = now();
    Object.assign(spin, { drag: true, id: e.pointerId, lastX: e.clientX, lastT: now(), v: 0 });
    document.documentElement.classList.add('spinning');
  });
  const endDrag = (e) => {
    if (!spin.drag || (e && e.pointerId !== spin.id)) return;
    spin.drag = false; spin.released = now();
    document.documentElement.classList.remove('spinning');
  };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);      // e.g. the browser took over for a vertical scroll
  // free spin with momentum, then he turns back to face his scene
  function spinStep(dt) {
    if (spin.drag || dt <= 0) return spin.a;
    spin.a += spin.v * dt;
    spin.v *= Math.exp(-dt * 3.2);
    if (now() - spin.released > 0.5 && Math.abs(spin.v) < 1.2) {
      // shortest way back to facing front, eased like a turntable settling
      const back = Math.atan2(Math.sin(spin.a), Math.cos(spin.a));
      spin.a = back * Math.exp(-dt * 2.6);
      spin.v *= Math.exp(-dt * 4);
    }
    return spin.a;
  }

  // Head (with a little neck and chest) turns to follow the pointer, as if it
  // were someone just in front of the screen. Eased like a real glance;
  // stands down while his hands or the big moves need his head.
  const look = { yaw: 0, pitch: 0, w: 0 };
  const _ray = new THREE.Raycaster(), _nd = new THREE.Vector2(), _pl = new THREE.Plane();
  const _hd = new THREE.Vector3(), _cp = new THREE.Vector3(), _tgt = new THREE.Vector3();
  const _L = new THREE.Vector3(), _R = new THREE.Vector3(), _fw = new THREE.Vector3(), _up = new THREE.Vector3();
  const _ql = new THREE.Quaternion(), _qa = new THREE.Quaternion();
  function lookAtPointer(s, dt, f) {
    const cam = f === 'H' ? camH : f === 'D' ? camD : camP;
    const busy = Math.max(s.wR, s.wL, s.wC, s.wJ, s.wLandH, f === 'D' ? s.wLand + s.wSTS : 0, s.ms > 0 && s.mc < 1 ? 1 : 0);
    const fresh = now() - ptr.t < (matchMedia('(pointer: coarse)').matches ? 2.5 : 6);
    const wantW = RM || spin.drag ? 0 : (fresh ? 1 : 0) * (1 - Math.min(1, busy));
    look.w += (wantW - look.w) * (1 - Math.exp(-dt * (wantW > look.w ? 3 : 1.6)));
    if (look.w < 0.002) return;

    // the pointer as a point ~1.2 m in front of his face, toward the camera
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    _nd.set(((ptr.x - rect.left) / rect.width) * 2 - 1, -((ptr.y - rect.top) / rect.height) * 2 + 1);
    B.head.getWorldPosition(_hd);
    cam.getWorldPosition(_cp);
    const toCam = _cp.clone().sub(_hd).normalize();
    _pl.setFromNormalAndCoplanarPoint(toCam, _hd.clone().addScaledVector(toCam, 1.2));
    _ray.setFromCamera(_nd, cam);
    if (!_ray.ray.intersectPlane(_pl, _tgt)) return;

    // his body's own frame: forward from the shoulder line
    B.lArm.getWorldPosition(_L); B.rArm.getWorldPosition(_R);
    _up.set(0, 1, 0).applyQuaternion(rig.getWorldQuaternion(_ql));
    const side = _L.sub(_R).normalize();
    _fw.crossVectors(side, _up).normalize();
    const dir = _tgt.sub(_hd).normalize();
    // signed turn about his up axis that takes his forward toward the pointer
    const yaw = Math.atan2(_fw.clone().cross(dir).dot(_up), dir.dot(_fw));
    const pitch = Math.asin(THREE.MathUtils.clamp(dir.dot(_up), -1, 1));
    const yT = THREE.MathUtils.clamp(yaw, -1.0, 1.0), pT = THREE.MathUtils.clamp(pitch, -0.3, 0.3);
    const k = 1 - Math.exp(-dt * 7);                               // a glance takes ~0.3 s
    look.yaw += (yT - look.yaw) * k; look.pitch += (pT - look.pitch) * k;

    for (const [bone, share] of [[B.spine2, 0.2], [B.neck, 0.3], [B.head, 0.5]]) {
      _qa.setFromAxisAngle(_up, look.yaw * share * look.w);
      _ql.setFromAxisAngle(side, -look.pitch * share * look.w);
      rotateBoneWorld(bone, _qa.multiply(_ql));
    }
  }

  /* Pose smoothing: every bone eases toward the pose the clips and IK ask for
     (critically damped, ~45 ms). It removes pops at blends, loop seams and
     IK weight changes without making him feel laggy. */
  const bones = [];
  avatar.traverse((o) => { if (o.isBone) bones.push(o); });
  const prevQ = new Float32Array(bones.length * 4);
  const prevHips = new THREE.Vector3();
  const _qsm = new THREE.Quaternion();
  let havePrev = false;
  function smoothPose(dt, snap) {
    if (!snap && havePrev) {
      const k = 1 - Math.exp(-dt / 0.045);
      for (let i = 0; i < bones.length; i++) {
        _qsm.fromArray(prevQ, i * 4).slerp(bones[i].quaternion, k);
        bones[i].quaternion.copy(_qsm);
      }
      B.hips.position.lerpVectors(prevHips, B.hips.position, k);
    }
    for (let i = 0; i < bones.length; i++) bones[i].quaternion.toArray(prevQ, i * 4);
    prevHips.copy(B.hips.position);
    havePrev = true;
  }

  // the mask travels in his (smoothed) fingers, then settles on his face
  function placeMask(s) {
    if (!(s.ms > 0 || s.wR > 0)) return;
    const wrist = B.rHand.getWorldPosition(new THREE.Vector3());
    const knuckle = B.rMid.getWorldPosition(new THREE.Vector3());
    // held a little past the knuckles, just in front of the palm
    const inHand = wrist.lerp(knuckle, 1.25).add(new THREE.Vector3(0, 0, 0.03).applyQuaternion(rig.quaternion));
    // the arc's centre sits inside the head, so its surface lands on the face
    const onFace = offsetFrom(B.head, 0, MASK_FIT.y, MASK_FIT.z);
    mask.position.copy(lerpV(inHand, onFace, s.mc));
    mask.quaternion.copy(rig.getWorldQuaternion(new THREE.Quaternion()));
    mask.scale.setScalar(Math.max(0.001, s.ms));
    mask.visible = true;
  }

  function handsHospital(s) {
    const poleR = offsetFrom(B.rArm, -0.5, -0.6, -0.3);
    const poleL = offsetFrom(B.lArm, 0.5, -0.6, -0.3);
    const relaxR = offsetFrom(B.rArm, -0.4, -0.6, 0.0);          // elbow down and a little out
    const relaxL = offsetFrom(B.lArm, 0.4, -0.6, 0.0);

    // mask: one continuous reach for each hand, like a person putting a mask on
    //   right: rest → pocket (grabs it) → up past the chest → mask to the chin
    //          → along the cheek → hooks the loop over the ear → down in front → rest
    //   left:  rest → up in front of the body → cheek → other ear → down in front → rest
    // (the low waypoints sit in front of the body, so the hands never pass
    //  through a hands-on-hips pose)
    if (s.ms > 0 || s.wR > 0 || s.wL > 0) {
      const restR = B.rHand.getWorldPosition(new THREE.Vector3());   // where the idle has the hands
      const restL = B.lHand.getWorldPosition(new THREE.Vector3());
      const pocket = offsetFrom(B.hips, -0.19, -0.08, 0.1);
      const liftR = offsetFrom(B.spine2, -0.13, -0.02, 0.32);
      const chin = offsetFrom(B.head, -0.04, -0.09, 0.2);
      const cheekR = offsetFrom(B.head, -0.14, -0.1, 0.1);
      const earR = offsetFrom(B.head, -0.13, -0.08, -0.01);
      const jawR = offsetFrom(B.head, -0.13, -0.27, 0.15);          // in front of the shoulder on the way down
      const dropR = offsetFrom(B.spine2, -0.15, -0.3, 0.27);
      const bellyL = offsetFrom(B.spine2, 0.14, -0.3, 0.27);
      const liftL = offsetFrom(B.spine2, 0.16, 0.0, 0.3);
      const cheekL = offsetFrom(B.head, 0.15, -0.12, 0.12);
      const earL = offsetFrom(B.head, 0.13, -0.08, -0.01);
      const jawL = offsetFrom(B.head, 0.13, -0.27, 0.15);
      const dropL = offsetFrom(B.spine2, 0.15, -0.3, 0.27);
      // knots: rest 0 · pocket 1 · lift 1.5 · chin 2 · cheek 3 · ear 4 · jaw 5 · drop 6 · rest 7
      const mp = s.mp < 1 ? s.mp : s.mp < 2 ? 1 + (s.mp - 1) * 2 : s.mp + 1;
      const rTarget = along(mp, [restR, pocket, liftR, chin, cheekR, earR, jawR, dropR, restR]);
      //        lp: rest 0 · belly 1 · chest 2 · cheek 3 · ear 4 · jaw 5 · drop 6 · rest 7
      const lTarget = along(s.lp, [restL, bellyL, liftL, cheekL, earL, jawL, dropL, restL]);
      // elbows: down at the pocket, lifting out to the side as the hands rise,
      // and settling down again as soon as the hands leave the ears
      const k = THREE.MathUtils.smoothstep(s.mp, 0.9, 2.2) * (1 - THREE.MathUtils.smoothstep(s.mp, 4.05, 4.9));
      const poleRt = lerpV(s.mp < 3 ? poleR : relaxR, offsetFrom(B.rArm, -0.85, -0.5, 0.05), k);   // elbows out to the side, below the shoulder
      const kl = THREE.MathUtils.smoothstep(s.lp, 1.2, 2.6) * (1 - THREE.MathUtils.smoothstep(s.lp, 4.05, 4.9));
      const poleLt = lerpV(relaxL, offsetFrom(B.lArm, 0.85, -0.5, 0.05), kl);
      ik(B.rArm, B.rFore, B.rHand, rTarget, poleRt, s.wR);
      ik(B.lArm, B.lFore, B.lHand, lTarget, poleLt, s.wL);
      // fingers point up and a little back near the face, like hooking a loop behind the ear
      const up = new THREE.Vector3(0, 1, -0.35).applyQuaternion(rig.quaternion).normalize();
      const headC = offsetFrom(B.head, 0, 0.02, 0.02);              // palms turn toward his head
      aimHand(B.rHand, B.rMid, up, s.wR * THREE.MathUtils.smoothstep(s.mp, 1.4, 2.4) * (1 - THREE.MathUtils.smoothstep(s.mp, 4.1, 4.9)), headC);
      aimHand(B.lHand, B.lMid, up, s.wL * THREE.MathUtils.smoothstep(s.lp, 2.0, 3.2) * (1 - THREE.MathUtils.smoothstep(s.lp, 4.1, 4.9)), headC);
    }

    // clipboard: tossed in from the right, caught, held against his chest
    if (s.cw > 0) {
      const start = MARK.clone().add(new THREE.Vector3(-2.6, 1.9, 0.6));
      const catchP = offsetFrom(B.spine2, -0.34, 0.05, 0.35);
      const chest = offsetFrom(B.spine2, -0.1, -0.06, 0.2);
      let p;
      if (s.cp <= 1) {
        p = lerpV(start, catchP, s.cp);
        p.y += Math.sin(s.cp * Math.PI) * 0.45;                  // thrown arc
      } else p = lerpV(catchP, chest, s.cp - 1);
      board.position.copy(p);
      board.quaternion.copy(rig.getWorldQuaternion(new THREE.Quaternion()));
      board.rotateY(-0.35 * Math.min(1, s.cp - 1 > 0 ? s.cp - 1 : 0));
      board.rotateZ((1 - Math.min(1, s.cp)) * -6.5 + 0.28);     // spins in flight
      board.visible = true;
      const grip = p.clone().add(new THREE.Vector3(-0.1, -0.02, 0.0));
      ik(B.rArm, B.rFore, B.rHand, grip, poleR, s.wC);
    }
  }

  /* ---------- loop ---------- */
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) clock.getDelta(); });
  // adaptive resolution: if the device can't hold ~45 fps, render at 1× until it can
  let ft = 0, fn = 0, slow = 0, fast = 0;
  function adapt(dt) {
    ft += dt; fn++;
    if (fn < 45) return;
    const avg = ft / fn; ft = 0; fn = 0;
    if (avg > 1 / 45) { fast = 0; if (++slow >= 2 && dprCap > 1) { dprCap = 1; sizeCanvas(); } }
    else if (avg < 1 / 58) { slow = 0; if (++fast >= 6 && dprCap < DPR_MAX) { dprCap = DPR_MAX; sizeCanvas(); } }
  }
  // mouse parallax for the painted backgrounds (styles.css reads --px/--py)
  const fine = matchMedia('(pointer: fine)').matches && !RM;
  const par = { x: 0, y: 0 };
  function parallax(dt) {
    if (!fine || ptr.t < 0) return;
    const k = 1 - Math.exp(-dt * 3);
    par.x += ((ptr.x / innerWidth) * 2 - 1 - par.x) * k;
    par.y += ((ptr.y / innerHeight) * 2 - 1 - par.y) * k;
    const st = document.documentElement.style;
    st.setProperty('--px', par.x.toFixed(4)); st.setProperty('--py', par.y.toFixed(4));
  }
  function loop() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    tClock += dt;
    parallax(dt);
    pose(dt);
    const cam = frame === 'H' ? camH : frame === 'D' ? camD : camP;
    renderer.render(SC[frame], cam);
    adapt(dt);
  }

  // compile every scene's shaders and upload textures now, so the first
  // switch to the plane or the office doesn't hitch
  for (const [f, cam] of [['P', camP], ['D', camD], ['H', camH]]) {
    SC[f].add(rig, mask, board);
    renderer.compile(SC[f], cam);
    SC[f].remove(rig, mask, board);
  }
  avatar.traverse((o) => {
    if (!o.isMesh) return;
    for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (o.material[k]) renderer.initTexture(o.material[k]);
  });

  useFrame('H');
  pose(0);
  renderer.setAnimationLoop(loop);          // paced by the display, same tick as GSAP

  document.documentElement.classList.add('has-3d');
  window.__hero3d = { WALK_K, face, renderer, avatar, A, camH, camD, camP, MARK, P0, SEAT, mask, board, B };
}

/* ---------- helpers ---------- */
function waitFor(fn) {
  return new Promise((res) => { const t = () => { const v = fn(); if (v) res(v); else setTimeout(t, 30); }; t(); });
}
function radialTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
