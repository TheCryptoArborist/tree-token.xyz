# One-time Sui-to-BNB pilot peer binding

All four BNB configuration transactions succeeded and their exact calldata, sender, nonce, destination, value, events, contract code hashes and live explicit/effective settings are verified in `bnb-configuration-complete-verified.json`. The BNB pass remains Unconfirmed. Sui-side libraries, four required DVNs, confirmations, executor and 195-byte receiver metadata are also explicitly configured.

Next signing page: `/play/multichaintest/setup/sui/bind/`. One user-signed Sui mainnet PTB makes two calls:

1. `0x00245ba36f7a1cc643a2b037450dff1e4399e18069c6545fb5fcaaf37d39d7dc::bytes32::from_address(0x000000000000000000000000b4c471c1fb8e31ddcbb518277e97a4575fc74779)`.
2. Original pilot package `0x2f3671d48dd000a27fd466fd347796149f5cd30cb16e1d22d2d89466ffc3d900::bridge::bind`, consuming the peer result and using the verified Bridge, BridgeAdminCap, OApp, OAppAdminCap, read-only endpoint and registered messaging channel.

The designated sender is the Sui dev wallet `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`. Both matching admin capabilities must remain owned by this wallet. The bridge's bind function is one-time. The BNB adapter is left-padded to 32 bytes; the Sui application identity is the original package, distinct from its shared OApp object and capability UID.

Simulation succeeded with net gas 5,071,497 MIST (0.005071497 SUI). Its exact input references, pure bytes, two commands, three events, expected new peer/channel dynamic fields, unchanged shared ownership and retained owned admin capabilities are checked. The simulated events are ChannelInitializedEvent, PeerSetEvent and Bound. PeerSetEvent uses the package identity, as confirmed by the deployed contract simulation. No NFT object, endpoint or ULN configuration is mutated; the disposable NFT remains nested in the bridge. No reserve packet, token approval or pass purchase is included. `sui-peer-bind-simulation.json` is simulation evidence only: unsigned and not executed.

Before each signing request, the browser rechecks BNB chain 56, all pilot/protocol code hashes, explicit and effective BNB settings and the Unconfirmed pass, then reads typed live Sui objects/capability ownership, unchanged unbound custody, registration/receiver instructions and explicit application security. A fresh gas-selecting Sui simulation follows. The original transaction instance is handed to the existing dApp Kit/Slush integration with gas configuration left to the wallet. The mainnet GraphQL client is used for reads/simulation; the existing wallet integration uses gRPC.

Submission requires explicit consent, stable wallet/account/network, a shared Web Lock and durable pending marker. Ambiguous errors retain pending; explicit rejection and known failed execution clear it. A saved receipt blocks re-submission. The page only reports submission until the actual on-chain receipt and live peer/channel fields are independently checked.

Publication adds exactly four new local page files. The preservation workflow captures current locked production, reuses all 49 complete backend package/provider/runtime records and five schedules, retains all original static bytes and environment/settings/lock, and verifies delivered JavaScript dependencies. No standard root snapshot is promoted.

After user signature: verify Bound/PeerSet/ChannelInitialized events, application peer field, channel nonce-zero state, unchanged NFT custody and retained admin authority. Then prepare and quote a separate reserve-announcement packet to BNB, verify authenticated delivery and Ready state, and only then test the 25-USDT purchase. Original 5,000 NFTrees are outside this disposable-NFT pilot.

Current external guidance consulted: MystenLabs/skills README; `ptbs/SKILL.md`, `ptbs/building.md`, `ptbs/commands.md`; `frontend-apps/SKILL.md`, `frontend-apps/non-react.md`, `frontend-apps/transactions.md`; `accessing-data/SKILL.md`, `accessing-data/graphql.md`. GraphQL and gRPC are generally available; Sui JSON-RPC is deprecated. The existing pinned SDK/wallet integration and deployed contract code are preserved.
