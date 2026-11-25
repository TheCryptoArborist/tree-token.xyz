# Verified native payment completion

November 24, 2026. Source and disposable tests only. Prior CI 45543920674 passed
for 8b09c320. The concurrent holiday review branch advanced to 221b8f1b and was
preserved. No live migration, route registration, publication or wallet action.

The host now supplies a read-only `shared-continue-complete` action. Like the
other shared actions, it requires canonical same-origin POST, a native bearer,
strict fields, trusted runtime/database identity and cutover policy. It accepts
only a payment ID, never browser-supplied completion evidence. Compositions that
do not supply the completion service deny the action.

`createNativePaymentCompletion` authenticates an unexpired session for the
payment's Sui wallet. One SQL statement requires matching runtime-scoped account
and run mapping, native payment evidence, started shared claim with activation
ID, native redemption and advanced native continuation counter. It verifies the
same digest, offer, wallet, run and sequence throughout. A fresh same-wallet
login can inspect historical completion; a different wallet cannot. Incomplete
or unsupported payments return review-required with archiveAllowed=false.
This completion action supports native Sui payment journals only; it does not
claim BNB completion support. It never writes or grants gameplay.

The browser's `archiveCompleted()` compares the verified payment ID, offer,
digest and original native run against its unchanged pending marker. It writes
and reads back a completed archive before removing the pending key. Errors or
mismatches keep payment blocked. Completed archive history is retained; automatic
retention cleanup is not introduced. The UI's Check completion button invokes
this action and reports that no payment or restoration was requested.

A completed shared claim proves server consumption, not that the player saw the
restored scene. If the activation response was lost, archiving does not replay
the scene or compensate the player; the existing restoration controller keeps
its replay-prevention marker. Do not mistake archival permission for a new grant.

## Cancellation boundary

Explicit wallet rejection codes are recorded as cancellation-reported. This is
a user-facing explanation, NOT authoritative proof that nothing was submitted.
The marker remains, and another payment remains blocked. Unknown outcomes and
missing receipts still require reconciliation/review. No automatic clear on a
cancel message, timeout, offer expiry or missing RPC result is permitted.
A complete non-submission recovery/compensation process is still a launch gate;
this milestone intentionally does not pretend that proof of absence exists.

## Tests

completion-tests.json records 83 unit checks, seven real Chromium control checks,
39 Netlify-role database/Phaser checks and 36 original-role database checks.
The database tests cover failure before consumption, matching successful native
redemption, foreign-wallet denial, fresh same-wallet login and counter mismatch.
Browser/unit checks cover verified archive, mismatched receipt/run, archive
storage failure, cancellation retention and the completion button. Existing
record/recover/restore suites remain green. Chain/signing/ownership observations
in the bundled test remain mocked; UI services in the DOM test are injected.

Use the existing commands in recovery-controls.md; CI runs the expanded suites.
No schema or SDK change was required. Next integration gates remain the mounted
native checkout UI, BNB financial flow/completion, operational drain/fencing,
reviewed hosted migration and preservation release. Never publish the historical
root build over current production.
