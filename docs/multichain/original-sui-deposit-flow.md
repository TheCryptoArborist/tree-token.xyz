# Original NFTree #2720 deposit approval

The actual peer-binding receipt FCG2538WHkd7rTAiC2McJanEw2Dr84BiaGcXoNzZUwsu is verified. This stage adds only `/play/multichaintest/original/fund/{index.html,app.js,core.js}`. The release must preserve the currently locked 604 static paths, all 49 complete backend packages/configurations and five schedules.

## Intent and custody

One original generic `vault::fund<collection::NFT>` command wraps original #2720 inside the dedicated shared vault. Matching Vault AdminCap is borrowed and stays dev-owned. No publish, upgrade, protocol configuration, cross-chain send, pass mint, sale activation or USDT payment is included. The original package has no arbitrary admin withdrawal or reset. Return requires the reviewed BNB-pass redemption and LayerZero receive path. The page states this before consent. Actual approval is exclusively in Peter's Brave/Slush dev account ending 45c4 on Sui mainnet.

## Route evidence and limits

`original-trial/fund-reserve-quote-simulation.json` is an unsigned atomic fund-and-quote simulation using the actual source vault, OApp, endpoint, channel, configured ULN, executor and three DVN workers. No security configuration writes or send commands are included. The source quote was 72,951,105 MIST, with zero ZRO fee. The raw template is constructed from the reviewed three-verifier protocol call recipe, replacing every retired pilot application/route reference with the original collection's actual route. No old four-DVN configuration recipe is reused.

`fund-bnb-redemption-quote.json` is a read-only Endpoint.quote using the actual adapter as sender, actual Sui package as receiver, actual vault/NFT, actual 30-million-gas options, and a hypothetical nonzero request with the dev recipient. It does not invoke adapter.quoteRedemption, which correctly requires a locked pass. It establishes fee-path availability, not an actual redemption. The observed quote was 0.004481595519267309 BNB with zero LZ token fee. Live cross-chain delivery and the final round trip remain to be proven.

The exact deposit-only unsigned simulation succeeds. The full execution-mutated vault BCS matches the unchanged original NFT metadata inside phase 1; `announced=false`, `ack_sent=false`, and zero request/recipient remain. Wrapping creates a storage rebate; estimated gross gas is 7,502,400 MIST, storage rebate 8,450,355 MIST, net credit 947,955 MIST. Wallet gas budget selection remains wallet-controlled. Both gross usage and selected budget are constrained to 0.1 SUI by receipt/simulation validation. These are reference estimates, not guaranteed final fees.

## Verification

Preflight verifies the actual publication, slot, registration, configuration and peer receipts, fresh source custody/security, BNB adapter/pass runtime/binding/paused/unminted state and all four BNB route receipts. It rechecks both quotes, then simulates only the exact deposit handed to the wallet. Signed receipts require exact commands/inputs, one Funded event, expected NFT wrapping/vault/AdminCap writes, no new objects or other asset payment, and full live post-deposit vault contents with unchanged authorities/security and unused channel. Sui net gas can be negative due to storage rebate; this is not treated as a failure.

Web Locks, a stage-specific durable storage key, pending-before-handoff, account/network/epoch and fresh completed quote checks block accidental duplicate or stale-wallet submission. A lost wallet response remains pending until receipt recovery. Explicit wallet rejection permits retry. Existing page bundles and historical stage snapshots stay frozen.

## Current guidance consulted

Live MystenLabs/skills README checked 2026-11-17; used accessing-data/SKILL.md and graphql.md, ptbs/SKILL.md, building.md and commands.md, frontend-apps/SKILL.md, non-react.md and transactions.md, move-security/SKILL.md, best-practices.md and access-control.md. Pinned installed SDK 2.26.1 APIs and actual mainnet simulations take precedence over stale examples. No wallet SDK migration or dependency upgrade is included.

https://github.com/MystenLabs/skills/blob/main/ptbs/SKILL.md
https://github.com/MystenLabs/skills/blob/main/accessing-data/SKILL.md
https://github.com/MystenLabs/skills/blob/main/frontend-apps/SKILL.md
https://github.com/MystenLabs/skills/blob/main/move-security/SKILL.md
