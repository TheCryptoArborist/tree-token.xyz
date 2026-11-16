# NFTree bridge setup

The existing `/play/multichaintest/` simulation remains the game preview. The separate `/play/multichaintest/setup/` page offers the first real wallet action: publishing the previously reviewed disposable pilot on Sui mainnet. No BNB deployment or original NFT reservation has occurred.

The setup reuses the contract package's wallet bundle without an SDK or wallet-flow rewrite. Only the canonical self-link changes to the new subpath. The bytecode hashes and dependency identities match the successful November 16 Sui simulation. Publication creates a new disposable NFT, shared Bridge, OApp and admin capabilities, and returns the UpgradeCap to the designated Sui wallet. It does not use the original collection. Estimated net gas was 0.0463536 SUI; the signing wallet must refresh gas and preview the transaction.

BNB endpoint reads on November 16 confirmed Sui EID 30378 is supported, with nonzero default send/receive libraries. Robinhood chain 4663, endpoint EID 30416, still reports `isSupportedEid(30378) = false`, with zero default send/receive libraries. Its chain listing does not establish the required route. See `multichain-setup-evidence-20261116.json` for the exact reads and simulation.

After a successful wallet publication, independently verify the real digest and created package/Bridge/NFT/OApp/capability IDs. Then prepare BNB constructors from those IDs and a fresh deployer nonce. Configure and verify both application peers, libraries, executor and DVNs before announcing reserve. Run one 25-USDT treasury purchase and redemption/acknowledgement round trip. Only after that succeeds should a collection-specific vault support the original 5,000 NFTrees. That production vault and game entitlement integration are not implemented by this page.

Publication uses the preserved-production release script with an exact two-path addition allowlist. It captures current production, preserves every existing static path and all 49 backend records plus five schedules and configuration, refuses queued builds and baseline drift, verifies a new candidate, and publishes only that candidate. The earlier connection-only overlay is not applied over the live simulation.

Validation: 14 EVM contract tests; fresh Sui GraphQL simulation with checks and gas selection enabled; publication tests for exact module/dependency identities, designated wallet, consent, tamper rejection, duplicate suppression and cancellation; preservation tests. Wallet connection, signing, transaction execution and the bridge round trip still require the user's actual wallet and live receipts.

Current external guidance consulted: MystenLabs `move-security/SKILL.md`, `move-security/best-practices.md`, `move-security/access-control.md`, and `sui-publish/SKILL.md`. No Move module or dependency was changed for this page.
