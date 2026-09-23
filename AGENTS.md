# TREE production synchronization

Read `production/README.md` before deployment work. `production/manifest.json` is the verified deployment baseline. Preserve its byte-exact files when only synchronizing the repository.

The current production baseline has exact copies of 189 static files and 2 of 37 current function packages. The other 35 current packages, including Knowledge Trial, remain available only on Netlify with recorded identities; historical ZIPs and recovery source candidates are not verified replacements. Preserve production functions on frontend-only releases. A broad backend rebuild needs parity verification first.

`npm run build` produces the unchanged published snapshot in `dist/`. `npm run build:preview` produces the native STI candidate in `dist-preview/`, overlaying four reviewed frontend files and adding two STI modules. The manifest retains published digests; archived baseline copies supply those four files. Deploy previews use only `netlify/preview-functions`, a public GET-only proxy without background jobs or writes. A review preview is not a production release package.

Use feature branches and previews for changes. Do not push preview-only VICTORY or Kelpie changes into a production synchronization commit. Record the published commit and deployment manifest after an authorized release; avoid unrecorded manual uploads.
