# NFTree Gateway arcade presentation

The Gateway entrance uses the existing TREE FORCE artwork, forest backdrop, a “Ready, pilot?” invitation, three entry steps and a prominent wallet button. The sign-in explanation, direct-holder requirement, errors, disconnect control and wallet-warning guidance remain visible.

This release changes only `/play/treeforce89/index.html` and adds `/play/treeforce89/gateway.css`. All game/wallet JavaScript and the original stylesheet are preserved byte-for-byte. The existing 39 function records (38 original functions plus the isolated game API), all five schedules and all other 206 static paths must match the current live release. The existing functions-only development database binding is retained, fingerprint-checked, and never exposed in public files. No migration, payment enablement or database provisioning is included.

The introductory artwork is ordinary HTML outside the React root. CSS shows it only while the native NFTree Gateway is present. It disappears when the authenticated game shell opens; original gameplay layout and controls then apply. Responsive rules cover narrow screens, with keyboard focus styles and reduced-motion support. The wallet SDK, its button action and its dialog are unchanged.

Reproduction: `scripts/style-treeforce89-gateway.mjs` applies the HTML fragment and CSS to a staged native build while verifying identical script tags. Both native build paths call it. `scripts/release-treeforce89-gateway-style.mjs` packages only the two static paths through the initialized official Netlify CLI and checks the complete live inventory and backend records before and after publication. Auto publishing stays locked.

Current external guidance checked: MystenLabs/skills README, `frontend-apps/SKILL.md` and `frontend-apps/limitations.md`. The installed SDK's `@mysten/dapp-kit-react/docs/theming.md` and `@mysten/dapp-kit-core/src/web/dapp-kit-connect-button.ts` document CSS variables and the exported `trigger` part used to style the existing shadow-DOM button. The pinned integration is retained; no wallet logic or dependencies change. Netlify Deploy guidance informs the atomic static release and retained publication lock.

## Status: visual review ready; live page unchanged

Static visual-only draft: `6ae5619a7fc0ca149bfe089d`. This draft intentionally has **zero functions, zero schedules and no database binding**, and must never be published. It exists only to inspect the HTML/CSS alongside the unchanged game bundles. Live deployment remains `6ae55a0c1aa8c546b7109a41` with its 39 functions, five schedules and existing isolated database binding.

Desktop browser review passed for the forest/artwork composition, readable sign-in details, bright full-width SDK button, and the original wallet modal opening and closing normally. No wallet is installed in the test browser, and no wallet authorization, signature, transaction or backend authentication test was attempted on the static draft. Responsive and reduced-motion CSS is included; mobile visual verification remains pending. JavaScript and backend hashes are unchanged by the proposed release; syntax and whitespace checks pass.

Automatic approval review rejected preparing the production-context candidate because it carries the existing private database connection as a functions-only secret into a new Netlify deployment. The reviewer stated that explicit end-user authorization naming that sensitive payload and destination was required. That blocked action was not retried by another route. The subsequent visual-only drafts contain no secrets or backend. The temporary database credential capture was deleted.

Next: obtain permission to carry the same private server-only development database connection into Netlify's new release; then prepare and verify the complete preserved-backend candidate, publish, retain the lock and check canonical rendering/readiness. The real-holder Slush lifecycle acceptance test remains separate and pending under Issue #69. Paid continues remain disabled.
