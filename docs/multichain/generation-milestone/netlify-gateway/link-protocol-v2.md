# Explicit BNB wallet-link protocol isolation

November 24, 2026. Source/tests only. Prior CI 45547286491 passed for b9cba340.
Concurrent inventory/holiday branches were fetched and preserved. No wallet,
chain payment, schema migration or deployment was performed.

The existing BNB coordinator and PostgreSQL store now accept an explicit trusted
`deliveryProtocol` setting: tree-paid-delivery.v1 or tree-paid-delivery.v2. Default
behavior remains v1. Unknown configurations fail. The coordinator requires the
authoritative session to use its configured protocol. The store checks both the
locked authoritative session and stored checkout protocol against its configured
protocol before mutations. The existing signed link message already includes
Delivery protocol; signature bytes and SDK APIs were not changed.

The v2 delivery candidate remains review-only and explicitly requires authenticated
shared import. Setting v2 does not verify native identity, authorize gameplay,
register an endpoint, or make preview IDs into native run IDs. Caller-supplied
session/lock adapters must still use verified native tables and runtime identity.
The production native v2 adapter and full mounted wallet flow are still pending.
Payment terms, receipt verification and existing Sui game behavior are unchanged.

link-protocol-tests.json records 43 unit checks and 21 disposable PostgreSQL
checks for each protocol. Both database variants use actual test-key Sui/EVM
signatures and synthetic chain receipts. A signature over the other protocol's
message is rejected before checkout opening, and a differently configured store
cannot open it. Existing native/shared regression passed 40 checks (Phaser option
was not run for this protocol-only change). CI now exercises both variants.
No real wallet or RPC was called. Test session/flight tables remain fixtures,
not a claim of completed native adapter integration.

```
node --test tests/multichain-sui-bnb-continue.test.mjs
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-sui-bnb-continue-postgres.mjs
BNB_DELIVERY_PROTOCOL=tree-paid-delivery.v2 BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-sui-bnb-continue-postgres.mjs
```

Existing dependency locks remain pinned. Current Mysten README, backend SDK skill
and signing reference were read; evidence includes their hashes. No SDK migration
or production signer was introduced.

The owner's clarified inventory requirement is independent of this continue
payment work: see ../individual-inventory-requirements.md. Every admitted original
and its unique artwork must be tracked separately, with one global active backing
allocation across chains. The collection's described size is 5,000, but admission
requires reconciled object-level evidence; neither the unresolved inventory gap
nor the deployed metadata gap is resolved here. The 250-pass example is not an
approved deposit batch. Existing Sui holders paying a continue allocate no NFT.

Next: implement verified native v2 session/locking adapters and exercise wallet
link -> receipt verification -> shared import/consumption against them. Expanded
custody/metadata, uncertain-payment recovery and preservation publication remain
separate reviewed milestones. Keep live payments/game activation unchanged.
