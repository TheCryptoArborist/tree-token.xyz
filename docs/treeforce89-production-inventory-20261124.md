# Task 1 complete: current production inventory

Captured and independently verified November 24, 2026, **7:57:53 PM America/Chicago** (2026-11-25T01:57:53Z). Current ready/locked deployment: `6b063e9462762ae02c0fd5db`.

- **693 static paths**, each with its Netlify content SHA1.
- **61 complete backend/provider records**, including package digests, provider identity, routes, runtime and configuration fields without normalizing omitted values.
- **Five scheduled functions**, with exact names and cron expressions.
- Production runtime/region fields, **54 site environment records** (all 54 function-scoped), zero returned shared account environment records, build-setting fingerprints, snippet fingerprint and API-visible domain/TLS/access/processing-setting fingerprints.

The snapshot stores environment/configuration hashes and binding metadata, not secret values. Masked secret bytes and deploy-specific environment overrides remain unobservable through these GET endpoints. Static/backend inventory capture records hashes and metadata; it does not download every asset or rebuild/download every backend package. No claim of new native backend source parity is made.

[Baseline](treeforce89-production-inventory-20261124/baseline.json) · [Verification](treeforce89-production-inventory-20261124/verify.json) · [Successful hosted audit](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45529494565)

Canonical baseline SHA256: `3eb73c298fa6aac5bfeae8ba7a4ddc79daef20c0e2cea59a92f13995af48572d`.

## Verification and efficiency

An isolated audit branch reused the existing GitHub Actions Netlify secret connection. The checker permits only GETs to bounded inventory endpoints and requires an explicit current deploy ID. It rejects concurrent publication/lock/configuration drift and verifies all pages of the file listing. Capture checks mutable settings twice; a separate verify invocation reads everything again. All 31 guard tests passed locally and hosted, including unsafe endpoint rejection, function/runtime/schedule drift, paginated files and secret-safe serialization.

The historical 41-function preservation checker remains unchanged. The new isolated current-inventory variant pins 61 functions and adds site-protection/snippet fingerprints. It contains no publication mode. Two lightweight audit runs passed; the second retained the already-sanitized result in logs because direct Azure artifact retrieval returned 403. The downloaded log record was decompressed and its canonical SHA256 independently verified. Artifact provenance and API limitations are recorded beside the baseline.

No full website build, backend rebuild, database mutation, real payment or production publication occurred. The game worktree and other repositories were preserved. The audit source and evidence are retained on `audit/treeforce-inventory-20261125`; operational audit pushes use `[skip netlify]` and no PR was opened solely to trigger a repository-wide preview build.

## Next task

Task 2 can now use this inventory to assemble the complete preserved review candidate. Keep all existing paths and full backend records, check the game-overlay path collisions and recheck production/configuration immediately before candidate preparation. Other chats are actively publishing; this is a verified point-in-time baseline, not permission to replace future changes. Owner phone review and explicit production approval remain later tasks.
