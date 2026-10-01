# Continue UI and purchase recovery integration — staged and tested

## Scope and deployment status

The default game-over Continue button is now connected in the feature-branch code to the receipt-bound preparation/activation protocol. A server-backed RECOVER TREE PURCHASE panel finds existing orders even without a browser payment marker or transaction digest. The compiled application, HTTPS proxy/session gateway, actual receipt-verification implementation and actual PostgreSQL storage have been exercised together.

This is an implemented and tested integration milestone, not a hosted payment launch. Backend draft PR #49 and game draft PR #4 remain unmerged and target preview/flight-recovery rather than main. The game deployment manifest REVIEWED_CONTINUE_DEPLOYMENT remains null, so the hosted payment gate remains disabled. The new gateway and database changes have not been installed into the hosted payment environment during this work package.

No hosted Supabase migration, runtime login or role membership, quote-signing key, live payment receipt, mainnet contract publication, or TREE transfer was created during this request. The existing practice-recovery preview branches were not changed. The last-reported 700 simulation CC was not queried, topped up or migrated. Price, recipient and the existing private-storage installation approval are already resolved; they are not being requested again.

## Product preserved

The fixed price remains 20,000 TREE, or 20000000000 raw units at six decimals. The product restores three lives with the starting weapon and brief spawn protection, retains the wave and score, permits one continue per flight and keeps continued play casual rather than ranked. Starting a new game is free. No Canopy Credits package is required.

Coin type: `0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`

Recipient: `0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`

## New behavior

The default checkout checks server-held orders before opening a wallet payment request. An existing unresolved purchase goes through reconciliation rather than another payment. A local pending marker that cannot be matched also fails closed. Unknown wallet outcomes retain the existing order; the separate delivery controller remains responsible for reconstruction, activation and life restoration. The old unleased deliver action is not used by the default UI.

RECOVER TREE PURCHASE is available outside the game and inside the exhausted-flight dialog. It lists the signed-in account's server-held orders, shows order and flight identifiers, and can resume a verified, unconsumed continue without a local digest. Account changes clear the panel's ownership context and controllers. Modal handling keeps the recovery controls reachable while the game remains paused.

The backend searches recent checkout events for the payer and event type, then independently verifies candidate transaction effects using directContinueVerifier. Event discovery alone does not authorize a receipt. The existing purchase service locks the durable order, verifies the payment and claims its unique receipt. Recovered orders are nonpayable, with no signed quote envelope or direct life authorization in the recovery response.

The scanner is bounded: the default is three pages of sixteen candidate events, with a durable ten-second per-order scan throttle. Empty results, a bounded scan, an unavailable index, partial GraphQL errors or a wrong chain do not prove nonpayment and do not enable another charge. There is no durable historical scan cursor or backfill worker in this implementation. An older payment outside the recent window is not guaranteed to be discovered automatically.

The server gateway verifies the opaque HttpOnly TREE session through a pinned issuer before creating its server-side actor. The browser cannot supply trusted account, payer, receipt evidence or a verified flag. The same-origin proxy forwards only the session and allowed command fields to the configured server channel; it does not expose the session in JSON. Runtime provisioning still needs to bind these factories to the actual reviewed hosted services.

A lost activation acknowledgement can be retried in the same page using the same lease and activation request. A fresh page after consumption receives review-required instead of another set of lives. The UI now exposes that review state and identifiers, but no support-ticket backend, refund executor or regrant policy has been implemented. This does not prove honest gameplay or exactly-once browser rendering.

## Implementation files

Backend additions:
- services/canopy-credits/migrations/purchase-recovery-v1.sql
- services/canopy-credits/purchase-recovery.mjs
- services/canopy-credits/receipt-discovery.mjs
- services/canopy-credits/continue-gateway.mjs
- services/canopy-credits/tests/purchase-recovery-pg.test.mjs
- services/canopy-credits/tests/purchase-recovery-https-browser.mjs

The existing .github/workflows/paid-delivery-isolated.yml now runs the additional integration tests. The new NOLOGIN tree_continue_recovery database role can execute only scoped purchase lookup and scan reservation functions. It cannot manufacture receipts or activate delivery. Browser/platform roles cannot invoke these functions. The migration does not provision a runtime login, public RPC or signing authority.

Game additions/changes:
- app/game/tree-continue-checkout.mjs
- app/game/purchase-recovery-ui.mjs
- app/game/tree-continue-ui.mjs
- netlify/lib/tree-continue-proxy.mjs
- netlify/lib/tree-continue-gate.mjs

The existing paid-flight-delivery and paused Phaser loader remain the restoration path. The legacy checkout module remains for regression coverage, but the default UI imports the new checkout orchestration.

## Final verified execution

Backend tested commit: `45e50ffb064ca3fae2cd0465804b68a6ea84fae2`

Game tested commit: `a20cfa7e78ddbe6228b1006003147681c2543cac`

Run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/36802790543

Job: `110180697781`, completed SUCCESS, including cleanup. Full completed job logs were read. Node v22.23.3, disposable PostgreSQL 17.11.

Results:
- 19 new purchase-recovery, verifier, default-checkout and gateway/database scenarios passed. Node reports 20 including the enclosing parent.
- 28 existing paid-delivery database/controller scenarios passed. Node reports 29 including the parent.
- 229 existing game/account/wallet/campaign/records cases passed: 195 plus 8 plus 26.
- Actual production Vite compilation passed. Existing CSS at-rule and large-chunk warnings remain. No separate typecheck or independent security audit is claimed.
- Four existing actual Phaser/Vite-source/database browser scenarios passed again.
- Four new compiled-default-UI/HTTPS/database scenarios passed.

The new browser suite serves the compiled dist application, clicks its actual buttons, and uses separate real HTTPS game-proxy, gateway and issuer/index servers on loopback. PostgreSQL and the game/verification/proxy code are real. Authentication, normalized chain responses and checkpoint-review decisions are explicit fixtures. No installed wallet or mainnet payment is involved.

The new scenarios cover the default Continue button, a reopened damaged boss flight with cleared local storage, an unavailable activation acknowledgement, and disabled checkout with an empty recovery panel followed by free restart. Recovery preserves wave, score, the already-earned milestone life and physical keyboard movement/shooting. The boss retains 59/180 HP. Each of the three recovered orders ends with one verified receipt and one consumed continue; each further fresh page shows review-required without starting gameplay.

In the acknowledgement-loss scenario, the server commits activation and the test returns an explicit 503 instead of its acknowledgement. Before retry, the browser still has zero lives and the database already has one consumption. The same UI button retries identical requestId, leaseId and checkpointHash values, restores three lives and leaves one consumption.

Final compiled-suite counters: passed=4, browserPayments=0, sessionChecks=25, indexReads=3, activationCalls=4, pageErrors=0. Of those four scenarios, three are recovery cases and the fourth is disabled-checkout/free-restart coverage.

## Evidence and test corrections

Final artifact: `11136264668`, continue-integration-evidence, twelve files: eleven screenshots and results.json. Downloaded ZIP size: 2849048 bytes.

Verified ZIP SHA-256: `e92d1b45b7c4ce9526a393365bc690291269fc5961bde0ec0a9a2bc572505986`.

The final restored-boss, lost-acknowledgement-before-retry and fresh-page review screenshots were visually inspected. The archive contains no signing credentials or TLS private key.

An earlier raw-socket-loss test timed out; that run is not claimed to pass or to establish a particular browser retry cause. The harness was changed to deterministic post-commit acknowledgement failure. A later free-restart test ambiguously matched both recovery buttons; its locator was scoped to the exhausted-flight dialog. The expiry test was strengthened to advance the injected service clock and verify that reordering is rejected. Payment verification, zero-life-before-activation, unique consumption and retry-identity assertions were preserved. The full corrected run passed.

## Remaining hosted milestone

Deploy the reviewed migration and scoped runtime services, bind the actual session issuer and actual chain reader/deployment configuration, and exercise that hosted path with payments disabled. Do not give the practice storage gateway financial authority or seed fake paid receipts into the hosted database.

Before a monetary pilot, finish checkpoint eligibility authorization, quote authority and mainnet contract configuration, administrator/pilot-payer identities, cumulative/gas limits, and the operational review/recovery policy. Add broader historical discovery where required, then perform a restricted actual 20,000-TREE wallet purchase and gameplay restore. Peter's manual hosted save-close-reopen acceptance has not yet been reported; automated tests do not substitute for it.

## Guidance

The current MystenLabs/skills README was checked during this request. Relevant files read were frontend-apps/SKILL.md, frontend-apps/transactions.md, frontend-apps/limitations.md, accessing-data/SKILL.md and accessing-data/graphql.md. Current official Sui GraphQL EventFilter, Event and events query references were used for sender/type filtering, transaction digest extraction and pagination. The current EventFilter uses type, not the legacy eventType field. Netlify serverless coding context was also reviewed.

This report is documentation only. It does not modify the tested runtime files or enable the hosted gate.
