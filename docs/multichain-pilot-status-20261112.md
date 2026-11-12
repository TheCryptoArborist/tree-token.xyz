# NFTree multichain pilot — November 12, 2026

## Status

Built and tested on isolated branch `pilot/nftree-multichain-20261112`; draft PR #151. **Not published.** Target: `https://tree-token.xyz/play/multichaintest/`.

The page was created from scratch. No prepared page was required or recovered.

## Implemented

- Responsive Tree Arcade pilot with Robinhood Chain, BNB Smart Chain, Base, Solana and Sui selection.
- Proposed non-Sui Arcade pass prices: 25 USDG / 25 USDT / 25 USDC / 25 USDC respectively. Proposed continues: one unit of the corresponding stablecoin. Sui simulates existing NFTree access and shows the proposed $1 worth of TREE continue without fabricating an indexer quote or changing live prices.
- Simulated access and an isolated playable copy of Tree Force '89.
- Successful, cancelled and failed continue simulations. Success restores three lives while preserving score and wave. Cancellation and failure grant no lives.
- Reset clears the pilot session and destroys the copied game instance.
- Explicit simulation-only disclosure. No wallet access, signatures, approvals, payments, contract deployment, backend writes, real ownership verification, or production leaderboard submissions.
- Pilot assets remain under `/play/multichaintest/`. Existing live games and shared wallet integrations are not edited.

Game source: `TheCryptoArborist/treeforce89@87bca303eb84c38599b186defa23844134f2b1f2`. The copied engine's Git blob is verified before bundling. Pilot tooling installs separately without altering root dependencies.

## Validation

Validated commit: `5eb27d430fe01dc489c1b48f58de6358450aad44`.

GitHub run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/43257955199

- Eight unit/isolation tests passed.
- Isolated game build passed.
- Chromium browser checks passed at 1280 x 1000, 390 x 844 and 375 x 812.
- All five chain options rendered their expected proposed pricing.
- The actual game loaded and started.
- Continue success preserved score and wave; cancellation/failure did not grant lives.
- No horizontal overflow, page errors, wallet-provider accesses or forbidden external/API/RPC requests were detected in these checks.
- Reset removed the game canvas and returned access to its initial state.
- Desktop and mobile screenshots were inspected.

These tests validate the simulated browser experience, not real blockchain integrations, ownership verification or payment processing.

Validation artifact: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/43257955199/artifacts/13963800226

## Publication blocker

The existing GitHub Actions `NETLIFY_AUTH_TOKEN` is populated, but it is not authorized for the protected Netlify inventory requests required for safe publication.

Read-only diagnostic run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/43258479163

Observed responses:

- Both deploy-detail endpoints returned HTTP 200 with only public metadata, omitting function/schedule/runtime inventories.
- The site functions endpoint returned HTTP 401.
- The deploy files endpoint returned HTTP 401.

The connected Netlify app can read the full deployment record, but its currently exposed actions do not include deployment creation, upload or publication. The existing event-workshop workflow uses the same GitHub Actions secret; it is not a separate working release credential.

No release candidate was created, no files were uploaded to Netlify, and no production publication was performed. Both release attempts stopped before any Netlify mutation. Preservation assertions have not been weakened.

## Protected baseline

Netlify site: `aa62f324-b880-47d6-85b8-4ba0700ff5bf` (`tree-token`).

Published deploy remains `6af4ef567e67ea8af9abe8ed`, ready and locked. The authenticated deployment record contains 49 backend functions and five schedules. Main remains `ee6db9f6c499b48a1ec22c138e3f7b0ea58bd7a5`; this pilot has not been merged.

## Required to complete publication

Repair or replace the repository's encrypted Actions secret `NETLIFY_AUTH_TOKEN` with a Netlify credential authorized for this site. Do not place credentials in source files, PR comments, logs or chat. After authorization is repaired, refresh the published baseline and rerun validation and the additive preservation release. Any changed baseline must be reassessed before publication.

No PowerShell or user-local deployment bundle is required. Do not run the repository's historical snapshot build as a replacement for the live site.

## Guidance consulted

Current MystenLabs/skills README, `frontend-apps/SKILL.md`, `frontend-apps/limitations.md`, and `frontend-apps/non-react.md`; repository `AGENTS.md` and production preservation guidance; Netlify deployment coding context. No Sui SDK migration or live wallet rewrite was performed.
