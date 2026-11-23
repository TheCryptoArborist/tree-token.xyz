# Task 5: original music and combat sound identity

Local review branch `dev/treeforce89-feedback-20261123`, following task 4 commit `c543f6c`. Nothing published. No gameplay rules, transactions, SDKs, backend functions or schedules changed.

## Change

The existing soundtrack repeats 16 steps at 150ms (2.4 seconds). `sound-identity.mjs` now supplies three original 128-step phrases (19.2 seconds each): normal canopy patrol, brighter bonus rounds, and a lower boss theme. Each contains eight distinct bars, rests, melody and bass movement. Challenge and windfall share the bonus mood. The active game state selects the mood; transitions restart its phrase on the next 150ms tick. Clearing the boss returns to the normal theme. Pause preserves the phrase cursor, and game destruction resets it. Brief previously scheduled note tails can overlap an encounter transition (at most about 0.285 seconds); there is no additional scheduler.

Player shots rise in pitch, enemy shots fall with a sawtooth tone, hits use a short triangular attack, and kills fall more deeply. Existing weapon frequencies distinguish standard/piercing/heavy/turbo shots. The sound mixer adds an overridable combat-tone method; its default behavior is unchanged, and the r10 subclass supplies the new timbres. Both retain two voices per effect and the task 1 caps/throttles. All 24 named event cues compare equal to the recovered source. No reference-game samples, sprites or melodies were imported.

All music layers duck to 35% during priority event cues. The new isolated music renders are quieter than the old loop at the same slider setting; comparison clips are separately loudness-matched. In-game balance remains a listening-review item. This change makes no claim that a human has approved the musical result.

## Verification

- Five score/identity tests passed: phrase length and diversity, rests and bounded density, encounter selection, transition/reset behavior, event ducking and distinct combat profiles.
- Eight mixer tests passed for the existing mixer and again for the new subclass, including impacts during reward cues, bounded voices and mute/cleanup.
- Thirteen real-browser lifecycle/transition checks passed, including actual challenge, windfall completion, normal, boss and clear states; zero-volume samples remain exactly zero, pause/interruptions silence audio, destruction closes the context and recreation works.
- Ten mocked-wallet browser regressions passed at 390px, including expiry recovery, wallet switching and receipt sharing.
- Six OfflineAudioContext samples rendered without clipping. They compare the previous music and combat sounds against the new normal, bonus, boss and combat profiles. These are source-backed isolated renders, not live-play recordings. The legacy melody and bass arrays are read from the emitted r9 engine.

See `treeforce89-sound-identity-browser.json`, `treeforce89-sound-wallet-browser-390.json`, and the [listening review](treeforce89-sound-review/index.html). Its clips are normalized near −26 LUFS with measured peak headroom; this does not alter game gain settings. Raw and normalized metrics are included.

Remaining review: subjective musical preference, dense-combat balance, phone speaker/headphone harshness and masking, and real iOS/Android/Slush audio return. The existing stage/weapon timing, identities, three lives, continue rules, achievements, per-wallet leaderboard and shared receipt workflow remain intact.

## Reproduce

```sh
node scripts/treeforce-local/prepare-sound-identity.mjs /workspace/treeforce-review/release/treeforce-baseline release/treeforce-sound-identity
node scripts/treeforce-local/serve.mjs release/treeforce-sound-identity 4184
node --test tests/treeforce-local/sound-identity.test.mjs tests/treeforce-local/combat-audio.test.mjs
TREEFORCE_SOUND_IDENTITY=1 node --test tests/treeforce-local/combat-audio.test.mjs
TREEFORCE_REVISION=r10 node tests/treeforce-local/audio-lifecycle-browser.cjs
node tests/treeforce-local/render-sound-review.cjs
python scripts/treeforce-local/normalize-sound-review.py /workspace/treeforce-feedback-evidence/sound-review docs/treeforce89-sound-review
```

Local practice: `http://127.0.0.1:4184/__local/practice?lab=1&revision=r10&scene=title`. Unranked, no payments or saves. The r10 frontend overlay retains the earlier review modules; it is not a complete production release package.
