# Tree Force ’89 — 25 SUI event readiness

## Completed

- Prepared `/play/events/treeforce89-preview/index.html` as a static, noindex review page using the current Arcade styles and existing Tree Force poster.
- Preview card matches the proposed Events tab card exactly. Entry is explicitly closed, dates are unset, and the sole game CTA is practice.
- Preview has no JavaScript, forms, wallet connection or payment actions.
- Checked prize/rules copy, exact article parity, poster path, game links, noindex, script syntax, and whitespace. All pass.
- Inspected the published Arcade Events tab in the browser. It still displays its placeholder. Desktop/mobile visual validation of the new card is NOT complete: local Chromium could not launch in this environment and no preview was published.

## Current production and scoring findings

Published deployment inspected: `6af34e39760c3d568bd12519`, locked, 46 functions and five schedules. Game entry uses `index-session-r2.js` and `arcade-session-r2.js`.

The source and preparation scripts used for that frontend release were located in a previous workspace checkout, under `scripts/treeforce-session/` with release documentation in `docs/treeforce-session-return-20261110.md`. This resolves the current frontend lineage, not recovery of its deployed scoring backend.

The live pilot UI POSTs `{username, run}` to `/api/treeforce89-leaderboard` with the existing bearer session token. It binds its display/save state to the current wallet and run, and describes scores as client-recorded. The production deploy maps this endpoint to `treeforce89-scores`. Its deployed source has not yet been recovered or audited; do not infer absent server validation solely from the client request.

The staged `treeforce89` feature/tree-paid-continue sources provide wallet-bound, server-issued run IDs and continuation records (`tree_game_sessions`, `continuation_number`). Their compatibility with the current deployed gateway must be established before reuse. Server-owned continuation history, event timestamps, immutable result IDs, and evidence review are needed for prize eligibility; a browser flag alone does not prove a three-life run.

## Publication status

No preview or event was published. The existing live Events page, game, wallets, payments, backend functions and scheduled jobs remain unchanged.

The preservation check found ten unfinished historical deployments (August–October), in `prepared`, `uploading`, or `new` states. Automatic approval review rejected an attempted removal of the candidate’s active-build check. The check was restored; it remains enforced for candidate creation, verification and publication. No alternate deployment path was used.

IDs reported by the read-only inventory:

- 6ac52820279f7eb4a8d2457f — prepared
- 6ac527e17cf112fbffd1d846 — prepared
- 6ac5279f64ded4fdb3ab3beb — uploading
- 6ac52772cdbea704934a7104 — uploading
- 6ac51f782d2f32b1d81cc2ee — uploading
- 6ac51ee343f065a97870c8c1 — uploading
- 6aaef0c3bef6988a2854e692 — uploading
- 6aaa1e51ab04ece07223c51a — uploading
- 6a88c1e0f4f19fa43716b98e — new
- 6a862cb81463fc03bfff46fa — new

## Remaining

Resolve unfinished deployments without bypassing release checks; capture a fresh full baseline; stage and verify the single added preview path, preserving all prior paths, exact function records, runtime settings and schedules. Then perform desktop and mobile visual checks before publication. Tournament dates and scoring integration remain pending. No payout has been initiated.
