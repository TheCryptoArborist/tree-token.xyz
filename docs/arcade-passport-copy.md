# Arcade Passport: monthly challenge invitation

## Requested change

Replace the discouraging `OPTIONAL MONTHLY GOAL` heading with
`MONTHLY ARCADE CHALLENGE`. The Passport name, stamp count, badge explanation,
eligibility rules, and paid-entry information retain their existing behavior.

The public change is exactly one text replacement in `/play/index.html`.
Its source bytes were checked against the currently published HTML before
editing. No JavaScript, CSS, wallet integration, game, database, or dependency
change is part of this update.

## Preserved baseline

The captured current publication is `6ae806bda0c2f59d35109a6e`, with 284 static
paths, 41 complete function records, five schedules, and 50 site Functions
environment entries. The persistent Production/Functions TREE FORCE database
binding is included in the current baseline, with safe metadata and a record
fingerprint. The release procedure compares all site and shared environment
scopes and preserves the existing Canopy routing and generated configuration.

`scripts/release-arcade-passport-copy.py` accepts only `/play/index.html` as an
overlay. It refuses backend, edge-function, or server uploads and requires
complete current provider/runtime records to remain identical. The earlier
session-repair provider-metadata exception does not apply to this copy update.
The existing publication stays locked while the newly recorded candidate is
verified. Only that new candidate can be published and locked.

## Status

Published and locked as `6ae80cef3e9589ac84d0857a` at
`2026-11-02T04:10:29.743Z`, from source commit
`048da5d94c01351fd4f59b217973270fd07645f3` on
`copy/arcade-passport-challenge-20261102`. Live at
https://tree-token.xyz/play/.

The candidate and canonical site display `MONTHLY ARCADE CHALLENGE`, and the
Passport disclosure still opens to its stamp and badge explanation. The
candidate had no horizontal overflow at the inspected desktop viewport.
All 284 static paths remain; the other 283 files, all 41 complete function
records, five schedules, runtime configuration, 50 site Functions environment
entries, and persistent TREE FORCE database binding were preserved exactly.

Candidate and canonical participation probes returned HTTP 401
`invalid-game-session` for a cryptographically random nonexistent game session.
This exercised the real database-backed authentication gate without awarding
progress. No real-user wallet signature, transaction, or authenticated game
run was performed for this copy change.

The publication receipt is `production/arcade-passport-copy-release.json`;
`production/current-release.json` records the same current inventory.
Hosted checks and scope are recorded in
`docs/arcade-passport-copy-verification.json`.
