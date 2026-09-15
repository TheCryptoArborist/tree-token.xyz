# TREE Token Website

GitHub and local production baseline for tree-token.xyz, synchronized from live deploy `6aa70deff0b74e2bfe8b7725` on September 15, 2026.

## Current status

- All 166 deployed site files are recovered and hash verified.
- All 35 server-function identities and five schedules are recorded; 30 exact function ZIPs are backed up.
- Five Knowledge Trial packages still require source/package reconciliation. Their live Netlify packages remain in place. Local candidates are preserved separately and are not verified replacements.
- VICTORY PR #22 and Kelpie PR #21 remain separate preview work.

Read [the production record](production/README.md) and [manifest](production/manifest.json) before deployment work.

## Local verification

Use Node.js 24. The recovery build has no external dependencies.

```sh
npm run verify:production
npm run build
```

`dist` contains exactly the captured deployed files. Preserve any previous development build elsewhere first. Server-function packages and recovery candidates are excluded from the public build.

The homepage's compiled bundle is retained exactly. Earlier editable source remains in Git history. Future development belongs on a feature branch with preview validation and an updated release manifest.

## Secrets and deployment

Keep credentials and populated environment files out of Git. Use `.env.example` for variable names and Netlify's environment configuration for runtime values.

Production publishing is locked to the existing deployment while backend parity remains unresolved. Synchronizing GitHub does not deploy the site. Do not use a broad production deployment to reconcile source drift.
