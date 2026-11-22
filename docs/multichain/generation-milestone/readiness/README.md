# Pre-deployment readiness review — unsigned only

This is the next step after contract implementation. PR #280 remains the source
review; nothing here merges it, publishes a contract, deposits an NFT or activates
sales/gameplay. The automated code review of contract commit `2a29a4c` reported no
findings. All implementation checks passed on `48a091a`. This assessment does not
replace independent contract/security review.

## Completed simulations

On November 21, 2026 at 21:10 America/Chicago (03:10 UTC November 22), Sui mainnet
GraphQL successfully simulated the exact release build and a native type probe.

- Publication: **69,723,600 MIST (0.0697236 SUI)** estimated net gas. No gas spent.
- Creates exactly six objects: new package, empty shared Registry, shared OApp,
  vault AdminCap, OApp AdminCap and UpgradeCap. All three capabilities remain with
  the designated dev wallet ending `45c4` in this **baseline simulation**.
- The publication PTB contains only Publish and transfer of its UpgradeCap to that
  wallet. No original collection capability or NFT is an input/effect.
- Native `type_name::with_original_ids` with the actual mainnet NFTree type returns
  the exact string enforced by the new custody package. This confirms runtime type
  identity; it is not a deposit or a substitute for an exact-type slot/deposit
  simulation against subsequently published new objects.
- Before/after checkpoint reads confirm #2720's exact ID, type, version, digest and
  direct dev-wallet ownership remained unchanged.

**All IDs created in these outputs are ephemeral simulation identities.** They are
not published package/registry/OApp IDs, must not be copied into BNB constructor
arguments, and must never be used to construct a deposit. No transaction bytes,
wallet button, signer, or submission path is supplied here.

Evidence: `publishResult.json`, `nativeResult.json`, `summary.json`. Pinned release
bytecode: `../publication-bytecode.json`; its SHA256 must match
`../validation.json`, and CI reproduces it with the pinned compiler. The simulation
estimates can change and expire; fresh evidence is required before wallet approval.

## Governance assessment

| Authority | Current source behavior | Pre-funding decision |
| --- | --- | --- |
| New Sui UpgradeCap | Baseline publication retains it with dev; compatible upgrades can change custody logic | Choose immutable package before funding, or explicitly reviewed upgrade custody/policy; do not describe current source as immutable |
| Vault AdminCap | Controls slot creation, fixed peer binding and deposit/reserve pause; cannot withdraw or change admission | Dev custody in current init; key-only cap has no transfer/rotation function. Multisig custody would require a reviewed source change before publication |
| Sui OApp AdminCap | Controls mutable peer/options; vault cross-checks the fixed peer, but incompatible changes can halt completion | Dedicated reviewed custody/configuration policy; preserve exit availability and ability to raise gas |
| BNB binder/controller | Deployment sender binds pass once, controls purchase pause and raises receive gas; also the initial permitted buyer | Select deployment authority before deployment; these identities are immutable and lack controller rotation |
| BNB endpoint delegate | Initially set to deployment sender; endpoint configuration influences message trust/availability | Independently review and verify delegate, libraries, DVNs and executor policy |
| Original collection caps | Neither publication nor generic custody needs MintCap or collection UpgradeCap | Leave original collection authority unchanged |

Recommendation: approve an explicit governance policy **before** publishing/funding.
An immutable custody package removes unilateral custody-code upgrades, but does not
remove OApp/endpoint configuration risk or solve lost-key recovery. If a multisig
or rotatable controller is required, implement and test that support now; the
current fixed-dev/immutable-controller design cannot be described as already
providing it. No choice is silently made by this simulation.

## Route setup order and gates

1. Review/merge source separately from any deployment. Resolve governance and
   regenerate/simulate the exact final build and capability effects.
2. User-approved new Sui publication; independently verify actual package bytes,
   created object types and capability owners. Create the one canonical typed slot
   with the exact original collection type and verify its Registry relationship.
3. Deploy the **new** BNB adapter against the actual new Sui package peer and Vault
   route, then deploy/bind its new pass. Verify runtime hashes, chain 56, endpoint
   EID 30102, Sui EID 30378, token/currency/treasury and reciprocal binding.
4. Configure and verify both message paths, receive-library security, DVNs,
   executor settings, minimum execution gas and zero native receive value. A nonzero
   peer alone proves neither counterpart deployment nor route security.
5. Verify all four message directions and failure/retry recovery in an isolated
   acceptance environment. Keep purchases paused and gameplay disabled.
6. Refresh original collection package resolution/bytecode, #2720 ownership and
   reference, and USDT identity. Simulate the exact **one-NFT** deposit into the
   actual new Vault, then present effects/fees for separate wallet approval.
7. Only after verified custody/reserve and a separate review, allow the designated
   controlled purchase/transfer/redemption test. Public sale and live game access
   remain separate milestones.

No old trial address/route is an acceptable substitute at any step. No full-collection
admission is allowed while inventory reconciliation remains incomplete. No Netlify
production release is part of this readiness work.

## Reproduce safely

From repository root with the existing pinned root dependency lock:

```sh
npm ci --ignore-scripts --cache /workspace/npm-cache
node --test contracts/nftree-generation/scripts/readiness.test.mjs
node --use-env-proxy contracts/nftree-generation/scripts/simulate-readiness.mjs /workspace/new-readiness-output
```

Use a new output directory each time. `--use-env-proxy` is for cloud environments
whose HTTPS access uses proxy variables (Node 24). The wrapper admits only GraphQL
queries to the pinned mainnet endpoint and rejects execution mutations before
network access. It never loads keys or invokes a signing/execution API.

Seventeen tests validate the actual saved simulation response and reject changed
bytecode/dependencies, extra commands/inputs, NFT effects, capability recipients,
wrong sender/gas owner, unexpected payments, high gas, wrong types, stale candidate
observations and submission attempts. Existing 52 Move and 16 EVM tests are unchanged.
Current Mysten README/skills revision is still `a384d9a158c4639f075ad3f6644d925108ddfc78`;
publishing and PTB command/building references were read for this step, in addition
to the previously recorded Move/security/data guidance. SDK remains locked at 2.26.1.
