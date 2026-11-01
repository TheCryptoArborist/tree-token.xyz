# Daily Growth invitation — November 1, 2026

## Published release

Live at https://tree-token.xyz/play/ as locked deploy `6ae75c44b387f8129ba60518`, published `2026-11-01T15:36:38.093Z` from source `90ce9a5a308855c07b08597fa0341367842591b8`. The exact deployment inventory and backend preservation evidence are recorded in `production/daily-growth-invitation-release.json`. Both candidate and canonical hosted checks passed using real served code, public GET status, and the existing wallet bundle, without connecting or signing.

## Purpose

The collapsed Daily Growth panel did not clearly explain how to check in or why a player should open it. This update gives the compact panel a visible invitation, a direct check-in action, and a preview of the next attendance badge.

## Player experience

- New visitors see **What will you grow today?**, the existing Seedling/Garden Bot artwork, **Connect to check in**, and **Reveal today’s quest**.
- Connecting and message sign-in remain separate, explicit actions. Sign-in does not automatically record attendance.
- Signed-in players can check in directly from the collapsed panel. The button waits for the server response, disables duplicate submissions, and leaves the panel closed.
- Verified progress shows the next badge, remaining check-ins, and progress toward its actual threshold. Signed-out previews show a badge goal without inventing personal progress.
- After check-in, the invitation points toward the daily quest. After both actions are verified complete, it opens earned badges.
- The badge artwork, headline, and labeled native disclosure all open the relevant activity. Keyboard operation and expanded-state announcements work; opening the panel never starts a wallet action.
- Stale progress is labeled as last saved. Account changes and session expiry clear the previous player’s progress.

The design uses the existing ecosystem artwork, forest background, gold headings, and leaf-green check-in button. The panel remains closed initially.

## Scope and source

The deployed overlay changes exactly three existing files:

1. `/play/index.html`
2. `/scripts/arcade-daily-growth.js`
3. `/styles/tree-arcade-suite.css`

The source baseline reconciles the previously released Garden Battles/Daily Growth branch with the Deadfall Run branch and the current Canopy Defense cabinet. Current production deployment `6ae69fa9b3d4702fcc61177c` is the authoritative release baseline, including all 283 static paths, 41 complete function records, and five schedules. Current Canopy source provenance is recorded in `production/daily-growth-invitation-baseline.json`.

Wallet adapter bundles, dependencies, server functions, check-in rules, badge thresholds, game eligibility, game links, and other pages remain byte-for-byte identical in the deployment inventory. The controller changes only the invitation’s presentation and disclosure behavior; wallet signing, session handling, and API request implementations are retained.

## Verification

The 30 controller tests pass. The targeted native-browser checks cover the visible actions, keyboard entry points, successful and failed check-in, delayed server confirmation, no automatic check-in on sign-in, completion, stale data, and clearing progress on account change. Browser fixtures are synthetic; no real wallet signature or production progress write is used.

Desktop and mobile measurements and screenshot paths are in `docs/review/daily-growth-invitation/browser-report.json`. The panel measures 162 px on desktop and 262–269 px for signed-out mobile layouts. The first game is visible within the tested 1440 × 900, 390 × 844, and 320 × 740 viewports. No horizontal overflow or page/console errors were observed.

## Release procedure

`scripts/release-daily-growth-invitation.py` pins the production baseline, exact full source commit/tree, and the three permitted overlays. It preserves the current complete function records, schedules, generated configuration, site/account environment fingerprints, and current publication lock. It rejects concurrent publication drift and unexpected backend uploads.

Create the candidate from a clean committed checkout, verify its complete inventory and hosted UI, then publish that exact newly recorded candidate. The publication receipt is saved to `production/daily-growth-invitation-release.json`; hosted checks are recorded separately.

The current Canopy Defense implementation uses a deployment-scoped authentication store. Its existing short-lived sessions may need sign-in after publication even though its code, configuration, and assets are unchanged.
