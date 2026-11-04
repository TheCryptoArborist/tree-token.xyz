# TREE FORCE gameplay flight test

The supplied `deluxegalaga_v26.zip` contains one 901,120-byte Amiga OFS disk image, `Deluxe Galaga v26.adf`. Its 26 files were enumerated and the OFS file headers/data-block checksums checked while extracting `GALAGA.GUIDE` and `READ_ME_FIRST`. The executable has an Amiga HUNK signature; no editable source was found. The manual separately advertised source/tools. This work uses the documented weapon progression, varied enemy combinations and Meteor Storm as design references. No Deluxe Galaga art, audio or executable bytes enter the web build. The disk was not emulated, so these are original TREE FORCE mechanics, not a claim of matching original movement or collision timing.

## Implemented

- Enemy packs use swoop, hook and crossfire curves; borers charge. A 450–650ms locked-target marker gives the pilot a chance to dodge. Escorts fit the actual remaining dive budget. Enemy fire is capped at 28 active shots.
- Five weapons progress through Sap Pod, Resin Repeater, Twin Pods, Thorn Lance and the focused triple Canopy Cannon. The first upgrade needs one violet core; later upgrades need two. Core drop protection begins after six kills for the starter and eight thereafter. Only one falling core is present at a time. The HUD shows charge progress. Active-shot caps apply to manual and automatic fire per Arborwing; a rescued wing retains its existing doubled volley allowance.
- Windfall Gauntlet follows combat waves four and eight. Its 18-second course spawns falling limbs and gold seeds with two clear lanes per row. Seeds award 100 score each. Contact records a bump without taking a life. A clean finish awards 3,000 score and one earned core; another finish awards 500 score. Completion is idempotent and returns to combat waves five or nine.
- Pause and the field guide freeze event timers, enemy tweens and physics together. The bonus timer advances only during active gameplay.

Ten combat waves, final-boss completion, NFTree gating, wallet configuration, paid-continue contract, amount, receipt verification and the strict eleven-field interrupted-run snapshot remain intact. Bonuses award local arcade score/weapon progression, not on-chain currency or reward entitlement. No extra lives are granted. The same original dependency lock and wallet configuration are asserted during builds.

## Preview and validation

The actual game frontend is built for `/play/treeforce89/flight-lab/`. A separate `review.html` fixture is an explicitly labelled isolated game test, with no wallet, payment or server session. It offers real engine controls and integration assertions for weapon progression/caps, attack warnings/budgets, bonus collision/reward behavior, pause and the transition back into combat. The fixture does not establish real NFTree access or a successful payment.

The original 32 wallet/continuation tests and four new deterministic gameplay tests pass locally. Native build and path checks pass, with the pinned build's existing CSS/chunk warnings. Production snapshot preflight passes. The live site was inspected read-only at deployment `6ae971bd73f65c3f86a9e887` with 41 functions and five schedules. Current CLI upload/inventory access returns 401, so no preserved canonical upload is attempted. The repository's isolated Deploy Preview build is used for browser testing; it does not publish to production.

Current MystenLabs `README.md`, `frontend-apps/SKILL.md` and `frontend-apps/react.md` were read live through the GitHub connector. Their wallet gating guidance is consistent with retaining the existing account/session boundary; no SDK migration or signing changes are part of this work.

The isolated build now includes 18 original pinned frontend text files and their SHA256 provenance, including the unchanged wallet configuration and dependency lock. Seven original TREE FORCE art assets are fetched from their existing public canonical paths and verified against pinned SHA256 hashes. The build no longer requires access to a second Git repository. Repeater speed changes apply to both held and automatic fire.
