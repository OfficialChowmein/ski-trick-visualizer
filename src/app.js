import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { buildRun, JUMPS } from './sim.js';
import { TRICKS, CATEGORIES, explain } from './tricks.js';
import { Rig } from './rig.js';

const $ = (id) => document.getElementById(id);
const DEG = 180 / Math.PI;

// ---------------------------------------------------------------- renderer
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false;
controls.enableDamping = true;

// Sky and sun (Preetham sky model from three.js addons).
const sky = new Sky();
sky.scale.setScalar(4000);
const su = sky.material.uniforms;
su.turbidity.value = 3; su.rayleigh.value = 1.2; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.85;
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(55), THREE.MathUtils.degToRad(205)); // behind and left of the in-run
su.sunPosition.value.copy(sunDir);
scene.add(sky);
scene.fog = new THREE.Fog(0xc9dbea, 160, 900);

scene.add(new THREE.HemisphereLight(0xdbe9f7, 0xb7c6d6, 1.6));
const sun = new THREE.DirectionalLight(0xfff3e2, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 160 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// ---------------------------------------------------------------- world (rebuilt per jump)
let world = null;

function noise(x, z) {
  return Math.sin(x * 0.11 + z * 0.05) * 0.6 + Math.sin(x * 0.037 - z * 0.071) * 1.4 + Math.sin(z * 0.023 + x * 0.019) * 2.2;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function buildWorld(jumpKey) {
  if (world) { scene.remove(world); world.traverse((o) => { o.geometry?.dispose(); }); }
  world = new THREE.Group();
  const J = JUMPS[jumpKey];
  const T = buildRun(TRICKS[0], jumpKey).terrain;
  const halfW = { small: 5, medium: 7, big: 9 }[jumpKey];

  // Ground under everything that isn't the built course.
  const natural = (z) => {
    if (z <= T.zK0) return T.y(z);
    if (z <= 0) return T.yBase;
    if (z <= T.zL0) return T.yBase + (T.yDeck - T.yBase) * (z / T.zL0);
    return T.y(z);
  };
  const heightAt = (x, z) => {
    const ax = Math.abs(x);
    const w = smooth(halfW, halfW + 4, ax);
    let y = T.y(z) * (1 - w) + natural(z) * w;
    y += 0.9 * smooth(halfW + 0.5, halfW + 2.5, ax) * (1 - smooth(halfW + 6, halfW + 14, ax)); // side berms
    y += noise(x, z) * smooth(halfW + 8, halfW + 40, ax);
    y += Math.max(0, ax - halfW - 30) * 0.18; // valley walls rise away from the course
    return y;
  };

  // Sample z densely where the shape changes, sparsely elsewhere.
  const zs = [];
  for (let z = T.zStart - 120; z < T.zK0 - 2; z += 1.5) zs.push(z);
  for (let z = T.zK0 - 2; z < -0.05; z += 0.25) zs.push(z);
  zs.push(-0.03, 0.03); // near-vertical drop off the back of the lip
  for (let z = 0.3; z < T.zL0 + 8; z += 0.5) zs.push(z);
  for (let z = T.zL0 + 8; z < T.zEnd + 200; z += 1.5) zs.push(z);
  const xs = [];
  for (let x = -260; x <= 260; x += x > -halfW - 16 && x < halfW + 16 ? 0.5 : 4) xs.push(x);

  const pos = [], col = [], idx = [];
  const cSnow = new THREE.Color(0xf4f8fb), cShade = new THREE.Color(0xdde7f0), cKick = new THREE.Color(0xe6eef6);
  for (const z of zs) for (const x of xs) {
    const y = heightAt(x, z);
    pos.push(x, y, z);
    const onKicker = Math.abs(x) < halfW && z > T.zK0 && z <= 0;
    const c = (onKicker ? cKick : cSnow).clone().lerp(cShade, 0.5 * smooth(halfW + 2, halfW + 60, Math.abs(x)));
    col.push(c.r, c.g, c.b);
  }
  const nx = xs.length;
  for (let i = 0; i < zs.length - 1; i++) for (let j = 0; j < nx - 1; j++) {
    const a = i * nx + j, b = a + nx;
    idx.push(a, b, a + 1, a + 1, b, b + 1); // counter-clockwise from above, so normals point up
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }));
  ground.receiveShadow = true;
  world.add(ground);

  // Dye lines on the landing every 5 m past the knuckle, red at the knuckle itself.
  const dye = (z, color, width = 0.35) => {
    const pts = [];
    for (let x = -halfW; x <= halfW; x += 0.5) pts.push(x, heightAt(x, z) + 0.03, z);
    const geo = new THREE.BufferGeometry();
    const p = [], ix = [];
    for (let k = 0; k < pts.length / 3; k++) {
      const x = pts[k * 3], y = pts[k * 3 + 1], zz = pts[k * 3 + 2];
      p.push(x, y, zz - width / 2, x, heightAt(x, zz + width / 2) + 0.03, zz + width / 2);
      if (k) ix.push((k - 1) * 2, (k - 1) * 2 + 1, k * 2, (k - 1) * 2 + 1, k * 2 + 1, k * 2);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setIndex(ix); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }));
    m.receiveShadow = true; world.add(m);
  };
  dye(T.zL0, 0xc8312b, 0.45);
  for (let z = T.zL0 + 5; z < T.zL1; z += 5) dye(z, 0x2f6fd0);
  dye(-0.2, 0x2f6fd0, 0.3); // lip line

  // Safety netting along both sides of the course.
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3b4450, roughness: 0.6, metalness: 0.4 });
  const netMat = new THREE.MeshStandardMaterial({ color: 0xf25c1f, roughness: 0.85, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const x = side * (halfW + 3.2);
    const pts = [];
    for (let z = T.zStart + 20; z < T.zL1 + 10; z += 3) pts.push(new THREE.Vector3(x, heightAt(x, z), z));
    const netPos = [], netIdx = [];
    pts.forEach((p, k) => {
      netPos.push(p.x, p.y + 0.1, p.z, p.x, p.y + 1.6, p.z);
      if (k) netIdx.push((k - 1) * 2, k * 2, (k - 1) * 2 + 1, (k - 1) * 2 + 1, k * 2, k * 2 + 1);
      if (k % 2 === 0) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), postMat);
        post.position.set(p.x, p.y + 0.9, p.z); post.castShadow = true; world.add(post);
      }
    });
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(netPos, 3)); ng.setIndex(netIdx); ng.computeVertexNormals();
    world.add(new THREE.Mesh(ng, netMat));
  }

  // Big air: steel scaffold where the lip overhangs the deck.
  if (J.scaffold) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x55606c, roughness: 0.5, metalness: 0.6 });
    const drop = -T.yDeck;
    for (let x = -halfW; x <= halfW + 0.01; x += 1.5) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, drop, 0.1), steel);
      p.position.set(x, -drop / 2, 0.15); p.castShadow = true; world.add(p);
    }
    for (let y = -drop + 0.6; y < -0.2; y += 0.8) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, 0.07, 0.07), steel);
      r.position.set(0, y, 0.15); world.add(r);
    }
  }

  // Trees on the hillside, kept off the course.
  const tree = new THREE.ConeGeometry(1, 1, 7);
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x24402f, roughness: 0.95 });
  const N = 900, trees = new THREE.InstancedMesh(tree, treeMat, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let n = 0;
  while (n < N) {
    const x = (rnd() - 0.5) * 480, z = T.zStart - 100 + rnd() * (T.zEnd - T.zStart + 300);
    if (Math.abs(x) < halfW + 36) continue; // keep the side camera's sight line clear
    const h = 5 + rnd() * 9;
    s.set(h * 0.28, h, h * 0.28); p.set(x, heightAt(x, z) + h * 0.45, z);
    trees.setMatrixAt(n++, m4.compose(p, q, s));
  }
  trees.castShadow = true;
  world.add(trees);

  // Mountains on the horizon.
  const ring = new THREE.BufferGeometry();
  const rp = [], rc = [], ri = [];
  const SEG = 160, R0 = 900, R1 = 1300;
  const rock = new THREE.Color(0x6f7f91), snowC = new THREE.Color(0xf2f6fa);
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    const h = 120 + 140 * Math.abs(Math.sin(a * 3.1) * Math.cos(a * 1.7)) + 90 * Math.abs(Math.sin(a * 7.3));
    rp.push(Math.cos(a) * R0, -60, Math.sin(a) * R0, Math.cos(a) * R1, h, Math.sin(a) * R1);
    rc.push(rock.r, rock.g, rock.b, snowC.r, snowC.g, snowC.b);
    if (i) ri.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1);
  }
  ring.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  ring.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
  ring.setIndex(ri);
  ring.computeVertexNormals();
  world.add(new THREE.Mesh(ring, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })));

  scene.add(world);
  return { T, halfW, heightAt };
}

// ---------------------------------------------------------------- rider
const SUIT = 0xf25c1f, JOINTS = 0x14233a;
function makeSki(mat) {
  // A twin-tip ski: flat plank with both ends turned up.
  const shape = new THREE.Shape();
  const L = 1.78, Wd = 0.105;
  shape.moveTo(-Wd / 2, -L / 2); shape.lineTo(Wd / 2, -L / 2); shape.lineTo(Wd / 2, L / 2); shape.lineTo(-Wd / 2, L / 2); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: false, steps: 1 });
  geo.rotateX(-Math.PI / 2);
  // Bend the tips: lift vertices near the ends.
  const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const z = pa.getZ(i), e = Math.max(0, Math.abs(z) - L / 2 + 0.22);
    pa.setY(i, pa.getY(i) + e * e * 2.2);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

function makeRider(template, ghost = false) {
  const rider = new THREE.Group();
  const body = SkeletonUtils.clone(template);
  const ghostMat = new THREE.MeshStandardMaterial({ color: 0x14233a, transparent: true, opacity: 0.38, depthWrite: false });
  body.traverse((o) => {
    if (o.isMesh) {
      o.material = ghost ? ghostMat : new THREE.MeshStandardMaterial({
        color: o.name === 'Beta_Joints' ? JOINTS : SUIT, roughness: 0.62, metalness: 0.05,
      });
      o.castShadow = !ghost; o.frustumCulled = false;
    }
  });
  rider.add(body);
  const rig = new Rig(rider);
  // Put the hips bone at the rider origin so tricks rotate around the hips, not the feet.
  rider.updateMatrixWorld(true);
  const hips = rig.pos('Hips');
  body.position.sub(hips);

  // Helmet and goggles ride on the head bone.
  const head = rig.bones.mixamorigHead;
  const ws = head.getWorldScale(new THREE.Vector3()).x;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
    ghost ? ghostMat : new THREE.MeshStandardMaterial({ color: 0xf3f6f8, roughness: 0.35 }));
  helmet.scale.setScalar(1 / ws); helmet.position.set(0, 0.07 / ws, 0.0);
  helmet.castShadow = !ghost;
  head.add(helmet);
  if (!ghost) {
    // Goggle lens: a curved band across the front of the helmet.
    const goggles = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.05, 20, 1, true, -Math.PI * 0.32, Math.PI * 0.64),
      new THREE.MeshStandardMaterial({ color: 0x1f5fbf, roughness: 0.15, metalness: 0.6, side: THREE.DoubleSide }));
    goggles.scale.setScalar(1 / ws);
    goggles.position.set(0, 0.075 / ws, 0.01 / ws);
    head.add(goggles);
  }

  const skiMat = ghost ? ghostMat : new THREE.MeshStandardMaterial({ color: 0x14233a, roughness: 0.4, metalness: 0.3 });
  const skis = [makeSki(skiMat), makeSki(skiMat)];
  rider.add(...skis);

  const tmp = new THREE.Vector3();
  function set(sample) {
    rider.position.copy(sample.hips);
    rider.quaternion.copy(sample.q);
    rider.updateMatrixWorld(true);
    rig.apply(sample.pose);
    ['LeftFoot', 'RightFoot'].forEach((f, i) => {
      rider.worldToLocal(rig.pos(f, tmp));
      skis[i].position.set(tmp.x, tmp.y - 0.1, tmp.z + 0.1);
    });
  }
  return { group: rider, set };
}

// ---------------------------------------------------------------- state
const state = {
  trick: TRICKS.find((t) => t.id === 'dc1080'),
  jump: 'big', cam: 'chase', t: 0, playing: false, speed: 0.25, seq: false,
};
(function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const t = TRICKS.find((x) => x.id === h.get('trick')); if (t) state.trick = t;
  if (JUMPS[h.get('jump')]) state.jump = h.get('jump');
})();
const writeHash = () => history.replaceState(null, '', `#trick=${state.trick.id}&jump=${state.jump}`);

let run, env, rider, ghosts = [], pathLine = null, template = null;

function rebuild({ worldChanged = false } = {}) {
  if (worldChanged || !env) env = buildWorld(state.jump);
  run = buildRun(state.trick, state.jump);
  state.t = Math.min(state.t, run.duration);
  drawTimeline();
  drawInfo();
  drawPath();
  drawGhosts();
  writeHash();
  snapCamera = true;
}

function drawPath() {
  if (pathLine) { scene.remove(pathLine); pathLine.geometry.dispose(); }
  const pts = [];
  for (let t = run.ev.tLip; t <= run.ev.tLand; t += 0.03) pts.push(run.sample(t).hips);
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  pathLine = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0x1f5fbf, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.7 }));
  pathLine.computeLineDistances();
  scene.add(pathLine);
}

function drawGhosts() {
  for (const g of ghosts) scene.remove(g.group);
  ghosts = [];
  if (!state.seq || !template) return;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = run.ev.tLip + (run.ev.airtime * (i + 0.5)) / n;
    const g = makeRider(template, true);
    g.set(run.sample(t));
    scene.add(g.group);
    ghosts.push(g);
  }
}

// ---------------------------------------------------------------- UI: panel
function trickSub(t) {
  const bits = [];
  if (t.spin) bits.push(`${t.spin}°`);
  if (t.flips) bits.push(`${Math.abs(t.flips)} ${t.flips > 0 ? 'back' : 'front'}${t.axis >= 80 ? ' side' : ''} flip${Math.abs(t.flips) > 1 ? 's' : ''}`);
  return bits.join(', ');
}
function drawPanel() {
  const list = $('trickList');
  list.innerHTML = '';
  for (const c of CATEGORIES) {
    const g = document.createElement('div'); g.className = 'group';
    g.innerHTML = `<h2>${c}</h2>`;
    for (const t of TRICKS.filter((x) => x.cat === c)) {
      const b = document.createElement('button');
      b.className = 'trick'; b.dataset.id = t.id;
      b.setAttribute('aria-pressed', String(t === state.trick));
      b.innerHTML = `<b>${t.name}</b><span>${trickSub(t)}</span>`;
      b.onclick = () => { state.trick = t; state.t = 0; state.playing = false; syncPlay(); markPanel(); rebuild(); };
      g.appendChild(b);
    }
    list.appendChild(g);
  }
  seg('jumpSeg', Object.entries(JUMPS).map(([k, J]) => [k, J.label]), () => state.jump, (k) => { state.jump = k; rebuild({ worldChanged: true }); });
  seg('camSeg', [['chase', 'Behind'], ['side', 'Side'], ['orbit', 'Free']], () => state.cam, setCam);
  seg('speedSeg', [[0.1, '0.1×'], [0.25, '¼×'], [0.5, '½×'], [1, '1×']], () => state.speed, (v) => { state.speed = v; });
  $('seqToggle').checked = state.seq;
  $('seqToggle').onchange = (e) => { state.seq = e.target.checked; drawGhosts(); };
}
function markPanel() {
  for (const b of document.querySelectorAll('.trick')) b.setAttribute('aria-pressed', String(b.dataset.id === state.trick.id));
}
function seg(id, items, get, set) {
  const el = $(id);
  el.querySelectorAll('button').forEach((b) => b.remove());
  for (const [v, label] of items) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.setAttribute('aria-pressed', String(get() === v));
    b.onclick = () => { set(v); el.querySelectorAll('button').forEach((x, i) => x.setAttribute('aria-pressed', String(items[i][0] === v))); };
    el.appendChild(b);
  }
}
function setCam(c) {
  state.cam = c;
  controls.enabled = c === 'orbit';
  snapCamera = true;
  seg('camSeg', [['chase', 'Behind'], ['side', 'Side'], ['orbit', 'Free']], () => state.cam, setCam);
}

function drawInfo() {
  const t = state.trick, s = run.stats;
  $('trickName').textContent = t.name;
  $('trickExplain').textContent = explain(t);
  document.title = `${t.name} – Ski Trick Visualizer`;
  const rows = [
    ['Airtime', `${s.airtime.toFixed(2)} s`],
    ['Take-off speed', `${Math.round(s.takeoffKmh)} km/h`],
    ['Peak above deck', `${s.maxHeight.toFixed(1)} m`],
    ['Landing distance', `${s.distance.toFixed(0)} m`],
    ['Rotation needed', `${Math.round(s.avgRate)}°/s`],
  ];
  let html = rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
  if (s.avgRate > 950) html += `<p class="note">Very fast for this jump size. Riders usually pick a bigger jump for this one.</p>`;
  $('runStats').innerHTML = html;
}

// ---------------------------------------------------------------- UI: timeline
const track = $('track');
function drawTimeline() {
  const d = run.duration;
  track.style.setProperty('--sec', `${(1 / d) * 100}%`);
  const air = $('airBand');
  air.style.left = `${(run.ev.tLip / d) * 100}%`;
  air.style.width = `${(run.ev.airtime / d) * 100}%`;
  const marks = $('marks');
  marks.innerHTML = '';
  run.marks.forEach((m, i) => {
    const el = document.createElement('div');
    el.className = `mark ${i % 2 ? 'down' : 'up'}`;
    el.style.left = `${(m.t / d) * 100}%`;
    el.innerHTML = `<span>${m.label}</span>`;
    el.title = `${m.label} at ${m.t.toFixed(2)} s`;
    marks.appendChild(el);
  });
  declutterMarks();
}
// Hide a label when it would overlap the previous label on the same row; the tick stays.
function declutterMarks() {
  const lastRight = { up: -Infinity, down: -Infinity };
  for (const el of $('marks').children) {
    const row = el.classList.contains('up') ? 'up' : 'down';
    const span = el.firstChild;
    span.style.visibility = '';
    const r = span.getBoundingClientRect();
    if (r.left < lastRight[row] + 6) span.style.visibility = 'hidden';
    else lastRight[row] = r.right;
  }
}
function scrubTo(clientX) {
  const r = track.getBoundingClientRect();
  state.t = Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * run.duration;
  state.playing = false; syncPlay();
}
track.addEventListener('pointerdown', (e) => { track.setPointerCapture(e.pointerId); scrubTo(e.clientX); });
track.addEventListener('pointermove', (e) => { if (track.hasPointerCapture(e.pointerId)) scrubTo(e.clientX); });

function syncPlay() {
  $('playIcon').setAttribute('d', state.playing ? 'M6 4h4v16H6zM14 4h4v16h-4z' : 'M7 4l13 8-13 8z');
  $('playBtn').setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
}
function togglePlay() {
  if (!state.playing && state.t >= run.duration - 1e-3) state.t = 0;
  state.playing = !state.playing; syncPlay();
}
$('playBtn').onclick = togglePlay;

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
  const frame = 1 / 30;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); state.playing = false; syncPlay(); state.t = Math.min(run.duration, state.t + (e.shiftKey ? 0.25 : frame)); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); state.playing = false; syncPlay(); state.t = Math.max(0, state.t - (e.shiftKey ? 0.25 : frame)); }
  else if (e.key === '1') setCam('chase');
  else if (e.key === '2') setCam('side');
  else if (e.key === '3') setCam('orbit');
  else if (e.key.toLowerCase() === 's') { state.seq = !state.seq; $('seqToggle').checked = state.seq; drawGhosts(); }
});

// ---------------------------------------------------------------- camera
let snapCamera = true;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function updateCamera(s, dt) {
  const h = s.hips;
  let wantPos, wantLook;
  if (state.cam === 'chase') {
    wantPos = new THREE.Vector3(h.x + 1.6, h.y + 2.6, h.z - 8.5);
    wantLook = new THREE.Vector3(h.x, h.y + 0.2, h.z + 5);
  } else if (state.cam === 'side') {
    // Stay above the hillside and the netting, whatever the rider's height.
    const dist = { small: 13, medium: 19, big: 26 }[state.jump];
    const cx = h.x + dist, cz = h.z - 2;
    wantPos = new THREE.Vector3(cx, Math.max(h.y + 2, env.heightAt(cx, cz) + 3.5), cz);
    wantLook = new THREE.Vector3(h.x, h.y, h.z + 1);
  } else {
    // Free camera: keep the orbit target on the rider and move the camera with it.
    const delta = h.clone().sub(controls.target);
    if (snapCamera) { camera.position.set(h.x + 6, h.y + 3, h.z - 7); controls.target.copy(h); snapCamera = false; }
    else { controls.target.add(delta); camera.position.add(delta); }
    controls.update();
    return;
  }
  const k = snapCamera ? 1 : 1 - Math.exp(-dt * 7);
  camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
  snapCamera = false;
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ---------------------------------------------------------------- readout
function updateReadout(s) {
  $('rTime').textContent = s.t.toFixed(2);
  $('rHeight').textContent = Math.max(0, s.heightAboveSnow).toFixed(1);
  $('rSpeed').textContent = Math.round(s.speed * 3.6);
  $('rSpin').textContent = Math.round(state.trick.spin * s.u);
  $('rFlip').textContent = Math.round(Math.abs(state.trick.flips) * 360 * s.u);
  $('rInverted').hidden = !s.inverted;
  const d = run.duration;
  $('head').style.left = `${(s.t / d) * 100}%`;
  $('headTime').textContent = `${s.t.toFixed(2)} s`;
  track.setAttribute('aria-valuenow', (s.t / d).toFixed(3));
  const live = [...run.marks].reverse().find((m) => s.t >= m.t - 1e-6);
  track.setAttribute('aria-valuetext', `${s.t.toFixed(2)} seconds, ${live ? live.label : ''}`);
}

// ---------------------------------------------------------------- loop
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', () => { resize(); declutterMarks(); });

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state.playing) {
    state.t += dt * state.speed;
    if (state.t >= run.duration) { state.t = run.duration; state.playing = false; syncPlay(); }
  }
  const s = run.sample(state.t);
  rider.set(s);
  updateCamera(s, dt);
  sun.position.copy(s.hips).addScaledVector(sunDir, 60);
  sun.target.position.copy(s.hips);
  updateReadout(s);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot
const loader = $('loader');
new GLTFLoader().load('assets/skier.glb', (gltf) => {
  template = gltf.scene;
  rider = makeRider(template);
  scene.add(rider.group);
  drawPanel();
  rebuild({ worldChanged: true });
  resize();
  loader.hidden = true;
  // Expose for debugging and screenshots.
  window.__ski = { state, get run() { return run; }, setT: (t) => { state.t = t; }, setCam, rebuild, renderer, scene, camera };
  requestAnimationFrame(frame);
}, undefined, () => {
  loader.classList.add('error');
  loader.textContent = location.protocol === 'file:'
    ? 'The skier model can’t load from a file on disk. Run a local web server in this folder (python3 -m http.server) and open http://localhost:8000, or use the live site.'
    : 'The skier model didn’t load. Check your connection and reload the page.';
});
