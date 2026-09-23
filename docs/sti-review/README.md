# Native STI widget and purchase preview

## Current reconciliation — 2026-09-23

Current `main` (`506edda`, PRs #30/#31) is merged into `feature/sti-tree-stats`. Native STI purchase code and its reviewed security decisions are preserved. Production V3 combined volume, Knowledge Trial purchase verification, the current homepage/assets and the published backend inventory remain intact.

Production verification/build now reproduces the current 189-file baseline. The feature build outputs 191 files to `dist-preview/`, with four explicit frontend overlays and two STI modules. Four baseline source copies are archived without changing their published digests. Preview hosting uses a separate GET-only public-data proxy; it never rebuilds historical backend source or invokes production jobs. Backend writes and Knowledge Trial submissions are unavailable in the review preview. See `production/README.md` for the release boundary. The reports and preview URLs below are historical evidence from the earlier review, not verification of this merged candidate.

Run the source/core command below, `node --test tests/sti-preview-build.test.mjs tests/sti-preview-proxy.test.ts`, and the production V3/Knowledge Trial safeguards. Browser suites are `sti-native-browser.mjs`, `sti-header-wallet-browser.mjs`, and `sti-wallet-bootstrap-browser.mjs`. They accept `STI_PREVIEW_URL`, `STI_QA_OUTPUT`, `PLAYWRIGHT_MODULE`, `CHROME_PATH`, and optional `STI_TEST_PROXY`. For local review, run `node tests/serve-sti-preview.mjs` after building the candidate.

## Earlier native review

The external iframe has been replaced by TREE-owned HTML and JavaScript. The new card uses STI's public feed, identifies STI as independently operated, and opens a purchase panel inside the Stats section. It has no external navigation link or automatic redirect. Wallet connection and approval may open the user's wallet.

Preview: https://6ab20b357712f7a0f83335ab--tree-token.netlify.app/dapp/#stats

Branch: `feature/sti-tree-stats`. No production promotion has occurred.

## Purchase scope

SUI → STI, through the single verified Cetus STI/SUI pool. This version does not implement basket minting, selling, redemption, or claim to find the cheapest route across those options. That limitation appears in the purchase panel. The pool charges 0.25%; TREE adds no fee. Quotes include the pool fee, disclose estimated and minimum STI, apply 1% slippage protection, and reject price impact above 3% (including the pool fee). Gas is additional; 0.1 SUI must remain available and transaction gas budget is capped at 0.05 SUI.

The STI site's published app supplied the initial token and pool identifiers. These were independently checked through Sui Mainnet, including token metadata, pair, pool availability, and fee. `native-pool-verification.json` records the returned state. The code uses these fixed identities:

- STI: `0x054e8315e419c9768faf889e36a0a12c90287e14669903f20f92f0ce9a8013c2::sti::STI`, 9 decimals.
- Pool: `0xc9fb86078a0e88c31cee675386047edcb29b5a1f5ebe6358a968f1f816e9caa4`.
- Cetus configuration: `0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f`.
- Entry point: `0xae9c208cf58fd5ba36737c9ee5dcfa7f152d0fb5a5a99eebb7c881ebc2fe59e0::pool_script_v2::swap_b2a`.

The transaction is built locally with an empty STI coin, an exact SUI split from gas, and the fixed Cetus swap call. No transaction bytes, recipient address, Move targets, or pool identities are accepted from STI's data feed. Cetus transfers outputs to the sender. Minimum output is enforced by the on-chain swap call.

Before wallet approval, the app rechecks wallet identity, amount, quote age (30 seconds), and live SUI balance, builds and simulates the exact transaction, verifies STI received by the buyer and bounds SUI spending, then passes those same resolved transaction bytes to TREE's existing mainnet wallet connector. Quote/account changes or failed simulation prevent signing. Buttons prevent duplicate submissions; a returned transaction ID remains pending until finality is checked, so a delayed confirmation does not trigger another purchase. Wallet rejection clears the quote and does not retry automatically.

## Data and code trust

Only JSON is fetched from `https://sti-keeper-production.up.railway.app/badge`, with credentials omitted and no referrer. The widget uses the full TREE coin type, validates fields and a five-minute freshness window, and writes display values with `textContent`. Failed/stale feeds show unavailable values, not old membership claims. Pool quotes are independent of that informational feed.

The widget no longer loads STI's iframe, its executable scripts, Google Fonts, or Cloudflare telemetry. The original review and source captures remain in `original-embed-review.md` and related files as historical evidence, not the current implementation.

Purchasing lazily loads versioned SDK modules from `esm.run`: Mysten Sui 2.23.1 (transactions and gRPC) and Cetus CLMM 1.4.7. These are the SDK versions already used by the site's transaction integrations. The CDN and transitive dependencies remain part of the code trust boundary; no claim of complete transitive integrity pinning is made. Chain identity and STI metadata are checked against the fixed public Sui Mainnet gRPC endpoint before quoting/purchasing. The native card's local TREE logo avoids arbitrary upstream image URLs.

## Verification

- 11 new/updated source and core tests pass: placement and ownership; removal of external embed/navigation; precise amounts; wrong token/pool/fee and paused pool rejection; exact input/minimum output; high price impact; stale/changed quotes; gas reserve; malformed/stale feed and membership changes; fixed transaction construction; simulated output, recipient and spending checks.
- Existing Stats supply and NFTree tests pass; feature build produces 168 files (166 baseline plus two explicitly listed modules).
- Unsigned mainnet simulations for 0.001, 0.1 and 1 SUI succeeded with sufficient STI credited to the test address. This address is public and was used only as a simulation sender; no key or wallet was accessed. Details in `native-simulations.json`.
- Chromium browser checks pass at 1440×1000, 390×844 and 320×740, including actual live pool quotes, card placement, no page overflow, no STI iframe/scripts/telemetry, no new tab or navigation, amount-edit invalidation, quote expiry, routing back to Stats, and feed failure with independent quoting.
- A non-signing browser wallet stub received the resolved transaction only after a successful real mainnet simulation, then rejected it. The UI handled cancellation correctly. No transaction was signed, submitted, or paid for. Real user wallet approval and successful settlement are not claimed as tested.
- Screenshots were inspected. See `native-mobile-purchase.png`, `native-desktop-card.png`, and `native-browser-report.json`.

Run `node --test tests/stats-sti-source.test.mjs tests/sti-purchase-core.test.mjs tests/stats-live-supply-source.test.mjs tests/stats-nftree-source.test.mjs`, then `npm run build:preview`. For browser QA, run `tests/sti-native-browser.mjs` with `STI_PREVIEW_URL`; optional `PLAYWRIGHT_MODULE`, `CHROME_PATH`, and `STI_QA_OUTPUT` select the installed test runtime and output path.

## Deployment boundaries

The draft preserves the current production inventory and changes only `/dapp/index.html`, `/dapp/styles.css`, plus new `/dapp/sti-widget.js` and `/dapp/sti-purchase-core.js`. One preview-only `_redirects` file forwards existing GET-only Stats endpoints. Total preview files: 169. No functions were deployed or rebuilt. Other server-dependent features are not a complete preview backend.

Production deployment `6aad931f45a27f392303e229` remains locked, and all 35 backend function identities were verified unchanged. Production manifests intentionally remain the published baseline. Feature previews use `build:preview`; production snapshot verification is not a feature-release build. The previously documented unrelated legacy navigation assertion remains outside this change.

Production promotion remains a separate decision after this preview review, using the existing workflow that preserves unrecovered backend packages.
