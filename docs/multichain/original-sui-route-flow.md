# Original NFTree — configure the Sui side of the BNB route

Canonical signing page: /play/multichaintest/original/configure/.
This is one Sui mainnet approval from dev wallet ending 45c4, using Slush in
Brave. It configures only this registered application's Sui endpoint settings;
BNB settings and the Sui peer binding remain separate later approvals.

## Exact settings

- Application identity: original package CallCap, not shared OApp address.
- Actual registered channel: 0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef.
- Explicit send/receive library: Sui ULN302.
- Required operators: Twinstake, LayerZero Labs, Horizen. All three must verify.
- Optional DVNs: none; no default-inheritance flags.
- Sui send confirmations: 5; Sui receive confirmations: 20 BNB blocks.
- Outbound executor: LayerZero executor, maximum message size 10,000 bytes.
- Execution metadata: OAppInfoV1, direct original vault::lz_receive call with
  the original collection::NFT generic, actual Vault and OApp, and endpoint call ID.

Official live deployment metadata lists the selected classic (not lzRead) DVNs
as nondeprecated on both chains. The selected three operators match the completed
pilot and its approved security policy; the new application has no existing
messages or application-specific configuration. Source:
https://metadata.layerzero-api.com/v1/metadata/deployments
Snapshot: original-trial/route-provider-metadata.json. No existing pilot setting
or live Arcade access/payment integration is changed.

## Transaction and metadata proof

Nine Move commands atomically set send/receive libraries, executor, send and
receive ULN rules, and receiver metadata. Each endpoint set_config call's
hot-potato result is consumed immediately by ULN302 set_config. The OApp is
read-only; its matching dev-owned OApp AdminCap authorizes settings. No default
protocol administrator function, delegate change, peer binding, NFT deposit,
cross-chain message, stablecoin payment, token mint or sale activation occurs.

Original vault::lz_receive requires the original NFT type argument; the retired
pilot callback had no generic. The new 278-byte metadata is independently
checked against deployed Move oapp_info_v1::create/encode and
ptb_builder_helper::lz_receive_call_id simulations. Evidence:
original-trial/route-metadata-verified.json. This proves encoding, not actual
executor delivery; complete route verification and messaging tests remain later.

## Checks and recovery

Preflight rechecks Sui genesis/publication/slot/source capabilities and NFT
ownership, actual signed registration/channel, fixed endpoint/ULN/table identities,
unchanged protocol defaults and absence of application settings. It rechecks
the actual BNB binding receipt, exact event, runtimes and paused/unminted pass.
Only a verified BNB result is accepted. No BNB wallet is requested on this Sui page.

Checked mainnet simulation validates full exact command/argument/pure-byte shape,
sender/gas owner, seven exact events, four deterministically derived config
field IDs and their parents, permitted existing writes and gas-only balance
change. Version numbers are normalized between SDK numeric/string forms.
Three ephemeral call IDs and the gas accumulator are permitted; no other
persistent object creation or protected custody/configuration mutation is allowed.

Only the OApp AdminCap, endpoint, ULN and application registry entry may change.
Vault, original NFT, VaultAdmin, original Registry, OApp, UpgradeCap and messaging
channel remain protected. Net estimated gas must remain under 0.1 SUI.
The fresh checked simulation's net gas is 14,951,541 MIST (0.014951541 SUI).
Slush selects final gas; no budget/price/payment is forced into the signing intent.

The two-minute review, identity/network/epoch checks, repeated preflight, Web
Locks and durable pending state guard handoff. Explicit rejection or known failed
execution clears pending; ambiguous responses retain it. Exact receipt recovery
checks all commands/effects and actual live explicit settings plus source/BNB
proofs before clearing pending state. No automatic signature or transaction retry.

## Preservation and references

Add only index.html, app.js and core.js under the new path. Expected locked
baseline: 6afcc6048594a4fe92aee28d (595 static paths). Preserve every existing
static byte, 49 complete backend package/provider/runtime records, protected
runtime/environment configuration and five schedules. New total: 598 paths.
All previous signing snapshots and bundles stay frozen. No dependency or
contract source changes are included.

Live MystenLabs guidance read:
https://github.com/MystenLabs/skills/blob/main/README.md
https://github.com/MystenLabs/skills/blob/main/ptbs/SKILL.md
https://github.com/MystenLabs/skills/blob/main/ptbs/building.md
https://github.com/MystenLabs/skills/blob/main/ptbs/commands.md
https://github.com/MystenLabs/skills/blob/main/accessing-data/SKILL.md
https://github.com/MystenLabs/skills/blob/main/accessing-data/graphql.md
https://github.com/MystenLabs/skills/blob/main/frontend-apps/SKILL.md
https://github.com/MystenLabs/skills/blob/main/frontend-apps/transactions.md

Pinned LayerZero source reviewed: OApp endpoint_calls, OAppInfoV1, receiver
helper, EndpointV2/message_lib_manager and original vault::lz_receive signature.
The deployed Move encoder/call-ID and actual configuration simulation provide
independent runtime checks against the reviewed source and pinned SDK 2.26.1.
