# Tree Arcade attendance forest: isolated static release

This release adds daily check-in counts, a streak countdown and a growing
attendance forest to the existing `/play/` page. Missed attendance can show
embers; rain follows a server-verified recovery, while pending payment stays
pending. It uses the existing GitHub Actions Netlify connection and preserves
the current wallet and recovery payment integrations. This document describes
the release procedure; it does not establish that a candidate or production
release has been created.

## Exact scope and current baseline

Preparation is pinned to the observed ready, locked production deployment
`6b027652b3eb61d8107261d0`, the published wallet-switch fix. Its observed
inventory contains 655 static paths, 52 complete backend/provider records and
five schedules. Each run captures the full current API inventory and refuses
to continue if that deployment is no longer the published, locked baseline.
The counts are observations, not substitutes for complete live inventories.

The only permitted delivery changes are:

| Published path | Committed source | Required change |
| --- | --- | --- |
| `/scripts/arcade-organization.js` | `scripts/arcade-organization.js` | Replace existing bytes |
| `/scripts/arcade-monthly.js` | `scripts/arcade-monthly.js` | Replace existing bytes |
| `/styles/arcade-organization.css` | `styles/arcade-organization.css` | Replace existing bytes |
| `/scripts/arcade-attendance-forest.js` | `scripts/arcade-attendance-forest.js` | Add this one new path |

All three existing assets must change. The forest module must be absent from
the fresh baseline and present in the candidate. The delivered organization
module must import `./arcade-attendance-forest.js`, which resolves to the new
module under `/scripts/`. No other new or replaced path, alternate source,
HTML replacement, backend package upload, SDK upgrade, migration or environment
mutation is allowed. The complete candidate must contain the full baseline
inventory plus exactly the new module.

All other static hashes, complete function/provider records (including unknown
fields), runtime configuration, schedules, environment fingerprints, build
settings and snippet fingerprints must equal the fresh capture before and
after publication. Current wallet bridge and Daily Growth bytes remain in the
preserved static inventory. The helper imports the existing scoped API,
runtime, inventory, candidate identity and Git build-queue guards. It adds exact
complete backend equality, this narrow static scope and forest browser checks;
completed release helpers and their guards remain unchanged.

Environment verification covers API-visible records and IDs. Masked secret
bytes and unexposed overrides cannot be independently read through these GET
endpoints. Historical snapshots are test fixtures and archived material; they
must never become a substitute for the captured live release inventory.

## Workflow and source verification

Workflow: `.github/workflows/arcade-attendance-forest.yml`.

| Phase | Exact branch | Required commit markers |
| --- | --- | --- |
| Prepare | `release/arcade-attendance-forest-prepare` | `[prepare arcade attendance forest] [skip netlify]` |
| Publish | `release/arcade-attendance-forest-publish` | `[publish arcade attendance forest] [skip netlify]` |
| Audit | `release/arcade-attendance-forest-audit` | `[audit arcade attendance forest] [skip netlify]` |

PRs run verification only. Focused checks cover the forest, monthly attendance
events and identity changes, prior wallet account selection, the monthly UI,
UTC deadlines, organization and preservation guards. Source and control
commits use `[skip netlify]` to prevent historical Git snapshot builds.

PR verification uses `tree-arcade-forest-pr-${github.ref}` so unrelated
preservation workflows cannot replace its pending run. Prepare, publication
and audit retain the shared `tree-production-preservation-release` mutex.
Publication additionally scans every Netlify deployment-history page and waits
for all actual queued Git builds to reach a terminal state.

## Prepare and review

1. Commit the complete tested source, helper, workflow and documentation. Push
   that exact SHA to the prepare branch with both required markers.
2. The workflow captures the current site, pins the complete source tree,
   assembles the three replacements and one new module, creates one new
   unpublished candidate and checks its full inventory. Production stays locked.
3. `tests/arcade-attendance-forest-browser.mjs` checks the candidate's actual
   served static assets. It receives `ARCADE_FOREST_ORIGIN`,
   `ARCADE_PLAYWRIGHT_MODULE` and `ARCADE_FOREST_REVIEW_OUTPUT`;
   `ARCADE_FOREST_LOCAL` must be unset. Isolated synthetic wallet/data fixtures
   intercept API writes, including check-in and recovery. No real wallet
   signature, payment or chain transaction is performed.
4. The helper binds successful browser evidence to that exact candidate.
   Review the candidate and its screenshots after the entire prepare workflow
   concludes successfully. A failed run cannot provide publication evidence.

The nine bounded release records in `.netlify/arcade-attendance-forest/` are
`baseline.json`, `plan.json`, `candidate.json`, `report.json`, each JSON's
`.sha256` file, and `baseline-play.html`. They contain no secret values, function
ZIPs or full site build. The separate visual artifact includes screenshots and
`.netlify/arcade-attendance-forest-review/browser-review.json`.

The browser report has `schemaVersion: 1`, `result: "passed"` and binds
`sourceCommit`, `sourceTree`, `candidateId`, `planSha256`, candidate `origin`
and `checkedAt` after creation. Evidence must be current within 24 hours and
include phone (320–430 pixels) and desktop (at least 1024 pixels) widths. It
requires `noWalletOrPaymentActions: true`, `syntheticWalletOnly: true`,
`syntheticDataOnly: true`, and all of these checks:

```json
{
  "games": true,
  "daily": true,
  "campaigns": true,
  "events": true,
  "monthlyProgress": true,
  "badgeCollection": true,
  "mobileLayout": true,
  "noMissingAssets": true,
  "countdownUTC": true,
  "checkinCount": true,
  "streakCountdown": true,
  "growingForest": true,
  "missedDayEmbers": true,
  "verifiedRecoveryRain": true,
  "pendingRecoveryNoRain": true,
  "walletIsolation": true,
  "reducedMotion": true,
  "monthRollover": true,
  "staleProgress": true
}
```

`noWalletOrPaymentActions` means no real wallet or payment operation; the two
synthetic flags identify the mocked identity, attendance and recovery evidence.
Record only observed successful checks. Installed-wallet and physical-device
acceptance remain separate from these tests.

## Publish the reviewed candidate

Merge through normal review after required checks pass. The merged main
commit's entire tree must equal the prepared source tree. If any code, test,
documentation or production baseline changed, prepare and review a new
candidate. Do not transplant a previous candidate's evidence.

Create one control commit directly atop that exact merged main on the publish
branch. It may change only `production/arcade-attendance-forest-publish.json`
and `production/arcade-attendance-forest-browser-review.json`. The review file
is the actual candidate-bound browser report. The control shape is:

```json
{
  "schemaVersion": 1,
  "action": "publish-arcade-attendance-forest",
  "sourceCommit": "EXACT_REVIEWED_40_HEX_COMMIT",
  "sourceTree": "EXACT_REVIEWED_40_HEX_TREE",
  "mainCommit": "EXACT_MERGED_40_HEX_COMMIT",
  "expectedDeploy": "EXACT_LOCKED_24_HEX_BASELINE",
  "candidateId": "EXACT_NEW_24_HEX_CANDIDATE",
  "planSha256": "EXACT_PLAN_64_HEX_DIGEST",
  "candidateRunId": "SUCCESSFUL_PREPARE_RUN_ID",
  "candidateArtifactId": "ORIGINAL_IMMUTABLE_ARTIFACT_ID",
  "candidateArtifactSHA256": "ORIGINAL_ARCHIVE_64_HEX_DIGEST",
  "browserReview": "production/arcade-attendance-forest-browser-review.json"
}
```

The workflow validates the control commit's parent and exact two-file diff,
original successful prepare run, branch, workflow path, source SHA, immutable
artifact ID and archive digest. Failed or unfinished statuses/checks on the
source or merged main block publication, supplementing the normal required
merge checks. Extraction accepts only the nine records and rejects duplicate
paths, symlinks and excessive sizes.

Before publication, the helper rechecks the baseline, complete candidate,
protected configuration, remote main and whole tree; it then waits for every
actual Git build and performs a final queue scan. Only the newly created,
reviewed candidate's lock endpoint can be called. There is no restore or unlock
operation. Final checks verify its published ID, ready/locked state, every
preserved record and the exact canonical bytes of all four delivery assets.

## Interrupted publication and evidence

If a lock request may have succeeded before a timeout, inspect the current
published ID before any retry. Use the same artifact and candidate in a narrow
control commit on the audit branch, with `action: "audit-arcade-attendance-forest"`
and both markers. Audit makes GET requests only and requires that exact
candidate to be the published, locked deployment.

After success, record the complete release report, source/main/control SHAs,
workflow and artifact identities, and truthful candidate/canonical evidence in
a separate `[skip netlify]` documentation commit. Update the newest section of
`production/README.md` with the observed outcome.
