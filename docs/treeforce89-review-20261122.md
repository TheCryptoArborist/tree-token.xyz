# Tree Force ’89: reconciliation and bounded first patch

Prepared against the live game on November 22–23, 2026 (Chicago date at task start: November 22). No production deployment, real payment, chain transaction, access/pricing change, or tournament activation was performed.

## Review location and baseline

Worktree `/workspace/treeforce-review`, branch `dev/treeforce89-reconcile-20261122`, based on integration main `662e167f5c16295bfcbe989d832ceace3a8ffb13`. Fresh clones and isolated worktrees were used; no existing user checkout or uncommitted work was overwritten.

The canonical game is https://tree-token.xyz/play/treeforce89/. PR https://github.com/TheCryptoArborist/tree-token.xyz/pull/112 remains open, but its mobile JavaScript is already manually published. PR state is not production state. Standalone main is `87bca303eb84c38599b186defa23844134f2b1f2`; historical `feature/tree-paid-continue` is in **TheCryptoArborist/treeforce89**, at `faba1b3df2b766dea5b7da242cbd30327d05b2fa`, not the integration PR.

The observed locked manual Netlify deployment is `6b03cc46411c5bac0b910909`, newer than the handoff deployment, with no Git commit attached. Its captured function metadata contains 57 functions and five schedules. See `treeforce89-live-inventory-20261122.json`. Backend files, schedules, environment, routing and shared Arcade services have not been modified. This inventory records available deployment metadata, not a downloadable backup of every deployed static file/function binary. The local candidate is a **partial static comparison overlay, never a standalone deployment payload**.

## Verified editable source lineage

The current application is not reproduced by building either repository's main branch alone. Editable TypeScript was recovered in integration `fix/treeforce89-powerup-readability`, commit `55cb3ee65600fc5014c8eeaaadcdc0f0206d9a8b`, under `treeforce89/frontend`, `paid`, `achievements` and `pinned-frontend`.

The historical preparation chain was executed locally and reproduced the current JavaScript byte for byte:

| Stage | Repository commit | Local preparation script |
| --- | --- | --- |
| Editable TypeScript base | integration `55cb3ee` | `scripts/prepare-treeforce89-powerup-release.mjs` |
| Published mobile layer / PR112 | integration `e1f7de58c11cce8067a0083ad8b7ccfd23e3dfd4` | `scripts/prepare-treeforce-mobile-production.mjs` |
| Session renewal | integration `046640c1079466d9c0e3321f7bfd4ac23cc60757` | `scripts/treeforce-session/prepare.mjs`, then `scripts/treeforce-renewal/prepare.mjs` |
| Saved-result sharing | integration `17d339ddd845b802695f434c62f21d895aee5d41` | `scripts/arcade-play-share/prepare-end-share.mjs` |

The TypeScript build produced original `index-C7sLq93z.js` hash `810a2af51cb15df497b9ba2b2a5f28c15c4dcf33f092ae92c31c818c3b886631` and `arcade-CdwOWItr.js` hash `54a2dc3bd59c23e3e925454d7737dcd038b99ac814c0ccbdcc5d782ce701dab2`. Mobile, renewal and sharing transformations then matched the published modules. Current CSS is captured and hash-pinned separately; the historical mobile build's stylesheet is not byte-identical, so it was not substituted.

Current runtime SHA-256 pins:

- `index-share-r4.js`: `738c68535a66f68544a9ca30ba0ab6894bca312872568f89910a40954bd741bf`
- `arcade-renewal-r3.js`: `2e9d45ed31189ebaaa7e9d3762ef32295d67a64880f0ec1d2a71aed2f80b8003`
- `graphql-mobile-r1.js`: `45e654d6851f198d4d4d37d9a7d1753aad5985fe7f0c9ccf0154007da0922254`
- `mobile-r1.css`: `dd1952c8f37372bc70821baf5b466722227b890167e1b37312ff65d76a6f6bcd`

`treeforce89-baseline-manifest.json` inventories all 23 captured resources. This is a source-backed historical preparation chain, not yet a consolidated modern frontend build. Consolidating those layers into TypeScript is deferred to avoid expanding the first patch.

Live MystenLabs/skills README and relevant frontend, transactions, queries, limitations, SDK/TypeScript, data access/GraphQL and PTB guidance were read at `a384d9a158c4639f075ad3f6644d925108ddfc78`. Installed dapp-kit-react 2.1.41 documentation (disconnect, personal-message signing, transaction execution) and Sui 2.37.0 were checked. No SDK migration or authentication redesign was made.

## Reproduced defects and changes

1. **Multiple application roots reset the game.** The sharing entry imports an engine that imports a second application entry; lazy GraphQL imports a third entry. Instrumenting a captured baseline counted two roots initially and three after lazy GraphQL. A synthetic authenticated game disappeared on that lazy load. `prepare.mjs` redirects the three current modules' internal references to a single versioned entry. Candidate counts stay at one and the mounted run survives. This reproduces a runtime reset mechanism; it is not proof of every historical Slush complaint.
2. **Mobile CSS stretches the share card.** Game-canvas 2:3 sizing also matched the 1200×675 sharing canvas. Four selectors now target `.phaser-mount canvas`. The share card retains its landscape ratio in mobile checks.

The preparation script changes module-reference strings and canvas selectors only, adds versioned assets, updates HTML references, and retains historical assets. Gameplay, Tree Hero/Arborwing artwork, NFTree verification, wallet authentication, three lives, 20,000 TREE continue semantics, thirteen achievements, per-wallet best-score leaderboard and shared receipt handling remain unchanged. Generated bundles are ignored, with hashes and reproducible scripts supplied for review.

## Already working / verification

| Area | Evidence and limits |
| --- | --- |
| Session recovery | 20 renewal tests passed. Browser mocks exercised expiry, same-wallet proof renewal and run preservation after the module fix. Real Slush background/resume remains unverified. |
| Disconnect / switch | Browser checks preserve a paused run through temporary disconnect and reconnect. Explicit disconnect clears identity; another synthetic wallet gets a new run and profile. |
| Scoring / continues | New candidate runs start at zero with three lives. 202 historical standalone tests and 32 current-source contract/gameplay/achievement tests passed, including paid-flow behavior with mocked signing/network. No real payment was attempted. |
| Mobile / tutorial | Existing emitted-engine pause/HUD/hero-clearance checks pass across five growth scales; touchbar checks cover pointer cancel, blur and lost capture. Guide and result screenshots recorded at 320, 390 and 1280 widths. Human tutorial comprehension and physical touch remain device work. |
| Pilot / save / achievements | Existing wallet-backed profile is displayed; simulated failed save retries successfully; wallet change isolates profile. Thirteen-achievement source contract tests pass. Live persistence and award issuance were not written to. |
| Saved-run sharing | Existing receipt-based handoff already present; 13 shared Arcade tests passed, including completed-run selection and handoff. Candidate emits an opaque saved receipt link after successful mocked save; no social post was sent. |

Candidate browser checks pass at 320, 390 and 1280 pixels with no page errors. Reports and screenshots are in this directory. These are synthetic wallet/API tests of the actual emitted app, not a live-chain end-to-end certification. Historical tests establish source behavior; only the browser/emitted-engine tests execute the candidate bundles. Local practice was visually inspected and New Game restarted into wave 1 with the current hero and touchbar.

## Reproduce the preview and checks

Node 22+ is needed (`import.meta.filename`, built-in fetch). From this worktree:

```sh
NODE_USE_ENV_PROXY=1 node scripts/treeforce-local/capture.mjs
node scripts/treeforce-local/prepare.mjs
node scripts/treeforce-local/serve.mjs release/treeforce-candidate 4175
```

Open `http://127.0.0.1:4175/__local/practice?lab=1` for clearly labelled unranked practice, or `/play/treeforce89/` for the gated application. Practice is served by a local-only route and is not included in the generated overlay. The server rejects writes and blocks external connection requests. Authentication, score persistence and payments require the synthetic test harness locally.

For browser checks, make Playwright available to Node (the task environment supplies it through NODE_PATH) and set CHROMIUM_PATH if Chromium is not `/usr/bin/chromium`:

```sh
TREEFORCE_URL=http://127.0.0.1:4175 TREEFORCE_WIDTH=390 node tests/treeforce-local/browser.cjs
```

Repeat with widths 320 and 1280. Baseline reproduction currently recognizes port 4173: serve `release/treeforce-baseline` there and set TREEFORCE_URL accordingly. Test interception is local-only; wallet signatures and transaction submission are mocked/rejected.

Historical checks ran in isolated worktrees; logs are copied under `docs/treeforce89-test-evidence/`. Source preparation outputs and dependencies remain in the local worktrees. Never run historical publish scripts as part of review.

## Remaining device and release work

On iOS Safari and Android Chrome with Slush: verify expiry while backgrounded, cancelled wallet prompts, app/deep-link return, disconnect/reconnect and account switching; confirm preserved score/wave after interruptions. Check safe areas, hero visibility, finger reach, pointer cancellation, Pause/Resume and guide understanding. Verify native share/download/copy behavior using an existing saved receipt. A real paid continue and real persistence check require separately authorized test conditions; this task did not make a payment.

Before any later release, recheck current live hashes and deployment inventory, integrate only this reviewed overlay into the **complete current site/backend payload**, and preserve all 57 functions and five schedules. Do not deploy the local capture or resurrect an older backend. Production publishing is outside this task's authorization.
