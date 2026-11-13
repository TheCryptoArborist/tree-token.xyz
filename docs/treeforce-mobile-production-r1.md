# Tree Force ’89 — approved mobile production release R1

Main game: https://tree-token.xyz/play/treeforce89/.
Published deployment: `6af2269339c88800be3ea322`, November 9, 2026 at
2026-11-09T20:03:13.335Z (2:03 PM America/Chicago).
User accepted the mobile gameplay, full hero/Arborwing visibility and end-of-run
username flow on iPhone, then authorized promotion to the main game.

This release uses the approved mobile controls, Pause/Resume, illustrated
shoot/dodge/collect tutorial and full-sprite flight lane from Mobile Test 6.
The main game retains its original authenticated username/score/achievement
endpoint. Its pilot panel starts collapsed, opens at mission completion and
scrolls into view. Server-loaded pilot name/badges are retained; successful
saves are confirmed only after the server replies successfully. A late save
response for a different wallet/session is ignored in the UI. Test localStorage
results are never imported into public rankings.

The original wallet, session, NFTree and payment code is byte-identical outside
the profile UI, module-link names and build label. Existing 20,000 TREE continues
remain active in the main game. Test payments remain disabled at the separate
test path, whose files are preserved. No on-chain transaction was executed.

New versioned JS/CSS assets keep old tabs working with the retained original
modules. Only the existing main index.html changes; four new main-game assets
are added. All 380 other existing static paths, all 46 backend records/configs,
five scheduled jobs, runtime and environment settings are preserved. Automatic
publishing remains locked. See treeforce-mobile-production-r1-release.json for
the final publication identity and preservation result.

## Validation

- Emitted save-function tests exercise the unchanged authenticated POST body,
  name-only writes, matching-run guard, server success/failure, retry state,
  stale-wallet response guard and username-cache failure after server success.
- Existing tutorial/Pause, native touchbar and complete hero frame clearance
  regressions pass. Generated JS modules pass syntax checks.
- A 390 × 650 browser fixture using the actual production profile code and a
  simulated server loaded ExistingPilot, showed a 500-point mission, reported
  an intentionally failed save, then saved MobilePilot and one badge on retry.
  Refreshing reloaded that profile via the authenticated GET code path.
- Live public leaderboard GET succeeds. Invalid-token GET returns public
  entries without a personal profile. Same-domain POST with absent/invalid
  sessions returns 401: Verify your NFTree to save your pilot profile. Calls
  lacking a permitted Origin are rejected separately with 403.
- Full unpublished candidate boots with the original NFTree gate, continue
  price and MOBILE R1 label. Five changed/new asset responses match their
  expected hashes, allowing only the existing Netlify HTML nav injection.
- Final canonical main page and post-publication preservation are checked.

The browser save scenario uses simulated server responses; it is not a real
NFTree-holder sign-in, live successful score write or paid continue. The owner
can complete one authenticated main-game run, Save score, then refresh to
confirm the live end-to-end result on the phone. No fake leaderboard entry or
payment was created for validation.

## Reviewed references and release workflow

Current MystenLabs/skills README, frontend-apps/SKILL.md and
frontend-apps/react.md were reviewed. Existing dApp Kit and authentication APIs
were retained; wallet-gated effects and late async UI updates remain guarded.
Netlify deployment guidance was checked for locked, atomic manual deployment.

Preparation: scripts/prepare-treeforce-mobile-production.mjs rebuilds the
reviewed test layout, compares original production wallet/game modules with
live source, restores the original authenticated profile contract and emits
new versioned production files. Its source fingerprint assertions stop on
unexplained drift. It proves all other entry-module bytes remain original.

Release scripts: scripts/treeforce-production-release/{capture,stage,verify,
http,publish,verify-post}.mjs. Run from a workspace containing release/live and
release/mobile-production. Capture takes the explicitly reviewed deployment
ID; stage requires all 46 functions/five jobs, the locked baseline and the exact
one-file/four-addition allowlist. It forbids backend uploads. Verify/http must
pass before deliberate publication; publish rechecks baseline, settings and
environment and locks the newly published snapshot. Verify-post repeats all
preservation checks. Do not use a standard historical repository build.
