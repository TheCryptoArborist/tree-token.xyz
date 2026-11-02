# Preserved production validation

This change repairs `scripts/release-preserved-production.mjs` as a **read-only** preservation gate. It does not publish, restore, unlock, upload, rebuild functions, change environment variables, or run database migrations. The old `preview` and `promote` modes are rejected before credential lookup or network access. Future publication needs a separately reviewed release procedure; this tool does not authorize or perform it.

## Current baseline

The local, ignored `.netlify/preservation-baseline-v2.json` captures authenticated Netlify GET responses for production deployment `6ae8112dce29c5db8b725ff0` on site `aa62f324-b880-47d6-85b8-4ba0700ff5bf`. Its canonical SHA256 is pinned in the adjacent `.sha256` file. The capture was explicitly pinned to that deployment; it did not automatically accept whichever release happened to be current. Production records and environment fingerprints remain local and are not included in this code change.

The capture contains:

- All **41 complete function records**, including package SHA256, provider identities, creation/account metadata, runtime, memory, region, bootstrap data, invocation mode, routes, rate limits, and every other API-returned function field. No two-function replacement exception remains.
- All **five exact schedules**, with their complete records and array order.
- All **288 published static path/SHA1 pairs**, including generated Netlify configuration, headers, redirects, Arcade assets, Canopy paths, and VICTORY files. Historical `production/manifest.json` is not used to replace this inventory.
- Deployment runtime settings, region overrides, production database branch, and the current publication lock. Active database migrations and edge/server bundles stop this workflow.
- Fingerprints of every API-returned site and shared environment record across all scopes, an additional functions-scope consistency check, and the site's build settings. Only the build-settings audit timestamp `updated_at` is excluded from configuration equality: Netlify advanced it immediately after the PR #72 merge without publishing the site. It is retained separately as an observation. Every other setting, value, field presence, and array order remains protected; per-field setting fingerprints make future differences inspectable. The current Functions inventory has **50 site records**. The persistent production/functions secret `TREEFORCE89_DEV_DATABASE_URL` must retain its value ID, context, scopes, and secret classification.

No environment values or credentials are saved in the baseline or report. Function metadata and static hashes are retained directly. Function ZIPs are not downloaded or rebuilt; their API-reported SHA256 identities are protected.

## Run the gate

Use Node.js 24 and an existing authenticated Netlify CLI session or `NETLIFY_AUTH_TOKEN`. The credential is read at runtime and never printed or persisted by this script. Both the current Linux CLI configuration and the Windows configuration path are supported.

```bash
node --test tests/preserved-release.test.mjs
node scripts/release-preserved-production.mjs verify
```

To save a local report without changing the baseline:

```bash
node scripts/release-preserved-production.mjs verify --report .netlify/preservation-validation.json
```

The independent live read-back from this change passed and is recorded locally in `.netlify/preservation-validation.json`. All remote operations are GET requests. The reader rechecks publication, lock, complete function records, schedules, runtime, and mutable environment configuration before succeeding.

## Updating a baseline

A changed publication is a failure, even when its package hashes happen to match. Review and authorize the new live state before explicitly capturing it to a **new** filename. Capture refuses to overwrite either an existing baseline or its hash file:

```bash
node scripts/release-preserved-production.mjs capture \
  --expected-deploy REVIEWED_DEPLOYMENT_ID \
  --baseline .netlify/preservation-baseline-REVIEWED_DEPLOYMENT_ID.json
```

Review the full diff, update consumers deliberately, and retain prior evidence. This script intentionally expects 41 functions and five schedules; changing either count requires a code review. Do not simply replace a failed baseline to make verification pass. Version 1 baselines are not accepted by version 2: retain the old capture, compare every previously protected function, schedule, runtime, static file, and environment-variable fingerprint, and explicitly capture the reviewed version 2 state. Version 1 did not record per-field build-setting hashes, so it cannot prove which other build fields did or did not change historically; preserve that limitation in the local migration review.

## Verification limits

Netlify masks production secret values. The gate detects differences in API-visible records, record/value IDs, contexts, scopes, and returned values; it cannot prove byte equality of secret values that Netlify does not return. Deployment-specific environment overrides are also not exposed by these GET endpoints. The report states both limits explicitly. A future publishing procedure must preserve independently verified deployment-override provenance and perform the relevant runtime/database-backed checks; this validator alone does not establish those facts.

This maintenance change does not test a real wallet transaction or prove that an actual Sustainable Reinvest receipt was rendered after a user payment. The previously approved receipt function remains live; that end-to-end check remains separate.

## Automated checks

`tests/preserved-release.test.mjs` covers identity, package, route, rate-limit, runtime, cron, static inventory, environment, baseline-integrity, concurrent-change, credential-path, and read-only transport failures. The dedicated GitHub Actions workflow runs these tests using synthetic fixtures without Netlify credentials or captured production records. It neither accesses production nor deploys. A fresh checkout needs a locally reviewed capture before live verification; CI cannot establish live production preservation.

Sources checked for the implementation: [Netlify API](https://open-api.netlify.com/) (`getEnvVars`, deploy details, deploy file inventory) and the current [MystenLabs skills README](https://github.com/MystenLabs/skills). This maintenance concerns Netlify inventory validation and makes no Sui SDK, Move, wallet, or transaction changes.
