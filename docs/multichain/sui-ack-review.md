# Final disposable pilot acknowledgement

The BNB redemption source transactions succeeded and Sui transaction `Ai2yCaGUHrDZ8VSmq2e5dCbV4bmHt9YY9UkG8Wd3KNaZ` released disposable NFT `0xc07d792d3700dea38f695d843f7eefa2e9c81efdf8aaf7da5fd151e4c58ef26c` to dev wallet `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`. BNB pass #1 is locked pending the final acknowledgement. This page sends that acknowledgement; it does not change NFT ownership.

## Fixed scope

- New URL: `/play/multichaintest/setup/sui/ack/` (four static assets).
- Sui mainnet source, BNB mainnet destination EID 30102; fixed deployed pilot contracts, request `0x58ea0a82f5eef90c41ef40d2eebed01a4e9c89abb9b7fb304fbc1d4e2b4b2644` and dev recipient.
- Kind-3 message, source nonce 2, GUID `0xfa79848dee327e279114a78aad22f95563f3375487edec2e5b9a655178a10f2b`, 200,000 BNB receive gas, no native drop.
- Exactly three required DVNs: Horizen, Twinstake and LayerZero Labs. Existing confirmations and settings remain unchanged. No admin capability is an input.
- User explicitly connects Slush and signs once. No auto-connect, seed phrases, private keys or server-side signing. No USDT purchase. Messaging fee cap 0.5 SUI; simulated net gas cap 0.1 SUI; fresh quote and consent required.
- The original 5,000 NFTs and live game flows remain outside this disposable pilot.

## Verification

Browser preflight reads both chains, verifies BNB contract bytecode/configuration, locked pass, request and undelivered acknowledgement, checks Sui released custody, current NFT ownership, route, verifiers and nonce, and simulates quote/send with full checks and gas selection. It compares exact calls, inputs, packet, three verifier fees, executor, aggregate balance changes and permitted object effects. Gas selection is performed on simulation clones; the user's wallet selects gas for the unbuilt signing transaction.

Both templates include an on-chain nonce guard using published standard vector functions: outbound nonce 1 selects an empty vector and succeeds; nonce 0 selects a nonempty vector and aborts on destroy; nonce 2 or later aborts on remove. A second send therefore cannot pay LayerZero fees even if it races a stale preflight. The negative replay simulation appends the guard after send and confirms the expected abort without any chain write.

Real Sui quote/send simulations passed: fee 72,951,105 MIST, estimated net gas 4,052,857 MIST in the saved fixture. Fees change; the page requotes before signing. The returned NFT, custody object and admin capabilities are not mutated. Stored pending state and browser cross-tab locks block ambiguous or duplicate wallet requests. Only explicit rejection or a known failed transaction clears pending state.

An isolated BNB mainnet fork accepted the exact callback and burned token #1: state Retired, balance 0, canPlay false and ownerOf reverts, using 78,579 gas. **This fork impersonates the endpoint locally and proves callback behavior only. It does not prove actual DVN verification or destination delivery.** Mainnet acknowledgement submission and BNB delivery remain pending user approval and independent receipt verification.

## Publication preservation

The existing preservation workflow requires current locked deployment `6afc7dff1b766ee9e7e26c7f`, retains every existing static file byte-for-byte, all 49 backend packages, five schedules, environment/context configuration and runtime identity. It adds only the four acknowledgement assets. It stops on baseline or backend drift. No standard dashboard production build is used.

## Current Sui guidance consulted

Current MystenLabs/skills README and `ptbs/SKILL.md`, `ptbs/building.md`, `ptbs/commands.md`, `ptbs/troubleshooting.md`, `accessing-data/SKILL.md`, `accessing-data/graphql.md`, `frontend-apps/SKILL.md`, `frontend-apps/non-react.md`, and `frontend-apps/transactions.md` were read live for this step. The implementation uses the current Sui SDK GraphQL client for checks and dApp Kit for explicit wallet signing.
