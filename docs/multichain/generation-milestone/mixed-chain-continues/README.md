# Launch requirement: Sui access with BNB USDT continues

On November 24, 2026 the user made this an initial-launch requirement: at least
25 existing Sui participants may want to use BNB stablecoins for continues.
**Do not require them to buy another BNB game pass or move/deposit their Sui NFT.**
The user selected **1 USDT per continue**, plus the player's BNB network fee.
This is exactly one token unit, not a floating USD conversion or oracle price.

Existing Sui entitlement remains the access authority. A separately proven BNB
wallet is only the payment source. Preserve the existing Sui TREE payment option,
game rules, scoring and tournament eligibility. The reviewed direct-continue
source restores three lives, permits one continue per eligible unfinished run,
and requires zero lives. Adding a payment chain must not change those rules.

## Current source implementation — not a live payment feature

`scripts/multichain/sui-bnb-continue.mjs` adds:

- A five-minute, server-stored link challenge bound to the authenticated Sui
  account/session, run, continue number, destination payer and delivery protocol.
  Both wallets sign the same canonical-origin, explicitly non-payment message.
  The existing Sui personal-message verifier and pinned viem EOA verifier are
  reused. The published wallet-link endpoint is untouched.
- A server dependency contract for fresh authenticated Sui run/entitlement reads.
  It checks account/run UUIDs, `tree-paid-delivery.v1`, ruleset `treeforce89.v1`,
  ownership eligibility, zero lives and unused continue. Browser claims are not
  accepted as authentication. The actual game adapter is still required.
- An exact BNB chain-56 USDT transfer proposal: token
  `0x55d398326f99059fF775485246999027B3197955`, 18 decimals, amount
  `1000000000000000000`, existing BNB fee wallet
  `0xC440F06BBC7e58b0d055815f915447e4ae0E3720`. This preserves the previously named
  BNB treasury; deployment review must show the exact destination. It does not
  change the separate Sui TREE recipient. No allowance transaction is needed for
  this proposed direct `transfer` flow; this code does not send any transaction.
- A trusted-client receipt reader that requires a reviewed token runtime hash,
  checks chain 56, reads the transaction/receipt/canonical block/token bytecode,
  requires a finalized block and rechecks the receipt block's canonical hash.
  No client-provided receipt JSON or block confirmation is accepted by the service.
- Verification of exact transaction sender, token, calldata, zero native value,
  successful receipt and one matching nonremoved USDT Transfer event to the fee
  wallet for exactly one USDT. The payment block must be within the quote window.
  The transfer proposal includes `notBefore`, rounded up to the next block-second,
  because block timestamps cannot express milliseconds.
- Receipt reconciliation after quote expiry when the payment itself mined in
  time. Access loss after payment does not discard funds: authenticated matching
  orders can record the payment for review, with no access/lives grant. RPC errors
  leave the order pending; recovery must check the same transaction, never prompt
  another payment merely because the response was lost.

Every public result still has `paymentEnabled:false` or
`continueAuthorized:false`. There is no HTTP route, database migration, payment
button, new contract or game writer. The record store is an interface; tests use
an explicitly labelled atomic in-memory double. This is a tested policy and
cryptography milestone, not durable production integration.

## Existing delivery work found and preserved

Read-only inspection found `feature/paid-continue-delivery` in this same GitHub
repository at `23e3f8bc216098121f966d7a11e99535cd350061`. Its relevant files are:

- `services/canopy-credits/direct-continue-service.mjs`
- `services/canopy-credits/direct-continue-repository.mjs`
- `services/canopy-credits/continue-product.mjs`
- `services/canopy-credits/paid-delivery.mjs`

The service separates order/payment verification from the page-bound delivery
lease. `withPaidDelivery` removes reconciliation's lives authorization; the
`tree-paid-delivery.v1` prepare/activate protocol owns restoration and recovery.
That is the intended integration target. Do not create an independent lives
writer or expose its old internal `deliver` action directly.

The paired `TheCryptoArborist/treeforce89` branch `feature/paid-continue-delivery`
contains its proxy and game-side protocol. Its configured hosted preview is
read-only and is not evidence of production payment readiness. No external
preview link is offered as a wallet handoff here. No files on either other branch
were merged, modified or deployed during this work.

Those existing order terms explicitly describe Sui TREE, a Move checkout event,
and Sui quote hashes. **Never reinterpret a BNB receipt as that Sui event.** Add a
typed `eip155:56` payment adapter and durable receipt binding to the shared
account/run purchase record, then use the same reviewed delivery protocol. The
current production `treeforce89-dev` function is also a protected package whose
exact archive was still missing in the prior package-recovery inventory. A
reviewed source/package mapping is required before any live handler replacement.

## Required durable semantics and next implementation

1. Resolve the existing canonical Sui account/session and server flight into the
   adapter's input. Recheck current NFT entitlement; a stored wallet link or login
   does not prove current ownership. Preserve existing Sui identity behavior.
2. Store challenge nonce hashes and immutable terms; atomically consume one nonce
   and open one checkout per payer and per account/run/continue. Check session
   revocation, run eligibility and DB-clock expiry again under locks. Add a
   challenge rate limit. Never persist session bearer tokens or signatures in logs.
3. Direct USDT transfers contain no order ID. Therefore the one-pending-checkout
   per payer rule and globally unique `(chain, txHash, logIndex)` AND transaction
   hash are mandatory. Serialize across workers and tie the receipt permanently
   to the signed account/run terms. Exact replay on that same order is idempotent;
   another order cannot claim it. Do not deploy a multi-order variant without a
   nonce-bearing checkout design and separate contract review.
4. Extend the existing durable order/payment ledger with typed BNB evidence,
   preserving Sui terms and receipt tables. Payment recording and order update
   must commit together. Add independent PostgreSQL workers to test nonce races,
   double claims, expiry, revocation, interrupted commit and retry recovery.
5. Bridge a verified purchase to the existing paid-delivery lease, checkpoint and
   activation IDs exactly once. Receipt verification alone must never resume the
   game. Test interrupted restoration and refresh/recovery without a second charge.
6. Specify recovery for a wallet/session that expires or is revoked after payment,
   changed/finished runs, late or wrong-amount transfers and permanently undeliverable
   purchases. Provide authenticated account-level discovery and an explicit refund
   or credit policy before enabling money movement. The current source denies
   mismatches; it does not implement refunds or silently promise them.
7. Build the canonical `/play/` UI showing Sui access plus linked MetaMask payer,
   exactly 1 USDT, the BNB gas fee, recipient and payment status. Preserve Sui
   payment choice. Never request seed phrases or bridge the NFT. Initially support
   tested EOA MetaMask/Ledger payers; contract-wallet/zkLogin compatibility needs
   explicit end-to-end coverage of the existing signature verification paths.
8. Review token runtime/decimals against chain state and production finality RPC
   behavior, complete preserved-package release preparation, then request a
   separately reviewed private paid acceptance. Test returning Sui holders before
   public launch. No new BNB pass purchase is a prerequisite for this path.

This requirement joins artwork display as a launch gate, rather than being
postponed to an optional future feature. Price selection authorizes source/design
work; it does not itself authorize sending funds or publishing a payment endpoint.

## Validation and guidance

40 tests pass with real Ed25519 Sui and EVM signatures, synthetic finalized-payment
fixtures and an in-memory store. They cover signature/account/run substitution,
one-time challenges, duplicate/cross-order claims, exact token/amount/recipient,
reverted/removed/stale/wrong-chain receipts, altered token code, finality/reorg
checks, delayed reconciliation and preservation of existing continue limits.
Existing wallet-link cryptography also passes unchanged.

```sh
node --test tests/multichain-sui-bnb-continue.test.mjs
node --experimental-strip-types tests/arcade-wallet-link.test.ts
```

Current MystenLabs/skills README, `sui-ts-sdk-backend/SKILL.md`,
`accessing-data/SKILL.md` and `accessing-data/grpc.md`, plus SDK cryptography
reference material were fetched before Sui integration decisions. No SDK migration
or Sui transaction was introduced. The existing pinned signature primitive is
retained; new entitlement reads must use the reviewed server adapter and current
supported data APIs, not browser ownership claims.
