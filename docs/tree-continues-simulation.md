# TREE-funded continues — isolated simulation, 13 September 2026

This preview implements the first proof-of-concept, not real TREE payments or the production credit ledger. Start from https://deploy-preview-1--treeforce89.netlify.app/ and sign into the paired TREE Account preview. Central authentication remains at deploy-preview-18--tree-token.netlify.app. No production branch, contract, database migration, real token transfer, treasury operation or NFT entitlement is changed.

## Scope and prototype settings

One account-scoped simulated TREE funding package: 1,000 base test CC plus a 10% TREE bonus, totaling 1,100 test CC. The deliberately fictional oracle is 1 TREE = $0.001, so the test quote shows 1,000 SIMULATED TREE. It is not the current TREE price. All payment data has mode=simulation, network=simulation and asset=SIMULATED_TREE. There is no real payment address, wallet transaction request or on-chain receipt ingestion endpoint.

The quote is server-stored, HMAC-signed, account-bound and valid for 45 seconds. Five top-ups maximum per preview account. A duplicate simulated receipt credits once. No issued test credits expire automatically, but this test namespace will not migrate to launch balances.

One optional continue per run costs 100 test CC. It restores three Seedling lives and the starting weapon, resets combo/charge/temporary power-ups, clears bullets, preserves wave/enemy/boss progress, score and already-awarded extra-life milestones, and grants three seconds of spawn protection. These are temporary play-test settings, not finalized launch pricing or balance.

## Shared-system boundary

The connected Supabase project has no development branch, and the earlier canopy-credits-ledger-core.ts file was not present in either checked portal branch. Production Postgres/Supabase was deliberately not modified. This simulation uses a separate private, strong-consistency Netlify Blobs namespace as a temporary test adapter under the CENTRAL portal, keyed by the existing authenticated preview TREE Account UUID. It is not browser-local spending and not a per-game balance. The approved private transactional Postgres architecture remains the production target; the simulation adapter must not be promoted to a monetary ledger.

Accounting is a bounded per-account append-only journal inside one atomically replaced aggregate. Each issuance, reserve, commit, release and refund contains balanced integer lines. Reads derive available/held/spent totals from those lines and reconcile FIFO credit-lot attribution. Conditional ETag writes serialize racing actions. Idempotency keys have immutable command fingerprints; changed commands with the same ID fail. No transfer, redeem, production deposit, arbitrary SKU or client-set amount API exists. Game requests use the existing HttpOnly account-session cookie and a same-origin server proxy. Central identity verification is reused, including parent-session revocation and game audience checks.

reserve -> prepare paused game -> commit -> restore while paused -> confirm delivery -> resume. Failed preparation releases the hold. Failed application reverses a committed debit with a referenced refund entry. Unfinished holds and unacknowledged deliveries expire after 90 seconds and are reconciled on the next ledger read/action. Retry IDs are retained after a lost response so retries do not charge or restore twice. After delivery acknowledgment, further release requests are rejected. The client still controls game execution; this is a NON-MONETARY test protocol, not authoritative gameplay or anti-cheat proof. A crash after delivery acknowledgment and before visible resume still requires the production recovery policy/server checkpoint design.

A successful continue triggers the existing first-credit scoreboard boundary before restoring the player. Further points are casual. TEST CONTINUE NOW deliberately marks the entire flight as practice; it cannot earn normal records or achievements. Old local records are not promoted to verified results.

## Testing and remaining gates

Local: 22 ledger tests, 18 continue/proxy tests, and five cross-repository ledger/controller integration tests passed. Covered 100 duplicate receipt deliveries, changed idempotency inputs, expired/tampered quotes, cross-account rejection, concurrent non-overdraft spending, holds/releases/refunds, lost commit/delivery responses, pause controls, and preserved game-state fields. Two additional records-adapter tests run in the game's preview build along with existing tests.

An isolated Chromium harness exercised the actual new UI/controller and the actual reducer through local process IPC, with mocked account/scene/storage dependencies, at 1200x900, 390x844 and 320x700. Simulated funding, successful continue, failed preparation/release and dialog closure passed; no page errors or horizontal overflow. This is not a deployed Phaser campaign or installed-wallet end-to-end acceptance. Browser network access was blocked in the runtime.

Enable only with function-scoped deploy-preview TREE_CC_SIMULATION_ENABLED=true on both paired sites. The exact configured preview origins and deploy-preview hostname gates remain mandatory. To pause NEW activity while preserving reads and recovery, set central TREE_CC_SIMULATION_PAUSED=true; do not simply disable the whole service during a pending recovery.

Next acceptance: sign in, create/confirm simulated quote, see 1,100 test CC, exhaust lives or use the practice shortcut, continue, and verify 1,000 remains. Try TEST FAILED CONTINUE on a fresh flight and verify no net debit. Test the unchanged capture/rescue and final boss flows in the actual Phaser build.

Exclusive levels, content entitlements, real TREE valuation/checkout/finality verification, optional wallet linking, daily issuance, real Postgres deployment, verified rankings, security review and final recovery/refund rules are NOT implemented here. No expansion is charged for, and no promised NFTree utility is restricted.
