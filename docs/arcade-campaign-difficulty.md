# Root Rush difficulty and repeat-attempt evaluation

This is **offline scripted-play evidence**, prepared November 18, 2026 in
America/Chicago (November 19 UTC). It does not measure human skill, authorize
rewards, change pilot rules or establish eligibility for a funded campaign.

**Promotion scope correction, November 19:** TREE Force '89 is the first game
to promote; Canopy Defense is second. This report remains an Arborist Trials
technical reference only. Its win rates, card rules and retry findings do not
measure either promoted game's difficulty or define their campaign objectives.
See the [corrected campaign plan](./arcade-weekly-campaign-setup.md).

The important result is that **a simple growth-first script won 2,073 of 2,560
matches (80.98%)**. In each of its 256 groups of ten fresh attempts, it won at
least three matches. Increasing the target from one win to three therefore
does not screen out this straightforward automation under that attempt budget.

The complete reproducible evidence is
[`arcade-campaign-difficulty-evidence.json`](./arcade-campaign-difficulty-evidence.json).
The measurements below come from that file, not live players or production data.

## Frozen scope and provenance

| Item | Evaluated value |
| --- | --- |
| Game | The isolated no-prize Arborist Trials pilot |
| Fixed rules date | November 18, 2026; **Root Rush**, standard rule |
| Objective | Reach 50 Growth before Garden Bot |
| Cards | Four standard cards; no fifth card or paid advantage |
| Attempt end | Win, loss or the adapter's 100-move limit |
| Source | `TheCryptoArborist/gardenbattles` commit `4a27b3ac73ec815c9e28c23a6b0d07f09ee73794` |
| Isolated game version | `campaign-pilot-4a27b3ac-v1` |
| Ruleset / adapter | `portable-v1-four-card` / `arborist-trials-portable-four-card` 1.0.0 |
| Source hash | `9623279e03ddab211d51e26f89040afc0b8aee4ff86fc19af53243096215ca00` |
| Pilot rules hash | `ef07c5212301565b10faffc1e8fb97347fad522c6dc3e3f15bdf58d12b3c9b2d` |
| Suite | 256 groups × 10 attempts × 2 policies = **5,120 matches** |
| Ordered run-record digest | `53d02264da076627f3ec144cea3662cf81b2c1535a03e3d9dc4e2079ffbe2d20` |

The evaluator checks the literal expected pilot and source hashes and verifies
every generated engine module against its recorded SHA-256 before running.
The companion adapter tests also verify the original upstream files and the
complete provenance binding. The report records hashes of the evaluator,
policy file and adapter, as well as the ordered fixture-seed and run-record
digests. It contains four fixed audit examples rather than thousands of logs.

The pilot configuration is
[`data/arcade-challenge-pilot-november-2026.json`](../data/arcade-challenge-pilot-november-2026.json).
The engine's preserved source and limitations are described in
[`vendor/arcade-trials-engine/README.md`](../vendor/arcade-trials-engine/README.md).
This is not an assertion of parity with the current deployed daily Garden
Battles game or the other rotating Trials variants.

## What the scripts can see

Both policies receive **only the immutable player-visible view** returned by
`inspectReplay`: their dealt cards, legal actions, visible Growth and status
effects, the intended forecast if present, and the last public round log.
Root Rush has no forecast. The evaluator retains the challenge privately for
replay; it never passes the game seed, RNG state, hidden opponent hand or future
actions to a policy.

| Policy | Decision rule |
| --- | --- |
| `uniform-legal-v1` | Choose uniformly from the currently legal cards. A separate SHA-256 counter stream and rejection sampling provide reproducible choices without consulting game randomness. |
| `growth-first-v1` | Choose the largest printed expected immediate own-Growth gain, including immediately prevented visible poison/delayed damage when cleansing. Use the current visible conditions for conditional gains; break ties by lowest card ID. |

For example, the growth script scores Wildwood Gamble as `0.6 × 20 − 0.4 × 4 =
10.4`, Solar Bloom as the mean of 8 through 14 (11), and Potassium Power as
`0.75 × 15 + 0.25 × 3 = 12`. It reads only public past-card types for conditional
cards. The complete policy is in
[`difficulty-policies.mjs`](../scripts/arcade-campaigns/difficulty-policies.mjs).

This heuristic is deliberately approximate. It ignores natural-growth
thresholds, gain clipping near 50, direct attack value, defensive value, the
Growth donated to the opponent by Canopy Downpour, and future positions. It does
not look ahead, reconstruct randomness or optimize a finishing move. The
engine gives the player the first action; that property is retained, not
experimentally separated. More informed scripts may perform better. These
results establish what these particular scripts achieved, not an optimal
automation bound or a human success forecast.

## Deterministic experiment

The dataset identifier is `tree-arcade:offline-root-rush-difficulty:v1`.
Each public synthetic game seed is SHA-256 of that identifier, a `game`
domain label, the zero-based group index and the zero-based attempt index,
separated by newlines. The random policy uses the separate `policy-choice`
domain and a draw counter. No live seed, wallet, credential, database, network
call or account record is read.

The two policies use the same initial seed for each pair, so their initial
hands and Growth match. **Later random paths can diverge**: different card
choices can consume different numbers of random draws. The experiment does
not claim an identical future chance sequence for different policies.

All 2,560 declared starting seeds are evaluated for both policies; no seeds are
chosen based on a win, loss or attractive hand. Each group contains ten fresh
attempts, completed in order without selective abandonment. Qualification
counts use the actual first one, three, five or ten outcomes within each group.
There is no binomial extrapolation or assumption that the observed rate predicts
the next person's outcome. A group is a bookkeeping unit, not a real person.

## Match outcomes

| Metric | Uniform legal script | Growth-first script |
| --- | ---: | ---: |
| Matches | 2,560 | 2,560 |
| Wins | 1,362 (53.20%) | 2,073 (80.98%) |
| Losses | 1,196 (46.72%) | 487 (19.02%) |
| Reached 100-move limit without a result | 2 (0.08%) | 0 |
| Mean moves, all matches | 9.34 | 5.74 |
| Median moves, all matches | 8 | 5 |
| 90th percentile moves, all matches | 14 | 8 |

Across the 2,560 paired starts, both scripts won 1,191 times; only uniform
legal won 171 times; only growth-first won 882 times; and neither won 316 times.
Move counts are not elapsed human playing times.

Every hand includes at least one Attack, Growth and Hybrid card. That balances
types, not card strength. For example, growth-first won 836/974 matches with two
Growth cards (85.83%), compared with 761/1,000 with two Attack cards (76.10%).
These are descriptive groups with different card and opponent combinations,
not a causal estimate of the benefit of substituting one card.

## One win versus repeated wins

Each cell is the number of **synthetic groups out of 256** that reached the
target within the stated number of fresh attempts. Percentages describe those
groups only. The first-attempt row uses 256 starts, whereas the match table
above uses all 2,560 starts per policy.

| Attempt allowance | Required wins | Uniform legal script | Growth-first script |
| ---: | ---: | ---: | ---: |
| 1 | 1 | 132/256 (51.56%) | 207/256 (80.86%) |
| 3 | 1 | 226/256 (88.28%) | 252/256 (98.44%) |
| 3 | 2 | 142/256 (55.47%) | 223/256 (87.11%) |
| 3 | 3 | 37/256 (14.45%) | 131/256 (51.17%) |
| 5 | 1 | 248/256 (96.88%) | 255/256 (99.61%) |
| 5 | 2 | 221/256 (86.33%) | 252/256 (98.44%) |
| 5 | 3 | 138/256 (53.91%) | 236/256 (92.19%) |
| 10 | 1 | 255/256 (99.61%) | 256/256 (100%) |
| 10 | 2 | 252/256 (98.44%) | 256/256 (100%) |
| 10 | 3 | 247/256 (96.48%) | 256/256 (100%) |

This supports keeping a one-win target for the current free participation
pilot. Repeated wins increase the number of matches required, but they should
not be treated as a substitute for identity review, human-play evidence or a
deliberate funded qualification design. Even a five-attempt allowance leaves
the simple growth script at 255/256 for one win and 236/256 for three wins.

The experiment does not select a cash budget, a launch window, a funded retry
limit or a different live objective. A future funded use of this Trials implementation still needs those
decisions and the verification/review work described in
[`arcade-campaign-foundation.md`](./arcade-campaign-foundation.md).

## Fair repeat-attempt rules to decide before a funded campaign

The current pilot permits at most **20 active, unexpired attempts per wallet
and pilot**. That is a concurrent-attempt limit, not a weekly total-start cap.
The actual restriction is in
[`20261118223908_arcade_challenge_pilot.sql`](../supabase/migrations/20261118223908_arcade_challenge_pilot.sql),
and the scoped-auth migration preserves this behavior. The offline allowance
table does not implement or verify any new live limit.

For a future bounded funded competition, define a start as the server's first
successful issuance of a fresh attempt. The following are proposed rule
semantics, not changes to the pilot:

- A fresh dealt hand consumes one attempt, even if the player abandons it.
  Otherwise a total-attempt limit can become an unlimited search for a hand.
- An identical request retry, resumed game or page reload keeps the same
  attempt and must not consume an additional one. The existing pilot's stored
  request/version design provides this distinction within an issued attempt.
- A documented platform failure needs a published review/replacement policy,
  with an audit record. A player should not lose a legitimate opportunity
  solely because a response was lost, nor receive silent hand rerolls.
- Count any funded allowance against the campaign's approved participant
  identity. A per-wallet counter alone does not establish one person.
- Once a participant qualifies, extra wins must not increase that person's
  equal share. Practice can remain available separately.

Do not choose a hard human attempt allowance solely from these script results.
Real pilot observation is still needed for first-time comprehension, finish
time, interruptions and accessibility. The 15-minute server deadline, the
original session's earlier expiry, network latency, human deliberation and
abandoned starts were **not simulated**. Selective hand rerolling and more
advanced automation were also not evaluated. The inherited 32-bit game PRNG
is not a cryptographic anti-bot mechanism.

## Reproduce and verify

From the repository root, using the existing Node 24 runtime:

```sh
node scripts/arcade-campaigns/difficulty-evaluation.mjs > docs/arcade-campaign-difficulty-evidence.json
node --test tests/arcade-campaign-difficulty.test.mjs tests/arcade-trials-adapter.test.mjs
```

The CLI accepts no arguments and always runs the declared 256 × 10 × 2 suite.
The first test regenerates the full report and requires exact equality with
the committed evidence. Other focused tests check clock/global-randomness
independence, public immutable policy inputs, legal replay, hidden-field
access guards, actual grouped qualification arithmetic, bounds and source
hashes. The eight evaluator tests and 20 existing adapter tests passed locally.
The complete suite ran in about five seconds on the available runtime; that is
machine execution time, not player completion time.

`AGENTS.md` and the live MystenLabs/skills README were checked for this work.
The experiment is standalone offline JavaScript and makes no Sui Move, SDK,
wallet, transaction or deployment decision, so no Sui-specific skill applied.
Production, authentication, rewards, SDK dependencies and deployed game files
were not changed by this evaluation.
