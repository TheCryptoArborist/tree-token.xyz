# Disabled endpoint candidate verification

`create-bnb-run-candidate.mjs` consumes the committed preservation plan and the
exact hosted ZIP from run 45340749351. It rechecks source/dependency hashes and
the current production baseline before creating one new inactive deployment.
It permits uploading only the reviewed new function; static files, existing
functions, edge functions and server bundles must already be available unchanged.

The candidate has no publication, lock, restore, environment or database write
operation. The shared production-preservation queue serializes this work with
Tree Army and other releases. Baseline drift is a stop condition, not permission
to overwrite newer production. A failed run with a recorded candidate ID must be
inspected; do not blindly rerun creation after any upload or verification failure.

The checker verifies all static digests, complete old provider records, schedules
and runtime. It pins the new function's complete provider record and checks Node
24/stream/bootstrap, exact route and rate limit metadata. Wallet-free GET/POST
requests must return 503 `review-disabled`, false gameplay, no-store, no session
cookie and no CORS grant. The existing auth endpoint must retain its expected
origin denial on the candidate host. These are server smoke checks; users must
not connect wallets on a preview origin. No off-domain wallet preview is offered.

Fifty local tests cover the candidate/planning/runtime/HTTP/coordinator paths.
Merged-source contract CI 45346036595 also passed. Hosted evidence belongs in
this directory only after the candidate and unchanged production checks pass.
The next review concerns switching that exact verified disabled candidate;
database migration, enablement, sales, deposits and gameplay remain separate.

During candidate preparation, the queued Tree Army arm-proportions release
advanced production to `6b053a10d32f94ea6fc35ef1`. The older plan was not used
to overwrite it; preparation was repeated against the new locked baseline.

## Verified inactive candidate

Candidate `6b053b8285e0ee251b84ad06` is ready, unpublished and unlocked.
[Run 45347567727](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45347567727)
passed all checks; `verified.json` pins its full new provider record and HTTP
results. Independent provider reads confirmed the candidate has 61 functions
and five schedules while production remains `6b053a10d32f94ea6fc35ef1`.

No wallet interaction is needed. The next decision is publication of this exact
disabled candidate. Before switching, reverify complete baseline/configuration
and candidate records, wait for all pending builds, and reject any drift.
A later live release makes this candidate stale; preserve that release by
preparing a new candidate rather than publishing the old inventory. No SQL or
environment toggle is included.

## Published disabled

The user authorized the next publication step after reviewing the candidate.
Run [45426140480](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45426140480)
published and locked this exact candidate. `published.json` records the successful
canonical checks and unchanged environment/inventory. Independent provider reads
confirmed current/ready/locked, 61 functions and five schedules. The earlier
inactive evidence above describes the preparation state, not the current state.

The next milestone is hosted database readiness and migration review before any
read-only enablement. Retention ownership and hosted permission checks remain
required; gameplay and new-generation custody are not authorized by this release.
Do not rerun candidate creation against the obsolete baseline. Publication code
can audit this already-published candidate without repeating the lock operation.
