# Published V3 metrics repair — 6 October 2026

Published and locked as `6ac572a85dc967783eb08fb0` after explicit user approval. Reviewed source commit `a9d7486b250f46b537939798b4f13b8c1c3335fa`; review deployment `6ac56dda478232dee97f53b9`.


This candidate changes only `/dapp/v3-workspace.js` and the read-only `tree-v3-overview` handler. Production remains locked at `6ac55dae44d5c8fe2f469850` until publication. The production manifest continues to build the exact live frontend via an archived copy of the previous V3 JavaScript; the preview explicitly overlays the edited file.

TVL uses verified on-chain reserves with reference prices. Volume comes from the existing complete on-chain event scan, independently of rejected enriched APR analytics. Missing data cannot become a zero fee APR. Trading fee APR annualizes trailing 24-hour volume at the pool fee rate over reserve TVL. VICTORY reward APR validates emission amounts and schedule end dates against the on-chain pool, then uses explicitly labelled SuiDex token prices and active TVL. These two APR rates have different denominators and are shown separately, without a misleading sum.

`node scripts/verify-v3-candidate.mjs` validates all 38 rebuilt executable payloads: 37 against the production archives and one against the pinned candidate archive. Names, public routes and all five schedules remain unchanged. The normal production parity script remains unchanged; it intentionally rejects the candidate's changed V3 handler against the old live baseline. CI uses the explicit candidate verifier during review. After publication, archive the published handler, update the production baseline and return CI to the production verifier.

Validation passed: production snapshot integrity, preview build integrity, existing V3 overview and volume tests, missing-volume handling, independent emissions/expiry/denominator tests, and the displayed separation of reward and fee APR. Browser and deployed API checks are recorded separately when the review deployment finishes.

The preceding review description is historical. The production manifest and archived V3 handler now record the published release, and CI uses normal production source-parity verification again. `verify-v3-candidate.mjs` is retained as historical review tooling and requires the previous baseline; use `npm run verify:backend-source` for the current release.
