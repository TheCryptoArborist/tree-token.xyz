# Weekly campaign plan — TREE Force '89 first

Corrected November 19, 2026 (America/Chicago), following the project owner's explicit promotion order.

**First: TREE Force '89. Second: Canopy Defense.** Small campaign rewards should encourage people to play the featured game and take an interest in its larger Event. The previous recommendation to make Arborist Trials the first campaign was an assistant assumption and is superseded by this order.

No funded campaign is open. Amounts, assets, payout networks, dates and actual qualifying targets remain unselected.

## Promotion order and purpose

| Order | Game | Campaign purpose | Next work |
| --- | --- | --- | --- |
| 1 | **TREE Force '89** | Get players into the shooter, learning its controls and working toward a clear game-specific goal that leads into its Event. | Audit current score, wave, completion and run records; determine which target can be verified reliably. |
| 2 | **Canopy Defense** | Promote the tower-defense game after TREE Force, with a clear defense-specific objective and its own Event connection. | Audit supported map/wave completion, difficulty, upgrades and continues before choosing a qualifying target. |
| Technical reference only | Arborist Trials | Retain useful authentication, retry, replay and exact-allocation implementation evidence. | Do not use its rules, verifier, card-win target or difficulty results as qualification for either promotion game. |

The promotion order is decided. Game-specific targets and funded terms are not. The setup records that distinction instead of treating an available technical test as the selected promotional game.

## First campaign: TREE Force '89

The featured Campaigns content should make three things clear: which game to play, what published objective earns a qualifying result, and which Event the campaign leads into. The small fixed pool introduces that path; the larger Event provides the next reason to participate.

The working title is **TREE Force '89 Weekly Campaign**. Possible objective categories are reaching a wave, reaching a score or completing a qualifying run. These are options for inspection, not selected requirements or claims about current server verification. Do not invent a wave number or score threshold.

Before selecting the target:

1. Identify the current authoritative game build and the records available for a single run: score, reached wave, completion and run identity.
2. Verify how scores are saved, which values are calculated independently of the browser, and whether replayed submissions can be distinguished.
3. Inspect continues and any other advantages that can affect a result. Define qualifying run conditions without changing ordinary paid play by assumption.
4. Choose a target from TREE Force evidence and actual play, then bind it to the campaign's game version, time window and eligibility rules.
5. Connect the campaign to the actual TREE Force Event and its published entry terms. Campaign completion must not silently create a new Event entry rule.

The inspected Campaigns presentation already names **TREE Force '89: Defend the Canopy**, with dates to be announced. That is the relevant Event direction to confirm when the owner supplies the details. No replacement Event, date or prize amount is created by this plan.

The proposed reward model remains one equal share of a fixed pool for each reviewed qualifying player. Extra qualifying runs must not multiply shares. Whether a particular campaign allows repeated starts, caps starts or selects a best result must be explicitly decided for TREE Force; the Trials retry policy does not automatically transfer.

## Second campaign: Canopy Defense

Use the same clear presentation after TREE Force, with a Canopy Defense-specific goal. A selected map, wave milestone or completed defense may be suitable, but the goal requires its own gameplay and evidence review.

Map, difficulty, upgrades and continues can affect comparability. Establish eligible conditions and the corresponding verifier before announcing rewards. The TREE Force scoring model and Trials win counter are not interchangeable with tower-defense qualification.

Keep the second campaign's pool, date and Event association unselected until its terms are defined. Second in promotion order does not mean a calendar date or funded offer has been scheduled.

## Existing technical work and its limits

The generic equal-share allocator, grouped setup workflow, exact-unit examples and many authentication/idempotency concepts remain useful. The [Arborist Trials pilot](./arcade-challenge-pilot.md) is a separate no-prize technical implementation.

The [5,120-match difficulty assessment](./arcade-campaign-difficulty.md) tested only that pinned Trials card-game engine. It says nothing about TREE Force shooter difficulty or Canopy Defense difficulty. Its one-win/three-win results must not select, weaken or replace a goal for either promoted game.

The setup preserves Trials' exact source snapshot as a labeled technical reference. It is not a verified build or result adapter for TREE Force or Canopy Defense. Their game-specific build, rules and verifier remain unresolved. Similarly, Trials' no-purchase/no-NFT access policy must not be presented as either promoted game's current access policy. Inspect and disclose the actual game eligibility before any funded offer.

## Six setup sections

| Section | Planning content |
| --- | --- |
| Challenge | TREE Force first, Canopy Defense second; exact game-specific build, target, eligible settings and attempt rules still to be reviewed. |
| Schedule | Actual inclusive UTC start and exclusive UTC close; no dates inferred from the Trials pilot or November badge deadline. |
| Pool | Fixed amount, exact asset, decimals and one payout network. |
| Players and review | How the qualifying player, linked wallets, result and payout recipient are reviewed; correction and payout timing. |
| Associated Event | The real Event for the promoted game and its separate entry terms. |
| Final terms | Cancellation, unused units, zero-qualifier handling and other published arrangements. |

Entered planning text is not an authenticated result, verified asset metadata, distinct-human identity or proof of funding. All reviews remain nonpayable and not launch-ready, including after planning choices are filled.

## Local review commands

From the repository root with the existing Node 24 runtime:

```sh
node scripts/arcade-campaigns/setup-cli.mjs review
node scripts/arcade-campaigns/setup-cli.mjs review --json
node scripts/arcade-campaigns/setup-cli.mjs check
```

The default input is `data/arcade-weekly-campaign-setup.json`. Its 22 operator choices remain null; the confirmed promotion order is recorded separately. Use a private copy for planning and pass its path after `review` or `check`. `review` prints Markdown by default, or JSON with `--json`. `check` returns `2` for incomplete/invalid planning records, `0` for complete valid planning fields, and `1` for parsing, file-read or execution failures. A successful check never authorizes launch or payment.

When all five pool fields are valid, the review shows exact-unit examples for 0, 1, 5, 10 and 25 illustrative qualifiers. No budget is inferred. The original generic funding draft and allocator remain unchanged, with 25 unresolved fields in that draft. This local tool contacts no network and performs no signing, database write, deployment or transfer.

## Draft campaign-card copy

> **TREE Force '89 — Weekly Campaign**
>
> Take on **[approved TREE Force objective]** during **[UTC campaign window]**.
>
> **[fixed pool and token]** will be shared equally among reviewed qualifying players, paid on **[network]**. One qualifying player receives one share.
>
> **[actual game access and eligible-run conditions]**
>
> Ready to compete? Explore **[associated TREE Force Event and its entry details]**.

Bracketed fields are unselected. This is working copy, not an active offer. The second campaign will use Canopy Defense-specific copy and rules.

## Next implementation step

Audit TREE Force '89's current run/score/wave evidence and continue behavior, then implement a verifier and campaign objective for that game. Follow with Canopy Defense. Reuse shared infrastructure where it fits, but keep each game's qualification bound to its own evidence. Existing Trials results never become eligible for either promoted game's pool.

The current [MystenLabs skills README](https://github.com/MystenLabs/skills) was checked live for this correction. This is campaign planning and offline review tooling; it makes no Sui SDK, wallet, transaction or dependency change.
