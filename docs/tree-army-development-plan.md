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
2. **Hero combat — foundation published in Prototype 0.14.** Ordinary ranged attack, automatic saw melee with readable
   contact and bounded knockback, stable facing while retreating/target switching,
   and distinct power-shot behavior. Preserve the difference between ordinary
   attack cadence and special cooldowns.
3. **Hero animation — Prototype 0.15 walking refinement; acceptance pending.** Coordinated walking, idle, ranged and saw attacks.
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

## Metal fist → chainsaw hand — Prototype 0.14

New runs begin with a visible metal fist. Between waves, an 80-seed purchase
replaces it with a wrist-mounted chainsaw for the remainder of that run. The
first wave earns 110 seeds before other purchases. The shop prevents duplicate
charges and buying during battle; the equipped label persists into the next
wave. A fresh run restores the fist. The mobile control hint names the equipped
melee weapon. Small-phone upgrade lists scroll while Begin wave stays visible;
hidden camp controls and the tutorial shortcut stay hidden in other modes.

Fist: 35 + 10 per hero-strength level damage, 66 reach, contact at .22 seconds,
26-pixel push. Chainsaw: 58 + 14 per level damage, 88 reach, contact at .30 seconds,
42-pixel push and a .9-second attack cooldown. Its unique animation lifts,
cuts through, then recovers; moving before contact cancels the attack. These
are Tree Army tuning values. Regular ranged shooting and Power Shot remain.

Push eases over .14 seconds and interrupts ordinary enemy wind-ups. Tanks take
60% displacement. Bosses take 20% and keep their attack commitment, preventing
a boss stun lock. Damage resolves once at contact after checking live target,
range and facing. Killing hits do not push corpses.

Tests cover purchase affordability/duplicate/camp guards, persistence and reset,
reach/damage/contact, both-facing push, interruption, resistance, movement
cancellation and ranged fallback. Original opening spawn schedule/count remain;
opening simulations clear in 47.04–49.44 seconds. Browser checks now include a
normal-UI first-wave clear, earned-seed purchase and equipped second wave, as
well as four viewport checks and asset failure. The unaccelerated diagnostic
recording uses controlled high-health targets to inspect punch/cut animations.

Original art: `hero-melee.webp`. See `tree-army-melee-mobile-20261123.webm` and
the release screenshots. Hero leg-gait acceptance remains separate. Latest
MystenLabs skills README checked; no SDK changes or third-party game code copied.

### Right-fist correction before release

The user identified the initial metal-fist artwork as a left fist on the hero's
right arm. Release run `45326131972` was cancelled during verification, before
candidate creation or publication; live remained Prototype 0.13. Regenerated the
fist as the outside/back view of the right hand, preserving arm/wrist alignment
and the chainsaw mounting. Refreshed the diagnostic recording and contact images.
Combat rules, purchase behavior and the 0.14 delivery allowlist are unchanged.

Published in deployment `6b0514cbcf9d22003b6d784e`, source PRs #307/#308, release run
`45326594565`. The corrected right-fist artwork passed through the full release.
Candidate and canonical checks include a real first-wave earning/purchase/next-wave
flow. See the production melee release record and live equipped/shop screenshots.

## Hero walking refinement — Prototype 0.15

Lengthened the full stride from 80 to 112 world pixels without changing movement
speed (185 pixels/second). Cadence falls from about 4.6 to 3.3 steps per second.
The planted foot still cancels world travel, while the swinging knee lifts
further and the ankle flexes through toe-off and landing. Lower hips maintain
bent knees; body height now rises during passing and drops at contact.
Opposing carry-arm swings and a lifted, lightly swaying cape expose the rear
leg's passing motion. Both legs perform the same cycle half a stride apart.

Existing art files, right-hand orientation, combat rules, movement speed,
approved troop animation and opening spawns remain unchanged. Tests cover
contact/clearance, fixed bone lengths, mirrored phase, ankle continuity, stopping,
combat and progression. Opening simulations remain 47.04–49.44 seconds.
The unaccelerated 390×844 diagnostic recording exercises walking both ways
with fist and chainsaw; sampled phone poses were inspected. See
`tree-army-walk-mobile-20261123.webm`. Numeric tests and sampled poses are not
user acceptance of natural motion; that remains pending the next playtest.

Release scope is the playtest HTML only, with no new assets or backend rebuild.

Published in deployment `6b051af87755a75a0915a338`, source PR #310, release run
`45329775899`. Candidate and canonical checks passed. Visual acceptance of the
revised gait remains pending user playtest.

## Enemy approach and attack spacing — Prototype 0.16

Ordinary and heavy machines previously started wind-up at only 58 pixels
center-to-center (38 reach + 20 tolerance), regardless of their visual size.
This crowded the machine chassis into the target before the blade attack.
New center-to-center reach: ordinary machine 88, heavy machine 108, thorn runner
64 and boss 150 (formerly 58, 58, 58 and 100). Machine values account for the
forward blade at contact and target body width at each rendered scale.

Approach stops within four pixels of that bound; wind-up and strike use the
same reach. The .40-second wind-up and .85-second action remain. A retreat out
of reach still dodges, strikes resolve only once, and no forward creep occurs
during wind-up. Damage, speed, cooldowns, hero combat, artwork, troop movement
and the opening spawn schedule/count are unchanged. Earlier enemy contact does
slightly affect combat pacing: normal opening simulations clear in 49.04–49.68
seconds across the existing viewport scenarios.

Tests exercise actual spawned normal/heavy/runner/boss sizes, approaching from
both directions, stop distance, pre-hit telegraph, single contact, outside-range
rejection and retreat dodges. A full-speed mobile diagnostic uses high-health
enemies and disables hero auto-attacks to expose approach and strike timing;
see `tree-army-enemy-spacing-mobile-20261123.webm` and contact screenshots.
Release scope is playtest HTML only; preserve existing art and full live site.

Published in deployment `6b0525020b1bdef34dace0f1`, source PR #312, release run
`45334582545`. Candidate and canonical game/cabinet checks passed.

## Recorded walking feedback — Prototype 0.17

The user's November 24 recording rejects the 0.15 gait refinement. Close frame
samples show compressed legs, high knees and a disproportionately large torso.
The previous numeric foot-contact checks did not establish natural-looking motion.

Replace the independently rotated thigh/shin/boot pieces with eight connected
whole-leg illustrations. Near and far legs traverse all eight phases, four
poses apart, so both lead and trail. Knees recover behind the body and the
passing foot stays lower. Fixed source hip/ground anchors keep the illustrations
aligned; idle and reduced motion use planted poses. New leg height is about
85px; upper body scales to .88 with a -28px offset, giving fuller legs and a
smaller torso. The shared weapon muzzle follows that same transform.

Two paired-leg generation attempts were rejected for repeating one leading leg.
The accepted source method illustrates one complete leg across the full cycle,
then offsets the second leg. The final transparent atlas is original art,
converted to WebP without matte cleanup. Existing right fist, chainsaw, weapon
actions, troop walking, movement speed and enemy attack spacing remain.

Validation covers all eight poses on both legs, opposite phase, stable idle,
reduced motion, stopping, shared muzzle, combat, progression and enemy spacing.
Obsolete cutout bone-length/foot-IK tests were removed with the old renderer.
Opening simulations clear in 49.00–49.68 seconds. Diagnostic recordings run
unaccelerated with walks in both directions and both melee weapons; sampled
mobile and desktop poses are reviewed. Visual acceptance remains pending the
user's next playtest, not inferred from passing logic tests.

Publication replaces playtest HTML and adds only `hero-walk-legs.webp`.

Published in deployment `6b053183229603fcba59509e`, source PR #314, release run
`45339983272`. Candidate and canonical checks passed; natural-motion
acceptance remains pending the user's playtest.

## Arm proportions — Prototype 0.18

The user's November 24 screenshot shows thin arms relative to the chest.
The melee arm's rendered muscle width was too small, while the gun-side upper
arm was largely hidden inside the torso. Thicken the melee muscle perpendicular
to its length, with a smooth maximum 60% increase tapering to the unchanged
wrist. The corrected metal fist and chainsaw are rendered at their original
dimensions. Gun-side upper-arm thickness increases 35%; the lower forearm/grip
gains 30% depth below the weapon. The barrel pixels remain unchanged.

Move the gun-side shoulder from local x10 to x23 so the upper arm and elbow
show beside the torso. The shared muzzle calculation follows that shoulder,
keeping normal/special shot origins and flashes attached to the barrel.
No art files, leg poses, body scale, movement speed, damage, attack ranges or
cooldowns change. Existing combat, muzzle, progression and enemy-spacing tests
pass. Opening simulations clear in 49.04–49.72 seconds. Diagnostic phone renders
cover idle, both facings, walking and aiming, with fist and chainsaw checks.
Release scope is the playtest HTML only; no new assets or backend rebuild.
