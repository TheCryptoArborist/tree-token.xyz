# Stablecoin Dominance in Market Caps

## Scope and source

This change adds **Stablecoin Dominance** immediately after **BTC.D** in the
Market Caps controls at `/market-insights/`. It uses the existing TradingView
Advanced Chart integration with `CRYPTOCAP:STABLE.C.D`, TradingView's stablecoin
market-cap index divided by its tracked TOTAL market cap, multiplied by 100.
The explanation distinguishes a share of market value from actual money flows.

Provider references:

- https://www.tradingview.com/symbols/STABLE.C.D/
- https://www.tradingview.com/blog/en/new-cryptocap-symbols-52377/
- https://www.tradingview.com/support/solutions/43000550480-where-do-i-find-crypto-market-capitalization-and-dominance/

Only these existing public paths may change:

| Source and public path | Reviewed prior SHA-1 |
| --- | --- |
| `/market-insights/index.html` | `8daa43d8ed2a50269e652f339bf9312979a8a611` |
| `/market-insights/insights.js` | `6ab44fb11dd883b1d87fb9b45540d755fb8a7541` |

The baseline for preparation is the freshly observed locked deployment
`6aff527173dc08672f92903f`. Its actual full paginated static inventory is
captured by the workflow. Every other path, all **50 complete backend package,
provider and runtime records**, five schedules, environment settings and site
snippet configuration must remain unchanged. No historical snapshot build,
backend rebuild, wallet change or new public path is part of this release.

The hosted HTML adds one existing, exact Arboretum delivery snippet. The
existing Market Insights delivery helper validates that single insertion and
rejects all other byte differences. Stored source does not absorb the snippet.

## Validation boundaries

`scripts/check-stablecoin-dominance-page.mjs` checks the requested tab order,
keyboard activation, chart configuration, source link, explanation, desktop
position and mobile width at 320, 390, 768 and 1363 pixels. Its external chart
providers are explicitly mocked. The resulting report has `testOnly: true` and
does not establish real TradingView symbol availability.

Before publication, the newly created candidate must also be reviewed in the
real browser. Confirm `CRYPTOCAP:STABLE.C.D` renders actual data, the new tab
follows Bitcoin Dominance, a chart control works, and the source link is correct.
Do not claim that a symbol's existence on TradingView alone proves embed support.

The release guard tests check the two-file scope, source hashes, exact backend
records, rejected backend uploads, candidate identity, artifact/source binding,
separate real-provider review, queued builds and canonical byte delivery.

## Prepare the exact candidate

Push the complete reviewed source to `release/stablecoin-dominance-prepare`
using both `[skip netlify]` and `[prepare stablecoin dominance]` in the commit
message. Open a feature PR with `[skip netlify]` in its title. The dedicated
workflow verifies source/layout and then runs:

```sh
node scripts/release-stablecoin-dominance.mjs capture
node scripts/release-stablecoin-dominance.mjs plan --source-commit "$REVIEWED_SHA"
node scripts/release-stablecoin-dominance.mjs candidate --source-commit "$REVIEWED_SHA"
node scripts/release-stablecoin-dominance.mjs verify --source-commit "$REVIEWED_SHA"
```

The workflow supplies `STABLECOIN_DOMINANCE_EXPECTED_DEPLOY`, the existing
Netlify connection and the isolated Playwright module. Preparation never
unlocks or replaces current production. The candidate artifact contains the
captured baseline, normalized prior HTML, exact plan, candidate identity and
verification report, each structured record with an integrity digest.

The checker accepts `STABLECOIN_DOMINANCE_BROWSER_MODULE`,
`STABLECOIN_DOMINANCE_TEST_BASE`, `STABLECOIN_DOMINANCE_CANDIDATE_ID` and
`SOURCE_COMMIT`. Reports and screenshots are stored under `.netlify/`;
candidate release records are in `.netlify/stablecoin-dominance/`.

## Bind the real review and publish

After the preparation run passes, review its concrete preview. Merge the
source PR only after required checks pass. The merged main tree must equal
the complete reviewed candidate tree. Create one control commit directly on
that merged main, changing only:

- `production/stablecoin-dominance-publish.json`
- `production/stablecoin-dominance-browser-review.json`

The control JSON uses schema version 1 and action
`publish-stablecoin-dominance`. Pin `sourceCommit`, `sourceTree`, `mainCommit`,
`expectedDeploy`, `candidateId`, `planSha256`, `candidateRunId`,
`candidateArtifactId`, `candidateArtifactSHA256` and the exact `browserReview`
path above. All values come from the successful reviewed preparation run.

The separate browser review records schema version 1, `result: "passed"`,
`testOnly: false`, the same source commit/tree, candidate ID and plan digest,
the candidate `origin`, actual `checkedAt`, `noWalletOrPaymentActions: true`,
`provider: "TradingView"`, `symbol: "CRYPTOCAP:STABLE.C.D"`, and observed
`viewportWidths`. Its checks must reflect actual observations:
`stablecoinTabAfterBitcoin`, `actualStablecoinChartRendered`, `stablecoinSymbol`,
`chartInteraction` and `sourceLink`. Automated layout evidence is bound and
validated separately; do not present the provider mocks as a real chart review.

Push that control commit to `release/stablecoin-dominance-publish` with
`[skip netlify] [publish stablecoin dominance]`. The workflow validates the
control-only diff, successful original run, immutable artifact ID/digest,
bounded archive contents, exact candidate/source/tree/plan and review. It
checks out the original candidate source, revalidates current production and
candidate bytes, reruns the layout checker, and waits for all real Git builds
to become terminal. Any new or changed nonterminal deployment blocks the
switch; only the ten exact previously audited inactive API records are ignored.

Only that newly created candidate can be published and locked. The workflow
then verifies canonical bytes, all static paths, all complete backend records,
schedules, protected configuration, canonical layout and the published lock.
If publication status is uncertain after a timeout, use the same artifact and
review through `release/stablecoin-dominance-audit`, action
`audit-stablecoin-dominance` and `[skip netlify] [audit stablecoin dominance]`.
Audit is read-only. Never restore an older deploy or blindly retry publication.

## Release status

This document describes preparation and verification requirements. Publication
has not been established by this source change. After successful publication,
record the exact source/main commit, candidate/deploy ID, final full inventory,
workflow/artifact identities and canonical verification in a separate release
record and the newest `production/README.md` section.
