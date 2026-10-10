# Hosted TREE commerce: installation and policy verification

## Current result

The scoped-commerce migration is already installed in Supabase project `lehswszuekjqottolmsf`. The prior installation returned success and migration history recorded `20261007015339` / `tree_continue_scoped_commerce_v1`. Do not run that creation migration again merely because an older PR description says it is absent.

In the follow-up to Peter's request at 2026-10-07 01:58:57 UTC, the previously incomplete policy, membership and exact-count reads completed successfully through the native Supabase tools. This document records that follow-up; it is not a payment activation or a gateway deployment.

## Fresh policy results

A direct SELECT of the installed policy returned:

- `new_orders_enabled = false`
- `settlement_enabled = false`
- `deployment IS NULL = true`
- `total_limit_raw = 0`
- `reserved_raw = 0`
- `auth_origin = https://deploy-preview-48--tree-token.netlify.app`
- `environment = release-candidate`
- `admin_wallet = 0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`
- `pilot_wallet = 0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6`

The product is unchanged: 20,000 TREE per continue, three lives, the same flight, one continue per flight and free new games; no credit package. The sales recipient remains `0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f` in the reviewed product configuration. The policy SELECT did not independently read a recipient column because that field is not in this policy table.

## Fresh role checks

The order, settlement, delivery, storage and recovery permission roles all exist. Each has NOLOGIN, no superuser, no database-creation or role-creation privilege, and no RLS bypass. Each currently has only `postgres` as its recorded member. No dedicated application login was found among those membership results.

Effective EXECUTE privileges were separately read:

| Role | Read commerce policy | Save order | Settle receipt | Deliver continue |
|---|---|---|---|---|
| tree_continue_orders | Yes | Yes | No | No |
| tree_continue_settlement | Yes | No | Yes | No |
| tree_continue_delivery | No | No | No | Yes |
| tree_continue_storage | No | No | No | No |
| tree_continue_recovery | No | No | No | No |
| anon | No | No | No | No |
| authenticated | No | No | No | No |
| service_role | No | No | No | No |

This is verification of the listed function privileges, not a blanket audit of every possible database grant.

## Fresh exact counts

A separate COUNT query returned:

- orders: 0
- receipts: 0
- paid_deliveries: 0
- checkpoint_reviews: 0

These are exact results from that read, not estimates from table metadata. No test purchase or receipt was inserted for this check.

## Actual remaining setup dependency

The native Supabase tools available in this session can query/apply database changes and deploy Edge Functions, but expose no action for setting production Edge Function secrets. Netlify discovery likewise did not expose a site environment-variable write action. Plugin discovery was checked; no additional Supabase secret-setting action was found. This is a missing automation capability, not a failed database migration or a finding about the user's account permissions.

Do not place live database passwords in repository files, SQL files committed to Git, function source, browser code, PR descriptions, or chat. Do not substitute the database-owner connection or grant the generic platform role the new financial permissions to get around this setup requirement.

The supported Supabase setup path is Edge Functions > Secrets in the dashboard, or an authenticated local `supabase secrets set` operation. A trusted operator must provision distinct least-privilege application login credentials and install them in the selected server secret store. Credential values should not be sent to ChatGPT. The exact secret names must match the eventual runtime entrypoint; this update does not claim that an entrypoint or its environment contract has been deployed.

Reference: https://supabase.com/docs/guides/functions/secrets

## Scope and remaining launch gates

No hosted mutation, runtime login/password creation, secret provisioning, Edge Function update, Netlify deployment, wallet transaction, Move publication, policy activation, or game-preview update occurred in this follow-up. No new application or mainnet-purchase test suite was run. Historical CI results remain in `docs/scoped-commerce-validation.md` and are not presented as fresh results here.

Next: establish the secure credential-configuration path, provision the restricted logins, and connect the authenticated hosted order/receipt/delivery runtime without enabling payments. The actual reviewed checkout package and instance, quote authority, saved-flight eligibility authorization, interrupted-delivery resolution, cumulative pilot cap, gas and upgrade policy, and restricted installed-wallet purchase acceptance remain separate release gates.

Wallet selections and private database installation approval are resolved and must not be requested again. A saved public address is not proof of wallet control. Mainnet-first development remains in force; no testnet setup is requested.

## Guidance checked live

Current MystenLabs/skills README; `frontend-apps/SKILL.md` and `frontend-apps/limitations.md`; `accessing-data/SKILL.md`; official Supabase Edge Function environment-variable documentation. All wallet keys remain outside the application; no transaction was constructed in this follow-up.
