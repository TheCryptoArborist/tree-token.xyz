# Standard TREE continue runtime — hosted validation, 2026-10-12

The recovery preview now uses the existing hosted server database credential.
No custom credential installer, password rotation, or application-login repair
is required for this path. Fixed transaction roles restrict the operations used
by the service. This remains a trusted platform-credential model; it does not
provide separate process isolation through distinct login credentials.

The player product remains 20,000 TREE for three lives in the same flight,
with the same wave and score. The approved recipient remains
`0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`.
The service retains signed quotes, independent receipt verification,
receipt deduplication, checkpoint validation and one-consumption delivery.
It does not add a Canopy Credits purchase.

## Completed deployment

Following Peter's approval, native migration
`20261012161413 / tree_continue_platform_role_access_v1` enabled the existing
postgres account to explicitly assume the five existing permission roles.
It created no login, changed no password or secret, and granted no browser
access. Do not apply this migration again. The source migration filename was
reconciled with the native hosted version.

Supabase function `tree-continue-standard` is ACTIVE at version 2. Its bundle
SHA256 is `2b95e6f9160be20e438c279a9ab535b303e5359d1ecdbd8bf0563da4f7ef6605`.
All 16 retrieved deployed source files matched the submitted source. The
initial startup issue was resolved by explicitly importing Node's Buffer
rather than relying on a Node-only global. Hosted database TLS and role
switching were accepted by actual authenticated requests.

Game preview commit: `bb48b5695101430cfa376f9f107aa8b5c174b25a`.
Netlify deploy: `6acd08ba6a38050bd48c214a`, READY, deploy-preview context.
URL: https://deploy-preview-3--treeforce89.netlify.app/
Only the existing recovery preview was redirected to the standard service;
no production branch was advanced.

## Executed validation

Backend implementation `05d2c45bb6f5fd334608d61b90dfe3038517f516` passed
https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/38276426507
(job `114902904687`; completed full log inspected): 85 quote/receipt/adapter
checks and 30 actual disposable PostgreSQL scenarios plus their parent test.
Ten concurrent orders with two-connection pools retained one order; independent
receipt settlement, three-life authorization, identical activation retry,
fresh-page review and paused-policy rejection passed. Chain responses,
checkpoint approval and deployment IDs in these database scenarios were fixtures.
31 game sign-in/pause/proxy unit checks also passed locally.

Actual hosted acceptance used source `42bf9905483436a3b98b66e97aed0485339e7412`:
https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/38277167393
(job `114905355040`; completed SUCCESS; completed full log inspected).
Ten direct-server checks and ten preview-proxy checks passed, including real
personal-message sign-in, private database access, account-scoped empty lookup,
missing-order handling, disabled new purchases, denied identity injection and
revoked-session rejection. Compiled browser recovery panels worked at 390,
320 and 1200 pixels with three successful real lookups and zero page errors.
Signers were unfunded ephemeral test keys. No installed wallet or Sui transaction
was used. No purchase, receipt or paid-continue grant was created.

A fresh native hosted read after acceptance confirmed orders/settlement off,
deployment null, total/reserved limits zero, orders/receipts/deliveries zero,
and zero custom application logins enabled. Private-schema RLS advisory
information did not require exposing these tables to browser roles.

## Remaining payment launch work

The hosted connection is complete. Actual Sui checkout deployment and
quote-authority configuration, trusted flight eligibility, interrupted-delivery
resolution and wallet-approved real 20,000 TREE acceptance remain before paid
launch. Those are not established by the hosted empty-lookup or database-fixture
checks. Checkout remains disabled; the older custom setup/recovery utilities
are not needed for the standard hosted path.

## Guidance checked live

MystenLabs/skills README; `frontend-apps/SKILL.md`, `non-react.md`,
`limitations.md`, `transactions.md`; `ptbs/SKILL.md`, `building.md`,
`commands.md`; `accessing-data/SKILL.md`. Official Supabase default-secret and
database-connection documentation and PostgreSQL's role-GRANT documentation
were consulted. Database credentials remain server-side, and user transaction
approval remains in the wallet.
