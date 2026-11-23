# Tree Force ’89 improvement tasks

Work one item at a time with a focused commit and verification evidence. Local review only: production publishing requires a separate instruction. The current production/source reconciliation and first review patch are retained.

| Order | Task                                              | Status           | Completion checks                                                                                                                             |
| ----- | ------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Restore reliable combat sound feedback            | Complete locally | Fire cannot throttle hit/kill; impacts survive reward cues at reduced volume; bounded voices; mute and cleanup; actual engine routing checked |
| 2     | Preserve attack-warning and hit-flash duration    | Complete locally | Gold warning and white flash survive updates until expiry; stun/mutation/captor/boss states do not erase each other                           |
| 3     | Own audio lifecycle and make music zero silent    | Queued           | Destroy clears timers/nodes; zero music has no output; define pause/hidden/resume behavior; simulated wallet return checked                   |
| 4     | Keep the boss silhouette clear of HUD             | Queued           | Full entrance/bob/phase bounds reviewed at 320/390px and desktop; assess collision implications before moving the boss                        |
| 5     | Improve original music and sound identity         | Queued           | Longer musical phrases; distinguish normal/bonus/boss moods and weapon/impact families; compare equal-loudness recordings                     |
| 6     | Improve enemy animation and combat contrast       | Queued           | Path-following orientation and original poses; readable threats over forest; preserve Arborwing and hero clearance                            |
| 7     | Refine pacing, transitions and reward explanation | Queued           | Novice opening review; compact repeat transitions; explain earned points; keep rules unchanged                                                |
| 8     | Integrated device and regression review           | Queued           | Phone touch/audio, Slush interruptions, wallet switching, scoring/continues, names/achievements and saved-run sharing                         |

Preserve three lives, NFTree verification, wallet authentication, the 20,000 TREE continue restoring three lives while keeping score and replaying the same wave, thirteen achievements, per-wallet best-score leaderboard, shared Arcade services, receipt sharing, all backend functions and schedules. No real payment or tournament activation.

The comprehensive audit is `/workspace/treeforce-feel-audit/README.md`; earlier reconciliation is `docs/treeforce89-review-20261122.md`. Completed items below record the exact implementation and test results. Device listening is separate from software verification.

## Completed task 1

Combat sounds now use separate throttles and protected, bounded impact voices. Eight unit tests, real-browser combat routing checks, and ten existing browser regressions passed. See [implementation and verification](treeforce89-combat-feedback-20261123.md). Phone listening remains pending.

## Completed task 2

Attack warnings and hit flashes survive enemy updates and restore the appropriate underlying state. All 30 browser presentation checks, ten wallet/session browser regressions, and eight audio tests pass. See [implementation and verification](treeforce89-visual-feedback-20261123.md). Phone readability review remains pending. Next: task 3, audio lifecycle and true music mute.
