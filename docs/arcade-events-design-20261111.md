# Canopy Crown ’89 — current event design

The canonical workshop is `/play/events/preview/`. The approved profile try-on
is `/play/events/profile-cosmetics/`. This version adopts Peter’s approved
USDC entry and prize ladder. Paid registration, ranked score submission and
earned cosmetic unlocks remain closed until the launch integrations below are
verified. Neither an eligibility check nor a saved draft issues an entry,
receipt or entitlement.

## Approved entry and prize policy

- Entry costs **5 native Circle USDC on Sui**, once per eligible wallet per
  event. An entry includes unlimited fresh eligible attempts in the event window.
- **80% of fees** goes to the prize pool; **20%** is the organizer allocation
  before guarantee contributions and operating expenses.
- First place receives at least **25 USDC** when there is at least one confirmed
  paid entrant. With zero entrants, there is no payout or guarantee contribution.
- The number of confirmed paid, eligible NFTree holders at **registration close**
  determines the paid places and percentage split below. Publish the complete
  ladder before registration opens; pay after the event ends and results are
  verified.

| Paid entrants at registration close | Paid places | First | Second | Third |
| --- | --- | --- | --- | --- |
| 1–24 | One | 100% | — | — |
| 25–49 | Two | 75% | 25% | — |
| 50 or more | Three | 60% | 25% | 15% |

Percentages apply to the prize pool. The organizer covers any shortfall in the
25 USDC first-prize guarantee. With the approved 5 USDC entry, this occurs at
one to six entrants: the contribution is `25 − 4 × entrants` USDC. The estimate
shows the fee-funded pool, guarantee contribution, actual total pool, each paid
place, organizer allocation and organizer net before costs separately. Organizer
net is `entry revenue − actual total prizes`; it may be negative at low turnout.

At 25 entrants the 100 USDC pool pays 75 / 25 USDC. At 50 entrants the 200 USDC
pool pays 120 / 50 / 30 USDC. At 100 entrants the 400 USDC pool pays
240 / 100 / 60 USDC. First place’s amount can fall when another paid place is
introduced: 24 entrants pay first place 96 USDC, while 25 pay first place
75 USDC. Likewise, first place changes from 147 USDC at 49 entrants to
120 USDC at 50. During registration, emphasize the total pool and minimum
first prize; the final registration count fixes the allocation.

The currency is the native six-decimal asset:

```text
0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC
```

The saved policy identifies currency, Sui mainnet, coin type, decimals, integer
amounts and the full ladder. Legacy nine-decimal SUI MIST values are never
interpreted as USDC units. No gasless checkout behavior is promised by this
design; checkout compatibility must be tested during payment integration.

## Event rules and approved cosmetics

Use explicit start/end instants, with Central Time or UTC input. Ambiguous or
nonexistent daylight-saving times reject. The start is inclusive and the end
exclusive; each ranked run must both start and finish within the window. Dates
alone do not turn a saved draft into a scheduled event.

The best verified score for each wallet counts. Ties resolve by the earliest
verified achievement time. The same wallet must be used for registration,
event play and rewards. NFTree ownership is required before payment and before
each ranked run; direct ownership and wallet-controlled Sui Kiosks qualify.
Other Arcade access routes do not qualify for this event.

Tree Force ’89 uses fresh three-life runs without paid continues. Other game
choices remain planning options and need their own rules and server adapters.
Payouts are manual after final standings and all prize recipients are reviewed.

The approved Canopy Crown ’89 **Contender** design has bronze branches and green
canopy without a championship belt. It is the permanent included entry cosmetic.
The approved **Champion** design has gold laurels and a championship belt for
the verified first-place winner. Both carry Canopy Crown ’89 and TREE TOKEN ·
SUI branding. No second- or third-place artwork is implied by the cash prizes.
The try-on supports local photo placement, profile-size examples and PNG exports;
those previews do not grant wallet ownership or gameplay advantages. Artwork is
approved; permanent wallet-linked unlock integration is still pending.

## Implemented workshop and draft foundation

The workshop supports title/game/time-zone/date editing, an exact integer-USDC
prize estimator, local drafts, JSON draft downloads, approved cosmetic examples,
an empty leaderboard and launch readiness. Local storage and authorized server
storage are labelled separately. Browser-imported arithmetic and evidence filters
are reusable rules, not an anti-cheat service or an authorization boundary.

The isolated handler, `netlify/event-functions/arcade-events.ts`, serves
`/api/arcade-events`. It reuses existing Arcade bearer-session authentication
and rejects expired, revoked and wrong-origin sessions. Eligibility calls
`getCanonicalNftreeOwnership` directly on the server instead of the cached public
wallet endpoint. Wrong collection, network or wallet, inconsistent counts,
provider errors and absent NFTrees fail closed. Future payment and ranked-run
actions must each repeat the holder guard; neither action is enabled now.

Three private tables hold the organizer allowlist, versioned event drafts and
append-only history. Only service-role RPC calls can read or write them. The RPCs
validate the Arcade session and organizer membership inside the transaction.
Expected-version checks and a per-event transaction lock prevent stale edits;
locked drafts reject changes. The organizer allowlist remains empty until Peter
identifies the management wallet. It must not be inferred from unrelated treasury
or Arboretum addresses.

The original foundation used fixed SUI terms and version 1 RPCs. The additive
USDC migration preserves those legacy columns, rows and history and introduces
explicit version 2 policy storage and RPCs. New server drafts enforce the approved
USDC terms, NFTree-only access and disabled payment. A legacy server draft cannot
silently change currency or share an identity with a new USDC draft. Client saves
must acknowledge policy version 2, so cached SUI clients reject and request a
reload. The serialized draft format version and policy version are separate from
the database record’s optimistic-lock version.

Safe unpaid local planning drafts can adopt the approved policy while retaining
their event identity, title, schedule and cosmetic identifiers. Drafts with paid
entries, active payment flags, unsupported terms or a non-draft state reject.
A changed wallet discards a pending server reply. No new signature/payment flow,
wallet SDK change or gameplay timer is introduced.

Focused verification uses the pinned dependencies in `vendor/arcade-events`:

```sh
node --test tests/arcade-event-core.test.mjs tests/arcade-event-access.test.ts tests/arcade-event-database.test.mjs tests/arcade-event-controls.test.mjs
```

## Remaining launch integration

1. Set the event and registration-close schedule, authorize the organizer wallet,
   define the event-specific fee recipient, and verify funding for the minimum
   first prize. Do not infer a recipient from unrelated game wallets.
2. Add wallet/event-unique entries, immutable published policy snapshots,
   idempotent checkout receipts, payment memo binding, cancellation/refund rules
   and atomic permanent cosmetic grants. Verify the receipt’s sender, recipient,
   Sui network, native USDC coin type, exact six-decimal amount, success and
   on-chain timestamp. Recover submitted receipts after retries without charging
   twice. Keep the ledger transactional and private, never in localStorage or
   Netlify Blobs.
3. Add trusted run-start tickets and game-specific server validation. Never accept
   client assertions such as `trust: server-reviewed`; only the authenticated
   server adapter may attach that status after reviewing evidence. The ordinary
   completed-run tracker does not establish verified tournament scores. Reject
   invalid server clocks and fail closed for unintegrated games.
4. Connect permanent Profile Studio discovery and restoration to the registered
   wallet. Contender ownership survives event closing; Champion is granted after
   first-place review and finalization.
5. Exercise payment retries, duplicate receipts, wallet changes, expiry, boundary
   times, tier finalization, tampered scores, continued runs, unlock recovery,
   refunds and manual payout recording against a non-paying test event before
   opening paid entry.

Authoritative service time determines the event phase. A scheduled notification
worker, if later added, cannot expand the permitted score window.

## Scoped publication

The USDC release uses `scripts/arcade-events/release-usdc-terms.mjs` and the
manual `Publish Canopy Crown USDC rules` workflow. The prerequisite migration is
`supabase/migrations/20261111222359_arcade_event_usdc_terms.sql`.
It was applied and independently verified before this release: all three private
tables retain RLS, browser-role access is denied, and all five event RPCs remain
service-only with invoker security and an empty search path. Production had zero
organizers, drafts and history records; no paid or legacy draft was converted.
The public configuration endpoint does not query private draft storage and
cannot establish migration status.

The publisher captures a fresh current locked inventory, requires its exact ID
and preserves all static paths except these five workshop files:

- `/play/events/preview/index.html`
- `/scripts/arcade-events/core.mjs`
- `/scripts/arcade-events/preview.mjs`
- `/scripts/arcade-events/server-controls.mjs`
- `/styles/arcade-events-preview-v1.css`

Only the isolated `arcade-events` package is rebuilt and replaced. Every other
function’s complete record stays exact, apart from equivalent Netlify
memory/region aliases. The replaced handler retains its route, rate limit,
runtime, invocation mode, memory, region, provider account and other execution
configuration. Its package digest, package/provisioning IDs, byte size and
creation time may change; build metadata must match the new package manifest.
All five schedules, deploy runtime settings, site build settings and protected
environment fingerprints are preserved. The historical root build must not
replace the current live site.

Every queued build must be terminal before candidate creation and publication.
The source commit and package are recorded and checked between phases. The
candidate must report exact version 2 terms with payment, scoring and awards
disabled before publication. Full inventory and canonical configuration are
checked again after locking the release. Existing game/wallet code, the Arcade
event card and the approved profile artwork are outside this change set.
Record the actual deploy, source commit, migration verification and canonical
browser checks after publication.
