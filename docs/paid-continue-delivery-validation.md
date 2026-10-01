# Receipt-bound paid continue delivery — staged implementation and validation

## Delivered in this work package

The fixed 20,000 TREE continue now has a separate two-phase delivery protocol, a private SQL migration, a scoped server adapter, an HTTP-handler factory, and an actual Phaser scene loader/renderer port. The components were connected and tested in an isolated runner. They are NOT yet wired into the hosted purchase button or an enabled public payment endpoint.

Backend draft PR: https://github.com/TheCryptoArborist/tree-token.xyz/pull/49
Game draft PR: https://github.com/TheCryptoArborist/treeforce89/pull/4
Both branches: feature/paid-continue-delivery, based on the existing preview/flight-recovery branches. Neither PR was merged. The existing hosted recovery preview, its wallet prompt, production branches, and previously reported 700 simulation CC were not changed.

No Supabase migration, grant, credential, hosted receipt, contract publication, or TREE transfer was performed during this work package. The new paid-delivery migration ran only in a disposable CI database. Database-installation approval, fixed price, and sales recipient remain resolved; this report does not request them again.

## Product unchanged

20,000 TREE = 20000000000 base units at six decimals. Restore three lives, starting weapon and brief spawn protection, retain the same wave/score, one continue per flight, casual scoring after continuation, and free new games. No Canopy Credits package, dollar conversion or bonus issuance.

Coin type:
`0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`

Recipient:
`0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`

## Protocol and failure behavior

1. A verified receipt, a validated immutable checkpoint, and the matching server-authenticated Sui account/payer/issuer are prerequisites. A saved snapshot, wallet connection, or browser-supplied success flag alone cannot qualify.
2. prepare_delivery obtains a 120-second exclusive page lease and returns the exact saved checkpoint. It does not authorize or consume gameplay. The client validates the bytes/hash and reconstructs the actual game in a paused, zero-life state first.
3. activate_delivery atomically records one entitlement consumption and the existing order-history transition before the browser restores lives. The page's activation request is stable across retries. The client sets its application latch before modifying Phaser so a partial restoration cannot apply a second set of lives.
4. A second page receives in-use while the first preparation is valid. If the first page closes before activation, another page can prepare after that lease expires, without purchasing again.
5. If the activation response is lost but the same page remains open, it retries the identical request and can finish its single restoration. It does not prepare another purchase, call a wallet, or submit a second transfer.
6. Once activation is consumed, a fresh page receives review-required rather than another three-life authorization. A crash after activation/partial rendering therefore still needs a user-facing support/recovery decision. This is not a completed automatic post-activation resume or refund policy.

The protocol protects the server's one-time entitlement record and accidental retry/concurrent-page behavior. It does not prove that an untrusted browser rendered a frame, prevent a modified client from cheating, or establish cryptographic exactly-once gameplay. Copying client state is outside that guarantee. Hash integrity does not establish honest gameplay.

## Implementation files

Backend:
- services/canopy-credits/migrations/paid-delivery-v1.sql
- services/canopy-credits/paid-delivery.mjs
- services/canopy-credits/paid-delivery-http.mjs
- services/canopy-credits/tests/paid-delivery-pg.test.mjs
- services/canopy-credits/tests/paid-delivery-browser.mjs
- .github/workflows/paid-delivery-isolated.yml

Game:
- app/game/paid-flight-delivery.mjs
- app/game/paid-flight-scene.mjs
- app/game/tree-continue-game.mjs (narrow renderer-port/paid-recovery additions)

The SQL migration adds paid_deliveries and append-only paid_delivery_events. Its NOLOGIN tree_continue_delivery role can invoke only the scoped protocol function, not modify tables or fabricate receipts. Browser roles, service_role and the ordinary storage role receive no paid-delivery authority. No runtime login/membership or public RPC is provisioned by that migration.

withPaidDelivery must wrap any publicly exposed purchase service. It removes the legacy reconciliation response's direct life authorization and rejects the old unleased deliver action. The legacy internal purchase orchestrator must not be routed directly to the browser. Reconciliation establishes payment status; it does not by itself grant life restoration.

The new Phaser loader uses the existing formation recovery policy: preserve campaign progress and surviving enemy health, normalize unfinished attack motion and clear transient projectiles. It is not an exact-frame rewind. Paid reconstruction cannot invoke the preview's practice-resume shortcut. The actual game-over purchase UI still needs to invoke the new controller after verification rather than its old delivery path.

## Final verified run

Backend tested commit: bfdd3d9613ffd3cd96755664985eed477451c77a
Game tested commit: cfef872a7e5de0020e97ecd14975a75d6644c241
Run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/36798683284
Job: 110167890809, completed SUCCESS. Full job logs were read after execution.
Node v22.23.2; disposable PostgreSQL 17.11.

Results:
- 195 existing direct-flow, account, wallet, recovery-prompt, codec and gameplay cases passed.
- 8 campaign and 26 records tests passed during the actual production build: 229 existing game regression cases in total for this run, not all new tests.
- Actual Vite production build succeeded. Existing CSS at-rule and bundle-size warnings remain; no separate typecheck or independent security audit is claimed.
- 28 individual new PostgreSQL/service/controller/security scenarios passed. Node reports 29 including the enclosing parent test; the parent is not counted as an independent scenario.
- All four actual Chromium/Phaser/PostgreSQL scenarios passed: Wave 3 reopen, damaged final-boss reopen, lost activation reply, and two-page contention.

The database protocol tests exercise real PostgreSQL row/advisory locking and transactions, actual purchase/storage adapters, the new server protocol, and the actual browser delivery controller. Their identity, chain evidence, checkpoint-review decisions and renderer callbacks are fixtures. Twenty competing page preparations granted exactly one lease; twelve identical activation calls produced one initial consumption and eleven idempotent responses. Wrong account/payer/hash/key, expired leases, cross-account receipt replay, unsafe roles, forged input and historical mutation were rejected.

The separate browser suite ran the actual Phaser source through Vite, with a real PostgreSQL database and the actual scene loader/controller and service. Production compilation was checked separately; this browser suite did not serve the compiled dist bundle. Test routing injected authentication and already-verified chain/review fixtures and called the new controller directly. It was not a deployed HTTP or installed-wallet checkout test.

Each browser scenario saved an actual exhausted scene, closed the complete original browser context, created a new context, reconstructed the stored flight, activated delivery, restored three lives, and verified physical keyboard movement and shooting. The boss retained 59/180 health. The high-score checkpoint retained its already-earned extra-life award rather than awarding it again. A further fresh page was denied replay of the consumed grant in every scenario. Each order had exactly one delivered journal entry.

Final browser result: passed=4, browserPurchaseCalls=0, activations=5 (one was the deliberate same-request retry), pageErrors=0. Authentication, paymentEvidence and checkpointReview were all explicitly reported as fixture. No real TREE payment occurred.

Evidence artifact: 11134637596, paid-delivery-game-evidence, four mobile screenshots.
Downloaded ZIP SHA-256: f2a716affdcc5b8aef771990c0fc82f5e446246a8233babbb20b171ac158fa6c.
The restored boss and competing-page winner screenshots were visually inspected.

## Corrections during testing

The initial database fixtures reused one synthetic digest across unrelated accounts. The global receipt-reuse defense correctly rejected them. Each fixture now uses its own fake digest, and an explicit cross-account reuse rejection test remains.

The first browser fixture assigned a score over the 10,000-point life milestone but had not run the game's award logic before forcing the last life to be lost. The checkpoint's existing extra-life consistency assertion rejected reconstruction. The fixture now runs the actual updateHud/checkExtraLives path first and explicitly verifies that the earned-life counter remains one before and after recovery. No accounting or security assertion was removed or weakened. The full corrected run passed.

## Remaining release connection

Next integrate the scoped paid-delivery service with the real session resolver and game-over/saved-flight UI, preserving the existing no-payment preview until that integration is ready. Install the new migration and restricted runtime credential/grant only with the reviewed integration; do not grant the practice gateway monetary authority.

Still required before a monetary pilot: trusted checkpoint authorization, durable mainnet receipt reconciliation when the browser loses its digest, user-facing review/recovery handling, protected quote authority, contract publication/configuration, administrator and pilot-payer identities, explicit cumulative/gas limits, and security/operations checks. Then a restricted real 20,000 TREE purchase must restore actual gameplay. The present test run does not satisfy those live-payment gates.

Peter has not reported completion of his manual hosted save-close-reopen acceptance cycle. Automated checks do not silently substitute for that report. No repeat CC top-up or price/recipient/database-install approval is required.

## Guidance consulted

The current MystenLabs/skills README, frontend-apps/SKILL.md, frontend-apps/transactions.md and frontend-apps/limitations.md were checked live during this request. They informed separation of wallet approval from server verification and keeping trusted credentials/authorization out of browser input. Official Phaser scene lifecycle and Vite server documentation were also consulted for the actual-scene test integration.

This documentation-only update does not change the tested implementation or activate a payment route.
