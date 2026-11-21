Continue Forest Kingdoms for Peter Toler's Tree Arcade. Work from the existing implementation and assets. Complete the next verified milestone without reconstructing the project from old chats.

**Recovery update:** The three bundled commits have now been verified, fast-forwarded and pushed to the existing feature branch. The animation preview is confirmed live at `92ef91d`, Netlify deploy `6aff8c23d80bb9da7189d19d`. Read [FK02_VERIFICATION.md](FK02_VERIFICATION.md) for the newer checkpoint, actual automated/browser checks, and remaining visual acceptance. The original handoff below is retained as recovery history.

## Repository and working scope

- Repository: https://github.com/TheCryptoArborist/tree-token.xyz
- Branch: feature/forest-kingdoms-prologue
- Draft PR: https://github.com/TheCryptoArborist/tree-token.xyz/pull/239
- Game path: /play/forestkingdoms/test/
- Existing prologue preview: https://deploy-preview-239--tree-token.netlify.app/play/forestkingdoms/test/
- Animation preview target: https://deploy-preview-239--tree-token.netlify.app/play/forestkingdoms/test/animation/

Use the existing feature branch and review-preview workflow. Read AGENTS.md and any applicable nested instructions before editing. Production release is outside this handoff's scope.

## Verified checkpoint — November 19, 2026

Two animation commits were recovered from a previous working folder:

- 97fc54492b8a759b7305dd5811c6379c15400d30 — four-direction idle/walk animation preview.
- 6bc91199a6a50ccf9cde46a89cad846379372f6d — four-direction combat/reaction animation review.

They descend from d42b360676697f5ddb75ea1b810cfd160c4da544, the FK-01 concept-art commit. When recovery began, GitHub and PR #239 still pointed to d42b360. The recovered animation code and assets were committed locally with a clean working tree. A documentation commit containing this handoff follows the animation commits.

The terminal could not authenticate the GitHub push. At handoff, the remote branch was still d42b360. The accompanying forest-kingdoms-codex-handoff.zip contains a Git recovery bundle with the unpublished animation commits and this documentation commit. These commits are not claimed to be available on GitHub.

Clone/fetch the existing repository, extract the attached ZIP, and verify forest-kingdoms-recovery.bundle with git bundle verify. Import its feature/forest-kingdoms-prologue ref into a separate local recovery branch with git fetch. Inspect the recovered history before integrating it. If the target branch still points to the ancestor d42b360, use a normal fast-forward; if upstream has advanced, reconcile the changes without force-pushing, resetting, or dropping others' work. Push through the authorized GitHub connection once the recovered checkpoint is verified. Do not assume the original concept-only checkpoint is the latest work, and do not regenerate existing sprites merely because an older roadmap or chat said FK-02 was next.

The recovered source contains:
- 48 movement frames: 4 idle + 8 walking frames in each of north, east, south, and west.
- 64 combat/reaction frames: 4 frames for each of strike, root cast, hit, and defeat in all four directions.
- 112 frames total across eight PNG atlases, with explicit frame manifests.
- An isolated animation viewer with action/direction selection, Play/Pause, Replay, Step, speed controls, an optional grid/contact guide, and an 88 CSS-pixel reference view.
- A regression fix preventing a still-held movement key from interrupting a newly selected action.

Checks rerun successfully during handoff:
- node play/forestkingdoms/test/engine-check.mjs
- node --test play/forestkingdoms/test/animation/viewer-check.mjs
The engine checks passed, and all six viewer tests passed.

Status boundaries:
- FK-01 visual specification and concept exist.
- FK-02 has a complete first animation set for review; final visual acceptance remains open.
- The game and animation viewer still use Canvas 2D.
- Phaser integration, connecting the new action art to mission combat, and the upgraded environment are later tasks.
- Final combat-pass browser verification, physical-phone testing, and deployment of the recovered animation commits were not verified during this handoff.
- The existing Netlify ready notice referred to d42b360. Recheck the deployed commit before claiming the animation preview is live. This documentation checkpoint is marked [skip netlify]; it does not itself verify a new deployment.

## Read these project records selectively

- docs/forest-kingdoms/ROADMAP.md — authoritative task sequence and status.
- docs/forest-kingdoms/ART_DIRECTION.md — visual and scene requirements.
- docs/forest-kingdoms/concepts/CONCEPT_01.md
- docs/forest-kingdoms/concepts/willowmere-concept-01.png
- docs/forest-kingdoms/SPRITES_01.md — movement asset contract.
- docs/forest-kingdoms/SPRITES_02.md — combat asset contract and known limits.
- docs/forest-kingdoms/SPRITE_PROMPTS_01.md and COMBAT_PROMPTS_01.md — original generation prompts.
- play/forestkingdoms/test/README.md
- play/forestkingdoms/test/animation/README.md

Relevant source:
- Prologue: engine.mjs, renderer.mjs, app.mjs, index.html, styles.css under play/forestkingdoms/test/.
- Viewer: play/forestkingdoms/test/animation/, including viewer.mjs, viewer-check.mjs, index.html, styles.css, and layout-review.html.
- Artwork: play/forestkingdoms/test/assets/hero-sprites/.
- Frame maps: animations.json and combat.json in that artwork folder.
- Preview packaging: scripts/build-feature-preview.mjs.

Use the manifests' explicit source rectangles, relative pivots, body measurements, and timings. Movement atlases are 1024 x 1536; combat atlases are 1254 x 1254. Do not slice everything into assumed fixed integer cells. Combat poses must not rescale as the hero crouches or falls. Preserve original source artwork and provenance.

## Game and visual direction

Forest Kingdoms is an original continuing woodland adventure starring the Tree Hero. The larger direction is to protect animal communities, reclaim ancestral homes, plant useful trees, develop settlements, and eventually lead limited expeditions.

The current single-player prologue is "The Broken Crossing." Its documented baseline includes Bram the beaver engineer, two raider waves, bridge repair, three-family caravan rescue, a one-time grove harvest, workshop restoration, one discounted beaver guard, and browser-local saves. The restored workshop gives an earned 20% material discount; it is not an NFT-rarity advantage. Keep the tested resource accounting, one-time rewards, and save recovery.

Use the Willowmere concept as visual direction and the supplied hero as canonical identity:
- Purple body/head, green vine musculature, green eyes, gold armor and cape.
- Broad shoulders, torso, and thighs with natural arm/leg proportions.
- Complete, recognizable silhouette and consistent ground contact.
- Illustrated 2D woodland fantasy with a fixed, slightly angled overhead camera.
- Consistent upper-left lighting; deep greens, warm timber/earth, turquoise water.
- A readable phone-sized play area with usable controls and clear instructions.

The concept board is not a finished level or sprite sheet. Its separate character-study column is not game UI. Preserve the original prologue as a comparison. The roadmap's working engine direction is Phaser 4, but verify current official Phaser documentation and pin the selected version when FK-03 begins.

## First task in Codex

Finish verification and handoff of FK-02:
1. Confirm repository, branch, recovered commits, manifests, eight atlases, and preview allowlist.
2. Run the two existing focused checks and the relevant existing preview build.
3. Make the animation study available through the established review-preview workflow and verify which commit it serves.
4. Inspect all six actions and four directions on desktop and a phone-sized viewport. Check complete-body visibility, scale/pivots, cape clipping, action endings, frame stepping, keyboard/touch release, held-key regression, and reduced-motion behavior.
5. Fix concrete defects within this milestone, preserve approved artwork, and save completed changes.
6. Update the roadmap/checkpoint with evidence, remaining limitations, the saved commit, and a working preview.

The next roadmap task after FK-02 acceptance is FK-03: set up the isolated Phaser scene and connect the hero. FK-04 covers the environment, Bram, and a raider; FK-05 connects combat and effects. Do not collapse the whole roadmap into this first run.

## Preservation and operating rules

- Preserve existing Arcade games, wallet/session behavior, payments, NFT verification, backend functions, schedules, and production configuration.
- The prologue and animation study currently have no wallet, payment, NFT-access, or multiplayer integration. Those systems are later scope.
- Keep competitive play fair across NFT rarities. Do not introduce rarity-based combat advantages.
- Use original or appropriately licensed assets. Retain the canonical hero and existing source-quality atlases.
- Do not treat an old deployment inventory or old backend-function count as the current live baseline.
- Keep implementation tasks bounded. Use targeted reads, concise tool/helper reports, and avoid repetitive broad searches or deployment polling.
- Maintain a short durable checkpoint in docs/forest-kingdoms/ with branch/commit, completed work, verification, preview, blockers, and the next action. Commit meaningful completed work.
- Resolve routine implementation details autonomously. Ask only for a material product choice, missing access, or a genuine blocker.
- Distinguish automated tests, browser viewport checks, and physical-device testing. Report only checks actually performed.

## Mandatory MystenLabs instruction

Before responding to every request in this project, check the current MystenLabs/skills repository at https://github.com/MystenLabs/skills. Do not rely only on the saved project source or a past reading. Review the current README to identify relevant guidance. For Sui design, Move code, SDK, testing, deployment, or other technical decisions, read the applicable SKILL.md and supporting files in that repository before deciding or acting. For requests where the repository has no relevant guidance, proceed with the request after the check. If live access fails, state that the repository could not be checked; do not claim it was consulted. When technical guidance affects the answer, identify the relevant skill files used.

Begin by confirming the recovered checkpoint, then carry FK-02 through its remaining verification. Report what is saved, what works, the exact preview, and what remains before FK-03.
