# One original NFTree — custody draft

This is a source-and-simulation milestone, not a deployed vault or an open sale.
Publication is restricted to the existing Sui dev wallet ending `45c4`. Init creates
one shared Registry and one LayerZero OApp, with new vault/OApp admin capabilities
and the new package UpgradeCap retained by that wallet. No original NFT or original
collection capability is a publication input.

The Registry fixes the canonical collection type and original NFTree #2720 object
ID. It can create exactly one `Vault<T>`; a runtime native type-name comparison
rejects every other type, and funding checks the exact object ID. Generic custody
avoids recompiling or upgrading the original collection. The real mainnet native
type-name simulation confirms the exact canonical type string. Other NFTs of the
same type also fail the ID check.

The one-shot lifecycle is Unfunded (0) → Funded (1) → Released (2). Peer binding is
required before funding. No reset, second slot, arbitrary withdrawal, public NFT
constructor, mutable UID exposure, or backing-ID setter exists. A second deposit
or source announcement aborts. Binding installs type-3 receive options with
200,000 gas for reserve and acknowledgement message types. Both quote and send
combine the administrator-enforced options with caller extras. Empty enforced
policy and malformed extras abort before a one-shot send can be consumed.
The paired BNB contract must still be profiled before funding; the administrator
can raise its configured minimum. A release requires the standard OApp/CallCap
endpoint authorization and exact BNB EID, fixed peer, protocol version, route,
backing NFT ID, nonzero request and recipient. Identical delivery is idempotent;
changed request/recipient abort. Source acknowledgement can be sent once and
records the same fixed request/recipient. No time-based unlock exists.

An admin pause stops funding and reserve announcement; it does not block a valid
release or its acknowledgement. The admin capability is tied to the Registry.
The current source has no admin withdrawal entry; **the new package UpgradeCap
remains upgrade authority**. Upgrade governance must be explicitly reviewed
before real funding. No claim of immutable governance or independent audit is made.

## Protocol boundary

Messages are exactly 130 bytes, using a new **wire version 2**. Byte offsets:

| Offset | Length | Value |
| --- | --- | --- |
| 0 | 1 | Version 2 |
| 1 | 1 | Kind: 1 reserve, 2 redemption, 3 release acknowledgement |
| 2 | 32 | Unique vault route/object ID |
| 34 | 32 | Original NFT object ID |
| 66 | 32 | Request ID (zero for reserve) |
| 98 | 32 | Sui recipient (zero for reserve) |

This draft is deliberately incompatible with the completed disposable version-1
adapter/pass. A new BNB counterpart and new route are required. This route never
reuses a released slot, so it does not implement generation changes or migration
between chains. A larger inventory or reusable registry needs a separately tested
protocol/registry design. The 18 unaccounted original serials remain outside this
one-ID admission rule and block full-collection approval.

## Build and verification

Compiler: official Sui `1.83.1-6a567faf6de1`. Sui/MoveStdlib revision is locked in
Move.lock. Vendored LayerZero source, manifests, mainnet bindings, provenance and
license are retained under `../vendor/layerzero-sui`; its 33 source modules are
unchanged from the previously inspected pilot dependencies. No upstream runtime
or test helper was modified.

From this directory, developer/CI commands are:

```
sui move test --build-env mainnet
sui move build --build-env mainnet --dump-bytecode-as-base64 --no-tree-shaking
```

`--no-tree-shaking` permits reproducible offline output; the mainnet GraphQL
simulation separately verifies the emitted dependency bindings. This is not a
wallet migration or user instruction to install a CLI. The CI-only config helper
refuses local execution and any existing wallet config; its keystores are empty.

36 Move tests pass. Tests use locally created fixture NFTs, test registries with
fixture identity, synthetic endpoint capabilities and a fixture announcement
state. Additional tests exercise the actual source send guards. These establish
custody/state/authentication-boundary behavior, **not real DVN verification,
worker fee handling or complete endpoint/ULN dispatch**. Existing upstream
`confirm_lz_send` must consume a properly completed Call in the real send PTB;
fixture Call destruction is test-only and not a deployable sending recipe.

The release disassembly and build checks prove fixture constructors/bypasses are
absent from mainnet bytecode. Five JS checks validate the unsigned publication and
reject changed bytecode, dependencies, recipients, NFT effects, extra calls or
non-SUI payments. The complete local JS regression run passed 215 checks.

## Mainnet simulation and remaining execution work

Saved evidence is in `../../docs/multichain/one-slot-vault/`. The unsigned
publication simulation passed, with estimated net gas **59,767,600 MIST**
(0.0597676 SUI). No gas was spent. It creates the new package, empty Registry,
OApp and three dev-owned capabilities. Only the simulator's SUI gas accounting
changes; NFTree #2720 is not a transaction input/effect. Its current owner/type
were independently read on mainnet. Native type resolution also passed.

All object IDs created by simulation are **ephemeral simulation identities**, not
published bindings; never use them to deploy or configure a BNB counterpart.
`publication-unsigned.json` is review-only and has signing disabled. There is no
funding transaction ready to sign: an unpublished vault cannot yet be a genuine
mainnet deposit target.

The paired BNB version-2 adapter/pass and purchase/transfer/redemption tests now
live in `../bnb-one-slot/`. Its golden messages match this Move codec byte for byte.
The endpoint peer is the original published package identity used by the package
CallCap; it is distinct from the shared OApp object ID and the shared Vault route ID.

Before offering funding: complete paired-contract review; review upgrade governance;
then publish and verify actual source/destination contracts, create the fixed
slot, verify generic-NFT receive metadata and all endpoint/DVN/executor/peer
settings on the new route, refresh NFT ownership, and simulate the exact one-NFT
deposit. A nonzero bound peer alone is not proof that the BNB contract exists or
that route security is configured. No sales or live game access are enabled by
this milestone. User signs each actual transaction in their own wallet.

Current MystenLabs guidance read live: README, sui-move/SKILL.md, sui-move/move.md,
sui-move/events-coins.md, sui-move-project/SKILL.md, sui-build-test/SKILL.md,
move-unit-testing/SKILL.md, object-model/SKILL.md, object-model/transfers.md,
object-model/patterns.md, move-security/SKILL.md, move-security/access-control.md,
move-security/best-practices.md, modern-move-syntax/SKILL.md,
naming-conventions/SKILL.md, ptbs/SKILL.md, ptbs/building.md, ptbs/commands.md,
accessing-data/SKILL.md and accessing-data/graphql.md. Advice was checked against
the pinned compiler, SDK and protocol source. The live arcade and its production
functions/schedules are not modified by this branch.
