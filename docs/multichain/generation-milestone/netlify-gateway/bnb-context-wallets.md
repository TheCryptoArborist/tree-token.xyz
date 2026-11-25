# Authenticated context and wallet adapter assembly

November 25, 2026 (America/Chicago). Source only; no published route or wallet call.

`shared-continue-bnb-context` is a proposed bearer-authenticated POST action with
an exact empty JSON body. The host resolves the native session, runtime identity,
NFT entitlement and reviewed zero-life checkpoint using the same native BNB
bridge as challenge admission. It returns mapped account/run, native run, Sui
wallet, next sequence, native expiry and Sui network. The response contains no
bearer or checkpoint and forces the existing review-only flags. Mapping creation
may persist the existing native identity binding; this action does not create a
quote, payment record or game grant. Missing checkpoint/ownership denies access.
Default legacy mode and the shared cutover guard continue to block the action.

`browser/bnb-review-wallets.mjs` adapts the host's already-selected wallets:

- Inject `getSui()` returning the actual Wallet Standard `{wallet,account,network}`
  and `subscribeSui(listener)` returning an unsubscribe function. Notify on wallet,
  account, network and disconnect changes, including switching away and back.
- Inject the selected MetaMask/EIP-1193 provider with request/on/removeListener.
  The adapter subscribes to accountsChanged, chainChanged and disconnect.
- Sui uses only `sui:signPersonalMessage` with the selected account and Uint8Array.
  BNB uses `personal_sign` with UTF-8 hex message and lowercase selected address.
- Both check selected accounts/network before and after signing. Event epochs
  invalidate a signature even if an account switches away and back. Teardown
  removes listeners and invalidates in-flight work.

No connection prompt, provider discovery, network switching, transaction signing,
transaction sending or token approval is added. Wallet Standard account objects
must be the actual connected account objects, not reconstructed copies.

`browser/bnb-connected-review.mjs` prepares the existing review controller by
reading the authenticated context over `createNativeContinueTransport`, checking
native run/expiry/Sui wallet against the active session and selected wallets,
and retaining a context bound to the session and wallet epoch. The native session
source must expose sessionToken/nativeRunId/epoch/expiresAt exactly as used by the
existing transport; it is not read from URL parameters. The returned controller
can be passed to `mountBnbCheckoutReview`. The host still owns its session source,
wallet selection/subscriptions and mounting lifecycle. These components are not
mounted in the published game.

## Verification

Current MystenLabs README and frontend personal-message guidance were refreshed;
the installed Wallet Standard feature declaration was checked. Dependencies and
existing Sui integrations remain unchanged.

```sh
node --test tests/multichain-bnb-review-wallets.test.mjs tests/multichain-bnb-checkout-review.test.mjs tests/multichain-native-composition.test.mjs tests/multichain-native-host.test.mjs tests/multichain-native-gateway.test.mjs
NETLIFY_CONTINUE_SCHEMA=1 NATIVE_BUNDLE_CHECK=1 node scripts/multichain/check-native-sui-session-postgres.mjs
node scripts/multichain/check-native-sui-session-postgres.mjs
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-bnb-checkout-review-browser.mjs
```

Use the existing PostgreSQL and browser setup in `native-bnb-checkout.md` and
`bnb-review-ui.md`; relocated PostgreSQL needs BNB_PG_BIN/BNB_PG_SHARE. Passed:
66 unit tests, 43 Netlify-mode database/bundle checks, 40 restricted-role checks,
and six Chromium review-control regression checks. Adapter fixtures produce real
disposable-key signatures checked by the existing server verifier. Database chain
evidence remains synthetic; Chromium uses injected adapters. No actual Slush,
MetaMask or Ledger extension interaction was tested. Machine-readable evidence:
`bnb-context-wallet-tests.json`.

## Remaining launch gates

Mount the assembly with the existing native session and selected-wallet providers;
exercise Slush/MetaMask/Ledger on the canonical origin under a separately reviewed
publication. Pending-payment/cross-payment coordination, expired-session BNB
reconciliation, the trusted production checkpoint source, migration and legacy
writer drain still require completion before live payments. Capture the current
production inventory before any authorized release. Unique original artwork,
individual custody identity and one global allocation per original remain
separate inventory/contract launch gates.
