# TREE FORCE joins the Arcade Passport

## Intended behavior

From the November 2026 UTC season onward, Arcade Passport requires four game stamps:

1. Garden Bot — an official completed battle, win or lose.
2. PvP Battle — an official completed battle, win or lose; its existing paid entry applies.
3. Arborist Trials — an official saved result from the daily predetermined-card challenge.
4. TREE FORCE ’89 — a recorded authenticated run that reaches the first wave. Finishing or winning the run is not required.

TREE FORCE appears in the same two-column stamp grid as the other three games. Its unearned card says “Start a run · Reach the first wave”; a saved run says “First wave started · Stamp earned.” The progress counter and meter use the server’s four required games. The separate optional TREE FORCE section disappears for this season.

The Passport remains an optional monthly badge. Check-ins and daily quests do not require paid PvP or completion of all four games. Opening a game link alone does not award a stamp. The compact Daily Growth invitation and its check-in actions remain unchanged.

## Seasonal rules and existing progress

The database is the source of truth for the frozen monthly requirements. October 2026 retains three required Garden games and its optional TREE FORCE stamp. November and later seasons add TREE FORCE to the required set, including the already-created November rule. Existing November TREE FORCE records count immediately; the migration does not rewrite any game event, attendance, daily quest, authentication record, or earned badge.

Both the Daily Growth handler and TREE FORCE’s existing ingestion RPC continue sending their original three-game fallback. The updated database helper adds TREE FORCE from November onward before freezing a new season. This also covers a future month whose first participant enters through TREE FORCE. Existing frozen rows retain precedence, and the migration explicitly extends saved November-and-later rows once.

The Garden result adapter still accepts only its three official completed-result modes. TREE FORCE continues using its existing authenticated first-wave reporting path. Wallet signatures, ownership checks, gameplay, paid continues, and dependency locks are unchanged.

## Reviewed rollout

1. Apply and verify the migration on the existing development database branch, including rolled-back synthetic award tests.
2. Publish the compatibility backend and interface while production still returns the earlier three-game rule. The new handler accepts either three or four requirements.
3. Apply the identical migration to production only after the compatible function is published and verified.
4. Verify the live API and canonical website expose four required games, and compare stored activity and historical rules against the pre-migration inventory.

This ordering prevents the earlier handler, which rejects four required IDs, from receiving the new rules during deployment. Source and release evidence use `feature/treeforce-passport-20261101`.

## Validation before publication

- 69 backend, monthly-model, Garden adapter, and TREE FORCE reporting tests passed.
- 32 controller tests passed, including four required stamps, first-wave credit, unearned completion rejection, and October compatibility.
- Three database fixture suites passed on the existing development branch. All synthetic rows were rolled back. The new seasonal suite contains 45 assertions covering first-season freeze, incomplete subsets, exactly-once awards, historical badge timestamps, and access controls.
- Five extracted-package scenarios passed, including the actual pinned signature verifier, three- and four-game session responses, wrong-account/wrong-message rejection, and authenticated first-wave reporting. No network request or transaction occurred in those fixtures.
- 16 native browser checks passed across nine synthetic contexts at widths 1440, 390, and 320. Four stamps form a two-by-two grid, no horizontal overflow or browser errors appeared, and a verified fixture advanced 3/4 to 4/4.
- Collapsed Daily Growth heights match the preceding release exactly. Existing artwork is reused; no CSS or game asset replacement is needed.
- The unmodified archived source-parity gate passed for all 38 archived handlers, executable dependencies, routes, and five schedules in an isolated copy of its intended source set. The ordinary root gate first rejected the known additional `arcade-growth` handler because the archived manifest lists only 38 functions. No archived handler was changed to resolve this inventory mismatch.

Browser sessions and saved progress used for visual QA were explicitly synthetic. Production checks are read-only; no real wallet signature, transaction, or fabricated production participation is used to validate this release.

## Release preservation

The guarded release overlays only `/play/index.html`, `/scripts/arcade-daily-growth.js`, and the explicitly reviewed `arcade-growth` function package on the captured current production inventory. All 283 static paths remain present; the other 281 static files, 40 complete function records, five schedules, runtime settings, environment settings, and publication lock are preserved. Current Canopy Defense and Deadfall Run additions remain in place.

The ordinary root snapshot build is historical recovery material and must not be deployed for this update. The existing Canopy Defense authentication store is deployment-scoped, so its active short-lived sessions may need to sign in again after publication.

Evidence: `treeforce-passport-database-dev.json`, `treeforce-passport-function.json`, `treeforce-passport-packaged.json`, `treeforce-passport-archived-parity.json`, and `review/treeforce-passport/`. The final production receipt and database verification are recorded after publication and rule activation.
