# Sui-side BNB pilot configuration

Status: prepared and simulated, not signed or applied. This is the next signing stage after verified registration `BAtQ9VoBDonDGdcJBNoYm9Gqcz1H63eVCZKWEEEce8Zd`. Only the disposable NFT pilot is in scope. Final peer binding and all BNB application-specific settings remain pending.

## Reviewed settings

- Sui original application identity: `0x2f3671d48dd000a27fd466fd347796149f5cd30cb16e1d22d2d89466ffc3d900`.
- Actual registered channel: `0x2b8072647e1c9fa38a020058285c10aaaed463be1b90831f63ea8a6e862cccee`.
- Remote EID: BNB 30102; local EID: Sui 30378.
- Explicit send and receive library: Sui ULN302 original package `0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0`.
- Required DVNs: all four current route providers (Twinstake, LayerZero Labs, Horizen, Canary). No optional providers or threshold; all default-inheritance flags are false.
- Send confirmations: 5 Sui confirmations; receive confirmations: 20 BNB confirmations.
- Outbound executor: `0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989`; max message size 10,000 bytes.

Current mainnet reads at Sui checkpoint 346047716 and BNB block 134033083 confirm the same four provider identities in both directions. BNB send/receive values still inherit defaults; they have not been explicitly set for this adapter. The exact route addresses are retained in the checked-in evidence; provider names alone do not identify an address.

## One atomic Sui transaction

Nine Move calls:

1. OApp `endpoint_calls::set_send_library` for BNB.
2. OApp `endpoint_calls::set_receive_library` for BNB with zero grace period (no existing application path/messages).
3–8. Three `endpoint_calls::set_config` calls, each immediately consumed by `uln_302::set_config`, for executor, send ULN and receive ULN respectively.
9. OApp `endpoint_calls::set_oapp_info` for the custom receiver instructions.

No default administrator function is called. OApp/Bridge peers are not bound here. No packet is sent, no USDT allowance/payment is requested, and no NFT moves. The OApp AdminCap remains with the designated Sui dev wallet.

## Custom receiver instructions

The endpoint metadata is version 1 (big-endian two-byte prefix), followed by BCS OAppInfoV1. Its OApp object is the existing OApp shared object. `next_nonce_info` is empty for unordered delivery, and `extra_info` is empty.

`lz_receive_info` has its own version-1 prefix and exactly one direct (not builder) MoveCall to this pilot package's `bridge::lz_receive`. Arguments are the Bridge object, the OApp object, and the global ID of the endpoint-created `Call<LzReceiveParam,Void>`. There are no type parameters or result-ID promises. The authenticated handler itself validates the endpoint caller, bound BNB peer, route, NFT and redemption payload before any release.

The call ID is `64202616f75a5614acfa264418258521299eb6a892eeeea392feef8948c7eb53`. It was independently confirmed by simulating the deployed OApp's `ptb_builder_helper::lz_receive_call_id` and by hashing the original-ID Move type name. The complete 195-byte metadata exactly matches a simulation of the deployed Move `oapp_info_v1::create`/`encode` functions. This verifies encoding, not end-to-end executor delivery, which requires the later actual message test.

References: current LayerZero-v2 commit `9c741e7f9790639537b1710a203bcdfd73b0b9ac`, OAppInfoV1, OFT PTB builder direct-call example, PTB Move Call specification, and the official npm `@layerzerolabs/lz-sui-sdk-v2` 3.0.168 BCS/decoder source. The older SDK was used only as a reference; it is not installed in the website and its deprecated JSON-RPC transport is not used.

## Simulation and safeguards

The unsigned nine-call mainnet simulation succeeded. Net estimated gas is 14,807,141 MIST (0.014807141 SUI). It emitted exactly the reviewed send/receive library, timeout, executor, two ULN and OApp-info events. NFT custody and peer state remain unchanged. Four new application configuration entries are created under the expected tables.

Before signing, the page re-reads typed objects, admin ownership, exact registration/channel, absent app-specific settings and pinned defaults, then simulates with checks and real gas selection. It passes a Transaction instance to Slush with no gas price, budget or gas-coin override. Cross-tab locks and durable pending/receipt state block duplicates; ambiguous provider outcomes remain pending without automatic retry. Signing controls are always visible and the wallet module is shipped locally with the page.

## Subsequent steps

Verify the actual signed Sui configuration receipt and table entries. Prepare BNB delegate transactions to explicitly pin the reviewed libraries and matching four-provider verifier/executor settings. Verify those receipts. Only then bind the Sui peer to the verified BNB adapter and prepare the reserve announcement. Destination gas options are separately profiled and quoted on actual send transactions. Do not open pass purchases or original NFTree integration before the disposable-NFT round trip succeeds.

## Guidance and site preservation

Read the live MystenLabs/skills README plus `ptbs/SKILL.md`, `ptbs/building.md`, `ptbs/commands.md`, `accessing-data/graphql.md`, `frontend-apps/SKILL.md`, `frontend-apps/non-react.md` and `frontend-apps/transactions.md` for this preparation.

Publish four additive files under `/play/multichaintest/setup/sui/configure/` against locked baseline `6afbad80286adf9569314871`. Every existing file, all 49 backend package/runtime records, five schedules and configuration fingerprints remain protected. Production import verification fetches and hashes the actually served local dependencies.
