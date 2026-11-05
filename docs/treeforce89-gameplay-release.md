# TREE FORCE 0.6.0 production release

TREE FORCE ’89 is live at https://tree-token.xyz/play/treeforce89/ on locked Netlify deployment `6aec00c92d9060d410e986e0`, published November 5, 2026 at 04:34:36 UTC. The complete post-publication preservation check passed in GitHub Actions run [41968993436](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/41968993436). The sanitized release evidence is in `treeforce89-gameplay-published.json`.

## Result

The approved enemy attack variety, five-tier weapon progression, Windfall Gauntlet bonus stages and natural green pickup glow are now the canonical game. Red pointed enemy shots and the persistent collect/avoid legend distinguish hazards from items. Buy TREE and Back to Arcade navigation remain outside the canvas. The integrated NFTree wallet access panels are retained.

The native thirteen-file frontend overlay preserves the wallet configuration, dependency lock, account/session gating and seven original art files. Relative to the authorized production baseline, only index.html and gateway.css changed among existing paths, and three new hashed JavaScript paths were added. Every other current static path is preserved.

## Verification and preservation

The authorized baseline was locked deployment `6aebf70ad3b2d01755518023`, containing 43 functions and five schedules. Its original 41 function records were unchanged; arcade-social and arcade-campaign were already present before this release.

Preflight [41968460364](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/41968460364) passed 39 focused tests, the canonical build, complete static inventory and all function/runtime/schedule/environment comparisons before publication. No functions were uploaded or rebuilt; no environment values or migrations were changed. The reviewed candidate was forward-published through Netlify; no old deployment was restored and no pull request was merged.

Post-publication verification rebuilt the pinned frontend and confirmed the complete live static SHA-1 inventory, all 43 complete backend records, five schedules, runtime settings, API-visible environment fingerprints and deployment lock. Twelve frontend assets match their expected public bytes exactly. Served HTML matches the reviewed file after accounting for the byte-identical pre-existing sitewide Arboretum snippet; the stored HTML digest also matches exactly. The snippet is inert on the game path.

The canonical status endpoint reports schemaReady, isolationVerified and paymentSchemaReady. Unauthenticated run creation is denied. **Paid continues remain disabled** (`paymentsEnabled: false`), preserving the existing server flag. This release does not enable 20,000 TREE payments. No real wallet signature, NFT-holder session or payment was performed by these release checks. Masked secret bytes and deploy-specific overrides are not observable through the inventory API.

The canonical home was also inspected in the browser after publication. The Connect Sui wallet panel, Buy TREE, Back to Arcade and collect/avoid legend render without home-screen overlap. The candidate wallet picker exposed Slush, Suiet, Nightly and Backpack publisher links; this browser has no installed Sui wallet.

## Reproduction

`node scripts/prepare-treeforce89-gameplay-release.mjs` builds the approved native overlay from pinned source and verifies art hashes. Its output is an overlay, never a standalone complete-site upload.

`scripts/lib/treeforce89-production-inventory.mjs` captures the complete protected inventory using only the Actions environment credential, without reading local credential files. `scripts/release-treeforce89-gameplay.mjs published` performs read-only verification against the captured candidate evidence. The candidate workflow is pinned to the previous production baseline and must not be reused to create another release without a fresh authorized baseline.

Current MystenLabs guidance reviewed live for this release: `README.md`, `frontend-apps/SKILL.md`, `frontend-apps/react.md`. The pinned dApp Kit client boundary is retained; this release includes no SDK, signing or contract migration.
