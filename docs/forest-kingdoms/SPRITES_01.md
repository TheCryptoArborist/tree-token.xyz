# Tree Hero movement assets — first pass

Date: November 19, 2026 (America/Chicago)

Task: **FK-02, in progress.** This deliverable establishes four-direction idle and walking artwork and a viewable animation study. Strike, root-cast, hit, and defeat animation remain within FK-02. Phaser integration belongs to FK-03.

## Review

- [Animation study](https://deploy-preview-239--tree-token.netlify.app/play/forestkingdoms/test/animation/)
- [Original prologue](https://deploy-preview-239--tree-token.netlify.app/play/forestkingdoms/test/)
- [Canonical Tree Hero reference](../../play/forestkingdoms/test/assets/hero.jpg)
- [Willowmere concept](concepts/willowmere-concept-01.png)
- [Complete generation prompts](SPRITE_PROMPTS_01.md)

Choose Idle or Walk, select North/East/South/West, pause or step frames, and change playback speed. The larger canvas supports arrow/WASD movement when focused and hold-to-move direction buttons. A second view displays the same frame at a nominal 88 CSS pixel body height. A grid and contact guide can be enabled for inspection. The enlarged character is nominally 220 CSS pixels and fits its canvas.

## Asset contract

Source files are `play/forestkingdoms/test/assets/hero-sprites/hero-{south,east,north,west}.png`. Each source is a 1024-by-1536 RGBA atlas with twelve figures arranged in four columns and three rows. The complete set contains 16 idle and 32 walking frames.

`animations.json` defines idle indices 0–3 at 3 frames per second and walking indices 4–11 at 8 frames per second. The walk is one eight-frame cycle, not two independent rows. Viewer speed options multiply that playback rate.

The JSON supplies an explicit padded source rectangle for each figure. Some capes extend slightly beyond a nominal grid cell, so consumers must use these rectangles instead of blindly slicing the source into fixed cells. Rectangles were measured from the alpha-connected character silhouette; no raster artwork or original alpha was repainted. This avoids cutting a cape edge or including an adjacent frame.

Each frame's pivot is relative to its own source rectangle. The horizontal anchor follows the head center and the vertical anchor follows the lowest opaque foot contact. `bodyHeight` is a common idle-height measurement for a direction, not a per-frame size adjustment; all poses in a direction share one render scale. Consumers should use the actual frame rectangle, pivot, bodyHeight, and animation timing from the JSON.

The viewer exports `chooseFrame` and `drawHeroFrame` for later integration. It does not import Phaser, change mission state, use local storage, or connect wallets/payments. The original prologue source is preserved for comparison.

## Provenance and identity

The built-in image-generation tool created the original raster artwork from the owner's canonical Tree Hero and Willowmere references. The south atlas additionally served as an identity/layout reference for east and west. Production prompts specify green eyes, purple body/head, green vine musculature, a broader athletic torso and thighs, gold armor, gold cape, natural limbs, a consistent slightly elevated camera, and upper-left warm lighting.

An initial three-quarter sheet with the concept's warmer eye color was excluded from the delivered asset set. Generated PNG bytes and their alpha are retained. Generation prompts are recorded separately for reproducibility and subsequent art corrections. No assets from another game are included.

## Validation and limits

- All four sources have RGBA alpha, expected dimensions, twelve nonempty figures, and in-bounds JSON rectangles.
- Source rectangles include cape spill across nominal cell boundaries and exclude neighboring figures.
- Display scale and pivot calculations were checked, including trimmed source rectangles.
- Browser review covered idle/walk switching, direction changes, frame stepping, the guide overlay, enlarged rendering, and the 88-pixel view.
- A 390-by-844 iframe viewport was inspected. The content has no horizontal overflow; movement targets are 44-by-44 pixels and instruction text is 16 pixels.
- Keyboard/pointer release and focus/visibility reset logic are included. Reduced-motion starts paused.
- Source syntax and focused playback/pivot assertions pass. Physical iOS and Android devices have not been tested.
- This is the first artwork/motion pass. Review the cape silhouette, walk cadence, natural leg movement, and identity across directions before incorporating feedback into the remaining FK-02 animations.
- The four source PNG atlases total approximately 9.2 MB. They are source-quality assets; download optimization and measured device performance remain ahead of the public game release.

## Next work in FK-02

Create and review strike, root-cast, hit, and defeat animations in the same visual language. Then check the full set together before advancing to FK-03 and the playable Phaser scene.
