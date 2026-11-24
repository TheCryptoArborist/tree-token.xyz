# PR #306 code review and input correction

This pass reviewed the frontend helpers, overlay anchors and preserved runtime paths for audio ownership/cleanup, mobile input, reward presentation, enemy presentation and build provenance. It is a self-review with automated browser reproduction, not an independent approval or real-phone certification.

## Reproduced finding: releasing Fire cancelled another finger's steering

At the previous PR head `a7da94c`, hold one touch on the playfield, hold a second touch on Fire, then release only Fire. The r13 toolbar boundary cleared **all** game touch state on release. The first finger was still physically held, but steering stopped.

Chromium's multi-touch input reproduced the sequence: both held gave `drag=true, fire=true`; releasing Fire gave `drag=false, fire=false`; moving the remaining touch left the hero at x=240. With the correction, releasing Fire gives `drag=true, fire=false`, and moving the still-held touch moves the hero from x=240 to approximately x=264.62. Releasing all touches then ends steering.

`isolateTouchbarInput` still stops down/move/click/keydown events from reaching both the toolbar and Phaser. It lets release/cancel/keyup events propagate so Phaser can retire the matching input. The Fire button continues to own its own pointer release/cancel. An outside-canvas mouseup also explicitly clears **only** Phaser's mouse fire pointer (ID 0); this preserves release-over-toolbar cleanup without cancelling another touch's steering.

The old regression manually assigned a scene pointer ID without creating a corresponding Phaser pointer. It now uses an actual browser mouse press/release. A separate multi-touch test uses Chromium input dispatch with two independent touch IDs and checks movement after releasing Fire. Both tests are included in the combined runner.

## Review conclusions and scope

- Audio lifecycle code owns its scheduler, nodes and context; the existing pause/blur/mute/destroy checks remain applicable. No audio composition change was made here.
- Enemy pose/facing and reward-card helpers retain their presentation scope. Scoring and paid-continue restoration remain in the original runtime; this correction does not alter them.
- Overlay builds verify captured bytes and use exact replacement anchors. The generated game still requires the reconciled captured baseline; these scripts are not a complete production release pipeline.
- The prior boss-position tradeoff remains: approximately 0.21 seconds less straight-shot travel. Real-phone dodge comfort is still unverified.
- No other actionable defect was established in this bounded review. This is not a claim that all device behavior or the complete live backend has been certified.

## Verification and artifacts

All 13 jobs in the final combined runner passed, including the new multi-touch regression. [Final results](treeforce89-code-review-20261124/suite-results.json), browser reports and logs are retained together. Tests use local Chromium, simulated wallet/API responses, and no real payments or live score writes. The final candidate was rebuilt after the input correction; [build hashes](treeforce89-code-review-20261124/review.json) distinguish it from the original r13 artifacts despite retained local module filenames.

The updated private kit is `/workspace/treeforce89-phone-review-20261124.zip`; [kit integrity record](treeforce89-code-review-20261124/kit.json) records its size, SHA-256 and 37 verified archived file hashes. It supersedes the earlier `/workspace/treeforce89-phone-review-r13.zip`, which contains the old input behavior. Run it using the existing extraction/Node/same-Wi-Fi instructions. The kit remains unranked private practice and cannot validate authenticated Slush, real saves or native receipt sharing.

The original evidence folders remain unchanged as historical results. Production, backend functions/schedules, wallet/SDK dependencies, access/pricing rules, lives, continue cost/semantics, achievements and tournament status are unchanged. PR #306 remains a draft; physical-device review and any production release remain separate next steps.
