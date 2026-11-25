# Private acquisition and redemption-lock review — November 23, 2026

## Concrete proposed next authorization

The user requested the next review after confirmed forward delivery. No real
USDT purchase, allowance, unpause or redemption lock has been signed. This review
proposes five transactions from MetaMask + Ledger account
`0xF2Ab1eEBbEcb4E315FE95D8b532D1aB00F1A8789`, BNB chain 56:

1. Approve exactly 25 USDT to new pass
   `0x418cC337FC19D8cf3b41a9C6E3138a60E34Eb9b5`.
2. Unpause its private purchase. Only the pinned initial buyer may buy.
3. Buy generation 1. Exactly 25 USDT goes directly to unchanged treasury
   `0xC440F06BBC7e58b0d055815f915447e4ae0E3720`; token 1 is minted to admin 8789.
4. Pause further purchases.
5. Request redemption to Sui dev
   `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
   This locks the pass and makes it nonplayable before the return message.

Proposed combined cap for these five actions: **25 USDT + 0.0001 BNB gas**.
No unlimited allowance. Observed existing allowance is zero; if it changes, stop
and refresh the review, rather than adding an unreviewed reset transaction.
Exact calldata, recipient contracts, gas estimates/limits and local execution
receipts are recorded in `fork.json`. These are evidence, not a signing packet.
A future canonical handoff must enforce fresh nonces, quotes, intermediate states,
remaining total cap, signature account/chain and receipt persistence.

This is a real purchase, not a refundable deposit. Redemption returns the NFT but
does not return the 25 USDT. Any treasury reimbursement would be a separate transfer.
No fees or transactions were submitted to mainnet by this review.

## Rehearsal and live prerequisites

A pinned mainnet fork ran against the already deployed contracts, without token,
native-balance or contract-storage overrides. The approved buyer had
73.874865379536648165 USDT, 0.033795386251497008 BNB and zero allowance.
USDT address `0x55d398326f99059fF775485246999027B3197955`, 18 decimals and pinned
runtime hash were checked. Fresh independent verification before and after the
rehearsal confirms Sui phase-1 generation-1 custody and BNB Ready/paused state.

The rehearsal proves exact buyer debit and treasury credit, zero residual
allowance, correct NFT owner, rejection of unauthorized controller/buyer and
repeat purchase, then Locked state and blocked token transfer. A crucial boundary:
**pause only stops purchases; it does not invalidate an Active owned pass**.
Contract canPlay is true between purchase and redemption lock. The live Arcade
policy remains disabled and is not changed by this review or proposed sequence.
If interrupted after buy, reconcile its receipt and finish the reviewed lock;
never claim re-pausing alone makes the Active pass nonplayable.

At 50,000,000 wei gas price, summed gas limits (each estimate + 25%) give
**0.00001975075 BNB**, below the proposed 0.0001-BNB ceiling. Refresh before every
signature; compare actual spent fees plus maximum remaining fees against the cap.
The local receipts are not live transactions or delivery proofs.

## Remaining return path and fees

After local lock, the real adapter's state-valid kind-2 quote is
**0.004577084124304116 BNB**, excluding send gas. This exceeds the five-action gas
ceiling and is explicitly outside its proposed approval. The quote is from local
fork state, not a claim that the live Ready adapter can send yet.

The next separately reviewed steps are: refresh locked-state quote and send kind 2;
verify Sui release to dev 45c4 (phase 2); quote/send Sui kind-3 acknowledgement;
verify BNB retirement and token burn; quote/send BNB kind-4 completion; verify Sui
phase 3 before any reuse. Sui acknowledgement fees and future message/gas fees
must be freshly reviewed when the real lifecycle permits their application calls.
Earlier hypothetical return/completion estimates are not current signing quotes.
A lock alone does not release the original; it stays in custody until verified
return delivery. No direct admin withdrawal or cancellation exists.

No retries, altered security settings, upgrades, public sale or live gameplay are
approved here. An uncertain submission must be reconciled by hash before another
signature. Delayed delivery must be diagnosed against the original GUID.

## Reproduction

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix contracts/bnb-generation
node --use-env-proxy contracts/bnb-generation/scripts/review-private-purchase.mjs /tmp/private-purchase-review.json
npm test --prefix contracts/bnb-generation
```

Remote transport permits only read RPC methods. All sendTransaction calls run on
local Ganache; no private key or mainnet signer is used. `fork.json` contains the
five receipts and explicit negative-case assertions. `before.json`/`after.json`
record live unchanged source/destination prerequisites. No production site build,
release or contract change accompanies this review.

Validation: all 16 EVM lifecycle tests passed in addition to the five-action fork
rehearsal and its authorization, duplicate-purchase and locked-transfer checks.
