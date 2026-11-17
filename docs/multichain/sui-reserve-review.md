# Disposable reserve announcement review

Only `/play/multichaintest/setup/sui/reserve/` is added. Preserve all current static files, 49 function packages, five schedules, runtime/environment settings and deployment lock against baseline 6afbc096b77db1f373d96ba1.

Sui peer binding `4F8yEPsKg3tHzsu4D2Jo9gtMKHQ5PZfcxZdvXUadMQ5J` is verified in the accompanying record. Both admin capabilities remain with the dev wallet; the disposable NFT remains nested in the bridge. No reserve has been delivered and no USDT purchase has occurred.

## Canary identity correction

The prior Sui settings copied Canary worker object `0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0` as its verification identity. The live object's worker_cap.cap_type is Package `0x5ddd0e7338d03f52e98831b52ca28e09a145a0495eea80fe46c4a4b88a69278a`; this actual identity has registered worker info and PTBs. The worker-object key does not. Generic quote discovery aborted until corrected. This approval atomically corrects send/receive identities and sends the reserve announcement. Twinstake, LayerZero Labs, Canary and Horizen remain required, with send 5 / receive 20 confirmations and no optional verifiers. BNB settings stay unchanged.

## Reviewed send

Static PTB templates were expanded from registered onchain endpoint, ULN and worker builders using official @layerzerolabs/lz-sui-sdk-v2 3.0.168 source/deployment metadata. The legacy JSON-RPC SDK is not loaded in the page. Current SDK GraphQL simulations use checksEnabled:true and complete hot-potato consumption. Only the fresh AdminCap reference and exact quoted native fee can vary; payload, options, commands and shared object initial versions are pinned. Runtime checks compare BNB configuration/code and Sui bound custody, both admin capabilities, explicit config, peer and zero outbound nonce. Checked quote/send simulations verify exact commands, inputs, events, fees, balance changes and existing-object effects.

Verified fee: 1.034611781 SUI messaging, 0.004054192 SUI estimated net gas, 1.038665973 SUI estimated total. Live quote review is required, expires after 120 seconds and clears consent if the fee changes. Pilot limits: 2 SUI message fee and 0.1 SUI simulated gas. Gas remains selected by the user's own wallet. Cross-tab coordination and durable pending/receipt storage prevent ordinary duplicate submissions; ambiguous wallet outcomes cannot automatically retry.

First packet nonce 1. GUID 0x6a21b3ef6075b49ae3bdb1b839554326695df0d71c949db5aa8898ffc7967f8f. Options: type 3, 200,000 destination gas, no native drop. Message kind 1 announces only the exact disposable bridge/NFT reserve, with zero request and recipient. No original-collection NFT moves and no USDT approval/purchase occurs. The actual source digest, packet and LayerZero destination delivery must be independently verified before the later 25-USDT purchase. Successful source simulation is not destination delivery proof.

## Live Sui guidance used

MystenLabs/skills README and ptbs/SKILL.md (building.md, commands.md), frontend-apps/SKILL.md (transactions.md, non-react.md), accessing-data/SKILL.md (graphql.md).
