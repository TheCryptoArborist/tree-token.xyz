# Native database compatibility audit

This bounded audit reads catalog metadata for the four native authentication,
session and redemption tables and the seven proposed shared-continuation tables.
It reads no player rows, tokens, wallet balances or payment records. It applies
no schema changes and never authorizes a runtime or game restore.

The connection comes from the existing function-scoped
`TREEFORCE89_DEV_DATABASE_URL` site binding, resolved inside GitHub Actions using
the existing Netlify connection. Before connecting, the audit verifies the same
provider/path and database identity pinned in the reproduced native backend:
`df2f0abee059d9898495a125018fa0a291d50b9050c0d4557231f409bed53065`.
It deliberately does not select the site's default production database.
Credentials are never written to artifacts or logs. Netlify access is GET-only;
raw failures are suppressed because connection errors can contain credentials.

The PostgreSQL connection defaults to read-only, with bounded statement, lock,
connection and idle-transaction timeouts. All queries run on one connection in a
REPEATABLE READ READ ONLY transaction, independently checking that read-only mode
is on and always rolling back. Queries inspect columns/defaults, constraints,
indexes, table privileges, RLS, user triggers, policies, proposed table presence,
private schema permissions and the three roles assumed by the source-only SQL.

`expected-catalog.json` is generated from the two exact pinned native migrations
in disposable PostgreSQL, not from hosted data. The local checker verifies it and
exercises real schema drift and PostgreSQL write denial. `local-tests.json`
records eleven passing checks, including denial of environment listings and unrelated binding paths. Reproduce with Node 24, installed pg in
`vendor/bnb-continue-store`, and PostgreSQL tools:

```sh
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-database-audit-local.mjs
```

For unpacked tools also set BNB_PG_SHARE. `--write-reference` is only for deliberate
reference generation from the pinned SQL, never for accepting hosted drift.

The hosted workflow triggers only on this feature branch with the explicit
`[approved native binding audit]` commit marker (requires specific binding-access approval). It validates locally before obtaining
the runtime binding. It verifies the published native package digest and locked
ready deploy before and after the audit, refusing concurrent deployment changes.
The current site binding is evidence, not proof that an unobservable deploy-time
override is identical. A successful catalog read does not grant production
activation or prove current frontend compatibility. Recheck at release time.

## Observed result and limit

The initial hosted run `45535811060` passed all ten local tests but stopped in
`binding` before connecting to PostgreSQL. Its deliberately redacted error does
not identify the failing binding assertion; no hosted catalog was obtained.
A subsequent connector request to list environment variables was rejected by
automatic approval review because it could expose unrelated secrets outside the
metadata-only audit. That request was not retried.

The prepared runner now reads only the named `TREEFORCE89_DEV_DATABASE_URL` key,
never the environment listing. It has not been run in this form. Its trigger
was changed so documentation/evidence pushes cannot rerun the rejected listing.
Specific approval to use that one binding inside the isolated Actions runner
is the outstanding prerequisite for the complete catalog audit. It will not
print, save or export the connection string and will retain the same read-only
transaction and identity checks. Do not use default database credentials as a
substitute.

A safe alternative check called the existing canonical native status endpoint:
`POST https://tree-token.xyz/play/treeforce89/api/status` with matching Origin.
The exact verified handler makes read-only schema checks for this path, without
wallet/session creation. It returned schemaReady=true, tableCount=4,
isolationVerified=true, paymentSchemaReady=true and paymentsEnabled=true.
The last flag describes the existing native Sui payment path; it does not enable
BNB payments or the shared restore implementation. See `runtime-status.json`.

This runtime response supports compatibility with the existing native schema
checks and proves the deployed handler can reach its pinned database. It does
not enumerate current constraints, policies, privileges or the seven proposed
tables. Their hosted state remains unknown; absence must not be inferred from
the disposable reference. The coordinated gateway stays source-only pending the
full audit and migration/activation review.

## Single-binding audit authorization

The owner approved using only `TREEFORCE89_DEV_DATABASE_URL` inside GitHub
Actions for the read-only audit, without printing or saving the credential.
This authorizes the narrowed runner and no environment listing, migration,
application-row read, deployment or gameplay activation.
