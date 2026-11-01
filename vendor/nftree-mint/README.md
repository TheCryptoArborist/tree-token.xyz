# Pinned NFTree wallet module for TREE Arcade

Upstream: https://github.com/TheCryptoArborist/nftree_landing/tree/f8f014c2869dbaed04735c43f94d01a1a818abaa

`upstream-wallet-mint.js`, `package.json`, and `package-lock.json` are byte-exact copies of that commit. Their Git blob identities are recorded in `provenance.json`. The project root dependency manifest and lockfile are not used or changed.

## Scope of the adaptation

`wallet-mint.js` retains the upstream wallet discovery, connection, account restoration, balance reads, gas budget, transaction construction, modern Wallet Standard signing feature, and existing legacy signing fallback. The changes are limited to:

- An optional synchronous `assertBeforeSign` callback and an exact active-account guard before/after asynchronous balance or serialization work and immediately before the wallet signing call.
- Coded pre-sign errors so the controller can distinguish a blocked request from an ambiguous submitted purchase.
- `confirmMintReceipt(expected)`, implemented in `receipt.mjs` using the same pinned Sui SDK. It performs public reads only.

Receipt verification checks the requested digest, sender, original two-command purchase, latest package, selected pool, mint configuration, and exact payment. Both the successful and failed transaction branches must pass those scope checks. Successful receipts additionally require exactly one NFTree ownership change to the payer, an indexed checkpoint in the submission time window, and a fresh object read proving direct ownership. Missing, mismatched, timed-out, or otherwise unverified receipts remain pending. They never authorize an automatic replacement purchase.

The page-level coordinator is `scripts/arcade-nftree-access-core.mjs`. It rejects unverified or stale inventory; requires fresh review if price, pool, or wallet changes; persists an intent before asking the wallet to sign and a digest before confirmation; and permits only status checks while an unresolved purchase exists. The DOM controller owns visible acknowledgement, wallet connection, storage, and tab coordination.

## Rebuild without changing root dependencies

Use an isolated temporary copy of this directory, outside the project dependency tree:

```sh
mkdir -p /tmp/arcade-nftree-vendor-build
cp vendor/nftree-mint/package.json vendor/nftree-mint/package-lock.json vendor/nftree-mint/wallet-mint.js vendor/nftree-mint/receipt.mjs vendor/nftree-mint/vite.arcade.config.mjs vendor/nftree-mint/build.mjs /tmp/arcade-nftree-vendor-build/
cd /tmp/arcade-nftree-vendor-build
npm ci --ignore-scripts --no-audit --no-fund
node build.mjs
```

The build uses the upstream lockfile: `@mysten/sui` 2.26.2, `@mysten/wallet-standard` 0.21.18, and Vite 8.2.2. Initial validation used Node 24.22.1. No dependency lifecycle scripts are needed.

Copy only `build/nftree-wallet-mint.js` to `assets/arcade/nftree-wallet-mint.js`. `build.mjs` folds dependency license notices into the JavaScript comment header and removes the intermediate license file. There is exactly one public vendor output, with no source map or additional public license route. This vendor directory and its package metadata are not public deployment overlays.

## Verification

```sh
node tests/arcade-nftree-access-core.test.mjs
node --check scripts/arcade-nftree-access-core.mjs
node --check assets/arcade/nftree-wallet-mint.js
```

The offline tests exercise fail-closed data loading, changed reviews, exact-account races, insufficient balance, concurrent clicks, storage failures, cancellation, ambiguous wallet responses, reload recovery, supplied-digest validation, and receipt/ownership checks. No real wallet, purchase, signature, or deployment is exercised by these tests.

Pinned SDK receipt shapes were inspected in `@mysten/sui` 2.26.2 `docs/clients/executing.md`, `src/client/types.ts`, `src/client/core.ts`, `src/grpc/core.ts`, and `src/transactions/data/v2.ts` from the isolated install. This does not migrate the site's other Sui integrations.
