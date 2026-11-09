# Current revision: Mobile Test 4 — native mobile action bar

Published at https://tree-token.xyz/play/treeforce89/test/ in deployment
`6af21d8911a27d24c02264bc`, November 9, 2026 at 19:23:25 UTC.

The user's iPhone screenshot showed that Test 3 still clipped the bottom of
all three canvas buttons. That physical-device evidence supersedes the earlier
browser-frame fit assessment below. Test 4 replaces mobile canvas controls
with three native HTML buttons outside the canvas: Auto Fire, Shield and Fire.
The existing game methods still handle firing, shield costs and cooldowns.
Desktop controls remain unchanged. Test checkout and score writes stay disabled.

The active viewport displays the playfield and stat rows through world Y=650;
the old canvas action targets below Y=651 are clipped intentionally. The DOM
bar then follows in normal flow, with 56px minimum button heights and padding
below their borders. Canvas position/margins are explicitly anchored because
Phaser's centering produced a negative top margin in the compact test frame.
The game world itself retains its existing 480 × 720 dimensions. Bar sizing
tracks visualViewport resize and safe-area padding. It disappears for title,
loss and completion screens and disables its buttons during Pause/tutorial.

Validation: source-based native-bar tests cover Auto Fire, Fire hold/release/
cancel/lost capture, keyboard, Shield charge/pause gates, blur/visibility,
viewport changes, desktop/scene hiding and cleanup. Existing tutorial/pause
regressions also pass. Browser checks covered 355 × 650 and 390 × 650 frames:
all three buttons measured 56px tall with 10px clearance beneath the bottom
border. Auto Fire toggled; a native manual Fire tap increased shots; charged
Shield consumed its charge; Pause disabled the bar; Resume re-enabled it;
forced completion displayed CANOPY SECURED and removed the bar. Forced loss
also removed the bar. Completion is a QA transition, not a natural playthrough.

The final public domain visibly shows MOBILE TEST 4. Positive NFTree-holder
sign-in and physical iPhone/Safari acceptance remain user checks; the existing
authentication endpoints and gate have not been replaced.

Only three test-path files changed from Test 3. The release report records
preservation of 368 production files, all 46 functions, all five schedules,
runtime settings and environment settings. Automatic publishing remains locked.

## Earlier revision records

# Mobile Test 3 — visual guide and uncluttered HUD

Published at https://tree-token.xyz/play/treeforce89/test/ in deployment
`6af21232514520bf83ab83e9`, November 9, 2026 at 18:36:06 UTC
(12:36 PM America/Chicago), replacing Mobile Test 2.

The bottom HUD now reserves separate rows for growth/weapon information and
three equally sized Auto Fire / Shield / Fire targets. The help icon moves
to the upper HUD; the chain readout is hidden from the compact bottom HUD.
Explicit canvas aspect sizing prevents clipping, and the live leaderboard
starts collapsed behind View live leaderboard. The short collectible key is
hidden while signed-in gameplay occupies the cabinet.

The tutorial uses actual loaded game textures: bat and borer targets, pointed
red shots and a falling limb, and green growth seeds, violet cores, VICTORY
and BOOM pickups. Shoot / dodge / collect explanations are presented in
separate colored rows. It can be reopened from Pause or the question mark.
Existing testers receive the illustrated guide once because its test-only
storage key was updated. Help replay resumes the current mission rather than
starting a new run.

Validation: actual emitted pause/HUD methods checked for paused clocks,
single overlay, tutorial sprites, touch reset, separated stat rows, action
bounds and non-overlapping hit targets. Responsive visual checks covered
390 × 760, 355 × 650, and 390 × 650 browser frames. In a compact frame the
canvas ended at document Y=548, with the collapsed leaderboard beginning at
Y=556 and ending at Y=602, inside a 650-pixel viewport. These are browser-frame
checks, not physical Safari measurements. Final public page shows Mobile
Test 3 and the collapsed live leaderboard opens and closes correctly.

Payments and test score submissions remain disabled. Only four test-path
files changed; original production static assets and backend configuration
were preserved. See the V3 release report for post-publication checks.

## Earlier revisions

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
