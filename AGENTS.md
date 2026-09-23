# TREE production synchronization

Read `production/README.md` before deployment work. `production/manifest.json` is the verified deployment baseline. Preserve its byte-exact files when only synchronizing the repository.

The current production baseline has exact copies of 193 static files and 2 of 37 current function packages. The other 35 current packages, including Knowledge Trial, remain available only on Netlify with recorded identities; historical ZIPs and recovery source candidates are not verified replacements. Preserve production functions on frontend-only releases. A broad backend rebuild needs parity verification first.

`npm run build` produces the exact published 193-file snapshot, including native STI Stats and price tracking, in `dist/`. `npm run build:preview` produces a separate candidate in `dist-preview/` using the same manifest plus explicit frontend overlays. The four pre-STI archived files are historical rollback material; the current manifest uses the published source files. Deploy previews use only `netlify/preview-functions`, a public GET-only proxy without background jobs or writes. A review preview is not a production release package.

Use feature branches and previews for changes. Do not push preview-only VICTORY or Kelpie changes into a production synchronization commit. Record the published commit and deployment manifest after an authorized release; avoid unrecorded manual uploads.
