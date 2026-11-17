# Original NFTree trial: confirmed source publication

The user signed Sui mainnet publication
`9tBTVYhDGMhrGstVxGVMzmhTfyYGQnQhZ7paPkPcVmg2`.
The receipt passed the same strict browser validator used before signing: exact
reviewed module bytes/dependencies, sender, capability transfer, created objects,
SUI-only gas accounting and absence of any original NFT input/effect.
Actual net gas: 63,750,000 MIST (0.06375 SUI).

Independent current reads confirm the original #2720 remains directly dev-owned,
the new Registry has no slot, its backing/type/OApp/package CallCap match the
reviewed source, and all three administrative capabilities remain in the dev
wallet. UpgradeCap points at this original published package, version 1, policy 0
(compatible). `bindings.json` contains actual published IDs; source package peer
identity is distinct from shared OApp object ID. No BNB contract is deployed for
this original-NFT route and neither funding nor sales are ready.

The next action, `vault::create_slot<canonical original NFT type>`, was separately
simulated against the actual published package and actual Registry/AdminCap.
It passed on mainnet without signing or submission. Estimated net gas is
3,832,051 MIST (0.003832051 SUI). It produces one shared empty typed Vault and one
SlotCreated event, mutates the Registry, and keeps the reused AdminCap dev-owned.
The immutable-reference owned AdminCap receives a normal Lamport version stamp;
this is not a capability transfer. Exact command/type/event/backing checks and
SUI-only gas accounting passed. No original NFT is an input or effect.

The unsigned slot transaction has no fixed gas fields and is review material,
not a user instruction to run a CLI or import transaction bytes. There is no new
slot-signing page yet. Actual slot creation requires its own Slush approval.
The Vault ID in the simulation proof is ephemeral and MUST NOT be used to bind
the BNB adapter. After the actual slot receipt, verify the actual shared Vault ID,
then proceed with BNB deployment and complete fresh LayerZero route verification
before any NFT deposit or pass sale. Do not publish this package again.

No website, contract source, environment, backend or schedule changed while
verifying this receipt. This evidence records a user-signed publication and an
unsigned next-step simulation; it does not claim real original-NFT bridge delivery.

Live MystenLabs/skills README checked 2026-11-17. Guidance read:
`accessing-data/SKILL.md`, `accessing-data/graphql.md`, `sui-publish/SKILL.md`,
`ptbs/SKILL.md`, `ptbs/building.md`, and `ptbs/commands.md`. GraphQL/SDK calls were
verified against pinned Sui 2.26.1 and actual mainnet results.
