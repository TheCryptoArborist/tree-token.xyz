# Native Sui payment evidence and shared consumption

The native TREE payment flow now has a source-only evidence recorder separate
from restoration. It uses the exact recovered mainnet transaction reader, pinned
in `upstream/` with source hashes in `provenance.json`. This milestone introduces
no Sui SDK upgrade, native endpoint replacement or deployment.

## Payment recording

`native-sui-payment.mjs` accepts only a session hash, offer ID and transaction
digest. A trusted server reader fetches the transaction; browser-provided chain
evidence is never an input. After the read, the recorder locks the native auth
and offer rows in deterministic order and verifies the authenticated wallet,
database identity, immutable native run mapping, offer checkpoint and time window.

The transaction must be checkpointed and successful on mainnet, sent by the
native Sui wallet, after the offer's checkpoint anchor and within the existing
native time allowance. Treasury balance changes must total at least 20,000 TREE
using the pinned token and six-decimal amount. The original native overpayment
behavior is preserved: excess is recorded but buys no additional continues.
The treasury cannot pay itself.

The native evidence row and a `sui-native-tree` shared payment row commit in one
transaction. No counter advances, redemption is written or restoration granted.
Both rows are immutable to the proposed runtime role. A digest or native offer
cannot be applied to a second purchase. Retries return the same shared payment ID.
Payments already present in native redemptions are refused as unused purchases.

An expired original session may be reconciled through a fresh same-wallet native
login if its payment met the original offer's checkpoint/time rules. Native logout
clears `continue_pending`; that does not erase evidence of a timely payment. The
recorder accepts the expired original offer only while it is still game-over,
uncleared and unredeemed. This records past payment; it does not reopen a quote.
The returned shared payment ID supports the existing paid-run recovery adapter,
which moves the credential lease without granting lives or charging again.

## Consumption

The native source type is distinct from the preview-only `sui-tree` receipt
adapter. Native receipt loading refuses a legacy redemption unless it belongs to
an already recorded shared consumption. Shared activation advances the native
counter and writes the native redemption, shared claim and journal in the same
transaction. Failure rolls everything back. Retries of a consumed claim remain
review-only. The original evidence row persists throughout.

No runtime is enabled here. Existing Sui routes are unchanged. The old endpoint
must be replaced through a reviewed coordinated cutover, not left as an
independent restoration path. Browser restoration still always receives
`restoreAuthorized: false` from this source implementation.

## Tests and reproduction

The expanded native PostgreSQL checker has 33 passing checks (22 earlier
session/recovery checks and 11 additional payment checks). It exercises the exact
pinned reader with synthetic Core API responses, actual native SQL and real local
transactions. Cases include failed effects, wrong digest/sender/token/recipient,
checkpoint/time violations, underpayment, overpayment, 12 verification retries,
cross-offer digest reuse, consumed receipt denial, timely reconciliation after
expiry, fresh-login recovery, evidence immutability and rollback at both evidence
and redemption boundaries. All 17 shared-delivery regressions also pass.

Positive chain responses, production provenance, ownership and checkpoint
validation remain explicitly synthetic. These results are not live SDK/mainnet
compatibility or production package parity evidence.

```sh
npm ci --ignore-scripts
npm ci --prefix vendor/bnb-continue-store --ignore-scripts --no-audit --no-fund
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-sui-session-postgres.mjs
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-shared-delivery-postgres.mjs
```

Use Node 24 and PostgreSQL 17 as a non-root user. Set `BNB_PG_SHARE` for unpacked
binaries. The runner uses a fresh disposable local database and cannot accept
hosted credentials. `schema.sql` is a proposal, outside hosted migrations.

## Remaining work

- Verify current deployed native package, database identity and runtime grants
  against exact source; the recovered historical package hash differs.
- Validate the pinned reader's Core API fields against a known successful mainnet
  transaction and the deployed SDK before enabling a payment endpoint. The
  current Mysten README and previously read access/gRPC references informed the
  review; no network-client API change was needed.
- Connect the native checkpoint/renderer and review consumed-but-unconfirmed
  delivery recovery. No client-reported snapshot is marked independently validated
  by this payment recorder; recording payment and accepting game state are separate.
- Wire authenticated HTTP and canonical `/play/` UI for both payment methods,
  then review migrations and a fresh production-preserving release.

No live transaction, payment, NFT movement, database write, public sale, game,
score, tournament, deployment or existing authentication behavior changed.

Hosted [CI 45526542284](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45526542284) passed on `4addf69`, including all native/shared payment checks and existing regressions. A previous documentation-commit run failed before tests during PostgreSQL startup; the native runner now uses a private Unix socket and preserves startup diagnostics. See `hosted-ci.json`.
