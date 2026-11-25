# Christmas scenery prototype

Local-only first visual pass. No Netlify build, push or deployment.

The r15 game is copied after verifying its recorded changed-file hashes. A single presentation hook activates only for `theme=christmas`. It tints existing forest layers, draws frosted firs and small warm lights at the arena edges, and adds 32 faint snow particles behind combat. Snow uses no game RNG or physics bodies, stops advancing while the game is paused, and is stationary with reduced-motion preference. Scene shutdown removes its update listener.

Normal mode skips the helper. The local comparison page offers Normal / Christmas links. These reload local practice; they are not yet an in-game production selector. The generated output explicitly identifies itself as a local experiment, not a release package.

## Review images

![Christmas at phone width](treeforce89-christmas-preview/christmas-390.png)

[Normal comparison](treeforce89-christmas-preview/normal-390.png) · [Desktop Christmas](treeforce89-christmas-preview/christmas-1000.png)

## Verification

`node tests/treeforce-local/christmas-preview.cjs` passed four browser scenarios: normal and Christmas at 390 and 1000 CSS pixels. All loaded a live player without page errors. Christmas snow was present at depth -2 with no physics body; normal had no snow object. Phone screenshot inspected. These are short synthetic local practice checks, not complete runs or phone performance measurements. Existing wallet/backend behavior was not retested for this scenery-only prototype.

Reproduce:

```sh
node scripts/treeforce-local/prepare-christmas.mjs
node scripts/treeforce-local/serve.mjs release/treeforce-christmas 4195
```

Open `/__local/christmas.html?lab=1&revision=r15&theme=christmas` on that local server. Preparation requires a new output directory and retains the r15 baseline unchanged.

Next: refine the scenery based on review, then festive Arborwing accents and seasonal audio. Those are not implemented in this first scenery study. Production selection and calendar cutoff remain later work. No new badges or award backend are included.
