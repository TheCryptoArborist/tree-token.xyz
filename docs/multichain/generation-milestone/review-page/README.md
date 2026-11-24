# Canonical generation-1 review page — source milestone

Prepared `play/generation-review/index.html` and `app.js` for the canonical path
`https://tree-token.xyz/play/generation-review/`. **These files are not deployed.**
Do not send the user to that path until a preservation release verifies it live.
No preview wallet URL is provided. The page disables all wallet controls on
noncanonical origins.

The page copies the published BNB connect, personal-message sign-in and status
handlers without changing their protocol. Source tests compare those handlers
exactly. The existing sign-in/old inspector assets and every backend remain
unchanged. Only the review button uses the new fixed-generation endpoint; it
posts `{ "action": "issue" }` with the existing private session cookie.
It never calls the old entitlement inspector, consumes a ticket, stores an
access flag, requests payment or enables a game. Unexpected success/tickets are
not retained or displayed. Another generation is not accepted from the browser.

A denied review does not distinguish a session failure from a backing failure.
The page therefore gives a denial message and suggests checking sign-in status;
it does not claim that a 403 response proves current ownership or custody.
The completed/retired generation is described separately as lifecycle context.
Network errors, malformed responses and rate limits have separate messages.
Account, chain or provider changes discard pending results and clear the display.

## Validation

Two source checks preserve authentication and prohibit the old entitlement,
ticket consumption, persistence and transaction requests. Seventeen actual-page
browser scenarios pass with mocked wallet/API responses at 320, 390 and 1440px.
They cover login/denial/logout, expired sessions, rate limiting, outages,
malformed and unexpected success responses, forged gameplay grants, late
account/chain/provider changes, mismatched sessions, missing sessions, wrong
chain and noncanonical origins. The review requests no additional signature.
Phone and desktop screenshots were visually inspected with no overflow.

`browser-local.json` records exact asset hashes and scenarios. `phone.png` and
`desktop.png` show simulated addresses and results, not a live wallet test.
The CI workflow uses Playwright 1.56.1 in an isolated tooling directory; project
SDK and dependency locks are unchanged.

```
node --test tests/bnb-generation-review-page.test.mjs
node scripts/check-bnb-generation-review-browser.mjs /PATH/TO/playwright/index.mjs /tmp/FRESH-EVIDENCE
```

## Remaining release and acceptance

Capture the full current locked production baseline anew. Add only the two new
static paths and preserve all existing paths, all 61 complete function/provider
records, five schedules, runtime and protected settings. No historical root
build or backend rebuild. Refuse any function upload requirement. Check the
candidate assets and canonical-origin restrictions, wait for queued builds, then
publish the new preservation candidate and verify its canonical bytes/layout.

After publication, perform an authenticated acceptance with the user's BNB
wallet and an explicitly reviewed login message. Expected outcome for retired
generation 1 is denial with no ticket or gameplay. This milestone used only
mocks and does not claim installed MetaMask/Ledger acceptance. No wallet action,
payment, NFT deposit or chain transaction is needed to review this source.
