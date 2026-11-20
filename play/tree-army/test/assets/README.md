# Tree Army illustrated prototype assets

Original artwork generated for TREE Army from the approved November 16, 2026 concept and the supplied TREE Hero identity. No Army of Darkness artwork or code is included.

- `grove-battlefield.webp`: empty scrolling forest fortress and industrial camp, 2172 × 724.
- `forest-army.webp`: transparent sprite atlas, 1774 × 887; three forest unit types with ready/attack poses, a logging bot, and a thorn runner.
- `tree-hero.webp`: transparent four-pose hero atlas, 1263 × 1246; ready, two movement keyframes, and firing.

Source rectangles are explicit in `index.html` because the illustrated figures do not occupy exact uniform grid cells. The same artwork supplies troop portraits. Asset loading must finish before a run can start; failed loading leaves a reload message and the start button disabled.

Animation in this first integration uses pose switching plus slight movement bob/tilt. It is not a full hand-animated walk cycle. The Iron Stump currently uses an enlarged logging-bot sprite; a dedicated boss asset remains future work. Reduced-motion preference disables ambient bob/tilt/firefly motion.

The three WebP files total approximately 1.6 MiB. All URLs are relative to `/play/tree-army/test/`; no new runtime dependencies, wallet connections, payments, backend handlers, or scheduled jobs are introduced.
