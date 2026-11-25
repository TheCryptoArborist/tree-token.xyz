# Arborwing desktop rendering experiment

Local-only continuation of the revised adult Tree Hero artwork at commit `2cff802`, based on published r19 source `64060196`. Nothing deployed; no Netlify builds, wallet operations or payments.

The existing game uses a 480×720 drawing buffer enlarged by the desktop layout. The experiment uses a 960×1440 WebGL drawing buffer at viewport widths of 1000px and above while retaining 480×720 logical coordinates. It adjusts the screen viewport and scissor operations; offscreen framebuffer operations retain the original methods. Mobile retains its original buffer. Both the localhost restriction and `render=hd` opt-in are required.

Actual captures in [the comparison](treeforce89-render-review/comparison.html) use the same revised first-stage artwork. The higher resolution makes the face, emblem, vines and glider visibly clearer. This does not add detail to the original low-resolution enemy or background textures. The browser screenshot is displayed at the same CSS size; the detail comparison is enlarged 2×.

## Verification

`node tests/treeforce-render-review.cjs` passed four cases: standard and HD at 390×844 and 1920×1080. It blocked external requests and all non-GET requests. Verified:

- Expected buffer sizes, identical CSS canvas size, logical scale, world bounds, camera and hero/body geometry.
- Pointer coordinates remain logical; actual Pause and overlay Resume buttons work.
- Desktop ArrowLeft moves the hero.
- Desktop-to-mobile-to-desktop resizing switches buffers back to 480×720 and 960×1440.
- No page errors in the four cases.

The local practice fixture explicitly refreshes ScaleManager after its initial DOM layout settles, before input checks. The screenshot scene is paused after the interaction checks; encounters are not frame-identical across captures. `checks.json` records the measurements. Syntax checks passed for the adapter and browser test.

During development, the adapter initially assumed an initialized scissor rectangle at startup; the test caught this and it now falls back to the full logical buffer. The initial test also incorrectly tried to resume through the obscured top Pause control; it now clicks the real overlay Resume button.

## Review scope and next task

This is a renderer prototype, not a release candidate. Four times as many drawing-buffer pixels may increase GPU cost; headless Chromium does not establish real desktop performance. Context loss/recovery, offscreen effects, later growth stages, capture/rescue and restart still need coverage before promoting this approach. The renderer does not replace the artwork in the remaining four growth stages.

Next bounded task: validate the revised hero and HD rendering through growth stages and capture/rescue/restart, then complete a real desktop smoothness check before any publication decision. Phone behavior should receive a final smoke check when a release candidate exists.

## Reproduce locally

```sh
node scripts/treeforce-local/prepare-arborwing-review.mjs
node tests/treeforce-render-review.cjs
```

The existing local server serves `/workspace/treeforce-arborwing-preview` on port 4206. Compare `/arborwing-review.html?lab=1&revision=r20&art=after&render=standard` with `render=hd`. This emitted overlay is not a full deployment package; a future authorized release must start from a fresh complete live inventory.

## Follow-up

Growth/capture/rescue/restart evidence is recorded in [the lifecycle review](treeforce89-render-lifecycle.md). See that report for the latest validation scope and remaining release work.

## Combined batch follow-up

The automatic fallback, remaining four stage assets and final rendering checks are now recorded in [the combined graphics review](treeforce89-combined-graphics-review.md). That report supersedes the remaining-work list above.
