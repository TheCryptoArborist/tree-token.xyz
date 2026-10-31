# TREE Arcade: eight posters

Removed the third Coming Soon poster, leaving six game posters and two future slots. The desktop lineup now forms two complete rows of four. The welcome guide spans the entire grid below the posters on desktop, tablet, and phone.

The game order is Garden Bot, PvP Battle, Arborist Trials, Canopy Clash, Arboretum, TREE FORCE ’89, and the two remaining Coming Soon posters. All six game destinations and availability labels are preserved, including the red LIVE badge and PLAY TREE FORCE ’89 action.

## Review

Browser review confirmed eight posters, two future slots, six game links, the expected order, and a full-width welcome guide below the last poster. Desktop and 1110px layouts retain four columns; 768px retains two columns; 390px and 320px retain one column. All checked widths have no horizontal page overflow. TREE FORCE ’89 remains LIVE with computed text color `rgb(255, 118, 118)`.

The current MystenLabs/skills README was checked and remains blob `8be2c5d51d94c953a007e286f63df38372faa8d0`; this presentation change introduces no Sui integration changes. `git diff --check` passed. No new automated tests were added for this small presentation change.

## Release scope

Only `/play/index.html` and `/styles/tree-arcade-suite.css` change from deployment `6ae5895193ef2a292283c697`. The bounded release script requires all 231 existing public paths, the other 229 static files byte-for-byte, all 39 complete backend function records, five schedules, the original runtime context and database binding, enabled paid continues, and the publication lock. No dependencies, game logic, wallet code, or migrations change.

Publication is pending. The release script records the committed source and verified published deployment in `arcade-eight-posters-published.json` only after successful publication.
