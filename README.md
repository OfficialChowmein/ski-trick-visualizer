# Ski Trick Visualizer

Interactive 3D tool that shows where a skier's body and limbs should be, moment by moment, through a freestyle trick off a big air jump. Built for learning new tricks.

## Run it

Open `index.html` in a browser. No build step. Three.js r128 loads from cdnjs.

## What it does

- Chase camera behind the skier, from in-run through kicker, air, and landing
- Scrub slider to freeze any moment, plus slow-mo and real-speed playback
- Phase timeline (approach, pop, rotation milestones, spot, land)
- Gauges for muscle load, rotation completed, and height
- Tricks: spins (360 to 1080), flips (backflip, dub backflip), corks (cork 720 to triple cork 1620), misty, rodeo, bio, switch

## Known limits (v1)

- Figure is cylinders and spheres, not a skinned human model
- Seven shared keyframe poses; tricks differ only in rotation, not in body shape
- Cork, bio, misty and rodeo use one Euler rotation, so the axes are approximations, not real off-axis mechanics
- Fixed 1200x600 canvas; not responsive
