# Run-review migration applied; endpoint remains disabled

On November 24, 2026 at approximately 12:40 America/Chicago, the approved single
migration was applied to project `lehswszuekjqottolmsf`. Supabase recorded it as
`20261124184014_arcade_bnb_run_review`. The exact SQL came from the committed
`supabase/migrations/20261124060157_arcade_bnb_run_review.sql`, SHA256
`15a8f418df1b9155d4d54833c51a40811e39aa80405c4a0464edba03cbfcfe3e`.
The connector generated the hosted version; the source filename stays unchanged.
Do not apply it again or use an unscoped database push to reconcile timestamps.

Immediately before application, catalog metadata matched the readiness baseline,
no new table/RPC/index existed, and history contained no run-review migration.
The apply-migration tool returned success. History now contains exactly one such
migration. The new RPC body hash matches the reviewed SQL exactly.

## Hosted verification

The private table has RLS enabled and zero rows. Its primary key, foreign key,
checks and session/time index are present. The RPC is SECURITY INVOKER with an
empty search_path. Anon/authenticated have no schema/table/RPC permissions;
service_role has only SELECT/INSERT/UPDATE and RPC EXECUTE, with no DELETE.

Actual role-scoped RPC calls in rollback-only transactions returned PostgreSQL
42501 permission denied for both anon and authenticated. A service-role read of
the nonexistent all-zero ticket hash returned null. No ticket or real user
session was created or altered. Before/after metadata confirms all existing BNB
identity table columns/constraints, RPC definitions, grants and role capabilities
are unchanged. Canonical GET returned 503 `review-disabled`, false gameplay.

`before.json`, `after-identity.json`, `after-review.json`, `postcheck.sql` and
`migration-history.json` preserve the metadata evidence. `receipt.json` records
the apply result and role checks. Reproduce the offline evidence checks with:

```
node scripts/multichain/check-bnb-run-applied.mjs
```

This verifies saved evidence, not a fresh live database snapshot. No credentials,
user rows, wallet signatures or tokens are in these records.

## Advisor comparison

Security notices increased from 58 to 59 solely because the new private table
has RLS without user policies. That is deliberate service-only access, verified
by grants and actual denial checks; see the
[RLS/no-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
Performance notices add only the currently unused session/time index, expected
for an empty disabled feature; retain it for admission and session lookups.
See [unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
Existing unrelated performance warnings are unchanged. Health has no findings.

## Remaining scope

No website deployment, environment toggle, deposit, payment, sale or gameplay
activation occurred. The next review is server binding/hosted HTTP readiness and
controlled generation-1 read-only enablement. Retention ownership still must be
resolved before enabling issuance: the proposed policy is seven days after
expiry, bounded administrator cleanup, no new scheduled job or runtime DELETE
grant. Generation 1 is retired and must deny backing; a future generation and
actual gameplay require separate reviewed milestones. Keep the endpoint disabled
if any subsequent validation fails; fix forward without dropping audit or
identity tables.
