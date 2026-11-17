# Disposable NFT reserve recovery on BNB

The user-approved Sui transaction `HXuc2RpT44yQRL6cgd9CW4WNbttG2ZVMU4XYJoq2HF7U` succeeded at checkpoint 346250773. Both Sui directions require Twinstake, LayerZero Labs and Horizen; the disposable NFT remains nested, administrative capabilities remain with the developer wallet, and nonce remains 1.

The new isolated BNB page updates both BNB directions to those same three required verifiers, commits the existing packet and delivers it through the LayerZero endpoint. Canary is excluded as approved. BNB confirmations stay send 20 / receive 5; no optional verifier is enabled. This reuses the original source transaction `5Uztr6gLvf9fSMNfFRSi2fTVTAHXC1rCSKSRwn4h8JQP`, GUID `0x6a21b3ef6075b49ae3bdb1b839554326695df0d71c949db5aa8898ffc7967f8f`, without another source messaging fee.

A local fork of BNB mainnet executed all four exact transactions, ending with the pass reserve Ready and the expected delivered message hash. Remote writes were blocked; local signer impersonation occurred only inside the fork. Evidence is in `bnb-three-verifier-recovery-fork.json`; this is simulation evidence, not mainnet completion.

The wallet page checks current source alignment, BNB identity, code hashes, 21 exact state reads, pending/current account nonce, simulation and gas before opening the selected wallet. Configuration and packet calldata are bundled and immutable. Dynamic account nonce is pinned before submission. A Web Lock and persisted pending record prevent retries after uncertain submission; exact transaction, receipt events and resulting chain state are required before clearing it. Automatically advanced stages are skipped. No new contract deployment, USDT transfer, NFT transfer or source-message send is requested here. The separate 25-USDT purchase awaits confirmed recovery.

Production publication preserves the complete locked baseline static inventory, all 49 backend packages, runtime/environment configuration and five schedules. Only three new `/play/multichaintest/setup/bnb/recover/` files are added.

Current MystenLabs guidance consulted: `skills/accessing-data/SKILL.md` and `skills/accessing-data/graphql.md`. Current GraphQL state and transaction effects were checked, rather than inferred from the explorer or the simulation.
