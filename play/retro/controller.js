// Short clicks must survive until the NES has actually read a few frames.
export function createButtonLatch(nes, minimumFrames = 3) {
  const buttons = new Map();
  let frame = 0;
  return {
    press(number, source) {
      let button = buttons.get(number);
      if (!button) {
        button = { sources: new Set(), releaseAfter: frame + minimumFrames };
        buttons.set(number, button);
        nes.buttonDown(1, number);
      }
      if (!button.sources.has(source)) {
        button.sources.add(source);
        button.releaseAfter = frame + minimumFrames;
      }
    },
    release(number, source, cancel = false) {
      const button = buttons.get(number);
      if (!button || !button.sources.delete(source) || button.sources.size) return;
      if (cancel || frame >= button.releaseAfter) {
        nes.buttonUp(1, number);
        buttons.delete(number);
      }
    },
    afterFrame() {
      frame++;
      for (const [number, button] of buttons) {
        if (!button.sources.size && frame >= button.releaseAfter) {
          nes.buttonUp(1, number);
          buttons.delete(number);
        }
      }
    },
    releaseAll() {
      for (const number of buttons.keys()) nes.buttonUp(1, number);
      buttons.clear();
    }
  };
}
