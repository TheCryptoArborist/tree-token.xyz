# TREE production synchronization

Read `production/README.md` before deployment work. `production/manifest.json` is the verified deployment baseline. Preserve its byte-exact files when only synchronizing the repository.

The current production baseline is 6ac55dae44d5c8fe2f469850 and has 194 static files plus all 38 exact published function packages under production/functions. Five schedules and the complete runtime configuration are recorded in production/manifest.json. Four packages preserve original production bytes; 34 are validated reconstructions. Current main source alone must not be rebuilt over production: recovered Challenge behavior and four restored function bundles are not fully represented in its normal build. Preserve the archived complete backend on subsequent releases. A broad backend rebuild needs parity verification first.

`npm run build` produces the exact published 194-file snapshot, including native STI Stats and price tracking, in `dist/`. `npm run build:preview` produces a separate candidate in `dist-preview/` using the same manifest plus explicit frontend overlays. The archived baseline files are historical rollback material; the current manifest uses the published source files. Deploy previews use only `netlify/preview-functions`, a public GET-only proxy without background jobs or writes. A review preview is not a production release package.

Use feature branches and previews for changes. Do not push preview-only VICTORY or Kelpie changes into a production synchronization commit. Record the published commit and deployment manifest after an authorized release; avoid unrecorded manual uploads.
