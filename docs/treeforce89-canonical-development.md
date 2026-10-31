# TREE FORCE development Gateway on TREE Arcade

The user identified `https://tree-token.xyz/play/` as the working entry point after Slush warned about the Deploy Preview hostname. The published addition places a native TREE FORCE testing link on that page and serves the game at `/play/treeforce89/`. It does not change unrelated site content, merge a branch, enable live continuation payments, or reuse a production database. Existing `www` to apex routing remains unchanged. No claim is made that Slush has cleared the native origin.

**Status: deployment `6ae55a0c1aa8c546b7109a41` is published and locked.** After the owner instructed the agent to proceed with the next step, the saved candidate was reverified against the unchanged live baseline and published through the Netlify dashboard. Netlify records publication at `2026-10-31T03:16:30.675Z` (October 30, 10:16 PM America/Chicago). The prior publication blocker is resolved. Canonical-domain automated checks pass; real-holder Slush testing remains pending.

## Release boundary

- Source branch: `feature/treeforce89-play-integration`; draft PR #70 remains unmerged.
- Pre-release baseline: `6ae534bcd660ba4ea4235172`, 196 static files, 38 exact existing function/provider configurations, five schedules, auto publishing locked.
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

The candidate passed hosted challenge/signature/non-holder/replay/logout/run-denial/payment-disabled checks again before publication. The same checks passed on `https://tree-token.xyz` after publication. A directly held NFTree wallet is still required for a real Slush positive-login, game launch, restart and logout acceptance test. Issue #69 stays open until that test passes.

## References checked

Current MystenLabs/skills README, `frontend-apps/SKILL.md` and `transactions.md`, `sui-ts-sdk-backend/SKILL.md` and `bootstrap.md`, and `accessing-data/SKILL.md` and `grpc.md` informed preservation of the existing wallet integration and pinned SDK. API usage is verified against installed Sui 2.37.0. Netlify database, functions and deployment guidance informed the explicit server-side binding, custom function route and preserved-package release. The pinned packager requires `aggregateBy: ['ip']` to emit the intended IP limiter; this is checked before upload.

## Completed candidate evidence

- Netlify deployment `6ae55a0c1aa8c546b7109a41` is ready, published and locked in production hosting context. Implementation source is `03372a1c04a546666c9a1d67e38875d2b4376aa1`, with reviewed evidence at `d862d5da79c73d2e0c21b48d2e57f01ad85626ce`, on the feature branch. The `main` hosting label does not represent a Git branch update.
- Inventory: 207 files; all 195 unrelated static paths retain exact baseline SHA-1s. Only `/play/index.html` changes among existing paths; eleven game files are added. Netlify reports new hashed asset names in lowercase; exact served JavaScript/CSS/image digests and mixed-case generated URLs were independently verified. The corrected inventory comparison passes without skipping any files.
- All 38 existing function records, including package/provider identities, routes, runtimes and configuration, match exactly. The five schedules match exactly. Only `treeforce89-dev` is added.
- The candidate has **zero migration files**. The dashboard labels its hosting database context Production, but the game function uses only the explicit development binding, validated against the isolated branch's fingerprint before connecting. Hosted schema readiness confirms all four required tables. No production schema migration was submitted.
- Hosted smoke passes: challenge issuance, genuine ephemeral personal-message signature, live mainnet non-holder rejection, replay/forgery/eligibility rejection, cross-origin blocking, token-required/idempotent logout, invalid run denial, disabled continuation payments, and database isolation/readiness. Positive holder/session/run/logout tests pass locally with real signatures and fixture ownership under the native hosting guard.
- Four GitHub runs passed on the implementation commit: production snapshot, STI Stats, and both native preflight triggers. Twenty focused tests pass; native build and browser Gateway rendering pass.
- Temporary database credential captures were deleted after supplying the functions-only deploy secret. No connection URL is stored in this report, source control, public assets or logs.

Machine-readable evidence: `treeforce89-canonical-candidate.json` contains the exact candidate inventory and original backend records. `treeforce89-canonical-published.json` records the verified published inventory, new function identity, preserved schedules, publication state and canonical-domain smoke results. Earlier permalink and local tests remain in `treeforce89-canonical-hosted-smoke-results.json` and `treeforce89-canonical-local-results.json`.

## Canonical-domain verification

- The published `/play/` page displays the TREE FORCE card as **IN TESTING**, with a **TEST TREE FORCE ’89** link to `/play/treeforce89/` in the same tab.
- Following that exact link in the browser opens the native NFTree Gateway, Connect Wallet button, message-signing explanation and warning-stop guidance.
- The published release verifier passes against all 207 static files, all 38 existing function/provider/configuration records and all five schedules. One isolated game function is added. Auto publishing remains locked.
- Hosted smoke on the canonical origin passes: real signatures, mainnet non-holder denial, replay and forged-signature rejection, forged-eligibility rejection, cross-origin blocking, authenticated/idempotent logout, invalid run denial, schema readiness and database isolation. Payments remain disabled.
- No migration was applied by this publication. No holder wallet was connected, and Slush clearance is not established by these checks.

## Exact next steps

1. Open `https://tree-token.xyz/play/` and select **TEST TREE FORCE ’89**.
2. With a directly held NFTree, test Slush login, game entry, restart/token rotation, account switching, disconnect/logout and reconnect. Stop on any wallet security warning.
3. Record the holder results and close Issue #69 only when the remaining acceptance checks pass. Paid continues remain disabled.
