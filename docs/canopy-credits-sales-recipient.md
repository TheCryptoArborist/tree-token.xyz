# Canopy Credits sales recipient — founder-approved setting

Peter supplied the following full public wallet address on 2026-09-14 at 01:03:34 UTC for Canopy Credits sales:

`0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`

The current payment route is TREE on Sui mainnet. This resolves the previously unconfirmed receiving-address item in the mainnet-first decision and ledger-foundation notes. It does not set destinations for unrelated NFTree sales, other games, or other networks.

## Code change

`services/canopy-credits/sales-recipient.mjs` stores the exact approved address. The draft-order configuration validator and stored-order validator both require this recipient. The existing receipt/effects verifier still requires the payment recipient to match the stored order and requires the expected TREE balance changes. The recipient is not an environment-variable or browser-selectable override.

The payment tests use the approved recipient string but fictional payer/package/price/transaction data, with no network requests or fund movement. Existing SQL-only accounting fixtures remain fictional and do not establish that the recipient has been configured in a deployed database. This patch does not migrate a database.

## Boundaries

The supplied address passes the code's canonical-format check (0x plus 64 lowercase hexadecimal characters). This is not independent proof of ownership or control. No verification payment was sent. No private key, recovery phrase, treasury signer, or wallet permission was requested.

The change is on `feature/canopy-credits-mainnet-ledger` in draft PR 20 only. `LIVE_CHECKOUT_ENABLED` remains false; draft orders remain `payable:false`; the live checkout entry point still throws. No game preview, central simulation service, environment variable, production branch, or 700-test-CC balance is changed by this patch.

This address is a receiving destination, not a payer allowlist entry or authorization to spend. Pricing, payer restrictions, purchase and aggregate caps, gas bounds, chain-reader integration, reviewed checkout deployment, production identity mapping/database provisioning, and recovery controls still need completion before a real monetary pilot. No mainnet transaction or public payment activation is authorized merely by recording this address.

The older validation report records the tests for its identified implementation commit. This patch adds three recipient-specific JavaScript checks to the existing suite; its run outcome must be checked separately rather than inferred from the earlier report.
