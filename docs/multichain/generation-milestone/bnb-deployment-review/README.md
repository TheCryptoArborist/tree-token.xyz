# BNB adapter/pass deployment — prepared, not authorized or submitted

The real Sui empty custody slot is verified. This milestone prepares the next
three BNB mainnet transactions for separate review and approval. Signing will use
**MetaMask with Ledger**, as selected by the user, with admin
`0xF2Ab1eEBbEcb4E315FE95D8b532D1aB00F1A8789`.

## Exact proposed sequence

1. Deploy new `TreePassAdapter(packagePeer, vaultRoute)` directly from the admin.
2. Deploy new `TreeSuitePass(adapterAddress)` directly from the same admin.
3. Call the new adapter's `bindPass(newPassAddress)` once.

The constructor's package peer is
`0xc445519bf1d6ed8ab6002d20ad7ed81a9ad25e31990df9b72203d0ad86fd2e92`.
It is the package-based CallCap identity, **not** the OApp object ID. The route is
the actual newly created Sui vault:
`0xf5dff8e2cc96824f89735fa16c068ee8194fbb7e8d697aeebe5d135f8a5916eb`.
The retired trial vault, pass and adapter are never inputs or destinations.

The deployment sender becomes adapter binder, pass controller, initial private
buyer and endpoint delegate. Binder/controller/initial buyer are immutable; this
step adds no key rotation. Fee treasury remains
`0xC440F06BBC7e58b0d055815f915447e4ae0E3720`. Payment currency remains the existing
18-decimal BNB USDT at `0x55d398326f99059fF775485246999027B3197955`.
No USDT transfer or allowance is included. Constructors set the endpoint delegate
but do not configure message libraries, DVNs, executor, or the Sui peer path.
`bindPass` links the two new BNB contracts; it is distinct from Sui peer binding.

## Mainnet fork evidence and costs

`review.json` records the first successful local fork at BNB block 135184193;
`refreshed-review.json` records the repeated run at block **135184352**. Both use
the exact selected admin, pinned compiled initcode, real Endpoint/USDT code and
storage, and actual Sui package/route. Raw unsigned calldata, nonce, gas limits,
code hashes and Sui observations are saved. No private key is loaded. All sends
occur only in local Ganache; the remote transport allows reads and rejects
submission/signing methods before fetch.

The latest snapshot observed admin nonce **4739**, yielding conditional predicted
addresses (these are **not deployed**):

- Adapter: `0x74c20dEB476Dca58459956b1AcD65771197900C9`
- Pass: `0x418cC337FC19D8cf3b41a9C6E3138a60E34Eb9b5`

| Action | Local gas used | Reviewed gas limit |
| --- | ---: | ---: |
| Deploy adapter | 1,590,262 | 1,987,828 |
| Deploy pass | 1,838,468 | 2,298,085 |
| Bind pass | 52,354 | 65,443 |

At the observed **0.05 gwei**, aggregate gas-limit allowance is
**0.0002175678 BNB**. Proposed absolute total fee ceiling: **0.001 BNB**.
The packet verifier rejects a higher aggregate allowance. This is a proposal,
not user approval. Real admin balance was **0.033993167401497008 BNB**; no funding
shortfall at that quote. Ganache was independently gas-funded locally to test
execution; the real balance was read and recorded separately.

## Verified outcomes

Both fresh forks deployed and bound successfully. Endpoint EID is 30102, Sui EID
30378, real USDT has 18 decimals, and delegate/binder/controller/initial buyer all
match the selected admin. Runtime bytes match the compiler outside immutable
slots, with immutable values checked through getters. Endpoint and token code
hashes, final runtime hashes and production source hashes are recorded.

The pass remains **Unconfirmed**, generation 0, purchases paused, zero minted
balance, and canPlay=false. Unauthorized binding, repeat binding, unauthorized
unpause and purchase attempts fail. Fresh Sui reads still show the same empty,
unbound vault, and original NFT identity/ownership remains correct. This does
not prove LayerZero message delivery or security configuration; those are later
milestones. No live Arcade access changes are made.

Validation: **16 EVM lifecycle tests** and **19 deployment-review/wallet tests**
passed; production Solidity compiled with pinned solc 0.8.30, optimizer 200,
Shanghai EVM. Source/lock hashes are in validation.json. Ganache on Node 24 used
its JavaScript fallback because its optional native uWS binary was unavailable;
both actual fork runs completed successfully.

## Reproduce and continue

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix contracts/bnb-generation
node --use-env-proxy contracts/bnb-generation/scripts/deployment-review.mjs /tmp/new-bnb-review.json
node --test contracts/bnb-generation/test/deployment-review.test.mjs contracts/bnb-generation/test/wallet-preflight.test.mjs
npm test --prefix contracts/bnb-generation
npm run compile --prefix contracts/bnb-generation
```

Node 24 is used. `--use-env-proxy` supports this Cloud network; omit if unnecessary.
Output paths must be new to preserve evidence. Saved review timestamps expire
for signing after two minutes; offline fixture tests intentionally verify them
at their historical preparation time. Do not send saved transactions directly.

After approval, build a canonical `tree-token.xyz/play/` MetaMask/Ledger handoff
with fresh nonce, block, fee, bytecode and Sui checks. Verify chain 56 and the
exact selected admin. Reserve no nonce based on these historical predictions.
For each of the three steps, persist the transaction hash before proceeding,
verify the actual receipt/runtime/roles and resolve uncertain submission before
retrying. An unrelated admin transaction requires refreshing subsequent nonce
and address predictions; a partially deployed sequence must resume from verified
receipts, never blindly deploy again. No preview-domain signing is permitted.

Deployment approval, canonical handoff publication, BNB message-path security
configuration, Sui peer binding, NFT deposit, sales and gameplay activation remain
outstanding. The first proposed approval covers only the three empty BNB steps
and their canonical signing handoff, with the 0.001 BNB aggregate ceiling.
No website or live backend was changed in this preparation milestone.
