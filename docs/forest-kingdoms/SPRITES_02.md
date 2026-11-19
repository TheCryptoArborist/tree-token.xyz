# Tree Hero combat and reaction assets — first pass

Date: November 19, 2026 (America/Chicago)

Task: **FK-02, in progress — complete first animation set for review.**

## Review

- [Character animation study](https://deploy-preview-239--tree-token.netlify.app/play/forestkingdoms/test/animation/)
- [Existing playable prologue](https://deploy-preview-239--tree-token.netlify.app/play/forestkingdoms/test/)
- [Movement asset contract](SPRITES_01.md)
- [Complete combat generation prompts](COMBAT_PROMPTS_01.md)

The recovered movement pass was saved locally in commit `97fc544` but had not been pushed when the previous chat stopped. Its four atlases and original `animations.json` are preserved unchanged. This update adds four combat/reaction atlases, their separate `combat.json`, and viewer support for selecting, pausing, stepping, and replaying the new actions.

## Animation set

| Action | Frames per direction | Playback | Ending |
| --- | ---: | --- | --- |
| Idle | 4 | 3 fps | Loops |
| Walk | 8 | 8 fps | Loops |
| Strike | 4 | 10 fps | Holds final guard pose |
| Root cast | 4 | 7 fps | Holds final ready pose |
| Hit reaction | 4 | 8 fps | Holds recovered stance |
| Defeat | 4 | 5 fps | Holds fallen pose |

Every action has north, east, south, and west views. The first full review set has **112 frames**: 48 original movement frames and 64 new combat/reaction frames. The short action sequences are an initial motion pass; they are not a claim of final animation polish or user acceptance.

## Asset contract

The four new files are `play/forestkingdoms/test/assets/hero-sprites/hero-{direction}-combat.png`. Each is an unchanged **1254 × 1254 RGBA PNG**, containing four columns and four rows. Actual output dimensions differ from the requested 1536-square prompt; no raster resizing, mirroring, repainting, or alpha modification was performed.

`combat.json` uses the same manifest contract as the movement set, with explicit source rectangles and relative pivots. Rows map to strike (0–3), cast (4–7), hit (8–11), and defeat (12–15). All four definitions set `loop: false`. Frame rectangles were measured from each character's alpha-connected silhouette and padded; they contain no adjacent character and remain inside the source image. Consumers must use these explicit rectangles rather than assuming an integer cell grid.

Each direction uses a common standing-body measurement across all its action frames. Crouching and falling change the pose, never the render scale. The horizontal pivot retains one measured column-relative anchor per direction, and the vertical pivot follows the character's lowest solid ground contact. The north view is a rear view, including its fallen pose; east and west are separately generated rather than mirrored lighting.

| Direction | Common standing measurement | PNG bytes |
| --- | ---: | ---: |
| South | 290 px | 1,650,348 |
| East | 289 px | 1,733,310 |
| North | 269 px | 1,390,609 |
| West | 289 px | 1,685,181 |

The new source atlases total 6,459,448 bytes. They remain source-quality review assets. Public-game optimization and measured physical-device performance belong to later milestones.

## Viewer behavior

Use the four action buttons directly beneath the clearing. A selected action plays once and retains its final pose. Replay restarts it. Pause and Step allow inspection; Step retains the final combat frame, while movement frames wrap. Direction and speed controls apply to all six states. The smaller view keeps the nominal standing body at 88 CSS pixels, including the falling sequence at the same scale.

Focus the clearing for WASD/arrows; J strikes, K casts, H shows the hit reaction, X shows defeat, and R replays. Moving deliberately cancels the current action. Selecting an action clears held movement so stale key/pointer releases do not cancel it. Reduced-motion starts paused and action selection remains paused; Play or Replay is an explicit playback request.

## Source verification

- All four new sources have nonempty alpha and sixteen distinct character silhouettes; no opaque figure intersects the outside image edge.
- All sixty-four explicit rectangles fit their source dimensions and exclude neighboring principal silhouettes.
- The existing movement PNGs and manifest retain their recovered bytes.
- Focused playback, stepping, source selection, and manifest validation checks are in `play/forestkingdoms/test/animation/viewer-check.mjs`.
- The feature-preview allowlist includes the new JSON and four PNGs; the production build and protected wallet/backend modules are not changed.
- Browser and deployment verification are recorded in the delivery update after the review build is available. A source check is not a claim of browser or physical-device verification.

## Scope and next step

This is an isolated character animation study. It does not connect actions to mission damage, enemy state, root snares, saved progression, or payments. Enemy artwork/reactions remain FK-04/FK-05; Phaser integration remains FK-03. Review the complete hero set, incorporate concrete visual feedback, then connect it to the upgraded Willowmere scene.
