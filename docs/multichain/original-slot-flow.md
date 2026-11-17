# Original NFTree #2720: empty slot signing page

The isolated `/play/multichaintest/original/slot/` page creates the single empty
Vault from the already published original-NFT package. It does not deposit,
transfer or mint an NFT, configure BNB, or enable purchases. The actual Vault ID
is available only after the user's signed receipt is independently verified.
Simulation-created IDs must never become immutable BNB constructor bindings.

## Reviewed intent

The dev wallet ending 45c4 calls the published package's
`vault::create_slot<original collection::NFT>` with just the shared Registry and
dev-owned AdminCap. The original NFT is not an input. The Registry cap moves into
the new shared Vault; the AdminCap stays dev-owned (its Lamport version can change).
The package's compatible upgrade authority remains in the dev wallet.

The page verifies Sui mainnet genesis, exact original publication bytecode and
bindings, current Registry/OApp/cap content, and NFT ownership before simulation.
The wallet gets an unbuilt intent and selects gas. The displayed net gas is an
estimate; the 0.1-SUI preflight estimate ceiling is not a fixed wallet gas budget.
Every signature attempt repeats preflight. Wallet/network/review epochs, two-minute
quote expiry, changed gas, cross-tab Web Locks, and persisted pending/receipt
state prevent stale or duplicate handoffs. Ambiguous responses retain the pending
guard. Receipt recovery verifies exact effects and a fresh empty, unbound Vault
with canonical backing and route, before clearing the pending guard.

`original-trial/slot-browser-preflight.json` records the fresh unsigned mainnet
check. Fourteen new tests cover exact intent, altered effects/state, receipt
recovery, storage failures and wallet coordination. The focused regression suite
passed 215 tests. Source and browser bundle are compared in CI.

## Additive release

Capture current locked deploy `6afc9ba2a979535dc510438e`: 580 static paths,
49 full backend package/provider/runtime records and five schedules. Add only
three slot-page files; preserve every existing path and byte, all runtime and
environment configuration, and backend identities. The release script waits for
all queued Git builds, validates the new candidate and its module import closure,
then publishes by locking the new candidate. Expected static total: 583.
No historical snapshot build or older deployment restore is part of this release.

## Next authorized user action

In Brave/Slush, connect the dev account, simulate, review and separately approve
empty-slot creation. Return the digest for verification. No NFT deposit or BNB
transaction is authorized by this page. Subsequent BNB deployment must use the
actual confirmed Vault ID as route and published package CallCap identity as peer,
not the shared OApp ID. The one-original trial remains separate from reconciling
the entire 5,000-NFT inventory.

## Live Mysten guidance consulted

The current repository README was checked before this work. Applicable files:

- https://github.com/MystenLabs/skills/blob/main/frontend-apps/SKILL.md
- https://github.com/MystenLabs/skills/blob/main/frontend-apps/transactions.md
- https://github.com/MystenLabs/skills/blob/main/ptbs/SKILL.md
- https://github.com/MystenLabs/skills/blob/main/ptbs/building.md
- https://github.com/MystenLabs/skills/blob/main/accessing-data/graphql.md

The existing pinned Sui SDK and wallet vendor integration are reused unchanged.
