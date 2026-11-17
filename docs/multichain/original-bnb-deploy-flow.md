# Original NFTree trial: BNB adapter deployment page

The isolated `/play/multichaintest/original/bnb/` page offers just one BNB
adapter creation. It fixes the actual package peer and confirmed empty Vault
route for original #2720. It does not deploy the suite pass, bind peers, deposit
an NFT, take USDT or enable purchases. The user approves the transaction in their
own BNB extension on Brave; the assistant signs/submits nothing.

## Fixed reviewed intent

- BNB Smart Chain mainnet, chain 56; endpoint EID 30102 and Sui EID 30378.
- Intended deployer/binder: `0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae`.
- Peer: actual package `0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4`.
- Route: actual Vault `0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c`.
- Calldata: reviewed production adapter bytecode plus those two bytes32 values.
- Transaction value: zero. The wallet pays BNB network gas only.

The prior disposable wire-v1 pilot IDs and simulation-created Vault IDs are not
used. The new suite pass remains a subsequent separate step: one token at
25 USDT directly to treasury `0xC440F06BBC7e58b0d055815f915447e4ae0E3720`,
initially paused. That pass and adapter binding are not offered by this page.

## Checks before every handoff

Reuse the pinned Sui GraphQL client and strict publication/slot validators.
Verify actual mainnet publication and creation receipts, current dev-owned NFT
and capabilities, unchanged upgrade/OApp configuration, and the exact shared,
empty, unbound Vault. No Sui signature or JSON-RPC method is involved.

Reuse the existing BNB RPC response parser and public read fallback. Account and
chain identity always come from the chosen extension; reads go through verified
BNB-mainnet endpoints. Only the explicit creation request goes to the wallet,
with no send retry. Endpoint code and EID, current latest/pending nonce equality,
empty predicted address, exact creation simulation runtime and immutable values,
gas allowance, and BNB balance must all pass. The nonce is read fresh; a changed
nonce or fee requires renewed review. A quote expires after two minutes. The
wallet displays the final fee; the 0.01-BNB allowance check is an estimate ceiling,
not a restriction on a user's later wallet fee edits.

Pinned compiler AST checks independently establish immutable slots 61=suiPeer,
63=route and 65=binder, then compare exact creation code, runtime template and
references with the reviewed artifact. Contract source and lock are unchanged.

Web Locks coordinate this page across tabs. Persist nonce and predicted address
before requesting the signature, then persist the returned hash. Explicit user
rejection clears pending state; ambiguous errors, missing hashes or storage
failures retain it. Manual hash recovery uses the same lock and verifies exact
creation sender/calldata/value/chain/nonce/address, the Endpoint DelegateSet event,
actual runtime, initial adapter getters and delegate. A mismatched receipt cannot
clear the recorded request. Browser storage is a browser-local guard, not an
on-chain registry of all possible deployments or a cross-device guarantee.

## Validation and preservation

The real unsigned page preflight passed; proof is
`original-trial/bnb-page-preflight.json`. Simulating from the intended public
account does not prove a connected wallet identity. Actual wallet approval must
be tested by the user. The reviewed EndpointV2 code fixture is public chain data.
229 focused checks passed, including 14 new adapter-page checks. The existing
14 EVM tests are run again in dedicated CI, along with pinned artifact and exact
browser-bundle reproduction. No remote transaction is submitted by these checks.

The release captures actual locked production `6afca1e2756277d1cf2ed161`: 583
static paths, 49 complete backend packages and five schedules. Add exactly the
new page's index.html, app.js and core.js. Preserve all existing paths byte for
byte, full backend identities/configuration and protected environment/runtime
fingerprints. Expected new total: 586 paths. Wait for every queued Git build,
verify the new candidate, and publish by locking that new candidate. Never run
the historical snapshot build as a production release or restore an older deploy.

## Guidance checked live

Current MystenLabs/skills README, `accessing-data/SKILL.md` and
`accessing-data/graphql.md` were read for the Sui receipt/current-state reads.
https://github.com/MystenLabs/skills/blob/main/accessing-data/SKILL.md
https://github.com/MystenLabs/skills/blob/main/accessing-data/graphql.md
Existing pinned SDK, wallet helpers and vendor bytes remain unchanged.
