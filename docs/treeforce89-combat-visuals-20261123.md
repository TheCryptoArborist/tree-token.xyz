# Task 6: enemy animation and combat contrast

Local review branch `dev/treeforce89-feedback-20261123`, following task 5 commit `e02de15`. The user approved task 5's musical direction; its source and settings are retained. Nothing published. No backend, wallet/SDK, pricing/access, scoring or tournament changes.

## Focused visual changes

Existing entry and dive curves were already present and remain unchanged. Their sprite facing previously used preset tilts unrelated to the direction of travel. `combat-visuals.mjs` now faces sprites along those curves. Formation entries straighten smoothly over their final fifth so they settle upright without snapping. Return-to-formation and captor-specific raid logic retain their existing behavior.

Ordinary bats and mutated wasps have two original wing poses and light silhouette edges, generated once per texture manager. Pose selection is deterministic and does not consume game RNG. Sprite dimensions remain 30×22 for bats and 32×28 for wasps. Special leader, guardian, challenge-target and corrupted identities are excluded from texture swapping. Boss, captor, hero, pickup and projectile art are retained. Existing hit flashes, stun colors and warnings continue to take precedence.

During the game scene only, a subtle dark layer (alpha 0.18) separates combat from forest detail, and foreground foliage alpha drops from 0.48 to 0.22. The forest and hero imagery remain present. Title/background presentation is unchanged. No per-frame graphics objects or new physics objects are created.

## Verification

- Four focused tests passed: tangent direction, deterministic alternating poses, excluded/stunned identities, and smooth entry settling.
- Before/after emitted-engine checks at widths 320, 390 and 1000 sampled bat, borer and spore entry/dive motion. All 81 position/body samples match exactly, including body width/height and center offsets. Facing changed in 72 of those samples. Hero texture, dimensions, scale and y position match.
- Wing pose changes retain sprite dimensions. Existing gold warnings and white flashes remain visible with the new poses. All 30 task 2 presentation regressions also pass, including mutation, boss/captor/stun interactions, repeated hits and pause timing.
- Screenshots inspected at all three widths, with before/after comparison at 390px. These are forced unranked encounters, not complete human playthroughs or phone performance measurements.
- Ten existing wallet/session browser regressions pass at 390px, including expiry recovery, wallet switching, save retry and receipt sharing. No page errors.

Evidence: `treeforce89-combat-r10-checks.json`, `treeforce89-combat-r11-checks.json`, `treeforce89-combat-geometry-comparison.json`, `treeforce89-combat-feedback-regressions.json`, `treeforce89-combat-wallet-browser-390.json`, and matching screenshots.

Remaining phone review: wing readability and rotation comfort in motion, visibility of threats in dense combat/bright surroundings, and rendering performance on lower-powered devices. Axis-aligned Arcade collision bodies remain unchanged; rotated artwork naturally has different visual corners, so real play should still assess perceived hit fairness.

## Local review

```sh
node scripts/treeforce-local/prepare-combat-visuals.mjs /workspace/treeforce-review/release/treeforce-baseline release/treeforce-combat-visuals
node scripts/treeforce-local/serve.mjs release/treeforce-combat-visuals 4185
node --test tests/treeforce-local/combat-visuals.test.mjs
node tests/treeforce-local/combat-visuals-browser.cjs
TREEFORCE_URL=http://127.0.0.1:4185 TREEFORCE_REVISION=r11 node tests/treeforce-local/enemy-feedback-browser.cjs
```

Practice: `http://127.0.0.1:4185/__local/practice?lab=1&revision=r11&scene=title` (local, unranked, no payments or saves). The r11 frontend overlay retains previous modules. It is not a complete production release package; preserve the entire current backend and schedule inventory in any separately authorized release.
