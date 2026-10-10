// Run: node tests/sim.test.mjs   (needs `npm i three` once)
import fs from 'fs';
import assert from 'assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildRun, JUMPS, makeTerrain, trickQuat } from '../src/sim.js';
import { TRICKS, explain } from '../src/tricks.js';
import { POSES } from '../src/poses.js';
import { Rig } from '../src/rig.js';

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.log('FAIL', name, '-', e.message); } };

// ---- terrain ----
for (const k of Object.keys(JUMPS)) {
  const T = makeTerrain(JUMPS[k]);
  ok(`${k}: lip at origin`, () => assert.ok(Math.abs(T.y(0)) < 1e-9));
  ok(`${k}: kicker rises toward lip`, () => { for (let z = T.zK0; z < -0.1; z += 0.1) assert.ok(T.y(z + 0.1) >= T.y(z) - 1e-9); });
  ok(`${k}: lip angle matches`, () => assert.ok(Math.abs(-T.angle(-0.01) / (Math.PI / 180) - JUMPS[k].lipAngle) < 1.5));
  ok(`${k}: landing never rises`, () => { for (let z = 0.1; z < T.zEnd; z += 0.2) assert.ok(T.y(z + 0.2) <= T.y(z) + 1e-9); });
}

// ---- runs ----
const table = [];
for (const k of Object.keys(JUMPS)) {
  for (const tr of TRICKS) {
    const R = buildRun(tr, k);
    const id = `${k}/${tr.id}`;
    ok(`${id}: lands on the landing slope, not the deck`, () => assert.ok(R.stats.distance > R.terrain.zL0 + 2, `distance ${R.stats.distance.toFixed(1)} knuckle ${R.terrain.zL0}`));
    ok(`${id}: lands before the run-out`, () => assert.ok(R.stats.distance < R.terrain.zL1, `distance ${R.stats.distance.toFixed(1)}`));
    // No dip at the lip: hips height keeps rising through take-off.
    ok(`${id}: no dip leaving the lip`, () => {
      let prev = -Infinity;
      for (let t = R.ev.tLip - 0.05; t < R.ev.tLip + 0.2; t += 0.005) { const y = R.sample(t).hips.y; assert.ok(y >= prev - 0.02, `t=${t.toFixed(3)} y=${y.toFixed(3)} prev=${prev.toFixed(3)}`); prev = y; }
    });
    ok(`${id}: position continuous`, () => {
      let p = R.sample(0).hips;
      for (let t = 0.004; t <= R.duration; t += 0.004) { const q = R.sample(t).hips; assert.ok(q.distanceTo(p) < 0.25, `jump of ${q.distanceTo(p).toFixed(2)} m at t=${t.toFixed(3)}`); p = q; }
    });
    ok(`${id}: orientation continuous`, () => {
      let p = R.sample(0).q;
      for (let t = 0.004; t <= R.duration; t += 0.004) { const q = R.sample(t).q; assert.ok(q.angleTo(p) < 0.35, `snap of ${(q.angleTo(p) * 57.3).toFixed(0)} deg at t=${t.toFixed(3)}`); p = q; }
    });
    ok(`${id}: inversions match the name`, () => assert.equal(R.stats.inversions, Math.abs(tr.flips)));
    ok(`${id}: upright after landing`, () => { const s = R.sample(R.duration); const up = new THREE.Vector3(0, 1, 0).applyQuaternion(s.q); assert.ok(up.y > 0.75, `up.y ${up.y.toFixed(2)}`); });
    ok(`${id}: lands facing the right way`, () => {
      const s = R.sample(R.duration);
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(s.q);
      const switchLand = ((tr.spin / 180) % 2 === 1) !== !!tr.switchIn;
      assert.ok(switchLand ? fwd.z < -0.6 : fwd.z > 0.6, `fwd.z ${fwd.z.toFixed(2)} expected ${switchLand ? 'switch' : 'forward'}`);
      assert.ok(explain(tr).includes(switchLand ? 'Lands switch' : 'Lands forward'));
    });
    if (k === 'big' || tr.id === '360') table.push([id, R.stats.airtime.toFixed(2), R.stats.distance.toFixed(1), R.stats.maxHeight.toFixed(1), Math.round(R.stats.avgRate)]);
  }
}

// Tucking must speed rotation up (the physics claim the UI makes).
ok('tuck spins faster than open', () => {
  const R = buildRun(TRICKS.find((t) => t.id === 'dc1080'), 'big');
  const rate = (t) => (R.sample(t + 0.01).u - R.sample(t - 0.01).u) / 0.02;
  const tTuck = R.ev.tLip + R.ev.airtime * 0.45, tOpen = R.ev.tLand - R.ev.airtime * 0.12;
  const tOpen2 = R.ev.tLand - R.ev.airtime * 0.2; // still rotating, already opening
  assert.ok(rate(tTuck) > rate(tOpen2) * 1.4, `tuck ${rate(tTuck).toFixed(2)} open ${rate(tOpen2).toFixed(2)}`);
  void tOpen;
});
ok('backflip goes head-backward first', () => {
  const q = trickQuat({ spin: 0, flips: 1, axis: 0 }, 0.25);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  assert.ok(up.z < -0.9, `head z ${up.z.toFixed(2)}`);
});
ok('frontflip goes head-forward first', () => {
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(trickQuat({ spin: 0, flips: -1, axis: 0 }, 0.25));
  assert.ok(up.z > 0.9);
});

// ---- rig ----
const buf = fs.readFileSync(new URL('../assets/skier.glb', import.meta.url));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
const holder = new THREE.Group(); holder.add(gltf.scene);
const rig = new Rig(holder);
const P = (n) => rig.pos(n).clone();
for (const [name, pose] of Object.entries(POSES)) {
  rig.apply(pose);
  const hip = P('Hips'), lK = P('LeftLeg'), rK = P('RightLeg'), lA = P('LeftFoot'), rA = P('RightFoot');
  const head = P('Head'), lH = P('LeftHand'), lUp = P('LeftUpLeg');
  ok(`pose ${name}: knees in front of hips`, () => assert.ok(lK.z > lUp.z - 0.02 && rK.z > lUp.z - 0.02, `kz ${lK.z.toFixed(2)} hipz ${lUp.z.toFixed(2)}`));
  ok(`pose ${name}: feet below knees`, () => assert.ok(lA.y < lK.y && rA.y < rK.y));
  ok(`pose ${name}: head above hips`, () => assert.ok(head.y > hip.y + 0.15, `head ${head.y.toFixed(2)} hip ${hip.y.toFixed(2)}`));
  ok(`pose ${name}: left side is +X`, () => assert.ok(lK.x > rK.x && lH.x > -0.1));
  ok(`pose ${name}: bone lengths preserved`, () => assert.ok(Math.abs(lK.distanceTo(lA) - 0.445) < 0.01));
  if (name === 'tuck') ok('tuck: knees near chest height', () => assert.ok(lK.y > hip.y - 0.05, `knee ${lK.y.toFixed(2)} hip ${hip.y.toFixed(2)}`));
  if (name === 'pop') ok('pop: hands above head', () => assert.ok(lH.y > head.y - 0.05));
  if (name === 'grab') ok('grab: left hand reaches below knees', () => assert.ok(lH.y < lK.y, `hand ${lH.y.toFixed(2)} knee ${lK.y.toFixed(2)}`));
}
// Rotated rider frame: pose directions follow the frame.
holder.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
rig.apply(POSES.stand);
ok('rotated frame: knees follow the rider facing -Z', () => assert.ok(P('LeftLeg').z < P('LeftUpLeg').z));

console.log('\nAirtime / distance / peak / avg rotation rate');
console.log('jump/trick'.padEnd(24), 'air s', 'dist m', 'peak m', 'deg/s');
for (const r of table) console.log(r[0].padEnd(24), r.slice(1).map((x) => String(x).padStart(6)).join(' '));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
