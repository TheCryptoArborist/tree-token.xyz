# Assembled native BNB checkout mount

November 25, 2026 (America/Chicago). Source-only, not published.

`browser/native-bnb-review-mount.mjs` supplies the explicit host mount for the
BNB review flow. It constructs the canonical authenticated transport, selected
wallet adapters, authenticated-context controller and DOM review controls. The
host supplies a dedicated root, existing session source and selected wallet
providers as documented in `bnb-context-wallets.md`. Nothing auto-mounts.

The returned `ready` promise resolves true only after context validation and
mounting; failures resolve false with a generic visible status. `destroy()`
removes only its owned container, invalidates the controller and removes wallet
subscriptions. If navigation occurs while loading context or waiting for a wallet,
late responses cannot mount controls or advance the review. The surrounding
checkout remains intact. This API does not own or destroy the host's wallet.

The mount has four review/signature buttons and no payment or approval control.
Its personal-message signatures remain subject to server verification. It does
not modify the native game's payment paths, scoring, tournament behavior or Sui
authentication. No chess source was touched; that work is outside this project.

## Validation

```sh
node --test tests/multichain-bnb-review-wallets.test.mjs tests/multichain-bnb-checkout-review.test.mjs tests/multichain-native-host.test.mjs
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-native-bnb-mount-browser.mjs
```

Use the existing pinned Playwright installation in vendor/continue-browser-test.
Passed 35 unit tests and six new Chromium checks. The browser checks exercise the
assembled production-source modules with injected server/wallet responses,
canonical URL and bearer transport checks, ordered signing/review, loading and
wallet-prompt teardown, generic errors and preservation of the host container.
All external browser requests are intercepted. No live endpoint, extension,
Ledger or chain transaction was exercised. Evidence: `bnb-review-mount-tests.json`.
CI includes the new browser rehearsal.

## Remaining work

Integrate this explicit mount with the current native frontend checkout entry
point and its actual session/provider lifecycle, preserving concurrent Treeforce
work. Complete pending-payment coordination and expired-session reconciliation,
provide the trusted checkpoint source, and review migration/drain and production
inventory before any release. Actual Slush/MetaMask/Ledger verification still
requires the canonical origin and a separately reviewed publication. This source
milestone does not authorize payments, gameplay activation or NFT movements.
Individual original artwork and one-to-one cross-chain custody requirements remain
unchanged.
