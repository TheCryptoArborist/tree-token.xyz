# Arborwing firing origin correction

The owner reported that the upgraded hero appears to shoot from his hands. Inspection reproduced the cause: the original `branchMount()` coordinates (stage zero y=15 relative to the 128×160 frame center) were retained when the illustrated hero and glider replaced the original artwork. They now intersect the arm area. The new glider's gold front surface lies lower in the frame.

The local adapter computes mount offsets from each fitted artwork layout and a stage-specific glider-front anchor. The existing `weaponPoints()` pattern still supplies alternating, center, paired and spread shots. The real projectile and existing muzzle flash share the corrected origin. Upgraded-art projectiles render at depth 5, in front of the depth-4 hero, so a center shot is not hidden behind his body until it reaches his head. Original-art scenes retain their original mounts and depth.

This intentionally changes the initial projectile position/path. It does not preserve exact collision timing near the player. Fire cadence, velocity, projectile hitbox sizes, damage, piercing, shot caps and weapon patterns are unchanged; there is no invisible physics projectile separated from its visible shot. Hero position and collision geometry are unchanged.

Verification: `node tests/treeforce-wing-mounts.cjs` passed 50 cases (five growth stages × five weapon levels × single/dual fighters), comparing original-art and corrected-art shot counts, velocities, damage, piercing and hitbox sizes. Every upgraded mount moves down onto the glider; shots use the foreground drawing depth. The seedling paired-shot screenshot was visually inspected and shows both flashes at the glider tips. Network writes/external requests were blocked.

[Actual launch-point screenshot](treeforce89-wing-mounts/glider-fire.png). Measurements: `treeforce89-wing-mounts/checks.json`.

Local preview: `http://127.0.0.1:4206/arborwing-review.html?lab=1&revision=r20&art=all&render=auto`.

This correction is local only. The frozen r21 hosted review and main game have not been modified; no Netlify deployment was made. A hosted update must recapture current inventory and package the corrected engine/import plus mount adapter while preserving newer work elsewhere on the site.

## Hosted follow-up

The correction is now published and verified at the canonical review URL. See [publication evidence](treeforce89-hosted-wing-fix.md); the local-only status above describes the initial implementation checkpoint.
