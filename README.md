# Ski Trick Visualizer

See where a skier's body should be, moment by moment, through freestyle tricks off a jump. Scrub the timeline, freeze any frame, and watch from behind, from the side, or from any angle.

**Live:** https://officialchowmein.github.io/ski-trick-visualizer/

## Run it locally

The page loads a 3D model, which browsers block from `file://`. Serve the folder instead:

```
python3 -m http.server 8000
```

then open http://localhost:8000. Share a specific trick with the URL hash, e.g. `#trick=dc1080&jump=big`.

## Controls

- Drag the timeline to scrub. Space plays and pauses. Left/right arrows step one frame (shift: 0.25 s).
- 1 / 2 / 3: behind, side, free camera. S: show the sequence (ghost frames through the air).
- Pick the jump size: park small, park large, big air.

## What's real and what's estimated

Real (computed, not hand-typed):
- Flight path is projectile motion from the lip speed and angle; touchdown is where that path meets the landing slope. Airtime, distance and peak height come from it.
- Rotation speed follows conservation of angular momentum: the body's moment of inertia is computed from its pose each moment, so tucking spins faster and opening up slows the rotation down.
- Timeline milestones (each 360° of spin, each time the rider goes upside down) are detected from the motion itself.
- Switch take-offs approach backward; tricks land facing the correct way and hold that heading.

Estimated:
- Jump dimensions and take-off speeds are plausible values, not measurements from a real venue.
- Body shapes are hand-authored keyframes. Off-axis tricks are modelled as spin plus a flip about a tilted horizontal axis; real corks vary by rider.
- The "very fast for this jump" note uses a rough threshold, not data.

## How it's built

- `src/sim.js`: terrain, physics, rotation, timing. No drawing, so it runs in Node.
- `src/poses.js`: body shapes as segment directions, plus inertia and hip-height estimates (segment masses from de Leva 1996).
- `src/rig.js`: aims the rigged model's bones at those directions, so any Mixamo-style humanoid works.
- `src/app.js`: Three.js scene, cameras, timeline and UI.
- `tests/sim.test.mjs`: 683 checks across every trick and jump (no dip at the lip, no snaps, inversion counts, upright and correctly facing landings, pose geometry on the real rig). Run `npm install && npm test`.

Three.js 0.170 from jsdelivr. Sky from three.js addons.

## Model and licensing

`assets/skier.glb` is the "Xbot" character from the three.js examples (a Mixamo character), with its animations stripped. Check Mixamo's terms before any commercial release; swapping in another Mixamo-rigged humanoid needs no code changes.

## History

- v1 (tag `v1`): single-file Three.js r128 build from the Claude.ai artifact era. Cylinder figure, shared poses, Euler rotations.
- v2: rigged human model, real physics, honest readouts, side and free cameras, sequence view, responsive layout.
