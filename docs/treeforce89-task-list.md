# Tree Force ’89 improvement tasks

Work one item at a time with a focused commit and verification evidence. Local review only: production publishing requires a separate instruction. The current production/source reconciliation and first review patch are retained.

| Order | Task                                              | Status           | Completion checks                                                                                                                             |
| ----- | ------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Restore reliable combat sound feedback            | Complete locally | Fire cannot throttle hit/kill; impacts survive reward cues at reduced volume; bounded voices; mute and cleanup; actual engine routing checked |
| 2     | Preserve attack-warning and hit-flash duration    | Complete locally | Gold warning and white flash survive updates until expiry; stun/mutation/captor/boss states do not erase each other                           |
| 3     | Own audio lifecycle and make music zero silent    | Complete locally | Destroy clears timers/nodes; zero music has no output; define pause/hidden/resume behavior; simulated wallet return checked                   |
| 4     | Keep the boss silhouette clear of HUD             | Complete locally | Full entrance/bob/phase bounds reviewed at 320/390px and desktop; assess collision implications before moving the boss                        |
| 5     | Improve original music and sound identity         | Complete locally | Longer musical phrases; distinguish normal/bonus/boss moods and weapon/impact families; compare equal-loudness recordings                     |
| 6     | Improve enemy animation and combat contrast       | Complete locally | Path-following orientation and original poses; readable threats over forest; preserve Arborwing and hero clearance                            |
| 7     | Refine pacing, transitions and reward explanation | Complete locally | Novice opening review; compact repeat transitions; explain earned points; keep rules unchanged                                                |
| 8     | Integrated device and regression review           | Queued           | Phone touch/audio, Slush interruptions, wallet switching, scoring/continues, names/achievements and saved-run sharing                         |

Preserve three lives, NFTree verification, wallet authentication, the 20,000 TREE continue restoring three lives while keeping score and replaying the same wave, thirteen achievements, per-wallet best-score leaderboard, shared Arcade services, receipt sharing, all backend functions and schedules. No real payment or tournament activation.

The comprehensive audit is `/workspace/treeforce-feel-audit/README.md`; earlier reconciliation is `docs/treeforce89-review-20261122.md`. Completed items below record the exact implementation and test results. Device listening is separate from software verification.

## Completed task 1

Combat sounds now use separate throttles and protected, bounded impact voices. Eight unit tests, real-browser combat routing checks, and ten existing browser regressions passed. See [implementation and verification](treeforce89-combat-feedback-20261123.md). Phone listening remains pending.

## Completed task 2

Attack warnings and hit flashes survive enemy updates and restore the appropriate underlying state. All 30 browser presentation checks, ten wallet/session browser regressions, and eight audio tests pass. See [implementation and verification](treeforce89-visual-feedback-20261123.md). Phone readability review remains pending.

## Completed task 3

Music zero is silent; pause/interruption stops audio, and destruction releases the scheduler, nodes, context and listeners. Twelve browser lifecycle checks, ten wallet/session regressions and eight audio tests pass. See [implementation and verification](treeforce89-audio-lifecycle-20261123.md). Real-phone audio unlock and Slush return checks remain pending.

## Completed task 4

Boss movement and phase banners now clear the HUD. Before/after entrance and four-phase bounds checked at 320/390/1000px, screenshots inspected, and ten browser regressions passed. See [implementation, geometry tradeoff and verification](treeforce89-boss-clearance-20261123.md). Real-phone dodge-space review remains pending.

## Completed task 5

Three original 19.2-second musical phrases and distinct combat timbres are implemented. Five score tests, both eight-test mixer suites, thirteen browser audio checks and ten wallet/session regressions passed. See [implementation and verification](treeforce89-sound-identity-20261123.md) and [matched-volume listening samples](treeforce89-sound-review/index.html). The user approved the musical direction; phone/dense-combat listening remains pending.

## Completed task 6

Entry/dive facing follows existing curves, ordinary bats and mutated wasps have wing poses, and combat foreground contrast is improved. Four focused tests, 81 unchanged geometry samples, 30 warning/flash checks and ten wallet/session regressions passed. See [implementation and verification](treeforce89-combat-visuals-20261123.md). Phone motion/readability/performance review remains pending. The user approved the visual previews.

## Completed task 7

Later clear cards and repeat bonus introductions are shorter; first-time teaching and combat timing are preserved. Result cards explain wave-attempt points and separate target earnings from completion bonuses without changing scores. Timing, pause, reward/idempotence and text bounds pass at 320/390/1000px, plus ten wallet/session regressions. See [implementation and verification](treeforce89-round-presentation-20261123.md). Next: task 8, integrated device and regression review.
