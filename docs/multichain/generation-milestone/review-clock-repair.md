# Publication review clock repair

The original browser compared server `preparedAt` directly against desktop
`Date.now()`, rejecting a fresh review if the desktop was behind by even a few
milliseconds or ahead by more than two minutes. The reported screenshot matches
this failure path. The user's actual clock offset has not been measured.

The browser now anchors to the same-origin HTTPS response Date, accounts for its
Age header, timestamp precision and full request duration conservatively, then
uses monotonic elapsed time. The desktop wall clock cannot accept/reject a review.
The two-minute limit remains enforced before signing, after signing, and after
signature verification. Slow requests, malformed time, future packets and stale
responses fail closed. Transaction bytes, gas, recipient and signature checks
are unchanged. The backend service is unchanged.

76 local unit/tooling/release tests pass. Three browser cases pass both locally
and against the actual candidate assets/service: desktop a day behind, desktop
a day ahead, and a genuinely stale server review. Fresh cases reach the enabled
sign button; mock user rejection causes zero submissions. The stale case stays
disabled. These tests use a mock Wallet Standard account, not the user's wallet.

Candidate `6b0341e7545ba49e00a0e496`, source
`e8c4294ab54358fc32aa4569d2a440f2dd323b68`, prepared successfully in run
`45060715586`. A fresh capture pins baseline `6b032a964276045ddedb18ca`.
Only `/play/generation-publication/app.js` changes; all 657 other static hashes,
all 53 complete backend records, five schedules, runtime and API-visible
protected configuration must match. Independent Netlify API comparisons found
all 53 backend records and schedules unchanged in the ready unpublished candidate.
The publisher waits for all Netlify builds before switching and locking this
exact candidate. No backend upload or rebuild is allowed by the repair script.

Reproduce the browser cases after installing Playwright separately:
`CHROMIUM_PATH=/usr/bin/chromium node tests/generation-review-clock-browser.cjs`.
Alternatively omit CHROMIUM_PATH to use Playwright's installed browser and set
PLAYWRIGHT_MODULE to an isolated Playwright module path when needed. Root lock
and production application dependencies remain unchanged.

## Published and verified

Repair is live on locked deploy `6b0341e7545ba49e00a0e496`. The same three browser cases also passed against the canonical hosted page/service. See `review-clock-live.json` for source/bundle hashes and preservation evidence. User should reload the page to load the repaired bundle, reconnect Slush, then refresh the review.
