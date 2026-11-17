# Original NFTree #2720 — bind the confirmed BNB pass

The isolated page at /play/multichaintest/original/bnb/bind/ links the confirmed
suite pass 0x1d3da001E586a7DEFD397B77FADB29eD6F039c13 to adapter
0x90b5292a5074CfDD665C726b433cc0A97e0dA6ab. Only the designated BNB wallet ending
83ae can approve this fixed bindPass call. It sends zero BNB value, uses gas,
and neither transfers USDT nor deposits NFTree #2720. Purchases remain paused,
the pass remains Unconfirmed, and no token is minted.

The signing page verifies source publication and actual empty Vault, direct
dev ownership of #2720 and source capabilities, exact pass creation receipt and
calldata, patched reviewed runtime, immutables, initial storage, adapter runtime,
zero pass pointer, binder, source package peer, route, backing NFT, endpoint
delegate, endpoint bytecode/EID and 18-decimal BNB USDT. The confirmed source
package peer is the CallCap identity, not the shared OApp object.

Simulation checks current wallet/network, latest/pending nonce, call result,
gas bounds and balance. Approval repeats checks, requires a fresh reviewed quote,
and persists the intent before the wallet handoff under a Web Lock. Explicit
wallet rejection clears the intent; ambiguous failure retains it for receipt
recovery. The receipt must match the exact account, target, calldata, zero value,
chain and one exact PassBound event. Current state must then show this exact
pass pointer, unchanged paused/unminted pass and unchanged empty source Vault.

The fresh unsigned mainnet preflight is recorded in
original-trial/bnb-binding-page-preflight.json: nonce 337, estimated gas 53,153
and reference fee 0.00000265765 BNB. This is not a wallet signature or submission.

Publication adds only index.html, app.js and core.js under the new path to the
current locked 6afcb8faa4752b6b52595145 baseline. All 589 prior paths, 49 complete
backend package/provider/runtime records, protected environment/runtime
fingerprints and five schedules must remain unchanged (592 paths afterward).
The frozen earlier snapshots and signing bundles are not rebuilt or modified.

After Peter signs, independently verify the actual receipt. LayerZero source
registration, peers, libraries, DVNs and executor settings must be checked before
any original NFT deposit, sale enablement or mint. The old disposable pilot is
retired. This page does not wire pass access into the live Arcade.

Current MystenLabs guidance consulted on 2026-11-17:
- https://github.com/MystenLabs/skills/blob/main/README.md
- https://github.com/MystenLabs/skills/blob/main/accessing-data/SKILL.md
- https://github.com/MystenLabs/skills/blob/main/accessing-data/graphql.md

Use the pinned SDK 2.26.1 and existing read helpers; this work does not migrate
SDKs, wallet helpers, dependencies or contract source.
