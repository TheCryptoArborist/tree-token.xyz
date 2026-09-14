# Canopy Credits — isolated ledger foundation

Review implementation targeting TREE payments on Sui mainnet. This is NOT a deployed checkout or a live monetary ledger. No testnet setup is required. The existing game preview, central simulation service and 700 test CC are not migrated or modified.

## Components

- `schema.sql`: manually reviewed PostgreSQL schema with account row locks, an append-only integer credit journal, balanced per-lot postings, FIFO purchase/bonus provenance, durable request idempotency, and global receipt uniqueness. Browser roles have no access. Separate internal runtime and ingestion roles prevent the game runtime from issuing credits or modifying prices. The initial 100 CC continue SKU is disabled by default.
- `ledger.mjs`: dependency-injected, parameterized server adapters. No browser route or database credentials. Caller identity must come from an independently reviewed server mapping, not a client-provided account ID. Runtime and ingestion need separate least-privilege connections.
- `mainnet-payment.mjs`: immutable draft order terms, explicit pricing/metadata/recipient/package requirements, integer payment rounding, quote commitments/signatures, and receipt/effects validation. `payable:false`; `beginLiveCheckout()` always throws. No actual signing, publishing or payment execution exists.

The chain-reader interface is a NORMALIZED INTERNAL CONTRACT, not an SDK response schema. Tests supply fictional evidence. The next implementation must supply an independently verified gRPC/GraphQL reader, decode the actual reviewed checkout event, and persist ingestion/reconciliation progress. `checkout::Purchase` is a proposed receipt specification, not a deployed contract. No live TREE metadata, price or transaction is inferred from test fixtures.

## Recovery limits

Reserve -> prepare -> commit with a checkpoint hash -> acknowledge delivery. Undelivered holds/commits can be released/refunded with compensating journal entries. A fresh `recover` command expires outstanding attempts and returns current state; plain balance reads do not sweep. No recovery worker is scheduled here.

After delivery, recovery retains the checkpoint reference and flags review; it does not automatically refund delivered gameplay. Actual checkpoint storage, validation and Phaser resume are NOT implemented. This does not fully solve a browser crash after delivery acknowledgment. A CC reversal is not an on-chain TREE/gas refund.

Idempotent retries return their ORIGINAL result; use a new recovery request to query current state. Issued credits do not expire. No transfer, redemption, arbitrary browser-set charge, or simulation-credit import is supported.

## Tests and isolation

`node --test services/canopy-credits/tests/payment.test.mjs`

`python3 services/canopy-credits/tests/postgres_test.py` requires an EMPTY disposable loopback PostgreSQL database named `canopy_ci`. The workflow `.github/workflows/canopy-ledger-isolated.yml` provisions that database without production secrets. Do not run fixtures against a user database. The schema intentionally fails if already present. No migrations run during Netlify builds.

Local JavaScript checks pass. Final CI outcomes, exact tested commit, and database version are recorded separately in `docs/canopy-credits-ledger-validation.md` once the complete run is verified. Database tests execute against actual PostgreSQL; chain and identity evidence remain fixtures, not live payment tests or an external audit.

## Before any monetary pilot

Still required: production/staging identity mapping and database provisioning, mainnet reader and verified metadata, reviewed checkout package and transaction builder, reviewed TREE pricing, approved recipient/payers, per-order and aggregate caps, pending-payment reconciliation, checkpoint/recovery integration, independent security review, monitoring and backup/restore validation. Production owner separation and credential grants are deployment gates, not satisfied by the test schema alone. A private URL alone is not an access control.

Do not change the active game/portal branches, issue purchased credits, deploy a contract, or send TREE merely to test this foundation. Real purchases require a separately reviewed activation and wallet transaction approval. Simulation acceptance already completed by Peter need not be repeated without a relevant regression.

## References

- https://docs.sui.io/operators/exchange-integration
- https://sdk.mystenlabs.com/sui/clients/grpc
- https://www.postgresql.org/docs/current/explicit-locking.html
- https://www.postgresql.org/docs/current/sql-createtrigger.html
- https://supabase.com/docs/guides/api/securing-your-api
