# Empty publication review packet

This is a **proposed unsigned review**, not approval or a deployed package. The
saved `packet.json` is historical simulation evidence and a regression fixture;
it expires after two minutes and must be regenerated before a future wallet review.
Nothing here signs, submits, deposits, binds a route, sells a pass or activates games.

## Concrete proposed effects

- Publish the two pinned release modules and create the empty Registry and OApp.
- Keep the new vault AdminCap, OApp AdminCap and UpgradeCap in dev wallet
  `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- **Retain upgrade authority for the private pilot.** This is a proposed policy,
  not an immutable package or a previously recorded user governance approval.
- Pay SUI gas from that wallet: fixed budget 100,000,000 MIST (0.1 SUI).
  Saved simulation estimate: 69,723,600 MIST (0.0697236 SUI).
- No original NFT input or effect, slot creation, peer binding or application change.

The packet includes the JSON transaction blueprint and transaction-kind bytes,
not fully resolved signable transaction bytes. Gas references/price still need
fresh resolution. The kind hash does not cover gas or sender; the verifier checks
the full JSON blueprint separately. Never paste simulation-created IDs into a
BNB constructor or treat this file as proof of a deployed contract.

## Reproduce in Codex Cloud

Use Node 24 and the committed root lock (`npm ci --ignore-scripts`). From repo root:

```sh
node --use-env-proxy contracts/nftree-generation/scripts/prepare-publication.mjs /workspace/new-publication-review.json
node --test contracts/nftree-generation/scripts/*.test.mjs
npm ci --ignore-scripts --prefix contracts/bnb-generation
node --test contracts/bnb-generation/test/wallet-preflight.test.mjs
```

The output file must not already exist. Fresh preparation queries the candidate
before and after checked publication simulation. It requires unchanged exact
#2720 identity and direct dev-wallet ownership, fresh checkpoints, the pinned
mainnet chain, matching modules/dependencies, only expected object effects and
capability owners, and bounded gas. `verifyPacket` additionally rejects wrong
wallet/network, expired evidence, altered commands, bytes, budget and policy. It
returns a newly constructed pinned blueprint, never the caller's transaction.
Simulation evidence is trusted RPC output, not a cryptographic attestation;
a future signing flow must obtain it afresh, not accept untrusted uploaded JSON.

BNB `verifyWalletIntent` checks chain 56, all selected deployment roles and the
unchanged treasury against source. It deliberately reports `deploymentReady:false`:
it does not verify deployed code, source bindings, endpoint configuration or
hardware custody. No BNB deployment transaction is prepared before actual new
Sui publication and canonical Vault verification.

## Validation and remaining steps

36 local tooling tests pass (17 existing readiness, 15 packet, 4 BNB intent).
The fresh mainnet simulation succeeded with checks and gas selection enabled.
Contract source/bytecode is unchanged; earlier 52 Move and 16 EVM tests remain
recorded in the milestone validation. CI now runs the new tooling tests too.
Current Mysten skills revision remains
`a384d9a158c4639f075ad3f6644d925108ddfc78`; publishing and PTB guidance was applied
against the pinned SDK. No production file or application runtime was changed.

Remaining: review source PR and explicitly resolve retained upgrade authority;
prepare the wallet signing handoff with freshly verified full transaction effects;
obtain separate user approval/signature for empty publication; verify actual
published bytes/owners; create and verify the canonical empty slot; then prepare
BNB adapter/pass deployment with the selected Ledger-described admin. Route
security, lifecycle acceptance, renewed candidate verification and a separately
approved one-NFT deposit follow. Public sales/gameplay remain disabled.

## Complete unsigned wallet handoff

`wallet-handoff.json` adds complete BCS transaction bytes, including sender, gas
price/budget and validity. These exact bytes were simulated with checks enabled
and **gas reselection disabled**; the returned transaction BCS must match byte for
byte. This closes the gap between the earlier kind-only blueprint and a concrete
transaction. Nothing is signed or submitted. This saved evidence is already stale
for signing purposes; it is a regression fixture, not a wallet import invitation.

Regenerate immediately before a separately approved wallet review:

```sh
node --use-env-proxy contracts/nftree-generation/scripts/prepare-wallet-handoff.mjs /workspace/new-wallet-handoff.json
```

The pinned SDK resolves address-balance SUI gas with no owned gas-coin inputs and
a `ValidDuring` expiration bound to mainnet and two consecutive epochs. The
verifier requires that shape and the simulation epoch inside that window. The
stricter two-minute review expiry is an application check, not a chain-enforced
two-minute deadline. A future wallet integration must preserve the exact bytes,
check the connected dev address and `sui:mainnet`, obtain fresh trusted evidence,
and compare wallet output to the reviewed bytes. Wallet compatibility with this
transaction form has **not** been tested. No wallet UI or signing method has been
connected, and private keys must not be imported into this Cloud workspace.

A changed gas price, budget, payment, sender, command or validity requires a new
checked simulation, not reuse of this evidence. `verifyHandoff` checks the full
BCS against the simulation and reconstructs it only after wallet, chain,
freshness, candidate and capability checks. RPC evidence remains trusted data,
not an independently signed attestation. `authorized:false` and
`submitted:false` accurately describe preparation, not authority to execute.

Validation: **52 tooling tests pass**, including 16 new full-byte handoff tests.
The fresh exact-byte simulation succeeds, estimates 69,723,600 MIST, and leaves
#2720 unchanged. The previous commit `9f5ebfa` passed both contract CI runs,
legacy vault tests and production-snapshot checks. Source contracts and pinned
bytecode remain unchanged in this step.

### Decision needed before live work

Review proposal: publish only the empty new package from the selected Sui dev
wallet with a maximum 0.1 SUI gas budget; retain its new UpgradeCap, vault AdminCap
and OApp AdminCap in that wallet for the private pilot. Retaining UpgradeCap means
that wallet can upgrade compatible custody logic; this is not immutable custody.
This approval would cover only empty publication, not NFT deposit, BNB deployment,
route activation, sales or gameplay. The original user scope reserved live
deployment for a subsequent reviewed milestone, so preparation does not supply
that approval. After explicit approval, a compatible wallet-signing surface and
fresh simulation are still required; verify the actual transaction effects and
published bytes before progressing to canonical slot creation.


## User approval received

The user explicitly approved the empty-publication proposal after commit
`37e4449`. [Approval record](../publication-approval.json) records the exact scope,
retained capabilities, 0.1 SUI maximum gas budget and exclusions. This supersedes
the pending approval status above; **do not request that approval again**.
All contract, vault and production-preservation checks passed at that head.
A fresh exact-byte simulation also passed after approval.

Publication still awaits the user's wallet signature. No Sui blockchain signer
is exposed by the connected tools, and no wallet app/device has yet been identified
for this handoff. Do not import a seed/private key into Cloud. The preparation
packet's `authorized:false` is a legacy preparation-only marker; conversation
authority is recorded separately here, not inferred from uploaded packet fields.
Historical packets remain expired evidence. Regenerate and verify once the wallet
surface is ready, obtain the user signature there, and verify actual publication
effects before recording any real package IDs.
