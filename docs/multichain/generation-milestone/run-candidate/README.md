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
