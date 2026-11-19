# Weekly campaign and skill-challenge foundation

This change prepares an **offline operator draft and allocation dry run**. It
does not open a campaign, fund a pool, publish terms, verify a person, verify a
game result, or authorize a payment. The foundation draft and allocation CLI
are not wired into a public route or a production release. The actual draft keeps the budget, asset,
network, dates, game build, skill target, verification adapters and associated
Event unset.

The proposed relationship is straightforward: a small, free campaign helps a
player discover and practice a game; its final action links to the associated
Event. A skill challenge gives **one equal share of a fixed pool to each verified
player who meets the published target**. More successful attempts do not buy or
earn more shares. Completing a campaign does not add an Event entry requirement.
Monthly check-in rewards and the existing Event terms are separate decisions.

**Confirmed rotation scope (November 19, 2026): every working Arcade game.**
TREE Force '89 opens the first cycle, followed by Canopy Defense, then the
remaining working games before the cycle repeats. Ordinary LIVE Arborist Trials
belongs in that roster. The isolated `/play/challenge/` Trials pilot remains a
technical reference, not an additional rotation slot or a verifier for the
other games or the ordinary Trials build.

The next implemented stage is documented in
[`arcade-challenge-pilot.md`](./arcade-challenge-pilot.md): a versioned Arborist
Trials verifier, authenticated per-move service and private transactional pilot
ledger. The free, explicitly nonpaying pilot is published, with isolated
pilot-only authentication and recorded canonical start/play/retry/resume
verification. That protocol check did not finish a winning match or establish
distinct-human identity. Funded qualification and payouts remain pending. This
offline allocator keeps its original input-assertion and nonpayable boundaries.

The current promotion plan is the
[`weekly campaign setup and working brief`](./arcade-weekly-campaign-setup.md),
with the confirmed game order, grouped operator choices and an offline share
preview. Its pinned Trials source record is a technical reference only. The
[`difficulty evaluation`](./arcade-campaign-difficulty.md) reproduces 5,120
scripted matches against that pilot, not the promoted games. These additions do not fill this
foundation's actual draft or activate funded eligibility.

## What is ready to review

| File | Purpose |
| --- | --- |
| `data/arcade-campaigns-draft.json` | Actual operator planning record. Unchosen terms are `null`; its check intentionally fails until those decisions are made. Free entry and no purchase requirement are the proposed campaign defaults. |
| `scripts/arcade-campaigns/core.mjs` | Strict draft validation, content-addressed frozen drafts, evidence consistency checks, one-player allocation and exact integer accounting. |
| `scripts/arcade-campaigns/dry-run.mjs` | Local-file CLI with `check`, `freeze`, `plan` and `demo` commands. It writes reports to stdout only. |
| `scripts/arcade-campaigns/synthetic-demo.mjs` | Clearly fictional historical game, players, verifier and nontransferable TEST units. Never a real funding offer. |
| `tests/arcade-campaign-foundation.test.mjs` | 28 focused tests, including exact arithmetic, evidence rejection, cutoff boundaries, identity duplication, immutable-rule binding and real CLI behavior. |

Run from the repository root:

```sh
node scripts/arcade-campaigns/dry-run.mjs check
node scripts/arcade-campaigns/dry-run.mjs demo
node --test tests/arcade-campaign-foundation.test.mjs
```

`check` returns exit code **2** for any draft validation failure, including the
deliberately incomplete real draft. Execution or JSON parsing errors and invalid
`freeze`/`plan` inputs return **1**. Successful commands return **0**.
The demo accounts for ten fictional smallest units: three verified-input
identities receive three units each and one unit remains unallocated. A fourth
attempt by an existing identity does not increase that identity's share.

After an operator completes a private planning copy, `freeze draft.json` prints
its frozen draft. `plan frozen.json evidence.json UTC_AS_OF` prints the roster;
the final argument must be an explicit ISO UTC time at or after the closing
instant. The synthetic module is a complete example of the input shape. These
commands read local JSON, require no credentials or dependencies beyond Node,
and contain no network, wallet, signing or transfer operation.

## Allocation and verification boundaries

All monetary amounts are **strings of smallest token units**, converted directly
to `BigInt`. The asset is identified by the chosen network and exact asset ID;
the ticker is display metadata. The operator must verify decimals and network
limits when a real asset is selected. There is no conversion between assets and
no pooled value across chains.

For a pool `P` and `N` qualifying identities, every identity's allocation is
`floor(P / N)`. The report shows `allocatedUnits` and `unallocatedUnits`, with
their sum equal to the original pool. Before freezing, both the residual and
zero-qualifier policies must explicitly be `leave-unallocated`. There is no
automatic carryover, donation, organizer payout or rounding bonus. If nobody
qualifies, the entire pool stays unallocated. If the pool contains fewer units
than qualifying identities, every calculated share is zero and the complete
pool remains unallocated; the report exposes that condition rather than
selecting a smaller set of winners.

The exact game ID, build version, ruleset, target, asset, time window,
verification identifiers, eligibility policies and Event association are hashed
together using canonical JSON and SHA-256. A serialized frozen draft is checked
again when used, so modifying a term without changing the hash is rejected.
An evidence manifest and every run must reference that same campaign and rule
hash. A hash identifies a particular rules snapshot; it **does not prove that
the organizer approved or published it**. The offline freeze operation is not
a public registry, signature, timestamp authority or production edit lock.

Both the start and finish of a qualifying run must fall within the published
UTC interval: start is inclusive and end is exclusive. Review may finish after
the deadline, but the claimed gameplay completion may not. A review timestamp
cannot precede completion or follow the supplied as-of instant. The first
version supports one exact integer metric with `gte`, `lte` or `eq`. A complex
multi-stage challenge requires a reviewed adapter and an explicitly expanded
schema before use.

The manifest separates reviewed identity records from reviewed runs. Reused
player IDs, identity evidence, run IDs or original evidence hashes block an
ambiguous manifest. An unknown identity, unreviewed identity, unreviewed run,
browser/client source, wrong verifier, changed game version, wrong rule hash,
paid gameplay advantage, debug run or missed target cannot qualify. Multiple
accepted runs for the same canonical identity still produce only one share.

**The tool checks input assertions, not their authenticity.** A JSON field
claiming `server-verification-adapter` is not proof of server provenance. An
operator can invent that label, a player ID or a receipt hash. The tool does not
fetch the original evidence, verify signatures, detect alternate identities,
check wallet ownership, prove funding or resolve payout recipients. Its output
always says `payable: false` and `launchReady: false`, including for a complete
operator-supplied manifest. Do not connect this CLI directly to a payment worker
or expose it as a browser-submitted qualification API.

## Existing integration map

The following findings come from the repository source inspected for this task.

| Existing component | What the inspected source establishes | Campaign implication |
| --- | --- | --- |
| `scripts/arcade-organization.js` | Campaigns currently says no funded campaign is open, groups onboarding activities, links practice to the Events tab and states that practice scores do not count. | Keep this public preparation state until rules and actual integrations are ready. |
| `scripts/arcade-refresh/arcade-quest-campaigns.js` and `scripts/arcade-quest-campaigns-guided.js` | First Round uses the shared Arcade session and `/api/arcade-campaign` for four saved onboarding tasks. Its badge copy promises no token payment or NFT mint. Social post submissions can remain pending review. | Preserve First Round. Its task stamps and claims are not cash-prize qualification evidence. |
| `production/arcade-organization-static/runtime/scripts/arcade-completed-run-tracking.js` | The client loads `/api/arcade-completed-runs` and validates wallet, UTC day, supported game ID, unique receipt ID, completion timestamp, optional integer score and completion outcome. | Useful for daily discovery/share cards. That response shape does not establish an authenticated challenge start, game build, paid-advantage policy or independently verified score. |
| `scripts/arcade-events/core.mjs` and `docs/arcade-events-design-20261111.md` | The separate Canopy Crown workshop has USDC entry/ladder draft economics and best-score standings. Its design explicitly says the completed-run tracker is not tournament score verification and calls for trusted start tickets and game-specific validation. | Do not reuse its paid-entry economics or ranked standings for equal-share free campaigns. Do not treat the browser-importable evidence helper as a security boundary. |
| `netlify/event-functions/arcade-events.ts` | Current actions are configuration, eligibility and authorized draft load/save; responses keep payment, scoring and awards disabled. | No existing enabled ranked-run or payout endpoint can be assumed. Campaign execution needs its own later integration. |
| `production/README.md`, 2026-11-18 organization/cutoff section | The organization/cutoff release preserves existing Event terms, adds no funded campaign or monthly cash program, and separates paid attendance recovery from completed-game quest credit. | Leave the lobby's existing 25 SUI announcement, workshop terms, monthly attendance rules and running backend records unchanged in this work. |

The live MystenLabs skills README was checked for this request. This bounded
addition uses standard Node tooling only and changes no Sui SDK, wallet, Move
package, chain reader, database schema or pinned dependency. Existing working
integrations remain the applicable baseline; a future Sui integration must read
the then-current applicable SDK guidance and verify it against the pinned
project version.

## Remaining work before the first real campaign

1. **Choose one pilot.** Select a game/build/ruleset, one understandable skill
   target, exact pool, one asset/network, start/end in UTC, and an associated
   Event. Publish the actual cancellation and unused-funding policy. The draft
   intentionally supplies no real budget, dates, target or prize promise.
2. **Implement the selected game's verifier.** Bind an authenticated start
   ticket to the canonical player, campaign, immutable rules and approved game
   version; independently validate completion and the chosen target. Enforce
   the disclosed paid-advantage and debug policies. Raw browser scores,
   screenshots and a saved ordinary completion alone are insufficient.
3. **Implement canonical identity and review.** Define how one verified player
   is recognized across linked wallets and chains, how duplicate or disputed
   identities are resolved, and how evidence is retained and reviewed. Wallet
   possession alone cannot establish one human. Do not infer this service from
   the existing Sui login.
4. **Add authenticated records and funding review.** A later backend must bind
   authenticated verifier output to immutable published terms, record approvals
   and prevent duplicated receipts or payments. Select and verify actual payout
   recipients on the disclosed network. Neither escrow nor transaction
   execution is present in this foundation.
5. **Run a nonpaying pilot end to end.** Verify tampered and duplicated results,
   alternate identities, game updates, retries, cutoff behavior, zero qualifiers,
   indivisible units and exact budget conservation before publishing a cash
   opportunity. Freeze the reviewed rules and separately authorize a real
   campaign's funding and launch.

For multi-chain expansion, keep the canonical player identity independent of
the reward wallet, and disclose one payout network per campaign. Supporting
multiple chains later means implementing their actual identity, asset and
payout adapters; the generic metadata fields do not provide those capabilities.
