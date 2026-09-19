# TREE composed-path validation

Observed September 19, 2026 at 03:03:44–03:03:48 UTC (September 18, 22:03 CDT).
Branch `feature/tree-liquidity-graph`, draft PR #28. Production Best Swap is unchanged.

Follow-up: the [chain-authoritative small-split study](../tree-splits/README.md)
found no improvement in its tested grid, including gas at equal total SUI cost.

## Result

All nine paths passed full Move transaction simulation with checks enabled:
direct SuiDex V3 SUI/TREE, SuiDex V3 SUI/BOOM → Aftermath BOOM/TREE, and SuiDex V2
SUI/SHOCK → Aftermath SHOCK/TREE, each at 10, 50 and 100 SUI.

| SUI input | Direct V3 TREE | Via BOOM TREE | Via SHOCK TREE |
| ---: | ---: | ---: | ---: |
| 10 | 362,664.795859 | 350,838.135394 | 290,869.030262 |
| 50 | 1,812,458.182003 | 1,571,578.659049 | 819,681.136817 |
| 100 | 3,622,754.194685 | 2,781,246.141067 | 1,060,961.184507 |

Net simulated gas was 0.002515724 SUI for direct V3, 0.005420492 SUI via BOOM,
and 0.009099140 SUI via SHOCK at each size. Net gas is computation plus storage
cost minus storage rebate; the nonrefundable fee is already accounted for and
is not added twice. Sender SUI debits equal exact input plus net gas in every
successful result. Direct V3 strictly dominates these candidates: more TREE and
less SUI spent on gas, without requiring an oracle to convert gas into TREE.

These are **simulations using a server-mocked gas coin and fixed dummy sender**,
not signed transactions or proof of any user's funding. No wallet, private key,
signature or submission endpoint was used. Production integration remains disabled.

## Corrections to the SDK-only findings

- The 30% input/output reserve guard is an **SDK restriction**, not a demonstrated
  contract limit. SHOCK at 50 and 100 SUI succeeds in Move despite SDK refusal.
  Those paths are economically poor, but should not be described as impossible.
- The quote service's `isComposable: false` metadata describes its builder support;
  it is not evidence that the contracts cannot compose. Direct reads of the Move
  signatures show public functions returning balances/coins, and complete PTBs
  successfully pass the intermediate coin into Aftermath.
- The locked SDK uses `Pools.constants.feePercentages.totalProtocol = 0.00005`
  (0.005%, or 0.5 basis points). Comparing simulated bridge outputs, verified DAO
  fees and Aftermath swap-event inputs shows a ~0.0005 deduction (0.05%, or 5 bps).
  This is an **inference from execution amounts**, not a fetched fee configuration.
  The SDK overstates available BOOM-path outputs by 3.55–4.38 bps and the 10-SUI
  SHOCK output by 3.72 bps. The existing SDK is not patched or silently calibrated.

The historical SDK report remains saved, with a link to these corrections.

## What was verified

Bridge object IDs, exact package/type/coin direction, shared ownership, positive
reserves and (for V3) active liquidity, sqrt price and fee bounds were checked
directly through mainnet gRPC. The saved ABI inspection verifies public V3
`flash_swap` / `repay_flash_swap` and V2 `swap_exact_tokens0_for_tokens1_composable`.

For both Aftermath tails, SDK coin identities, normalized reserves, decimal
scalars, weights, flatness and trade fees were matched against independent chain
objects. BOOM/TREE's 200-bps DAO fee and wrapper's pool ID were verified, including
the pool → dynamic-field parent → shared DAO-wrapper ownership chain. The builder
uses `daoFeePoolTradeTx` for BOOM, not the plain shared-pool swap function.

Each of the nine cases runs three unsigned simulations:

1. Discover the actual full-path output with a one-base-unit diagnostic floor.
2. Repeat the complete path with an end-to-end floor of 99% of that observed output.
3. Require twice the observed output as a negative control. All nine abort with
   `InsufficientCoinBalance` at the expected final minimum-output command.

The floor is enforced by splitting the final TREE coin before merging it back
and transferring the full output. No intermediate coin is transferred away by
the route builder. Contract fee transfers still occur in the simulated effects.
All path operations belong to one PTB, so a minimum-output failure aborts the
whole simulated transaction. Only the final TREE amount is protected, not a
separate slippage allowance for every leg.

Reads and successive simulations do not share one pinned checkpoint. Object
versions/digests and timestamps are retained; a 30-second capture-age bound
prevents the script from building on old validation. These checks do not prove
future execution, wallet funding, price stability or universal venue coverage.

## Evidence and checks

- `chain-inspection.json`: independently read pool objects and Move signatures.
- `composed-simulation.json`: all 27 simulation results, before-state pool objects,
  SDK state, DAO ownership evidence, protected PTB command data, gas accounting,
  fee discrepancies and expected negative-control failures.
- `tests/tree-composition-validation.test.ts`: identity/fee/reserve mismatch
  rejection, gas conservation, dummy-sender builder bounds, final-floor placement,
  and regressions distinguishing SDK refusal from successful Move simulation.

Five new tests passed, along with TypeScript checking and production snapshot
verification. The existing 16 routing tests remain in the branch workflow. Run:

```sh
node --experimental-strip-types scripts/inspect-tree-bridge-chain.mjs
node --experimental-strip-types scripts/simulate-tree-composed-paths.mjs
node --experimental-strip-types --test tests/tree-composition-validation.test.ts
node scripts/verify-production-snapshot.mjs
```

Use `TREE_COMPOSITION_OUTPUT_DIR` for a new evidence directory. CI writes and
uploads `artifacts/tree-composition`; the simulator exits unsuccessfully if any
state check, protected path, or expected negative control does not pass.

## Safest next step

Keep the PR in draft and leave Best Swap unchanged. Reconcile the SDK's fee and
reserve-guard assumptions using chain-derived quotes, then run a read-only
small-leg split study with full-transaction gas and final-output protection.
There is no evidence here supporting switching a whole 10–100 SUI order away
from the existing direct V3 route.
