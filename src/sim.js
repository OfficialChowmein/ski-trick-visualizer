// Physics and timing. No drawing here, so it runs in Node for tests too.
//
// World frame: +Z = downhill / direction of travel, +Y = up, +X = rider's left when facing +Z.
// Units: metres, seconds, radians (degrees only at the edges).

import * as THREE from 'three';
import { POSES, blendPose, hipHeight, inertia } from './poses.js';

const G = 9.81;
const DEG = Math.PI / 180;

// ---------- Jumps ----------
// lipAngle: kicker take-off angle. kickH: kicker height above its base. deckDrop: lip height above
// the deck. knuckle: distance from lip to where the landing starts falling away. landAngle: landing
// pitch. speed: take-off speed. All three are plausible, not measured from a specific venue.
export const JUMPS = {
  small: { label: 'Park (small)', speed: 9.5, lipAngle: 27, kickH: 1.1, deckDrop: 1.1, knuckle: 5, landAngle: 30, inrunAngle: 16, landLen: 22, scaffold: false },
  medium: { label: 'Park (large)', speed: 13, lipAngle: 30, kickH: 2.2, deckDrop: 1.6, knuckle: 9.5, landAngle: 32, inrunAngle: 20, landLen: 34, scaffold: false },
  big: { label: 'Big air', speed: 17.5, lipAngle: 32, kickH: 3.6, deckDrop: 2.4, knuckle: 15, landAngle: 34, inrunAngle: 27, landLen: 52, scaffold: true },
};

// Terrain height y(z) along the centre line. Lip is at (z=0, y=0).
export function makeTerrain(J) {
  const a = J.lipAngle * DEG, b = J.landAngle * DEG, s = J.inrunAngle * DEG;
  const R = J.kickH / (1 - Math.cos(a));            // kicker transition radius
  const zK0 = -R * Math.sin(a);                      // where the kicker curve starts (flat)
  const flat = 4;                                    // short flat table before the kicker
  const zF0 = zK0 - flat;                            // in-run meets the flat here
  const F = 10;                                      // in-run to flat blend length
  const Fk = 5;                                      // knuckle rounding length
  const zL0 = J.knuckle, zL1 = J.knuckle + J.landLen; // landing slope span
  const Fr = 14;                                     // landing to run-out blend length
  const yBase = -J.kickH, yDeck = -J.deckDrop;
  const yLandEnd = yDeck - Math.tan(b) * (zL1 - zL0 - Fk / 2);

  function y(z) {
    if (z <= zF0 - F) return yBase + Math.tan(s) * (zF0 - F / 2 - z);
    if (z <= zF0) return yBase + Math.tan(s) * (zF0 - z) ** 2 / (2 * F);
    if (z <= zK0) return yBase;
    if (z <= 0) { const th = Math.asin((z - zK0) / R); return yBase + R * (1 - Math.cos(th)); }
    if (z <= zL0) return yDeck;
    if (z <= zL0 + Fk) return yDeck - Math.tan(b) * (z - zL0) ** 2 / (2 * Fk);
    if (z <= zL1) return yDeck - Math.tan(b) * (z - zL0 - Fk / 2);
    if (z <= zL1 + Fr) { const u = z - zL1; return yLandEnd - Math.tan(b) * (u - u * u / (2 * Fr)); }
    return yLandEnd - Math.tan(b) * Fr / 2;
  }
  // Slope angle (positive = falling away downhill). The kicker face is the only rising part.
  // Uphill of the lip use a one-sided difference so the drop off the back of the kicker never leaks in.
  function angle(z) {
    const h = 0.05;
    if (z <= 0) return -Math.atan((y(z) - y(z - h)) / h);
    return -Math.atan((y(z + h) - y(z - h)) / (2 * h));
  }
  return { y, angle, zK0, zF0, zL0, zL1, zEnd: zL1 + Fr + 25, zStart: zF0 - 60, R, yBase, yDeck };
}

// Walk along the surface by arc length starting at z0 (negative distance = uphill).
function walk(T, z0, dist) {
  const step = 0.05 * Math.sign(dist);
  let z = z0, left = Math.abs(dist);
  while (left > 0) {
    const dz = step, dy = T.y(z + dz) - T.y(z);
    const seg = Math.hypot(dz, dy);
    if (seg >= left) { z += dz * (left / seg); break; }
    z += dz; left -= seg;
  }
  return z;
}

// ---------- Rotation ----------
// Body orientation in the air = pitch of the take-off/landing (world X) * entry heading *
// spin around the rider's vertical * flip around a horizontal axis in the rider's frame.
// The flip axis sits `axis` degrees from the rider's left-right line toward their nose.
// A backflip is a negative rotation about +X (left) because +X rotation tips the head forward.
const AX_X = new THREE.Vector3(1, 0, 0), AX_Y = new THREE.Vector3(0, 1, 0);

export function trickQuat(trick, u, out = new THREE.Quaternion()) {
  const spin = trick.spin * DEG * u;
  const flip = -trick.flips * 2 * Math.PI * u;
  const ax = new THREE.Vector3(Math.cos(trick.axis * DEG), 0, Math.sin(trick.axis * DEG));
  const qs = new THREE.Quaternion().setFromAxisAngle(AX_Y, spin);
  const qf = new THREE.Quaternion().setFromAxisAngle(ax, flip);
  return out.copy(qs).multiply(qf);
}

// ---------- Pose schedule ----------
// Returns the body shape as a function of time, given the event times of this run.
function poseSchedule(trick, ev) {
  const air = ev.tLand - ev.tLip;
  const mid = trick.family === 'spin' ? POSES.spinTight : POSES.tuck;
  const k = [
    [0, POSES.stand],
    [ev.tLip - 0.75, POSES.stand],
    [ev.tLip - 0.22, POSES.load],      // sink into the transition
    [ev.tLip, POSES.pop],               // full extension leaving the lip
    [ev.tLip + Math.min(0.28, air * 0.18), mid],
  ];
  if (trick.grab) {
    k.push([ev.tLip + air * 0.32, POSES.grab], [ev.tLip + air * 0.55, POSES.grab], [ev.tLip + air * 0.66, mid]);
  } else {
    k.push([ev.tLip + air * 0.6, mid]);
  }
  k.push([ev.tLand - Math.min(0.42, air * 0.3), POSES.open]); // open up, spot the landing
  k.push([ev.tLand, POSES.open], [ev.tLand + 0.18, POSES.absorb], [ev.tLand + 0.8, POSES.stand]);
  return (t) => {
    if (t <= k[0][0]) return k[0][1];
    for (let i = 0; i < k.length - 1; i++) {
      const [t0, a] = k[i], [t1, b] = k[i + 1];
      if (t <= t1) { const f = (t - t0) / Math.max(1e-6, t1 - t0); return blendPose(a, b, f * f * (3 - 2 * f)); }
    }
    return k[k.length - 1][1];
  };
}

// ---------- Build a full run ----------
export function buildRun(trick, jumpKey = 'big') {
  const J = JUMPS[jumpKey];
  const T = makeTerrain(J);
  const a = J.lipAngle * DEG, b = J.landAngle * DEG;
  const v0 = J.speed;
  const approachTime = 2.2, rideOut = 1.6;
  const tLip = approachTime;

  // Take-off: the centre of mass leaves the lip with the lip's angle and speed.
  // CoM height above the skis at the lip comes from the pop pose.
  const hPop = hipHeight(POSES.pop);
  const qLip = new THREE.Quaternion().setFromAxisAngle(AX_X, -a); // nose up
  const comLip = new THREE.Vector3(0, hPop, 0).applyQuaternion(qLip); // lip is at origin
  const vz = v0 * Math.cos(a), vy = v0 * Math.sin(a);
  const comAir = (t) => new THREE.Vector3(0, comLip.y + vy * t - 0.5 * G * t * t, comLip.z + vz * t);

  // Touchdown: first time the skis (CoM minus the landing-pose offset, tilted to the slope) meet snow.
  const hOpen = hipHeight(POSES.open);
  const qLandPitch = new THREE.Quaternion().setFromAxisAngle(AX_X, b);
  const offLand = new THREE.Vector3(0, hOpen, 0).applyQuaternion(qLandPitch);
  const gap = (t) => { const c = comAir(t); return (c.y - offLand.y) - T.y(c.z - offLand.z); };
  let t0 = 0.15, t1 = 0.15;
  while (gap(t1) > 0 && t1 < 8) { t0 = t1; t1 += 0.02; }
  for (let i = 0; i < 40; i++) { const m = (t0 + t1) / 2; if (gap(m) > 0) t0 = m; else t1 = m; }
  const airtime = (t0 + t1) / 2;
  const tLand = tLip + airtime;
  const landCom = comAir(airtime);
  const zTouch = landCom.z - offLand.z;
  const vLand = Math.hypot(vz, vy - G * airtime);
  const speedAlong = vLand * Math.cos(Math.atan2(G * airtime - vy, vz) - b); // keep the part along the slope
  const duration = tLand + rideOut;

  const ev = { tLip, tLand, airtime, duration };
  const poseAt = poseSchedule(trick, ev);

  // Rotation progress: angular momentum is conserved in the air, so rotation rate ~ 1 / inertia.
  // Integrate that over the air time, then normalise so the trick finishes a little before touchdown.
  const rotEnd = tLip + airtime * 0.9;
  const N = 400, cum = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const t = tLip + (rotEnd - tLip) * (i - 0.5) / N;
    cum[i] = cum[i - 1] + 1 / inertia(poseAt(t));
  }
  const rotU = (t) => {
    if (t <= tLip) return 0;
    if (t >= rotEnd) return 1;
    const x = (t - tLip) / (rotEnd - tLip) * N, i = Math.floor(x);
    return (cum[i] + (cum[Math.min(N, i + 1)] - cum[i]) * (x - i)) / cum[N];
  };

  const yaw0 = trick.switchIn ? Math.PI : 0;
  const qYaw0 = new THREE.Quaternion().setFromAxisAngle(AX_Y, yaw0);
  const qYawEnd = new THREE.Quaternion().setFromAxisAngle(AX_Y, yaw0 + trick.spin * DEG);

  // Ground positions: arc-length along the surface from the lip / touchdown point.
  function onGround(z, heading, pose) {
    const ang = T.angle(z);
    const qp = new THREE.Quaternion().setFromAxisAngle(AX_X, ang);
    const q = qp.multiply(heading);
    const up = new THREE.Vector3(0, hipHeight(pose), 0).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(AX_X, ang));
    return { hips: new THREE.Vector3(0, T.y(z), z).add(up), q, contactZ: z };
  }

  function sample(t) {
    t = Math.max(0, Math.min(duration, t));
    const pose = poseAt(t);
    let hips, q, contactZ = null, phase, speed;
    const u = rotU(t);
    if (t < tLip) {
      const z = walk(T, 0, -v0 * (tLip - t));
      ({ hips, q, contactZ } = onGround(z, qYaw0, pose));
      phase = 'ground'; speed = v0;
    } else if (t < tLand) {
      const ta = t - tLip;
      hips = comAir(ta);
      // Base pitch eases from the lip angle to the landing angle so the skis match the landing.
      const f = ta / airtime, e = f * f * (3 - 2 * f);
      const qp = new THREE.Quaternion().setFromAxisAngle(AX_X, -a + (a + b) * e);
      q = qp.multiply(qYaw0.clone()).multiply(trickQuat(trick, u));
      phase = 'air'; speed = Math.hypot(vz, vy - G * ta);
    } else {
      const z = walk(T, zTouch, speedAlong * (t - tLand));
      ({ hips, q, contactZ } = onGround(z, qYawEnd, pose));
      phase = 'ground'; speed = speedAlong;
    }
    const upDir = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const below = T.y(hips.z);
    return {
      t, pose, hips, q, u, phase, speed, contactZ,
      inverted: upDir.y < 0,
      heightAboveSnow: hips.y - below,
    };
  }

  // Milestones computed from the motion itself, not hand-typed.
  const marks = [
    { t: 0, label: 'Approach' },
    { t: tLip - 0.22, label: 'Load' },
    { t: tLip, label: 'Pop' },
  ];
  const step = 1 / 120;
  let wasInv = false, inv = 0, nextSpin = 360;
  for (let t = tLip; t < tLand; t += step) {
    const s = sample(t);
    if (s.inverted && !wasInv) marks.push({ t, label: `Inverted ${++inv}` });
    wasInv = s.inverted;
    const spunNow = trick.spin * s.u;
    while (trick.spin >= nextSpin && spunNow >= nextSpin && nextSpin < trick.spin) { marks.push({ t, label: `${nextSpin}°` }); nextSpin += 360; }
  }
  marks.push({ t: tLand - Math.min(0.42, airtime * 0.3), label: 'Spot & open' });
  marks.push({ t: tLand, label: 'Touchdown' });
  marks.push({ t: tLand + 0.18, label: 'Absorb' });
  marks.sort((x, y) => x.t - y.t);

  const totalDeg = trick.spin + Math.abs(trick.flips) * 360;
  const stats = {
    airtime,
    takeoffKmh: v0 * 3.6,
    maxHeight: (comLip.y + vy * vy / (2 * G)) - T.yDeck, // CoM height above the deck at the peak
    distance: zTouch,
    avgRate: totalDeg / (rotEnd - tLip),                 // degrees per second, averaged
    inversions: inv,
  };

  return { trick, jump: J, terrain: T, ev, duration, sample, marks, stats, rotEnd };
}
