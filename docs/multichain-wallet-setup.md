# NFTree bridge setup

The existing `/play/multichaintest/` simulation remains the game preview. The separate `/play/multichaintest/setup/` page offers the first real wallet action: publishing the previously reviewed disposable pilot on Sui mainnet. No BNB deployment or original NFT reservation has occurred.

The setup reuses the contract package's wallet bundle without an SDK or wallet-flow rewrite. The canonical self-link points to the new subpath. Publication now also requires a cross-tab Web Lock, reconciles shared storage before requesting the wallet, and fails closed if its pending marker cannot be saved. The bytecode hashes and dependency identities match the successful November 16 Sui simulation. Publication creates a new disposable NFT, shared Bridge, OApp and admin capabilities, and returns the UpgradeCap to the designated Sui wallet. It does not use the original collection. Estimated net gas was 0.0463536 SUI; the signing wallet must refresh gas and preview the transaction.

BNB endpoint reads on November 16 confirmed Sui EID 30378 is supported, with nonzero default send/receive libraries. Robinhood chain 4663, endpoint EID 30416, still reports `isSupportedEid(30378) = false`, with zero default send/receive libraries. Its chain listing does not establish the required route. See `multichain-setup-evidence-20261116.json` for the exact reads and simulation.

After a successful wallet publication, independently verify the real digest and created package/Bridge/NFT/OApp/capability IDs. Then prepare BNB constructors from those IDs and a fresh deployer nonce. Configure and verify both application peers, libraries, executor and DVNs before announcing reserve. Run one 25-USDT treasury purchase and redemption/acknowledgement round trip. Only after that succeeds should a collection-specific vault support the original 5,000 NFTrees. That production vault and game entitlement integration are not implemented by this page.

Publication uses the preserved-production release script with an exact two-path addition allowlist. It captures current production, preserves every existing static path and all 49 backend records plus five schedules and configuration, refuses queued builds and baseline drift, verifies a new candidate, and publishes only that candidate. The earlier connection-only overlay is not applied over the live simulation.

Validation: 14 EVM contract tests; fresh Sui GraphQL simulation with checks and gas selection enabled; publication tests for exact module/dependency identities, designated wallet, consent, tamper rejection, duplicate suppression and cancellation; preservation tests. Wallet connection, signing, transaction execution and the bridge round trip still require the user's actual wallet and live receipts.

Current external guidance consulted: MystenLabs `move-security/SKILL.md`, `move-security/best-practices.md`, `move-security/access-control.md`, and `sui-publish/SKILL.md`. No Move module or dependency was changed for this page.

## Dev-wallet update

The user designated `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4` as the Sui development/admin wallet. It replaces `0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6` as publisher, UpgradeCap recipient and pilot administrator. The old address is no longer accepted for publication. The EVM buyer and payment treasury are unchanged. This address update does not assign a new redemption recipient; that transaction will be reviewed separately.

`multichain-dev-publication-unsigned.json` is the updated unsigned description, including both sender and pure UpgradeCap-recipient bytes. Its SHA-256 is the signing page's draft identity. Module bytes and dependencies are unchanged. The wallet page and these versioned records supersede the historical downloaded package's publication-wallet setting; do not run the old draft or old wallet preflight. Actual publication IDs remain pending.

This release replaces only the two reviewed setup files, pinned to their exact prior hashes, against production `6afb5ee1e0da5058b298ad6a`. All other static files, function records, schedules and configuration must remain exact.
