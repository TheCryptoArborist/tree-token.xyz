# Tree Hero movement study

An isolated FK-02 review viewer for the generated four-direction idle/walking assets. Open `index.html` through an HTTP server so the ES module and adjacent JSON can load. The PR preview route is `/play/forestkingdoms/test/animation/`.

Controls: choose Idle/Walk and a direction; Play/Pause; Step; playback speed; optional grid/contact guide. Focus the larger canvas and use arrow keys/WASD, or hold the on-screen direction pad. The smaller canvas shows a nominal 88 CSS pixel body height for readability review.

Artwork and the JSON frame map live in `../assets/hero-sprites/`. Each direction's frames use explicit source rectangles and relative pivots. Read [the asset notes](../../../../docs/forest-kingdoms/SPRITES_01.md) for the contract and remaining work.

The viewer is dependency-free Canvas 2D and does not change the original prologue, saves, wallet integration, or game economy. Phaser integration is a subsequent roadmap task.
