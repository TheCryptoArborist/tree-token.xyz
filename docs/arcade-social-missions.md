# Arcade Missions — first social release

Implementation is on `feature/arcade-social-missions-20261104`, based on the recorded Legends of TREE release branch `feature/arcade-growth-collection-20261102` at `d08b66b`. Main does not contain the current Arcade; merging a replacement built from main would regress the live Arcade.

## Player behavior

Daily, Community and Events share the existing task panel; This month and Badge collection remain accessible. Daily check-ins, attendance awards and game Passport requirements retain their existing storage and rules. Community stamps appear alongside Passport participation as a separate monthly count; this release adds no token payout or new Passport badge threshold.

- Share Your Score: one original public X post with gameplay screenshot, game, score, Arcade link and signed-in wallet address. Pending until staff review.
- Challenge a Friend: challenge post with score, game, Arcade link and signed-in wallet; friend replies with their own completed run. Pending until staff verifies both runs and the reply.
- Community Vote: choose TREE FORCE, Garden Bot or Arborist Trials for the next spotlight. First vote is final for that UTC week and immediately saves one stamp.
- Weekly reset is Monday 00:00 UTC. One entry per wallet/mission/week. A submitted post ID cannot be reused across weeks, wallets or missions. Rejected entries may be retried next week using a new post.
- Events shows an honest empty state until event dates/rules exist.

The composer only opens a draft. No messages are sent automatically. Links never grant credit, and X account ownership is checked manually against the wallet address in the post. Account changes/logout clear proof fields and displayed community progress; late responses from the previous account are ignored.

## Storage and release

`arcade-social` is a new independent Netlify function, reusing the established Daily Growth session via a service-role-only RPC. The 41 existing function source files, wallet adapters, dependency lock, scheduled jobs and production manifest are unmodified. No new chain transaction is involved. SQL uses SECURITY INVOKER, private tables with RLS, explicit service-role grants and the existing session verifier. No browser role may call the RPC or read/write entries directly. The approved release enables this new handler without adding site environment settings. An explicit `ARCADE_SOCIAL_ENABLED` override other than true disables it.

Release procedure (completed; real wallet and canonical phone checks remain):

1. Reconcile against the actual current production inventory (the archived root build is not a production package).
2. Apply `supabase/migrations/20261104133625_arcade_social_missions.sql` to the confirmed Daily Growth database. It was tested in an isolated PostgreSQL engine and installed alongside campaign progress on 2026-11-05 UTC; see docs/arcade-quest-campaigns.md.
3. Package the new function with the existing Daily Growth Supabase binding; no new environment flag is required; preserve every existing function package, runtime/provider binding and all five schedules. No ordinary dashboard build.
4. Include `/scripts/arcade-social-missions.js` and the three changed frontend files in the preserved release. Only activate after the database and function pass hosted authentication/authorization checks.
5. Check canonical desktop and phone rendering and a real wallet's message-only sign-in, then confirm a pending submission and saved vote. Preview hosts cannot reuse canonical-origin sessions.

## Staff review (trusted database access only)

Review pending entries using a private query; never publish wallet/proof lists in the client:

```sql
select wallet, week_key, mission, proof, submitted_at
from private.arcade_social_entries
where status = 'pending' order by submitted_at;
```

Verify the public post belongs to the submitting wallet (wallet address in the post), contains the required game/result/Arcade link, and is original. For a friend challenge, verify the friend's completed run in the reply and reject self-challenges. A share and friend mission require distinct post IDs. Approve only after inspection, using bound parameters:

```sql
update private.arcade_social_entries
set status = $4, reviewed_at = clock_timestamp(), review_note = $5
where wallet = $1 and week_key = $2 and mission = $3 and status = 'pending'
returning wallet, week_key, mission, status;
-- $4 is 'completed' or 'rejected'; $5 records the reviewer and reason.
```

Completed rows supply the monthly community stamp count automatically on refresh. They do not change check-ins or game stamps. Weekly vote tally:

```sql
select week_key, proof as game, count(*) as votes
from private.arcade_social_entries where mission = 'community-vote'
group by week_key, proof order by week_key desc, votes desc;
```

## Verification

80 existing/new Node checks passed: daily controller, wallet adapter, original growth backend, new mission handler and social controller. The additive SQL passed an isolated PGlite PostgreSQL run, including role permissions, expired/revoked/origin-bound sessions, weekly idempotency, reviewed versus pending stamps, and no attendance/badge writes. `git diff --check` passed.

Native visual checks are provided in `tests/arcade-social-browser.mjs`, but could not run in this execution environment: Chromium fails at process-singleton socket creation (`Operation not permitted`); downloading the alternate headless browser also failed. No desktop/mobile visual or hosted wallet verification is claimed.

Commands (temporary dependencies are isolated from project package/lock files):

```sh
npm install --prefix /tmp/arcade-mission-tools jsdom @electric-sql/pglite
ARCADE_DOM_TEST_DEPS=/tmp/arcade-mission-tools node --test tests/arcade-social.test.ts tests/arcade-social-ui.test.mjs tests/arcade-daily-growth-ui.test.mjs tests/arcade-growth-backend.test.ts tests/arcade-growth-wallet.test.mjs
ARCADE_DOM_TEST_DEPS=/tmp/arcade-mission-tools node tests/arcade-social-database.mjs
node tests/arcade-social-browser.mjs
```

Guidance checked live: MystenLabs/skills README and `frontend-apps/SKILL.md`; no Sui SDK API, wallet flow or pinned dependency changed. Supabase current changelog and database-functions documentation were consulted for the additive invoker RPC and permissions. Supabase CLI 3.0.0 generated the migration filename locally.
