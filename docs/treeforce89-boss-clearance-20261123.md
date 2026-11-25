# Task 4: boss clearance beneath the HUD

Local review branch `dev/treeforce89-feedback-20261123`, following task 3 commit `933a185`. The reconciled integrated baseline and earlier patches are retained. No production publication, backend/SDK changes, payments or access/pricing changes.

## Reproduced overlap and focused fix

The settled boss previously bobbed around y=120, from y=95 to 145. Its 112×96 sprite at 1.08 scale reached y=43.16 at the top, intersecting the main HUD (bottom 68) and boss health display (bottom 97 including stroke). Temporary phase banners at y=176 also covered it.

Three exact runtime edits now set the boss's entrance destination to y=180, its bob center to y=180, and its notices to y=300. Horizontal movement, ±25 vertical bob, art, scale, hitbox dimensions, phase colors, health, score rules, attack speed, five-shot fan and 1150ms firing threshold are unchanged.

The complete settled sprite stays within y=103.16–256.84, leaving at least 6.16 logical pixels below the health display. Phase damage marks also remain clear. The phase notice sits below the sprite. The existing 2500ms entrance still comes from y=-90 behind the HUD; it is deliberately not fully visible while entering, and clears the HUD before settling. This patch does not attempt to show the entire offscreen entrance sprite.

## Gameplay implication

This is a geometry change, not merely a cosmetic translation: the boss sprite and collision body move together, and shots still originate from the boss. At wave 10, the unchanged projectile speed is 217×1.315 = 285.355 logical pixels/second. Moving the settled boss down 60 pixels reduces straight-down projectile travel time by about 0.210 seconds and also shortens player-shot travel distance. Diagonal trajectories vary. The body retains its existing subpixel center offset (−0.84, −0.28) and dimensions 103.68×88.56; no collision resizing or detached visual offset was introduced. Real play should judge the resulting dodge margin before production publication.

## Verification

Chromium compared r8 and r9 at viewport widths 320, 390 and 1000:

- Actual Phaser entrance tween sampled at 0/500/1000/1500/2000/2500ms.
- Each of four damage phases sampled every 10ms over 20 seconds, including horizontal/vertical sprite bounds and damage marks; analytical extrema agree with samples.
- Before-build overlap reproduced; after-build clearance passed at all three widths.
- Collision dimensions and offsets retained, 24 HP retained, five-shot fan and wave-10 projectile speed retained. The actual update method fires after, not at, the 1150ms threshold.
- Screenshots inspected at all three widths. Tests force an unranked boss encounter; they do not represent a complete playthrough or real phone session.
- Ten existing mocked-wallet browser regressions passed at 390px, including session expiry/recovery, wallet switching, score/lives initialization and save-retry receipt sharing. No page errors.

Evidence: `treeforce89-boss-r8-checks.json`, `treeforce89-boss-r9-checks.json`, `treeforce89-boss-browser-390.json` and matching PNGs. Phone follow-up: confirm boss/health readability and dodge space during real touch play, with browser bars and fingers present.

## Local review

```sh
node scripts/treeforce-local/prepare-boss-clearance.mjs /workspace/treeforce-review/release/treeforce-baseline release/treeforce-boss-clearance
node scripts/treeforce-local/serve.mjs release/treeforce-boss-clearance 4183
node tests/treeforce-local/boss-clearance-browser.cjs
```

Practice: `http://127.0.0.1:4183/__local/practice?lab=1&revision=r9&scene=title` (unranked, no payments or saves). The r9 frontend overlay retains prior modules. It is not a complete production release package; preserve all current backend functions and schedules in any separately authorized release.
