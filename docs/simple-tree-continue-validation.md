# Standard TREE continue runtime — 2026-10-12

The server implementation removes the custom credential installer and five
application-login dependency. It uses the existing hosted `SUPABASE_DB_URL`,
with fixed `SET LOCAL ROLE` permissions for each database transaction. This is
a trusted platform-credential model, not isolation through distinct login
credentials; the separate-login implementation remains the default for other
callers. No browser receives database credentials or chooses a database role.

The player flow and fixed product stay unchanged: lose all lives, sign in with
Sui, approve 20,000 TREE, verify the purchase, and restore three lives in the
same flight with the same wave and score. The approved recipient remains
`0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`.
The runtime retains signed quotes, independent finalized receipt checks,
receipt deduplication, checkpoint eligibility checks, and one-consumption
delivery. It does not add a Canopy Credits package.

## Executed validation

Implementation tested: `ec6dfda3be572e6068186363631835c18bf149de`.
Run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/38275337440
Job: `114899290851`, completed SUCCESS; completed full log inspected.

- 85 quote, receipt, transport and platform-adapter checks passed.
- 30 database scenarios passed, plus their parent test, using actual disposable
  PostgreSQL 17.11. The new scenarios exercised the complete standard runtime,
  ten concurrent requests with two-connection pools, one signed order, independent
  receipt settlement, three-life authorization, identical activation retry,
  fresh-page review requirements and paused-policy rejection.
- 31 existing game sign-in/pause and hosted-gate unit checks passed locally.

Chain responses, checkpoint approval, account identity, deployment IDs and quote
keys were test fixtures. This was not an installed-wallet payment or new Phaser
browser acceptance test. No Sui transaction was signed or submitted.

## Hosted boundary

The proposed migration permits the existing `postgres` account to explicitly
assume `tree_continue_orders`, `tree_continue_settlement`,
`tree_continue_storage`, `tree_continue_delivery` and `tree_continue_recovery`.
It uses `WITH SET TRUE`, preserves existing membership options, grants nothing
to browser roles, and refuses application while checkout policy is active.
It creates no login and resets no password or secret.

Automatic approval review rejected applying that hosted permission change
because the exact production privilege change and its security boundary were
not explicitly authorized. It was not retried through another mechanism.
The migration is prepared for explicit review in PR #56.

A fresh native hosted read after rejection confirmed new orders and settlement
disabled, checkout deployment null, total/reserved limits zero, and zero of the
five proposed server role switches enabled. The new Edge Function was not
deployed, the game preview was not redirected, and production was unchanged.
The existing custom application logins were not enabled or changed.

After approval, the next action is the exact reviewed server-role permission
change and authenticated hosted connection testing with checkout disabled.
Actual checkout deployment and quote-authority configuration, trusted flight
eligibility, interrupted-delivery handling and installed-wallet acceptance
remain necessary before paid launch. Hosted TLS/runtime acceptance is untested.

## Guidance checked live

MystenLabs/skills current README; `frontend-apps/SKILL.md`, `non-react.md`,
`limitations.md`, `transactions.md`; `ptbs/SKILL.md`, `building.md`,
`commands.md`; `accessing-data/SKILL.md`. Official Supabase default-secret and
database-connection docs confirm hosted server database access; PostgreSQL's
GRANT documentation defines explicit role switching. Private keys and database
credentials remain server-side; wallet signing remains in the wallet.
