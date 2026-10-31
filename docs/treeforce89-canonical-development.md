# TREE FORCE development Gateway on TREE Arcade

The user identified `https://tree-token.xyz/play/` as the working entry point after Slush warned about the Deploy Preview hostname. The prepared candidate adds a native TREE FORCE testing link on that page and `/play/treeforce89/`. It does not change unrelated site content, merge a branch, enable live continuation payments, or reuse a production database. Existing `www` to apex routing remains unchanged. No claim is made that Slush has cleared the native origin.

**Status: verified candidate `6ae55a0c1aa8c546b7109a41`, not published.** Automatic approval review rejected the Netlify **Publish deploy** click because the original instructions prohibit production publication and it did not consider the later domain request an explicit override. The blocked action was not retried through the API or CLI. The original production deploy remains live. Publishing this exact candidate requires the owner's explicit approval to change the live Play entry and add the native game path.

## Release boundary

- Source branch: `feature/treeforce89-play-integration`; draft PR #70 remains unmerged.
- Live baseline: `6ae534bcd660ba4ea4235172`, 196 static files, 38 exact existing function/provider configurations, five schedules, auto publishing locked.
- Existing-path change: `/play/index.html`, limited to the TREE FORCE card, its testing description, and a native same-tab link. Garden Battles, Arboretum and the DApp remain unchanged.
- Eleven pinned game assets are added under `/play/treeforce89/`. The original game's source commit is `a38e08e37e1f71ea41b86add8e26a92b0789cf22`. Seven asset URLs are rebased and five HTTP endpoint literals are namespaced. Wallet signing, transactions, dependencies and contracts are unchanged.
- One additional function, `treeforce89-dev`, routes only `/play/treeforce89/api/*`; the existing 38 functions are reused without rebuilding.
- Its explicit, functions-only secret points to the already migrated `feature/treeforce89-play-integration` database. It refuses the default TREE Token database, original TREE FORCE production database, an unrecognized database identity, or an absent binding. No automatic production-database fallback is permitted.
- The production deployment context is a hosting context required for canonical routing, not permission to use a production database. The live baseline's branch label is retained; neither repository's `main` ref is changed. No migration is included in this manual file-digest release.
- Every authentication request must be an exact same-origin HTTPS POST on the game API path. Only the approved site's production context and the current immutable candidate permalink are accepted. Wallet challenge messages remain origin-bound. The preview hostname is not used as a proxy or iframe.
- Both continuation endpoints remain disabled. The public status endpoint exposes readiness booleans and table count, never credentials, wallet holdings, signatures or session tokens.

## Verification before publication

Twenty focused boundary tests pass. Local Netlify PostgreSQL emulation also verifies the actual HTTP adapters under both the preview and native production hosting contexts: real Sui personal-message signatures, holder fixtures, session issuance, replay rejection, run/token rotation, old-token rejection and logout. Fixture ownership is restricted to the local harness; hosted ownership continues to use live mainnet reads. No payment rows are created.

The packaging script emits only native public assets and a private function ZIP. It verifies that browser bundles contain no PostgreSQL connection URLs and no root API paths that could collide with existing functions. The release script runs through the existing authenticated official Netlify CLI, without reading its credential files or creating access tokens. It verifies file digests, all existing function/provider records and all five schedules before any candidate can be published. The database binding is supplied only as a functions-scoped secret. Temporary credential captures must be deleted after the upload.

The new candidate must pass hosted challenge/signature/non-holder/replay/logout/run-denial/payment-disabled checks before publication. A directly held NFTree wallet is still required for a real Slush positive-login, game launch, restart and logout acceptance test. Issue #69 stays open until that test passes.

## References checked

Current MystenLabs/skills README, `frontend-apps/SKILL.md` and `transactions.md`, `sui-ts-sdk-backend/SKILL.md` and `bootstrap.md`, and `accessing-data/SKILL.md` and `grpc.md` informed preservation of the existing wallet integration and pinned SDK. API usage is verified against installed Sui 2.37.0. Netlify database, functions and deployment guidance informed the explicit server-side binding, custom function route and preserved-package release. The pinned packager requires `aggregateBy: ['ip']` to emit the intended IP limiter; this is checked before upload.

## Completed candidate evidence

- Netlify candidate `6ae55a0c1aa8c546b7109a41` is ready in production hosting context, with `published_at: null`. Implementation source is `03372a1c04a546666c9a1d67e38875d2b4376aa1` on the feature branch. The `main` hosting label does not represent a Git branch update.
- Inventory: 207 files; all 195 unrelated static paths retain exact baseline SHA-1s. Only `/play/index.html` changes among existing paths; eleven game files are added. Netlify reports new hashed asset names in lowercase; exact served JavaScript/CSS/image digests and mixed-case generated URLs were independently verified. The corrected inventory comparison passes without skipping any files.
- All 38 existing function records, including package/provider identities, routes, runtimes and configuration, match exactly. The five schedules match exactly. Only `treeforce89-dev` is added.
- The candidate has **zero migration files**. The dashboard labels its hosting database context Production, but the game function uses only the explicit development binding, validated against the isolated branch's fingerprint before connecting. Hosted schema readiness confirms all four required tables. No production schema migration was submitted.
- Hosted smoke passes: challenge issuance, genuine ephemeral personal-message signature, live mainnet non-holder rejection, replay/forgery/eligibility rejection, cross-origin blocking, token-required/idempotent logout, invalid run denial, disabled continuation payments, and database isolation/readiness. Positive holder/session/run/logout tests pass locally with real signatures and fixture ownership under the native hosting guard.
- Four GitHub runs passed on the implementation commit: production snapshot, STI Stats, and both native preflight triggers. Twenty focused tests pass; native build and browser Gateway rendering pass.
- Temporary database credential captures were deleted after supplying the functions-only deploy secret. No connection URL is stored in this report, source control, public assets or logs.

Machine-readable evidence: `treeforce89-canonical-candidate.json`, `treeforce89-canonical-hosted-smoke-results.json`, and `treeforce89-canonical-local-results.json` in this directory. These describe the unpublished candidate, not a completed canonical-domain wallet test.

## Exact next steps

1. Obtain explicit approval to publish this candidate to `tree-token.xyz`, changing only the TREE FORCE card on `/play/` and adding the native game/API paths while preserving all existing backend records and schedules.
2. Publish the already verified candidate, retain auto-publish locking, run the same smoke checks on the canonical origin, and record the final published inventory.
3. With a directly held NFTree, test Slush login, game entry, restart/token rotation, account switching, disconnect/logout and reconnect. Stop on any wallet security warning. Keep Issue #69 open until this passes. Paid continues remain disabled.
