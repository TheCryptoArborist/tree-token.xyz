# Generation custody milestone — source only

Cloud worktree: `/workspace/tree-bnb-generation`, branch
`feat/bnb-generation-custody`. GitHub is the durable source of truth. Baseline
main: `462ff86a7b120f3c89bc9a24eccc46fbac8a491f`. The clone and isolated worktree
started clean; the remote is `TheCryptoArborist/tree-token.xyz`, and all five
requested guidance files are tracked and were read. No reset or local-file
replacement was used. The Windows checkout has not been accessed.

## Scope and preservation

New packages: `contracts/nftree-generation` and `contracts/bnb-generation`.
The completed one-slot trial contracts, peers and route are unchanged. Published
BNB authentication and read-only backing diagnostics still deny gameplay.
No site build, deployment, deposit, public sale or gameplay activation is part
of this milestone. Existing Sui authentication, TREE payments, games, scoring,
tournaments, frontend and backend packages are unchanged. The historical root
build must never replace production. Any future website release requires a fresh
complete live inventory under the newest production/README.md instructions.

## Custody and admission

`Registry` is created once in package initialization and may create exactly one
`Vault<T>` record. It pins the canonical original collection type and exact ID:
`0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba` (#2720).
Native `type_name::with_original_ids<T>()` rejects substitutes; the deposit checks
the exact object ID. A serial/artwork match cannot authorize a different NFT.
There is no admission setter, extra slot, alternate-chain allocation entry,
collection mint operation, arbitrary withdrawal, mutable UID exposure or reset.
The 18-serial inventory gap remains unresolved and prevents expansion.

The Registry-to-Vault link identifies the canonical allocation record. Its
`(backing, generation, destination=30102, peer, tokenId=generation)` binding is
stored in typed custody, not in a hypothetical EVM registry. The single shared
Vault serializes every allocation; another chain cannot allocate independently.
The BNB peer and route are fixed after binding. Future chain expansion needs a
separate reviewed design using the same global backing inventory.

An owner deposits the approved NFT **by value**, without a collection capability
or administrator signature. Sui object ownership authorizes that input; neither
an administrator nor another wallet can pull it from its owner. Deposit and
monotonic `u64` generation increment are one atomic operation. Checked overflow
aborts rather than wrapping. Only Empty or Completed permits deposit. Initial
publication remains restricted to the designated dev wallet, consistent with the
one-ID trial scope; nothing in this source authorizes that publication now.

## Protocol v3

Messages are exactly **138 bytes**, fixed-width, network byte order:

| Offset | Bytes | Field |
| --- | --- | --- |
| 0 | 1 | Version 3 (v1/v2 rejected) |
| 1 | 1 | Kind 1 reserve, 2 redeem, 3 released, 4 retired |
| 2 | 32 | New Sui Vault object ID / route |
| 34 | 32 | Exact original NFT ID |
| 66 | 8 | Generation; also the ERC721 token ID |
| 74 | 32 | Redemption request; zero only on reserve |
| 106 | 32 | Fixed Sui recipient; zero only on reserve |

Golden vectors are in `contracts/bnb-generation/fixtures/wire-v3.json`; Move and
EVM tests compare the same bytes, including a multibyte generation.

1. Sui holds the approved NFT and allocates generation `g`, then sends reserve.
2. Endpoint/peer-authenticated reserve makes BNB generation `g` Ready. It must be
   exactly the next generation, after no prior pass or a Retired pass. Matching
   retries are no-ops in Ready, Active, Locked and Retired; they never reactivate.
3. Every generation starts purchases paused. The controller can permit only the
   initial designated buyer to pay **25 USDT** to
   `0xC440F06BBC7e58b0d055815f915447e4ae0E3720`. Currency is fixed at
   `0x55d398326f99059fF775485246999027B3197955`, 18 decimals. Deployment and each
   purchase verify decimals; purchase also checks the captured runtime hash and
   exact treasury balance delta. Short/false transfers and receiver rejection
   revert the entire mint/payment. No public checkout exists.
4. The current ERC721 owner can transfer the Active pass or request redemption.
   Approved operators cannot redeem. Redemption atomically fixes the Sui recipient
   and request and locks the pass. Locked passes cannot play, transfer or unlock.
5. Anyone can sponsor authenticated kind-2 delivery, with the fixed request and
   recipient. Sui releases the exact NFT once, but **keeps the generation allocated**.
6. Sui sends kind 3; BNB verifies the locked generation/request/recipient and burns
   the pass. Duplicate acknowledgements are idempotent.
7. BNB sends kind 4 **only after retirement**. Sui checks its authenticated origin
   and exact released record, then marks Completed. Only now can the current
   original owner deposit again, creating `g+1`. Sending kind 3 alone never permits
   reuse. Old generation messages fail even when their GUID was previously seen.

There are no timeouts, refunds, cancellation or admin retirement shortcuts.
Delayed/lost messages leave the pass Locked or the source allocation pending,
never playable or reusable. Fixed-payload sends are retryable. Pauses stop deposits,
reserve sends and purchases; they cannot stop release, acknowledgement or
retirement confirmation. Receive gas may be raised for recovery. Source options
are validated for sufficient gas, supported format and zero native receive value.

`canPlay` is a contract lifecycle predicate used in tests. It does **not** activate
Arcade access. Later server integration must revalidate current owner, both
reviewed deployments, source custody/allocation and authenticated session at each
protected action. No prior-owner session or cached eligibility can authorize it.

## Security assumptions and limits

These are tests of the application contracts, not an independent audit or proof
of LayerZero DVNs. Production authorization uses the existing vendored OApp/CallCap
boundary on Sui and the fixed endpoint + EID + peer on BNB. Retry ordering is handled
by generation/state transitions, not hardcoded transport nonces. EVM GUID collisions
with changed payloads fail. A route-security or upgrade-authority compromise is
outside that assumption and must be addressed before funding.

Move unit tests create local NFT values and test-only registries to exercise real
resource custody and transfer. The production constructor separately rejects the
fixture type. They do not fabricate an original-collection mint or claim execution
with a real mainnet NFT. The current original type/owner is independently observed
on mainnet; exact-type unpublished-package/deposit simulation remains a later gate.
The send/retry tests execute endpoint/channel/Call confirmation with a synthetic
fee library. Inbound endpoint capabilities and EVM endpoint/currency contracts are
fixtures; real ULN/DVN/executor delivery and fees remain untested here.

The Sui UpgradeCap and OApp administrative controls remain privileged. No immutable
upgrade governance, cap recovery/rotation, refunds or public-sale readiness is
claimed. BNB contracts have no upgrade or emergency withdrawal entry, but endpoint
configuration/delegate authority still matters. Currency codehash checks cannot
guarantee immutable behavior behind a proxy; independently verify the actual USDT
implementation and chain configuration before deployment.

## Reproduce in Codex Cloud

Use a fresh clone/worktree; preserve any existing checkout before switching.
Node 24, Python 3, Git, curl and tar are sufficient. Commands from repository root:

```sh
npm ci --ignore-scripts --prefix contracts/bnb-generation --cache /workspace/npm-cache
npm test --prefix contracts/bnb-generation
npm run compile --prefix contracts/bnb-generation

mkdir -p /workspace/generation-tools
curl -fL --retry 2 -o /workspace/generation-tools/sui.tgz https://github.com/MystenLabs/sui/releases/download/mainnet-v1.83.1/sui-mainnet-v1.83.1-ubuntu-x86_64.tgz
echo 'a54b24da3c8fd4b88522f01c8718826ae5637512ee0953469a5759408e1f701b  /workspace/generation-tools/sui.tgz' | sha256sum --check
tar -xzf /workspace/generation-tools/sui.tgz -C /workspace/generation-tools ./sui
python contracts/nftree-generation/scripts/build-config.py /workspace/generation-tools/config
export SUI_CONFIG_DIR=/workspace/generation-tools/config
export MOVE_HOME=/workspace/generation-tools/move-cache
/workspace/generation-tools/sui move test --path contracts/nftree-generation --build-env mainnet
/workspace/generation-tools/sui move build --path contracts/nftree-generation --build-env mainnet --dump-bytecode-as-base64 --no-tree-shaking > /workspace/generation-tools/bytecode.json
```

The config helper refuses a nonempty directory and creates empty keystores. Reuse
its directory on subsequent runs; do not rerun creation or point the compiler at a
user wallet. No signer is needed. Move.lock pins Sui/MoveStdlib; vendored LayerZero
sources and existing dependency locks remain unchanged. The isolated workflow
`verify-generation-custody.yml` repeats the contract tests and release builds.
Ganache's Node 24 native µWS warning falls back to its JavaScript transport.

Read-only candidate refresh (uses current GraphQL, not deprecated Sui JSON-RPC):

```sh
python docs/multichain/generation-milestone/check-candidate.py
```

It checks mainnet identity, fresh checkpoints, exact ID/type/serial, direct dev
ownership and stability across two reads. `candidate-observation.json` is evidence
only, never deposit authorization. Refresh immediately before a later simulation
and wallet signing, including package resolution/bytecode and object reference.

## Validation and next steps

See `validation.md`, `invariants.md` and saved test output for the completed checks.
Review PR: https://github.com/TheCryptoArborist/tree-token.xyz/pull/280.
Implementation commit: `2a29a4c799d7866160fe159afc9c07a301c751ab`.

Remaining reviewed milestones:

- Review source and tests, including upgrade/cap/delegate governance and recovery.
- Refresh canonical collection package/type, original ownership/reference, USDT
  identity and route security. Simulate the exact new publication and deposit;
  show all objects, capability effects and fees before wallet approval.
- Publish new contracts/route only after review; independently verify bytecode,
  endpoint libraries, DVNs, executor settings and mutual peer/pass bindings.
- At most one user-approved deposit and controlled purchase/transfer/redemption
  acceptance on the new route. No old vault/pass/route reuse.
- Separately review public sales, larger inventory, refunds/cancellation and
  gameplay integration. The published inspector remains deny-only until then.
- When moving the branch to Windows later, first inspect and preserve its local
  changes; fetch and create an isolated worktree rather than resetting anything.

## Guidance provenance

Before technical decisions, fetched MystenLabs/skills README at
`a384d9a158c4639f075ad3f6644d925108ddfc78`. Read sui-move (move.md,
events-coins.md), sui-move-project, object-model (ownership.md, transfers.md,
patterns.md), move-security (access-control.md, best-practices.md),
move-unit-testing, sui-build-test, sui-install and accessing-data (graphql.md).
Advice was checked against the pinned compiler/dependency source. Repository and
user instructions govern scope: pause never strands redemption, and there is no
wallet/SDK migration or production release in this milestone.

## Next-step readiness work

The [unsigned readiness review](readiness/README.md) records successful mainnet
publication/type simulations, exact capability effects, governance decisions and
new-route sequencing. This does not authorize or prepare a live deposit. Its
simulation-only tooling has 17 guard tests and no signing/submission path.


BNB wallet selection is recorded in `selected-wallets.json`: administration is
`0xF2Ab1eEBbEcb4E315FE95D8b532D1aB00F1A8789`; the existing treasury remains
`0xC440F06BBC7e58b0d055815f915447e4ae0E3720`. This is a deployment-preparation
input, not a deployment authorization. See the readiness review for role mapping.

## Unsigned publication handoff

[Review packet and reproduction](publication-review/README.md) records the proposed
empty publication, fixed gas budget and retained-capability policy. The saved
packet is expired evidence, not authorization. BNB wallet-intent checks enforce
the selected admin and treasury; actual deployment bindings remain pending.
