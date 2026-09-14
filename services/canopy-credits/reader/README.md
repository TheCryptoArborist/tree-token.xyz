# Read-only Sui mainnet adapter

Scope: real mainnet metadata and finalized-transaction READS for the isolated CC foundation. No checkout, contract deployment, signing key, database connection, ledger writes or paid infrastructure is activated.

`connectMainnetReader()` returns only `getNetworkIdentity`, `getTreeMetadata`, `getRecentTransactionDigests` and `getFinalizedTransaction`. Its transport permits exactly four Ledger/State read RPC methods and blocks execution, simulation and streaming before transport. The official endpoint is pinned in code; callers cannot supply a URL. Dependencies are isolated here, locked with npm integrity hashes, and installed using `npm ci --ignore-scripts`. The portal/game dependencies are not changed.

The genesis digest is anchored to Mysten's Sui source rather than trusting a 'mainnet' label. Coin type and decimal precision are retrieved from StateService.GetCoinInfo. Transaction fields are requested with explicit protobuf masks. The reader looks up the containing checkpoint and matches the transaction digest, effects digest, contents reference and timestamp before returning finalized=true. Missing status, incomplete events, wrong checkpoint, malformed or unsafe amounts and stale network information fail closed. Only three attempts are made for transient gRPC transport failures, with deadlines and bounded delay.

**Trust boundary:** this is trusted-RPC checkpoint-inclusion validation, not independent verification of validator quorum signatures or recomputation of checkpoint/effects BCS hashes. The public fullnode is adequate for this read-only development milestone, not a high-availability monetary-ingestion deployment. Endpoint trust, additional evidence/verification and operational service requirements must be reviewed before live payments.

`getFinalizedTransaction` retains exact string integer amounts, ordered event indices, JSON inspection data and event BCS. The result matches the existing payment verifier's reader interface. `fields` remains null unless an explicit receipt codec is supplied for its exact event type. No production checkout codec is registered: `checkout::Purchase` is still a proposed event contract. Ordinary successful mainnet transactions cannot be treated as CC purchases merely because they have events. The four reader/payment integration tests use a clearly marked fixture codec, not a deployed Move schema.

Run from the repository root:

```
npm ci --prefix services/canopy-credits/reader --ignore-scripts --no-audit --no-fund
node --test services/canopy-credits/tests/*reader*.test.mjs services/canopy-credits/reader/transport.test.mjs
node services/canopy-credits/reader/smoke.mjs
```

The explicit smoke test makes bounded reads over at most four recent checkpoints/twelve transactions. It does not query the founder's wallet balance or construct payment orders. It prints and saves a timestamped mainnet-read-report.json with actual metadata and sampled transaction identifiers. It fails if no sample with events and balance changes was read, rather than substituting fixture data. A failed transaction retains failed status. Run reports are observations at their stated time, not current market statistics or proof of a Canopy purchase.

Existing ledger schema, approved sales recipient, simulation account/balance, both active preview branches and production remain untouched. All payment execution remains hard disabled. No repeat gameplay test is required for this milestone.

Sources inspected for this adapter:
- https://sdk.mystenlabs.com/sui/clients/grpc
- https://docs.sui.io/operators/exchange-integration
- https://github.com/MystenLabs/sui-apis/tree/main/proto/sui/rpc/v2
- https://github.com/MystenLabs/sui/blob/09bc5893477acc650490465ebf63ceed6630517f/crates/sui-types/src/digests.rs (canonical full mainnet genesis digest)

Remaining payment work: reviewed checkout contract/event codec and transaction builder, actual price policy and metadata binding to live configuration, identity mapping and deployed private ledger, durable ingestion/reconciliation, payer allowlist and aggregate limits, checkpoint recovery/game integration, and security/operations review. This adapter is not automatically wired to any public HTTP route or running game.
