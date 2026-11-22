# Tree Arcade seasonal grove artwork and December preview

## November autumn presentation

The attendance forest uses the November theme only when its accepted attendance snapshot has a November month key. Each verified saved date renders one illustrated Tree Hero emblem tree. The autumn sprite contains amber, orange, gold, burgundy and olive leaves, a purple-shadowed trunk, and the green branching crest. A warm dusk landscape and sparse leaf litter support the seasonal palette. Current-day trees are smaller. Unknown attendance never creates earned trees; stale refreshes retain the last verified scene with the existing status message.

The monthly controller, server attendance rules, wallet authentication, recovery price, receipt verification, session expiry, and backend are unchanged. The controller still waits for confirmed attendance before growing a tree or displaying recovery rain. Switching wallets clears the previous wallet's earned presentation. Permanent recovery droplets remain removed.

## December interactive preview

The independent `/play/advent-preview/` route demonstrates the December calendar with explicit sample progress. It loads no wallet bridge and makes no attendance API calls. Its fixed sample date is December 25, 2026; December 1 and 10 begin saved. Today's reveal adds December 25 and starts a one-day sample streak. Recovery restores December 3's artwork without changing that streak. Reset returns to the original two saved dates.

The preview renders all 31 dated positions and four approved illustrations: First Light (December 1), Gingerbread Grove (December 3), Nutcracker Sentinel (December 10), and Tree Hero Christmas Tree (December 25). Calendar thumbnails and the featured card crop the same original approved PNG through SVG view boxes. There is no separate raster edit or re-generated variant. Other dates in the existing December component still use its first-pass emblem SVG artwork; a complete 31-image illustrated set remains future artwork work. The preview does not claim that all 31 illustrations are finished.

The shared component derives saved/recovered/missed/today/future/unvisited states from the existing normalized snapshot, binds state to the active wallet, labels stale data, and selects the exact newly saved or recovered date. Previously earned dates remain selectable. The larger featured card comes before the compact calendar on phones. Copy says TREE ON SUI, and example reset/deadline times use 00:00 UTC. The independent preview has noindex metadata.

## Artwork provenance

Both PNGs were created with the built-in image-generation tool using the user's existing Tree Hero and the approved art direction as references. The original generated files remain available in the conversation. Project assets are copies, preserving their pixels and alpha.

- `assets/arcade-seasonal/advent-art-preview.png`: approved four-panel December art board, 1254 × 1254, RGB. Prompt direction: four dimensional emblem-shaped trees in a snowy purple-and-green forest; gold panel frames; First Light with lights/purple ribbon; Gingerbread Grove with cookies/icing/candy canes; Nutcracker Sentinel with red/gold toy-soldier details; Christmas Day with the same emblem tree, star, gifts, and Tree Hero. Keep the central branching stem, individual almond-shaped leaves and common crest recognizable in all four.
- `assets/arcade-seasonal/november-emblem-tree.png`: isolated illustrated tree, 1178 × 1335, RGBA with true transparency. Prompt direction: a November version of that same emblem-shaped tree; amber/gold/orange/copper/burgundy and a few olive leaves; purple-shadowed rooted trunk; original green crest in a purple/gold medallion; crisp dimensional fantasy-arcade rendering readable at small sizes; minimal padding; no snow, lights, gifts, water droplets, fire, frame, text or extra character.

## Validation and release scope

Meaningful code checks cover attendance consistency and UTC boundaries, wallet changes, exact-date recovery, preview count/streak behavior, accessible selection, source scope, and preserved deployment controls. Candidate browser review uses synthetic attendance and wallets at 320, 390 and 1280 pixels; it also decodes the exact served PNG assets and exercises all preview buttons. It makes no real wallet signatures or payments.

Publication uses `scripts/release-arcade-advent.mjs` and its workflow. Every candidate captures a fresh locked production baseline, changes only its exact declared frontend paths, preserves all other static hashes and complete backend/provider/runtime/schedule/configuration records, and binds browser results to the exact candidate/source tree. The old snapshot build is not a replacement for the current production inventory.

Current technical references checked for this work: MystenLabs/skills `README.md`, `frontend-apps/SKILL.md`, and `frontend-apps/queries.md`. Wallet-dependent presentation remains identity-scoped and confirmed-state driven; no SDK migration was introduced.
