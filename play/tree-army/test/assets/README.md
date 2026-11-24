# Tree Army illustrated prototype assets

Original artwork generated for TREE Army from the approved November 16, 2026 concept and the supplied TREE Hero identity. No Army of Darkness artwork or code is included.

- `grove-battlefield.webp`: empty scrolling forest fortress and industrial camp, 2172 × 724.
- `forest-army.webp`: transparent sprite atlas, 1774 × 887; three forest unit types with ready/attack poses, a logging bot, and a thorn runner.
- `tree-hero.webp`: transparent four-pose hero atlas, 1263 × 1246; ready, two movement keyframes, and firing.

Source rectangles are explicit in `index.html` because the illustrated figures do not occupy exact uniform grid cells. The same artwork supplies troop portraits. Asset loading must finish before a run can start; failed loading leaves a reload message and the start button disabled.

Animation in this first integration uses pose switching plus slight movement bob/tilt. It is not a full hand-animated walk cycle. The Iron Stump currently uses an enlarged logging-bot sprite; a dedicated boss asset remains future work. Reduced-motion preference disables ambient bob/tilt/firefly motion.

The three WebP files total approximately 1.6 MiB. All URLs are relative to `/play/tree-army/test/`; no new runtime dependencies, wallet connections, payments, backend handlers, or scheduled jobs are introduced.

## Prototype 0.6 gait atlas

`forest-walk.webp` is a 1536 × 1024 transparent atlas with six 256px cells
per row: Seedling, Archer, Guardian, thorn runner. New poses were generated
from the existing forest-army artwork. The user explicitly approved local
sprite processing to remove the generator's unwanted white matte. Cleanup
preserves bright sword/mouth details and removes edge matte contamination.
The runtime uses fixed species scales and ground anchors, with frame selection
based on distance traveled. Idle feet freeze; original attack poses are retained.
Machines retain their original sprite with travel-driven wheel highlights.
This is a six-pose prototype gait, not a skeletal animation rig. The existing
hero artwork and enlarged-machine boss remain unchanged. Reduced motion freezes
the gait frames as well as ambient movement.

## Prototype 0.12 combat parts

`combat-parts.webp` is an original generated 1536×1024 transparent atlas using
our existing hero and machine designs as references. Six explicit source
rectangles supply the hero torso, gun arm, fist arm, machine chassis, articulated
machine arm and saw blade. Arms rotate about shoulders; the blade rotates about
its axle. The original cape and leg rig remain in use. This update does not
claim acceptance of the hero's existing walk cycle. Approved forest troop art
is unchanged. No Army of Darkness sprites, audio or source code are included.

## Prototype 0.14 melee hands

`hero-melee.webp` is an original transparent 1536×1024 two-arm atlas generated
from our TREE hero design: a silver metal fist and a wrist-mounted arborist
chainsaw replacing the fist. No original Army of Darkness art is included.
Both use a shared shoulder scale. The chainsaw has a separate lift/cut/recovery
arc, with chain markers that freeze when paused and are omitted for reduced
motion. The metal fist uses the existing punch timing. The gun rig and troop
assets remain unchanged.
