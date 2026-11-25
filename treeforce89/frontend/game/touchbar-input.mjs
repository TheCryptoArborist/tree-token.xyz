// DOM controls must not also trigger Phaser's window-level input handlers.
export function isolateTouchbarInput(bar, releaseMouse) {
  const events = [
    "pointerdown",
    "pointermove",
    "mousedown",
    "mousemove",
    "touchstart",
    "touchmove",
    "click",
    "keydown",
  ];
  // Let release/cancel events reach Phaser so it can retire the matching
  // pointer/key. Clearing all game input here also cancels another finger's
  // steering when the Fire finger lifts. The Fire button owns its own release.
  const stop = (event) => {
    event.stopPropagation();
  };
  for (const type of events) bar.addEventListener(type, stop);
  // Phaser does not always dispatch an outside-canvas mouseup to the scene.
  // Release only its mouse pointer, never another touch's steering/fire state.
  bar.addEventListener("mouseup", releaseMouse);
  return () => {
    for (const type of events) bar.removeEventListener(type, stop);
    bar.removeEventListener("mouseup", releaseMouse);
  };
}
