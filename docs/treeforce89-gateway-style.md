# NFTree Gateway arcade presentation

The Gateway entrance uses the existing TREE FORCE artwork, forest backdrop, a “Ready, pilot?” invitation, three entry steps and a prominent wallet button. The sign-in explanation, direct-holder requirement, errors, disconnect control and wallet-warning guidance remain visible.

This release changes only `/play/treeforce89/index.html` and adds `/play/treeforce89/gateway.css`. All game/wallet JavaScript and the original stylesheet are preserved byte-for-byte. The existing 39 function records (38 original functions plus the isolated game API), all five schedules and all other 206 static paths must match the current live release. The existing functions-only development database binding is retained, fingerprint-checked, and never exposed in public files. No migration, payment enablement or database provisioning is included.

The introductory artwork is ordinary HTML outside the React root. CSS shows it only while the native NFTree Gateway is present. It disappears when the authenticated game shell opens; original gameplay layout and controls then apply. Responsive rules cover narrow screens, with keyboard focus styles and reduced-motion support. The wallet SDK, its button action and its dialog are unchanged.

Reproduction: `scripts/style-treeforce89-gateway.mjs` applies the HTML fragment and CSS to a staged native build while verifying identical script tags. Both native build paths call it. `scripts/release-treeforce89-gateway-style.mjs` packages only the two static paths through the initialized official Netlify CLI and checks the complete live inventory and backend records before and after publication. Auto publishing stays locked.

Current external guidance checked: MystenLabs/skills README, `frontend-apps/SKILL.md` and `frontend-apps/limitations.md`. The installed SDK's `@mysten/dapp-kit-react/docs/theming.md` and `@mysten/dapp-kit-core/src/web/dapp-kit-connect-button.ts` document CSS variables and the exported `trigger` part used to style the existing shadow-DOM button. The pinned integration is retained; no wallet logic or dependencies change. Netlify Deploy guidance informs the atomic static release and retained publication lock.

## Status: published and locked

Current live deployment: `6ae5626d7f0e8b6dd74b6ce8`, published at `2026-10-31T03:39:24.957Z` (October 30, 10:39 PM America/Chicago), with auto publishing locked. The implementation artwork/CSS is pinned in source commit `214fc4203e8ffeb15ca6d21b3ed7945402cd1ac7`. The previous native integration deployment was `6ae55a0c1aa8c546b7109a41`.

Static visual-only review draft `6ae5619a7fc0ca149bfe089d` intentionally has **zero functions, zero schedules and no database binding**, and must never be published. The separate complete live release preserves all 39 functions, all five schedules and the existing isolated database binding.

Desktop browser review passed for the forest/artwork composition, readable sign-in details, bright full-width SDK button, and the original wallet modal opening and closing normally. No wallet is installed in the test browser, and no wallet authorization, signature, transaction or backend authentication test was attempted on the static draft. Responsive and reduced-motion CSS is included; mobile visual verification remains pending. JavaScript and backend hashes are unchanged by the proposed release; syntax and whitespace checks pass.

Automatic approval review initially rejected preparing the production-context candidate because it carries the existing private database connection as a functions-only secret into a new Netlify deployment. That blocked action was not retried by another route. After the owner explicitly authorized publishing with the existing server-only connection, the complete candidate was created with the same fingerprint-verified development binding, verified and published through the dashboard. Temporary credential captures were removed from both browser and execution workspaces. No credential value is recorded in source, public files or reports.

## Final verification

- All 208 published file digests match the reviewed inventory. The existing game entry HTML is the only changed path; one stylesheet is added. All other 206 static paths and every game/wallet JavaScript bundle are unchanged.
- All 38 original function records compare exactly. The isolated game function retains its exact package, provider identities, routes, runtime, rate limit, 1024 MB memory and Ohio region. Netlify materializes redundant `mo`/`rgo` metadata aliases for the already explicit `m`/`rg` settings; the verifier requires those pairs to agree and compares every other field exactly. All five schedules are unchanged.
- Canonical rendering shows the approved artwork, heading, steps and bright wallet button. The reviewed HTML/CSS is live; Netlify's existing `tree-arcade-arboretum-link` snippet is identical to the baseline response. Removing only that unchanged site snippet yields the reviewed HTML byte-for-byte. No unrelated snippet was altered.
- The canonical read-only status check returns HTTP 200, all four tables ready, isolated development database verified and payments disabled. The deployment has no migration files and is locked.
- Machine-readable evidence: `treeforce89-gateway-style-published.json`. No new database, SDK migration, game build or backend rebuild was performed for this release. Both `main` branches remain untouched.

Next: the real-holder Slush lifecycle acceptance test remains pending under Issue #69. Paid continues remain disabled.
