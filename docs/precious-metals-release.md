# Precious metals charts — guarded Market Insights release

This correction replaces the Silver/Gold Ratio with TradingView's dedicated Gold/Silver Ratio index, TVC:GOLDSILVER. Gold and Silver remain after Stablecoin Dominance, followed by Gold/Silver Ratio. The ratio divides the gold price per troy ounce by the silver price per troy ounce and shows how many ounces of silver equal one ounce of gold. A falling ratio means silver is gaining value relative to gold; a rising ratio means gold is gaining relative to silver. This describes relative performance, not whether either metal's dollar price is rising.

Use the dedicated `.github/workflows/publish-precious-metals.yml` preservation pipeline, not a root build or ordinary Netlify deploy. Capture baseline `6affb0e47dc837eae9bdc12d` as long as it remains current. Its published Market Insights SHA1s are `2129bd2818ea6052fafa56b5cf470de9dbd4baab` for HTML and `6b99eda47fe4aacf7ea8db21603e105b5a24e72d` for JavaScript. Only those two existing static paths may change. Preserve all other files and all 50 complete backend function records, five schedules and protected environment/runtime configurations. Prepare the exact candidate; require human-observed real TradingView rendering for all three instruments before an artifact-bound publication control commit. The automated four-viewport browser checker uses mock provider data and must not be mistaken for real chart availability.

Use fresh operation branches `release/gold-silver-prepare`, `release/gold-silver-publish` and `release/gold-silver-audit`; prior Precious Metals branch history remains intact. Commit markers remain `[prepare precious metals]`, `[publish precious metals]` or `[audit precious metals]`, together with `[skip netlify]`. The existing control filenames, artifact identities and action schema are unchanged.

If the production baseline has changed, stop and recapture/review rather than overwriting another release.

