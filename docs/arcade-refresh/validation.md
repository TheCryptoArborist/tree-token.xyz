# Arcade check-in refresh

Live baseline: 6aef85c5cebbdcc5d61af448 (356 static paths, 44 complete backend records, five schedules).
Preview: https://6aef8e7e76e9bc32c6dd4e3e--tree-token.netlify.app/play/

Only /play/index.html and /scripts/arcade-daily-growth.js are replaced; /styles/arcade-checkin-refresh.css is added. The full preview inventory, backend records, schedules and protected environment fingerprints were verified by the preserved-production release script. Production has not changed.

Four jsdom integration tests pass: restoration on initial load and after transient disconnect plus pageshow, account switch invalidation, expiry invalidation, and explicit sign-out. Run `node --test tests/arcade-return-session.test.mjs` with jsdom installed, or supply ARCADE_TEST_JSDOM. Desktop preview rendered 30 November stamps, four illustrated goals and no horizontal overflow (1348 CSS-pixel content width). Real extension-wallet round trip and narrow-screen visual testing remain outstanding.

The second local commit normalizes date-prefixed milestone IDs for earned reward styling; the current preview predates that one-line correction. A new plan is stored locally for that correction, but was not deployed after automatic review rejected GitHub publication. The final source is committed locally. GitHub push and production publication remain pending explicit approval; do not bypass that rejection.
