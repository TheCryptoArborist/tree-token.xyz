# Original #2720 backing announcement

This stage adds only `/play/multichaintest/original/reserve/{index.html,app.js,core.js}` to the current locked live deployment `6afce679fb554257af0b2c57`. The preservation release must keep all 607 existing static paths byte-identical, all 49 complete backend package/provider/runtime/configuration/environment records and all five schedules. No existing bundle, game, backend, dependency or Move/EVM contract is changed.

## Actual custody and intent

Signed deposit `GLXLAmCD3DrbdK55NXmppr7uPEWDdrYYF9JBd3C5XBvE` holds the full unchanged original collection NFT #2720 inside the reviewed vault. It is not a newly minted substitute. Source state is phase 1, bound, unannounced, unused channel. The BNB adapter and pass are bound, paused and unminted. The announcement page uses only Slush in Peter's Brave dev account ending 45c4 on Sui mainnet. Wallet alone selects gas, signs and submits; no app keys or agent submission.

The user approval spends SUI for one LayerZero backing announcement and gas. The original NFT stays in its Sui vault; no admin capability is an input. This approval sends no stablecoin, performs no second deposit or mint, changes no verifier/security configuration and does not enable sales. BNB delivery must be verified separately before the later 25-USDT purchase activation. The vault's existing no-direct-withdrawal custody terms remain in force.

## Exact packet and fee checks

The reviewed quote/send PTB templates contain the actual original generic `vault::quote`, `vault::send` and corresponding confirmation calls, actual endpoint/channel/ULN, executor and all three configured DVN worker objects. They contain no old pilot application references or four-DVN configuration mutations. Fee is typed BCS u64, selected at fresh quote time; gas configuration stays unresolved for Slush. Every protocol call input/result and the refund address is fixed.

The 130-byte payload is codec version 2, kind 1, original Vault and NFT IDs, zero request and zero recipient. The packet uses Sui EID 30378, original package CallCap as sender, BNB EID 30102, actual adapter as receiver and nonce one. GUID is independently derived from the protocol's packed nonce/eid/sender/eid/receiver:
`0x8e1331227a97541412fb436a355605469cdcfb0d97d3f7538b33185c06ca7f67`.

The simulated reference message fee is 72,951,105 MIST, net gas 4,053,443 MIST, total 77,004,548 MIST (0.077004548 SUI). The page displays each amount separately. Fresh fees above 0.5 SUI, gross gas or gas budget above 0.1 SUI, nonzero LZ-token fees or native delivery options are rejected. These are reference estimates; fresh checks run before handoff.

Simulation/receipt validators require exact transaction inputs/commands, executor/DVN fee events for all three required verifiers and independently encoded PacketSent bytes/options/library. Fees must sum exactly to the selected quote and appear only in the expected SUI balance changes and worker payees. Expected existing writes are Vault, OApp, channel and the one derived outbound-path field; all other existing non-gas objects are protected. New writes may only be SUI coins to fixed worker payees or sender. Full current state checks protect the wrapped NFT metadata, ownership, authorities, Registry, upgrade policy, security fields and unrelated nonces. The unsigned preparation's execution-attached post-state was independently checked for intact NFT custody and only announcement/nonces advancing.

## Preflight, signing and recovery

Preflight verifies all actual signed publication/slot/registration/configuration/peer/deposit receipts, fresh source state, BNB runtime and binding, all four BNB configuration receipts and the paused/unminted pass. It rereads source state after BNB checks, obtains a fresh quote and simulates the exact send transaction. Timeouts are created per simulation after prerequisite checks.

A dedicated storage key and Web Lock coordinate this one-shot stage. Persist pending before wallet handoff; ambiguous wallet failures stay pending. Explicit rejection allows retry. Sender/network/connection epoch/consent and completed quote age are checked. Changed message fees or gas require re-review. Wallet reported success is distinguished from chain-verified source receipt. Recovery independently verifies the signed source packet, exact payment and live announced vault/outbound nonce one. It intentionally does not require BNB to remain unconfirmed after sending, because successful delivery can already have advanced it. The receipt displays destination status `not_yet_verified`; it never equates source finality with BNB delivery.

## Current Mysten guidance used

Live README and applicable files checked for this request:

- [ptbs/SKILL.md](https://github.com/MystenLabs/skills/blob/main/ptbs/SKILL.md), [building.md](https://github.com/MystenLabs/skills/blob/main/ptbs/building.md), [commands.md](https://github.com/MystenLabs/skills/blob/main/ptbs/commands.md)
- [frontend-apps/SKILL.md](https://github.com/MystenLabs/skills/blob/main/frontend-apps/SKILL.md), [non-react.md](https://github.com/MystenLabs/skills/blob/main/frontend-apps/non-react.md), [transactions.md](https://github.com/MystenLabs/skills/blob/main/frontend-apps/transactions.md)
- [accessing-data/SKILL.md](https://github.com/MystenLabs/skills/blob/main/accessing-data/SKILL.md), [graphql.md](https://github.com/MystenLabs/skills/blob/main/accessing-data/graphql.md)
- [move-security/SKILL.md](https://github.com/MystenLabs/skills/blob/main/move-security/SKILL.md), [best-practices.md](https://github.com/MystenLabs/skills/blob/main/move-security/best-practices.md)

Pinned installed SDK 2.26.1 and actual unsigned simulations establish API behavior. No SDK migration or dependency installation is included. Public Sui reads use GraphQL, not deprecated Sui JSON-RPC. BNB reads use EVM JSON-RPC.
