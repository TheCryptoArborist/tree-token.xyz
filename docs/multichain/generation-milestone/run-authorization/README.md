> Follow-up: [durable store and HTTP source](../run-storage/README.md) now implements the storage contract below and passes local PostgreSQL concurrency tests. Neither migration nor endpoint is deployed.

# Isolated session and run review coordinator — source only

The new `scripts/multichain/bnb-run-authorization.mjs` validates existing BNB
identity sessions, fresh generation backing and single-use review tickets.
`contracts/bnb-generation/scripts/run-authorization-adapter.mjs` composes the
existing read-session RPC with the actual generation backing reader. Neither is
imported by a published handler. No endpoint, migration, gameplay, payment,
score or tournament behavior changes.

## Scope and implementation

A caller must supply trusted server dependencies: identity RPC, durable store,
BNB/Sui clients and an explicitly reviewed generation. Never accept these from
an HTTP body. The service hashes the existing identity token before querying
its stored session; checks origin, chain 56, scope, authenticated/revoked flags,
wallet and one-hour expiry bound. It accepts no browser-provided wallet claim.

Issue checks fresh backing for that wallet/generation and rereads the session
before persisting a 32-byte random review-ticket hash. Ticket expiry is at most
60 seconds and no later than session expiry. Raw session/ticket tokens are not
stored. Consume checks ticket/session bindings and expiry, rechecks backing and
session, then requires an atomic store consumption. Only one concurrent consume
may succeed. Ownership loss/redemption after issue prevents consumption. All
successful responses retain **gameplayAuthorized: false**; this is a review
coordinator, not a live game start or paid-action API.

There is no cross-chain atomic lock. Ownership can change after a read. A later
run/score/action integration must recheck at its boundary and define an explicit
in-flight revocation policy. No authorization can be inferred from sign-in or a
cached backing result. Unexpected dependency failures reject the operation.

## Required durable-store contract (not deployed or implemented here)

- `insert(row)`: durable unique hash insertion, returning false on duplicate.
  Enforce server-side lifetime constraints; retain audit data without raw tokens.
- `read(hash)`: retrieve the persisted row or null; never a client-supplied row.
- `consume({hash,sessionHash,wallet,generation,now})`: a single database transaction
  locks both session and ticket, revalidates session authentication/revocation,
  chain, scope, origin, wallet and expiry using trusted server/database time;
  checks ticket scope/chain/session/wallet/generation, issued/expiry bounds and
  consumed=false; marks consumed and returns true exactly once. Every mismatch
  returns false. An in-process mutex or read-then-write is insufficient.

The in-memory test store exists only inside tests to exercise this contract. It
is not a production adapter and does not prove database isolation. Durable
storage/migration, DB race/revocation tests, retention/rate limits and HTTP
cookie/CSRF/body-size/error handling remain a separate review before deployment.
The existing login cookie is scoped to its current API path; do not broaden it
or rewrite authentication without an explicit integration design.

## Validation and reproduction

Node 24 and pinned root dependencies:

```sh
node --test tests/multichain-bnb-run-authorization.test.mjs tests/multichain-bnb-game-access.test.mjs
```

Tests cover one successful review sequence with no game grant, replay, concurrent
consume, expired/revoked sessions, wrong origin/scope/chain, ticket expiry, wrong
session/wallet/generation, revocation racing commit, ownership loss, stale/forged
backing, RPC failure, and the recorded real generation-1 denial. No live wallet,
transaction or database write is used. Hosted CI includes these tests.

## Remaining work

Review and implement durable persistence plus atomic integration tests; then
prepare an isolated HTTP review endpoint with existing session permissions,
rate limiting and strict origin/CSRF handling. Keep gameplay disabled until
explicit private activation and an independently reviewed positive entitlement
test. USDT payments, deposits, public sales, scores and tournaments remain
separate milestones. Capture then-current production before any later release;
never publish the historical root build. No current completed message is repeated.

Validation: **31 focused tests passed**. Hosted [CI 45335995797](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45335995797) passed for source `2d1fc9f`, including the new coordinator tests and existing contract/release checks. No production persistence or endpoint is deployed.
