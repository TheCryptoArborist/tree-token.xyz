# Tree Army illustrated playtest and preview — published November 20, 2026

Current locked production is `6b000d7e752506183abed5ad`, published and verified
by workflow [44707502086](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44707502086)
at 09:07 UTC (03:07 America/Chicago). Published source:
`bb36b82ce841a1e5b3b95ab4497367f125f1f103`, through PRs #253 and #254.

Tree Army: Defend the Grove now serves illustrated Prototype 0.5 at
`/play/tree-army/test/`. One existing Coming Soon cabinet on `/play/` opens a
10-second actual-gameplay preview in a keyboard/touch accessible modal. Its
still is captured gameplay, not the separately referenced original concept.
Hero/archer projectile origins were corrected with point-blank collision coverage.

The fresh baseline was `6affc81a0ebcfd39b2efbbb0`: 631 static paths, 50 backend
records, five schedules. Only the playtest HTML and Arcade organization module
changed; eight named art/media/module/style files were added. The release
preserved **629 unrelated static paths, all 50 complete backend records, five
schedules**, runtime settings, environment/build configuration and site snippets.
Current inventory: **639 static paths and 50 backend records**. No wallet,
payment, access policy, reward, database or dependency change was published.

Both candidate and canonical game/cabinet checks passed at 1440×1000, 390×844,
320×740 and 844×390. They cover actual video decoding/duration, keyboard/touch
open/close, focus return, playback pause, gameplay controls and required-artwork
failure. CI used normal certificate verification. Separate local live visual
inspection required accommodation for this cloud workspace's proxy certificate;
it is not evidence about the public site's certificate. Canonical desktop and
phone screenshots were inspected.

Evidence: `production/tree-army-release-20261120.json` contains the complete
published static inventory. The adjacent `tree-army-game-browser-20261120.json`
and `tree-army-cabinet-browser-20261120.json` contain canonical results. Original
workflow artifact 14615478901 has SHA256
`e7f1f0a5f92f250f997d667be6e97b6c1a9b719d65da7938bf4874e2402b1de4`.
Details and remaining art/animation work: `docs/tree-army-continuation.md`.

Capture a fresh live inventory for every later release. Do not reuse the Tree
Army publisher's one-time replacement/addition plan for another update without
reviewing its exact hashes and paths. Never publish the historical root build.

---

# Market Overview — published and verified 2026-11-20 UTC

Current locked production is `6affc81a0ebcfd39b2efbbb0`, published at
`2026-11-20T04:18:30.303Z`. Reviewed source
`21861aea559c59bd67a371c1f00811fd09e92896` merged through PR249 as
`70dbf26e010238dcbe18722b6d6178bf62a6084b`; the complete merged source tree is
`a384970a220343e18ce37a19b0f27986d204aae2`. Publication workflow
`44673293820` passed, verifying canonical delivery, the complete inventory,
protected configuration and the production lock at `2026-11-20T04:18:46.818Z`.

**Market Overview** at `/market-insights/` now organizes fourteen charts into
**Market Size**, **Dominance**, **Sectors & Ecosystems**, and **Metals & Ratios**.
The five additions are OTHERS, ETH Dominance, Stablecoin Market Cap, DeFi Market
Cap, and Altcoins vs. BTC. Every chart has a consistent reading guide and source
link. Chart selections are remembered, and copied links open the selected
chart. The other Explorer tools remain available.

The fresh baseline was `6affc6cb821278e5a2a481e2`. Only
`/market-insights/index.html` and `/market-insights/insights.js` changed.
The release preserves **629 other static paths, all 50 complete backend
records, five schedules**, runtime settings, protected configuration and site
snippets. Current production contains **631 static paths and 50 backend
records**.

Preservation checks passed. Provider-mocked browser checks verified all fourteen
charts, the seven Explorer sections, selection and link behavior, keyboard
operation and layouts at 320, 390, 768 and 1363 pixels. Separate actual-provider
review confirmed all five new TradingView instruments displayed populated data
and the 3M range control worked. The canonical browser review records the
separate observed live checks after publication. No wallet or payment actions
were used.

Release evidence: `production/market-overview-release-20261120.json`.
Implementation: https://github.com/TheCryptoArborist/tree-token.xyz/pull/249
Publication: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44673293820
Release procedure: `docs/market-overview-release.md`.

Capture the actual current live inventory afresh before any future release.
This release's baseline hashes describe its completed input. Do not replace
current production with an earlier release or the historical snapshot build.

---

# Gold/Silver Ratio correction — published and verified 2026-11-20 UTC

Current locked production is `6affb404f25e798bc619e2a8`, published at
`2026-11-20T02:48:42.578Z`. Reviewed source
`31909de7bce24b2deda7f7855521e06a4e955f95` merged through PR244 as
`32cc4aadf536b5fc55aa6b56d9ec6ef6cd3c8643`; the complete merged source tree is
`429d5a8f6467598001bb7caf214f5d6d34400226`. Publication workflow
`44663246197` completed successfully and verified canonical asset delivery,
the complete inventory, protected configuration and production lock at
`2026-11-20T02:48:49.792Z`.

**Market Caps** at `/market-insights/` now uses TradingView's dedicated
**Gold/Silver Ratio** index, `TVC:GOLDSILVER`, after the Gold and Silver choices.
The label, source link, reading guide and copied summary are corrected.
The guide explains that a ratio of 80 means one troy ounce of gold is worth
about 80 troy ounces of silver, and that a falling ratio means silver is gaining
value relative to gold. This is a relative-value comparison; it does not by
itself establish a rise in silver's U.S. dollar price.

The fresh baseline was `6affb0e47dc837eae9bdc12d`, the preceding precious-metals
release. Only `/market-insights/index.html` and
`/market-insights/insights.js` changed. The release preserves **623 other static
paths, all 50 complete backend records, five schedules**, full runtime settings,
protected configuration and site snippets. Current production contains
**625 static paths and 50 backend records**.

All nine preservation guard tests passed. Provider-mocked checks verified the
choices, correct symbols and source links, guide visibility, keyboard behavior
and layouts at 320, 390, 768 and 1363 pixels. Separate actual-provider review
confirmed populated Gold, Silver and Gold/Silver charts. A cloud-browser visit
to the exact candidate verified the real 3M range control. The canonical page
was opened after publication and showed the corrected label, explanation and
populated native ratio data. No wallet or payment actions were used.

Release evidence: `production/gold-silver-ratio-release-20261120.json`.
Implementation: https://github.com/TheCryptoArborist/tree-token.xyz/pull/244
Publication: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44663246197
Release procedure: `docs/precious-metals-release.md`.

Capture the actual current live inventory afresh before any future release.
The existing release script's baseline hashes describe this completed
correction's input; update and review them for a new operation. Do not replace
current production with an earlier release or the historical snapshot build.

---

# Stablecoin Dominance — published and verified 2026-11-20 UTC

Current locked production is `6aff8d6c44e257067443ba98`, published at
`2026-11-20T00:03:37.405Z`. Reviewed source
`12318adb226a20a0fdb9b8c558a4c6a25b3320b3` merged through PR240 as
`bf57326c41989edcbba09dced015cb018d6836f5`; its complete tree equals reviewed candidate tree
`a805f9318da65de375d2d697535fce305dd50b49`. Publication workflow
`44642541103` completed successfully and verified canonical asset delivery,
the complete inventory, protected configuration and production lock at
`2026-11-20T00:03:44.588Z`.

**Market Caps** at `/market-insights/` now includes **Stablecoin Dominance**
immediately to the right of **BTC.D**, using TradingView's
`CRYPTOCAP:STABLE.C.D` percentage index. A short reading guide explains a rising
or falling market share; source notes link TradingView's methodology. The
existing TOTAL, TOTAL2, TOTAL3, TOTAL3ES and Bitcoin dominance charts remain
available.

The fresh baseline was `6aff527173dc08672f92903f`, including the previously
published Daily dashboard and all other current pages. This release replaces
only `/market-insights/index.html` and `/market-insights/insights.js`. It
preserves **623 other static paths**, **all 50 complete backend records**,
**five schedules**, full runtime settings, protected configuration and site
snippets. Current production has **625 static paths and 50 backend records**.

All source PR checks and nine focused preservation guard tests passed.
Separate automated checks verified tab ordering, keyboard activation, chart
symbols and links, guide visibility and layouts at 320, 390, 768 and 1363
pixels. Those checks explicitly mock external providers. Real browser review
of the exact candidate confirmed populated stablecoin percentage data and
working 3M range control. The canonical page was then reloaded and visually
verified with the real TradingView chart and the requested tab placement.

Current release evidence:
`production/stablecoin-dominance-release-20261120.json`. It records the complete
static inventory, preserved backend/runtime/configuration records, exact
source and artifact identities, separate candidate and canonical browser
reviews, and the provider-mocked layout evidence.

Implementation: https://github.com/TheCryptoArborist/tree-token.xyz/pull/240
Publication: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44642541103
Release procedure: `docs/stablecoin-dominance-release.md`.

Capture the actual current live inventory afresh before any future release.
Do not use an earlier release or the historical snapshot build as a new
production baseline.

---

# Isolated free pilot sign-in — published and verified 2026-11-19

Current locked production is `6afe4d06ab2e466f455605db`, published at
`2026-11-19T01:17:08.058Z`. Reviewed source
`6c8622c64186e7b08c475cf2ae79758149f1545e` merged through PR229 as
`204861cdea1e095e383cffd940a691523760d188`; the complete merged tree equals
the reviewed candidate tree `b707c5224968ca9e3fbe1e9b4548df0a0194de27`.
Publication workflow `44435573744` verified canonical asset delivery, the full
inventory, protected configuration and production lock at
`2026-11-19T01:17:11.739Z`.

The free **Arborist Trials — Test challenge, no prizes** flow at
`/play/challenge/` now works for a fresh Sui wallet without an NFTree, purchase
or gas payment. New sign-in uses a separate pilot-only personal-message
challenge and session. It preserves the published wallet bridge, pinned SDK,
existing Arcade eligibility and both shared Arcade session storage locations.
Existing Arcade sessions remain usable for pilot gameplay. Pilot tokens cannot
authorize original Arcade actions, and pilot logout cannot revoke an Arcade
session.

The correction addresses the initial canonical `nftree-required` failure
recorded below. The original Arcade gate was correct; it was never disabled or
bypassed. The hosted auth migration was applied as `20261119010740`. All twenty
pilot definitions/grants match the reviewed source, all six protected Arcade
auth definitions/grants and existing session records remained unchanged, and
the original enabled no-prize game configuration was preserved. Browser roles
cannot access the six private pilot tables or nine public RPCs.

Fresh baseline `6afe412cc313992199456506` was captured before preparing the new
candidate. This release replaces exactly three existing pilot browser modules
and the one isolated `arcade-challenge-pilot` function. It preserves **622 other
static paths**, **49 other complete backend records**, **five schedules**, full
runtime settings and protected configuration. Current production contains
**625 static paths and 50 backend records**. The exact reviewed function ZIP
was carried into publication with SHA256
`4051add0bae6a9c5fcf8080eee11b4c564cd36d96f04d5cd1cbd1923f248f7a5`.
All other live game, wallet, payment, monthly, event and styling assets retain
their captured bytes.

All seven source PR workflows passed. Pilot workflow `44434933521` passed
**129 automated tests**, including thirteen
browser cases. Both independent-worker PostgreSQL suites passed: seven
gameplay scenarios across 100 workers and seven auth scenarios across twenty
workers. The exact candidate was reviewed at 1440, 390 and 320 pixels, including
keyboard focus, images, Campaigns navigation and the no-prize label. Its API
continues to reject preview origins.

Canonical workflow `44435875741` passed at `2026-11-19T01:19:09.001Z` with one
fresh unfunded operator wallet, one actual personal-message signature, one
pilot-only session, one test attempt and three distinct legal moves. Fourteen
API calls verified a committed response lost in transit, its identical retry
without a duplicate move, and same-session reload without another signature or
attempt. It observed zero Growth API calls and zero browser errors, retained
shared Arcade storage, then revoked only its own pilot session. All server
responses were HTTP 200; the recorded failed delivery was the deliberate lost
response after commitment. The bounded test ended with an active match at
version three, not a completed win. Completed/winning states are covered by
the source tests. This operator-provider check does not establish installed
Slush extension prompt UX, unique-human identity or automation resistance.

The pilot remains free and nonpaying. It awards no prizes, attendance, badges
or monthly quest credit. Its November 18 ruleset and November 19–December 1 UTC
window, four standard cards, fifteen-minute limit and no-paid-advantage terms
remain unchanged. Funded campaigns, verified-person eligibility and payouts
remain future work.

Current release evidence:

- `production/arcade-challenge-auth-release-20261119.json`, SHA256
  `4e50b69e291fbd41d18c37e40a72bc668219ca44efc0243af27336320942b336`.
- `production/arcade-challenge-auth-deployment-20261119.json` records the complete
  backend/runtime/schedules, exact package, source and artifact identities.
- `production/arcade-challenge-auth-candidate-review-20261119.json` and
  `production/arcade-challenge-auth-canonical-review-20261119.json` record the
  separate preview and live verification boundaries.
- `production/arcade-challenge-auth-db-readiness.json` and
  `docs/arcade-challenge-auth-ci-validation-20261119.json` record hosted SQL and
  source verification. Local PostgreSQL 17.11 and CI PostgreSQL 18.6 both passed
  the independent worker checks.

Implementation: https://github.com/TheCryptoArborist/tree-token.xyz/pull/229
Publication: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44435573744
Canonical verification: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44435875741

---

# Initial Arborist Trials pilot — published 2026-11-19

That release locked production at `6afe412cc313992199456506`, published at
`2026-11-19T00:33:21.154Z` from reviewed source
`cabecd68d34d605988a5550fa45b3cd33caffd1b`. PR228 merged as
`a2fae47e5c0b1fe9259d1c08409a48086a8e194a`; its complete tree equals the reviewed
candidate tree `1577cdca4ef7e31903d198d74da5de0d85c73b55`.
Publication workflow `44429745020` passed with final inventory, canonical asset
delivery, public API and lock verification at `2026-11-19T00:33:26.574Z`.

Campaigns now links to **Arborist Trials — Test challenge, no prizes** at
`/play/challenge/`. The forest-green and gold page presents four standard cards,
Growth meters, current effects, round feedback and saved practice results. It
uses the existing Arcade session and unchanged personal-message wallet bridge.
Starting a match requires an explicit action. A pending move retains its exact
request identity across interruptions; the original session can resume the
match after reload. Changed sessions, unavailable storage, expiry and pilot
closure have explicit states.

The pilot terms promise free entry without an NFTree, purchase or paid
advantages. The fresh-wallet canonical check exposed an integration mismatch:
the reused Arcade authentication returned `nftree-required` before issuing a
session. Existing Arcade eligibility is correct and remains unchanged. The
isolated pilot sign-in correction is documented in
`docs/arcade-challenge-auth-release.md`; its production verification is a
separate release gate. The test awards no prizes, badges, attendance or
monthly quest credit. Its
fixed November 18 ruleset is configured for November 19 at 00:00 UTC through
the exclusive close of December 1 at 00:00 UTC. Attempts last at most fifteen
minutes and 100 moves, shortened by original-session expiry or pilot close.
Funded qualification, unique-player review and payouts remain future work.

The newly captured baseline was `6afe22a623fe04c7a4a9d0c0`. The release adds
five static paths and the single isolated `arcade-challenge-pilot` function,
and replaces only `/scripts/arcade-organization.js` to add the Campaigns entry.
All **619 other original static files**, **49 complete existing backend
records**, **five schedules**, runtime settings and protected configuration
were preserved. Current production has **625 static paths and 50 backend
records**. The exact reviewed function ZIP was carried from preparation to
publication, with SHA256
`297ca0cd39d392d52378b985f35d224a1a2c9d49824df0a6fbbdf984964e8342`.
Existing game, wallet, payment and monthly assets remain byte-identical, as do
the existing Event terms and November badge cutoff.

The hosted migration was applied separately as version `20261119000653`.
All eleven live function definitions match the reviewed migration exactly;
browser roles cannot access the three private tables or four public RPCs.
The enabled configuration and every pilot result retain explicit nonpaying,
not-prize-eligible flags. No migration is run by the Netlify publication job.

All seven final-head PR workflows passed. Twelve browser cases exercised the
actual service, SQL and engine with clearly labeled synthetic sessions at
desktop and narrow phone widths. Seven PostgreSQL contention scenarios passed
across 100 independent workers. The exact candidate passed layout, keyboard,
image, Campaigns-link and no-prize-label review at 1440, 390 and 320 pixels;
its API remains blocked on the preview origin.

The canonical signed-message run `44432319554` verified the generated
signature locally and received HTTP 403 `nftree-required` from the original
Arcade session endpoint. It created no session, attempt or move. This initial
release did **not** pass fresh-wallet sign-in. The exact failure report is
retained below; it must not be presented as successful play verification.

Publication evidence:
`production/arcade-challenge-release-20261119.json` (file SHA256
`68c0e52c2d7de91380d84bd26573787a43de24ff447fcb9d357f2ce558eeb55a`).
Complete backend/runtime/schedule and artifact binding:
`production/arcade-challenge-deployment-20261119.json`.
Browser evidence:
`production/arcade-challenge-candidate-review-20261119.json` and
`production/arcade-challenge-canonical-review-20261119.json`.
Hosted database and independent-worker evidence:
`production/arcade-challenge-db-readiness.json` and
`docs/arcade-challenge-postgres-validation-20261119.json`.

Implementation: https://github.com/TheCryptoArborist/tree-token.xyz/pull/228
Publication: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44429745020
Release procedure: `docs/arcade-challenge-release.md`.

This is the newest live preservation baseline. Capture the complete current
inventory afresh before any later release. Earlier sections below describe
their historical deployment states; ordinary Git builds and archived snapshots
must not replace current production.

---

# Earlier Arcade tab design polish — published 2026-11-18

Current locked production is `6afe22a623fe04c7a4a9d0c0`, published at
`2026-11-18T22:17:52.239Z` from reviewed source
`ac7005ff02bdb7d3e45ae71312a2ae4135026205`. PR225 merged as
`90d95b6303c7ce4578d5be210d99153551536cee`; its entire tree equals the reviewed
candidate tree `3d436765752955fe0c7475420e9dd11b8df967e4`.
Publication workflow `44410001644` passed end to end, with final inventory,
canonical delivery and lock verification at `2026-11-18T22:17:56.113Z`.

Daily's task panels, heading sizes, utility buttons and community surfaces now
share the forest-green and gold treatment used by Monthly Progress. Fresh
signed-in attendance reduces duplicated confirmation text while retaining the
original controls and loading/stale/error guidance. Games retains its cabinet
artwork and individual play-button accents; LIVE labels are consistently green,
PREVIEW purple and COMING SOON subdued. Active season countdowns place details
on the left and timer values on the right at desktop widths, and stack on
phones. Accessible keyboard focus and the existing UTC deadline are preserved.

The fresh baseline was `6afe0141248c1062e8414ed7`. Exactly three existing assets
changed: `/styles/arcade-organization.css`,
`/styles/arcade-season-deadline.css` and `/scripts/arcade-organization.js`.
All **617 other static paths**, **49 complete backend records**, **five
schedules**, runtime settings and protected configuration were preserved. There
are still **620 static paths and 49 backend records**. No backend package was
uploaded. The page HTML, wallet and monthly JavaScript, database, payment flows,
November cutoff enforcement and existing 25 SUI Event terms remain unchanged.

The same reviewed Git tree adds an **offline campaign/skill-challenge planning
foundation**. It includes an incomplete real draft, content-hashed rules,
evidence consistency checks and exact-unit equal shares per input canonical
player identity. It is excluded from the production payload. Every allocation
report remains nonpayable and not launch-ready; actual budget, asset, network,
dates, game/target and verifier choices remain unset. No funded campaign, live
score verification, payout route or monthly cash program is activated.
See `docs/arcade-campaign-foundation.md` for source-backed integration boundaries
and the remaining implementation work.

Validation passed: **94 focused tests**, covering 32 organization/countdown/
preview checks, 34 current/historical preservation guards and 28 campaign
foundation tests. All four PR workflows and the deploy-preview checks completed
successfully. Independent release and campaign reviews found no blocking issues.
The exact candidate's six tabs passed desktop (1363 CSS pixels) and phone
(390 pixels) review; the countdown also passed at 320 pixels. Both monthly
disclosures opened by keyboard with visible focus and 76-pixel summary targets.
Canonical review of all six tabs and the Monthly Progress deep-link reload
passed at `2026-11-18T22:19:35.662Z`. No document overflow or failed visible image
was observed. Live browser review was signed out; fresh completed/stale/loading
attendance presentation was tested with DOM fixtures. No wallet, signature,
check-in, vote, recovery, payment or new award was submitted during review.

Complete static inventory and publication report:
`production/arcade-polish-release-20261118.json` (file SHA-256
`8cfbb16a666369978dcaaaae69ab9478238c991edea17a47e98c3bb24d78a2f4`).
Complete published backend/runtime/schedule records and source/artifact binding:
`production/arcade-polish-deployment-20261118.json`.
Browser evidence: `production/arcade-polish-candidate-review-20261118.json`,
`production/arcade-polish-canonical-review-20261118.json`,
`docs/arcade-polish-live-month-20261118.jpg`,
`docs/arcade-polish-live-daily-20261118.jpg`,
`docs/arcade-polish-daily-phone-20261118.jpg`, and
`docs/arcade-polish-monthly-phone-20261118.jpg`.

Implementation: https://github.com/TheCryptoArborist/tree-token.xyz/pull/225
Publication: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44410001644
Release procedure: `docs/arcade-polish-release.md`.

This is the newest live preservation baseline. Capture the complete live
inventory afresh before a subsequent release. The earlier release sections below
are historical records; ordinary Git builds and archived snapshots must not
replace current production.

---

# Arcade organization and November cutoff — published 2026-11-18

Current locked production is `6afe0141248c1062e8414ed7`, published at
`2026-11-18T20:01:47.679Z` from reviewed source
`09f77e96556bbbb39a8b1eee26c2cf712d4f3b9b`. PR223 merged as
`e5dcee4d07a2483b1bb989641d0026650b438dca`; its entire tree equals the reviewed
candidate tree `6a601123f7ca9ccee3199b6191cd63e2bc6f1909`.
Publication workflow `44386363937` passed end to end, with final inventory,
canonical delivery and lock verification at `2026-11-18T20:01:52.861Z`.

Games now leads with the cabinets and compact attendance shortcuts. Daily
contains check-in and quest actions followed by the Spotlight and Stay Connected
panels. Campaigns explains the route from practice to Events and groups existing
onboarding activities. Monthly Progress has polished action panels, and both it
and Badge Collection display the November earning deadline: **December 1, 2026
at 00:00 UTC**. This release does not activate a funded campaign or monthly cash
program and preserves the existing Event terms.

New attendance recovery expires at the earlier of fifteen minutes and the next
UTC month boundary. For November 2026 and later, the successful checkpointed
payment must precede the exclusive cutoff. Server and database checks enforce
the rule independently. Eligible earlier payments remain verifiable after the
month closes, existing receipts and earned badges remain intact, and earlier
seasons retain their issued terms. Recovery remains 20,000 TREE plus SUI gas and
does not award completed-game quest credit. Migration `20261118193129` was
applied and its live RPC definitions and existing privileges verified.

The fresh baseline was `6afde69b28000c929ce7a0a4`. The release replaced only
`/play/index.html`, `/scripts/arcade-monthly.js` and the isolated `arcade-monthly`
function, and added the four organization/countdown assets. All **614 other
existing static paths**, **48 unrelated complete backend records**, **five
schedules** and protected configuration were preserved. Current production has
**620 static paths and 49 backend records**. The monthly package retained the
existing pinned dependencies and wallet integration.

Validation passed: **85 monthly/session tests**, **32 organization/countdown/
preview checks**, **18 release-preservation tests**, and all five PR workflows.
The existing public-chain payment diagnostic passed separately without writes or
signatures. All six tabs passed candidate review at 390 and 1200 CSS pixels.
Canonical review passed at 1363 pixels, including tab navigation, the monthly
deep-link reload and recovery disclosure, at `2026-11-18T20:03:36.982Z`.
No document-wide overflow or failed visible image was observed. No wallet was
connected, no payment was made and no production check-in or sample award was
created during review.

Complete static inventory and publication report:
`production/arcade-cutoff-release-20261118.json` (SHA-256
`5f8e0bd444ce343922121475d5ccbb7eaa08abbcf0e62d1d637f36e8708b2ed2`).
Complete published backend/runtime/schedule records and source/artifact binding:
`production/arcade-cutoff-deployment-20261118.json`.
Browser evidence: `production/arcade-cutoff-candidate-review-20261118.json`,
`production/arcade-cutoff-canonical-review-20261118.json`, and
`docs/arcade-games-live-20261118.jpg`, `docs/arcade-monthly-live-20261118.jpg`,
`docs/arcade-recovery-live-20261118.jpg`.

Implementation: https://github.com/TheCryptoArborist/tree-token.xyz/pull/223
Publication: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44386363937
Rules and limitation of an already-open wallet approval:
`docs/arcade-month-end-cutoff.md`. Release procedure:
`docs/arcade-cutoff-release.md`.

This is the newest live preservation baseline. Capture the complete live
inventory afresh before a subsequent release. Historical root snapshots and
ordinary PR previews must not replace current production.

---

# STI wallet loading and recovery — published 2026-11-18

Current locked production is `6afde69b28000c929ce7a0a4`, published at
`2026-11-18T17:57:21.131Z` (11:57 a.m. America/Chicago) from source commit
`0a354794c782d4f6c83e17b49e13b7e2577df929`, PR220. Final read-only verification
passed at `2026-11-18T18:05:39.622Z` (12:05 p.m. America/Chicago).

The STI panel now shows a loading state, waits for the shared wallet manager
when Connect wallet is clicked, and offers Retry wallet connection and Reload
wallet tools when loading fails. A deliberate reload can retain the entered
amount; a fresh quote and any required impact acceptance are still necessary.
Recovery cannot reload during purchase processing or pending confirmation and
never retries a purchase.

The release replaced `/dapp/index.html` and `/dapp/sti-widget.js`, added
`/dapp/sti-wallet-recovery.js`, and preserved all **613 other existing paths**.
The inventory contains **616 static paths**, **49 complete backend records**
and **five schedules**. Authoritative frontend sources remain in
`production/sti-purchase-static/`; shared wallet, purchase-core and stylesheet
bytes were preserved. All provider/runtime records and protected configuration
matched the freshly captured baseline.

All **82 focused tests** and all **12 candidate and canonical browser scenarios**
passed at 320, 390, 768 and 1363 CSS pixels. Four additional tests verified the
read-only audit guards. A manual canonical check opened the wallet picker
through normal navigation. No wallet was selected or connected and no
transaction was initiated. Evidence: `docs/sti-wallet-recovery-live-20261118.jpg`.

Publication workflow `44363664888` timed out during canonical delivery checks
after publication; it did not pass end-to-end. The unchanged local
`verifyDelivery` subsequently passed at `2026-11-18T18:00:16.959Z`. Read-only
audit workflow `44365536121` (PR221) then passed the complete published inventory,
configuration, canonical delivery and browser checks, with zero remote mutations.

Final report: `production/sti-wallet-recovery-release-20261118.json`.
Report SHA-256: `c5317ebcf3d418b39578c5ad9e4c9037cfff517ab51676e9c396363653d142d0`.
Audit artifact 14454819494 SHA-256:
`0818407c455d1b03dfe67197352592c4ce2cc3bd0aba4d5652771cb2cfac1cff`.
Verification: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44365536121
Implementation: https://github.com/TheCryptoArborist/tree-token.xyz/pull/220

The original browser-session cause remains unproven. The repair addresses the
reproduced loading and recovery gaps. Diagnosis, verification boundaries and
current Mysten guidance are recorded in `docs/sti-wallet-recovery.md`.
This is the newest live preservation baseline. Capture the complete current
inventory afresh before any subsequent release; historical root snapshots must
not replace it.

---

# STI purchase quote review — published 2026-11-18

Current locked production is `6afddc74d6c8647c67efdbad`, published at
2026-11-18T17:12:59.413Z (11:12 a.m. America/Chicago) from source commit
`9e68a5034c72d4d564e0a374a5cb0ef44c3fbc33`. Final verification completed at
`2026-11-18T17:13:11.813Z`. Read `production/sti-purchase-release-20261118.json`
for the complete **615-path** inventory and bound candidate/canonical evidence.
This is the newest live preservation baseline; capture it afresh before any
subsequent release.

The STI panel now displays quotes above 3% through 5% with explicit acceptance
for the exact quote. Quotes above 5% remain blocked. The 1% slippage limit,
minimum output, 30-second expiry, gas reserve, simulation checks and separate
final wallet gesture remain in place. Acceptance resets on quote, amount,
wallet, expiry or panel changes; revocation invalidates a prepared purchase.

Authoritative frontend overlays for this release:

- `production/sti-purchase-static/index.html` → `/dapp/index.html`
- `production/sti-purchase-static/sti-widget.js` → `/dapp/sti-widget.js`
- `production/sti-purchase-static/sti-purchase-core.js` → `/dapp/sti-purchase-core.js`
- `production/sti-purchase-static/sti-purchase.css` → `/dapp/sti-purchase.css`

The release replaced exactly three existing paths and added one stylesheet.
All **611 other existing paths**, **49 complete backend package records**,
**five schedules**, runtime settings and protected configuration were preserved.
Historical manifest-pinned sources remain archival build material.

69 focused unit/approval/preservation tests passed. Candidate and canonical
browser checks passed all seven scenarios at 320, 390, 768 and 1363 pixels.
A separate manual canonical check at approximately 11:13 a.m. America/Chicago
returned a live 2 SUI quote with 3.50% impact, 322321.683251131 estimated STI
and 319098.466418619 minimum STI, plus the acceptance warning and 1% slippage.
No wallet was connected and no transaction was signed or submitted.

Release procedure and dated diagnosis: `docs/sti-purchase-repair.md`.
Live UI evidence: `docs/sti-purchase-live-20261118.jpg`.
Verification workflow: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44355770097
Implementation PR: https://github.com/TheCryptoArborist/tree-token.xyz/pull/217
CI setup repair PR: https://github.com/TheCryptoArborist/tree-token.xyz/pull/218

Release report SHA-256: `f902ae5b58508ce5e85b30fd0bf62d3f0f4dcb3c8667df4133971934b7b6750a`.
Artifact 14452971172 SHA-256: `aeb3f2e0b96d733373e64f0f7aa32526a0372cc9d5c1f9fefc5b7f1e60a2e8eb`.

---

# Stats market chart and holder source — published 2026-11-18

Current locked production is `6afd423531560084e7dd48e8`, published from source
commit `e54531dfcb85cb712798f7e5890fb04017582d51`. Read
`production/stats-market-release-20261118.json` for the complete **614-path**
static inventory and preservation fingerprints covering **49 complete backend
package records**, five schedules, and candidate/canonical verification. This is the newest live
preservation baseline; capture it afresh before any subsequent release.

Stats at `/dapp/#stats` now embeds the same Noodles TREE/USD chart as Market
Insights and uses the homepage's Noodles-backed market holder count. The separate
coin-object-owner count remains in Canopy accounting and cannot overwrite the
market holder card. Holder verification times remain visibly dated during
provider and browser-cache fallbacks.

Authoritative frontend overlays for this release:

- `production/stats-market-static/index.html` → `/dapp/index.html`
- `production/stats-market-static/app.js` → `/dapp/app.js`
- `production/stats-market-static/stats-market.css` → `/dapp/stats-market.css`

These sources start from the exact prior production bytes, including Profile
Studio navigation and the stored site snippet. Historical manifest-pinned root
files remain archival build material. Preserve all current live paths and all
backend/provider/runtime/schedule/environment configuration on future releases.

The release changed only two existing static paths, added one scoped stylesheet,
and preserved **611 existing paths** unchanged. All candidate and canonical
layout checks passed at 320, 390, 768 and 1363 pixels. The production-snapshot,
holder-source and STI/wallet regression checks passed. A manual canonical browser
check confirmed actual Noodles candles and the seven-day range control; the
homepage and Stats both displayed 606 holders during that check. No wallet was
connected and no transaction was signed or submitted.

Release procedure and metric definitions: `docs/stats-market-release.md`.
Verification workflow: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/44249180370

---

# Current production — Market Insights, 2026-11-17 (America/Chicago)

Locked ready deployment `6afd38b699fcd142a80207f5`, published at
2026-11-18T05:34:19.756Z (UTC), source
`81c802f3f2e0aba6959c490514396a0e2f201263`, release PR213,
workflow `44244603229`. Canonical page: `/market-insights/`.
The homepage now links to **Resources → Market Insights**.

The release adds the three Market Insights application files and replaces only
`/scripts/homepage-refresh.js` to add that navigation link. All **609 other
existing paths remain byte-identical** to the freshly captured locked baseline
`6afd22ad90e2e583fed38ea7`. The full current inventory is **613 static
paths, 49 complete backend packages and five schedules**. Complete package,
provider, runtime, schedule and protected configuration comparisons passed.
The final published inventory and lock were checked again after canonical
delivery and browser verification.

All seven approved research views are available: Fear & Greed, Price Charts,
Rainbow, Market Caps, CBBI, On-Chain and Cycle Tools. Both application scripts
retain the approved preview bytes. Production HTML adds canonical metadata and
navigation, removes preview indexing restrictions, and wraps long calculator
result text on narrow phones.

All 41 release/preservation tests passed. Candidate and canonical page checks
passed at 320, 390, 768 and 1363 CSS pixels, covering the seven panels, keyboard
navigation, mobile menu, chart labels and the maximum 2009 calculator case.
Automated browser checks use labeled synthetic data and block third-party
content. Separate desktop review of the live production page verified the
Resources navigation, all seven tabs, all five live sentiment cards, 90-day
history, BTC TradingView and TREE/Noodles charts, the Rainbow and Realized Price
embeds, TOTAL3, all nine CBBI components and the current-price calculator.
No wallet or transaction actions were performed.

The complete publisher report, including all 613 file hashes and bound candidate
and canonical browser evidence, is `docs/market-insights-release.json`.
Its SHA-256 is `cfa0051e73c8544dadb46c1a01a5cd50a24416855edefc6562fb3f7299a6c001`.
Release artifact `14401227320` has SHA-256
`88fb4d2d38c198a4b47057083f862d7af4e906fd382fd53cea1325222ffd28b2`.
Capture this full current baseline before any future publication; the historical
root snapshot remains unsuitable for replacing current production.

---

# Current production — original NFTree deposit page, 2026-11-17

Locked ready deploy `6afce679fb554257af0b2c57`, verified at 23:43:26 UTC, source
`b629eefa6b9d11f14ba71523c58b7da360a995d2`, workflow `44201601429`.
Canonical isolated page: `/play/multichaintest/original/fund/`.

Exactly three files were added. All 604 previous paths remain byte-identical;
total inventory is 607 static paths, 49 complete backend packages and five
schedules. Full package/provider/runtime records, protected configuration and
environment fingerprints, canonical delivery and production lock were verified.
Release proof: `docs/multichain/original-sui-deposit-page-release.json`.

The actual Sui peer-binding receipt is verified. Fresh mainnet preflight checks
all signed source and BNB configuration/binding receipts, both fee routes and
the exact unsigned NFT deposit. One generic vault::fund command wraps original
NFTree #2720, borrowing the matching dev-held Vault AdminCap. The approval has
no publish, upgrade, packet send, stablecoin payment, pass mint or activation.
No actual deposit or blockchain transaction was submitted by the assistant.
Until Peter approves, #2720 remains dev-owned and the BNB pass paused/unminted.

Custody terms are explicit before consent: no direct admin withdrawal or reset;
return requires BNB-pass redemption and LayerZero delivery. Full simulated vault
BCS preserves the original NFT metadata. Receipt recovery checks actual wrapping
and full funded/unannounced vault state, authorities, protocol and unused channel.
Estimated gross gas is 7,502,400 MIST, with a storage rebate yielding net credit
947,955 MIST. Gross usage and selected budget above 0.1 SUI are blocked.

377 focused tests including 25 deposit tests and the preview/preserved build
passed. All repository checks passed; automated review of `c9cde595b22ebb6336e59e7a0a9a122029f2467f`
completed with no findings. The exact browser bundle was reproduced and compared.
The canonical page renders, displays correct bindings/custody terms, exposes
connect and adjacent receipt recovery, reports missing Slush, and keeps signing
disabled without a wallet and fresh simulation even if consent is checked.
The test consent was cleared. No wallet signature was requested. Slush reputation
clearance was not asserted. See `docs/multichain/original-sui-deposit-flow.md`
for scope, quote limitations and current Mysten guidance used.

---

# Current production — original NFTree Sui peer binding, 2026-11-17

Locked deploy `6afcde0a032ffec83290f366`, verified at 23:07:27 UTC, source
`3404dd237d20f976cf6681a327b05bbffaa65e35`, workflow `44196234748`.
Canonical isolated page: `/play/multichaintest/original/bind/`.

Exactly three files were added. All 601 existing paths remain byte-identical;
total inventory is 604 paths, 49 complete backend packages and five schedules.
Full package/provider/runtime records, protected configuration/environment
fingerprints, canonical delivery and production lock were verified.

The four actual BNB settings receipts are verified and recorded. The new page
prepares one Sui approval with exactly two commands: construct the verified BNB
peer Bytes32 and invoke the original generic vault::bind. This initializes an
unused path, sets the peer and enforces reserve/acknowledgment delivery options.
The approval has no NFT input, deposit, packet send, stablecoin payment, mint,
upgrade or purchase activation. Both AdminCaps stay dev-owned. NFTree #2720
stays directly dev-owned, Vault remains empty and BNB pass stays paused/unminted.

Preflight rechecks the signed Sui publication/slot/registration/configuration,
fresh source authority, exact live state, paused BNB pass/binding and all four
actual BNB receipts. Exact command/input/pure-byte/event/effect/balance checks
protect NFT, original Registry, UpgradeCap and protocol objects. Expected effects
are five application/capability writes plus four deterministic dynamic fields.
Web Locks, durable pending state, wallet account/network/epoch and fresh matching
gas guard handoff. Recovery verifies the actual bound state and unused nonces.

352 focused regressions, 25 new peer tests, preview build and 14 EVM tests passed.
Pinned artifacts and exact bundle checks passed. Full read-only mainnet preflight
and unsigned simulation passed with net gas 9,266,741 MIST (0.009266741 SUI).
Execution-attached output objects independently pass the bound-state validator.
No actual peer-binding transaction was submitted by the assistant. Review of
`4f61887adb5bd7abd1680f30990c99c519057b05` completed without findings; all
source CI passed. Existing SDK and wallet vendor remain unchanged.

Canonical title, actual bindings and enforced delivery policy, visible connection
and adjacent receipt recovery, missing-Slush feedback and disabled signing even
with consent checked while disconnected were verified. Cloud browser had no
Slush extension and requested no signature. The approval is completed in Peter's
Brave/Slush dev wallet ending 45c4. Full route verification precedes NFT deposit
or sale enablement.

Release record: `docs/multichain/original-sui-peer-page-release.json`.
Flow and current guidance: `docs/multichain/original-sui-peer-flow.md`.
Latest stage bindings: `docs/multichain/original-trial/bnb-route-bindings.json`.
Capture this current full inventory before future publication. Freeze the new
peer baseline, signing snapshot and public bundle with all older pages.

---

# Current production — original NFTree BNB route settings, 2026-11-17

Locked deploy `6afcd3e553bde30fccc917df`, verified at 22:24:10 UTC, source
`dce29e9ab89c86492f930270c8b7093db043a5c1`, workflow `44189472900`.
Canonical isolated page: `/play/multichaintest/original/bnb/configure/`.

Exactly three files were added. All 598 existing paths remain byte-identical;
total inventory is 601 paths, 49 complete backend packages and five schedules.
Full package/provider/runtime records, protected configuration/environment
fingerprints, canonical delivery and production lock were verified.

The page prepares four BNB approvals: explicit send and receive ULN302 libraries,
send executor/security and receive security. All three classic DVNs must verify
(Horizen, Twinstake, LayerZero Labs), with 20 BNB / 5 Sui confirmations and no
optional verifiers. Each approval rechecks the signed Sui configuration, source
NFT/empty Vault, confirmed BNB binding, paused/unminted pass, exact protocol
code/settings, selected wallet account/network, fresh nonce and gas.
Durable pending records block duplicate requests; exact receipt recovery accepts
Speed Up replacement hashes only with the recorded nonce/stage/target/calldata.

327 focused tests (19 new), 14 EVM tests, pinned artifact and exact bundle checks
passed. All four unsigned mainnet calls simulated successfully. The complete
sequence passed on an ephemeral local BNB fork with exact events and all five
route states. No mainnet configuration transaction was submitted by the assistant.
Automated review of `2c3ed9245fce128ec2b71979cd8bcdf1fe15c40f` completed
without findings; all source CI passed. The earlier Speed Up recovery finding
was fixed and regression-tested before publication.

Canonical title, expanded actual bindings/three verifier rules, visible connection
and adjacent receipt recovery controls, missing-extension feedback and disabled
signing without a wallet/simulation were checked in the cloud browser. No wallet
extension was available and no signature was requested. Actual four-step BNB
configuration remains Peter's next approvals in Brave with account ending 83ae.
Original #2720 is not deposited; Sui peer binding and full route verification
remain later steps. Purchases remain paused and no pass token is minted.

Release record: `docs/multichain/original-bnb-route-page-release.json`.
Flow: `docs/multichain/original-bnb-route-flow.md`.
Capture this current full inventory before future publication. Freeze the new
unsigned configuration snapshot and signing bundles alongside all older pages.

---

# Current production — original NFTree Sui route settings, 2026-11-17

Locked deploy `6afcccb3950cd53f974fe3bf`, verified at 21:53:22 UTC, source
`9ec421796921666d2501fae70940484648f681aa`, workflow `44184227223`.
Canonical isolated page: `/play/multichaintest/original/configure/`.

Exactly three files were added. All 595 existing paths remain byte-identical;
total inventory is 598 paths, 49 complete backend packages and five schedules.
Full package/provider/runtime records, protected configuration/environment
fingerprints, canonical delivery and production lock were verified.

The page prepares one Sui approval containing nine exact application settings
calls: ULN302 send/receive libraries, the approved three required DVNs, no
optional verifiers, 5 Sui / 20 BNB confirmations, executor and original-vault
receive metadata. Only OApp AdminCap, endpoint, ULN, application registry field
and four derived application configuration entries may change. Original NFTree
#2720, empty/unbound Vault, VaultAdmin, original Registry, OApp, UpgradeCap and
actual messaging channel remain protected. BNB pass stays paused and unminted.
No NFT deposit, stablecoin charge, message, mint, peer bind or sale occurs here.

The new 278-byte receive metadata targets original vault::lz_receive with the
original collection NFT generic; the retired nongeneric pilot callback is not
reused. Deployed Move metadata encoder and endpoint call-ID simulations matched
independently. Current official metadata confirms the three selected classic
DVN identities on Sui and BNB. Preflight rechecks source/publication/slot,
actual signed registration, empty application settings and a verified BNB
binding result. Full command/argument/pure-byte/effect/event checks, fresh quote,
wallet identity/network/epoch and durable Web Locks guard wallet handoff.
Exact receipt recovery also checks actual live configured values.

290 focused tests, 14 EVM tests, pinned artifact and exact bundle checks passed.
Unsigned checked mainnet simulation passed with net gas 14,951,541 MIST
(0.014951541 SUI). Slush selects final gas. Automated review of
`2dff1e7ddff344fcc65aa6f59a361291f483ca1d` completed without findings;
all source CI passed.

Canonical title, expanded original bindings/three verifier rules, visible Slush
connection/receipt controls, missing-extension feedback and disconnected signing
guards were checked. Cloud browser has no Slush extension and requested no
signature. Actual on-chain configuration remains Peter's next approval in Brave.
The assistant submitted no transaction.

Release record: `docs/multichain/original-sui-route-page-release.json`.
Flow: `docs/multichain/original-sui-route-flow.md`.
Capture this current full inventory afresh before future publication. Freeze
all current signing snapshots and bundles. After verifying the actual Sui
settings receipt, prepare matching BNB configuration and Sui peer binding.
Complete route verification must precede original NFT deposit or sale.

---

# Current production — original NFTree LayerZero registration, 2026-11-17

Locked deploy `6afcc6048594a4fe92aee28d`, verified at 21:24:55 UTC, source
`b0fc793e2d209daea4269dbc8e65f388760ed24e`, workflow `44179255810`.
Canonical isolated page: `/play/multichaintest/original/register/`.

Exactly three files were added. All 592 existing paths remain byte-identical;
total inventory is 595 paths, 49 complete backend packages and five schedules.
Full provider/package/runtime records, protected configuration/environment
fingerprints, canonical delivery and production lock were verified.

The page calls original vault::register with its actual Vault read-only, dev
AdminCap, LayerZero endpoint and empty metadata. It creates a new messaging
channel and typed registry entry for the package CallCap identity. Original
NFTree #2720 stays dev-owned, the Vault remains empty/unbound and the BNB pass
stays paused and unminted. No deposit, payment, cross-chain message or sale occurs.
The assistant submitted no on-chain transaction; Peter's Slush approval is next.

Fresh source/publication/slot/endpoint/absence/BNB binding checks, exact effects,
two-minute review and durable Web Locks guard handoff. Receipt recovery verifies
the actual channel and registration entry rather than a simulated ID. Public
BNB receipt lookup must return verified status; a missing/pending receipt blocks.
Review identified that missing-status guard; it was corrected and regression
tested before release. Re-review of `6699eb6831c27d5afbf2a289a759e7fe6a994bbe`
completed with no remaining findings. All source CI passed.

274 focused tests, 14 EVM tests, pinned artifacts and exact bundle checks passed.
A fresh unsigned checked mainnet simulation at 21:23:06 UTC confirmed net gas
4,668,124 MIST (0.004668124 SUI). Slush selects final gas. Simulation channel IDs
are provisional and must never become actual route configuration.

Canonical title, expanded actual source/BNB/NFT bindings, visible connection and
receipt controls, missing-extension feedback and disconnected signing guards
were checked. The cloud browser has no Slush extension and requested no signature.

Release record: `docs/multichain/original-registration-page-release.json`.
Flow: `docs/multichain/original-registration-flow.md`.
Capture this current full inventory afresh before future releases. After the
user-signed registration, verify its actual receipt/channel, then configure and
verify execution metadata, peers, libraries, DVNs and executor before funding
or enabling a sale. Prior wallet bundles and signing snapshots remain frozen.

---

# Current production — original NFTree pass binding page, 2026-11-17

Locked deploy `6afcbf06032b351187d30179`, verified at 20:55:04 UTC, source
`79d5e5ae58453012ae8e809d712d49db5cf3f6c0`, workflow `44174076629`.
Canonical isolated page: `/play/multichaintest/original/bnb/bind/`.

Exactly three files were added. All 589 existing paths remain byte-identical;
total inventory is 592 paths, 49 complete backend packages and five schedules.
Full package/provider/runtime records, protected environment/runtime fingerprints,
canonical delivery and production lock were verified. No backend rebuild occurred.

The fixed bindPass call links confirmed pass
`0x1d3da001E586a7DEFD397B77FADB29eD6F039c13` to adapter
`0x90b5292a5074CfDD665C726b433cc0A97e0dA6ab` from BNB wallet ending 83ae.
Fresh source, deployed-code, immutable, state, identity, nonce and gas checks guard
approval. The exact receipt/event and bound pointer must be verified afterward.
Purchases remain paused; no token is minted, USDT charged or original NFT moved.
Actual wallet approval remains Peter's next step in Brave. The assistant has
submitted no on-chain transaction.

260 focused tests, 14 EVM contract tests, pinned artifact/semantic checks and exact
bundle reproduction passed. All source CI passed; automated review of
`f20646d6b3002a44eee6f9f017c7e716ed1a0907` completed without findings.
Canonical rendering, expanded contract/price/treasury/source bindings, connection
controls, explicit missing-extension feedback and disconnected signing guards
were checked in the cloud browser, which has no BNB wallet extension.

Release record: `docs/multichain/original-bnb-binding-page-release.json`.
Flow: `docs/multichain/original-bnb-binding-flow.md`.
Capture this current full inventory afresh before future releases. LayerZero
registration/configuration verification still precedes any original NFT deposit
or sale enablement. Freeze all prior signing snapshots and bundles.

---

# Current production — original NFTree suite-pass page, 2026-11-17

Locked deploy `6afcb8faa4752b6b52595145`, published at 20:29:16 UTC, source
`72fb54181eeeab41a012e6b1405e6cd61f304ee2`, workflow `44169558421`.
Canonical isolated page: `/play/multichaintest/original/bnb/pass/`.

Exactly three files were added. All 586 existing paths remain byte-identical;
total inventory is 589 paths, 49 complete backend packages and five schedules.
Full package/provider/runtime identities, routes, region overrides, protected
environment fingerprints and production lock were verified. No backend upload,
migration or assistant-submitted on-chain transaction occurred.

This page creates the reviewed suite-pass contract against confirmed adapter
`0x90b5292a5074CfDD665C726b433cc0A97e0dA6ab` from BNB wallet ending 83ae.
The constructor fixes the adapter, initial buyer/controller and actual Vault
route; price is 25 USDT to the designated treasury and purchases start paused.
Creation mints no pass token, takes no USDT and deposits no NFT. Fresh source/
adapter/currency/endpoint/identity/nonce/runtime/gas checks and durable Web Locks/
receipt recovery guard wallet approval. The original published signing pages,
wallet helpers, contract source and dependency locks are unchanged.

244 focused checks and 14 EVM contract tests passed. Exact bundle reproduction,
pinned artifact/immutable-semantic checks and all source CI passed. Automated
review of `c6e3811` completed without findings. Actual canonical rendering,
expanded adapter/price/treasury bindings, visible connection controls, no-extension
feedback and disconnected signing guards were checked. The cloud browser had no
BNB wallet extension; actual user signature remains the next action in Brave.
No wallet signature or transaction request was submitted by the assistant.

Release record: `docs/multichain/original-bnb-pass-page-release.json`.
Flow, fixed settings and remaining approvals: `docs/multichain/original-bnb-pass-flow.md`.
Future releases must capture this actual current inventory afresh.

---

# Current production — original NFTree BNB adapter page, 2026-11-17

Locked deploy `6afcb1e59274eb1f9d9a58c7`, published at 19:59:00 UTC, source
`18d664df4104f99cfb98dfc4b2f87b8f2e931855`, workflow `44164114042`.
Canonical isolated page: `/play/multichaintest/original/bnb/`.

Exactly three files were added. All 583 existing paths remain byte-identical;
total inventory is 586 paths, 49 complete backend packages and five schedules.
Full backend package/provider/runtime identities, routes, region overrides,
protected environment/runtime fingerprints and the production lock were verified.
No backend upload, migration or assistant-submitted on-chain transaction occurred.

The page offers one BNB adapter creation from wallet ending 83ae, fixing the actual
original Sui package peer and confirmed empty Vault route. Fresh preflight checks
actual Sui receipts/state, wallet identity, nonce, endpoint code/EID, exact runtime
and immutables, and deployment gas. It reuses existing RPC fallback/parser helpers
without modifying them. Web Locks and durable pending/receipt recovery guard the
wallet handoff. Pass deployment, NFT deposit and sales remain subsequent steps.

229 focused checks and 14 EVM contract tests passed. All source CI and exact bundle
reproduction passed. Automated review of `2988c58` completed without findings.
The canonical page rendered, exposed connection controls and extension help, and
kept signing disabled without a wallet/simulation. Missing-extension feedback was
checked. The cloud browser had no BNB extension; actual signature approval remains
the user's action in their own Brave browser. No wallet request was submitted.

Release record: `docs/multichain/original-bnb-page-release.json`.
Flow and limits: `docs/multichain/original-bnb-deploy-flow.md`.
Future website releases must capture this actual current inventory afresh.

---

# Current production — original NFTree empty-slot page, 2026-11-17

Locked deploy `6afca1e2756277d1cf2ed161`, published at 18:50:45 UTC, source
`38db1f6f311c4acc8bf444c45fbd3b4dc2297014`, workflow `44151963288`.
Canonical isolated page: `/play/multichaintest/original/slot/`.

Exactly three files were added. All 580 existing paths remain byte-identical;
total inventory is 583 paths, 49 complete backend packages and five schedules.
Existing provider/runtime records, package digests, routes, region overrides,
protected environment fingerprints and production lock were verified unchanged.
No backend upload, database migration or on-chain submission occurred.

The page offers one `create_slot` call to the already confirmed original-NFT
package from dev wallet ending 45c4. NFTree #2720 remains in that wallet. NFT
deposit, BNB deployment and purchases are unavailable. A real unsigned mainnet
preflight passed at 0.003832051 SUI estimated net gas. The wallet selects gas and
shows its final budget. Actual creation requires the user's Slush signature.

All source CI passed; automated review of `5bacec6` completed without findings.
215 focused checks passed. The canonical page, disconnected signing guards and
invalid receipt feedback were checked in the browser. The cloud browser had no
user Slush extension; no wallet signature was requested.

Release record: `docs/multichain/original-slot-page-release.json`.
Flow, current bindings and next-stage constraints: `docs/multichain/original-slot-flow.md`.
Future releases must capture this actual current inventory afresh.

---

# Current production — original NFTree trial publication page, 2026-11-17

Locked deploy `6afc9ba2a979535dc510438e`, published at 18:23:53 UTC, source
`c27ec94f33452979a7ce2ba46e8016700263a0aa`, workflow `44147183482`.
Canonical isolated page: `/play/multichaintest/original/`.

The release adds exactly three static files. All 577 existing static paths remain
byte-identical; total inventory is 580 paths, 49 complete backend packages and
five schedules. Existing provider/runtime records, package digests, routes,
explicit region overrides, protected environment fingerprints and production lock
were verified unchanged. No function upload or database migration occurred.

This page offers only publication of the reviewed empty Sui package from the dev
wallet ending 45c4; NFTree #2720 and the original collection are not inputs.
It discloses retained compatible upgrade authority and requires fresh mainnet
simulation, identity checks, explicit review and a user Slush signature. BNB
deployment, deposit, reserve and sales remain unavailable pending actual IDs and
fresh LayerZero configuration verification. The assistant has signed/submitted no
on-chain transaction and has moved no NFT. Test publication gas was 0.06375 SUI;
the wallet displays the final cost before user approval.

All six source CI workflows passed, including exact browser bundle reproduction;
fresh automated review completed without findings. 201 focused checks passed.
The actual canonical page, disconnected button guards and receipt input feedback
were checked. This browser had no user Slush extension; actual wallet approval
remains the user's next step on their own Brave browser.

Release record: `docs/multichain/original-publication-page-release.json`.
Wallet and remaining route setup: `docs/multichain/original-publish-flow.md`.
Future website releases must capture this actual current inventory afresh.

---

# Current production — Canopy Crown USDC proposal published, 2026-11-11

Locked deploy `6af4ef567e67ea8af9abe8ed`, published at 22:42:49 UTC, source
`ae882dc0feb9a71e277611fbfa8c8589dbc80bc1`, workflow `43113929057`.
Canonical workshop: `/play/events/preview/`; mobile review:
`/play/events/mobile-review/`. This approved policy supersedes the historical
SUI proposal described below.

Entry is **5 native USDC on Sui**, with 80% of fees funding prizes and a 20%
organizer allocation before costs. First place receives at least 25 USDC when
there is an entrant; the organizer funds any shortfall. At registration close,
confirmed paid eligible NFTree holders set the ladder: 1–24 entrants pay first
place 100%, 25–49 pay 75%/25%, and 50+ pay 60%/25%/15%. Zero entrants means no
payout or subsidy. Payouts follow event completion and verified results. The
page discloses that individual prizes can fall when another place unlocks.

The page, calculator, local/downloaded drafts and isolated server draft handler
now use terms version 2, six-decimal USDC units and the same approved policy.
The additive production migration `20261111222359_arcade_event_usdc_terms`
preserves legacy records and private service-only access. No organizer, draft,
payment, score or award was created by this release.

All 29 focused tests passed. Canonical desktop and mobile checks verified the
prize ladder, calculator at 0/1/6/25/50/100 entrants, local save/reload and actual
JSON download. Document client/scroll widths match at 1348px desktop and 375px
mobile. Public API reports the exact policy with payment/scoring/awards false;
unauthenticated private actions reject with 401 and unsupported entry/run-start
actions reject with 404.

Inventory remains **513 static paths, 49 functions and five schedules**. Exactly
five workshop files and the isolated `arcade-events` package changed; all 508
other static files, all 48 other complete function records, schedules, runtime,
region overrides, build settings and protected environment fingerprints were
preserved. Approved artwork, try-on, wallet and game code are unchanged.

Release and validation records: `docs/canopy-crown-usdc-release-20261111.json`,
`docs/canopy-crown-usdc-validation-20261111.json`,
`docs/canopy-crown-usdc-api-validation-20261111.json` and
`docs/canopy-crown-usdc-database-validation-20261111.json`. Browser screenshots
and the real exported draft are in `docs/validation/canopy-crown-usdc-20261111/`.

The approved event proposal and design are published. Registration remains
closed pending schedule, organizer authorization/recipient, guaranteed funding,
payment receipts, trusted tournament scoring and permanent cosmetic unlock
integration. Saving a draft cannot launch the event. Future releases must
capture a fresh full published inventory.

---

# Historical production — approved Canopy Crown ’89 artwork, 2026-11-11

Locked preview release `6af4e675bad4dee995a99806`, source
`ac34030d613ebdcb7ca49544194425c7fb9d18da`, PR #145, workflow
`43108591709`. Finished try-on: `/play/events/profile-cosmetics/`;
mobile review: `/play/events/profile-cosmetics/mobile-review/`;
event workshop: `/play/events/preview/`.

The approved Contender and Champion artwork now replaces the earlier sample
frames. Contender has no belt; Champion has the championship belt. Both carry
Canopy Crown ’89 and TREE TOKEN · SUI branding. Photo upload stays local, with
zoom/position controls, small profile examples, and 1024px profile/transparent
frame PNG downloads. A cached silhouette mask prevents the photo from leaking
outside the illustrated frame. Original artwork bytes are preserved.

Actual canonical-page browser checks passed: synthetic photo selection,
maximum zoom/position, reset and both PNG export formats. Desktop viewport
1363px has 1348px client/scroll width; mobile iframe has 375px client/scroll
width and a 307×52px photo control. Both real downloaded PNGs are 1024×1024
RGBA with transparent corners; the frame download also has a transparent center.
Workshop uses the approved title and hides this collection for other planned
games. Six event tests, six renderer cases, independent exterior-pixel checks,
and both required GitHub checks passed. Records:
`docs/canopy-crown-profile-validation-20261111.json` and
`docs/canopy-crown-profile-release-20261111.json`.

Fresh inventory preserved all 49 backend function records, five schedules,
and runtime/provider/build/protected-environment fingerprints. Total 513 static
paths: 503 unchanged, eight workshop presentation/helper paths changed, two
approved PNGs added. Existing game and wallet/payment JavaScript is unchanged.

This completes the approved design and try-on preview. Tournament entry,
payments, ranked scoring and earned unlocks remain closed. The previous 5 SUI
entry and 25 SUI-or-80% winner rule remain unchanged in the closed workshop.
Peter has asked about 5 native USDC on Sui and second/third prizes; these are
under discussion, not approved or implemented. The recommended alternative
is 80% of fees to a shared prize pool, second place at 25 paid entrants and
third at 50. Currency, minimum-prize redenomination and the full payout ladder
must be agreed before checkout rules change. Future releases capture a fresh
published inventory.

---

# Current production — photo-first event cosmetic review, 2026-11-11

Locked deploy `6af4c09480dca6c4a8ad75d7`, source `ea81a2de80eacb00e60aaf384fec2878ea7d370f`, PR #143. Review `/play/events/profile-cosmetics/`, mobile-width review `/play/events/profile-cosmetics/mobile-review/`; workshop concepts updated at `/play/events/preview/`. Cosmetic approval and permanent ownership unlocks are still pending.

Replaces poster medallions and tiny ribbons/lettering with a thin canopy frame, compact lower-right hero-face emblem and gold champion profile kit. Photo remains prominent; decoration stays inside the circular social crop. New try-on uses local-only photo upload/crop controls and actual 48/80/128px examples. No photo data is uploaded or stored on a server. The existing workshop publisher also includes all new renderer dependencies/routes.

Validation: upload/reset tested in browser using a synthetic photo; desktop 1363px has 1348px document width; mobile content/scroll width 375px and photo label 307×52px. All nine small examples have exact 48/80/128 canvas/CSS widths at desktop. Separate raster check using @napi-rs/canvas 0.1.80 reports zero opaque pixels outside the social circle, transparent corners and unchanged center photo pixels for all three compositions: `docs/event-profile-cosmetics-render-validation-20261111.json`. Existing event-rule and required production-snapshot checks pass. Workshop eligibility still prompts signed-out users correctly and entry remains disabled.

Fresh baseline `6af4a8a16b5775b6f672ecb0` preserved all 49 complete backend records, five schedules and runtime/provider/build/protected-environment fingerprints. 511 static paths; 504 unchanged, 2 workshop presentation paths changed, 5 review/renderer paths added. No Profile Studio, game, wallet, payment, eligibility, database or backend package changes. Release: `docs/event-profile-cosmetics-release-20261111.json`; workflow `43086635932`. Future releases capture fresh published inventory.

---

# Current production — NFTree-only tournament foundation, 2026-11-11

Locked deploy `6af4a8a16b5775b6f672ecb0`, source `6994fb2fac05dcea36d694b4e8a70202dd6af701`, PR #141. Review page `/play/events/preview/`; isolated handler `netlify/event-functions/arcade-events.ts` at `/api/arcade-events`.

Adds authenticated, uncached canonical NFTree eligibility checks (direct and wallet-controlled Kiosks), plus authorized organizer server draft save/load. Private organizer allowlist starts empty pending Peter's explicit management wallet. Entry collection, tournament run starts, scoring and cosmetic unlocks remain closed/unintegrated. The shared holder guard is prepared for fresh checks before future payment and each ranked run. Cosmetic concepts still await improvement/review.

Fresh baseline `6af47ccc900af8400ddb46b3` included other Arcade work. Preserved **all 48 existing complete backend records and all five schedules**, adding only `arcade-events` (49 total). Now 506 static paths: 502 unchanged, three workshop paths updated and one server-controls module added. Existing games, wallet code, Profile Studio and community tracking remain unchanged. Runtime/provider/build/protected-environment fingerprints verified. Release: `docs/arcade-event-foundation-release-20261111.json`; workflow `43070383514`. Future releases capture fresh inventory. The first-install release utility refuses to replace any existing event handler.

Validation: 15 focused tests plus existing NFTree ownership regression; required production-snapshot and STI regression workflows passed. Live configuration reports NFTree-only/entry off/scoring off, missing and invalid sessions reject with 401, unsupported entry/run actions return 404. Desktop 1363px and 390px mobile iframe checked; content/scroll width 375px, no overflow; signed-out holder and organizer controls display sign-in guidance; entry stays disabled. Positive authenticated ownership and organizer save tests use controlled fixtures; a real organizer-wallet round trip awaits allowlisting. Migration is installed, browser roles denied, and RLS enabled on all three new private tables. No organizer or paid event was seeded.

---

# Current production — scheduled event workshop preview, 2026-11-11

Locked deploy `6af3f56c6ea78991ef999584`, source `951fd28e0f90747cb80de11c74d7e4a5b5ee7862`, PR #137. Review page `/play/events/preview/`; source `production/arcade-events-static/index.html`, modules `scripts/arcade-events/{core,preview}.mjs`, stylesheet `styles/arcade-events-preview-v1.css`.

Adds a separate event-planning and cosmetic-concept review only. Entry remains disabled. No wallet, fee collection, server scheduling, score submission or permanent entitlement grant is connected. Existing Arcade event card and gameplay remain unchanged. Scope and remaining integration: `docs/arcade-events-design-20261111.md`.

Fresh inventory: 492 static paths, **all 487 prior static paths unchanged**, all 47 complete backend records, five schedules, runtime/provider/build configuration and protected environment fingerprints preserved. Release report: `docs/arcade-events-release-20261111.json`; workflow run `42962404360`. Future releases must capture fresh published inventory. `scripts/arcade-events/release.mjs` and its manual workflow permit preview routes only.

Validation: five event-rule suites plus required production-snapshot and STI regression workflows passed. Desktop (1363px) and mobile iframe (375px content, 375px scroll width) checked; original art loads, draft save/reload works, invalid ending dates reject, entrant estimator handles zero/100 entrants, game planning choices update, and entry remains disabled. Validation record: `docs/arcade-events-validation-20261111.json`.

---

# Current production — all illustrated borders fit their photo edges, 2026-11-10

Locked deploy `6af3bb0fbd70015aaa06efb8`, source `f0e0a36c0d9d9635a3314d02efa2f25e7cf8b550`, PR #136. Active page `production/profile-border-fit-static/index.html`; script `scripts/tree-profile-studio-v16.js`; frame silhouette helper `scripts/profile-border-fit.js`; game art helper `scripts/profile-game-art.js`; existing stylesheet v9 unchanged.

Leafy Canopy, Christmas Lights and Autumn Glow now use their actual illustrated outer contour to clip the photo underneath their rim. Original bulbs/leaves are retained. Downloaded 1024px PNGs using one high-contrast diagnostic photo show zero photo pixels outside all three frames and transparent corners. Classic Gold and Canopy Mint exports are pixel-identical to baseline. Validation: `docs/profile-border-validation-20261110.json`.

The original Canopy Breaker arcade artwork and Root Rage boss action are live, all nine ecosystem choices including approved Deadfall Run are present, and owned NFTs precede TREE Ecosystem. Existing wallet/session/ownership/payment behavior is unchanged.

Fresh inventory preserved: 487 static paths (486 unchanged at production promotion), all 47 complete backend records, five schedules and runtime/provider/build/protected-environment fingerprints. Release: `docs/profile-border-fit-release-20261110.json`. Future releases capture fresh published inventory using `scripts/profile-border-fit/release.mjs`.

---

# Current production — approved ninth Deadfall Run badge, 2026-11-10

Locked deploy `6af3b401d0193c86219abb02`, source `1be865bd768123d2e5cc1fcc02e95c9e96884f00`, PR #135. Active page `production/profile-deadfall-static/index.html`, script `scripts/tree-profile-studio-v13.js`, helper `scripts/profile-deadfall-art.js`; existing stylesheet v9 unchanged.

Adds the approved bright purple truck with lowered title as ninth ecosystem badge. The other eight live badges are unchanged. Pending original Canopy Breaker and Root Rage boss artwork remain in the separate v12 game-art preview. Live badge selection, exact nine-choice count and frame PNG export verified.

Fresh release preserves 479 static paths (476 unchanged), all 47 complete backend records, five schedules and runtime/provider/build/protected-environment fingerprints. Source and release record: `docs/profile-deadfall-release-20261110.json`. Future releases use fresh published inventory; utility `scripts/profile-deadfall/release.mjs`.

---

# Current production — clear game badges and mobile photo upload, 2026-11-10

Locked deploy `6af3ab2cd3c66da0f6847165`, source `6258bbaeeef5295294ed8bf34714bf6d268900be`, PR #132. Active page: `production/profile-ecosystem-static/index.html`; script `scripts/tree-profile-studio-v11.js`; stylesheet `styles/tree-profile-studio-v9.css`.

Photo picker is full-width gold, 60px tall on mobile. At 390px viewport the document is 375px wide with no horizontal overflow. Native file chooser opens. Canopy Breaker and Root Rage use distinct named SVG medallions readable in the compact picker; frame export reports success. TREE Token renamed; generic NFTree, duplicate Thickquidity and Sui emblem choices removed. Owned NFTrees remain above Partners. Ancient Oak retains its 48px lift.

Fresh inventory preserved: 473 static paths, 472 unchanged at production promotion; all 47 complete backend records, five schedules and runtime/provider/build/protected environment fingerprints unchanged. Release record: `docs/profile-ecosystem-upload-release-20261110.json`. Future releases capture a fresh published baseline using `scripts/profile-ecosystem/release.mjs`.

---

# Current production — NFTrees before Partners, 2026-11-10

Locked deploy `6af39467220a8ff936b957ea`, source
`4e002623565a0bcf197e272e3785ee7ee94b6e84`, PR #130.
Active Studio: `production/profile-nftree-order-static/index.html`,
`scripts/tree-profile-studio-v9.js`; existing styles-v8, partner-medallion and
access-v4 are unchanged.

The existing owned-NFTree bottom-badge panel now sits immediately after TREE
Ecosystem and before Partners. Order is None, TREE Ecosystem, NFTs, Partners,
November, December. Desktop preview and340-CSSpx layout verified this exact DOM
order;337px document width. No badge selection, photo, ownership, session, wallet,
payment, border or artwork behavior changes. Syntax and required production
snapshot checks pass. No new tests added for this small presentation reorder.

Fresh baseline `6af3942619ebbfb53d7765fd`;463 static paths,462 unchanged at promotion.
All47 complete backend records, five schedules and runtime/provider/build and
protected environment hashes preserved. Release/validation record:
`docs/profile-nftree-order-release-20261110.json`. Future releases must capture
fresh published inventory; utility `scripts/profile-nftree-order/release.mjs`.

---

# Current production — official partner badges, 2026-11-10

Locked deploy `6af39210476c85cf56dbd130`, source
`d866f59aa3cc8f85d1db4272cbe04c9fa7756633`, PR #129.
Active Studio source: `production/profile-partners-static/index.html`,
`scripts/tree-profile-studio-v8.js`, `scripts/profile-partner-medallion.js`,
`styles/tree-profile-studio-v8.css`. Existing access-v4 and all wallet/payment
code are unchanged. The compact wallet controls and bottom NFTs panel remain.

Partners adds one official SuiDex handshake (1080px transparent Media Pack PNG)
and one official Kelpie on-dark emblem. Original assets are stored unchanged;
extra renderer/thumbnail padding preserves the full marks inside round gold rims.
Both select as bottom medallions, retaining the uploaded profile photo. Other
medallion rendering uses the original default and all other artwork stays intact.

Seventeen existing regressions passed. Desktop and340-CSSpx preview verified;
actual1024x1024 RGBA exports for both have transparent centers/corners and opaque
badge regions. No actual wallet signing/payment or user photo upload. Asset source
and validation details: `docs/profile-partner-logos-design-20261110.md`,
`docs/profile-partner-logos-release-20261110.json`,
`docs/profile-partner-logos-validation-20261110.json`.

Fresh baseline `6af391a15fc90f558550dfe6`;461 static paths,460 unchanged at promotion.
All47 complete backend records and five schedules plus runtime/provider/build and
protected environment fingerprints preserved. Use fresh published inventories;
release utility `scripts/profile-partners/release.mjs`.

---

# Current production — NFT artwork as bottom badges, 2026-11-10

Locked deploy `6af38cfd5ab474aae2a0cddf`, source
`24edebbae97333e854fa8536e28337b11d3021b9`, PR #128.
Active Studio: `production/profile-nft-badge-static/index.html`,
`scripts/tree-profile-studio-v7.js`, `scripts/profile-studio-access-v4.js`,
`styles/tree-profile-studio-v7.css`.

NFTs is back below the other badge collections. Actual owned NFTree thumbnails
are selectable round bottom medallions; uploading the profile photo remains a
separate control and selecting an NFT never replaces that photo. The oversized
wallet instructions/navigation buttons are replaced by compact connection and
local sign-in controls. Existing Arborist Trials lift and other artwork remain.

Reproduced and fixed the screenshot wallet's Kiosk ownership error: NFTs are
reached through owned Kiosk Item dynamic-object-field values, with canonical type
and matching Item/object/metadata IDs, rather than expecting direct Kiosk ownership.
Bounded workers progressively show verified items; failed Kiosks cannot hide
separately verified artwork, and exports still await/recheck current holdings.
Existing session/expiry/sign-in guards remain. Read-only live lookup found three
canonical NFTrees (two direct, one Kiosk), no partial errors; sample image200/CORS*.

Seventeen focused tests passed, including uploaded-photo preservation and bottom
medallion placement. Desktop preview showed the compact wallet and bottom NFTs
panel;340 CSSpx mobile document337px, wallet section174px. No real-wallet signing,
payment or user-photo upload. Details: `docs/profile-nft-bottom-badge-design-20261110.md`,
`docs/profile-nft-bottom-badge-release-20261110.json`,
`docs/profile-nft-bottom-badge-validation-20261110.json`.

Fresh baseline `6af38c4ae461c7fd2c8e5ebd`;455 paths,454 unchanged at promotion.
All47 complete backend records, five schedules and runtime/provider/build and
protected environment hashes preserved. Always capture fresh baselines; release
utility `scripts/profile-nft-badge/release.mjs`.

---

# Current production — in-place Profile Studio sign-in, 2026-11-10

Locked deploy `6af388bc2cee7668d2bdf882`, source
`a7633354886828a8474915fb26705c450e6bcd2d`, PR #127.
Active Studio: `production/profile-signin-static/index.html`,
`scripts/tree-profile-studio-v6.js`, `scripts/profile-studio-access-v3.js`,
existing `styles/tree-profile-studio-v5.css`.

Sign in here replaces the redirect to Arcade. Existing valid shared Arcade sessions
restore silently without another signature. Local sign-in uses the same wallet
adapter and challenge/session/status endpoints, persists the exact server expiry
under the same shared storage key, and is reusable by Arcade. Expired sessions or
a remembered Studio wallet can restore wallet identity only; earned badges still
require current authentication. No check-in, payment, wallet SDK or TTL change.

Fourteen focused tests passed for shared-session reuse, local sign-in, expired
identity restore, rejection, account changes, duplicate clicks including pending
refresh, ownership/Kiosks/transfer/outage and non-destructive focus. Desktop and
340-CSSpx signed-out UI checked. Real-wallet signing was not performed. Detailed
design: `docs/profile-studio-signin-design-20261110.md`.

Fresh baseline `6af3876a3c2cbc34e58e5f83`;451 paths,449 unchanged at promotion,
all47 complete backend records and five schedules plus runtime/provider/build
and protected environment fingerprints preserved. Records:
`docs/profile-studio-signin-release-20261110.json` and
`docs/profile-studio-signin-validation-20261110.json`.
Use fresh complete baselines; utility `scripts/profile-signin/release.mjs`.

---

# Current production — visible NFTree picker and Trials artwork, 2026-11-10

Locked release `6af385eb6da682188cf300e3`, source
`0b6bdb854dce8e993945660223f78934de799781`, PR #126.
Active Studio source: `production/profile-discovery-static/index.html`,
`scripts/tree-profile-studio-v5.js`, `styles/tree-profile-studio-v5.css`.
The existing `scripts/profile-studio-access-v2.js` is unchanged.

Your NFTrees is now a static, highlighted selector before all other artwork,
initialized before wallet discovery finishes, with connect/refresh controls and
a prominent shortcut beside wallet status. This supersedes the earlier selector
that appeared below every seasonal badge. Arborist Trials alone moves up 72px
within the 1024px composition to clear the border. All other artwork placements
and actual NFTree ownership/monthly badge requirements remain unchanged.

Desktop preview verified shortcut navigation, signed-out picker, and clear Trials
logo separation. Mobile 340 CSSpx: document337px and picker267px, no overflow.
Existing ten focused checks passed; required production-snapshot passed. No live
wallet connection, signature or payment. Full preservation records and final live
visual validation: `docs/profile-studio-discovery-release-20261110.json` and
`docs/profile-studio-discovery-validation-20261110.json`.

Fresh promotion baseline `6af3858856d2b81eba715c06` had448 static paths; only main
Studio HTML changes,447 paths preserved. All47 complete backend records and five
schedules, provider/runtime/build configuration and environment hashes remain
exact. Continue using fresh baselines; utility `scripts/profile-discovery/release.mjs`.

---

# Current production — owned NFTrees in Profile Studio, 2026-11-10

Locked deploy `6af3843998541eb5599dee67`, source
`89f5b30e64a4c5a40cf62f93dadd7559b2c93fa4`, PR #125.
Active Studio source is now `production/profile-feedback-static/index.html`,
`scripts/tree-profile-studio-v4.js`, `scripts/profile-studio-access-v2.js`,
`styles/tree-profile-studio-v4.css`. Header and all three navigation entries from
PR #124 remain unchanged. All 47 backend function records and five schedules,
runtime/provider/build settings and protected environment hashes preserved.

Sui emblem and Tree Hero are in TREE Ecosystem. Free artwork no longer repeats
category labels. Locked monthly artwork remains fully visible with an explicit
lock explanation. Wallet identity, Connect/change wallet, Refresh collections and
Arcade sign-in controls are now above the editor. Shared Arcade session parsing
accepts its existing opaque token format and supports legacy sessionStorage;
server authentication and existing one-hour expiry still control earned badges.

The earlier six synthetic rarity-holder emblems are superseded by Your NFTrees:
actual canonical NFT artwork, name and rarity from the connected wallet's direct
and supported Kiosk holdings. Public ownership requires wallet connection; monthly
awards additionally require the authenticated Arcade session. Ownership refreshes
before every NFT export. Account change, transfer or verification failure revokes
access. Same-wallet focus refresh preserves the selected artwork. Remote images
load anonymously with CORS to preserve canvas export; the sample Pinata gateway
returned Access-Control-Allow-Origin: *.

Validation: focused direct/Kiosk metadata and artwork, opaque session restoration,
monthly authorization, transfer/outage revocation, in-flight account change and
same-wallet focus regression checks. Desktop browser verified the visible wallet
panel, clean categories, eight locked monthly choices, no synthetic holder buttons
and the signed-out Your NFTrees explanation. A 340 CSS-pixel layout check passed.
No real-wallet connection/signature/payment was performed; authenticated behavior
uses controlled tests. Release records and limits are in
`docs/profile-owned-nftrees-release-20261110.json` and
`docs/profile-owned-nftrees-validation-20261110.json`.

Use a fresh current published baseline for every future release. Never publish
the historical root snapshot. Utility: `scripts/profile-feedback/release.mjs`.

---

# Current production — Profile Studio access and navigation, 2026-11-10

Locked deploy `6af3818fdc888d00cdad3d5f`, source
`9667681f8f22ac54032be304fb40aa836a4ae97e`, PR #124.
441 static paths, all 47 complete backend function records and five schedules.
Fresh baseline `6af38002595dc15f8d7529aa`; 434 static paths preserved byte-exact.
Only four main HTML pages and three new Studio asset versions changed on promotion.
Full runtime/provider/config/build and protected environment fingerprints preserved.

Active Studio source: `production/profile-medallions-static/index.html`,
`scripts/tree-profile-studio-v3.js`, `styles/tree-profile-studio-v3.css`,
`scripts/profile-medallion.js`, `scripts/profile-studio-access.js`.
Navigation sources: `scripts/profile-site-nav.js`,
`scripts/profile-studio-entrypoints.js`, `styles/profile-site-navigation.css`,
`production/profile-entrypoints-static/{home,command,arcade}.html`.
Existing guided Arcade scripts from PR #123 remain active and unchanged.

Square ecosystem/partner art becomes circular gold-rimmed medallions in picker
and exported PNG. Sovereign City is now included from the user-supplied original;
the earlier pending-artwork note below is superseded. Monthly designs are locked
previews until earned for the authenticated wallet. A separate six-rarity holder
collection requires exact current canonical NFTree ownership (direct and supported
Kiosks), and revokes on transfer/expiry/account changes. Restricted exports refresh
verification. Existing one-hour Arcade session and payment approvals remain intact.

Studio now has the homepage header; homepage has a prominent feature and menu link;
Arcade has a Studio destination immediately after Badge Collection; Command Center
has a Studio navigation link. All original scripts on these three pages are exact.

Ten focused tests passed, actual transparent round-artwork PNG inspected, desktop
published navigation/artwork verified, and 340 CSS-pixel mobile menu tested.
Authenticated access/transfer/race cases use controlled mocks, plus real read-only
GraphQL schema/type/rarity checks. No live-wallet signing or payments performed.
Records: `docs/profile-studio-medallions-live-release-20261110.json`,
`docs/profile-studio-medallions-validation-20261110.json`,
`docs/profile-studio-access-design-20261110.md`.
Use a fresh complete published baseline for future releases; never replace it with
the historical root snapshot. Release utility: `scripts/profile-medallions/release.mjs`.

---

# Current production — guided Arcade and Profile Studio, 2026-11-10

Locked deployment `6af37ace6ec0f06da74b724f` publishes the coordinated guided
Arcade and Profile Studio update from source commit
`0f773ec5356164f46a69e4aca8ccfaf6d0dcd3d9`, PR #123.

Active sources:
- Arcade: `production/arcade-guided-static/index.html`
- Core integration: `scripts/arcade-daily-growth-guided.js`, campaign/social
  `*-guided.js` siblings, `scripts/arcade-guided-v2.js`, `scripts/arcade-share-builder.js`
- Studio: `production/profile-studio-v2-static/index.html`,
  `scripts/tree-profile-studio-v2.js`, `styles/tree-profile-studio-v2.css`
- New transparent overlay assets: `assets/profile-studio/`

One compact daily/monthly summary stays above the navigation. Monthly Progress
replaces This Month. The main starter guide separates free attendance,
optional follow, game choice and coordinated three-style sharing from the
optional existing First Round bonus badge and quiz. Legacy badge requirements
and previously earned progress remain unchanged. Telegram is a working
community link rather than a pending verification task. Voting choices are
browseable while signed out; submission remains authenticated and limited.

Share graphics use original game artwork, with PNG/native-share and prefilled
X composer options. No automatic publishing or invented score/result. Current
saved Garden result stamps and Tree Force participation have distinct labels.
The API does not expose consistent score receipts, so cards do not assert scores.

Profile Studio adds TREE logo/Thickquidity/NFTree artwork, original VICTORY and
BOOM power-up art, and a separate Sui emblem. Autumn Glow and Christmas Lights
use real illustrated overlays. Leafy Canopy and Sui emblem are independent.
Classic Gold, Canopy Mint and the badge collection design are unchanged.
Sovereign City artwork was not present in current Tree Force assets/bundles
or accessible source searches; that item remains pending the original asset.

Session regression repeatedly navigated all seven tabs without signing or
check-in calls, preserving the same valid stored session. Transient restore
hides actionable sign-in UI; one-hour expiry remains and explicitly states
saved attendance stays saved. The user's original real-wallet prompt was not
reproduced in a live signed-in browser; no expiry/security weakening is claimed.

Validation: five focused tests, desktop and 340-CSS-pixel zoom-based layout
checks, actual three-style game share PNG export, local-image profile loading,
1024px transparent frame and composed-photo downloads inspected. No real-wallet
sign-in/payment or social publishing performed. Details and full inventory:
`docs/arcade-guided-validation-20261110.json`, preview and live release records.

Fresh promotion baseline `6af37a24db5b4154a0999951` had 429 static paths.
Promotion changes only `/play/index.html` and `/play/profile-studio/index.html`;
427 other static paths, all 47 complete function records, five schedules,
provider/runtime/build settings and protected environment fingerprints remain
exact. Initial review added14 paths to the prior415 without altering those paths.
Capture a fresh complete live baseline before future work; never publish the
historical root snapshot over current production.

---

# Current production — Know Your TREE dropdown fix, 2026-11-10

Locked deploy `6af370678cf2aa50165d807a` fixes quiz answer browsing on `/play/`.
Source commit `6479a1236531e6a8286be32357a01662f4ca344a`, PR #122.
Only `/scripts/arcade-quest-campaigns.js` changes, from repository source
`scripts/arcade-refresh/arcade-quest-campaigns.js`. Answer selects remain
usable while signed out, before saved progress loads, and after this week's
stamp. Submission still requires the existing verified session/progress and
weekly eligibility. Accessible text beside the form explains each state.

Three focused tests passed. All three selections were changed successfully
in both isolated `/play/quiz-preview/` and live `/play/#campaigns`; signed-out
submission remains disabled. No real-wallet scoring/credit submission was
performed. Session, API, payment, scoring and reward logic are unchanged.

Fresh main baseline `6af3701ad1b172340c881dcc` had 415 static paths;
414 remain exact, all 47 full function records and five schedules are
preserved, with runtime/build/environment fingerprints intact. Preview added
three isolated review paths without changing the prior 412 paths. Records:
`docs/arcade-quiz-release-20261110.json`, preview release and validation JSON.

The active Arcade page and Profile Studio remain the seasonal sources below.
Capture a fresh complete inventory before every deployment; never publish
the historical root snapshot over current production.

---

# Current production — seasonal Arcade and Profile Studio, 2026-11-10

Locked deploy `6af36decd5317e3867e86e8f` publishes the seasonal Arcade UI on
`/play/` and the local photo tool at `/play/profile-studio/`. Frontend source
commit `a93907cfaa55b2517966deb2dda58428369def2c` is in PR #121.

The active Arcade page source is `production/arcade-autumn-static/index.html`.
Its presentation modules are `scripts/arcade-seasonal-data.js` and
`scripts/arcade-seasonal-v1.js`, layered on the unchanged navigation module.
Profile Studio source is `production/profile-studio-static/index.html`,
`scripts/tree-profile-studio.js`, and `styles/tree-profile-studio.css`.

November/December retain four existing attendance goals (3/7/14/21 days),
with Autumn Hero/Christmas Hero at 21. December is an upcoming collection
until December 1 UTC. Campaigns and Community use open scrolling sections;
attendance has a persistent visible callout; Month badges precede the calendar.
Profile Studio offers local photo crop, four borders, nine badge decorations,
three ecosystem artwork choices and 1024px PNG/profile-frame downloads.
Selecting artwork never awards an achievement.

Fresh promotion baseline `6af36ba4757ed7f4d9bd47c5` had 412 static paths.
Promotion changes only `/play/index.html` and the seasonal stylesheet;
410 other paths, all 47 complete backend records, five schedules, runtime,
build settings and protected environment fingerprints remain intact.
The staged preview added 16 paths while preserving all prior 396 paths.
See `docs/arcade-autumn-release-20261110.json`, the preview release record,
and `docs/arcade-autumn-validation-20261110.json` for inventory and evidence.

Desktop and 340-CSS-pixel narrow layout checks passed. Actual local-photo
loading and PNG downloads passed; exported alpha and 1024px dimensions were
inspected. Three focused Node tests passed. Original wallet/payment/game/
quest scripts remain byte-exact; signed-in actions and payments were not
exercised. The 25 SUI Tree Force event remains coming soon, entries closed.
Capture a fresh full current baseline before every release. Never publish
the historical root build as current production.

---

# Current production — Arcade history restoration, 2026-11-10

Locked deployment `6af3618b197365bd03c62936` corrects Back/Forward restoration
for the visible Arcade navigation. Source `0fd80495eff1a93d5c2dfff1e73f32e780da761d`
is in PR #120. The fresh baseline is `6af35ef0c1679f00c601ca0e`.

Only `/scripts/arcade-navigation-v1.js` changes. All 395 other static paths,
47 complete backend records, five schedules, runtime/build settings and
protected environment fingerprints are preserved (396 total static paths).
The full current inventory is
`docs/arcade-navigation-history-fix-release-20261110.json`.

The main page remains `production/arcade-navigation-static/index.html`.
Fresh /play/ defaults to Games; Daily → Back restores empty-hash Games;
Forward restores Daily without adding a new history entry. The live browser
regression evidence is in `docs/arcade-navigation-history-regression-20261110.json`.
Capture a fresh complete baseline before every future release.

---

# Current production — visible Arcade sections, 2026-11-10

Locked deployment `6af35ef0c1679f00c601ca0e` publishes the visible section menu
and upcoming 25 SUI Tree Force challenge on `/play/`. Source commit is
`75147f406d96d0623514e6b091f9047765d44267`, PR #120. The active page source is
`production/arcade-navigation-static/index.html`, with presentation assets
`scripts/arcade-navigation-v1.js` and `styles/arcade-navigation-v1.css`.

Fresh promotion baseline `6af35dfcb412ba20353c478c` contains 396 static paths,
47 backend functions and five schedules. Only `/play/index.html` changes;
all 395 other paths and exact function/package/runtime/provider records,
schedules, build settings and protected environment fingerprints are preserved.
See `docs/arcade-navigation-release-20261110.json` for the full current inventory.
The earlier review added `/play/navigation-preview/` and the two new assets
without changing any existing paths.

Games is the default. Daily, Campaigns, Community, Events, This Month and
Badge Collection are available without opening an outer disclosure. Full
calendar/monthly progress is under This Month. Original wallet, payment,
quest and game JavaScript stays unchanged. Event entries remain closed and
dates unset. Functional, keyboard/history and 340-CSS-pixel narrow-layout
checks are recorded in `docs/arcade-navigation-validation-20261110.json`.

Before every future release capture a fresh complete live inventory. The
historical root snapshot build must not replace current production.

---

# Current production — homepage ecosystem refresh, 2026-11-07

Deployment `6aef8152b93ffa0224e1f0cd` refreshes the homepage with live TREE Force ’89,
Canopy Defense and Canopy Breaker previews, full App/Arcade/NFTree/Rewards
entry cards, clearer access and purchase wording, and grouped Resources navigation.
The hero video, contribution dialog and five existing market nodes and requests
are preserved. All five figures loaded in browser checks; desktop and narrow
454/340 CSS-pixel layouts were checked without horizontal overflow.

Source `223004ee3ac7f8300df6a0e418c3113240dbc6e2` uses the newly captured current
347-path baseline `6aef7c5589af8c6d5a21ce78`. Only `/index.html` is replaced;
`/scripts/homepage-refresh.js` and `/styles/homepage-refresh.css` are added,
bringing the complete inventory to **349 static paths**. All 43 complete backend
records, five schedules, runtime settings and protected environment fingerprints
match. See `homepage-refresh-release-20261107.json` for the complete inventory.
Capture this release before future publication. The root historical snapshot
and manifest remain intact; the active homepage source overlay is in
`homepage-refresh-static/index.html`. Never replace production with the old root
snapshot build. No transaction or wallet module was changed.

The market resilience and preservation checks pass, as do both required GitHub
workflows. The optional legacy `homepage-simple-source` test still asserts old
Vite asset-import syntax in unchanged `scripts/home-v2.js`; this pre-existing
source assertion is recorded separately from current browser behavior.

---

# Current production — supplied rewards artwork, 2026-11-07

Locked deployment `6aef79ac2b3345f579dd4e3e` replaces the rewards card image with Peter's supplied `5115.jpg`, stored byte-for-byte as `/rewards/nftree-rewards-hero.jpg`. Source `755a77bb3dc8b4642f89b7c31fbf57ea34f9fb29` is merged in PR #91. TypeScript/build passes and preview framing was visually checked. All 330 prior paths remain, with only `/rewards/index.html` replaced and eight assets added (338 total). All 43 backend records, five schedules and protected environment fingerprints match. See `nftree-rewards-release-20261107.json` for the complete current inventory. Capture this deployment before future releases.

---

# Current production — rewards character framing, 2026-11-07

Locked deployment `6aef77ffb97eb2200655b411` anchors the rewards illustration to its top edge, keeping the character's head and raised hand visible. Source `664f152938428d811aea699d5cf85cb46ac12b5a` is merged in PR #89. Build passes and the preview was visually checked. All 322 previous paths remain, with only `/rewards/index.html` replaced and eight new hashed assets (330 total). All 43 backend records, five schedules and protected environment fingerprints match. The complete current inventory is in `nftree-rewards-release-20261107.json`; capture this deployment before future releases.

---

# Current production — rewards background video, 2026-11-07

Locked deployment `6aef763bf1c54c76ba751d1c` restores the original TreeDrop video at `/rewards/`, with pause/resume, reduced-motion support and a dark overlay. Source `9e487c34a49798a9910b3996eb74b0959696490f` is merged in PR #87. All 314 prior static paths, 43 complete backend records, five schedules and protected environment fingerprints were verified unchanged, except the rewards HTML entry. Eight hashed assets bring the total to 322 paths. TypeScript/build and all 40 application checks pass; preview playback and pause/resume were checked in a browser. The current inventory is in `nftree-rewards-release-20261107.json`. Capture this current deployment before future releases.

---

# Current production — native NFTree Rewards, 2026-11-07

Locked deployment `6aef6c32cb53f14a782ffc71` serves the native NFTree Rewards
page at `https://tree-token.xyz/rewards/`. Reviewed source is
`4e28e7bafd32ba08aeeacded2f1784fdf86dc28a`, merged in PR #84 as
`7468d9557d34b63e9da5436cf0987df6f61997cf`.

The release preserves **all 43 complete backend package/provider/runtime/route
records, five scheduled jobs, protected environment fingerprints, and every
previous static path**. There are 314 static files: only the two existing
homepage and Arcade HTML files changed, with native reward bundles and a small
homepage entry script added. No existing backend was rebuilt and no reward
transaction was signed or executed. See `nftree-rewards-release-20261107.json`
for the complete current inventory and validation. Earlier manifests and build
snapshots below remain historical recovery material; they do not contain the
complete current 314-file/43-function deployment.

`rewards-app/` contains the pinned source for holder claims, verified ownership
snapshots and the direct-distribution manager. Build its own package with
`npm ci --ignore-scripts` and `npm run build`, then use a newly captured current
preservation baseline for any future publication. Never deploy an old root build
as a replacement for the current site or rebuild unrelated functions.

TreeDrop's root now forwards visitors to the native page through a fixed,
serve-time head snippet (`Native NFTree Rewards entry`, ID `0`). Its original
published deployment `6a89d2b2ceda1c578f9baa02`, seven static files and two backend
packages remain intact and locked. An attempted server-redirect candidate was
stopped when Netlify requested unavailable older function archives; it was never
published. The forwarding source is `scripts/treedrop-native-entry.html` and four
focused checks cover its fixed destination, query/hash preservation, API exclusion
and JavaScript-disabled fallback. The private TreeDrop repository also retains
root/index server redirect rules for future builds. Current forwarding is not an
HTTP 301 response; the browser follows the fixed native destination immediately.

Validation passed: 40 application checks, 15 preservation/redirect checks, four
entry forwarding checks, TypeScript, production app build, desktop and narrow
340-CSS-pixel browser layout, homepage/Arcade links, wallet picker, sponsor form,
manager gate and canonical redirects. Read-only Mainnet tests validated existing
receipts, every registered token's decimals, a complete 1,420-NFT snapshot with
zero unresolved owners, original-package SUI claims and a four-token community
claim batch. SUI/community package families require separate wallet approvals.
Operator payout records are browser-local with export/import; gas sponsorship is
not enabled.

---

# Current preservation baseline — validation only, 2026-11-02 UTC

Authenticated read-only capture and verification protect published, locked deployment `6ae8112dce29c5db8b725ff0`: **288 static paths, 41 complete function records, five schedules, and 50 site Functions environment entries**. The captured records, canonical SHA256 sidecar, and validation report remain in the local ignored `.netlify/` directory. See `../docs/preserved-release-validation.md` for usage and API visibility limits. This records the current live state; it does not publish or synchronize the historical source/build manifest with all later feature releases.

`node scripts/release-preserved-production.mjs verify` fails if the publication, any complete backend record, schedule, runtime setting, static path/digest, or protected API-visible environment fingerprint changes. Capture requires an explicit expected deployment ID and refuses to overwrite a baseline. The script no longer permits the historical metric-package replacements or any publish/restore mode. No production changes were made by this maintenance work. Earlier sections below are historical records.

The version 2 local baseline is `.netlify/preservation-baseline-v2.json`. It excludes only the build-settings audit field `updated_at` from configuration equality, preserving that timestamp separately as an observation. All other settings retain aggregate and per-field hashes. Version 1 evidence is retained locally; its aggregate-only settings hash cannot reconstruct historical field-level differences. See the validation guide for the explicit version migration review.

---

# Historical production — validated VICTORY reward display, 2026-10-06

Deployment `6ac58a83cdbea77d7a4a7336` is published and locked. Source commit `359e39ec17b0b437606abe3275b42df2bbc01a79` (PR #53). This frontend-only follow-up removes fallback to legacy reward analytics: reward APR remains unavailable whenever the on-chain incentive validation fails. The regression fixture includes a legacy analytics object marked verified alongside unavailable incentives.

Only `/dapp/v3-workspace.js` changed from `6ac572a85dc967783eb08fb0`. All 38 exact function packages, 194-file inventory, runtime configurations and five schedules are preserved.

---

# Current production — V3 metrics and VICTORY rewards, 2026-10-06

Deployment `6ac572a85dc967783eb08fb0` is published in production context and locked after explicit approval. Reviewed source commit `a9d7486b250f46b537939798b4f13b8c1c3335fa` (PR #53).

Only `/dapp/v3-workspace.js` and the read-only `tree-v3-overview` handler changed. TVL and complete on-chain volume are independent of enriched APR validation. Trading fees and VICTORY emissions are shown separately, with their different denominators stated. Emission rates and reward end dates must match on-chain accounting; token prices and active TVL remain venue-provided estimates.

All 194 static digests, 38 function configurations and five schedules were verified. The other 37 function packages remain exact. The published V3 handler is archived in `production/functions`; the previous handler remains in `production/previous-functions` for rollback. All three candidate GitHub workflows, focused fixtures, live API checks and browser review passed. CI has returned to the production source-parity gate.

---

# Source parity verified — 2026-10-06

`npm run verify:backend-source` rebuilds all 38 handlers with the pinned Netlify packager and compares their executable files and bundled dependencies against the published archives. It also checks public route inventory and all five schedules. The check passed for deployment `6ac55dae44d5c8fe2f469850`; 34 focused recovery tests and the existing 24 production CI tests passed.

The source now restores the rotating three-question / 90-second Challenge, its test relays and rotation jobs, and the leaderboard refresh authorization response. The claim handler uses an isolated historical database adapter to preserve its production database preference and RPC behavior while the other Challenge handlers retain the newer adapter. Its compiled code matches after normalizing that adapter's source-label comment.

The comparison excludes Netlify-generated bootstrap, telemetry, and package metadata. It does not claim byte-identical ZIPs or authorize changing production runtimes, credentials, or publication. Keep the archived ZIPs as the release and rollback baseline. No production deployment or database mutation was made for this source restoration. Python 3 is required by the payload comparison, including CI.

---

# Current production — complete backend recovery, 2026-10-06

Deployment `6ac55dae44d5c8fe2f469850` is published in production context and locked. Source commit: `12d07ac0db1f50521043cd71bdb5032f93306336`. All 194 static files, 38 function packages, function configurations, and five schedules were verified against the approved release request.

Four original production packages are unchanged; the remaining 34 were reconstructed and validated on review deployment `6ac55ae1fefa47b10af44df6`. Direct leaderboard, full exposure, and behavioral badges completed successfully in review; all ten tabs opened, buy/sell quotes and wallet chooser worked, and Challenge retained three questions / 90 seconds. V3 metrics remain unverified and no wallet transaction was signed.

All 38 exact published ZIPs are now archived in `production/functions/` with SHA256 identities in `manifest.json`. Preserve these packages in future releases. The current source checkout alone is not a complete reproducible backend: recovered Challenge behavior and four restored function bundles must not be omitted by a rebuild. Production refresh credentials remain private in Netlify and are excluded from artifacts.

---

# Current production — Challenge claim correction, 2026-09-26

Deploy `6ab83984d79aa57ee13aadd3` is published and locked after PR #43,
merged commit `a185d1ecc40f40a844014cfd20f46b57a7d041bf`.

The September 22 Challenge award was immutably registered for 1,000 TREE, but
the browser had hard-coded the claim button, review, and success copy to say
50,000 TREE. `dapp/index.html` and `scripts/tree-knowledge-trial.js` now render
each award's recorded `amountRaw` and fail closed if that amount is malformed.
The claim path also passes the `Transaction` instance through simulation and
wallet approval without pre-building transaction bytes.

The `tree-knowledge-trial-claim` function now accepts the base64 `vector<u8>`
event representation returned by live Sui GraphQL, in addition to typed byte
arrays. This repaired post-claim reconciliation for transaction
`Ej9Wyaf8fWyLUf9sBAwu65wn2QWaVZYWkeY5DtfqyRvA`; the September 22 award is now
recorded as claimed. This release did not create or submit a Sui transaction.

All 194 static files were verified. The other 36 function packages and all five
schedules were preserved, while the exact updated claim-function ZIP is now
archived locally. Twenty focused tests, required CI, the protected candidate
inventory, live GraphQL verification, and production HTTP checks passed.

---

# Current production — Challenge funding panel, 2026-09-26

Deploy `6ab81d9ca3cdab704f81a86b` is published and locked after PR #41,
merged commit `ebeeb05732eef41432566c51ea2cf7fabea16bf2`.

Four public paths changed: `dapp/index.html`, `dapp/panel-router.css`,
`scripts/tree-knowledge-trial.js`, and the new
`dapp/challenge-funding-core.js`. The Challenge tab now exposes a funding panel
only to the designated funding wallet. The panel reads the live pool state,
warns when older scored awards may consume funding first, simulates the
deposit-only transaction twice, hands the `Transaction` instance to the wallet,
and waits for finalized effects.

All 194 static files were verified. All 37 function package/provider identities,
routes, runtime/invocation modes and five schedules were preserved. No backend
was rebuilt. Automatic publication remains locked. Fifteen focused checks,
production verification, the preview build, required CI, and a live browser
check passed. No Sui or TREE transaction was signed or submitted by the
assistant.

---

# Current production — STI wallet approval fix, 2026-09-24

Deploy `6ab52b651469a000c65232e3` is published and locked after PR #35,
merged commit `cb937a40855650d25ec1f30f45b75c5789396708`, reviewed source
`8ac47c26e96596307d4b8b77764a4bdb19ac7214`.

Only three public paths changed: `dapp/index.html`, `dapp/sti-widget.js`,
and `scripts/wallet.js`. STI now exposes explicit connect/manage controls,
requires an actual signer session, and separates asynchronous purchase review
from the final wallet approval gesture. Generic `sui` account metadata remains
compatible with the existing connection validation.

All 193 static files were verified. All 37 function package/provider identities,
routes, runtime/invocation modes and five schedules were preserved. Netlify now
serializes the documented 1024 MB and Ohio defaults explicitly in some function
records; both deployments report `cmh` and effective settings match. No backend
was rebuilt. Automatic publication remains locked.

53 focused checks passed, along with desktop/390px/320px approval browser tests
and required CI. The user reported a successful preview transaction; no
transaction was signed or submitted by the assistant. See
`sti-wallet-release-candidate.json`, `sti-wallet-release-report.json`, and
`current-release.json`. The previous STI bytes remain archived under
`sti-release-static/`. Historical STI inventory tests verify those archived
bytes, while current production verification uses the new manifest.

---

# Historical production — STI release, 2026-09-23

Deploy `6ab345e1b9c190b8487f1d7b` is published and locked after PR #32, merged commit `1fc415b63b2eeab0afc5a1ab8372085517a004b7` (candidate source `804d5d24c1007e9540c95d877a57c14d2d8ee8c9`). Native STI Stats includes the restored local index icon, basket segments, live Cetus STI/SUI price and index backing per STI. The reviewed native purchase route and safeguards remain intact; no third-party embed executes. Late Slush session restoration and preview Canopy reads were corrected before release.

All 193 static files are recorded in `manifest.json` and `current-release.json`. Both production and feature-preview builds now contain 193 unique files. All 37 existing production function packages, routes/configuration and five schedules were retained without rebuilding; only two exact function packages are available locally. Keep automatic production publishing locked and preserve running backend packages for frontend-only releases.

Validation: 56 focused tests, STI browser/visual QA at 1440/390/320 widths, six wallet-restoration scenarios, desktop/mobile nonblocking wallet picker checks, three bootstrap failure cases, required CI checks, production snapshot verification/build, exact hosted file inventory and eight changed public file hashes. Live V3, volume, liquidity and Knowledge Trial status APIs returned HTTP 200/ok. No transaction was signed or submitted. See `sti-verification-20260923.json` and the review evidence under `docs/sti-review/`.

The Canopy exposure/badge snapshots still return their pre-existing not-ready state. The unrelated legacy Arcade diagnostic remains non-blocking. The historical notes below describe earlier deployments and are not current release instructions.

---

# STI integration review — 2026-09-23

The STI branch includes current main through PRs #30/#31. Published file digests, release metadata, backend identities and schedules remain unchanged. Four original published files (`dapp/index.html`, `dapp/styles.css`, `dapp/interaction-bootstrap.js`, `scripts/wallet.js`) are archived under `production/live-static/`; the manifest now reads those copies to retain a reproducible production snapshot while the editable files contain the reviewed native STI integration.

`npm run verify:production` and `npm run build` verify/build the 189-file published baseline in `dist/`. `npm run build:preview` builds a separate 193-file candidate in `dist-preview/`, using public manifest paths (including supplementary assets), four explicit frontend overlays, and three explicit STI modules plus the local STI icon. `tests/sti-preview-build.test.mjs` checks every output digest and the complete candidate inventory.

Netlify Deploy Previews use only the separate public read proxy in `netlify/preview-functions/`. It accepts GET requests on explicit public endpoints, including Knowledge Trial status and the Canopy exposure/badge snapshots, and does not forward credentials or non-status actions. Existing production functions, schedules and state-changing APIs are not rebuilt. Knowledge Trial submissions and backend writes are deliberately unavailable in this review environment. STI quotes and unsigned simulations use the reviewed Mainnet path. Do not promote this review deployment or unlock automatic publication; an eventual production release must preserve all current backend packages and use a separately verified release inventory.

# Current production — 2026-09-23

Deploy `6ab31e7878c67aff72b0dc54` is published and locked from merged PR #30, source commit `dae05c8e9fdd675fb77caeac7e5507616b38cf98`. The V3 headline displays the verified SuiDex + Cetus + Turbos sum and fails closed. The only public-file change from the previous live release is `dapp/v3-workspace.js`. Knowledge Trial is preserved byte-for-byte; only the two read-only metrics functions were updated. All other 35 functions and five schedules are preserved. The STI Stats branch remains separate.

Validation: 24 focused tests, both GitHub workflows, production verification/build, live API and file-hash checks, and browser navigation checks passed. At verification, $16.46 + $59.692141830144 + $5.449790692352001 = $81.601932522496, displayed as $81.60. Stats navigation worked with its existing last-verified market snapshot fallback during a provider outage. See `current-release.json` and `verification-20260923.json`.

---

# Corrective release candidate — 2026-09-23

The release snapshot now reconciles all 189 files from locked production deploy `6ab219d0f2e18c9096895bf6`. The only intended public-file change relative to that deployment is `dapp/v3-workspace.js`: combine verified SuiDex, Cetus and Turbos 24-hour volume, reject missing/invalid values, and clear the headline while loading or on failure. Zero remains valid.

Knowledge Trial purchase verification, the live homepage/assets and litepaper are recovered byte-for-byte. 35 current backend packages and all five schedules must be reused, not rebuilt. Only tree-volume and tree-liquidity are updated: per-pool Cetus/Turbos coverage, bounded event pagination, and fail-closed incomplete coverage. Their reviewed source and exact packages are tracked under production/metrics-functions. None of the historical local ZIP archives are verified matches for the current packages. `release-baseline-20260923.json` records the live baseline; `manifest.json` describes candidate static bytes and required backend identities.

Use the authenticated preserved-package release script for preview and promotion. Do not deploy the root functions directory through an ordinary full-build deploy. Keep automatic publication locked. The STI Stats branch is excluded.

The production verification/build checks snapshot byte integrity; it does not assert backend source parity. Newly recovered supplementary deployed files are stored under `production/live-static` and built at their recorded public paths.

---

# Current production — 2026-09-18

VICTORY funding and MAX fixes are published and locked as deploy `6aad931f45a27f392303e229`, from GitHub commit `06211bf3f558b775ced7eb5dba2c90461f2487da` (PR #26). See [current-release.json](current-release.json) for the complete live static-file inventory, backend digests/configurations, five schedules, and previous deployment.

Only three public files changed: `dapp/earn-transactions-core.js`, `dapp/victory-center.js`, and `dapp/victory-transaction-core.js`. All 35 backend functions and the live generated Netlify configuration were preserved. The release reused the existing `kelpie-v3-release-safe` deployment context before promotion; this is a hosting context label, not the source branch. Kelpie remains V3-only.

The source snapshot manifest verifies repository file bytes. Its original deployment metadata and archived generated `deployed-netlify.toml` are historical; the current live configuration differs from that archive. Use `current-release.json` as the live deployment inventory, and preserve configuration directly from the published deployment for frontend-only releases.

Validation: nine focused suites, SDK funding checks, two unsigned seven-day-lock mainnet simulations, desktop/mobile browser checks, and user wallet preview confirmation passed. Unrelated legacy Arcade diagnostics remain non-blocking and visibly failing.

---

# Production baseline — 2026-09-15

This directory records the live TREE deployment `6aa70deff0b74e2bfe8b7725`, published September 13, 2026. Synchronizing this baseline does not publish a new deployment.

## Verified recovery

- All 166 deployed files have been recovered and verified against Netlify's SHA-1 inventory, including the protected deployed configuration.
- Public HTML, JavaScript, CSS, and assets are restored at their normal repository paths. The homepage includes its exact deployed compiled bundle; the prior editable source remains in Git history.
- `manifest.json` maps every deployed path to its repository source and records all 35 function identities/configurations and five schedules.
- `functions/` contains 30 exact deployed ZIP packages verified against Netlify's SHA-256 digests. These are recovery artifacts, not a directory to publish as public site files.
- `deployed-netlify.toml` preserves the historical generated configuration, including its old absolute build paths. The root configuration remains portable.

## Remaining source verification gap

Five locally cached function ZIPs differ from production: `tree-knowledge-trial`, `tree-knowledge-trial-admin`, `tree-knowledge-trial-resolver`, `tree-knowledge-trial-rotation-on-deploy`, and `tree-knowledge-trial-rotation-scheduled`.

Their exact deployed identities are retained in the manifest and their running packages remain on Netlify. Local source candidates were found and preserved under `recovery/source-candidates/`; they must not be represented as verified production source. The other existing `netlify/` sources also require a reproducible package comparison before a full backend rebuild. Do not replace these running packages merely to make a build pass.

## Verify and build

Run `npm run verify:production` to verify the recovered bytes and function archives. Run `npm run build` to create the exact 166-file static snapshot in `dist`. A different old build must first be preserved or removed. The build never copies function ZIPs, recovery candidates, or private server source into `dist`.

This is a production recovery baseline, not a new feature release. The VICTORY fix remains separately reviewable in PR #22; the Kelpie changes remain in PR #21. Neither is part of the captured live site.

## Keeping the repository synchronized

1. Begin future work from the synchronized `main` branch and commit changes on a feature branch.
2. Test a preview before publishing. Record the exact commit, static-file digests, function package digests, schedules, and resulting deployment ID.
3. For a frontend-only release while backend recovery is incomplete, retain the current verified backend package identities rather than rebuilding unrelated functions.
4. Update this baseline and manifest after an authorized production release, then fast-forward the computer's checkout.
5. Do not unlock automatic production publishing until the five missing exact function packages or equivalent source parity have been resolved and verified. The currently published deployment is locked during this synchronization to avoid an incidental full rebuild replacing it.

The separately dirty `tree-token-v3-repair` workspace was inspected read-only and remains untouched.
