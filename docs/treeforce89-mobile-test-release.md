# Tree Force ’89: same-domain mobile test release

Published test: https://tree-token.xyz/play/treeforce89/test/

The current guarded release is Mobile Test 6, deployment `6af222b0834c8837008aa4a7`. It preserves all
368 original static files, 46 backend functions/configurations and five
scheduled jobs. The initial release added 13 test-path files; Test 6 updates four of those files. Auto publishing is locked.

See `treeforce-mobile-live-test-status.md` for implementation, validation and
remaining physical-device acceptance checks, and
`treeforce-mobile-release-v6-20261109.json` for the preservation report.

This release uses the existing live game's same-domain wallet/session routes.
Do not substitute the feature branch's origin-relative new endpoint wiring.
Test payments and production score writes are disabled; local device saves are enabled; the original production game,
NFTree checks, existing payment backend and scores remain independent.

Future releases must capture the then-current protected snapshot, preserve
all existing files and backend records, stop on unexplained drift, and
validate before deliberate publication. Never use a standard repository
build to replace this preserved snapshot.
