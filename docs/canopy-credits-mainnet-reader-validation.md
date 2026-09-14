# Canopy Credits: read-only Sui mainnet verification

## Completed milestone and scope

The read-only mainnet reader is implemented and has been exercised against actual Sui mainnet data. The tested implementation is commit `35883ee442061b725ef87f27744a184258b3bb6b` on `feature/canopy-credits-mainnet-ledger`, under draft PR 20. It has not been merged into the active account preview or production and is not a running payment service.

This report and `services/canopy-credits/reader/README.md` supersede the earlier foundation notes ONLY where they describe the mainnet reader and metadata reads as unimplemented. The other outstanding checkout, database, identity, recovery and release requirements remain outstanding.

## Actual mainnet observation

The final read-only smoke test reported `2026-09-14T03:19:53.659Z`. Its complete logged observation is preserved in `docs/canopy-credits-mainnet-read-observation.json`.

The reader used the official endpoint `https://fullnode.mainnet.sui.io:443` through the locked `@mysten/sui@2.31.0` gRPC client. It confirmed the full mainnet genesis digest `4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S` and short chain identifier `35834a8a`.

StateService.GetCoinInfo returned the canonical TREE coin type:
`0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`

Observed metadata:
- Name: `Thickquidity`.
- Symbol, preserving on-chain capitalization: `Tree`.
- Decimals: `6`; one TREE equals `1,000,000` base units.
- Metadata object: `0xe4dcc3ff58d2069c18b024fb69c925abb95748dbeb16a99258e1d3433c140902`.

Two actual existing transactions were read and matched to checkpoint `322387160` and its recorded effects:
- `2sHX5Lv8JxpoFnBEYJKX5WanYRRq3AoLFfw8YeBz1CfH`: successful system transaction, no events or balance changes.
- `JAouMW1mURREN2xUrpoKiUNxWm3YXq3HniXX2zxzyTRq`: successful transaction with two events and one balance change.

The initial implementation run, at `2026-09-14T03:16:04.800Z`, also read the actual failed transaction `e5CfBV6qsYCuaShTEGt35Fk7buv1Fu2o4Pp7Wa6TYrN` in checkpoint `322386153` and retained its failed status. Initial implementation: `d76b9654f0282dbfa1cbb02a5c2f5786a6c214a5`; run `34802009330`, job `103846375349`.

These are ordinary existing network transactions, NOT Canopy Credits purchases or newly submitted transactions. No price was fetched or inferred. No recipient-wallet balance was queried. No purchased credits were issued from any sampled transaction.

## Verified automated execution

For the final tested implementation commit above, both complete workflow/job summaries and full logs were inspected:

1. Read-only workflow: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/34802215718
   Job `103846989755`: completed SUCCESS. `npm ci --ignore-scripts` and unchanged manifest/lock verification passed. All **103 Node tests passed**, with zero failures and zero skipped tests; the subsequent real mainnet smoke test passed.
2. Isolated ledger workflow: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/34802215676
   Job `103846989533`: completed SUCCESS. All **28 actual PostgreSQL integration tests passed**. The existing 48 payment tests also passed again in this job; do not count those repeated executions as additional distinct tests. Database reported PostgreSQL 17.11; CI Node reported v22.23.2.

Distinct automated coverage: **131 passing tests** = 48 existing payment/server tests + 46 reader tests + 5 transport restriction tests + 4 reader/payment integration tests + 28 database tests. Thus this milestone adds 55 new tests. The live smoke test is reported separately, not added to that unit/integration count.

Offline reader and payment tests use controlled protobuf data. The four reader/payment integration tests use an explicitly fictional receipt codec and no network or database. The PostgreSQL tests use disposable fixture accounts, not the user's Supabase database. The smoke test alone queries actual mainnet. SDK installation and real network acceptance were executed in GitHub Actions; the local container could not resolve external hosts.

## Reader behavior and trust limits

The transport permits only GetServiceInfo, GetCoinInfo, GetTransaction and GetCheckpoint. Execution, simulation, wallet-balance reads and streaming are rejected before transport. There is no signer, arbitrary caller-selected endpoint or public HTTP route. The isolated SDK lockfile does not change the game or portal dependencies.

The adapter checks explicit status, exact integer amounts, transaction/checkpoint inclusion, corresponding effects digest, event-list digest consistency and timestamps. Missing, stale or mismatched data fail closed. Transient requests have bounded retry/deadline handling.

This is **trusted-RPC checkpoint-inclusion validation**. It does not independently verify validator quorum signatures or recompute the cryptographic BCS commitments. A production payment service still needs reviewed trust, availability and reconciliation arrangements; this milestone is not an external security audit.

Every event returned by the live reader has `fields:null` because no approved Canopy checkout receipt decoder is registered. Ordinary event JSON cannot become a purchase receipt. A proposed `checkout::Purchase` event format remains a specification until the actual checkout contract and codec are implemented and reviewed.

## Unchanged and next work

No contract was published, no transaction was submitted, no user database was mutated, and no payment flags, environment variables, active preview branches or production branches were changed. The approved sales recipient remains `0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`. The existing game preview and Peter's last verified 700 test CC were not modified or imported into the new ledger. This step did not reread his personal test balance.

`LIVE_CHECKOUT_ENABLED` is still false, draft orders are not payable and the live checkout entry point still throws. There is no new game screen or repeat gameplay acceptance required for this backend step.

Next implementation: the checkout Move contract, exact receipt decoder and wallet transaction builder. Before any monetary pilot, complete the reviewed pricing and metadata binding, payer restrictions and per-purchase/aggregate/gas limits, approved identity mapping and deployed private ledger, durable payment reconciliation, saved-flight recovery and security/operations review. The receiving address is already resolved; do not ask for it again.

This commit adds documentation/observations only, after the identified passing implementation. It does not alter tested code or activate a payment route.
