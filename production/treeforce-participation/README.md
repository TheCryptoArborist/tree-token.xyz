# TREE FORCE ’89 Daily Growth participation

This directory archives the exact revised `arcade-growth` function package for
the first-wave participation release. It is not a public static directory.

- Package SHA-256: `ac313c8da92e4c5cb2fde6014f1fc5dbd917ebe49c94fab05e5e70162f1bef57`
- Runtime: Node.js 22, streaming invocation.
- Route: `GET` and `POST /api/arcade-growth`.
- New action: `POST ?action=treeforce-play`, with the existing TREE FORCE bearer
  and a body containing only `runId`.

The browser reports the first wave of a fresh authenticated run. The handler
reads the existing isolated game session, rechecks NFTree ownership and that
session, then atomically records participation in Daily Growth. This confirms
authenticated participation reporting; it is not server-verified gameplay or a
completed-run result. The existing TREE FORCE handler and database are not
modified by this release.

Credit is limited to one daily quest per wallet and UTC day. The original run
identity remains unique, so retries and paid continues return its original
receipt instead of assigning a new day. The monthly Passport retains its three
required Garden games; TREE FORCE supplies an optional participation stamp.

Build inputs and package metadata are recorded in
`docs/treeforce-participation-function.json`. Native frontend source pins and
byte-exact baseline reproduction are recorded in
`docs/treeforce-participation-frontend.json`. Production schema evidence is in
`docs/treeforce-participation-database.json`. The release script preserves all
237 previous public paths, all 39 other complete function records, and all five
schedules. The final deployment inventory is recorded in
`docs/treeforce-participation-published.json` after publication.

The root dependency lock and wallet/payment modules remain unchanged. The
additional database driver uses the exact isolated integration dependency lock
under `vendor/arcade-growth-backend`. Do not run a full backend rebuild or an
ordinary root-directory Netlify deploy to release this change.
