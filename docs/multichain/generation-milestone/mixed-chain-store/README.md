# Durable mixed-chain checkout and receipt ledger — source only

This implements the store contract for the [Sui-access / BNB-USDT continue
policy](../mixed-chain-continues/README.md). Existing Sui holders do not need a
BNB pass. Price remains one USDT plus network gas. No live schema, payment route,
wallet UI, existing Sui payment flow or game delivery handler changed.

## What is implemented

`createPostgresContinueStore` in `scripts/multichain/sui-bnb-continue-store.mjs`
uses a server-injected PostgreSQL pool and a mandatory authoritative
`lockSuiRun` adapter. The proposed `schema.sql` adds three private RLS tables:

- Immutable signed checkout terms, session/account/run binding, an exact payment-policy snapshot and state.
- One immutable receipt per checkout, with globally unique transaction hash and
  chain/transaction/log identity.
- One pending delivery-review record per receipt, inserted in the same transaction.

The schema is outside the migration directory and has only been applied to
disposable localhost PostgreSQL. Do not deploy it via a generic migration command.
The runtime adapter imports no PostgreSQL driver or credentials; the local checker
uses the separately pinned `pg@8.16.3` package under `vendor/bnb-continue-store`.
Existing root dependencies and published backend packages are untouched.

## Atomicity and identity

The authoritative adapter must use the exact transaction connection supplied to
it to lock the current Sui session and flight, in that order, retaining both locks
until commit. It returns the authenticated account UUID, run UUID, session hash,
Sui wallet, expiry, revocation and authoritative game state. There is no fallback
adapter and no browser-provided identity accepted. The production mapping to the
existing Sui account tables still needs implementation and review.

The store then locks the checkout, reads database time after locking, and checks
session/flight/quote validity again. Opening also checks that the signed terms
have not changed, zero lives, no previous continue, an unfinished run and the
existing ruleset. Fresh NFT ownership remains the coordinator's trusted reader
responsibility; the database cannot make an on-chain ownership read atomic with
its commit. It must be checked again before actual restoration.

Partial unique indexes enforce one unresolved checkout per BNB payer across
accounts and one per Sui account/run/continue across different BNB wallets. Five
new challenges per minute per session are admitted under the session lock. There
is no automatic reopening of an unresolved or paid checkout merely because its
quote expired: that could invite a second payment before the first is reconciled.

Token, raw amount, recipient and policy version are snapshotted at creation.
A future policy change fails closed for old rows instead of reinterpreting a paid
receipt at a new price. Runtime credentials cannot edit the snapshot.

Recording a receipt, updating the checkout to `paid-review`, and inserting its
pending delivery record commit or roll back together. A lost response can be
retried: the same exact receipt is idempotent, while changes to block identity,
payment identity or checkout are denied. A different checkout cannot claim a
transaction, even with a different log index. A payment mined during its quote
window can be reconciled after quote expiry while the session remains valid.
Revoked/expired sessions need the later account-recovery flow; no bypass is added.

## Delivery boundary

`deliveryCandidate({id,sessionHash})` revalidates the session and returns a typed
`tree-paid-delivery.v1` pending record containing:

- Sui access wallet, account and run.
- Separate `eip155:56` payment wallet, token, raw amount and existing BNB treasury.
- Stable receipt identity, transaction hash and finalized block evidence.
- `requiresPayment:false`, `authorization:null`, `restoreAuthorized:false`.

This is a durable input for review, **not** a call to the existing delivery
service and not an instruction to grant lives. It never changes the Sui order
terms or pretends that a BNB Transfer is a Sui Move event.

The other branch `feature/paid-continue-delivery` was refreshed read-only and
remains at `23e3f8bc216098121f966d7a11e99535cd350061`. Its
`services/canopy-credits/paid-delivery.mjs` is still the intended consumer protocol:
prepare a page-bound lease and checkpoint, then activate idempotently. That branch
was not merged or edited. A reviewed typed bridge must atomically associate this
BNB receipt with its existing paid order before preparation/activation. The
bridge, authoritative Sui lock adapter and real game acceptance remain the next
implementation milestone.

## Privileges and operations

All three tables have RLS and no public policies. Public/anon/authenticated have
no access. Runtime service access is select/insert plus **status-column-only**
update on checkouts; it cannot modify signed terms, edit receipts or delete any
records. Broad default grants are explicitly revoked first and tested locally.
No public RPC, SECURITY DEFINER function, view or new exposed schema is added.

These are financial audit records, not short-lived review tickets. The existing
seven-day ticket cleanup targets different tables and cannot delete them. No
financial-record deletion, scheduler, cancel/refund issuer or retention policy
was added. Releasing unresolved payer/run locks, long-term retention, handling
late/wrong-amount payments, expired-session discovery, and refund/credit decisions
must be reviewed before a live payment route is enabled. A permanent delivery
failure must not be addressed by asking the player to pay again.

Supabase changelog and current RLS guidance were checked; the recent branch-merge
permission change does not affect local validation. Schema review uses actual
local roles and catalogs. No hosted migration or advisor operation was performed.

## Reproduce and evidence

Node 24 and PostgreSQL 17:

```sh
npm ci --prefix vendor/bnb-continue-store --ignore-scripts --no-audit --no-fund
BNB_PG_BIN="$(pg_config --bindir)" node scripts/multichain/check-sui-bnb-continue-postgres.mjs
node --test tests/multichain-sui-bnb-continue.test.mjs
```

If binaries are unpacked, also set `BNB_PG_SHARE` to their share directory. The
checker creates and destroys a localhost-only cluster, clears inherited PG
options for child processes, and supplies explicit local pool settings. It does
not accept a hosted URL. Test session/flight tables are explicitly synthetic and
are not a proposed replacement for production Sui authentication.

**20 real PostgreSQL checks passed**, including 12 concurrent challenge consumers,
12 idempotent receipt writers, five admitted challenges out of 12 requests,
revocation while a request waits, expiry, cross-account/payer/run conflicts,
privilege checks, immutable evidence and injected transaction failure/recovery.
The full coordinator path uses real Sui/EVM signatures, the actual store and a
clearly synthetic chain receipt. **40 existing mixed-chain policy tests passed.**
`postgres-validation.json` records the database results. CI includes the same
checker plus existing contract/endpoint regressions.

Hosted [CI 45514471453](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45514471453) passed on `e61f500`, including all 20 new PostgreSQL checks, the existing policy suite, Move/EVM regressions and endpoint/package checks. No hosted database or production release accompanied validation.
