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

## Opening-wave pacing follow-up

The November 23 playtest feedback reported an opening lasting about ten seconds.
The 0.9 code scheduled seven enemies from 2 to approximately 17.5 seconds;
stationary hero/special and army/special simulations cleared it in 20–21 seconds.
The reported ten-second result was not reproduced.

Prototype 0.10 schedules ten opening enemies at 2, 6, 10, 15, 20, 25, 30, 35,
40 and 45 seconds of active battle. Completion still requires all scheduled
enemies to be defeated. There is no extra victory-delay timer. Normal summons
and specials cleared the revised wave in 47.68–49.60 simulated seconds across
320, 390, 844 and 1100px canvas widths; actual player time will vary. The normal
per-enemy seed reward means wave-one earnings rise from 86 to 110 seeds.
Pause, restart, early field clearing and unchanged wave-two cadence are tested.
Later waves, hero weapons, projectile origins and animation are unchanged.
Latest MystenLabs/skills README checked; this change uses no Sui APIs.

A separate 390×844 browser run completed the opening in 48.046 seconds of wall
time using normal UI summons/specials, with the unmodified animation loop, no
forced kills and no clock acceleration. It reached the wave-one camp with no
browser errors. See `production/tree-army-opening-walltime-20261123.json` and
`docs/tree-army-opening-cleared-phone-20261123.png`.

Published as Prototype 0.10 in deployment `6b0465140cb614081b5a0f52`, source
PR #298, workflow run `45211270718`. All candidate/canonical checks passed.
The hero weapon/projectile-origin audit remains outstanding.

## Hero weapon-origin follow-up (Prototype 0.11)

The user accepted the 0.10 opening timing and requested the weapon/hand-projectile
check next. Ordinary shots previously started at x±60, specials at x±72, while
the rendered muzzle was x±82. Target-distance clamping could pull a shot farther
back into the hand; full-length trails could also extend back through the sprite.

Both attacks now share the rendered muzzle's mirrored position, gait bob and
recoil. Hero rounds stay at their firing height instead of dropping through the
hand area, and trails cannot extend behind their emission point. An independent
firing timer drives both normal and special flashes; the normal attack cooldown
no longer determines whether a special has a firing effect. Close-range collision
sweeps still include the distance between the hero and muzzle, so nearby enemies
are not skipped. Archer projectile behavior is retained.

While moving, ordinary auto-fire selects only enemies ahead; stopping can aim at
either side. This removes the one-frame retreat-facing flip. It does not implement
the full stop-to-attack policy or melee yet. Existing damage/cooldowns, opening
schedule, approved troop artwork, and hero gait are unchanged. Full saw/fist
contact and revised weapon/attack artwork remain the next combat milestone;
this fix is not an accepted hero animation redesign.

Tests cover both facings, ordinary/special shots, close targets, height, separate
firing timers, pause/reset, retreat/stop aiming and the accepted opening timing.
Rendered right/left firing poses were inspected against the existing barrel.
Latest MystenLabs/skills README checked; no Sui APIs changed.

Published in deployment `6b046c3ccb8dfd3eb651353c`, source PR #300, release run
`45217408843`. All candidate/canonical checks passed. Diagnostic firing images
are `docs/tree-army-weapon-{right,left,special}-20261123.png`. The full melee and
weapon-art milestone remains open; the reported projectile-origin defect is fixed.

## Combat action milestone — Prototype 0.12

Implemented stop-to-attack, a separate close-range punch, and raised carry →
aim/fire → recovery using independent hero arms. Ordinary ranged hits resolve
at the firing moment with muzzle flash and impact; only the explicit Power Shot
uses the travelling special projectile. Walking cancels a pending normal attack.
Power Shot retains its own short cast and ten-second cooldown.

Machines now spin a separate saw and lift/sweep/recover their arm. Enemy damage
resolves 0.40 seconds after wind-up starts, with range and facing rechecked at
contact. Retreat can dodge. Hero punch contact is at 0.22 seconds; ordinary fire
at 0.24 seconds. These are Tree Army tuning choices, not measured original-game
frame timings. Reduced motion suppresses continuous blade spin, retaining the
action poses needed to read an incoming strike.

Reference audit: original 2011 GameFAQs FAQ 62546 and Sparky125/aod-rebuild at
commit ea762ba46f684356e9870844dc7ba25a06571a0e (unit.gd/main.gd). Used
stop-to-attack and delayed-strike concepts; no third-party code or original-game
assets copied. The fan rebuild is not authoritative proof of exact original
values. Latest MystenLabs skills README checked; no SDK changes.

Ten opening spawns remain at 2,6,10,15,20,25,30,35,40,45 seconds. Simulations clear
in 47.04–49.44 seconds. Logic tests cover both-facing dodge/punch, damage timing,
no melee projectile, no repeated recovery damage, walk cancellation, pause and
restart; desktop and three mobile browser sizes pass. A real-time mobile combat
recording exercises ranged/punch actions in both directions and retreat using
controlled stationary targets (diagnostic setup, unaccelerated animation loop).
See `tree-army-combat-mobile-20261123.webm`; normal UI first-wave timing is recorded
separately in `tree-army-combat-walltime-20261123.json`.

Hero gait still needs the user's visual acceptance; this milestone changes
combat arms and enemy telegraphs, not the existing leg rig. Dedicated boss art
and further balance progression remain later work.

Published in deployment `6b048faddcf2eb2d8c595f60`, source PR #302, release run
`45243887801`. Candidate and canonical checks passed at all four viewports.
The normal UI mobile run cleared in 47.786 seconds. See the production release
record and `tree-army-combat-live-phone-20261123.png` for verified delivery.

Reference links: [2011 gameplay guide](https://gamefaqs.gamespot.com/android/697753-army-of-darkness-defense/faqs/62546),
[fan rebuild source](https://github.com/Sparky125/aod-rebuild/tree/ea762ba46f684356e9870844dc7ba25a06571a0e).

## Bent-elbow carry correction — Prototype 0.13

The 0.12 gun arm rotated as one straight sprite, creating the user-reported
locked elbow held in the air. Split that existing atlas region at the elbow
in the renderer. The upper arm hangs alongside the torso; an independently
rotated forearm carries the gun lower, close to the body. Both joints blend
into aiming, and muzzle placement follows the same joint transforms.

Phone-size renders checked idle, walking left/right and aiming. An unaccelerated
mobile recording exercises both walking directions. See `tree-army-carry-phone-20261123.png`
and `tree-army-carry-mobile-20261123.webm`. Existing combat outcome/muzzle tests pass;
opening simulations still clear in 47.04–49.44 seconds. No art files, attack
rules, troop movement or opening schedule changed. This corrects the arm pose;
the separate existing leg-gait feedback remains unresolved. Latest MystenLabs
skills README checked; no SDK changes.

Published in deployment `6b04bdf56959e6a5452c7622`, source PR #304, release run
`45278903790`. Candidate and canonical game/cabinet checks passed at four
viewports. See the complete production carry-release record and
`tree-army-carry-live-phone-20261123.png`.
