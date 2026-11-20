# Market Overview — guarded Market Insights release

This release expands `/market-insights/` from nine market charts to fourteen.
It adds OTHERS, ETH Dominance, Stablecoin Market Cap, DeFi Market Cap and
Altcoins vs. BTC; renames Market Caps to Market Overview; and organizes the
charts into Market Size, Dominance, Sectors & Ecosystems, and Metals & Ratios.
Every chart has a plain-language reading guide. Share links identify a research
view, and the page remembers supported section and chart selections locally.
TradingView's own time-range settings are not part of that saved page state.

## Fresh production baseline and permitted changes

Use `.github/workflows/publish-market-overview.yml`. The reviewed current input
deployment is `6affb90d186b9e416a040a80`, published at
`2026-11-20T03:06:10.962Z`. It includes the original-backed NFTree BNB purchase
enablement routes. It is newer than the Gold/Silver record that headed
`production/README.md` when this work began.

Capture the entire current deployment afresh. The only permitted static changes
are the two existing files below; their input SHA1s are pinned in the release
script.

| Public path | Required input SHA1 |
| --- | --- |
| `/market-insights/index.html` | `69187850c90dab01a96706dcd17966769e09d53d` |
| `/market-insights/insights.js` | `9f60d35390e57a33dfb42c13067df6dc389731d5` |

No public paths may be added or removed. Preserve every other captured static
hash, all 50 complete function/provider/package records, five schedules,
runtime settings, site snippets and API-visible protected configuration.
The latest NFTree enablement HTML, app and core files are also required in the
capture. No wallet, payment, backend package or environment changes are part
of this release. A historical root build must not be used as the release body.

If the actual live deployment or source baseline has changed, capture and
review a new candidate. Do not replace another release with an older one.

## Prepare and review

Use the fresh branch `release/market-overview-prepare` with both
`[prepare market overview]` and `[skip netlify]` in the source commit message.
The workflow checks the complete preservation guards, creates the candidate
from the full current inventory, verifies exact public asset delivery and
checks the candidate with isolated Chromium.

Provider-mocked checks cover all fourteen chart choices, four groups,
plain-language guides, view links, remembered state and layouts at 320, 390,
768 and 1363 pixels. Mocked provider tests cannot establish live data
availability. A separate check must render populated actual TradingView data
for all five new symbols, exercise a native chart control and verify source
links. Review the resulting screenshots and bound real-provider report before
publication.

The source verification job also runs the existing Market Insights regression
checker once with the same isolated Chromium installation. This checks the
seven Explorer sections, including Fear & Greed, price charts, Rainbow, CBBI,
On-Chain and Cycle Tools, because remembered navigation affects those views.
Its provider-mocked report and screenshots accompany the layout artifacts.

| New chart | Required TradingView symbol |
| --- | --- |
| OTHERS | `CRYPTOCAP:OTHERS` |
| ETH Dominance | `CRYPTOCAP:ETH.D` |
| Stablecoin Market Cap | `CRYPTOCAP:STABLE.C` |
| DeFi Market Cap | `CRYPTOCAP:TOTALDEFI` |
| Altcoins vs. BTC | `CRYPTOCAP:TOTAL3ESBTC` |

The prepare run emits `market-overview-candidate-<run ID>` and
`market-overview-visual-<run ID>` artifacts. The candidate artifact contains
the complete baseline, exact plan, candidate identity and verification report.
The real-provider report must name the same candidate, source commit, source
tree, plan digest and candidate origin. A review from another origin, a
different source or mocked data cannot be substituted.

## Publish and record the observed result

Merge the exact reviewed source tree into `main`. Create one control commit
directly on that merged main using `release/market-overview-publish`; the
commit may change only `production/market-overview-publish.json` and
`production/market-overview-browser-review.json`. Include
`[publish market overview]` and `[skip netlify]` in the message. The control
binds the prepare run, original branch, successful conclusion, artifact ID,
archive SHA256, plan SHA256, source, candidate and merged main.

The workflow revalidates the downloaded records and exact reviewed candidate,
waits for all real queued Git builds to reach terminal states, rechecks current
production and main, and locks only the newly created reviewed candidate.
It then verifies canonical delivery, layouts, complete static inventory,
backend records, schedules, protected configuration and the production lock.

Record the actual published source commit, deployment ID and complete release
evidence in `production/README.md` and a dated production JSON record. Do not
claim publication from a candidate or an incomplete workflow. If a publication
request succeeded before a timeout, inspect the exact candidate with the
read-only `release/market-overview-audit` branch and
`[audit market overview] [skip netlify]` markers; never restore an earlier
deployment or retry publication blindly.
