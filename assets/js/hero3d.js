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
    new THREE.TextureLoader().loadAsync(`assets/3d/coat.webp?v=${V}`),   // white coat over dark scrubs (tools/make_coat.py)
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

  /* ---------- pharmacist's outfit: white coat over dark scrubs ---------- */
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
  // The coat's lower half: an open-fronted flared skirt from the waist to mid-thigh,
  // carried by the hips. Each frame it is draped as cloth (see drapeCoat): it
  // swings on a damped spring from his movement and wraps around his thighs.
  const coat = {};
  {
    avatar.updateMatrixWorld(true);
    const hipsW = B.hips.getWorldPosition(new THREE.Vector3());
    // starts up under the jacket hem, so no dark band shows between the two
    const TOP = hipsW.y + 0.17, LEN = 0.47, GAP = 0.42;                    // metres; front opening (rad)
    const g = new THREE.CylinderGeometry(0.2, 0.25, LEN, 72, 14, true, GAP / 2, Math.PI * 2 - GAP);
    g.scale(1.08, 1, 0.84);                                               // hips are wider than deep
    const skirt = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: 0xf1f2f4, roughness: 0.82, side: THREE.DoubleSide, clippingPlanes: [clip],
    }));
    skirt.name = 'coatSkirt';
    skirt.frustumCulled = false;
    skirt.position.set(hipsW.x, TOP - LEN / 2, hipsW.z);
    rig.add(skirt);
    B.hips.attach(skirt);                                                 // keep world pose, follow the hips
    Object.assign(coat, {
      skirt, LEN, pos: g.attributes.position, rest: Float32Array.from(g.attributes.position.array),
      thighs: [[bone('LeftUpLeg'), bone('LeftLeg')], [bone('RightUpLeg'), bone('RightLeg')]],
      off: new THREE.Vector3(), vel: new THREE.Vector3(), lastHips: null,
    });
  }

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
  const P0 = new THREE.Vector3((880 - 470.5) * 1.95 / 2297, 0, -1.95);       // close-up, right edge
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
  function ik(upper, lower, end, target, pole, w) {
    if (w <= 0.001) return;
    const q0u = upper.quaternion.clone(), q0l = lower.quaternion.clone();
    upper.getWorldPosition(_a); lower.getWorldPosition(_b); end.getWorldPosition(_c);
    const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
    _t.copy(target).sub(_a);
    const d = THREE.MathUtils.clamp(_t.length(), 0.05, (l1 + l2) * 0.999);
    const dirv = _t.normalize();
    const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const pv = pole.clone().sub(_a); pv.sub(dirv.clone().multiplyScalar(pv.dot(dirv))).normalize();
    const elbow = _a.clone().add(dirv.clone().multiplyScalar(l1 * cosA)).add(pv.multiplyScalar(l1 * sinA));
    _q.setFromUnitVectors(_b.clone().sub(_a).normalize(), elbow.sub(_a).normalize());
    rotateBoneWorld(upper, _q);
    lower.getWorldPosition(_b); end.getWorldPosition(_c);
    const tgt = _a.clone().add(dirv.clone().multiplyScalar(d));
    _q.setFromUnitVectors(_c.clone().sub(_b).normalize(), tgt.sub(_b).normalize());
    rotateBoneWorld(lower, _q);
    if (w < 1) {
      upper.quaternion.copy(q0u.slerp(upper.quaternion, w));
      lower.quaternion.copy(q0l.slerp(lower.quaternion, w));
      upper.updateMatrixWorld(true);
    }
  }

  // turn a hand so its fingers (wrist → middle-finger base) point along `dir`
  function aimHand(hand, finger, dir, w) {
    if (w <= 0.001) return;
    hand.getWorldPosition(_a); finger.getWorldPosition(_b);
    _q.setFromUnitVectors(_b.sub(_a).normalize(), dir);
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
  const piece = (p, pts) => {                       // piecewise path along stage points
    const i = Math.min(Math.floor(p), pts.length - 2);
    return lerpV(pts[i], pts[i + 1], THREE.MathUtils.clamp(p - i, 0, 1));
  };

  /* ---------- per-frame: state → pose ---------- */
  const clock = new THREE.Clock();
  let tClock = 0;
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
      /* Mission Hospital: close-up → turn → walk away → turn back → mark,
         then the mask and the clipboard. */
      const idleT = tClock % A.idle.getClip().duration;
      setAct('idle', idleT, s.wIdle);
      setAct('turnWalk', s.tTW, s.wTW);
      setAct('walkB', s.tWA % walkDur, s.wWA);
      setAct('turnWalkB', s.tTB, s.wTB);

      const [rx1, rz1] = rootAt('turnWalk', s.tTW);
      const [rx2, rz2] = rootAt('turnWalkB', s.tTB);
      const walked = -walkSpeed * Math.max(0, s.tWA - s.waStart);   // walking away (−z), after the turn's own travel
      rig.position.set(
        THREE.MathUtils.lerp(P0.x, MARK.x, s.drift) + (s.tTW > 0 ? rx1 : 0) + (s.tTB > 0 ? rx2 : 0),
        0,
        P0.z + (s.tTW > 0 ? rz1 : 0) + walked + (s.tTB > 0 ? rz2 : 0),
      );
      rig.position.z += s.recoil;
      rig.rotation.set(0, 0, 0);
      shadow.visible = true;
      shadow.position.set(rig.position.x, 0.003, rig.position.z);
      // S2 slide-in comes from the scroll timeline
      const slide = gsap.getProperty(el.portraitWrap, 'xPercent') || 0;
      rig.position.x += slide / 100 * 941 * Math.abs(P0.z) / camH.userData.f;
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
      /* IGMH: falls in from above and lands in his chair. */
      setAct('fall', s.tF, s.wF);
      setAct('sit', tClock % A.sit.getClip().duration, 1 - s.wF);
      rig.position.set(SEAT.x, s.gyD, SEAT.z);
      const swivel = (gsap.getProperty(el.chair, 'rotationY') || 0) * Math.PI / 180;
      rig.rotation.set(0, swivel, THREE.MathUtils.degToRad(gsap.getProperty(el.chair, 'rotation') || 0) * 0.6);
      clip.constant = -DESK_TOP_Y;                     // behind the desk
    }

    mixer.update(0);
    avatar.updateMatrixWorld(true);
    rig.updateMatrixWorld(true);

    const snap = f !== lastFrame || dt <= 0 || dt > 0.25;   // new scene / first frame / resumed tab
    lastFrame = f;
    if (f === 'H') handsHospital(s);
    smoothPose(dt, snap);
    avatar.updateMatrixWorld(true);
    if (f === 'H') placeMask(s);
    drapeCoat(dt, snap);
  }
  let lastFrame = null;

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

  /* Cloth: the coat's skirt trails and swings on a damped spring driven by his
     hips' movement, and is pushed out around his thighs so it drapes over them
     (including when he sits). ~1000 vertices, updated every frame. */
  const _cv = new THREE.Vector3(), _cd = new THREE.Vector3(), _ab = new THREE.Vector3(), _hp = new THREE.Vector3();
  const _inv = new THREE.Matrix4();
  const segA = [new THREE.Vector3(), new THREE.Vector3()], segB = [new THREE.Vector3(), new THREE.Vector3()];
  function drapeCoat(dt, snap) {
    const { skirt, pos, rest, LEN, thighs, off, vel } = coat;
    B.hips.getWorldPosition(_hp);
    if (snap || !coat.lastHips) {
      coat.lastHips = _hp.clone(); off.set(0, 0, 0); vel.set(0, 0, 0);
    } else if (dt > 0) {
      // the hem trails behind his movement, then swings back and settles
      const h = Math.min(dt, 1 / 30);
      const vx = (_hp.x - coat.lastHips.x) / dt, vz = (_hp.z - coat.lastHips.z) / dt;
      coat.lastHips.copy(_hp);
      const tx = THREE.MathUtils.clamp(-vx * 0.06, -0.09, 0.09), tz = THREE.MathUtils.clamp(-vz * 0.06, -0.09, 0.09);
      const K = 70, D = 10;
      vel.x += (K * (tx - off.x) - D * vel.x) * h; vel.z += (K * (tz - off.z) - D * vel.z) * h;
      off.x += vel.x * h; off.z += vel.z * h;
    }
    skirt.updateMatrixWorld(true);
    const M = skirt.matrixWorld;
    _inv.copy(M).invert();
    for (let s = 0; s < 2; s++) { thighs[s][0].getWorldPosition(segA[s]); thighs[s][1].getWorldPosition(segB[s]); }
    const half = LEN / 2, arr = pos.array;
    for (let i = 0; i < arr.length; i += 3) {
      _cv.set(rest[i], rest[i + 1], rest[i + 2]);
      const w = Math.pow(THREE.MathUtils.clamp((half - _cv.y) / LEN, 0, 1), 1.6);   // free hem, pinned waist
      _cv.applyMatrix4(M);
      _cv.x += off.x * w; _cv.z += off.z * w;
      for (let s = 0; s < 2; s++) {
        _ab.subVectors(segB[s], segA[s]);
        const t = THREE.MathUtils.clamp(_cd.subVectors(_cv, segA[s]).dot(_ab) / _ab.lengthSq(), 0, 1);
        _cd.copy(segA[s]).addScaledVector(_ab, t);                 // closest point on the thigh
        const r = THREE.MathUtils.lerp(0.108, 0.083, t) + 0.012;
        _ab.subVectors(_cv, _cd);
        const L = _ab.length();
        if (L < r && L > 1e-5) _cv.copy(_cd).addScaledVector(_ab, r / L);
      }
      _cv.applyMatrix4(_inv);
      arr[i] = _cv.x; arr[i + 1] = _cv.y; arr[i + 2] = _cv.z;
    }
    pos.needsUpdate = true;
    skirt.geometry.computeVertexNormals();
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

    // mask: pocket → in front of his chin → past the cheek → loops over the ears
    if (s.ms > 0 || s.wR > 0) {
      const pocket = offsetFrom(B.hips, -0.19, -0.08, 0.1);
      // wrist targets: the hand is ~18 cm long, so wrists sit beside the jaw
      // and the fingertips reach the ears
      const chin = offsetFrom(B.head, -0.04, -0.09, 0.2);
      const cheekR = offsetFrom(B.head, -0.14, -0.1, 0.1);
      const earR = offsetFrom(B.head, -0.13, -0.08, -0.01);
      const earL = offsetFrom(B.head, 0.13, -0.08, -0.01);
      const rTarget = piece(s.mp, [pocket, pocket, chin, cheekR, earR]);
      const poleRu = offsetFrom(B.rArm, -0.5, -0.5, 0.35);        // elbows down, out and forward
      const poleLu = offsetFrom(B.lArm, 0.5, -0.5, 0.35);
      ik(B.rArm, B.rFore, B.rHand, rTarget, s.mp > 1.5 ? poleRu : poleR, s.wR);
      ik(B.lArm, B.lFore, B.lHand, earL, poleLu, s.wL);
      // fingers point up and a little back, like hooking a loop behind the ear
      const up = new THREE.Vector3(0, 1, -0.35).applyQuaternion(rig.quaternion).normalize();
      aimHand(B.rHand, B.rMid, up, s.wR * THREE.MathUtils.clamp(s.mp - 1, 0, 1));
      aimHand(B.lHand, B.lMid, up, s.wL);
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
  function loop() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    tClock += dt;
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
  window.__hero3d = { renderer, avatar, A, camH, camD, camP, MARK, P0, SEAT, mask, board, B };
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
