# TREE FORCE ’89 — isolated Gateway verification

October 30, 2026 (America/Chicago). **Backend ready for real NFTree-holder preview testing. Issue #69 remains open pending that test.**

## Working preview

- URL: https://deploy-preview-70--tree-token.netlify.app/play/treeforce89/
- Draft PR: https://github.com/TheCryptoArborist/tree-token.xyz/pull/70
- Branch: `feature/treeforce89-play-integration`.
- Authenticated native-game preview deployed as `6ae553cf9f662938de87be99`, source `904047e87d9411b0aed03ac23c2011f7a2f74ef5`.
- The browser rendered the NFTree Gateway and its Connect Wallet button. No iframe, redirect to the old game origin, real payment, or wallet-warning bypass is used.

## Database provisioning and isolation

Netlify now has a dedicated branch named `feature/treeforce89-play-integration` on the TREE Token project (`aa62f324-b880-47d6-85b8-4ba0700ff5bf`), associated with Deploy Preview #70. Its dashboard explicitly identifies it as an isolated branch whose changes do not affect production.

The read-only bootstrap deploy was `6ae551d85e378ea57f261a7f`. Before any migration or authentication write:

1. Read-only connection targets were independently obtained from the signed-in Netlify dashboards for TREE Token production, original TREE FORCE production, and the new integration branch. Credentials were never printed, committed, or sent to the frontend.
2. Compute `SHA256(normalized database hostname + "|" + database path)`. Normalize only Netlify's `-pooler` hostname alias; credentials are excluded.
3. A hosted read-only function independently derived the same identity from Netlify's automatically scoped runtime connection.
4. Confirmed the integration schema had zero tables before promoting the migration.

| Environment | Non-secret database identity |
| --- | --- |
| TREE Token default production branch | `5a940f1b6bdcce4a96dff3ffcfeb6a2b5de01b09fcfe2f8f1e351a9a0ef47712` |
| Original TREE FORCE production branch | `5db7840e95d93a2a62119d00e7f2774591f307ea086ac00026f9a91777247141` |
| Integration branch — dashboard and runtime agree | `df2f0abee059d9898495a125018fa0a291d50b9050c0d4557231f409bed53065` |

Existing TREE Token production functions also use Supabase project `lehswszuekjqottolmsf`; the new Gateway uses only the verified Netlify PostgreSQL branch. No Supabase connection or existing application database is reused.

Runtime guards reject a production endpoint, a changed/unverified database identity, a different site/branch/deploy context, canonical production hosts, other PR hosts, missing/forged Origin, and cross-site fetch metadata. The approved identity is server-owned evidence, never a caller-supplied boolean. Schema readiness is checked before authentication writes.

### Cost control and provisioning history

The owner approved retaining the database and up to **100 credits** for testing. Maximum database compute was reduced from 16 to **1 unit**; idle sleep remains **5 minutes**. The observed account credit balance moved from 2,649.9 to 2,648 during this work (1.9 credits); this is an account-wide observation, not finalized per-project billing. Usage reporting can lag. No plan upgrade, credit purchase, or payment was made.

The default database had initially been created by an agent mistake before cost approval: the manual-create button immediately provisioned it instead of opening a setup screen. That incident was disclosed in the previous report and Issue #69. Subsequent provisioning and usage proceeded after the owner's explicit approval. The default production branch was never used for game development or migrated.

## Migration and table verification

Exact migration source: `TheCryptoArborist/treeforce89` at `a38e08e37e1f71ea41b86add8e26a92b0789cf22`:

`db/staged-migrations/20261016030500_tree_authentication.sql`

- Git blob: `e9d0af1a777bee3b77c2e57e7da659dcd2dfa2d8`.
- SHA-256: `c98e97212e3b9bc2a8731324f2b11a682cc03fbd6c262fb1ab93ac1aa3076c36`.
- Promoted unchanged to `netlify/database/migrations/20261016030500_tree_authentication.sql` only after hosted isolation and empty-schema verification.
- Netlify deployment **`6ae55249e051bde70d2093cf`** reports migration `20261016030500_tree_authentication` as **applied**, specifically to database branch `feature/treeforce89-play-integration`.
- Subsequent deploys report no pending migration; no hosted DDL was executed through a manual connection or SQL console.

| Required table | Hosted result |
| --- | --- |
| `tree_wallet_challenges` | Present, required columns and primary key verified |
| `tree_wallet_logins` | Present, required columns, primary key and wallet index verified |
| `tree_game_sessions` | Present, required columns, session/run uniqueness, nonnegative checks, wallet index and expiry/state defaults verified |
| `tree_continue_redemptions` | Present, digest uniqueness, session/continuation uniqueness and session foreign key verified |

The catalog inspector passed **27 column checks, eight key/reference checks, two nonnegative constraints, two wallet indexes and ten defaults**. It runs in a read-only transaction and returns only readiness booleans and a non-secret database fingerprint.

## Authentication implementation and evidence

Six same-origin API paths remain on the TREE Token preview:

| Endpoint | Behavior |
| --- | --- |
| `tree-challenge` | Single-use, five-minute, origin/network/wallet-bound personal-message challenge |
| `tree-session` | Real Sui signature verification, direct mainnet NFTree ownership check, hashed game-session credential |
| `tree-logout` | Server-side revocation; authenticated bearer required; idempotent for absent/expired credentials |
| `tree-run` | Authenticated atomic run/token rotation, ownership recheck, original expiry retained |
| `tree-continue-offer` | Disabled, HTTP 503 |
| `tree-continue` | Disabled, HTTP 503; no real 20,000 TREE execution |

Seventeen gateway modules were copied from the pinned source; sixteen remain byte-identical. Only `preview-access.mjs` was adapted to TREE Token's site, PR, context and same-origin gate. Provenance hashes are recorded in `netlify/preview-lib/treeforce89-source/provenance.json`. The Gateway has its own pinned `@mysten/sui@2.37.0` dependency directory. Existing DApp SDK `2.26.1` and all previously locked dependency versions are unchanged.

The pinned game is built for `/play/treeforce89/`. Seven Phaser asset URLs were rebased for that path; wallet and transaction source is unchanged. Eleven native assets passed verification. The browser loads the game directly under the preview origin.

### Passed tests

- **Hosted PostgreSQL connectivity and catalog checks:** ready; four tables; correct isolated identity; all schema checks pass.
- **Hosted real-signature/non-holder smoke:** issued a real challenge to an unfunded ephemeral signer, verified its Sui personal-message signature, performed a live mainnet NFTree ownership lookup, and correctly returned `NFTREE_REQUIRED`.
- **Hosted rejection checks:** reused nonce, forged signature, browser-supplied eligibility, cross-origin request, missing logout token and unauthenticated run all rejected.
- **Hosted logout readiness:** absent valid-format token handled idempotently; no false claim of an existing holder-session revocation.
- **Hosted checkout:** payment endpoint remains unauthorized and disabled.
- **Local integrated HTTP + SQL test:** real ephemeral signatures with fixture NFT holdings; session creation, hashed credentials, run/token rotation, original expiry, old-token rejection and logout invalidation pass.
- **Local schema negative tests:** absent schema, missing session-token uniqueness, wrong wave type and missing expiry default all rejected.
- **Preview security suites:** 17/17 pass.
- **Original source unit suite:** 201/201 pass.
- **Function packaging:** all eight preview functions bundled successfully. Existing required CI also rebuilt handler sources in disposable validation for parity; none of those generated packages was published to production.
- **GitHub checks:** all five runs on `904047e` succeeded, covering production snapshot, STI integration, preview/isolation preflight (push and PR) and native asset staging.

Machine-readable hosted results: `docs/treeforce89-hosted-smoke-results.json`.
Existing real PostgreSQL 16 concurrency/rollback/logout-race evidence for the source pin remains available in [source CI run 41156891841](https://github.com/TheCryptoArborist/treeforce89/actions/runs/41156891841). Local PGlite testing is not described as a real multi-client PostgreSQL concurrency test.

### Remaining real-holder test

A real NFTree holder must open the preview, connect Slush, and choose **Verify NFTree & Play**. Confirm a game session opens, restarting rotates the run, and disconnect/logout invalidates access. Account-switch and reconnect behavior should also be checked. This requires a real holder-controlled wallet signature; no private key, test NFT, synthetic hosted ownership result, or security-warning bypass was introduced.

Real-holder session issuance and actual Slush approval/security behavior have **not** been verified. Stop on any Slush warning. Issue #69 remains open until this test succeeds.

## Production preservation

Published deployment IDs remained:

- TREE Token: `6ae534bcd660ba4ea4235172`.
- Original TREE FORCE: `6a9d79efef404400084bec93`.

TREE Token's published deployment still has **38 production functions** and exactly these **five schedules**:

| Scheduled function | UTC cron |
| --- | --- |
| `tree-badges-refresh-scheduled` | `47 */6 * * *` |
| `tree-exposure-refresh-scheduled` | `27 */6 * * *` |
| `tree-knowledge-trial-resolver` | `5 * * * *` |
| `tree-knowledge-trial-rotation-scheduled` | `15 * * * *` |
| `tree-leaderboard-refresh-scheduled` | `17 */6 * * *` |

Repository preservation checks pass for 196 protected baseline files and 38 archived function packages. Both `main` branches remain unchanged; the PR stays draft and unmerged. No production deployment, production package replacement, production migration, production credential change, smart-contract action or wallet-transaction rewrite occurred. Database provisioning and its approved compute setting are the only changes to hosting configuration outside Deploy Preview #70.

No game publication at `tree-token.xyz` or `www.tree-token.xyz` is authorized. The exact next step is the holder test above; any eventual canonical-domain publication requires separate authorization and security review.

## Reproduce

Install the root locked dependencies and the nested Gateway dependencies with `npm ci --ignore-scripts`. Use a sibling original-game checkout at the pinned source SHA and a temporary harness with `@netlify/database-dev@1.0.1`.

```sh
npm ci --prefix netlify/preview-lib/treeforce89-source --ignore-scripts --no-audit --no-fund
node scripts/verify-treeforce89-play-boundary.mjs
node --test tests/treeforce89-preview-functions.test.mjs tests/treeforce89-preview-isolation.test.mjs tests/treeforce89-database.test.mjs
node scripts/verify-treeforce89-local-database.mjs ../treeforce89 ../local-db-harness
node scripts/verify-treeforce89-hosted-smoke.mjs
```

The hosted script targets only PR #70, uses unfunded ephemeral keys, never submits a blockchain transaction, and prints no signatures, nonces, tokens, connection strings or private keys.

## Guidance checked

The current MystenLabs README and relevant guidance were retrieved live for this work: `sui-ts-sdk-backend/SKILL.md`, `sui-ts-sdk-backend/bootstrap.md`, `accessing-data/SKILL.md`, and `accessing-data/grpc.md`. SDK advice was checked against the pinned installed version; its `core.listOwnedObjects` accepts `owner` and `type`, so the existing working implementation was preserved. No skill installation or SDK migration occurred.

Netlify Database, CLI/migration references, Functions and Deploy guidance were consulted. Supabase guidance was checked only to identify existing production storage; no Supabase change was made.
