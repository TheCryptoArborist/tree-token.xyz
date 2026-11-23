# Task 2: attack warnings and hit flashes

Prepared locally on `dev/treeforce89-feedback-20261123`, following task 1 commit `2d074b9`. This retains the previously reconciled integrated baseline and r6 audio fix. No production publication, wallet/SDK changes, backend changes or real payments.

## Reproduced behavior

The previous engine clears ordinary enemy tint during every `updateEnemies()` call. This erases gold dive warnings and white hit flashes. Boss phase colors also overwrite flashes. Independently, each hit schedules an unconditional clear, so an older hit can erase a newer flash. Transformed enemies can retain stale transient colors. Captor rescue gold, corrupted-Arborwing magenta and challenge target gold are likewise lost through unconditional clearing.

## Change

`treeforce89/frontend/game/enemy-feedback.mjs` resolves enemy presentation in this order: active hit flash, shield stun, dive/rescue warning, boss phase, corrupted identity, challenge target, ordinary texture. Mutation keeps its existing wasp texture. The brief white flash returns to the applicable underlying color when it ends.

Dive warnings are cleared by the existing dive-start callback. Hit flashes use the original scene timers (55ms ordinary, 100ms boss), with an identity token so an older callback cannot clear a newer flash. Both timers continue to respect Pause/Resume. Existing 450/650ms warning durations, attack paths, movement, collision, damage, scoring and rescue eligibility are unchanged.

`prepare-visual-feedback.mjs` verifies five exact anchors in the hash-pinned runtime and emits separate r7 modules, retaining r6 and original assets. This is a frontend review overlay, not a complete production release package. Preserve the complete live backend and schedules in any separately authorized future release.

## Verification

The same Chromium test ran against r6 and r7. It executes actual scene methods and advances the actual Phaser clock deterministically; it is not a full human playthrough.

- All 30 r7 presentation checks pass: 450/650ms warnings, exact flash boundaries, overlapping hits, restoration of warning/stun/captor/boss colors, mutation texture, corrupted identity, challenge gold, Pause/Resume and safe callbacks after destruction.
- The r6 comparison reproduces the defects; see the before/after JSON evidence.
- All ten existing browser regressions pass at 390px, including simulated expiry, disconnect/reconnect, separate wallets/profiles, score/lives initialization, save retry and receipt handoff. No page errors.
- All eight task 1 audio tests still pass.

Evidence: `treeforce89-visual-feedback-before.json`, `treeforce89-visual-feedback-after.json`, and `treeforce89-visual-feedback-browser-390.json`.

Phone-only follow-up remains: judge warning/flash readability during real touch play, especially dense combat and bright screen conditions. Synthetic wallet checks do not establish real Slush behavior. Other queued tasks, including music lifecycle/true mute and boss/HUD placement, are not part of this patch.

## Local review

```sh
node scripts/treeforce-local/prepare-visual-feedback.mjs /workspace/treeforce-review/release/treeforce-baseline release/treeforce-visual-feedback
node scripts/treeforce-local/serve.mjs release/treeforce-visual-feedback 4181
node tests/treeforce-local/enemy-feedback-browser.cjs
```

Practice: `http://127.0.0.1:4181/__local/practice?lab=1&revision=r7&scene=title` (local, unranked, no payments or saves).
