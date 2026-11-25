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
records ten passing checks. Reproduce with Node 24, installed pg in
`vendor/bnb-continue-store`, and PostgreSQL tools:

```sh
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-database-audit-local.mjs
```

For unpacked tools also set BNB_PG_SHARE. `--write-reference` is only for deliberate
reference generation from the pinned SQL, never for accepting hosted drift.

The hosted workflow triggers only on this feature branch with the explicit
`[audit native database]` commit marker. It validates locally before obtaining
the runtime binding. It verifies the published native package digest and locked
ready deploy before and after the audit, refusing concurrent deployment changes.
The current site binding is evidence, not proof that an unobservable deploy-time
override is identical. A successful catalog read does not grant production
activation or prove current frontend compatibility. Recheck at release time.

Hosted results will be recorded after the read-only workflow completes.
