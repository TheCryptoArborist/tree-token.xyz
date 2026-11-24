# Next source milestone: generation-aware BNB access

## Decision and scope

Generation 1 completed the private cross-chain lifecycle. Its pass is burned and
cannot serve as a positive access test. The next useful milestone is source and
tests for an access reader against the actual deployed generation contracts,
followed by isolated Tree Force ’89 server integration. Do not redeploy contracts,
repeat completed messages or reopen the old trial route.

The existing `scripts/multichain/bnb-game-access-core.mjs` is a mock-tested
foundation, not an implementation for this deployment. It expects an EVM registry
address/code hash while the deployed generation Registry is a Sui object. The
published `bnb-backing-reader.mjs` deliberately inspects the retired trial and
always denies gameplay. Neither module can be enabled by changing a flag.

The source milestone must introduce a separate generation reader and policy,
leaving published authentication and trial diagnostics intact. Use the new
pass/adapter addresses and exact Sui package/registry/vault/original identifiers
already recorded in the generation evidence. Review current Mysten guidance and
the pinned SDK interfaces before implementation; no dependency migration follows
from this plan.

## Required implementation and acceptance

1. Define a trusted server policy for one explicitly approved original and
   generation, exact deployed runtime/package identity, route and mutual bindings.
   Use a real Sui registry/vault reader, never a browser-provided backing claim or
   a fictitious EVM registry. Package upgrades/configuration changes require review.
2. Pin BNB reads to a single block. Require Active state, matching generation/token,
   current ERC-721 owner and canPlay, exact bindings and accepted source route.
   Validate fresh Sui mainnet checkpoint, exact NFT type/ID held in the correct
   vault, registry-slot association, generation/phase and no pending redemption.
   Cross-chain reads are not atomic: specify an explicit freshness/recheck policy
   and fail closed on inconsistency or unavailable evidence.
3. Keep identity sessions distinct from game authorization. Bind server-created
   run/action authorization to wallet, chain, generation and expiry. Recheck
   entitlement at run creation and every paid action; do not trust cached client
   eligibility. Review in-flight run/score policy for transfer or redemption before
   implementing integration. Preserve Sui sessions and tournament rules.
4. Test Active/held success only with clearly labeled fixtures; deny the actual
   Retired generation-1 state. Cover wrong owner, transfer after login, redemption
   lock, burned token, stale generation, wrong original/route/peer, changed code,
   stale checkpoint, RPC failure, client-forged claims and replay/concurrent action
   attempts. A mock positive result is not live entitlement acceptance.
5. Add isolated server integration only after the reader review. Existing Sui
   authentication, TREE payments, score/wave behavior, games and tournaments must
   pass regression checks. USDT paid actions (including nominal one-dollar pricing,
   receipt binding, rounding and replay prevention) remain their own review.

## Later live milestones, separately approved

A read-only generation diagnostic could be published first under the canonical
`tree-token.xyz/play/` origin, still denying gameplay. Prepare it with the complete
then-current production inventory and preserve all existing static files, backend
provider/runtime records, settings and five schedules. Never deploy the root snapshot.

Positive live testing needs a separately approved generation-2 deposit/reserve
and purchase, fresh NFT identity/ownership and fee reviews, plus explicit private
gameplay activation. The completed 25-USDT purchase does not automatically buy a
new generation or refund itself. Do not request a new payment before source/tests
and a concrete live acceptance procedure are ready.

Public sales, expanded original inventory, refunds/cancellation, additional games
and tournaments are outside this milestone. Reconcile the collection inventory
before admitting more original IDs. No live activation is authorized by this plan.

## Review readiness

PR #280 was reconciled with main `6162edf`, preserving all incoming Tree Army
files byte-for-byte and both production histories. `main-reconciliation.json`
records the comparison and verification. The historical milestone index now points
to final completion evidence. This update contains no website or chain writes.
