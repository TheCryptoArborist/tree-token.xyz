# Original NFTree trial: confirmed publication and empty Vault

## Confirmed empty Vault — 2026-11-17

The user signed `AfupAmEkVCxA9uXWL6v42yopXtM6zpgt7dcYjx5Ei6QZ`.
The receipt passed the published strict slot validator on Sui mainnet. Actual
net gas was 3,832,051 MIST (0.003832051 SUI). The actual shared Vault is
`0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c`.

Fresh reads confirmed the Vault is empty and unbound, with the exact original
NFT type, #2720 backing, Vault-ID route and package CallCap; Registry.slot now
points at it and the CallCap moved from Registry into the Vault. #2720 remains
directly dev-owned with unchanged version and digest. The reused AdminCap, OApp
AdminCap and compatible UpgradeCap remain dev-owned; OApp and upgrade settings
are unchanged. There was no NFT input, transfer, mint or payment other than gas.

`slot-bindings.json` is the latest actual route binding record.
`bindings.json` remains the immutable publication-era snapshot consumed by the
already published signing bundle. Do not replace that snapshot and silently
invalidate browser/source bundle reproducibility.

The actual BNB adapter constructor is now prepared with the published package
as `peer` and the actual Vault ID as `routeId`. A read-only BNB-mainnet preflight
at block 134177177 confirmed chain 56, the unchanged EndpointV2 code and EID
30102, successful creation `eth_call`, exact reviewed runtime template, and all
three immutable values (peer, route, intended binder). `eth_estimateGas` returned
1,565,084 gas; at reference 0.05 gwei this is 0.0000782542 BNB. This estimate is
not a fee commitment and must be refreshed before a wallet handoff. No nonce,
gas limit or gas price is fixed in the review-only unsigned intent.

`bnb-adapter-unsigned.json` is review material, not a wallet signing page or a
claim of deployment. The intended BNB deployer remains
`0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae`. Both adapter and suite pass must be
new deployments for this original wire-v2 route. The disposable wire-v1 pilot
addresses must not be reused. The suite pass remains one token, 25 USDT direct
to treasury `0xC440F06BBC7e58b0d055815f915447e4ae0E3720`, initially paused.

Next: prepare the isolated BNB signing page with fresh identity/nonce/fee checks,
then separately verify the user-signed adapter and pass deployments. Complete
registration, peer/library/DVN/executor verification before any original NFT
deposit. No actual BNB contract, funding or sales are ready yet. Existing website
files, services and schedules were not modified for receipt verification.

Live Mysten guidance rechecked for this receipt: `accessing-data/SKILL.md` and
`accessing-data/graphql.md`. The verified SDK GraphQL interface is reused; no
JSON-RPC Sui calls, dependencies or wallet integration changed. Existing
publication/slot regression suite: 28 checks passed.

## Prior publication and simulation evidence

The user signed Sui mainnet publication
`9tBTVYhDGMhrGstVxGVMzmhTfyYGQnQhZ7paPkPcVmg2`.
The receipt passed the same strict browser validator used before signing: exact
reviewed module bytes/dependencies, sender, capability transfer, created objects,
SUI-only gas accounting and absence of any original NFT input/effect.
Actual net gas: 63,750,000 MIST (0.06375 SUI).

Independent current reads confirm the original #2720 remains directly dev-owned,
the published Registry initially had no slot; its backing/type/OApp/package CallCap matched the
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
not a user instruction to run a CLI or import transaction bytes. The isolated slot-signing page was subsequently published at
`/play/multichaintest/original/slot/`. The user then signed actual creation below.
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
