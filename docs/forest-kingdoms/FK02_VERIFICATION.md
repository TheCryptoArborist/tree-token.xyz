# FK-02 recovery and verification — November 19, 2026

Branch: `feature/forest-kingdoms-prologue`. Recovery branch: `recovery/forest-kingdoms-handoff`.
Recovered checkpoint: `92ef91d8d999b0a7cb4b8e93b86b0377e5925acb` (includes `97fc544` and `6bc9119`).
This verification commit follows that checkpoint; resolve it with `git log -1 --format=%H -- docs/forest-kingdoms/FK02_VERIFICATION.md`.

## Recovery and deployment

- ZIP extracted; both supplied Markdown records read before integration.
- Bundle SHA256 matched `7ab59f44ba4318d69fe1dec9ab8644205a4da496fd55ee04a41a519d9b205f71`; `git bundle verify` passed against the cloned repository.
- Remote was still `d42b360676697f5ddb75ea1b810cfd160c4da544`. Imported the separate recovery branch, inspected the three commits/23 changed paths, fast-forwarded, and pushed normally. No reset or force push.
- Netlify deploy `6aff8c23d80bb9da7189d19d` is ready, context `deploy-preview`, review 239, commit `92ef91d8d999b0a7cb4b8e93b86b0377e5925acb`. The running browser's Netlify drawer identified that same deployment. Its only function is the existing review-data proxy; no schedules.
- [Animation preview](https://deploy-preview-239--tree-token.netlify.app/play/forestkingdoms/test/animation/).
- [Immutable verified deployment](https://6aff8c23d80bb9da7189d19d--tree-token.netlify.app/play/forestkingdoms/test/animation/).
- [Original prologue](https://deploy-preview-239--tree-token.netlify.app/play/forestkingdoms/test/).

## Actual checks

- `node play/forestkingdoms/test/engine-check.mjs`: passed.
- `node --test play/forestkingdoms/test/animation/viewer-check.mjs`: six passed.
- `node --test play/forestkingdoms/test/animation/viewer-events-check.mjs`: five passed.
- `npm run build:preview`: passed; 356 files, 50 pinned current Arcade runtime assets. Viewer, both manifests and eight atlases are explicitly allowlisted.
- Initial Windows build detected CRLF-converted captured bytes. Local `core.autocrlf=false` and restoration of exact HEAD bytes fixed it; no protected source or hash assertion was changed.
- Actual PNG headers and both manifests verified: four 1024×1536 movement atlases, four 1254×1254 combat atlases, 112 in-bounds source rectangles.
- New deterministic tests run the actual viewer handlers with DOM/Canvas doubles. They cover reduced-motion pause/explicit replay, held-key repeats and stale release, pointer up/cancel/lost capture, window blur, and every frame's destination bounds in both canvases at desktop and phone widths.
- Browser: 1440×1000 desktop and 390×844 phone viewport. Selected all six states in all four directions. Reviewed the rendered phone sequences and held endings, desktop direction changes, casting intermediate frames, grid/contact guides, 0.5× selection, Pause, Replay and Step. Direction-pad click/release and canvas arrow-key release returned to Idle; J selected Strike.
- Phone layout had no horizontal overflow (390 viewport, 375 body width including scrollbar allowance); all four direction targets measured 44×44 CSS pixels. Full body/cape and fallen silhouettes remained visible in the reviewed states. Detail and 88 CSS-pixel views used the same pose with fixed standing-body scale.
- Reviewed the Willowmere concept and recovered combat atlases. Preserved all artwork, manifests, original prologue and production configuration byte-for-byte. No reproducible runtime defect requiring a source/art change was established.

## Limits and next action

FK-02 technical recovery, deployment and review checks are complete; Peter's final visual acceptance remains open. This is the first four-frame combat pass, not a claim of final animation polish. The review page scrolls on phones; it is not the future gameplay HUD. Source-quality artwork totals approximately 15.7 MB and has not been optimized or performance-certified.

Reduced motion, simultaneous held-key cancellation and pointer cancellation were verified with automated event doubles; OS reduced-motion browser behavior and real multitouch were not independently exercised. No physical iOS/Android testing is claimed. Physical-device validation remains FK-08.

Next: collect visual feedback on this preview, then FK-03 (isolated Phaser scene and hero connection), verifying current official Phaser 4 documentation and pinning the selected version at that time. No combat/game-state integration or production release occurred.

Current MystenLabs/skills README was checked live for this request; no Sui skill applied to this Canvas-only verification.
