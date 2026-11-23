# Tree Army — core gameplay task list

The November 23 audit and the user's subsequent direction establish Army of
Darkness: Defense's core mechanics as the reference. Tree Army keeps its forest
characters and setting. The earlier free-roaming courtyard direction is superseded.

1. **Battlefield and controls — published in Prototype 0.9; release checks passed.**
   One horizontal battle lane for the hero, allies, and enemies; labeled Left/Right
   hold controls; A/D and left/right arrows; release to stop. Summoning and specials
   stay visible on mobile. The tutorial explains automatic ranged attacks and
   distinguishes special abilities from normal fire. Cannon is labeled Power Shot
   without changing its damage or cooldown. Vertical keyboard and battlefield-drag
   movement are removed. Pointer cancellation/lost capture, pause, focus loss and
   resize clear holds. Separate pointer IDs preserve movement while a second finger
   summons or uses a special. Opposing directions cancel; releasing one preserves
   the other. Focused move buttons also support holding Space/Enter.
2. **Hero combat — next.** Ordinary ranged attack, automatic saw melee with readable
   contact and bounded knockback, stable facing while retreating/target switching,
   and distinct power-shot behavior. Preserve the difference between ordinary
   attack cadence and special cooldowns.
3. **Hero animation — pending.** Coordinated walking, idle, ranged and saw attacks.
   Review full-speed motion before publication; the existing cutout animation is
   not considered visually accepted by the user.
4. **Representative wave and balance — pending.** Meaningful hero positioning,
   sap income, frontline/ranged/tank roles and special timing.
5. **Mobile playtest and acceptance — pending.** Device feedback and full-speed
   recordings in addition to browser tests. Do not equate numeric gait tests or
   layout checks with acceptance of natural motion.
6. **Progression expansion — after the foundation passes.** Persistent earned
   upgrades, additional troops/enemies/defenses, waves, bosses and endless mode.

## Task 1 boundaries and checks

This step changes the battlefield movement/input foundation and instructions.
It does not claim to solve the hero's walk, implement melee, fix combat-facing
policy or match the original's firing cadence. Those remain separate tasks above.
The current automatic ranged attack still fires while moving when a target is
in range; the tutorial accurately describes the current behavior.

Validation covers lane invariants for all actors, ignored vertical keys, left/right
movement and gait distance, release/cancel/lost capture, opposing pointers,
pause/focus/resize cleanup, normal ranged fire without special input, enemy melee,
and a real first-wave win with normal troops/abilities. Browser checks cover
1440×1000, 390×844, 320×568 and 844×390, tutorial copy, control/label fit, keyboard
button activation, trusted touch movement, second-finger summoning and Power Shot,
cancellation, pause, abilities and failed artwork handling.

Release scope: replace only `/play/tree-army/test/index.html`, based on the
published 0.8 SHA1 `9533798a3c190a919ad9b95146ba96331b5ca401`. No new assets,
backend packages or dependencies. Preserve the freshly captured complete live
inventory, 59 backend/provider records, five schedules and protected configuration.
Latest MystenLabs/skills README checked; no Sui API change applies to this step.

## Task 1 published result

Published November 23, 2026 at 09:26:16 America/Chicago. Source PR #296,
commit `8311f08cf61771503d6dc19464fc0fa4a36164bc`, deployment
`6b045ada195938dd6638275a`, workflow run `45204472155`.
Candidate and canonical game/cabinet browser checks all passed. The live phone
screenshot was inspected. The release preserved 681 unrelated static paths,
59 complete backend/provider records, five schedules and protected configuration.
Task 2 is next; task 3 still includes the unaccepted hero walking animation.
