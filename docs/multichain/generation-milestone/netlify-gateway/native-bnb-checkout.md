# Native session bridge for BNB checkout

November 24, 2026 (America/Chicago). Source and disposable local tests only.

`createNativeBnbCheckout` connects the existing BNB coordinator and PostgreSQL
store to the recovered native session adapter with `tree-paid-delivery.v2` fixed
by trusted server code. It derives account/run identity from the native bearer,
checks runtime provenance and current NFT entitlement, and requires a reviewed,
hash-matching, zero-life checkpoint with the current continuation number and
valid native snapshot before issuing a wallet-link challenge or opening a quote.
The store rechecks admission under its transaction's native session row lock.
No browser account/run identifier or protocol selects this binding.

The integration test uses actual native session tables and shared mappings,
real signatures from disposable Sui/EVM test keys, and synthetic finalized BNB
receipt evidence. It covers malformed credentials, missing/bad-hash checkpoints,
lost entitlement before challenge/open, challenge replay, receipt reconciliation
after entitlement loss, and idempotent import into the shared gateway. Verification
and import leave the native continuation counter unchanged. Existing tests cover
settlement and restoration separately; this does not establish wallet/RPC E2E.

Setup uses existing pinned dependencies (`npm ci --prefix vendor/bnb-continue-store
--ignore-scripts`) and PostgreSQL binaries. The native checker also needs the
repository's pinned Sui/viem packages. With relocated binaries, set BNB_PG_BIN
and BNB_PG_SHARE. Run:

```sh
node --test tests/multichain-sui-bnb-continue.test.mjs
NETLIFY_CONTINUE_SCHEMA=1 NATIVE_BUNDLE_CHECK=1 CONTINUE_PHASER_CHECK=1 CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-native-sui-session-postgres.mjs
node scripts/multichain/check-native-sui-session-postgres.mjs
```

Phaser/bundle checks use the pinned dependencies in vendor/continue-browser-test.
Results are recorded in `native-bnb-checkout-tests.json`. CI includes this new
bridge in its path filters and runs the database checker in both permission models.

## Remaining work

- Wire challenge/open/reconcile through authenticated, strict HTTP boundaries and
  canonical checkout UI, with real wallet/RPC integration tests.
- Provide the trusted reviewed-checkpoint source and production runtime proof;
  missing checkpoint evidence continues to deny checkout.
- Complete cross-payment pending-state coordination and fresh-login reconciliation
  for a paid BNB checkout whose original session has expired, before activation.
- Review hosted schema migration, legacy-writer drain and fresh production
  preservation inventory before any separately authorized publication.
- Preserve the individual original/artwork requirements in
  `../individual-inventory-requirements.md`; inventory expansion and pass metadata
  remain separate contract launch gates.

The factory is not registered on live HTTP routes. Payment responses remain
review-only with paymentEnabled=false; no wallet send, hosted migration,
deployment, NFT deposit, sale or gameplay activation occurs in this milestone.
