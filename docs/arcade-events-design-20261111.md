# Scheduled Arcade events — first review

The canonical review route is `/play/events/preview/`. Paid entry and score submission remain closed. The second stage adds an authenticated NFTree ownership check and server draft controls for explicitly allowlisted organizer wallets. Local storage and server storage are labelled separately. No receipt or entitlement is issued.

## Agreed model

- 5 SUI once per wallet per event, unlimited fresh eligible attempts during the window.
- Winner receives max(25 SUI, 80% of collected entry revenue); organizer funds the shortfall where necessary. Organizer remainder is before costs.
- Explicit start/end instants, Central Time or UTC input. Reject ambiguous/nonexistent daylight-saving times. Start inclusive, end exclusive; both run start and completion must be inside the window.
- Best verified score per wallet, ties resolved by earliest verified achievement time. NFTree ownership is required before entry payment and each ranked run; other Arcade access routes do not qualify.
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

## NFTree-only foundation, November 11

- New isolated handler: `netlify/event-functions/arcade-events.ts`, `/api/arcade-events`. Uses existing Arcade bearer-session authentication and rejects expired/revoked/wrong-origin sessions. No wallet SDK or existing handler is changed.
- Eligibility calls `getCanonicalNftreeOwnership` directly on the server; it does not call the cached public wallet endpoint. Direct NFTrees and wallet-controlled Sui Kiosks count. Wrong collection/network/wallet, inconsistent counts, provider errors and no NFTree fail closed. The shared check must run separately before future payment intent creation and each future ranked run; neither action is enabled in this release.
- Three private tables: organizer allowlist, versioned event drafts and append-only draft history. Only service-role RPC calls can read/write them; RPCs validate the Arcade session and organizer membership within the transaction. The organizer allowlist starts empty: Peter must identify the management wallet before activation. Do not infer it from unrelated treasury or Arboretum addresses.
- Database enforces fixed 5 SUI / 25 SUI minimum / 80% terms, NFTree-only access, and payment disabled. Save uses expected-version checks plus a per-event transaction lock; outdated edits cannot overwrite a newer version. Locked drafts reject further edits.
- Frontend checks do not grant entry. A changed wallet discards a pending reply. Existing wallet sign-in is reused; no timer interrupts gameplay and no new signature/payment flow is added.
- Test command: `node --test tests/arcade-event-core.test.mjs tests/arcade-event-access.test.ts tests/arcade-event-database.test.mjs tests/arcade-event-controls.test.mjs` (15 tests). Dependencies pinned separately in `vendor/arcade-events`.
- Live migration applied through Supabase after PGlite tests; verified RLS, browser-role denial and service-only RPC execution. Security advisors report INFO-only no-policy notices for these private default-deny tables, as intended; no browser policy is added.
- Package only `arcade-events`; preservation release may add this one handler and update only the workshop assets. Capture the current site baseline: other Arcade work has changed production since the first preview. Preserve every complete existing backend record and all five schedules.

Remaining: authorized organizer wallet selection, verified payment/receipt handling, server run tickets and game-specific anti-cheat, permanent cosmetic grants, reviewed cosmetic artwork, cancellation/refund policy and payout finalization. This foundation does not claim tournament scores are verified by the existing ordinary completed-run tracker.
