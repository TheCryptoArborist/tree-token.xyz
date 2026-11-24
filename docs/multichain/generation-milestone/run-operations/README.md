# Production binding verification and retention operations

The user accepted ownership of the routine expired-ticket review on November 24,
2026, with Codex preparing/running checks when asked. No automatic job, reminder,
new runtime permission or schedule is installed. This is manual ownership, not a
promise that Codex runs when the chat is closed. While issuance is enabled, the
owner should request the check daily; while disabled and empty there is no data
to clean. Retention applies seven days after expiry, not ticket creation.

## Verified runtime binding

[Run 45466344470](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45466344470)
passed the check inside an unpublished Netlify production-context candidate
`6b05e11ad1a29353fee22226`. It used the normal runtime environment binding and
made only two read RPC calls for nonexistent all-zero identifiers: new review
ticket and existing identity session. Both returned null as expected. No user
rows were written or credentials exported. The check preserved all 691 live
static paths, 61 existing complete provider records, runtime, protected settings
and five schedules. Canonical production stayed disabled and unchanged at
`6b053b8285e0ee251b84ad06`. See `runtime-binding.json`.

**Do not publish the diagnostic candidate.** It adds an audit-only function and
exists solely to verify runtime connectivity. It is not the gameplay or endpoint
enablement candidate. No wallet interaction or preview link is needed.

The initial attempt to resolve credentials in GitHub CI did not succeed; it was
replaced by this in-runtime check, and its workflow/script were removed. The
runtime workflow first failed on a missing preservation-tool dependency before
creating anything; installing the unchanged isolated lock corrected that issue.
The final hosted check passed. Secrets were not saved or logged by either path.

The diagnostic reads the same explicit-override/fallback production binding and
requires the intended site, POST method, and disabled flag. Tests cover wrong
site/method, missing/partial binding, enabled flag, read-only calls and no secret
response. The actual published run-review handler remains disabled; its enabled
HTTP/session behavior still needs a separate controlled check.

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

## Validation and next step

Eighteen disposable PostgreSQL checks passed, including the three retention
checks; [contract CI 45465413809](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45465413809)
also passed. The initial hosted count found zero rows and zero expired records;
no deletion occurred. User ownership with Codex assistance was explicitly accepted.
No automatic scheduler/reminder or runtime DELETE grant was added.

Next is a reviewed, controlled generation-1 read-only enablement. Generation 1
is retired, so backing checks must deny playable access. Do not enable gameplay,
start a new custody generation, accept payment or publish the diagnostic candidate
as part of that step. Recheck current production and binding before any toggle.
