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
