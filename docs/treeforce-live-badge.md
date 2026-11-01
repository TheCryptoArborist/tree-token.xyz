# TREE FORCE ’89 live status

The owner confirmed that TREE FORCE ’89 is live. Its arcade poster now displays LIVE in red and the action reads “PLAY TREE FORCE ’89.” The existing `/play/treeforce89/` destination is retained. The red treatment is scoped to that poster; the other games retain their availability and colors.

Only `/play/index.html` and `/styles/tree-arcade-suite.css` are changed from published deployment `6ae5879d07576659dfd6fd1a`. All 231 static paths remain, with the other 229 files preserved exactly. The release reuses all 39 full backend function records, five schedules, runtime context, isolated database binding, and enabled continue setting. No game logic, dependencies, wallet signing code, or database migrations are changed.

Browser review confirmed the LIVE text, red computed color `rgb(255, 118, 118)`, updated action, unchanged game destination, preserved green statuses on the other live games, and no page overflow. The existing screen-reader description includes the updated status. The current MystenLabs/skills README was checked and remains blob `8be2c5d51d94c953a007e286f63df38372faa8d0`; this presentation update introduces no Sui integration changes.

The committed source and resulting locked deployment are recorded in `treeforce-live-badge-published.json` after publication.

Published source `768f8b9d906e1ceb86817dd4ef5bf018793dcc68` as locked deployment `6ae5895193ef2a292283c697` on 2026-10-31 at 06:23:28 UTC. The canonical page was reloaded and verified to show the red LIVE status and “PLAY TREE FORCE ’89.” Live visual evidence is saved in `review/treeforce-live-badge-6ae58951.jpg`. All 39 function records and five schedules were verified unchanged after publication.
