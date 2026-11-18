# Stats market chart and holder source release

The Stats → Market panel at `/dapp/#stats` embeds the same TREE/USD Noodles
chart as Market Insights. The market holder card now uses the Noodles-backed
`/api/tree-dashboard` response that also supplies the homepage. The separate
coin-object-owner count remains in its existing leaderboard accounting view;
it no longer overwrites the market holder card.

## Public change boundary

| Public path | Explicit source | Current SHA-1 before replacement |
| --- | --- | --- |
| `/dapp/index.html` | `production/stats-market-static/index.html` | `5f35a5343f4ffcd5c7a5fd4726ecd2947ab777e0` |
| `/dapp/app.js` | `production/stats-market-static/app.js` | `177fed9f6ebb4aa7f52d9be71cfaa747070c376b` |
| `/dapp/stats-market.css` | `production/stats-market-static/stats-market.css` | New path |

The HTML overlay starts from the exact currently deployed file, not the older
manifest-pinned root copy. It retains the Profile Studio navigation and stylesheet,
wallet modules, STI markup and one stored `tree-arcade-arboretum-link` snippet.
Netlify currently adds one additional identical snippet during delivery. The
byte verifier accepts only that exact additional body-end insertion; it does not
strip both copies or normalize arbitrary script changes.

The inspected current baseline is locked deployment
`6afd38b699fcd142a80207f5`, with 613 static files, 49 complete backend packages
and five schedules. The new candidate must contain 614 static files, preserving
611 original paths unchanged. The publisher freshly captures and compares every
current file and complete function/provider/runtime record, schedule, environment
record and protected site configuration. It does not rebuild functions or change
wallet/transaction modules.

## Verified data distinction

A public observation on 2026-11-18 at 05:49:26 UTC returned 606 from
`/api/tree-dashboard` → `live.data.holderCount`, with source Noodles.fi and a
successful contemporaneous verification time. The same observation returned
2,198 from `/api/tree-exposure` → `source.direct.verifiedAddressOwners`, based
on a complete coin-object scan at 00:28:07 UTC. The scan includes address owners
of zero-balance TREE coin objects; it is not a count restricted to wallets with a
positive aggregate balance. The entire difference has not been attributed to
zero-balance wallets, and this update does not assert an undocumented Noodles
filtering method. Both market cards simply use the same provider and definition.

## Release procedure

The dedicated workflow verifies the approved overlay sources, focused holder
and chart regression tests, preservation guards and isolated desktop/phone layouts.
Local browser checks serve a temporary assembled directory; they do not rewrite
historical manifest files. Fixture values are CI-only and never enter public files.

The approved main-branch release commit includes `[skip netlify]` to prevent
historical Git-CD snapshot publication and `[publish stats market]` to select
this one bounded preservation publisher. The workflow pins the current baseline
explicitly through `STATS_MARKET_EXPECTED_DEPLOY`; there is no default old baseline.

The publisher captures the current locked deployment, plans only the three
approved frontend overlays, creates a new candidate, and verifies its complete
hosted inventory and delivered bytes. Isolated browser evidence is bound to the
candidate ID, source commit and origin and must pass all four widths: 320, 390,
768 and 1363 pixels. The publisher rechecks unchanged production immediately
before publication and blocks any unknown or changed nonterminal deployment.
Only this newly created and verified candidate may be published, and publication
keeps the resulting production deployment locked.

After publication, the same exact byte, full preservation and browser checks
run against the canonical route. Record the source commit, new deployment ID,
complete inventory and verified result in `production/README.md` and the release
record. A manual live browser check should confirm the actual external chart and
current provider count; isolated CI deliberately does not claim external provider
availability or chart interior verification.

## Published verification

- Locked production deployment: `6afd423531560084e7dd48e8`.
- Published source commit: `e54531dfcb85cb712798f7e5890fb04017582d51`.
- Canonical route: https://tree-token.xyz/dapp/#stats.
- Full release record: `production/stats-market-release-20261118.json`.
- Hosted result: 614 static paths; 611 prior paths unchanged; all 49 backend
  package/provider/runtime records, five schedules and protected configuration
  preserved. Only the two reviewed dapp files and one new stylesheet differ.
- Candidate and canonical byte verification and all four isolated browser
  viewport checks passed. The production-snapshot and existing STI/wallet
  regression checks also passed before publication.
- Manual canonical check confirmed actual external Noodles chart data, a
  working seven-day/one-hour-interval view, and 606 on both market holder
  displays. This is a dated observation of provider data, not a fixed count.

The chart and holder source changes are live. Future releases must capture this
new current deployment instead of rerunning this publisher against its older
pinned baseline.
