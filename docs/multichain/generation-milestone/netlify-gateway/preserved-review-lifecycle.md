# BNB review lifecycle in the preserved r19 runtime

November 25, 2026. Source/test milestone only; no deployment or activation.

A fresh cloud instance restored feature commit a19261ce from GitHub. The working
tree was clean, origin/main was cf50c6a56d9b1616bb0d0771d5ccfca70f850feb, and the
feature branch contains the required 462ff86 ancestor. The canonical 25-path
capture passed its existing hashes and concurrent-release checks. This focused
capture does not establish a complete production inventory or deploy lock.

`check-preserved-bnb-review-browser.mjs` now runs the review wrapper within the
actual preserved r19 React/game runtime, with synthetic Wallet Standard and
EIP-6963 providers and locally intercepted native/BNB API responses. Every
unrecognized request is aborted and fails the test. Transaction methods throw.
No private keys, real signatures, wallet extensions or production API writes are
used. Image/font responses are stubbed.

The normal candidate remains hard-disabled. The test checks its entry hash, then
changes only the browser-intercepted entry response to enable review and expose
a callback that opens checkout from the authenticated gateway. Unique anchors
are required. This callback bypasses game-over mechanics solely for this test;
it is never written to the candidate, generator or production source. The entry
hash is checked again at the end. There is no URL/storage flag enabling review.

Nine checks passed: artifact integrity plus four scenarios at 390px and 1000px:

- Complete review: native sign-in, explicit BNB provider selection, challenge,
  separate Sui/BNB personal-message signatures, then verified 1 USDT terms with
  payments disabled. Closing removes the provider listeners.
- Close while Sui signing is pending: the late signature cannot submit BNB
  verification or restore controls.
- Switch Sui account while signing is pending: native account handling unmounts
  checkout; the late signature cannot submit verification or restore controls.
- Change BNB account while its signature is pending: provider selection is
  invalidated and review controls/listeners are removed; the late signature
  cannot submit verification.

Assertions enforce the exact context/challenge/open request sequence (open only
in the completed case), zero transaction requests, the wallet-method allowlist,
no remaining EVM listeners, no page exceptions and no unexpected network calls.
Twelve offline preservation tests also passed. Machine-readable evidence is in
`preserved-review-lifecycle-tests.json`.

## Fresh cloud setup and reproduction

```sh
git clone --filter=blob:none --branch feat/bnb-generation-custody https://github.com/TheCryptoArborist/tree-token.xyz.git tree-bnb-generation
cd tree-bnb-generation
npm ci --ignore-scripts --cache /workspace/npm-cache
npm ci --prefix vendor/continue-browser-test --ignore-scripts --cache /workspace/npm-cache
NODE_USE_ENV_PROXY=1 node scripts/multichain/prepare-preserved-bnb-review.mjs /tmp/new-bnb-preserved-candidate
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-preserved-bnb-review-browser.mjs /tmp/new-bnb-preserved-candidate
node --test tests/multichain-preserved-bnb-review.test.mjs tests/multichain-native-frontend-release.test.mjs
```

Use a fresh output path. Capture deliberately stops on canonical drift; review
and repin the newer release rather than bypassing the guard. The root build is
not part of this process and must never replace the current site.

## Remaining work

Successful native paid restoration using local fixtures is the next regression
step. Real extension interaction, actual artwork/media and complete game behavior
remain untested here. Any later canonical publication requires a freshly verified
full static/backend/runtime/schedule inventory and deploy lock. Payment activation
still requires backend migration, trusted checkpoint evidence, legacy-writer
drain, cross-payment coordination and expired-session recovery review. Existing
Sui payments, games, scoring and tournaments were not modified. No NFT, custody,
contract, sale or gameplay setting changed.
