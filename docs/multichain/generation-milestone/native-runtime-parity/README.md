# Native backend package parity — November 24, 2026

The native `treeforce89-dev` package has now been reproduced **byte-for-byte**
from release commit `bf4537220bb9a9b096cfaab9598fa2cd13556db9` and its committed
locks. Its SHA-256 is
`af1bc6f03de12e0ee77b10cd118ab346e8f5fa3c9e92cb05ee8ed8a264532a63`,
with 1,753,757 bytes. That matches the package digest/size returned by Netlify
for the currently published backend. The exact reconstructed archive is retained
at `production/recovered-function-archives/treeforce89-dev.zip`; never include
this server-side archive in public/static output.

This resolves the earlier **backend source/package identity** gap, not every
production-readiness gate. The hosted database schema, deployed environment
values, frontend parity, wallet flows and coordinated payment cutover have not
been verified by this check. The checker always reports runtime authorization,
database parity and deployability as false. No route, runtime, migration, payment,
wallet integration or production deployment changed.

## Evidence and reproduction

`live-observation.json` records the read-only Netlify connector observation at
ready/locked deploy `6b06476aad525a8e3c5afdf9`, including the full native function
record and five schedules. During this audit another task published
`6b0648c1a375b045129de7b0`; the second read found its native function record
unchanged (`live-recheck.json`). These are focused metadata observations, not a
complete preservation baseline and not permission to replace either deployment.

The historic release manifest `production/treeforce89-scoped-api-manifest.json`
on `feature/treeforce89-leaderboard-achievements` identifies release commit
`bf453722` and the same published package. Its original successful packaging
workflow is GitHub Actions run `42050197557`.

A detached audit worktree was created at `/workspace/tree-native-parity-bf453722`.
Only its ignored dependencies and generated package were created; tracked files
remain clean. The active feature worktree and original checkout are preserved.
To reproduce in a new detached worktree at that commit:

```sh
npm ci --ignore-scripts --no-audit --no-fund --cache /workspace/npm-cache
npm ci --prefix netlify/preview-lib/treeforce89-source --ignore-scripts --no-audit --no-fund --cache /workspace/npm-cache
# Use Node 22, matching the original workflow:
node scripts/prepare-treeforce89-scoped-api.mjs
```

The managed cloud installer initially gave dependency files mode 0600. Both
Node 24.22.3 and Node 22.21.1 produced hash `4fd59cf1…` with those permissions.
The original archive uses mode 0644. Setting only installed dependency files in
the audit worktree to 0644 (0755 for executable files, leaving symlinks alone)
then running Node 22.21.1 reproduced the exact published hash. No source bytes,
lockfile, bundler settings, archive contents or runtime settings were changed to
force a match. ZIP metadata matters to the hash.

`source-comparison.json` records release lock hashes and compares all 11 entries
in the native-session/native-payment provenance lists against released source.
Every pinned file matches, including logout, authentication, restart, gateway,
database selection, paid-continue logic, both SQL migrations, payment contract
and mainnet transaction reader. This is source equality, not proof that those
migrations are the current hosted schema.

From the feature branch, independently check the committed archive and snapshots:

```sh
node scripts/multichain/check-native-runtime-parity.mjs
node --test tests/multichain-native-runtime-parity.test.mjs
```

Nine guard tests pass, including altered ZIP bytes, digest/size/runtime/route/rate
limit mismatches, wrong site and unlocked deployment. The valid fixture is the
actual reproduced archive, not a synthetic package. The required archived preservation check (`npm run verify:backend-source`)
also passed: 38 executable packages, routes and five schedules match the archived
October baseline. That local comparison is not a current-site parity claim.
The native package was then reproduced again with the same exact hash. No
historical root website build was run.

## Gateway integration preparation

The matching source exposes native challenge/session/logout/restart under
`/play/treeforce89/api/`. Its `tree-continue-offer`, `tree-continue` and
`tree-continue-recover` dispatch to the existing native paid-continue service.
The new shared HTTP prepare/activate handlers are still unregistered.

The implementation sequence is now concrete:

1. Inspect the current hosted native schema read-only against the matching SQL
   and check the proposed mappings/claims separately. Establish database identity
   and privileges without modifying data or installing migrations.
2. Build the gateway composition against the verified source: retain native
   challenge/session/logout/restart and current game rules; coordinate both Sui
   and BNB receipts through shared consumption. Do not leave legacy Sui redeem
   enabled alongside a shared grant for the same continue sequence.
3. Supply a trusted runtime/release-policy reader only from independently checked
   evidence. Package equality alone must never enable its production policy.
4. Connect the real frontend credential lifecycle and test wallet switching,
   logout, React teardown, Sui payment recovery, scoring and tournaments. Preserve
   the separately developed game presentation; do not replace it with these
   pinned historical frontend fixtures.
5. Prepare a reviewed migration/release with a newly captured complete inventory.
   Live activation still requires separate review.

No new Sui technical API decision was made; no SDK dependency was changed.

Hosted [CI 45534301720](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45534301720) passed on `7e30582d`, including native archive guards and existing contract, database, HTTP and Phaser/browser regressions.

The subsequent [hosted schema audit](../native-database-audit/README.md) verifies native catalog compatibility through the existing Netlify read-only branch connection. Shared schema/permissions and gateway integration remain the next implementation work.
