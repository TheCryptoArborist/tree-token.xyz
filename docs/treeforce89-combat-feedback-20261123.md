# Task 1: combat sound delivery

Local review branch: `dev/treeforce89-feedback-20261123`, based on reconciliation commit `d52928e`. Production was not published. The earlier review worktree is unchanged.

## Verified baseline and scope

The integrated runtime was reconciled to source commit `55cb3ee65600fc5014c8eeaaadcdc0f0206d9a8b` plus the subsequent renewal, sharing and mobile transforms. PR #112's mobile changes are already manually published; its open status does not indicate missing production features. The historical paid-continue branch belongs to the standalone repository. See `treeforce89-review-20261122.md` for the baseline inventory and provenance. This patch layers onto that hash-pinned baseline and the existing r5 root/share-layout fixes.

The game already has 24 synthesized event motifs, weapon tones and music. The reproduced defect was shared throttling: a shot could suppress an impact 20ms later, and reward cues suppressed ordinary impacts. This patch retains the motifs, frequencies and gameplay and routes six combat call sites through independently throttled fire, enemy-fire, hit and kill categories. Hits and kills get up to four short voices inside a ten-voice ceiling; reward cues reduce their gain to 55% rather than suppressing them. Crowded audio remains bounded and can still drop events at capacity. Late oscillator callbacks can no longer remove unrelated voices after preemption.

Recovered editable audio source lives in `treeforce89/frontend/game/audio-cues.mjs`. `prepare-feedback.mjs` checks exact runtime anchors and emits a separate r6 frontend overlay. Original assets remain present. This is not a complete deployable site and must not replace the backend/function/schedule inventory. No Galaga samples, sprites or music were copied.

## Verification

- Eight focused Node tests passed: independent throttles, impact during upgrades, priority handling, bounded voices, effects mute, safe callbacks, reuse and existing motif inventory.
- Chromium executed the emitted r6 engine with a running AudioContext. Actual fire, enemy-fire, nonlethal hit and kill methods each reached their intended category and were accepted. Fire plus impact and upgrade plus kill were both accepted; no page errors.
- Ten existing browser checks passed at 390px: one app root before/after lazy GraphQL, verified run retention, zero score/three lives, temporary disconnect, expiry recovery, failed-save retry and receipt handoff, share-card proportions, explicit disconnect, separate wallet/profile.
- Wallet/API checks use mocks and external requests are blocked. These do not prove real Slush or mainnet behavior. No real payment was made.

Evidence: `treeforce89-combat-audio-checks.json` and `treeforce89-feedback-browser-checks-390.json`.

## Local review

From this worktree, with the reconciled baseline available:

```sh
node scripts/treeforce-local/prepare-feedback.mjs /workspace/treeforce-review/release/treeforce-baseline release/treeforce-feedback
node scripts/treeforce-local/serve.mjs release/treeforce-feedback 4180
node --test tests/treeforce-local/combat-audio.test.mjs
node tests/treeforce-local/combat-audio-browser.cjs
```

Practice URL: `http://127.0.0.1:4180/__local/practice?lab=1&revision=r6&scene=title`. This harness is local, unranked, and disables payments and saves.

Still needed: listen on phone speakers and headphones, check perceived balance in dense combat, and test mobile audio unlock/background/Slush return on actual devices. Audio scheduling success is not a subjective listening verdict. Music lifecycle/true zero volume, warning flashes and boss/HUD clearance remain separate queued tasks.
