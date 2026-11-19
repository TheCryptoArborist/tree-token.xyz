# First weekly campaign — setup and working brief

Prepared November 18, 2026 (America/Chicago; November 19 UTC).

**Status: offline proposal. No funded campaign is open.** This milestone adds a
reproducible difficulty assessment and a local operator setup/review flow. It
does not change the published free pilot, select a budget, publish prize terms
or enable payouts. The actual funding draft remains deliberately incomplete.

## Recommendation

Use the first small Campaigns pool to reward participation and introduce players
to the associated larger Event. A clear, accessible win condition fits that
purpose. Keep the stronger skill challenge as a separate rules-design step:
the current evidence does not support describing a single win, or three wins
with generous retries, as a demanding skill filter.

The proposed first campaign has one game, one fixed pool, one payout asset and
network, one week-long window, and one equal share per reviewed qualifying
player. These are proposed terms, not an announcement. The amount, exact dates,
player-review process and real Event pairing still need to be chosen.

The working candidate is **Arborist Trials — Weekly Practice Challenge**, using
the pinned Root Rush variant. “Win one eligible match” is the simplest candidate
objective for a participation campaign. The setup keeps the actual objective
unselected so that this recommendation cannot silently become funded terms.

## What the difficulty check found

The offline experiment ran 5,120 matches against the exact pinned four-card
engine: 2,560 per scripted policy, grouped into 256 sequences of ten fresh
attempts. Both policies see only the same public information a player receives;
neither gets a hidden opponent hand, game seed or future action. The two policies
use matched starting seeds, although different choices can change later random
draws and opponent actions.

| Measure | Random legal choices | Simple Growth-first choices |
| --- | ---: | ---: |
| Wins across all 2,560 matches | 1,362 (53.20%) | 2,073 (80.98%) |
| Groups earning at least one win within five attempts | 248 / 256 (96.88%) | 255 / 256 (99.61%) |
| Groups earning at least three wins within five attempts | 138 / 256 (53.91%) | 236 / 256 (92.19%) |
| Groups earning at least one win within ten attempts | 255 / 256 (99.61%) | 256 / 256 (100%) |
| Groups earning at least three wins within ten attempts | 247 / 256 (96.48%) | 256 / 256 (100%) |

Source: [`arcade-campaign-difficulty-evidence.json`](./arcade-campaign-difficulty-evidence.json).
Method, limitations and reproduction:
[`arcade-campaign-difficulty.md`](./arcade-campaign-difficulty.md).

These are results for two simple scripts on a fixed synthetic dataset, not
human success rates, optimal play or an anti-bot guarantee. The Growth-first
policy intentionally ignores several strategic factors; more capable scripts
may perform better. The experiment does not simulate the real fifteen-minute
deadline, human deliberation, network delays, abandonment or multiple accounts.

The practical implication is narrow but useful: more retries make this target
very accessible, even without thoughtful card selection. Raising the target to
three wins would add repeated play without establishing human skill. A separate
funded skill challenge needs a deliberately reviewed objective and starting
conditions, tested against both stronger scripts and actual player experience.

## Six sections in the setup

| Section | Already known | Decision still required |
| --- | --- | --- |
| Challenge | Pinned Trials engine, Root Rush date, four standard cards, no paid advantages, current single-match win result | Participation objective versus a newly designed skill objective; exact funded attempt policy and starting conditions |
| Schedule | UTC start is inclusive and close is exclusive | Actual weekly start and end; the free pilot's dates are not reused automatically |
| Pool | Equal whole-unit shares can be calculated exactly | Fixed amount, exact asset, decimals, payout network, funding source and transaction-fee allowance |
| Players and review | One share per canonical qualifying player is the intended model | How linked wallets and duplicate players are reviewed, who reviews, and how recipients are confirmed |
| Associated Event | `/play/#events` is a valid discovery destination | The real named Event, its dates and separate entry terms |
| Final terms | Unused units can remain unallocated; no automatic carryover is implemented | Cancellation, unused-pool handling, payout timing and a correction/dispute period |

The setup separates source facts, suggested terms and actual operator decisions.
An entered value is an operator assertion, not evidence of funding, verified
asset metadata, distinct-human identity or a published promise. Completing the
worksheet still produces `payable: false` and `launchReady: false`.

### Using the local setup

Run from the repository root with the existing Node 24 runtime:

```sh
node scripts/arcade-campaigns/setup-cli.mjs review
node scripts/arcade-campaigns/setup-cli.mjs review --json
node scripts/arcade-campaigns/setup-cli.mjs check
```

The default input is `data/arcade-weekly-campaign-setup.json`. It deliberately
contains **22 unselected operator choices**, grouped into the six sections.
`review` prints readable Markdown; `--json` prints the structured review.
`check` returns exit code `2` for incomplete or invalid planning records and `0`
only when their fields are complete and valid. Parsing, file-read and execution
failures return `1`. Source-reference mismatches block the review, and altered
engine bytes stop source loading. A zero exit code still does not authorize
launch or payment.

For actual planning, edit only `decisions` in a private copy and pass its path:

```sh
node scripts/arcade-campaigns/setup-cli.mjs review /path/to/private-setup.json
node scripts/arcade-campaigns/setup-cli.mjs check /path/to/private-setup.json
```

The commands read local files and write their report to standard output. They
have no network, wallet, database, signing or payment operation. Source changes
require explicit review; the tool never silently updates the pinned reference.
All five pool fields must be valid and supplied before hypothetical shares are
shown for 0, 1, 5, 10 and 25 qualifiers. These counts are illustrative, and entered
asset metadata remains unverified. No amount is inferred from a ticker.

The original `data/arcade-campaigns-draft.json` and its strict allocator are
unchanged. Its **25 unresolved fields** still block freezing. The new setup
envelope provides the date-specific implementation context and review process
that the generic schema cannot currently express; it does not upgrade that
schema into a funded service.

### Challenge and attempt rules

The exact game variant matters. The pilot fixes the challenge date to November
18, 2026, which selects Root Rush. A game version and ruleset name alone do not
bind the date-derived modifiers. The setup records the original engine source
hash, adapter version, pilot rule hash, challenge date, maximum moves, duration
and hand rules, then checks those references against the repository.

The current pilot deals four standard cards with at least one Attack, Growth
and Hybrid card. It does **not** give everyone identical-strength hands, and it
contains chance effects. The player acts first and can win before the opponent
responds. “No paid advantages” is accurate; “equal starting hands” or “pure
skill” would overstate what this implementation provides.

The current limit of twenty active, unexpired attempts is a concurrency guard.
It is not a total weekly start limit. For a funded challenge with a stated
attempt allowance, count every accepted start against the reviewed player,
including abandoned, losing and expired attempts. Decide the allowance before
opening a window. A retry of the same committed request must not consume a new
start. Additional wins must never increase that player's equal-share allocation.

If the final objective spans several matches, implement an authenticated
aggregate over distinct eligible completed attempts. The existing offline
allocator checks each run separately, and the pilot's `wins` result is binary.
Setting its target to `3` would not implement “win three matches.”

### Pool and review

For pool `P` in the asset's smallest units and `N` finalized qualifiers, each
player receives `floor(P / N)` units. The remaining units stay explicit. A
fixed total budget does not imply a fixed per-player reward. Allocation examples
are planning estimates until both terms and the qualifying roster are final.
The proposed policy leaves the full pool unallocated if nobody qualifies and
leaves any indivisible remainder unallocated. If a share would be zero smallest
units, the tool exposes that outcome instead of quietly selecting fewer winners.

For a small first campaign, a manageable manual review of player profiles and
linked payout wallets is a practical proposal. The actual checks and a way to
correct mistaken exclusions must be written before announcing eligibility.
Neither a signed wallet message nor a manually entered player identifier proves
that an applicant is a distinct human. This milestone adds no identity service.

Keep one payout network per campaign. The setup can name a proposed network,
but that does not create a connector or settlement capability for that chain.
Expansion to other chains should follow an actual available game, wallet and
payout integration, with the same player receiving at most one share.

### Event connection

The general Events tab can be offered as discovery while the association is
being planned. Do not label a generic link as a verified campaign/Event pairing.
The inspected featured Event is TREE Force '89: Defend the Canopy, with dates
still to be announced; it does not establish an Arborist Trials Event.

Before the campaign is announced, pair it with a real Event and explain how the
campaign prepares someone for that Event. If the first funded Event uses a
different game, select a relevant preparation activity rather than implying the
Trials pilot is its qualifier. Campaign completion must not silently become an
additional Event entry requirement.

## Player-facing copy to complete after the terms are selected

> **Arborist Trials — Weekly Practice Challenge**
>
> Fixed prize pool: **[amount and token]**, paid on **[network]**.
>
> Play for free and complete **[approved objective]** between **[start UTC]** and
> **[exclusive closing time UTC]**. You may start **[published allowance]** eligible
> attempts. No purchase or paid gameplay advantage is required or allowed.
>
> Each reviewed player who qualifies receives one equal share of the fixed pool.
> Your final share depends on the final number of qualifiers. See the rules for
> player review, unused units, payout timing and corrections.
>
> Ready for the next challenge? **[named Event and its separate entry details]**.

This is an editable copy template. None of its bracketed fields is an active
offer. Earlier free-pilot results will not gain retroactive prize eligibility.

## What this milestone completes

- Reproducible synthetic difficulty evidence and a clear interpretation for the
  proposed participation campaign.
- A local setup/review record that binds the actual candidate implementation
  without confusing it with selected funded terms.
- Grouped missing decisions and exact-unit allocation examples when valid pool
  metadata is entered.
- Regression checks for source drift, malformed setup input and the continuing
  nonpayable boundary.

The next implementation milestone is a separately versioned funded rule schema
and qualification flow: bind the actual objective and starting conditions,
count accepted starts, review canonical player identities, and retain the exact
eligible evidence behind each share. Final funding, named Event, dates and
payout authorization require actual selected terms. The live practice pilot and
the existing Event and monthly rules remain unchanged by this work.

## Guidance checked

The current [MystenLabs skills README](https://github.com/MystenLabs/skills)
was checked live for this request. The routing guidance in
[`frontend-apps/SKILL.md`](https://github.com/MystenLabs/skills/blob/main/frontend-apps/SKILL.md)
and
[`sui-ts-sdk-backend/SKILL.md`](https://github.com/MystenLabs/skills/blob/main/sui-ts-sdk-backend/SKILL.md)
was reviewed. This milestone is offline Node tooling and documentation; it
introduces no Sui SDK, wallet, signer, chain-reader or dependency change.
