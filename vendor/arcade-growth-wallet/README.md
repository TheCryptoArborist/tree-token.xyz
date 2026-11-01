# Daily Growth wallet adapter

This small, separately bundled adapter connects an installed Sui wallet and requests only the exact personal message issued by `/api/arcade-growth`. It never builds, signs, or submits a transaction. Existing NFTree mint, game, and dapp wallet code is unchanged.

The dependency pins are shared with the reviewed `../nftree-mint/package.json` and `../nftree-mint/package-lock.json`: Wallet Standard `0.21.18`, core `1.1.2`, and the exact Vite build recorded there. The build validates installed versions, operates in a new temporary directory, includes dependency licenses, and emits only `assets/arcade/arcade-growth-wallet.js` without a source map.

Build using the existing isolated dependency installation:

```sh
node scripts/build-arcade-growth-wallet.mjs /tmp/arcade-nftree-vendor-build/node_modules
```

The module exports `getWalletState`, `getAvailableWallets`, `connectWallet`, `restoreWallet`, `disconnectWallet`, `signPersonalMessage`, `subscribeWalletState`, and `subscribeWallets`. Restore is silent and requires the saved wallet name and exact account. Account changes, wallet removal, and stale asynchronous results invalidate the active connection. The backend independently verifies the signature and current NFTree ownership.
