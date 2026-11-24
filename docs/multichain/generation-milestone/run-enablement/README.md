# Generation 1 review enablement — publication blocked

The November 24 attempt stopped before publication. Netlify requested all 61
function ZIPs after the production environment change, so package reuse alone
cannot apply this configuration. The guard rejected the request; no function was
rebuilt or uploaded. Both newly added flags were removed. The existing locked
live deployment remains `6b053b8285e0ee251b84ad06`, with review disabled.

`blocked.json` records the attempt and exact missing archive identities. There
are 38 exact matching ZIPs locally; recover the remaining 23 from their original
CI release artifacts and verify their SHA-256 values before attempting this
milestone again. Do not rebuild unrelated handlers to bypass this requirement.
Do not rerun the publisher against the incomplete candidate. Refresh the live
plan and verify all package bytes before any further environment mutation.

All 43 focused tests passed; hosted read-only preparation succeeded. Fresh
mainnet checks observed BNB state 4 (Retired), no owner, `canPlay: false`, and Sui
phase 3, generation 1. No authenticated live-wallet acceptance is claimed.

This is the next operational milestone after the database/runtime binding check.
The completed generation 1 remains retired and cannot issue an eligible review
ticket. Review tickets never authorize gameplay or payments.

Run `node --test tests/bnb-run-enablement.test.mjs`, then, in the existing secret-
bound CI environment, `node scripts/prepare-bnb-run-enablement.mjs OUTPUT_DIR`.
The preparation script permits GET-only Netlify requests, captures the complete
current locked production baseline, verifies the review flags are absent, runs
the existing real-chain generation reader, checks the canonical disabled route,
and repeats the baseline capture. No website, environment or database mutation
is performed. The plan retains all current static paths, all complete function
provider records, schedules, runtime metadata and protected setting fingerprints.
The diagnostic binding candidate is explicitly excluded.

## Remaining execution

1. Revalidate the entire fresh plan against current production; stop on drift.
2. Add only the production/functions-scoped nonsecret generation flag `1`, then
   enabled flag `true`. Preserve all other settings and credential bindings.
3. Create a new production-context preservation candidate from the exact plan;
   do not rebuild the historical root or publish the diagnostic candidate.
4. Verify all 691 paths, 61 function/provider records, five schedules and runtime;
   verify the only environment difference is the two approved flags. Wait for
   every queued Git build before locking/publishing the new candidate.
5. Check the canonical review route: no-cookie JSON POST is 401; a correctly
   formatted nonexistent session is 403 `review-denied`, with no ticket, no
   cookie changes, no-store and false gameplay. Recheck existing authentication.
6. Repeat the real-chain retired-generation check and confirm the review table
   remains empty. Save evidence and the new locked deployment in this repository.

Do not claim an authenticated live-wallet acceptance test from these negative
checks. Do not enable another generation, deposits, payment or gameplay. On any
failure stop publication; if already published, disable the review flag and
prepare a fresh preservation release rather than restoring an old deployment.

The user owns the routine daily expired-ticket check once issuance is enabled;
Codex assists on request. Keep records seven days after expiration. No automatic
job or reminder is installed; review counts before any bounded deletion.

Recovery CI 45469679175 verified the original protected baseline exactly and
cancelled the incomplete candidate (terminal `error`). See `recovery.json`.
