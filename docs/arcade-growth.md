# TREE Arcade — Daily Growth

Published at **2026-10-31 21:30:27 UTC** on
[TREE Arcade](https://tree-token.xyz/play/#arcade-daily-growth).
Deployment: `6ae65d956e30582ff6f5baa2`. Published source:
`ea323cebb0f33de1f5d123be867c7574781a43f5`. The current deployment is locked.

## Release scope

Daily Growth adds wallet-based attendance, one verified daily quest, a monthly
Arcade Passport, and permanent cosmetic badges to `/play/`. The panel sits after
the NFTree access and inline mint area, before the game posters. It has three
views: Today’s quest, This month, and Earned badges.

The release changes only these existing public files:

- `/play/index.html`
- `/styles/tree-arcade-suite.css`

It adds two public files:

- `/scripts/arcade-daily-growth.js`
- `/assets/arcade/arcade-growth-wallet.js`

The static inventory grows from 235 to 237 paths; 233 baseline paths remain
byte-identical. The new `arcade-growth` function exposes GET/POST
`/api/arcade-growth`. All 39 existing complete function/provider records and all
five schedules are preserved by the bounded release script. The existing
TREE FORCE isolated database binding and paid-continue setting remain exact.
The complete published identities are recorded in `arcade-growth-published.json`.

## Player rules

- Connect a Sui wallet, then explicitly sign a Daily Growth personal message.
  Connection alone does not sign in, submit a transaction, or earn credit.
- An eligible NFTree held directly or in an owned Kiosk is required to save
  progress. Ownership is checked at sign-in and again before each write.
- Manual check-in grants attendance only. A verified game result grants that
  day’s check-in and daily quest together.
- A win is not required. Only completed, officially saved results count.
- Daily quests and check-ins are limited to one per wallet per UTC day.
- Today’s Pick rotates between Garden Bot and Arborist Trials. PvP can also
  complete the daily quest, but is an optional alternative because it has paid
  entry and requires another player.
- The monthly Passport records distinct supported games. Its required set is
  frozen when monthly progress tracking is initialized. Additional games join a future
  month’s requirements.
- Seedling, Sapling, Deep Roots, and Full Canopy badges are earned at 3, 7, 14,
  and 21 different check-in days. Completing all required games earns the
  monthly Arcade Passport badge. These are saved cosmetic records, not tokens,
  NFTs, or financial rewards.
- At the start of the next UTC month, attendance, daily quest totals, and
  Passport stamps start a new month. Previously earned badges remain saved.
- Missing a day does not remove earlier progress. There is no mandatory streak.

## Supported completion evidence

| Game | Credit in this release | Evidence |
| --- | --- | --- |
| Garden Bot | Yes | Official completed battle for the wallet, recognized bot mode, consistent players/outcome, valid transaction digest and server timestamp |
| PvP Battle | Yes | Official completed match for either human participant, consistent mode/outcome, valid transaction digest and server timestamp |
| Arborist Trials | Yes | Current official challenge result saved for the same wallet; local unsaved practice does not count |
| TREE FORCE ’89 | Tracking soon | The current live engine/server has no trusted completed-run endpoint |
| Arboretum | Excluded | Preview; no playable test release currently available |
| Canopy Clash | Excluded | Preview; no supported completion integration |

The Railway origin is fixed in the server adapter. Requests are read-only,
bounded by time and response size, and do not follow redirects. The browser
cannot submit dates, game outcomes, attendance, stamps, or achievement flags.
Source event IDs include the wallet so both PvP participants can receive their
own participation credit without duplicating a wallet’s result.

A capped or partial history can still prove a positive completed result. The
adapter saves those verified positives while reporting incomplete coverage;
it never treats truncation as evidence that the player did not play. Source
errors preserve previously saved progress.

### Current-day verification limit

This release checks only the server’s current UTC day. Players must finish and
save the game, return to the lobby, and refresh before 00:00 UTC for that day’s
quest and Passport credit. Opening a game grants nothing. Historical results
are not backfilled. The UI states the deadline in the quest and return notice.
A lookup that crosses midnight returns a refresh instruction rather than
crediting yesterday’s result to today.

TREE FORCE remains live and playable. It is neither a preview nor a required
Passport stamp in this release. Session creation, restart, paid continuation,
and opening the game do not establish completion. Adding it requires a
separately reviewed game engine and server completion protocol.

## Authentication and storage

- Message-only wallet client, built with the exact existing wallet-standard
  dependency pins; existing mint, payment, wallet scripts, and root dependency
  lock are unchanged.
- Five-minute server-issued challenge binds wallet, exact production origin,
  mainnet, UTC date, purpose, nonce, issue time, and expiry.
- The pinned Sui SDK 2.26.1 verifies personal-message intent and wallet address.
  zkLogin verification receives the fixed mainnet gRPC client with a bounded
  verification call. Passkeys and other SDK-supported personal-message schemes
  use that SDK’s verification path.
- Atomic challenge consumption prevents replayed or concurrent signatures from
  creating multiple sessions. One-hour bearer tokens are stored as SHA-256
  hashes in the database. The raw token is only retained in the browser’s
  session storage, bound to the exact wallet.
- Wallet changes cancel pending requests and immediately remove the previous
  wallet’s displayed progress. Late responses cannot restore it.
- Seven new private RLS tables and fourteen SECURITY INVOKER functions use an
  empty search path. PUBLIC, anon, and authenticated have no execution or table
  access; the server’s service role is the only application caller.
- Wallet locks, unique date/source keys, timestamp checks, and conflicting-event
  rejection make writes idempotent. Sessions are rechecked after lock waits.
- Rate limits: 60 HTTP requests per domain/IP per minute; six challenge requests
  per wallet/request-fingerprint pair per ten minutes, and forty per fingerprint.
  A different requester cannot exhaust a wallet-wide challenge quota. Raw IP
  addresses are not stored; fingerprints use a server-only keyed hash.
- No new token emission, payment, scheduled job, or on-chain write is introduced.

## Database and environment

Applied and validated first on the existing `knowledge-trial-v3-safe`
development branch, then applied to the existing production Supabase project:

1. `20261031211739_arcade_growth.sql`
   — SHA-256 `d3fe2502612ea9328a3c93321165bc83e0924637ba856c64b37fbaf13847417a`
2. `20261031211743_arcade_growth_challenge_rate_scope.sql`
   — SHA-256 `900ec357935e73754a95e533ecda3aceac1a1ca01a0974ca0750fc373dac5060`

The second migration corrects the challenge quota without modifying the already
applied first migration. No existing game, raffle, payment, or reward object is
altered. No new Supabase project, development branch, or Netlify database is
created. Netlify deploy metadata correctly contains no Netlify DB migrations;
these two additive Supabase migrations are recorded separately.

No new site-wide environment variable is retained. The reviewed function has an
explicit enabled release default. If `ARCADE_GROWTH_ENABLED` is supplied, only
the exact string `true` enables it; all other supplied values disable it.
Missing storage or sign-in rate protection still fails closed.

The service uses the existing complete production TREE_RAFFLE Supabase URL/key
pair and the existing >=32-character `TREE_KNOWLEDGE_TRIAL_RATE_LIMIT_SECRET`
with a Daily Growth-specific HMAC domain. A dedicated
`ARCADE_GROWTH_RATE_LIMIT_SECRET` is also supported. Optional dedicated
`ARCADE_GROWTH_SUPABASE_URL` and `ARCADE_GROWTH_SUPABASE_SECRET_KEY` must be
configured together. Incomplete database URL/key configuration fails closed.
Existing environment values are unchanged.

The first review candidate, `6ae65c15c82ebb434083c695`, was stopped before any
upload when Netlify requested all 39 existing function packages along with the
new package. The two new site-wide settings added during preparation were
removed, restoring the baseline configuration; the function instead uses the
explicit release default and existing server secret. The stopped candidate was
never published. The same strict preservation check remains required on retry.
Netlify documents that each deploy captures its environment at creation and
that deploy-specific environment data cannot subsequently be changed:
[function environments](https://docs.netlify.com/build/functions/environment-variables/)
and [deployment API](https://open-api.netlify.com/).

## Validation

- 10 wallet behavior checks: explicit connection and signing, generic Sui
  metadata, exact-account restoration, cancellation, unregister, and account
  changes during signing.
- 15 UI behavior tests, including integration with the actual wallet adapter:
  no fabricated progress, independent check-in, no launch credit, account
  switching, expired/revoked sessions, outage recovery, tabs, month dates,
  permanent badges, before-reset copy, and tracking-soon visibility.
- 18 game adapter tests: real record shapes, both PvP seats, win/loss, proof and
  date validation, source errors, bounded requests, partial positive results,
  duplicate/conflicting IDs, official Trials, and exclusion of practice.
- 22 backend/core/store tests: origin/wallet binding, replay/concurrency,
  ownership checks, bearer sessions, client-claim rejection, UTC rollover,
  partial sources, consistent snapshots, and private error redaction.
- Three packaged-runtime signature scenarios use the actual extracted ZIP and
  real pinned SDK: correct signature returns 200; wrong account or wrong
  message returns 401 with no session write. The test makes no network calls
  or transactions and confirms lazy SDK modules resolve inside the ZIP.
- The transactional database test runs as `service_role` and checks exact
  permissions/RLS, atomic challenge consumption, independent attendance,
  idempotent events/quests, conflicting wallets/results, frozen rules, monthly
  reset, permanent badges, both challenge quotas, and revoked-session writes.
  Every synthetic record is rolled back. Production read checks confirm seven
  tables, fourteen functions, zero missing-RLS tables, zero browser-callable
  RPCs, and the corrected quota scope.
- Strict TypeScript checking passed against the exact pinned dependency
  declarations. Syntax and whitespace checks passed.
- Desktop and 320px browser review exercised the real HTML/CSS/controller with
  clearly marked synthetic fixtures. No horizontal overflow was observed in
  quest, month, or badge views. Fixtures remain outside the release inventory.
- Nine hosted API checks passed on the candidate and again on the canonical
  domain: rules load successfully; unauthenticated writes, client-supplied game
  claims, foreign origins, invalid wallets, unsupported methods, and unknown
  sessions are rejected; the server issues a real challenge; a correctly signed
  ephemeral wallet without an NFTree is denied access. No progress is credited
  by these checks. Reports are `arcade-growth-candidate-api.json` and
  `arcade-growth-live-api.json`.
- The published page loads the eligible games, message-only wallet controls,
  signed-out empty states, and TREE FORCE tracking notice. The screenshot
  `arcade-growth-live.jpg` is from the canonical live page, not a fixture.

### Validation boundaries

No real player wallet signature, game purchase, NFT mint, paid continuation,
or other Sui transaction was submitted during this release. Live wallet-provider
and zkLogin round trips are not represented as end-to-end tested by the local
Ed25519 signature fixtures.

The required historical backend source-parity command was attempted in an
isolated checkout with the current pinned lock. It fails on the archived
`arcade-wallet-link` dependency payload inventory. Consequently this release
does not rebuild or replace any existing handler. The full 39 live provider
records and five schedules are preserved exactly; only the new function is
packaged. This historical source/archive mismatch remains a separate recovery
task, not a passed check.

## Reproduction and release evidence

Run focused tests with Node 24; UI tests use isolated jsdom 26.1.0.

```sh
node tests/arcade-growth-wallet.test.mjs
ARCADE_DOM_TEST_DEPS=/path/to/isolated-jsdom node tests/arcade-daily-growth-ui.test.mjs
node tests/arcade-growth-games.test.ts
node tests/arcade-growth-backend.test.ts
node tests/arcade-growth-packaged.mjs /path/to/extracted-zip /path/to/isolated-dependencies
```

`scripts/build-arcade-growth-wallet.mjs` builds the separate wallet module from
the existing reviewed pins. `scripts/package-arcade-growth.mjs` packages only
the new function with zip-it-and-ship-it 16.3.0 and physical traced dependencies;
it rejects missing verifier modules, unsafe paths, or archived dependency
symlinks. Its manifest pins the source inputs and ZIP digest.

`scripts/release-arcade-growth.mjs` captures the locked baseline, creates a new
unpublished candidate, verifies the complete static/function/schedule records,
and only then permits forward publication of that exact never-published
candidate. It requires the old production lock before publication and verifies
the new current-publication lock afterward. Netlify released the old deploy’s
lock when the new one became the current published pin. The final read-only
audit records that observed state while verifying both deployment inventories.
The old deploy was not re-locked: the documented `lockDeploy` operation would
publish a noncurrent target first, undoing the forward release. See the
[official lock operation](https://open-api.netlify.com/#tag/deploy/operation/lockDeploy).
The exact new
ZIP is archived under `production/arcade-growth/`; do not replace the other
function packages with ordinary build output.
