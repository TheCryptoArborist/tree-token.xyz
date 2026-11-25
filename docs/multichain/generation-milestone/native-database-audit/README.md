# Native database compatibility verified — November 24, 2026

The hosted read-only audit completed successfully. **No owner credential setup
is needed.** The prior request to add a GitHub Actions database secret is
superseded by the existing hosting connection described here.

[Successful run 45537779169](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45537779169)
verified source commit `ec38f4f3`. Sixteen disposable audit checks passed first.
`hosted-catalog-verified.json` retains the actual catalog evidence;
`hosted-success.json` retains the run/commit receipt.

## Findings

The database identity equals the identity pinned in the byte-for-byte reproduced
native backend: `df2f0abee059d9898495a125018fa0a291d50b9050c0d4557231f409bed53065`.
The native package digest and ready/locked deployment
`6b064f079c4511c1d31205e3` were checked before and after the audit.

All four native tables match the pinned native SQL in columns/defaults,
constraints, indexes, user triggers, policies, RLS and table kinds. The connection
used PostgreSQL 18.7 (`server_version_num=180007`). Its table privileges show
SELECT allowed and INSERT/UPDATE/DELETE denied. No application rows were read.

The seven proposed shared tables are absent:

- `arcade_native_sui_accounts`, `arcade_native_sui_runs`
- `arcade_native_paid_recoveries`, `arcade_native_sui_payments`
- `arcade_continue_payments_v2`, `arcade_continue_claims_v2`, `arcade_continue_events_v2`

The `private` schema is absent, as are `anon`, `authenticated` and `service_role`.
Those roles are assumed by the source-only proposal SQL used in disposable
fixtures. **Do not apply those proposals unchanged to this database.** The next
milestone must adapt schema ownership/permissions to Netlify and test them.

This is a point-in-time catalog compatibility finding. It does not verify player
records, application write-role privileges, frontend behavior, every database
object, or future deployment state. It does not approve migration, payments,
restore authorization or gameplay activation. No database settings, player rows,
schema, deployment, live authentication, game, score or tournament were changed.

## Existing hosting connection

Released source commit `bf4537220bb9a9b096cfaab9598fa2cd13556db9` records the branch
ID `feature/treeforce89-play-integration` in
`docs/treeforce89-paid-migrated-isolation.json`. The original native release
scripts also use Netlify's database branch API. We inspected the current official
OpenAPI specification at `https://open-api.netlify.com/swagger.json`: its
`getSiteDatabaseBranch` GET operation supports `role=netlifydb_readonly`.

The audit obtains that **specific existing branch's read-only connection** inside
Actions using the existing Netlify integration. It validates provider, database
path, pinned identity and the `netlifydb_readonly` username before connecting.
No new database, database branch, role or credential is provisioned. The URL is
never printed, saved to a file or exported to the model/user. The runner no longer
reads any environment variables from Netlify or a database secret from GitHub.

The HTTP path allowlist permits only the exact site, deploy metadata, and exact
recorded branch with `role=netlifydb_readonly`. It rejects environment listings,
individual environment keys, branch listings, other databases and the owner role.
All requests are GET. The database connection defaults to read-only, with bounded
connection/statement/lock/idle-transaction timeouts. The catalog is read on one
connection in a REPEATABLE READ READ ONLY transaction; read-only mode is checked
and the transaction is always rolled back.

## PostgreSQL catalog compatibility

The first successful connection returned `nativeSchemaMatches=false` solely
because PostgreSQL 18 adds `pg_constraint.contype='n'` records for NOT NULL.
PostgreSQL 17's reference represents the same requirement in column nullability.
The raw first result is preserved in `hosted-catalog-raw.json`.

The comparator now accepts only an exact redundant NOT NULL definition on a
known column already checked as non-null, and only when validated and enforced.
It still compares every other constraint, plus all column definitions. Tests
reject nullable/unknown columns, unvalidated or unenforced NOT NULL, and changed
columns, keys, indexes and RLS. The reference was regenerated only from the
unchanged pinned SQL in disposable PostgreSQL; hosted drift was not copied into
it. Official reference: https://www.postgresql.org/docs/18/catalog-pg-constraint.html .

## Reproduce

With Node 24, pg dependencies in `vendor/bnb-continue-store`, and PostgreSQL tools:

```sh
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-database-audit-local.mjs
```

For unpacked tools also set `BNB_PG_SHARE`. `--write-reference` is for deliberate
regeneration from the pinned migrations, never for accepting a hosted mismatch.
The hosted workflow runs on the feature branch only with the explicit
`[approved native binding audit]` commit marker. It uses the existing
`NETLIFY_AUTH_TOKEN` integration. No extra database secret or owner action is needed.

Earlier attempts using the site environment value were blocked before connection
because the returned value was not a parseable URL. An all-environment connector
listing was rejected by approval review and was not retried. The owner then
approved a narrow audit. The later direct read-only branch method avoids the
environment listing entirely and satisfies the same pinned database identity.
`approved-audit-result.json` and `hosted-attempt.json` retain the historical failed
attempts; they do not describe the current result. The deployed native status
check is retained separately in `runtime-status.json`.

## Next implementation

Prepare a Netlify-compatible, additive shared-schema proposal outside automatic
migration directories until reviewed. Choose and test an explicit application
permission model; do not invent Supabase roles or assume the read-only role can
write. Preserve the four existing native tables and payment history.

Compose the verified native gateway with shared payment evidence/consumption,
coordinating Sui redeem/recovery and BNB import so a legacy path cannot grant the
same sequence after shared consumption. Test permissions, concurrent payments,
logout, recovery and rollback against the target schema. Preserve the separate
current game-presentation work, artwork requirements, scoring and tournaments.
Only after review should the migration be packaged for the proper existing
branch, with fresh runtime evidence and a complete production-preservation audit.
