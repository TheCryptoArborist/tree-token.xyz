# End-to-end delivery review — November 22, 2026

## Decision

The configured empty route has no heartbeat/no-op message. **Do not deposit merely
to test connectivity.** Prepare the exact reserve-send fee/execution review and the
complete private redemption/recovery plan before asking for a deposit signature.
The six earlier approvals are complete; they do not authorize an NFT deposit,
USDT purchase, message fees, unpausing purchases or gameplay activation.

Source: `contracts/nftree-generation/sources/vault.move` (`fund`, `payload`,
`process`, `quote`, `send`) and `contracts/bnb-generation/src/TreeSuitePass.sol`
(`confirmReserve`, `buy`, `requestRedemption`, `acknowledge`), `TreePassAdapter.sol`
(`outboundPayload`, `quote`, `send`, `lzReceive`). No old trial route is reused.

## What was proved now

The direct final-binding verifier refreshed original #2720 identity/ownership,
empty bound custody, configured security, retained capabilities and inactive BNB
state before and after the probes. Checked Sui simulations of kinds 1 and 3 on the
empty vault reject with `vault::payload` abort code 5. Read-only BNB quotes for
kinds 2 and 4 reject with exact `Invalid()` selector `0x6dac6a09` while inactive.

A checked simulation of **fund + payload inspection**, using the exact currently
owned original, succeeds and returns the expected 138-byte wire-v3 reserve
payload: kind 1, new vault route, original NFT ID, generation 1, zero request and
recipient. It emits only `Funded`, not a sent LayerZero packet. This does **not**
prove delivery, authorize deposit, quote messaging fees or create actual custody.
The before/after live NFT and vault objects are identical.

The simulated transaction uses a 0.1-SUI simulation budget. Its net gas is
-948102 MIST because the model includes a storage rebate from wrapping the NFT.
This is not a promise of free execution or a fee limit: gross gas, address balance
and the later message-fee quote still require a fresh review. No message fee was
quoted here, and no fee ceiling for a future live delivery test is approved.

Evidence: `verified/` (before/after state, exact failures, successful simulation,
BNB RPC errors and summary). All **16 BNB contract lifecycle tests passed**;
`evm-tests.txt` records authentication, private purchase, stale/duplicate messages,
redemption locking, retries, retirement and two-generation behavior. Local mocks
and simulations do not establish validator/executor delivery on mainnet.

## Proposed staged sequence — not authorized for signing

| Stage | Required action | Observable success | Stop condition / scope |
| --- | --- | --- | --- |
| 0: prepare | Refresh exact identities, current bound state, both security configurations and executor options; build/simulate new-route fund+reserve quote/send and enumerate every payee | Exact commands, fees, packet, GUID/nonce expectations, custody effects and adequate execution gas | No NFT movement or message submission yet; no inherited fee caps |
| 1: source reserve | Dev signs an explicitly reviewed deposit and reserve announcement; prefer an atomic fund+send PTB if the full protocol flow can be validated | Original held in new vault, generation 1, phase 1, announced; exact PacketSent GUID/nonce/payload and fee events | Never claim destination success from source receipt. Separate deposit then send leaves a custody interval and needs explicit review |
| 2: forward delivery | Three configured required verifiers attest and executor delivers Sui→BNB | Exact GUID/payload recorded in adapter, MessageApplied(kind 1, generation 1), ReserveConfirmed(1), state Ready, purchasesPaused true, no owner/token minted, canPlay false | A forward-only acceptance gate; does not prove BNB→Sui or permit a sale |
| 3: private acquisition | Separately approve controller unpause, exact 25-USDT allowance to the new pass, and the initial buyer's buy | Exactly 25 USDT reaches unchanged treasury; token 1 belongs to admin/initial buyer 8789; state Active | Contract canPlay becomes true here. Live Arcade policy remains disabled. This is a real private purchase, not a free mint or a public sale |
| 4: redemption lock | Current BNB owner requests redemption to exact dev Sui address 45c4; re-pause purchases as reviewed | State Locked, deterministic request/recipient, canPlay false before any cross-chain release | Lock first. No cancellation/unlock/admin withdrawal function exists |
| 5: return delivery | Quote then send kind 2 on BNB; source gas plus exact native message fee | Exact Sui receive releases the original to dev wallet; phase 2, NFT absent, matching request/recipient, BNB remains Locked | A source MessageSent is not proof of Sui release |
| 6: burn acknowledgement | Quote/send kind 3 on Sui | BNB acknowledges same generation/request/recipient, state Retired, token burned, canPlay false | NFT already returned; missing acknowledgement leaves pass Locked, never playable |
| 7: close generation | Quote/send kind 4 on BNB | Sui authenticated completion, phase 3 and empty; BNB Retired; original dev-owned | Only then is another funding generation eligible; no automatic re-fund |

Stages 1–2 require NFT custody but no purchase. Full round-trip validation requires
stages 3–7 under the deployed lifecycle. There is **no direct admin withdraw** in
the current package. Upgrade authority is retained, but an upgrade is a separate
reviewed intervention, not the planned routine exit. Do not treat pause as a
withdrawal/recovery operation or as a way to make an Active contract pass invalid.

## Fee review before live approval

For each future signature present chain, sender, destination, exact action, max
gas, max native message fee, total maximum and non-native spend. Refresh quotes
immediately before signing; compare already-spent fees plus all remaining
approved maxima against any explicitly agreed combined budget. No unlimited
USDT allowance; no changes to the existing treasury. Price is exactly 25 USDT
(25×10^18 units), plus chain gas. Any residual allowance must be reconciled.

The first reserve fee cannot be quoted through the empty vault without a
simulation-scoped fund. Implement that complete quote path against the new IDs,
current protocol worker objects and three required verifiers. Check send events,
all fee recipients, packet serialization and executor gas. Do not copy retired
application objects, old packet version, old routes or historical fee caps.
Future acknowledgement/return fees depend on their actual lifecycle state; quote
and bound them at their reviewed stage. Expired/changed quotes stop signing.

## Recovery and evidence gates

- Save the transaction digest/hash before submission; uncertain outcomes require
  receipt lookup, never blind re-signing or a new deposit. Check canonical receipts.
- Save GUID, source/destination EIDs, peer, route, NFT ID, generation, nonce,
  message hash, options, exact fees and relevant checkpoint/block for each leg.
  Track verifier and executor stages separately; only destination contract state
  plus matching events proves application delivery.
- If a packet is verified but execution fails, diagnose gas/options/application
  failure and prepare exact supported executor retry. Do not change the peer or
  lower verification requirements as a shortcut. An unavailable required verifier
  delays progress; there is no promised delivery deadline.
- Source resends create new packet nonces/GUIDs and charge fees even for the same
  lifecycle payload. Lifecycle deduplication does not make retries free. Reconcile
  both chains before choosing a retry and approve its fee separately if needed.
- Before the purchase, a delayed reserve leaves the NFT in custody and no minted
  pass. After redemption lock, delays leave a non-playable Locked pass. After NFT
  release but before burn acknowledgement, pass stays Locked. After burn but
  before final completion, Sui must not allocate another generation.
- Never use Endpoint skip/nilify/burn, admin-upgrade recovery, substitute NFT,
  manufactured delivery, or the retired trial route without a separate concrete
  review. Local Endpoint impersonation in tests is not real delivery evidence.

## Reproduction and next work

Node 24; root `npm ci --ignore-scripts` and
`npm ci --ignore-scripts --prefix contracts/bnb-generation`.

```
node --use-env-proxy contracts/nftree-generation/scripts/review-delivery-gates.mjs /tmp/new-delivery-review
npm test --prefix contracts/bnb-generation
```

Next implementation: read-only new-route funding-plus-reserve quote/send
simulations with complete effects/payee checks, receiver execution-budget proof,
and a concrete private round-trip recovery proposal. Only after those are
reviewable request the necessary additional live authorizations. Any eventual
signing page stays under https://tree-token.xyz/play/. No deployment or website
change is needed for this planning milestone. Preserve current production in full.

MystenLabs/skills README was refreshed at commit
`a384d9a158c4639f075ad3f6644d925108ddfc78`. Applicable PTB/data-access skills and
building/commands/GraphQL references from the current session informed the
checked simulation; the project's pinned SDK and query-only transport remain.
