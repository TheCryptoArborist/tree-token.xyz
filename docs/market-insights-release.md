# Market Insights production release

The approved Market Insights preview is promoted to `/market-insights/` and linked
from the homepage's **Resources → Market Insights** menu. The page keeps all seven
tools together: Fear & Greed, Price Charts, Rainbow, Market Caps, CBBI, On-Chain,
and Cycle Tools.

Approved preview source: `c819de96a5c37d2dd8f29470e5e47d85b74e1678` (draft PR210).
The production page carries the same application scripts. Its HTML changes only
production metadata, script paths, and navigation destinations. It no longer
contains preview-only noindex directives or the preview title.

## Public change boundary

- Add `/market-insights/index.html`.
- Add `/market-insights/insights.js`.
- Add `/market-insights/sentiment.js`.
- Change only the Resources link list in `/scripts/homepage-refresh.js`.

The publisher requires the previous homepage-script SHA-1
`73f4ffb8773ad531dd42a7bcf2bde60e4cc9c761` before replacing it. It must preserve
every other current static file, every complete backend package/provider/runtime
record, all five schedules, existing environment records and site configuration.
The current inspected production deployment has 49 backend packages; the release
captures and compares the complete fresh inventory rather than reconstructing
it from an archived repository snapshot.

## Release procedure

The dedicated workflow verifies release guards and isolated automated layouts.
The approved main-branch release commit includes `[skip netlify]` to prevent
the historical Git-CD snapshot from competing with the preservation release and
`[publish market insights]` to select this one bounded publisher.

The publisher captures the explicitly selected current locked deployment,
builds a new candidate, verifies all hosted bytes and expected snippet insertion,
checks the new page at phone and desktop widths, and verifies unchanged production
again. It refuses unknown active deployments, a changed baseline, an unexpected
upload, a backend change, or an unverified candidate. Only its newly created
candidate can be published; the resulting production deployment remains locked.

The browser fixtures belong exclusively to the CI checker. They are never
included in the public files or used as market data on the website. Actual
provider data, attribution and freshness handling remain in the application.

After publication, record the source commit, deployment ID, complete inventory
comparison and verification result in `production/README.md` and a release
record. Verify the canonical page and the homepage Resources link in the browser.
