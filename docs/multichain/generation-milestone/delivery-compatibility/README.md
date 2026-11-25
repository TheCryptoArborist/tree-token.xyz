# Delivery integration compatibility result

The attempted next integration uncovered two concrete prerequisites. The current
`tree-paid-delivery.v1` implementation cannot accept the BNB ledger through a thin
adapter, and the inspected identity gateway is not a production Sui session
adapter. Do not call either gap completed or enable payments while they remain.

## Evidence from actual source and PostgreSQL

The source at `23e3f8bc216098121f966d7a11e99535cd350061` was refreshed read-only.
Exact snapshots and SHA-256 provenance are stored in `upstream/` and
`provenance.json`. These are test/reference inputs, never deployment artifacts.
The checker loads the unmodified upstream schema into a disposable database.

Nine compatibility checks passed:

- A valid, checkpoint-reviewed Sui TREE order inserts successfully.
- The actual order constraints separately reject BNB network, one-USDT raw amount,
  BNB treasury and USDT token/decimals. This is not a mocked rejection.
- Delivery cannot prepare without a verified order in its own Sui-specific table.
- Its SQL contains account bindings but no authentication session table.
- Its gateway explicitly accepts `environment:preview` identity and maps only to
  `release-candidate`. The identity implementation stores parent/child sessions in
  a conditional-write key/value store, outside the PostgreSQL transaction.

Consequently, `lockSuiRun` cannot honestly be implemented as a database session
lock using this source. The earlier local ledger tests use explicitly synthetic
session tables; those tests remain valid transaction tests, not proof of an
available production session adapter. Renaming a preview identity to mainnet or
inventing a local session mirror would weaken logout/revocation guarantees.

The existing delivery SQL also binds payment `payer` to the Sui access wallet and
requires exactly 20,000 TREE on Sui. Substituting BNB receipt fields would either
fail its checks or misrepresent the payment. No such substitution was attempted.

## Implemented correction

The durable store's pending output now identifies itself as
`tree-mixed-payment-review.v1`, with `targetDeliveryProtocol:tree-paid-delivery.v1`,
`deliveryCompatible:false`, and an explicit incompatibility reason. It retains
null authorization and false restore permission. A review record is no longer
labelled as though it were a native response from the existing delivery engine.
All 20 ledger database checks still pass after this correction, including the
real-signature coordinator path. No live data, existing Sui function or other
branch was changed.

## Revised implementation sequence

The launch requirement is unchanged: existing Sui holders may pay one BNB USDT
for the same continue without buying another pass. The necessary next source
milestone is a **shared versioned delivery model**, not an alias to v1:

1. Separate the Sui access identity from the payment identity/network. Define
   explicit immutable terms for the existing Sui TREE product and the BNB USDT
   product; preserve each token, decimals, amount, recipient and receipt format.
2. Add one shared account/run/continue consumption record, used by both payment
   paths. Prove that simultaneous Sui and BNB purchases cannot restore twice.
   Do not leave a v1 delivery path bypassing that shared record during rollout.
3. Reuse the existing validated checkpoint, page lease, prepare/activate IDs and
   recovery behavior. Keep a paid receipt separate from permission to restore.
   Cross-chain payment support must not change three lives, one continue per
   eligible unfinished run, scoring or tournament rules.
4. Identify and review the actual production Sui session authority. The live
   `treeforce89-dev` package was among the unrecovered archives in the earlier
   preservation inventory. Its source/runtime mapping must be resolved before a
   replacement is packaged. If session revocation stays in a remote store,
   explicitly redesign/test the concurrency guarantee rather than claiming a
   PostgreSQL lock covers it. Prefer a shared authoritative transaction boundary
   for admission/consumption; do not import browser or preview identity as fact.
5. Implement the typed ledger bridge against that version and identity mapping,
   then test recovery after payment, interruption during restoration, logout,
   ownership loss and mixed-payment races. Only then prepare the canonical wallet
   UI and a separately reviewed private paid acceptance.

These are source/design steps within the requested work. No additional payment,
NFT deposit or wallet action is requested. Production replacement still requires
its normal fresh full-inventory preservation and reviewed release.

## Reproduce

```sh
npm ci --prefix vendor/bnb-continue-store --ignore-scripts --no-audit --no-fund
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-delivery-compatibility-postgres.mjs
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-sui-bnb-continue-postgres.mjs
```

For unpacked binaries, also set `BNB_PG_SHARE`. Both checkers use disposable
localhost databases, no hosted credentials. Upstream snapshots are hash-checked
before execution. `postgres-validation.json` and `ledger-regression.json` retain
the results. CI includes both. The current Mysten skills README was refreshed;
this work introduces no Sui SDK, signature, on-chain read or transaction change.

Hosted [CI 45515841710](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45515841710) passed on `9c8a5f4`, including nine compatibility checks, 20 ledger checks and existing contract/endpoint regressions. Passing means the incompatibility is reproducible and guarded; it does not mean the BNB delivery integration is enabled.
