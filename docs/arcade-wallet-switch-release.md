# Tree Arcade wallet switching: isolated static release

This release corrects sign-out and account selection on the existing `/play/`
page, including clearing and reloading the monthly progress for the selected
wallet. It uses the existing GitHub Actions Netlify connection because local
credentials are not required or assumed. This document describes a procedure;
it is not evidence that a candidate or production release has been created.

## Scope and current baseline

Preparation is pinned to the observed ready, locked production deployment
`6b0274526be03dc8db2280df` (Root Rage combat refinements). Its observed backend
inventory contains 52 complete records and five schedules. Every run captures
the full current API inventory and refuses to continue if that deployment is no
longer the published, locked baseline. Historical manifests must not replace it.

The earlier preparation pinned `6b026f92f0abc1d08fbc4913`. A concurrent Root Rage
publication advanced the live site, and run `44987061235` correctly stopped at
capture without creating a candidate. The new ready, locked deployment was
checked directly: all 52 complete backend records and five schedules match the
prior capture, and all four wallet-release target assets are unchanged. The
served play HTML differs by an appended existing Arboretum link snippet, with
the wallet integration intact. Preparation now captures the new full inventory
and configuration so every part of that concurrent release is preserved.

Only these four existing assets may change:

| Published path | Committed source |
| --- | --- |
| `/scripts/arcade-daily-growth-play-share.js` | `production/arcade-organization-static/runtime/scripts/arcade-daily-growth-play-share.js` |
| `/assets/arcade/arcade-growth-wallet.js` | `production/arcade-organization-static/runtime/assets/arcade/arcade-growth-wallet.js` |
| `/styles/arcade-organization.css` | `styles/arcade-organization.css` |
| `/scripts/arcade-monthly.js` | `scripts/arcade-monthly.js` |

All four must change. No new static path, substituted source, HTML replacement,
backend package upload, SDK upgrade, database migration or environment mutation
is permitted by the release helper. All other static hashes, complete function
and provider records (including unknown fields), runtime configuration,
schedules, environment fingerprints, build settings and snippet fingerprints
must match the fresh capture before and after publication.

The wrapper imports existing scoped API, runtime, inventory, backend projection,
candidate-identity and build-queue guards. It adds strict complete backend
equality and wallet-specific browser evidence. Existing release helpers and
their scopes remain unchanged. The inherited environment verification covers
API-visible records and IDs; masked secret bytes and unexposed deploy overrides
cannot be independently read by those GET endpoints.

## Workflow and source verification

Workflow: `.github/workflows/arcade-wallet-switch.yml`.

| Phase | Exact branch | Commit markers |
| --- | --- | --- |
| Prepare | `release/arcade-wallet-switch-prepare` | `[prepare arcade wallet switch] [skip netlify]` |
| Publish | `release/arcade-wallet-switch-publish` | `[publish arcade wallet switch] [skip netlify]` |
| Audit | `release/arcade-wallet-switch-audit` | `[audit arcade wallet switch] [skip netlify]` |

Ordinary PRs run verification only. The workflow requires the focused wallet and monthly-identity,
release-preservation, organization and countdown tests to pass before any
release job. Source/control commits use `[skip netlify]` to avoid historical Git
snapshot builds. The shared production-preservation concurrency group serializes
these releases; a final complete Netlify queue scan still blocks publication
until every actual queued Git build is terminal.

## Prepare and review

1. Commit the complete tested fix, helper, workflow and documentation. Push the
   exact source SHA to the prepare branch with its required markers.
2. The workflow captures the current site, verifies source-tree identity,
   assembles the four-asset overlay, creates one new unpublished candidate and
   checks its complete inventory against the capture. Production stays locked.
3. `tests/arcade-wallet-switch-browser.mjs` runs against that candidate's real
   served static assets. `ARCADE_WALLET_LOCAL` must be unset. Synthetic wallets
   and mocked or blocked API writes prevent real sign-ins, check-ins, payments
   or chain transactions. Phone and desktop checks cover all six tabs and the
   requested account transitions.
4. The helper binds the successful browser report to the candidate. The entire
   prepare workflow must finish successfully. Review its screenshots and the
   concrete candidate URL before publishing.

Release records are saved in `.netlify/arcade-wallet-switch/`: `baseline.json`,
`plan.json`, `candidate.json`, `report.json`, each JSON's `.sha256` file, and
`baseline-play.html` (nine files). No secret values, function ZIPs or full site
builds are included. The separate visual artifact contains screenshots and
`.netlify/arcade-wallet-switch-review/browser-review.json`.

The browser report binds `sourceCommit`, `sourceTree`, `candidateId`,
`planSha256`, candidate `origin`, and `checkedAt` after candidate creation. It
must be no more than 24 hours old and include phone and desktop viewport widths,
`noWalletOrPaymentActions: true`, `syntheticWalletOnly: true`, and these checks:

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
  "walletSignOut": true,
  "walletSwitch": true,
  "sameProviderAccountSelection": true,
  "cancelKeepsSignedOut": true,
  "noOldWalletData": true,
  "returnsSignedOut": true
}
```

`noWalletOrPaymentActions` means no real user-wallet or payment operation;
`syntheticWalletOnly` identifies the separate mocked-wallet test evidence.
Record only observed successful checks. Real Slush/mobile acceptance remains
distinct from synthetic browser coverage.

## Publish the exact reviewed candidate

Merge the reviewed source through the normal PR process after required checks
pass. The merged main commit's **entire tree** must equal the prepared source
tree. If code, tests, documentation, or the published baseline changed, prepare
and review a new candidate; do not transplant the old publication record.

Create one control commit directly atop that merged main on the publish branch.
Only `production/arcade-wallet-switch-publish.json` and
`production/arcade-wallet-switch-browser-review.json` may change. The latter is
the actual bound browser report. The control shape is:

```json
{
  "schemaVersion": 1,
  "action": "publish-arcade-wallet-switch",
  "sourceCommit": "EXACT_REVIEWED_40_HEX_COMMIT",
  "sourceTree": "EXACT_REVIEWED_40_HEX_TREE",
  "mainCommit": "EXACT_MERGED_40_HEX_COMMIT",
  "expectedDeploy": "EXACT_LOCKED_24_HEX_BASELINE",
  "candidateId": "EXACT_NEW_24_HEX_CANDIDATE",
  "planSha256": "EXACT_PLAN_64_HEX_DIGEST",
  "candidateRunId": "SUCCESSFUL_PREPARE_RUN_ID",
  "candidateArtifactId": "ORIGINAL_IMMUTABLE_ARTIFACT_ID",
  "candidateArtifactSHA256": "ORIGINAL_ARCHIVE_64_HEX_DIGEST",
  "browserReview": "production/arcade-wallet-switch-browser-review.json"
}
```

The workflow verifies the control commit's exact parent and two-file diff, the
successful original prepare run, branch, workflow path, source SHA, immutable
artifact ID and archive digest. Known failed or unfinished statuses/checks on
the candidate source or merged main block publication; this supplements the
repository's normal required-check merge gates. Extraction accepts only the
nine bounded release records and rejects duplicate paths, symlinks and excessive
sizes.

Before publishing, the helper rechecks baseline/candidate inventories, all
protected configuration, remote main and its whole tree, then waits for every
actual Git build. Only the newly created reviewed candidate's lock endpoint is
called. No restore or unlock endpoint is available. Final checks verify its
published ID, ready/locked state, complete preservation and canonical delivery.

## Interrupted publication and evidence

If a request times out after a lock may have succeeded, inspect the current
published ID before any retry. Use the same exact artifact and candidate in a
two-file control commit on the audit branch, with `action` set to
`audit-arcade-wallet-switch` and its required markers. Audit makes GET requests
only and requires that exact candidate to be published and locked.

After success, preserve the complete release report, source/main/control SHAs,
workflow/artifact identities and truthful candidate/canonical browser evidence
in a separate `[skip netlify]` documentation commit. Update the newest
`production/README.md` section to the observed outcome.
