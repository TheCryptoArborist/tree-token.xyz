# Arborwing Seedling artwork review

Local branch `dev/treeforce-arborwing-hd`, based on published r19 source `64060196`. No production deployment, Netlify build, payment, wallet change or backend change.

The current five-frame player sheet uses 128×160 logical frames. Its first-stage painted silhouette occupies only about 36×59 source pixels and is enlarged by the existing 1.75 game scale, then the game canvas is enlarged again on desktop. The current engine explicitly enables pixel-art rendering; the browser presentation also uses pixelated canvas scaling. This explains why the larger layout reveals coarse edges. It does not mean all existing art is defective.

The prototype replaces only frame zero with original, simplified Tree Hero artwork: purple mask/suit, green eyes and leaf armor, tree emblem, gold accessories and compact leaf glider. The first detailed illustration proved too intricate at gameplay scale, so the final study uses broad cel-shaded shapes for readability. The original four later growth-stage frames remain on their original texture source and filtering.

The new frame is composed at 4× texture density into the same 128×160 logical frame, with the painted envelope kept at x45..80 / y75..133. A separate texture source allows linear sampling for that frame alone. Phaser's cached WebGL UVs sample the high-resolution source while the quad and physics remain logical size. This frame remapping is an **experimental local technique**, not yet approved for production. Canvas fallback deliberately retains the original texture. The module refuses to activate outside localhost and requires `art=after`.

## Review images

[Side-by-side actual game comparison](treeforce89-arborwing-review/comparison.png) (2× detail enlargement)

[Desktop current](treeforce89-arborwing-review/game-before-1920.png) · [Desktop prototype](treeforce89-arborwing-review/game-after-1920.png) · [Phone current](treeforce89-arborwing-review/game-before-390.png) · [Phone prototype](treeforce89-arborwing-review/game-after-390.png)

These are actual rendered local-game captures; the larger standalone generated artwork is a design asset, not a game screenshot.

## Validation and limits

`tests/treeforce-arborwing-review.cjs` runs isolated unranked scenes at 390×844 and 1920×1080, blocks external requests and non-GET methods, and compares original/prototype player position, sprite width/height, display size, origin, body size, body offsets and body position. All measured geometry is identical. The logical dimensions of all five frames match. Both variants use the existing WebGL renderer and 480×720 internal game canvas. No page errors. Screenshots were inspected; an initial invisible-frame prototype was corrected before the final comparison.

This does not yet establish performance on physical devices or validate every captor/rescue/tint/crop and scene-restart path. It does not upgrade the other growth stages, enemies, background, HUD or internal canvas resolution. Those are follow-up decisions after visual review, not claims of this bounded patch. The retained 480×720 canvas still limits fine desktop detail; do not publish this prototype as a complete HD graphics release.

## Reproduce

The preview is `/workspace/treeforce-arborwing-preview`, assembled from the current local r19 assets plus `node scripts/treeforce-local/prepare-arborwing-review.mjs`. Serve it with `node scripts/treeforce-local/serve.mjs /workspace/treeforce-arborwing-preview 4206`.

- Before: `http://127.0.0.1:4206/arborwing-review.html?lab=1&revision=r20&art=before`
- After: `http://127.0.0.1:4206/arborwing-review.html?lab=1&revision=r20&art=after`

The local practice shell is unranked and has no payments or saves. The r20 module graph is only a local experiment and is not a production payload. The generated source artwork is kept in `assets/arborwing-review/seedling-hd.png`.

## Body-type correction from the owner's reference

The owner supplied `hero prototype.PNG` as the authoritative physique reference: tall muscular adult, broad shoulders, tapered waist, long limbs, proportionate head, original purple/emerald vine suit, dark mask lenses and cape. The initial stockier cel-shaded study was rejected as the body-type direction and is superseded by the revised `seedling-hd.png`.

The atlas composer previously stretched a narrow illustration to fill the 36×59 occupied envelope. It now fits uniformly inside that envelope, horizontally centered and bottom aligned. The new source crop is x165/y59, 693×1392 pixels. It draws at approximately 29.37×59 logical pixels instead of stretching to 36×59. Frame dimensions, display scale, origin, body dimensions, body offsets and position remain unchanged. A narrower painted silhouette is intentional; no collision adjustment was made.

The browser comparison was rerun at 390×844 and 1920×1080. Both passed the existing geometry checks and new aspect-ratio/containment checks, with no page errors. The latest actual-game screenshots and comparison image show this revised art. The full five-stage upgrade, high-density canvas investigation and gameplay edge-case tests remain separate follow-ups. No production release or Netlify deployment occurred.
