# Task 3: audio ownership and true music mute

Local review on `dev/treeforce89-feedback-20261123`, following task 2 commit `eb98ba8`. The hash-pinned integrated baseline and both prior fixes are retained. No production publish, backend/SDK changes, real payment or rule changes.

## Reproduced cause and change

The existing soundtrack used an unowned module interval, and music oscillators had no cleanup tracking. Destroying a Phaser game left the interval running. Its envelope also clamped zero volume to 0.001, producing a small audible signal instead of silence.

`audio-lifecycle.mjs` owns the soundtrack scheduler, active music nodes, interruption listeners and game association. It uses the original melody, bass, rhythm, 150ms interval and nonzero envelopes. Music volume zero immediately clears the timer and active music nodes; sound effects remain independently available. Raising the volume restores the scheduler when playback is allowed. Setting SFX volume to zero stops active SFX voices.

Pause silences music and SFX. Blur or a hidden document also pauses the active game and silences audio. Focus/visibility return does not resume the run automatically; the existing Resume action restores playback. The guide uses the same paused state. Browser AudioContext resume rejections are handled, and subsequent user interaction can recover a suspended context.

Destroy immediately removes this game's listeners, stops voices and scheduler, closes the custom context and clears its reference. Recreating the game gets a fresh context. Cleanup is idempotent and bound to its owning game so a stale destroy event cannot stop its replacement. The decorative home-only game does not claim audio ownership. No wallet authentication/session code is modified.

`prepare-audio-lifecycle.mjs` emits a separate r8 frontend overlay with exact-anchor checks. Original and earlier review assets remain available. This overlay is not a complete production release package; all live backend functions and schedules must be preserved for any separately authorized release.

## Verification

Twelve Chromium lifecycle checks passed with real Web Audio:

- User-gesture start, volume restoration, independent SFX, master sound toggle and suspended-context recovery.
- With music and SFX volume zero, sampled peak was exactly 0, new oscillators were 0, music voices were 0 and no scheduler remained.
- Pause/Resume, simulated wallet blur/focus, hidden/visible return, run retention, destruction and recreation.
- Destroyed state had no owner, scheduler, music voices or SFX voices; the context was closed. No page errors.

All eight task 1 audio tests also pass. See `treeforce89-audio-lifecycle-checks.json`. All ten broader mocked-wallet regressions passed at 390px, including expiry recovery, wallet switching and save-retry receipt sharing. Results are recorded separately in `treeforce89-audio-lifecycle-browser-390.json`.

These checks do not substitute for real Slush or phone audio testing. Remaining device checks: iOS/Android browser audio unlock after wallet return, app switching/screen lock, speaker/headphone balance, and whether stopping a currently playing note produces an objectionable click. No soundtrack redesign is included; that remains task 5.

## Local review

```sh
node scripts/treeforce-local/prepare-audio-lifecycle.mjs /workspace/treeforce-review/release/treeforce-baseline release/treeforce-audio-lifecycle
node scripts/treeforce-local/serve.mjs release/treeforce-audio-lifecycle 4182
node tests/treeforce-local/audio-lifecycle-browser.cjs
```

Practice: `http://127.0.0.1:4182/__local/practice?lab=1&revision=r8&scene=title` (local, unranked, no payments or saves).
