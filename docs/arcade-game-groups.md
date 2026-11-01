# TREE Arcade: standalone games first

The owner plans two more standalone games and requested keeping the Garden Battles modes together below them. The arcade now uses two labelled groups, each with its own four-poster desktop row.

| Group | First | Second | Third | Fourth |
| --- | --- | --- | --- | --- |
| Standalone games | TREE FORCE ’89 | Arboretum | Coming Soon | Coming Soon |
| Garden Battles | Garden Bot | PvP Battle | Arborist Trials | Canopy Clash |

The two future slots explicitly describe upcoming standalone games without inventing names, genres, or release dates. They remain noninteractive. The Garden Battles introduction and authentic practice screenshot sit directly above its four modes. The welcome guide follows both groups at full width.

All six game destinations, availability labels, game descriptions and action labels are preserved. The four Garden Battles subtitles and fact lines are unchanged. TREE FORCE ’89 retains its red LIVE badge; Arboretum remains IN TESTING; Garden Bot retains START HERE; Canopy Clash remains a tournament preview.

## Review

The HTML order matches visual and keyboard order. Both groups contain four posters, with group headings below the overall lineup heading and each game's title below its group heading. All accessible-description references resolve, and all IDs are unique. Keyboard navigation from Choose a game reaches TREE FORCE ’89 first with a visible 3px focus outline.

Browser review checked desktop and 1110px four-column layouts, a 768px two-column layout, and 390px/320px single-column layouts. No horizontal page or checked text overflow appeared. Desktop poster bottoms and actions align within each group. The gameplay image loads; the welcome guide matches the main content width; TREE FORCE LIVE remains `rgb(255, 118, 118)`. Visual checks covered both desktop groups and phone views.

The current MystenLabs/skills README remains blob `8be2c5d51d94c953a007e286f63df38372faa8d0`. This presentation change does not modify Sui integration or dependencies. `git diff --check` and the bounded release script's syntax check pass. No new automated tests were added for this reversible presentation change.

## Release scope

The baseline is locked production deployment `6ae6175066e3bb789eca5a69`. Only `/play/index.html` and `/styles/tree-arcade-suite.css` change. The release requires all 232 public paths, the other 230 static files unchanged, all 39 complete function records, all five schedules, the original runtime context and isolated database binding, enabled paid continues, and the publication lock. No new public paths, backend builds, game logic changes, wallet changes, or migrations are included.

## Published release

Reviewed source `82f485ed8cf90bd8b28213587c26610605f83cc3` on `feature/arcade-game-groups-20261031` was published as locked deployment `6ae621b628540d6446e7ad84` on October 31, 2026 at 17:14:08 UTC. The bounded release verified all 232 paths, the other 230 static files unchanged, all 39 complete function records, all five schedules, the runtime context and database binding, enabled paid continues, no migrations, and the publication lock.

The canonical `https://tree-token.xyz/play/` page was checked after publication. Both groups contain four posters in the requested order. All six game links are correct, two future slots are present, the practice image loads, and TREE FORCE LIVE remains red. No horizontal overflow was present.

The full deployment inventory and backend preservation record is in `arcade-game-groups-published.json`. Live visual evidence is saved in `review/arcade-game-groups-live-top-6ae621b6.jpg` and `review/arcade-game-groups-live-battles-6ae621b6.jpg`.
