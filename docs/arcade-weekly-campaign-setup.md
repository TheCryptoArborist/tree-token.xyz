# Weekly campaign rotation — every working Arcade game

Updated November 19, 2026 (America/Chicago), following the project owner's direction to rotate every working game.

**Every working Arcade game belongs in the recurring rotation. TREE Force '89 opens the first cycle, and Canopy Defense follows second.** Small campaign rewards should encourage people to play the featured game and take an interest in its larger Event. These opening priorities are part of the full Arcade rotation.

No funded campaign is open. Amounts, assets, payout networks, dates and actual qualifying targets remain unselected.

## Initial rotation and purpose

The canonical [Arcade Games page](https://tree-token.xyz/play/) was read on November 19, 2026 and lists six LIVE cabinets. The first two positions follow the owner's instruction; the remaining positions follow the existing LIVE cabinet order.

| Turn | Game | Campaign focus to define from that game's evidence |
| --- | --- | --- |
| 1 | **TREE Force '89** | Shooter score, wave or completed-run objective; lead into its Event. |
| 2 | **Canopy Defense** | Defense-specific map, wave or completion objective and Event. |
| 3 | **Canopy Breaker** | A suitable score, stage or completion objective for the breaker game. |
| 4 | **Garden Bot** | A suitable completed-match or strategy objective. |
| 5 | **PvP Battle** | A suitable head-to-head objective using its actual entry and result rules. |
| 6 | **Arborist Trials** | The ordinary LIVE daily game, with its own daily/practice rules. |
| Next cycle | **Return to TREE Force '89** | Repeat through the eligible roster, including newly ready games. |

These objective categories are planning options, not selected thresholds or claims of existing funded verification. LIVE labels establish the public listing, not a fresh end-to-end gameplay test. Recheck availability and actual access before featuring a game; assess funded qualification separately.

**Ordinary Arborist Trials belongs in the rotation.** Its cabinet leads to the normal game at `https://nftree.net/battle/trials`. The separate `/play/challenge/` no-prize technical pilot is not an extra rotation entry, and its verifier does not automatically validate the ordinary game.

### How the rotation should work

- Feature one game per suggested seven-day window. Actual UTC dates remain unselected.
- Give every currently eligible game a turn before repeating. After the six-game opening cycle, begin the next cycle.
- Temporarily skip a game that is unavailable, retain it in the roster, and return it to a later eligible turn. Do not confuse an ordinary access requirement with an outage.
- Add newly working games to future cycles. The roster can grow; it is not permanently limited to these six entries.
- Keep a single featured campaign and any selected weekly pool focused on that game's turn. Membership in the rotation does not automatically fund a pool.
- Set an objective suited to each game. Record its rules, prize terms and actual Event link before announcing a funded opportunity.
- Keep existing live campaign terms fixed during their window. A roster change does not rewrite an active campaign's target, payout or cutoff.

The planning record encodes this policy but has **no automatic activation or scheduler**. A recurring product rotation is not a background reminder task or permission to spend weekly funds.

### Games waiting to join

The current cabinets mark **Arboretum, Deadfall Run, TREE: Root Rage and Canopy Clash** as PREVIEW. Two other cabinets are unnamed COMING SOON slots. They join the rotation when their publicly playable release is ready. Preview status is not a claim that a game is broken; Root Rage's current cabinet, for example, links to a preview video.

### Campaigns tab presentation

The intended layout is a compact **This week's game** feature, **Up next**, and a readable or expandable **Full rotation** list within Campaigns. Keep Games focused on its playable cabinets. The existing Daily spotlight-voting control remains separate until its effect on a future cycle is explicitly designed; it must not silently prevent working games from receiving a turn.

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

Keep the second campaign's pool, date and Event association unselected until its terms are defined. Continue the cycle with Canopy Breaker, Garden Bot, PvP Battle and ordinary Arborist Trials. Rotation positions do not create scheduled dates or funded offers.

## Existing technical work and its limits

The generic equal-share allocator, grouped setup workflow, exact-unit examples and many authentication/idempotency concepts remain useful. The [Arborist Trials pilot](./arcade-challenge-pilot.md) is a separate no-prize technical implementation.

The [5,120-match difficulty assessment](./arcade-campaign-difficulty.md) tested only that pinned Trials card-game engine. It does not measure difficulty across the rotation or establish equivalence to the ordinary LIVE Arborist Trials build. Its one-win/three-win results must not select, weaken or replace the goals for other games.

The setup preserves Trials' exact source snapshot as a labeled technical reference. It is not a verified build or result adapter for the other games, or proof of parity with ordinary LIVE Trials. Game-specific builds, rules and verifiers need their own review. Similarly, the technical pilot's no-purchase/no-NFT access policy must not be presented as every rotation game's current access policy. Inspect and disclose the actual game eligibility before any funded offer.

## Six setup sections

| Section | Planning content |
| --- | --- |
| Challenge | Every working game rotates, opening with TREE Force and Canopy Defense; each game needs its own reviewed build, objective and eligible settings. |
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

The default input is `data/arcade-weekly-campaign-setup.json`. Its 22 operator choices remain null; the initial six-game order and recurring rotation policy are recorded separately. Use a private copy for planning and pass its path after `review` or `check`. `review` prints Markdown by default, or JSON with `--json`. `check` returns `2` for incomplete/invalid planning records, `0` for complete valid planning fields, and `1` for parsing, file-read or execution failures. A successful check never authorizes launch or payment.

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

Bracketed fields are unselected. This is working copy, not an active offer. Subsequent campaigns use the same clear format with the featured game's own copy and rules.

## Next implementation step

Start the rotation's game-specific work with TREE Force '89's current run/score/wave evidence and continue behavior, then Canopy Defense. Continue through every working game in the roster. Reuse shared campaign infrastructure where it fits, while keeping each game's objective and qualification bound to its own evidence. Technical-pilot results never become eligible for the featured games' pools.

The current [MystenLabs skills README](https://github.com/MystenLabs/skills) was checked live for this correction. This is campaign planning and offline review tooling; it makes no Sui SDK, wallet, transaction or dependency change.
