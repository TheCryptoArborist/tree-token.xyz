# Precious metals charts — guarded Market Insights release

This update adds three TradingView charts after Stablecoin Dominance: TVC:GOLD, TVC:SILVER and TVC:SILVER/TVC:GOLD. The last divides the silver price by gold, not the more common gold/silver ratio. The labels identify the metal-price feeds and unitless ratio, not cryptocurrency market capitalizations.

Use the dedicated `.github/workflows/publish-precious-metals.yml` preservation pipeline, not a root build or ordinary Netlify deploy. Capture baseline `6aff8d6c44e257067443ba98` as long as it remains current. Only the two existing Market Insights static paths may change. Preserve all other files and all 50 complete backend function records, five schedules and protected environment/runtime configurations. Prepare the exact candidate; require human-observed real TradingView rendering for all three instruments before an artifact-bound publication control commit. The automated four-viewport browser checker uses mock provider data and must not be mistaken for real chart availability.

If the production baseline has changed, stop and recapture/review rather than overwriting another release.
