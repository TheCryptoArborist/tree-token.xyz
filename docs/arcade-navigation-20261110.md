# Visible Tree Arcade navigation

Source: `75147f406d96d0623514e6b091f9047765d44267`, PR #120.

The page exposes Games, Daily, Campaigns, Community, Events, This Month and Badge Collection beneath the hero. Games is the default. The original tab buttons and all account, quest and progress element IDs remain in use. The outer missions disclosure stays open, its summary/collapse controls are hidden, and header shortcuts open Daily instead of advertising expansion. Individual quest/rules details retain their existing behavior.

Section links use #games, #daily, #campaigns, #community, #events, #month and #badges. The existing #cabinets skip link still opens and focuses Games. Arrow keys, Home/End and browser history work with the selected tab, including horizontal scrolling on narrow layouts.

The check-in/account strip stays available. Full attendance and monthly progress/recovery controls appear under This Month. Games features the Tree Force ’89 25 SUI challenge above the lineup; View Challenge opens Events. The event remains Coming Soon, with dates unset and entries closed.

## Implementation boundaries

The new presentation source is production/arcade-navigation-static/index.html, derived from the captured live Arcade baseline.html beside it. The new CSS/JS files are styles/arcade-navigation-v1.css and scripts/arcade-navigation-v1.js. The overlay has no fetch, browser-storage, signing or payment calls. Existing tab click handlers still refresh Campaigns and Community; existing account logic remains untouched.

All original script tags and inline bodies were compared byte-for-byte with the captured baseline, with only the added navigation module excluded. No existing wallet, game, check-in, campaign or monthly JavaScript file was changed.

## Validation

Same-domain preview: /play/navigation-preview/. Seven desktop tab selections each displayed exactly one corresponding section and updated the URL. Calendar and monthly progress were visible only under This Month. The outer collapse control stayed hidden.

At 340 CSS pixels (Chrome 400% page zoom, not handset emulation), all seven views fit without page overflow. The menu scrolled horizontally and each selected tab stayed visible. Featured challenge navigation selected Events, focused its tab and revealed its panel. Browser Back restored Events and its focus; Home selected Games and End selected Badge Collection. Header controls no longer exposed aria-expanded; the challenge CTA used dark text for contrast. Browser zoom was restored to normal.

These checks used signed-out browsing. They do not constitute a holder-wallet, payment, mobile-touch or game-playthrough test. Existing code and backend preservation are verified separately by the release script.

Full observed navigation checks are recorded in arcade-navigation-validation-20261110.json. The preservation release script captures fresh live files, exact function records, schedules, runtime/build settings and protected environment fingerprints. It refuses active deployments and concurrent publication. The historical root build must not replace current production.

## Published release

The main Arcade is live at https://tree-token.xyz/play/ on locked deployment `6af35ef0c1679f00c601ca0e`, from source `75147f406d96d0623514e6b091f9047765d44267`. Its fresh baseline was `6af35dfcb412ba20353c478c`. Only `/play/index.html` changes in the promotion: all 395 other static paths are identical, with 396 total. All 47 complete function records, five schedules, runtime/build settings and protected environment fingerprints match.

The main page was opened in the browser and confirmed to default to Games. Its featured challenge link selected Events at /play/#events, and the header shortcut selected Daily. The account/check-in control finished loading normally without a login or transaction. The final Games view was captured after loading.

The same-domain navigation preview remains available. Its polish deployment modified only the two new navigation assets before promotion. Neither preview release altered the main Arcade page.

Tournament scoring and event dates remain separate unfinished work. This presentation change does not open entries or award the 25 SUI prize.
