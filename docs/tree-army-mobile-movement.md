# Tree Army mobile controls and locomotion — Prototype 0.6

The mobile report exposed two problems: controls could sit below the visible
battlefield, and moving troops used a static illustration with a tilt.

The mobile command deck now fits one dynamic viewport, including safe-area
padding. Hold Left/Right, all three troop cards, Cannon and Shield stay visible.
Labels explain automatic firing, summoning and ability roles. A direct Start
battle option accompanies the optional tutorial. Horizontal battlefield dragging
moves the hero; crossing the starting point reverses direction; lifting stops.
A 12px dead zone prevents accidental motion. Pointer cancellation, lost capture,
window blur, pause and resize clear movement. Keyboard controls still work.
Canvas dimensions follow the actual stage ratio so portraits do not stretch art.

Troops and thorn runners have six stepping poses, fixed scale and ground anchors,
and gait phase driven by distance traveled. Stopped actors and paused battles
freeze gait. Same-type allies keep spacing; melee allies can pass archers.
Machines remain level with distance-driven wheel highlights. Original attacks
and hero artwork remain. These are prototype pose cycles; further animation
polish and a dedicated boss sprite remain future work.

Validation:
- Logic harness: waves, upgrades, combat, restart; drag dead zone/reversal/release;
  cancellation, pause/blur cleanup, distance-driven movement and frame wrapping.
- Chromium: desktop 1440×1000, portrait 390×844, small phone 320×568 and landscape
  844×390; all seven action buttons in viewport, touch-target heights, trusted
  touch dragging/reversal/release, no page scroll, correct canvas proportions,
  tutorial, summons, abilities, pause and artwork failure.
- Six pose samples rendered on the battlefield and inspected, plus phone and
  landscape screenshots. Browser phone emulation is not a physical-device test.
- Preservation plan tests and complete historical production/preview build test.

Publication allowlist: replace only `/play/tree-army/test/index.html`, pinned
against its current published SHA1; add only `assets/forest-walk.webp` beneath
that playtest. Fresh full inventory, backend/runtime/configuration and snippet
preservation are mandatory in the release workflow. Existing cabinet/video
remain the prior actual-gameplay preview. No backend or dependency changes.

Initial publication: PR #256, source `83332f28a15936387464a12fb830b00b2060cb4c`,
deploy `6b0062b486ca536dd1768394`, workflow `44760037142`. Full inventory is in
`production/tree-army-mobile-initial-release-20261120.json`: 640 static paths,
638 unrelated paths preserved, all 50 backend records and five schedules.
Live screenshot inspection caught a production-font fit issue on the Guardian
card at 320px. The follow-up narrows portraits/text only below 361px and adds
an assertion that rendered troop-name text stays inside each card. Its release
plan replaces only the newly pinned HTML; the atlas is already published.
