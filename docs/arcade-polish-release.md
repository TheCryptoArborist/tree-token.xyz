# Arcade tab polish: static preservation release

This procedure prepares a new review candidate from the complete current
production inventory. It does not claim that the visual release has been
published. Read the newest `production/README.md` section and the successful
workflow report for the observed production state.

The preparation workflow currently requires locked production deployment
`6afe4d06ab2e466f455605db`. Its last verified inventory contains 625 static paths,
50 backend records and five schedules. Those counts describe the starting point;
the helper captures and verifies the complete live inventory afresh.

The November countdown styling is already on the current locked site and is unchanged in this release. This release combines the merged Campaigns and Daily tab polish.

## Approved scope

Exactly these existing public assets change:

| Public path | Committed source | Purpose |
| --- | --- | --- |
| `/styles/arcade-organization.css` | `styles/arcade-organization.css` | Compact Daily status, check-in and quest panels; preserve the Campaigns spotlight layout |
| `/scripts/arcade-organization.js` | `scripts/arcade-organization.js` | Campaigns presentation plus routine Daily success-message suppression |

The helper requires both approved presentation changes. It rejects a new static path, a missing
overlay, a source substitution or an unapproved upload. `/play/index.html`,
the monthly and countdown JavaScript, wallet code and every other static digest
remain unchanged. Campaign configuration, validation, dry-run code and related
documents may exist in the reviewed Git tree, but cannot enter this release's
static payload. No funded campaign is activated by this release.

All 50 complete backend records must remain equal to the fresh capture,
including the monthly function's package identities, provider account, creation
time, digest, size, routes, observability, unknown provider fields and memory and
region overrides. No backend upload is allowed. No function is packaged, no
dependency is installed for deployment, and no database migration runs.
The separate verification job installs the existing isolated lock to run the
DOM tests; it produces no deployment package and changes no dependency version.

The implementation reuses the previous cutoff release's API scoping, backend
validation and configuration projection, new-candidate identity, candidate
browser review, and all-build queue guards. The new wrapper adds strict complete
backend equality; it does not alter or weaken the historical helper.

Every schedule, captured runtime setting, site/shared environment fingerprint,
build setting and site snippet fingerprint is checked before and after
publication. Secret values are not saved. The environment API exposes masked
secret records and value IDs; deploy-specific secret overrides are not exposed
by these GET endpoints. Those existing verification limits remain unchanged.

## Workflow entry points

Workflow: `.github/workflows/publish-arcade-polish.yml`.

| Phase | Exact branch | Required commit markers | Remote effect |
| --- | --- | --- | --- |
| Prepare | `release/arcade-polish-prepare` | `[prepare arcade polish] [skip netlify]` | Create and verify one new unpublished candidate |
| Publish | `release/arcade-polish-publish` | `[publish arcade polish] [skip netlify]` | Publish and lock only the exact reviewed candidate |
| Audit | `release/arcade-polish-audit` | `[audit arcade polish] [skip netlify]` | GET-only verification of that already-published candidate |

Ordinary PRs run verification. Feature/main pushes and missing release markers
cannot publish through this workflow. Keep `[skip netlify]` in source/control
commit messages to avoid a historical Git snapshot build racing the manual
release. Keep it out of the PR title when an ordinary sandbox preview is needed.

The existing GitHub Actions `NETLIFY_AUTH_TOKEN` secret supplies Netlify access.
The helper reads only that environment variable; it does not locate credentials
on disk. Release artifacts are retained for 30 days. A missing, expired or
unverifiable artifact requires a newly prepared and reviewed candidate.

## 1. Prepare the exact source

1. Commit the complete visual changes, meaningful tests, release helper,
   workflow and this runbook. Include `[prepare arcade polish] [skip netlify]`
   in the source commit message.
2. Push that exact source SHA to `release/arcade-polish-prepare`. No extra
   trigger commit is needed. The workflow tests the source, captures current
   locked production, assembles the exact two-path overlay, creates a new
   candidate and verifies it without publishing.
3. Require the entire workflow to succeed. Its summary gives the candidate URL,
   source commit, whole-tree hash, current baseline, plan SHA256, candidate ID,
   original run ID, immutable artifact ID and archive SHA256.
4. Review the concrete candidate at phone and desktop widths. Check all six
   tabs, Daily's fresh completed versus stale/error states, the unchanged deadline
   layout and game-status labels, asset loading and the UTC countdown.
   Record only checks actually observed.

The candidate uses production backend routes. Do not connect a wallet, sign,
pay, check in, recover or mint during review. The ordinary PR sandbox is GET-only
and useful for early layout work; it is not the preservation candidate and cannot
satisfy the publication review gate.

Preparation stores nine files in `.netlify/arcade-polish/`: `baseline.json`,
`plan.json`, `candidate.json`, `report.json`, their four `.sha256` integrity
files, and the exact `baseline-play.html`. The candidate artifact's root contains
these nine files only. It contains neither an application build nor any function
ZIP. Upload requests for existing backend packages fail closed.

## 2. Record candidate review

After successful candidate browser review, create
`production/arcade-polish-browser-review.json` using actual values:

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

Use measured viewport widths and a timestamp after candidate creation. The
review must be no more than 24 hours old at publication. The source commit,
whole tree, candidate, plan and origin must all match the original preparation
artifact. The report may include additional observations and image references.

## 3. Merge the reviewed tree and publish

Merge the reviewed source into main. The merged commit SHA can differ from the
prepare SHA, but its **entire Git tree must equal the reviewed source tree**.
Any intervening application, test or documentation change requires a new
candidate. Leave the release-control files off main.

Create a single control commit directly on that exact merged main commit, on
`release/arcade-polish-publish`. It may change only the browser review above and
`production/arcade-polish-publish.json`:

```json
{
  "schemaVersion": 1,
  "action": "publish-arcade-polish",
  "sourceCommit": "EXACT_REVIEWED_SOURCE_COMMIT",
  "sourceTree": "EXACT_REVIEWED_TREE",
  "mainCommit": "EXACT_MERGED_MAIN_COMMIT",
  "expectedDeploy": "EXACT_CURRENT_LOCKED_BASELINE",
  "candidateId": "EXACT_REVIEWED_NEW_CANDIDATE",
  "planSha256": "EXACT_PLAN_SHA256",
  "candidateRunId": "ORIGINAL_SUCCESSFUL_PREPARE_RUN_ID",
  "candidateArtifactId": "ORIGINAL_IMMUTABLE_ARTIFACT_ID",
  "candidateArtifactSHA256": "ORIGINAL_ARTIFACT_ARCHIVE_SHA256",
  "browserReview": "production/arcade-polish-browser-review.json"
}
```

The commit message must contain `[publish arcade polish] [skip netlify]`.
Push this control commit to the exact publication branch.

The workflow checks the single parent, two-file diff, complete main tree and
markers before checking out the original candidate source. It then verifies the
original successful prepare run, repository, event, branch, source SHA, workflow
path, artifact ID, artifact API digest and downloaded ZIP SHA256. Extraction
permits exactly the nine bounded release records. It rejects symlinks, duplicate
files, unexpected paths and excessive archive size.

The helper binds the browser report to the downloaded plan and candidate. It
rechecks the complete live baseline, candidate static map, every backend record
and configuration before publication. All queued Git builds must reach a
terminal state. The only exceptions are the exact previously audited inactive
historical API records; an actual Git build has no exception. A fresh queue
scan immediately before publication catches newly queued work.

Remote main must still equal the declared merged commit. Only then can the new
candidate's lock endpoint be called. No restore or unlock endpoint exists in
this helper. The final checks require the exact published candidate ID, ready
state, production lock, complete static/backend/runtime/schedule preservation,
protected configuration and canonical delivery. `/play/` must still match the
captured HTML, and monthly public status must retain the existing recovery
price and November cutoff policy.

## 4. Complete evidence or recover from an interrupted check

Inspect the workflow conclusion and actual current production state. A
post-publication HTTP timeout may occur after the new candidate is already
published. Never retry the lock request blindly, and never restore an old
deployment.

For a GET-only completion audit, create the same two-file control commit directly
on the recorded merged main, on `release/arcade-polish-audit`. Use action
`audit-arcade-polish` and markers `[audit arcade polish] [skip netlify]`. Bind the
same successful preparation artifact and candidate. Supply current, truthful
browser evidence if the original review has expired. The audit accepts only
that candidate as the current published and locked deployment; it performs no
remote writes.

After success, record the complete release report, provider/runtime inventory,
candidate and canonical browser evidence, source/main/control commits, workflow
and artifact identities in a separate documentation commit with `[skip netlify]`.
Update the newest production README section to the observed release state.

## Exact CLI phases for the authorized runner

The workflow uses these commands with the existing secret already supplied as
`NETLIFY_AUTH_TOKEN` and the fresh expected baseline supplied as
`ARCADE_POLISH_EXPECTED_DEPLOY`:

```bash
node scripts/release-arcade-polish.mjs capture
node scripts/release-arcade-polish.mjs plan --source-commit "$SOURCE_SHA"
node scripts/release-arcade-polish.mjs candidate --source-commit "$SOURCE_SHA"
node scripts/release-arcade-polish.mjs verify --source-commit "$SOURCE_SHA"
```

After the exact candidate review and main-tree merge:

```bash
node scripts/release-arcade-polish.mjs verify --source-commit "$SOURCE_SHA" --expected-candidate "$CANDIDATE_ID" --browser-report "$REVIEW_PATH"
node scripts/release-arcade-polish.mjs publish --source-commit "$SOURCE_SHA" --expected-candidate "$CANDIDATE_ID" --main-commit "$MAIN_SHA"
```

The separate GET-only completion command is:

```bash
node scripts/release-arcade-polish.mjs audit --source-commit "$SOURCE_SHA" --expected-candidate "$CANDIDATE_ID" --browser-report "$REVIEW_PATH"
```

`--expected-deploy` can replace the expected-baseline environment variable.
There is no CLI phase named `prepare`; preparation is the workflow sequence of
`capture`, `plan`, `candidate` and `verify`. Local developer tooling without the
existing authorized token is not an alternative release path.
