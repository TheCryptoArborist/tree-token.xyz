# Forest Kingdoms — First Graphics Upgrade Brief

Updated: November 19, 2026 (America/Chicago)

Related task: FK-01 in [ROADMAP.md](ROADMAP.md).

## First deliverable

A playable Willowmere clearing containing the Tree Hero, Bram, one raider type, the damaged crossing, a resource grove, and the beginnings of the beaver outpost. The player can walk, strike, cast roots, and interact. This scene establishes the art and animation standard for the rest of the game.

Working technology direction: Phaser 4, with its exact version and renderer setup verified during FK-03. This document does not mean Phaser is already installed.

## Visual direction

Illustrated 2D woodland fantasy, viewed from a slightly angled overhead camera. Preserve the readability and quick response of an arcade game while giving the forest richer forms, textures, and movement.

- Use a coherent view angle, light direction, outline treatment, and scale across every asset.
- Keep ground routes quieter than characters and important objects.
- Use deep forest greens, warm wood and earth colors, turquoise water, and restrained gold highlights.
- Reserve the strongest purple/green/gold combination for the Tree Hero.
- Use contrast, silhouettes, and motion to communicate danger and interaction; color alone should not carry essential instructions.
- Keep effects short and purposeful so they do not cover enemies or the hero.

This first pass retains the existing overhead layout and routes. A true isometric grid, free camera rotation, and full 3D models are separate scope decisions.

## Tree Hero

Canonical reference: the project owner's supplied artwork, retained in the prototype at [assets/hero.jpg](../../play/forestkingdoms/test/assets/hero.jpg).

Preserve:

- Purple body and head with green vine/wood musculature.
- Gold armor accents and a gold cape.
- Recognizable face and heroic silhouette.
- Consistent, natural arm and leg proportions; two arms and two legs in every pose.
- A full visible body at gameplay scale, with feet anchored consistently between frames.

Start with four directional views. Prepare idle/walk first, then strike, root-cast, hit, and defeat. Use consistent cell dimensions, pivots, contact points, and timing. Extra diagonal poses can follow if the four-direction set looks inadequate during play.

Inspect actual animation frames together. A polished still image alone is not a finished character animation asset. Check foot sliding, changing limb lengths, cape clipping, direction changes, and frame-to-frame armor consistency before integrating.

## Supporting characters

**Bram:** a recognizable beaver engineer with a broad tail, useful work clothing, and a clear engineering prop. His movements should communicate that he is a capable ally. He should remain distinct from a beaver guard.

**Raider:** one enemy type for the first scene, with a readable silhouette, obvious attack preparation, hit reaction, and defeat. Equipment must fit the forest kingdom's visual language. Guns, helicopters, and other modern machinery are not added to this scene without an intentional world-design decision.

Match the camera angle and detail level across hero, ally, and enemy. Keep faces and essential silhouettes readable at phone size.

## Environment kit

Prepare only enough original reusable pieces for the first scene:

- Ground and path textures with subtle roots, leaf litter, and stones.
- A few distinct tree forms, including an oak-like broad crown, pine-like crown, and willow-like riverbank form.
- Reeds and shrubs around water.
- River surface, riverbank, and restrained current/ripple animation.
- Damaged and repaired bridge states.
- Young and established grove states.
- Outpost tent and damaged/restored workshop states.
- A small selection of readable signs, resource props, and banners.

These initial species are visual candidates; their resource yields belong to the later economy design. Do not imply that those production systems already exist.

## Lighting, depth, and movement

Use a consistent directional light and contact shadows to ground objects. Add restrained canopy motion, moving water, and occasional leaves. Test any glow, shadow, or lighting filter on the target devices before expanding its use.

Maintain clear depth ordering. Trees or roofs that hide the player should become less obstructive while the player is behind them. The hero, enemy warnings, and interactable objects must remain identifiable during a fight.

## First scene interaction

1. The scene clearly introduces the movement controls and the objective to reach Bram.
2. Bram provides one short story prompt.
3. One small enemy encounter demonstrates walking, strikes, roots, and damage feedback.
4. A nearby damaged object or grove demonstrates contextual interaction and a visible world change.
5. The scene ends in a clear review state so the presentation can be compared with the original prologue.

This is a graphics and control milestone. Complete mission conversion, expanded resource production, additional faction rules, and paid systems have their own tasks in the roadmap.

## Phone and accessibility requirements

- Show the full hero and the important nearby play area; avoid HUD coverage at the crossing and workshop.
- Keep touch targets usable without scrolling during play.
- Ensure text, resource icons, enemy warnings, and interaction prompts can be understood at the actual display size.
- Keep keyboard, click/tap movement, and on-screen movement/action controls consistent.
- Provide sound control and a reduced-effects option if motion or effect density warrants it.
- Record results from real devices before treating phone compatibility as complete.

## Asset provenance and preparation

Use the supplied Tree Hero reference and original artwork. Keep source files, exported assets, animation/frame definitions, and provenance together. Record any external asset license before inclusion. Do not copy another game's characters, art, interface, or mission layout.

Use transparent character assets and consistent animation boundaries. Pack and size assets for the game rather than shipping oversized source art. Measure actual loading and rendering behavior once the scene runs; do not promise performance from the engine choice alone.

## Acceptance checklist for the upgraded scene

- [ ] The Tree Hero is immediately recognizable from the canonical artwork.
- [ ] His body proportions and armor remain consistent during motion.
- [ ] Bram, the raider, and the forest share a coherent art style.
- [ ] The scene is playable in Phaser, with working movement, strike, roots, and interaction.
- [ ] The river, trees, and settlement show a clear improvement during play.
- [ ] The hero and important threats remain visible around trees, roofs, and UI.
- [ ] The scene is readable in desktop and phone-sized layouts.
- [ ] Loading, performance observations, and any remaining limitations are recorded.
- [ ] A review preview is available for comparison before the complete prologue is converted.

## Reference checks

- Working gameplay baseline: [PR #239](https://github.com/TheCryptoArborist/tree-token.xyz/pull/239) and its implementation README.
- Phaser framework and current release: [Phaser 4](https://www.phaser.io/phaser4) and [release list](https://phaser.io/download/phaser4). Recheck the chosen version during implementation.
- Project guidance: the live [MystenLabs skills README](https://github.com/MystenLabs/skills/blob/main/README.md) was checked on November 19, 2026. It does not prescribe a graphics engine. Relevant Sui skill files must be reviewed when their implementation tasks begin.
