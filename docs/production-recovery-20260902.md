# Production recovery record — 2026-09-02 deployment

This branch reconstructs the recoverable public source of the TREE Arcade from the live Netlify deployment without changing production.

## Deployment evidence

- Netlify site: `tree-token` (`aa62f324-b880-47d6-85b8-4ba0700ff5bf`)
- Production deploy: `6a9850dcd999de5008b4903d`
- Created: `2026-09-02T16:37:48Z`
- Deploy title: `Clarify Arboretum earnings copy`
- Deployment method: manual API deploy
- Git commit reference: unavailable
- Netlify source archive: unavailable
- Recovery base: `c5a07d3aeffd0094171f1734ecfba61ec0dd5407` (`feature/tree-v3-transactions-v1`)

Because the production deploy has no commit reference or downloadable source archive, this branch must not be described as a complete production-source recovery.

## Files recovered from the public deployment

The following public files were downloaded from `https://tree-token.xyz` and compared directly with the live responses:

- `play/index.html`
- `styles/tree-arcade-branding.css`
- `assets/garden-battles-logo.webp`
- `assets/arboretum-logo-black.webp`
- `assets/tree-force-89-logo-black.webp`
- `assets/tree-arcade-world-bg-v2.webp`

The four public PNGs were recovered exactly, visually compared with their WebP derivatives, and then replaced by those smaller WebP files for repository publication. The derivatives retain the source dimensions while reducing the combined transfer size from about 6.4 MB to about 540 KB. The existing `styles/tree-arcade.css` in the recovery base already matched production.

## Known unrecoverable server sources

Production reports four deployed functions that are missing from every inspected Git branch and cannot be downloaded from Netlify:

- `tree-knowledge-trial-claim-test.ts`
- `tree-knowledge-trial-rotation-on-deploy.ts`
- `tree-knowledge-trial-rotation-scheduled.ts`
- `tree-knowledge-trial-test.ts`

These functions must be recovered from the original development environment or rebuilt from an approved specification. They are intentionally not guessed or replaced in this branch.

## Safety boundary

- Do not deploy this branch to production until build, automated tests, and staging parity checks pass.
- Do not enable Robinhood Chain, bridge TREE, or request wallet signatures as part of this recovery.
- Do not overwrite the production site while the four function-source gaps remain unresolved.
- Use a draft deploy or the dedicated test site for validation.
