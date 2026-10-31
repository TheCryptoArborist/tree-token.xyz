# TREE FORCE '89 under TREE Arcade — integration plan

Status: **pre-deployment staging**. No change to the canonical production website.

## Target
- Existing arcade landing: https://www.tree-token.xyz/play
- Proposed native game route: https://www.tree-token.xyz/play/treeforce89/
- Source game: https://github.com/TheCryptoArborist/treeforce89/tree/feature/tree-paid-continue
- This integration branch: `feature/treeforce89-play-integration`.

## Why same-origin hosting
The wallet authorization origin must be the actual `https://www.tree-token.xyz` page, not an iframe, redirect or link to a `netlify.app` URL. Wallet security checks may still block the new origin; this is **not** a bypass or security clearance.

## Critical constraints
1. Do not modify `main`, `production/manifest.json`, production snapshot bytes, `netlify/functions` or scheduled jobs.
2. Preserve the current TREE Arcade landing page and every other DApp feature.
3. Do not enable 20,000 TREE payment execution. Current checkout is review-only.
4. Keep the TREE FORCE database isolated from the TREE Token production data and all existing functions.
5. No wallet signatures or tokens may be sent to an external origin merely to make the UI appear same-origin.
6. No deployment of unreviewed third-party scripts or a proxy that exposes authentication tokens.

## Integration stages

### A. Static artifact staging (branch only)
Build the pinned TREE FORCE source at an auditable commit. Use Vite's `base: '/play/treeforce89/'` or equivalent so asset URLs remain under the native route. Copy the resulting HTML and assets to the preview artifact `dist-preview/play/treeforce89/`, **not** the protected `dist/` production snapshot. Validate that no absolute asset URLs point to the old Netlify origin. Do not silently overwrite `play/index.html`.

### B. Backend origin and deployment boundary
The current TREE FORCE server functions enforce a specific Netlify site ID and branch context. They **will reject** requests served from the separate TREE Token site. Do not loosen or remove those guards. Design a new authenticated same-origin routing layer for the TREE Token site, preserving its existing 38 backend functions and scheduled functions. Use separate preview-only function names and database configuration. Explicitly test challenge issuance, signature verification, direct NFTree ownership, session issuance, logout, and run rotation.

### C. Security and wallet acceptance
Before a canonical-domain release, compare generated assets against the source build, review dependency and browser network requests, and submit the exact route to Slush/Mysten for classification review. Test holder, non-holder, disconnect, account switching, Game Over and disabled checkout. Stop on any malicious-site warning; never bypass it.

### D. Controlled publication
A GitHub branch preview normally uses a Netlify preview hostname, **not** the canonical browser origin. To test the exact `www.tree-token.xyz` origin, a deliberate restricted production-hostname publication will eventually be needed, after review and explicit authorization. This is not authorized by this staging plan.

## Current blockers
- Game build not yet copied into the TREE Token branch preview.
- Authenticated same-origin functions not yet ported or tested.
- Wallet security classification unresolved.
- Exact canonical domain may redirect from `www` to apex; verify redirect/canonicalization before signing any origin-bound challenge.
- Real paid continuation requires separately approved payment recipient, Game Over policy and verified Sui receipts.

## Release acceptance
Only publish when source parity, backend isolation, database separation, Slush review, rollback plan and disabled-payment tests all pass. Production remains unchanged until an explicit release decision.
