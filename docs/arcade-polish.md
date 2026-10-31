# TREE Arcade polish

## Design and behavior

The approved finishing pass keeps all nine game posters and the requested desktop order: Garden Bot, PvP Battle, Arborist Trials, and Canopy Clash in row one; Arboretum and TREE FORCE ’89 followed by two Coming Soon posters in row two. The ninth poster starts row three, and the new welcome guide fills the remaining three columns.

The introduction is shorter and uses “Battle. Grow. Defend the canopy.” Game statuses and genre labels use at least 10px type, descriptions use 13–14px, and primary actions are at least 44px tall. Live modes use Play actions; Canopy Clash remains a preview; Arboretum and TREE FORCE retain In Testing labels with explicit test-version actions. All six complete posters remain links to the original destinations. Future posters are noninteractive and display Coming Soon once with a plain “Details to be revealed” footer.

Arborist Trials uses its wide proportions. The original Arboretum and TREE FORCE marks blend into forest and star backgrounds through CSS. The six original artwork files remain untouched; sized WebP delivery copies reduce their combined payload from 1,535,842 to 416,356 bytes (72.9%). The reproducible encoding script and exact asset identities are recorded in `scripts/optimize-arcade-art.py` and `arcade-polish-assets.json`.

The skip link moves keyboard focus to the game section, after which Tab selects Garden Bot. A real 3px outline highlights the focused poster. Reduced-motion and forced-color treatments are included. Social metadata references a new 1200×630 JPEG, documented in `arcade-social-art.md`.

## Browser review

- Desktop at 1363px: four columns, all six artwork files load, nine posters, no horizontal or text overflow. The hero is 223px tall, down from 284px; the first poster row starts at 394px, down from 455px.
- 1110px: four columns with no text or page overflow; welcome guide starts beside the ninth poster.
- 768px: two columns with no text or page overflow; welcome guide starts beside the ninth poster.
- 390px and 320px: one column, all nine posters followed by the welcome guide, with no text or horizontal page overflow. Status labels remain 10px. Deferred game artwork loads when navigated into view.
- Keyboard: Enter on Skip to the games focuses `#cabinets`; Tab then focuses the Garden Bot poster with a visible 3px outline.
- Review is limited to layout, content, assets, accessibility, and navigation. No wallet signing, purchase, or gameplay transaction was performed.

## Release preservation

The baseline is locked deployment `6ae5843ef25937c4e39bc684`. Its full 224-file inventory, 39 complete backend function records, five schedules, existing isolated database identity, and enabled paid-continue setting were captured and checked against the previous release record.

Only two existing public files change: `/play/index.html` and `/styles/tree-arcade-suite.css`. Seven public image assets are added: six optimized poster WebPs and one social JPEG. The release therefore contains 231 static paths, preserving the other 222 original paths exactly. No game code, wallet logic, dependency lock, backend package, runtime configuration, schedule, or database migration is changed.

`scripts/release-arcade-polish.mjs` pins the committed source, checks the exact static allowlist, verifies the complete function records and schedules before and after publication, and immediately locks the newly published deployment. Publication evidence is saved separately in `arcade-polish-published.json`.

The current MystenLabs/skills README was checked for this request and remains blob `8be2c5d51d94c953a007e286f63df38372faa8d0`. This is an HTML/CSS and image delivery change with no Sui SDK or wallet integration changes.
