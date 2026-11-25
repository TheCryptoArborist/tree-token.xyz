# First redemption return-message review — November 23, 2026

## Concrete proposed authorization

One BNB transaction from MetaMask + Ledger admin 8789 calls `send(2)` on the new
adapter `0x74c20dEB476Dca58459956b1AcD65771197900C9`. It sends the already locked
redemption request to Sui package
`0xc445519bf1d6ed8ab6002d20ad7ed81a9ad25e31990df9b72203d0ad86fd2e92`,
for original NFTree #2720 in vault
`0xf5dff8e2cc96824f89735fa16c068ee8194fbb7e8d697aeebe5d135f8a5916eb`.
The exact recipient is dev wallet
`0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
The adapter constructs the payload; the caller cannot substitute its recipient.

Proposed ceiling: **0.006 BNB total**, comprising at most **0.0059 BNB native
message fee + 0.0001 BNB gas**. Refresh immediately before signing and reject
above either component or total. No further USDT payment, allowance, purchase,
unpause, Sui acknowledgement, completion message, upgrade or gameplay activation
is included. The user has requested this review; this new native-fee send still
requires explicit approval. No live transaction was submitted by Codex.

## Checked quote and source execution

At the pinned block in `fork.json`, the actual adapter's state-valid quote is
**0.004577084124304116 BNB** native fee, zero LZ-token fee. Estimated gas is
377784 units; its 25% padded limit is 472230 at 50,000,000 wei/gas, giving
**0.0000236115 BNB** maximum quoted gas and **0.004600695624304116 BNB** maximum
combined spend at that quote. Local execution consumed 0.00001851085 BNB gas,
for a local total of 0.004595594974304116 BNB. These are simulation values, not
live expenditure. No balances or storage were overridden.

The same local fork checks current BNB Locked/paused state, zero allowance,
code hashes, both configured libraries/security, reciprocal binding, exact
recipient/request and admin nonce 4751. The adapter's outbound nonce is zero;
any existing outbound message requires reconciliation rather than another send.
The exact first GUID is
`0xb46132353e03697bb27ed5581c3ac1b2e0a2ba1e365a11a388bcf0390cba6b99`.

Checked execution proves exactly one kind-2/generation-1 MessageSent event and
one Endpoint PacketSent containing the full reviewed wire-v3 payload, route,
original object, request, recipient, destination 30378 and first sequence number.
It checks unchanged send library, options, and receiveGas 30,000,000. Executor
and all three required-verifier fee events reconcile exactly to the native quote;
addresses and amounts are in `fork.json.feeAllocation`. No optional verifiers are
used. Exact native fee is required: both underpayment and overpayment reject.
Wrong outbound kinds 1, 3 and 4 reject in this state. Sender balance decreases
by exactly the quote plus local gas. The pass remains Locked/nonplayable after
source send; a source transaction does not itself return the original.

Six focused fee tests reject altered executor, missing/extra verifier events,
changed fee and quote mismatch. The actual source send and wrong-kind/exact-fee
checks ran on a local fork using the deployed runtime. Remote transport permits
read-only methods; it has no wallet key and cannot submit to mainnet.

## Destination gate and remaining steps

`live-prerequisites.json` independently refreshes phase-1 Sui custody/security
and BNB Locked/paused state. The published Sui handler checks authenticated peer,
route, original NFT, generation and nonzero request/recipient. Successful kind-2
processing transfers the original to 45c4, records request/recipient and phase 2.
Existing lifecycle tests cover these guards and duplicate/stale behavior.

This review does not fabricate LayerZero verifier attestations or claim a live
Sui release. The configured 30,000,000 receive-gas option is preserved; this local
BNB send simulation alone is not proof of destination executor capacity or delivery.
After the user signs, independently verify source receipt/GUID and actual Sui
Released event, exact object ownership, phase 2 and matching request/recipient.
A delayed message must be diagnosed against that GUID before any retry or change.

After the original returns, the BNB pass remains Locked until separately quoted
Sui kind-3 acknowledgement burns it. BNB kind-4 completion then closes the Sui
generation before reuse. Neither later message nor its fee is approved here.
No 25-USDT refund is triggered by any redemption step.

## Reproduction and durable records

With pinned root/isolated BNB dependencies installed, Node 24:

```sh
node --use-env-proxy contracts/bnb-generation/scripts/review-return-send.mjs /tmp/return-review.json
node --test contracts/bnb-generation/test/return-fees.test.mjs
```

Only run this first-send rehearsal while outbound nonce is zero and the live
pass is Locked. `fork.json` contains the unsigned call, exact packet, fee allocation,
local receipt, before/after state and fee proposal. Local transaction hashes are
not live explorer receipts. The current Mysten README and accessing-data/GraphQL
references were refreshed; existing pinned GraphQL custody verification is reused.

No website, contract or security configuration was changed by this review.
The signing handoff, if approved, must remain under `tree-token.xyz/play/` and
preserve the current complete production inventory. Existing authentication,
payments, games, scoring and tournaments stay unchanged.
