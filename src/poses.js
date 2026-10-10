// Body shapes, written as the direction each body segment points.
// Frame: rider's own frame. +Y up, +Z the way the chest faces, +X the rider's LEFT.
// Directions don't need to be unit length; they are normalised when used.
//
// Only directions are stored. The rig's own bone lengths decide where each joint ends up,
// so the same pose works on any humanoid model.

const P = (o) => o;

export const POSES = {
  // Athletic ski stance: shins and torso roughly parallel, hands forward.
  stand: P({
    spine: [0, 1, 0.28], neck: [0, 1, 0.15],
    lUpper: [0.3, -0.9, 0.35], lFore: [0.1, -0.35, 0.93],
    rUpper: [-0.3, -0.9, 0.35], rFore: [-0.1, -0.35, 0.93],
    lThigh: [0.02, -0.92, 0.4], lShin: [0, -0.94, -0.33],
    rThigh: [-0.02, -0.92, 0.4], rShin: [0, -0.94, -0.33],
  }),
  // Loading on the kicker: deep flex, chest over knees, arms reaching forward.
  load: P({
    spine: [0, 0.82, 0.58], neck: [0, 0.8, 0.6],
    lUpper: [0.3, -0.55, 0.78], lFore: [0.1, 0.05, 1],
    rUpper: [-0.3, -0.55, 0.78], rFore: [-0.1, 0.05, 1],
    lThigh: [0.03, -0.6, 0.8], lShin: [0, -0.82, -0.57],
    rThigh: [-0.03, -0.6, 0.8], rShin: [0, -0.82, -0.57],
  }),
  // Pop off the lip: legs extend, arms swing up and forward.
  pop: P({
    spine: [0, 1, 0.08], neck: [0, 1, 0.05],
    lUpper: [0.35, 0.65, 0.65], lFore: [0.15, 0.9, 0.4],
    rUpper: [-0.35, 0.65, 0.65], rFore: [-0.15, 0.9, 0.4],
    lThigh: [0.02, -1, 0.06], lShin: [0, -1, -0.06],
    rThigh: [-0.02, -1, 0.06], rShin: [0, -1, -0.06],
  }),
  // Flat-spin shape: tall-ish, knees up a little, arms pulled in across the chest.
  spinTight: P({
    spine: [0, 1, 0.25], neck: [0, 1, 0.12],
    lUpper: [0.2, -0.55, 0.8], lFore: [-0.75, 0.1, 0.65],
    rUpper: [-0.2, -0.55, 0.8], rFore: [0.75, 0.1, 0.65],
    lThigh: [0.03, -0.55, 0.84], lShin: [0, -0.9, -0.44],
    rThigh: [-0.03, -0.55, 0.84], rShin: [0, -0.9, -0.44],
  }),
  // Tuck: knees to chest, hands toward shins.
  tuck: P({
    spine: [0, 0.72, 0.7], neck: [0, 0.55, 0.84],
    lUpper: [0.3, -0.35, 0.89], lFore: [-0.2, -0.75, 0.6],
    rUpper: [-0.3, -0.35, 0.89], rFore: [0.2, -0.75, 0.6],
    lThigh: [0.05, 0.25, 0.97], lShin: [0, -0.96, -0.28],
    rThigh: [-0.05, 0.25, 0.97], rShin: [0, -0.96, -0.28],
  }),
  // Mute-style grab: tucked, left hand down to the outside of the left ski, right arm out for balance.
  grab: P({
    spine: [0, 0.68, 0.73], neck: [0, 0.5, 0.86],
    lUpper: [0.35, -0.75, 0.55], lFore: [0.08, -0.97, 0.22],
    rUpper: [-0.85, 0.05, 0.5], rFore: [-0.6, 0.35, 0.72],
    lThigh: [0.06, 0.3, 0.95], lShin: [0, -0.96, -0.28],
    rThigh: [-0.06, 0.3, 0.95], rShin: [0, -0.96, -0.28],
  }),
  // Opening to spot the landing: legs reach down, arms out to slow the rotation.
  open: P({
    spine: [0, 1, 0.22], neck: [0, 0.95, 0.3],
    lUpper: [0.75, -0.25, 0.6], lFore: [0.45, -0.15, 0.88],
    rUpper: [-0.75, -0.25, 0.6], rFore: [-0.45, -0.15, 0.88],
    lThigh: [0.03, -0.82, 0.57], lShin: [0, -0.96, -0.28],
    rThigh: [-0.03, -0.82, 0.57], rShin: [0, -0.96, -0.28],
  }),
  // Absorb on touchdown: deep knee bend, arms forward.
  absorb: P({
    spine: [0, 0.78, 0.63], neck: [0, 0.8, 0.6],
    lUpper: [0.35, -0.6, 0.72], lFore: [0.15, -0.1, 0.99],
    rUpper: [-0.35, -0.6, 0.72], rFore: [-0.15, -0.1, 0.99],
    lThigh: [0.03, -0.52, 0.85], lShin: [0, -0.8, -0.6],
    rThigh: [-0.03, -0.52, 0.85], rShin: [0, -0.8, -0.6],
  }),
};

export const SEGMENTS = Object.keys(POSES.stand);

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// Blend two poses segment by segment (normalised lerp of directions).
export function blendPose(a, b, t) {
  const out = {};
  for (const k of SEGMENTS) {
    const x = norm(a[k]), y = norm(b[k]);
    out[k] = norm([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  }
  return out;
}

// Approximate segment lengths (metres) for a 1.8 m rider. Used only for physics estimates
// (moment of inertia, hip height). The browser uses the real rig's bones for drawing.
export const BODY = {
  spine: 0.46, neck: 0.18, shoulderHalf: 0.17, hipHalf: 0.085,
  upper: 0.28, fore: 0.28, thigh: 0.44, shin: 0.45, ankleToBase: 0.11,
};

// Segment masses as fractions of body mass (de Leva 1996, rounded).
const MASS = { trunk: 0.43, head: 0.08, upper: 0.027, fore: 0.022, thigh: 0.14, shin: 0.06 };

const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

// Joint positions in the rider frame, hips at the origin.
export function joints(pose) {
  const d = {};
  for (const k of SEGMENTS) d[k] = norm(pose[k]);
  const hip = [0, 0, 0];
  const neck = add(hip, d.spine, BODY.spine);
  const head = add(neck, d.neck, BODY.neck);
  // Shoulders sit either side of the neck base, perpendicular to the spine in the left-right direction.
  const lSh = add(neck, [1, 0, 0], BODY.shoulderHalf), rSh = add(neck, [-1, 0, 0], BODY.shoulderHalf);
  const lEl = add(lSh, d.lUpper, BODY.upper), rEl = add(rSh, d.rUpper, BODY.upper);
  const lHa = add(lEl, d.lFore, BODY.fore), rHa = add(rEl, d.rFore, BODY.fore);
  const lHp = [BODY.hipHalf, 0, 0], rHp = [-BODY.hipHalf, 0, 0];
  const lKn = add(lHp, d.lThigh, BODY.thigh), rKn = add(rHp, d.rThigh, BODY.thigh);
  const lAn = add(lKn, d.lShin, BODY.shin), rAn = add(rKn, d.rShin, BODY.shin);
  return { hip, neck, head, lSh, rSh, lEl, rEl, lHa, rHa, lHp, rHp, lKn, rKn, lAn, rAn };
}

// Height of the hips above the ski base for this pose (rider frame).
export function hipHeight(pose) {
  const j = joints(pose);
  return -Math.min(j.lAn[1], j.rAn[1]) + BODY.ankleToBase;
}

// Moment of inertia (per kg of body mass) about the centre of mass, averaged over the three
// principal directions. Good enough to show the key effect: tuck = small = spins fast.
export function inertia(pose) {
  const j = joints(pose);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const pts = [
    [mid(j.hip, j.neck), MASS.trunk], [j.head, MASS.head],
    [mid(j.lSh, j.lEl), MASS.upper], [mid(j.rSh, j.rEl), MASS.upper],
    [mid(j.lEl, j.lHa), MASS.fore], [mid(j.rEl, j.rHa), MASS.fore],
    [mid(j.lHp, j.lKn), MASS.thigh], [mid(j.rHp, j.rKn), MASS.thigh],
    [mid(j.lKn, j.lAn), MASS.shin], [mid(j.rKn, j.rAn), MASS.shin],
  ];
  let m = 0; const c = [0, 0, 0];
  for (const [p, w] of pts) { m += w; c[0] += p[0] * w; c[1] += p[1] * w; c[2] += p[2] * w; }
  c[0] /= m; c[1] /= m; c[2] /= m;
  let I = 0;
  for (const [p, w] of pts) I += w * ((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2);
  // Add each segment's own small inertia so a fully folded body never reaches zero.
  return (2 / 3) * I + 0.012;
}
