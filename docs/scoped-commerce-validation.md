# Direct TREE continues: scoped order and settlement integration

## Result and deployment boundary

Implemented the role-separated PostgreSQL adapter and private commerce migration on `feature/paid-continue-delivery`, draft PR #49. Tested implementation commit: `0a3c8da94c23b2d632146620bcd61d6c4b00ee39`.

The migration was executed in a disposable CI database, NOT installed in hosted Supabase. The attempted hosted read-only preflight through Supabase.execute_sql was blocked by the tool safety check. No hosted result was returned, and no hosted mutation, credential provisioning, Edge Function deployment or production/preview branch update followed. Earlier hosted table counts and deployment observations remain historical, not a fresh verification.

No Move package, wallet transaction or TREE transfer was signed/submitted. Checkout remains disabled in the running application. No old simulation-credit balance was read or migrated.

## Implemented files

- `services/canopy-credits/migrations/scoped-commerce-v1.sql`: additive private migration, depending on the existing purchase, flight-storage and paid-delivery migrations. Adds separate NOLOGIN order and settlement roles, narrow function grants, a row-level-security-protected policy table, and consistency checks. No runtime login or password is created by the migration.
- `services/canopy-credits/scoped-commerce.mjs`: connects the existing purchase orchestrator to the new scoped database functions. Order and settlement use different pools. The adapter checks the actual session login's privileges and rejects database-owner/superuser pools, swapped credentials, broad direct-write permissions and overlapping delivery/settlement authority. It does not rely on merely SET ROLE from an administrative session.
- `services/canopy-credits/reader/checkout/tests/scoped-commerce-pg.mjs`: real separate-login PostgreSQL integration, cryptographic quote signing, exact BCS decoding, receipt normalization and delivery tests.
- `.github/workflows/scoped-commerce-isolated.yml`: disposable PostgreSQL CI with read-only GitHub repository permissions and no hosted credentials.

The order role may create an eligible fixed-price order, attach its signed envelope or cancel it. It cannot create receipts, mark an order paid, approve a checkpoint or activate a continue. The settlement role may read an existing signed order and atomically attach matching verified evidence and a unique receipt. It cannot create/cancel orders or sign quotes through the order API. Neither role receives direct table writes or the delivery capability. The existing storage and delivery roles remain separate.

This is database credential/operation separation, not a claim of separately deployed machines or protection from compromise of a process holding every credential. Production should isolate the quote signer, verifier and service credentials appropriately. Trusted server session verification must still supply account identity; knowing a public address does not prove control.

The adapter independently verifies the quote signature and exact bytes before committing the purchase transaction. It uses the existing receipt-verification callback and receipt-bound delivery protocol. SQL checks evidence consistency and immutable order fields, but does not itself query or cryptographically verify the Sui chain. The trusted settlement worker must continue to obtain evidence from the independently configured mainnet reader, never browser-provided JSON.

## Default policy and purchase limits

Both `new_orders_enabled` and `settlement_enabled` are false initially. Deployment is null, and the cumulative limit and reservation counters are zero. There is no approved active pilot allowance in this migration.

When deliberately configured later, the database reserves 20,000 TREE of cumulative capacity before a signed order can be returned. Concurrent flights cannot reserve beyond that configured ceiling. Retries of the same flight reuse the existing order and capacity reservation. Bad signatures roll back the order and reservation. Cancelled/expired instructions do not automatically release capacity: cancellation or an empty receipt scan is not proof of nonpayment. An operator reconciliation policy is needed before reclaiming that capacity. The existing one-order-per-flight/quote-expiry behavior is not redesigned here.

New-sale pause and settlement pause are distinct. Disabling new orders does not disable settlement or delivery for an existing eligible purchase, provided the separate settlement service remains enabled. The independent settlement pause is an emergency control, not a substitute for recovery.

The seeded role metadata retains the user decisions:

- Administrator/intended AdminCap and UpgradeCap custodian: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- First pilot purchaser: `0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6`.
- Sales recipient: `0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`.

These metadata fields assign no on-chain capabilities. The product remains 20,000 TREE (`20000000000` raw units), three lives, same wave/score, one continue per flight, and a free new game. No Canopy Credits package or dollar-price conversion is introduced.

## Verified execution

New scoped job:
https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/36877733710
Job `110421387537`, completed SUCCESS including cleanup. Full completed log read.

- 81 existing quote, receipt, reader and transport tests passed, zero failed/skipped.
- 27 new scoped-commerce PostgreSQL scenarios passed, zero failed/skipped. Node displays 28 because it also counts the enclosing parent test; 27 is the scenario count.
- Node v22.23.3; disposable PostgreSQL 17.11.

The new suite uses four actual non-owner session logins for orders, settlement, storage and delivery. The administrator connection is used only for migration/setup, fixture checkpoint review and assertions. Service operations are executed through their restricted login pools. The suite additionally verifies that using the database-owner pool fails the new adapter's privilege check.

Covered outcomes include: unauthorized role switching/receipt writes/delivery/checkpoint access denied; exact price and recipient independently enforced by SQL; ten competing requests preserving one order/signature/reservation; two different flights competing for one remaining purchase slot allowing exactly one reservation; ten settlement retries preserving one receipt; invalid signatures rolling back; failed node/effects/checkpoint reads not fabricating receipts; account/issuer substitutions denied; cancellation retaining capacity while still allowing a valid on-time receipt; and one-time delivery remaining recoverable while new sales are paused.

Identity, on-chain deployment IDs, node responses and checkpoint approvals are explicit fixtures. Only quote signatures are real cryptographic signatures; there is no wallet transaction signature, live mainnet purchase or game rendering in these 27 new scenarios. The runner refuses non-loopback hosts and database names other than `scoped_commerce_ci`.

Existing regression run:
https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/36877733410
Job `110421386691`, completed SUCCESS including cleanup. All completed step summaries inspected: gateway tests, game/wallet/recovery regressions, production game compilation, existing PostgreSQL suites, source-served game/database browser tests and compiled-UI/HTTPS/database tests passed. A new full raw-log review of this broad regression run is not claimed. These older browser suites exercise the prior integration path, not the new scoped pools, and still use controlled chain/identity/checkpoint data.

No assertions were removed or weakened to get a passing run. Existing nonfatal build/action warnings are not claimed resolved. This is not an independent security audit or installed-wallet acceptance.

## Next deployment work

Review the migration against the actual hosted database before installation; the live inspection was blocked in this turn. Then provision distinct least-privilege runtime connections without exposing credentials, and wire the scoped adapter into the authenticated gateway. Do not run the old owner-privileged repository as a production shortcut. No browser/platform key receives the new financial function grants.

The actual reviewed checkout package/instance, quote authority, checkpoint-eligibility authorization, approved cumulative pilot limit, gas configuration, upgrade policy and paused publication are still required. Operational handling for ambiguous post-activation review/refund/regrant and wider receipt-history reconciliation remain outstanding. The first real 20,000-TREE purchase must still be reviewed and signed by the designated purchaser. Price, wallet roles and prior private-storage approval are already resolved; do not request them again.

## Guidance reviewed live

MystenLabs/skills current README, `frontend-apps/SKILL.md`, `frontend-apps/limitations.md`, `accessing-data/SKILL.md`, and `accessing-data/grpc.md`. Also consulted the official Supabase database-functions documentation and PostgreSQL CREATE FUNCTION / explicit-locking documentation. This change preserves server-only credentials and the separation between wallet approval, independent payment verification and gameplay authorization.
