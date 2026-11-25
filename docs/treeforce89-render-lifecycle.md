# HD Arborwing lifecycle validation

Continuation of local rendering prototype `d18d5b5`, on isolated branch `dev/treeforce-arborwing-hd`. No deployed files, economy, wallet integration or backend changes. No Netlify builds or deployments.

## Scope

`tests/treeforce-render-lifecycle.cjs` exercises the real scene methods in controlled unranked fixtures. External traffic and all non-GET requests are blocked. Normal update and physics movement are suspended to isolate transitions, while the scene clock dispatches the actual reserve-deployment callback. These are integration checks, not complete human playthroughs.

The cases are standard desktop, HD desktop (1920×1080), and mobile (390×844). For each:

- All five player frames retain their logical dimensions and stage-specific body geometry. Only stage zero uses the new atlas; stages 1–4 retain their original texture source.
- Capture at each of the five stages removes one of three lives, hides/disables the active player, and creates the correctly framed tinted captive.
- The delayed reserve callback restores the stage-zero player and body. A forced rescue window permits the actual rescue handler to create an untinted matching wing and add the existing 2,500-point rescue bonus.
- Growing through stages 1–4 updates both rescued and active wing frames together. Damage steps the active player back through stages 3–0.
- Scene restart restores three lives and stage zero without adding texture sources or changing the expected drawing buffer.
- Desktop standard and HD geometry and transition traces match exactly.

Screenshots and machine-readable measurements are in `treeforce89-render-lifecycle/`. Capture timing is not identical across modes: the temporary invulnerability blink and moving enemies can differ between images.

## Remaining release work

The first-stage art is sharper; later stages still use their original lower-resolution artwork. A consistent upgrade of those stages remains an art task, not a demonstrated logic defect. Real desktop GPU performance and a phone smoke test remain necessary before recommending production use. Offscreen effect/render-target coverage and a complete fresh-game teardown/recreation test are not established by a scene restart check.

## Results

All three lifecycle cases passed, with 15 capture/reserve/rescue cycles total, matching desktop traces and no page errors. No game-code changes were needed for these scenarios.

`node tests/treeforce-render-recovery.cjs` also passed simulated WebGL context loss/restoration in standard and HD desktop modes. Both recovered the expected buffer and viewport, retained the stage-zero texture source and active player, and produced visible game/hero screenshots without page errors. The captures were visually inspected.

An eight-second requestAnimationFrame sample before context loss used **SwiftShader software rendering**, not a hardware GPU. Standard: 113 intervals, median 49.9ms, p95 583.3ms. HD: 32 intervals, median 150.1ms, p95 1433.3ms. Both runs are slow and this single sequential sample is not a controlled hardware benchmark; however, HD clearly cost more in this environment. These numbers must not be presented as proof of acceptable performance. The sample measures browser frame intervals rather than GPU render time.

The appropriate next implementation task is a bounded standard-resolution fallback/quality policy for slower desktops, preserving the sharper option where performance supports it. Real desktop smoothness testing remains outstanding. Do not enable HD unconditionally in production based on these results.

Reproduce with the existing localhost port-4206 preview running:

```sh
node tests/treeforce-render-lifecycle.cjs
node tests/treeforce-render-recovery.cjs
```

Both test files passed syntax checks; `git diff --check` passed. No payments, saves, real wallet sessions or production operations were performed.
