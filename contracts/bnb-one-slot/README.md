# One-original-NFT BNB counterpart

Source review only. No deployment, signature, NFT deposit, live sale, game access
change or production website deployment is part of this milestone. This is a new
wire-v2 route, separate from the completed disposable wire-v1 pilot.

## Fixed scope

| Item | Value |
| --- | --- |
| Network | BNB Smart Chain mainnet, chain 56; LayerZero EID 30102 |
| Sui EID | 30378 |
| Endpoint | `0x1a44076050125825900e736c501f859c50fE728c` |
| Currency | BNB USDT `0x55d398326f99059fF775485246999027B3197955`, 18 decimals |
| One-time price | 25 USDT, `25000000000000000000` units |
| Treasury | `0xC440F06BBC7e58b0d055815f915447e4ae0E3720` |
| Backing | Original Common NFTree #2720, object `0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba` |
| Supply | One ERC721 token, ID 1; no second mint or route reuse |
| Intended deployer and initial buyer | `0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae` |

The adapter's constructor fixes the actual Sui package peer and shared Vault
route. The pass constructor binds the adapter, fixed token/treasury/backing and
uses its deployer as initial buyer and controller. A deployment recipe MUST
check the intended account above; the bytecode does not hardcode that account.
Both contracts must be deployed by that same account and bound once. There are
no proxy, upgrade, token-mint, withdrawal or timeout-unlock functions.

## Endpoint identity is not the shared OApp object

The pinned Sui OApp creates **package CallCaps**. `call_cap::id()` returns the
original package address; `EndpointV2.register_oapp` and endpoint send/receive
use that identity. Therefore BNB `suiPeer` is the **published original package
address**, not the shared Sui OApp object ID. The latter is still needed by the
Sui PTBs. `route` is the shared Vault object ID. Never fill either immutable
binding with simulation-created IDs or IDs from the disposable pilot.

## State and transfer behavior

Unconfirmed → Ready after authenticated reserve → Active after purchase → Locked
on owner-requested redemption → Retired after authenticated release acknowledgement.
The sale starts paused. Only the initial buyer can buy the one trial pass.
USDT goes directly to the fixed treasury; the exact received delta must be 25.
Missing allowance, false-return tokens, transfer fees or rejected safe mint roll
back payment and issuance. No-return transfer functions are supported.

While Active, standard ERC721 transfers and resale are unrestricted. `canPlay`
follows the current owner; approved operators may transfer but cannot choose a
Sui redemption recipient. Only the current owner may request redemption. This
locks access and transfers immediately. The acknowledgement must match route,
backing ID, request hash and Sui recipient exactly; only then is token 1 burned.
Identical retries are harmless and old reserve messages cannot reopen the sale.
A controller purchase pause does not block transfers, redemption or completion.
There is no cancellation or automatic timeout recovery after locking. Delivery
failure requires repair/retry of the authenticated LayerZero route; a successful
source send cannot be repeated to pay another messaging fee.

## Message and execution policy

Messages are 130 bytes: version 2, kind 1/2/3, route, backing object, request,
recipient. Each word is 32 bytes. Reserve requires source nonce 1 and zero
request/recipient; acknowledgement requires nonce 2. Endpoint, source EID, peer,
GUID, length and full payload are checked. `nextNonce=0` uses endpoint unordered
execution; the two expected source nonces are still checked by the adapter.

Redemption derives its payload from the Locked pass. Anyone may sponsor the
exact fresh native fee; refunds go to that payer. Native payment only. Fixed
Type-3 receive execution options begin at 30,000,000 Sui gas and can only be
raised by the binder before the one successful send. There is no caller options
argument and no fee ceiling that could permanently prevent an exit if fees rise.
Actual generic-NFT receive metadata, worker fees and executor dispatch still
need the new published route. This default alone is not delivery validation.

The Sui sender enforces 200,000 BNB receive gas. Local fork measurements are
83,026 gas for reserve and 79,055 for acknowledgement (including direct-call
transaction overhead). Both fit with headroom. These are callback measurements,
not real executor/DVN delivery proof.

## Build and verification

Use Node 24, `npm ci --ignore-scripts`, `npm run compile`, `npm test` in this
folder. Compiler 0.8.30, Shanghai, optimizer 200; dependencies are separately
locked and do not change the website's root dependencies. The CI workflow runs
only local fixture tests; it cannot sign or publish. Test fixture contracts are
not part of the deployment artifact list. Review evidence lives under
`../../docs/multichain/bnb-one-slot/`.

Tests cover initial sale, exact treasury payment, rollback and retries, malicious
ERC20/ERC721 callbacks, transfer/access behavior, authentication, replay and
payload rejection, fixed gas/fees, failed send rollback and acknowledgement burn.
Shared golden fixtures are checked by both Move and EVM tests. The production
Sui artifact was rebuilt and freshly simulated after merged option validation was
added; the codec is unchanged. Nonzero receive value, unsupported/malformed
options and combined receive gas below 200,000 are rejected before source send.

`node scripts/fork-smoke.mjs /tmp/proof.json` is an optional read-only-RPC local
fork check. It keeps the real USDT code and buyer balance, locally funds gas,
locally deploys these contracts, impersonates the endpoint and uses synthetic
peer/route IDs. It cannot submit remote transactions: the remote provider has an
explicit read-method allowlist. The saved proof establishes real-token local
behavior, NOT real DVN verification, Sui custody/release or mainnet delivery.

## Remaining before an original NFT is funded

Complete paired-source review and new Sui upgrade-governance review; publish and
verify actual contracts with individual user wallet approvals; create the one
exact-type slot; register the generic receive schema; configure/verify endpoint,
peer, send/receive libraries, three DVNs and executor on the fresh route; recheck
ownership and simulate the exact NFT deposit. Verify intended deployer, exact
runtime bytecode/immutables, treasury, currency, price and bindings before any
wallet request. Contract `canPlay` is not yet wired to the live Tree Arcade.

Collection-wide admission remains blocked by the unreconciled 18 serials in the
original inventory review. Only the exact dev-owned #2720 object is in scope.
Sui UpgradeCap and OApp configuration authority remain material trust assumptions;
this prototype does not claim immutable cross-chain governance.

Guidance checked live this turn: MystenLabs/skills README,
`move-security/SKILL.md`, `move-security/best-practices.md`, and
`move-unit-testing/SKILL.md`. Endpoint identity was checked against the pinned
LayerZero `call_cap.move`, `oapp.move` and `endpoint_v2.move`, and the npm-pinned
LayerZero endpoint interfaces. No production source, function package, runtime
setting or scheduled job is changed.
