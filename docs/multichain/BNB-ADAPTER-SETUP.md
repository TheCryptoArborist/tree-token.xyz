# BNB adapter wallet step

The isolated page at `/play/multichaintest/setup/bnb/` handles only the first adapter deployment. It uses the real Sui publication receipt and the previously designated BNB deployer/buyer `0x90f9c1c0c675A0ce9D539c540DB7F4A1f7e583AE`. The designated Sui dev wallet remains the owner of the Sui admin and upgrade capabilities. No additional EVM admin address was inferred from that Sui address.

The first BNB transaction creates LzPilotAdapter with the reviewed endpoint, Sui package peer, Bridge route, disposable NFT backing and the BNB deployer as delegate/binder. It has zero native-token value and no USDT transfer or approval. The page requests a wallet signature only after explicit consent and fresh successful checks. Loading, provider discovery and connection do not request transaction or message signatures.

Preflight verifies chain 56, designated account, matching pending/latest nonce 321, empty predicted adapter address, exact LayerZero endpoint code, reviewed creation bytecode and simulated deployment runtime. It estimates gas and checks native balance, then repeats account/network/nonce checks immediately before requesting the wallet. Account/network changes invalidate the checks. A nonce change blocks this draft and requires regeneration.

The configuration bytes are SHA-256 pinned by the app; the creation data, endpoint code and expected runtime are separately pinned. The runtime was obtained by a read-only mainnet deployment simulation. A separate user-approved transaction is required for the pass after the adapter's actual receipt is verified. No dependent pass or binding transaction is submitted here.

Cross-tab Web Locks and durable shared state guard submission. Missing locks or failed persistence stop before the wallet request. Explicit wallet rejection clears the marker; ambiguous errors and invalid/missing hashes retain it for review. No automatic retry or timeout unlock is offered. The app stores a returned transaction hash before receipt lookup; an explicit read-only receipt check verifies success, expected creation address, sender, nonce, chain, zero value, exact creation data and deployed runtime. A missing receipt is pending, never success.

Wallet discovery follows EIP-6963; EIP-1193 provider requests handle reads and user-approved transaction submission. Wallet names are rendered as text and provider icons are not used. No external wallet SDK, CDN script, seed phrase or private key is used.

Current primary references checked: https://eips.ethereum.org/EIPS/eip-1193, https://eips.ethereum.org/EIPS/eip-6963, and https://docs.layerzero.network/v2/developers/evm/oapp/overview. The current MystenLabs skills README was checked; this step changes no Sui code, publication or SDK integration.

The release adds exactly four BNB-page files against current production `6afb62823771123196482071`. Every existing static file, 49 backend package/provider/runtime records, five schedules, environment/configuration fingerprints and production lock remain protected by the preserved-release workflow. Source records from the verified Sui receipt and unsigned BNB preparation are retained here. Original NFTree integration and the LayerZero round trip remain pending.
