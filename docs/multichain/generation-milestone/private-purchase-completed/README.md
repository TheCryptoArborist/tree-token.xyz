# Private purchase and redemption lock complete — November 23, 2026

All five user-signed transactions independently verify against the pinned approved
sequence. Nonces 4746–4750, exact calldata/recipients, successful canonical
receipts, gas limits, payment/mint/lock events, current runtime/security and final
state passed the existing purchase verifier. Do not repeat any of these actions.

| Step | Transaction |
| --- | --- |
| Exact 25-USDT approval | `0x90513e77348c8432bde9da795b64eb42aa755c781f68595685cb6b8d8ecccc34` |
| Private unpause | `0xa6479792eec6e606d5ee7f4f4ecd7627c1f51478d574148e545995df89e2d90e` |
| Purchase generation 1 | `0x80ed100d08356834a8be8e008972e943d080aa0025b0160112e9289e51e3278a` |
| Re-pause | `0x403974ee957126e7c35f8680734028e56a320470a1f53e79deedcadbf6faf704` |
| Redemption lock | `0xeb391e4f8d85c1c0765c564ac21d1862a805a7d1cc6eca6a84d0607229e3a43c` |

Exactly **25 USDT** was transferred from admin/initial buyer 8789 to unchanged
fee treasury `0xC440F06BBC7e58b0d055815f915447e4ae0E3720`. This is a real purchase
payment, not a refundable deposit. All five actual gas fees total
**14825150000000 wei = 0.00001482515 BNB**, within the approved 0.0001-BNB cap.
The remaining allowance to the pass is **zero**.

Final BNB state: **Locked, generation 1, purchases paused, canPlay false**. Token 1
is owned by admin 8789 and locked against transfer. Redemption request:
`0xc99c328de96599e4ea3332e097436cdc5bd542a0a479f892543b3008664128b3`.
Exact Sui recipient:
`0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.

Independent current Sui verification confirms original NFTree #2720 remains held
in the new vault, phase 1/generation 1, announced. A redemption request on BNB is
not an NFT release. No return message or further chain action was submitted by
Codex. Website gameplay remains disabled.

## Evidence and reproduction

`user-receipt.json` preserves the parsed uploaded receipt. `rpc-reads.json` contains
independently fetched transactions, receipts, canonical block checks and current
BNB code/settings/state. `verification.json` records the successful reconciliation.
`sui-custody.json` records independently refreshed source effects/current custody.

The user supplied receipts rather than an exported browser progress file.
`reconstructed-session.json` explicitly reconstructs the five approved requests
using fixed calldata, nonces and gas limits plus the saved live preflight's
50,000,000-wei gas-price ceiling. It is not claimed to be the user's original
browser storage. All actual transaction fee ceilings satisfy that reviewed bound.

With pinned root and `contracts/bnb-generation` dependencies installed, Node 24:

```sh
node --use-env-proxy docs/multichain/generation-milestone/private-purchase-completed/verify.mjs
```

The script permits only read RPC methods and cannot sign or submit. Its current
state checks intentionally stop passing after subsequent lifecycle transitions;
use the next milestone's verifier then, without repeating completed transactions.
No production code or website deployment accompanies this receipt update.

## Next reviewed milestone

Prepare a fresh state-valid kind-2 BNB return-message quote, exact payload/request/
recipient, send simulation, executor budget and fee cap. Review that concrete
message fee plus gas before requesting a new user signature. The prior five-step
approval does not include this send or its native message fee.

After sending, independently verify Sui delivery releases the original to 45c4
(phase 2). Separately review Sui kind-3 burn acknowledgement, verify BNB retirement,
and review kind-4 completion before any generation reuse. A delayed message is
not authorization to resend, alter security, upgrade, or activate gameplay.
