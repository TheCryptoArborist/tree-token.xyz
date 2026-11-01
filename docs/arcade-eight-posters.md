# TREE Arcade: eight posters

Removed the third Coming Soon poster, leaving six game posters and two future slots. The desktop lineup now forms two complete rows of four. The welcome guide spans the entire grid below the posters on desktop, tablet, and phone.

The game order is Garden Bot, PvP Battle, Arborist Trials, Canopy Clash, Arboretum, TREE FORCE ’89, and the two remaining Coming Soon posters. All six game destinations and availability labels are preserved, including the red LIVE badge and PLAY TREE FORCE ’89 action.

## Review

Browser review confirmed eight posters, two future slots, six game links, the expected order, and a full-width welcome guide below the last poster. Desktop and 1110px layouts retain four columns; 768px retains two columns; 390px and 320px retain one column. All checked widths have no horizontal page overflow. TREE FORCE ’89 remains LIVE with computed text color `rgb(255, 118, 118)`.

The current MystenLabs/skills README was checked and remains blob `8be2c5d51d94c953a007e286f63df38372faa8d0`; this presentation change introduces no Sui integration changes. `git diff --check` passed. No new automated tests were added for this small presentation change.

## Release scope

Only `/play/index.html` and `/styles/tree-arcade-suite.css` change from deployment `6ae5895193ef2a292283c697`. The bounded release script requires all 231 existing public paths, the other 229 static files byte-for-byte, all 39 complete backend function records, five schedules, the original runtime context and database binding, enabled paid continues, and the publication lock. No dependencies, game logic, wallet code, or migrations change.

This layout was published together with the newcomer game explanations as locked deployment `6ae6175066e3bb789eca5a69`, from source `8a8861c7f35650503b3795c6633a7f69f6485d9b`, on October 31, 2026 at 11:29 a.m. CDT. The combined release adds one authentic gameplay screenshot, for 232 public paths. Its full release evidence is in `arcade-game-explanations-published.json`; there was no separate eight-poster deployment.
