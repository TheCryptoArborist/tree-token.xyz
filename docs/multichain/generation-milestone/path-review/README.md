# New generation path review — source and simulation only

Current continuation: the user approved the single registration transaction.
Its canonical signing handoff is now published; see
[registration-handoff](../registration-handoff/README.md). The actual signature
and registration receipt remain pending. The notes below describe the earlier
read-only review, not authorization for later configuration.

**No chain transaction was submitted, and no page or backend was deployed.** The
new BNB adapter/pass remain bound, paused and non-playable; Sui custody remains
empty and unbound. No retired trial object or route is a write target.

## Next concrete step: register the new Sui application

Fresh Sui GraphQL reads show the new package is **not registered** in LayerZero's
Endpoint registry. Registration must create its own shared messaging channel
before we can finalize a peer-binding transaction with actual object references.
The simulated channel ID is not an existing object and must never be used as an
actual binding input.

The prepared transaction contains exactly one call:

`0xc445519bf1d6ed8ab6002d20ad7ed81a9ad25e31990df9b72203d0ad86fd2e92::vault::register<original collection::NFT>`

It borrows the existing empty Vault and dev-owned Vault AdminCap, mutates the
LayerZero Endpoint, and supplies empty registration metadata. It creates only
the new application's messaging channel and registry entry. It does not bind a
peer, configure DVNs, move an NFT, mint a pass, change delegates or transfer caps.
The existing gas object/accumulator and permitted version bookkeeping are checked.

Checked mainnet simulation: **4,668,124 MIST (0.004668124 SUI)** net gas.
Proposed maximum gas budget: **20,000,000 MIST (0.02 SUI)**, paid by dev wallet
`0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4` in desktop Slush.
This is a new transaction beyond the completed three BNB deployment approvals.
It needs a fresh review and wallet approval; the saved simulation is historical,
not a reusable signing packet. Any signing page must remain under
`https://tree-token.xyz/play/`.

`registration-simulation.json` contains exact intent JSON, resolved simulated
transaction, effects, events, gas and source state. The verifier rejects altered
sender, gas budget, arguments, package, metadata, NFT mutation and cap transfer.
An existing registration fails preflight rather than creating a replacement.

## Security proposal for the subsequent configuration review

The new application has no explicit Sui library, executor or ULN settings. Live
Sui defaults include **four required operators**, including Canary; relying on
those defaults would not establish the proposed three-operator path. The current
BNB defaults and new-app state are recorded separately in `bnb-fork-review.json`.

Proposed explicit policy (not applied or approved for signing): **all three**
classic Horizen, Twinstake and LayerZero Labs operators must verify in both
directions; no optional DVNs. This follows the operator set used in the completed
round trip, but is a fresh application-specific proposal, not reuse of its route.
Current official metadata lists one active, nondeprecated, non-lzRead instance
of each selected operator per chain. Metadata does not itself prove delivery or
current operator availability. Requiring all three means any one unavailable
operator can delay delivery. Pending redemption must stay locked during delays.

| Setting | Sui → BNB | BNB → Sui |
| --- | --- | --- |
| Source send / destination receive confirmations | 5 Sui confirmations | 20 BNB blocks |
| Required operators | Horizen + Twinstake + LayerZero Labs | Same three operators |
| Optional operators | None | None |
| Maximum outbound message size | 10,000 bytes | 10,000 bytes |

Use explicit ULN302 libraries and the current LayerZero executor on each chain.
Full addresses are in `protocol-metadata.json` and `bnb-fork-review.json`.
BNB's *stored* optional-DVN count must be **255** to disable inheritance; its
*effective* count correctly reads **0**. Sui uses all three default-inheritance
flags set to false and empty optional DVNs. These encodings are different.

The four exact proposed BNB Endpoint calls were executed only in an ephemeral
fork at block **135199079**. Each rejected a different caller with the exact
`LZ_Unauthorized()` error. Post-state checks confirm explicit send/receive
libraries, exact stored and effective security settings, unchanged delegate and
an inactive pass. Local gas usage was 57,730 / 64,405 / 190,167 / 162,237;
at the read quote of 0.05 gwei the sum was **0.00002372695 BNB**. This is a local
simulation, not a fee ceiling or an authorization to submit those four calls.
No public signing endpoint is added by this review.

## Sequence and remaining gates

1. Obtain approval for the one Sui registration transaction and prepare its
   canonical signing handoff. Recheck registration absence, fresh inactive BNB binding proof, Sui state and gas.
2. Verify the actual registration receipt and new channel identity independently.
3. Finalize/simulate Sui receiver metadata and explicit security settings for the
   new generation package, with the actual channel. Review both directions and
   executor gas/options; static DVN metadata is not end-to-end delivery proof.
4. Separately review configuration and Sui peer binding. Binding uses the new
   BNB adapter, not the pass or any retired adapter. Reverify both chains after.
5. Refresh original NFTree #2720 identity/ownership before any later deposit.
   Deposit, reserve delivery, sale and gameplay each remain later milestones.

## Reproduce

Node 24, root and `contracts/bnb-generation` locked dependencies are required.

```
node --test contracts/nftree-generation/scripts/registration-review.test.mjs contracts/bnb-generation/test/path-review.test.mjs
node --use-env-proxy contracts/nftree-generation/scripts/read-path-state.mjs /tmp/new-generation-sui-path.json
```

For a fresh registration simulation import `prepareRegistration()` from
`contracts/nftree-generation/scripts/registration-review.mjs` and save the returned
packet to a new file. It uses the project's GraphQL query-only transport and
checked simulation. The BNB fork runner is
`contracts/bnb-generation/scripts/path-review.mjs`; its remote provider rejects
all write methods. Its output uses exclusive creation: archive an earlier local
report before regenerating it. Do not confuse fork receipts with mainnet receipts.

**103 regression checks passed**, including **21 focused checks** (17 registration guard cases and four BNB proposal
checks), plus the successful checked Sui simulation and four-step live-state BNB
fork exercise. Raw evidence is committed beside this document.

Guidance refreshed: MystenLabs/skills README at
`a384d9a158c4639f075ad3f6644d925108ddfc78`, PTBs (building/commands), accessing-data
(GraphQL), and sui-ts-sdk-backend (transactions). The project's pinned SDK and
production-preservation instructions take precedence over advisory migration
recommendations; no SDK migration was made. Sui reads/simulation use GraphQL,
not deprecated Sui JSON-RPC. LayerZero sources: current official deployment
metadata and `UlnBase.sol` (`getUlnConfig`, `getAppUlnConfig`, NIL_DVN_COUNT), plus
the repository's pinned Endpoint/OApp Move source for registration and binding.
