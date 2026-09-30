# Hosted flight-recovery preview — deployment and validation

## Current deliverable

The separate game recovery preview is deployed at:
https://deploy-preview-3--treeforce89.netlify.app/

Its paired TREE account service is deployed at:
https://deploy-preview-48--tree-token.netlify.app

Game PR #3 and account/service PR #48 use `preview/flight-recovery` branches. They target main to obtain separate Netlify previews; neither is approval to merge or change production. The previous game PR #1 preview remains separate.

This candidate connects authenticated TREE sign-in to the installed private Supabase recovery storage. A signed-in player can save an exhausted flight, close the browser, reopen this preview, select SAVED FLIGHTS, load the saved flight, and explicitly resume it AS PRACTICE without spending TREE. The 20,000 TREE payment route remains hard-disabled. A saved snapshot is not a verified purchase or paid entitlement.

The fixed launch product remains 20,000 TREE (20000000000 base units at six decimals), three lives, starting weapon, brief protection, one continue per flight, same wave/score, free new flight and casual scoring after continuation. No CC package, dollar conversion, or bonus-credit issuance applies to this product. Its approved recipient remains:
0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f

## Implemented recovery behavior and limits

The data-only formation-recovery.v1 codec captures the actual Phaser game-over scene, checks allowed types and bounded values, and reconstructs a fresh game scene. It preserves the wave, score, surviving enemies and their health, pending spawn progress, RNG state, relevant counters and supported pickups. A restored exhausted scene remains paused with zero lives until the explicit practice action restores three lives.

Recovery is NOT a frame-identical rewind: unfinished dives and attack animations are normalized to a safe formation, transient projectiles are cleared, and active capture/companion assistance is reset. The candidate labels that behavior. This recovery policy and the trusted authorization/replay-lease rules still require review before monetary activation.

Testing found and corrected missing campaign-specific Tyrant armor textures, damaged-leader/captor/corrupted-wing sprites, moving spore fragments and generated circular pickup textures. Fresh-browser reconstruction rebuilds rounded Victory and Sovereign textures using the existing drawing helper rather than reverting to square logos. Corrupted-wing frames and moving fragment velocity are retained. These changes do not retune the original campaign, boss health, weapons or price.

The practice recovery action is restricted to the recovery candidate/loopback test context and permanently marks the reconstructed flight as practice/continued. It is not a bypass made available on the production game. The ordinary TREE payment builder remains unconfigured and /api/tree-continue rejects activation with checkout-not-enabled.

## Hosted service and database

Existing Supabase project: lehswszuekjqottolmsf. No new database project or paid branch was created.

The previous private purchase/flight migrations remain installed. This milestone adds migration 20260930232356, tree_recovery_candidate_gateway_v1, an eighth private candidate_limits table and the narrow public.tree_recovery_candidate_rpc function. The function permits only list/save/recover, binds records to the candidate issuer/environment/account/payer, and enforces preview quotas: 16 saved flights per account, 60 storage requests per minute per account, and 256 candidate quota accounts. These are preview limits, not approved monetary caps.

All eight private tables have RLS enabled. anon/authenticated/service_role have no direct schema access; only service_role can execute the candidate RPC. The RPC cannot write payment receipts, sign quotes, mark a checkpoint validated, or grant restoration/payment authorization. Its replies retain paymentsEnabled=false and restoreAuthorized=false.

The tree-recovery-preview Edge Function is deployed ACTIVE. It uses custom authentication: an opaque TREE session is independently checked against the paired central account service before storage access. Platform JWT verification is disabled for this function because TREE sessions are not Supabase JWTs; the custom session verification is mandatory for storage requests. The public GET response is health information only.

The browser calls a same-origin Netlify proxy using its HttpOnly session cookie. The proxy forwards the session only to the fixed Edge endpoint. The Edge Function uses platform-held backend credentials to invoke the narrow RPC; no credentials, wallet keys or database owner connection are delivered to the browser. The platform service credential itself is privileged; the deployed application operation surface is restricted by the reviewed code/RPC, not by claiming that credential has project-wide least privilege.

Candidate authentication preserves the existing preview account alias namespace for the same Sui wallet, while binding new game sessions to the new candidate origin. Browser-local achievements/history remain origin-specific; opening the new hostname does not migrate or delete records saved on the previous preview.

## Final game and browser validation

Final tested game commit: 5fbcc539470ec1ee03ba841d6fd305bf747d302c.
Last runtime-code revision: 876e172cfd58e1c4db7eeeb70a5f64721811240d; the final commit expands browser scenarios only.
Run: https://github.com/TheCryptoArborist/treeforce89/actions/runs/36792280616
Job: 110147715187, completed SUCCESS. Full logs were inspected.

- 181 direct-flow, game, account, checkpoint and regression Node tests passed.
- 8 campaign tests and 26 records tests passed during the actual build.
- 215 distinct Node test cases in this game run; these are not all newly added coverage.
- Actual Vite production compilation succeeded. Existing non-fatal CSS at-rule and bundle-size warnings remain; no separate typecheck or independent security audit is claimed.
- All 10 browser-close/reopen scenarios passed, one per campaign wave, using the compiled Phaser game, actual gateway/proxy/RPC code and real disposable PostgreSQL.

The browser suite closed the complete browser context, created a new context without the old page state, loaded the checkpoint from PostgreSQL, reconstructed the actual scene, checked state, and then verified physical movement and increased shot counts after the explicit practice resume. Authentication in this suite was a fixture; no installed wallet or real blockchain purchase was involved.

Wave 3 additionally exercised actual game factories/handlers for a damaged leader, root captor, corrupted wing with growth frame 3, three moving spore fragments, and both circular logo pickups. Wave 10 verified that a boss reduced to 59/180 HP retained 59 HP after reconstruction instead of resetting to full health.

Final browser result: passed=10, storageCalls=30, paymentCalls=0, pageErrors=0, realPhaser=true, realPostgres=true. Each scenario retained its expected wave/score and restored three lives, movement and shooting. These are targeted state-reconstruction tests, not a complete human campaign play-through or coverage of every possible mid-animation state.

Evidence artifact: 11131324569, recovery-browser-evidence, containing ten screenshots. Its downloaded ZIP SHA-256 is 74e057bec0d14c0f76b4434dcef1576e77d7db2d6631f972a57d99c475ea802d. Desktop and mobile layouts were visually inspected.

Earlier failing runs exposed a test-identity collision, a fixed-delay keyboard-readiness race and missing runtime texture cases. Test fixtures/timing and the actual codec were corrected, then the complete final suite passed. No payment, ownership or state-integrity assertion was removed to obtain a passing result.

## Gateway and SQL validation

Backend tested commit: bbd136c78b79adcd7c3a4ce7ee855f9e3ddd7cdc.
Backend runtime commit: d7c2fed7f0cfa8da058285d91c91f753e9ab22cc; the later commit fixes test fixture identity only. The game browser suite checked out that same backend runtime.
Run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/36789285777
Job: 110138081717, completed SUCCESS. Full logs were inspected.

17 gateway/authentication/input-boundary tests and 9 actual PostgreSQL RPC tests passed. Cases cover identity injection, expired/EVM sessions, cross-origin requests, bounded canonical snapshot hashing, error redaction, cross-account restrictions, idempotency, wrong payer rejection, public permissions, rate limits and absence of payment/review writes.

## Real hosted authentication and storage connectivity

Run: https://github.com/TheCryptoArborist/treeforce89/actions/runs/36791481150
Job: 110145143698, completed SUCCESS. Full logs were inspected.
Script revision: 44d2e821e31121abb6c55a0be51193975e9d36fb. Later game changes did not alter the hosted authentication/proxy path.

This separate smoke test used a temporary in-memory Ed25519 identity to sign an actual personal-message challenge from the deployed candidate. It established a real HttpOnly game session, traversed the deployed proxy and Edge Function, returned an empty list from the actual hosted database, and verified logout/revocation. Unauthenticated storage access, foreign-origin requests, injected account fields and the disabled payment endpoint were checked. No secret material was logged.

This was NOT an installed-wallet UI test and did NOT save a hosted game checkpoint. The complete save/close/reopen/gameplay test used real disposable CI PostgreSQL; actual hosted authentication/database connectivity was checked separately. Do not conflate these into a completed real-wallet/mainnet purchase acceptance test.

The hosted test wrote no flight, purchase or receipt. Its single ephemeral quota record was removed using an exact test account ID with an absence-of-account-binding guard. A subsequent independent SQL read confirmed zero rows in all eight private tables, including candidate_limits. No immutable purchase history was deleted. The temporary central preview sign-in was logged out.

## Deployment status and user acceptance

Netlify's commit status for final game commit 5fbcc539470ec1ee03ba841d6fd305bf747d302c reports success for netlify/treeforce89/deploy-preview and points to https://deploy-preview-3--treeforce89.netlify.app . The paired account preview is deployed and was exercised by the hosted smoke test. These are deploy previews, not production publication.

Acceptance:
1. Open the new game preview and sign in with the same Sui wallet. Approve a personal sign-in message only; no TREE payment is needed.
2. Start a flight, lose all lives, and wait for SAVED — SAFE TO RELOAD FOR TEST. Note the displayed wave and score. Use SAVE FLIGHT FOR RELOAD TEST if an explicit retry is needed.
3. Close the tab, reopen the same new preview, and sign back in if needed. From the title screen, choose SAVED FLIGHTS and LOAD WAVE ... — PRACTICE.
4. Confirm the matching wave/score, then choose RESUME AS PRACTICE — NO TREE. Confirm three lives, movement and shooting.

The old simulation's last user-confirmed 700 test CC was not queried, migrated or changed. There is no test-credit top-up required here. Existing production and stable preview branches were not changed or merged.

## Remaining before real paid launch

The hosted storage/reconstruction preview is now available; earlier statements that there is no hosted integrated recovery preview are superseded. Paid restoration still needs trusted checkpoint authorization and one-use/replay-safe delivery, durable receipt reconciliation when the browser loses its digest, and review of recovery policy. Contract publication/configuration, quote authority, approved administrator/pilot payer/cumulative and gas limits, security/operations checks, and a restricted real 20,000 TREE purchase with gameplay restoration remain separate monetary-release gates.

No real TREE moved, no package was published, no paid entitlement was created, and no mainnet purchase was tested in this milestone. Recovery storage does not imply an on-chain TREE or gas refund.

## Current guidance

The MystenLabs/skills README and applicable frontend-apps/SKILL.md, frontend-apps/transactions.md and frontend-apps/limitations.md were checked live during this work. They informed server-side secrets/session verification, wallet-managed transaction boundaries and explicit failure handling. Official Supabase API-security guidance informed the RPC/grant boundary; official Netlify preview guidance informed deployment isolation.

This document records completed checks and remaining limits. It does not activate payments or change tested runtime files.
