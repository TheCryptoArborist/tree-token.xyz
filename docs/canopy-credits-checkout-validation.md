# Canopy Credits checkout implementation — tested, not deployed

## Scope and authoritative revision

Peter authorized implementing the next checkout work package after the read-only Sui mainnet milestone. This work remains on `feature/canopy-credits-mainnet-ledger` in draft PR 20, targeting the account-preview branch rather than production main.

Tested code commit: `d561c98327b5bf0f3758b610b9411dd5b1cecdfc`.
PR: https://github.com/TheCryptoArborist/tree-token.xyz/pull/20

The checkout Move contract, exact receipt codec, quote-signature helper and unsigned offline transaction builder are now implemented and tested. They are NOT published on Sui mainnet, configured with a live quote-authority key, exposed through a payment service or connected to the running game. This report supersedes older notes only where they said these source-code components had not yet been authored; their deployment and monetary activation remain outstanding.

The user-selected network remains Sui mainnet. No user testnet setup is required.

## Implemented components

### Move checkout contract

`services/canopy-credits/contract/sources/checkout.move` accepts the existing canonical TREE coin type:
`0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`.

The receiving address is fixed to the founder-approved address:
`0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`.

There is no recipient setter, payment custody balance or CC token mint. Successful payment transfers the exact quoted Coin directly to that recipient and emits the purchase receipt in the same transaction. A new Checkout starts paused and unconfigured. Its AdminCap is bound to that Checkout instance; init would deliver the cap to the publisher, which does not establish who is authorized to publish or hold it in production.

Configuration requires a nonzero 32-byte Ed25519 quote public key, positive per-purchase and cumulative raw-TREE limits, and a nonempty bounded payer allowlist. Reconfiguration increments the quote-key epoch, always pauses the checkout and never resets the amount already received. AdminCap checks prevent controlling a different instance.

Each canonical BCS quote binds the mainnet-specific domain, Checkout instance, key epoch, order UUID, account UUID, payer, recipient, coin type, exact raw amount, issuance/expiry times and the immutable order commitment. The contract enforces a maximum 45-second validity window using Sui Clock, verifies the server quote signature, rejects reused order IDs, checks the actual Coin<T> type and value, enforces payer and spending limits, and emits a versioned Purchase receipt including the payment Clock timestamp. There is no signing key embedded in the production contract.

### Receipt codec and quote authority

`services/canopy-credits/reader/checkout/codec.mjs` defines the exact Quote/Purchase BCS layouts and a package/instance-specific receipt decoder. It rejects the wrong package, instance, version, recipient, coin type, malformed IDs, noncanonical/trailing bytes, invalid amount and inconsistent time fields. It reads binary receipt contents, not matching-looking event JSON. A prior paid key epoch can be decoded after rotation, subject to the configured snapshot; an unknown newer epoch is rejected.

`quote-authority.mjs` signs canonical quote bytes using a caller-supplied Ed25519 KeyObject whose public key must match the deployment record. This is server authorization of order terms, not a Sui wallet transaction signature. No real authority key was generated, provisioned, stored or loaded from environment by this implementation. Tests use public disposable keys explicitly labeled as fixtures. The signing helper is not a production quote service: account authentication, reviewed pricing, durable order persistence and pilot restrictions must precede any future invocation with a real key.

No actual package ID, shared Checkout ID or production codec registration has been configured. The existing live read-only smoke test still has no checkout codec registered and cannot recognize sampled network events as CC purchases.

### Unsigned transaction builder

`builder.mjs` constructs a full unsigned transaction from explicitly supplied, resolved TREE and SUI coin references. It checks owner, type, digest/version format, duplicate inputs, integer balances and overflow, sufficient TREE, sufficient SUI gas and an explicit gas-budget cap. It merges TREE objects when necessary, splits the exact quoted amount, and calls the single checkout pay function with the Checkout shared object and read-only Clock.

Construction occurs without a network client or transaction submission. Tests block fetch and round-trip the resulting bytes through the SDK. Inputs are snapshotted before the first await so later caller mutation cannot alter the review summary. The returned Transaction object and bytes are review outputs, not an immutable signing authorization; the future wallet UI must validate the exact bytes it asks the payer to sign. The live coin/gas resolver, UI and execution path are not part of this completed step.

Drafts and builder outputs remain `payable:false`. `LIVE_CHECKOUT_ENABLED` remains false and `beginLiveCheckout()` always throws. These labels are not substitutes for a server-side activation/access-control boundary; no live checkout route was added.

## Receipt timestamp correction

The verifier now distinguishes execution time from the later checkpoint timestamp. For a decoded contract receipt, its Clock-derived `paidAtMs` must match the stored order's validity window and must not be after the containing checkpoint. The resulting evidence uses that payment time as `timestampMs`, and preserves `checkpointTimestampMs` plus `paymentTimeSource: checkout-clock` separately. An on-time payment is not rejected solely because checkpoint inclusion or worker observation occurs after quote expiry. The actual recipient credit and payer debit still must equal the order amount.

The existing SQL window check therefore receives payment time for these receipts; older non-checkout fixtures keep their previous checkpoint-time behavior. This timestamp distinction must be preserved in future reconciliation/operations reporting. No public endpoint accepts client-supplied receipt timestamps or evidence.

## Verified execution and counts

All results below refer to the same tested code commit above. Full checkout and ledger job logs and their completed summaries were inspected.

1. Checkout workflow: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/34803805128
   Job `103851570123`: completed SUCCESS. **150 JavaScript tests passed, zero failed/skipped**. The production Move package compiled successfully. **26 Move VM tests passed, zero failed**. The log reports completion of the Move tests at approximately 2026-09-14 03:49:00 UTC.
2. Ledger workflow: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/34803804990
   Job `103851569526`: completed SUCCESS. **28 actual PostgreSQL integration tests passed** on disposable PostgreSQL 17.11. Its repeated 48 payment tests also passed, and are not counted twice.
3. Existing mainnet read-only workflow: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/34803804995
   Job `103851569757`: completed SUCCESS, including the read-only mainnet acceptance step, as verified in the completed job summary. This report does not substitute a new transaction observation for the separately recorded earlier mainnet observations.

Total distinct automated coverage: **204 passing tests = 150 JavaScript + 26 Move + 28 PostgreSQL**. This milestone adds 73 tests to the earlier 131: 39 quote/codec/builder checks, 8 codec/reader/verifier boundary checks and 26 Move tests. Duplicate executions across workflows are excluded from the total. The network smoke test is separate.

The local independent Python BCS encoder and Ed25519 implementation produced golden vectors. The SDK/Node output matched those vectors, and the Move VM successfully verified the same signed quote and emitted receipt bytes matching the SDK layout. The CI production build explicitly verified that the test-only TREE stand-in, vector module and test module were absent from the production bytecode output. The stand-in did not deploy or mint a replacement TREE token.

The complete JavaScript/Move suites ran in GitHub Actions. The local chat container generated independent vectors but did not execute a live wallet flow or the Sui CLI. The pinned official CLI reported `sui 1.79.1-808640d9b49a`; the official release archive checksum was verified. Framework source was pinned to `58386edc269ef88ff0f40ab0a9d50e87cba80ca8`. The isolated SDK remains integrity-locked at `@mysten/sui@2.31.0`, and Node reported v22.23.2. A non-failing implicit-constant-copy compiler warning remains; a clean compilation is not an external security review.

## Corrected initial CI issues

The initial revision compiled the production package and passed its JavaScript suite, but its Move test compilation failed on unsupported indexed assignment syntax. The test mutation was corrected using an explicit mutable vector borrow, without removing the rejection test. The complete updated suite then passed.

The first CLI invocation also auto-bootstrapped a throwaway local runner wallet/config because no client configuration existed, and printed that disposable recovery material in the runner log. It was not a project wallet, was not funded or used for any transaction, and must never be reused. No recovery material is reproduced here. The workflow was corrected to supply an explicitly empty keystore, no active signing address and a mainnet environment record before compiling/testing. The final successful run checked that the keystore remained `[]` after both build and tests. No user wallet configuration or testnet setup was requested or changed.

## Boundaries and next work

No mainnet contract was published, no transaction was submitted, no purchased CC were issued, and no user database, active preview branch or production environment was changed. The existing game, sign-in, achievements and simulation ledger remain separate. Peter's last verified 700 test CC were not modified or imported; this task did not query his personal test balance.

The contract/codec/builder tests exercise controlled coins, keys, prices, objects and chain responses. They are not a completed mainnet checkout, end-to-end wallet/ledger/game test, refund of an on-chain payment, independent audit or guarantee of production security. The earlier reader's trusted-RPC finality limitations remain.

The next engineering work package should connect authenticated TREE Accounts, immutable orders, the quote authority, independently resolved coin/gas inputs and receipt reconciliation to a separately provisioned persistent private ledger, while monetary execution remains disabled. Integrate saved-flight recovery before claiming crash-safe paid continues. Prepare a reviewed deployment/configuration record with package/Checkout IDs, verified source/bytecode and capability ownership; registration of this receipt codec must use that actual record, not fixture values.

Before any monetary pilot, Peter must approve the payer account(s), purchase and cumulative limits, gas/deployment budget and administrator/capability destinations. Finalize reviewed TREE pricing and replay/recovery policy, key management, operational reconciliation/backups, security review and wallet transaction approval. The receiving wallet is already resolved and must not be requested again. General authorization to build these components did not authorize publishing or moving funds.

This file records results only and does not alter tested implementation code or activate checkout.
