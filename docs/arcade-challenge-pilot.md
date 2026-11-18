# Arborist Trials challenge qualification pilot

## Status

The next implementation after the offline campaign allocator is a working,
**nonpaying server-authoritative Arborist Trials pilot service**. It includes a
pinned game verifier, an authenticated HTTP handler, a private transactional
attempt ledger, a reproducible rehearsal and an isolated function package.

This is reviewed source and local verification. The database migration has not
been applied to the hosted project, the new function has not been published,
and no playable public pilot, funded campaign or prize eligibility is enabled.
The migration creates empty tables; it inserts no pilot. The existing Arcade
release remains the live baseline in the newest `production/README.md` section.

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
| `netlify/challenge-functions/arcade-challenge-pilot.mjs` | Authenticate the existing Arcade session, accept bounded action requests, create opaque attempts, invoke the verifier and persist atomic moves. This directory is outside the currently deployed function inventory. |
| `scripts/arcade-campaigns/pilot-rpc.mjs` | Server-only, allowlisted RPC transport using the existing database environment convention. Sanitized failures never expose keys or database details. |
| `supabase/migrations/20261118223908_arcade_challenge_pilot.sql` | Empty private configuration, attempt and request tables; service-only RPCs; locks, immutable records, idempotency and server deadlines. |
| `scripts/arcade-campaigns/pilot-demo.mjs` | Rehearse the real handler, engine and SQL locally using synthetic wallet sessions and PGlite. |
| `scripts/arcade-campaigns/package-pilot.mjs` | Package this one function for review with the existing pinned build tooling. It contains no deployment operation. |

The storage RPC interface is documented in
`scripts/arcade-campaigns/pilot-store-contract.md`. None of these modules converts
an ordinary daily-game receipt or a browser `verified` label into cash-prize
evidence.

## What the service actually verifies

### Start and rules

The service reads the existing authenticated Arcade session, hashes its bearer
token and loads an operator-configured pilot. The client supplies the pilot ID
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
node --test tests/arcade-trials-adapter.test.mjs tests/arcade-challenge-pilot-database.test.mjs tests/arcade-challenge-pilot-service.test.mjs tests/arcade-campaign-foundation.test.mjs
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

PGlite runs through one connection. The integration tests cover overlapping API
requests and the actual transactional statements, but do not reproduce lock
scheduling between independent PostgreSQL workers. A separate-worker test on
a disposable PostgreSQL instance remains a hosting gate. Synthetic wallet
sessions also do not replace a real signed-in browser pilot.

The package manifest is generated at
`.netlify/arcade-challenge-pilot-functions/manifest.json`; it records exact source
hashes, ZIP hash, the single route, Node 24 runtime and `deployed: false`. The
existing production release scripts do not include this function or migration.

## Next implementation milestone

1. Build the playable pilot view under the Arcade, using only the server's
   public state and legal actions. Explain that it is a test without prizes.
   Persist the opaque attempt token for the original session, recover from
   interrupted requests and show a clear expiry/finished state.
2. Exercise the real signed-in browser flow and independent-worker database
   races in an isolated test environment. Verify draft/disabled behavior and
   strict origin, request-size and rate limits.
3. Prepare an additive preservation release using a freshly captured complete
   production inventory. Apply the reviewed migration separately, create the
   actual nonpaying pilot configuration and publish the tested UI/function.
4. Review pilot difficulty and abuse evidence before setting the first funded
   week's target, budget, asset/network, dates and canonical identity policy.
   Funded eligibility and payout remain separate implementations.

## Guidance checked for this change

The current MystenLabs skills README was read live on November 18, 2026, followed
by `frontend-apps/SKILL.md`, `frontend-apps/limitations.md` and
`sui-ts-sdk-backend/SKILL.md`. The relevant boundary is server-owned authentication
and secrets. No Sui SDK, wallet, Move, chain-reader or dependency upgrade was
needed. Netlify Functions guidance and the current Supabase changelog/function
security guidance informed the isolated handler, private service-only data and
transactional authorization. Supabase CLI v3.2.0 generated the migration file;
no command targeted a hosted database.
