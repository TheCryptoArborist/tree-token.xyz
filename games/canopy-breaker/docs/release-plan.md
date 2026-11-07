# Production activation and remaining acceptance

Target site: `aa62f324-b880-47d6-85b8-4ba0700ff5bf`, tree-token.xyz.
Game prefix: `/play/canopy-breaker/`.

Published November 7, 2026. Arcade deployment `6aef5d756e05b131e841a269`
activates the cabinet and proxies the game path to isolated production host
deployment `6aef5b8a4cf0018145d4fae5`. The saved-game migration is applied to
the host's production database and `BREAKER_ENABLED=true` enables gameplay.
The root release retains 302 static paths, all 43 existing function records,
five schedules, runtime configuration and site environment records. Only the
cabinet HTML and routing configuration changed; publication is locked.

The public username leaderboard is published as host deploy
`6aef64eb6cafc47f69d4fcdb`; the arcade deployment is unchanged. Its additive
`20261107180000_canopy_breaker_leaderboard` migration is applied to production.
All 108 automated tests and hosted leaderboard/access/health checks pass.
Peter reported successful gameplay and payment before this update. Real-holder
username enrollment, score-recovery confirmation, mobile wallet round trip and
physical NES controller acceptance still require user confirmation. See
`production-leaderboard-2026-11-07.json` for the current host release,
`production-score-navigation-2026-11-07.json` for the earlier score fix and
`production-release-2026-11-07.json` for the initial arcade integration.

## Original pre-launch plan (historical)

The following first-release plan records the state before this activation.
Its infrastructure and deployment steps are superseded by the release record
above; the real-wallet and physical-device acceptance work remains outstanding.

1. Establish authenticated deployment access. The connected Netlify tools can
   inspect the site but expose no deployment upload operation in this session;
   the executor has no authenticated Netlify CLI session. No deployment or
   database write was attempted.
2. Prepare an isolated candidate using the committed additive migration and
   Netlify's supported database-branch migration workflow. The six `breaker`
   tables must be the only schema additions. Do not modify existing game data.
3. Stage only the five files in `dist/` under the game prefix and the exact
   `breaker-access` package/compiler manifest. Add no new scheduled job.
   Do not deploy the downloadable mechanics-test HTML or local-test module.
4. Preserve every existing static path and backend package identity, full
   runtime/provider settings and all five schedules. Abort any candidate
   requesting an unrelated function upload or changing existing records.
   The root snapshot build and ordinary dashboard build are not release paths.
5. Keep `BREAKER_ENABLED` off until candidate DB, gate, private source routes,
   persisted run logic, payment history and payment recovery pass hosted
   negative and positive checks. Wallet rejection must never submit payment.
6. Have a real NFTree holder sign in and play; test one genuine 20,000 TREE
   restart from a defeated run and recover the same recorded payment without
   a second charge. Test a mobile wallet round trip. Automated synthetic
   signatures and mocked chain receipts do not establish these live outcomes.
7. Publish through the validated preservation workflow, record the exact source
   commit, package digests and deployment ID, and reverify all protected
   baseline identities. Add a cabinet to the latest live lobby only using a
   separately scoped edit based on that live file. Never overwrite the lobby
   with this checkout's historical copy.

Source and tests are complete for the first playable. Hosted activation and
real-wallet acceptance remain pending. Existing production was not modified.
