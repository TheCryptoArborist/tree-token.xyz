# Tree Army — Defend the Grove

## November 19, 2026 continuation (America/Chicago)

Branch: `codex/tree-army-continuation`, based on current main `e7a9199`.
The three commits from PR #155 applied without conflicts; no older website
snapshot was merged. See Git history for the exact source revision of this record.

The canonical playtest was fetched before work and still served Prototype 0.2.
The canonical Arcade HTML and its organization module had no Tree Army cabinet;
`reserved-2-title` and `reserved-3-title` were still unused. The organization
module's delivered SHA1 matched current main (`23097fbb79032124017f75ef79dc4381be3646c9`).
Production publication is a separate operation, not implied by this source branch.

## This milestone

Prototype 0.5 retains the original canvas game and illustrated assets from PR #155.
Hero and archer projectiles now emerge from their weapons. The first collision
sweep includes the body-to-muzzle segment so point-blank enemies cannot be skipped.
The existing logic harness tests this regression along with waves, failure,
restart, upgrades, movement and pause.

`/scripts/arcade-tree-army.js` mounts exactly one preview in reserved cabinet 2,
through the existing organization module. It preserves the cabinet title ID and
all other existing controls/links. The native modal provides focus containment,
Escape/Close, focus return, touch controls and pause on close/tab hiding.
The label remains **Coming Soon · In Development**, with **Watch Preview**.
It changes no access, wallet, payment, attendance or reward policy.

## Artwork and capture provenance

- `play/tree-army/test/assets/grove-battlefield.webp`: illustrated environment.
- `play/tree-army/test/assets/forest-army.webp`: explicit troop/enemy atlas rectangles.
- `play/tree-army/test/assets/tree-hero.webp`: supplied hero identity and poses.
- `play/tree-army/preview-gameplay.jpg`: actual browser gameplay screenshot.
- `play/tree-army/preview-gameplay.mp4` and `.webm`: ten-second browser gameplay
  capture, using ordinary keyboard and summon/ability controls. No simulated
  entity placement, health overrides or speed changes. No audio.

The supplied images visually match the illustrated implementation assets.
The separate combined concept is not present as a downloadable attachment in
this workspace. The cabinet therefore uses a clearly identified actual-gameplay
still in the same art direction, not a claim that the concept file was recovered.
The concept's handoff library link/provenance qualification remains unresolved.
`docs/tree-army-illustrated-preview.png` is the earlier implementation preview.

## Run and verify

From repository root, `python3 -m http.server 8765` then open
`http://localhost:8765/play/tree-army/test/`.
Use an isolated Playwright 1.56.1 install; do not change repository dependencies.

```
node tests/tree-army-logic.cjs
node --test tests/tree-army-release.test.mjs
node --check scripts/release-tree-army.mjs
node --check scripts/check-tree-army-page.mjs
TREE_ARMY_TEST_BASE=http://127.0.0.1:8765 node scripts/check-tree-army-page.mjs
TREE_ARMY_TEST_BASE=http://127.0.0.1:8765 TREE_ARMY_CABINET_FIXTURE=1 node scripts/check-tree-army-cabinet.mjs
```

Set `TREE_ARMY_BROWSER_MODULE` to the isolated Playwright `index.mjs`.
The cabinet checker uses full Chromium and tests actual media decoding.
Local fixture mode uses the existing captured Arcade HTML with navigation and
presentation modules only; wallet/progress runtimes are not initialized.
Candidate/canonical checks use the complete delivered page without fixtures.
The release script refuses fixture mode.

Recreate media with `node scripts/capture-tree-army-preview.mjs` (requires ffmpeg).
Playback and capture are real-time; footage may vary between runs.

## Scoped release

The workflow remains main-only for release, with `publish` defaulting to false.
It captures a fresh expected locked deployment and its full static inventory,
backend/runtime records, schedules and configuration fingerprints. Two existing
paths may change, and only at their reviewed prior SHA1s: the playtest HTML and
Arcade organization module. Eight named assets may be added, including both
video formats. Existing additions, stale replacement hashes, missing assets,
unrelated changes and non-static uploads fail closed.

The publisher reuses the repository's current backend comparison, function
configuration, HTML delivery and queued-build checks. All unchanged paths,
complete backend records, runtime settings, five schedules and protected
configuration remain checked before publication and after canonical verification.
The root historical build is never a release payload. No dependency lock changed.

Run the workflow with a freshly inspected `expected_deploy`; any changed baseline
requires reassessment. Record the actual published deploy and canonical browser
results after success. A passing PR check is not publication evidence.

## Remaining work

Pose switching is still used instead of complete walk/attack cycles. Iron Stump
still uses an enlarged logging machine. Unit overlap remains visible in crowded
combat. Dedicated boss art, spacing/animation polish and later-wave balancing
are later milestones. The original combined concept still needs recovery if it
is to replace the gameplay cabinet still. No persistence or score submission.

## Local verification completed

Gameplay browser checks passed at 1440×1000, 390×844, 320×740 and 844×390,
including required-asset failure. Cabinet checks passed at those same viewports:
actual WebM decoding/duration, Enter/Escape, touch open/Close, paused playback,
focus restoration, viewport bounds and no page errors. Desktop and 320px screenshots
were inspected. Both formats are ten seconds; Chromium here cannot decode H.264,
so MP4 was inspected with ffprobe while actual browser playback exercised WebM.
The gameplay logic suite and five preservation-plan tests passed. The 19 existing
Arcade organization assertions passed; JSDOM emitted an asynchronous navigation
observer teardown warning, so this is not claimed as a warning-free suite.

The branch was subsequently rebased onto main `87390ef` without conflicts.
The feature-preview builder now includes the explicit Tree Army delivery files;
without those files its organization-module import failed. After that correction,
Campaigns and synthetic Daily visual checks passed at 390 and 1200px. These remain
review-fixture checks, distinct from candidate/canonical verification.


## Initial release attempt

PR #253 merged as `cdc57627539912719ce9b9da1fbbb1402373732a`. All head CI
checks passed at `70e5c82bd472918e1a76a2b63b3feedfae852001`. Workflow
`44703408350` captured production `6affc81a0ebcfd39b2efbbb0`: 631 static paths,
50 backend records and five schedules. Candidate `6b00064e021da9f2964cba68`
was created, but its first still-preparing API response had no function records.
The full-backend validator correctly rejected that incomplete response, before
publication. The correction waits for ready before validating complete records;
the baseline and all ready-candidate/post-publication checks remain mandatory.
