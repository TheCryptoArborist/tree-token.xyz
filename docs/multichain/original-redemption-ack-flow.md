# Original NFTree #2720 — final release acknowledgement

Signing page: `/play/multichaintest/original/sui/ack/`.

## Verified redemption and remaining action

BNB transaction
`0xa33612db18691d9805ebbc69ac24501d6e4476bd4edf2476b9b9b1710c50fe6f`
successfully sent the fixed original-backed redemption request from the buyer
ending 83ae, nonce 347. The exact adapter calldata, complete LayerZero packet,
delivery options, library, GUID and request events were checked against the
published send validator and current BNB contract state.

LayerZero GUID
`0x1c493300e7be4fddd4f5cb61cd6b003e59b6873246df438a52d303dac89bb87d`
was delivered from BNB EID 30102 to Sui EID 30378. Source confirmation was
2026-11-20 17:27:01 UTC; Sui execution was 17:27:35 UTC. The destination digest is
`Ay5gtMkYp5mjYidC3TJn4YuJLKYcHLg3Yxm8qRhTy9mU`.

Independent Sui GraphQL receipt and object reads confirmed that the exact
original NFT
`0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba`
was unwrapped, with no object-ID creation, and transferred to
`0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
Its original collection type and NFTree #2720 metadata are intact. The vault is
phase 2, its NFT option is empty, and its immutable request and recipient match.
At this verification checkpoint `ack_sent` is false and BNB pass #1 remains
Locked, balance one, with game access disabled and USDT allowance zero.

Evidence: `original-trial/redemption-send-receipt.json`,
`original-trial/redemption-delivery-verified.json`, and
`original-trial/ack-release-receipt.json`. These are timestamped observations.
The acknowledgement page checks current state before every signing handoff.

## One final user-approved Sui transaction

The acknowledgement calls the existing original vault's kind-3 send path in
package
`0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4`.
It binds vault/route
`0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c`,
the original NFT, request
`0x76f08f56cc030f0b7db560cf46df3fee212d1ddcfa2c8135d1fbee4e85e38497`,
and the fixed Sui recipient. It sends to BNB adapter
`0x90b5292a5074CfDD665C726b433cc0A97e0dA6ab` for pass
`0x1d3da001E586a7DEFD397B77FADB29eD6F039c13`.

Expected acknowledgement GUID:
`0xe9b1c9627995eb8c09471150e121847770e7b28d9d705acd7b2a7f42b5a44c8c`.
The path is Sui EID 30378 to BNB EID 30102 with outbound nonce 2, package/CallCap
identity as sender, and the padded original adapter as receiver. Application wire
version 2, kind 3 carries the exact route, NFT, request and recipient. The enclosing
LayerZero packet is PacketV1. Existing enforced options provide 200,000 BNB receive
gas and no native delivery; three required DVNs remain unchanged.

The PTB is derived from the already reviewed original reserve transport: the
quote changes only the kind to 3; the send changes only the kind and current
native fee. It has no original NFT or administrator capability input and leaves
gas selection to the user's wallet. The on-chain vault's `ack_sent` flag makes
the acknowledgement one-shot within the atomic Sui transaction.

The page requires explicit Slush connection to the Sui dev wallet, a fresh
simulation, displayed SUI fees, and consent before opening approval. No BNB
wallet connection or second USDT purchase is involved. Native message fee must
be positive and at most 0.5 SUI; simulated gross gas and simulation gas budget
must each be at most 0.1 SUI. The wallet controls its final gas settings. These
limits are not quoted prices.

## Read, simulation and recovery boundaries

Current state checks retain the existing pinned GraphQL integration and verify
the original package, authorities, registry, route, verifiers, libraries, enforced
options, vault relationships and channel. Only independently established lifecycle
changes are normalized when reusing earlier route validation. Pre-send checks
require the released NFT's exact type/metadata and designated owner. Completed
acknowledgement recovery permits subsequent legitimate NFT movement and never
reapplies the obsolete phase-1 requirement that the NFT remain wrapped.

The exact successful Sui release receipt and prior original source receipts are
checked. Public BNB reads verify deployed runtime and bindings, current Locked
or Retired pass state, immutable request/recipient, the actual BNB send receipt,
and the acknowledgement GUID's delivered payload hash at one pinned block.
Retired is accepted only with zero pass balance, disabled access and the exact
kind-3 payload hash. `ownerOf` is not called on the burned pass.

Both quote and send are simulated with checks and gas selection enabled on
clones. Validators compare exact commands and inputs, sender/gas owner, payment
currency, aggregate balance changes, executor and three DVN fee recipients,
complete packet/options/library, and the permitted object effects. Simulation
also checks the original vault's BCS contents after setting `ack_sent`. The only
existing non-gas writes are the vault, OApp, channel and exact outbound path.
The returned original NFT is not an input and is not mutated.

The unsigned simulation checkpoint quoted 94,962,136 MIST in message fees and
4,053,255 MIST in net gas, totaling 99,015,391 MIST. Fresh live checks supersede
these values. The simulation-attached poststate confirms `ack_sent=true`,
outbound nonce 2 and unchanged OApp/channel contents. Relevant fixtures are
`original-trial/ack-quote-simulation.json`, `ack-send-simulation.json`, and the
adjacent unsigned templates and poststate evidence.

Read-only BNB `eth_call` accepted the exact callback within 200,000 gas and
rejected the wrong nonce and an unauthenticated caller. Its evidence is
`original-trial/redemption-ack-bnb-callback-simulation.json`. It uses an
impersonated endpoint caller only inside simulation, so it proves callback
acceptance and those rejection checks, not actual DVN verification, delivery,
pass retirement, or a mainnet state change.

Browser Web Locks and durable pending state prevent concurrent or ambiguous
retries. Wallet-reported submission is displayed separately from chain-verified
success. Manual receipt recovery works without connecting a wallet and verifies
the exact acknowledgement transaction before updating its saved state. A known
failed transaction or explicit rejection may clear pending; an ambiguous error
requires receipt recovery. Account/network changes and expired or changed quotes
invalidate consent.

Sui acknowledgement confirmation and BNB retirement are distinct outcomes.
The receipt check reports completion only when the source acknowledgement and
the destination's exact retired/pass state have both been verified.

## Additive publication

The required input baseline is the current locked send release
`6b00812738f2bd1e7367809f`, with 646 static paths, 50 complete backend function
records and five schedules. The publisher captures and verifies the actual
current inventory, then adds only the acknowledgement HTML, app and core files.
The existing shared Sui wallet module is reused and pinned by its current SHA1.

All old file hashes, complete backend provider/package/runtime records, schedules,
runtime settings, protected environment configuration and snippets must remain
identical. Any live baseline drift or genuine queued build blocks publication.
Only the exact existing audited historical API orphan exception is retained.
No historical root snapshot, backend rebuild, SDK migration or rollback is used.
CI verifies source/bundle parity, protocol tests, and disconnected browser behavior
at 1440, 390 and 320 pixels. Installed-wallet connection and actual user approval
are separate from those browser checks.

## Current guidance consulted

MystenLabs/skills was fetched live for this step: `README.md`,
`accessing-data/SKILL.md`, `accessing-data/graphql.md`, `move-security/SKILL.md`,
`move-security/best-practices.md`, `ptbs/SKILL.md`, `ptbs/building.md`,
`ptbs/commands.md`, `ptbs/fundamentals.md`, `frontend-apps/SKILL.md`,
`frontend-apps/non-react.md`, and `frontend-apps/transactions.md`.
The project remains on its pinned Sui SDK 2.26.1 and existing wallet bundle.
GraphQL is used for Sui reads and unsigned simulation; deprecated Sui JSON-RPC
is not introduced. The contract source and exact deployed runtime remain the
authority for this original-specific acknowledgement flow.
