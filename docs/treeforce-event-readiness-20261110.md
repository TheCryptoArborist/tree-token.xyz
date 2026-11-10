# Tree Force ’89 — 25 SUI event readiness

## Completed

- Prepared `/play/events/treeforce89-preview/index.html` as a static, noindex review page using the current Arcade styles and existing Tree Force poster.
- Preview card matches the proposed Events tab card exactly. Entry is explicitly closed, dates are unset, and the sole game CTA is practice.
- Preview has no JavaScript, forms, wallet connection or payment actions.
- Checked prize/rules copy, exact article parity, poster path, game links, noindex, script syntax, and whitespace. All pass.
- Published the isolated preview at https://tree-token.xyz/play/events/treeforce89-preview/ and checked its desktop (1363 CSS px) and narrow (340 CSS px) layouts. Artwork loads, rules expand, and links fit without horizontal overflow. The narrow check used browser page zoom; it was not a mobile-device or touch test. Browser zoom was restored.
- The main Arcade Events tab remains unchanged; tournament entry is not open.

## Current production and scoring findings

Published deployment inspected: `6af34e39760c3d568bd12519`, locked, 46 functions and five schedules. Game entry uses `index-session-r2.js` and `arcade-session-r2.js`.

The source and preparation scripts used for that frontend release were located in a previous workspace checkout, under `scripts/treeforce-session/` with release documentation in `docs/treeforce-session-return-20261110.md`. This resolves the current frontend lineage, not recovery of its deployed scoring backend.

The live pilot UI POSTs `{username, run}` to `/api/treeforce89-leaderboard` with the existing bearer session token. It binds its display/save state to the current wallet and run, and describes scores as client-recorded. The production deploy maps this endpoint to `treeforce89-scores`. Its deployed source has not yet been recovered or audited; do not infer absent server validation solely from the client request.

The staged `treeforce89` feature/tree-paid-continue sources provide wallet-bound, server-issued run IDs and continuation records (`tree_game_sessions`, `continuation_number`). Their compatibility with the current deployed gateway must be established before reuse. Server-owned continuation history, event timestamps, immutable result IDs, and evidence review are needed for prize eligibility; a browser flag alone does not prove a three-life run.

## Publication status

Published preview-only deployment: `6af3559fba1ce0403584707f`, locked. Source commit: `0ef9fe3f0986c02b25887fd304d7ec1651a74ac4`. Fresh baseline: `6af34e39760c3d568bd12519`.

The release adds only `/play/events/treeforce89-preview/index.html`: all 390 existing static paths remain byte-for-byte unchanged (391 total). All 46 complete backend records, five schedules, runtime settings, build settings and normalized protected-environment fingerprints match the captured baseline. No game, wallet, payment or leaderboard behavior changed.

After explicit user authorization, all ten historical unfinished deployments were canceled. Each was confirmed to belong to this site, predate October 7, and differ from the live release. Live publication remained unchanged throughout cleanup. See `treeforce-event-stale-deploy-cleanup-20261110.json` for the exact IDs and results.

The active-build safeguard remained enabled for the successful candidate and publication. One transient deployment caused a later candidate attempt to stop; a fresh complete inventory confirmed no unfinished deployments before retrying. The first unpublished candidate was superseded by the corrected accessibility-label candidate; it was never published.

The earlier automatic-review rejection was resolved through the explicitly authorized cleanup, without bypassing the release guard. No active unfinished deployment was canceled outside the ten approved IDs.

Full preservation and layout results: `treeforce-event-preview-release-20261110.json`.

## Remaining

Recover and audit the current deployed scoring backend, then implement event-bound authenticated results and server-owned continuation checks. Verify prize eligibility, duplicate submissions, tie timestamps, wallet binding and event boundaries before opening entries. Confirm event dates in America/Chicago. The proposed main Events card stays in draft PR #119; this preview does not accept entries or pay out the prize.
