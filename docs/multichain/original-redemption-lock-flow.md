# Original NFTree #2720 — redemption lock stage

Additive page: `/play/multichaintest/original/bnb/redeem/`.
This stage exposes only requestRedemption(fixed dev recipient), with zero native
transaction value. It does not expose a message sender, withdrawal, NFT transfer,
admin change, cancellation or pass burn. NFTree #2720 remains in the existing
Sui vault until authenticated delivery of the later LayerZero redemption packet.

## Fixed identity and transitions

BNB mainnet 56. Pass #1 `0x1d3da001E586a7DEFD397B77FADB29eD6F039c13`;
adapter `0x90b5292a5074CfDD665C726b433cc0A97e0dA6ab`;
owner `0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae`.
Recipient is the existing Sui dev/admin wallet
`0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
The request binds wire version 2, chain, exact pass, route, original NFT, token #1,
current owner and this exact recipient. Active→Locked disables BNB access and
transfers. No timeout/admin reset exists; completing redemption requires the
separate send, authenticated Sui release and Sui→BNB acknowledgement. Only the
acknowledgement makes Locked→Retired and burns the pass. There is no additional
USDT payment and no replacement NFT is minted.

Successful actual purchase receipt:
`0x2a98b797478a92ca5000038208b6e9ea2746889bfff87fc8e64243ccd77552c5`.
The unsigned checkpoint in `original-trial/redemption-lock-preflight.json`
records actual current reads, prospective message quote and lock simulation.
It is a public intended-account check, not an installed-wallet test or signature.

## Read and signing boundaries

The new stage independently validates exact original contract runtime/immutables,
USDT/protocol code, all 17 configured/effective security reads, pass and adapter
identity, zero remaining USDT allowance, balance one, owner, and Active/Locked
access. Locked requires the exact request and recipient; the outbound message
nonce must remain zero. No old Ready/Unconfirmed phase validator is weakened.
Full original source custody, contents, publication, authority, security and
announcement receipts are verified with the existing GraphQL source validator.
Historical purchase receipt validation reuses its exact calldata/payment/mint
checks with only its current-state callback replaced by this stage's independent
Active/Locked validator result. A past purchase does not imply a Ready current state.

The prospective BNB→Sui messaging quote uses the deployed endpoint, exact adapter
sender, package/CallCap peer, v2 redemption payload and fixed 30,000,000 destination
gas options. Quoting is a view call, so no Locked state is manufactured. Native
fee must be positive, ≤0.006 BNB and request zero LZ tokens. The exact future
send is not simulated or submitted here: it cannot succeed before locking and
will be re-quoted/simulated in the next stage. Sui delivery and return ACK fees
will be reviewed separately, not presented as included in this BNB estimate.

The lock call itself is simulated and must return the exact derived request.
Gas estimate must be positive and ≤700,000; buffered gas budget ≤0.01 BNB.
Before commitment require enough native BNB for buffered lock gas, current message
quote and a conservative 2,000,000-gas reserve for the separate send. Insufficient
funding returns a visible shortfall with signing disabled. No current quote is a
promise about future fees. User signs every transaction, controls final wallet
fees, and is shown the irreversible lock/recipient before consent.

Require fresh two-minute quote, matching action/nonce/gas/message fee, account and
chain identity, unchanged account epoch and renewed consent. Durable pending state
plus Web Locks prevents duplicates. Explicit user rejection alone clears pending;
ambiguous errors retain recovery. Manual hash recovery is available without local
state and matches exact lock target/calldata, zero native value, successful chain
receipt, request/NFT/recipient event, nonce and current full Locked state.
This page is intentionally limited to pre-send state. If a message was independently
sent or delivered, it stops and asks for delivery verification; it does not reset
custody or resubmit a lock. Existing purchase/enable/reserve pages stay unchanged.

## Release preservation and checks

The current actual baseline was selected as `6b0062b486ca536dd1768394` (Tree Army
mobile controls), 50 backend records and five schedules. It was observed ready
and current but unlocked. A narrow protection mode verifies this exact deployment
is STILL current/published/ready, validates backend identity, refuses all queued
or nonterminal builds except the ten unchanged audited historical API orphans,
rechecks identity, and locks only that current version. It cannot publish an old
or unpublished baseline. Capture and every later guard then require the lock.
A moved baseline or active build aborts; no unrelated job is canceled.

The additive release permits exactly three new redeem page files, preserving the
fresh complete static inventory, backend provider/package/runtime records, all
five schedules, build/runtime/environment configuration and site snippets.
No existing game, wallet module, contract, NFT, backend or dependency is changed.
Source must pass PR CI and automated review before a reviewed main commit triggers
publication. Browser CI checks 1440/390/320 widths, visible connection/recovery,
no module error/overflow and disabled disconnected signing. Full protocol/state,
funding, receipt, nonce, consent, error/recovery and preservation tests run too.

Current MystenLabs/skills README.md, accessing-data/SKILL.md,
accessing-data/graphql.md, move-security/SKILL.md and
move-security/best-practices.md were checked live. Existing pinned GraphQL reads
are retained; Sui JSON-RPC is deprecated. No SDK migration or new Sui PTB is made.
