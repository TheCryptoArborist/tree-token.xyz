# Durable run-review tickets and HTTP factory — not deployed

This source milestone implements the prior coordinator's durable store contract.
The new CLI-created migration `20261124060157_arcade_bnb_run_review.sql` adds one
private RLS-enabled table, a session/time index, and one service-role-only
SECURITY INVOKER RPC with empty search_path. It does not alter existing identity
functions, tables, grants, Sui sessions, payments, scores or tournaments.

## Concurrency and permissions

Issue and consume lock the existing identity session first. The clock is read
after lock acquisition; revoked/expired sessions, mismatched wallet/origin/chain/
scope and wrong generation fail closed. Consume locks the ticket next, checks
expiry again, and updates consumed exactly once. Existing session revocation
updates the same session row, so a consumer waiting behind a committed revocation
is denied. If consumption wins the lock first it precedes revocation; subsequent
operations must recheck the session. No database lock can prevent later chain
ownership changes; review tickets still are not game capabilities.

Only hashed ticket/session identifiers are stored. Tickets live at most 60 seconds
and cannot outlive their session. Five issue attempts that successfully create
tickets per minute per session are allowed, serialized by the session lock.
Replay, duplicate insertion and cross-generation consumption fail. Public/anon/
authenticated roles have no table access or RPC execute grant. The private table
is not added to exposed schemas. Service-role credentials remain server-only.

## HTTP integration

`createGenerationRunReviewHttp` composes the existing identity read RPC, actual
backing reader, durable store and HTTP factory. A dedicated RPC transport accepts
only the new function name, disallows redirects, and enforces a 12-second timeout.
Boolean store success must be literal true, never a truthy error payload.

The proposed path is `/api/arcade-bnb-test/run-review`, beneath the existing login
cookie Path. It requires the exact canonical origin, POST JSON, exactly one valid
existing cookie, no extra body fields, no content encoding, maximum 1024 streamed
body bytes and a trusted server-supplied admission limiter. Actions are only issue
and consume. Responses are no-store, hide dependency errors and ALWAYS force
`gameplayAuthorized:false`. No cookie attributes or identity handler are changed.
No Netlify function/route or browser client has been registered or published.

The admission limiter is mandatory and must be supplied by the eventual deployment
(e.g. reviewed durable edge/IP rate limiting); do not use the tests' always-allow
stub. Database per-session issuance limiting complements rather than replaces it.
No database cleanup job is installed. Set a bounded audit retention/purge policy
before rollout, preserving the existing five schedules.

## Reproduce

Use Node 24 and pinned root dependencies, with local PostgreSQL binaries:

```sh
node --test tests/multichain-bnb-run-http.test.mjs tests/multichain-bnb-run-authorization.test.mjs tests/multichain-bnb-game-access.test.mjs
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-bnb-run-postgres.mjs
```

The DB checker creates/destroys a disposable localhost cluster, clears inherited
PG connection options, accepts no remote URL/credentials, uses independent psql
workers and applies the migrations only there. If binaries are unpacked rather
than installed, set BNB_PG_SHARE to their share/postgresql directory.

**45 HTTP/coordinator/auth tests passed. 11 real PostgreSQL checks passed**, including
12 competing workers with one winner, persisted consumption across connections,
revocation while a consumer waits, database-clock expiry, rate limit, wrong
generation/null action, RLS/invoker/privilege checks, and byte-equivalent existing
identity function definitions/grants before and after migration. Local evidence:
`postgres-validation.json`. Hosted CI includes both suites. These are local DB
and mocked HTTP dependency tests, not a claim of deployed end-to-end acceptance.

Guidance: Supabase skill, current changelog and database-functions docs were read.
Relevant upcoming branch-merge permission change does not affect this local work.
CLI 2.83.0 created the migration; PostgreSQL 17.12 ran local validation. SQL catalog
checks directly verify invoker, RLS and grants in the standalone test cluster;
no hosted advisors or live database operations were performed.

## Remaining review

Review migration, RPC privileges, retention and admission-limiter configuration.
Prepare a production-preserving backend package plus complete HTTP/identity/backing
integration tests before requesting migration/publication approval. Capture the
actual current production baseline, preserve all files/functions/settings and five
schedules; never publish the historical root build. No deployment or live write is
authorized by this source milestone. Positive gameplay, new deposits/purchases,
USDT actions, public sales and tournaments remain separately reviewed steps.
