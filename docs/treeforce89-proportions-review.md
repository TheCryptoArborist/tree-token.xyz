# Tree Hero reference-proportion correction

Owner requested that the elongated in-game hero be corrected to match their resupplied original illustration. Generated a consistent five-stage sheet with a broader chest, fuller arms/thighs/calves and a less elongated silhouette, preserving the purple/green/gold identity and glider progression. The new sheet is `assets/arborwing-review/proportions-hd.png`.

Each frame is cropped and fitted with a uniform scale inside its original occupied envelope. Logical 128×160 frames, sprite origins, game stage scales and physics bodies are unchanged. No global squashing or physics resizing is used. Firing mounts use the new gliders' gold surface at source-sheet y=535, converted through the fitted layout; visible projectiles and muzzle flashes retain their shared launch point and foreground drawing depth.

The local `art=proportions` option supports comparison with the prior `art=all` sheet. The r23 hosted package selects the corrected sheet by default and loads that single sheet instead of downloading the two unused earlier HD sheets. Existing artwork files remain preserved on the site.

Verification evidence is in `treeforce89-proportions-review/`. The 50-case firing comparison passed, retaining shot counts, velocity, damage, piercing and hitbox dimensions. Adaptive fallback, pointer alignment, Pause/Resume after fallback, complete game teardown/recreation, offscreen rendering and frame-envelope checks passed. Actual five-stage and glider firing screenshots were inspected. An initial lifecycle run timed out during parallel browser work; the sequential rerun passed all three viewport/render cases. Geometry and capture-transition traces match the previous all-stage version exactly. No failure was hidden or treated as proof of a game defect.

The body revision is visual; physical-device performance still requires owner review. This update is intended for the existing canonical review route, not the main game.

Packaged r23 checks at 390×844 and 1440×900 also passed, confirming the reference-proportion registry flag, all five frame dimensions, glider mounts, wallet gate and thirteen badges. All 38 preservation/source guards passed.
