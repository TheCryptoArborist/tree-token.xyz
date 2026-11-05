# Saved Arcade quest campaigns

## Implemented behavior

The approved campaign presentation is now part of the real Arcade source on PR #78, with the demo's client-side completion and approval controls removed. First Round has four tasks and a once-per-wallet profile badge claim. No token payout, NFT mint, transaction or reward budget is involved.

Start First Round to save an enrollment. Check in on its start day or later; pass Know Your TREE in the enrollment week or later; finish a saved Garden Bot, Arborist Trials or PvP result after enrollment; and have a Share Your Score post approved in the enrollment week or later. Existing paid PvP is an alternative, never required. TREE FORCE first-wave participation is deliberately excluded because that existing receipt proves a run start, not a completed game.

The three-question educational quiz is graded server-side. Wrong answers do not count. It awards one saved learning stamp per UTC week, limits unpassed wallets to ten attempts per rolling hour, and returns the original receipt after a pass. First Round claims re-read the stored evidence under a per-wallet transaction lock; pending posts and browser-supplied completion flags cannot earn a badge. Repeated claims return the original claim timestamp.

A profile badge is a saved campaign receipt, separate from the existing Legends of TREE attendance awards and game Passport rules. Historical claims remain recorded even if later evidence changes. Team TREE is visibly unavailable until X account verification and official Telegram bot/group configuration exist. There are no simulation controls or invented membership checks in the development branch.

## Database installed, handlers live

The connected Daily Growth database was identified by its existing private tables, session verifier and verified-game evidence column in Supabase project `lehswszuekjqottolmsf`. On 2026-11-05 UTC, both additive migrations were installed successfully:

- `20261104133625_arcade_social_missions.sql`
- `20261105012102_arcade_campaign_progress.sql`

Hosted checks confirmed RLS enabled on all four new private tables, no SELECT/INSERT/UPDATE privilege for anon/authenticated roles, and only service_role execution of the public campaign RPC. A real invalid-session claim request was rejected by the existing session verifier before any write. Saved claims remained zero. No real user session, quiz attempt, check-in, game result, social post or badge was created during hosted verification.

Security advisors report only the expected informational “RLS enabled, no policy” notices for these private service-only tables. The design intentionally has no browser policies: privileges are revoked and the trusted service role alone accesses them. See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy. No campaign-related warning or error finding was returned.

`arcade-social` and `arcade-campaign` are independent new function packages. The approved release enables these two handlers by default; an explicit flag override other than true disables the relevant handler. No activation flags are added to the site environment, so all 50 existing environment records remain exact. Existing 41 backend sources, schedules, wallet adapter, lockfile and production manifest are unmodified.

## Published release

Published and locked deploy `6aebe195dff096f7428fe1b0` at `2026-11-05T01:56:59.773Z`, application source `b7c1849aeac0cdb4c75b9325ab0bf5fa6cd23e7e`. Canonical URL: https://tree-token.xyz/play/. Open Arcade Missions, then Campaigns or Community.

The actual baseline was `6ae971bd73f65c3f86a9e887`. All 41 original complete provider/function records and ZIP hashes, five schedules, protected runtime fields and 50 environment records remained exact. Two independent functions were added. All 288 previous paths remain: only three changed and two modules were added, giving 290 paths. No ordinary dashboard build was used. The private Sites preview is a separate synthetic review surface.

Exact new ZIPs are archived under `production/arcade-quest-functions/`; current-release.json contains the complete published function records and static inventory. Preserve the current 43 functions on future releases, including these two new handlers. The archival root function manifest is historical.

## Validation

90 Node checks passed across existing Daily Growth, wallet, growth backend and social missions plus the new campaign handler/controller. The SQL migration passed isolated PostgreSQL checks for session/origin enforcement, role isolation, immutable enrollment, quiz pass idempotency, attempt limits, completed-result filtering, pending/approved proof, one-time badge claims, cross-wallet isolation and unchanged attendance awards.

Commands:

```sh
npm install --prefix /tmp/arcade-campaign-tools jsdom @electric-sql/pglite
ARCADE_DOM_TEST_DEPS=/tmp/arcade-campaign-tools node --test tests/arcade-campaign.test.ts tests/arcade-campaign-ui.test.mjs tests/arcade-daily-growth-ui.test.mjs tests/arcade-growth-backend.test.ts tests/arcade-social-ui.test.mjs tests/arcade-social.test.ts tests/arcade-growth-wallet.test.mjs
ARCADE_DOM_TEST_DEPS=/tmp/arcade-campaign-tools node tests/arcade-campaign-database.mjs
```

The prior synthetic campaign preview was checked through the browser at desktop and narrow phone frame widths. The canonical Campaigns UI and negative authentication gates passed after publication. A real signed-in hosted end-to-end campaign still requires a wallet test; it was not performed by the agent. No production wallet signature or transaction was requested or performed.

MystenLabs/skills README was checked live. No Sui SDK/API or wallet-signing decision changed. Supabase's current changelog, database-function documentation, and the Netlify functions guidance were consulted for the new server routes. Existing pinned dependencies were retained.


## Prepared function packages

`node scripts/package-arcade-quests.mjs /tmp/arcade-quest-build/node_modules` packages only the two new quest handlers with the pinned lockfile dependencies. The ZIPs are checked for integrity, traversal and symlinks, and smoke-tested through their extracted handler modules. An explicit disabling override returns 503/no-store, and an unauthenticated request to an enabled handler returns 401 before any API call. `docs/arcade-quest-release-preparation.json` records the exact source inputs, overlay digests and new package hashes. All 41 existing production packages were reused byte for byte from the actual live deployment.

The archival `verify:backend-source` command was also attempted after installing its pinned tools in an isolated dependency directory. It rejects the additive function inventory against its older manifest, so it is not a passing current-production preservation check. Its temporary output was discarded. The release helper compared all 41 existing published records/packages and five jobs to the live baseline both before and after publication.

Official Netlify CLI authorization succeeded. Publication used the authenticated preservation helper, with no access token embedded in source or printed in chat. No new environment flags remain.

The first prepared candidate `6aebe0959784934882b1fa78` requested all original function packages and was stopped before upload/publication. Every original archive has since been located with its exact production SHA256. Two temporary site activation flags were removed before preparing the replacement so the original environment fingerprint can remain exact. The replacement packages enable only their own new handlers. No original function is rebuilt for the release.
