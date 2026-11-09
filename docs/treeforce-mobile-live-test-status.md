# Current mobile test revision: Mobile Test 2

Published deployment `6af20f9078d58b0a05fe6d65` on November 9, 2026 at
18:23:55 UTC (12:23 PM America/Chicago), replacing the first mobile test
snapshot `6af209ff9c76670c2a66714a`. The player URL remains
https://tree-token.xyz/play/treeforce89/test/.

Only four existing test-path files changed. The 368 production files, 46
backend functions/configurations, five schedules, runtime and environment
settings remain protected. Payments and test score submission stay disabled.

This revision adds replayable How to Play in Pause, opens the short tutorial
from the question-mark control, enlarges the Pause target, prevents native
page gestures over the signed-in game canvas, and explicitly identifies live
rankings as read-only. The tutorial explains Shield growth/charge requirements.
The test's Save control is disabled.

Validation: generated module syntax checks; source-based pause regression
covering tutorial start, help replay without resuming clocks, one overlay,
resume and cleared touch inputs; responsive 390 × 760 visual check of pause
and help replay; final public page/test label and live leaderboard read.
Asset responses use max-age=0,must-revalidate. Real iPhone/Safari acceptance
and successful NFTree-holder sign-in remain player checks.

## Initial release record

# Tree Force ’89 mobile test — published

Test URL: https://tree-token.xyz/play/treeforce89/test/
Published November 9, 2026 at 18:01:08 UTC (12:01 PM America/Chicago).
Deployment: `6af209ff9c76670c2a66714a`; previous production snapshot:
`6af1c0e464d4cdc85c4e9c34`. Automatic publishing remains locked.

The test adds 13 static files beneath the test path. All 368 preexisting
static paths/digests, 46 exact backend records/configurations, five schedules,
runtime fields, and API-visible environment settings were verified before
and after publication. Netlify lowercases manifest paths and injects the
existing Arboretum navigation snippet into served HTML; those transformations
were inspected. Environment entries are sorted before fingerprinting because
the API returns the same records in varying orders. All 53 settings last
changed before staging (latest update November 5).

The copy derives from the live game modules `index-C7sLq93z.js` and
`arcade-CdwOWItr.js`, retaining existing `/play/treeforce89/api/` wallet/session
routes. No new backend endpoints were deployed. The separate feature branch's
new test-authentication endpoints were not used for this release.

Changes: viewport sizing based on PR #112, touch Pause/Resume overlay, first
mobile tutorial, Auto Fire on touch, taller action buttons, no dragging while
paused, and a continuously identifiable Shield label. Test checkout throws
before signing or requesting an offer. Test score submission is disabled.
Pending-checkout and pilot-name storage keys are separate from production.

The reproducible preparation script checks pinned source fingerprints and
preserves the production authentication URL strings. Do not replace the live
snapshot with a standard historical repository build.

## Verification

- 390 × 760 responsive browser frames: navigation, simulated wallet-status row,
  full game canvas, all action buttons, and item legend fit.
- Tutorial starts correctly; Auto Fire, manual Fire, charged Shield, touch
  Pause/Resume, and offline restart after loss were checked.
- Paused dragging keeps player position unchanged. Loss and victory scenes
  were inspected using forced QA transitions, not a natural full playthrough.
- A fresh disposable wallet received a production-domain sign-in challenge
  (201), its valid signature was denied NFTree access (403/NFTREE_REQUIRED),
  and challenge replay was denied (401). No transaction was signed or paid.
- The final public page, wallet picker, live leaderboard read, original game
  entry bytes, and lazy wallet module were checked on tree-token.xyz. The www
  URL redirects to the canonical apex domain.

Real iPhone/Safari playthrough and successful sign-in by an NFTree holder
remain player acceptance checks. Browser-frame testing does not replace them.
