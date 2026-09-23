# STI integration review — 2026-09-23

The STI branch includes current main through PRs #30/#31. Published file digests, release metadata, backend identities and schedules remain unchanged. Four original published files (`dapp/index.html`, `dapp/styles.css`, `dapp/interaction-bootstrap.js`, `scripts/wallet.js`) are archived under `production/live-static/`; the manifest now reads those copies to retain a reproducible production snapshot while the editable files contain the reviewed native STI integration.

`npm run verify:production` and `npm run build` verify/build the 189-file published baseline in `dist/`. `npm run build:preview` builds a separate 193-file candidate in `dist-preview/`, using public manifest paths (including supplementary assets), four explicit frontend overlays, and three explicit STI modules plus the local STI icon. `tests/sti-preview-build.test.mjs` checks every output digest and the complete candidate inventory.

Netlify Deploy Previews use only the separate public read proxy in `netlify/preview-functions/`. It accepts GET requests on eight explicit public endpoints, including Knowledge Trial status, and does not forward credentials or non-status actions. Existing production functions, schedules and state-changing APIs are not rebuilt. Knowledge Trial submissions and backend writes are deliberately unavailable in this review environment. STI quotes and unsigned simulations use the reviewed Mainnet path. Do not promote this review deployment or unlock automatic publication; an eventual production release must preserve all current backend packages and use a separately verified release inventory.

# Current production — 2026-09-23

Deploy `6ab31e7878c67aff72b0dc54` is published and locked from merged PR #30, source commit `dae05c8e9fdd675fb77caeac7e5507616b38cf98`. The V3 headline displays the verified SuiDex + Cetus + Turbos sum and fails closed. The only public-file change from the previous live release is `dapp/v3-workspace.js`. Knowledge Trial is preserved byte-for-byte; only the two read-only metrics functions were updated. All other 35 functions and five schedules are preserved. The STI Stats branch remains separate.

Validation: 24 focused tests, both GitHub workflows, production verification/build, live API and file-hash checks, and browser navigation checks passed. At verification, $16.46 + $59.692141830144 + $5.449790692352001 = $81.601932522496, displayed as $81.60. Stats navigation worked with its existing last-verified market snapshot fallback during a provider outage. See `current-release.json` and `verification-20260923.json`.

---

# Corrective release candidate — 2026-09-23

The release snapshot now reconciles all 189 files from locked production deploy `6ab219d0f2e18c9096895bf6`. The only intended public-file change relative to that deployment is `dapp/v3-workspace.js`: combine verified SuiDex, Cetus and Turbos 24-hour volume, reject missing/invalid values, and clear the headline while loading or on failure. Zero remains valid.

Knowledge Trial purchase verification, the live homepage/assets and litepaper are recovered byte-for-byte. 35 current backend packages and all five schedules must be reused, not rebuilt. Only tree-volume and tree-liquidity are updated: per-pool Cetus/Turbos coverage, bounded event pagination, and fail-closed incomplete coverage. Their reviewed source and exact packages are tracked under production/metrics-functions. None of the historical local ZIP archives are verified matches for the current packages. `release-baseline-20260923.json` records the live baseline; `manifest.json` describes candidate static bytes and required backend identities.

Use the authenticated preserved-package release script for preview and promotion. Do not deploy the root functions directory through an ordinary full-build deploy. Keep automatic publication locked. The STI Stats branch is excluded.

The production verification/build checks snapshot byte integrity; it does not assert backend source parity. Newly recovered supplementary deployed files are stored under `production/live-static` and built at their recorded public paths.

---

# Current production — 2026-09-18

VICTORY funding and MAX fixes are published and locked as deploy `6aad931f45a27f392303e229`, from GitHub commit `06211bf3f558b775ced7eb5dba2c90461f2487da` (PR #26). See [current-release.json](current-release.json) for the complete live static-file inventory, backend digests/configurations, five schedules, and previous deployment.

Only three public files changed: `dapp/earn-transactions-core.js`, `dapp/victory-center.js`, and `dapp/victory-transaction-core.js`. All 35 backend functions and the live generated Netlify configuration were preserved. The release reused the existing `kelpie-v3-release-safe` deployment context before promotion; this is a hosting context label, not the source branch. Kelpie remains V3-only.

The source snapshot manifest verifies repository file bytes. Its original deployment metadata and archived generated `deployed-netlify.toml` are historical; the current live configuration differs from that archive. Use `current-release.json` as the live deployment inventory, and preserve configuration directly from the published deployment for frontend-only releases.

Validation: nine focused suites, SDK funding checks, two unsigned seven-day-lock mainnet simulations, desktop/mobile browser checks, and user wallet preview confirmation passed. Unrelated legacy Arcade diagnostics remain non-blocking and visibly failing.

---

# Production baseline — 2026-09-15

This directory records the live TREE deployment `6aa70deff0b74e2bfe8b7725`, published September 13, 2026. Synchronizing this baseline does not publish a new deployment.

## Verified recovery

- All 166 deployed files have been recovered and verified against Netlify's SHA-1 inventory, including the protected deployed configuration.
- Public HTML, JavaScript, CSS, and assets are restored at their normal repository paths. The homepage includes its exact deployed compiled bundle; the prior editable source remains in Git history.
- `manifest.json` maps every deployed path to its repository source and records all 35 function identities/configurations and five schedules.
- `functions/` contains 30 exact deployed ZIP packages verified against Netlify's SHA-256 digests. These are recovery artifacts, not a directory to publish as public site files.
- `deployed-netlify.toml` preserves the historical generated configuration, including its old absolute build paths. The root configuration remains portable.

## Remaining source verification gap

Five locally cached function ZIPs differ from production: `tree-knowledge-trial`, `tree-knowledge-trial-admin`, `tree-knowledge-trial-resolver`, `tree-knowledge-trial-rotation-on-deploy`, and `tree-knowledge-trial-rotation-scheduled`.

Their exact deployed identities are retained in the manifest and their running packages remain on Netlify. Local source candidates were found and preserved under `recovery/source-candidates/`; they must not be represented as verified production source. The other existing `netlify/` sources also require a reproducible package comparison before a full backend rebuild. Do not replace these running packages merely to make a build pass.

## Verify and build

Run `npm run verify:production` to verify the recovered bytes and function archives. Run `npm run build` to create the exact 166-file static snapshot in `dist`. A different old build must first be preserved or removed. The build never copies function ZIPs, recovery candidates, or private server source into `dist`.

This is a production recovery baseline, not a new feature release. The VICTORY fix remains separately reviewable in PR #22; the Kelpie changes remain in PR #21. Neither is part of the captured live site.

## Keeping the repository synchronized

1. Begin future work from the synchronized `main` branch and commit changes on a feature branch.
2. Test a preview before publishing. Record the exact commit, static-file digests, function package digests, schedules, and resulting deployment ID.
3. For a frontend-only release while backend recovery is incomplete, retain the current verified backend package identities rather than rebuilding unrelated functions.
4. Update this baseline and manifest after an authorized production release, then fast-forward the computer's checkout.
5. Do not unlock automatic production publishing until the five missing exact function packages or equivalent source parity have been resolved and verified. The currently published deployment is locked during this synchronization to avoid an incidental full rebuild replacing it.

The separately dirty `tree-token-v3-repair` workspace was inspected read-only and remains untouched.
