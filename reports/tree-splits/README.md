# TREE chain-authoritative split study

Observed September 19, 2026, 03:14:11–03:14:21 UTC (September 18, 22:14 CDT).
Feature branch `feature/tree-liquidity-graph`, draft PR #28. No production routing changes.

## Result

**None of 73 tested split allocations beat direct V3, even before gas.**
All three input-size studies completed with stable pool versions/digests, and
the closest split in each case allocated 0.01 SUI to BOOM and the remainder to
direct V3. The total-cost comparison also favors direct V3.

| Total swap input | Direct V3 TREE | Closest split TREE | Split gross difference | Difference at equal total SUI cost |
| ---: | ---: | ---: | ---: | ---: |
| 10 SUI | 362,599.834892 | 362,598.602106 | −1.232786 TREE | −110.148073 TREE |
| 50 SUI | 1,812,133.609738 | 1,812,132.723054 | −0.886684 TREE | −109.697999 TREE |
| 100 SUI | 3,622,105.630753 | 3,622,105.176000 | −0.454753 TREE | −109.136311 TREE |

Direct gas was 0.002515724 SUI. The closest split used 0.005519816 SUI, an extra
0.003004092 SUI. Other BOOM/SHOCK and three-leg allocations were also tested.
The quoted amounts differ from earlier reports because these are fresh observations.

## Quote reconciliation

The study **uses checks-enabled full-transaction Move simulation as the quote
authority**, replacing SDK estimates for eligibility, final output and ranking.
The earlier SDK protocol-fee assumption and its reserve guard are retained only
as diagnostics. They cannot reject a simulated-valid candidate or determine its
rank here. No SDK constant, pool weight or reserve is silently altered to force
agreement. `sdkReconciliation` records SDK outputs/errors next to the actual
Aftermath swap-event output for each tested partner leg.

This resolves the operational consequence of the discrepancy without pretending
that the locked SDK math has been repaired. Its approximate fee assumptions remain
a separate unresolved SDK issue, and historical SDK reports remain historical.

Each candidate is one PTB: exact SUI allocations → direct and partner routes →
merge TREE outputs → final minimum-output check → one output transfer. The shared
leg builder is reused from the validated composition work, including the BOOM DAO
wrapper. Simulating the whole PTB captures its fees, gas and any shared state effects.
It does not add separately quoted outputs or assume independent leg gas costs.

## Grid and gas comparison

- Individual BOOM or SHOCK allocations: 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2 and 5 SUI,
  subject to a maximum of 20% of the total swap input.
- Combined allocations: 0.05, 0.1 and 0.25 SUI to each partner, with the remainder
  direct V3. All nine combinations satisfy the 20% limit at these input sizes.
- 10 SUI: 23 splits plus one direct baseline. 50 and 100 SUI: 25 splits plus one
  direct baseline each. This is a finite 73-split grid, not a global optimizer.
- Nine additional direct simulations match split budgets across the three observed
  gas-cost classes per input size. Direct input is adjusted until its input plus
  measured gas equals the split input plus measured gas. If gas changes, the
  comparator re-quotes, and fails closed after three unsuccessful iterations.
- This needs no gas/TREE exchange-rate assumption. The saved comparator input,
  actual output and gas are bound to the same simulated transaction.

The best split at each size was then repeated with a 1% end-to-end output floor.
All three passed. All three deliberately excessive floors failed with
`InsufficientCoinBalance` at the exact expected final split command. In total,
the run made 91 simulations: 76 candidates/baselines, nine equal-cost comparisons,
and six protection/negative controls.

## State validation and limitations

The study independently reads all three bridge/direct pools and both Aftermath
tails, validates SDK tail state against chain state, and verifies the BOOM DAO
wrapper and ownership chain. It records versions/digests and rechecks them at
least every 15 seconds when starting another quote, and at the end of each size.
Any mismatch prevents a completed comparison. A successful conclusion is set only
after the final stability check. Different input-size studies may use different
state; no common historical checkpoint is claimed. Global fee/governance state
is not pinned; the individual simulation remains the authority for actual costs.

The dummy sender uses a server-mocked gas coin. No funds, signatures, keys or
submission calls are involved. Success is not proof of a real user's funding or
future execution. This study covers direct V3 and the verified BOOM/SHOCK paths;
it does not establish optimality across every venue, amount or possible allocation.

## Evidence and reproduction

`split-study.json` retains each allocation, input state, SDK diagnostic, simulation
events, gas, balance changes, exact-cost comparator and final-control transaction.
It is a dated evidence artifact, not a cache to use for live routing.

```sh
node --experimental-strip-types scripts/study-tree-splits.mjs
node --experimental-strip-types --test tests/tree-split-study.test.ts tests/tree-composition-validation.test.ts
node scripts/verify-production-snapshot.mjs
```

Set `TREE_SPLIT_OUTPUT_DIR` to preserve the saved evidence while running again.
CI writes and uploads `artifacts/tree-splits`. The script exits nonzero for missing
state, state drift, simulation failure, nonconverging gas comparison or failed
output-floor controls. Unit tests cover allocation conservation, gas re-quoting,
nonconvergence rejection, exact-cost evidence and three-leg final-output protection.

## Safest next step

The [opt-in comparison tool](COMPARISON-TOOL.md) now implements fresh three-round
comparison and reproducibility checks without changing production routing.

Keep Best Swap on its existing direct routes and keep this PR in draft. The evidence
does not justify enabling BOOM/SHOCK split execution. Use the opt-in comparison
tool to refresh state and flag a reproducible net improvement; execution
integration should wait for that evidence.
The current study does not schedule monitoring or enable any ongoing network work.
