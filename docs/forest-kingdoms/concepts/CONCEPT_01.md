# Forest Kingdoms — Concept 01 record

Created: November 19, 2026 (America/Chicago)
Task: FK-01 — Define the first scene and art direction

## Deliverable

[Willowmere and Tree Hero — Concept 01](willowmere-concept-01.png)

A 1536 × 1024 RGB PNG reference illustration. The left panel is a full-body Tree Hero study; the right panel establishes the scene's appearance and spatial relationships. This is visual-development artwork, not a gameplay screenshot, transparent sprite, frame sequence, or production level background.

The working direction is illustrated 2D woodland fantasy. It provides a concrete reference for FK-02 character work and FK-04 environment assets. The concept is presented for Peter's review; no unprovided approval is assumed.

## Provenance

- Character identity reference: Peter's supplied project artwork, preserved at [assets/hero.jpg](../../../play/forestkingdoms/test/assets/hero.jpg). Its original uploaded filename is `Default_A_detailed_comicbook_style_superhero_made_of_purple_an_0 (100).jpg`.
- Created with the built-in image-generation tool using that image as the explicit character reference.
- The image uses an original composition and scene. No competitor artwork, interface, level screenshot, or source code was supplied as an input.
- The concept PNG is an unchanged copy of the generated output.
- Tool mode: built-in image generation, with a local referenced image and an opaque background. No CLI/API fallback was used.

## Visual review

The large character study and smaller scene character preserve the reference's purple body/head, green vine musculature, gold armor/cape, and green facial detail. Both show a complete body with two arms and two legs. The large study gives a useful silhouette and costume reference for the next task.

Bram reads as a beaver through his broad tail, incisors, brown fur, and work clothing. The gap in the bridge is visible, and the approach path leads toward it. The river separates the starting bank from the grove and workshop. Oak-like, pine-like, and willow-like forms give the woodland distinct silhouettes.

The scene and character study share painted forms, outlines, and warm directional light. The forest's color range lets the hero's purple remain prominent.

Two identity refinements carry forward to the sprite master: keep the canonical green eyes rather than the concept's warmer yellowish eye highlights, and recover some of the reference's broader shoulder, torso, and thigh mass. The concept establishes a treatment, not a replacement for the original character reference. The in-scene hero's projection must also be normalized with the other directional poses during asset production.

These observations apply to the displayed concept image. They do not establish animation consistency, collision accuracy, render performance, physical-device compatibility, or readability of actual production sprites.

## Production handoff

1. **Keep the canonical identity.** Use the original hero plus this illustrated treatment as references for FK-02. Reduce small vine/armor details where needed at game size. Preserve proportions, armor placement, cape attachment, and full-body framing.
2. **Choose one game projection.** The large character study is a presentation pose. Production directions must match the actual overhead camera and share consistent feet/pivots, rather than cutting the study out and treating it as a finished animated sprite.
3. **Build a real animation set.** FK-02 begins with four-direction idle/walk views, followed by strike, root-cast, hit, and defeat. A still illustration does not complete those checks.
4. **Keep the scene navigable.** Preserve the existing crossing, objective locations, and mission topology. Quiet path textures and reduce foliage overlap as needed. Use separate foreground layers and obstruction fading in the running scene.
5. **Distinguish world states.** The concept's workshop shows the restored appearance target. Damaged/restored structures, repaired bridge, and grove growth stages must be separate game assets. The drawn plants do not imply implemented resource production.
6. **Reframe for phones.** Use a follow camera around nearby action. Judge the actual sprite size, warnings, prompts, and control overlap in the running preview. The complete concept board is not a phone gameplay screen.
7. **Retain task boundaries.** The raider design, environmental animation, combat effects, UI treatment, and Phaser integration follow in their assigned tasks. This image contains no raider and supplies no finished enemy asset.

## Complete generation prompt

```text
Use case: stylized-concept.
Asset type: art-direction concept board for the original 2D browser adventure FOREST KINGDOMS, task FK-01. This is a visual development reference, not a screenshot or sprite sheet.
Input image: the supplied Tree Hero artwork is the canonical character identity reference. Translate that specific character into a cohesive hand-painted 2D game-art treatment while preserving his purple head and body, green living vine/wood musculature, gold shoulder armor, bracers, boots, belt and flowing gold cape. Keep the green mouth/face detail and recognizable purple face. Omit the small handheld circular weapon for this study.
Composition: a polished wide landscape concept board, approximately 3:2. A quiet deep-forest-green left column, about 28 percent of the width, contains a large full-body Tree Hero character study, facing slightly right, from head through both feet with generous breathing room. Two arms, two legs, natural humanoid proportions, compact hands, relaxed arms ending near upper thighs; no stretched limbs or giant head. His cape falls behind his legs without hiding both feet. At top of this column use the title exactly "FOREST KINGDOMS" in restrained readable warm-gold lettering. Under it, smaller, "Willowmere". At bottom, small "Visual direction • Concept 01".
The right 72 percent is an illustrated gameplay-scale woodland clearing seen from a fixed slightly angled overhead orthographic camera, with no horizon or vanishing-point vista, no isometric diamond grid. A turquoise river runs roughly from the top to bottom near the center-right of this scene. A clearly damaged low wooden bridge connects the left and right banks horizontally; missing center planks show the gap. A warm earth path curves from the lower left toward the bridge, then continues onto the right bank to a modest beaver timber workshop and a small canvas outpost tent. Put a young planted grove on the right bank below the workshop. The bridge stays unoccupied so its missing planks are readable.
Show one small gameplay-scale version of the exact same Tree Hero on the left-bank path near the crossing, full body visible, purple and gold clearly contrasting with foliage; face and torso turned three-quarter toward the viewer. Nearby stands Bram, a friendly compact beaver engineer with brown fur, broad flat tail, work apron and small mallet, using the same illustrated style and light angle. These are the only two characters in the scene. Leave open playable ground around them.
Frame the perimeter with distinct rounded oak crowns, conical pines and a willow with long trailing branchlets on the riverbank. Add a few readable reeds, ferns, smooth stones, leaf litter and timber piles, keeping paths and character silhouettes visually quiet. Foliage must not hide the hero, Bram or bridge.
Style: richly illustrated 2D woodland fantasy, clean confident dark outlines, grouped painted forms, restrained texture, soft contact shadows, warm afternoon light from the upper left. Appeal of a polished retro-inspired adventure with modern clarity. Deliberately simplified game-sized details, not photorealism or a glossy 3D render. Hero study and scene must clearly belong to the same art style. Deep green canopy, moss green, warm brown wood and earth, turquoise water; strongest saturated purple/green/gold combination reserved for Tree Hero.
Mood: hopeful forest kingdom in need of rebuilding, small signs of damage, welcoming but ready for adventure.
Constraints: original composition and art; no references to another game's assets, no guns, helicopters, vehicles or modern technology. No UI, no fake health bars, no claim of gameplay implementation, no extra characters, no logo from another project, no visible watermark. Do not turn Tree Hero into a generic bark tree creature or leafy-headed mascot. Do not crop his head, cape or feet in the large character study.
```

## Related project records

- [Art direction and scene brief](../ART_DIRECTION.md)
- [Development task list](../ROADMAP.md)
- [Existing playable prologue](https://deploy-preview-239--tree-token.netlify.app/play/forestkingdoms/test/)

