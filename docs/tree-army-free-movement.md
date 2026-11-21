# Tree Army courtyard movement — Prototype 0.7

The user requested free movement across the battlefield after reviewing the
Army of Darkness references. The inspected fan implementations use horizontal
player movement with terrain/depth placement; this milestone intentionally
extends Tree Army to two-axis movement. No reference code or assets were copied.

- WASD and all four arrow keys move in eight directions. Diagonal vectors are
  normalized, so diagonals do not give a speed advantage.
- A labeled thumb joystick replaces the left/right buttons. Dragging either
  the pad or battlefield supports any direction, a radial dead zone and analog
  speed. Release, cancellation, lost capture, blur, pause and resizing reset it.
- Movement is bounded to the illustrated courtyard floor (world Y 290–390),
  not walls or sky. Hero Y resets at the start of each wave.
- Troops spawn at varied depths and pursue enemies in two dimensions. Enemies
  pursue nearby defenders. Attack range uses ground-plane distance.
- Auto-fire and Cannon aim across depth; swept segment collision rejects
  targets outside the shot path and retains point-blank collision handling.
- Actors, shadows and health bars move together and draw back-to-front by foot
  position. Existing six-frame gaits follow actual two-axis travel distance.

Validation: gameplay regression harness plus vertical keys/touch, normalized
speed, both floor boundaries, interruption cleanup, enemy depth pursuit,
depth-aware melee, angled auto-fire, and off-path projectile misses. Chromium
checks at 1440×1000, 390×844, 320×568 and 844×390 cover joystick, vertical and
diagonal dragging, multi-touch summon/release, all controls in the viewport,
labels, artwork loading, pause, abilities and tutorial. Existing production/
preview build and release-plan checks also pass. Physical-device testing remains
separate from browser touch emulation.

The release replaces only `/play/tree-army/test/index.html`, pinned against the
last published game HTML. It captures and preserves the full current production
inventory, backend packages, schedules, configuration and snippets. Cabinet
media remains the prior gameplay preview; no new assets or dependencies.
