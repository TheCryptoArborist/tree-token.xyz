# Scheduled Arcade events — first review

The canonical review route is `/play/events/preview/`. This is a functional planning workshop, not a live tournament. It never connects a wallet, takes a payment, creates a server event, submits a score, or grants an entitlement. Local draft storage is explicitly labelled. A downloaded JSON draft is configuration for review, not authority to open entry.

## Agreed model

- 5 SUI once per wallet per event, unlimited fresh eligible attempts during the window.
- Winner receives max(25 SUI, 80% of collected entry revenue); organizer funds the shortfall where necessary. Organizer remainder is before costs.
- Explicit start/end instants, Central Time or UTC input. Reject ambiguous/nonexistent daylight-saving times. Start inclusive, end exclusive; both run start and completion must be inside the window.
- Best verified score per wallet, ties resolved by earliest verified achievement time. Existing access conditions remain.
- Tree Force ’89 starts with three lives and no continued runs. Other games require their own rules/adapters and are planning options only.
- Manual payout after the closed standings and winner are reviewed.
- Permanent event-specific frame and participant badge with entry, separate champion badge for verified winner. Preview uses original game artwork; visual concepts need review.

## Implemented and tested

Workshop: game/title/timezone/date editing, exact prize estimator, persistent local drafts, JSON draft download, entry cosmetic concepts, empty leaderboard, launch-readiness display. Drafts never become scheduled events just because a date passes. Payments stay disabled.

Shared pure core: integer-MIST arithmetic; local-to-UTC conversion including DST; phase rules; eligibility rules for trusted, previously verified Tree Force evidence; deterministic best-score standings; launch readiness. Browser-imported rule code is not an anti-cheat service or an authorization boundary.

Run `node --test tests/arcade-event-core.test.mjs`.

## Remaining production integration

1. Configure authenticated event management, event-specific fee recipient and guaranteed prize funding. No event recipient is assumed from unrelated game wallets.
2. Transactional private database: event versions, immutable published terms, wallet/event unique entries, idempotent checkout receipts, payment memo binding, atomic permanent cosmetic grants, cancellation/refund policy. Validate receipt sender, recipient, exact SUI amount, success and on-chain timestamp; recover submitted receipts after retries without charging twice. No ledger in localStorage or Netlify Blobs.
3. Trusted run-start tickets and game-specific server validation. Never accept client assertions such as `trust: server-reviewed`; only an authenticated server adapter may attach that status after reviewing evidence. Pure eligibility filters alone do not establish trustworthy scores. Invalid/non-finite server clocks are rejected. Unintegrated games fail closed.
4. Profile Studio wallet-linked cosmetic discovery and restoration; participant ownership survives closing. Champion grant follows finalized winner review.
5. Exercise payment retries, duplicate receipts, wallet changes, expiry, boundary times, tampered scores, continued runs, permanent unlock recovery and manual payout recording against a non-paying test event before opening paid entry.

No new scheduled jobs are needed for opening/closing: authoritative service time determines phase. A worker may notify, but cannot expand the score window.

## Release scope

Preview-only new static routes and files; preserve every existing static path, all backend packages, five schedules and runtime/environment configuration from a fresh published inventory. Do not rebuild or replace current game bundles. The existing Arcade event card is not promoted to this paid model in this stage.
