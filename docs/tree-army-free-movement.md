# Tree Army courtyard movement — Prototype 0.7

The user requested free movement across the battlefield after reviewing the
Army of Darkness references. The inspected fan implementations use horizontal
player movement with terrain/depth placement; this milestone intentionally
extends Tree Army to two-axis movement. No reference code or assets were copied.

- WASD and all four arrow keys move in eight directions. Diagonal vectors are
  normalized, so diagonals do not give a speed advantage.
- A labeled thumb joystick replaces the left/right buttons. Dragging either
  the pad or battlefield supports any direction, a radial dead zone and analog
  speed. Release, cancellation, lost capture, blur, pause and resizing reset it.
- Movement is bounded to the illustrated courtyard floor (world Y 290–390),
  not walls or sky. Hero Y resets at the start of each wave.
- Troops spawn at varied depths and pursue enemies in two dimensions. Enemies
  pursue nearby defenders. Attack range uses ground-plane distance.
- Auto-fire and Cannon aim across depth; swept segment collision rejects
  targets outside the shot path and retains point-blank collision handling.
- Actors, shadows and health bars move together and draw back-to-front by foot
  position. Existing six-frame gaits follow actual two-axis travel distance.

Validation: gameplay regression harness plus vertical keys/touch, normalized
speed, both floor boundaries, interruption cleanup, enemy depth pursuit,
depth-aware melee, angled auto-fire, and off-path projectile misses. Chromium
checks at 1440×1000, 390×844, 320×568 and 844×390 cover joystick, vertical and
diagonal dragging, multi-touch summon/release, all controls in the viewport,
labels, artwork loading, pause, abilities and tutorial. Existing production/
preview build and release-plan checks also pass. Physical-device testing remains
separate from browser touch emulation.

The release replaces only `/play/tree-army/test/index.html`, pinned against the
last published game HTML. It captures and preserves the full current production
inventory, backend packages, schedules, configuration and snippets. Cabinet
media remains the prior gameplay preview; no new assets or dependencies.

## Initial blocked release attempts (resolved)

Implementation merged through PR #269 as
`5cb9630efb1faec70916f4e4f46a6d3816dfe2a7`. Workflow `44865719998` passed all
local gameplay/browser checks but Netlify returned HTTP 403 on candidate
creation. No candidate was published. The canonical playtest remains 0.6 on
locked deploy `6b00892b6acd6fc92a18fd20`. A bounded provider-error diagnostic
now reports code/message/error fields without logging request payloads or
credentials, so a retry can identify the provider-side cause.

Diagnostic retry `44866213576` (source
`7bd1a07c4c4ce484ba2addf2cdd0bcb5003bb7d9`) passed gameplay and all four browser
layouts again, then returned the provider's exact cause on candidate creation:
**Account credit usage exceeded - new deploys are blocked until credits are added**.
This is a Netlify account credit block, not a gameplay failure. No deployment
was created or published. The team owner must add credits before a fresh scoped
release can proceed. Do not work around the credit block with a different site
or historical production build.

Saved pre-publication evidence: `docs/tree-army-courtyard-local-checks-20261120.json`
and `docs/tree-army-courtyard-preview-20261120.png`. These are CI-local checks,
not canonical-site evidence. Original artifact 14691394067 has SHA256
`8fea03b2904cbfadcdfaf8bbd8c21d4a243d8575503338f1e614f20464bcf258`.
The earlier accidental dispatch `44865447132` was canceled with no jobs after
a concurrent main-branch update rejected the first merge attempt.

## Published after credits were added

Workflow `44867337174` successfully published source
`bcb8df4d0cecc94eb33fa918554a58e6a380a7f6` to locked deploy
`6b01217f8e1995306b794031`. Candidate and canonical tests passed at all four
sizes, and the final 320px screenshot was inspected. The release preserves
648 unrelated static paths, all 50 backend records, five schedules and protected
configuration. Complete published inventory and canonical checks are in
`production/tree-army-courtyard-*20261120.json`; live screenshot:
`docs/tree-army-courtyard-live-20261120.png`. The game is now live at
https://tree-token.xyz/play/tree-army/test/ .
