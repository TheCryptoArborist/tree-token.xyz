# Tree Force ’89: combined graphics review

Local review on `dev/treeforce-arborwing-hd`, following `f5d2301` and the published r19 source baseline. Existing unrelated worktrees remain untouched. No website build, Netlify deployment, wallet write, payment or backend change.

## Completed batch

- Added four illustrated growth-stage designs matching the approved adult Tree Hero. Sapling, Young Tree, Mature and Ancient progressively expand the leaf glider and vine armor. Seedling retains the previously approved asset.
- All five frames retain their original logical 128×160 dimensions. New art is fitted without stretching inside each original occupied envelope; original game scale, collision geometry and rules remain in force.
- Added automatic desktop resolution fallback. `render=auto` starts with a 960×1440 drawing buffer at desktop widths, then changes once to 480×720 after two consecutive active sampling windows whose median interval exceeds 26ms. Each window requires at least two seconds and 12 samples. Individual intervals are capped at 250ms. Paused/hidden intervals reset sampling; a fallback remains latched until a new game instance. Mobile stays at 480×720. This improves workload, not a guarantee of a particular frame rate.
- Preserved explicit `render=hd` for controlled comparisons and `render=standard` as baseline. All adapters remain localhost-only. `art=all` enables all five upgraded frames; historical `art=after` still isolates Seedling.

[Actual in-game artwork review image](treeforce89-final-review/review.png) · [Self-contained review page](treeforce89-final-review/review.html)

The stage strip uses a common sprite scale for comparing designs. Gameplay uses the original per-stage scales. Generated artwork is a review candidate, not a claim of user approval for the four new stages.

## Verification completed

- Three quality-policy unit tests passed: sustained slowdown, healthy/isolated-stall behavior, and inactive-window exclusion.
- All-stage lifecycle checks passed at standard desktop, HD desktop and mobile. Fifteen capture/reserve/rescue cycles exercised every growth stage. Growth, damage and scene restart passed. Apart from the intended texture-source changes, stage geometry and capture traces match the preceding baseline exactly.
- Browser integration passed a controlled slowdown through the actual renderer callback, retention of HD while paused, latched fallback through viewport changes, and full destruction/recreation with one practice canvas and six texture sources (no accumulation). A fresh game restored three lives and reset the fallback policy.
- Pointer alignment and actual Pause/Resume controls passed after fallback and viewport changes.
- A real Phaser RenderTexture drew the hero offscreen and displayed it alongside the active hero. Camera flash/shake were invoked and the resulting screenshot was visually inspected. This covers these concrete paths, not every possible effect.
- Simulated WebGL context loss/restoration passed in standard and HD modes with all-stage assets loaded, correct viewport/buffer recovery and no page errors.
- All tests prohibit external requests and non-GET requests. Lifecycle tests use controlled scene-method fixtures rather than complete human playthroughs. The fallback integration test injects only the sampler clock in the local module response to make the timing deterministic.

Evidence is in `docs/treeforce89-final-review/`. The recovery script records SwiftShader timings; these remain slow and are not real-desktop performance evidence. Some runs overlapped other browser checks, so do not treat those numbers as comparative benchmarks.

## Remaining human review and release

One consolidated review should cover the four new stage designs, smooth desktop movement/controls, and a brief phone playthrough. There is no new hosted review URL yet; this work has stayed local to avoid deployment credits. A canonical-domain review candidate can be prepared as the next delivery step. No production publication has been performed or requested for this batch.

Before any authorized publication, capture a fresh complete live inventory and preserve all current frontend paths, backend packages, runtime settings and schedules. This localhost overlay is not a complete release package. Parallel multichain/site work must be reconciled at that point, not overwritten with this older frozen base.

## Local reproduction

Use the existing port-4206 static server with root `/workspace/treeforce-arborwing-preview`:

```sh
node scripts/treeforce-local/prepare-arborwing-review.mjs
node --test tests/treeforce-render-quality.test.mjs
TREEFORCE_ART=all node tests/treeforce-render-lifecycle.cjs
node tests/treeforce-final-review.cjs
TREEFORCE_ART=all node tests/treeforce-render-recovery.cjs
```

Combined preview: `/arborwing-review.html?lab=1&revision=r20&art=all&render=auto`.

## Hosted review now available

The approved local batch is now available at https://tree-token.xyz/play/treeforce89/review/arborwing/ . See [publication evidence](treeforce89-hosted-arborwing.md). The main game remains unchanged; the combined device review is the next checkpoint.
