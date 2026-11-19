# Arborist Trials challenge qualification pilot

## Status

The initial **Test challenge — no prizes** page and game service were published
at `/play/challenge/`. The subsequent canonical test with a fresh unfunded
wallet found a real integration defect: the existing Arcade session endpoint
returned `nftree-required`, so a new wallet could not enter the advertised free
pilot. Existing signed-in fixtures had not exercised that ownership gate.

A separate pilot-only sign-in now corrects that defect in production. The
reviewed auth correction was published as `6afe4d06ab2e466f455605db` at
`2026-11-19T01:17:08.058Z`. Canonical fresh-wallet authentication, start, three
legal moves, identical retry, reload recovery and session revocation passed at
`2026-11-19T01:19:09.001Z`. The newest `production/README.md` section and dated
auth release records bind these outcomes to the exact source and artifacts.

The Campaigns entry opens a screen with four standard cards, Growth meters,
current effects and round feedback. The correction keeps the published
message-only wallet bridge. New sign-in requests use only the pilot endpoint;
an already valid same-wallet Arcade session can still be read and reused for
gameplay. Starting a match is explicit; the pilot does not submit attendance,
check-in, payment or transaction actions.

The initial reviewed migration was applied to the hosted project as version
`20261119000653`. At that initial verification all eleven helper/RPC definitions
matched the exact locally applied source; browser roles could not access its
three private tables or four public RPCs. The enabled no-prize configuration
uses a fixed November 18 ruleset, opens November 19 at 00:00 UTC and closes
December 1 at 00:00 UTC. Each match lasts at most fifteen minutes, shortened by
session expiry or pilot close. Its canonical rule hash is
`ef07c5212301565b10faffc1e8fb97347fad522c6dc3e3f15bdf58d12b3c9b2d`.
See `production/arcade-challenge-db-readiness.json` and
`data/arcade-challenge-pilot-november-2026.json`.

The initial preservation release added five static paths and one function and
changed only the Campaigns organization module. The separate auth migration,
`supabase/migrations/20261119005653_arcade_challenge_pilot_auth.sql`, is now
applied to the hosted project as version `20261119010740`. All twenty hosted
pilot function definitions and grants match the reviewed local application
exactly. All six protected Arcade auth definitions/grants and the Arcade
session-row fingerprint remain unchanged; there were no prior pilot attempts,
and the original enabled pilot configuration is unchanged. The hosted proof is
`production/arcade-challenge-auth-db-readiness.json`. The correction preserves
622 other static files, 49 other complete backend records and five schedules.
Funded campaigns, prize eligibility and payout execution remain disabled.

## Isolated free pilot authentication

New players explicitly connect a Sui wallet and approve a server-issued,
single-use personal message. The message names the wallet, canonical origin,
nonce, expiry and pilot-only audience. It states that the sign-in grants no
check-ins, rewards, Event access, payments, transfers or other Arcade
permissions. It requires no NFTree, purchase, funded account or transaction.

All three actions use `/api/arcade-challenge-pilot`: `auth-challenge`,
`auth-session` and `auth-logout`. The challenge is bounded to five minutes and
the session to one hour. Issued tokens have the form `pilot_` plus 64 hex
characters and carry `sessionScope: "challenge-pilot"`. The browser checks the
challenge/session wallet, origin, scope and expiry before retaining a session;
it checks the challenge before asking the wallet to sign.

Pilot sessions are stored under the separate
`tree-arcade:challenge-pilot:session:v1` key, preferring tab storage. The shared
`tree-arcade:daily-growth:session:v1` key is read-only in this application: the
pilot never creates, replaces, erases or revokes an Arcade session. Existing
64-hex Arcade tokens remain accepted for pilot gameplay, while the new
pilot-only token cannot authorize the original Arcade session reader or its
attendance/reward routes, including when its prefix is stripped.

The auth migration adds separate private challenge/session tables and a scoped
binding layer for pilot attempts. It preserves existing Arcade session rows,
function definitions and grants, as well as attempts bound to old Arcade
sessions. Nonce consumption, session expiry and revocation are checked in the
database. Personal-message verification remains on the server using the
existing pinned SDK; no private signing key is placed in the production page.

## Player recovery

The browser stores the opaque attempt token and a hash of its original session
in tab storage. It does not copy either kind of bearer token into that record.
An uncertain move is persisted with its original UUID, version and card before
dispatch; refresh and reload resolve that same request before allowing another
move. Reconnecting the same original session resumes the match. A replacement
session requires an explicit new attempt, even for the same wallet.
If both a valid pilot session and a valid Arcade session exist, restoration
selects the exact original token matching the saved attempt. Wallet changes
suspend the current match; a change during asynchronous restoration or signing
cannot leave the previous wallet active in the interface. A newly issued pilot
session that cannot be retained is revoked without touching Arcade sessions.

Every displayed result is returned by the service. The countdown is anchored
to database time, and closed/expired/finished states disable card choices.
The UI supports unavailable storage, revoked-session renewal, server errors,
stale-tab conflicts and a committed response lost during transport. Wallet
connection and personal-message signing require deliberate player actions.

## Why Arborist Trials

The existing Trials source already reconstructs a match from its initial seed
and sequence of card choices. That allows the service to independently calculate
legal moves, opponent actions, Growth, victory and score. The browser sends one
card choice; it does not supply an authoritative score or final game state.

The engine is pinned from the project owner's `gardenbattles` repository at
commit `4a27b3ac73ec815c9e28c23a6b0d07f09ee73794`. The adapter identifies its
isolated build as `campaign-pilot-4a27b3ac-v1`, ruleset
`portable-v1-four-card`. Its original source, Git blob hashes, generated runtime
hashes and reproducible transformations are preserved under
`vendor/arcade-trials-engine/`. Exact equivalence to the currently deployed daily
game is not claimed. This deliberately versioned ruleset lets a future campaign
retain the same calculations even if the ordinary game changes.

The pilot objective is to **win a Trials match using the four dealt standard
cards**. The fifth card is never unlocked. The service has no NFTree ownership
gate, paid continue, purchase, debug or payment action. The daily game's own
access and ranked-result flows are separate.

## Components

| Component | Responsibility |
| --- | --- |
| `scripts/arcade-campaigns/trials-adapter.mjs` | Reconstruct the pinned game from server entropy and stored moves; return computed results and a sanitized public view. |
| `scripts/arcade-campaigns/pilot-rules.mjs` | Validate and content-hash an exact no-prize configuration, including game/build, objective, rules date, UTC window and attempt duration. |
| `netlify/challenge-functions/arcade-challenge-pilot.mjs` | Route scoped pilot auth and gameplay, accept existing Arcade sessions for gameplay, validate bounded requests, create opaque attempts, invoke the verifier and persist atomic moves. This isolated build directory is packaged separately from existing functions. |
| `scripts/arcade-campaigns/pilot-auth.mjs` | Issue pilot-only challenges, verify exact personal messages with the pinned SDK, consume a nonce once, create bounded sessions and revoke only pilot tokens. |
| `scripts/arcade-campaigns/pilot-rpc.mjs` | Server-only, allowlisted RPC transport using the existing database environment convention. Sanitized failures never expose keys or database details. |
| `supabase/migrations/20261118223908_arcade_challenge_pilot.sql` | Empty private configuration, attempt and request tables; service-only RPCs; locks, immutable records, idempotency and server deadlines. |
| `supabase/migrations/20261119005653_arcade_challenge_pilot_auth.sql` | Separate private pilot authentication, scoped session bindings and an upgrade preserving existing Arcade definitions, privileges, rows and session-bound attempts. |
| `scripts/arcade-challenge.mjs`, `scripts/arcade-challenge-client.mjs`, `scripts/arcade-challenge-view.mjs` | Explicit scoped sign-in, read-only Arcade compatibility, original-session recovery and presentation of server-provided game state. |
| `scripts/arcade-campaigns/pilot-demo.mjs` | Rehearse the real handler, engine and SQL locally using synthetic wallet sessions and PGlite. |
| `scripts/arcade-campaigns/package-pilot.mjs` | Package this one function for review with the existing pinned build tooling. It contains no deployment operation. |

The storage RPC interface is documented in
`scripts/arcade-campaigns/pilot-store-contract.md`. None of these modules converts
an ordinary daily-game receipt or a browser `verified` label into cash-prize
evidence.

## What the service actually verifies

### Start and rules

The service reads the authenticated pilot or existing Arcade session through
the scoped pilot session reader, hashes its complete bearer token and loads an
operator-configured pilot. Token format must match its stored scope. The client supplies the pilot ID
and the rule hash it reviewed. The server verifies that hash against the exact
configuration and its own allowlisted adapter. Unknown or changed builds fail
closed.

The service generates a 32-byte opaque attempt token and a separate 32-byte
seed. Only the token hash is stored. The database binds the attempt to its
original session, wallet and origin; the exact rules/build/adapter; the seed and
private-challenge hash; and database-owned start and expiry timestamps.

Expiry is the earliest of the pilot's exclusive closing instant, the configured
attempt duration and the session's expiry. Starts are inclusive at the opening
instant and excluded at the closing instant. A wallet may have at most 20 active
unexpired attempts for one pilot, even if it has multiple sessions.

The server timestamp returned by the database is authoritative for stored-record
chronology. A function-host clock two seconds ahead or behind does not discard a
successfully committed attempt token or change a move's database deadline.

### Every move

The request contains only the opaque attempt token, one integer card ID, the
expected action version and a UUID request ID. Extra fields such as `score`,
`completed`, `state`, `seed`, `verified` or a replacement campaign are rejected.

The service reconstructs the match from the stored seed and action history. It
enforces the dealt four-card hand, repeat restrictions, special daily rules and
the 100-move ceiling. It calculates the opponent's turn and the new public game
state. The browser cannot choose the opponent state or declare that a paid
advantage was absent.

The database then checks the session again under a session lock and commits the
move under an attempt row lock. It checks the current version, pilot status and
actual commit time before appending the action. This closes the gap between
calculating a move and persisting it after a deadline or session revocation.

The public response contains visible cards, legal moves, Growth, public status
effects, the last round, timestamps and the derived result. It excludes server
entropy, RNG state, hidden bot cards, wallet identifiers, session hashes and
stored token hashes. Diagnosis reveals only the forecast its original rule
intends to reveal.

### Retries and finishing

An identical request ID and fingerprint returns the original stored response.
The fingerprint binds the attempt, rules, version and move. Reusing that request
ID for another move conflicts. Competing requests for the same version can
append only one action. Request receipts are immutable.

Completed games accept no new moves. A nonterminal game reaching 100 moves also
ends the attempt with `outcome: "move-limit"`, `completed: false` and no met
objective. An identical previously committed retry may be read after the cutoff,
but the original session must still be valid; it creates no new result.

An enabled configuration cannot be edited. An operator may disable it once; it
cannot then be reopened or changed. The service's scoped lock privilege cannot
be used to activate or modify configuration.

## Qualification and reward boundary

The computed `ruleTargetMet` field means this pilot's game objective was met.
Every response and stored result still carries:

```json
{
  "mode": "nonpaying-pilot",
  "identityScope": "wallet-session-only",
  "payable": false,
  "prizeEligible": false,
  "awardsEnabled": false
}
```

The database rejects conflicting payout, reward or verified-person claims,
including nested claims. The funded campaign allocator does not accept the
pilot response format. The actual weekly-campaign draft remains incomplete and
does not acquire an asset, budget, reward network, launch date or approved
identity policy through this work.

Authenticating a wallet session does not establish one human. This verifier
proves that the stored moves produce the stated outcome under the pinned rules;
it does not prove that a person played without automation. The upstream engine
uses a 32-bit seeded PRNG. The server's larger random seed is reduced to that
engine state for compatibility; it is not a cryptographic hidden-opponent or
anti-bot guarantee. Hands and chance effects vary, so a funded challenge needs
a deliberate difficulty and repeated-attempt policy, plus identity/review rules.

## Verification and reproduction

From the repository root, restore the already pinned test/build tools if needed:

```sh
npm ci --prefix vendor/arcade-events --ignore-scripts --no-audit --no-fund
npm ci --prefix vendor/arcade-monthly --ignore-scripts --no-audit --no-fund
node --test tests/arcade-trials-adapter.test.mjs tests/arcade-challenge-pilot-database.test.mjs tests/arcade-challenge-pilot-service.test.mjs tests/arcade-campaign-foundation.test.mjs
node --test tests/arcade-challenge-pilot-auth.test.mjs tests/arcade-challenge-pilot-auth-database.test.mjs tests/arcade-challenge-client.test.mjs tests/arcade-challenge-controller.test.mjs
node scripts/arcade-campaigns/pilot-demo.mjs
node scripts/arcade-campaigns/package-pilot.mjs
```

The combined suite contains 20 engine tests, 10 database tests, 17 service
integration tests and the existing 28 campaign-allocation tests. These include
real service-role SQL execution, disabled/draft states, browser-role denial,
immutable rules, wrong-session attempts, illegal actions, replay conflicts,
revocation between calculation and commit, a move delayed past the actual SQL
cutoff, source/seed substitution and host-clock skew. The test fixture initially
exposed a row-lock privilege mismatch; the scoped privilege and mutation guard
are now exercised under the actual `service_role`.

The local rehearsal uses synthetic sessions and the public fixture seed ending
in `0005`, dated November 18, 2026. The legitimate moves `[19, 27, 19]` calculate:

| Round | Player Growth | Bot Growth |
| --- | ---: | ---: |
| 1 | 21 | 8 |
| 2 | 29 | 19 |
| 3 | 50 | 19 |

The resulting score is **16,375**. The same rehearsal rejects a supplied fake
score, preserves an identical retry, rejects a changed retry and verifies that
only three moves were recorded. Public fixture entropy is for tests only.

PGlite runs through one connection. A separate disposable PostgreSQL 17.11
test now verifies actual lock contention across 100 independent workers:
competing moves, identical and divergent retries, disable/revocation before
commit, cutoff while blocked and the active-attempt cap all passed. Evidence is
in `docs/arcade-challenge-postgres-validation-20261119.json`. The auth upgrade
also has a separate independent-worker harness in
`scripts/arcade-campaigns/pilot-auth-postgres-check.mjs`; actual results belong
to its dated evidence and the final source CI run.

The corrected client suite contains thirteen tests, including pilot-token
separation, original-token binding and an interrupted committed move recovered
with the exact same request. Eleven controller tests exercise explicit free
sign-in, byte-for-byte preservation of both Arcade storage locations, reuse of
existing Arcade sessions, original-session selection, revocation, wallet-switch
races, origin/scope/expiry checks and cleanup of an unretained pilot session.
These local suites use the actual HTTP handler and SQL with synthetic signatures
only at the deliberate test verifier seam.

The browser suite contains thirteen cases at desktop and narrow phone widths.
It invokes the actual new auth handler/SQL; only the synthetic wallet signature
verifier and local/canonical-origin adapter are confined to the loopback
harness. Its legacy Arcade auth route deliberately returns an ownership error,
so free sign-in cannot accidentally succeed through that endpoint. The suite
checks isolated storage, explicit start and same-session lost-response recovery
for new pilot tokens as well as existing Arcade-token gameplay. These thirteen
updated cases passed in workflow `44434933521`, with 129 total source tests and
both independent PostgreSQL race suites passing. The initial twelve-case
browser result is separate historical evidence. Exact corrected counts and
reports are preserved in
`docs/arcade-challenge-auth-ci-validation-20261119.json`.

Canonical fresh-wallet verification uses real personal-message signatures and
is reported separately from synthetic browser testing and installed wallet-
extension permission-prompt UX. The initial canonical failure is retained as
evidence; it must not be described as a successful authentication/play test.
The corrected canonical run `44435875741` passed with fourteen API requests,
zero Growth requests, one signature/session/start and three distinct legal
moves. It recovered the exact committed retry, resumed after reload, preserved
shared Arcade storage and revoked its own pilot session. The match remained
active at version three; this bounded test does not claim a completed win or
an installed Slush extension review.

The package manifest is generated at
`.netlify/arcade-challenge-pilot-functions/manifest.json`; it records exact source
hashes, ZIP hash, the single route, Node 24 runtime and `deployed: false`. The
isolated pilot preservation workflow publishes this function. The hosted
migration is applied and verified separately; it is not part of the Netlify
deployment.

## Next implementation milestone

1. Observe the bounded no-prize pilot and collect practical usability findings.
2. Review installed-wallet connection and permission-prompt behavior separately
   from the completed operator-provider protocol check.
3. Review pilot difficulty and abuse evidence before setting the first funded
   week's target, budget, asset/network, dates and canonical identity policy.
   Funded eligibility and payout remain separate implementations.

## Guidance checked for this change

The current MystenLabs skills README was checked live during November 18–19,
2026. Applicable guidance was read from `frontend-apps/SKILL.md`,
`frontend-apps/limitations.md`, `frontend-apps/non-react.md`,
`frontend-apps/transactions.md`, `sui-ts-sdk-backend/SKILL.md` and
`sui-ts-sdk-backend/bootstrap.md`. The working wallet bridge and pinned SDK
remain in use. Netlify Functions guidance and the current Supabase
changelog/function security guidance informed the isolated handler, private
service-only data and transactional authorization. Supabase CLI v3.2.0 generated
the initial migration file locally. The reviewed initial migration was subsequently
applied to the hosted project; its actual version, exact-definition comparison
and permission verification are recorded in
`production/arcade-challenge-db-readiness.json`.
