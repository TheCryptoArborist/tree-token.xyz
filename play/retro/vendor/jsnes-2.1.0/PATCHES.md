# TREE runtime patch to JSNES 2.1.0

The Apache-2.0 licensed upstream distribution is modified only in its browser FrameTimer. The NES CPU/PPU/APU, mapper, input, and save-state implementation remain unchanged.

- Stop animation callbacks and delayed frame generation when paused.
- Limit catch-up to three frames per animation callback and discard the accumulated time debt. A long native file dialog must not enqueue thousands of emulated frames.

Upstream source: https://github.com/bfirsh/jsnes/blob/v2.1.0/src/browser/frame-timer.js

Original distribution JS SHA-256: 84946f0dae4bcf3b2dfebe84ad3bfeb1dbcb413bd9b1a69e1f45910a95fd7b41

Exact minified substitutions (each must match once):

```js
// Before
onAnimationFrame=t=>{this.requestAnimationFrame();
// After
onAnimationFrame=t=>{if(!this.running)return;this.requestAnimationFrame();
```

```js
// Before
generateFrame(){this.onGenerateFrame(),this.lastFrameTime+=this.interval}
// After
generateFrame(){this.running&&(this.onGenerateFrame(),this.lastFrameTime+=this.interval)}
```

```js
// Before
let i=Math.round((s-this.lastFrameTime)/this.interval);if(0===i)return;
// After
let i=Math.max(0,Math.min(3,Math.round((s-this.lastFrameTime)/this.interval)));if(0===i)return;this.lastFrameTime=s-i*this.interval;
```

