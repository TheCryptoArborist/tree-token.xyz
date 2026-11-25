# Native Sui session adapter — source milestone

A full remote fetch recovered native TREE FORCE authentication source omitted
from the earlier branch inspection. This supersedes the assertion that only the
preview key/value identity implementation was available. Exact source snapshots
and hashes are pinned in `provenance.json` at commit `9974d7f`.

The native gateway uses PostgreSQL `public.tree_game_sessions`, a SHA-256 bearer
hash, `grove-…` run IDs, wallet ownership checks, and expiry-based logout. Its
canonical development database is explicitly selected separately from the site's
default database. Being mounted on the production domain does not erase that
isolation policy. The adapter does not select or rebind any hosted database.

## Implemented

`scripts/multichain/native-sui-session.mjs` maps native wallet/run identities to
persisted server-created UUIDs, scoped to a verified database identity. Browser
UUIDs cannot create bindings. New runs retain the wallet's account ID and get a
separate run ID. These are integration identifiers, not pre-existing TREE account
IDs and not a replacement authentication authority.

`lockSessionAndFlight` locks the actual native session row on the shared delivery
transaction's connection. Logout and restart update that same row. Expiry is
checked with the database clock after lock acquisition and after ownership reads.
A current ownership observation is required; cached observations are not relabelled
fresh. Runtime provenance verification is mandatory and has no default adapter.
The checkpoint adapter defaults to null, so authenticated native sessions still
cannot prepare or activate a continue without separately reviewed game evidence.

The proposed mapping schema grants no changes to native tables. It is outside
hosted migrations. No HTTP route, wallet flow, credentials, live reads, migration,
function package or production setting was changed.

## Evidence and limits

Fourteen disposable PostgreSQL checks pass using the exact recovered native SQL
and unmodified credential revoker. They cover 12 concurrent binding retries,
wallet/run separation, invalid credentials, expiry, stale/lost ownership, default
checkpoint denial, runtime mismatch, logout after preparation, actual logout
waiting on the shared row lock, and native continuation changes invalidating a
prepared shared activation. Runtime provenance, ownership, positive checkpoint
review and payment evidence are explicit test fixtures. Existing native services
were neither edited nor replaced.

An older archived `treeforce89-dev.zip` was also recovered from Git history, but
its SHA-256 differs from the previously captured published package. See
`archive-comparison.json`. Neither that archive nor this branch's source is
claimed to match the current live runtime. A fresh provider inventory and exact
runtime/source verification remain necessary before integration release.

## Important integration corrections

- The actual native paid-continue service uses `tree_continue_redemptions`, not
  the preview branch's `tree_continue_v1.orders`. The earlier Sui receipt adapter
  is tested against that preview schema; it is **not** a native production receipt
  adapter. Native receipts are inserted during restoration, so importing them as
  unused purchases would be incorrect. Split payment evidence from consumption
  in a reviewed coordinated change before connecting native Sui payments.
- Native snapshots are client-reported non-reward game state. They do not equal
  the shared protocol's independently reviewed checkpoints. No conversion marks
  them validated in this adapter.
- Native paid continues increment a continuation counter and allow repeated
  continues. The proposed shared v2 claim currently allows one per run. Preserve
  existing Sui behavior: introduce an explicit continuation sequence and common
  consumption boundary for both paths before a production cutover. This adapter
  refuses shared restoration once the native counter is nonzero; this is a
  fail-closed source limitation, not a change to the running Sui game.
- Both payment paths must use the common consumption boundary. Session locks alone
  do not prevent a legacy Sui restoration after a new shared consumption commits.
  Recovery after a new signed login must retain the native run identity and avoid
  admitting two credentials or importing a previously consumed payment.

Next work: resolve current native package provenance, implement sequence-aware
payment/consumption and native checkpoint recovery together, then integrate the
canonical wallet UI. No user wallet transaction is needed for these source steps.

## Reproduce

From the repository root with Node 24 and PostgreSQL 17 as a non-root user:

```sh
npm ci --prefix vendor/bnb-continue-store --ignore-scripts --no-audit --no-fund
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-native-sui-session-postgres.mjs
```

For unpacked PostgreSQL set `BNB_PG_SHARE` too. The checker starts and removes a
local database and does not accept hosted credentials. `postgres-validation.json`
records the results. GitHub CI includes this check with existing regressions.

Current Mysten README, `sui-ts-sdk-backend`, `accessing-data` and the gRPC reference
were read before this inspection. No SDK, wallet, signature or chain-read API was
changed; existing pinned dependencies are preserved.
