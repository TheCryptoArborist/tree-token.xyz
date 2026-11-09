# Tree Force ’89: same-domain mobile test release gate

**Target URL, NOT LIVE:** https://tree-token.xyz/play/treeforce89/test/

## Verified November 9, 2026

- The primary Netlify site is `tree-token`, currently locked to deployment `6af1c0e464d4cdc85c4e9c34`. The current snapshot contains **46 existing functions and 5 scheduled jobs**.
- The gameplay improvements are committed to `TheCryptoArborist/treeforce89`, `feature/tree-paid-continue`, through `154cd9a864e1a5cf30697bd62d3e5190404ea8db`. Its Netlify branch build is ready; this is **not** a safe player-facing URL.
- Website viewport CSS is in this pull request, isolated to `play/treeforce89/gateway.css`. It must not replace the live site's full protected snapshot.

## Critical same-origin compatibility requirement

The game candidate currently calls four **origin-relative** endpoints:

- `/.netlify/functions/tree-challenge`
- `/.netlify/functions/tree-session`
- `/.netlify/functions/tree-logout`
- `/.netlify/functions/tree-run`

Those endpoints belong to the isolated TREE Force deployment and do **not** exist among the currently published `tree-token` site's 46 function identities. **Do not ship only the new frontend static assets.** Doing so creates a page that appears to work but fails NFTree wallet verification, session handling and run restart. Neither a cross-origin iframe nor an external Netlify preview URL satisfies the same-domain testing requirement.

## Protected release sequence

1. With authenticated Netlify deployment access, capture the fresh **currently published** `tree-token` snapshot: every static SHA, 46 exact backend packages and their routes/configuration, 5 schedules, environment fingerprints, redirects and headers.
2. Build the exact reviewed TREE Force source and stage a distinct `/play/treeforce89/test/` version. All entry scripts, styles, images and dynamic imports must resolve under the production host. Do not overwrite `/play/treeforce89/`.
3. Integrate namespaced test authentication/session functions under the SAME site origin, with correct challenge origin, NFTree ownership verification, durable session handling and replay protection. Keep paid continuation disabled. Do not proxy sensitive wallet-signing calls to unreviewed external hosts.
4. Create an atomic candidate deployment preserving every unrelated asset and the **unchanged 46 existing** functions and five jobs. Any additional test-specific functions must be reviewed, isolated and denied by default where appropriate; all original function digests/configuration must remain equal.
5. Verify candidate, then publish under the production domain via the guarded Netlify release process. Reject any concurrent deploy or baseline drift. Keep current live gameplay untouched.
6. Open `https://tree-token.xyz/play/treeforce89/test/` and verify HTTPS, same-origin resources, functioning NFTree sign-in, first-run instructions, mobile Pause/Resume, Auto Fire, Fire, Shield, blur pause, all game completion states and return to `/play/`. **Only then send this link to player testers.**

## Acceptance criteria

- iPhone portrait: gameplay, HUD and full action row visible without clipping or scrolling during play, including persistent browser controls.
- Drag horizontally; Auto Fire on by default; tutorial teaches shooting, dodging and 10 waves/final boss.
- Pause and resume by touch; no motion, score or wave timers advance while paused.
- NFTree verification, wallet sessions, other arcade games and existing scores unchanged.
- Zero real payment or purchase in this test; production game still works independently.
- The final player-visible URL must stay on `tree-token.xyz`, never `netlify.app`.

## Current publishing blocker

The connected Netlify tools available in this chat can inspect projects and deployments, but do not expose the required **upload static files / create release candidate / lock and publish** operations. The authenticated site release must be performed using the existing guarded Netlify CLI/API environment or ChatGPT Work's browser. Do not paste deployment credentials into GitHub source or an ordinary chat.