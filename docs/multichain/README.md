# Sui publication verified; BNB preparation

Publication `3PqsBcdj4CVTuQrpdWVCUqAGa5Nw7oLQp4PafcbmY1t4` succeeded on Sui mainnet at checkpoint 345966371. Sender and all three admin/upgrade capability owners in the receipt match the designated dev wallet. Actual gas: 46,353,600 MIST (0.0463536 SUI).

Verification checked the exact two transaction commands, submitted module hashes and dependency identities against the reviewed dev-wallet draft. The transaction serializer explicitly marks the publication result's first return as subresult 0; this is the UpgradeCap returned by Publish. Published bridge/codec bytes match the reviewed module hashes after normalizing their single relocated self-package address. Bridge route equals its object ID, backing equals the nested disposable NFT ID, the OApp relationship matches, and initial bound/released state is false. The receipt assigns both admin capabilities and the UpgradeCap to the dev wallet. This is publication evidence, not proof of registration or a working bridge.

`bnb-deployed-bindings.json` now contains real receipt IDs, not simulation IDs. The read-only BNB snapshot confirms chain 56, pending/latest nonce both 321. `bnb-evm-unsigned.json` was generated with the existing pinned Solidity 0.8.30 builder and contains three unsigned transactions: adapter deployment, pass deployment, one-time binding. No signatures, approvals, purchases or broadcasts were performed.

Before signing: refresh the buyer nonce and balances, estimate/simulate the adapter deployment against the real endpoint, verify its actual receipt/runtime, then simulate the pass deployment against that actual deployed adapter. The pass constructor requires adapter code, so independent pre-deployment estimation is insufficient. Verify each receipt and runtime before the next transaction. Regenerate predicted addresses if the nonce changes. The existing BNB buyer is still the designated deployer/binder/delegate; the Sui dev address does not imply a new EVM account.

After BNB deployment, register/configure the Sui OApp and both peers, libraries, executor options and DVNs, then perform reserve delivery, the 25-USDT purchase to the existing treasury, and a full redemption/acknowledgement round trip. Do not expose public sales or integrate original NFTrees before this disposable pilot succeeds.

Current MystenLabs README and `accessing-data/SKILL.md` plus `accessing-data/graphql.md` were checked live for receipt verification. These records use GraphQL, not deprecated JSON-RPC.

Adapter preparation: read-only `eth_call` against the real BNB endpoint returned deployment runtime successfully; `eth_estimateGas` returned 1268792 gas. This is an estimate for the first deployment only, not the entire pilot or crosschain messaging. Pass deployment and binding still require the deployed predecessor receipts and simulation.
