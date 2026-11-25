# Hosted BNB run-review database readiness — migration not applied

Read-only inspection on November 24, 2026 at approximately 12:32 America/Chicago
confirmed project `lehswszuekjqottolmsf` is ACTIVE_HEALTHY (PostgreSQL 17.6.1.127).
The run-review table, RPC (including other overloads), index and migration-history
entry are absent. The existing BNB authentication migration is recorded as
`20261121040149`; its local source filename has an earlier timestamp. All five
hosted function body hashes match that source exactly, so do not replay identity
migrations based on filenames or run an unscoped database push.

The existing session primary key, eight required fields, RLS, schema permissions
and service-role SELECT/UPDATE grants support the proposed migration. All five
identity RPCs are SECURITY INVOKER, have empty search_path, and deny execution to
anon/authenticated. Both identity tables deny public user access. The service
role has BYPASSRLS and is not superuser. No user/session rows or credentials were
read; the saved capture contains only catalog metadata and function-body hashes.

## Evidence and reproduction

- `catalog-query.sql`, `catalog.json`: exact hosted metadata query and response.
- `collision-check.json`: no index conflict or RPC overload.
- `migrations.json`: current migration-history names/versions.
- `project.json` and advisor files: project and pre-migration advisory baseline.
- `validation.json`: offline source/schema/grant compatibility verification.
- `local-rehearsal.json`: 15 passing disposable PostgreSQL checks, including
  HTTP issue/consume, concurrent replay, revocation and backing-loss denial.

```
node scripts/multichain/check-bnb-run-database-readiness.mjs
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-bnb-run-postgres.mjs
```

The validator checks the saved capture, not current live state. Refresh catalog
and history immediately before applying anything. A hosted canonical GET also
returned 503 `{"error":"review-disabled","gameplayAuthorized":false}` during
review. No deployment or environment change was made.

## Advisory assessment

The security advisor reports 58 INFO notices for RLS-enabled tables without
policies, including the two existing private BNB identity tables. Their missing
public grants and service-only use are intentional; adding user policies would
widen access. See [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
The health advisor reports no findings. Performance baseline contains eight
unindexed-FK INFO findings, three existing unrelated
[auth RLS initialization-plan warnings](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan),
seven unused-index INFO findings (including the BNB wallet/time index), and one
connection-allocation INFO finding. None requires changing existing auth/game
objects for this migration. Retain the BNB admission index despite its low current
usage. Full findings and remediation links are saved for before/after comparison;
this is not a claim that every unrelated project advisory has been resolved.

Supabase changelog and database-functions guidance were refreshed. No SDK/CLI,
Postgres upgrade, branching change or Sui technical change is part of this work.

## Exact next migration scope

Apply only `supabase/migrations/20261124060157_arcade_bnb_run_review.sql`, SHA256
`15a8f418df1b9155d4d54833c51a40811e39aa80405c4a0464edba03cbfcfe3e`, to the project
above. It creates one private RLS-enabled ticket table, its session/time index,
and one service-role-only SECURITY INVOKER RPC. It does not modify existing
identity, Sui authentication, payments, games, scores or tournament functions.
The hosted application remains disabled throughout; do not set an enable flag.

Before execution, repeat the metadata-only checks and stop on drift or existing
objects/history. After applying once, record the actual hosted migration version
and exact SQL hash; compare all captured identity function definitions/grants and
table definitions against this baseline. Verify new-table RLS and private access,
RPC invoker/search_path and service-only grants. Test anon/authenticated denial
and service-role read of a nonexistent hash without writing real user sessions.
Repeat advisors and explain any new findings. Do not test a real purchase or game.

Migration readiness is established; it is not a migration receipt or permission
to enable the endpoint. Seven-day expired-ticket retention and operator ownership
remain part of the later enablement review, as documented in `../run-release/`.
If validation fails, leave the endpoint disabled and fix forward; do not drop
identity objects, audit rows or restore an older site.

Hosted default privileges were also inspected (`default-privileges.json`): no
private-schema or global defaults add runtime permissions. Public RPC defaults
include anon/authenticated EXECUTE, which the migration explicitly revokes.
[CI 45460963810](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45460963810)
passed the saved readiness validator and full existing contract/test workflow.
