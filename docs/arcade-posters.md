# TREE Arcade game posters

The arcade landing page presents nine compact game posters. The desktop order is four Garden Battles modes across the first row: Garden Bot, PvP Battle, Arborist Trials, and Canopy Clash. The second row starts with Arboretum and TREE FORCE ’89, followed by two Coming Soon posters. The remaining Coming Soon poster starts the third row.

The entire poster for each named destination is one link, including its artwork, title, short description, and action label. The three Coming Soon placeholders have no links. Existing availability labels distinguish live modes, the Canopy Clash preview, and the two games in testing.

The design reuses the official artwork already deployed. It removes the machine silhouettes, CRT frames, joysticks, and coin-door decorations, shortens the promotional copy, and gives the artwork and game links more emphasis. The layout uses four columns on desktop, two on tablets, and one on phones.

## Release scope

Only `/play/index.html` and `/styles/tree-arcade-suite.css` are overlaid onto production deployment `6ae580fad3f05a19757996a5`. The other 222 published paths, all 39 complete backend function records, five scheduled jobs, existing isolated database binding, and enabled TREE FORCE continuation configuration are preserved. No game logic, signing code, dependency, backend package, database migration, or new public asset is included.

`scripts/release-arcade-posters.mjs` captures the live baseline, pins the reviewed source, verifies an unpublished candidate, and forward-publishes that candidate with the production publication lock retained. Final publication evidence is recorded in `arcade-posters-published.json`.

The current MystenLabs/skills README was checked again for this request; its blob remains `8be2c5d51d94c953a007e286f63df38372faa8d0`. This revision is HTML/CSS presentation and uses the existing game destinations without introducing Sui SDK or wallet changes.

## Review

The desktop browser rendered all nine posters at approximately 305 × 386 pixels in the requested 4–4–1 arrangement. All six artwork images loaded, all game titles and descriptions fit, and there was no horizontal page overflow. Phone reviews at 390px and 320px iframe widths confirmed one column with no page or text overflow. A whole-poster click on Canopy Clash reached its existing tournament preview.

An independent content review confirmed the six destinations, availability labels, nine entries, and noninteractive Coming Soon placeholders. Link descriptions explicitly include the availability status for screen-reader users. This is presentation and navigation verification; no wallet signing or gameplay transaction was performed.
