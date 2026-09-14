# Canopy Credits: mainnet-first payment integration

Status: implementation direction and release gates, NOT an enabled mainnet checkout.

## User decision

The founder explicitly selected Sui mainnet for the next payment integration rather than setting up Sui testnet. This supersedes the previously proposed mandatory Sui testnet checkout milestone. Do not ask the founder to configure a testnet wallet, obtain faucet coins, or deploy a replacement TREE token as a prerequisite.

The network decision is not authorization to move an unspecified amount of funds, select an unconfirmed settlement address, import test balances into purchased credits, or publish an unrestricted public payment service. It does not waive local testing, verification, security review or recovery requirements.

The next engineering work package remains the central private Postgres ledger and the Sui-mainnet checkout/payment verifier. Develop the backend in an isolated environment, even though the selected blockchain is mainnet. Mainnet is a blockchain selection; it does not require modifying the existing production website or other Sui games.

## Simulation acceptance already completed by the user

The user reported successful same-page sign-in and retrieval of the existing test CC balance. A continue resumed gameplay and reduced the displayed balance from 800 to 700. On a separate flight, the deliberately failed continue showed no delivery and retained 700 test CC. The user then confirmed 700 remained after refreshing.

These user reports and screenshots close the specific basic simulation acceptance checks. They are not an independent transaction-journal audit, a full campaign/device test, a concurrency/security review, or a completed real-payment test. Do not ask the user to repeat these same checks without a relevant regression.

The existing 700 test CC stays in the existing simulation environment. It is neither deleted nor converted into mainnet-purchased credits. The new purchased-credit ledger must begin without imported simulation funds. Preserve account identity through an explicit reviewed mapping; do not blindly reuse preview sessions as production authorization.

## Planned implementation boundary

1. Implement the central server-authoritative Postgres ledger with integer amounts, immutable journal entries, transactional reservations/commit/release/refund operations, and durable idempotency. Test it separately from existing production databases.
2. Add a checkout order and transaction verifier for Sui mainnet. Pin the canonical TREE coin type, read its decimals/metadata from the chain, and bind each order to an authenticated account, intended payer, recipient, price/credit terms and expiry. Reject wrong networks, wrong coins, underpayments, reused receipts and unmatched orders.
3. Use the canonical project TREE coin type:
   `0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`.
   Do not create an on-chain Canopy Credits token or bridge credits. CC remains the shared account-ledger spending balance.
4. Run automated/local tests and simulate supported transaction paths against mainnet before requesting execution. Simulated effects are never evidence of a deposit. Simulation is not a substitute for security review or proof that a later transaction will succeed.
5. Verify successful finalized transaction effects and the expected payment/receipt from independent chain data before posting a purchased-credit issuance. Store network, transaction digest and receipt/event identity with durable uniqueness, so replay or retry cannot credit twice.
6. Keep payment execution disabled until an explicitly approved, small private pilot is configured. Restrict authorized accounts on the server, apply per-purchase and aggregate spending caps, and provide pause controls that preserve reads and recovery. A non-public preview URL alone is not an access control.
7. Define and test recovery before any monetary pilot: distinguish no payment, pending confirmation, confirmed payment not yet credited, reserved credits, committed but undelivered continue, and completed delivery. A failed continue may release/refund CC; that is not automatically a refund of the original on-chain TREE purchase or its gas fees. A crash after delivery acknowledgment still needs an explicit recovery policy/checkpoint design.

Mainnet purchases move real TREE and incur network fees; each initial transaction must be reviewed and signed in the user's wallet. Never request seed phrases or private keys. Do not put privileged capabilities or unrestricted treasury signing keys on the web server. Any deployment transaction also needs its own identified package, capability destination and bounded gas authorization.

## Proposed pilot scope and unresolved settings

Recommended initial scope: one game (TREE FORCE '89), one payment route (TREE on Sui mainnet), founder-controlled access, and one small reviewed purchase before expanding. This is not yet a public launch or a claim that a pilot has passed.

Still unconfirmed: the full receiving wallet address for CC sales, the allowed payer/account list, exact first-purchase amount and aggregate spending/gas cap, checkout package/capability configuration, and the reviewed TREE pricing method. Other project treasury addresses are not automatically authorized as the CC-sales destination.

Do not use the simulation's fictional TREE = $0.001 quote as a mainnet price. A mainnet quote needs an explicitly reviewed pricing policy with freshness/size checks and fail-closed behavior; do not silently substitute an easily manipulated spot quote. The existing 100 CC continue, three-life restoration, one-continue limit and 10% TREE bonus remain prototype parameters until finalized.

Retain the previously specified independent contract/security review, legal/tax and terms/refund-policy review, reliable RPC sources, monitoring, protected administration, reconciliation and backup/restore checks before applicable monetary/public-release gates. Skipping a testnet setup does not remove these tasks.

## Current technical references

- Mysten SDK signing/execution documentation includes `simulateTransaction` against a mainnet client without executing the transaction: https://sdk.mystenlabs.com/sui/transactions/signing-and-execution
- Sui integration guidance requires finalized-effect verification before crediting, durable deduplication, reconciliation and recovery. New integrations should use gRPC or GraphQL rather than deprecated JSON-RPC: https://docs.sui.io/operators/exchange-integration

Check these references against pinned implementation dependencies when coding. Existing unrelated game/portal APIs are not silently migrated by this decision note.

## Effect of this commit

Documentation only. No payment flag, chain endpoint, environment variable, contract, database, account, credit balance, gameplay code or production branch is modified. Real TREE checkout is still not implemented or activated by this note. Prior simulation documents describe their historical implementation; this note governs the newly selected mainnet-first work sequence.
