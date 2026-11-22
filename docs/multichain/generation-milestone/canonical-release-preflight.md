# Canonical signing release preflight

User requires wallet-signing links under `https://www.tree-token.xyz/play/`.
External preview wallet connection/signing remains disabled. Empty Sui package
publication is approved; no NFT deposit, BNB deployment, sale or gameplay is approved.

## Current production, freshly checked

The connected Netlify project reports ready production deploy
`6b0282d222b49cfa17fa3731`. Current remote main is
`c26203c` (attendance-forest publication evidence). Its newest production README
records **656 static paths, 52 complete backend records, five schedules**.
The connected deploy read independently confirms 52 function records and the five
schedules. This supersedes the old 651-path/51-function baseline. The full static
and protected-configuration capture is still required before creating a release.
No current live file or setting has been changed by this preflight.

Current main was merged into `feat/bnb-generation-custody` without resetting either
checkout. The latest attendance forest and wallet switching changes are preserved.
All 63 generation/wallet tooling tests and five preview preservation/proxy tests
pass after the merge.

## Observed domain redirect

Unauthenticated HTTPS HEAD requests to both `https://www.tree-token.xyz/play/`
and the intended `/play/generation-publication/` path return HTTP 301 to the same
path on `https://tree-token.xyz`. Netlify also reports `https://tree-token.xyz`
as the project's primary URL. This is the existing canonical-domain redirect,
not a preview URL.

The current exact-origin signing guard requires `www.tree-token.xyz`; it correctly
stays disabled after this redirect. Merely adding static files cannot make that
guard pass. Resolve whether the user accepts the existing apex canonical origin
under `/play/`, or requires keeping `www` in the browser (which would require a
separately assessed domain configuration change). Do not silently weaken the
origin guard or change the site's primary domain.

## Remaining release work

Once the origin is resolved, capture all current static hashes, complete function
records, schedules, runtime fields and protected configuration using the existing
credentialed preservation workflow. This Cloud shell has no Netlify CLI/API token;
the connected plugin can read project/deploy state but does not expose the full
inventory/preserving deploy operations. Existing GitHub release workflows use the
repository's Netlify credential; prefer that existing path rather than requesting
or copying a token into chat.

Prepare only the new `/play/generation-publication/` files and its fixed read-only
simulation/receipt service. Preserve every pre-existing production entry, verify
the candidate, and wait for all queued Git builds before an exact new-candidate
publication/lock switch. Never deploy the root historical snapshot or
`dist-preview` as production. Independently verify canonical response paths and
bundle hashes before offering the signing link. Do not claim Slush warning status
until observed in the user's actual desktop wallet.
