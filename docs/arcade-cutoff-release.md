# Arcade organization and authoritative month-end cutoff release

This release was published successfully on November 18, 2026. Production is
locked on `6afe0141248c1062e8414ed7`; workflow `44386363937` passed end to end.
The final report is `production/arcade-cutoff-release-20261118.json`, with the
complete published provider/runtime inventory and artifact binding in
`production/arcade-cutoff-deployment-20261118.json`. Read the newest section of
`production/README.md` for observed verification and browser evidence.

The procedure below records how this exact release was prepared and published.
Its old baseline constant and completed control branch are not a reusable
authorization to publish again. A subsequent release requires a fresh capture,
source/candidate review and its own explicit publication control.

## Exact scope

The helper captures the complete **current** Netlify deployment, then replaces
only `/play/index.html` and `/scripts/arcade-monthly.js`. It adds:

- `/scripts/arcade-organization.js`
- `/scripts/arcade-season-deadline.js`
- `/styles/arcade-organization.css`
- `/styles/arcade-season-deadline.css`

Current `/play/` bytes must match the reviewed `baseline.html` after removing
at most the one exact known final Netlify delivery snippet. Candidate HTML must
equal those freshly captured bytes plus the three approved CSS/module imports.
Any concurrent cabinet or other HTML change stops the plan for a source rebase
and review. All other current static paths remain in the complete digest map.
The historical root build and preview-only runtime/transaction guard are never
release inputs.

Only the isolated `arcade-monthly` ZIP may change. The manifest binds the exact
handler/core files and existing vendor lock to its ZIP digest. All other
function records stay identical, including unknown provider fields. The changed
monthly function may receive new package IDs, creation time, size, digest and a
valid 12-digit provider log-account allocation. Netlify's official CLI maps the
compact `a` field to `account_id`; this initial provisioning exception applies
only when the approved monthly ZIP digest actually changes. Its runtime,
memory, regions, routes, rate limit, observability and every other configuration
field remain unchanged. API-materialized overrides are accepted only when equal
to the captured effective setting. The complete raw monthly record is then
pinned and checked again before and after publication, including the allocation
metadata. Every other function's complete record remains exact throughout.

Every schedule and captured runtime setting, site/shared environment record
fingerprint, build setting and site snippet fingerprint is checked again before
and after publication. Counts come from fresh capture, rather than the earlier
616-static/49-backend/five-schedule report. Environment values are not saved in
the release artifact; API-masked values are verifiable only through returned
record metadata and value IDs. Deploy-specific secret overrides are not exposed
by these GET endpoints.

The existing `NETLIFY_AUTH_TOKEN` GitHub Actions secret supplies release access.
The helper does not discover or extract credentials, change settings, apply SQL,
restore old deploys, unlock production, or rebuild unrelated functions.

## Database prerequisite

`production/arcade-cutoff-db-readiness-20261118.json` records an operator's
read-only production SQL verification for project `lehswszuekjqottolmsf`.
It binds exact migration bytes, the applied migration version/name, both live
recovery RPC definition hashes, invoker security, empty search paths, service
role execution grants and browser-role denials. The proof must be committed in
the source and no older than 24 hours when preparing or publishing.

Source migration:
`supabase/migrations/20261118192546_arcade_recovery_month_end_cutoff.sql`.
The provider's applied migration version may differ from that local filename.
The helper verifies the recorded source SHA256 and does not infer DB readiness
from an anonymous endpoint. Public status must separately report
`configuration.recovery.cutoffPolicy = "utc-month-end-v1"` and
`cutoffEffectiveMonth = "2026-11"` while retaining the existing recovery price.

## Prepare before merging

1. Commit the complete feature, tests, release helper/workflow and database
   proof. Include **`[prepare arcade cutoff] [skip netlify]`** in that source
   commit message. The latter prevents a historical Git snapshot build from
   racing a manual release.
2. Push the exact source SHA to **`release/arcade-cutoff-prepare`**. No extra
   trigger commit is necessary. The workflow verifies source, packages only the
   monthly handler, captures the expected current locked baseline, creates a new
   unpublished candidate, and checks its complete inventory and public delivery.
   It cannot publish. Ordinary PR, feature and main pushes cannot publish either.
3. Read the successful workflow summary. It contains the candidate URL, source
   commit and whole-tree hash, baseline ID, plan SHA256, run ID, immutable artifact
   ID and artifact archive SHA256. The artifact holds the complete inventories,
   exact captured HTML, isolated ZIP and integrity-bound release state.
4. Review all six tabs at phone and desktop widths, asset loading and the UTC
   countdown. Do not connect a wallet, sign, pay, check in, recover or mint during
   this review. The production-context candidate uses real backend routes; it is
   separate from the GET-only ordinary PR sandbox.

The expected baseline currently configured in the preparation workflow is
`6afde69b28000c929ce7a0a4`. It must still be the current ready, locked deployment.
A changed live ID or changed current `/play/` bytes requires a new capture and
reviewed source; never bypass the guard to reuse an old inventory.

## Record the review

After reviewing the concrete candidate, create
`production/arcade-cutoff-browser-review.json` with actual evidence:

```json
{
  "schemaVersion": 1,
  "result": "passed",
  "sourceCommit": "EXACT_40_HEX_SOURCE_COMMIT",
  "sourceTree": "EXACT_40_HEX_TREE",
  "candidateId": "EXACT_24_HEX_NEW_CANDIDATE",
  "planSha256": "EXACT_64_HEX_PLAN_DIGEST",
  "origin": "https://EXACT_CANDIDATE--tree-token.netlify.app",
  "checkedAt": "ACTUAL_UTC_ISO_TIMESTAMP",
  "viewportWidths": [390, 1280],
  "checks": {
    "games": true,
    "daily": true,
    "campaigns": true,
    "events": true,
    "monthlyProgress": true,
    "badgeCollection": true,
    "mobileLayout": true,
    "noMissingAssets": true,
    "countdownUTC": true
  },
  "noWalletOrPaymentActions": true
}
```

Use measured viewport widths, truthful checks and a timestamp after candidate
creation. A report for the PR sandbox, canonical site or another source/candidate
does not satisfy the publication gate.

## Publish after review and merge

Merge the reviewed source to main. A merge or squash commit may have a different
commit SHA, but **its entire Git tree must equal the candidate source tree**.
Any intervening content change requires a new candidate. Keep release-control
files off main so they do not change the reviewed application tree.

Create one control commit directly on that exact merged main commit, on branch
**`release/arcade-cutoff-publish`**. It may change only the browser review JSON
above and `production/arcade-cutoff-publish.json`:

```json
{
  "schemaVersion": 1,
  "action": "publish-arcade-cutoff",
  "sourceCommit": "EXACT_REVIEWED_SOURCE_COMMIT",
  "sourceTree": "EXACT_REVIEWED_TREE",
  "mainCommit": "EXACT_MERGED_MAIN_COMMIT",
  "expectedDeploy": "EXACT_CURRENT_LOCKED_BASELINE",
  "candidateId": "EXACT_REVIEWED_NEW_CANDIDATE",
  "planSha256": "EXACT_PLAN_SHA256",
  "candidateRunId": "ORIGINAL_SUCCESSFUL_PREPARE_RUN_ID",
  "candidateArtifactId": "ORIGINAL_IMMUTABLE_ARTIFACT_ID",
  "candidateArtifactSHA256": "ORIGINAL_ARTIFACT_ARCHIVE_SHA256",
  "browserReview": "production/arcade-cutoff-browser-review.json"
}
```

Its commit message must contain **`[publish arcade cutoff] [skip netlify]`**.
The workflow checks the control diff and parent, then checks out the original
candidate source. It verifies the original successful prepare run, source SHA,
branch, workflow path, artifact ID and API digest, and independently hashes the
downloaded ZIP before extracting an exact allowlist of files. It does not rebuild
the monthly package after review.

The helper rechecks source, browser report, DB proof, candidate inventory and
current locked baseline. It waits for **all queued Git builds** to finish, with
only the already-audited, exact historical inactive API records exempted. A
nonterminal or newly queued build blocks publication. Remote main must still
equal the declared merged commit. Only then does it lock/publish that newly
created candidate. Full canonical inventory, configuration, HTML/assets, status
and final lock checks follow. The source candidate must be fixed forward if a
problem is found; no old-deploy restore path exists.

## Finish evidence after a transient publication timeout

A failed post-lock HTTP check can leave the correct new candidate published.
Inspect the actual current deployment before taking another action. Never retry
the lock request blindly.

For an exact candidate-bound **GET-only audit**, create the same two-file control
commit directly on the recorded main commit, on branch
`release/arcade-cutoff-audit`. Use `"action": "audit-arcade-cutoff"` and the
markers **`[audit arcade cutoff] [skip netlify]`**. Reuse the original candidate
artifact/source identity and truthful browser review. The helper accepts only
that exact candidate as the current published, locked deployment, verifies all
inventories/configuration and canonical delivery again, and writes a fresh
report without a remote mutation. An older DB proof may be inspected in this
audit according to its original plan timestamp; it cannot authorize a new
publication.

The CLI exposes the same phases for an already authorized runner with the existing
release token: `capture`, `plan --monthly-manifest ...`, `candidate`,
`verify --browser-report ...`, `publish --expected-candidate ... --main-commit ...`
and `audit --expected-candidate ...`. Capture, plan, verify and audit have explicit
GET-only API guards. The branch-trigger path is provided so an interactive
GitHub “Run workflow” control is not required.
