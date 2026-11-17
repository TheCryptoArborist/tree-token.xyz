# Original NFTree — bind the Sui peer

Canonical signing page: /play/multichaintest/original/bind/.
One Sui mainnet approval in Slush/Brave, from dev wallet ending 45c4.
Original NFTree #2720 remains directly in that wallet. BNB purchases stay paused.

## Confirmed prerequisite

All four actual BNB configuration receipts were independently verified against
exact sender/endpoint/chain/value/calldata/ordered events and current stage four.
Evidence: original-trial/bnb-route-receipts.json and bnb-route-verified.json.
Latest bindings: original-trial/bnb-route-bindings.json. Both chains explicitly
require Horizen, Twinstake and LayerZero Labs, no optional DVNs, 20 BNB / 5 Sui
confirmations. The BNB pass is bound, paused and unminted with fixed 25-USDT
price and treasury. Total gas for those four actual BNB settings transactions
was 23,729,350,000,000 wei (0.00002372935 BNB); no stablecoin was charged.

## Exact approval

Two commands, one atomic PTB:

1. utils::bytes32::from_address converts the verified BNB adapter to Bytes32.
2. Original vault::bind<original collection::NFT> borrows the empty Vault,
   matching Vault AdminCap, OApp, matching OApp AdminCap, read-only Endpoint and
   actual registered MessagingChannel, then consumes that peer value.

Peer: 0x00000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab.
The immutable original package is targeted, with the original NFT type generic.
The owned references are refreshed, and the wallet chooses gas. There is no NFT
input, transfer, fund, quote/send packet, pass mint, stablecoin payment, upgrade
or purchase activation. Both capabilities stay dev-owned.

The deployed bind function initializes one unused channel path, sets the peer
and enforced Type-3 LZ_RECEIVE options for message types 1 and 3. Minimum
execution gas is 200,000 for reserve/acknowledgment, with zero native delivery.
Exactly five events and four deterministic dynamic-field writes are expected.
Only Vault, OApp, messaging channel and the two borrowed capabilities may be
written apart from gas. Original NFT, Registry, UpgradeCap, Endpoint, ULN and
registration/configuration entries are protected.

## Preflight, simulation and recovery

Verify mainnet identity and the signed publication, slot, registration and Sui
configuration receipts. One fragmented GraphQL query checks current source,
protocol, peer/options/channel state under the public 5,000-byte payload limit.
Stage zero requires no peer, options or channel entry. Stage one requires the
exact peer, both exact enforced options and zero inbound/outbound nonces.
Protected NFT/Registry/UpgradeCap versions, digests, ownership and contents are
unchanged. Both admin relationships and custody are checked.

BNB checks reuse reviewed runtimes/binding/paused-pass checks and require live
stage four plus all four actual user-signed settings receipts. The public
receipt account is synthetic read-only identity; this page requests no BNB
wallet and its provider exposes no signing method.

Mainnet unsigned simulation passed with 9,266,741 MIST net gas (0.009266741 SUI).
Execution-attached output objects independently pass the exact bound-state
validator, including derived field IDs and empty inbound payload table. This is
simulation evidence; it is not a signed mainnet peer-binding receipt.
Evidence: peer-binding-simulation.json, peer-binding-poststate-simulation.json,
peer-bind-current-state.json, peer-binding-unsigned.json and
peer-binding-preflight.json under original-trial/.

Wallet handoff requires reviewed fresh matching gas, unchanged account/network/
epoch, full repeated preflight, Web Lock and durable pending state. Explicit
rejection clears pending; ambiguous responses retain it. Receipt recovery is
available beside approval and via a manual digest input. Recovery checks the
exact commands, arguments, pure bytes, events, object effects, positive bounded
gas, sole SUI gas balance change, current bound source state and unchanged BNB
route before declaring chain verification. A digest alone is never success.

## Release boundaries and next stage

Add only index.html, app.js and core.js under the new canonical path. Preserve
all 601 existing paths, all 49 complete backend package/provider/runtime records,
configuration/environment fingerprints and five schedules. New total: 604 paths.
Freeze all earlier snapshots and public bundles, including BNB configuration.
Full source CI and review must precede the current-production preservation release.

After the actual Sui binding receipt, verify the complete route before original
NFT deposit or enabling sales. This stage does not send a LayerZero message.

## Current MystenLabs guidance consulted

Live README and applicable files were rechecked. Existing pinned SDK 2.26.1 and
working dApp Kit connection are preserved; no installation or migration occurs.
API examples were checked against the pinned SDK and actual mainnet simulations.

- https://github.com/MystenLabs/skills/blob/main/ptbs/SKILL.md
- https://github.com/MystenLabs/skills/blob/main/ptbs/building.md
- https://github.com/MystenLabs/skills/blob/main/ptbs/commands.md
- https://github.com/MystenLabs/skills/blob/main/ptbs/fundamentals.md
- https://github.com/MystenLabs/skills/blob/main/frontend-apps/SKILL.md
- https://github.com/MystenLabs/skills/blob/main/frontend-apps/non-react.md
- https://github.com/MystenLabs/skills/blob/main/frontend-apps/transactions.md
- https://github.com/MystenLabs/skills/blob/main/accessing-data/SKILL.md
- https://github.com/MystenLabs/skills/blob/main/accessing-data/graphql.md
- https://github.com/MystenLabs/skills/blob/main/move-security/SKILL.md
- https://github.com/MystenLabs/skills/blob/main/move-security/best-practices.md
