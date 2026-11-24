# Disabled endpoint preservation release — preparation only

The next release adds only `arcade-bnb-run-review`, disabled. It needs no hosted
SQL migration and no new environment variable. It returns 503 `review-disabled`
without reading secrets or calling the database/chain. This separates publishing
an inert package from the later database and backing-review enablement.

## Exact inputs

- Reviewed source: `905fd47313efa4fbea599b4e5c7ce87be9fc0dfa`.
- Package run: https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45340749351
- Artifact `bnb-run-review-candidate`, ID `14896150960`.
- Function ZIP SHA256 `8c226ea9fd3390292e4f2e63363c65bfefd96b03fdd0a2258891ca67770caa14`, 645897 bytes.
- Modern Node 24, stream invocation, bootstrap 2.24.0/API 2.
- Route `/api/arcade-bnb-test/run-review`; 20 requests per 60 seconds per domain/IP.
- Current reviewed live baseline: `6b053183229603fcba59509e`, ready and locked,
  691 static paths, 60 functions and five schedules. This includes the latest
  Tree Army illustrated walking release. `origin/main` at `38b452b` was merged;
  incoming Tree Army source/assets remain identical to main.

The GET-only `scripts/prepare-bnb-run-release.mjs` verifies the exact hosted ZIP,
source/lock/traced dependency hashes, migration hash, route and admission rules.
It captures the full static digest map, complete backend/provider records,
runtime and hashed protected configuration twice. It refuses drift, missing
inventory, duplicate route/function, or an enabled/masked environment flag.
It creates a local proposed deploy request and plan; it cannot publish or mutate
anything remotely. Credentials and environment values are not written to artifacts.

Run via `.github/workflows/bnb-run-release-plan.yml` using a branch commit marked
`[prepare bnb run review] [skip netlify]`. It downloads the reviewed artifact,
uses the shared production preservation concurrency group, and uploads the full
plan plus summary. Package and plan retention is 30 days; retain the selected
manifest, hashes and run IDs in GitHub before any future publication.

## Subsequent publication procedure

1. Re-read the current published ID/lock and compare **all** captured static,
   backend, schedule, runtime and protected configuration evidence. If anything
   changed, capture and review a fresh plan. Never replace newer Tree Army work.
2. Create a new candidate from the captured live digest map, all original function
   digests/configuration, and the one exact new ZIP. Do not run the root build.
   Only the new function may require uploading; any static/old-backend requirement
   is a stop condition. Upload with Node 24/stream metadata and the exact route,
   bootstrap and rate-limit rules. No environment writes or SQL execution.
3. Inspect the candidate's complete inventories. All 691 static paths and 60
   old provider records must match; the new total is 61 functions and five
   unchanged schedules. Verify the new function's disabled response, no-store
   headers, platform admission metadata and existing BNB authentication route.
   No wallet page, wallet signature or preview link is needed.
4. Only after those checks and review of that exact candidate, authorize the
   production switch. Wait for **all** queued/building Git deployments to finish,
   recheck the current baseline, publish the new candidate and lock it. Verify
   the canonical endpoint and full inventory again. Do not restore an old deploy.

No candidate creation or publication code is included in the planning workflow.
The package plus GET-only plan are preparation evidence, not a hosted candidate
or approval to enable gameplay. If a post-publication defect appears, keep/force
`BNB_RUN_REVIEW_ENABLED=false` and prepare a fix-forward release from the then-
current live inventory. Preserve all unrelated newer work; do not drop data or
restore a historical site snapshot.

## Later database/enablement scope (not part of disabled publication)

The unchanged migration is
`supabase/migrations/20261124060157_arcade_bnb_run_review.sql`; its exact SHA256
is pinned in `../run-endpoint/package-review.json` and the generated plan.
Before applying it to project `lehswszuekjqottolmsf`, inspect hosted catalog and
migration history, verify existing BNB identity table/RPC signatures and grants,
and confirm the new objects do not already exist. If present, reconcile rather
than replay. Apply only this reviewed transaction, never a broad push of all
historical pending migrations. Record its history once and validate afterwards.

Check RLS, SECURITY INVOKER with empty search_path, no PUBLIC/anon/authenticated
execute/table access, service-role-only RPC permissions, and unchanged identity
objects/grants. Use invalid/nonexistent ticket identifiers for hosted negative
RPC checks; do not create or revoke real user sessions. Run hosted advisors and
review new findings. Local PostgreSQL evidence does not substitute for these
hosted checks. Enable only generation 1 in a subsequent reviewed change; it is
retired and must deny backing. Any future generation needs a separate review.

Proposed retention before enablement: keep expired review rows for seven days
for diagnosis; an administrator deletes only rows with `expires_at` older than
seven days, in bounded batches, after counting candidates. Review once daily
while enabled. This is an operational proposal, not an installed schedule or a
DELETE grant to the runtime. Expired tickets remain unusable regardless of cleanup.
The disabled publication produces no rows and therefore needs no cleanup job.
Stop enablement if no operator accepts retention ownership. Existing identity
sessions are never deleted by this procedure.

If migration validation fails, keep the endpoint disabled and fix forward; keep
private audit rows for diagnosis. Do not drop the table or alter existing auth,
payments, scores, games or tournament routines as a rollback.

Supabase changelog and securing-the-API guidance were refreshed during planning.
The current PostgreSQL ltree/pgcrypto upgrade notice does not require changes to
this plain SQL ticket table/RPC. No SDK, database upgrade or Sui protocol change
is included.
