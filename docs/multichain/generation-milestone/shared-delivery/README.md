# Shared continue delivery v2 — source milestone

This source-only coordinator gives Sui TREE and BNB USDT payments one durable
consumption record per account/run. It does not enable purchases, restore lives,
change the current Sui game, or deploy a database migration. All responses contain
`restoreAuthorized: false`. The proposed SQL deliberately lives outside migrations.

## Behavior

`importPayment` reads a persisted verified receipt through a trusted server
adapter and retains its actual network, payer, token, amount and recipient. Sui
terms remain 20,000 TREE; BNB terms remain 1 USDT. Account/run/access-wallet binding
must match the authenticated session. Import retries return the same payment ID.

`prepare` requires a freshly checked entitlement and a reviewed zero-lives,
unused-continue checkpoint. Both payment sources compete for one account/run
claim. A page-bound lease lasts at most two minutes and cannot exceed session
expiry. Expired leases may be prepared again using the same payment. Another
payment cannot take over the claim. Both payments remain recorded if a player
has paid twice; the losing payment requires recovery/refund review. No automatic
refund or money movement is implemented.

`activate` rechecks session, entitlement, checkpoint and lease, then records one
consumption and its journal event in the same transaction. Once consumed, retries
return review-required, including after a lost response. This proves at-most-once
durable consumption, not exactly-once browser restoration. A future renderer and
recovery design must handle ambiguous delivery without granting a second continue.

## Reproduce

Use Node 24 and PostgreSQL 17 tools as a non-root user, from the repository root:

```sh
npm ci --ignore-scripts
npm ci --prefix vendor/bnb-continue-store --ignore-scripts --no-audit --no-fund
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-shared-delivery-postgres.mjs
```

For an unpacked PostgreSQL distribution, also set `BNB_PG_SHARE` to its share
folder. The runner creates and removes a disposable localhost database; it does
not accept hosted credentials. `postgres-validation.json` records 16 passing
checks, including 12 competing preparations and 12 competing activation retries,
transaction rollback, lease expiry, revocation, stale entitlement, runtime grants,
and adapters reading both persisted receipt formats. Chain evidence and session
rows are explicit fixtures. These tests do not verify production authentication
or a real payment. GitHub CI runs this checker alongside the existing suite.

## Required integration before release

1. Recover and verify the actual production Sui session/flight authority. The
   inspected upstream identity gateway is preview-only; relabelling it as mainnet
   is rejected. `lockSessionAndFlight` must lock authoritative session and flight
   state on the same database transaction and return current entitlement evidence.
   Its implementation is mandatory and intentionally absent here. If production
   authority remains in another store, design an equivalent atomic revocation and
   consumption boundary rather than claiming SQL fixture locks protect it.
2. Route **both** Sui and BNB consumption through this common claim in a coordinated
   reviewed cutover. The upstream Sui v1 grant function remains unchanged in this
   milestone and must not coexist as a bypass. Reading its verified receipt does
   not mark that old order consumed; independent activation would permit a second
   grant. Preserve current Sui pricing, authentication and player outcomes.
3. Integrate authoritative checkpoint validation, page resume and game restoration,
   with recovery for consumed-but-unconfirmed delivery and unused second payments.
   Test current games, scores and tournaments before any release.
4. Create a reviewed migration and canonical `/play/` wallet flow, then capture a
   fresh complete production inventory before a separately authorized release.

The source scan did not recover the exact published `treeforce89-dev` backend.
No production identity mapping is asserted. This milestone adds no HTTP handler,
public grants, cleanup job, score submission or wallet transaction.
