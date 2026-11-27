# Native payment recovery and game restoration regression

November 27, 2026. Local fixtures only; nothing published or activated.

The feature checkout was clean at 85e413963d0e5bac156c5cccb5c7f99f2db72387;
fetched origin/main remained cf50c6a56d9b1616bb0d0771d5ccfca70f850feb. A fresh
canonical capture passed all existing r19 hash and concurrent-release checks.
This is a focused frontend capture, not a full deployment inventory or lock check.

`check-preserved-native-restoration-browser.mjs` compares the captured game with
the disabled BNB candidate at 390px and 1000px. A synthetic Wallet Standard
provider signs in against intercepted API fixtures. The test seeds a saved
native payment receipt and uses the real recovery and Resume buttons. Every
unrecognized request is aborted; wallet transaction methods throw. No request
is forwarded to a live backend or chain.

Five checks passed: artifact integrity plus valid/invalid recovery at both widths.

- Valid authorization shows the native confirmation screen. The receipt remains
  saved until the user explicitly resumes. On resume, the actual Phaser scene
  has three lives, score 1234, wave 2, and the exact authorized run ID, seed,
  kills, perfect count, growth stage, shots fired/hit, start and mode. Only then
  is the payment recovery record cleared and checkout removed.
- A grant with four lives is rejected as invalid. No Resume button appears and
  the saved receipt remains recoverable.
- Both scenarios subsequently switch accounts and verify native session teardown.
  Only challenge, session, recovery and logout fixture requests occur. Each run
  uses one synthetic login signature and zero transaction requests. No BNB
  controls or requests, page exceptions or unexpected network calls occur.

The test adds an observation-only assignment to the browser-intercepted entry
response to expose the created game instance. It does not change authorization,
resume inputs or saved candidate bytes. A unique anchor is required. Images and
fonts are stubbed. This proves local saved-payment recovery and actual scene-state
restoration; it does not verify on-chain payments, new purchase signing, real
wallet extensions, artwork or complete game mechanics. Browser run fields are
presentation state, not server reward/checkpoint evidence.

Twelve offline preservation tests also passed. Results and entry hashes are in
`preserved-native-restoration-tests.json`.

## Reproduce

Use the fresh-cloud dependency setup in `preserved-review-lifecycle.md`, then:

```sh
NODE_USE_ENV_PROXY=1 node scripts/multichain/prepare-preserved-bnb-review.mjs /tmp/new-bnb-preserved-candidate
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-preserved-native-restoration-browser.mjs /tmp/new-bnb-preserved-candidate
node --test tests/multichain-preserved-bnb-review.test.mjs tests/multichain-native-frontend-release.test.mjs
```

Use a fresh output directory and stop on canonical drift. Do not replace the
current site with a historical build or treat this focused capture as release
permission.

## Next work

Review the combined frontend/backend launch gates and prepare a concrete,
source-backed integration checklist for the next isolated milestone. Real wallet
extension testing, artwork/media checks and full production preservation remain
open. Payment activation still depends on backend migration, trusted checkpoint
evidence, legacy-writer drain, cross-payment coordination and expired-session
recovery. Existing Sui gameplay, payments, scoring, tournaments and NFT custody
were not changed. The BNB review candidate remains hard-disabled.
