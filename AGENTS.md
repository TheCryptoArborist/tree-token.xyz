# TREE production synchronization

Read `production/README.md` before deployment work. `production/manifest.json` is the verified deployment baseline. Preserve its byte-exact files when only synchronizing the repository.

The current production baseline has exact copies of 194 static files and 3 of 37 current function packages. The other 34 current packages, including most of the Knowledge Trial stack, remain available only on Netlify with recorded identities; historical ZIPs and recovery source candidates are not verified replacements. Preserve production functions on frontend-only releases. A broad backend rebuild needs parity verification first.

`npm run build` produces the exact published 194-file snapshot, including native STI Stats and price tracking, in `dist/`. `npm run build:preview` produces a separate candidate in `dist-preview/` using the same manifest plus explicit frontend overlays. The archived baseline files are historical rollback material; the current manifest uses the published source files. Deploy previews use only `netlify/preview-functions`, a public GET-only proxy without background jobs or writes. A review preview is not a production release package.

Use feature branches and previews for changes. Do not push preview-only VICTORY or Kelpie changes into a production synchronization commit. Record the published commit and deployment manifest after an authorized release; avoid unrecorded manual uploads.
