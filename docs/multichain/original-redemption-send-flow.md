# Original NFTree #2720 — LayerZero redemption send

Isolated page: `/play/multichaintest/original/bnb/send/`.
The preceding actual lock succeeded:
`0xb3913d8880bc662a2f40434f84691c87374a7cd9d8f0401ee77b6eec6e91b6a9`
(nonce 346, pass `0x1d3da001E586a7DEFD397B77FADB29eD6F039c13`).

## One exact native-fee transaction

This page exposes only `sendRedemption()` on existing original-backed adapter
`0x90b5292a5074CfDD665C726b433cc0A97e0dA6ab`, BNB chain 56, from designated
wallet `0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae`.
No token approval, USDT payment, NFT mint, admin call, options parameter or
recipient editing is offered. The native BNB value is the current exact
LayerZero quote; network gas is separate. Message fee must be positive and
≤0.006 BNB, with zero LZ-token payment. Buffered network gas ≤0.01 BNB.
The wallet controls its final network gas edits; frontend estimates do not
constrain a fee the user changes inside the wallet.

The immutable request is
`0x76f08f56cc030f0b7db560cf46df3fee212d1ddcfa2c8135d1fbee4e85e38497`;
recipient is the existing Sui dev wallet
`0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
Original NFT is
`0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba`;
vault route is
`0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c`.

Expected GUID:
`0x1c493300e7be4fddd4f5cb61cd6b003e59b6873246df438a52d303dac89bb87d`.
It binds outbound nonce 1, source EID 30102, bytes32-padded adapter, destination
EID 30378 and original package/CallCap peer
`0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4`.
The shared OApp address is not substituted for this peer identity.

Application wire version 2, kind 2, contains exact route/NFT/request/recipient.
The enclosing LayerZero PacketV1 contains version 1, nonce/path, GUID and wire
payload. Destination options are fixed at 30,000,000 gas, zero native delivery.
`PacketSent(bytes,bytes,address)` must match the complete encoded packet,
options and configured send library. `RedemptionSent` must match GUID/request.
Live simulation returns this exact GUID, nonce one, positive native fee no greater
than the provided quote and zero LZ-token fee.

## Current state and receipt boundaries

New helpers leave all frozen purchase/lock/source validators unchanged. Before an
unsent request, full original source custody, contents, authority, dependencies,
security, publication/announcement and prior receipts are checked with the existing
GraphQL integration. At a pinned BNB block verify exact original pass/adapter
runtime and immutable bindings, protocol/USDT code, every reviewed route/security
read, pass identity/request/recipient, zero allowance, Locked ownership, disabled
access, adapter gas/payload/options, send flag/GUID and endpoint outbound nonce.
Adapter and direct fixed endpoint quotes must be byte-identical.

The actual lock receipt is verified again for exact successful transaction,
calldata, sender, original NFT/request/recipient event and chain. Only its old
current-state callback is replaced with this stage's independently validated
current state; historical transaction validation is retained. A verified lock
receipt alone does not authorize a send without current custody/route checks.

Read the monotonic send hint first: before sending, source phase-1 custody checks
are required; once sent, the source NFT may already be released, so do not rerun
frozen phase-1 custody preconditions. Instead require sent=true, exact stored GUID,
outbound nonce one, exact request/recipient and Locked or Retired state. Locked
requires owner/balance one and no access; Retired requires balance zero and no
access, and ownerOf is not called for the burned token. An unsent Retired state,
regressing send flag, unexpected nonce or GUID fails closed. No source delivery
claim is inferred: every completed send result explicitly says destination is
not verified. This avoids treating legitimate release as lost custody while
preventing a second send.

Require a fresh two-minute quote, matching step/target/nonce/native fee/gas,
selected account/chain, account epoch and explicit consent. Recheck the native
ceiling and fixed target at wallet handoff. Web Locks plus durable pending
nonce/target/value/hash coordinate tabs. Explicit rejection alone clears pending;
ambiguous errors, missing hashes and post-submit storage failure retain recovery.
Manual recovery works without local state and matches successful exact send
identity/calldata/native amount, exact packet/options/library and GUID/request
logs, current full one-shot BNB state, and any stored nonce/value/hash. Duplicate
packet/send events are rejected; ordinary worker fee events may accompany them.

## Verified unsigned checkpoint and later steps

`original-trial/redemption-send-preflight.json` records the actual successful
unsigned mainnet simulation and full BNB reads, including the exact prior lock
receipt. At capture: Locked, unsent, outbound nonce zero; source custody checks
passed. Quote 4,577,068,618,141,518 wei, estimated network gas 404,306 units,
nonce 347, and sufficient BNB. No assistant transaction was signed or submitted.
The account in a public read-only harness is not an installed-wallet test.

After the user signs, verify the BNB receipt first. Then independently verify
LayerZero delivery and original NFT ownership on Sui. Only authenticated delivery
releases NFTree #2720 to the fixed recipient. The later Sui→BNB acknowledgement
retires/burns the locked pass; separate Sui gas and return message fees require
fresh review. Sending, delivery and acknowledgement are distinct results.

## Additive publication and guidance

Expected baseline is the current locked redemption-lock release
`6b007400b0b6efcc0896ac43`: 643 static paths, 50 backend records, five schedules.
Capture the actual fresh inventory and require the exact baseline throughout.
Only three new files under original/bnb/send/ are permitted. Preserve every old
static path/byte, all complete function provider/package/runtime records, all
five schedules, build/runtime/environment configuration and snippets. Do not use
the historical root snapshot or upload rebuilt functions. Refuse every active
or queued build except the ten exact unchanged audited historical API orphans.
Any current-site drift aborts; do not cancel an unrelated job or restore old files.

The new publisher retains the tested narrow current-baseline protection guard,
which cannot lock an older/unpublished baseline. The selected baseline is already
locked, so protection is a no-op after verification. Main publication is guarded
by the shared production concurrency lock and exact reviewed source SHA.
Browser CI uses pinned Playwright 1.56.1 full Chromium with --no-shell at desktop
1440 and mobile 390/320 widths, verifying visible connection/recovery, no page
errors/overflow and disconnected signing blocked. This is not proof of an
installed extension connection, wallet reputation clearance or destination execution.

Current MystenLabs/skills README.md, accessing-data/SKILL.md,
accessing-data/graphql.md, move-security/SKILL.md and
move-security/best-practices.md were checked live. Existing pinned Sui GraphQL
reads are reused; Sui JSON-RPC is deprecated. No Sui PTB or SDK migration is made.
LayerZero primary GUID.sol, PacketV1Codec.sol and ILayerZeroEndpointV2.sol were
checked in LayerZero-Labs/LayerZero-v2; GUID/packet/event derivations were then
verified against the actual pinned deployed-runtime send simulation. Existing
contract build remains locked to @layerzerolabs/lz-evm-protocol-v2 3.0.168.
