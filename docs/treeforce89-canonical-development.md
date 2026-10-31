# TREE FORCE development Gateway on TREE Arcade

The user identified `https://tree-token.xyz/play/` as the working entry point after Slush warned about the Deploy Preview hostname. This narrowly authorizes a native TREE FORCE testing link on that page and `/play/treeforce89/`; it does not authorize unrelated site changes, a branch merge, live continuation payments, or production-database reuse. Existing `www` to apex routing remains unchanged. No claim is made that Slush has cleared the native origin.

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

Publication evidence and the canonical smoke-test results are recorded separately after the candidate passes.
