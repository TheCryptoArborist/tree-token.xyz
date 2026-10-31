# TREE read-only routing comparison

Observed September 19, 2026, 02:47:34–02:47:49 UTC (September 18, 21:47 CDT).
Branch: `feature/tree-liquidity-graph`; draft PR #28. No production Best Swap changes.

**Follow-up:** [on-chain composition validation](../tree-composition/README.md)
supersedes the execution assumptions below. The SHOCK 50/100 SUI rejection was
an SDK guard, not an on-chain contract limit. Complete paths simulated successfully,
and the Aftermath SDK estimates were slightly optimistic versus Move execution.

## Result

Direct SuiDex V3 returned the most TREE for all three tested inputs. The strongest
mixed-venue candidate used SuiDex V3 SUI/BOOM followed by Aftermath BOOM/TREE.
These are independent, full-input estimates before gas, not executable offers.

| SUI input | Direct SuiDex V3 TREE | Direct SuiDex V2 TREE | Direct Turbos TREE | SUI → BOOM → TREE (V3 bridge) | SUI → SHOCK → TREE (SuiDex V2 bridge) |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 362,664.795859 | 358,089.897735 | 356,787.107642 | 350,991.874189 | 290,977.288793 |
| 50 | 1,812,458.182003 | 1,736,833.669133 | 1,763,738.695745 | 1,572,201.602096 | Rejected: Aftermath input reserve bound |
| 100 | 3,622,754.194685 | 3,348,333.150465 | 3,478,253.542484 | 2,782,233.314786 | Rejected: Aftermath input reserve bound |

The BOOM path returned approximately 3.22%, 13.26%, and 23.20% less TREE than
direct V3, respectively. Cetus SUI/BOOM bridges also quoted, with slightly lower
outputs. Cetus SUI/SHOCK bridges produced only 9,134.597035 / 9,412.764531 /
9,448.810151 TREE: technically positive SDK estimates but far below the baselines.
Their service-reported price impacts were extreme; they are not recommendations.

Three-hop paths were also enumerated. The best SHOCK → BOOM tail produced
318,752.357587 TREE at 10 SUI and 1,177,404.468449 at 50 SUI. No enumerated
three-hop candidate beat direct V3 or the best two-hop BOOM candidate.

## Eligibility and discovery

The original [successful health scan](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/35413658039)
is preserved in `tests/fixtures/aftermath-tree-health-2026-09-19.json`: 19 TREE pools,
including BOOM/TREE at $579.0746 TVL, SHOCK/TREE at $72.6136, and direct SUI/TREE
at $0.014283. These historical dollar figures are evidence, not filter inputs.

The new filter has three stages:

1. Reject malformed, empty, or stale state; validate coin identities, positive
   integer reserves, weights, trade/DAO fees, flatness and normalized balances.
2. For a requested full-input trade, compare each terminal pool's whole TREE
   reserve with the best valid direct quote. If even its entire reserve cannot
   beat that quote, exclude it from competitive route enumeration. No USD TVL
   threshold, oracle price, or volume cutoff is needed. Without a valid baseline,
   this economic pruning is disabled rather than inventing a cutoff.
3. Quote exact amounts through the official Aftermath SDK, including its fees
   and input/output reserve limits. Zero output, reserve exhaustion, SDK failures,
   or stale state reject the route. The SDK's 30% reserve bound (with its own
   margin) is an SDK guard, not a confirmed on-chain limit or new TREE TVL threshold.

All 1,855 Aftermath pools were scanned so bridge pools without TREE were retained.
At 10 SUI, only BOOM/TREE and SHOCK/TREE survived the terminal reserve bound;
at 50 and 100 SUI, only BOOM/TREE survived. This does not declare the other pools
permanently unusable: eligibility depends on direction and size, and a split
optimizer must reconsider its actual smaller leg amounts.

Aftermath-only enumeration produced 190 / 177 / 177 competitive candidates up to
three hops, with no route-cap truncation. Every one failed the SDK's input-reserve
constraint somewhere along the path. The direct Aftermath SUI/TREE pool fails
at all three sizes; no direct Aftermath SUI/BOOM pool was discovered, and both
Aftermath SUI/SHOCK bridges were too shallow.

The simulator therefore also queries SuiDex's read-only route service for direct
SUI/BOOM and SUI/SHOCK bridge estimates, validates pair/input/output/timestamps,
then enumerates Aftermath tails up to the overall three-hop limit. It records
20 mixed-venue candidates per size, including diagnostic paths excluded by the
terminal bound; 8 / 5 / 4 returned positive estimates. Every such result is marked
`executionVerified: false`. Unsupported, malformed or unavailable service quotes
remain explicit failures, never zero-valued quotes or execution routes.

## Evidence and reproducibility

- `simulation.json`: exact base-unit quotes, rejection reasons, identities,
  coverage, timestamps, raw SuiDex responses and all route results.
- `snapshot-{10,50,100}-sui.json`: full SDK pool objects for the relevant graph,
  including weights, reserves and fees, captured for each input size.
- `tests/tree-simulation-replay.test.ts`: offline replay of successful mixed-venue
  estimates and direct Aftermath rejection using the locked SDK and saved state.

Run from the repository root with Node 22 or later:

```sh
npm ci
node --experimental-strip-types scripts/simulate-tree-liquidity-routes.mjs
node --experimental-strip-types --test tests/tree-route-simulation.test.ts tests/tree-bridge-quotes.test.ts tests/tree-simulation-replay.test.ts tests/tree-liquidity-discovery.test.ts tests/tree-liquidity-graph.test.ts tests/tree-venue-discovery.test.ts tests/aftermath-tree-discovery.test.ts tests/tree-swap-route.test.ts
node scripts/verify-production-snapshot.mjs
```

Set `TREE_SIMULATION_OUTPUT_DIR` to write a new run elsewhere and retain this
dated evidence. CI writes `artifacts/tree-liquidity` and uploads it. A fresh run
can differ as pool state changes. The 30-second freshness policy measures capture
age; it does not prove a common blockchain checkpoint. Service clocks may lead
the local clock by up to one second (measured ~372 ms during validation); older
quotes still expire after 30 seconds. Larger future timestamps are rejected.

Validation: all 16 focused tests passed, including real-state SDK replay. The
production verifier passed for 166 static files and 30 exact function packages;
the same five historical unrecovered packages remain unchanged. A pre-existing
generic-type parsing failure in known-pool discovery was fixed and its existing
regression test now passes. Production handlers and swap UI are unchanged.

## Safest next step

Keep PR #28 in draft and keep Best Swap on its existing direct venues. Independently
verify the SUI/BOOM and SUI/SHOCK bridge pool state, then compare these SDK/service
estimates with read-only on-chain simulations of the complete composed paths,
including gas and slippage. The service reports `isComposable: false` for its
selected bridge metadata, so an estimate is not evidence that its transaction
builder supports atomic composition. Only after that validation should a small-leg
split study test whether marginal liquidity improves gas-adjusted execution.

No wallet was connected, no swap was signed or submitted, and nothing was merged
or deployed to production. This is a finite discovery/quote experiment, not an
exhaustive claim about every venue or a recommendation to trade.
