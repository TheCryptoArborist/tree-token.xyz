// DOM controls must not also trigger Phaser's window-level input handlers.
export function isolateTouchbarInput(bar, clearGameInput) {
  const events = [
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointercancel",
    "mousedown",
    "mousemove",
    "mouseup",
    "touchstart",
    "touchmove",
    "touchend",
    "touchcancel",
    "click",
    "keydown",
    "keyup",
  ];
  const ends = new Set([
    "pointerup",
    "pointercancel",
    "mouseup",
    "touchend",
    "touchcancel",
    "keyup",
  ]);
  const stop = (event) => {
    event.stopPropagation();
    if (ends.has(event.type)) clearGameInput();
  };
  for (const type of events) bar.addEventListener(type, stop);
  return () => {
    for (const type of events) bar.removeEventListener(type, stop);
  };
}
