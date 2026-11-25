# Tree Hero movement and combat study

An isolated FK-02 review viewer for the four-direction Tree Hero assets. Open `index.html` through an HTTP server so the ES module and adjacent JSON can load. The PR preview route is `/play/forestkingdoms/test/animation/`.

## Controls

- Choose Idle/Walk in the review panel, or Strike, Root cast, Hit reaction, or Defeat beside the stage.
- Choose a direction, Play/Pause, Replay from frame one, Step, playback speed, or the optional grid/contact guide.
- Focus the larger canvas and use arrow keys/WASD to move. The canvas also accepts J (Strike), K (Root cast), H (Hit reaction), X (Defeat), and R (Replay). These shortcuts do not intercept typing elsewhere on the page.
- On a phone, use the action buttons and hold the direction pad. Moving cancels the current action, and releasing movement returns to Idle. Selecting an action clears any held movement input.
- Combat and reaction sequences play once and hold the final pose. Step holds a non-looping sequence at its last frame; Replay explicitly starts over. Idle and Walk continue to loop.
- A selected action respects a paused viewer. Reduced-motion users start paused, and selecting a different action or direction remains paused. Play or Replay is an explicit request to animate.

The smaller canvas shows a nominal 88 CSS pixel body height for readability review. Both canvases use the same selected frame.

## Artwork contract

Artwork and frame maps live in `../assets/hero-sprites/`. The viewer loads the unchanged `animations.json` movement map and the separate `combat.json` map. Each action selects its own source sheet, direction-specific body measurement, scale, source rectangle, and relative ground-contact pivot. Combat frame numbers are local to the combat sheet; they never index the movement sheet.

The combat map supplies `strike`, `cast`, `hit`, and `defeat` definitions with `loop: false`. A sequence finishes after all frames have had their configured screen time, and then holds its final frame. The viewer validates both maps and all eight sheets before enabling controls.

Read [the asset notes](../../../../docs/forest-kingdoms/SPRITES_01.md) for the art contract and remaining work. Run the focused playback and manifest checks from this repository with `node --test play/forestkingdoms/test/animation/viewer-check.mjs`.

The viewer is dependency-free Canvas 2D and does not change the original prologue, saves, wallet integration, or game economy. Phaser integration is a subsequent roadmap task.

Additional event and geometry verification: `node --test play/forestkingdoms/test/animation/viewer-events-check.mjs`.
This runs the actual viewer handlers against DOM/Canvas doubles, including reduced motion,
held-key cancellation, pointer release, and all 112 draw rectangles at desktop/phone widths.
It is not a replacement for browser rendering or physical-device testing.
