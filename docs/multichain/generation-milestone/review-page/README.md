# Canonical generation-1 review page — published and repaired

The initial release was superseded by a competing manual Canopy Defense
publication 27 seconds later, causing the user's 404. Repair deployment
`6b060f725f10a0dbfc4f05d6` preserves that newer deployment's exact `/_redirects`
change and restores only the two reviewed static files. It published/locked at
16:28:19 America/Chicago on November 24. Five source/preservation checks and 17
source/live browser scenarios passed; three delayed full-state and canonical
checks also passed. See `repair-404.json` and `browser-live-repaired.json`.
The original `published.json` below remains historical evidence of the first
release; use the repair receipt as the current baseline.

The page is live at https://tree-token.xyz/play/generation-review/.
Deployment `6b060d9d9feb3f962c534534` published and locked November 24 at
16:20:30 America/Chicago (22:20:30 UTC). `published.json` records exact asset
hashes and preservation: all 691 old paths, 61 complete function/provider
records, five schedules, runtime and environment remain unchanged. Only the
two new static files were added, for 693 total paths. No backend uploads.

Run 45499597917 passed four source/preservation checks and the same 17 browser
scenarios against both source files and live canonical assets (`browser-live.json`).
Live HTML permits only the exact existing site-wide Arboretum snippet injection;
JavaScript bytes must match exactly. Browser wallet/API responses remain mocked.
Separate real endpoint requests confirmed 401/403 denials and false gameplay.
No real wallet, payment or deposit was used during publication.

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

Hosted verification passed in
[run 45495408772](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45495408772).
`browser-ci.json` confirms the same exact asset hashes and all 17 scenarios,
plus two source checks. The source files are commit `2ce768e`; `dd1c1ad` fixes
only the browser executable selection and records evidence. The initial CI
attempt stopped before testing because the headless-shell executable was not
installed; the successful run uses the installed full Chromium binary.

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

## Completed release and remaining wallet acceptance

The completed release captured the full current locked production baseline. Future releases must capture it anew. Add only the two new
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

## User acceptance steps

1. Open the canonical page in the desktop browser with MetaMask and Ledger.
2. Select BNB Smart Chain and the intended BNB account. Click **Connect BNB wallet**.
3. Click **Sign a login message** and review/approve the personal-message prompt.
   This is identity verification, with no transaction or fee. An existing valid
   session can instead be restored with **Check sign-in status**.
4. Click **Review generation 1**. Expected: **Review denied**, with gameplay disabled.
5. Record the displayed result. A denial after sign-in is the expected retired-
   generation outcome; it is not a positive gameplay acceptance test.

The user has now supplied the expected sign-in/denial screenshot. See
`../review-acceptance/README.md` for the recorded observation, independent
checks and limits of this negative acceptance.
