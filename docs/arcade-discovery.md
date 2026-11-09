# Arcade discovery and saved badge announcements

Routine promotional posts: Monday, Wednesday and Friday at 12:00 America/Chicago, DST-safe. No historical catch-up; skip slots more than six hours old. Deterministic rotation covers TREE FORCE ’89, Canopy Breaker, Arborist Trials, Garden Bot and a live daily-quest spotlight. Each has one CTA. Game pages are checked before promotion; quest content is read from the current public Arcade todayPick and enabledGames rather than a hard-coded quest schedule. No posts claim unannounced rewards. Current optional continue costs are stated in game spotlights. New/unreleased games are not advertised.

Spotlights use the existing provided Tree Force and Canopy Breaker images; other content stays text. The Sunday roundup gets a rotating Try this next week recommendation. No additional weekly post or daily reminder is created. Deployment/setup notices and earned-result alerts are separate from the three-per-week promotional cap.

Monthly badge alerts are based only on newly inserted authoritative private.arcade_growth_monthly_badges rows. Supported labels: TREE Spark (3 monthly check-ins), NFTree Scout (7), TREE FORCE Vanguard (14), Thickquidity Legend (21), Arcade Passport (configured monthly game stamps). Existing awards are never backfilled or invented. Monthly attendance is distinguished from consecutive check-in streaks. Unknown future badge IDs are not announced until the catalog is updated.

A same-transaction badge/streak association suppresses standalone badge announcements because the existing streak alert already includes those exact saved badges. Other badge unlocks post once per wallet/month/badge. Existing game completion messages remain intact; no duplicate game-achievement alert layer is added. There are no new all-time-record, prize, or unreleased-content claims.

The existing GET-only milestone feed adds kind=badges. Private outbox data is exposed only to the existing service role; the public feed returns primary SuiNS/shortened wallet labels, badge names, month, IDs and grouping metadata, never full wallets, sessions, or payment data. No auth keys or environment settings are changed. A read-only API keeps game/check-in writes unchanged.

Delivery reservations and completed IDs live in the existing persistent bot state; explicit API rejection retries, ambiguous failures remain reserved until manually reconciled. Source queue capture is transactional and unique. A five-minute overlap handles late source commits. The database migration does not grant badges, backfill attendance or write synthetic results.

Tests: eight new discovery/badge worker fixtures cover DST, schedule, missed slots, rotation, unavailable games, live quest validation, one CTA, saved badge labels, grouping, restart deduplication and delivery ambiguity. PostgreSQL-compatible migration tests cover no historical notifications, duplicate inserts, rollback, same-transaction grouping and RPC permissions. Existing notifier and source-parity tests remain required. Update the migration file to the server-recorded apply_migration timestamp after deployment so schema history remains aligned.

Initial scope is the recommended discovery/earned-monthly-badge rollout and weekly recommendation. Broader per-game badge catalogs, authoritative all-time leader-change detection, and manual new-content campaigns need their own verified data/approval when those releases are ready.

Database tests use the isolated, pinned vendor/arcade-discovery-tests package. Run npm ci --prefix vendor/arcade-discovery-tests before the database fixtures; do not install test-only packages into the root dependency tree.
