# Arborist Trials pilot preservation release

This procedure adds the playable, free **Test challenge — no prizes** pilot.
It does not activate a funded campaign or a monthly cash award. It preserves
the full freshly captured production inventory and every existing backend
package/provider/configuration record, schedule and protected setting.

## Exact release scope

| Public path | Reviewed source |
| --- | --- |
| `/play/challenge/index.html` | `production/arcade-challenge-static/index.html` |
| `/styles/arcade-challenge.css` | `styles/arcade-challenge.css` |
| `/scripts/arcade-challenge-view.mjs` | `scripts/arcade-challenge-view.mjs` |
| `/scripts/arcade-challenge-client.mjs` | `scripts/arcade-challenge-client.mjs` |
| `/scripts/arcade-challenge.mjs` | `scripts/arcade-challenge.mjs` |
| `/scripts/arcade-organization.js` | `scripts/arcade-organization.js` |

Only the existing organization module changes, to add the Campaigns link. The
five pilot paths must be new. The release adds exactly one isolated function,
`arcade-challenge-pilot`, at `/api/arcade-challenge-pilot` using Node 24 and the
reviewed four-card engine. Existing functions may not be uploaded or rebuilt.
The new function has no schedule, event subscription, custom region or compute
override. It retains the domain/IP 60-per-minute limit from its package.

`scripts/release-arcade-challenge.mjs` provides capture, plan, candidate,
verify, publish and audit phases. It reuses the existing preservation primitives,
checks complete static/backend inventories, and binds publication to a new
candidate, exact source tree, immutable Actions artifact and explicit browser
review. Ordinary Git builds and the historical root snapshot are not a release
path for this feature. Source/control commits use `[skip netlify]`; all queued
Git builds must finish before publication. The new candidate becomes the locked
production deploy, keeping a later ordinary Git build from replacing it.

## Database readiness

Apply the already reviewed additive migration separately:
`supabase/migrations/20261118223908_arcade_challenge_pilot.sql`. It creates empty
private tables and service-only RPCs; it inserts no pilot. Inspect the current
hosted schema first. The read-only check on November 19, 2026 confirmed the
existing Arcade session tables, column types, RLS, service role grants and
SECURITY INVOKER session helpers in project `lehswszuekjqottolmsf`; no pilot
tables existed at that check. This preflight is not proof of migration application.

After applying the migration and creating the explicit no-prize pilot, capture
fresh read-only evidence in `production/arcade-challenge-db-readiness.json`:

```json
{
  "schemaVersion": 1,
  "projectId": "lehswszuekjqottolmsf",
  "sourceMigration": "supabase/migrations/20261118223908_arcade_challenge_pilot.sql",
  "sourceMigrationSHA256": "<sha256 of exact migration bytes>",
  "appliedMigration": { "version": "<actual hosted version>", "name": "arcade_challenge_pilot" },
  "verifiedAt": "<read-only verification UTC timestamp>",
  "rpcDefinitions": [
    { "name": "arcade_challenge_pilot_load_config_v1", "sha256": "<live pg_get_functiondef hash>", "securityDefiner": false, "searchPath": "", "executeRoles": ["postgres", "service_role"], "deniedRoles": ["PUBLIC", "anon", "authenticated"] }
  ],
  "tables": [
    { "name": "arcade_challenge_pilot_configs", "schema": "private", "rls": true, "browserAccess": false }
  ],
  "pilot": { "pilotId": "arborist-trials-november-2026", "status": "enabled", "rulesHash": "<canonical rule hash>", "rules": {} }
}
```

Include all four RPCs (`load_config`, `start`, `load_attempt`, `commit_move`,
each with the `arcade_challenge_pilot_` prefix and `_v1` suffix), all three
tables (`configs`, `attempts`, `requests`) and the complete exact rules.
The helper rejects incomplete evidence, public/browser access, stale evidence,
wrong source hashes, wrong configuration and every payable/prize-enabled rule.
Do not add session tokens, signatures, wallet keys or player records to evidence.

The pilot uses an explicitly fixed game-rule date and a bounded UTC opening and
closing window. A start is allowed at the opening instant and excluded at the
closing instant. Each attempt ends at the earliest of its configured duration,
pilot close and original session expiry. The database proof and plan record the
actual selected window; the release helper does not invent one.

## Independent PostgreSQL verification

The new harness starts a private throwaway database on `127.0.0.1`, loads the
existing session fixture and actual migration, runs the real HTTP handler and
game verifier, then stops and removes the cluster. Every RPC uses a separate
`psql` process and service-role transaction. A blocking transaction and
`pg_stat_activity` confirm that competing workers actually waited on locks.

```sh
ARCADE_PG_BIN=/path/to/postgresql/bin node scripts/arcade-campaigns/pilot-postgres-check.mjs
```

If PostgreSQL is extracted to a temporary location, set `ARCADE_PG_SHARE` to its
share directory. PostgreSQL 16–19 is accepted, and the report records the actual
version. This does not read database URLs or credentials and cannot target a
hosted database. No package or dependency-lock change is required.

The local PostgreSQL 17.11 run passed seven races with 100 distinct backend
workers: competing moves at one version; identical retries; divergent retries;
operator disable before commit; session revocation before commit; cutoff while
waiting for an attempt row; and competing starts for the twentieth active slot.
`docs/arcade-challenge-postgres-validation-20261119.json` records the exact
runtime/package provenance, source hashes and verification boundary. These are
synthetic wallet sessions, not a browser-wallet signing review or human proof.

## Prepare and review

Run the source/unit/service/database/UI suites before preparation. The workflow
`.github/workflows/verify-arcade-challenge-pilot.yml` owns browser tests with the
actual local service, SQL and engine. A real hosted sign-in check is separate:
an ephemeral operator test key may exercise the actual signed-message protocol
without owning coins or submitting a transaction. This is distinguishable from
testing an installed wallet extension and its permission prompts.

Push the complete reviewed source commit to `release/arcade-challenge-prepare`
with both `[prepare arcade challenge]` and `[skip netlify]`. The workflow's
expected baseline must match the actual current locked deploy. The prepare job:

1. Captures all current static paths, backend records, schedules, runtime and
   protected configuration afresh.
2. Builds only the isolated pilot package using the existing pinned tools.
3. Binds the package manifest, exact ZIP, static source hashes and database proof
   into an immutable plan.
4. Creates one new unpublished candidate, uploads only allowed bytes, and checks
   the complete result and public delivery while the original stays locked.
5. Uploads the bounded release records plus `pilot-manifest.json` and
   `pilot-function.zip` in one Actions artifact.

Inspect `/play/challenge/` and the Campaigns entry at phone and desktop widths.
Check keyboard focus, complete assets and the visible no-prize label. The
candidate hostname is deliberately excluded from the service's origin
allowlist, so pilot API requests there must return `origin-not-allowed` (403).
Do not weaken the canonical-origin/session boundary to make a preview sign in.
Local actual-service browser tests supply the playable state review; canonical
auth/play verification follows the additive publication.

## Publish and audit

After the source PR and all CI gates pass, merge the exact reviewed tree. Create
a separate two-file control commit directly on that merged main tree, containing
`production/arcade-challenge-publish.json` and
`production/arcade-challenge-browser-review.json`. The control binds source/main
commits, tree, baseline, candidate, plan SHA, successful prepare run, artifact ID
and archive SHA. The review binds the same source/tree/candidate/plan, a recent
timestamp, both viewport sizes, `noWalletOrPaymentActions: true`, and all seven
checks: `pilotPage`, `campaignLink`, `mobileLayout`, `keyboardFocus`,
`noMissingAssets`, `noPrizeLabel`, `previewOriginBlocked`.

Push that control commit to `release/arcade-challenge-publish` with
`[publish arcade challenge] [skip netlify]`. The workflow revalidates the original
run and artifact digest, permits only the exact bounded entries, checks out the
original source, rechecks source/package/database evidence, waits for every
queued build, and verifies the still-current baseline before locking/publishing
only this new candidate. It then checks canonical static bytes, no-prize service
configuration, unauthenticated denial, complete inventory, environment and lock.

The actual signed-in start/play/resume/retry check remains a separate canonical
test; static delivery and an unauthenticated health check do not establish it.
Record that outcome explicitly, and do not claim that pilot completion grants
funded eligibility, monthly progress or a prize.

If a publication request succeeds but later verification times out, inspect its
observed state. Use `release/arcade-challenge-audit` with a matching audit control
commit for the exact candidate; audit is read-only. Do not blindly repeat
publication, restore an older deployment or replace the preservation candidate
with a historical snapshot.

## Guidance

The current MystenLabs frontend guidance was checked for this change by the
parent task. Existing wallet integration and pinned dependencies remain intact.
The Netlify deploy/functions guidance informed isolated bundling, response
headers, no speculative compute settings, and locked preservation publication.
The Supabase skill, current changelog and RLS documentation informed read-only
schema/privilege inspection. No Supabase SDK or CLI upgrade is part of this work.
