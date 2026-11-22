# Generation custody milestone — source only

Cloud worktree: `/workspace/tree-bnb-generation`, branch
`feat/bnb-generation-custody`. GitHub is the durable source of truth; no Windows
checkout is involved. Baseline main is `462ff86a7b120f3c89bc9a24eccc46fbac8a491f`.
The initial clone and isolated worktree were clean; all five required guidance
files are tracked. No reset or existing-file deletion was used.

## Boundary

New packages only. The retired original trial, its contracts/routes and the
published BNB login/backing inspector remain unchanged. No site build, deployment,
NFT deposit, public sale or gameplay activation is authorized by this milestone.
Existing Sui authentication, payments, games, scoring and tournaments are preserved.

The candidate remains original NFTree #2720, exact object ID
`0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba`.
Type and fresh ownership/reference must be revalidated before any later deposit.
An old inventory observation is not deposit approval. Admission stays at one ID.

## Design in progress

One singleton Sui registry creates one typed custody object. Deposit and generation
allocation are atomic. The route/BNB adapter is immutable once bound. Token ID is
the monotonically increasing generation. A four-message protocol covers reserve,
redemption, release acknowledgement and BNB retirement confirmation. Sui may not
reuse an NFT after release until authenticated retirement confirmation arrives.
Pending requests never time out into playable/unallocated states. Identical
messages are idempotent; changed identities and stale generations fail closed.
Pauses stop allocations/sales, not redemption completion.

## Guidance

Fetched MystenLabs/skills at `a384d9a158c4639f075ad3f6644d925108ddfc78` before
technical decisions. Read README; sui-move (including move.md), sui-move-project,
object-model (ownership/transfers), move-security (access-control/best-practices),
move-unit-testing and sui-build-test guidance. Repository-pinned compiler/dependency
APIs take precedence over newer advisory examples. No wallet SDK migration.

## Remaining work

- Implement new Move custody/generation lifecycle and BNB pass/adapter.
- Execute real Move and EVM tests, including adversarial/retry/generation cases.
- Record reproducible setup/results and protocol/trust limitations here.
- Review diff for production preservation; push and open a reviewable PR.
- Later reviewed milestones: governance and route configuration, fresh mainnet
  identity/simulations, user-signed publication/deposit, and isolated access integration.
