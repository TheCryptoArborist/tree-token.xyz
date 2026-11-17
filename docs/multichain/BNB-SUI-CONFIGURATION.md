# BNB-side Sui pilot configuration

The Sui configuration succeeded in transaction `9KDBT9PfyX8QLrxtaH5KkAVUgCKfhVa7V42kkvNUuomE`. Its receipt, exact reviewed-command comparison and application-specific live configuration checks are stored alongside this document.

The next user-signed step is `/play/multichaintest/setup/bnb/configure/`. Four transactions configure the existing adapter at `0xb4c471c1fb8e31ddcbb518277e97a4575fc74779` through the BNB LayerZero endpoint. The delegate and sender is `0x90f9c1c0c675A0ce9D539c540DB7F4A1f7e583AE`. This page sends zero native value and does not approve or transfer USDT.

1. `setSendLibrary(adapter,30378,0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE)`.
2. `setReceiveLibrary(adapter,30378,0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1,0)`.
3. Send-library `setConfig`: executor type 1, ULN type 2; 20 confirmations, four required DVNs, no optional DVNs, 10,000-byte maximum message, existing reviewed executor.
4. Receive-library `setConfig`: ULN type 2; 5 confirmations, the same four required DVNs, no optional DVNs.

The BNB optional-DVN count must be **255**, not zero: zero inherits protocol defaults, whereas 255 explicitly disables optional DVNs. Required DVNs are sorted ascending: Horizen, Twinstake, Canary and LayerZero Labs. `configuration.json` contains the exact calldata, events, raw configuration reads, effective reads and contract code hashes. Its bytes are SHA-256 pinned in the controller. Initial wallet nonce was 324; each confirmed step advances it by one. Unrelated wallet activity blocks further signing until the draft is reviewed again.

`bnb-config-simulation.json` records four successful read-only `eth_call` simulations and gas estimates. These were independent latest-state calls (not execution and not historical block-pinned simulation). The public BNB endpoint prunes historical state; the route-discovery block is recorded separately. Every wallet approval repeats identity, all code hashes, explicit and effective route state, nonce, simulation, balance and gas checks against current state.

The browser coordinates both submission and receipt updates with one Web Lock and durable pending markers. Explicit user rejection clears the pending marker; ambiguous wallet results retain it. Recovery accepts a hash from wallet activity and verifies exact sender, chain, nonce, destination, value, calldata, events and live route state. Nothing automatically retries a signature. Refresh/reconnect clears review. All four transaction receipts must be confirmed before the next request is enabled in this browser.

Only four new public page files are published. The preservation publisher retains all original static bytes, 49 backend function records, five schedules, environment and runtime settings and the production lock. No smart contract is changed by publication.

After all BNB settings are verified, review and sign the one-time Sui peer binding. Only then quote/send the disposable NFT reserve packet and verify delivery before any 25-USDT purchase. No completed cross-chain delivery or original-collection custody support is implied by configuration.

Guidance checked live: MystenLabs/skills README, `accessing-data/SKILL.md`, `accessing-data/graphql.md`. Sui verification uses GraphQL, which is generally available; Sui JSON-RPC is deprecated. EVM JSON-RPC remains the BNB interface. LayerZero primary sources checked: current `MessageLibManager.sol`, `UlnBase.sol`, `SendLibBase.sol`, `ReceiveUln302.sol`; metadata and live effective-route values match the previously reviewed security providers.

## Receipt-read recovery fix

The user’s confirmed step-one receipt was blocked by the wallet RPC returning an HTTP client error. Chain reads now use two BNB-documented HTTPS endpoints with an explicit chain-56 check before accepting their results. Requests are sequential, authenticated-wallet identity remains mandatory, and every signing request goes to the selected wallet exactly once. Only transient read failures switch endpoints; wrong-chain, mismatched-response and EVM-revert errors fail closed. Pending markers, exact receipt/calldata/event checks, code hashes, nonces and configuration bytes remain enforced. A prominent “Verify previous step and continue” action mirrors the receipt control next to the blocked approval button.

Public read endpoints: `https://bsc-dataseed.bnbchain.org` and `https://bsc-dataseed-public.bnbchain.org` (BNB official JSON-RPC endpoint documentation). Both returned chain ID 56 and browser-compatible CORS headers during verification. No wallet RPC setting or permission is changed. Publication replaces only the three hash-pinned configuration page files; `configuration.json`, all other static bytes, functions and schedules are retained.
