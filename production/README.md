# Production baseline — 2026-09-15

This directory records the live TREE deployment `6aa70deff0b74e2bfe8b7725`, published September 13, 2026. Synchronizing this baseline does not publish a new deployment.

## Verified recovery

- All 166 deployed files have been recovered and verified against Netlify's SHA-1 inventory, including the protected deployed configuration.
- Public HTML, JavaScript, CSS, and assets are restored at their normal repository paths. The homepage includes its exact deployed compiled bundle; the prior editable source remains in Git history.
- `manifest.json` maps every deployed path to its repository source and records all 35 function identities/configurations and five schedules.
- `functions/` contains 30 exact deployed ZIP packages verified against Netlify's SHA-256 digests. These are recovery artifacts, not a directory to publish as public site files.
- `deployed-netlify.toml` preserves the historical generated configuration, including its old absolute build paths. The root configuration remains portable.

## Remaining source verification gap

Five locally cached function ZIPs differ from production: `tree-knowledge-trial`, `tree-knowledge-trial-admin`, `tree-knowledge-trial-resolver`, `tree-knowledge-trial-rotation-on-deploy`, and `tree-knowledge-trial-rotation-scheduled`.

Their exact deployed identities are retained in the manifest and their running packages remain on Netlify. Local source candidates were found and preserved under `recovery/source-candidates/`; they must not be represented as verified production source. The other existing `netlify/` sources also require a reproducible package comparison before a full backend rebuild. Do not replace these running packages merely to make a build pass.

## Verify and build

Run `npm run verify:production` to verify the recovered bytes and function archives. Run `npm run build` to create the exact 166-file static snapshot in `dist`. A different old build must first be preserved or removed. The build never copies function ZIPs, recovery candidates, or private server source into `dist`.

This is a production recovery baseline, not a new feature release. The VICTORY fix remains separately reviewable in PR #22; the Kelpie changes remain in PR #21. Neither is part of the captured live site.

## Keeping the repository synchronized

1. Begin future work from the synchronized `main` branch and commit changes on a feature branch.
2. Test a preview before publishing. Record the exact commit, static-file digests, function package digests, schedules, and resulting deployment ID.
3. For a frontend-only release while backend recovery is incomplete, retain the current verified backend package identities rather than rebuilding unrelated functions.
4. Update this baseline and manifest after an authorized production release, then fast-forward the computer's checkout.
5. Do not unlock automatic production publishing until the five missing exact function packages or equivalent source parity have been resolved and verified. The currently published deployment is locked during this synchronization to avoid an incidental full rebuild replacing it.

The separately dirty `tree-token-v3-repair` workspace was inspected read-only and remains untouched.
