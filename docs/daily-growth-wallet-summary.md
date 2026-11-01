# Wallet identity in collapsed Daily Growth

The compact Daily Growth panel now shows the current wallet beneath the invitation copy, outside the expandable quest and badge section. The line contains the wallet name, shortened Sui address, and an explicit **Signed in** or **Connected** label. Its title and accessible label expose the full address. The wallet name can truncate on narrow screens while the address remains readable.

## State behavior

- **Signed in:** the current wallet matches an unexpired Daily Growth session.
- **Connected:** the wallet is connected but has no current matching Daily Growth session, including after sign-out, expiry, or revocation.
- **Account changed:** the new address appears immediately as Connected; the previous account’s sign-in state is cleared.
- **Disconnected:** the indicator hides and clears its address, text, title, and accessible label.
- **Progress unavailable:** a valid wallet/session identity remains visible while the existing progress error is shown separately.

The row reuses the controller’s existing wallet/session state. It adds no authentication action, signature, API request, transaction, copy button, or new dialog. It uses the established green/gold styling and existing panel artwork. No wallet integration, game, dependency, backend, or database code changes.

The status uses a polite live region. It updates only when the identity or authentication state changes, so routine progress renders do not repeat a full wallet-address announcement.

## Validation

All 32 controller tests passed with focused identity assertions added to the existing account/session cases. A MutationObserver check confirms progress-only updates do not rewrite the identity live region.

Fourteen native browser checks passed at widths 1440, 390, and 320. The indicator remains visible with details closed, and the full address is available through the title, ARIA label, and computed accessible name. Account changes, disconnection, sign-out, and expiry update immediately. Long wallet names truncate without horizontal overflow. No browser or console errors occurred.

For the standard fixture, desktop height is unchanged and phone height increases by 20.59 px. Disconnected layouts are unchanged. At 320 px, the signed-in panel is 269.83 px tall and the first game artwork begins at 654.13 px in a 740 px viewport. The long-name case also retains the game artwork within the viewport.

Browser wallet state and saved sessions used for these checks are synthetic. No real wallet signature, transaction, or remote write was used. Source hashes were checked at the start and end of the final browser run.

## Deployment scope

The guarded release changes only `/play/index.html`, `/scripts/arcade-daily-growth.js`, and `/styles/tree-arcade-suite.css` over the actual published baseline `6ae7648ca7cf1ea1c10b47b5`. All 283 paths remain present, with 280 unrelated files, all 41 complete function records, five schedules, generated Netlify configuration, runtime/environment settings, and the publication lock preserved.

The November four-game Passport, including TREE FORCE ’89, remains in place. No database migration is included. The existing Canopy Defense authentication store is deployment-scoped, so active short-lived Canopy sessions may need to sign in again after publication.

Evidence: `daily-growth-wallet-summary-verification.json`, `review/daily-growth-wallet-summary/browser-report.json`, and the three selected screenshots in that review directory. Publication and canonical hosted verification are recorded in the final release receipt.
