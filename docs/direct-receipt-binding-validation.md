# Direct TREE receipt connection and quote-context validation

## Scope of this milestone

Implemented and committed the receipt-verification portion of the direct-continue backend connection in draft PR #49. This is source-level integration plus isolated validation, not the completed hosted monetary runtime. No database permission migration, credential provisioning or payment activation is included.

Runtime implementation commit: `b9345439dfc8543098214f38cbc3084e0cc573a4`.
Final tested commit (adds the database integration harness): `8addf6ae7e55aa56a390038f325d63d6bce50658`.
Branch: `feature/paid-continue-delivery`. Neither `main` nor `preview/flight-recovery` was advanced during this milestone.

## Implemented connection

`services/canopy-credits/reader/checkout/direct-receipt-reader.mjs` supplies a `verifyPayment` callback for the existing direct-continue purchase service. It connects the existing full read-only mainnet gRPC reader to the exact checkout BCS receipt decoder and direct-order verifier.

It snapshots the reviewed deployment and the requested order before asynchronous reads; rejects a changed package, checkout instance, runtime configuration or future signing epoch; validates the digest; and returns independently read payment evidence, not a life grant. Existing checks then enforce the fixed TREE type, payer, recipient, amount, committed order fields, payment time and checkpoint inclusion/effects. The adapter has no database, signing key, wallet, transaction execution or HTTP route.

The operator must still supply the actual reviewed deployed package/checkout/key configuration. `inspect()` verifies network and coin metadata, reports that a receipt decoder was selected, and always returns `paymentsEnabled:false` and `restoreAuthorized:false`. It does NOT verify that the supplied checkout object exists or is correctly configured on-chain. The established reader trusts its pinned RPC's checkpoint data; it does not independently verify validator committee signatures.

## Quote mismatch fixed

The previous `quoteFields()` implementation validated the package but could replace a direct order's `checkoutId` or `keyEpoch` with values from the supplied deployment when encoding signed bytes. Because the saved quote commitment still included the original fields, that mismatch could produce a payment instruction that could not later be matched to its saved order.

For `kind:'direct-continue'`, encoding now rejects any checkout-instance or signing-epoch disagreement BEFORE quote signing. This change does not alter the legacy CC quote format or publish a new Move package. New signatures must use the exact saved epoch; already-paid receipts from an older epoch can still settle after rotation when their receipt and saved order agree. No exploited or actual lost payment is asserted.

## Verified test results

Binding run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/36811055993
Job: `110205981862`, completed SUCCESS including cleanup.
The full completed job log was read.

- 81 exact-quote, receipt, reader and transport tests passed; 0 failed, 0 skipped. This includes 29 new direct-receipt/quote-context tests and 52 existing tests.
- 7 new actual PostgreSQL service-integration scenarios passed. Node reports 8 tests because it also counts the enclosing parent; the scenario count here excludes that parent.
- 36 new distinct scenarios in this milestone: 29 + 7.
- Node reported v22.23.3. The disposable container reported PostgreSQL 17.11.

The database harness connects the actual signed-quote helper, exact BCS receipt decoder, mainnet response normalizer, new receipt adapter, existing purchase repository/service and receipt-bound delivery function. Ten simultaneous reconciliation attempts produced one receipt, one quote signature and one transaction read in the tested case. Receipt verification alone did not grant lives. Repeated delivery activation retained one consumed-continue journal entry. Underpayment, node outage and missing checkpoint cases did not fabricate receipts. Pausing new purchases did not prevent reconciliation/delivery of the existing eligible order.

The underpayment scenario changes a fictional node response to exercise retry handling; it does NOT suggest that real immutable blockchain transactions can be edited.

These tests use real cryptographic QUOTE signatures and a real disposable PostgreSQL database. Identity, deployment IDs, node responses and checkpoint approvals are explicit fixtures. There is no installed wallet, wallet transaction signature, live mainnet purchase or actual game rendering in these seven new scenarios. The order/settlement test repository uses the disposable database owner; it does NOT establish production role separation. Delivery calls use the existing restricted delivery role. The runner refuses non-loopback database hosts and database names other than `direct_receipt_ci`; no hosted database secrets are supplied.

Full existing regression run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/36811055999
Job: `110205982462`, completed SUCCESS including cleanup.
All completed step summaries were inspected: gateway checks, game/wallet/recovery regressions, production compilation, existing PostgreSQL suites, the source-served game/database browser checks, and compiled-UI/HTTPS/database checks passed. A separate fresh full raw-log review of this broad regression run is not claimed. The new binding job's full log was reviewed as noted above.

Both newly introduced binding runs passed; no test assertion was removed to obtain these results. Test execution was in GitHub Actions, not the local chat container. No external audit or live-wallet acceptance is implied by the results.

## Product and deployed state

The product remains a fixed 20,000 TREE, or 20000000000 raw units at six decimals, for one three-life continue. The same-wave/score rules and free-new-game option are unchanged. No Canopy Credits package is introduced.

Admin and first purchaser remain `0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6`.
Sales remain directed to `0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`.
These choices were not requested again or changed. See `docs/continue-mainnet-wallet-roles.md`.

No Supabase mutation, hosted database grant, deployed quote key, mainnet transaction, Move publication or update to the active game-preview branch was performed. The active read-only preview was not wired to the new adapter during this milestone. No simulation balance was accessed or migrated. Do not describe this as deployment of the previously unfinished order/settlement permissions.

## Remaining release work

Still required: complete and review the separate restricted order/quote and receipt-settlement runtime connections; connect this receipt adapter to the hosted payment endpoint with the actual checkout deployment; implement checkpoint eligibility authorization and operational handling for ambiguous post-activation cases; settle deployment gas, cumulative pilot cap and upgrade policy; publish/configure the checkout through the designated wallet; and run the restricted actual-wallet 20,000-TREE purchase/continue acceptance test. The existing bounded event discovery remains insufficient to prove nonpayment from an empty scan. Public payments remain disabled.

The previous hosted milestone and its limitations remain documented in `docs/hosted-continue-readonly-deployment.md`. No new installed-wallet or gameplay test is requested from Peter for this source-only change.

## Guidance used

Read the current MystenLabs/skills README and relevant `frontend-apps/SKILL.md`, `frontend-apps/limitations.md`, `accessing-data/SKILL.md` and `accessing-data/grpc.md`. Also checked the official Sui skills page, Supabase database-function guidance and PostgreSQL privilege documentation. Existing server-only credentials and wallet-approval boundaries are preserved.
