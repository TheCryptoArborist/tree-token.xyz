# Enemy animation polish: r14

Ordinary bats and mutated wasps now use six wing poses instead of two over the same 250ms wingbeat cycle. Curved entries/dives also fold the inside wing through two banking strengths in either direction. The body art, eyes, colors and original up/down wing endpoints are retained. Straight paths use neutral wings; entries settle upright, and return/formation states use neutral banking.

[Watch the before/after MP4](treeforce89-enemy-animation-20261124/before-after.mp4) · [Looping animation](treeforce89-enemy-animation-20261124/before-after.gif) · [Still frame](treeforce89-enemy-animation-20261124/poster.png)

The comparison uses actual generated game textures at 4× scale with identical heading and wingbeat timing on both sides. It is a three-second deterministic sprite comparison, not a full playthrough or performance measurement. The runtime helper is `treeforce89/frontend/game/enemy-animation.mjs`; existing r13 presentation code is retained as its base.

## Scope and preservation

- Only ordinary bats/wasps receive the extra wing poses. Leaders, guardians, challenge targets, corrupted enemies, captors, bosses, hero and non-winged species retain their existing textures.
- Flight banking derives from the curve's local change of heading. It writes only presentation data and selects same-size textures; existing facing, paths, timing, position, collision shapes and game RNG are unchanged.
- Sixty small textures are generated once per texture manager: two species × six wing poses × five bank states. The original textures remain available. No graphics objects are constructed during animation updates.
- The texture size remains 30×22 for bats and 32×28 for wasps. Hit flashes, dive warnings and stun colors remain controlled by the existing feedback layer.
- No impact-effect changes, weapon changes, wallet/payment changes, multichain changes, backend changes or production publication are included.

## Focused verification

Eight unit tests passed: four retained facing/presentation tests and four new wing-cycle, curve-handedness, settling/return and identity/stun tests. Actual-browser checks passed at 320/390/1000px. All **81 sampled flight positions, angles and collision-body measurements** match the corrected r13 baseline exactly; hero texture/dimensions/scale and wing sprite dimensions also match.

All 30 enemy-feedback browser checks pass, including hit-flash duration, warning duration, mutation, special enemies, pause/resume and destroyed callbacks. The browser comparison confirms six pixel-distinct neutral poses for each species and that repeated setup reuses the texture cache. No page errors were observed.

See the JSON evidence and final overlay manifest in [the evidence folder](treeforce89-enemy-animation-20261124/). Phone animation comfort and sustained device performance remain unverified; this polish does not claim complete parity with every Deluxe Galaga animation.

## Incremental build and local review

```sh
node scripts/treeforce-local/prepare-enemy-animation.mjs release/treeforce-integrated-review release/treeforce-enemy-animation
node scripts/treeforce-local/serve.mjs release/treeforce-enemy-animation 4191
node --test tests/treeforce-local/enemy-animation.test.mjs tests/treeforce-local/combat-visuals.test.mjs
TREEFORCE_REVISION=r14 TREEFORCE_URL=http://127.0.0.1:4191 node tests/treeforce-local/combat-visuals-browser.cjs
```

Use a fresh output directory: the preparation script refuses an existing one. It verifies the existing r13 overlay hashes, copies the local review bundle, and adds only the r14 helper and module links. It does not rebuild the website or backend. The local practice allowlist now accepts r14; practice URL is `http://127.0.0.1:4191/__local/practice?lab=1&revision=r14&scene=title`. This is a workspace-local URL, not the hosted phone link.

The existing port-4189 private kit remains the previously approved r13 kit; the r14 animation candidate is separate for visual review. The shared Sui/BNB release still needs reconciliation before integration. Impact-effect identity remains the next separate polish task. This change is saved locally and is not pushed solely to trigger another site-wide CI build.
