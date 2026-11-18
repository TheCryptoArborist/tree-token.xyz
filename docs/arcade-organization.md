# Arcade organization and campaign pathway

## Review scope

The November 18, 2026 presentation changes start from the actual current
`/play/index.html`, not the historical root snapshot. The stored HTML hash is
`7cb4b232c92dcc2f6e82f082672f00849d853de7` (SHA-1), matching locked production
deploy `6afde69b28000c929ce7a0a4`. The public response appends one known site
snippet; only that exact final insertion was removed to recover the stored bytes.
The original is retained in `production/arcade-organization-static/baseline.html`.

The candidate HTML adds two scoped stylesheets and one presentation module.
`scripts/arcade-organization.js` moves existing elements so their identifiers,
listeners, form values and saved-progress consumers remain intact. It does not
connect a wallet, sign a message, submit a check-in, alter score evidence, or
construct or submit a transaction.

## Tab organization

| Tab | Candidate arrangement |
| --- | --- |
| Games | Game lineup follows the tab navigation. Existing attendance shortcuts sit beside its heading. The existing upcoming-event promotion follows the cabinets. |
| Daily | The existing wallet/check-in strip is first. Daily tasks, saved-result sharing and Passport remain; spotlight voting and community links follow them. |
| Campaigns | A concise explanation and an honest upcoming state lead into practice for the existing Event. Existing getting-started, First Round and learning activities remain in three expandable sections. |
| Events | Existing Event information and announced terms are preserved. New funded campaign or Event details have not been invented. |
| Monthly Progress | Countdown and attendance overview precede the existing monthly rail. Quest Details and Recover a Missed Day are larger, styled disclosures; recovery still visibly costs 20,000 TREE plus SUI gas. |
| Badge Collection | A compact countdown precedes the current collection; upcoming artwork and earned history remain. A Daily sign-in link provides a route back to the shared controls. |

The new module uses the existing six-tab router and its `#games`, `#daily`,
`#campaigns`, `#events`, `#month`, and `#badges` links. It opens relevant campaign
disclosures before existing quiz/share scroll handlers run. It corrects the
legacy community panel's Games-only hidden state to match its new Daily home.
The original runtime and pinned wallet integration are preserved byte-for-byte.

## November deadline: display and enforcement are separate tasks

The intended exclusive end of November earning is **December 1, 2026, 00:00 UTC**.
The countdown displays this exact deadline, becomes a closed state at expiry,
retains an already displayed November collection across device month rollover,
and follows a new month when actual progress/calendar data selects it. Earned
badges remain visible. The display uses the browser clock for its time remaining;
it is not the source of award eligibility.

The source audit found a backend boundary that needs a separate change before
calling the deadline fully enforced. A recovery intent currently lasts 15 minutes
without being clipped to month end. An intent created at November 30, 23:55 UTC
could therefore accept payment just after midnight while restoring November.
This review does not change that transaction or database behavior.

The follow-up must cap new recovery intents at the earlier of their normal expiry
and next-month 00:00 UTC, check the actual payment timestamp, and preserve late
verification of a payment that genuinely occurred before cutoff. The existing
cross-month reconciliation behavior is intentional and must survive. Do not
discard awards merely because their insertion/verification timestamp is later
than the earning deadline. Existing valid paid receipts must remain reconcilable.

Relevant source boundaries:

- `netlify/monthly-functions/arcade-monthly.ts`: isolated monthly handler.
- `netlify/lib/arcade-monthly-core.ts`: recovery payment verification.
- `supabase/migrations/20261107211943_arcade_monthly_rewards.sql`: monthly rules.
- `supabase/migrations/20261107214147_arcade_recovery_reconciliation.sql`: late receipt reconciliation.
- `tests/arcade-monthly-database.test.mjs`: month-rollover evidence.

## Funded campaign decisions still open

The agreed future skill-challenge model gives every verified player who meets the
published target one equal share of a fixed pool. Campaigns should prepare players
for their associated larger Events. There is no approved weekly amount, asset,
network, campaign window or new monthly cash scheme in this change. The existing
25 SUI, one-winner upcoming Event retains its already published terms; it is not
silently converted into the new shared-pool model.

Before activation: configure the actual target/game/version, funding and fees,
window, network and token, evidence checks, player/linked-wallet deduplication,
equal attempt conditions, final roster, rounding, zero qualifiers, payout timing
and idempotent execution. Monthly cash eligibility and any drawing remain
undecided. The existing 20 verified quest-day counter is not a cash promise.

## Preview and release boundary

The normal deploy-preview builder overlays the current Arcade files and captured
runtime on the historical preview snapshot. Captured assets are explicit and
hash-checked. Preview-only code labels the review and blocks sign-in, attendance
and payment writes. Public game destinations remain links to their actual sites.
No player state is fabricated. The preview is for organization and layout review,
not for proving live wallet/payment behavior or a complete production inventory.

The candidate must not be published by the historical `npm run build` pipeline.
Any production release needs a fresh capture of the complete actual live inventory,
all backend/provider/runtime records, protected configuration and schedules.
The last audited production inventory was 616 paths, 49 backend records and five
schedules. Those counts are evidence from that release, not constants to assume
at the next release. The review builder does not publish or switch production.

## Verification recorded for review

The 22 organization/countdown cases and nine preview-boundary cases pass locally.
Coverage includes six initial tab hashes, keyboard/history routing, preserved
control identity and input state, campaign disclosures, legacy hidden-state
updates, UTC cutoff/rollover, and preview transport/control/storage restrictions.
The feature preview builds 336 explicit files, including a preview-only responsive
review frame at `/arcade-review/` with 320, 390, 768 and 1200 CSS-pixel widths.
It loads the actual review page, not a separate mockup. All 50 captured/reused current
Arcade assets and the anonymous public-rules snapshot are hash-checked by the
builder. Existing archived snapshot and 38-handler source parity gates pass.
Browser layout review remains separate from these automated checks.

## External technical guidance

The live MystenLabs/skills README was checked for this request. Applicable
guidance read: `frontend-apps/SKILL.md`, `frontend-apps/non-react.md`, and
`frontend-apps/limitations.md`. This presentation work preserves
the project's pinned, working wallet SDK and does not perform an SDK migration.
