# TREE Arcade — NFTree access and inline mint

## Intended result

The `/play/` hero explains access immediately: **Your NFTree is your arcade pass.** Visitors can mint from the official sales pools on the arcade page, buy a specific NFTree on the official TradePort collection, or skip directly to the game lineup when they already own one.

The inline panel is collapsed by default. Opening it loads the wallet adapter and live sales-pool inventory. The normal arcade page does not connect a wallet or load the wallet bundle. Each mint link retains the official NFTree mint URL as a progressive fallback when JavaScript is unavailable.

The eight existing game posters retain their grouping and destinations. TREE FORCE ’89 remains LIVE in red; Arboretum remains PREVIEW / VIEW PREVIEW. Two standalone coming-soon slots remain above the four Garden Battles modes.

## Purchase flow

1. Read current price, available inventory, and the network gas budget from the official integration.
2. Explicitly connect a compatible Sui wallet.
3. Review one NFTree, the SUI price, maximum gas budget and maximum total, and the exact purchasing wallet.
4. Acknowledge that artwork and rarity are revealed after purchase.
5. Request approval in the wallet. Fresh checks precede this request; a changed price or pool requires a new review and acknowledgement.
6. Show success only after confirming the exact purchase transaction and NFTree ownership. A pending or unknown response offers read-only status checks and never automatically submits a replacement purchase.

The panel explains that some modes charge separate entry fees, Garden Battles practice is available without an NFTree, previews are still in development, and TREE FORCE ’89 currently recognizes NFTs held directly in the wallet rather than in a Sui Kiosk.

## Integration and boundaries

- Public inventory: `https://nftree.net/api/nftree-sale-pools`.
- Official fallback: `https://nftree.net/mint#mint`.
- TradePort links use the collection's exact type identifier and items tab.
- Wallet code is adapted from `TheCryptoArborist/nftree_landing` at `f8f014c2869dbaed04735c43f94d01a1a818abaa`.
- Sui SDK 2.26.2 and wallet-standard 0.21.18 retain their upstream lockfile in an isolated vendor build. Root dependencies and the site's existing wallet integrations are unchanged.
- See `vendor/nftree-mint/README.md` and `provenance.json` for upstream blob identities, the scoped account/receipt guards, dependency notices, and reproducible build instructions.

Inventory fails closed on stale, inconsistent, incomplete, fallback, or unrecognized contract data. Review and signing require the exact connected account. A durable pending record is saved before requesting a signature, and a returned digest is saved before receipt checks. Storage failures pause purchasing. Cross-tab locking and stored pending records prevent accidental repeat submissions. Browsers without the Web Locks API receive the official mint fallback and cannot initiate an inline purchase; existing purchases can still be checked. Unknown wallet responses remain unresolved across reloads. A manually entered digest can be corrected while the purchase remains pending; a digest returned by the wallet cannot be replaced.

Receipt checks verify the digest, sender, package, pool, configuration, exact payment, transaction success, one matching NFT output, an indexed checkpoint, and current direct ownership. Failed receipts also need the matching purchase scope before the pending record can clear. A manual status lookup does not purchase an NFT.

## Verification

All **34 focused checks passed**: 17 core tests and 17 isolated controller DOM tests. The core tests cover malformed/stale inventory, changed price/pool/account, insufficient balance, account changes during asynchronous work, duplicate clicks, cancellation, persistence failures, unknown submission results, reload recovery, immutable wallet digests, correctable manual digests, and receipt ownership checks. The actual-controller tests exercise separate connect/review/acknowledge/sign actions, price-change acknowledgement resets, pending recovery, visible storage failures, unavailable wallet/module states, and cross-tab exclusion. An unsupported-browser race found during review is covered by a regression that verifies two tabs cannot initiate inline purchases without the atomic browser lock.

Run the core suite with `node tests/arcade-nftree-access-core.test.mjs`. The DOM suite uses an isolated install of `jsdom@26.1.0`, without root dependency changes:

```sh
npm install --prefix /tmp/tree-arcade-ui-testdeps --ignore-scripts --no-audit --no-fund jsdom@26.1.0
ARCADE_DOM_TEST_DEPS=/tmp/tree-arcade-ui-testdeps node --experimental-vm-modules tests/arcade-nftree-access-ui.test.mjs
```

Local browser review confirmed the desktop hero, inline panel, no-wallet fallback, and live cross-origin inventory. At the October 31, 2026 review, the live panel displayed **25 SUI** and **3,561 available**; these are observations, not hard-coded display values. The gas budget is **up to 0.12 SUI**, shown separately from the NFT price.

Responsive review at 390, 320, 768, and 1110 CSS-pixel frame widths found no horizontal overflow. Hero actions have at least 44-pixel heights. Phone mint statistics stack vertically; narrow layouts preserve all labels and buttons. Actual content widths are 15 pixels smaller where the review browser reserves scrollbar space.

Keyboard Escape closes the mint panel, restores focus to its trigger, and updates all expanded-state attributes. An unavailable wallet displays the official mint fallback and disables purchase review.

The receipt verifier also accepted an existing public purchase, `Da64RXmgZQDzdUqyi7PD2nJhKTeB3KgHJj9VxZn8q8y4`, obtained from Pool 1's last transaction. It matched the expected purchase scope and the actual wrapped-NFT ownership-change shape. A fresh object read independently verified direct ownership. See `arcade-nftree-access-receipt-validation.json`. The historical receipt was retrieved with the pinned SDK's GraphQL client because the public gRPC fullnode had pruned it; this check does not claim an end-to-end test of new signing or gRPC checkpoint confirmation. Very old unresolved purchases may remain pending when public history is unavailable.

No real wallet was connected, no signature requested, and no purchase submitted by the assistant. Mock flow tests and public reads verify the implementation without claiming a real-wallet purchase was exercised.

## Bounded release

The release script starts from published deployment `6ae630e786bec27734f72e9e` and changes only:

- `/play/index.html`
- `/styles/tree-arcade-suite.css`

It adds only:

- `/assets/arcade/nftree-wallet-mint.js`
- `/scripts/arcade-nftree-access-core.mjs`
- `/scripts/arcade-nftree-access.js`

The expected inventory is 235 public files with 230 baseline paths unchanged. All 39 backend function records, five schedules, runtime configuration, existing isolated database identity, enabled TREE FORCE paid continues, and publication lock are preserved. No backend rebuild or database migration is part of this change.

Publication evidence belongs in `docs/arcade-nftree-access-published.json`, written only after the release is verified on the canonical domain.
