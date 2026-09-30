# Canopy Credits ledger foundation — verified test results

## Implemented scope

The new backend foundation is isolated on `feature/canopy-credits-mainnet-ledger`, with draft PR 20 targeting `preview/treeforce-account-step1`, not production main. The implementation lives in `services/canopy-credits/`: private PostgreSQL schema, parameterized server adapters, disabled Sui-mainnet draft-order/payment-validation logic, and automated tests. It is not deployed into the user database or connected to the running game.

PR: https://github.com/TheCryptoArborist/tree-token.xyz/pull/20

## Verified execution

Tested implementation commit: `4cf6865697e513867c6a39707132efe603534084`.
GitHub Actions run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/34794317667
Job: `103824373419` (`ledger`). Full job logs were read after execution.

- JavaScript payment-verifier/server-adapter suite: **45 passed, 0 failed, 0 skipped**. Executed both locally and in CI.
- PostgreSQL integration suite: **28 passed, 0 failures/errors**. Executed against an actual disposable PostgreSQL service, not a mocked database.
- Total: **73 automated checks passed** for that implementation revision.
- Database reported `PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2)`.
- CI Node reported `v22.23.2`.
- The database test suite finished at approximately 2026-09-14 00:58:32 UTC; its final result was `OK`.

The first workflow attempt stopped at incorrectly quoted container health-check arguments. The next attempt ran all database checks: 27 passed and one had a multiline JSON parsing error in the Python result helper. Both test-infrastructure defects were corrected. No financial assertions were removed, weakened or skipped; the full corrected suite passed.

## What the database checks establish

Within the tested cases: one-time receipt crediting under sequential and concurrent duplicate delivery; global receipt uniqueness across accounts; immutable request payloads; one continue reservation per run; no overdraft when 12 concurrent 100-CC reservations compete for 1,100 CC; purchase/bonus provenance; reserve/commit/deliver accounting; release and referenced compensating refund entries; expiration recovery; preserving delivered state for review; required/matching checkpoint references; unprivileged browser and runtime restrictions; blocked historical update/delete/truncate; and BIGINT round-trip precision above JavaScript's safe-integer range.

The payment tests use fictional reader responses and do not establish that a real on-chain purchase has been read or credited. They check the verifier's rejection of failed/simulated/unfinalized, wrong-chain, wrong-coin, wrong-payer/recipient/order, underpaid, expired or mismatched-receipt evidence.

## What remains unimplemented

The gRPC/GraphQL reader is still an injected interface, not a live network adapter. Actual mainnet metadata verification, checkout package/event implementation and review, transaction construction, pricing source/policy, approved settlement address and payer allowlist, aggregate purchase caps, account mapping, deployed database credentials, ingestion/reconciliation workers and game integration remain to be completed.

The ledger stores recovery checkpoint REFERENCES and state; it does not yet store/validate/replay the game checkpoint. A crash after acknowledged delivery still requires an integrated resume/refund decision. This is not a solved end-to-end recovery guarantee, external security audit, production backup/restore test or authorization for mainnet fund movement.

## Isolation confirmed by scope

No Supabase mutation, production database migration, contract publication, token transfer, live payment flag, Netlify function or environment change was made for this work. The active game preview branch and central account/simulation branch were not updated. Existing simulated credits were neither read into nor copied into the new ledger. Peter's previously verified 700 test CC stays in the simulation.

The new workflow uses a disposable database and fixture accounts, with contents-read permissions and no production secrets. Its runner rejects non-loopback database hosts and database names other than `canopy_ci`. No additional paid database project was created.

`LIVE_CHECKOUT_ENABLED` remains false and `beginLiveCheckout()` throws. The schema's initial continue SKU remains disabled by default; only the disposable database test fixture enables it. No newly playable payment UI is expected in the existing preview.

This document is a test report only. No tested implementation files were changed after the identified passing run.
