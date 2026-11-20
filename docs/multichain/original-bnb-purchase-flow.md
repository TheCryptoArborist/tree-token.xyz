# Original-backed 25-USDT purchase stage

New isolated page: `/play/multichaintest/original/bnb/buy/`.

The owner enabled purchases with actual BNB receipt
`0xbed02845217412a516a77167a9cf1d2edec25965c6d9568d2c096b8ca1c26830`.
The pass remains Ready, unminted and backed by original Sui NFTree #2720.
The successful unsigned mainnet preflight is recorded in
`original-trial/purchase-preflight.json`. Public intended-account reads do not
establish an installed extension connection or user signature.

## Fixed payment and separate approvals

BNB mainnet chain 56. The only initial buyer is
`0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae`.
USDT is `0x55d398326f99059ff775485246999027b3197955` (18 decimals).
The sole spender/pass is `0x1d3da001E586a7DEFD397B77FADB29eD6F039c13`.
Price is exactly 25e18 USDT, paid atomically with mint to treasury
`0xc440f06bbc7e58b0d055815f915447e4ae0e3720`.
Native transaction value is always zero; BNB pays network gas separately.

A different existing allowance requires a separate reset-to-zero. Zero allowance
selects approve(exactly 25 USDT); exact allowance selects buy(); Active state with
verified buyer ownership, canPlay=true and zero allowance selects complete.
No unlimited approval or combined signing. Every call is re-encoded against the
fixed ABI/amount/spender at module load; a mismatching plan fails closed.

This stage is backed by an original NFT, unlike the frozen disposable purchase
page. No existing helper, source receipt, fixture, browser bundle or contract is
changed. The same Sui package/CallCap peer, original vault and BNB adapter remain
in use. No further LayerZero message, NFT transfer or deployment is requested.

## Verification and recovery

Before each wallet handoff, verify original custody/contents, source authority,
actual announcement and prior source receipts using unchanged reserve validators.
The actual enablement receipt is verified for exact call/sender/event separately;
its old Ready-only poststate helper is replaced ONLY at the injection boundary by
this new stage's own full Ready/Active current-state validation. No old validator
is weakened or invoked as if the pass were still Unconfirmed.

At one pinned BNB block, verify exact original pass/adapter runtime and
immutables, protocol/USDT code, all route/library/default/effective security reads,
fixed treasury/price/currency/controller/initial buyer/backing/route/peer,
redemption settings, pause flag, allowance, balance and access. Active state
requires the actual ownerOf(1), buyer balance one, canPlay=true and allowance zero.
The contract's byte-exact buy implementation itself requires the treasury's
USDT balance to increase by exactly PRICE in the purchase transaction.

Simulate each exact call and estimate positive bounded gas (700,000 maximum),
positive fee, buffered 0.01-BNB per-step ceiling, sufficient BNB/USDT and equal
latest/pending nonces. Require fresh two-minute quote, renewed consent if action,
nonce or fee changes, selected account/chain and unchanged account epoch.
The wallet controls its final fee; the estimate ceiling does not constrain later
wallet fee edits. No assistant signature or mainnet transaction is submitted.

Web Locks and durable pending action/nonce/target/hash block duplicate handoffs.
Explicit rejection clears pending; ambiguous errors, missing hashes and failed
post-submission storage retain recovery. Recovery is available even without local
state or after device changes. Match exact successful receipt identity, calldata,
zero native value, USDT approval/payment/mint logs and current full pass state.
The buy receipt requires the exact 25-USDT treasury transfer, allowance reduction
to zero, mint of token #1 to the designated buyer and PassPurchased event.
A different nonce/action/hash, changed wallet epoch or concurrent storage update
cannot clear a pending request. Re-read progress after every verified receipt.

Pass contract access verification is NOT live Arcade integration. The page makes
that distinction visible. Existing Sui access, games, missions and tests stay as
published. Wider supply rollout, transfer/redemption tests and live game gates
remain separate stages. Keep wallet signing with Peter.

## Checks and additive release

Tests cover exact calldata/amount/spender, Ready/Active transitions, real captured
unsigned mainnet reads and drift rejection, insufficient funds, altered events,
wrong ownership, stale quotes/nonces/consent, locks, ambiguous submissions,
manual recovery, account changes and storage failures. The existing full
multichain suite remains required. Browser CI checks 1440, 390 and 320 widths,
no module errors/overflow, visible connection and manual recovery, missing-wallet
feedback and blocked disconnected signing even with consent selected. These are
not installed-wallet reputation or prompt tests.

New `release-original-purchase.mjs` captures the selected actual locked baseline,
adds exactly three new files under original/bnb/buy/, and preserves all 628 prior
static paths, all 50 complete backend records, five schedules, runtimes, protected
configuration/environment fingerprints and snippets. Expected total is 631 paths.
The runner refuses baseline drift, altered candidate identity or queued builds;
it locks only the new verified candidate. It never restores an older deployment.

Current MystenLabs/skills README.md, accessing-data/SKILL.md and
accessing-data/graphql.md were checked live. The pinned Sui GraphQL integration
and existing EVM wallet read/fallback integration are reused without dependency
upgrades, Sui JSON-RPC or new Sui transaction construction.
