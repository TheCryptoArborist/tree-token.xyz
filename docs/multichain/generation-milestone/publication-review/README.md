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
