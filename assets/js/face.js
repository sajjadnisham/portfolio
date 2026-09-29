/* =========================================================
   Facial expressions for the Avaturn avatar.

   The Avaturn export has no blendshapes, so two are built here from the
   head mesh at load time (morph targets on the skinned body):
     blink  both upper lids close down to the lash line, lower lids rise a little
     smile  mouth corners lift and widen, cheeks rise, eyes narrow slightly

   Feature positions are in the avatar's rest pose as three.js loads it (metres,
   T-pose, facing +z), measured from the textured head (tools/source/3d/avatar.glb,
   whose skeleton scales the mesh by 0.953 and lifts it 5.9 cm). A different
   avatar needs them re-measured; everything else adapts.
   ========================================================= */
import * as THREE from 'three';

const EYES = [[-0.0329, 1.7067], [0.0329, 1.7067]];      // centre of each eye opening
const EYE_HW = 0.0176;                                  // half width of the opening
const MOUTH = [[-0.0372, 1.6419], [0.0372, 1.6419]];        // mouth corners
const CHEEK = [[-0.04, 1.6672], [0.04, 1.6672]];

const ramp = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);   // 0 at a → 1 at b

export function buildFace(mesh) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const n = pos.count;
  const blink = new Float32Array(n * 3);
  const smile = new Float32Array(n * 3);
  // mesh space → bind-pose world (call with the avatar unposed, at the origin).
  // The optimised GLB folds its quantisation scale into the inverse bind
  // matrices, so go through the head bone: world = head · headInverse · bind.
  const sk = mesh.skeleton;
  const hi = Math.max(0, sk.bones.findIndex((b) => b.name === 'Head'));
  sk.bones[hi].updateWorldMatrix(true, false);
  const toWorld = sk.bones[hi].matrixWorld.clone().multiply(sk.boneInverses[hi]).multiply(mesh.bindMatrix);
  const toGeom = new THREE.Matrix3().setFromMatrix4(toWorld.clone().invert());
  const p = new THREE.Vector3(), d = new THREE.Vector3();
  let touched = 0;

  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(toWorld);
    if (p.y < 1.58 || p.y > 1.76 || p.z < 0.02 || Math.abs(p.x) > 0.09) continue;

    /* blink */
    d.set(0, 0, 0);
    for (const [ex, ey] of EYES) {
      const ax = 1 - ramp(Math.abs(p.x - ex), EYE_HW * 1.0, EYE_HW * 1.45);
      if (ax <= 0) continue;
      const line = ey - 0.0015;                          // where the lids meet
      const top = ey + 0.0055;                           // upper lid edge (lash line)
      let dy;
      if (p.y >= line) {
        dy = p.y <= top ? line - p.y : (line - top) * (1 - ramp(p.y, top, ey + 0.017));
        d.z += 0.0012 * ax * (1 - ramp(p.y, top, ey + 0.017));   // the lid rounds over the eye
      } else {
        const edge = ey - 0.0045, low = ey - 0.008;       // lower lash line, lower lid
        dy = p.y >= edge ? line - p.y : (line - edge) * (1 - ramp(edge - p.y, 0, low - edge + 0.0105));
      }
      d.y += dy * ax;
    }
    if (d.lengthSq() > 0) { touched++; d.applyMatrix3(toGeom).toArray(blink, i * 3); }

    /* smile */
    d.set(0, 0, 0);
    MOUTH.forEach(([mx, my], k) => {
      const r = Math.hypot(p.x - mx, (p.y - my) * 1.3);
      const w = 1 - ramp(r, 0.004, 0.03);
      const sx = k === 0 ? -1 : 1;
      d.x += sx * 0.004 * w;
      d.y += 0.006 * w;
      d.z -= 0.0022 * w;
    });
    CHEEK.forEach(([cx, cy]) => {
      const w = 1 - ramp(Math.hypot(p.x - cx, p.y - cy), 0.004, 0.025);
      d.y += 0.0022 * w; d.z += 0.0012 * w;
    });
    for (const [ex, ey] of EYES) {                        // a smile narrows the eyes from below
      const ax = 1 - ramp(Math.abs(p.x - ex), EYE_HW * 0.8, EYE_HW * 1.3);
      const below = ey - p.y;
      if (ax > 0 && below > -0.001) d.y += 0.0016 * ax * (1 - ramp(below, 0.004, 0.014));
    }
    if (d.lengthSq() > 0) d.applyMatrix3(toGeom).toArray(smile, i * 3);
  }

  g.morphAttributes.position = [
    new THREE.BufferAttribute(blink, 3),
    new THREE.BufferAttribute(smile, 3),
  ];
  g.morphTargetsRelative = true;
  mesh.updateMorphTargets();
  mesh.morphTargetDictionary = { blink: 0, smile: 1 };
  mesh.morphTargetInfluences = [0, 0];
  return { mesh, touched, set: (b, s) => { mesh.morphTargetInfluences[0] = b; mesh.morphTargetInfluences[1] = s; } };
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
