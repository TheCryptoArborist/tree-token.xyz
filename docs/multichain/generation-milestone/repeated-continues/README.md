# Repeated continues and paid-run recovery

This source milestone extends the undeployed shared v2 model to preserve repeated
continues. One account/run/sequence has one consumption claim across Sui TREE and
BNB USDT. Each subsequent continue requires its own payment and a newly eligible
checkpoint. The existing prices and three-life product are unchanged. Every
response still contains `restoreAuthorized: false`; there is no live renderer.

## Implemented behavior

Payment records carry an immutable positive sequence. Preparation compares that
sequence with the reviewed checkpoint's used-continue count plus one. The native
adapter checks the checkpoint count against the locked native row. Old payments
cannot advance a later sequence, and prepaid future sequences cannot skip ahead.
The inspected preview Sui receipt format has only sequence 1; it is not relabelled
as a native repeated-continue receipt.

Activation requires an explicit trusted `consumeRun` writer; the default denies.
The native writer increments the counter and clears game-over/pending on the
same transaction connection. Shared consumption and its journal commit together
with that update. If any write fails, all changes roll back. A consumed claim is
never reopened, even after an activation response is lost.

For a persisted BNB receipt, activation also changes its checkout to `consumed`.
A database trigger requires the matching shared consumption before that transition
and prevents reopening it. This releases the unresolved payer reservation for a
subsequent checkout without deleting the receipt, pending record or payment
terms. An unconsumed second payment remains reserved for explicit recovery/refund
review; this milestone does not refund or silently reassign money. The signing
policy and durable ledger now require `sequence = continuesUsed + 1` instead of
limiting all checkouts to the first continue.

`native-paid-run-recovery.mjs` handles a fresh native same-wallet login after an
unconsumed payment. It locates the paid run through immutable server mappings,
locks both native rows in deterministic order, verifies current ownership, and
moves the credential lease with the fresh login's original expiry. It neither
extends that expiry nor increments the continue counter. Old credentials cease
to match. Repeating the recovery returns the same run without a second journal
entry. Existing page leases must expire before another page can prepare.

A consumed, stale-sequence or competing payment returns `review-required` without
moving credentials or granting lives. Failed recovery journalling rolls back both
credential updates. Recovery records contain no raw credential or bearer hash.
This is recovery before consumption; consumed-but-unconfirmed browser restoration
still requires the separately reviewed renderer/recovery design.

## Validation

- 22 native PostgreSQL checks: original native logout/identity tests plus mixed
  payment races, three successive continues, skipped/replayed sequences, counter
  rollback, fresh-login recovery, ownership/wallet denial, recovery rollback,
  lease handoff and consumed-payment denial.
- 17 shared PostgreSQL checks: existing concurrency/security tests plus guarded
  BNB settlement, next-sequence checkout and immutable receipt preservation.
- 20 existing durable-ledger PostgreSQL checks remain passing.
- 41 signature/payment-policy tests, including real signatures binding a later
  continue number, pass.

Tests run against disposable PostgreSQL 17 databases and the pinned native schema
and logout source. Positive runtime provenance, ownership, payment evidence and
checkpoint validation are explicitly synthetic. Injected payment-loader tests
also inject a no-op settlement callback; the persisted BNB adapter test exercises
real local ledger settlement. Native source parity with today's deployment is
not established by these tests. GitHub CI runs all these checks.

## Reproduce

Use Node 24 and PostgreSQL 17 as a non-root user, from the repository root:

```sh
npm ci --ignore-scripts
npm ci --prefix vendor/bnb-continue-store --ignore-scripts --no-audit --no-fund
node --test tests/multichain-sui-bnb-continue.test.mjs
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-sui-bnb-continue-postgres.mjs
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-shared-delivery-postgres.mjs
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-sui-session-postgres.mjs
```

Set `BNB_PG_SHARE` too for unpacked PostgreSQL. These are revised *proposed* source
schemas, not upgrade migrations; create a fresh disposable database. Nothing was
applied to a hosted database. Local results are saved alongside this document.

## Remaining integration

1. Verify the currently published native package and database binding against
   exact source. The recovered older ZIP does not match the captured live hash.
2. Split native Sui payment evidence from its current restoration-time redemption
   record, and route both payment paths through the common sequence boundary.
   Do not import an already consumed native redemption as an unused payment.
3. Implement the reviewed native checkpoint/renderer and ambiguous-delivery
   recovery policy, preserving native game trust rules, scores and tournaments.
   No client-reported snapshot is automatically marked independently validated.
4. Connect authenticated HTTP/payment adapters and canonical `/play/` wallet UI,
   then review migrations and a fresh full-inventory preservation release.

The current Mysten guidance was refreshed; this step makes no Sui SDK, signature,
network endpoint, contract, wallet or deployed-function change. No user wallet
transaction is needed for the next source integration steps.

Hosted [CI 45525080280](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45525080280) passed on `51ea37d`, including all repeated-continue checks and existing regressions. Machine-readable evidence is in `hosted-ci.json`.
