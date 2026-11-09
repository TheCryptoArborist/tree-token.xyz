# Tree Force ’89: same-domain mobile test release

Published test: https://tree-token.xyz/play/treeforce89/test/

The current guarded release is Mobile Test 4, deployment `6af21d8911a27d24c02264bc`. It preserves all
368 original static files, 46 backend functions/configurations and five
scheduled jobs. The initial release added 13 test-path files; Test 4 updates three of those files. Auto publishing is locked.

See `treeforce-mobile-live-test-status.md` for implementation, validation and
remaining physical-device acceptance checks, and
`treeforce-mobile-release-v4-20261109.json` for the preservation report.

This release uses the existing live game's same-domain wallet/session routes.
Do not substitute the feature branch's origin-relative new endpoint wiring.
Test payments and score writes are disabled; the original production game,
NFTree checks, existing payment backend and scores remain independent.

Future releases must capture the then-current protected snapshot, preserve
all existing files and backend records, stop on unexplained drift, and
validate before deliberate publication. Never use a standard repository
build to replace this preserved snapshot.
