# First redemption return delivered — November 23, 2026

The user's approved single BNB `send(2)` and actual Sui delivery independently
verify. Do not resend, repeat the purchase, or redeposit the original.

- BNB source: `0xedb9edeecf1fd27e8851e57e436d9a7944933d9f0c85101d4f59be3e2f87e3b0`.
- GUID: `0xb46132353e03697bb27ed5581c3ac1b2e0a2ba1e365a11a388bcf0390cba6b99`.
- Sui delivery: `CYqYhXynf4fvaUNN8TnQxX6J1YMB3T2ab5avAbtnwZzn`.
- Message fee: **0.004577084124304116 BNB**.
- Actual gas: **0.00001851085 BNB**.
- Total: **0.004595594974304116 BNB**, below approved 0.006 BNB.
- No additional USDT payment or refund occurred in this step.

NFTree #2720, exact original object/type, is owned by Sui dev wallet
`0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
The new vault is empty, phase 2/generation 1, with exact request and recipient;
ack_sent is false. Successful delivery emitted the pinned endpoint's
PacketDeliveredEvent (BNB origin, new adapter, nonce 1) and the new vault's
Released event. NFT output version/digest/owner match the current object.
The BNB pass remains Locked, purchases paused, canPlay false. Generation 1 is
still allocated until acknowledgement and completion; NFT return alone does not
close the cross-chain lifecycle.

## Reproduce

Use Node 24 and existing pinned root plus isolated BNB dependencies:

```sh
node --use-env-proxy docs/multichain/generation-milestone/return-completed/verify.mjs
node --test docs/multichain/generation-milestone/return-completed/verify.test.mjs tools/bnb-return/core.test.mjs
```

The verifier uses a read-only EVM method allowlist and existing read-only Sui
GraphQL transport. No key, signature or transaction submission is available.
`user-receipt.json` preserves the provided receipt; `session.json` uses its exact
saved request. `rpc-reads.json` and `bnb-verification.json` independently reconcile
canonical BNB receipts, fee events, packet, all prior purchase receipts, security
and current Locked state. `sui-state.json` and `sui-delivery.json` contain actual
mainnet reads; `verification.json` summarizes the result. Reverification is scoped
to this pre-acknowledgement phase and intentionally rejects later lifecycle states.

All **37 focused tests passed** (11 destination evidence checks plus 26 existing
source checks). Negative cases reject wrong owner/original/type, stale checkpoint,
held custody, wrong generation, missing/altered release, wrong delivery nonce and
wrong output owner. No production website, contract or configuration was changed.

Current MystenLabs skills README, accessing-data/SKILL.md and its graphql.md
reference were refreshed from GitHub before Sui verification. The repository's
pinned GraphQL SDK/schema was checked directly; no dependency changes were made.

## Remaining reviewed milestones

1. Prepare a fresh Sui kind-3 acknowledgement quote/simulation and explicit fee
   review. Its delivery burns the locked BNB pass. No acknowledgement is approved
   or submitted by this receipt verification.
2. Verify the burn, then review BNB kind-4 completion and confirm Sui phase 3.
3. Keep sales/gameplay disabled and the old trial retired. Any new generation,
   deposit or public activation remains a separate reviewed action.

GitHub is the durable record. Keep existing computer checkouts untouched when
later bringing this feature branch onto the user's desktop.
