# Tree Force ’89 active-session renewal and held-run recovery

Published November 10, 2026 at 11:51 AM America/Chicago as
`6af359316cee71c48cb0ce4e`, preserving baseline
`6af3559fba1ce0403584707f`. The final inventory has 47 functions
(46 original packages unchanged plus one renewal function), five schedules and
393 static paths. Production remains locked. The canonical game boots and its
DOM confirms index-renewal-r3.js.


The prior live gateway unmounted Phaser immediately when authentication expired.
This release keeps the same scene instance paused and held in memory. The app
renews eligible, near-expiry sessions while the page is visible and the player
has recent pointer/keyboard activity. Refresh runs at most every 30 seconds,
only within the final 15 minutes of validity, and rechecks direct NFTree
ownership before extending access. Automatic renewal is capped at 24 hours
from the existing session row's creation time. The wallet is never asked to
sign automatically.

If access has expired or ownership cannot be established, the game pauses and
a clear Verify & resume run action is shown. A fresh, same-wallet signed login
through the unchanged existing gateway is required. The isolated renewal
function locks both session rows, consumes the fresh session, rotates the
held run's credential and retains its original run ID and all gameplay/payment
columns. It never supplies extra lives, rewinds a wave, modifies a score or
creates a paid continue. Different-wallet, old-proof, used-proof, completed-run
and old-run recovery requests are rejected. An old bearer credential alone
cannot recover an expired session.

Recovery is idempotent for a lost response. The replacement credential is
derived from both high-entropy bearer secrets; neither stored token hash is
sufficient to derive it. An atomic successful exchange can be retried with the
same two inputs, without another signature or extending expiry. The browser
holds the fresh proof in memory during retry and drops it on wallet change or
successful recovery. No credentials are added to persistent browser storage.

The Phaser key and initial scene are unchanged on renewal/recovery. The
mission profile remains mounted but inert while verification is paused, so
pending results are retained. The player explicitly resumes the paused scene.
Connection-interruption and verification-expiry messages are distinct.

## Scope and validation

- Twenty automated service, HTTP, client and emitted-handler checks pass.
- Tests cover ownership denial, concurrent logout, caps, same-wallet fresh
  recovery, invalid/expired/used proofs, replay after a lost response, origin and
  size rejection, unbounded response rejection, and no scene reset on retry.
- Both emitted JavaScript assets pass syntax checks.
- The staged page boots at the NFTree gate without application console errors.
- Hosted missing/invalid-token and foreign-origin checks return 401/401/403.
- All existing backend packages and five schedules must match the captured
  baseline before and after publication; the new isolated function is the only
  backend addition. No schema migration or environment change is required.
- Packaging uses pinned @mysten/sui 2.37.0, @netlify/database 2.0.1 and
  @netlify/zip-it-and-ship-it 16.3.0; runtime remains nodejs22.x/stream.

The exact Slush-browser incident has not been reproduced with a real holder
wallet. Successful holder re-sign/recovery and long-running Slush play remain
end-to-end user validation. No wallet signature, score write or payment was
created during hosted checks. This release addresses the confirmed expiry
interruption and improves diagnosis; it does not establish that expiry caused
the player's original report.

Hard refresh, tab closure and mobile OS tab eviction remain outside the
in-memory recovery boundary. Keep the game page open during verification.

## Reproduction

Install locked dependencies in vendor/treeforce-renewal with npm ci, then run
scripts/treeforce-renewal/prepare.mjs and package.mjs. Run
`node --test tests/treeforce-renewal.test.mjs`. Release tooling under
scripts/treeforce-renewal/release captures, stages, verifies and publishes
against a fresh current preservation baseline, with all queued builds terminal.
Never run the historical root snapshot build as a production substitute.
