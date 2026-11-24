# Production binding verification and retention operations

The user accepted ownership of the routine expired-ticket review on November 24,
2026, with Codex preparing/running checks when asked. No automatic job, reminder,
new runtime permission or schedule is installed. This is manual ownership, not a
promise that Codex runs when the chat is closed. While issuance is enabled, the
owner should request the check daily; while disabled and empty there is no data
to clean. Retention applies seven days after expiry, not ticket creation.

## Binding check boundary

`check-bnb-run-binding.mjs` reads only the existing production/function-scoped
Netlify binding into CI memory, uses the same runtime configuration resolver and
RPC clients, and calls only the new ticket read and existing identity read with
nonexistent all-zero hashes. It never issues/consumes a ticket or creates/revokes
a session. It does not save or print credentials, responses or environment values.
It refuses unresolved/masked/ambiguous credentials and checks unchanged binding
metadata afterward. No new service secret is provisioned or copied into the repo.

The workflow also checks the canonical endpoint still returns 503 disabled.
A passing result proves the production binding and hosted PostgREST transport
work from CI. It does **not** prove an enabled request executed inside Netlify:
that controlled server check belongs to a later enablement step. No browser or
wallet connection is required, and no preview link is offered.

## Administrator retention procedure

1. Check the expected Supabase project `lehswszuekjqottolmsf`, endpoint state,
   current row count and the migration receipt. Do not change the enable flag.
2. Run `scripts/multichain/maintenance/bnb-run-retention-count.sql` read-only.
   Record only the count and timestamp, not ticket/session identifiers.
3. If zero, record no cleanup needed and stop. For a nonzero result, review the
   count and authorize the bounded maintenance action in the active session.
4. Execute `bnb-run-retention-batch.sql` as administrator. It deletes at most
   1000 rows whose expiry is more than seven days old, skipping locked rows.
   Lock timeout is two seconds and statement timeout ten seconds. Recount and
   record the number deleted. No unbounded loop or automatic retry is provided.
   Inspect a failed/ambiguous operation before another batch.
5. Confirm recent tickets and identity tables remain unchanged. A backlog needs
   another reviewed batch. Never delete original identity sessions as cleanup.

The endpoint's service role intentionally has no DELETE permission. No scheduled
job or extra grant is introduced. Disposable PostgreSQL tests cover the 1000-row
cap, old-only deletion, recent-ticket/session preservation and runtime denial.
No hosted deletion was executed to prepare this procedure.

The seven-day policy is a target maintained by the owner; it is not an automatic
retention guarantee. Missed checks mean old rows may remain longer, while ticket
expiry still prevents reuse. Pause enablement if ongoing maintenance cannot be
provided. Payments, scores, gameplay, NFT custody and other data are out of scope.
