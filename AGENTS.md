# TREE production synchronization

Read `production/README.md` before deployment work. `production/manifest.json` is the verified deployment baseline. Preserve its byte-exact files when only synchronizing the repository.

The current production baseline has exact copies of 166 static files and 30 of 35 function packages. Five Knowledge Trial function packages remain available only on Netlify with recorded digests; recovery source candidates are not verified replacements. Preserve production functions on frontend-only releases. A broad backend rebuild needs parity verification first.

Use feature branches and previews for changes. Do not push preview-only VICTORY or Kelpie changes into a production synchronization commit. Record the published commit and deployment manifest after an authorized release; avoid unrecorded manual uploads.
