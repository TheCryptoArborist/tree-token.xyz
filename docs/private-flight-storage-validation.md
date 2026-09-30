# Private purchase and flight storage — installed and verified

## Scope and authorization

On September 30, 2026, Peter approved proceeding with the previously described private purchase-and-flight-recovery database installation in the existing Supabase project. This authorization covered the reviewed additive migrations and integration work, not publishing a contract, transferring tokens or enabling public payments.

The approved database installation is complete. The game is NOT yet connected to this hosted storage. Actual Phaser scene capture/validation/rehydration and the deployed session-to-storage service remain unfinished. This report supersedes earlier statements that no direct-continue schema has been installed; it does not supersede the remaining mainnet activation gates.

Product remains fixed at 20,000 TREE (20,000,000,000 base units, six decimals), on Sui mainnet, to the previously approved recipient. Direct continues do not issue or consume Canopy Credits and do not use a market-price feed.

## Applied migrations

Existing project: `lehswszuekjqottolmsf`, TheCryptoArborist's Project. Hosted PostgreSQL reports version 17.6. No new paid project or branch was created.

The Supabase migration API returned success for both migrations; the migration-history API subsequently confirmed:

- `20260930222217` — `tree_continue_private_purchase_storage_v1`.
- `20260930223727` — `tree_continue_private_flight_storage_v1`.

The first migration installs the existing `services/canopy-credits/direct-continue-schema.sql` schema, with explicit revocations also covering Supabase's `anon`, `authenticated` and `service_role` roles. The migration API manages the transaction, so the source's outer BEGIN/COMMIT were omitted. No existing application tables were altered by this baseline installation.

The second migration uses `services/canopy-credits/migrations/flight-storage-v1.sql` from tested commit `d24f13deca9da002d7b8e0d34e93ab44e68d51fd` (blob `13b944d8de71af89722651f56a2eefc667e87f18`). It adds flight/account/checkpoint relationships and restricts new order creation to a matching, reviewed saved flight.

The installed private schema `tree_continue_v1` contains seven tables:

1. `accounts` — fixed account/payer/issuer/environment binding.
2. `flights` — globally unique run IDs bound to accounts and the game ruleset.
3. `checkpoints` — one bounded immutable game-over snapshot per flight, with a SHA-256 check enforced by PostgreSQL.
4. `checkpoint_reviews` — separate validation outcomes. No runtime validation writer is granted or configured.
5. `orders` — fixed-price direct purchases bound to the account, flight and saved-state hash.
6. `receipts` — unique receipt claims matched to an order.
7. `journal` — append-only purchase-state transitions.

All seven tables have RLS enabled. No browser policies or public table access were introduced. Read-back confirmed that `anon`, `authenticated`, and `service_role` cannot use this schema or read orders/write receipts.

A dedicated `tree_continue_storage` role has NOLOGIN, no superuser, no role-creation and no RLS-bypass privileges. Its only application-function grants are `register_flight`, `store_checkpoint`, and `read_recovery`; it cannot directly read the tables, issue/verify payments or attest checkpoints. No login password or host credential was created. PostgreSQL automatically gave the creating `postgres` role administrative membership with INHERIT=false and SET=false; no runtime role membership was granted.

This is a storage permission group, not a deployed database connection. A restricted host login and secrets provisioning still need to be configured separately. Do not use the database-owner connection for the eventual public application.

## Server implementation

New code at the tested commit:

- `flight-storage.mjs`: parameterized PostgreSQL storage adapter; bounded canonical snapshot encoding; exact hash round-trip validation; explicit issuer/environment/account checks; and a resolver that refuses unreviewed checkpoints.
- `flight-storage-http.mjs`: deployment-neutral same-origin JSON POST handler requiring injected server-session verification and rate limiting. It rejects client-supplied account/verification flags, caps payload size and redacts unexpected database errors. No route has been deployed.
- `migrations/flight-storage-v1.sql`: immutable account/flight/checkpoint records, explicit private permissions and saved-flight requirements on orders.

Recovery responses expose stored information but deliberately return `restoreAuthorized:false` and `paymentsEnabled:false`. A hash detects changes to saved data; it does not prove that client-reported gameplay occurred. The game validator and replay/lease policy are not implemented by these routines.

## Automated execution — actual PostgreSQL adapter integration

Tested commit: `d24f13deca9da002d7b8e0d34e93ab44e68d51fd`.
Workflow: Private flight storage and PostgreSQL service integration.
Run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/36786344107
Job: `110128535832` (`flight-storage`), completed SUCCESS. Full logs were read after completion.

All 33 distinct leaf test cases passed: 15 serialization/HTTP/security cases and 18 real PostgreSQL integration subtests. Node reports 34 passing tests because it also counts their enclosing integration test. No tests failed or were skipped. The 15 standalone cases also passed locally.

Unlike the prior in-memory service tests, this suite invokes the actual `postgresDirectRepository` and `createDirectContinueService` against a real disposable PostgreSQL pool. It verifies concurrent idempotent registration/checkpoint/order requests, account binding, immutable saved state, SQL hash checking, scoped routine permissions, retained cancelled orders, one-time receipt claims and delivery journal transitions, and recovery information after recreating adapters/connections.

The CI database was disposable PostgreSQL 17.11, Node 22.23.2, and test-only pg 8.16.3. The driver was installed outside app dependencies; this does not provision a production PostgreSQL client/credential. The workflow has contents-read permissions and no production database secrets.

The CI quote authorization, checkpoint attestation and chain evidence were explicitly synthetic fixtures. They were not real signatures, real payments or proof of a functioning Phaser replay validator. No mainnet transfer was executed.

## Hosted installation checks

After installing the tested migration, read-back confirmed the seven tables, their RLS flags, the exact scoped grants and the lack of public access.

An initial attempt to execute the hosted smoke test under `SET LOCAL ROLE tree_continue_storage` was denied, because the connector's `postgres` role has no SET membership. That attempt stopped before writing test records; no membership was added to work around it. Scoped-role execution was already exercised successfully in the disposable CI database.

A subsequent hosted smoke test invoked the installed routines through the administrative connector, inside a transaction explicitly rolled back. It confirmed:

- Exact saved snapshot and checksum round trip.
- Duplicate save returns the same checkpoint ID.
- A mismatched payer is rejected.
- A changed snapshot cannot overwrite the saved checkpoint.
- Unreviewed recovery information grants neither gameplay restoration nor payment permission.
- Installed storage-role grants do not allow direct order reads or receipt inserts.

The smoke test returned `passed`. A separate read after rollback confirmed ZERO rows in all seven tables, including accounts/checkpoints/reviews, orders/receipts/journal. No fake purchase or permanent test identity was left in the user database.

The public/private relation metadata fingerprint before and after the flight migration and smoke test remained `60a10efd146bb0d698a128c7500aae7f`. This checks relation identity/names/RLS/ACL metadata for those unrelated schemas; it is NOT a whole-database backup, data-content comparison or external audit. No commands in this work targeted their application data.

The Supabase security advisor returned informational `rls_enabled_no_policy` notices, including the seven new tables. This is deliberate default-deny behavior for private tables accessed through tightly scoped server routines; no public policies were added merely to silence the notice. Explanation: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Not changed / not complete

No Sui package was published, no quote key was generated or installed, no live payments were enabled, no token moved, and no browser/database credentials were exposed. The generic `canopy_credits_v1` schema remains absent in the hosted project. The previously confirmed 700 simulated CC were not queried, migrated or modified.

The production and stable preview application branches were not changed. Game PR #2 remains the same direct-continue code candidate. There is no newly confirmed hosted integrated game preview from this work.

Still required for the next integration milestone: actual game-scene snapshot capture and validation, safe rehydration after reload, authenticated host session mapping, restricted database connection deployment, stored-order reconciliation when the browser loses the transaction digest, and a test of those pieces together in a separate hosted candidate. A saved snapshot alone must not be presented as a paid-continuation grant or a crash-safe gameplay guarantee.

Mainnet activation then additionally requires the published/configured checkout, safely provisioned quote authority, approved admin/payer/caps/gas settings, security/operations review, and a restricted real purchase plus gameplay-resume test. Price and recipient are already resolved; database installation approval is already satisfied and must not be requested again.

## Current guidance used

Live-checked MystenLabs/skills README, `frontend-apps/SKILL.md`, and `frontend-apps/limitations.md`; the relevant guidance keeps database credentials, trusted account verification and signing authority on the server rather than in the browser. Supabase's official API security guidance informed schema grants, RLS and restricted function execution. This migration does not alter wallet transaction construction.
