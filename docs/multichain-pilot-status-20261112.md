# NFTree multichain pilot — November 12, 2026

## Current status: published and verified

Live test page: https://tree-token.xyz/play/multichaintest/

Published at **21:46:44 UTC / 3:46:44 PM Central on November 12, 2026**. Netlify deploy `6af6339b098ffae9bfb4e692` is ready, published and locked. Release source: `54921f6f4359ef94b1522c32f6a53fcde4823beb`.

The pilot remains isolated on `pilot/nftree-multichain-20261112`, draft PR #151. It was not merged into main. The page was created from scratch; no prepared page was required.

## Authentication resolved

Peter updated the TREE repository's encrypted `NETLIFY_AUTH_TOKEN` secret. TREE-only diagnostic run `43311624068` then passed user authentication, site access, full deployment inventory access and protected file inventory access, all with HTTP 200. The previous authentication blocker is resolved; no further credential change is needed for this publication.

Evidence: `docs/multichain-auth-restored-20261112.json`. Earlier failed-authentication reports are historical, not the current status.

## What is available to test

Choose Robinhood Chain, BNB Smart Chain, Base, Solana or Sui; grant simulated access; then launch the isolated Tree Force '89 copy. The pilot displays the proposed chain-specific pass and continue pricing, but charges nothing.

The Test controls & results section can trigger a continue without waiting to lose all three lives. Successful simulated continues restore three lives while retaining score and wave. Cancellation and failure grant no lives. Reset destroys the copied game and resets pilot access.

The page is explicitly **simulation only**. Real wallet connections, signatures, token approvals, NFT ownership verification, pass minting, payment processing and production leaderboard submissions are not connected. No contract was deployed and no wallet transaction was performed.

Game source is pinned to `TheCryptoArborist/treeforce89@87bca303eb84c38599b186defa23844134f2b1f2`; the live game was not modified. Pilot scripts, game bundle and assets are contained under `/play/multichaintest/`.

## Preservation verified

The release captured baseline `6af4ef567e67ea8af9abe8ed` and added only **13 new static paths**, for **526 total**. All **513 pre-existing static paths**, all **49 complete backend function records**, all **five schedules**, runtime/region configuration, build settings and protected environment fingerprints were preserved. Existing games, test routes, wallet integrations and site snippet configuration were unchanged.

An existing Netlify-injected Arcade link snippet changes delivered HTML without changing stored file hashes. The release verifier recognizes only that exact inspected snippet by SHA-256; all new pilot HTML beyond that insertion and every other new asset are still checked byte-for-byte. The new pilot permits exactly one insertion. A pre-existing duplicate on the untouched lobby was not removed or changed.

## Validation completed

Successful workflow: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/43313284565

All eight unit/isolation tests passed. Chromium browser checks passed on the local build, the immutable deployment candidate, and the actual `https://tree-token.xyz` origin at 1280 x 1000, 390 x 844 and 375 x 812.

Checks covered all five chain choices, actual game load/start, simulated success/cancellation/failure, score/wave retention and reset. No horizontal overflow, page errors, wallet-provider accesses or forbidden external/API requests were detected. The canonical desktop and small-mobile screenshots were reviewed. Canonical browser verification completed at `2026-11-12T21:47:13.043Z`.

This is browser-flow validation, not a test of real blockchain integrations, physical mobile-wallet browsers, payment receipts, or a full-game victory playthrough.

Release manifest and validation record: `docs/multichain-pilot-release-20261112.json`. Full 526-path manifest, browser reports and screenshots are in workflow artifact `13987162211`, SHA-256 `14417ad6e8e0e022fc1c3f6af5264acee6ad59f395aee5e8404eed76c316c006` (retention until December 12, 2026).

## Next stage

The immediate next step is Peter's desktop/mobile review of the published simulation. Real-wallet connectivity, chain configuration, secure ownership/entitlement checks, payment receipt validation and on-chain deployment remain separate future work. Do not enable real payments or deploy contracts without the required authorization and validation.

Future releases must capture a new live inventory; the old first-install publisher intentionally refuses to overwrite existing pilot paths or use a changed baseline. Do not run a historical root snapshot build as a replacement for the live site.

## Guidance consulted

Current MystenLabs/skills README, `frontend-apps/SKILL.md` and `frontend-apps/limitations.md`; repository preservation guidance; Netlify deployment coding context. No live Sui SDK migration or wallet rewrite was performed.
