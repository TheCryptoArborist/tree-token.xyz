# TREE FORCE '89 — Issue #69 verification

Date: October 30, 2026 (America/Chicago). **NO-GO for hosted Gateway testing.**

## Hosted findings

| Project | Site ID | Observed database branches |
| --- | --- | --- |
| tree-token | aa62f324-b880-47d6-85b8-4ba0700ff5bf | Initially no Netlify Database; newly created default `production` branch only |
| treeforce89 | 35f5591a-5c7d-4bc6-ae9a-3e61e816b641 | Existing `production` and `feature/tree-paid-continue` |

There is **no verified database branch for `feature/treeforce89-play-integration`**.
Neither site's environment-variable listing supplied a dedicated integration
database URL. Absence from that listing alone does not prove absence of a
managed database; the signed-in Database panels were also inspected.

### Unintended provisioning

During inspection, the agent selected **“Or create a database manually instead”**
on the TREE Token Database page, expecting configuration options. That button
immediately provisioned a database. This was an agent error: cost approval should
have preceded the action. It created a default branch called `production`, **not**
the required development branch. Do not treat it as isolation evidence or as a
completed development setup.

The panel showed one branch, 0 bytes storage, 0 bytes bandwidth and rounded
0.0 GB-hours compute. These metrics do not establish that no credits were used.
Default compute is 1–16 units, sleeping after five minutes of inactivity.
No connection string was requested, no hosted migration was applied, and no
application connection was configured. Production write access for personal
access tokens remained disabled. The agent stopped further provisioning and
must obtain approval before retaining/using billable infrastructure or deleting
the new database.

Supported continuation: retain the newly provisioned empty database only with
approval; create a separate Netlify Deploy Preview database branch for the
integration branch; compare independently obtained provider/branch identities
with the TREE Token default branch, the original TREE FORCE database, and any
production PostgreSQL connection used by existing handlers. Reject any alias,
reused endpoint/branch, or unverified identity. A name or an environment boolean
does not prove isolation. Do not connect the game to the default production
branch or the original TREE FORCE database.

Netlify's current [database billing documentation](https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/)
lists 10 credits per compute unit-hour and 20 credits per GB of database egress.
No plan change, credit purchase, or payment was made. Actual incremental dollar
charges were not established. No new preview or PR was opened because preview
creation may provision an additional billable branch.

## Migration and source compatibility

Reviewed source: `TheCryptoArborist/treeforce89` at
`a38e08e37e1f71ea41b86add8e26a92b0789cf22`.

The exact migration is copied to
`db/staged-migrations/20261016030500_tree_authentication.sql` in this repository.
It is deliberately **outside** `netlify/database/migrations` and cannot be
automatically applied by this change.

- Git blob: `e9d0af1a777bee3b77c2e57e7da659dcd2dfa2d8`.
- SHA-256: `c98e97212e3b9bc2a8731324f2b11a682cc03fbd6c262fb1ab93ac1aa3076c36`.
- Four tables: `tree_wallet_challenges`, `tree_wallet_logins`,
  `tree_game_sessions`, `tree_continue_redemptions`.
- No extension or external-table dependency; redemption references the session
  table created in the same migration. `IF NOT EXISTS` does not repair an
  incompatible existing table, so catalog checks remain necessary.

`scripts/lib/treeforce89-schema.mjs` inspects catalog metadata in one read-only
transaction and returns booleans only: 27 required columns, eight key/reference
constraints, two nonnegative checks, two wallet indexes and ten defaults. It
does not construct a connection, inspect user rows, prove hosted isolation,
enable endpoints or apply SQL migrations. Schema readiness and hosted isolation
are explicitly separate results.

## Verification evidence

| Check | Result | Scope |
| --- | --- | --- |
| TREE Token protected snapshot | Passed: 196 files and 38 archived function packages | Repository baseline only; not a fresh live package download |
| Preview handler/isolation tests | 14/14 passed | TREE Token branch; all six public APIs still return 503 |
| TREE FORCE unit tests | 201/201 passed | Pinned source checkout |
| Migration + schema inspector | Passed; all four tables and required schema checks | New disposable in-memory Netlify Database emulator (PGlite), not hosted PostgreSQL |
| Negative schema tests | Missing schema, missing session-token uniqueness, wrong wave type and missing expiry default rejected | Local emulator |
| Signed wallet gateway | Real ephemeral Ed25519 signatures, single-use challenge/replay rejection, hashed sessions, invalid signatures denied | Local emulator; NFT holdings are fixtures |
| NFT gate | Holder fixture accepted, non-holder fixture rejected | No live mainnet ownership or user wallet proof |
| Session lifecycle | Creation, restart with fresh token/run, original expiry retained, previous token denied, logout invalidation | Local emulator |
| Payments | No redemptions created; public checkout remains disabled | No chain transaction or real payment |
| Existing PostgreSQL 16 CI | Successful source run; all four tables/eight keys, signed-wallet Gateway, concurrency/rollback/logout-race tests | Existing source-repository CI, not TREE Token hosted preview |
| Hosted connectivity / Gateway / wallet smoke tests | **Not run** | Await isolated branch, cost approval, server configuration and adapted guards |

Existing real PostgreSQL evidence:
[TREE database migration validation run 41156891841](https://github.com/TheCryptoArborist/treeforce89/actions/runs/41156891841),
job `124405549399`, at the pinned source commit. Job steps and logs were read;
the successful CI result is not proof of deployment-database isolation.

### Reproduce local verification

Use a sibling checkout of `treeforce89` at the pinned SHA, install its locked
dependencies with `npm ci --ignore-scripts --no-audit --no-fund`, and install
`@netlify/database-dev@1.0.1` in a separate temporary harness directory. From this
integration checkout run:

```sh
node scripts/verify-treeforce89-play-boundary.mjs
node --test tests/treeforce89-preview-functions.test.mjs tests/treeforce89-preview-isolation.test.mjs
node scripts/verify-treeforce89-local-database.mjs ../treeforce89 ../local-db-harness
```

The last command uses only an in-memory local database and unfunded ephemeral
test keys. It rejects a source checkout with the wrong commit and a modified
migration checksum. Its synthetic preview hostname is a fixture, not a live URL.
It does not read hosted credentials or test real PostgreSQL multi-client locking.

## Production preservation

No production deployment, merge, function rebuild, schedule change, wallet-flow
change or contract transaction was performed. The unintended database creation
above **did change the site's database provisioning**, so this report does not
claim that every Netlify configuration remained unchanged.

Published deployment IDs before and after inspection:

- TREE Token: `6ae534bcd660ba4ea4235172`.
- TREE FORCE: `6a9d79efef404400084bec93`.

Both `main` heads remained unchanged:

- TREE Token: `9f76044a5b27ab20e1ee5e4868c93ac1f3e38081`.
- TREE FORCE: `f04261491ae78dc21cb87842bc3a0b1da81cefc6`.

This commit changes only staged migration material, local verification helpers
and this report. Existing production/preview handlers, runtime configuration,
38 archived production function packages, five schedules, package manifests and
dependency locks are untouched. No Slush warning was bypassed.

## Remaining acceptance gates and next action

1. Obtain the user's decision on retaining/using the newly created database
   and consuming credits for isolated preview testing, or removing it.
2. With cost approval, establish a deploy-preview branch and independently
   verify non-secret database identities against **both** production environments.
3. Promote the exact staged SQL only after compatible schema/isolation checks;
   let Netlify's preview deploy apply it. Configure connection access server-side
   for this development context only; do not copy production URLs or secrets.
4. Adapt the source's site/branch guards to the TREE Token deploy-preview
   metadata without weakening same-origin requirements. The source still
   rejects the TREE Token site by design; public placeholders remain disabled.
5. Verify the catalog and live challenge/signature/NFTree/session/logout/run
   flow on that exact preview, plus forged/replayed/non-holder/cross-origin
   cases and disabled checkout. Any Slush warning stops wallet testing.
6. Record hosted evidence and close Issue #69 only after all gates pass.

No canonical-domain publication or real 20,000 TREE payments are authorized.

## Guidance consulted

The current MystenLabs README and these files were retrieved live:
`sui-ts-sdk-backend/SKILL.md`, `sui-ts-sdk-backend/bootstrap.md`,
`accessing-data/SKILL.md`, `accessing-data/grpc.md`.
The latter's generic NFT filter example conflicts with the installed
`@mysten/sui@2.37.0` source: `core.listOwnedObjects` in that pinned version accepts
`owner` and `type`. The existing implementation was preserved after checking
`node_modules/@mysten/sui/src/grpc/core.ts`; no SDK upgrade or wallet rewrite was
made. Netlify Database guidance, CLI and migration references were also read.
