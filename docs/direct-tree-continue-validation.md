# Direct 20,000 TREE continue — implementation and validation, 30 September 2026

## Scope and revisions

Peter selected a fixed 20,000 TREE payment after all lives are lost, without a Canopy Credits top-up or USD conversion. This implementation follows that decision. Starting a new game remains free. One purchased continue restores three lives, the starting weapon and brief spawn protection, preserving the current wave and score. The existing one-continue-per-flight and casual-score boundary remain.

Game implementation: `TheCryptoArborist/treeforce89`, branch `feature/direct-tree-continues`, draft PR 2. Final tested game commit: `dbb73751948ca727c30d6d76f1afa58f166116fd`.

Backend implementation: `TheCryptoArborist/tree-token.xyz`, branch `feature/canopy-credits-mainnet-ledger`, draft PR 20. Final tested backend commit: `56922c7caf3930c7fb5bdc2ae63fe48b0eea686f`.

This is tested implementation, NOT an activated mainnet checkout. No contract was published, no real payment was submitted, no private production database was migrated, and no real authority key was provisioned. Both existing production branches and the stable `preview/animated-enemy-roster` game branch were left untouched.

## Player-facing implementation

The candidate game installs the direct continue adapter instead of the test-CC top-up adapter. At zero lives it pauses the existing game scene, physics and controls, then shows a rounded responsive dialog with `CONTINUE — 20,000 TREE` and `START NEW GAME — FREE`. It does not request a wallet signature merely because the player dies. The SUI network fee is described separately from the TREE price.

The fixed price is 20,000,000,000 raw units at the verified six-decimal TREE precision. Coin type and recipient are pinned in both game and service product policy:

`0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`

`0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`

The browser checks the order, authenticated account, payer, flight, quantity, lives, amount, destination, quote commitment and exact signed BCS quote. A normal Transaction instance with an exact TREE coin intent is passed to dApp Kit; the wallet resolves its coins and gas. The browser does not prematurely build raw bytes or manually select gas coins. Wallet dependencies are isolated and locked at @mysten/sui 2.33.2 and @mysten/dapp-kit-core 1.6.35 without changing root app dependencies.

A wallet success response is only a transaction-digest hint. Separate server receipt verification must authorize restoration. Duplicate clicks are serialized in the tab. After an unknown wallet result, verification timeout or lost delivery acknowledgment, the attempt reconciles the same purchase rather than requesting a second payment. Same-tab restoration is applied once. A rejected signature leaves the unpaid free restart available. A pending recovery marker contains no session token or signature; a new free flight cannot erase an older flight's pending purchase marker.

## Backend implementation

`continue-product.mjs` creates fixed-price, single-flight terms with no CC issuance, bonus or dollar fields. The run/account/payer and recovery checkpoint hash are part of the immutable commitment.

`direct-continue-service.mjs` provides dependency-injected order, reconcile, deliver and cancel orchestration. It requires a verified Sui account and trusted server flight state. It signs an order only after the order has been saved in the surrounding transaction and returns only after commit. Retries reuse one order per account/run. Cancellation preserves an order so a previously signed payment arriving later can still be reconciled. New purchase pausing does not prevent recovery of existing paid orders.

`direct-continue-verifier.mjs` connects the fixed product to the existing mainnet reader and exact checkout receipt verification. It rejects a mismatching order, token, amount, recipient, checkout instance or key epoch. The service records a unique receipt before authorizing delivery.

`direct-continue-repository.mjs` supplies a parameterized PostgreSQL repository with per-account/run transaction locking. `direct-continue-schema.sql` defines a separate private `tree_continue_v1` purchase/receipt journal with immutable terms, guarded state transitions, receipt uniqueness and append-only history. This does not reinterpret 20,000 TREE as a Canopy Credits exchange rate. No schema or application table was installed or altered in the user's Supabase project.

## Verified tests and build

Game workflow: https://github.com/TheCryptoArborist/treeforce89/actions/runs/36782977338
Job 110117541485 completed SUCCESS; full logs were inspected.

- 168 direct-continue and existing gameplay/account regression tests passed; zero failures/skips.
- The app build additionally passed 8 campaign tests and 26 record tests.
- Actual Vite production compilation succeeded and package/lockfile drift check passed.
- Thus this game run passed 202 distinct test cases across its three test invocations. Forty-six direct-continue tests are new; the remainder are existing regressions.
- Non-fatal CSS at-rule and large-chunk warnings remain. This is not a separate TypeScript type-check or full Phaser campaign play-through.

Backend integration workflow: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/36782899968
Job 110117284978 completed SUCCESS; full logs were inspected.

- 75 JavaScript tests passed: 25 new product/service tests, 2 new cross-repository quote/builder tests, and 48 existing payment tests.
- 28 existing ledger database tests and 12 new direct-purchase SQL invariant tests passed on actual disposable PostgreSQL 17.11.
- The cross-repository checks used game commit 03be08c5ade7a30d7868fff714f391233acc4b3c. Subsequent game changes only corrected test inspection and adjusted the CI reporter; runtime modules are unchanged.
- Service transaction tests use an in-memory repository; SQL invariant tests execute directly against Postgres. The new PostgreSQL repository/service together have not yet undergone a hosted, authenticated end-to-end acceptance test.
- Existing backend ledger, checkout/Move and mainnet-read workflows for the same backend revision also report SUCCESS in the completed workflow summaries; their repeated cases are not added again to the above counts.

Local Chromium interface checks executed the authored dialog, state machine and scene wrapper at 1200x900, 390x844 and 320x700. All 12 scenario/viewport checks passed: disabled checkout, successful authorized restoration, pending verification followed by recovery without a second payment, and signature rejection followed by free restart. No page errors or dialog horizontal overflow were observed. Wallets, server responses and Phaser scene interfaces were simulated. These were in-memory interface tests, not a deployed browser wallet or live mainnet purchase.

Initial tests found two test-inspection defects: attempting to serialize a deliberately unresolved SDK coin intent without a client, and serializing an SDK BigInt through plain JSON.stringify. The assertions now inspect the exact amount without rounding and explicitly confirm coin resolution is deferred. No monetary/safety assertions were removed or skipped. Final complete runs passed.

## Explicit activation and recovery blockers

The candidate `/api/tree-continue` route deliberately returns HTTP 503 `checkout-not-enabled`. `APPROVED_DEPLOYMENT` is null. A URL query or environment toggle alone cannot turn on payments. There is no fake successful purchase route in the candidate.

Still required before receiving real TREE: publish and record the reviewed checkout package/shared object with approved AdminCap/UpgradeCap ownership and gas limits; provision the quote authority safely; install and connect the private purchase database with least-privilege access; bind the service to authenticated TREE Accounts and a durable flight registry; wire the game proxy to that service; and complete independent security/operations review and the restricted mainnet acceptance test.

Full reload/browser-close saved-flight recovery and no-digest background receipt discovery are not implemented by this step. They remain monetary activation blockers. The current pending marker prevents an additional charge but cannot reconstruct a flight after closing the tab. Unknown or expired attempts can remain blocked until reconciliation/recovery is implemented. This is not a promise of exactly-once gameplay across crashes, a refund of on-chain TREE/gas, or a completed anti-cheat system.

No new Netlify preview deployment was confirmed for the game feature branch at the time of the status check; GitHub reported the successful test/build check, not a Netlify deploy-ready status. The existing PR 1 preview is not the new direct-payment candidate. Do not supply a guessed candidate preview URL.

The old sign-in, achievements and 700 test CC previously confirmed by Peter were not migrated or modified. The task did not reread his personal test balance. No extra top-up or repetition of the prior simulation acceptance is needed.

Guidance consulted live: MystenLabs/skills README; frontend-apps/SKILL.md, frontend-apps/transactions.md and frontend-apps/non-react.md; ptbs/SKILL.md and ptbs/building.md. Netlify serverless context was also checked when reviewing the fail-closed route.

This report is documentation only; it does not change the tested code, deploy a game, or activate payments.
