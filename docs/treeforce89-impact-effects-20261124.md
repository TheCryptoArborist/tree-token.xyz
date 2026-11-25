# Tree Force ’89: localized enemy impact effects

Local r15 review follows r14 commit `347993b` on `dev/treeforce89-feedback-20261123`. The user approved continuing after enemy animation. This is a bounded presentation pass, not a production release or a claim of complete visual parity with Deluxe Galaga.

[Watch before/after motion](treeforce89-impact-effects-20261124/before-after.mp4) · [Animated GIF](treeforce89-impact-effects-20261124/before-after.gif) · [Still](treeforce89-impact-effects-20261124/poster.png)

## Change

Ordinary enemy deaths previously shared the same drifting leaves. Light enemies now emit brief green shards, spores emit softer violet/green dust, and borers emit falling bark chips. Effects stay localized and last at most 513 ms. A per-scene cap of 72 particles bounds simultaneous effects; exceeding it skips a new burst while retaining its random draws. These are visual objects without physics bodies. Existing nonlethal flashes, boss bursts, pickup effects and combat rules are retained.

The incremental builder verifies the r14 overlay hashes and changes only the game entry modules and new effect helper. It reuses the captured assets and installed dependencies without a website or backend rebuild. The helper consumes exactly the previous burst's random ranges, order and counts so effects do not alter subsequent random outcomes.

## Verification

- Three focused unit tests passed: species/counts/random draws; particle cap/recovery; trajectory, lifetime and cleanup bounds.
- Actual emitted r14/r15 game comparison at 390 px passed for bat, borer and spore: nonlethal damage, score, kills, chain, charge, lives, drops and spore splitting match. Both global and seeded game random streams match after these encounters.
- All 30 existing enemy-feedback browser checks passed against r15.
- The effect preview uses the actual old and new helpers in Phaser with controlled time and randomness. Pause freezes progress; completion and resumed completion leave zero preview particles; no page errors. The pause assertion exercises the tween manager because directly updating individual tweens bypasses manager pause.
- Inspected rendered comparison frames and recorded 72 frames at 24 fps. This is a synthetic effect board, not a full playthrough or phone performance measurement.

Evidence is in [the artifact directory](treeforce89-impact-effects-20261124/), including gameplay parity, cleanup, feedback and generated-overlay hash records. Existing broader wallet/audio/control verification is not newly claimed by these focused tests.

## Reproduce locally

```sh
node scripts/treeforce-local/prepare-impact-effects.mjs release/treeforce-enemy-animation release/treeforce-impact-effects
node scripts/treeforce-local/serve.mjs release/treeforce-impact-effects 4192
node --test tests/treeforce-local/impact-effects.test.mjs
```

The builder requires a fresh output directory. Practice: `http://127.0.0.1:4192/__local/practice?lab=1&revision=r15` (local, unranked; no payments or saves). Gameplay parity expects r14 on port 4191 and r15 on 4192. Browser scripts write evidence relative to their working directory; run them in a scratch directory with a `docs` subdirectory.

Remaining: real-phone effect visibility and performance during dense combat, the owner's controls/audio/return checks, and reconciling the separate multichain work before assembling the full preserved release candidate. This local frontend overlay is not a complete production release package. No push, production publication, payment or backend change is part of this task.
