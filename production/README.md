# Current production — photo-first event cosmetic review, 2026-11-11

Locked deploy `6af4c09480dca6c4a8ad75d7`, source `ea81a2de80eacb00e60aaf384fec2878ea7d370f`, PR #143. Review `/play/events/profile-cosmetics/`, mobile-width review `/play/events/profile-cosmetics/mobile-review/`; workshop concepts updated at `/play/events/preview/`. Cosmetic approval and permanent ownership unlocks are still pending.

Replaces poster medallions and tiny ribbons/lettering with a thin canopy frame, compact lower-right hero-face emblem and gold champion profile kit. Photo remains prominent; decoration stays inside the circular social crop. New try-on uses local-only photo upload/crop controls and actual 48/80/128px examples. No photo data is uploaded or stored on a server. The existing workshop publisher also includes all new renderer dependencies/routes.

Validation: upload/reset tested in browser using a synthetic photo; desktop 1363px has 1348px document width; mobile content/scroll width 375px and photo label 307×52px. All nine small examples have exact 48/80/128 canvas/CSS widths at desktop. Separate raster check using @napi-rs/canvas 0.1.80 reports zero opaque pixels outside the social circle, transparent corners and unchanged center photo pixels for all three compositions: `docs/event-profile-cosmetics-render-validation-20261111.json`. Existing event-rule and required production-snapshot checks pass. Workshop eligibility still prompts signed-out users correctly and entry remains disabled.

Fresh baseline `6af4a8a16b5775b6f672ecb0` preserved all 49 complete backend records, five schedules and runtime/provider/build/protected-environment fingerprints. 511 static paths; 504 unchanged, 2 workshop presentation paths changed, 5 review/renderer paths added. No Profile Studio, game, wallet, payment, eligibility, database or backend package changes. Release: `docs/event-profile-cosmetics-release-20261111.json`; workflow `43086635932`. Future releases capture fresh published inventory.

---

# Current production — NFTree-only tournament foundation, 2026-11-11

Locked deploy `6af4a8a16b5775b6f672ecb0`, source `6994fb2fac05dcea36d694b4e8a70202dd6af701`, PR #141. Review page `/play/events/preview/`; isolated handler `netlify/event-functions/arcade-events.ts` at `/api/arcade-events`.

Adds authenticated, uncached canonical NFTree eligibility checks (direct and wallet-controlled Kiosks), plus authorized organizer server draft save/load. Private organizer allowlist starts empty pending Peter's explicit management wallet. Entry collection, tournament run starts, scoring and cosmetic unlocks remain closed/unintegrated. The shared holder guard is prepared for fresh checks before future payment and each ranked run. Cosmetic concepts still await improvement/review.

Fresh baseline `6af47ccc900af8400ddb46b3` included other Arcade work. Preserved **all 48 existing complete backend records and all five schedules**, adding only `arcade-events` (49 total). Now 506 static paths: 502 unchanged, three workshop paths updated and one server-controls module added. Existing games, wallet code, Profile Studio and community tracking remain unchanged. Runtime/provider/build/protected-environment fingerprints verified. Release: `docs/arcade-event-foundation-release-20261111.json`; workflow `43070383514`. Future releases capture fresh inventory. The first-install release utility refuses to replace any existing event handler.

Validation: 15 focused tests plus existing NFTree ownership regression; required production-snapshot and STI regression workflows passed. Live configuration reports NFTree-only/entry off/scoring off, missing and invalid sessions reject with 401, unsupported entry/run actions return 404. Desktop 1363px and 390px mobile iframe checked; content/scroll width 375px, no overflow; signed-out holder and organizer controls display sign-in guidance; entry stays disabled. Positive authenticated ownership and organizer save tests use controlled fixtures; a real organizer-wallet round trip awaits allowlisting. Migration is installed, browser roles denied, and RLS enabled on all three new private tables. No organizer or paid event was seeded.

---

# Current production — scheduled event workshop preview, 2026-11-11

Locked deploy `6af3f56c6ea78991ef999584`, source `951fd28e0f90747cb80de11c74d7e4a5b5ee7862`, PR #137. Review page `/play/events/preview/`; source `production/arcade-events-static/index.html`, modules `scripts/arcade-events/{core,preview}.mjs`, stylesheet `styles/arcade-events-preview-v1.css`.

Adds a separate event-planning and cosmetic-concept review only. Entry remains disabled. No wallet, fee collection, server scheduling, score submission or permanent entitlement grant is connected. Existing Arcade event card and gameplay remain unchanged. Scope and remaining integration: `docs/arcade-events-design-20261111.md`.

Fresh inventory: 492 static paths, **all 487 prior static paths unchanged**, all 47 complete backend records, five schedules, runtime/provider/build configuration and protected environment fingerprints preserved. Release report: `docs/arcade-events-release-20261111.json`; workflow run `42962404360`. Future releases must capture fresh published inventory. `scripts/arcade-events/release.mjs` and its manual workflow permit preview routes only.

Validation: five event-rule suites plus required production-snapshot and STI regression workflows passed. Desktop (1363px) and mobile iframe (375px content, 375px scroll width) checked; original art loads, draft save/reload works, invalid ending dates reject, entrant estimator handles zero/100 entrants, game planning choices update, and entry remains disabled. Validation record: `docs/arcade-events-validation-20261111.json`.

---

# Current production — all illustrated borders fit their photo edges, 2026-11-10

Locked deploy `6af3bb0fbd70015aaa06efb8`, source `f0e0a36c0d9d9635a3314d02efa2f25e7cf8b550`, PR #136. Active page `production/profile-border-fit-static/index.html`; script `scripts/tree-profile-studio-v16.js`; frame silhouette helper `scripts/profile-border-fit.js`; game art helper `scripts/profile-game-art.js`; existing stylesheet v9 unchanged.

Leafy Canopy, Christmas Lights and Autumn Glow now use their actual illustrated outer contour to clip the photo underneath their rim. Original bulbs/leaves are retained. Downloaded 1024px PNGs using one high-contrast diagnostic photo show zero photo pixels outside all three frames and transparent corners. Classic Gold and Canopy Mint exports are pixel-identical to baseline. Validation: `docs/profile-border-validation-20261110.json`.

The original Canopy Breaker arcade artwork and Root Rage boss action are live, all nine ecosystem choices including approved Deadfall Run are present, and owned NFTs precede TREE Ecosystem. Existing wallet/session/ownership/payment behavior is unchanged.

Fresh inventory preserved: 487 static paths (486 unchanged at production promotion), all 47 complete backend records, five schedules and runtime/provider/build/protected-environment fingerprints. Release: `docs/profile-border-fit-release-20261110.json`. Future releases capture fresh published inventory using `scripts/profile-border-fit/release.mjs`.

---

# Current production — approved ninth Deadfall Run badge, 2026-11-10

Locked deploy `6af3b401d0193c86219abb02`, source `1be865bd768123d2e5cc1fcc02e95c9e96884f00`, PR #135. Active page `production/profile-deadfall-static/index.html`, script `scripts/tree-profile-studio-v13.js`, helper `scripts/profile-deadfall-art.js`; existing stylesheet v9 unchanged.

Adds the approved bright purple truck with lowered title as ninth ecosystem badge. The other eight live badges are unchanged. Pending original Canopy Breaker and Root Rage boss artwork remain in the separate v12 game-art preview. Live badge selection, exact nine-choice count and frame PNG export verified.

Fresh release preserves 479 static paths (476 unchanged), all 47 complete backend records, five schedules and runtime/provider/build/protected-environment fingerprints. Source and release record: `docs/profile-deadfall-release-20261110.json`. Future releases use fresh published inventory; utility `scripts/profile-deadfall/release.mjs`.

---

# Current production — clear game badges and mobile photo upload, 2026-11-10

Locked deploy `6af3ab2cd3c66da0f6847165`, source `6258bbaeeef5295294ed8bf34714bf6d268900be`, PR #132. Active page: `production/profile-ecosystem-static/index.html`; script `scripts/tree-profile-studio-v11.js`; stylesheet `styles/tree-profile-studio-v9.css`.

Photo picker is full-width gold, 60px tall on mobile. At 390px viewport the document is 375px wide with no horizontal overflow. Native file chooser opens. Canopy Breaker and Root Rage use distinct named SVG medallions readable in the compact picker; frame export reports success. TREE Token renamed; generic NFTree, duplicate Thickquidity and Sui emblem choices removed. Owned NFTrees remain above Partners. Ancient Oak retains its 48px lift.

Fresh inventory preserved: 473 static paths, 472 unchanged at production promotion; all 47 complete backend records, five schedules and runtime/provider/build/protected environment fingerprints unchanged. Release record: `docs/profile-ecosystem-upload-release-20261110.json`. Future releases capture a fresh published baseline using `scripts/profile-ecosystem/release.mjs`.

---

# Current production — NFTrees before Partners, 2026-11-10

Locked deploy `6af39467220a8ff936b957ea`, source
`4e002623565a0bcf197e272e3785ee7ee94b6e84`, PR #130.
Active Studio: `production/profile-nftree-order-static/index.html`,
`scripts/tree-profile-studio-v9.js`; existing styles-v8, partner-medallion and
access-v4 are unchanged.

The existing owned-NFTree bottom-badge panel now sits immediately after TREE
Ecosystem and before Partners. Order is None, TREE Ecosystem, NFTs, Partners,
November, December. Desktop preview and340-CSSpx layout verified this exact DOM
order;337px document width. No badge selection, photo, ownership, session, wallet,
payment, border or artwork behavior changes. Syntax and required production
snapshot checks pass. No new tests added for this small presentation reorder.

Fresh baseline `6af3942619ebbfb53d7765fd`;463 static paths,462 unchanged at promotion.
All47 complete backend records, five schedules and runtime/provider/build and
protected environment hashes preserved. Release/validation record:
`docs/profile-nftree-order-release-20261110.json`. Future releases must capture
fresh published inventory; utility `scripts/profile-nftree-order/release.mjs`.

---

# Current production — official partner badges, 2026-11-10

Locked deploy `6af39210476c85cf56dbd130`, source
`d866f59aa3cc8f85d1db4272cbe04c9fa7756633`, PR #129.
Active Studio source: `production/profile-partners-static/index.html`,
`scripts/tree-profile-studio-v8.js`, `scripts/profile-partner-medallion.js`,
`styles/tree-profile-studio-v8.css`. Existing access-v4 and all wallet/payment
code are unchanged. The compact wallet controls and bottom NFTs panel remain.

Partners adds one official SuiDex handshake (1080px transparent Media Pack PNG)
and one official Kelpie on-dark emblem. Original assets are stored unchanged;
extra renderer/thumbnail padding preserves the full marks inside round gold rims.
Both select as bottom medallions, retaining the uploaded profile photo. Other
medallion rendering uses the original default and all other artwork stays intact.

Seventeen existing regressions passed. Desktop and340-CSSpx preview verified;
actual1024x1024 RGBA exports for both have transparent centers/corners and opaque
badge regions. No actual wallet signing/payment or user photo upload. Asset source
and validation details: `docs/profile-partner-logos-design-20261110.md`,
`docs/profile-partner-logos-release-20261110.json`,
`docs/profile-partner-logos-validation-20261110.json`.

Fresh baseline `6af391a15fc90f558550dfe6`;461 static paths,460 unchanged at promotion.
All47 complete backend records and five schedules plus runtime/provider/build and
protected environment fingerprints preserved. Use fresh published inventories;
release utility `scripts/profile-partners/release.mjs`.

---

# Current production — NFT artwork as bottom badges, 2026-11-10

Locked deploy `6af38cfd5ab474aae2a0cddf`, source
`24edebbae97333e854fa8536e28337b11d3021b9`, PR #128.
Active Studio: `production/profile-nft-badge-static/index.html`,
`scripts/tree-profile-studio-v7.js`, `scripts/profile-studio-access-v4.js`,
`styles/tree-profile-studio-v7.css`.

NFTs is back below the other badge collections. Actual owned NFTree thumbnails
are selectable round bottom medallions; uploading the profile photo remains a
separate control and selecting an NFT never replaces that photo. The oversized
wallet instructions/navigation buttons are replaced by compact connection and
local sign-in controls. Existing Arborist Trials lift and other artwork remain.

Reproduced and fixed the screenshot wallet's Kiosk ownership error: NFTs are
reached through owned Kiosk Item dynamic-object-field values, with canonical type
and matching Item/object/metadata IDs, rather than expecting direct Kiosk ownership.
Bounded workers progressively show verified items; failed Kiosks cannot hide
separately verified artwork, and exports still await/recheck current holdings.
Existing session/expiry/sign-in guards remain. Read-only live lookup found three
canonical NFTrees (two direct, one Kiosk), no partial errors; sample image200/CORS*.

Seventeen focused tests passed, including uploaded-photo preservation and bottom
medallion placement. Desktop preview showed the compact wallet and bottom NFTs
panel;340 CSSpx mobile document337px, wallet section174px. No real-wallet signing,
payment or user-photo upload. Details: `docs/profile-nft-bottom-badge-design-20261110.md`,
`docs/profile-nft-bottom-badge-release-20261110.json`,
`docs/profile-nft-bottom-badge-validation-20261110.json`.

Fresh baseline `6af38c4ae461c7fd2c8e5ebd`;455 paths,454 unchanged at promotion.
All47 complete backend records, five schedules and runtime/provider/build and
protected environment hashes preserved. Always capture fresh baselines; release
utility `scripts/profile-nft-badge/release.mjs`.

---

# Current production — in-place Profile Studio sign-in, 2026-11-10

Locked deploy `6af388bc2cee7668d2bdf882`, source
`a7633354886828a8474915fb26705c450e6bcd2d`, PR #127.
Active Studio: `production/profile-signin-static/index.html`,
`scripts/tree-profile-studio-v6.js`, `scripts/profile-studio-access-v3.js`,
existing `styles/tree-profile-studio-v5.css`.

Sign in here replaces the redirect to Arcade. Existing valid shared Arcade sessions
restore silently without another signature. Local sign-in uses the same wallet
adapter and challenge/session/status endpoints, persists the exact server expiry
under the same shared storage key, and is reusable by Arcade. Expired sessions or
a remembered Studio wallet can restore wallet identity only; earned badges still
require current authentication. No check-in, payment, wallet SDK or TTL change.

Fourteen focused tests passed for shared-session reuse, local sign-in, expired
identity restore, rejection, account changes, duplicate clicks including pending
refresh, ownership/Kiosks/transfer/outage and non-destructive focus. Desktop and
340-CSSpx signed-out UI checked. Real-wallet signing was not performed. Detailed
design: `docs/profile-studio-signin-design-20261110.md`.

Fresh baseline `6af3876a3c2cbc34e58e5f83`;451 paths,449 unchanged at promotion,
all47 complete backend records and five schedules plus runtime/provider/build
and protected environment fingerprints preserved. Records:
`docs/profile-studio-signin-release-20261110.json` and
`docs/profile-studio-signin-validation-20261110.json`.
Use fresh complete baselines; utility `scripts/profile-signin/release.mjs`.

---

# Current production — visible NFTree picker and Trials artwork, 2026-11-10

Locked release `6af385eb6da682188cf300e3`, source
`0b6bdb854dce8e993945660223f78934de799781`, PR #126.
Active Studio source: `production/profile-discovery-static/index.html`,
`scripts/tree-profile-studio-v5.js`, `styles/tree-profile-studio-v5.css`.
The existing `scripts/profile-studio-access-v2.js` is unchanged.

Your NFTrees is now a static, highlighted selector before all other artwork,
initialized before wallet discovery finishes, with connect/refresh controls and
a prominent shortcut beside wallet status. This supersedes the earlier selector
that appeared below every seasonal badge. Arborist Trials alone moves up 72px
within the 1024px composition to clear the border. All other artwork placements
and actual NFTree ownership/monthly badge requirements remain unchanged.

Desktop preview verified shortcut navigation, signed-out picker, and clear Trials
logo separation. Mobile 340 CSSpx: document337px and picker267px, no overflow.
Existing ten focused checks passed; required production-snapshot passed. No live
wallet connection, signature or payment. Full preservation records and final live
visual validation: `docs/profile-studio-discovery-release-20261110.json` and
`docs/profile-studio-discovery-validation-20261110.json`.

Fresh promotion baseline `6af3858856d2b81eba715c06` had448 static paths; only main
Studio HTML changes,447 paths preserved. All47 complete backend records and five
schedules, provider/runtime/build configuration and environment hashes remain
exact. Continue using fresh baselines; utility `scripts/profile-discovery/release.mjs`.

---

# Current production — owned NFTrees in Profile Studio, 2026-11-10

Locked deploy `6af3843998541eb5599dee67`, source
`89f5b30e64a4c5a40cf62f93dadd7559b2c93fa4`, PR #125.
Active Studio source is now `production/profile-feedback-static/index.html`,
`scripts/tree-profile-studio-v4.js`, `scripts/profile-studio-access-v2.js`,
`styles/tree-profile-studio-v4.css`. Header and all three navigation entries from
PR #124 remain unchanged. All 47 backend function records and five schedules,
runtime/provider/build settings and protected environment hashes preserved.

Sui emblem and Tree Hero are in TREE Ecosystem. Free artwork no longer repeats
category labels. Locked monthly artwork remains fully visible with an explicit
lock explanation. Wallet identity, Connect/change wallet, Refresh collections and
Arcade sign-in controls are now above the editor. Shared Arcade session parsing
accepts its existing opaque token format and supports legacy sessionStorage;
server authentication and existing one-hour expiry still control earned badges.

The earlier six synthetic rarity-holder emblems are superseded by Your NFTrees:
actual canonical NFT artwork, name and rarity from the connected wallet's direct
and supported Kiosk holdings. Public ownership requires wallet connection; monthly
awards additionally require the authenticated Arcade session. Ownership refreshes
before every NFT export. Account change, transfer or verification failure revokes
access. Same-wallet focus refresh preserves the selected artwork. Remote images
load anonymously with CORS to preserve canvas export; the sample Pinata gateway
returned Access-Control-Allow-Origin: *.

Validation: focused direct/Kiosk metadata and artwork, opaque session restoration,
monthly authorization, transfer/outage revocation, in-flight account change and
same-wallet focus regression checks. Desktop browser verified the visible wallet
panel, clean categories, eight locked monthly choices, no synthetic holder buttons
and the signed-out Your NFTrees explanation. A 340 CSS-pixel layout check passed.
No real-wallet connection/signature/payment was performed; authenticated behavior
uses controlled tests. Release records and limits are in
`docs/profile-owned-nftrees-release-20261110.json` and
`docs/profile-owned-nftrees-validation-20261110.json`.

Use a fresh current published baseline for every future release. Never publish
the historical root snapshot. Utility: `scripts/profile-feedback/release.mjs`.

---

# Current production — Profile Studio access and navigation, 2026-11-10

Locked deploy `6af3818fdc888d00cdad3d5f`, source
`9667681f8f22ac54032be304fb40aa836a4ae97e`, PR #124.
441 static paths, all 47 complete backend function records and five schedules.
Fresh baseline `6af38002595dc15f8d7529aa`; 434 static paths preserved byte-exact.
Only four main HTML pages and three new Studio asset versions changed on promotion.
Full runtime/provider/config/build and protected environment fingerprints preserved.

Active Studio source: `production/profile-medallions-static/index.html`,
`scripts/tree-profile-studio-v3.js`, `styles/tree-profile-studio-v3.css`,
`scripts/profile-medallion.js`, `scripts/profile-studio-access.js`.
Navigation sources: `scripts/profile-site-nav.js`,
`scripts/profile-studio-entrypoints.js`, `styles/profile-site-navigation.css`,
`production/profile-entrypoints-static/{home,command,arcade}.html`.
Existing guided Arcade scripts from PR #123 remain active and unchanged.

Square ecosystem/partner art becomes circular gold-rimmed medallions in picker
and exported PNG. Sovereign City is now included from the user-supplied original;
the earlier pending-artwork note below is superseded. Monthly designs are locked
previews until earned for the authenticated wallet. A separate six-rarity holder
collection requires exact current canonical NFTree ownership (direct and supported
Kiosks), and revokes on transfer/expiry/account changes. Restricted exports refresh
verification. Existing one-hour Arcade session and payment approvals remain intact.

Studio now has the homepage header; homepage has a prominent feature and menu link;
Arcade has a Studio destination immediately after Badge Collection; Command Center
has a Studio navigation link. All original scripts on these three pages are exact.

Ten focused tests passed, actual transparent round-artwork PNG inspected, desktop
published navigation/artwork verified, and 340 CSS-pixel mobile menu tested.
Authenticated access/transfer/race cases use controlled mocks, plus real read-only
GraphQL schema/type/rarity checks. No live-wallet signing or payments performed.
Records: `docs/profile-studio-medallions-live-release-20261110.json`,
`docs/profile-studio-medallions-validation-20261110.json`,
`docs/profile-studio-access-design-20261110.md`.
Use a fresh complete published baseline for future releases; never replace it with
the historical root snapshot. Release utility: `scripts/profile-medallions/release.mjs`.

---

# Current production — guided Arcade and Profile Studio, 2026-11-10

Locked deployment `6af37ace6ec0f06da74b724f` publishes the coordinated guided
Arcade and Profile Studio update from source commit
`0f773ec5356164f46a69e4aca8ccfaf6d0dcd3d9`, PR #123.

Active sources:
- Arcade: `production/arcade-guided-static/index.html`
- Core integration: `scripts/arcade-daily-growth-guided.js`, campaign/social
  `*-guided.js` siblings, `scripts/arcade-guided-v2.js`, `scripts/arcade-share-builder.js`
- Studio: `production/profile-studio-v2-static/index.html`,
  `scripts/tree-profile-studio-v2.js`, `styles/tree-profile-studio-v2.css`
- New transparent overlay assets: `assets/profile-studio/`

One compact daily/monthly summary stays above the navigation. Monthly Progress
replaces This Month. The main starter guide separates free attendance,
optional follow, game choice and coordinated three-style sharing from the
optional existing First Round bonus badge and quiz. Legacy badge requirements
and previously earned progress remain unchanged. Telegram is a working
community link rather than a pending verification task. Voting choices are
browseable while signed out; submission remains authenticated and limited.

Share graphics use original game artwork, with PNG/native-share and prefilled
X composer options. No automatic publishing or invented score/result. Current
saved Garden result stamps and Tree Force participation have distinct labels.
The API does not expose consistent score receipts, so cards do not assert scores.

Profile Studio adds TREE logo/Thickquidity/NFTree artwork, original VICTORY and
BOOM power-up art, and a separate Sui emblem. Autumn Glow and Christmas Lights
use real illustrated overlays. Leafy Canopy and Sui emblem are independent.
Classic Gold, Canopy Mint and the badge collection design are unchanged.
Sovereign City artwork was not present in current Tree Force assets/bundles
or accessible source searches; that item remains pending the original asset.

Session regression repeatedly navigated all seven tabs without signing or
check-in calls, preserving the same valid stored session. Transient restore
hides actionable sign-in UI; one-hour expiry remains and explicitly states
saved attendance stays saved. The user's original real-wallet prompt was not
reproduced in a live signed-in browser; no expiry/security weakening is claimed.

Validation: five focused tests, desktop and 340-CSS-pixel zoom-based layout
checks, actual three-style game share PNG export, local-image profile loading,
1024px transparent frame and composed-photo downloads inspected. No real-wallet
sign-in/payment or social publishing performed. Details and full inventory:
`docs/arcade-guided-validation-20261110.json`, preview and live release records.

Fresh promotion baseline `6af37a24db5b4154a0999951` had 429 static paths.
Promotion changes only `/play/index.html` and `/play/profile-studio/index.html`;
427 other static paths, all 47 complete function records, five schedules,
provider/runtime/build settings and protected environment fingerprints remain
exact. Initial review added14 paths to the prior415 without altering those paths.
Capture a fresh complete live baseline before future work; never publish the
historical root snapshot over current production.

---

# Current production — Know Your TREE dropdown fix, 2026-11-10

Locked deploy `6af370678cf2aa50165d807a` fixes quiz answer browsing on `/play/`.
Source commit `6479a1236531e6a8286be32357a01662f4ca344a`, PR #122.
Only `/scripts/arcade-quest-campaigns.js` changes, from repository source
`scripts/arcade-refresh/arcade-quest-campaigns.js`. Answer selects remain
usable while signed out, before saved progress loads, and after this week's
stamp. Submission still requires the existing verified session/progress and
weekly eligibility. Accessible text beside the form explains each state.

Three focused tests passed. All three selections were changed successfully
in both isolated `/play/quiz-preview/` and live `/play/#campaigns`; signed-out
submission remains disabled. No real-wallet scoring/credit submission was
performed. Session, API, payment, scoring and reward logic are unchanged.

Fresh main baseline `6af3701ad1b172340c881dcc` had 415 static paths;
414 remain exact, all 47 full function records and five schedules are
preserved, with runtime/build/environment fingerprints intact. Preview added
three isolated review paths without changing the prior 412 paths. Records:
`docs/arcade-quiz-release-20261110.json`, preview release and validation JSON.

The active Arcade page and Profile Studio remain the seasonal sources below.
Capture a fresh complete inventory before every deployment; never publish
the historical root snapshot over current production.

---

# Current production — seasonal Arcade and Profile Studio, 2026-11-10

Locked deploy `6af36decd5317e3867e86e8f` publishes the seasonal Arcade UI on
`/play/` and the local photo tool at `/play/profile-studio/`. Frontend source
commit `a93907cfaa55b2517966deb2dda58428369def2c` is in PR #121.

The active Arcade page source is `production/arcade-autumn-static/index.html`.
Its presentation modules are `scripts/arcade-seasonal-data.js` and
`scripts/arcade-seasonal-v1.js`, layered on the unchanged navigation module.
Profile Studio source is `production/profile-studio-static/index.html`,
`scripts/tree-profile-studio.js`, and `styles/tree-profile-studio.css`.

November/December retain four existing attendance goals (3/7/14/21 days),
with Autumn Hero/Christmas Hero at 21. December is an upcoming collection
until December 1 UTC. Campaigns and Community use open scrolling sections;
attendance has a persistent visible callout; Month badges precede the calendar.
Profile Studio offers local photo crop, four borders, nine badge decorations,
three ecosystem artwork choices and 1024px PNG/profile-frame downloads.
Selecting artwork never awards an achievement.

Fresh promotion baseline `6af36ba4757ed7f4d9bd47c5` had 412 static paths.
Promotion changes only `/play/index.html` and the seasonal stylesheet;
410 other paths, all 47 complete backend records, five schedules, runtime,
build settings and protected environment fingerprints remain intact.
The staged preview added 16 paths while preserving all prior 396 paths.
See `docs/arcade-autumn-release-20261110.json`, the preview release record,
and `docs/arcade-autumn-validation-20261110.json` for inventory and evidence.

Desktop and 340-CSS-pixel narrow layout checks passed. Actual local-photo
loading and PNG downloads passed; exported alpha and 1024px dimensions were
inspected. Three focused Node tests passed. Original wallet/payment/game/
quest scripts remain byte-exact; signed-in actions and payments were not
exercised. The 25 SUI Tree Force event remains coming soon, entries closed.
Capture a fresh full current baseline before every release. Never publish
the historical root build as current production.

---

# Current production — Arcade history restoration, 2026-11-10

Locked deployment `6af3618b197365bd03c62936` corrects Back/Forward restoration
for the visible Arcade navigation. Source `0fd80495eff1a93d5c2dfff1e73f32e780da761d`
is in PR #120. The fresh baseline is `6af35ef0c1679f00c601ca0e`.

Only `/scripts/arcade-navigation-v1.js` changes. All 395 other static paths,
47 complete backend records, five schedules, runtime/build settings and
protected environment fingerprints are preserved (396 total static paths).
The full current inventory is
`docs/arcade-navigation-history-fix-release-20261110.json`.

The main page remains `production/arcade-navigation-static/index.html`.
Fresh /play/ defaults to Games; Daily → Back restores empty-hash Games;
Forward restores Daily without adding a new history entry. The live browser
regression evidence is in `docs/arcade-navigation-history-regression-20261110.json`.
Capture a fresh complete baseline before every future release.

---

# Current production — visible Arcade sections, 2026-11-10

Locked deployment `6af35ef0c1679f00c601ca0e` publishes the visible section menu
and upcoming 25 SUI Tree Force challenge on `/play/`. Source commit is
`75147f406d96d0623514e6b091f9047765d44267`, PR #120. The active page source is
`production/arcade-navigation-static/index.html`, with presentation assets
`scripts/arcade-navigation-v1.js` and `styles/arcade-navigation-v1.css`.

Fresh promotion baseline `6af35dfcb412ba20353c478c` contains 396 static paths,
47 backend functions and five schedules. Only `/play/index.html` changes;
all 395 other paths and exact function/package/runtime/provider records,
schedules, build settings and protected environment fingerprints are preserved.
See `docs/arcade-navigation-release-20261110.json` for the full current inventory.
The earlier review added `/play/navigation-preview/` and the two new assets
without changing any existing paths.

Games is the default. Daily, Campaigns, Community, Events, This Month and
Badge Collection are available without opening an outer disclosure. Full
calendar/monthly progress is under This Month. Original wallet, payment,
quest and game JavaScript stays unchanged. Event entries remain closed and
dates unset. Functional, keyboard/history and 340-CSS-pixel narrow-layout
checks are recorded in `docs/arcade-navigation-validation-20261110.json`.

Before every future release capture a fresh complete live inventory. The
historical root snapshot build must not replace current production.

---

# Current production — homepage ecosystem refresh, 2026-11-07

Deployment `6aef8152b93ffa0224e1f0cd` refreshes the homepage with live TREE Force ’89,
Canopy Defense and Canopy Breaker previews, full App/Arcade/NFTree/Rewards
entry cards, clearer access and purchase wording, and grouped Resources navigation.
The hero video, contribution dialog and five existing market nodes and requests
are preserved. All five figures loaded in browser checks; desktop and narrow
454/340 CSS-pixel layouts were checked without horizontal overflow.

Source `223004ee3ac7f8300df6a0e418c3113240dbc6e2` uses the newly captured current
347-path baseline `6aef7c5589af8c6d5a21ce78`. Only `/index.html` is replaced;
`/scripts/homepage-refresh.js` and `/styles/homepage-refresh.css` are added,
bringing the complete inventory to **349 static paths**. All 43 complete backend
records, five schedules, runtime settings and protected environment fingerprints
match. See `homepage-refresh-release-20261107.json` for the complete inventory.
Capture this release before future publication. The root historical snapshot
and manifest remain intact; the active homepage source overlay is in
`homepage-refresh-static/index.html`. Never replace production with the old root
snapshot build. No transaction or wallet module was changed.

The market resilience and preservation checks pass, as do both required GitHub
workflows. The optional legacy `homepage-simple-source` test still asserts old
Vite asset-import syntax in unchanged `scripts/home-v2.js`; this pre-existing
source assertion is recorded separately from current browser behavior.

---

# Current production — supplied rewards artwork, 2026-11-07

Locked deployment `6aef79ac2b3345f579dd4e3e` replaces the rewards card image with Peter's supplied `5115.jpg`, stored byte-for-byte as `/rewards/nftree-rewards-hero.jpg`. Source `755a77bb3dc8b4642f89b7c31fbf57ea34f9fb29` is merged in PR #91. TypeScript/build passes and preview framing was visually checked. All 330 prior paths remain, with only `/rewards/index.html` replaced and eight assets added (338 total). All 43 backend records, five schedules and protected environment fingerprints match. See `nftree-rewards-release-20261107.json` for the complete current inventory. Capture this deployment before future releases.

---

# Current production — rewards character framing, 2026-11-07

Locked deployment `6aef77ffb97eb2200655b411` anchors the rewards illustration to its top edge, keeping the character's head and raised hand visible. Source `664f152938428d811aea699d5cf85cb46ac12b5a` is merged in PR #89. Build passes and the preview was visually checked. All 322 previous paths remain, with only `/rewards/index.html` replaced and eight new hashed assets (330 total). All 43 backend records, five schedules and protected environment fingerprints match. The complete current inventory is in `nftree-rewards-release-20261107.json`; capture this deployment before future releases.

---

# Current production — rewards background video, 2026-11-07

Locked deployment `6aef763bf1c54c76ba751d1c` restores the original TreeDrop video at `/rewards/`, with pause/resume, reduced-motion support and a dark overlay. Source `9e487c34a49798a9910b3996eb74b0959696490f` is merged in PR #87. All 314 prior static paths, 43 complete backend records, five schedules and protected environment fingerprints were verified unchanged, except the rewards HTML entry. Eight hashed assets bring the total to 322 paths. TypeScript/build and all 40 application checks pass; preview playback and pause/resume were checked in a browser. The current inventory is in `nftree-rewards-release-20261107.json`. Capture this current deployment before future releases.

---

# Current production — native NFTree Rewards, 2026-11-07

Locked deployment `6aef6c32cb53f14a782ffc71` serves the native NFTree Rewards
page at `https://tree-token.xyz/rewards/`. Reviewed source is
`4e28e7bafd32ba08aeeacded2f1784fdf86dc28a`, merged in PR #84 as
`7468d9557d34b63e9da5436cf0987df6f61997cf`.

The release preserves **all 43 complete backend package/provider/runtime/route
records, five scheduled jobs, protected environment fingerprints, and every
previous static path**. There are 314 static files: only the two existing
homepage and Arcade HTML files changed, with native reward bundles and a small
homepage entry script added. No existing backend was rebuilt and no reward
transaction was signed or executed. See `nftree-rewards-release-20261107.json`
for the complete current inventory and validation. Earlier manifests and build
snapshots below remain historical recovery material; they do not contain the
complete current 314-file/43-function deployment.

`rewards-app/` contains the pinned source for holder claims, verified ownership
snapshots and the direct-distribution manager. Build its own package with
`npm ci --ignore-scripts` and `npm run build`, then use a newly captured current
preservation baseline for any future publication. Never deploy an old root build
as a replacement for the current site or rebuild unrelated functions.

TreeDrop's root now forwards visitors to the native page through a fixed,
serve-time head snippet (`Native NFTree Rewards entry`, ID `0`). Its original
published deployment `6a89d2b2ceda1c578f9baa02`, seven static files and two backend
packages remain intact and locked. An attempted server-redirect candidate was
stopped when Netlify requested unavailable older function archives; it was never
published. The forwarding source is `scripts/treedrop-native-entry.html` and four
focused checks cover its fixed destination, query/hash preservation, API exclusion
and JavaScript-disabled fallback. The private TreeDrop repository also retains
root/index server redirect rules for future builds. Current forwarding is not an
HTTP 301 response; the browser follows the fixed native destination immediately.

Validation passed: 40 application checks, 15 preservation/redirect checks, four
entry forwarding checks, TypeScript, production app build, desktop and narrow
340-CSS-pixel browser layout, homepage/Arcade links, wallet picker, sponsor form,
manager gate and canonical redirects. Read-only Mainnet tests validated existing
receipts, every registered token's decimals, a complete 1,420-NFT snapshot with
zero unresolved owners, original-package SUI claims and a four-token community
claim batch. SUI/community package families require separate wallet approvals.
Operator payout records are browser-local with export/import; gas sponsorship is
not enabled.

---

# Current preservation baseline — validation only, 2026-11-02 UTC

Authenticated read-only capture and verification protect published, locked deployment `6ae8112dce29c5db8b725ff0`: **288 static paths, 41 complete function records, five schedules, and 50 site Functions environment entries**. The captured records, canonical SHA256 sidecar, and validation report remain in the local ignored `.netlify/` directory. See `../docs/preserved-release-validation.md` for usage and API visibility limits. This records the current live state; it does not publish or synchronize the historical source/build manifest with all later feature releases.

`node scripts/release-preserved-production.mjs verify` fails if the publication, any complete backend record, schedule, runtime setting, static path/digest, or protected API-visible environment fingerprint changes. Capture requires an explicit expected deployment ID and refuses to overwrite a baseline. The script no longer permits the historical metric-package replacements or any publish/restore mode. No production changes were made by this maintenance work. Earlier sections below are historical records.

The version 2 local baseline is `.netlify/preservation-baseline-v2.json`. It excludes only the build-settings audit field `updated_at` from configuration equality, preserving that timestamp separately as an observation. All other settings retain aggregate and per-field hashes. Version 1 evidence is retained locally; its aggregate-only settings hash cannot reconstruct historical field-level differences. See the validation guide for the explicit version migration review.

---

# Historical production — validated VICTORY reward display, 2026-10-06

Deployment `6ac58a83cdbea77d7a4a7336` is published and locked. Source commit `359e39ec17b0b437606abe3275b42df2bbc01a79` (PR #53). This frontend-only follow-up removes fallback to legacy reward analytics: reward APR remains unavailable whenever the on-chain incentive validation fails. The regression fixture includes a legacy analytics object marked verified alongside unavailable incentives.

Only `/dapp/v3-workspace.js` changed from `6ac572a85dc967783eb08fb0`. All 38 exact function packages, 194-file inventory, runtime configurations and five schedules are preserved.

---

# Current production — V3 metrics and VICTORY rewards, 2026-10-06

Deployment `6ac572a85dc967783eb08fb0` is published in production context and locked after explicit approval. Reviewed source commit `a9d7486b250f46b537939798b4f13b8c1c3335fa` (PR #53).

Only `/dapp/v3-workspace.js` and the read-only `tree-v3-overview` handler changed. TVL and complete on-chain volume are independent of enriched APR validation. Trading fees and VICTORY emissions are shown separately, with their different denominators stated. Emission rates and reward end dates must match on-chain accounting; token prices and active TVL remain venue-provided estimates.

All 194 static digests, 38 function configurations and five schedules were verified. The other 37 function packages remain exact. The published V3 handler is archived in `production/functions`; the previous handler remains in `production/previous-functions` for rollback. All three candidate GitHub workflows, focused fixtures, live API checks and browser review passed. CI has returned to the production source-parity gate.

---

# Source parity verified — 2026-10-06

`npm run verify:backend-source` rebuilds all 38 handlers with the pinned Netlify packager and compares their executable files and bundled dependencies against the published archives. It also checks public route inventory and all five schedules. The check passed for deployment `6ac55dae44d5c8fe2f469850`; 34 focused recovery tests and the existing 24 production CI tests passed.

The source now restores the rotating three-question / 90-second Challenge, its test relays and rotation jobs, and the leaderboard refresh authorization response. The claim handler uses an isolated historical database adapter to preserve its production database preference and RPC behavior while the other Challenge handlers retain the newer adapter. Its compiled code matches after normalizing that adapter's source-label comment.

The comparison excludes Netlify-generated bootstrap, telemetry, and package metadata. It does not claim byte-identical ZIPs or authorize changing production runtimes, credentials, or publication. Keep the archived ZIPs as the release and rollback baseline. No production deployment or database mutation was made for this source restoration. Python 3 is required by the payload comparison, including CI.

---

# Current production — complete backend recovery, 2026-10-06

Deployment `6ac55dae44d5c8fe2f469850` is published in production context and locked. Source commit: `12d07ac0db1f50521043cd71bdb5032f93306336`. All 194 static files, 38 function packages, function configurations, and five schedules were verified against the approved release request.

Four original production packages are unchanged; the remaining 34 were reconstructed and validated on review deployment `6ac55ae1fefa47b10af44df6`. Direct leaderboard, full exposure, and behavioral badges completed successfully in review; all ten tabs opened, buy/sell quotes and wallet chooser worked, and Challenge retained three questions / 90 seconds. V3 metrics remain unverified and no wallet transaction was signed.

All 38 exact published ZIPs are now archived in `production/functions/` with SHA256 identities in `manifest.json`. Preserve these packages in future releases. The current source checkout alone is not a complete reproducible backend: recovered Challenge behavior and four restored function bundles must not be omitted by a rebuild. Production refresh credentials remain private in Netlify and are excluded from artifacts.

---

# Current production — Challenge claim correction, 2026-09-26

Deploy `6ab83984d79aa57ee13aadd3` is published and locked after PR #43,
merged commit `a185d1ecc40f40a844014cfd20f46b57a7d041bf`.

The September 22 Challenge award was immutably registered for 1,000 TREE, but
the browser had hard-coded the claim button, review, and success copy to say
50,000 TREE. `dapp/index.html` and `scripts/tree-knowledge-trial.js` now render
each award's recorded `amountRaw` and fail closed if that amount is malformed.
The claim path also passes the `Transaction` instance through simulation and
wallet approval without pre-building transaction bytes.

The `tree-knowledge-trial-claim` function now accepts the base64 `vector<u8>`
event representation returned by live Sui GraphQL, in addition to typed byte
arrays. This repaired post-claim reconciliation for transaction
`Ej9Wyaf8fWyLUf9sBAwu65wn2QWaVZYWkeY5DtfqyRvA`; the September 22 award is now
recorded as claimed. This release did not create or submit a Sui transaction.

All 194 static files were verified. The other 36 function packages and all five
schedules were preserved, while the exact updated claim-function ZIP is now
archived locally. Twenty focused tests, required CI, the protected candidate
inventory, live GraphQL verification, and production HTTP checks passed.

---

# Current production — Challenge funding panel, 2026-09-26

Deploy `6ab81d9ca3cdab704f81a86b` is published and locked after PR #41,
merged commit `ebeeb05732eef41432566c51ea2cf7fabea16bf2`.

Four public paths changed: `dapp/index.html`, `dapp/panel-router.css`,
`scripts/tree-knowledge-trial.js`, and the new
`dapp/challenge-funding-core.js`. The Challenge tab now exposes a funding panel
only to the designated funding wallet. The panel reads the live pool state,
warns when older scored awards may consume funding first, simulates the
deposit-only transaction twice, hands the `Transaction` instance to the wallet,
and waits for finalized effects.

All 194 static files were verified. All 37 function package/provider identities,
routes, runtime/invocation modes and five schedules were preserved. No backend
was rebuilt. Automatic publication remains locked. Fifteen focused checks,
production verification, the preview build, required CI, and a live browser
check passed. No Sui or TREE transaction was signed or submitted by the
assistant.

---

# Current production — STI wallet approval fix, 2026-09-24

Deploy `6ab52b651469a000c65232e3` is published and locked after PR #35,
merged commit `cb937a40855650d25ec1f30f45b75c5789396708`, reviewed source
`8ac47c26e96596307d4b8b77764a4bdb19ac7214`.

Only three public paths changed: `dapp/index.html`, `dapp/sti-widget.js`,
and `scripts/wallet.js`. STI now exposes explicit connect/manage controls,
requires an actual signer session, and separates asynchronous purchase review
from the final wallet approval gesture. Generic `sui` account metadata remains
compatible with the existing connection validation.

All 193 static files were verified. All 37 function package/provider identities,
routes, runtime/invocation modes and five schedules were preserved. Netlify now
serializes the documented 1024 MB and Ohio defaults explicitly in some function
records; both deployments report `cmh` and effective settings match. No backend
was rebuilt. Automatic publication remains locked.

53 focused checks passed, along with desktop/390px/320px approval browser tests
and required CI. The user reported a successful preview transaction; no
transaction was signed or submitted by the assistant. See
`sti-wallet-release-candidate.json`, `sti-wallet-release-report.json`, and
`current-release.json`. The previous STI bytes remain archived under
`sti-release-static/`. Historical STI inventory tests verify those archived
bytes, while current production verification uses the new manifest.

---

# Historical production — STI release, 2026-09-23

Deploy `6ab345e1b9c190b8487f1d7b` is published and locked after PR #32, merged commit `1fc415b63b2eeab0afc5a1ab8372085517a004b7` (candidate source `804d5d24c1007e9540c95d877a57c14d2d8ee8c9`). Native STI Stats includes the restored local index icon, basket segments, live Cetus STI/SUI price and index backing per STI. The reviewed native purchase route and safeguards remain intact; no third-party embed executes. Late Slush session restoration and preview Canopy reads were corrected before release.

All 193 static files are recorded in `manifest.json` and `current-release.json`. Both production and feature-preview builds now contain 193 unique files. All 37 existing production function packages, routes/configuration and five schedules were retained without rebuilding; only two exact function packages are available locally. Keep automatic production publishing locked and preserve running backend packages for frontend-only releases.

Validation: 56 focused tests, STI browser/visual QA at 1440/390/320 widths, six wallet-restoration scenarios, desktop/mobile nonblocking wallet picker checks, three bootstrap failure cases, required CI checks, production snapshot verification/build, exact hosted file inventory and eight changed public file hashes. Live V3, volume, liquidity and Knowledge Trial status APIs returned HTTP 200/ok. No transaction was signed or submitted. See `sti-verification-20260923.json` and the review evidence under `docs/sti-review/`.

The Canopy exposure/badge snapshots still return their pre-existing not-ready state. The unrelated legacy Arcade diagnostic remains non-blocking. The historical notes below describe earlier deployments and are not current release instructions.

---

# STI integration review — 2026-09-23

The STI branch includes current main through PRs #30/#31. Published file digests, release metadata, backend identities and schedules remain unchanged. Four original published files (`dapp/index.html`, `dapp/styles.css`, `dapp/interaction-bootstrap.js`, `scripts/wallet.js`) are archived under `production/live-static/`; the manifest now reads those copies to retain a reproducible production snapshot while the editable files contain the reviewed native STI integration.

`npm run verify:production` and `npm run build` verify/build the 189-file published baseline in `dist/`. `npm run build:preview` builds a separate 193-file candidate in `dist-preview/`, using public manifest paths (including supplementary assets), four explicit frontend overlays, and three explicit STI modules plus the local STI icon. `tests/sti-preview-build.test.mjs` checks every output digest and the complete candidate inventory.

Netlify Deploy Previews use only the separate public read proxy in `netlify/preview-functions/`. It accepts GET requests on explicit public endpoints, including Knowledge Trial status and the Canopy exposure/badge snapshots, and does not forward credentials or non-status actions. Existing production functions, schedules and state-changing APIs are not rebuilt. Knowledge Trial submissions and backend writes are deliberately unavailable in this review environment. STI quotes and unsigned simulations use the reviewed Mainnet path. Do not promote this review deployment or unlock automatic publication; an eventual production release must preserve all current backend packages and use a separately verified release inventory.

# Current production — 2026-09-23

Deploy `6ab31e7878c67aff72b0dc54` is published and locked from merged PR #30, source commit `dae05c8e9fdd675fb77caeac7e5507616b38cf98`. The V3 headline displays the verified SuiDex + Cetus + Turbos sum and fails closed. The only public-file change from the previous live release is `dapp/v3-workspace.js`. Knowledge Trial is preserved byte-for-byte; only the two read-only metrics functions were updated. All other 35 functions and five schedules are preserved. The STI Stats branch remains separate.

Validation: 24 focused tests, both GitHub workflows, production verification/build, live API and file-hash checks, and browser navigation checks passed. At verification, $16.46 + $59.692141830144 + $5.449790692352001 = $81.601932522496, displayed as $81.60. Stats navigation worked with its existing last-verified market snapshot fallback during a provider outage. See `current-release.json` and `verification-20260923.json`.

---

# Corrective release candidate — 2026-09-23

The release snapshot now reconciles all 189 files from locked production deploy `6ab219d0f2e18c9096895bf6`. The only intended public-file change relative to that deployment is `dapp/v3-workspace.js`: combine verified SuiDex, Cetus and Turbos 24-hour volume, reject missing/invalid values, and clear the headline while loading or on failure. Zero remains valid.

Knowledge Trial purchase verification, the live homepage/assets and litepaper are recovered byte-for-byte. 35 current backend packages and all five schedules must be reused, not rebuilt. Only tree-volume and tree-liquidity are updated: per-pool Cetus/Turbos coverage, bounded event pagination, and fail-closed incomplete coverage. Their reviewed source and exact packages are tracked under production/metrics-functions. None of the historical local ZIP archives are verified matches for the current packages. `release-baseline-20260923.json` records the live baseline; `manifest.json` describes candidate static bytes and required backend identities.

Use the authenticated preserved-package release script for preview and promotion. Do not deploy the root functions directory through an ordinary full-build deploy. Keep automatic publication locked. The STI Stats branch is excluded.

The production verification/build checks snapshot byte integrity; it does not assert backend source parity. Newly recovered supplementary deployed files are stored under `production/live-static` and built at their recorded public paths.

---

# Current production — 2026-09-18

VICTORY funding and MAX fixes are published and locked as deploy `6aad931f45a27f392303e229`, from GitHub commit `06211bf3f558b775ced7eb5dba2c90461f2487da` (PR #26). See [current-release.json](current-release.json) for the complete live static-file inventory, backend digests/configurations, five schedules, and previous deployment.

Only three public files changed: `dapp/earn-transactions-core.js`, `dapp/victory-center.js`, and `dapp/victory-transaction-core.js`. All 35 backend functions and the live generated Netlify configuration were preserved. The release reused the existing `kelpie-v3-release-safe` deployment context before promotion; this is a hosting context label, not the source branch. Kelpie remains V3-only.

The source snapshot manifest verifies repository file bytes. Its original deployment metadata and archived generated `deployed-netlify.toml` are historical; the current live configuration differs from that archive. Use `current-release.json` as the live deployment inventory, and preserve configuration directly from the published deployment for frontend-only releases.

Validation: nine focused suites, SDK funding checks, two unsigned seven-day-lock mainnet simulations, desktop/mobile browser checks, and user wallet preview confirmation passed. Unrelated legacy Arcade diagnostics remain non-blocking and visibly failing.

---

# Production baseline — 2026-09-15

This directory records the live TREE deployment `6aa70deff0b74e2bfe8b7725`, published September 13, 2026. Synchronizing this baseline does not publish a new deployment.

## Verified recovery

- All 166 deployed files have been recovered and verified against Netlify's SHA-1 inventory, including the protected deployed configuration.
- Public HTML, JavaScript, CSS, and assets are restored at their normal repository paths. The homepage includes its exact deployed compiled bundle; the prior editable source remains in Git history.
- `manifest.json` maps every deployed path to its repository source and records all 35 function identities/configurations and five schedules.
- `functions/` contains 30 exact deployed ZIP packages verified against Netlify's SHA-256 digests. These are recovery artifacts, not a directory to publish as public site files.
- `deployed-netlify.toml` preserves the historical generated configuration, including its old absolute build paths. The root configuration remains portable.

## Remaining source verification gap

Five locally cached function ZIPs differ from production: `tree-knowledge-trial`, `tree-knowledge-trial-admin`, `tree-knowledge-trial-resolver`, `tree-knowledge-trial-rotation-on-deploy`, and `tree-knowledge-trial-rotation-scheduled`.

Their exact deployed identities are retained in the manifest and their running packages remain on Netlify. Local source candidates were found and preserved under `recovery/source-candidates/`; they must not be represented as verified production source. The other existing `netlify/` sources also require a reproducible package comparison before a full backend rebuild. Do not replace these running packages merely to make a build pass.

## Verify and build

Run `npm run verify:production` to verify the recovered bytes and function archives. Run `npm run build` to create the exact 166-file static snapshot in `dist`. A different old build must first be preserved or removed. The build never copies function ZIPs, recovery candidates, or private server source into `dist`.

This is a production recovery baseline, not a new feature release. The VICTORY fix remains separately reviewable in PR #22; the Kelpie changes remain in PR #21. Neither is part of the captured live site.

## Keeping the repository synchronized

1. Begin future work from the synchronized `main` branch and commit changes on a feature branch.
2. Test a preview before publishing. Record the exact commit, static-file digests, function package digests, schedules, and resulting deployment ID.
3. For a frontend-only release while backend recovery is incomplete, retain the current verified backend package identities rather than rebuilding unrelated functions.
4. Update this baseline and manifest after an authorized production release, then fast-forward the computer's checkout.
5. Do not unlock automatic production publishing until the five missing exact function packages or equivalent source parity have been resolved and verified. The currently published deployment is locked during this synchronization to avoid an incidental full rebuild replacing it.

The separately dirty `tree-token-v3-repair` workspace was inspected read-only and remains untouched.
