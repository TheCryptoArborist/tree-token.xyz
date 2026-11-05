# On-demand TREE route comparison

Run this explicitly from the repository after `npm ci`:

```sh
node --experimental-strip-types scripts/compare-tree-routes.mjs --read-only
```

The command performs three independent fresh studies of 10, 50 and 100 SUI.
Each study refreshes and verifies pool state, simulates the existing 73-allocation
BOOM/SHOCK grid alongside direct V3, and compares outputs at equal total SUI cost.
Each study also checks final-output protection and deliberately failing controls.
An unchanged run uses 273 read-only simulations. The command is finite and starts
no background monitor. Running without the explicit flag makes no network calls.

Results and full evidence are saved under a new timestamped directory in
`artifacts/tree-comparisons/`. `comparison.json` reports one of:

- `repeated-improvement-observed`: the **same allocation** returned strictly more
  TREE at equal total SUI cost in all three studies. Inspect `repeatedImprovements`
  for exact allocations, each observed gain, and the minimum gain in TREE base
  units (divide by 1,000,000 for TREE).
- `no-repeated-improvement`: no tested allocation met that condition. This does
  not prove that another allocation or venue could not improve the result.
- `inconclusive`: a study failed, timed out, changed pool state, was missing or
  stale, or failed evidence validation. The command exits nonzero. This is never
  reported as evidence that direct routing won; review the round logs and retry
  explicitly when appropriate.

Successful comparisons return exit code zero regardless of whether an improvement
was found. Each child study is limited to three minutes and the evidence session
must fit within ten minutes. There are no automatic retries. Fresh states may
differ between studies; stability is required within each input-size comparison.
The SDK is diagnostic only. Full Move simulation is the quote authority.

The manual-only `Compare TREE routes (read-only, opt-in)` workflow preserves all
round artifacts when invoked. GitHub must recognize the workflow on the default
branch before it offers workflow dispatch; while this PR is draft, use the local
command. Existing push checks run the offline session tests and one split study,
not the three-round tool.

No wallet, signing, submission, production handler or Best Swap integration is
included. Mocked gas and a finite grid cannot guarantee funded execution, future
profitability, or global optimality. A positive flag is evidence for further
read-only investigation; it does not automatically enable a route.

## First live validation

The [saved session summary](comparison-session.json) covers September 19, 2026,
03:24:39–03:25:14 UTC. All three fresh studies completed (273 simulations) with
no repeated improvement. The closest allocation in every round put 0.01 SUI
through BOOM and the rest through direct V3, losing 110.148073, 109.697999 and
109.136311 TREE at equal total SUI cost for 10, 50 and 100 SUI respectively.
Full local round evidence is retained in
`artifacts/tree-comparisons/2026-09-19T03-24-39-521Z/`; the compact summary is
versioned here. Thirty focused tests and production snapshot verification passed.
