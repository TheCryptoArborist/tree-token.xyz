# Verified BNB mainnet deployment

All three approved transactions are complete. The user's receipt is preserved in
`user-receipt.json`; `completed/` contains independent RPC reads, a fresh Sui
empty-slot receipt and the verification summary. The earlier adapter-only receipt
is historical evidence of the first step.

| Step | Transaction |
| --- | --- |
| Deploy adapter | `0x016aa9570de26f1d25d3db2137fa1ef7dbac8e3a2efa1cab45c2e872deafee98` |
| Deploy pass | `0x9dd9e68b4c1d226e79f788d009a42cf47d4c7662ddc58b16670b4583226192b3` |
| Bind pass | `0x6304ed426f3653eb73f6eade845c5ef1e8b2e34be5270e1ac7b3b8a4431e8ebe` |

Adapter: `0x74c20dEB476Dca58459956b1AcD65771197900C9`.
Pass: `0x418cC337FC19D8cf3b41a9C6E3138a60E34Eb9b5`.
Admin/controller/binder/delegate: `0xF2Ab1eEBbEcb4E315FE95D8b532D1aB00F1A8789`.
Treasury unchanged: `0xC440F06BBC7e58b0d055815f915447e4ae0E3720`.

At block **135197952**, independent verification checked successful receipts,
exact sender/nonces/creation or binding calldata, no value transfer, expected
addresses, reviewed gas/fee limits, deployed runtime, immutable getters,
reciprocal binding and Endpoint delegate. Receipt block hashes and fee fields
match the user's receipt. Confirmations at verification were 2310, 309 and 143.
The fee comparison uses the pinned approved request template and historical
0.05-gwei quote; it does not claim to have read the user's browser storage.
Total gas fees: **0.0001740542 BNB**, below the **0.001 BNB** approval.

The pass is **Unconfirmed, generation 0, purchasesPaused true, canPlay false**.
A fresh Sui check confirms the existing slot remains **empty and unbound**.
BNB binding does not configure the LayerZero security path or bind the Sui peer.
No NFT was deposited by this sequence, and no sale or gameplay was activated.

## Reproduce the read-only checks

Use Node 24 and the committed dependencies:

```
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix contracts/bnb-generation
node --use-env-proxy contracts/bnb-generation/scripts/verify-deployed.mjs /tmp/tree-bnb-fresh-verification
```

Choose a new output directory. The verifier only permits read RPC methods, pins
contract state reads to one BNB block, applies the existing reviewed receipt and
runtime checks, then validates a fresh Sui receipt. It never signs or submits.
If later approved configuration changes the expected inactive state, the check
must fail rather than silently reinterpret this milestone's evidence.

## Remaining reviewed work

1. Review the exact LayerZero message-path security configuration (libraries,
   DVNs, confirmations, executor/options and costs) using the actual contracts.
2. Prepare and separately review configuration and Sui peer-binding transactions.
3. Refresh original NFTree #2720 identity and ownership before any later deposit.
4. Review backing delivery and lifecycle evidence before enabling sales or access.

Do not repeat these three completed transactions or reuse the retired trial route.
Existing Sui authentication, payments, games, scoring and tournaments are unchanged.
