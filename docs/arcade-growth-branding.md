# Legends of TREE: monthly badge collection

## Requested outcome

Make the Daily Growth panel more engaging and replace generic monthly badge names with identities drawn from the TREE ecosystem. The collection is **Legends of TREE**.

| Stable award ID | Display name | Monthly check-ins | Visual identity |
| --- | --- | ---: | --- |
| seedling | TREE Spark | 3 | Orange sprout bot, copper and cyan |
| sapling | NFTree Scout | 7 | NFTree forest scout, jade and violet |
| deep-roots | TREE FORCE Vanguard | 14 | TREE FORCE leaf-wing ship, cyan and violet |
| full-canopy | Thickquidity Legend | 21 | Purple and green Thickquidity hero, gold branches |

These are attendance milestones. Their names do not add NFT ownership, game victory, payment, token payout, or consecutive-day requirements.

## Presentation

The expanded Badge collection view shows four illustrated collectible cards with individual accent colors, rank numbers, requirements and earned/up-next states. Known saved progress has a numeric check-in count and a progress meter. Signed-out or unavailable states show goals without inventing progress. The next-unlock spotlight uses the same badge art, name and flavor text. The collapsed header retains the current wallet identity, check-in action and compact date strip.

The new display aliases also apply to historical earned badges. Original server IDs, dates, stored labels, check-in thresholds and normalized response objects are unchanged. Unknown award IDs retain their server-provided label and use neutral TREE art. Arcade Passport remains its separate monthly game-stamp award.

## Scope and preservation

Public changes are limited to `/play/index.html`, `/scripts/arcade-daily-growth.js`, `/styles/tree-arcade-suite.css`, and four new image files in `/assets/arcade-growth/`. Wallet signing, authentication, sessions, API requests, game launch/return handling, dependencies, backend functions and database rules are unchanged.

The guarded release starts from actual publication `6ae80cef3e9589ac84d0857a`, preserving its 284 existing paths except the three named presentation overlays. Four new 512-pixel transparent WebP badge images bring the total to 288. They total 447,662 bytes (down from 10,143,089 bytes of original generated PNGs). All 41 complete function/provider records, five schedules, runtime configuration, generated Netlify configuration, redirects, all 50 site Functions environment entries and the persistent Production/Functions TREE FORCE database binding must remain exact. Earlier provider identity exceptions do not apply.

`production/arcade-growth-branding-baseline.json` contains only explicitly selected safe deployment fields and environment fingerprints. It includes no raw secrets, connection values or skew-protection token. `scripts/release-arcade-growth-branding.py` permits only its newly recorded, separately verified candidate to be published and locked.

## Validation

- All 49 existing and focused controller cases passed with no failures or skips. Fixtures retain the old server badge labels to exercise display aliases.
- The additional history case verifies known legacy IDs, retained dates and source data, unknown awards, unchanged Passport identity, and no attendance writes during display.
- Independent source review found no auth, wallet, request, session or game-return changes; no existing HTML IDs were removed.
- Source syntax and whitespace validation passed.
- Artwork is generated, inspected and optimized. Read-only preflight verified the actual current publication and full environment preservation.
- Local frozen fixtures for 2-check-in, fully earned and signed-out states were generated from the actual controller, with no real-user progress or attendance writes. The cloud browser rejects file-protocol previews; those fixtures are not claimed as visual checks.
- Candidate and canonical browser checks passed: all four badge images loaded at their intended 512-pixel source size, the Badge collection tab opened correctly, all eight game cabinets remained, and no horizontal overflow appeared at the inspected 1363-pixel desktop viewport.
- Candidate and canonical database-backed negative authentication probes returned HTTP 401 `invalid-game-session` for random nonexistent sessions, before any participation write.
- Published and locked deployment `6ae8112dce29c5db8b725ff0` at `2026-11-02T04:29:52.370Z` from source commit `9c00bf6ae42d2ab6c2a78802cdfb4df1c42f795e`, tree `d855ed063b7ed2bb2383f299a6c1c6b5440f10ec`. Live at https://tree-token.xyz/play/.
- Receipts: `production/current-release.json`, `production/arcade-growth-branding-release.json`, and `docs/arcade-growth-branding-verification.json`.

No real-user wallet signature, transaction, game participation or attendance write is needed for this presentation update.
