# Daily Growth: monthly check-ins, tasks, and the next badge

This release implements the approved task-and-reward layout in TREE Arcade at https://tree-token.xyz/play/.

Published and locked deployment: `6ae7f8a9183c770b8f0eb50c`, at `2026-11-02T02:45:08.885Z`. Reviewed source: `f1a29b30aa8a726a38233d5f42a0582a9f347a38`; source tree: `936f1fa6ec410d6e3ee0cde06046b80524af8860`; branch: `feature/daily-growth-quest-layout-20261101`.

## Interface

The panel starts collapsed. The header retains the current wallet identity and explicit connect, sign-in, and check-in actions. A numbered attendance strip remains visible beneath it whether the details are open or closed. The strip follows the server's UTC month and contains every real calendar date, including February and leap years. Desktop shows one row; narrow screens use two rows.

Saved dates receive a checkmark. Today is highlighted, earlier unchecked dates remain distinguishable, and future dates are quiet. These marks describe recorded attendance; they are not controls for claiming past dates. Signed-out or unavailable progress does not display invented zero attendance or missed days. Last-saved records remain explicitly labeled during refreshes or recoverable errors. Changing or disconnecting the wallet clears personal progress.

Opening Daily Growth reveals compact daily tasks beside an artwork card for the next monthly badge. The check-in task and header use the same explicit check-in action. The quest disclosure retains game selection, the actual play link, participation and access requirements, and progress refresh. Tabs expose the full month calendar and earned badges. The monthly growth path sits with badges instead of above every task.

The Arcade Passport is a separately labeled optional monthly goal. November's four required games remain Garden Bot, PvP Battle, Arborist Trials, and TREE FORCE ’89. TREE FORCE still earns participation when a signed-in run reaches the first wave. The existing game-specific rules and historical month requirements are unchanged.

Attendance badges still count cumulative monthly check-ins at 3, 7, 14, and 21. The interface does not create a consecutive-day requirement, a new reward currency, a token payout, or an extra claim step. Badges are added to saved progress by the existing service when earned.

## Release boundary

The production baseline is the ready, locked deployment `6ae7eee018d3f212df6696d0`, which includes the later Canopy Defense checkout-test route. Its inventory contains 284 static paths, 41 complete function records, and five schedules. The three Daily Growth source files match the previous wallet-summary source exactly before this change.

Only these public paths are in the release allowlist:

- `/play/index.html`
- `/scripts/arcade-daily-growth.js`
- `/styles/tree-arcade-suite.css`

The guarded release preserves all other static files, including `/_redirects`, the complete function records and runtime configuration, generated Netlify configuration, environment fingerprints, and the publication lock. It does not rebuild backend packages, change the database, alter game code, replace the wallet adapter, or change dependencies.

The existing Canopy Defense access function uses deployment-scoped session storage. Its bytes and settings remain unchanged, but a new site deployment can require an active short-lived Canopy session to sign in again.

## Verification and publication

Prepublication verification passed all 39 controller cases (35 top-level cases and four exact-month subcases) and 16 grouped native browser checks. The native report is bound to the SHA-256 hashes of the three reviewed public files. It covers 1440, 390, and 320 px widths; 28-, 29-, 30-, and 31-day months; synchronized header/task check-in actions; retained earlier missed dates; cumulative badge awards; unknown, unavailable, stale, and account-change states; all four Passport games; and all eight cabinet destinations. No horizontal overflow or browser errors occurred.

The signed-in collapsed panel measures 242.58 px on desktop, 298.47 px at 390 px, and 293.33 px at 320 px. The first cabinet begins within every tested initial viewport. At 320 px, placing the connected-wallet controls on one row saves 47 px compared with the first layout pass and 38.34 px compared with the previous connected-only production panel. Both buttons remain at least 44 px high; wallet identity and sign-in guidance remain visible.

The controller evidence is `review/daily-growth-quest-layout/controller-tests.tap`, produced with `ARCADE_DOM_TEST_DEPS=/tmp/tree-arcade-ui-testdeps node --test-reporter=tap tests/arcade-daily-growth-ui.test.mjs`. The native report and seven screenshots are in `review/daily-growth-quest-layout/`. The release helper passed 18 preservation-guard checks, recorded in `daily-growth-quest-layout-release-guards.json`.

Both the candidate and canonical site passed five grouped hosted checks, with 20 anonymous GET responses returning HTTP 200 in each environment. The actual served controller, stylesheet, and wallet bundle match the reviewed bytes. Served HTML matches after removing only the exact existing hosting injection, pinned by ID, 572-byte length, SHA-256, and insertion position. The public API returns November's four required games and no private progress. Dates, native disclosure and tabs, cabinet destinations, first-cabinet visibility, and overflow checks pass on the canonical domain.

The hosted artwork wait was corrected after diagnosing a lazy image inside closed details: it can have layout dimensions before decoding completes. The final check requires the header, hero, and first-cabinet artwork to load and waits for other artwork only when actually visible. The public source and candidate did not change. The diagnostic and corrected runner are retained with the release evidence.

Synthetic authenticated fixtures exercise interface states without real wallet signatures, transactions, or production attendance writes. Hosted verification uses actual resources and unauthenticated GET/HEAD requests only. `daily-growth-quest-layout-verification.json` summarizes the results, and `../production/daily-growth-quest-layout-release.json` records the exact published inventory and preservation proof. `../production/current-release.json` now identifies this deployment. No live authenticated participation was fabricated for verification.
