# Monthly attendance recovery cutoff

The November 2026 earning window ends exclusively at **2026-12-01 00:00:00 UTC**. Subsequent seasons use the first instant of the next UTC month. This applies to new attendance recovery credit; already earned badges and recorded receipts remain intact.

## Payment and verification rules

- The server reads the successful, checkpointed payment and timestamp from Sui mainnet using the existing pinned SDK and ledger adapter. The browser cannot supply a trusted payment time.
- A new recovery checkout expires at the earlier of fifteen minutes after issuance and the UTC month boundary. The issuance clock is sampled after obtaining the wallet lock, so a request waiting across midnight cannot create a checkout for the closed month.
- A November-or-later payment must be strictly earlier than the month boundary and within its issued checkout window. Both the TypeScript verifier and the service-only database confirmation RPC enforce this rule independently.
- The verification date does not determine eligibility. A valid November payment can be verified in December, and a valid December payment in January. Attendance and badge calculations use the checkout's original month.
- Recovery remains 20,000 TREE plus SUI gas. It restores attendance only and does not create a completed-game quest day or monthly reward qualification.
- Seasons before November 2026 retain their original issued checkout terms. The migration does not rewrite existing intents, receipts, attendance, badges, or qualifications.
- Existing recorded receipts remain idempotent, with unchanged wallet binding, replay protection, session requirements, private-table RLS and service-role-only RPC access.

## Player-facing behavior

The Monthly Progress and Badge Collection countdowns show the displayed collection's UTC month end. A stale November collection stays closed instead of reopening because the browser date moved into December. Countdown display is presentation; payment eligibility is enforced by the server and database.

The recovery disclosure explains the confirmation deadline and retains a pending receipt after expiry. Verify payment stays available for an on-time payment after rollover. The expiry refresh preserves a digest the player has pasted. If the checkout expires while the payment module loads, the panel does not start a new wallet payment.

An already open wallet approval cannot be cancelled by the page's expiry check. The existing payment transaction has no on-chain deadline assertion, and this change does not rewrite the wallet adapter or transaction. The panel therefore explicitly asks players to allow time for confirmation and not approve after the deadline; a late payment does not restore attendance. An uncertain submitted payment should be verified using its digest instead of paid again.

## Database rollout

Source migration: `supabase/migrations/20261118192546_arcade_recovery_month_end_cutoff.sql`.

Applied on the existing Arcade Supabase project as migration `20261118193129`, `arcade_recovery_month_end_cutoff`. The read-only verification record is `production/arcade-cutoff-db-readiness-20261118.json`, which binds the source migration hash to both live RPC definition hashes and unchanged execution privileges. The migration only replaces the two validation functions and reiterates their existing restricted grants.

The pre-migration aggregate check found eight recovery intents, five confirmed receipts, no active unconfirmed checkout and no November-or-later checkout extending across a month boundary. Security advisory results were unchanged after the migration. No production payment, check-in or sample award was created for testing.

A separate catalog-only audit verified the live non-recovery attendance writers. Manual check-in derives the current UTC date after its lock, Garden event ingestion rejects a different date or completion day, and TREE FORCE assigns the server's current UTC date without reinserting attendance on replay. No client-controlled month or date can backdate a November attendance entry through those RPCs. The audit is bounded to the live database functions and available handler source; no claim is made about future funded challenge verification.

## Validation and release

- Published and locked on `6afe0141248c1062e8414ed7` at `2026-11-18T20:01:47.679Z`.
  Publication workflow `44386363937` passed end to end. Complete inventory,
  canonical delivery and lock checks passed at `2026-11-18T20:01:52.861Z`.
  See `production/arcade-cutoff-release-20261118.json` and the newest section of
  `production/README.md` for the exact source, inventory and browser evidence.
- The monthly/session suite passed 85 tests, with the opt-in live-chain diagnostic skipped in the ordinary suite. That diagnostic then passed separately against an existing public payment without database writes or signatures.
- Boundary coverage includes exact midnight rejection, one millisecond before midnight, ordinary earlier expiry, UTC time zones, leap February, December/January rollover, late reconciliation, earlier-season terms, replay protection, wallet binding and browser-role isolation.
- The 32 organization/countdown/preview checks passed, including preservation of captured runtime bytes and the single explicit monthly panel replacement.
- The isolated monthly package uses the unchanged `vendor/arcade-monthly` lock and SDK 2.26.1. The wallet adapter is not rebuilt or changed for this feature.
- All 18 release-preservation tests and all five PR workflows passed. Six-tab
  candidate reviews passed at 390 and 1200 pixels; canonical review passed at
  1363 pixels, including a monthly deep-link reload and the recovery disclosure.
  These signed-out checks did not create real check-ins, payments or awards.

The production release must capture the actual current complete static/backend/runtime/provider/configuration inventory. It may replace `/play/index.html`, `/scripts/arcade-monthly.js` and the isolated `arcade-monthly` package, and add the four reviewed organization/countdown assets. Every other live path and backend record, including the five schedules, must be preserved. The historical root snapshot build is not a production release payload.

## Technical references checked live

The current MystenLabs/skills README and relevant guidance were checked for this request: `accessing-data/SKILL.md`, `accessing-data/grpc.md`, `sui-sdks/SKILL.md`, `sui-sdks/typescript.md`, `sui-sdks/llm-docs.md`, and `sui-ts-sdk-backend/SKILL.md`. SDK details were checked against `vendor/arcade-monthly/node_modules/@mysten/sui/docs/llms-index.md` and `docs/clients/grpc.md` from the pinned installation. The existing gRPC integration was preserved; no SDK migration was introduced. Supabase function privilege and migration guidance, its current changelog, and Netlify deployment guidance were also consulted.
