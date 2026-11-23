# Final generation-1 completion review — November 23, 2026

Prepared and tested; **approval for this new BNB fee is pending**. No live
completion transaction has been submitted. One new-adapter `send(4)` from the
MetaMask + Ledger admin ending 8789 tells Sui that the pass is burned, closing
generation 1. NFTree #2720 stays in Sui wallet 45c4. No USDT, deposit, mint,
security change, public sales or gameplay activation is included.

## Concrete proposed authorization

One completion send, **0.006 BNB total maximum**:
**0.0059 BNB message fee + 0.0001 BNB gas**.

- Current native message quote: **0.004577084124304116 BNB**, zero LZ-token fee.
- Gas estimate: 360724; padded limit: 450905 at 50000000 wei/gas.
- Maximum quoted gas: **0.00002254525 BNB**.
- Combined quoted maximum: **0.004599629374304116 BNB**.
- Local fork actual gas: 0.00001765785 BNB; simulated total
  0.004594741974304116 BNB. These are simulated costs, not live expenditure.
- Admin nonce: **4752**, chain ID **56**, new adapter only.
- Outbound channel nonce: **1 → 2**; kind **4**, generation **1**.
- GUID: `0x89477a7ab8cb4e05877abe4322254432cd58e45f1f0d19f26a8a4c0558d283b8`.

The prior return-message approval does not cover this later message fee. Obtain
approval of the limits above before preparing the canonical signing handoff. The
fresh quote and current/pending nonce must be checked again immediately before
signing. Do not resend an uncertain submission.

## Verification and limits

`before.json` independently rechecks the actual Sui acknowledgement/source effects,
original identity and current ownership, BNB burn receipt, code/security/bindings,
Retired/paused/nonplayable state, nonexistent token, zero buyer balance and
outbound nonce still 1. Sui is phase 2/generation 1, ack_sent true, empty vault.

`fork.json` is a fresh mainnet fork with read-only remote transport. Only local
Ganache receives eth_sendTransaction; no original balance or storage is overridden.
The actual adapter quote/send(4) executes on local fork state. The exact wire-v3
payload pins vault, original NFT, generation, redemption and dev recipient. The
configured Sui receive gas remains 30000000; options/security are unchanged.
Underpayment and overpayment both revert; wrong kinds 1/2/3 revert. The source
receipt has exactly the expected executor/verifier fee events, PacketSent and
MessageSent. All three required verifier fees plus executor payment equal the
quote; the native balance delta equals message fee plus gas. BNB stays Retired,
paused, nonplayable and token 1 stays burned after the simulated send.

**Source simulation is not actual Sui completion.** The Move lifecycle tests cover
matching authenticated kind-4 completion, wrong request/recipient/generation,
stale messages, duplicate delivery and restrictions on reuse. After a real send,
independently verify its source receipt, actual Sui Completed event, matching
request/generation, phase 3, empty custody, and original ownership. Only then is
generation 1 closed; no new deposit, sales or gameplay is implied.

## Reproduce and tests

Use Node 24 and the existing pinned root/isolated BNB dependencies. From root:

```sh
node --use-env-proxy contracts/bnb-generation/scripts/review-completion-send.mjs /tmp/completion-review.json
node --test contracts/bnb-generation/test/completion-review.test.mjs contracts/bnb-generation/test/return-fees.test.mjs
```

All **26 focused tests passed**. They validate exact packet/GUID/options/fees,
Retired state, monetary caps and reject changed signer, adapter, kind, nonce,
chain, value, gas, playability, pause, recipient, request, payload, packet, options,
payee, removed events and extra events. CI includes the new completion tests.
Current Mysten skills README was refreshed before Sui checks; the applicable
GraphQL/data-access guidance was already read, and the pinned existing verifier
was reused without SDK/dependency changes.

This review changes no live website or contract. After approval, preserve the
complete then-current production baseline and use only a canonical
`tree-token.xyz/play/` MetaMask/Ledger handoff. GitHub branch/PR #280 retain the
review, setup, evidence and remaining task.

Hosted [CI run 45232405636](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45232405636) passed for source `63272b9e2fed9c7529589c5700a835fb34797f60`: 52 Move contract tests and release build, 16 EVM contract tests, 398 unsigned guard tests and 103 BNB guard tests, with no failures. `validation.json` records these results. New completion fee approval remains pending.
