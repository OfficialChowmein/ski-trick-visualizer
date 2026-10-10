// Drives a Mixamo-style skeleton from the segment directions in poses.js.
// Method: reset every bone to its rest rotation, then, parent first, rotate each bone the
// smallest amount that makes it point at its target direction. No per-model axis tables needed.

import * as THREE from 'three';

const NAME = (s) => `mixamorig${s}`;

// segment -> [bone that rotates, bone it should point at]
const CHAIN = [
  ['spine', 'Spine', 'Spine1'], ['spine', 'Spine1', 'Spine2'], ['spine', 'Spine2', 'Neck'],
  ['neck', 'Neck', 'Head'],
  ['lUpper', 'LeftArm', 'LeftForeArm'], ['lFore', 'LeftForeArm', 'LeftHand'],
  ['rUpper', 'RightArm', 'RightForeArm'], ['rFore', 'RightForeArm', 'RightHand'],
  ['lThigh', 'LeftUpLeg', 'LeftLeg'], ['lShin', 'LeftLeg', 'LeftFoot'],
  ['rThigh', 'RightUpLeg', 'RightLeg'], ['rShin', 'RightLeg', 'RightFoot'],
  ['foot', 'LeftFoot', 'LeftToeBase'], ['foot', 'RightFoot', 'RightToeBase'],
];

// Feet stay flat on the skis: toes point forward and a little down in the rider frame.
const FOOT_DIR = [0, -0.45, 0.89];

export class Rig {
  constructor(root) {
    this.root = root; // the object whose frame the pose directions are written in
    this.bones = {};
    root.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.rest = new Map();
    for (const b of Object.values(this.bones)) this.rest.set(b, b.quaternion.clone());
    this.chain = CHAIN.map(([seg, a, b]) => [seg, this.bones[NAME(a)], this.bones[NAME(b)]]);
    const missing = this.chain.filter(([, a, b]) => !a || !b);
    if (missing.length) throw new Error('Rig is missing bones: ' + missing.map((m) => m[0]).join(', '));
    this._v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this._q = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
  }

  apply(pose) {
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    this.root.updateMatrixWorld(true);
    const rootQ = this.root.getWorldQuaternion(this._q[2]);
    const [pa, pb, want] = this._v;
    const [qWorld, qParent] = this._q;
    for (const [seg, bone, child] of this.chain) {
      const d = seg === 'foot' ? FOOT_DIR : pose[seg];
      want.set(d[0], d[1], d[2]).normalize().applyQuaternion(rootQ);
      bone.parent.updateWorldMatrix(true, false);
      bone.updateWorldMatrix(false, true);
      bone.getWorldPosition(pa); child.getWorldPosition(pb);
      const cur = pb.sub(pa).normalize();
      const delta = new THREE.Quaternion().setFromUnitVectors(cur, want);
      bone.getWorldQuaternion(qWorld).premultiply(delta);
      bone.parent.getWorldQuaternion(qParent).invert();
      bone.quaternion.copy(qParent.multiply(qWorld));
      bone.updateWorldMatrix(false, true);
    }
  }

  // World position of a named bone (after apply).
  pos(name, out = new THREE.Vector3()) { return this.bones[NAME(name)].getWorldPosition(out); }
}
