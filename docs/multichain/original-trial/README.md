# Original NFTree trial: confirmed Vault, BNB adapter and pass

## Confirmed BNB suite-pass contract — 2026-11-17

The user signed creation
`0xe969a6c0eba78468776b97d1e98cfc9e3f5b3d2cbd91903bee10de48d1e5e717`.
The actual suite-pass contract is
`0x1d3da001E586a7DEFD397B77FADB29eD6F039c13`, nonce 336 from the designated
BNB wallet ending 83ae. The published strict pass receipt validator passed:
exact creation input/value/chain/sender/CREATE address, zero creation logs,
reviewed runtime/immutables, fixed adapter/buyer/controller/route/currency/treasury/
price/token/backing getters, Unconfirmed state, paused purchases, zero redemption/
recipient and zero buyer token balance. No pass token has been minted. Actual
gas was 2,033,615 at 0.05 gwei: 0.00010168075 BNB. Creation charged no USDT.

The actual adapter receipt/runtime/initial storage/delegate and BNB USDT code/
18 decimals were rechecked. The adapter pass pointer is still zero. Fresh Sui
GraphQL reads confirmed the exact Vault remains empty/unbound, #2720 remains
directly dev-owned with unchanged version and digest, and all caps/OApp/compatible
upgrade settings remain as reviewed. No original NFT deposit or sale is ready.
Latest actual bindings are in `pass-bindings.json`. Earlier binding snapshots
and unsigned creation artifacts remain frozen inputs to published bundles.

The next `bindPass(actual pass)` call has been prepared against the actual adapter
and simulated read-only on BNB mainnet at block 134185202. `eth_call` succeeded;
`eth_estimateGas` returned 53,153 gas. At reference 0.05 gwei, estimated fee is
0.00000265765 BNB. Reference nonce 337 and gas price must be refreshed before any
wallet handoff. The intent sends zero native value and takes no USDT; the fixed
25-USDT price and treasury are unchanged and purchases remain paused. The exact
expected event is one adapter `PassBound` with the confirmed pass address.
This is a simulation, not an actual state change or binding receipt.

Next: prepare the isolated binding signing page; recheck source/adapter/pass
state and exact code, wallet identity/nonce and gas; obtain the user's separate
BNB approval; verify the exact event and actual adapter pass pointer. Fresh
LayerZero registration/peer/library/DVN/executor verification still precedes any
NFT deposit or purchase. Binding alone does not enable sales or live Arcade access.

Evidence: `bnb-pass-receipt.json`, `bnb-pass-verified.json`, `pass-bindings.json`
and `bnb-binding-unsigned.json`. Existing publication/slot/adapter/pass regression
suite: 57 checks passed. No source contract, browser bundle, website, backend,
runtime or schedule changed, and the assistant submitted no on-chain transaction.

Guidance rechecked live for the current Sui reads:
https://github.com/MystenLabs/skills/blob/main/accessing-data/SKILL.md
https://github.com/MystenLabs/skills/blob/main/accessing-data/graphql.md

## Confirmed BNB adapter — 2026-11-17

The user signed BNB mainnet creation
`0x2bea9fd423d794de83f04c18381dc345ebf008d0a845a425ccb5c919beeca0ca`.
The adapter is `0x90b5292a5074CfDD665C726b433cc0A97e0dA6ab`, nonce 335 from
the designated BNB wallet ending 83ae. The published page's strict receipt
validator passed against the actual receipt, exact creation input/value/chain,
CREATE address, Endpoint DelegateSet event, exact reviewed runtime/immutables,
initial adapter getters and live endpoint delegation. Actual gas was 1,551,602
at 0.05 gwei: 0.0000775801 BNB. No USDT payment or NFT transfer occurred.

Fresh Sui GraphQL reads verified original #2720 is still directly dev-owned with
unchanged version/digest. The actual Vault is empty and unbound, all admin caps
remain dev-owned and the OApp/compatible upgrade configuration is unchanged.
The adapter has no pass bound, redemptionGas=30,000,000, redemptionSent=false,
and the confirmed original package peer and actual Vault route. Latest actual
bindings are in `adapter-bindings.json`. Prior `bindings.json` and
`slot-bindings.json` remain frozen for published browser-bundle reproducibility.

The next suite-pass constructor has been prepared against this actual adapter.
Read-only BNB mainnet simulation at block 134180571 passed and returned the exact
reviewed runtime with adapter, initial buyer, controller and Vault route values.
The pinned compiler AST independently mapped immutable references 870=adapter,
872=initialBuyer, 874=controller and 876=route. Reference nonce 336 and predicted
address are review-only and must be refreshed before any wallet handoff.
`eth_estimateGas` returned 2,050,922 gas; at reference 0.05 gwei this is
0.0001025461 BNB. No pass contract has been deployed or token minted by this check.

The pass is designed as one transferable token, with the initial sale paused,
priced at 25 BNB USDT (18 decimals), paid directly to treasury
`0xC440F06BBC7e58b0d055815f915447e4ae0E3720`. The intended initial buyer and
controller remain the designated BNB wallet ending 83ae. Creation itself sends
zero BNB value and takes no USDT; only deployment gas is paid at signing.

Next: prepare the isolated suite-pass signing page, refresh current Sui/adapter
state and wallet nonce/fee, then verify the user-signed creation. Binding and
fresh LayerZero registration/peer/library/DVN/executor verification remain
separate approvals before any original NFT deposit or sale. The website and
contracts were not changed while verifying this receipt. No assistant-submitted
transaction, backend change or schedule change occurred.

Evidence: `bnb-adapter-receipt.json`, `bnb-adapter-verified.json`,
`adapter-bindings.json`, `bnb-pass-unsigned.json`. The existing publication/slot/
adapter regression suite passed 42 checks. Live guidance rechecked:
https://github.com/MystenLabs/skills/blob/main/accessing-data/SKILL.md
https://github.com/MystenLabs/skills/blob/main/accessing-data/graphql.md

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
