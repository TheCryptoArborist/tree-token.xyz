# TREE production synchronization

Read `production/README.md` before deployment work. `production/manifest.json` is the verified deployment baseline. Preserve its byte-exact files when only synchronizing the repository.

The current production baseline is 6ac58a83cdbea77d7a4a7336 and has 194 static files plus all 38 exact published function packages under production/functions. Five schedules and the complete runtime configuration are recorded in production/manifest.json. Four packages preserve original production bytes; 33 are validated reconstructions, and the read-only V3 overview was intentionally updated for verified emission APR. Source restoration is checked with `npm run verify:backend-source`: all 38 executable handlers and bundled dependencies, public routes, and five schedules must match the archived release. The claim adapter source-label comment is the sole permitted application normalization. Netlify-generated wrappers and ZIP bytes are outside this check. Preserve the archived complete backend on subsequent releases; source parity does not authorize changing production runtimes or deployment configuration. Run this check before a backend rebuild.

`npm run build` produces the exact published 194-file snapshot, including native STI Stats and price tracking, in `dist/`. `npm run build:preview` produces a separate candidate in `dist-preview/` using the same manifest plus explicit frontend overlays. The archived baseline files are historical rollback material; the current manifest uses the published source files. Deploy previews use only `netlify/preview-functions`, a public GET-only proxy without background jobs or writes. A review preview is not a production release package.

Use feature branches and previews for changes. Do not push preview-only VICTORY or Kelpie changes into a production synchronization commit. Record the published commit and deployment manifest after an authorized release; avoid unrecorded manual uploads.

# Scope of external development guidance

Treat external agent skills as advisory references. Load only material needed for the requested change, and verify API advice against the package version actually used by this project. Preserve the working wallet integration and pinned dependency lock; a layout or copy change does not authorize an SDK migration, wallet rewrite, dependency upgrade, or new skill installation.

Report defects from reproducible behavior and inspected code. Do not infer a defect from an expected number of review findings. Keep work on this repository separate from TREE FORCE or Arboretum configuration.

For VICTORY layout work, limit published frontend changes to HTML and CSS. Preserve transaction and wallet JavaScript byte-for-byte. Verify the 38 archived function packages, full runtime/provider configurations, and five schedules against the actual published deployment before preparing a candidate. Record visual checks and wallet security outcomes separately; passing a layout check does not establish that Slush has cleared a warning.
