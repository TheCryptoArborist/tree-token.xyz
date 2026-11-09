# Validation — Arcade check-ins and wallet recovery, 2026-11-07

Locked deploy 6aef900f8a7e9faa60134a40 is live at https://tree-token.xyz/play/. Source de444ea1d68702617ad7426b772ac35c921e25f1 was merged in PR #99. The release replaces only /play/index.html and /scripts/arcade-daily-growth.js, and adds /styles/arcade-checkin-refresh.css. All 357 static paths, 44 complete backend records, five schedules and protected configuration fingerprints were verified against the newly captured current baseline. No backend package was rebuilt.

Monthly check-ins now show four illustrated badge goals and larger attendance stamps. An unexpired signed arcade session survives temporary provider loss and restores only for the same wallet on return. Account changes, expiry and explicit sign-out still invalidate the session. Four integration checks and both GitHub workflows pass. The canonical live page renders all 30 November stamps and four rewards with no desktop overflow. Real wallet round-trip confirmation and narrow-screen visual testing remain outstanding. See production/arcade-refresh-release-20261107.json. Capture this live release before any future publication; older root snapshots remain historical.

---

