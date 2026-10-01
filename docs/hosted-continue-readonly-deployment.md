# Hosted continue integration: deployed read-only milestone

## Completed scope and boundary

The recovery preview now uses the actual hosted account-verification and private purchase-lookup services. The new recovery entry is above the canvas next to sign-in. A live Sui gRPC probe confirms network identity and TREE metadata. Three database migrations and the new Edge Function were installed, and the final hosted acceptance run passed.

This is NOT a mainnet payment launch or the full hosted paid-purchase service. The deployed route cannot create/sign orders, ingest payment receipts, approve checkpoints or activate paid lives. A configured purchase-receipt verifier is still absent from this hosted route. Those monetary service connections, contract configuration and acceptance remain work, not merely an environment switch.

Product unchanged: 20,000 TREE (20000000000 raw units at six decimals), three lives, starting weapon, brief spawn protection, same wave/score, one continue per flight, casual scoring and free new games. No Canopy Credits package is required.

Coin: `0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`

Recipient: `0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`

## Actual hosted deployment

Game: https://deploy-preview-3--treeforce89.netlify.app/

Final game commit: `37d67e08516f9d8cac435f2bb6f67007e8eb302d`.
Netlify deployment: `6abdc807517d81000731b358`, ready at 2026-10-01T02:40:30.886Z, context deploy-preview, review 3, branch preview/flight-recovery, published_at null. The Netlify API and PR bot both confirmed this exact commit.

The game feature branch was fast-forwarded into preview/flight-recovery, not main, after the isolated validation run passed. PR #4 was consequently marked merged into the preview branch; its earlier unmerged-status description is historical. PR #3 remains the preview/release boundary. The main public game deployment was separately checked and remains `6a9d79efef404400084bec93`. The database did receive approved changes; do not describe the whole production environment as untouched.

Backend tested commit: `378829c42ce7c8752cf28eedd5b19bf3c54d817a`, feature/paid-continue-delivery, draft PR #49. This also contains the hosted verification script previously developed on verify/hosted-continue-readonly. The backend auth-preview issuer branch and public application main were not advanced.

## Three migrations installed in Supabase

Project: `lehswszuekjqottolmsf`; private schema: `tree_continue_v1`.

| Recorded version | Migration |
|---|---|
| 20261001020648 | tree_continue_paid_delivery_v1 |
| 20261001020823 | tree_continue_purchase_recovery_v1 |
| 20261001022226 | tree_continue_hosted_preview_lookup_v1 |

The first two install the previously tested receipt-bound delivery protocol and purchase-recovery lookup. The last adds a fixed-issuer read-only purchase-lookup wrapper and rate-limit counters. There are twelve private tables, all with row-level security enabled. The platform service_role can execute the narrow public lookup wrapper but cannot directly select private orders or invoke the private paid-delivery function. Neither anon nor authenticated can execute the wrapper. Delivery/recovery roles are NOLOGIN; only the postgres administrator has membership, not a deployed runtime login.

The general platform service key is not claimed to be globally least-privileged. It stays server-only; the relevant private-schema permissions are restricted. The original practice storage gateway receives no financial authority. No synthetic orders, receipts, checkpoint approvals or paid entitlements were inserted into hosted storage.

After hosted acceptance, SQL at 2026-10-01T02:43:43.683459Z confirmed orders=0, receipts=0, paid_deliveries=0, checkpoint_reviews=0. There are three preview lookup quota identities from the actual read-only test sessions. Authentication history and quota counters can exist; the whole database is not claimed empty. Unrelated application tables were not targeted.

## New hosted function and read-only connection

Edge Function: `tree-continue-preview`, version 1, ACTIVE.
ID: `28b53323-4c5b-4466-a449-0a8567869141`.
Deployment bundle SHA256: `129c4942e523f4b6c82c2dfbdf132f0067acb20c6709400026e0de9f961a55d0`.

The function verifies the opaque TREE session against the pinned issuer at https://deploy-preview-48--tree-token.netlify.app. Supabase JWT verification is disabled because this route performs custom opaque-session verification itself; a caller is not accepted without the issuer's valid response. The same-origin game proxy forwards the secure HttpOnly cookie token server-to-server. Secrets remain in the Edge Function environment, never the browser, repository or evidence archive. The deployed gateway and committed source have comment-only differences; byte identity is not claimed.

POST status returns the actual mainnet probe with enabled=false, checkoutConfigured=false and restoreAuthorized=false. list_purchases queries actual account-scoped storage. recover_purchase reports a missing order distinctly; an existing stored order remains blocked rather than being reverified or consumed by this read-only service. All order/reconcile/cancel/delivery actions are refused. Storage errors are errors, not fabricated empty purchase lists.

The probe transport permits only GetServiceInfo and GetCoinInfo on the fixed mainnet node. It verifies the genesis, a fresh checkpoint and the canonical TREE type/precision. It cannot submit a transaction or attest a purchase receipt. The separate staged full transaction reader and receipt decoder still require reviewed deployment configuration and runtime connections.

## Isolated validation passed

Run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/36806697353
Job: `110192518138`, completed SUCCESS including cleanup.
Backend: `378829c42ce7c8752cf28eedd5b19bf3c54d817a`.
Game: `37d67e08516f9d8cac435f2bb6f67007e8eb302d`.

All individual workflow steps succeeded. This work added 44 distinct automated cases: 30 hosted gateway/probe tests, 9 actual PostgreSQL lookup/permission/concurrency scenarios, and 5 game gate/placement tests. The game regression total is now 234 including those five (200 plus campaign 8 plus records 26). Existing 28 paid-delivery PostgreSQL scenarios and 19 purchase-recovery PostgreSQL scenarios also passed. Enclosing Node parent tests are excluded from the scenario counts. Production compilation passed; prior nonfatal CSS/bundle warnings remain. No separate typecheck or independent audit is claimed.

The four existing Vite-source/Phaser/database browser scenarios and four compiled-default-UI/HTTPS/database scenarios passed again. Authentication, chain data and checkpoint approvals in those isolated suites remain explicit fixtures. The completed workflow and all step summaries were inspected; this report does not claim a fresh full raw-log review of the isolated run.

## Actual hosted acceptance passed

Run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/36806916287
Job: `110193198759`, completed SUCCESS including cleanup.
Script commit: `378829c42ce7c8752cf28eedd5b19bf3c54d817a`.
Results timestamp: `2026-10-01T02:41:24.233Z`.

All eleven check groups passed:
1. Correct hosted read-only gate.
2. Unauthenticated lookup rejected.
3. Real issuer personal-message sign-in and HttpOnly session.
4. Real hosted mainnet network and TREE metadata.
5. Real account-scoped empty purchase lookup.
6. Missing order distinguished from a payment.
7. New order and paid activation operations blocked.
8. Identity injection and foreign-origin requests rejected.
9. Actual compiled recovery panel opened and closed at 390, 320 and 1200 pixel widths.
10. Revoked session rejected by the lookup route.
11. No browser page errors.

The live probe observed checkpoint 328891671, chain identifier 35834a8a, name Thickquidity, symbol Tree, decimals 6, and the fixed raw price 20000000000. Its receiptVerificationConfigured value remained false.

This test used a newly generated, unfunded, temporary signing key only for the real server-issued personal-message challenge. It did not use an installed wallet extension. Account verification, database calls, Netlify, Supabase and Sui node reads were actual hosted services, not HTTP fixtures. Counters: transaction signatures=0, purchases created=0, fake paid receipts seeded=0, paid continues activated=0. Gameplay save/close/reopen was not retested against hosted services in this run; the isolated gameplay suites and Peter's still-unreported installed-wallet acceptance are separate.

## UI issue found and corrected

Two initial hosted runs (36805704067 and 36806096144) passed the first eight check groups but failed during pointer interaction with the recovery entry. Diagnostic images showed that the entry had been appended below the full game frame, where Netlify's mobile collaboration toolbar could obscure it. The second diagnostic had no page errors. Updating software WebGL settings did not resolve the placement problem.

The application was fixed: the recovery entry is now a full-width, minimum-44-pixel button immediately above the canvas, next to account controls. A DOM placement/disposal regression test was added. The final hosted test used ordinary pointer clicks, left the preview toolbar intact, and asserted that the button was above the canvas without horizontal overflow. It did not force clicks, remove overlays, or relax payment/security assertions. The final mobile entry and recovery-panel screenshots were visually inspected.

## Downloaded evidence

Artifact: `11137932565`, hosted-continue-readonly-evidence.
Archive size: 1629006 bytes, seven files: six screenshots and results.json.
Downloaded SHA256 verified: `21300bf12e7c151c4d192af4f2921cb2fe630792ca38156618754884d162e3f8`.

The archive contains no session cookies, private keys, message signatures or database credentials. It records the real temporary test account only as a shortened public address in the UI. The final results JSON was read, not inferred from an in-progress job.

## Next monetary work and user testing

The preview now supports an installed-wallet sign-in and RECOVER TREE PURCHASE lookup test; an account with no purchases should show No purchases were found for this signed-in account. No TREE purchase is needed. A currently open unsaved flight should be saved before refreshing the preview.

Next engineering work is the reviewed quote/receipt/delivery runtime connection and checkpoint eligibility authorization, followed by the paused mainnet checkout publication/configuration and restricted real 20,000 TREE acceptance. Administrator and pilot purchaser public addresses, cumulative limits, gas settings and the operational review/refund/regrant policy remain unresolved. The purchaser must differ from the approved sales-recipient wallet. Broader historical receipt discovery remains unimplemented; an empty bounded recent-event scan does not prove nonpayment. No monetary feature may be enabled merely to make a test pass.

No transfer or Move package was published or signed in this work. The old simulation-credit balance was not queried, topped up or migrated. Existing database-installation approval, fixed price and recipient are already resolved and should not be requested again.

Guidance reviewed during this request: the current MystenLabs/skills README; frontend-apps/SKILL.md, frontend-apps/transactions.md, frontend-apps/limitations.md; accessing-data/SKILL.md and accessing-data/grpc.md; current official Sui SDK gRPC references, Supabase function/auth references and Netlify serverless coding context.
