# Task 8: integrated local review

The combined r13 candidate passes all twelve verification jobs. This pass also reproduced and fixed a toolbar input defect: a single Auto Fire click reached both the DOM button and Phaser's window mouse handler, toggling twice and leaving the setting unchanged. The r12 failure and r13 passing checks are retained in [the evidence directory](treeforce89-integrated-20261123/).

Work remains local on `dev/treeforce89-feedback-20261123`, following task 7 commit `fc3d6ed`. The user approved the task 5 musical direction and task 6/7 visual previews. No production publication, real payment, dependency migration, access/pricing change or tournament activation occurred.

## Verified baseline

The canonical game remains https://tree-token.xyz/play/treeforce89/. Its entry HTML still references `index-share-r4.js`; fresh hashes of that entry module, `arcade-renewal-r3.js`, `graphql-mobile-r1.js` and `mobile-r1.css` match the captured production baseline. See [live hashes](treeforce89-integrated-20261123/live-hashes.json).

The earlier [source reconciliation](treeforce89-review-20261122.md) still applies: neither repository's main branch alone reproduces the integrated game. Editable source was recovered from integration commit `55cb3ee65600fc5014c8eeaaadcdc0f0206d9a8b`, with the published mobile, renewal and sharing layers retained. PR #112's open status does not mean its manually published mobile changes are absent. Historical `feature/tree-paid-continue` belongs to the standalone `TheCryptoArborist/treeforce89` repository, at `faba1b3df2b766dea5b7da242cbd30327d05b2fa`.

The r13 overlay retains all 22 captured non-entry-HTML files byte for byte and adds uniquely named review modules. [Preservation evidence](treeforce89-integrated-20261123/preservation.json) records the final generated hashes and earlier overlay layers. The entry HTML selects the review modules. This is a partial static review package, not a complete deployable site.

The last recorded live inventory was 57 functions and five schedules. This pass rechecked selected live frontend assets, not the complete backend inventory. No backend or schedule was changed. Any later authorized release must capture and preserve the complete current inventory rather than deploying this local overlay alone.

## Bounded fix

`touchbar-input.mjs` stops toolbar events from bubbling into Phaser's global input handlers while preserving the buttons' own handlers and default browser activation. Pointer/touch release, cancel and keyboard release also clear prior held game input. Listeners are detached on game destruction. The build script applies this boundary to the existing mobile toolbar; no scoring, authentication or payment rules change.

The regression test checks mouse click, touch tap and keyboard activation toggle Auto Fire exactly once. It also checks that keyboard Fire does not accidentally invoke Shield, releasing over the toolbar clears a prior canvas drag, and interruption cancels held fire and pauses play. The same test fails against r12 and passes against r13.

## Verification

All twelve jobs in [suite-results.json](treeforce89-integrated-20261123/suite-results.json) passed. Browser checks use local Chromium with external requests blocked; application endpoints and wallets are mocked. They are not real Slush or on-chain tests.

| Area | Verified result | Remaining limitation |
| --- | --- | --- |
| Audio and presentation | 17 focused unit tests plus 8 IdentityMixer tests; 13 browser audio checks, actual engine cue routing, 30 enemy-feedback checks, boss/hero bounds, combat visuals and round presentation | Physical speaker/headphone listening, sustained phone performance and motion comfort |
| Session recovery | Temporary disconnect and expiry/same-wallet recovery retain the mounted run; explicit disconnect clears identity | Real Slush app switching and native wallet interruptions |
| Wallet switching and saves | Ten application regressions each at 320/390/1280px; second wallet gets a separate run/profile; failed save retries through receipt handoff | Live account persistence was not written |
| Controls and tutorial | First mobile guide pauses play; five hero growth stages fit; release/cancel, Auto Fire, Shield and blur behavior pass | Thumb reach, guide comprehension and physical touchscreen behavior |
| Scoring and continues | Emitted game restores a synthetic run at score 43,210, wave index 4, three lives, same seed/run ID and achievement counters; next individual run starts at zero | Checkout is mocked; no real 20,000 TREE transaction |
| Names, achievements, paid contracts | 31 recovered-source tests pass, covering pilot validation, thirteen achievements, gameplay/snapshots, database rules and payment recovery/cancellation | Source contract tests supplement the emitted-game checks; they do not certify the live backend |
| Saved-run sharing | Existing failed-save retry, receipt handoff and share-card proportions pass at three widths | Native phone share sheet/download and real saved receipt review |

Existing paths were retained rather than recreated: wallet authentication/NFTree verification, per-wallet best scores, thirteen achievements, paid-continue contracts and shared Arcade receipt sharing. The previous tasks' audio, visuals and transition changes remain together in r13. Task 4's boss movement still shortens straight projectile travel by approximately 0.21 seconds; assess dodge room on a phone.

The new control test was rerun after formatting/rebuilding; `controls-final.log` records that check. Other full-suite results precede formatting only. Screenshots show forced unranked encounters, not complete human playthroughs.

## Actual image previews

- [Combat at 390px](treeforce89-integrated-20261123/treeforce89-combat-r13-390.png)
- [Boss at 390px](treeforce89-integrated-20261123/treeforce89-boss-r13-390.png)
- [Wave-clear card at 390px](treeforce89-integrated-20261123/treeforce89-wave-clear-r13-390.png)
- [Challenge result at 390px](treeforce89-integrated-20261123/treeforce89-challenge-r13-390.png)

## Local reproduction

From this worktree:

```sh
node scripts/treeforce-local/prepare-integrated-review.mjs /workspace/treeforce-review/release/treeforce-baseline release/treeforce-integrated-review
node scripts/treeforce-local/serve.mjs release/treeforce-integrated-review 4187
node tests/treeforce-local/integrated-review.cjs /workspace/treeforce-integrated-r13
```

Practice: http://127.0.0.1:4187/__local/practice?lab=1&revision=r13&scene=title

This address is workspace-local, not a public phone preview. Practice is unranked with no payments or saves. Tests require Playwright and `/usr/bin/chromium`, with Playwright resolvable through the workspace's `NODE_PATH` or installed dependencies.

The 31 source tests were run from `/workspace/treeforce-source` with:

```sh
node --test tests/treeforce89-achievements.test.mjs tests/treeforce89-chapters.test.mjs tests/treeforce89-gameplay.test.mjs tests/treeforce89-paid-client.test.mjs tests/treeforce89-database.test.mjs
```

## Remaining real-phone review

Task 8 remains open for device testing on iOS Safari and Android Chrome:

1. Background/return through Slush, expire a session, cancel a signature and reconnect the same wallet. Check that the run stays paused, held input clears, audio recovers after a gesture and only one game is mounted.
2. Explicitly disconnect and switch wallets; confirm the second profile and run stay separate. Check save retry and an existing receipt without making a payment.
3. Play through all growth stages and a boss encounter; assess thumb controls, hero visibility, warning/wing readability, pause/resume, tutorial wording and dodge room.
4. Listen during dense combat, mute/unmute and background/return. Check sustained performance on a lower-powered device.
5. Open an existing saved-run receipt and exercise the native share/download workflow.

Real-payment testing and production publication remain outside this authorization. The local changes and regression evidence are ready for review; device checks have not been marked complete.
