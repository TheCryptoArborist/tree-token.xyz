# Tree Force ’89 — Defend the Canopy

Status: draft announcement; not launched. Sponsor: Peter Toler. Prize: 25 SUI to one verified winner. Dates: pending.

The Events panel now contains the game poster, prize, proposed rules, and a practice link. There is no entry button or standings claim. No badge is promised because event badge support is not implemented.

## Launch requirements

- Confirm Friday–Sunday opening and closing instants in America/Chicago and persist exact UTC timestamps.
- Locate and preserve the current published Tree Force source. The standalone repository main branch is historical; feature/tree-paid-continue also predates current published index-session-r2.js.
- The inspected live client calls /api/treeforce89-leaderboard and labels scores client-recorded, with paid continues retaining run and score. Do not use that all-time leaderboard to award the prize.
- Implement authenticated event-bound run records with server-issued run IDs, server timestamps, wallet binding, continuation history, version pinning, replay prevention, and review evidence sufficient to reject fabricated scores. A client-supplied no-continue flag is insufficient.
- Rank event-eligible results only: start and finish within the event window, no continues, best eligible result per wallet, first verified achievement breaks score ties. Preserve the original achievement timestamp on repeated submissions.
- Verify mobile and desktop gameplay, score submission, time boundaries, duplicate submissions, ties, wallet mismatch, forged scores, and continued-run rejection.
- Confirm payout process and review winning evidence before sending the 25 SUI. No prize transfer is authorized by this code change.
- Before publishing the announcement, capture the current live static/function/schedule inventory and apply only the reviewed frontend changes. The repository’s historical snapshot build must not replace production.

## Validation

`git diff --check` passes. The historical feature-preview build passes, but its output does not include these current Arcade overlays, so it is not validation of this event card. A current-baseline visual preview and event scoring validation remain outstanding.
