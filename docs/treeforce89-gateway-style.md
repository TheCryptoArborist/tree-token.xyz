# NFTree Gateway arcade presentation

The Gateway entrance uses the existing TREE FORCE artwork, forest backdrop, a “Ready, pilot?” invitation, three entry steps and a prominent wallet button. The sign-in explanation, direct-holder requirement, errors, disconnect control and wallet-warning guidance remain visible.

This release changes only `/play/treeforce89/index.html` and adds `/play/treeforce89/gateway.css`. All game/wallet JavaScript and the original stylesheet are preserved byte-for-byte. The existing 39 function records (38 original functions plus the isolated game API), all five schedules and all other 206 static paths must match the current live release. The existing functions-only development database binding is retained, fingerprint-checked, and never exposed in public files. No migration, payment enablement or database provisioning is included.

The introductory artwork is ordinary HTML outside the React root. CSS shows it only while the native NFTree Gateway is present. It disappears when the authenticated game shell opens; original gameplay layout and controls then apply. Responsive rules cover narrow screens, with keyboard focus styles and reduced-motion support. The wallet SDK, its button action and its dialog are unchanged.

Reproduction: `scripts/style-treeforce89-gateway.mjs` applies the HTML fragment and CSS to a staged native build while verifying identical script tags. Both native build paths call it. `scripts/release-treeforce89-gateway-style.mjs` packages only the two static paths through the initialized official Netlify CLI and checks the complete live inventory and backend records before and after publication. Auto publishing stays locked.

Current external guidance checked: MystenLabs/skills README, `frontend-apps/SKILL.md` and `frontend-apps/limitations.md`. The existing pinned integration is retained; no SDK advice is used to change wallet logic or dependencies. Netlify Deploy guidance informs the atomic static release and retained publication lock.

Release status and verification evidence will be recorded after candidate review and canonical-domain verification. The real-holder Slush lifecycle acceptance test remains separate and pending under Issue #69.
