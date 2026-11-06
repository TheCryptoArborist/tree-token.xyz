# Pending live activation

Target site: `aa62f324-b880-47d6-85b8-4ba0700ff5bf`, tree-token.xyz.
Game prefix: `/play/canopy-breaker/`.

Read-only discovery observed ready production deploy
`6aed035fb385f2f7869ac7f8` on November 5, 2026. This observation is not a verified
complete preservation baseline. Refresh the current publication and capture
its complete static inventory, backend records, runtime/provider configuration,
site environment fingerprint and all five schedules before preparing a release.
Prior work reported a baseline mismatch; do not use stale package counts or
the historical root build manifest as the current release.

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
